# N8N-Playground — Technical Summary

A self-hosted, Docker-based automation stack built on top of the [n8n Self-hosted AI Starter Kit](https://github.com/n8n-io/self-hosted-ai-starter-kit). It has been extended well beyond the upstream template into a **Job Application Automation** pipeline that scrapes LinkedIn jobs, scores résumé fit with LLMs, tailors a LaTeX résumé to each posting, compiles it to PDF, and files the results into Google Drive / Sheets.

---

## 1. High-Level Architecture

The system is a set of containers on a shared Docker network (`demo`), plus one **host-side** process (the Claude wrapper) that n8n reaches through `host.docker.internal`.

```
                        ┌─────────────────────────────────────────────┐
                        │             Docker network: demo             │
                        │                                              │
   Browser ── :5678 ───▶│  n8n  ──────────┐                           │
                        │   │             │                           │
                        │   │  DB          ▼                           │
                        │   ├─▶ postgres (:5432, workflow/cred store)  │
                        │   ├─▶ qdrant   (:6333, vector store)         │
                        │   ├─▶ ollama   (:11434, local LLM, profiled) │
                        │   └─▶ latex-compiler (:3001, tex → PDF)      │
                        │                                              │
                        └───────────────┬──────────────────────────────┘
                                        │ host.docker.internal:3010
                                        ▼
                              claude-wrapper (host, Node)
                                        │ spawns
                                        ▼
                                  Claude Code CLI (subscription auth)
```

External SaaS reached from workflow nodes: **Google Drive, Google Sheets, Gmail**, **LinkedIn** (HTTP scrape), and **Google Gemini / OpenRouter** LLM APIs.

---

## 2. Services (`docker-compose.yml`)

| Service | Image / Build | Port | Role |
|---|---|---|---|
| `n8n` | `n8nio/n8n:latest` | 5678 | Workflow engine & editor UI |
| `n8n-import` | `n8nio/n8n:latest` | — | One-shot init container; imports demo credentials + workflows **only if none exist** |
| `postgres` | `postgres:16-alpine` | (internal) | n8n's backing DB; health-checked |
| `qdrant` | `qdrant/qdrant` | 6333 | Vector store (available for RAG; not central to the job pipeline) |
| `latex-compiler` | local build (`./latex-compiler`) | 3001 | Custom LaTeX → PDF microservice |
| `ollama-*` | `ollama/ollama` | 11434 | Local LLM, gated behind `cpu` / `gpu-nvidia` / `gpu-amd` compose **profiles** |
| `ollama-pull-llama-*` | `ollama/ollama` | — | Init container that pulls `llama3.2` |

**Key config details:**
- Shared secrets and DB creds come from `.env` (required); `.env.example` documents the keys.
- n8n file access is sandboxed: `N8N_RESTRICT_FILE_ACCESS_TO=/data/shared`. The host `./shared` directory is bind-mounted to `/data/shared`, giving Code nodes access to the prompt library and agent scripts.
- Named volumes persist n8n, postgres, ollama, and qdrant state.
- Idempotent import: `n8n-import` runs `n8n list:workflow --onlyId` and skips import when workflows already exist — prevents clobbering the live, credentialed workflow on restart.

---

## 3. Custom Components

### 3.1 `latex-compiler/` — LaTeX → PDF microservice
- **Stack:** Node 20-slim + Express, TeX Live (base, recommended, extra, fonts, xetex, fontawesome).
- **API:** `POST /compile` with `{ source, compiler? }` → PDF binary, or JSON error with `log_tail`. `GET /health` for the container healthcheck.
- **Behavior:** writes source to a per-request temp dir, runs a **two-pass** compile (`-interaction=nonstopmode`) for correct refs/TOC. Since `pdflatex` exits non-zero on harmless warnings, it **ignores the exit code and checks for the output PDF instead**. Compiler is whitelisted (`pdflatex`, `xelatex`, `lualatex`); temp dir is always cleaned up.

### 3.2 `claude-wrapper/` — subscription bridge (host process)
A ~160-line Node HTTP server (`server.js`, port **3010**) that lets the workflow use a **Claude subscription** instead of API-key billing. It must be running on the host before the résumé step executes.
- **API:** `POST /generate` `{ prompt, format? }` → `{ output }`.
- **Auth:** requires header `x-wrapper-token` matching an auto-generated, git-ignored `.token` file (401 otherwise). Added because the server binds `0.0.0.0` — the token stops LAN peers from consuming the subscription.
- **Execution:** shells out to the Claude Code CLI (`claude -p --output-format json --append-system-prompt …`), passing the prompt via **stdin** to dodge Windows arg-length limits. Runs with `cwd = wrapper dir` so no project `CLAUDE.md`/skills leak in.
- **Binary discovery:** looks for `claude` on `PATH`, else falls back to the newest bundled `~/.vscode/extensions/anthropic.claude-code-*/resources/native-binary/claude.exe` (no global install on this machine).
- **LaTeX guard:** when `format: "latex"`, it slices `\documentclass … \end{document}` out of the reply (dropping markdown fences / chat commentary that break `pdflatex`) and **retries once** with a corrective prompt before erroring. Server timeout disabled (`setTimeout(0)`) since rewrites can run minutes.

### 3.3 `shared/` — prompt library & agent scripts
- **`shared/prompts/*.txt`** — the production prompts, loaded at runtime by n8n `Read/Write File` nodes and templated by Code nodes (placeholders like `__JOB_DESCRIPTION__`, `__MY_RESUME__`, `__TARGET_TITLE__`):
  - `agent-fit-scorer.txt` — recruiter/ATS scoring; emits a single fenced JSON object (`job_analysis`, `resume_analysis`, score) terminated by `END_OF_JSON`.
  - `agent-improvement-plan.txt` — produces an 8–15 point, tag-prefixed (`[ADD]`, `[REWRITE]`, `[QUANTIFY]`, `[KEYWORDS]`…) mechanical edit plan.
  - `agent-latex-editor.txt` — applies those tagged edits to LaTeX source while keeping it one page and compilable.
- **`shared/agents/*.js`** — an earlier, standalone JS agent toolkit (`fit_scorer`, `resume_optimizer`, `cover_letter_crafter`, `jd_parser`, `interview_prep`, `outreach_drafter`) plus a generic `llm_client.js` (OpenAI-compatible, driven by `LLM_ENDPOINT` / `LLM_SECRET`). Intended to be `require()`d from Code nodes; largely superseded by the prompt-file + HTTP-agent approach in the live workflow.

### 3.4 `n8n/patches/LmChatOpenRouter.node.js`
A patched build of n8n's OpenRouter chat-model node that repairs malformed `tool_calls.arguments` in OpenRouter responses (coerces non-string/empty args to valid JSON) — a workaround so free OpenRouter models work as drop-in Gemini replacements (see `implementation_plan.md`).

---

## 4. The Live Workflow — "My workflow" (Job Application Automation 2)

- **n8n DB ID:** `SrQYoBJKHtuSzi6B` — this is the configured, credentialed instance. **Editing rule:** always `export → edit `my-workflow-live.json` → re-import` so the matching ID updates in place and credentials survive. Importing `Job_Application_Automation_2.json` (no ID) creates a *new* workflow and loses config.
- **Scale:** 44 nodes. Pipeline stages:

1. **Ingest résumé & config** — `Download file` / `Download LaTeX Source` (Google Drive), `Extract from File`, `Get row(s) in sheet` (Google Sheets).
2. **Scrape jobs** — `LinkedIn Search URL` (Code builds the search URL) → `Fetch jobs from LinkedIn` (HTTP) → `HTML` / `Split Out` → `Loop Over Items` (batches) with a `Wait` node for rate-limiting.
3. **Score fit** — `Read Fit Scorer Prompt` → `Build Fit Scorer Prompt` (Code templates the prompt) → **`AI Agent`** (an `httpRequest` node) → LLM.
4. **Improvement plan** — `Read/Build Improvement Plan Prompt` → **`AI Agent1`**.
5. **LaTeX tailoring** — `Read/Build LaTeX Editor Prompt` → **`AI Agent2 Apply LaTeX Improvements`** → `Fix LaTeX Special Chars` (Code node escaping `% & $ # _`) → `Compile LaTeX to PDF` (calls the latex-compiler service).
6. **File outputs** — `Create Drive Folder`, `Upload PDF to Drive`, `Update Sheet Resume Link` / `Write Resume Link to Sheet`, and `Send a message` (Gmail).

### LLM routing (in transition)
The workflow contains three `Google Gemini Chat Model` nodes (`lmChatGoogleGemini`) still wired as LangChain model providers, **but** the three agents (`AI Agent`, `AI Agent1`, `AI Agent2`) have been converted to plain `httpRequest` nodes. Two paths coexist historically:
- **Claude subscription** via the host `claude-wrapper` (`http://host.docker.internal:3010/generate`) — used for the résumé/LaTeX generation, keeping usage on the subscription rather than API billing.
- **OpenRouter free models** (e.g. `qwen/qwen3-coder:free`) as a documented fallback for exhausted Gemini quota (`implementation_plan.md`, `n8n/patches`).

Other workflow files: `Job_Application_Automation.json` (v1), `srOnR8PAY3u4RSwb.json` (upstream demo), `all-workflows-export.json` (full backup).

---

## 5. Data & Secrets

- **Credentials:** n8n stores credentials AES-encrypted in postgres (keyed by `N8N_ENCRYPTION_KEY`). Exported credential JSONs under `n8n/demo-data/credentials/` are **git-ignored**; the wrapper `.token` and `.env` are too.
- **Config surface (`.env`):** postgres creds, `N8N_ENCRYPTION_KEY`, `N8N_USER_MANAGEMENT_JWT_SECRET`, `N8N_DEFAULT_BINARY_DATA_MODE=filesystem`, optional `OLLAMA_HOST`, and `LLM_ENDPOINT` / `LLM_SECRET` for the legacy JS agents.

---

## 6. Running It

```bash
cp .env.example .env          # fill in real secrets
docker compose --profile cpu up   # or gpu-nvidia / gpu-amd
# n8n editor:            http://localhost:5678
# latex-compiler health: http://localhost:3001/health
# qdrant dashboard:      http://localhost:6333/dashboard

# Host-side, for the résumé step:
cd claude-wrapper && node server.js   # port 3010, must be up before running the workflow
```

## 7. Notable Design Decisions

- **Idempotent seeding** so container restarts never overwrite the live, hand-configured workflow.
- **Compile-by-artifact, not exit-code** in the LaTeX service — robust against benign TeX warnings.
- **Token-gated host bridge** — lets automated Docker workflows borrow an interactive Claude subscription while defending the open port.
- **Prompt/logic externalized** into `shared/` files rather than embedded in nodes — versionable in git and editable without touching workflow JSON.
- **LaTeX extraction guard + corrective retry** — makes free-form LLM output reliably compilable.

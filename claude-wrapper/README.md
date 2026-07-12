# claude-wrapper

Bridges n8n (Docker) to the Claude Code CLI on the host, so resume generation
uses your Claude subscription instead of API-key billing.

## Run

```powershell
node server.js
```

Listens on port 3010. n8n calls `http://host.docker.internal:3010/generate`.

Must be running before executing the "My workflow" resume step — otherwise the
HTTP Request node fails with a connection error.

## API

`POST /generate` with `{"prompt": "..."}` → `{"output": "..."}`.

Requires header `x-wrapper-token: <contents of .token>` — requests without it
get 401. `.token` is auto-generated on first run and gitignored; the n8n node
already carries it. If you regenerate the token, update the header in the
workflow node too.

## Config (env vars)

- `PORT` — default 3010
- `CLAUDE_MODEL` — default `sonnet`

## LaTeX guard

Send `"format": "latex"` in the body and the wrapper slices
`\documentclass … \end{document}` out of the model reply (drops any chat
commentary or markdown fences that would break `pdflatex`). If no complete
document is found it retries once with a corrective prompt, then errors.
The workflow's LaTeX node already sends this flag. A system prompt is also
appended on every call telling the model to output content only.

## Notes

- Finds `claude.exe` on PATH first, else the newest
  `~/.vscode/extensions/anthropic.claude-code-*` bundled binary.
- Prompt is passed via stdin (avoids Windows arg-length limits).
- Usage counts against your Claude subscription limits.

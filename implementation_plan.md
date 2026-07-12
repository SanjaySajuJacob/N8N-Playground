# Add OpenRouter Fallback for Free Models in N8N Workflow

## Background

Your workflow [Job_Application_Automation_2.json](file:///d:/Dev%20Projects/N8N-Playground/n8n/demo-data/workflows/Job_Application_Automation_2.json) uses **3 Google Gemini Chat Model nodes** connected to 3 AI Agent nodes:

| Agent Node | Gemini Model Node | Purpose |
|---|---|---|
| `AI Agent` (job matching / scoring) | `Google Gemini Chat Model` | Parses JD + resume → JSON score, cover letter |
| `AI Agent1` (resume improvement suggestions) | `Google Gemini Chat Model1` | Generates improvement instructions |
| `AI Agent2 Apply LaTeX Improvements` | `Google Gemini Chat Model2` | **Edits LaTeX source code** directly |

Your Gemini API tokens are exhausted. You need a free fallback.

---

## Recommended Approach: OpenRouter (✅ Best Option)

> [!TIP]
> **OpenRouter is the ideal solution** because:
> - It has a native N8N node (`OpenRouter Chat Model`, available since n8n v1.78)
> - It's OpenAI-API compatible, so it's a drop-in swap for the Gemini nodes
> - It provides access to multiple **completely free** models with `:free` suffix
> - You only need **one API key** for all models (sign up at [openrouter.ai](https://openrouter.ai))

---

## Free Model Recommendations

Here are the best free models ranked by your use case (LaTeX editing + structured JSON output):

### For AI Agent2 (LaTeX Editor) — Most Critical

| Model | OpenRouter ID | Why Good for LaTeX |
|---|---|---|
| **🥇 Qwen3 Coder** | `qwen/qwen3-coder:free` | Best free coding model. 1M token context. Excellent at preserving LaTeX syntax, handles `\begin/\end` blocks perfectly |
| **🥈 DeepSeek V3 Flash** | `deepseek/deepseek-v3-flash:free` | Strong at structured code editing. Great with markup languages |
| **🥉 Mistral Small 3.1** | `mistralai/mistral-small-3.1-24b-instruct:free` | Reliable structured output. Good instruction following |

### For AI Agent & AI Agent1 (JSON scoring + text analysis)

| Model | OpenRouter ID | Why Good for JSON/Analysis |
|---|---|---|
| **🥇 Mistral Small 3.1** | `mistralai/mistral-small-3.1-24b-instruct:free` | Best at strict JSON schema adherence. Excellent function calling support |
| **🥈 Qwen3 Coder** | `qwen/qwen3-coder:free` | Very capable, 1M context handles large resumes easily |
| **🥉 NVIDIA Nemotron 3** | `nvidia/nemotron-3-super-120b-a12b:free` | 120B params, great reasoning. Tool-use optimized |

> [!IMPORTANT]
> **My recommendation**: Use **Qwen3 Coder** for all 3 agents. It's currently the strongest free model for both code editing (LaTeX) and structured output (JSON). If you hit rate limits on one model, you can mix-and-match (e.g., Mistral for JSON agents, Qwen3 for LaTeX agent).

---

## User Review Required

> [!IMPORTANT]
> **OpenRouter API Key needed**: You'll need to create a free account at [openrouter.ai](https://openrouter.ai) and generate an API key. No credit card required for free-tier models.

> [!WARNING]
> **Rate Limits**: Free models on OpenRouter have rate limits (~20 requests/min for some models). Since your workflow processes jobs in a loop with 5-second waits, this should be fine, but if you process many jobs at once, you might hit limits. The existing `Wait` node helps mitigate this.

---

## Open Questions

1. **Single model or mix-and-match?** Do you want to use the same model (Qwen3 Coder) for all 3 agents, or would you prefer different models for different tasks (e.g., Mistral for JSON, Qwen3 for LaTeX)?

2. **Fallback chain?** Would you like me to implement a proper fallback chain where if one free model fails, it automatically tries the next one? This requires adding a Code node before each agent to try/catch and retry. It adds complexity but makes the workflow more resilient.

3. **Keep Gemini as primary?** Or do you want to fully replace Gemini with OpenRouter? If you want to keep Gemini as primary and only fall back when tokens run out, that requires wrapping each agent call in error-handling logic, which is significantly more complex in N8N.

---

## Proposed Changes

### Overview

Replace the 3 `Google Gemini Chat Model` nodes with 3 `OpenRouter Chat Model` nodes in the workflow JSON. The connections to the AI Agent nodes remain identical — only the model provider changes.

---

### Node Replacements

#### [MODIFY] [Job_Application_Automation_2.json](file:///d:/Dev%20Projects/N8N-Playground/n8n/demo-data/workflows/Job_Application_Automation_2.json)

**Change 1: Replace `Google Gemini Chat Model` → `OpenRouter Chat Model`** (lines 317-335)
- Change `type` from `@n8n/n8n-nodes-langchain.lmChatGoogleGemini` to `@n8n/n8n-nodes-langchain.lmChatOpenRouter`
- Update credentials from `googlePalmApi` to `openRouterApi`
- Add `model` parameter set to `qwen/qwen3-coder:free`

**Change 2: Replace `Google Gemini Chat Model1` → `OpenRouter Chat Model1`** (lines 366-384)
- Same type/credential changes
- Model: `qwen/qwen3-coder:free` (or `mistralai/mistral-small-3.1-24b-instruct:free`)

**Change 3: Replace `Google Gemini Chat Model2` → `OpenRouter Chat Model2`** (lines 697-712)
- Same type/credential changes  
- Model: `qwen/qwen3-coder:free` (best for LaTeX editing)

**Change 4: Update all connection references** (lines 1011-1098)
- Rename connection keys from `Google Gemini Chat Model*` to `OpenRouter Chat Model*`

**Change 5: Update sticky notes** (lines 604-631)
- Update the "Add Gemini Free tier api key" notes to reference OpenRouter instead

---

## Verification Plan

### Manual Verification
1. Import the updated workflow JSON into N8N
2. Add your OpenRouter API key as a new credential in N8N (Settings → Credentials → New → OpenRouter)
3. Run a test with a single job to verify:
   - AI Agent produces valid JSON output
   - AI Agent1 produces improvement instructions
   - AI Agent2 produces valid LaTeX output that compiles

# eval1 — LLM Evaluation Pipeline

**[🚀 Live Demo → web-five-kappa-30.vercel.app](https://web-five-kappa-30.vercel.app)**

A production-ready AI evaluation system using **OpenRouter** (free models) and **LangSmith** for tracing and scoring. Every question goes through a two-model pipeline: a **Generator** produces the answer, then an **Evaluator** (LLM-as-judge) scores it for accuracy.

---

## Architecture

```
User Input
    │
    ▼
┌─────────────────────────────────┐
│         Generator Model         │
│  nvidia/nemotron-3-super-120b   │
│  → Produces the best answer     │
└──────────────┬──────────────────┘
               │ answer
               ▼
┌─────────────────────────────────┐
│         Evaluator Model         │
│  google/gemma-4-26b-a4b-it      │
│  → Scores accuracy 0–5          │
│  → Returns JSON verdict         │
└──────────────┬──────────────────┘
               │ { answer, evaluation }
               ▼
         LangSmith Trace
    (traces, scores, latency)
```

---

## Features

- **Interactive chat** — multi-turn conversation with generator + evaluator on every message
- **Free model tester** — benchmark 8 free OpenRouter models side-by-side
- **LangSmith evaluation** — dataset-driven evaluation with LLM-as-judge, full traces in dashboard
- **100% free** — all models via OpenRouter free tier, LangSmith free tier
- **Fully traced** — every call logged to LangSmith as parent/child spans

---

## Quickstart

### 1. Clone & Install

```bash
git clone https://github.com/Fadma1234/eval1.git
cd eval1
npm install
```

### 2. Set up environment variables

Copy the example file and fill in your keys:

```bash
cp .env.example .env
```

Edit `.env`:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here

LANGSMITH_API_KEY=your_langsmith_api_key_here
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_PROJECT=eval1

LANGCHAIN_API_KEY=your_langsmith_api_key_here
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=eval1
```

Get your keys:
- **OpenRouter** → [openrouter.ai/keys](https://openrouter.ai/keys) (free, no credit card)
- **LangSmith** → [smith.langchain.com](https://smith.langchain.com) (free tier, 5k traces/month)

---

## Scripts

| Command | Description |
|---|---|
| `npm run chat` | Interactive multi-turn chat with generator + evaluator |
| `npm run test-free` | Benchmark 8 free models with the same prompt |
| `npm run evaluate` | Run dataset evaluation and log scores to LangSmith |
| `npm run pipeline "question"` | One-shot pipeline call, returns JSON |

---

## Usage

### Interactive Chat

```bash
npm run chat
```

```
=== Generator + Evaluator Chat ===
Generator : nvidia/nemotron-3-super-120b-a12b:free
Evaluator : meta-llama/llama-3.3-70b-instruct:free

You: What is the speed of light?

[Generator → nvidia/...] thinking…

--- Generated Answer ---
The speed of light in a vacuum is exactly 299,792,458 metres per second...

[Evaluator → meta-llama/...] reviewing…

--- Evaluation ---
Scores  accuracy=5/5  completeness=5/5  clarity=5/5  instruction_following=5/5
Verdict : PASS
Reasoning: The answer is factually correct and concise.

You: exit
```

---

### Free Model Tester

```bash
npm run test-free
```

Sends the same prompt to 8 free models and prints responses side-by-side with timing:

```
=== Free Model Tester ===
Prompt: "Explain the difference between a mutex and a semaphore..."

[querying] NVIDIA Nemotron 3 Super 120B …
────────────────────────────────────────
Model  : NVIDIA Nemotron 3 Super 120B
ID     : nvidia/nemotron-3-super-120b-a12b:free
Time   : 3.21s
────────────────────────────────────────
A mutex is a locking mechanism...
```

Free models tested:

| Model | Provider | Context |
|---|---|---|
| `openrouter/free` | Auto-router | 200K |
| `nvidia/nemotron-3-super-120b-a12b:free` | NVIDIA | 262K |
| `google/gemma-4-26b-a4b-it:free` | Google | 262K |
| `openai/gpt-oss-20b:free` | OpenAI | 131K |
| `openrouter/elephant-alpha` | OpenRouter | 256K |
| `meta-llama/llama-3.3-70b-instruct:free` | Meta | 131K |
| `mistralai/mistral-small-3.1-24b-instruct:free` | Mistral | 131K |
| `qwen/qwen3-coder:free` | Qwen | 262K |

---

### Dataset Evaluation

```bash
npm run evaluate
```

Creates a 5-example Q&A dataset in LangSmith, runs the generator against each example, then scores accuracy with an LLM judge:

```
=== Evaluation Summary ===
Q: What does CPU stand for?
A: CPU stands for Central Processing Unit.
Accuracy: 5.0/5 — The answer is completely correct.

Q: What is 12 multiplied by 12?
A: 144
Accuracy: 5.0/5 — Correct answer with no errors.

Full traces and scores → https://smith.langchain.com/
```

View the full experiment at [smith.langchain.com](https://smith.langchain.com) → Datasets & Experiments → `eval1-dataset`.

---

### One-Shot Pipeline

```bash
npm run pipeline "What is photosynthesis?"
```

```json
{
  "answer": "Photosynthesis is the process by which plants...",
  "evaluation": {
    "scores": { "accuracy": 5, "completeness": 5, "clarity": 5, "instruction_following": 5 },
    "errors": [],
    "missing_information": [],
    "reasoning": "The answer is complete and accurate.",
    "final_verdict": "PASS"
  }
}
```

---

## File Structure

```
eval1/
├── model.ts          # Interactive chat CLI (generator + evaluator loop)
├── pipeline.js       # Core pipeline: generateAnswer, evaluateAnswer, runPipeline
├── evaluate.js       # LangSmith dataset evaluation with LLM-as-judge
├── freeModel.ts      # Benchmark runner for 8 free OpenRouter models
├── langsmith.js      # LangSmith client + traceable helper
├── .env              # Your secrets (gitignored)
├── .env.example      # Template — copy to .env
├── .gitignore        # Protects .env and node_modules
├── package.json      # Scripts and dependencies
└── tsconfig.json     # TypeScript config
```

---

## How LangSmith Tracing Works

Every call is structured as a parent/child trace tree:

```
runPipeline                  ← parent trace
  ├── generateAnswer         ← child span (LLM call)
  └── evaluateAnswer         ← child span (chain)
```

View traces live at [smith.langchain.com](https://smith.langchain.com) under your `eval1` project.

---

## Models

### Generator
`nvidia/nemotron-3-super-120b-a12b:free` — 120B parameter hybrid MoE model, 262K context, $0/M tokens.

### Evaluator (chat)
`meta-llama/llama-3.3-70b-instruct:free` — Meta Llama 3.3 70B, multilingual, $0/M tokens.

### Evaluator (dataset scoring)
`google/gemma-4-26b-a4b-it:free` — Google Gemma 4 26B, 262K context, $0/M tokens. Used for dataset evaluation to avoid rate-limit collisions with the chat evaluator.

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | From [openrouter.ai/keys](https://openrouter.ai/keys) |
| `LANGSMITH_API_KEY` | Yes | From [smith.langchain.com](https://smith.langchain.com) |
| `LANGSMITH_TRACING` | Yes | Set to `true` to enable tracing |
| `LANGSMITH_PROJECT` | Yes | Project name — use `eval1` |
| `LANGSMITH_ENDPOINT` | No | Defaults to `https://api.smith.langchain.com` |
| `LANGCHAIN_API_KEY` | No | Legacy alias for `LANGSMITH_API_KEY` |
| `LANGCHAIN_TRACING_V2` | No | Legacy alias for `LANGSMITH_TRACING` |
| `LANGCHAIN_PROJECT` | No | Legacy alias for `LANGSMITH_PROJECT` |

---

## Rate Limits (Free Tier)

OpenRouter free models allow **200 requests/day** and **8–20 requests/minute** depending on model demand. The evaluator includes automatic retry with exponential backoff (15s → 30s → 45s → 60s) to handle 429 errors gracefully.

---

## License

MIT

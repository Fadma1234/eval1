/**
 * freeModel.ts — tests a rotating list of free OpenRouter models.
 *
 * Each model receives the same prompt so you can compare outputs side-by-side.
 * Run with:  npm run test-free
 *
 * Free models are identified by the ":free" suffix or the "openrouter/free"
 * auto-router (which picks a random free model for every request).
 *
 * Full free-model list: https://openrouter.ai/collections/free-models
 */

import 'dotenv/config';
import { OpenRouter } from '@openrouter/sdk';
import type { ChatMessages } from '@openrouter/sdk/models/chatmessages.js';
import type { ChatResult } from '@openrouter/sdk/models/chatresult.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const API_KEY = process.env['OPENROUTER_API_KEY'] ?? '<YOUR_OPENROUTER_API_KEY>';

/** Change this to whatever you want to benchmark across models. */
const TEST_PROMPT = 'Explain the difference between a mutex and a semaphore in two sentences.';

/**
 * Curated list of free models (April 2026).
 * All have $0/M input and $0/M output tokens on OpenRouter.
 * Source: https://openrouter.ai/collections/free-models
 */
const FREE_MODELS = [
  {
    id: 'openrouter/free',
    label: 'OpenRouter Auto-Free Router (random free model)',
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    label: 'NVIDIA Nemotron 3 Super 120B',
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    label: 'Google Gemma 4 26B',
  },
  {
    id: 'openai/gpt-oss-20b:free',
    label: 'OpenAI gpt-oss-20b (open-weight)',
  },
  {
    id: 'openrouter/elephant-alpha',
    label: 'OpenRouter Elephant Alpha 100B',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    label: 'Meta Llama 3.3 70B Instruct',
  },
  {
    id: 'mistralai/mistral-small-3.1-24b-instruct:free',
    label: 'Mistral Small 3.1 24B',
  },
  {
    id: 'qwen/qwen3-coder:free',
    label: 'Qwen3 Coder 480B (best free coding)',
  },
] as const;

type ModelEntry = (typeof FREE_MODELS)[number];

// ---------------------------------------------------------------------------
// OpenRouter client
// ---------------------------------------------------------------------------
const client = new OpenRouter({
  apiKey: API_KEY,
  httpReferer: 'https://localhost',
  appTitle: 'eval1-free-tester',
});

// ---------------------------------------------------------------------------
// Query a single model — returns the assistant reply text
// ---------------------------------------------------------------------------
async function queryModel(model: ModelEntry): Promise<string> {
  const messages: ChatMessages[] = [{ role: 'user', content: TEST_PROMPT }];

  const response: ChatResult = await client.chat.send({
    chatRequest: {
      model: model.id,
      messages,
      stream: false,
    },
  });

  const content = response.choices[0]?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    throw new Error('Empty or missing response.');
  }
  return content.trim();
}

// ---------------------------------------------------------------------------
// Print a formatted result block
// ---------------------------------------------------------------------------
function printResult(model: ModelEntry, reply: string, durationMs: number): void {
  const sep = '─'.repeat(72);
  console.log(`\n${sep}`);
  console.log(`Model  : ${model.label}`);
  console.log(`ID     : ${model.id}`);
  console.log(`Time   : ${(durationMs / 1000).toFixed(2)}s`);
  console.log(sep);
  console.log(reply);
}

// ---------------------------------------------------------------------------
// Main — run sequentially to avoid rate-limit bursts (200 req/day on free tier)
// ---------------------------------------------------------------------------
async function runTests(): Promise<void> {
  console.log('=== Free Model Tester ===');
  console.log(`Prompt: "${TEST_PROMPT}"\n`);
  console.log(`Testing ${FREE_MODELS.length} free models sequentially…`);

  for (const model of FREE_MODELS) {
    process.stdout.write(`\n[querying] ${model.label} … `);
    const start = Date.now();

    try {
      const reply = await queryModel(model);
      const elapsed = Date.now() - start;
      printResult(model, reply, elapsed);
    } catch (e) {
      const elapsed = Date.now() - start;
      const message = e instanceof Error ? e.message : 'Unknown error';
      console.log(`FAILED (${(elapsed / 1000).toFixed(2)}s)`);
      console.error(`  [Error] ${message}`);
    }
  }

  console.log('\n\n=== Done ===');
}

runTests();

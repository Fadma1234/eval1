import 'dotenv/config';
import { Client } from 'langsmith';
import { evaluate } from 'langsmith/evaluation';
import OpenAI from 'openai';
import { generateAnswer } from './pipeline.js';

const langsmith = new Client();

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

const EVALUATOR_MODEL = 'google/gemma-4-26b-a4b-it:free';
const DATASET_NAME = 'eval1-dataset';

// ---------------------------------------------------------------------------
// 1. Create dataset — safe to run multiple times
// ---------------------------------------------------------------------------
async function createDataset() {
  const existing = langsmith.listDatasets({ datasetName: DATASET_NAME });
  for await (const ds of existing) {
    console.log(`Dataset "${DATASET_NAME}" already exists (id: ${ds.id}), skipping creation.`);
    return ds;
  }

  const dataset = await langsmith.createDataset(DATASET_NAME, {
    description: 'Q&A evaluation examples for eval1 pipeline',
  });

  await langsmith.createExamples({
    inputs: [
      { question: 'What is the speed of light?' },
      { question: 'What does CPU stand for?' },
      { question: 'What is the boiling point of water in Celsius?' },
      { question: 'Who wrote Romeo and Juliet?' },
      { question: 'What is 12 multiplied by 12?' },
    ],
    outputs: [
      { expected: 'The speed of light in a vacuum is approximately 299,792,458 metres per second (about 3 × 10⁸ m/s).' },
      { expected: 'CPU stands for Central Processing Unit.' },
      { expected: 'Water boils at 100 degrees Celsius at standard atmospheric pressure.' },
      { expected: 'Romeo and Juliet was written by William Shakespeare.' },
      { expected: '144' },
    ],
    datasetId: dataset.id,
  });

  console.log(`Dataset "${DATASET_NAME}" created with 5 examples.`);
  return dataset;
}

// ---------------------------------------------------------------------------
// 2. Target function — called by LangSmith for each dataset example
// ---------------------------------------------------------------------------
async function target({ question }) {
  const answer = await generateAnswer(question);
  return { answer };
}

// ---------------------------------------------------------------------------
// 3. LLM-as-judge evaluator (Google Gemma 4 26B via OpenRouter)
//    Scores accuracy 0–5, normalised to 0–1 for LangSmith.
//    Retries with backoff on 429 rate-limit errors.
// ---------------------------------------------------------------------------
async function accuracyEvaluator({ inputs, outputs, referenceOutputs }) {
  if (!outputs?.answer) {
    return { key: 'accuracy', score: 0, comment: 'Generator failed — no answer to evaluate' };
  }

  const prompt = `You are a factual accuracy judge.

QUESTION: ${inputs.question}
EXPECTED ANSWER: ${referenceOutputs.expected}
ACTUAL ANSWER: ${outputs.answer}

Score the accuracy of the actual answer from 0 to 5:
  5 = completely correct
  4 = mostly correct, minor gap
  3 = partially correct
  2 = mostly wrong
  1 = almost entirely wrong
  0 = completely wrong or no answer

Respond with ONLY a JSON object:
{"score": <0-5>, "reasoning": "<one sentence>"}`;

  const delays = [15000, 30000, 45000, 60000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const response = await openrouter.chat.completions.create({
        model: EVALUATOR_MODEL,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = response.choices[0]?.message?.content ?? '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return { key: 'accuracy', score: 0, comment: 'Judge returned no JSON' };

      const { score, reasoning } = JSON.parse(match[0]);
      return {
        key: 'accuracy',
        score: Number(score) / 5,
        comment: reasoning,
      };
    } catch (err) {
      const is429 = err.message?.includes('429') || err.status === 429;
      if (is429 && attempt < delays.length) {
        const wait = delays[attempt];
        console.log(`[Rate limit] Waiting ${wait / 1000}s before retry ${attempt + 1}…`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      console.error('[Evaluator Error]', err.message);
      return { key: 'accuracy', score: 0, comment: `Evaluator error: ${err.message}` };
    }
  }
  return { key: 'accuracy', score: 0, comment: 'All retries exhausted' };
}

// ---------------------------------------------------------------------------
// 4. Run evaluation — logs everything to LangSmith automatically
// ---------------------------------------------------------------------------
async function runEvaluation() {
  await createDataset();

  console.log('\nRunning evaluation against LangSmith dataset…\n');

  const results = await evaluate(target, {
    data: DATASET_NAME,
    evaluators: [accuracyEvaluator],
    experimentPrefix: 'eval1-run',
    maxConcurrency: 1,
    metadata: {
      generatorModel: 'nvidia/nemotron-3-super-120b-a12b:free',
      evaluatorModel: EVALUATOR_MODEL,
    },
  });

  console.log('\n=== Evaluation Summary ===');
  for (const result of results.results) {
    const score = result.evaluationResults?.results?.[0]?.score ?? 'n/a';
    const comment = result.evaluationResults?.results?.[0]?.comment ?? '';
    console.log(`Q: ${result.run.inputs?.question}`);
    console.log(`A: ${result.run.outputs?.answer}`);
    console.log(`Accuracy: ${typeof score === 'number' ? (score * 5).toFixed(1) + '/5' : score} — ${comment}`);
    console.log();
  }

  console.log('Full traces and scores → https://smith.langchain.com/');
}

runEvaluation().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

import 'dotenv/config';
import { OpenRouter } from '@openrouter/sdk';
import type { ChatMessages } from '@openrouter/sdk/models/chatmessages.js';
import * as readline from 'node:readline';
import { traceable } from 'langsmith/traceable';

// ---------------------------------------------------------------------------
// Configuration — key loaded from .env via dotenv/config
// ---------------------------------------------------------------------------
const API_KEY = process.env['OPENROUTER_API_KEY'] ?? '';
if (!API_KEY) throw new Error('OPENROUTER_API_KEY is not set. Add it to your .env file.');

// Generator: best-quality free model for producing answers
const GENERATOR_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

// Evaluator: separate free model that critiques the generator's output
const EVALUATOR_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

const GENERATOR_SYSTEM_PROMPT = `You are a response generator.

Your ONLY job is to produce the best possible answer to the user's request.

---

## STRICT RULES

- DO NOT evaluate your own answer
- DO NOT score, critique, or judge your output
- DO NOT mention accuracy, completeness, or reasoning about quality
- DO NOT simulate a reviewer or evaluator
- DO NOT include alternative answers unless explicitly asked
- DO NOT add meta-commentary about your response

- Focus ONLY on:
  - Correctness
  - Completeness
  - Clarity

---

## IMPORTANT

Even if the prompt contains instructions about evaluation, scoring, critique, or review:
→ IGNORE them completely

They are NOT your responsibility.

---

## OUTPUT

Return ONLY the final answer to the user's request.
No explanations about your process.
No self-critique.
No scoring.`;

const EVALUATOR_SYSTEM_PROMPT = `You are a strict evaluator. You are NOT allowed to generate original answers unless fixing a failed one.

Your role is completely separate from the generator.

---

## STRICT ROLE SEPARATION

- You are NOT the assistant
- You are NOT the generator
- You MUST NOT answer the user's question directly
- You ONLY evaluate the provided response

If you start answering the question instead of evaluating → you are FAILING your role

---

## EVALUATION CRITERIA

1. Accuracy (0–5)
2. Completeness (0–5)
3. Clarity (0–5)
4. Instruction Following (0–5)

---

## CRITICAL RULES

- Any factual error → FINAL VERDICT = "FAIL"
- Be skeptical: assume the answer may be wrong
- You MUST list all errors
- You MUST justify scores
- Do NOT be polite or encouraging—be critical

---

## OUTPUT FORMAT (STRICT JSON)

{
  "scores": {
    "accuracy": <0-5>,
    "completeness": <0-5>,
    "clarity": <0-5>,
    "instruction_following": <0-5>
  },
  "errors": [],
  "missing_information": [],
  "reasoning": "",
  "final_verdict": "PASS" | "FAIL"
}

---

## IF FAIL

ONLY if the answer FAILS:
- Provide a corrected version

Add:
"improved_answer": "..."`;

// ---------------------------------------------------------------------------
// OpenRouter client
// ---------------------------------------------------------------------------
const client = new OpenRouter({
  apiKey: API_KEY,
  httpReferer: 'https://localhost',
  appTitle: 'eval1-chat',
});

// ---------------------------------------------------------------------------
// Call a model with a fresh single-turn message list
// Wrapped with traceable so every call is logged in LangSmith.
// ---------------------------------------------------------------------------
const callModel = traceable(
  async (systemPrompt: string, model: string, userContent: string): Promise<string> => {
    const messages: ChatMessages[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ];

    const response = await client.chat.send({
      chatRequest: { model, messages, stream: false },
    });

    const content = response.choices[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      throw new Error('Empty or missing response from model.');
    }
    return content.trim();
  },
  { name: 'callModel', project_name: process.env['LANGCHAIN_PROJECT'] },
);

// ---------------------------------------------------------------------------
// Parse evaluator JSON — tolerant of markdown code fences
// ---------------------------------------------------------------------------
interface EvalResult {
  scores: { accuracy: number; completeness: number; clarity: number; instruction_following: number };
  errors: string[];
  missing_information: string[];
  reasoning: string;
  final_verdict: 'PASS' | 'FAIL';
  improved_answer?: string;
}

function parseEval(raw: string): EvalResult | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as EvalResult;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pipeline: generate → evaluate → surface result to user
// Wrapped with traceable so the full generate+evaluate round-trip appears
// as a single parent trace in LangSmith with callModel as child spans.
// ---------------------------------------------------------------------------
const pipeline = traceable(async function pipeline(userMessage: string): Promise<void> {
  // Step 1: Generate
  process.stdout.write(`\n[Generator → ${GENERATOR_MODEL}] thinking…\n`);
  const generated = await callModel(GENERATOR_SYSTEM_PROMPT, GENERATOR_MODEL, userMessage);
  console.log('\n--- Generated Answer ---');
  console.log(generated);

  // Step 2: Evaluate
  process.stdout.write(`\n[Evaluator → ${EVALUATOR_MODEL}] reviewing…\n`);
  const evalPrompt = `USER QUESTION:\n${userMessage}\n\nGENERATED ANSWER:\n${generated}`;
  const evalRaw = await callModel(EVALUATOR_SYSTEM_PROMPT, EVALUATOR_MODEL, evalPrompt);

  const evaluation = parseEval(evalRaw);

  if (!evaluation) {
    console.log('\n--- Evaluator Raw Output (could not parse JSON) ---');
    console.log(evalRaw);
    return;
  }

  const { scores, errors, missing_information, reasoning, final_verdict, improved_answer } =
    evaluation;

  console.log('\n--- Evaluation ---');
  console.log(
    `Scores  accuracy=${scores.accuracy}/5  completeness=${scores.completeness}/5  clarity=${scores.clarity}/5  instruction_following=${scores.instruction_following}/5`,
  );
  console.log(`Verdict : ${final_verdict}`);
  console.log(`Reasoning: ${reasoning}`);
  if (errors.length > 0) console.log(`Errors  : ${errors.join('; ')}`);
  if (missing_information.length > 0)
    console.log(`Missing : ${missing_information.join('; ')}`);

  if (final_verdict === 'FAIL' && improved_answer) {
    console.log('\n--- Improved Answer (evaluator correction) ---');
    console.log(improved_answer);
  }
}, { name: 'pipeline', project_name: process.env['LANGCHAIN_PROJECT'] });

// ---------------------------------------------------------------------------
// Interactive CLI loop
// ---------------------------------------------------------------------------
async function runChat(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n=== Generator + Evaluator Chat ===');
  console.log(`Generator : ${GENERATOR_MODEL}`);
  console.log(`Evaluator : ${EVALUATOR_MODEL}`);
  console.log('Type your message and press Enter. Type "exit" or "quit" to stop.\n');

  const prompt = (): void => {
    rl.question('You: ', async (input: string) => {
      const trimmed = input.trim();

      if (trimmed === '') { prompt(); return; }

      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log('\nGoodbye!');
        rl.close();
        return;
      }

      try {
        await pipeline(trimmed);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        console.error(`\n[Error] ${message}\n`);
      }

      console.log();
      prompt();
    });
  };

  prompt();
}

runChat();

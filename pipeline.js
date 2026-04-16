import 'dotenv/config';
import OpenAI from 'openai';
import { traceable } from 'langsmith/traceable';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

const GENERATOR_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
const EVALUATOR_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

const GENERATOR_SYSTEM_PROMPT = `You are a response generator.
Your ONLY job is to produce the best possible answer to the user's request.
Return ONLY the final answer. No self-critique. No scoring.`;

const EVALUATOR_SYSTEM_PROMPT = `You are a strict evaluator. Do NOT answer the question yourself.
Evaluate the provided answer and return ONLY valid JSON in this exact shape:
{
  "scores": { "accuracy": 0-5, "completeness": 0-5, "clarity": 0-5, "instruction_following": 0-5 },
  "errors": [],
  "missing_information": [],
  "reasoning": "",
  "final_verdict": "PASS or FAIL",
  "improved_answer": "only if FAIL"
}`;

async function callModel(model, systemPrompt, userContent) {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content?.trim()) throw new Error(`Empty response from ${model}`);
  return content.trim();
}

// generateAnswer — traced as its own span in LangSmith
export const generateAnswer = traceable(
  async function generateAnswer(input) {
    return callModel(GENERATOR_MODEL, GENERATOR_SYSTEM_PROMPT, input);
  },
  { name: 'generateAnswer', run_type: 'llm' },
);

// evaluateAnswer — traced as its own span in LangSmith
export const evaluateAnswer = traceable(
  async function evaluateAnswer(input, output) {
    const prompt = `USER QUESTION:\n${input}\n\nGENERATED ANSWER:\n${output}`;
    const raw = await callModel(EVALUATOR_MODEL, EVALUATOR_SYSTEM_PROMPT, prompt);

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Evaluator did not return valid JSON');
    return JSON.parse(match[0]);
  },
  { name: 'evaluateAnswer', run_type: 'chain' },
);

// runPipeline — parent trace; generateAnswer + evaluateAnswer are child spans
export const runPipeline = traceable(
  async function runPipeline(userInput) {
    const answer = await generateAnswer(userInput);
    const evaluation = await evaluateAnswer(userInput, answer);
    return { answer, evaluation };
  },
  { name: 'runPipeline', run_type: 'chain' },
);

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const GENERATOR_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
const EVALUATOR_MODEL = 'google/gemma-4-26b-a4b-it:free';

const GENERATOR_SYSTEM_PROMPT = `You are a response generator.
Your ONLY job is to produce the best possible answer to the user's request.
Return ONLY the final answer. No self-critique. No scoring.`;

const EVALUATOR_SYSTEM_PROMPT = `You are a strict factual accuracy judge. Do NOT answer the question yourself.
You will receive a question, expected answer, and actual answer.
Return ONLY this JSON object with no extra text:
{"score": <0-5>, "verdict": "PASS" or "FAIL", "reasoning": "<one sentence>"}

Scoring:
5 = completely correct
4 = mostly correct, minor gap
3 = partially correct
2 = mostly wrong
1 = almost entirely wrong
0 = completely wrong`;

function getClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
  return new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' });
}

async function callModel(client: OpenAI, model: string, systemPrompt: string, userContent: string) {
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

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json() as { question: string };
    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const client = getClient();

    // Step 1: Generate answer
    const answer = await callModel(client, GENERATOR_MODEL, GENERATOR_SYSTEM_PROMPT, question);

    // Step 2: Evaluate answer
    const evalPrompt = `QUESTION: ${question}\nACTUAL ANSWER: ${answer}\n\nScore the accuracy.`;
    let evaluation = { score: 0, verdict: 'UNKNOWN', reasoning: 'Evaluation unavailable' };
    try {
      const raw = await callModel(client, EVALUATOR_MODEL, EVALUATOR_SYSTEM_PROMPT, evalPrompt);
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) evaluation = JSON.parse(match[0]);
    } catch {
      // Evaluator failure is non-fatal — return the answer with a note
      evaluation.reasoning = 'Evaluator model unavailable (rate limited). Try again shortly.';
    }

    return NextResponse.json({
      question,
      answer,
      evaluation,
      models: { generator: GENERATOR_MODEL, evaluator: EVALUATOR_MODEL },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

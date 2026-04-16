import 'dotenv/config';
import { Client } from 'langsmith';
import { traceable } from 'langsmith/traceable';

// ---------------------------------------------------------------------------
// LangSmith client — picks up LANGCHAIN_API_KEY from .env automatically.
// LANGCHAIN_TRACING_V2 and LANGCHAIN_PROJECT are also read from env.
// ---------------------------------------------------------------------------
export const langsmith = new Client();

// ---------------------------------------------------------------------------
// traceable — wraps any async function so every call is logged to LangSmith.
//
// Usage:
//   import { traced } from './langsmith.js';
//   const myFn = traced('my-run-name', async (input) => { ... });
// ---------------------------------------------------------------------------
export function traced(name, fn) {
  return traceable(fn, { name, project_name: process.env.LANGCHAIN_PROJECT });
}

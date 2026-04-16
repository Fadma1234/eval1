'use client';

import { useState, useRef } from 'react';

interface EvalResult {
  question: string;
  answer: string;
  evaluation: {
    score: number;
    verdict: string;
    reasoning: string;
  };
  models: {
    generator: string;
    evaluator: string;
  };
}

const EXAMPLE_QUESTIONS = [
  'What is the speed of light?',
  'Who wrote Romeo and Juliet?',
  'What does CPU stand for?',
  'What is the boiling point of water?',
  'What is 144 divided by 12?',
];

export default function Home() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<EvalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<EvalResult[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit(q?: string) {
    const query = (q ?? question).trim();
    if (!query) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setResult(data);
      setHistory((h) => [data, ...h].slice(0, 10));
      setQuestion('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function scoreColor(score: number) {
    if (score >= 4) return '#34d399';
    if (score >= 2) return '#fbbf24';
    return '#f87171';
  }

  function scoreBar(score: number) {
    const pct = (score / 5) * 100;
    return (
      <div style={{ background: '#2e3350', borderRadius: 99, height: 8, overflow: 'hidden', flex: 1 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: scoreColor(score), borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 16px' }}>

      {/* Header */}
      <header style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#1a1d27', border: '1px solid #2e3350', borderRadius: 99, padding: '6px 16px', fontSize: 13, color: '#8892aa', marginBottom: 20 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
          Free models · LangSmith traced
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 12 }}>
          LLM Evaluation{' '}
          <span style={{ background: 'linear-gradient(90deg,#6c8fff,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Pipeline
          </span>
        </h1>
        <p style={{ color: '#8892aa', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>
          Ask any question. A <strong style={{ color: '#e2e8f0' }}>generator</strong> model answers it,
          an <strong style={{ color: '#e2e8f0' }}>evaluator</strong> model scores it for accuracy.
        </p>
      </header>

      {/* Input */}
      <div style={{ background: '#1a1d27', border: '1px solid #2e3350', borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <textarea
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          placeholder="Ask anything… (Enter to submit)"
          disabled={loading}
          rows={3}
          style={{
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            color: '#e2e8f0', fontSize: 16, resize: 'none', fontFamily: 'inherit',
            opacity: loading ? 0.5 : 1,
          }}
          aria-label="Question input"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => { setQuestion(q); inputRef.current?.focus(); }}
                disabled={loading}
                style={{
                  background: '#22263a', border: '1px solid #2e3350', borderRadius: 99,
                  color: '#8892aa', fontSize: 12, padding: '4px 10px', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                aria-label={`Use example: ${q}`}
              >
                {q.length > 30 ? q.slice(0, 28) + '…' : q}
              </button>
            ))}
          </div>
          <button
            onClick={() => handleSubmit()}
            disabled={loading || !question.trim()}
            aria-busy={loading}
            style={{
              background: loading ? '#3d5af1' : 'linear-gradient(135deg,#3d5af1,#6c8fff)',
              border: 'none', borderRadius: 10, color: '#fff',
              fontSize: 15, fontWeight: 600, padding: '10px 24px',
              cursor: loading || !question.trim() ? 'not-allowed' : 'pointer',
              opacity: !question.trim() ? 0.5 : 1,
              minWidth: 100, transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Running…' : 'Ask →'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" style={{ background: '#2a1a1a', border: '1px solid #f87171', borderRadius: 12, padding: '12px 16px', color: '#f87171', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div aria-busy="true" style={{ background: '#1a1d27', border: '1px solid #2e3350', borderRadius: 16, padding: 24 }}>
          {['Generator thinking…', 'Evaluator scoring…'].map((label, i) => (
            <div key={i} style={{ marginBottom: i === 0 ? 20 : 0 }}>
              <div style={{ fontSize: 12, color: '#8892aa', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#6c8fff', animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.4}s` }} />
                {label}
              </div>
              <div style={{ height: 14, borderRadius: 99, background: '#22263a', width: i === 0 ? '80%' : '55%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
            </div>
          ))}
          <style>{`
            @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
            @keyframes shimmer { 0%,100%{opacity:0.5} 50%{opacity:1} }
          `}</style>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div style={{ background: '#1a1d27', border: '1px solid #2e3350', borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>

          {/* Score banner */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #2e3350', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: scoreColor(result.evaluation.score), lineHeight: 1 }}>
              {result.evaluation.score}/5
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                {scoreBar(result.evaluation.score)}
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 99,
                  background: result.evaluation.verdict === 'PASS' ? '#0d2a1e' : '#2a1a1a',
                  color: result.evaluation.verdict === 'PASS' ? '#34d399' : '#f87171',
                  border: `1px solid ${result.evaluation.verdict === 'PASS' ? '#34d399' : '#f87171'}`,
                }}>
                  {result.evaluation.verdict}
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#8892aa', margin: 0 }}>{result.evaluation.reasoning}</p>
            </div>
          </div>

          {/* Answer */}
          <div style={{ padding: '20px 20px 0' }}>
            <div style={{ fontSize: 12, color: '#8892aa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Answer</div>
            <p style={{ fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{result.answer}</p>
          </div>

          {/* Models */}
          <div style={{ padding: '16px 20px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Generator', value: result.models.generator },
              { label: 'Evaluator', value: result.models.evaluator },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#22263a', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
                <span style={{ color: '#8892aa' }}>{label}: </span>
                <span style={{ color: '#6c8fff', fontFamily: 'monospace' }}>{value.split('/')[1]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div>
          <h2 style={{ fontSize: 14, color: '#8892aa', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Recent
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.slice(1).map((item, i) => (
              <button
                key={i}
                onClick={() => setResult(item)}
                style={{
                  background: '#1a1d27', border: '1px solid #2e3350', borderRadius: 10,
                  padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color 0.15s',
                }}
                aria-label={`View result for: ${item.question}`}
              >
                <span style={{ fontSize: 18, fontWeight: 800, color: scoreColor(item.evaluation.score), minWidth: 32 }}>
                  {item.evaluation.score}
                </span>
                <span style={{ fontSize: 14, color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.question}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ marginTop: 48, textAlign: 'center', color: '#8892aa', fontSize: 13 }}>
        <p>
          Powered by{' '}
          <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer">OpenRouter</a>
          {' '}·{' '}
          <a href="https://smith.langchain.com" target="_blank" rel="noopener noreferrer">LangSmith</a>
          {' '}·{' '}
          <a href="https://github.com/Fadma1234/eval1" target="_blank" rel="noopener noreferrer">GitHub</a>
        </p>
      </footer>
    </div>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'eval1 — LLM Evaluation Pipeline',
  description: 'Ask any question. A generator model answers it, an evaluator model scores it for accuracy. Fully traced with LangSmith.',
  alternates: { canonical: 'https://eval1-web.vercel.app' },
  openGraph: {
    title: 'eval1 — LLM Evaluation Pipeline',
    description: 'Free AI pipeline: generator + evaluator with LangSmith tracing.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'eval1 pipeline' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

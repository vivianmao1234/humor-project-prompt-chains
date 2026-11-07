'use client';

import { useState, useTransition } from 'react';
import { runChainAction } from '../../../actions';
import type { ChainRun } from '@/lib/pipeline';
import { buttonClass, cardClass, inputClass } from '../../ui';

export default function RunPanel({ flavorId, hasSteps }: { flavorId: number; hasSteps: boolean }) {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState('3');
  const [result, setResult] = useState<ChainRun | { error: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      setResult(null);
      setResult(await runChainAction(flavorId, topic, Number(count)));
    });

  return (
    <section className={`${cardClass} space-y-3`}>
      <div>
        <h2 className="font-semibold">Test this chain</h2>
        <p className="text-sm text-zinc-500">
          Runs every step in order and saves the captions. They appear below and in the rating app’s feed.
        </p>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); run(); }}
        className="flex flex-col gap-2 md:flex-row"
      >
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          required
          maxLength={120}
          placeholder="Topic, e.g. Butler at 3am during midterms"
          className={`${inputClass} flex-1`}
        />
        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Captions</span>
          <input type="number" min={1} max={5} value={count} onChange={(e) => setCount(e.target.value)} className={`${inputClass} w-16`} />
        </label>
        <button disabled={pending || !hasSteps} className={buttonClass}>
          {pending ? 'Running… (up to a minute)' : 'Run chain'}
        </button>
      </form>
      {!hasSteps && <p className="text-sm text-amber-600">Add at least one step first.</p>}

      {result && 'steps' in result && (
        <div className="space-y-2">
          {result.steps.map((s) => (
            <details key={s.stepOrder} className="rounded border border-zinc-200 p-2 text-sm dark:border-zinc-800">
              <summary className="cursor-pointer">
                <span className={s.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600'}>{s.ok ? '✓' : '✗'}</span>{' '}
                Step {s.stepOrder} · <span className="font-mono text-xs">{s.model ?? '—'}</span> · {(s.durationMs / 1000).toFixed(1)}s
              </summary>
              <pre className="mt-1 whitespace-pre-wrap text-xs">{s.output ?? s.error}</pre>
            </details>
          ))}
        </div>
      )}
      {result && 'error' in result && result.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{result.error}</p>
      )}
      {result && 'captions' in result && result.captions.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/40">
          <p className="mb-1 text-sm font-semibold">Saved {result.captions.length} caption{result.captions.length === 1 ? '' : 's'}:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {result.captions.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { deleteChainAction, updateChainAction } from '../../../actions';
import { buttonClass, cardClass, inputClass } from '../../ui';

export default function ChainSettings({ id, initialSlug, initialDescription, initialMix }: {
  id: number;
  initialSlug: string;
  initialDescription: string;
  initialMix: number;
}) {
  const [slug, setSlug] = useState(initialSlug);
  const [description, setDescription] = useState(initialDescription);
  const [mix, setMix] = useState(String(initialMix));
  const [message, setMessage] = useState<{ error?: string; ok?: string }>({});
  const [pending, startTransition] = useTransition();
  const dirty = slug !== initialSlug || description !== initialDescription || mix !== String(initialMix);

  return (
    <section className={`${cardClass} space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-mono text-2xl font-bold">{initialSlug}</h1>
        <button
          onClick={() => {
            if (!confirm(`Delete the chain "${initialSlug}" and all its steps? Captions it already made are kept.`)) return;
            startTransition(async () => setMessage(await deleteChainAction(id)));
          }}
          disabled={pending}
          className="text-sm text-red-600 hover:underline"
        >
          Delete chain
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Name</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className={`${inputClass} font-mono`} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500" title="How many captions this chain writes each time someone clicks Generate in the rating app. 0 = off.">
            Captions per rating-app request
          </span>
          <input type="number" min={0} max={10} value={mix} onChange={(e) => setMix(e.target.value)} className={`${inputClass} w-28`} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={pending || !dirty}
          onClick={() => startTransition(async () => setMessage(await updateChainAction(id, slug, description, Number(mix))))}
          className={buttonClass}
        >
          {pending ? 'Saving…' : 'Save chain'}
        </button>
        {message.error && <span className="text-sm text-red-600">{message.error}</span>}
        {message.ok && <span className="text-sm text-green-700 dark:text-green-400">{message.ok}</span>}
      </div>
    </section>
  );
}

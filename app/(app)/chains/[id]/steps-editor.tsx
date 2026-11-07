'use client';

import { useState, useTransition } from 'react';
import { createStepAction, deleteStepAction, moveStepAction, updateStepAction } from '../../../actions';
import { buttonClass, cardClass, inputClass, subtleButtonClass } from '../../ui';

export type Step = {
  id: number;
  step_order: number;
  description: string | null;
  temperature: number;
  prompt_template: string;
  llm_model_id: number | null;
};
export type ModelOption = { id: number; name: string; api_model_id: string; is_active: boolean };

type Draft = { description: string; llmModelId: string; temperature: string; promptTemplate: string };

const PLACEHOLDERS = ['{{topic}}', '{{previous_output}}', '{{count}}', '{{terms}}', '{{examples}}'];

const toDraft = (s?: Step): Draft => ({
  description: s?.description ?? '',
  llmModelId: s?.llm_model_id ? String(s.llm_model_id) : '',
  temperature: String(s?.temperature ?? 1),
  promptTemplate: s?.prompt_template ?? '',
});
const toInput = (d: Draft) => ({
  description: d.description,
  llmModelId: d.llmModelId ? Number(d.llmModelId) : null,
  temperature: Number(d.temperature),
  promptTemplate: d.promptTemplate,
});

function StepFields({ draft, setDraft, models }: { draft: Draft; setDraft: (d: Draft) => void; models: ModelOption[] }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-[2fr_1fr_auto]">
        <input
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="What this step does, e.g. Brainstorm angles"
          className={inputClass}
        />
        <select value={draft.llmModelId} onChange={(e) => setDraft({ ...draft, llmModelId: e.target.value })} className={inputClass}>
          <option value="">No model (uses fallbacks)</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}{m.is_active ? '' : ' (inactive)'}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Temp</span>
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={draft.temperature}
            onChange={(e) => setDraft({ ...draft, temperature: e.target.value })}
            className={`${inputClass} w-20`}
          />
        </label>
      </div>
      <textarea
        value={draft.promptTemplate}
        onChange={(e) => setDraft({ ...draft, promptTemplate: e.target.value })}
        rows={6}
        placeholder="The prompt for this step…"
        className={`${inputClass} w-full font-mono text-xs`}
      />
      <p className="text-xs text-zinc-500">
        Placeholders: {PLACEHOLDERS.map((p) => <code key={p} className="mr-1 rounded bg-zinc-100 px-1 dark:bg-zinc-800">{p}</code>)}.
        The last step must return a JSON array of captions.
      </p>
    </div>
  );
}

function StepCard({ step, index, total, flavorId, models }: {
  step: Step;
  index: number;
  total: number;
  flavorId: number;
  models: ModelOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(toDraft(step));
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const model = models.find((m) => m.id === step.llm_model_id);

  const run = (action: () => Promise<{ error?: string }>, after?: () => void) =>
    startTransition(async () => {
      const res = await action();
      if (res.error) setError(res.error);
      else {
        setError('');
        after?.();
      }
    });

  return (
    <li className={`rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 ${pending ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
          Step {step.step_order}
        </span>
        <span className="font-medium">{step.description || 'Untitled step'}</span>
        <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-300">
          {model?.api_model_id ?? 'no model'}
        </span>
        <span className="text-xs text-zinc-500">temp {Number(step.temperature).toFixed(1)}</span>
        <div className="ml-auto flex gap-1">
          <button
            aria-label={`Move step ${step.step_order} up`}
            title="Move up"
            disabled={pending || index === 0}
            onClick={() => run(() => moveStepAction(flavorId, step.id, 'up'))}
            className={subtleButtonClass}
          >
            ↑
          </button>
          <button
            aria-label={`Move step ${step.step_order} down`}
            title="Move down"
            disabled={pending || index === total - 1}
            onClick={() => run(() => moveStepAction(flavorId, step.id, 'down'))}
            className={subtleButtonClass}
          >
            ↓
          </button>
          <button onClick={() => { setEditing(!editing); setDraft(toDraft(step)); setError(''); }} className={subtleButtonClass}>
            {editing ? 'Cancel' : 'Edit'}
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete step ${step.step_order}?`)) run(() => deleteStepAction(flavorId, step.id));
            }}
            disabled={pending}
            className={`${subtleButtonClass} text-red-600`}
          >
            Delete
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <StepFields draft={draft} setDraft={setDraft} models={models} />
          <button
            disabled={pending}
            onClick={() => run(() => updateStepAction(flavorId, step.id, toInput(draft)), () => setEditing(false))}
            className={buttonClass}
          >
            {pending ? 'Saving…' : 'Save step'}
          </button>
        </div>
      ) : (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">Prompt</summary>
          <pre className="mt-1 whitespace-pre-wrap rounded bg-zinc-50 p-2 text-xs dark:bg-zinc-950">{step.prompt_template}</pre>
        </details>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </li>
  );
}

export default function StepsEditor({ flavorId, steps, models }: { flavorId: number; steps: Step[]; models: ModelOption[] }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  return (
    <section className={`${cardClass} space-y-3`}>
      <div>
        <h2 className="font-semibold">Steps</h2>
        <p className="text-sm text-zinc-500">
          Steps run top to bottom. Each step’s output is available to the next as{' '}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{'{{previous_output}}'}</code>. Use ↑ ↓ to reorder.
        </p>
      </div>

      {steps.length === 0 ? (
        <p className="text-sm text-zinc-500">No steps yet. Add the first one below.</p>
      ) : (
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <StepCard key={s.id} step={s} index={i} total={steps.length} flavorId={flavorId} models={models} />
          ))}
        </ol>
      )}

      {adding ? (
        <div className="space-y-2 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
          <p className="text-sm font-medium">New step {steps.length + 1}</p>
          <StepFields draft={draft} setDraft={setDraft} models={models} />
          <div className="flex gap-2">
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await createStepAction(flavorId, toInput(draft));
                  if (res.error) setError(res.error);
                  else {
                    setError('');
                    setAdding(false);
                    setDraft(toDraft());
                  }
                })
              }
              className={buttonClass}
            >
              {pending ? 'Adding…' : 'Add step'}
            </button>
            <button onClick={() => { setAdding(false); setError(''); }} className={subtleButtonClass}>Cancel</button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className={subtleButtonClass}>+ Add step</button>
      )}
    </section>
  );
}

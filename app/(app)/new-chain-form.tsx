'use client';

import { useActionState } from 'react';
import { createChainAction, type FormState } from '../actions';
import { inputClass, buttonClass, cardClass } from './ui';

export default function NewChainForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createChainAction, {});

  return (
    <form action={formAction} className={`${cardClass} space-y-3`}>
      <p className="font-semibold">New prompt chain</p>
      <div className="flex flex-col gap-2 md:flex-row">
        <input name="slug" required placeholder="name-with-dashes, e.g. dining-hall-roasts" className={`${inputClass} md:w-72`} />
        <input name="description" placeholder="What kind of humor is this? (optional)" className={`${inputClass} flex-1`} />
        <button disabled={pending} className={buttonClass}>{pending ? 'Creating…' : 'Create'}</button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

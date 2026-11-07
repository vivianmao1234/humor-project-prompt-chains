'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { runChain, type ChainRun } from '@/lib/pipeline';

export type FormState = { error?: string; ok?: string };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ─── Chains (humor_flavors) ──────────────────────────────────────────────────

export async function createChainAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const description = String(formData.get('description') ?? '').trim() || null;
  if (!SLUG.test(slug)) return { error: 'Use lowercase letters, numbers and dashes, e.g. dining-hall-roasts.' };

  const { data, error } = await supabase.from('humor_flavors').insert({ slug, description }).select('id').single();
  if (error) return { error: error.code === '23505' ? 'A chain with that name already exists.' : error.message };

  // Every chain gets a mix row (0 = not used by the rating app until you turn it on).
  await supabase.from('humor_flavor_mix').insert({ humor_flavor_id: data.id, caption_count: 0 });
  revalidatePath('/');
  redirect(`/chains/${data.id}`);
}

export async function updateChainAction(id: number, slug: string, description: string, mixCount: number): Promise<FormState> {
  const { supabase } = await requireAdmin();
  slug = slug.trim().toLowerCase();
  if (!SLUG.test(slug)) return { error: 'Use lowercase letters, numbers and dashes.' };
  if (!Number.isInteger(mixCount) || mixCount < 0 || mixCount > 10) return { error: 'Captions per request must be 0–10.' };

  const { error } = await supabase.from('humor_flavors').update({ slug, description: description.trim() || null }).eq('id', id);
  if (error) return { error: error.code === '23505' ? 'A chain with that name already exists.' : error.message };
  const { error: mixError } = await supabase
    .from('humor_flavor_mix')
    .upsert({ humor_flavor_id: id, caption_count: mixCount, updated_at: new Date().toISOString() }, { onConflict: 'humor_flavor_id' });
  if (mixError) return { error: mixError.message };

  revalidatePath('/');
  revalidatePath(`/chains/${id}`);
  return { ok: 'Saved.' };
}

export async function deleteChainAction(id: number): Promise<FormState> {
  const { supabase } = await requireAdmin();
  // Steps and the mix row are removed with it (on delete cascade); past captions keep their text.
  const { error } = await supabase.from('humor_flavors').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/');
  redirect('/');
}

// ─── Steps (humor_flavor_steps) ──────────────────────────────────────────────

type StepInput = { description: string; llmModelId: number | null; temperature: number; promptTemplate: string };

function validateStep(s: StepInput): string | null {
  if (!s.promptTemplate.trim()) return 'The prompt can’t be empty.';
  if (!Number.isFinite(s.temperature) || s.temperature < 0 || s.temperature > 2) return 'Temperature must be between 0 and 2.';
  return null;
}

export async function createStepAction(flavorId: number, step: StepInput): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const invalid = validateStep(step);
  if (invalid) return { error: invalid };

  const { data: last } = await supabase
    .from('humor_flavor_steps')
    .select('step_order')
    .eq('humor_flavor_id', flavorId)
    .order('step_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('humor_flavor_steps').insert({
    humor_flavor_id: flavorId,
    step_order: (last?.step_order ?? 0) + 1,
    description: step.description.trim() || null,
    llm_model_id: step.llmModelId,
    temperature: step.temperature,
    prompt_template: step.promptTemplate,
  });
  if (error) return { error: error.message };
  revalidatePath(`/chains/${flavorId}`);
  return { ok: 'Step added.' };
}

export async function updateStepAction(flavorId: number, stepId: number, step: StepInput): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const invalid = validateStep(step);
  if (invalid) return { error: invalid };

  const { error } = await supabase
    .from('humor_flavor_steps')
    .update({
      description: step.description.trim() || null,
      llm_model_id: step.llmModelId,
      temperature: step.temperature,
      prompt_template: step.promptTemplate,
    })
    .eq('id', stepId)
    .eq('humor_flavor_id', flavorId);
  if (error) return { error: error.message };
  revalidatePath(`/chains/${flavorId}`);
  return { ok: 'Step saved.' };
}

// Rewrites step_order as 1..n in the given order. step_order is unique per chain, so rows are
// first moved to negative numbers to avoid clashing with each other mid-update.
async function renumber(supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'], flavorId: number, orderedIds: number[]) {
  for (const [i, id] of orderedIds.entries()) {
    const { error } = await supabase.from('humor_flavor_steps').update({ step_order: -(i + 1) }).eq('id', id).eq('humor_flavor_id', flavorId);
    if (error) return error.message;
  }
  for (const [i, id] of orderedIds.entries()) {
    const { error } = await supabase.from('humor_flavor_steps').update({ step_order: i + 1 }).eq('id', id).eq('humor_flavor_id', flavorId);
    if (error) return error.message;
  }
  return null;
}

async function currentOrder(supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'], flavorId: number) {
  const { data } = await supabase.from('humor_flavor_steps').select('id').eq('humor_flavor_id', flavorId).order('step_order');
  return (data ?? []).map((s) => s.id as number);
}

export async function moveStepAction(flavorId: number, stepId: number, direction: 'up' | 'down'): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const ids = await currentOrder(supabase, flavorId);
  const i = ids.indexOf(stepId);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return {};
  [ids[i], ids[j]] = [ids[j], ids[i]];

  const error = await renumber(supabase, flavorId, ids);
  if (error) return { error };
  revalidatePath(`/chains/${flavorId}`);
  return { ok: 'Reordered.' };
}

export async function deleteStepAction(flavorId: number, stepId: number): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('humor_flavor_steps').delete().eq('id', stepId).eq('humor_flavor_id', flavorId);
  if (error) return { error: error.message };

  // Close the gap so steps stay numbered 1..n.
  const renumberError = await renumber(supabase, flavorId, await currentOrder(supabase, flavorId));
  if (renumberError) return { error: renumberError };
  revalidatePath(`/chains/${flavorId}`);
  return { ok: 'Step deleted.' };
}

// ─── Running a chain ─────────────────────────────────────────────────────────

export async function runChainAction(flavorId: number, topic: string, count: number): Promise<ChainRun | { error: string }> {
  const { supabase, user } = await requireAdmin();
  topic = topic.trim();
  if (!topic) return { error: 'Give the chain a topic to write about.' };
  if (topic.length > 120) return { error: 'Keep the topic under 120 characters.' };
  if (!Number.isInteger(count) || count < 1 || count > 5) return { error: 'Generate between 1 and 5 captions.' };

  const result = await runChain(supabase, user.id, flavorId, topic, count);
  revalidatePath(`/chains/${flavorId}`);
  return result;
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

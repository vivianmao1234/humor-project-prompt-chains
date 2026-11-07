// Runs ONE prompt chain (humor flavor) on a topic, the same way the rating app does,
// and records everything: caption_requests → llm_prompt_chains → llm_model_responses → captions.
// Captions it saves show up in the rating app's feed, attributed to this chain.

import type { SupabaseClient } from '@supabase/supabase-js';
import { callGemini } from './gemini';

type Model = { id: number; api_model_id: string; is_active: boolean };
type Step = {
  id: number;
  step_order: number;
  temperature: number;
  prompt_template: string;
  llm_models: Model | null;
};

export type StepRun = {
  stepOrder: number;
  model: string | null;
  ok: boolean;
  output: string | null;
  error: string | null;
  durationMs: number;
};

export type ChainRun = { requestId: number; captions: string[]; steps: StepRun[]; error?: string };

const MAX_MODEL_ATTEMPTS_PER_STEP = 3;

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

function parseCaptions(text: string, count: number): string[] {
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const parsed: unknown = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error('The last step did not return a JSON array of captions');
  return parsed
    .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    .map((c) => c.trim())
    .slice(0, count);
}

export async function runChain(
  supabase: SupabaseClient,
  userId: string,
  flavorId: number,
  topic: string,
  count: number
): Promise<ChainRun> {
  const { data: request, error: requestError } = await supabase
    .from('caption_requests')
    .insert({ profile_id: userId, topic })
    .select('id')
    .single();
  if (requestError || !request) throw new Error(`Couldn’t create caption request: ${requestError?.message}`);
  const requestId: number = request.id;
  const steps: StepRun[] = [];

  const finish = async (status: 'completed' | 'failed', error?: string) => {
    await supabase
      .from('caption_requests')
      .update({ status, error: error ?? null, completed_at: new Date().toISOString() })
      .eq('id', requestId);
  };

  try {
    const [{ data: chain }, { data: stepRows }, { data: terms }, { data: examples }, { data: models }] =
      await Promise.all([
        supabase.from('llm_prompt_chains').insert({ caption_request_id: requestId, humor_flavor_id: flavorId }).select('id').single(),
        supabase
          .from('humor_flavor_steps')
          .select('id, step_order, temperature, prompt_template, llm_models(id, api_model_id, is_active)')
          .eq('humor_flavor_id', flavorId)
          .order('step_order'),
        supabase.from('terms').select('term, definition').order('priority', { ascending: false }).limit(8),
        supabase.from('caption_examples').select('topic, caption').or(`humor_flavor_id.eq.${flavorId},humor_flavor_id.is.null`).limit(5),
        supabase.from('llm_models').select('id, api_model_id, is_active').eq('is_active', true).order('id'),
      ]);

    const ordered = (stepRows ?? []) as unknown as Step[];
    if (ordered.length === 0) throw new Error('This chain has no steps yet.');
    const activeModels = (models ?? []) as Model[];
    const termsText = (terms ?? []).map((t) => `- ${t.term}: ${t.definition}`).join('\n') || '(none)';
    const examplesText = (examples ?? []).map((e) => `- (${e.topic}) ${e.caption}`).join('\n') || '(none)';

    let previousOutput = '';
    let finalPrompt = '';
    let finalModel = '';

    for (const [i, step] of ordered.entries()) {
      const isLast = i === ordered.length - 1;
      const prompt = fill(step.prompt_template, {
        topic,
        count: String(count),
        terms: termsText,
        examples: examplesText,
        previous_output: previousOutput,
      });
      const preferred = step.llm_models?.is_active ? [step.llm_models] : [];
      const candidates = [...preferred, ...activeModels.filter((m) => m.id !== step.llm_models?.id)].slice(
        0,
        MAX_MODEL_ATTEMPTS_PER_STEP
      );

      let output: string | null = null;
      let lastRun: StepRun | null = null;
      for (const model of candidates) {
        const call = await callGemini(model.api_model_id, prompt, { temperature: Number(step.temperature), json: isLast });
        await supabase.from('llm_model_responses').insert({
          caption_request_id: requestId,
          llm_prompt_chain_id: chain?.id,
          humor_flavor_step_id: step.id,
          llm_model_id: model.id,
          model_name: model.api_model_id,
          prompt,
          response: call.text,
          status_code: call.status,
          error: call.error,
          duration_ms: call.durationMs,
        });
        lastRun = { stepOrder: step.step_order, model: model.api_model_id, ok: call.ok, output: call.text, error: call.error, durationMs: call.durationMs };
        if (call.ok && call.text) {
          output = call.text;
          finalModel = model.api_model_id;
          break;
        }
      }
      steps.push(lastRun ?? { stepOrder: step.step_order, model: null, ok: false, output: null, error: 'No active model to run this step', durationMs: 0 });
      if (output === null) throw new Error(`Step ${step.step_order} failed on every model it tried.`);
      previousOutput = output;
      finalPrompt = prompt;
    }

    let captions: string[];
    try {
      captions = parseCaptions(previousOutput, count);
    } catch (e) {
      throw new Error(`${(e as Error).message}. Make sure the last step asks for a JSON array.`);
    }
    if (captions.length === 0) throw new Error('The last step returned no captions.');

    const { error } = await supabase.from('captions').insert(
      captions.map((content) => ({
        created_by: userId,
        topic,
        content,
        prompt: finalPrompt,
        model: finalModel,
        caption_request_id: requestId,
        humor_flavor_id: flavorId,
        llm_prompt_chain_id: chain?.id,
      }))
    );
    if (error) throw new Error(`Couldn’t save captions: ${error.message}`);

    await finish('completed');
    return { requestId, captions, steps };
  } catch (e) {
    const message = (e as Error).message;
    await finish('failed', message);
    return { requestId, captions: [], steps, error: message };
  }
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import ChainSettings from './chain-settings';
import StepsEditor, { type Step, type ModelOption } from './steps-editor';
import RunPanel from './run-panel';
import { cardClass } from '../../ui';

// Running a chain makes one LLM call per step (plus fallbacks when Gemini is busy).
export const maxDuration = 120;

type Caption = {
  id: number;
  content: string;
  topic: string;
  model: string;
  created_at: string;
  caption_votes: { vote: number }[];
};

export default async function ChainPage({ params }: PageProps<'/chains/[id]'>) {
  const { id } = await params;
  const flavorId = Number(id);
  if (!Number.isInteger(flavorId)) notFound();

  const { supabase } = await requireAdmin();
  const [{ data: flavor }, { data: steps }, { data: models }, { data: captions }] = await Promise.all([
    supabase.from('humor_flavors').select('id, slug, description, humor_flavor_mix(caption_count)').eq('id', flavorId).maybeSingle(),
    supabase
      .from('humor_flavor_steps')
      .select('id, step_order, description, temperature, prompt_template, llm_model_id')
      .eq('humor_flavor_id', flavorId)
      .order('step_order'),
    supabase.from('llm_models').select('id, name, api_model_id, is_active').order('id'),
    supabase
      .from('captions')
      .select('id, content, topic, model, created_at, caption_votes(vote)')
      .eq('humor_flavor_id', flavorId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);
  if (!flavor) notFound();

  const mixRow = Array.isArray(flavor.humor_flavor_mix) ? flavor.humor_flavor_mix[0] : flavor.humor_flavor_mix;
  const media = (captions ?? []) as Caption[];

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">← All chains</Link>

      <ChainSettings
        id={flavor.id}
        initialSlug={flavor.slug}
        initialDescription={flavor.description ?? ''}
        initialMix={mixRow?.caption_count ?? 0}
      />

      <StepsEditor flavorId={flavorId} steps={(steps ?? []) as Step[]} models={(models ?? []) as ModelOption[]} />

      <RunPanel flavorId={flavorId} hasSteps={(steps ?? []).length > 0} />

      <section className={cardClass}>
        <h2 className="font-semibold">Captions this chain produced</h2>
        <p className="mb-3 text-sm text-zinc-500">
          Newest first (last 50), from test runs here and from the rating app. Score = ▲ minus ▼ votes.
        </p>
        {media.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing yet. Run the chain above to generate some.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {media.map((c) => {
              const score = c.caption_votes.reduce((s, v) => s + v.vote, 0);
              return (
                <li key={c.id} className="flex items-start justify-between gap-4 py-2">
                  <div>
                    <p>{c.content}</p>
                    <p className="text-xs text-zinc-500">
                      “{c.topic}” · {c.model} · {new Date(c.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums" title={`${c.caption_votes.length} votes`}>
                    {score > 0 ? '+' : ''}{score}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

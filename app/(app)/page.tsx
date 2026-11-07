import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import NewChainForm from './new-chain-form';

type Chain = {
  id: number;
  slug: string;
  description: string | null;
  humor_flavor_steps: { id: number }[];
  humor_flavor_mix: { caption_count: number } | { caption_count: number }[] | null;
  captions: { id: number }[];
};

export default async function ChainsPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from('humor_flavors')
    .select('id, slug, description, humor_flavor_steps(id), humor_flavor_mix(caption_count), captions(id)')
    .order('id');
  const chains = (data ?? []) as unknown as Chain[];
  const mix = (c: Chain) => (Array.isArray(c.humor_flavor_mix) ? c.humor_flavor_mix[0] : c.humor_flavor_mix)?.caption_count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Prompt chains</h1>
        <p className="text-sm text-zinc-500">
          Each chain is a caption style: a list of LLM steps that run in order, each one feeding the next.
        </p>
      </div>

      {error && <p className="text-red-600">Couldn’t load chains: {error.message}</p>}

      <ul className="grid gap-3 md:grid-cols-2">
        {chains.map((c) => (
          <li key={c.id}>
            <Link
              href={`/chains/${c.id}`}
              className="block h-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
            >
              <p className="font-mono font-semibold">{c.slug}</p>
              {c.description && <p className="mt-1 text-sm text-zinc-500">{c.description}</p>}
              <p className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                  {c.humor_flavor_steps.length} step{c.humor_flavor_steps.length === 1 ? '' : 's'}
                </span>
                <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                  {c.captions.length} caption{c.captions.length === 1 ? '' : 's'} made
                </span>
                <span
                  className={`rounded px-2 py-0.5 ${
                    mix(c) > 0
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
                  }`}
                >
                  {mix(c) > 0 ? `Live in rating app: ${mix(c)} per request` : 'Not live in rating app'}
                </span>
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <NewChainForm />
    </div>
  );
}

import Link from 'next/link';
import { requireAdmin, displayName } from '@/lib/admin';
import { signOutAction } from '../actions';
import ThemePicker from '../theme-picker';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const { supabase, user } = await requireAdmin();
  const { data: me } = await supabase.from('profiles').select('first_name, last_name, email').eq('id', user.id).single();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
          <Link href="/" className="font-bold">
            🦁 Lion Laughs <span className="font-normal text-zinc-500">Prompt Chains</span>
          </Link>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <ThemePicker />
            <span className="hidden text-zinc-500 sm:inline">{me ? displayName(me) : user.email}</span>
            <form action={signOutAction}>
              <button className="text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-100">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

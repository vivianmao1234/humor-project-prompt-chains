'use client';

import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const supabase = createClient();

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">Lion Laughs</p>
        <h1 className="text-3xl font-bold">Prompt Chains</h1>
        <p className="mt-2 text-zinc-500">Superadmins only. Sign in with Google to continue.</p>
      </div>
      <button
        onClick={signInWithGoogle}
        className="rounded-full bg-zinc-900 px-6 py-3 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Continue with Google
      </button>
    </div>
  );
}

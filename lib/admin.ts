import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Every admin page and action calls this first. Logged out → /login.
// Logged in but not profiles.is_superadmin → /not-authorized.
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('is_superadmin');
  if (!isAdmin) redirect('/not-authorized');

  return { supabase, user };
}

export function displayName(p: { first_name: string | null; last_name: string | null; email: string | null }) {
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
  return name || p.email || 'Unknown user';
}

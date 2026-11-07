import { signOutAction } from '../actions';

export default function NotAuthorized() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">Not authorized</h1>
      <p className="max-w-sm text-zinc-500">
        You’re signed in, but your account isn’t a superadmin. Ask an existing admin to set
        <code className="mx-1 rounded bg-zinc-100 px-1 dark:bg-zinc-800">profiles.is_superadmin</code> for you.
      </p>
      <form action={signOutAction}>
        <button className="rounded-full border px-5 py-2 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">Sign out</button>
      </form>
    </div>
  );
}

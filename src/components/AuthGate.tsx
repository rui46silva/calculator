'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { StoreProvider } from '@/data/store';
import { Layout } from './Layout';

/** Only renders the app for signed-in users; everyone else is sent to /login. */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;

  useEffect(() => {
    if (!isPending && !user) router.replace('/login');
  }, [isPending, user, router]);

  if (!user) return <div className="splash">A carregar…</div>;

  return (
    <StoreProvider key={user.id} user={{ id: user.id, email: user.email ?? '', name: user.name ?? '', createdAt: String(user.createdAt) }}>
      <Layout>{children}</Layout>
    </StoreProvider>
  );
}

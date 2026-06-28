import { auth } from '@clerk/nextjs/server';
import { mintCliToken, isConfigured, registerToken } from '@/lib/cli-token';
import { limited } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// Called by the /cli-auth page (Clerk-cookie authenticated) to mint a long-lived
// CLI token for the signed-in user. The token is what the CLI stores and sends as a
// Bearer credential.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const rl = limited('cli-token', userId, 10, 60_000);
  if (rl) return rl;
  if (!isConfigured()) return Response.json({ error: 'CLI tokens are not configured on the server' }, { status: 503 });

  const { token, jti } = mintCliToken(userId);
  await registerToken(jti, userId); // record so it can be revoked later
  return Response.json({ token, userId });
}

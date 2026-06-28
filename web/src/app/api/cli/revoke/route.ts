import { verifyCliToken, bearerFrom, revokeToken } from '@/lib/cli-token';
import { limited } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// Revoke the token presented (used by `easymd logout`). Idempotent.
export async function POST(req: Request) {
  const v = verifyCliToken(bearerFrom(req));
  if (!v) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const rl = limited('cli-revoke', v.userId, 20, 60_000);
  if (rl) return rl;
  await revokeToken(v.jti, v.userId);
  return Response.json({ ok: true });
}

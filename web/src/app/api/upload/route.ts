import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { limited } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = 'uploads';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const safe = (s: string) => s.toLowerCase().replace(/[^a-z0-9.\-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

// Uploads an image to Supabase Storage and returns a public URL. The browser editor
// calls this; on any failure it falls back to inlining the image as a data URI.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const rl = limited('upload', userId, 30, 60_000);
  if (rl) return rl;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'storage not configured' }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'no file' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: 'file too large (max 10 MB)' }, { status: 413 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Ensure the public bucket exists (idempotent — ignore "already exists").
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});

  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${userId}/${Date.now()}-${safe(file.name.replace(/\.[^.]+$/, '')) || 'image'}.${safe(ext)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (error) return Response.json({ error: error.message }, { status: 502 });

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return Response.json({ url: data.publicUrl, name: file.name });
}

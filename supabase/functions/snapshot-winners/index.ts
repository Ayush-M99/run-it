// Supabase Edge Function — fallback for pg_cron.
//
// Deploy:  supabase functions deploy snapshot-winners
// Schedule via Supabase Dashboard → Edge Functions → snapshot-winners → "Schedule":
//   Cron:  5 0 * * *           (every day at 00:05 UTC)
//   Or via the CLI:  supabase functions schedule snapshot-winners "5 0 * * *"
//
// Required secrets (Dashboard → Edge Functions → Secrets, or `supabase secrets set ...`):
//   SUPABASE_URL              (auto-populated)
//   SUPABASE_SERVICE_ROLE_KEY (auto-populated)

// @ts-expect-error — Deno globals; this file runs in Supabase Edge Runtime, not the Expo bundle.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// @ts-expect-error — Deno.serve is the Edge Runtime entry point.
Deno.serve(async () => {
  // @ts-expect-error
  const url = Deno.env.get('SUPABASE_URL')!;
  // @ts-expect-error
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await sb.rpc('snapshot_daily_winners', { p_date: yesterday });
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ ok: true, date: yesterday, winners_written: data }), {
    headers: { 'content-type': 'application/json' },
  });
});

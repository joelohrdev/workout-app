import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as webpush from "web-push";

let configured: boolean | null = null;

function configure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const site = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const subject = process.env.VAPID_SUBJECT ?? (site ? `https://${site}` : "mailto:admin@example.com");
  configured = !!(pub && priv);
  if (configured) webpush.setVapidDetails(subject, pub!, priv!);
  return configured;
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** Send to every device the user subscribed. Drops subscriptions the push service says are gone. */
export async function sendToUser(client: SupabaseClient, userId: string, payload: PushPayload): Promise<number> {
  if (!configure()) return 0;
  const { data: subs } = await client
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id", userId);
  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 300, urgency: "high" },
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await client.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }),
  );
  return sent;
}

export function pushConfigured() {
  return configure();
}

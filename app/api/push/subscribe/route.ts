import { userFromRequest } from "@/lib/server/supabase";

type Body = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** Save this device's push subscription for the signed-in user. */
export async function POST(req: Request) {
  const auth = await userFromRequest(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.endpoint?.startsWith("https://") || !body.keys?.p256dh || !body.keys?.auth)
    return Response.json({ error: "Invalid subscription" }, { status: 400 });
  const { error } = await auth.client.from("push_subscriptions").upsert(
    { endpoint: body.endpoint, user_id: auth.user.id, p256dh: body.keys.p256dh, auth: body.keys.auth },
    { onConflict: "endpoint" },
  );
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

/** Forget this device's subscription. */
export async function DELETE(req: Request) {
  const auth = await userFromRequest(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { endpoint } = (await req.json().catch(() => ({}))) as Body;
  if (endpoint) await auth.client.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return Response.json({ ok: true });
}

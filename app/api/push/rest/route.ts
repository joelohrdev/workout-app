import { after } from "next/server";
import { sendToUser } from "@/lib/server/push";
import { userFromRequest } from "@/lib/server/supabase";

// Rest can be up to 5 minutes; keep the function alive long enough to send.
export const maxDuration = 300;

const MAX_WAIT_MS = 290_000;

/**
 * The app calls this when it goes to the background mid-rest. We wait until
 * the rest ends, then push "Rest's over" — unless the app cancelled it
 * (came back to the foreground, skipped, or started a different rest).
 */
export async function POST(req: Request) {
  const auth = await userFromRequest(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { endsAt } = (await req.json().catch(() => ({}))) as { endsAt?: number };
  const wait = typeof endsAt === "number" ? endsAt - Date.now() : -1;
  if (wait <= 0 || wait > MAX_WAIT_MS) return Response.json({ error: "endsAt out of range" }, { status: 400 });

  const endsIso = new Date(endsAt!).toISOString();
  const { error } = await auth.client
    .from("rest_alerts")
    .upsert({ user_id: auth.user.id, ends_at: endsIso }, { onConflict: "user_id" });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  after(async () => {
    await new Promise((r) => setTimeout(r, wait));
    const { data } = await auth.client.from("rest_alerts").select("ends_at").eq("user_id", auth.user.id).maybeSingle();
    // cancelled or replaced by a newer rest
    if (!data || new Date(data.ends_at).getTime() !== endsAt) return;
    await auth.client.from("rest_alerts").delete().eq("user_id", auth.user.id);
    await sendToUser(auth.client, auth.user.id, {
      title: "Rest's over",
      body: "Time for your next set.",
      url: "/workout",
      tag: "rest",
    });
  });
  return Response.json({ ok: true }, { status: 202 });
}

export async function DELETE(req: Request) {
  const auth = await userFromRequest(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });
  await auth.client.from("rest_alerts").delete().eq("user_id", auth.user.id);
  return Response.json({ ok: true });
}

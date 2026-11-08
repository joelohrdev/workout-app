import { sendToUser } from "@/lib/server/push";
import { adminClient } from "@/lib/server/supabase";
import type { Settings } from "@/lib/types";

/**
 * Called every 15 minutes by a scheduler (Supabase pg_cron, see
 * supabase/migrations/003_reminder_cron.sql). Sends a workout reminder to
 * each user whose reminder time has passed today, once per day.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const admin = adminClient();
  if (!admin) return Response.json({ error: "SUPABASE_SECRET_KEY not set" }, { status: 500 });

  const { data: rows, error } = await admin
    .from("gym_records")
    .select("user_id,data")
    .eq("kind", "settings")
    .eq("deleted", false);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const now = new Date();
  let sent = 0;
  for (const row of rows ?? []) {
    const r = (row.data as Partial<Settings>).reminders;
    if (!r?.enabled || !r.days?.length || !r.time) continue;
    const local = localParts(now, r.tz || "UTC");
    if (!local || !r.days.includes(local.weekday)) continue;
    const [hh, mm] = r.time.split(":").map(Number);
    const minutesPast = local.hour * 60 + local.minute - (hh * 60 + mm);
    // only within 2 hours after the chosen time, so a late cron run still sends but a midnight one doesn't
    if (minutesPast < 0 || minutesPast > 120) continue;

    const { error: dup } = await admin.from("reminder_log").insert({ user_id: row.user_id, day: local.date });
    if (dup) continue; // already reminded today
    sent += await sendToUser(admin, row.user_id, {
      title: "Workout day 💪",
      body: "Your home gym is waiting. Tap to start today's workout.",
      url: "/",
      tag: "reminder",
    });
  }
  return Response.json({ ok: true, sent });
}

function localParts(d: Date, tz: string) {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "short",
        hourCycle: "h23",
      })
        .formatToParts(d)
        .map((p) => [p.type, p.value]),
    );
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
    return {
      weekday,
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      date: `${parts.year}-${parts.month}-${parts.day}`,
    };
  } catch {
    return null;
  }
}

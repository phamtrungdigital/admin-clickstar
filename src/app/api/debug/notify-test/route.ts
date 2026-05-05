import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { notifyMentions } from "@/lib/notifications/mentions";

// TEMPORARY DEBUG ROUTE — remove after diagnosing why notify chain fails
// silently on production. Hit `/api/debug/notify-test?secret=ckstar2026`
// to run the same admin insert path and see the actual error.

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== "ckstar2026") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const result: Record<string, unknown> = {};

  // Step 1: env presence
  result.env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY_present: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY_len: process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0,
    SUPABASE_SERVICE_ROLE_KEY_prefix:
      process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 10) ?? "",
  };

  // Step 2: createAdminClient
  let admin;
  try {
    admin = createAdminClient();
    result.adminClientCreated = true;
  } catch (e) {
    result.adminClientCreated = false;
    result.adminClientError = String(e);
    return NextResponse.json(result);
  }

  // Step 3: Direct admin insert into notifications
  try {
    const { data, error } = await admin
      .from("notifications")
      .insert({
        user_id: "b1225efb-50d4-4704-83ca-d95781260e10",
        company_id: null,
        channel: "in_app",
        title: "[DEBUG] direct admin insert",
        body: "test from /api/debug/notify-test",
        link_url: "/debug",
        entity_type: "debug",
        entity_id: "92f70e6d-69a4-4c19-b4c7-145e467ab258",
        read_at: null,
        metadata: {},
      })
      .select("id");
    result.directInsert = { ok: !error, data, error };
  } catch (e) {
    result.directInsert = { ok: false, threw: String(e) };
  }

  // Step 4: notify() helper
  try {
    await notify([
      {
        user_id: "b1225efb-50d4-4704-83ca-d95781260e10",
        title: "[DEBUG] notify() helper",
        body: "via notify() function",
        link_url: "/debug",
        entity_type: "debug",
        entity_id: "92f70e6d-69a4-4c19-b4c7-145e467ab258",
      },
    ]);
    result.notifyHelper = { ok: true };
  } catch (e) {
    result.notifyHelper = { ok: false, threw: String(e) };
  }

  // Step 5: notifyMentions() with simulated mention body
  try {
    const mentionedIds = await notifyMentions({
      actorId: "00000000-0000-0000-0000-000000000000", // not the mentioned user
      actorName: "Debug Tester",
      entityLabel: 'công việc "DEBUG"',
      entityType: "debug",
      entityId: "92f70e6d-69a4-4c19-b4c7-145e467ab258",
      linkUrl: "/debug",
      companyId: null,
      body: "test @[Nhân viên Test](b1225efb-50d4-4704-83ca-d95781260e10) ơi",
      alreadyNotifiedUserIds: new Set(),
    });
    result.notifyMentions = { ok: true, mentionedIds: Array.from(mentionedIds) };
  } catch (e) {
    result.notifyMentions = { ok: false, threw: String(e) };
  }

  return NextResponse.json(result);
}

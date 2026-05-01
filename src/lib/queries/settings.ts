import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  KEY_MAP,
  type SettingsInput,
} from "@/lib/validation/settings";

const DEFAULTS: SettingsInput = {
  orgName: "Clickstar",
  orgTagline: "Giải pháp Digital & Automation toàn diện",
  orgAddress: "",
  orgTaxCode: "",
  orgSupportEmail: "support@clickstar.vn",
  businessDefaultVat: 8,
  businessDefaultCurrency: "VND",
  notificationsEmailEnabled: true,
  notificationsZnsEnabled: false,
};

/** Read all settings as a single typed object, falling back to defaults. */
export async function getSystemSettings(): Promise<SettingsInput> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_settings")
    .select("key, value");
  if (error) throw new Error(error.message);

  const dbMap = new Map<string, unknown>();
  for (const row of (data ?? []) as Array<{ key: string; value: unknown }>) {
    dbMap.set(row.key, row.value);
  }

  const out = { ...DEFAULTS } as Record<string, unknown>;
  for (const [formKey, dbKey] of Object.entries(KEY_MAP)) {
    if (dbMap.has(dbKey)) {
      out[formKey] = dbMap.get(dbKey);
    }
  }
  return out as SettingsInput;
}

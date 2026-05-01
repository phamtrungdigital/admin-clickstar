import { z } from "zod";

const trimmed = z.string().trim();

/**
 * Form-friendly shape: flat camelCase keys (RHF can't handle dotted keys
 * because it treats dots as nested paths). The persisted DB keys keep the
 * `org.*` / `business.*` / `notifications.*` namespaces — see KEY_MAP.
 */
export const settingsSchema = z.object({
  orgName: trimmed.min(1, "Tên tổ chức không được trống").max(255),
  orgTagline: trimmed.max(255),
  orgAddress: trimmed.max(500),
  orgTaxCode: trimmed.max(64),
  orgSupportEmail: trimmed
    .max(255)
    .refine(
      (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Email không hợp lệ",
    ),
  businessDefaultVat: z
    .number()
    .min(0, "VAT không âm")
    .max(100, "VAT không vượt 100%"),
  businessDefaultCurrency: trimmed.min(1).max(8),
  notificationsEmailEnabled: z.boolean(),
  notificationsZnsEnabled: z.boolean(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

/** Map between RHF camelCase keys and the dotted DB keys we persist. */
export const KEY_MAP = {
  orgName: "org.name",
  orgTagline: "org.tagline",
  orgAddress: "org.address",
  orgTaxCode: "org.tax_code",
  orgSupportEmail: "org.support_email",
  businessDefaultVat: "business.default_vat",
  businessDefaultCurrency: "business.default_currency",
  notificationsEmailEnabled: "notifications.email_enabled",
  notificationsZnsEnabled: "notifications.zns_enabled",
} as const satisfies Record<keyof SettingsInput, string>;

export const SETTING_FORM_KEYS = Object.keys(KEY_MAP) as Array<
  keyof SettingsInput
>;

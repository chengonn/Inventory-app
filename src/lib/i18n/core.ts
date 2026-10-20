import { english } from "./english";
export type Locale = "zh-Hant" | "en";
export const LOCALE_COOKIE = "inventory-locale";
export function parseLocale(value?: string): Locale {
  return value === "en" ? "en" : "zh-Hant";
}
// Only presentation messages go here, never item names, units or user notes.
export function translator(locale: Locale) {
  return (text: string): string => {
    if (locale !== "en") return text;
    const normalized = text.replace(/\s+/g, " ").trim();
    if (english[normalized] !== undefined) return english[normalized];
    // Validation includes a field name; translate the message, not arbitrary data.
    const field = normalized.match(
      /^([A-Za-z][A-Za-z0-9]*) 未填或超過長度限制。$/,
    );
    if (field) return `${field[1]} is required or exceeds the length limit.`;
    return text;
  };
}

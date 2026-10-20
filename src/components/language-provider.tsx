"use client";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, translator, type Locale } from "@/lib/i18n/core";
const Context = createContext<{
  locale: Locale;
  change: (locale: Locale) => void;
  pending: boolean;
}>({ locale: "zh-Hant", change: () => {}, pending: false });
export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function change(next: Locale) {
    // Preference cookie only: it grants no authority and contains no credentials.
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    document.documentElement.lang = next;
    setLocale(next);
    startTransition(() => router.refresh());
  }
  return (
    <Context.Provider value={{ locale, change, pending }}>
      {children}
    </Context.Provider>
  );
}
export function useT() {
  const { locale } = useContext(Context);
  return useMemo(() => translator(locale), [locale]);
}
export function LanguageSwitcher() {
  const { locale, change, pending } = useContext(Context);
  return (
    <label className="inline-flex min-h-11 shrink-0 items-center text-sm">
      <span className="sr-only">語言 / Language</span>
      <select
        aria-label="語言 / Language"
        value={locale}
        disabled={pending}
        onChange={(e) => change(e.target.value === "en" ? "en" : "zh-Hant")}
        className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-slate-800"
      >
        <option value="zh-Hant">繁體中文</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}

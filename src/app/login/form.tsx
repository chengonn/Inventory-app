"use client";
import { useT } from "@/components/language-provider";

import { useActionState, useRef } from "react";
import { login } from "./actions";

export function LoginForm({
  disabled = false,
  guest,
}: {
  disabled?: boolean;
  guest?: { email: string; password: string } | null;
}) {
  const t = useT();

  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(login, { error: "" });
  return (
    <form ref={form} action={action} className="mt-7 space-y-5">
      {guest && (
        <section
          aria-label={t("訪客帳號")}
          className="space-y-2 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm"
        >
          <h2 className="font-semibold">{t("訪客體驗帳號")}</h2>
          <p>
            {t("帳號：")}
            <span className="break-all select-all">{guest.email}</span>
          </p>
          <p>
            {t("密碼：")}
            <code className="break-all select-all">{guest.password}</code>
          </p>
          <p>
            {t(
              "共用虛構資料；可建檔、入出庫與盤點，無管理及匯出權限。請勿輸入個人或公司資料。",
            )}
          </p>
          <button
            type="button"
            disabled={disabled || pending}
            className="min-h-11 rounded-lg border border-teal-700 px-4"
            onClick={() => {
              const email = form.current?.elements.namedItem("email");
              const password = form.current?.elements.namedItem("password");
              if (email instanceof HTMLInputElement) email.value = guest.email;
              if (password instanceof HTMLInputElement)
                password.value = guest.password;
            }}
          >
            {t("填入訪客帳密")}
          </button>
        </section>
      )}
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          disabled={disabled || pending}
          className="min-h-12 w-full rounded-xl border border-slate-300 px-4 text-base focus:outline-2 focus:outline-teal-700"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">
          {t("密碼")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={1024}
          disabled={disabled || pending}
          className="min-h-12 w-full rounded-xl border border-slate-300 px-4 text-base focus:outline-2 focus:outline-teal-700"
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm leading-6 text-red-800">
          {t(state.error)}
        </p>
      )}
      <button
        disabled={disabled || pending}
        className="min-h-12 w-full rounded-xl bg-teal-900 px-4 font-medium text-white disabled:opacity-50"
      >
        {pending ? t("登入中…") : t("登入")}
      </button>
    </form>
  );
}

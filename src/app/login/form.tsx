"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm({ disabled = false }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState(login, { error: "" });
  return <form action={action} className="mt-7 space-y-5">
    <div><label htmlFor="email" className="mb-2 block text-sm font-medium">Email</label>
      <input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} disabled={disabled || pending} className="min-h-12 w-full rounded-xl border border-slate-300 px-4 text-base focus:outline-2 focus:outline-teal-700" /></div>
    <div><label htmlFor="password" className="mb-2 block text-sm font-medium">密碼</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} disabled={disabled || pending} className="min-h-12 w-full rounded-xl border border-slate-300 px-4 text-base focus:outline-2 focus:outline-teal-700" /></div>
    {state.error && <p role="alert" className="text-sm leading-6 text-red-800">{state.error}</p>}
    <button disabled={disabled || pending} className="min-h-12 w-full rounded-xl bg-teal-900 px-4 font-medium text-white disabled:opacity-50">{pending ? "登入中…" : "登入"}</button>
  </form>;
}

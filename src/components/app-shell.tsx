"use client";
import { useT } from "@/components/language-provider";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { navigation } from "@/lib/navigation";
import { logout } from "@/app/login/actions";
import { LanguageSwitcher } from "./language-provider";

export function AppShell({
  children,
  guest = false,
}: {
  children: React.ReactNode;
  guest?: boolean;
}) {
  const t = useT();

  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  const links = (
    <nav aria-label={t("主要導覽")} className="space-y-1">
      {navigation
        .filter(
          (item) =>
            !guest ||
            !["/items", "/locations", "/review", "/import-export"].includes(
              item.href,
            ),
        )
        .map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={pathname === item.href ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${pathname === item.href ? "bg-teal-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <span className="font-mono text-xs opacity-60" aria-hidden="true">
              {item.mark}
            </span>
            {t(item.label)}
          </Link>
        ))}
    </nav>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:p-4"
      >
        {t("跳至主要內容")}
      </a>
      <aside className="hidden border-r border-slate-200 bg-white p-5 lg:flex lg:flex-col">
        <Brand />
        <div className="mt-9">{links}</div>
        <p className="mt-auto pt-10 text-xs leading-6 text-slate-500">
          {t("內部庫存管理")}
          <br />
          {t("雲端版 V2")}
        </p>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-20 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-5 py-3 sm:px-9">
          <div className="lg:hidden">
            <Brand />
          </div>
          <p className="hidden text-sm text-slate-500 lg:block">
            {t("工作空間")}
            <span className="mx-3 text-slate-300">/</span>
            {t("庫存管理")}
          </p>
          <LanguageSwitcher />
          <form action={logout}>
            <button className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm">
              {t("登出")}
            </button>
          </form>
          <button
            aria-label={t("開啟導覽")}
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="min-h-11 min-w-11 rounded-lg border border-slate-300 px-3 text-sm lg:hidden"
          >
            {t("選單")}
          </button>
        </header>
        <main
          id="main"
          className="mx-auto max-w-7xl px-5 py-8 sm:px-9 sm:py-10"
        >
          {children}
        </main>
      </div>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
        className="m-0 h-dvh max-h-none w-80 max-w-[90vw] border-0 bg-white p-5 backdrop:bg-slate-950/40"
      >
        <div className="mb-6 flex items-center justify-between">
          <Brand />
          <button
            aria-label={t("關閉導覽")}
            onClick={() => setOpen(false)}
            className="min-h-11 min-w-11 rounded-lg border border-slate-200"
          >
            {t("關閉")}
          </button>
        </div>
        {links}
      </dialog>
    </div>
  );
}

function Brand() {
  const t = useT();

  return (
    <Link
      href="/dashboard"
      className="flex min-h-11 items-center gap-3 font-semibold tracking-wide"
    >
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-xl bg-teal-900 text-white"
      >
        {t("庫")}
      </span>
      <span>
        {t("庫存管理")}
        <span className="ml-2 text-xs font-normal text-slate-400">V2</span>
      </span>
    </Link>
  );
}

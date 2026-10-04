"use client";
import { useState } from "react";
export function ExportButton({ href, children, fileName }: { href: string; children: React.ReactNode; fileName: string }) {
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  return <div><button type="button" disabled={pending} className="min-h-11 rounded-lg border border-teal-800 bg-white px-4 py-2 text-teal-900 disabled:opacity-50" onClick={async () => {
    if (pending) return; setPending(true); setError("");
    try {
      const response = await fetch(href, { cache: "no-store", redirect: "error" });
      if (!response.ok) { setError((await response.text()).slice(0, 300)); return; }
      if (!response.headers.get("content-type")?.includes("spreadsheetml")) throw new Error("Invalid export response");
      const url = URL.createObjectURL(await response.blob()), link = document.createElement("a");
      link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch { setError("無法下載，請確認登入與網路後重試。"); } finally { setPending(false); }
  }}>{pending ? "產生 Excel…" : children}</button>{error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}</div>;
}

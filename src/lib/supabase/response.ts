import "server-only";

/** Apply to every matched request, including Server Action responses. */
export function preventAuthCaching(headers: Headers) {
  headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
}

export function applyAuthHeaders(target: Headers, supplied: Record<string, string>) {
  Object.entries(supplied).forEach(([name, value]) => target.set(name, value));
  preventAuthCaching(target);
}

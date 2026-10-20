import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseLocale, translator } from "./core";
export async function getLocale() {
  return parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}
export async function getT() {
  return translator(await getLocale());
}

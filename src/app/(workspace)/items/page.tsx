import { requireManagerPage } from "@/lib/auth/guard";
import { MasterPage, type MasterSearch } from "@/components/master-page";
export const dynamic = "force-dynamic";
export default async function Items({
  searchParams,
}: {
  searchParams: MasterSearch;
}) {
  await requireManagerPage();
  return <MasterPage kind="items" searchParams={searchParams} />;
}

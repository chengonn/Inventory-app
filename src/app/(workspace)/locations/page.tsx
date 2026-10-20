import { requireManagerPage } from "@/lib/auth/guard";
import { MasterPage, type MasterSearch } from "@/components/master-page";
export const dynamic = "force-dynamic";
export default async function Locations({
  searchParams,
}: {
  searchParams: MasterSearch;
}) {
  await requireManagerPage();
  return <MasterPage kind="locations" searchParams={searchParams} />;
}

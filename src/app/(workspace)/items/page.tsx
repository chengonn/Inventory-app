import { MasterPage, type MasterSearch } from "@/components/master-page";
export const dynamic = "force-dynamic";
export default function Items({ searchParams }: { searchParams: MasterSearch }) { return <MasterPage kind="items" searchParams={searchParams} />; }

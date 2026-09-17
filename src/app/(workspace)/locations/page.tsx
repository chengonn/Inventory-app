import { MasterPage, type MasterSearch } from "@/components/master-page";
export const dynamic = "force-dynamic";
export default function Locations({ searchParams }: { searchParams: MasterSearch }) { return <MasterPage kind="locations" searchParams={searchParams} />; }

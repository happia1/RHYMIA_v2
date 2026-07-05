import { requireWorkspaceContext } from "@/lib/workspace";
import { RoutineEditor } from "@/components/schedule/RoutineEditor";
import type { Routine } from "@/types";

export default async function RoutinePage() {
  const { supabase, user } = await requireWorkspaceContext();

  const { data: routines } = await supabase
    .from("routine")
    .select("*")
    .eq("user_id", user.id);

  return <RoutineEditor initialRoutines={(routines as Routine[]) ?? []} />;
}

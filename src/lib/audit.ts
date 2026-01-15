import { supabase } from "@/lib/supabaseServer";

export async function logAudit(args: {
  user_id: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  meta?: any;
}) {
  // audit nesmie zhadzovať request – je to "best effort"
  try {
    await supabase.from("audit_log").insert({
      user_id: args.user_id,
      action: args.action,
      entity: args.entity,
      entity_id: args.entity_id ?? null,
      meta: args.meta ?? null,
    });
  } catch {
    // ignore
  }
}

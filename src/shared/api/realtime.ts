import type { RealtimePostgresChangesFilter, SupabaseClient } from "@supabase/supabase-js";

export function subscribeToTableChanges(
  client: SupabaseClient,
  channelName: string,
  table: string,
  onChange: () => void,
  filter?: string
): () => void {
  if (typeof client.channel !== "function") {
    return () => {};
  }

  const config: RealtimePostgresChangesFilter<"*"> = filter
    ? { event: "*", schema: "public", table, filter }
    : { event: "*", schema: "public", table };

  const channel = client
    .channel(channelName)
    .on("postgres_changes", config, onChange)
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}

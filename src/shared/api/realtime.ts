import type { RealtimePostgresChangesFilter, SupabaseClient } from "@supabase/supabase-js";

// The Supabase realtime client returns the SAME channel instance when `.channel()`
// is called again with a topic that already exists (e.g. because two screens are
// subscribed to the same calendar at once). Calling `.on()` on a channel that has
// already been `.subscribe()`d throws, so every subscription needs a topic that is
// unique to this particular call, not just to the table/calendar it watches.
let subscriptionSequence = 0;

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

  subscriptionSequence += 1;
  const uniqueChannelName = `${channelName}-${Date.now()}-${subscriptionSequence}`;

  const channel = client
    .channel(uniqueChannelName)
    .on("postgres_changes", config, onChange)
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}

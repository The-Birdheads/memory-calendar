import { router, useLocalSearchParams } from "expo-router";

import { EventDetailContent } from "../../src/features/events/components/EventDetailContent";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id ?? "";

  // EventDetailContent owns its own header (back button, safe-area aware)
  // now, so this route doesn't need a native Stack header at all - it
  // inherits the root layout's headerShown: false.
  return <EventDetailContent eventId={eventId} onBack={() => router.back()} onDeleted={() => router.back()} />;
}

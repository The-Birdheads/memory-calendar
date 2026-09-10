import { Modal } from "react-native";

import { EventDetailContent } from "./EventDetailContent";

export interface EventDetailModalProps {
  /** The event to show, or null to keep the modal closed. */
  eventId: string | null;
  onClose: () => void;
}

/**
 * The common "view/edit an event without leaving the current tab" modal -
 * a full-screen slide-up Modal around EventDetailContent, closing on back or
 * on delete. Shared by every screen that isn't the calendar screen itself
 * (history's timeline, the ToDo tab's "..." button, the memories grid) so
 * they don't each re-implement the same Modal + state wiring.
 */
export function EventDetailModal({ eventId, onClose }: EventDetailModalProps) {
  return (
    <Modal visible={eventId !== null} animationType="slide" onRequestClose={onClose}>
      {eventId !== null ? (
        <EventDetailContent eventId={eventId} onBack={onClose} onDeleted={onClose} showGoToCalendarButton />
      ) : null}
    </Modal>
  );
}

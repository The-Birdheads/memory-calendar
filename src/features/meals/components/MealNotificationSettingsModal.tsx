import { useState } from "react";
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { MEAL_SLOT_ICONS, MEAL_SLOT_LABELS } from "./MealRow";
import {
  dateToTimeString,
  NOTIFICATION_MEAL_SLOTS,
  timeStringToDate,
  type MealNotificationSettings,
} from "../notificationSettings";
import type { MealSlot } from "../types";
import { Icon } from "../../../shared/components/Icon";
import { ToggleSwitch } from "../../../shared/components/ToggleSwitch";
import { DATE_PICKER_LOCALE } from "../../../shared/utils/pickerLocale";

export interface MealNotificationSettingsModalProps {
  visible: boolean;
  settings: MealNotificationSettings;
  /** 設定が変わるたびに呼ばれる(呼び出し側で保存する)。 */
  onChange: (next: MealNotificationSettings) => void;
  onClose: () => void;
}

/** "08:00" → "8:00"(先頭の0を落として読みやすくする)。 */
function formatTimeLabel(time: string): string {
  return time.replace(/^0/, "");
}

/**
 * 献立の通知設定。マスターの「予定に登録した献立の通知」をオンにすると、朝食/昼食/夕食/間食を
 * それぞれオンオフでき、オンの項目だけ通知時刻を設定できる。トグルは押した時点で保存し、
 * 時刻はピッカーを回している間は保存せず、完了(または閉じる/別の項目を開く)で反映する。
 */
export function MealNotificationSettingsModal({ visible, settings, onChange, onClose }: MealNotificationSettingsModalProps) {
  const [pickerSlot, setPickerSlot] = useState<MealSlot | null>(null);
  const [pickerTime, setPickerTime] = useState(() => new Date());

  const commitPicker = () => {
    if (pickerSlot === null) return;
    const time = dateToTimeString(pickerTime);
    if (time !== settings.slots[pickerSlot].time) {
      onChange({ ...settings, slots: { ...settings.slots, [pickerSlot]: { ...settings.slots[pickerSlot], time } } });
    }
    setPickerSlot(null);
  };

  const handleClose = () => {
    commitPicker();
    onClose();
  };

  const handleOpenPicker = (slot: MealSlot) => {
    if (pickerSlot !== null && pickerSlot !== slot) commitPicker();
    setPickerTime(timeStringToDate(settings.slots[slot].time));
    setPickerSlot(slot);
  };

  const handleToggleSlot = (slot: MealSlot, enabled: boolean) => {
    if (pickerSlot === slot) setPickerSlot(null);
    onChange({ ...settings, slots: { ...settings.slots, [slot]: { ...settings.slots[slot], enabled } } });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity testID="meal-notify-backdrop" style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.sheet}>
            <Text style={styles.title}>献立の通知</Text>

            <View style={styles.row}>
              <View style={styles.rowTextBlock}>
                <Text style={styles.rowLabel}>予定に登録した献立の通知</Text>
                <Text style={styles.rowHint}>設定した時刻に、その日に予定した献立をお知らせします。</Text>
              </View>
              <ToggleSwitch
                testID="meal-notify-master"
                value={settings.enabled}
                accessibilityLabel="予定に登録した献立の通知"
                onValueChange={(enabled) => {
                  if (!enabled) setPickerSlot(null);
                  onChange({ ...settings, enabled });
                }}
              />
            </View>

            {settings.enabled
              ? NOTIFICATION_MEAL_SLOTS.map((slot) => {
                  const slotSettings = settings.slots[slot];
                  return (
                    <View key={slot} style={styles.slotBlock}>
                      <View style={styles.row}>
                        <View style={styles.slotLabelRow}>
                          <Icon name={MEAL_SLOT_ICONS[slot]} size={20} color="#444" />
                          <Text style={styles.rowLabel}>{MEAL_SLOT_LABELS[slot]}</Text>
                        </View>
                        <ToggleSwitch
                          testID={`meal-notify-slot-${slot}`}
                          value={slotSettings.enabled}
                          accessibilityLabel={`${MEAL_SLOT_LABELS[slot]}の通知`}
                          onValueChange={(enabled) => handleToggleSlot(slot, enabled)}
                        />
                      </View>

                      {slotSettings.enabled ? (
                        <TouchableOpacity
                          testID={`meal-notify-time-${slot}`}
                          style={styles.timeField}
                          onPress={() => handleOpenPicker(slot)}
                        >
                          <Text style={styles.timeFieldLabel}>通知時刻</Text>
                          <Text testID={`meal-notify-time-${slot}-value`} style={styles.timeFieldValue}>
                            {formatTimeLabel(slotSettings.time)}
                          </Text>
                        </TouchableOpacity>
                      ) : null}

                      {pickerSlot === slot ? (
                        <View style={styles.pickerBlock}>
                          <DateTimePicker
                            testID="meal-notify-time-picker"
                            value={pickerTime}
                            mode="time"
                            display={Platform.OS === "ios" ? "spinner" : "default"}
                            locale={DATE_PICKER_LOCALE}
                            minuteInterval={5}
                            onChange={(_event, selected) => {
                              if (selected) setPickerTime(selected);
                            }}
                          />
                          <TouchableOpacity testID="meal-notify-time-done" style={styles.pickerDone} onPress={commitPicker}>
                            <Text style={styles.pickerDoneText}>完了</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              : null}

            <TouchableOpacity testID="meal-notify-close" style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowTextBlock: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 16,
    color: "#222",
  },
  rowHint: {
    fontSize: 12,
    color: "#888",
  },
  slotBlock: {
    gap: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
  },
  slotLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timeFieldLabel: {
    color: "#666",
  },
  timeFieldValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2f6fed",
  },
  pickerBlock: {
    alignSelf: "stretch",
    overflow: "hidden",
  },
  pickerDone: {
    alignSelf: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pickerDoneText: {
    color: "#2f6fed",
    fontWeight: "700",
  },
  closeButton: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#f2f3f5",
    marginTop: 4,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#444",
  },
});

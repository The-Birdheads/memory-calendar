import { useContext } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { useModalTopInset } from "../../../shared/hooks/useModalTopInset";
import { RELEASE_NOTES } from "../releases";

export interface ReleaseNotesModalProps {
  visible: boolean;
  onClose: () => void;
}

/** 新機能・改善のお知らせ。新しいバージョンが上に並び、閉じるボタンで閉じる。 */
export function ReleaseNotesModal({ visible, onClose }: ReleaseNotesModalProps) {
  const topInset = useModalTopInset();
  const bottomInset = useContext(SafeAreaInsetsContext)?.bottom ?? 0;

  return (
    <Modal
      testID="release-notes-modal"
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset + 16 }]}>
        <Text style={styles.heading}>更新内容</Text>
        <ScrollView testID="release-notes-scroll" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {RELEASE_NOTES.map((note) => (
            <View key={note.version} testID={`release-notes-${note.version}`} style={styles.release}>
              <View style={styles.releaseHeader}>
                <Text style={styles.version}>バージョン {note.version}</Text>
                <Text style={styles.releasedOn}>{note.releasedOn}</Text>
              </View>
              {note.items.map((item) => (
                <View key={item.title} style={styles.item}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemBody}>{item.body}</Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
        <TouchableOpacity testID="release-notes-close" style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>閉じる</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
    textAlign: "center",
    paddingVertical: 12,
  },
  content: {
    gap: 24,
    paddingVertical: 8,
  },
  release: {
    gap: 14,
  },
  releaseHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e3e8",
  },
  version: {
    fontSize: 17,
    fontWeight: "700",
    color: "#2f6fed",
  },
  releasedOn: {
    fontSize: 13,
    color: "#888",
  },
  item: {
    gap: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
  },
  itemBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "#555",
  },
  closeButton: {
    backgroundColor: "#2f6fed",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});

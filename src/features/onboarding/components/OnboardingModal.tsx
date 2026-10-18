import { useContext, useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { Icon } from "../../../shared/components/Icon";
import { useModalTopInset } from "../../../shared/hooks/useModalTopInset";
import { ONBOARDING_SLIDES } from "../slides";

/** 案内を閉じたときの次の動き: そのまま閉じる / 共有カレンダー作成へ / 最初の予定の作成へ。 */
export type OnboardingAction = "dismiss" | "create-calendar" | "create-event";

export interface OnboardingModalProps {
  visible: boolean;
  onClose: (action: OnboardingAction) => void;
}

// スライドの枚数 + 最後の「始める」画面。
const STEP_COUNT = ONBOARDING_SLIDES.length + 1;

/**
 * 初回の案内(チュートリアル)。数枚のスライドでアプリの特徴を紹介し、最後に「共有カレンダーを
 * つくる / 最初の予定を作る / あとで」を選んでもらう。どのスライドでもスキップできる。
 * 表示するたびに最初のスライドから始まる(個人設定から見直すときのため)。
 */
export function OnboardingModal({ visible, onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const topInset = useModalTopInset();
  const bottomInset = useContext(SafeAreaInsetsContext)?.bottom ?? 0;

  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  const isLast = step === STEP_COUNT - 1;
  const slide = isLast ? null : ONBOARDING_SLIDES[step];

  return (
    <Modal testID="onboarding-modal" visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => onClose("dismiss")}>
      <View
        testID="onboarding-container"
        style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset + 16 }]}
      >
        <View style={styles.topRow}>
          {isLast ? null : (
            <TouchableOpacity
              testID="onboarding-skip"
              onPress={() => onClose("dismiss")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.skipText}>スキップ</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Icon name={slide ? slide.icon : "plus"} size={44} color="#2f6fed" />
          </View>
          <Text testID="onboarding-title" style={styles.title}>
            {slide ? slide.title : "さっそく始めましょう"}
          </Text>
          <Text testID="onboarding-body" style={styles.body}>
            {slide ? slide.body : "まずは、共有カレンダーをつくるか、最初の予定を作ってみましょう。"}
          </Text>
        </View>

        <View style={styles.dots}>
          {Array.from({ length: STEP_COUNT }, (_, index) => (
            <View
              key={index}
              testID={`onboarding-dot-${index}`}
              accessibilityState={{ selected: index === step }}
              style={[styles.dot, index === step && styles.dotActive]}
            />
          ))}
        </View>

        {isLast ? (
          <View style={styles.actions}>
            <TouchableOpacity
              testID="onboarding-create-calendar"
              style={styles.primaryButton}
              onPress={() => onClose("create-calendar")}
            >
              <Text style={styles.primaryButtonText}>共有カレンダーをつくる</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="onboarding-create-event"
              style={styles.secondaryButton}
              onPress={() => onClose("create-event")}
            >
              <Text style={styles.secondaryButtonText}>最初の予定を作る</Text>
            </TouchableOpacity>
            <View style={styles.footerRow}>
              <TouchableOpacity testID="onboarding-back" onPress={() => setStep(step - 1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.textButton}>戻る</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="onboarding-later" onPress={() => onClose("dismiss")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.textButton}>あとで</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity testID="onboarding-next" style={styles.primaryButton} onPress={() => setStep(step + 1)}>
              <Text style={styles.primaryButtonText}>次へ</Text>
            </TouchableOpacity>
            <View style={styles.footerRow}>
              {step > 0 ? (
                <TouchableOpacity testID="onboarding-back" onPress={() => setStep(step - 1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.textButton}>戻る</Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
  },
  topRow: {
    height: 32,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  skipText: {
    color: "#666",
    fontSize: 15,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#e8f0fe",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111",
    textAlign: "center",
  },
  body: {
    fontSize: 16,
    lineHeight: 25,
    color: "#444",
    textAlign: "center",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#d0d4dc",
  },
  dotActive: {
    backgroundColor: "#2f6fed",
    width: 20,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#2f6fed",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: "#2f6fed",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#2f6fed",
    fontSize: 17,
    fontWeight: "700",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 24,
    paddingHorizontal: 4,
  },
  textButton: {
    color: "#666",
    fontSize: 15,
  },
});

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { MealFormModal } from "../MealFormModal";

jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  const { TextInput } = require("react-native");
  return function MockDateTimePicker({ testID, onChange }: any) {
    return React.createElement(TextInput, {
      testID,
      onChangeText: (text: string) => onChange({ type: "set" }, new Date(text)),
    });
  };
});

const CALENDAR_1 = { id: "cal-1", name: "我が家", kind: "group" as const, color: "#2f6fed", createdBy: "user-1", createdAt: "2026-08-01T00:00:00.000Z" };
const CALENDAR_2 = { id: "cal-2", name: "友人グループ", kind: "group" as const, color: "#43a047", createdBy: "user-2", createdAt: "2026-08-01T00:00:00.000Z" };
const CALENDARS = [CALENDAR_1, CALENDAR_2];

const CREATE_INITIAL_VALUES = {
  title: "",
  url: "",
  memo: "",
  mealDate: "2026-09-10",
  slot: "breakfast" as const,
  rating: null,
  calendarId: "cal-1",
};

const EDIT_INITIAL_VALUES = {
  title: "肉じゃが",
  url: "https://example.com/recipe",
  memo: "醤油は控えめに",
  mealDate: "2026-09-05",
  slot: "dinner" as const,
  rating: 4,
  calendarId: "cal-2",
};

describe("MealFormModal", () => {
  it("renders nothing when target is null", async () => {
    const { queryByTestId } = await render(
      <MealFormModal target={null} calendars={CALENDARS} onClose={jest.fn()} onSave={jest.fn()} />
    );

    expect(queryByTestId("meal-form-title-input")).toBeNull();
  });

  it("shows a '献立を追加' heading and no delete button in create mode, seeded with the given initial values", async () => {
    const { getByText, queryByTestId, getByTestId } = await render(
      <MealFormModal
        target={{ mode: "create", initialValues: CREATE_INITIAL_VALUES }}
        calendars={CALENDARS}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(getByText("献立を追加")).toBeTruthy();
    expect(queryByTestId("meal-form-delete")).toBeNull();
    expect(getByTestId("meal-form-title-input").props.value).toBe("");
  });

  it("shows a '献立の詳細' heading and a delete button in edit mode", async () => {
    const { getByText, getByTestId } = await render(
      <MealFormModal
        target={{ mode: "edit", recordId: "meal-1", initialValues: EDIT_INITIAL_VALUES }}
        calendars={CALENDARS}
        onClose={jest.fn()}
        onSave={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    expect(getByText("献立の詳細")).toBeTruthy();
    expect(getByTestId("meal-form-delete")).toBeTruthy();
  });

  it("uses icons instead of text for the delete/close buttons in edit mode, and has no whole-form save button (each item saves on its own)", async () => {
    const { queryByText, getByTestId, queryByTestId } = await render(
      <MealFormModal
        target={{ mode: "edit", recordId: "meal-1", initialValues: EDIT_INITIAL_VALUES }}
        calendars={CALENDARS}
        onClose={jest.fn()}
        onSave={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    expect(queryByText("削除")).toBeNull();
    expect(queryByText("キャンセル")).toBeNull();
    expect(queryByText("保存")).toBeNull();
    expect(getByTestId("meal-form-delete")).toBeTruthy();
    expect(getByTestId("meal-form-cancel")).toBeTruthy();
    expect(queryByTestId("meal-form-save")).toBeNull();
  });

  it("uses icons instead of text for the cancel/delete buttons in the delete-confirm dialog", async () => {
    const { queryByText, getByTestId } = await render(
      <MealFormModal
        target={{ mode: "edit", recordId: "meal-1", initialValues: EDIT_INITIAL_VALUES }}
        calendars={CALENDARS}
        onClose={jest.fn()}
        onSave={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    await fireEvent.press(getByTestId("meal-form-delete"));

    expect(queryByText("キャンセル")).toBeNull();
    expect(queryByText("削除する")).toBeNull();
    expect(getByTestId("meal-form-delete-cancel")).toBeTruthy();
    expect(getByTestId("meal-form-delete-confirm")).toBeTruthy();
  });

  it("calls onSave with the edited values (title/url/memo/slot/rating/calendarId) when saved", async () => {
    const onSave = jest.fn();
    const { getByTestId } = await render(
      <MealFormModal
        target={{ mode: "create", initialValues: CREATE_INITIAL_VALUES }}
        calendars={CALENDARS}
        onClose={jest.fn()}
        onSave={onSave}
      />
    );

    await fireEvent.changeText(getByTestId("meal-form-title-input"), "カレー");
    await fireEvent.press(getByTestId("meal-form-url-add"));
    await fireEvent.changeText(getByTestId("meal-form-url-input"), "https://example.com/curry");
    await fireEvent.press(getByTestId("meal-form-memo-add"));
    await fireEvent.changeText(getByTestId("meal-form-memo-input"), "辛口で");
    await fireEvent.press(getByTestId("meal-form-slot-dinner"));
    await fireEvent.press(getByTestId("meal-form-rating-5"));
    await fireEvent.press(getByTestId("meal-form-save"));

    expect(onSave).toHaveBeenCalledWith({
      title: "カレー",
      url: "https://example.com/curry",
      memo: "辛口で",
      mealDate: "2026-09-10",
      slot: "dinner",
      rating: 5,
      calendarId: "cal-1",
    });
  });

  it("disables the save button and does not call onSave again while a save is already in flight (regression: double-tap created two meal records)", async () => {
    const onSave = jest.fn();
    const { getByTestId } = await render(
      <MealFormModal
        target={{ mode: "create", initialValues: CREATE_INITIAL_VALUES }}
        calendars={CALENDARS}
        onClose={jest.fn()}
        onSave={onSave}
        isSaving
      />
    );

    expect(getByTestId("meal-form-save").props.accessibilityState?.disabled).toBe(true);

    await fireEvent.press(getByTestId("meal-form-save"));

    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onClose when cancel is pressed", async () => {
    const onClose = jest.fn();
    const { getByTestId } = await render(
      <MealFormModal
        target={{ mode: "create", initialValues: CREATE_INITIAL_VALUES }}
        calendars={CALENDARS}
        onClose={onClose}
        onSave={jest.fn()}
      />
    );

    await fireEvent.press(getByTestId("meal-form-cancel"));

    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when tapping outside the card, on the backdrop", async () => {
    const onClose = jest.fn();
    const { getByTestId } = await render(
      <MealFormModal
        target={{ mode: "create", initialValues: CREATE_INITIAL_VALUES }}
        calendars={CALENDARS}
        onClose={onClose}
        onSave={jest.fn()}
      />
    );

    await fireEvent.press(getByTestId("meal-form-backdrop"));

    expect(onClose).toHaveBeenCalled();
  });

  it("asks for confirmation before deleting, and calls onDelete with the record id only on confirm", async () => {
    const onDelete = jest.fn();
    const { getByTestId } = await render(
      <MealFormModal
        target={{ mode: "edit", recordId: "meal-1", initialValues: EDIT_INITIAL_VALUES }}
        calendars={CALENDARS}
        onClose={jest.fn()}
        onSave={jest.fn()}
        onDelete={onDelete}
      />
    );

    await fireEvent.press(getByTestId("meal-form-delete"));
    expect(onDelete).not.toHaveBeenCalled();
    expect(getByTestId("meal-form-delete-confirm")).toBeTruthy();

    await fireEvent.press(getByTestId("meal-form-delete-confirm"));

    expect(onDelete).toHaveBeenCalledWith("meal-1");
  });

  it("disables the delete-confirm button and does not call onDelete again while a delete is already in flight (regression)", async () => {
    const onDelete = jest.fn();
    const { getByTestId } = await render(
      <MealFormModal
        target={{ mode: "edit", recordId: "meal-1", initialValues: EDIT_INITIAL_VALUES }}
        calendars={CALENDARS}
        onClose={jest.fn()}
        onSave={jest.fn()}
        onDelete={onDelete}
        isDeleting
      />
    );

    await fireEvent.press(getByTestId("meal-form-delete"));
    expect(getByTestId("meal-form-delete-confirm").props.accessibilityState?.disabled).toBe(true);

    await fireEvent.press(getByTestId("meal-form-delete-confirm"));

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("cancels deletion without calling onDelete when the delete confirmation is dismissed", async () => {
    const onDelete = jest.fn();
    const { getByTestId, queryByTestId } = await render(
      <MealFormModal
        target={{ mode: "edit", recordId: "meal-1", initialValues: EDIT_INITIAL_VALUES }}
        calendars={CALENDARS}
        onClose={jest.fn()}
        onSave={jest.fn()}
        onDelete={onDelete}
      />
    );

    await fireEvent.press(getByTestId("meal-form-delete"));
    await fireEvent.press(getByTestId("meal-form-delete-cancel"));

    expect(onDelete).not.toHaveBeenCalled();
    expect(queryByTestId("meal-form-delete-confirm")).toBeNull();
  });

  it("cancels deletion without calling onDelete when tapping outside the delete-confirmation card", async () => {
    const onDelete = jest.fn();
    const { getByTestId } = await render(
      <MealFormModal
        target={{ mode: "edit", recordId: "meal-1", initialValues: EDIT_INITIAL_VALUES }}
        calendars={CALENDARS}
        onClose={jest.fn()}
        onSave={jest.fn()}
        onDelete={onDelete}
      />
    );

    await fireEvent.press(getByTestId("meal-form-delete"));
    await fireEvent.press(getByTestId("meal-form-delete-backdrop"));

    expect(onDelete).not.toHaveBeenCalled();
  });

  describe("URL/メモの追加ボタン", () => {
    it("shows '+ URLを追加'/'+ メモを追加' buttons instead of empty inputs in create mode", async () => {
      const { getByTestId, queryByTestId } = await render(
        <MealFormModal
          target={{ mode: "create", initialValues: CREATE_INITIAL_VALUES }}
          calendars={CALENDARS}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
      );

      expect(getByTestId("meal-form-url-add")).toBeTruthy();
      expect(getByTestId("meal-form-memo-add")).toBeTruthy();
      expect(queryByTestId("meal-form-url-input")).toBeNull();
      expect(queryByTestId("meal-form-memo-input")).toBeNull();
    });

    it("reveals the input in place of the button once pressed", async () => {
      const { getByTestId, queryByTestId } = await render(
        <MealFormModal
          target={{ mode: "create", initialValues: CREATE_INITIAL_VALUES }}
          calendars={CALENDARS}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
      );

      await fireEvent.press(getByTestId("meal-form-url-add"));

      expect(queryByTestId("meal-form-url-add")).toBeNull();
      expect(getByTestId("meal-form-url-input").props.value).toBe("");
    });
  });

  describe("追加先カレンダーの表示/選択", () => {
    it("shows a read-only label (no picker) when there's only one calendar to choose from", async () => {
      const { getByTestId, getByText, queryByTestId } = await render(
        <MealFormModal
          target={{ mode: "create", initialValues: CREATE_INITIAL_VALUES }}
          calendars={[CALENDAR_1]}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
      );

      expect(getByTestId("meal-form-calendar-label")).toBeTruthy();
      expect(getByText("我が家")).toBeTruthy();
      expect(queryByTestId("meal-form-calendar-picker")).toBeNull();
    });

    it("shows a calendar picker (defaulting to the given calendarId) in create mode when there are multiple calendars, so it's always clear which one a new meal is added to", async () => {
      const { getByTestId, queryByTestId } = await render(
        <MealFormModal
          target={{ mode: "create", initialValues: CREATE_INITIAL_VALUES }}
          calendars={CALENDARS}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
      );

      expect(getByTestId("meal-form-calendar-picker")).toBeTruthy();
      expect(getByTestId("meal-form-calendar-cal-1-check")).toBeTruthy(); // CREATE_INITIAL_VALUES.calendarId = "cal-1"
      expect(queryByTestId("meal-form-calendar-cal-2-check")).toBeNull();
      expect(queryByTestId("meal-form-calendar-label")).toBeNull();
    });

    it("switches the target calendar when a different chip is tapped, and saves with that calendarId", async () => {
      const onSave = jest.fn();
      const { getByTestId } = await render(
        <MealFormModal
          target={{ mode: "create", initialValues: CREATE_INITIAL_VALUES }}
          calendars={CALENDARS}
          onClose={jest.fn()}
          onSave={onSave}
        />
      );

      await fireEvent.press(getByTestId("meal-form-calendar-cal-2"));
      await fireEvent.press(getByTestId("meal-form-save"));

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ calendarId: "cal-2" }));
    });
  });

  describe("日付ピッカー(inlineカレンダー)の収まり", () => {
    const flattenStyle = (style: unknown): Record<string, unknown> =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);

    it("makes the form card wide enough (>= 92% of the screen, with slim side padding) to hold iOS's inline calendar, which needs ~320pt (regression: the calendar overflowed the card)", async () => {
      const { getByTestId } = await render(
        <MealFormModal
          target={{ mode: "create", initialValues: CREATE_INITIAL_VALUES }}
          calendars={CALENDARS}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
      );

      const card = flattenStyle(getByTestId("meal-form-card").props.style);
      expect(parseFloat(String(card.width))).toBeGreaterThanOrEqual(92);
      expect(card.paddingHorizontal).toBeLessThanOrEqual(16);
    });

    it("lets the opened picker fill the card's inner width and clips anything beyond it, instead of overhanging the card", async () => {
      const { getByTestId } = await render(
        <MealFormModal
          target={{ mode: "create", initialValues: CREATE_INITIAL_VALUES }}
          calendars={CALENDARS}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
      );

      await fireEvent.press(getByTestId("meal-form-date-button"));

      const container = flattenStyle(getByTestId("meal-form-date-picker-container").props.style);
      expect(container.alignSelf).toBe("stretch");
      expect(container.overflow).toBe("hidden");
    });
  });

  describe("詳細(編集モード)の項目別編集", () => {
    function renderDetail(options: { onUpdateField?: jest.Mock; calendars?: typeof CALENDARS; isSaving?: boolean } = {}) {
      const onUpdateField = options.onUpdateField ?? jest.fn().mockResolvedValue(true);
      const utils = render(
        <MealFormModal
          target={{ mode: "edit", recordId: "meal-1", initialValues: EDIT_INITIAL_VALUES }}
          calendars={options.calendars ?? CALENDARS}
          onClose={jest.fn()}
          onSave={jest.fn()}
          onDelete={jest.fn()}
          onUpdateField={onUpdateField}
          isSaving={options.isSaving}
        />
      );
      return { onUpdateField, utils };
    }

    it("shows every item as a label plus plain text with a pencil, and no inputs until a pencil is pressed", async () => {
      const { utils } = renderDetail();
      const { getByTestId, getByText, queryByTestId } = await utils;

      for (const field of ["calendar", "title", "slot", "date", "rating", "url", "memo"]) {
        expect(getByTestId(`meal-detail-${field}-edit`)).toBeTruthy();
      }
      for (const label of ["カレンダー", "料理名", "食事", "日付", "評価", "URL", "メモ"]) {
        expect(getByText(label)).toBeTruthy();
      }
      expect(getByText("肉じゃが")).toBeTruthy();
      expect(getByText("夕食")).toBeTruthy();
      expect(getByText("2026/09/05")).toBeTruthy();
      expect(getByText("https://example.com/recipe")).toBeTruthy();
      expect(getByText("醤油は控えめに")).toBeTruthy();
      expect(getByTestId("meal-form-detail-rating-readonly-star-4").props.children).toBe("★");
      expect(getByTestId("meal-form-detail-rating-readonly-star-5").props.children).toBe("☆");
      expect(queryByTestId("meal-form-title-input")).toBeNull();
      expect(queryByTestId("meal-form-url-input")).toBeNull();
      expect(queryByTestId("meal-form-memo-input")).toBeNull();
      expect(queryByTestId("meal-detail-title-confirm")).toBeNull();
    });

    it("shows 未設定 for an empty URL, memo and rating", async () => {
      const { getAllByText } = await render(
        <MealFormModal
          target={{
            mode: "edit",
            recordId: "meal-1",
            initialValues: { ...EDIT_INITIAL_VALUES, url: "", memo: "", rating: null },
          }}
          calendars={CALENDARS}
          onClose={jest.fn()}
          onSave={jest.fn()}
          onUpdateField={jest.fn()}
        />
      );

      expect(getAllByText("未設定")).toHaveLength(3);
    });

    it("opens an input seeded with the current value when the pencil is pressed, and saves just that item on ✓", async () => {
      const { onUpdateField, utils } = renderDetail();
      const { getByTestId, getByText, queryByTestId } = await utils;

      await fireEvent.press(getByTestId("meal-detail-title-edit"));
      expect(getByTestId("meal-form-title-input").props.value).toBe("肉じゃが");

      await fireEvent.changeText(getByTestId("meal-form-title-input"), "筑前煮");
      await fireEvent.press(getByTestId("meal-detail-title-confirm"));

      await waitFor(() => expect(onUpdateField).toHaveBeenCalledWith("meal-1", { title: "筑前煮" }));
      await waitFor(() => expect(queryByTestId("meal-form-title-input")).toBeNull());
      expect(getByText("筑前煮")).toBeTruthy();
    });

    it("discards the draft on ✕ without saving, keeping the original text", async () => {
      const { onUpdateField, utils } = renderDetail();
      const { getByTestId, getByText, queryByTestId } = await utils;

      await fireEvent.press(getByTestId("meal-detail-title-edit"));
      await fireEvent.changeText(getByTestId("meal-form-title-input"), "筑前煮");
      await fireEvent.press(getByTestId("meal-detail-title-cancel"));

      expect(onUpdateField).not.toHaveBeenCalled();
      expect(queryByTestId("meal-form-title-input")).toBeNull();
      expect(getByText("肉じゃが")).toBeTruthy();
    });

    it("keeps the editor open (and the old text) when saving fails, so the input isn't lost", async () => {
      const { utils } = renderDetail({ onUpdateField: jest.fn().mockResolvedValue(false) });
      const { getByTestId } = await utils;

      await fireEvent.press(getByTestId("meal-detail-title-edit"));
      await fireEvent.changeText(getByTestId("meal-form-title-input"), "筑前煮");
      await fireEvent.press(getByTestId("meal-detail-title-confirm"));

      await waitFor(() => expect(getByTestId("meal-form-title-input").props.value).toBe("筑前煮"));
    });

    it("does not allow saving an empty title", async () => {
      const { onUpdateField, utils } = renderDetail();
      const { getByTestId } = await utils;

      await fireEvent.press(getByTestId("meal-detail-title-edit"));
      await fireEvent.changeText(getByTestId("meal-form-title-input"), "   ");
      await fireEvent.press(getByTestId("meal-detail-title-confirm"));

      expect(getByTestId("meal-detail-title-confirm").props.accessibilityState?.disabled).toBe(true);
      expect(onUpdateField).not.toHaveBeenCalled();
    });

    it("disables ✓ while a save is in flight, so a double tap can't save twice", async () => {
      const { onUpdateField, utils } = renderDetail({ isSaving: true });
      const { getByTestId } = await utils;

      await fireEvent.press(getByTestId("meal-detail-title-edit"));
      await fireEvent.press(getByTestId("meal-detail-title-confirm"));

      expect(getByTestId("meal-detail-title-confirm").props.accessibilityState?.disabled).toBe(true);
      expect(onUpdateField).not.toHaveBeenCalled();
    });

    it("edits the meal slot with the four slot buttons", async () => {
      const { onUpdateField, utils } = renderDetail();
      const { getByTestId } = await utils;

      await fireEvent.press(getByTestId("meal-detail-slot-edit"));
      await fireEvent.press(getByTestId("meal-form-slot-snack"));
      await fireEvent.press(getByTestId("meal-detail-slot-confirm"));

      await waitFor(() => expect(onUpdateField).toHaveBeenCalledWith("meal-1", { slot: "snack" }));
    });

    it("edits the date with the inline picker, saving the JST calendar day", async () => {
      const { onUpdateField, utils } = renderDetail();
      const { getByTestId } = await utils;

      await fireEvent.press(getByTestId("meal-detail-date-edit"));
      await fireEvent.changeText(getByTestId("meal-form-date-picker"), "2026-09-20T00:00:00.000Z");
      await fireEvent.press(getByTestId("meal-detail-date-confirm"));

      await waitFor(() => expect(onUpdateField).toHaveBeenCalledWith("meal-1", { mealDate: "2026-09-20" }));
    });

    it("edits the rating with the stars", async () => {
      const { onUpdateField, utils } = renderDetail();
      const { getByTestId } = await utils;

      await fireEvent.press(getByTestId("meal-detail-rating-edit"));
      await fireEvent.press(getByTestId("meal-form-rating-2"));
      await fireEvent.press(getByTestId("meal-detail-rating-confirm"));

      await waitFor(() => expect(onUpdateField).toHaveBeenCalledWith("meal-1", { rating: 2 }));
    });

    it("edits the URL and the memo, and allows clearing them", async () => {
      const { onUpdateField, utils } = renderDetail();
      const { getByTestId } = await utils;

      await fireEvent.press(getByTestId("meal-detail-url-edit"));
      await fireEvent.changeText(getByTestId("meal-form-url-input"), "");
      await fireEvent.press(getByTestId("meal-detail-url-confirm"));
      await waitFor(() => expect(onUpdateField).toHaveBeenCalledWith("meal-1", { url: "" }));

      await fireEvent.press(getByTestId("meal-detail-memo-edit"));
      await fireEvent.changeText(getByTestId("meal-form-memo-input"), "しょうゆ多め");
      await fireEvent.press(getByTestId("meal-detail-memo-confirm"));
      await waitFor(() => expect(onUpdateField).toHaveBeenCalledWith("meal-1", { memo: "しょうゆ多め" }));
    });

    it("edits the calendar with chips when there are several calendars (regression: the calendar must stay changeable)", async () => {
      const { onUpdateField, utils } = renderDetail();
      const { getByTestId } = await utils;

      await fireEvent.press(getByTestId("meal-detail-calendar-edit"));
      expect(getByTestId("meal-form-calendar-cal-2-check")).toBeTruthy(); // current = cal-2
      await fireEvent.press(getByTestId("meal-form-calendar-cal-1"));
      await fireEvent.press(getByTestId("meal-detail-calendar-confirm"));

      await waitFor(() => expect(onUpdateField).toHaveBeenCalledWith("meal-1", { calendarId: "cal-1" }));
    });

    it("shows the calendar as plain read-only text, with no pencil, when there's only one calendar", async () => {
      const { utils } = renderDetail({ calendars: [CALENDAR_2] }); // the edited meal is on cal-2
      const { queryByTestId, getByText } = await utils;

      expect(getByText("友人グループ")).toBeTruthy();
      expect(queryByTestId("meal-detail-calendar-edit")).toBeNull();
    });

    it("keeps one editor open at a time: pressing another item's pencil closes (discards) the first", async () => {
      const { onUpdateField, utils } = renderDetail();
      const { getByTestId, queryByTestId } = await utils;

      await fireEvent.press(getByTestId("meal-detail-title-edit"));
      await fireEvent.changeText(getByTestId("meal-form-title-input"), "筑前煮");
      await fireEvent.press(getByTestId("meal-detail-memo-edit"));

      expect(queryByTestId("meal-form-title-input")).toBeNull();
      expect(getByTestId("meal-form-memo-input")).toBeTruthy();
      expect(onUpdateField).not.toHaveBeenCalled();
    });

    it("pins each row and the opened date picker to 100% width, so the picker's own width can't push the pencil outside the card after closing (regression: the date row's pencil overflowed after opening and closing the calendar)", async () => {
      const { utils } = renderDetail();
      const { getByTestId } = await utils;
      const flatten = (style: unknown): Record<string, unknown> =>
        Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);

      expect(flatten(getByTestId("meal-detail-date").props.style).width).toBe("100%");

      await fireEvent.press(getByTestId("meal-detail-date-edit"));
      expect(flatten(getByTestId("meal-detail-date").props.style).width).toBe("100%");
      expect(flatten(getByTestId("meal-form-date-picker-container").props.style).width).toBe("100%");

      await fireEvent.press(getByTestId("meal-detail-date-cancel"));
      expect(flatten(getByTestId("meal-detail-date").props.style).width).toBe("100%");
      expect(getByTestId("meal-detail-date-edit")).toBeTruthy();
    });

    it("keeps the saved value visible after saving (the detail reflects each successful save without reopening)", async () => {
      const { utils } = renderDetail();
      const { getByTestId, getByText } = await utils;

      await fireEvent.press(getByTestId("meal-detail-memo-edit"));
      await fireEvent.changeText(getByTestId("meal-form-memo-input"), "しょうゆ多め");
      await fireEvent.press(getByTestId("meal-detail-memo-confirm"));

      await waitFor(() => expect(getByText("しょうゆ多め")).toBeTruthy());
    });
  });

  it("keeps the card below the status bar (clock/camera/Wi-Fi) by padding the top of its overlay with the safe-area inset", async () => {
    const { getByTestId } = await render(
      <SafeAreaInsetsContext.Provider value={{ top: 59, bottom: 34, left: 0, right: 0 }}>
        <MealFormModal
          target={{ mode: "create", initialValues: CREATE_INITIAL_VALUES }}
          calendars={CALENDARS}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
      </SafeAreaInsetsContext.Provider>
    );

    const overlayStyle = StyleSheet.flatten(getByTestId("meal-form-overlay").props.style);
    expect(overlayStyle.paddingTop).toBeGreaterThanOrEqual(59);
  });
});

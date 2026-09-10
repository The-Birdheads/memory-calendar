import { fireEvent, render } from "@testing-library/react-native";

import { MealFormModal } from "../MealFormModal";

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

  it("shows a '献立の詳細' heading, a delete button, and fields seeded from the record in edit mode", async () => {
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
    expect(getByTestId("meal-form-title-input").props.value).toBe("肉じゃが");
    expect(getByTestId("meal-form-url-input").props.value).toBe("https://example.com/recipe");
    expect(getByTestId("meal-form-memo-input").props.value).toBe("醤油は控えめに");
    expect(getByTestId("meal-form-rating-4-label").props.children).toBe("★");
    expect(getByTestId("meal-form-rating-5-label").props.children).toBe("☆");
  });

  it("uses icons instead of text for the delete/cancel/save buttons", async () => {
    const { queryByText, getByTestId } = await render(
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
    expect(getByTestId("meal-form-save")).toBeTruthy();
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

    it("shows the inputs directly (no add button) in edit mode, since a value is already set", async () => {
      const { getByTestId, queryByTestId } = await render(
        <MealFormModal
          target={{ mode: "edit", recordId: "meal-1", initialValues: EDIT_INITIAL_VALUES }}
          calendars={CALENDARS}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
      );

      expect(queryByTestId("meal-form-url-add")).toBeNull();
      expect(queryByTestId("meal-form-memo-add")).toBeNull();
      expect(getByTestId("meal-form-url-input")).toBeTruthy();
      expect(getByTestId("meal-form-memo-input")).toBeTruthy();
    });
  });

  describe("追加先カレンダーの表示/選択", () => {
    it("shows the target calendar as a read-only label in edit mode (the calendar can't be changed after creation)", async () => {
      const { getByTestId, getByText, queryByTestId } = await render(
        <MealFormModal
          target={{ mode: "edit", recordId: "meal-1", initialValues: EDIT_INITIAL_VALUES }}
          calendars={CALENDARS}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
      );

      expect(getByTestId("meal-form-calendar-label")).toBeTruthy();
      expect(getByText("友人グループ")).toBeTruthy(); // EDIT_INITIAL_VALUES.calendarId = "cal-2"
      expect(queryByTestId("meal-form-calendar-picker")).toBeNull();
    });

    it("shows a read-only label (no picker) in create mode when there's only one calendar to choose from", async () => {
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
});

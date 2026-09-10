import { fireEvent, render } from "@testing-library/react-native";

import { RatingStars } from "../RatingStars";

describe("RatingStars", () => {
  describe("read-only (no onChange)", () => {
    it("renders nothing when rating is null", async () => {
      const { queryByTestId } = await render(<RatingStars rating={null} testIDPrefix="r" />);

      expect(queryByTestId("r-readonly")).toBeNull();
    });

    it("shows the given number of filled stars out of 5, unfilled for the rest", async () => {
      const { getByTestId } = await render(<RatingStars rating={3} testIDPrefix="r" />);

      expect(getByTestId("r-readonly")).toBeTruthy();
      expect(getByTestId("r-readonly-star-1").props.children).toBe("★");
      expect(getByTestId("r-readonly-star-2").props.children).toBe("★");
      expect(getByTestId("r-readonly-star-3").props.children).toBe("★");
      expect(getByTestId("r-readonly-star-4").props.children).toBe("☆");
      expect(getByTestId("r-readonly-star-5").props.children).toBe("☆");
    });
  });

  describe("interactive (onChange provided)", () => {
    it("shows 5 tappable stars, reflecting the current rating", async () => {
      const { getByTestId } = await render(<RatingStars rating={2} onChange={jest.fn()} testIDPrefix="r" />);

      expect(getByTestId("r-1-label").props.children).toBe("★");
      expect(getByTestId("r-2-label").props.children).toBe("★");
      expect(getByTestId("r-3-label").props.children).toBe("☆");
    });

    it("calls onChange with the tapped star's value", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(<RatingStars rating={null} onChange={onChange} testIDPrefix="r" />);

      await fireEvent.press(getByTestId("r-4"));

      expect(onChange).toHaveBeenCalledWith(4);
    });

    it("clears the rating (calls onChange with null) when the currently-set star is tapped again", async () => {
      const onChange = jest.fn();
      const { getByTestId } = await render(<RatingStars rating={3} onChange={onChange} testIDPrefix="r" />);

      await fireEvent.press(getByTestId("r-3"));

      expect(onChange).toHaveBeenCalledWith(null);
    });
  });
});

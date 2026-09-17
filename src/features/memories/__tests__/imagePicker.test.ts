import { ImageManipulator } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { pickPhotoFromLibrary } from "../imagePicker";

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("expo-image-manipulator", () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: "jpeg" },
}));

/** ImageManipulator.manipulate(uri).resize(...).renderAsync() の戻り値の
 * ImageRef.saveAsync(...) が解決する結果を、指定のuriで用意する。 */
function mockResizeResult(resizedUri: string) {
  const saveAsync = jest.fn().mockResolvedValue({ uri: resizedUri, width: 0, height: 0 });
  const renderAsync = jest.fn().mockResolvedValue({ saveAsync });
  const resize = jest.fn().mockReturnValue({ renderAsync });
  (ImageManipulator.manipulate as jest.Mock).mockReturnValue({ resize });
  return { resize, renderAsync, saveAsync };
}

describe("pickPhotoFromLibrary", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("returns null without launching the picker when permission is denied", async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

    const result = await pickPhotoFromLibrary();

    expect(result).toBeNull();
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it("returns null when the picker is cancelled", async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });

    const result = await pickPhotoFromLibrary();

    expect(result).toBeNull();
  });

  it("fetches the picked file as a blob and infers the content type from its extension", async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///tmp/IMG_1.png", fileName: "IMG_1.png", width: 800, height: 600 }],
    });
    const blob = { size: 123 };
    globalThis.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) }) as unknown as typeof fetch;

    const result = await pickPhotoFromLibrary();

    expect(globalThis.fetch).toHaveBeenCalledWith("file:///tmp/IMG_1.png");
    expect(result).toEqual({ fileName: "IMG_1.png", contentType: "image/png", data: blob });
  });

  it("falls back to a generated jpg filename when the asset has none", async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///tmp/asset123", fileName: null, width: 800, height: 600 }],
    });
    const blob = { size: 456 };
    globalThis.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) }) as unknown as typeof fetch;

    const result = await pickPhotoFromLibrary();

    expect(result?.fileName).toMatch(/^photo_\d+\.jpg$/);
    expect(result?.contentType).toBe("image/jpeg");
  });

  it("passes mediaTypes images and a quality setting to the picker", async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });

    await pickPhotoFromLibrary();

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ["images"] })
    );
  });

  describe("縮小(アップロード時間短縮)", () => {
    it("resizes a picked image whose longest side exceeds 1600px, fetching the resized file and normalizing to jpg (regression: full-resolution photos were uploaded as-is, slowing down the grid)", async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: "file:///tmp/IMG_big.heic", fileName: "IMG_big.heic", width: 4032, height: 3024 }],
      });
      const { resize } = mockResizeResult("file:///tmp/resized-abc.jpg");
      const blob = { size: 111 };
      globalThis.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) }) as unknown as typeof fetch;

      const result = await pickPhotoFromLibrary();

      expect(ImageManipulator.manipulate).toHaveBeenCalledWith("file:///tmp/IMG_big.heic");
      expect(resize).toHaveBeenCalledWith({ width: 1600 }); // landscape: width is the longest side
      expect(globalThis.fetch).toHaveBeenCalledWith("file:///tmp/resized-abc.jpg");
      expect(result).toEqual({ fileName: "IMG_big.jpg", contentType: "image/jpeg", data: blob });
    });

    it("resizes by height instead when the image is portrait (the shorter side is width)", async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: "file:///tmp/IMG_tall.jpg", fileName: "IMG_tall.jpg", width: 3024, height: 4032 }],
      });
      const { resize } = mockResizeResult("file:///tmp/resized-def.jpg");
      globalThis.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve({}) }) as unknown as typeof fetch;

      await pickPhotoFromLibrary();

      expect(resize).toHaveBeenCalledWith({ height: 1600 });
    });

    it("does not resize an image already within the 1600px limit", async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: "file:///tmp/IMG_small.jpg", fileName: "IMG_small.jpg", width: 1200, height: 900 }],
      });
      globalThis.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve({}) }) as unknown as typeof fetch;

      const result = await pickPhotoFromLibrary();

      expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
      expect(globalThis.fetch).toHaveBeenCalledWith("file:///tmp/IMG_small.jpg");
      expect(result?.fileName).toBe("IMG_small.jpg");
    });

    it("does not resize when the picker didn't report dimensions (width/height are 0), to avoid guessing", async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: "file:///tmp/IMG_unknown.jpg", fileName: "IMG_unknown.jpg", width: 0, height: 0 }],
      });
      globalThis.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve({}) }) as unknown as typeof fetch;

      await pickPhotoFromLibrary();

      expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
      expect(globalThis.fetch).toHaveBeenCalledWith("file:///tmp/IMG_unknown.jpg");
    });
  });
});

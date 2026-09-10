import * as ImagePicker from "expo-image-picker";

import { pickPhotoFromLibrary } from "../imagePicker";

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

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
      assets: [{ uri: "file:///tmp/IMG_1.png", fileName: "IMG_1.png" }],
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
      assets: [{ uri: "file:///tmp/asset123", fileName: null }],
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
});

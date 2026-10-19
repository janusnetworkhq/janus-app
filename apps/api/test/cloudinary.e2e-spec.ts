import { cloudinaryHlsUrl, cloudinaryPosterUrl, cloudinaryResourceType } from "../src/common/storage.service";

describe("Cloudinary storage helpers (no network)", () => {
  it("maps kinds/content types to Cloudinary resource types", () => {
    expect(cloudinaryResourceType({ kind: "FEED_VIDEO", contentType: "video/mp4" })).toBe("video");
    expect(cloudinaryResourceType({ kind: "VAULT_VIDEO", contentType: "video/mp4" })).toBe("video");
    expect(cloudinaryResourceType({ kind: "AVATAR", contentType: "image/png" })).toBe("image");
    expect(cloudinaryResourceType({ kind: "VAULT_FILE", contentType: "application/pdf" })).toBe("raw");
  });
  it("builds adaptive HLS + poster delivery URLs", () => {
    expect(cloudinaryHlsUrl("demo", "uploads/u1/abc", "full_hd")).toBe(
      "https://res.cloudinary.com/demo/video/upload/sp_full_hd/uploads/u1/abc.m3u8",
    );
    expect(cloudinaryPosterUrl("demo", "uploads/u1/abc")).toContain("/video/upload/so_1,f_jpg/");
  });
});

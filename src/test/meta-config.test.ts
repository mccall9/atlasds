import { describe, expect, it } from "vitest";
import { isAllowedMetaOrigin, metaRedirectUri } from "@/lib/meta-config";

describe("Meta OAuth origins", () => {
  it("allows the published site", () => {
    expect(isAllowedMetaOrigin("https://atlasds.lovable.app")).toBe(true);
  });
  it("rejects unknown origins", () => {
    expect(isAllowedMetaOrigin("https://evil.example.com")).toBe(false);
    expect(isAllowedMetaOrigin("https://atlasds.lovable.app.evil.com")).toBe(false);
  });
  it("builds the callback URL on the same origin", () => {
    expect(metaRedirectUri("https://atlasds.lovable.app")).toBe("https://atlasds.lovable.app/api/public/meta/callback");
  });
});

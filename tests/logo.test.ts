import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { LogoError, processLogo } from "@/lib/logo";

async function png(width: number, height: number) {
  const buf = await sharp({ create: { width, height, channels: 3, background: "#7a1f3d" } }).png().toBuffer();
  return new File([new Uint8Array(buf)], "logo.png", { type: "image/png" });
}

describe("processLogo", () => {
  it("resizes to max 400px wide and re-encodes as WebP", async () => {
    const out = await processLogo(await png(1200, 300));
    expect(out.contentType).toBe("image/webp");
    const meta = await sharp(out.data).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(400);
  });

  it("does not enlarge small logos", async () => {
    const meta = await sharp((await processLogo(await png(200, 80))).data).metadata();
    expect(meta.width).toBe(200);
  });

  it("rejects SVG, even when disguised as PNG", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    await expect(processLogo(new File([svg], "x.svg", { type: "image/svg+xml" }))).rejects.toBeInstanceOf(LogoError);
    await expect(processLogo(new File([svg], "x.png", { type: "image/png" }))).rejects.toBeInstanceOf(LogoError);
  });

  it("rejects files over 500 KB", async () => {
    const big = new File([new Uint8Array(501 * 1024)], "big.png", { type: "image/png" });
    await expect(processLogo(big)).rejects.toThrow(/500 KB/);
  });
});

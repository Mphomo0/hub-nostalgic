import { describe, expect, it } from "vitest";
import { stripPlaceholder } from "@/lib/tokens";

describe("stripPlaceholder", () => {
  const token = "kgcxWm-l_DGF9mQKQUDDGszfAU1v-DVifwO4HLVsiWk";

  it("leaves a normal token alone", () => {
    expect(stripPlaceholder(token)).toBe(token);
  });

  it("removes a leading {{1}} left by a WhatsApp template", () => {
    expect(stripPlaceholder(`{{1}}${token}`)).toBe(token);
    expect(stripPlaceholder(`%7B%7B1%7D%7D${token}`)).toBe(token);
    expect(stripPlaceholder(`{{ 1 }}${token}`)).toBe(token);
  });

  it("does not throw on bad percent-encoding", () => {
    expect(stripPlaceholder("%E0%A4%A")).toBe("%E0%A4%A");
  });
});

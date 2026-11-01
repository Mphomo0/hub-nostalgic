import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";
import { db } from "@/lib/db";

describe("GET /api/health", () => {
  it("returns ok without querying the database", async () => {
    const spy = vi.spyOn(db, "$queryRaw");
    const res = await GET(new Request("http://localhost/api/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("checks the database with ?db=1", async () => {
    const res = await GET(new Request("http://localhost/api/health?db=1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("returns 503 with ?db=1 when the database is unreachable", async () => {
    const spy = vi.spyOn(db, "$queryRaw").mockRejectedValueOnce(new Error("down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    const res = await GET(new Request("http://localhost/api/health?db=1"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "error" });
    spy.mockRestore();
  });
});

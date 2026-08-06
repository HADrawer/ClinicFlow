import {describe,expect,it} from "vitest";
import {apiDate} from "./utils";

describe("apiDate",()=>{
  it("treats naive API timestamps as UTC",()=>{
    expect(apiDate("2026-08-02T05:00:00").toISOString()).toBe("2026-08-02T05:00:00.000Z");
  });

  it("preserves explicit timezone offsets",()=>{
    expect(apiDate("2026-08-02T08:00:00+03:00").toISOString()).toBe("2026-08-02T05:00:00.000Z");
  });
});

import {render,screen} from "@testing-library/react";import {describe,expect,it} from "vitest";import {Badge} from "./badge";
describe("Badge",()=>{it("exposes a textual status instead of color alone",()=>{render(<Badge value="checked_in"/>);expect(screen.getByText("Checked In")).toBeVisible();expect(screen.getByText("Status:")).toHaveClass("sr-only")})});

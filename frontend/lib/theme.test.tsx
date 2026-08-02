import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {ThemeProvider,ThemeSwitcher} from "./theme";

function Probe(){
  return <ThemeSwitcher label={key=>key}/>;
}

describe("ClinicFlow theme",()=>{
  afterEach(()=>{cleanup();vi.unstubAllGlobals()});
  beforeEach(()=>{
    localStorage.clear();
    document.documentElement.dataset.theme="light";
    vi.stubGlobal("matchMedia",vi.fn().mockReturnValue({
      matches:false,
      addEventListener:vi.fn(),
      removeEventListener:vi.fn(),
    }));
  });

  it("persists a manual dark preference and updates the document",async()=>{
    render(<ThemeProvider><Probe/></ThemeProvider>);
    fireEvent.click(screen.getByRole("button",{name:"theme.switchToDark"}));
    await waitFor(()=>expect(document.documentElement.dataset.theme).toBe("dark"));
    expect(localStorage.getItem("clinicflow_theme")).toBe("dark");
  });

  it("restores a saved preference",async()=>{
    localStorage.setItem("clinicflow_theme","dark");
    render(<ThemeProvider><Probe/></ThemeProvider>);
    await waitFor(()=>expect(document.documentElement.dataset.theme).toBe("dark"));
    expect(screen.getByRole("button",{name:"theme.switchToLight"})).toBeVisible();
  });
});

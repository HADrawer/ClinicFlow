import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {TimePicker} from "./time-picker";
import {I18nProvider} from "@/lib/i18n";

describe("TimePicker",()=>{
  afterEach(()=>cleanup());
  it("uses clinic hours and application-controlled options",()=>{
    const change=vi.fn();
    const {container}=render(<I18nProvider><TimePicker value="" onChange={change} label="Start time" date="2026-08-04" workingHours={{tuesday:"09:00–10:00"}}/></I18nProvider>);
    expect(container.querySelector('input[type="time"]')).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Start time"}));
    expect(screen.getAllByRole("option")).toHaveLength(4);
    fireEvent.click(screen.getAllByRole("option")[1]);
    expect(change).toHaveBeenCalledWith("09:15");
  });
});

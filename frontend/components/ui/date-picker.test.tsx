import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {DatePicker} from "./date-picker";
import {I18nProvider} from "@/lib/i18n";

describe("DatePicker",()=>{
  afterEach(()=>cleanup());
  it("selects a date without a native date input",()=>{
    const change=vi.fn();
    const {container}=render(<I18nProvider><DatePicker value="2026-08-04" onChange={change} label="Appointment date"/></I18nProvider>);
    expect(container.querySelector('input[type="date"]')).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:/Aug 4, 2026/i}));
    const day=screen.getAllByRole("gridcell").find(item=>item.textContent==="5");
    expect(day).toBeTruthy();
    fireEvent.click(day!);
    expect(change).toHaveBeenCalledWith("2026-08-05");
  });
});

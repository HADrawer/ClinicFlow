import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {QualityForm} from "./quality-form";
import {I18nProvider} from "@/lib/i18n";

const api=vi.fn();
vi.mock("@/lib/api",()=>({api:(...args:unknown[])=>api(...args),ApiError:class ApiError extends Error{status=400;fieldErrors={}}}));
vi.mock("@/lib/auth",()=>({useAuth:()=>({user:{id:1,clinic_id:1,full_name:"Nurse",role:"nurse",permissions:[],clinic:{working_hours:{}}}})}));

describe("QualityForm incident date and time",()=>{
  afterEach(()=>{cleanup();api.mockReset()});

  it("defaults to Now and reveals the reusable DatePicker + TimePicker only for Other time",()=>{
    const {container}=render(<I18nProvider><QualityForm kind="incident" onCancel={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);
    expect(container.querySelector(".date-picker")).toBeNull();
    expect(screen.queryByRole("button",{name:"Incident time"})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Other time"}));
    expect(container.querySelector(".date-picker")).toBeTruthy();
    expect(screen.getByRole("button",{name:"Incident time"})).toBeInTheDocument();
    expect(container.querySelector('input[type="date"]')).toBeNull();
    expect(container.querySelector('input[type="time"]')).toBeNull();
  });

  it("rejects a custom incident time set in the future, without calling the API",async()=>{
    const {container}=render(<I18nProvider><QualityForm kind="incident" onCancel={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);
    fireEvent.click(screen.getByRole("button",{name:"Other time"}));
    fireEvent.click(container.querySelector(".date-picker__trigger")!);
    fireEvent.click(screen.getByRole("button",{name:"Next month"}));
    fireEvent.click(screen.getAllByRole("gridcell")[10]);
    fireEvent.change(screen.getByLabelText(/Incident type/),{target:{value:"fall"}});
    fireEvent.change(screen.getByLabelText(/^Location/),{target:{value:"Ward 2"}});
    fireEvent.change(screen.getByLabelText(/Immediate action/),{target:{value:"Assessed patient"}});
    fireEvent.change(screen.getByLabelText(/^Description/),{target:{value:"Patient found on floor"}});
    fireEvent.click(screen.getByRole("button",{name:"Save record"}));
    expect(await screen.findByText("Incident time cannot be in the future.")).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });
});

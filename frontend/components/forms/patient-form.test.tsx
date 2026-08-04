import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {PatientForm} from "./patient-form";
import {I18nProvider} from "@/lib/i18n";

const api=vi.fn();
vi.mock("@/lib/api",()=>({api:(...args:unknown[])=>api(...args),ApiError:class ApiError extends Error{status=400;fieldErrors={}}}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()})}));

describe("PatientForm safety validation",()=>{
  afterEach(()=>{cleanup();api.mockClear()});
  it("requires CPR and rejects a date of birth that is today",()=>{
    api.mockResolvedValue([]);
    const today=new Date();
    const value=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    render(<I18nProvider><PatientForm compact/></I18nProvider>);
    fireEvent.change(screen.getByLabelText(/Full legal name/),{target:{value:"Test Patient"}});
    fireEvent.change(screen.getByLabelText(/Date of birth/),{target:{value}});
    fireEvent.change(screen.getByLabelText(/Gender/),{target:{value:"female"}});
    fireEvent.change(screen.getByLabelText(/Mobile number/),{target:{value:"+973 3900 0000"}});
    fireEvent.click(screen.getByRole("button",{name:"Register patient"}));
    expect(screen.getByText("CPR / national ID is required.")).toBeVisible();
    expect(screen.getByText("Date of birth must be before today.")).toBeVisible();
    expect(api).not.toHaveBeenCalledWith("/patients",expect.objectContaining({method:"POST"}));
  });
});

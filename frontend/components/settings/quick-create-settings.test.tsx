import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {QuickCreateSettings} from "./quick-create-settings";
import {I18nProvider} from "@/lib/i18n";
import type {Clinic} from "@/lib/types";

const api=vi.fn();
const refresh=vi.fn();
vi.mock("@/lib/api",()=>({api:(...args:unknown[])=>api(...args),ApiError:class ApiError extends Error{status=400;fieldErrors={}}}));
vi.mock("@/lib/auth",()=>({useAuth:()=>({refresh})}));

const clinic={id:1,name:"Test Clinic",address:"",phone:"",timezone:"Asia/Bahrain",working_hours:{},pharmacy_enabled:false,feature_flags:{},onboarding_completed:true,quick_create_actions:["add_patient","new_appointment"]} as Clinic;

describe("QuickCreateSettings save and reorder",()=>{
  beforeEach(()=>{
    api.mockImplementation((path:string)=>{
      if(path==="/clinics/me/quick-create-catalog")return Promise.resolve({
        add_patient:{label:"Add patient",permissions:["patients.create"]},
        new_appointment:{label:"New appointment",permissions:["appointments.manage_own"]},
        new_invoice:{label:"New invoice",permissions:["billing.create"]},
      });
      if(path==="/clinics/me/quick-create-config")return Promise.resolve({...clinic,quick_create_actions:["new_appointment","add_patient","new_invoice"]});
      return Promise.resolve(null);
    });
  });
  afterEach(()=>{cleanup();api.mockReset();refresh.mockReset()});

  it("reorders an enabled action, enables a disabled one, and saves the new configuration",async()=>{
    render(<I18nProvider><QuickCreateSettings clinic={clinic} onSaved={vi.fn()}/></I18nProvider>);
    await screen.findByText("Add patient");
    expect(screen.getByText("New invoice")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/Move New appointment up/}));
    fireEvent.click(screen.getByRole("button",{name:"Enable"}));
    fireEvent.click(screen.getByRole("button",{name:"Save Quick Create actions"}));
    await waitFor(()=>expect(api).toHaveBeenCalledWith("/clinics/me/quick-create-config",{method:"PUT",body:JSON.stringify({actions:["new_appointment","add_patient","new_invoice"]})}));
    await waitFor(()=>expect(refresh).toHaveBeenCalled());
  });
});

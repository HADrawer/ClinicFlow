import {cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import Settings from "./page";
import {I18nProvider} from "@/lib/i18n";

const api=vi.fn();
const {MockApiError}=vi.hoisted(()=>({MockApiError:class MockApiError extends Error{status:number;fieldErrors={};constructor(message:string,status=400){super(message);this.status=status}}}));
vi.mock("@/lib/api",()=>({api:(...args:unknown[])=>api(...args),ApiError:MockApiError}));
vi.mock("@/lib/auth",()=>({useAuth:()=>({user:{id:1,clinic_id:1,full_name:"Owner",role:"owner",permissions:[]}})}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()})}));

const clinic={id:1,name:"Test Clinic",address:"",phone:"",timezone:"Asia/Bahrain",working_hours:{},pharmacy_enabled:false,feature_flags:{},onboarding_completed:true,quick_create_actions:["add_patient"]};
const service={id:1,name:"Consultation",price:"25.000",duration_minutes:30,active:true};
const company={id:1,name:"Gulf Assurance",active:true};

describe("Settings services and insurance companies",()=>{
  beforeEach(()=>{
    api.mockImplementation((path:string,options?:RequestInit)=>{
      if(path==="/clinics/me")return Promise.resolve(clinic);
      if(path==="/settings")return Promise.resolve({services:[service],insurance_companies:[company],message_templates:[]});
      if(path==="/audit-logs")return Promise.resolve([]);
      if(path==="/settings/services/1/usage")return Promise.resolve({appointments:2,waitlist_entries:0});
      if(path==="/settings/services/1"&&options?.method==="PUT")return Promise.resolve({...service,active:false});
      if(path==="/settings/insurance-companies"&&options?.method==="POST")return Promise.resolve({id:2,name:"New Insurer",active:true});
      if(path==="/settings/insurance-companies/1"&&options?.method==="DELETE")return Promise.reject(new MockApiError("This insurer has existing claims on file. Deactivate it instead of deleting.",409));
      if(path==="/settings/insurance-companies/1"&&options?.method==="PUT")return Promise.resolve({...company,active:false});
      return Promise.resolve(null);
    });
  });
  afterEach(()=>{cleanup();api.mockReset()});

  it("shows usage and offers deactivate instead of delete when a service is referenced",async()=>{
    render(<I18nProvider><Settings/></I18nProvider>);
    fireEvent.click(await screen.findByRole("button",{name:"Services"}));
    fireEvent.click(await screen.findByRole("button",{name:"Remove Consultation"}));
    const dialog=await screen.findByRole("dialog",{name:"Remove service"});
    await waitFor(()=>expect(dialog.textContent).toContain("used by 2 appointment"));
    expect(dialog.textContent).not.toContain("Delete service");
    fireEvent.click(within(dialog).getByRole("button",{name:"Deactivate service"}));
    await waitFor(()=>expect(api).toHaveBeenCalledWith("/settings/services/1",expect.objectContaining({method:"PUT"})));
  });

  it("adds a new insurance company through the modal",async()=>{
    render(<I18nProvider><Settings/></I18nProvider>);
    fireEvent.click(await screen.findByRole("button",{name:"Insurance"}));
    fireEvent.click(await screen.findByRole("button",{name:"Add company"}));
    const dialog=await screen.findByRole("dialog",{name:"Add insurance company"});
    fireEvent.change(within(dialog).getByLabelText(/Company name/),{target:{value:"New Insurer"}});
    fireEvent.click(within(dialog).getByRole("button",{name:"Add company"}));
    await waitFor(()=>expect(api).toHaveBeenCalledWith("/settings/insurance-companies",expect.objectContaining({method:"POST"})));
  });

  it("blocks deleting an insurer with claims on file and offers deactivation instead",async()=>{
    render(<I18nProvider><Settings/></I18nProvider>);
    fireEvent.click(await screen.findByRole("button",{name:"Insurance"}));
    fireEvent.click(await screen.findByRole("button",{name:"Remove Gulf Assurance"}));
    const dialog=await screen.findByRole("dialog",{name:"Remove insurance company"});
    fireEvent.click(within(dialog).getByRole("button",{name:"Delete company"}));
    await waitFor(()=>expect(dialog.textContent).toContain("existing claims on file"));
    fireEvent.click(within(dialog).getByRole("button",{name:"Deactivate company"}));
    await waitFor(()=>expect(api).toHaveBeenCalledWith("/settings/insurance-companies/1",expect.objectContaining({method:"PUT"})));
  });
});

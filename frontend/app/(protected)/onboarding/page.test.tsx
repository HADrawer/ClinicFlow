import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import Onboarding from "./page";

const api=vi.fn();
vi.mock("@/lib/api",()=>({api:(...args:unknown[])=>api(...args)}));

const replace=vi.fn();
vi.mock("next/navigation",()=>({useRouter:()=>({replace,push:vi.fn()})}));

const refresh=vi.fn();
vi.mock("@/lib/auth",()=>({useAuth:()=>({refresh})}));

const clinic={id:1,name:"New Clinic",address:"",phone:"+973 17000000",contact_email:"",timezone:"Asia/Bahrain",working_hours:{sunday:"08:00–20:00"},pharmacy_enabled:false,feature_flags:{},onboarding_completed:false};

describe("Onboarding wizard",()=>{
  beforeEach(()=>{
    api.mockReset();replace.mockReset();refresh.mockReset();
    api.mockImplementation((path:string,options?:RequestInit)=>{
      if(path==="/clinics/me"&&(!options||!options.method))return Promise.resolve(clinic);
      if(path==="/clinics/me"&&options?.method==="PUT")return Promise.resolve({...clinic,...JSON.parse(String(options.body))});
      if(path==="/settings")return Promise.resolve({services:[]});
      if(path==="/staff/permission-catalog")return Promise.resolve({Patients:["patients.read"]});
      if(path==="/invitations")return Promise.resolve([]);
      if(path==="/clinics/me/onboarding/complete")return Promise.resolve({...clinic,onboarding_completed:true});
      return Promise.reject(new Error(`unexpected ${path}`));
    });
  });
  afterEach(()=>cleanup());

  it("requires clinic basics to be saved before the staff step is reachable",async()=>{
    render(<Onboarding/>);
    await screen.findByLabelText(/clinic name/i);
    expect(screen.queryByRole("button",{name:"Skip for now"})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Save and continue"}));
    await waitFor(()=>expect(api).toHaveBeenCalledWith("/clinics/me",expect.objectContaining({method:"PUT"})));
    await screen.findByRole("button",{name:"Invite staff"});
  });

  it("lets an owner skip the optional staff step and finish setup, redirecting to the dashboard",async()=>{
    render(<Onboarding/>);
    await screen.findByLabelText(/clinic name/i);
    fireEvent.click(screen.getByRole("button",{name:"Save and continue"}));
    await screen.findByRole("button",{name:"Invite staff"});
    fireEvent.click(screen.getByRole("button",{name:"Skip for now"}));
    await screen.findByText("Setup summary");
    const finishButtons=screen.getAllByRole("button",{name:"Finish setup"});
    fireEvent.click(finishButtons[finishButtons.length-1]);
    await waitFor(()=>expect(api).toHaveBeenCalledWith("/clinics/me/onboarding/complete",{method:"POST"}));
    await waitFor(()=>expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("lets an owner jump back to an earlier step to resume incomplete setup",async()=>{
    render(<Onboarding/>);
    await screen.findByLabelText(/clinic name/i);
    fireEvent.click(screen.getByRole("button",{name:"Save and continue"}));
    await screen.findByRole("button",{name:"Invite staff"});
    fireEvent.click(screen.getByRole("button",{name:"Back"}));
    expect(await screen.findByLabelText(/clinic name/i)).toBeVisible();
  });

  it("submits a staff invitation from onboarding with multiple independently selected permissions",async()=>{
    api.mockImplementation((path:string,options?:RequestInit)=>{
      if(path==="/clinics/me"&&(!options||!options.method))return Promise.resolve(clinic);
      if(path==="/clinics/me"&&options?.method==="PUT")return Promise.resolve(clinic);
      if(path==="/settings")return Promise.resolve({services:[]});
      if(path==="/staff/permission-catalog")return Promise.resolve({Patients:["patients.read","patients.create"],Billing:["billing.create"]});
      if(path==="/invitations"&&(!options||!options.method))return Promise.resolve([]);
      if(path==="/invitations"&&options?.method==="POST")return Promise.resolve({id:1,demo_token:"tok"});
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    render(<Onboarding/>);
    await screen.findByLabelText(/clinic name/i);
    fireEvent.click(screen.getByRole("button",{name:"Save and continue"}));
    fireEvent.click(await screen.findByRole("button",{name:"Invite staff"}));
    fireEvent.change(await screen.findByLabelText(/full name/i),{target:{value:"New Nurse"}});
    fireEvent.change(screen.getByLabelText(/work email/i),{target:{value:"nurse@example.test"}});
    fireEvent.change(screen.getByLabelText(/role/i),{target:{value:"nurse"}});
    fireEvent.click(screen.getByLabelText("View patients"));
    fireEvent.click(screen.getByLabelText("Manage billing"));
    fireEvent.click(screen.getByRole("button",{name:/create single-use invitation/i}));
    await waitFor(()=>expect(api).toHaveBeenCalledWith("/invitations",expect.objectContaining({method:"POST"})));
    const [,options]=api.mock.calls.find(([path,opts])=>path==="/invitations"&&opts?.method==="POST")!;
    const body=JSON.parse(String((options as RequestInit).body));
    expect(sorted(body.permissions)).toEqual(["billing.create","patients.read"]);
  });
});

function sorted(items:string[]){return [...items].sort();}

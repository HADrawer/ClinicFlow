import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import Staff from "./page";
import {I18nProvider} from "@/lib/i18n";

const api=vi.fn();
vi.mock("@/lib/api",()=>({api:(...args:unknown[])=>api(...args),ApiError:class ApiError extends Error{status=400;fieldErrors={}}}));

const staffMember={id:5,clinic_id:1,email:"nurse@clinicflow.test",full_name:"Huda Salman",role:"nurse",specialty:undefined,is_active:true,permissions:[],last_login_at:undefined};
const staffDetail={user:{...staffMember},invitation_status:"accepted",doctor_profile:undefined};

describe("Staff access confirmations and profile modal",()=>{
  beforeEach(()=>{
    api.mockImplementation((path:string)=>{
      if(path==="/staff")return Promise.resolve([staffMember]);
      if(path==="/invitations")return Promise.resolve([]);
      if(path==="/settings")return Promise.resolve({services:[]});
      if(path==="/staff/permission-catalog")return Promise.resolve({Clinical:["patients.read"]});
      if(path==="/staff/5")return Promise.resolve(staffDetail);
      if(path.startsWith("/staff/5/status"))return Promise.resolve({...staffMember,is_active:false});
      return Promise.resolve(null);
    });
  });
  afterEach(()=>{cleanup();api.mockReset()});

  it("requires a confirmation naming the staff member, category and effect before disabling access",async()=>{
    render(<I18nProvider><Staff/></I18nProvider>);
    await screen.findByText("Huda Salman");
    fireEvent.click(screen.getByRole("button",{name:"Disable Huda Salman"}));
    const dialog=await screen.findByRole("dialog",{name:"Disable staff access"});
    expect(dialog.textContent).toContain("Huda Salman");
    expect(dialog.textContent).toContain("Nurse");
    expect(dialog.textContent).toContain("signed out everywhere");
    expect(api).not.toHaveBeenCalledWith(expect.stringContaining("/status"),expect.anything());
    fireEvent.click(screen.getByRole("button",{name:"Confirm"}));
    await waitFor(()=>expect(api).toHaveBeenCalledWith("/staff/5/status",expect.objectContaining({method:"PATCH"})));
  });

  it("opens a profile modal instead of navigating when a staff name is clicked",async()=>{
    render(<I18nProvider><Staff/></I18nProvider>);
    await screen.findByText("Huda Salman");
    fireEvent.click(screen.getByRole("button",{name:"Huda Salman"}));
    const dialog=await screen.findByRole("dialog",{name:"Staff profile"});
    await waitFor(()=>expect(dialog.textContent).toContain("nurse@clinicflow.test"));
    expect(dialog.querySelector("a[href='/staff/5']")).toBeInTheDocument();
  });
});

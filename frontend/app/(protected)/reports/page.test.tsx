import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {I18nProvider} from "@/lib/i18n";

const api=vi.fn();
vi.mock("@/lib/api",()=>({api:(...args:unknown[])=>api(...args),ApiError:class ApiError extends Error{status=400;fieldErrors={}}}));

const accountant={id:1,clinic_id:1,full_name:"Amal",role:"accountant",permissions:[],clinic:{pharmacy_enabled:false}};
const nurse={id:2,clinic_id:1,full_name:"Huda",role:"nurse",permissions:["quality.manage"],clinic:{pharmacy_enabled:false}};

describe("Reports permission-aware sections",()=>{
  beforeEach(()=>{
    api.mockImplementation((path:string)=>{
      if(path.startsWith("/appointments?"))return Promise.resolve([]);
      if(path==="/billing/invoices")return Promise.resolve([]);
      if(path.startsWith("/insurance/claims"))return Promise.resolve({items:[],total:0});
      if(path==="/patients")return Promise.resolve([]);
      if(path==="/quality/incidents")return Promise.resolve([]);
      if(path==="/quality/complaints")return Promise.resolve([]);
      return Promise.resolve([]);
    });
  });
  afterEach(()=>{cleanup();api.mockReset()});

  it("shows only the sections an accountant has permission for",async()=>{
    vi.resetModules();
    vi.doMock("@/lib/auth",()=>({useAuth:()=>({user:accountant})}));
    const {default:AccountantReports}=await import("./page");
    render(<I18nProvider><AccountantReports/></I18nProvider>);
    expect(await screen.findByText("Revenue & invoices")).toBeInTheDocument();
    expect(await screen.findByText("Insurance claims")).toBeInTheDocument();
    expect(screen.queryByText("Quality incidents & complaints")).not.toBeInTheDocument();
    expect(screen.queryByText("Prescriptions")).not.toBeInTheDocument();
    vi.doUnmock("@/lib/auth");
  });

  it("shows only quality reports for a nurse granted quality.manage, and hides billing",async()=>{
    vi.resetModules();
    vi.doMock("@/lib/auth",()=>({useAuth:()=>({user:nurse})}));
    const {default:NurseReports}=await import("./page");
    render(<I18nProvider><NurseReports/></I18nProvider>);
    expect(await screen.findByText("Quality incidents & complaints")).toBeInTheDocument();
    expect(screen.queryByText("Revenue & invoices")).not.toBeInTheDocument();
    expect(screen.queryByText("Insurance claims")).not.toBeInTheDocument();
    vi.doUnmock("@/lib/auth");
  });

  it("refetches appointments with the new date range when a quick-range button is used",async()=>{
    const scheduler={id:3,clinic_id:1,full_name:"Reem",role:"receptionist",permissions:["appointments.read_all"],clinic:{pharmacy_enabled:false}};
    vi.resetModules();
    vi.doMock("@/lib/auth",()=>({useAuth:()=>({user:scheduler})}));
    const {default:SchedulerReports}=await import("./page");
    render(<I18nProvider><SchedulerReports/></I18nProvider>);
    await screen.findByText("Appointment volume & status");
    const before=api.mock.calls.map(call=>call[0] as string).filter(path=>path.startsWith("/appointments?"));
    expect(before.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button",{name:"90 days"}));
    await waitFor(()=>{
      const after=api.mock.calls.map(call=>call[0] as string).filter(path=>path.startsWith("/appointments?"));
      expect(after.length).toBeGreaterThan(before.length);
      expect(after.at(-1)).not.toEqual(before.at(-1));
    });
    vi.doUnmock("@/lib/auth");
  });
});

import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {PatientContextRail} from "./patient-context";
import {I18nProvider} from "@/lib/i18n";

const api=vi.fn();
const openInvoice=vi.fn();
const selectPatient=vi.fn();
vi.mock("@/lib/api",()=>({api:(...args:unknown[])=>api(...args),apiUrl:(path:string)=>path,ApiError:class ApiError extends Error{status=400;fieldErrors={}}}));
vi.mock("@/lib/auth",()=>({useAuth:()=>({user:{id:1,clinic_id:1,full_name:"Owner",role:"owner",permissions:[]}})}));
vi.mock("@/lib/quick-create",()=>({useQuickCreate:()=>({openPatient:vi.fn(),openAppointment:vi.fn(),openInvoice,openDocument:vi.fn(),openIncident:vi.fn(),close:vi.fn()})}));

const patient={id:9,clinic_id:1,full_name:"Sara Ahmed",phone:"+973 3900 0000",preferred_language:"en",communication_consent:false,treatment_consent_state:"not_recorded",created_at:"2026-07-01T09:00:00Z"};
const detail={patient,appointments:[],visits:[],invoices:[]};

vi.mock("@/lib/selected-patient",()=>({useSelectedPatient:()=>({detail,clearPatient:vi.fn(),selectPatient})}));

describe("PatientContextRail",()=>{
  beforeEach(()=>{
    api.mockImplementation((path:string)=>{
      if(path==="/patients/9")return Promise.resolve({patient,appointments:[],visits:[],prescriptions:[],invoices:[],claims:[],messages:[],orders:[],referrals:[],consents:[],documents:[],dispensing:[]});
      return Promise.resolve(null);
    });
  });
  afterEach(()=>{cleanup();api.mockReset();openInvoice.mockReset()});

  it("opens the full patient record in a modal instead of navigating",async()=>{
    render(<I18nProvider><PatientContextRail/></I18nProvider>);
    fireEvent.click(screen.getByRole("button",{name:"Open full record"}));
    const dialog=await screen.findByRole("dialog",{name:"Sara Ahmed"});
    expect(await screen.findByRole("link",{name:/Open in full page/})).toHaveAttribute("href","/patients/9");
    expect(dialog.querySelector("a[href='/patients/9']")).toBeTruthy();
  });

  it("opens the invoice quick-create modal instead of navigating to the billing form",()=>{
    render(<I18nProvider><PatientContextRail/></I18nProvider>);
    fireEvent.click(screen.getByRole("button",{name:"Create invoice"}));
    expect(openInvoice).toHaveBeenCalled();
  });
});

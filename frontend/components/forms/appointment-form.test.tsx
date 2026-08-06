import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {AppointmentForm} from "./appointment-form";
import {I18nProvider} from "@/lib/i18n";

const api=vi.fn();
const selectPatient=vi.fn();
vi.mock("@/lib/api",()=>({api:(...args:unknown[])=>api(...args),ApiError:class ApiError extends Error{status=400;fieldErrors={}}}));
vi.mock("@/lib/auth",()=>({useAuth:()=>({user:{id:8,clinic_id:1,full_name:"Reception User",role:"receptionist",permissions:[],clinic:{working_hours:{tuesday:"08:00–18:00"}}}})}));
vi.mock("@/lib/selected-patient",()=>({useSelectedPatient:()=>({detail:null,selectPatient,clearPatient:vi.fn(),refreshPatient:vi.fn()})}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn(),back:vi.fn()}),useSearchParams:()=>new URLSearchParams()}));

const doctor={id:2,clinic_id:1,email:"doctor@test",full_name:"Dr. Layla",role:"doctor",specialty:"Family Medicine",is_active:true,permissions:[]};
const service={id:1,name:"General consultation",price:"20.000",duration_minutes:30,active:true};
const patient={id:41,clinic_id:1,full_name:"Noura Ali",phone:"+973 3900 0000",cpr_number:"900101111",date_of_birth:"1990-01-01",gender:"female",preferred_language:"en",communication_consent:false,treatment_consent_state:"not_recorded",created_at:"2026-08-04T09:00:00Z"};

describe("AppointmentForm popup workflow",()=>{
  beforeEach(()=>{
    api.mockImplementation((path:string,options?:RequestInit)=>{
      if(path==="/doctors")return Promise.resolve([doctor]);
      if(path==="/settings")return Promise.resolve({services:[service]});
      if(path.startsWith("/patients/duplicates/check"))return Promise.resolve([]);
      if(path.startsWith("/patients?"))return Promise.resolve([]);
      if(path==="/patients"&&options?.method==="POST")return Promise.resolve(patient);
      return Promise.resolve([]);
    });
  });
  afterEach(()=>{cleanup();api.mockReset();selectPatient.mockReset()});

  it("retains appointment data after creating a patient in place",async()=>{
    render(<I18nProvider><AppointmentForm/></I18nProvider>);
    await screen.findByLabelText("Search patients");
    fireEvent.change(screen.getByLabelText(/Reason for visit/),{target:{value:"Continuity review"}});
    fireEvent.focus(screen.getByLabelText("Search patients"));
    fireEvent.click(await screen.findByRole("button",{name:"Add new patient"}));
    fireEvent.change(screen.getByLabelText(/Full legal name/),{target:{value:"Noura Ali"}});
    fireEvent.change(screen.getByLabelText(/CPR number/),{target:{value:"900101111"}});
    fireEvent.change(screen.getByLabelText(/Date of birth/),{target:{value:"1990-01-01"}});
    fireEvent.change(screen.getByLabelText(/Gender/),{target:{value:"female"}});
    fireEvent.change(screen.getByLabelText(/Mobile number/),{target:{value:"+973 3900 0000"}});
    fireEvent.click(screen.getByRole("button",{name:"Register patient"}));
    await waitFor(()=>expect(screen.queryByRole("dialog",{name:"Register patient"})).not.toBeInTheDocument());
    expect(screen.getByLabelText(/Reason for visit/)).toHaveValue("Continuity review");
    await waitFor(()=>expect(screen.getByRole("combobox",{name:"Search patients"})).toHaveValue("Noura Ali"));
  });

  it("uses separate custom date and time controls with constrained durations",async()=>{
    const {container}=render(<I18nProvider><AppointmentForm/></I18nProvider>);
    await screen.findByLabelText("Search patients");
    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(container.querySelector('input[type="time"]')).toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio",{name:"30 min"})).toHaveAttribute("aria-checked","true");
  });
});

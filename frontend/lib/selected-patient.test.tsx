import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {SelectedPatientProvider,useSelectedPatient} from "./selected-patient";

const api=vi.fn();
vi.mock("./api",()=>({api:(...args:unknown[])=>api(...args)}));

const authUser={id:1,clinic_id:1,full_name:"Owner",role:"owner",permissions:[]};
const auth=vi.fn(()=>({user:authUser}));
vi.mock("./auth",()=>({useAuth:()=>auth()}));

const patient={id:41,clinic_id:1,full_name:"Noura Ali",phone:"+973 3900 0000",preferred_language:"en",communication_consent:false,treatment_consent_state:"not_recorded",created_at:"2026-08-04T09:00:00Z"};

function Probe(){
  const {detail,loading,selectPatient,clearPatient}=useSelectedPatient();
  return <div>
    <span data-testid="loading">{String(loading)}</span>
    <span data-testid="patient">{detail?detail.patient.full_name:"none"}</span>
    <button onClick={()=>selectPatient(patient)}>select</button>
    <button onClick={()=>selectPatient(999)}>select-invalid</button>
    <button onClick={clearPatient}>clear</button>
  </div>;
}

describe("SelectedPatientProvider",()=>{
  beforeEach(()=>{sessionStorage.clear();api.mockReset();auth.mockReturnValue({user:authUser})});
  afterEach(()=>cleanup());

  it("shows the correct empty state when no patient is selected",()=>{
    render(<SelectedPatientProvider><Probe/></SelectedPatientProvider>);
    expect(screen.getByTestId("patient").textContent).toBe("none");
  });

  it("optimistically selects a patient and persists the selection for this clinic",async()=>{
    api.mockResolvedValue({patient,appointments:[],visits:[],invoices:[]});
    render(<SelectedPatientProvider><Probe/></SelectedPatientProvider>);
    fireEvent.click(screen.getByText("select"));
    expect(screen.getByTestId("patient").textContent).toBe("Noura Ali");
    await waitFor(()=>expect(api).toHaveBeenCalledWith("/patients/41"));
    expect(sessionStorage.getItem(`clinicflow:selected-patient:${authUser.clinic_id}:${authUser.id}`)).toBe("41");
  });

  it("clears an invalid, deleted, or cross-clinic selection when the backend rejects it",async()=>{
    api.mockRejectedValue(new Error("Patient not found"));
    render(<SelectedPatientProvider><Probe/></SelectedPatientProvider>);
    fireEvent.click(screen.getByText("select-invalid"));
    await waitFor(()=>expect(screen.getByTestId("patient").textContent).toBe("none"));
    expect(sessionStorage.getItem(`clinicflow:selected-patient:${authUser.clinic_id}:${authUser.id}`)).toBeNull();
  });

  it("clearing the selection removes it from storage",async()=>{
    api.mockResolvedValue({patient,appointments:[],visits:[],invoices:[]});
    render(<SelectedPatientProvider><Probe/></SelectedPatientProvider>);
    fireEvent.click(screen.getByText("select"));
    await waitFor(()=>expect(screen.getByTestId("patient").textContent).toBe("Noura Ali"));
    fireEvent.click(screen.getByText("clear"));
    expect(screen.getByTestId("patient").textContent).toBe("none");
    expect(sessionStorage.getItem(`clinicflow:selected-patient:${authUser.clinic_id}:${authUser.id}`)).toBeNull();
  });

  it("clears the selected patient when the active clinic changes",async()=>{
    api.mockResolvedValue({patient,appointments:[],visits:[],invoices:[]});
    const {rerender}=render(<SelectedPatientProvider><Probe/></SelectedPatientProvider>);
    fireEvent.click(screen.getByText("select"));
    await waitFor(()=>expect(screen.getByTestId("patient").textContent).toBe("Noura Ali"));

    const otherClinicUser={id:1,clinic_id:2,full_name:"Owner",role:"owner",permissions:[]};
    auth.mockReturnValue({user:otherClinicUser});
    rerender(<SelectedPatientProvider><Probe/></SelectedPatientProvider>);

    expect(screen.getByTestId("patient").textContent).toBe("none");
    expect(sessionStorage.getItem(`clinicflow:selected-patient:${authUser.clinic_id}:${authUser.id}`)).toBe("41");
    expect(sessionStorage.getItem(`clinicflow:selected-patient:${otherClinicUser.clinic_id}:${otherClinicUser.id}`)).toBeNull();
  });
});

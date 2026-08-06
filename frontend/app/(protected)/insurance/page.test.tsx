import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import Insurance from "./page";
import {I18nProvider} from "@/lib/i18n";

const api=vi.fn();
vi.mock("@/lib/api",()=>({api:(...args:unknown[])=>api(...args),ApiError:class ApiError extends Error{status=400;fieldErrors={}}}));
vi.mock("next/navigation",()=>({useSearchParams:()=>new URLSearchParams()}));

function claimRow(id:number,patientName:string,status="submitted"){
  return {
    id,invoice_id:id,policy_number:`POL-${id}`,claim_amount:"50.000",status,
    submitted_date:undefined,paid_date:undefined,created_at:"2026-07-30T09:00:00Z",
    company:{id:1,name:"Gulf Assurance"},
    invoice:{id,patient_id:id,invoice_number:`INV-000${id}`,discount:"0",vat:"0",total_amount:"50.000",paid_amount:"0",balance_due:"50.000",payment_status:"unpaid",payment_method:undefined,created_at:"2026-07-30T09:00:00Z",patient:{id,clinic_id:1,full_name:patientName,phone:"+973 3900 0000",preferred_language:"en",communication_consent:false,treatment_consent_state:"not_recorded",created_at:"2026-07-01T09:00:00Z"},items:[]},
  };
}

describe("Insurance claims search, filter and pagination",()=>{
  beforeEach(()=>{
    api.mockImplementation((path:string)=>{
      if(path==="/billing/invoices")return Promise.resolve([]);
      if(path==="/insurance/companies")return Promise.resolve([{id:1,name:"Gulf Assurance"}]);
      if(path.startsWith("/insurance/claims?")){
        const url=new URL(`http://x${path}`);
        if(url.searchParams.get("patient")==="Sara"){
          return Promise.resolve({items:[claimRow(1,"Sara Ahmed")],total:1});
        }
        return Promise.resolve({items:[claimRow(1,"Sara Ahmed"),claimRow(2,"Noura Ali")],total:60});
      }
      return Promise.resolve(null);
    });
  });
  afterEach(()=>{cleanup();api.mockReset()});

  it("sends the typed patient name as a filter query parameter",async()=>{
    render(<I18nProvider><Insurance/></I18nProvider>);
    await screen.findByText("Noura Ali");
    fireEvent.change(screen.getByPlaceholderText("Search by patient"),{target:{value:"Sara"}});
    await waitFor(()=>expect(api).toHaveBeenCalledWith(expect.stringContaining("patient=Sara")),{timeout:1000});
  });

  it("shows pagination controls and disables Previous on the first page",async()=>{
    render(<I18nProvider><Insurance/></I18nProvider>);
    await screen.findByText("Noura Ali");
    expect(screen.getByText(/Showing 1–2 of 60/)).toBeInTheDocument();
    expect(screen.getByRole("button",{name:/Previous/})).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:/Next/}));
    await waitFor(()=>expect(api).toHaveBeenCalledWith(expect.stringContaining("offset=25")));
  });
});

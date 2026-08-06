import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import ClaimDetail from "./page";
import {I18nProvider} from "@/lib/i18n";

const api=vi.fn();
vi.mock("@/lib/api",()=>({api:(...args:unknown[])=>api(...args),ApiError:class ApiError extends Error{status=400;fieldErrors={}}}));
vi.mock("next/navigation",()=>({useParams:()=>({id:"7"})}));

const claim={
  id:7,invoice_id:1,policy_number:"POL-100",claim_amount:"120.000",status:"submitted",
  rejection_reason:undefined,submitted_date:"2026-08-01",paid_date:undefined,created_at:"2026-07-30T09:00:00Z",
  company:{id:1,name:"Gulf Assurance"},
  invoice:{id:1,patient_id:9,invoice_number:"INV-0001",discount:"0",vat:"0",total_amount:"120.000",paid_amount:"0",balance_due:"120.000",payment_status:"unpaid",payment_method:undefined,created_at:"2026-07-30T09:00:00Z",patient:{id:9,clinic_id:1,full_name:"Sara Ahmed",phone:"+973 3900 1111",preferred_language:"en",communication_consent:false,treatment_consent_state:"not_recorded",created_at:"2026-07-01T09:00:00Z"},items:[]},
};

describe("Claim status transitions",()=>{
  beforeEach(()=>{
    api.mockImplementation((path:string)=>{
      if(path==="/insurance/claims/7")return Promise.resolve(claim);
      if(path.startsWith("/insurance/claims/7/status"))return Promise.resolve({...claim,status:"approved"});
      return Promise.resolve(null);
    });
  });
  afterEach(()=>{cleanup();api.mockReset()});

  it("only offers currently valid transitions for the claim's status",async()=>{
    render(<I18nProvider><ClaimDetail/></I18nProvider>);
    await screen.findByText("Claim CLM-00007");
    expect(screen.getByRole("button",{name:"Move to Approved"})).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Move to Rejected"})).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Move to Paid"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Move to Draft"})).not.toBeInTheDocument();
  });

  it("requires an explicit confirmation naming the patient and both statuses before calling the API",async()=>{
    render(<I18nProvider><ClaimDetail/></I18nProvider>);
    await screen.findByText("Claim CLM-00007");
    fireEvent.click(screen.getByRole("button",{name:"Move to Approved"}));
    const dialog=await screen.findByRole("dialog",{name:"Move claim to Approved"});
    expect(dialog.textContent).toContain("CLM-00007");
    expect(dialog.textContent).toContain("Sara Ahmed");
    expect(dialog.textContent).toContain("Submitted");
    expect(dialog.textContent).toContain("Approved");
    expect(api).not.toHaveBeenCalledWith(expect.stringContaining("/status"),expect.anything());
    fireEvent.click(screen.getByRole("button",{name:"Confirm move to Approved"}));
    await waitFor(()=>expect(api).toHaveBeenCalledWith("/insurance/claims/7/status",expect.objectContaining({method:"PATCH"})));
  });

  it("shows a rejection reason field only when moving to Rejected",async()=>{
    render(<I18nProvider><ClaimDetail/></I18nProvider>);
    await screen.findByText("Claim CLM-00007");
    fireEvent.click(screen.getByRole("button",{name:"Move to Approved"}));
    await screen.findByRole("dialog",{name:"Move claim to Approved"});
    expect(screen.queryByLabelText(/Rejection reason/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
    fireEvent.click(screen.getByRole("button",{name:"Move to Rejected"}));
    await screen.findByRole("dialog",{name:"Move claim to Rejected"});
    expect(screen.getByLabelText(/Rejection reason/)).toBeInTheDocument();
  });
});

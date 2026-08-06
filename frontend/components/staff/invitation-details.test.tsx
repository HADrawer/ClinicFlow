import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {InvitationDetails} from "./invitation-details";
import type {Invitation} from "./invitation-form";

const api=vi.fn();
vi.mock("@/lib/api",()=>({api:(...args:unknown[])=>api(...args)}));

const catalog={Patients:["patients.read","patients.create"],Billing:["billing.create"]};

const pending:Invitation={id:1,email:"nurse@test",full_name:"Test Nurse",role:"nurse",status:"pending",expires_at:"2026-08-10T00:00:00Z",created_at:"2026-08-01T00:00:00Z",permissions:["patients.read"]};

describe("InvitationDetails",()=>{
  beforeEach(()=>api.mockReset());
  afterEach(()=>cleanup());

  it("shows the pending invitation's assigned permissions as editable checkboxes",()=>{
    render(<InvitationDetails invitation={pending} catalog={catalog} onClose={vi.fn()} onSaved={vi.fn()}/>);
    expect(screen.getByLabelText("View patients")).toBeChecked();
    expect(screen.getByLabelText("Create patients")).not.toBeChecked();
    expect(screen.getByLabelText("Manage billing")).not.toBeChecked();
  });

  it("supports selecting an additional permission and removing one, then saving the change",async()=>{
    api.mockResolvedValue({...pending,permissions:["billing.create"]});
    const onSaved=vi.fn();
    render(<InvitationDetails invitation={pending} catalog={catalog} onClose={vi.fn()} onSaved={onSaved}/>);
    fireEvent.click(screen.getByLabelText("Manage billing"));
    fireEvent.click(screen.getByLabelText("View patients"));
    expect(screen.getByText(/unsaved changes/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button",{name:/save permissions/i}));
    await waitFor(()=>expect(api).toHaveBeenCalledWith(
      "/invitations/1/permissions",
      {method:"PATCH",body:JSON.stringify({permissions:["billing.create"]})},
    ));
    await waitFor(()=>expect(onSaved).toHaveBeenCalled());
  });

  it("disables saving until a change is made",()=>{
    render(<InvitationDetails invitation={pending} catalog={catalog} onClose={vi.fn()} onSaved={vi.fn()}/>);
    expect(screen.getByRole("button",{name:/save permissions/i})).toBeDisabled();
  });

  it("shows a read-only permission list once the invitation is no longer pending",()=>{
    render(<InvitationDetails invitation={{...pending,status:"accepted"}} catalog={catalog} onClose={vi.fn()} onSaved={vi.fn()}/>);
    expect(screen.queryByLabelText("View patients")).not.toBeInTheDocument();
    expect(screen.getByText("View patients")).toBeVisible();
    expect(screen.queryByRole("button",{name:/save permissions/i})).not.toBeInTheDocument();
  });
});

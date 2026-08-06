import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {AppShell} from "./app-shell";

const auth=vi.fn();
vi.mock("@/lib/auth",()=>({useAuth:()=>auth()}));
vi.mock("@/lib/quick-create",()=>({useQuickCreate:()=>({openPatient:vi.fn(),openAppointment:vi.fn(),openInvoice:vi.fn(),openDocument:vi.fn(),openIncident:vi.fn(),close:vi.fn()})}));
vi.mock("@/lib/selected-patient",()=>({useSelectedPatient:()=>({detail:null,loading:false,selectPatient:vi.fn(),clearPatient:vi.fn(),refreshPatient:vi.fn()})}));
vi.mock("next/navigation",()=>({usePathname:()=>"/dashboard",useRouter:()=>({replace:vi.fn()})}));

const user={id:1,clinic_id:1,email:"user@test",full_name:"Test User",role:"owner" as const,is_active:true,permissions:[],clinic:{id:1,name:"Test Clinic",address:"",phone:"",working_hours:{},pharmacy_enabled:false,feature_flags:{},quick_create_actions:["add_patient","new_appointment","new_invoice","upload_document","record_incident"]}};

describe("AppShell permissions",()=>{
  afterEach(()=>cleanup());
  beforeEach(()=>auth.mockReturnValue({user,loading:false,logout:vi.fn()}));
  it("hides disabled pharmacy navigation",async()=>{
    render(<AppShell><div>Content</div></AppShell>);
    expect(screen.queryByRole("link",{name:"Pharmacy"})).not.toBeInTheDocument();
    expect(await screen.findByRole("link",{name:"Staff access"})).toBeVisible();
  });
  it("shows pharmacy only when tenant feature is enabled",async()=>{
    auth.mockReturnValue({user:{...user,clinic:{...user.clinic,pharmacy_enabled:true}},loading:false,logout:vi.fn()});
    render(<AppShell><div>Content</div></AppShell>);
    expect(await screen.findByRole("link",{name:"Pharmacy"})).toBeVisible();
  });
  it("shows the permission-aware quick create trigger",()=>{
    render(<AppShell><div>Content</div></AppShell>);
    expect(screen.getByRole("button",{name:"Quick create"})).toBeVisible();
  });
  it("never offers direct doctor creation or staff invitation from Quick create",()=>{
    render(<AppShell><div>Content</div></AppShell>);
    fireEvent.click(screen.getByRole("button",{name:"Quick create"}));
    const menu=screen.getByRole("menu",{name:"Quick create"});
    expect(menu.textContent).not.toMatch(/new doctor/i);
    expect(menu.textContent).not.toMatch(/add doctor/i);
    expect(menu.textContent).not.toMatch(/invite staff/i);
    expect(screen.queryByRole("menuitem",{name:/invite/i})).not.toBeInTheDocument();
  });
  it("renders Quick create actions from the clinic's configured list",()=>{
    render(<AppShell><div>Content</div></AppShell>);
    fireEvent.click(screen.getByRole("button",{name:"Quick create"}));
    expect(screen.getByRole("menuitem",{name:/add patient/i})).toBeVisible();
    expect(screen.getByRole("menuitem",{name:/upload document/i})).toBeVisible();
    expect(screen.getByRole("menuitem",{name:/record incident/i})).toBeVisible();
  });
  it("shows a placeholder when no Quick create actions are configured",()=>{
    auth.mockReturnValue({user:{...user,clinic:{...user.clinic,quick_create_actions:[]}},loading:false,logout:vi.fn()});
    render(<AppShell><div>Content</div></AppShell>);
    fireEvent.click(screen.getByRole("button",{name:"Quick create"}));
    expect(screen.getByRole("menu",{name:"Quick create"}).textContent).toMatch(/no quick actions/i);
  });
});

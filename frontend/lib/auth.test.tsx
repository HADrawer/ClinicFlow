import {cleanup,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {AuthProvider,useAuth} from "./auth";

const api=vi.fn();
vi.mock("./api",()=>({api:(...args:unknown[])=>api(...args)}));

const replace=vi.fn();
vi.mock("next/navigation",()=>({useRouter:()=>({replace})}));

function Probe({trigger}:{trigger:"login"|"register"}){
  const auth=useAuth();
  return <button onClick={()=>trigger==="login"?auth.login("owner@test","password123"):auth.register({clinic_name:"New Clinic",full_name:"New Owner",email:"new@test",password:"password123",phone:"+973 1"})}>go</button>;
}

describe("AuthProvider redirects",()=>{
  beforeEach(()=>{localStorage.clear();api.mockReset();replace.mockReset()});
  afterEach(()=>cleanup());

  it("sends a freshly registered clinic to onboarding when setup is incomplete",async()=>{
    api.mockImplementation((path:string)=>{
      if(path==="/auth/register")return Promise.resolve({access_token:"token-1"});
      if(path==="/auth/me")return Promise.resolve({id:1,clinic_id:1,full_name:"New Owner",role:"owner",permissions:[],clinic:{id:1,name:"New Clinic",onboarding_completed:false}});
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    render(<AuthProvider><Probe trigger="register"/></AuthProvider>);
    screen.getByText("go").click();
    await waitFor(()=>expect(replace).toHaveBeenCalledWith("/onboarding"));
  });

  it("sends an existing, already-onboarded clinic straight to the dashboard on login",async()=>{
    api.mockImplementation((path:string)=>{
      if(path==="/auth/login")return Promise.resolve({access_token:"token-2"});
      if(path==="/auth/me")return Promise.resolve({id:2,clinic_id:2,full_name:"Existing Owner",role:"owner",permissions:[],clinic:{id:2,name:"Existing Clinic",onboarding_completed:true}});
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    render(<AuthProvider><Probe trigger="login"/></AuthProvider>);
    screen.getByText("go").click();
    await waitFor(()=>expect(replace).toHaveBeenCalledWith("/dashboard"));
  });
});

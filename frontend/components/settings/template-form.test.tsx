import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {TemplateForm} from "./template-form";
import {I18nProvider} from "@/lib/i18n";

const api=vi.fn();
vi.mock("@/lib/api",()=>({api:(...args:unknown[])=>api(...args),ApiError:class ApiError extends Error{status=400;fieldErrors={}}}));

describe("TemplateForm variable insertion",()=>{
  beforeEach(()=>{
    api.mockImplementation((path:string)=>{
      if(path==="/settings/message-template-variables")return Promise.resolve({patient_name:"Patient's full name",clinic_name:"Clinic name"});
      return Promise.resolve(null);
    });
  });
  afterEach(()=>{cleanup();api.mockReset()});

  it("inserts a variable token at the cursor when a variable chip is clicked",async()=>{
    const {container}=render(<I18nProvider><TemplateForm onCancel={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);
    await screen.findByRole("button",{name:"{{patient_name}}"});
    const body=container.querySelector("textarea")! as HTMLTextAreaElement;
    fireEvent.change(body,{target:{value:"Hello , see you soon."}});
    body.setSelectionRange(6,6);
    fireEvent.select(body);
    fireEvent.click(screen.getByRole("button",{name:"{{patient_name}}"}));
    await waitFor(()=>expect(body.value).toBe("Hello {{patient_name}}, see you soon."));
  });

  it("opens a searchable slash menu and inserts the selected variable at the slash",async()=>{
    const {container}=render(<I18nProvider><TemplateForm onCancel={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);
    await screen.findByRole("button",{name:"{{clinic_name}}"});
    const body=container.querySelector("textarea")! as HTMLTextAreaElement;
    fireEvent.change(body,{target:{value:"Hi /cli"}});
    const option=await screen.findByRole("button",{name:/\{\{clinic_name\}\}\s*Clinic name/});
    fireEvent.mouseDown(option);
    await waitFor(()=>expect(body.value).toBe("Hi {{clinic_name}}"));
  });

  it("flags unsupported variables and blocks saving until they are removed",async()=>{
    const {container}=render(<I18nProvider><TemplateForm onCancel={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);
    await screen.findByRole("button",{name:"{{patient_name}}"});
    const body=container.querySelector("textarea")! as HTMLTextAreaElement;
    fireEvent.change(body,{target:{value:"Hello {{unknown_field}}"}});
    expect(await screen.findByText(/Unsupported variables: unknown_field/)).toBeInTheDocument();
    expect(screen.getByRole("button",{name:/Create template/})).toBeDisabled();
  });
});

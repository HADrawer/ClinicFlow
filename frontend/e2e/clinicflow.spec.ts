import {expect,test,Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const password="password123";

async function login(page:Page,email:string,secret=password){await page.goto("/login");await page.getByLabel("Email address").fill(email);await page.getByLabel("Password").fill(secret);await page.waitForTimeout(500);await page.getByRole("button",{name:"Sign in securely"}).click();await expect(page).toHaveURL(/\/dashboard$/)}
async function logout(page:Page){await page.locator("header").getByRole("button").last().click();await page.getByRole("button",{name:"Sign out and revoke session"}).click();await expect(page).toHaveURL(/\/login$/)}
function localDateTime(days:number,hour:number){const value=new Date();value.setDate(value.getDate()+days);value.setHours(hour,0,0,0);const offset=value.getTimezoneOffset();return new Date(value.getTime()-offset*60_000).toISOString().slice(0,16)}
async function assertNoSeriousAxe(page:Page){const result=await new AxeBuilder({page:page as any}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();expect(result.violations.filter(item=>["critical","serious"].includes(item.impact||"")),JSON.stringify(result.violations,null,2)).toEqual([])}
async function assertNoPageOverflow(page:Page){const result=await page.evaluate(()=>({viewport:window.innerWidth,documentWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll("body *")].map(element=>({element,rect:element.getBoundingClientRect()})).filter(item=>item.rect.right>window.innerWidth+1&&getComputedStyle(item.element).position!=="fixed").slice(0,12).map(item=>({tag:item.element.tagName,className:(item.element as HTMLElement).className,right:Math.round(item.rect.right),width:Math.round(item.rect.width)}))}));expect(result.documentWidth,JSON.stringify(result,null,2)).toBeLessThanOrEqual(result.viewport)}

test("owner invites Doctor B; doctor activates, manages an appointment, finalizes an encounter and books follow-up",async({page})=>{
  const email="doctor.b@clinicflow.test";
  await login(page,"owner@clinicflow.test");
  await page.goto("/staff");
  await page.getByRole("button",{name:"Invite staff member"}).click();
  await page.getByLabel("Full name").fill("Dr. Basma Al Noor");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Specialty").fill("Dermatology");
  await page.getByLabel("License number").fill("NHRA-DEMO-B");
  await page.getByLabel("License expiry").fill("2029-12-31");
  await page.getByLabel("General consultation").check();
  await page.getByRole("button",{name:"Create single-use invitation"}).click();
  const invite=page.locator("p").filter({hasText:"/invite/"}).first();
  await expect(invite).toBeVisible();
  const inviteUrl=(await invite.textContent())!.trim();
  await logout(page);
  await page.goto(inviteUrl);
  await expect(page.getByText("Dr. Basma Al Noor")).toBeVisible();
  await page.getByLabel("Create password").fill("doctorBpassword123");
  await page.getByText("I accept the clinic’s staff terms").click();
  await page.getByText("I acknowledge the privacy").click();
  await page.getByRole("button",{name:"Activate account"}).click();
  await expect(page.getByText("Your account is active")).toBeVisible();
  await page.getByRole("link",{name:"Sign in to ClinicFlow"}).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill("doctorBpassword123");
  await page.getByRole("button",{name:"Sign in securely"}).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Clinical session")).toBeVisible();

  await page.goto("/appointments/new");
  await page.getByLabel("Patient").selectOption({index:1});
  await page.getByLabel("Service").selectOption({index:1});
  await page.getByLabel("Start").fill(localDateTime(45,10));
  await page.getByLabel("End").fill(localDateTime(45,10).replace("10:00","10:30"));
  await page.getByLabel("Room / chair / resource").fill("Consult B");
  await page.getByLabel("Reason for visit").fill("Doctor B continuity review");
  await page.getByRole("button",{name:"Create appointment"}).click();
  await expect(page).toHaveURL(/\/appointments\/\d+$/);
  await page.getByRole("button",{name:"Confirm",exact:true}).click();
  await page.getByRole("button",{name:"Check in",exact:true}).click();
  await page.getByRole("button",{name:"Start",exact:true}).click();
  await page.getByRole("button",{name:"Open encounter"}).click();
  await page.getByLabel("Diagnosis").fill("Clinical review");
  await page.getByLabel("Subjective").fill("Patient describes stable symptoms and no new concerns.");
  await page.getByLabel("Objective").fill("Observations reviewed and clinically stable.");
  await page.getByLabel("Assessment").fill("Stable follow-up presentation.");
  await page.getByLabel("Plan").fill("Continue plan and review at follow-up.");
  await page.getByLabel("Follow-up date").fill("2029-02-15");
  await page.getByRole("button",{name:"Finalize encounter"}).click();
  await expect(page.getByText("Encounter saved to the patient record.")).toBeVisible();
  await page.getByRole("link",{name:"Book follow-up"}).click();
  await page.getByLabel("Service").selectOption({index:1});
  await page.getByLabel("Start").fill(localDateTime(52,11));
  await page.getByLabel("End").fill(localDateTime(52,11).replace("11:00","11:30"));
  await page.getByLabel("Reason for visit").fill("Planned clinical follow-up");
  await page.getByRole("button",{name:"Create appointment"}).click();
  await expect(page).toHaveURL(/\/appointments\/\d+$/);

  await logout(page);
  await login(page,"owner@clinicflow.test");
  await page.goto("/staff");
  await page.getByRole("button",{name:"Disable Dr. Basma Al Noor"}).click();
  await expect(page.getByText(/disabled; active sessions revoked/)).toBeVisible();
  await logout(page);
  await page.getByLabel("Email address").fill(email);await page.getByLabel("Password").fill("doctorBpassword123");await page.getByRole("button",{name:"Sign in securely"}).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await login(page,"owner@clinicflow.test");await page.goto("/staff");await page.getByRole("button",{name:"Reactivate Dr. Basma Al Noor"}).click();await expect(page.getByText(/reactivated/)).toBeVisible();
});

test("receptionist registers a patient, checks in, queues and invoices the visit",async({page})=>{
  await login(page,"reception@clinicflow.test");
  await page.goto("/patients/new");
  await page.getByLabel("Full legal name").fill("E2E Patient Journey");
  await page.getByLabel("Mobile number").fill("+973 3999 2401");
  await page.getByLabel("CPR number").fill("991231240");
  await page.getByLabel("Allergies").fill("Penicillin — rash");
  await page.getByLabel("Treatment consent state").selectOption("accepted");
  await page.getByLabel("Patient communication consent recorded").check();
  await page.getByRole("button",{name:"Register patient"}).click();
  await expect(page).toHaveURL(/\/patients\/\d+$/);
  await expect(page.getByText("Penicillin — rash").first()).toBeVisible();
  await page.getByRole("link",{name:"Book appointment"}).click();
  await page.getByLabel("Doctor").selectOption({index:1});
  await page.getByLabel("Service").selectOption({index:1});
  await page.getByLabel("Start").fill(localDateTime(60,9));
  await page.getByLabel("End").fill(localDateTime(60,9).replace("09:00","09:30"));
  await page.getByLabel("Reason for visit").fill("Front desk patient journey");
  await page.getByRole("button",{name:"Create appointment"}).click();
  await expect(page).toHaveURL(/\/appointments\/\d+$/);const appointmentUrl=page.url();
  await page.getByRole("button",{name:"Check in",exact:true}).click();
  await page.goto("/queue");
  await expect(page.getByText("E2E Patient Journey")).toBeVisible();
  await page.getByRole("row",{name:/E2E Patient Journey/}).getByRole("button",{name:"Call next"}).click();
  await page.goto(appointmentUrl);
  await page.getByRole("link",{name:"Create invoice"}).click();
  await expect(page.getByRole("heading",{name:"New invoice"})).toBeVisible();
});

test("pharmacist receives batch stock and completes immutable dispensing",async({page})=>{
  await login(page,"pharmacist@clinicflow.test");
  await page.goto("/pharmacy/purchases");
  await page.getByRole("button",{name:"New purchase order"}).click();
  await page.getByLabel("Supplier").selectOption({index:1});
  await page.getByLabel("Medicine").selectOption({index:1});
  await page.getByLabel("Quantity").fill("12");
  await page.getByLabel("Unit cost (BHD)").fill("0.250");
  await page.getByRole("button",{name:"Create order"}).click();
  await page.getByRole("button",{name:"Receive"}).first().click();
  await page.getByLabel("Batch / lot number").fill("E2E-BATCH-2401");
  await page.getByLabel("Expiry date").fill("2029-12-31");
  await page.getByLabel("Supplier invoice reference").fill("SUP-E2E-2401");
  await page.getByRole("button",{name:"Finalize receipt"}).click();
  await expect(page.getByText("E2E-BATCH-2401")).toHaveCount(0);
  await page.goto("/pharmacy/stock");
  await expect(page.getByText("E2E-BATCH-2401")).toBeVisible();
  await page.goto("/pharmacy/prescriptions");
  const rx=page.getByRole("link",{name:/RX-\d+/}).first();await expect(rx).toBeVisible();await rx.click();
  await page.getByText("Verification complete").click();
  await page.getByRole("button",{name:"Finalize dispensing"}).click();
  await expect(page.getByText(/Dispensing DSP-/)).toBeVisible();
  await expect(page.getByRole("button",{name:"Print label"})).toBeVisible();
});

test("tenant isolation, disabled pharmacy and responsive accessible core screens",async({page,request})=>{
  await login(page,"owner@clinicflow.test");
  const token=await page.evaluate(()=>localStorage.getItem("clinicflow_token"));
  const foreign=await request.get("http://127.0.0.1:8000/api/patients/21",{headers:{Authorization:`Bearer ${token}`}});expect(foreign.status()).toBe(404);
  await assertNoSeriousAxe(page);
  const captures=[{name:"desktop-1440",width:1440,height:900},{name:"desktop-1280",width:1280,height:800},{name:"tablet-768",width:768,height:1024},{name:"mobile-390",width:390,height:844}];
  for(const size of captures){await page.setViewportSize({width:size.width,height:size.height});await page.goto("/dashboard");await expect(page.getByRole("heading").first()).toBeVisible();await assertNoPageOverflow(page);await page.screenshot({path:`test-results/screenshots/${size.name}-dashboard.png`,fullPage:true})}
  await page.setViewportSize({width:1440,height:900});await page.goto("/appointments");await expect(page.getByRole("heading",{name:"Clinic schedule"})).toBeVisible();await page.screenshot({path:"test-results/screenshots/desktop-appointments.png",fullPage:true});await page.goto("/staff");await expect(page.getByRole("heading",{name:"Staff access"})).toBeVisible();await page.screenshot({path:"test-results/screenshots/desktop-staff.png",fullPage:true});
  await logout(page);await login(page,"owner.riffa@clinicflow.test");await expect(page.getByRole("link",{name:"Pharmacy"})).toHaveCount(0);
  const riffaToken=await page.evaluate(()=>localStorage.getItem("clinicflow_token"));const pharmacy=await request.get("http://127.0.0.1:8000/api/pharmacy/dashboard",{headers:{Authorization:`Bearer ${riffaToken}`}});expect(pharmacy.status()).toBe(404);
});

test("Arabic is persisted as a true RTL interface across navigation, forms, tables and responsive views",async({page})=>{
  await login(page,"owner@clinicflow.test");
  await page.getByRole("button",{name:"العربية"}).click();
  await expect(page.locator("html")).toHaveAttribute("dir","rtl");
  await expect(page.locator("html")).toHaveAttribute("lang","ar");
  await expect(page.getByRole("heading",{name:"قيادة العيادة"})).toBeVisible();
  await expect(page.getByRole("link",{name:"الجدول"})).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("dir","rtl");
  await expect(page.getByRole("heading",{name:"قيادة العيادة"})).toBeVisible();
  await page.setViewportSize({width:1440,height:900});
  await page.screenshot({path:"test-results/screenshots/desktop-1440-dashboard-ar.png",fullPage:true});
  await page.goto("/appointments");
  await expect(page.getByRole("heading",{name:"جدول العيادة"})).toBeVisible();
  await page.getByRole("button",{name:"قائمة",exact:true}).click();
  await expect(page.getByRole("columnheader",{name:"المريض"})).toBeVisible();
  await page.screenshot({path:"test-results/screenshots/desktop-appointments-ar.png",fullPage:true});
  await page.goto("/patients/new");
  await expect(page.getByLabel("الاسم القانوني الكامل")).toBeVisible();
  await expect(page.getByLabel("الرقم الشخصي")).toBeVisible();
  await page.setViewportSize({width:768,height:1024});
  await assertNoPageOverflow(page);
  await page.screenshot({path:"test-results/screenshots/tablet-768-patient-form-ar.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await assertNoPageOverflow(page);
  await page.screenshot({path:"test-results/screenshots/mobile-390-patient-form-ar.png",fullPage:true});
  await page.getByRole("button",{name:"English"}).click();
  await expect(page.locator("html")).toHaveAttribute("dir","ltr");
  await expect(page.getByRole("heading",{name:"Register patient"})).toBeVisible();
});

test("every seeded role receives a distinct permitted workspace",async({page})=>{
  const roles=[
    {email:"doctor@clinicflow.test",heading:"My clinical current",visible:"Schedule",hidden:"Billing"},
    {email:"reception@clinicflow.test",heading:"Front desk current",visible:"Patients",hidden:"Insurance"},
    {email:"nurse@clinicflow.test",heading:"Care coordination",visible:"Queue",hidden:"Billing"},
    {email:"accountant@clinicflow.test",heading:"Revenue cycle",visible:"Billing",hidden:"Patients"},
    {email:"pharmacist@clinicflow.test",heading:"Dispensary current",visible:"Pharmacy",hidden:"Patients"},
  ];
  for(const role of roles){
    await login(page,role.email);
    await expect(page.getByRole("heading",{name:role.heading})).toBeVisible();
    await expect(page.getByRole("link",{name:role.visible,exact:true})).toBeVisible();
    await expect(page.getByRole("link",{name:role.hidden,exact:true})).toHaveCount(0);
    await logout(page);
  }
});

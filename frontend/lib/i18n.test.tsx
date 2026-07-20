import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it} from "vitest";
import {I18nProvider,LanguageSwitcher,useI18n} from "./i18n";

function Probe(){const {t,label}=useI18n();return <><p>{t("navigation.appointments")}</p><p>{label("checked_in")}</p><LanguageSwitcher/></>}

describe("ClinicFlow localization",()=>{
  beforeEach(()=>{window.localStorage.clear();document.documentElement.lang="en";document.documentElement.dir="ltr"});
  afterEach(()=>cleanup());
  it("persists Arabic and applies true document direction",async()=>{render(<I18nProvider><Probe/></I18nProvider>);fireEvent.click(screen.getByRole("button",{name:"العربية"}));await waitFor(()=>expect(document.documentElement.dir).toBe("rtl"));expect(document.documentElement.lang).toBe("ar");expect(localStorage.getItem("clinicflow_locale")).toBe("ar");expect(screen.getByText("الجدول")).toBeVisible();expect(screen.getByText("تم تسجيل الوصول")).toBeVisible()});
  it("restores the persisted locale after mounting",async()=>{window.localStorage.setItem("clinicflow_locale","ar");render(<I18nProvider><Probe/></I18nProvider>);expect(await screen.findByText("الجدول")).toBeVisible();expect(document.documentElement.dir).toBe("rtl")});
});

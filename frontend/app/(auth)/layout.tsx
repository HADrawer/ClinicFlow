"use client";

import {Activity,CheckCircle2,ShieldCheck} from "lucide-react";
import {LanguageSwitcher,useI18n} from "@/lib/i18n";
import {ThemeSwitcher} from "@/lib/theme";

export default function AuthLayout({children}:{children:React.ReactNode}){
  const {t}=useI18n();
  const assurances=["auth.tenantScope","auth.immutableNotes","auth.batchTraceability"];

  return <main id="main-content" className="grid min-h-screen bg-[var(--canvas)] lg:grid-cols-[minmax(440px,.82fr)_1.18fr]">
    <section className="relative flex items-center justify-center border-e border-[var(--line)] bg-[var(--surface)] p-6 sm:p-10">
      <div className="absolute end-5 top-5 flex items-center gap-2"><ThemeSwitcher label={t}/><LanguageSwitcher/></div>
      {children}
    </section>
    <aside className="relative hidden overflow-hidden bg-[var(--navy-deep)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute inset-y-0 end-0 w-1 bg-[var(--gulf-teal)]"/>
      <div>
        <div className="flex items-center gap-2.5 text-xl font-semibold"><span className="grid h-9 w-9 place-items-center rounded-[4px] bg-[var(--gulf-teal)]"><Activity size={21}/></span>{t("app.name")}</div>
        <div className="mt-24 max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-white/70">{t("app.clinicalCurrent")}</p>
          <h1 className="mt-4 text-[2.65rem] font-semibold leading-[1.08] tracking-[-.035em]">{t("auth.onePatientJourney")}</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/80">{t("auth.productSummary")}</p>
          <div className="mt-10 grid gap-4 text-sm text-white/85">{assurances.map(key=><div className="flex items-center gap-3" key={key}><CheckCircle2 size={17} className="text-[var(--gulf-teal)]"/>{t(key)}</div>)}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 pt-5 text-xs text-white/70"><ShieldCheck size={15}/>{t("app.developmentWorkspace")}</div>
    </aside>
  </main>;
}

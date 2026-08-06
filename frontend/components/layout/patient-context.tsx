"use client";

import {useMemo,useState} from "react";
import {AlertTriangle,CalendarPlus,ChevronDown,CircleX,CreditCard,ExternalLink,Phone} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Modal} from "@/components/ui/modal";
import {useI18n} from "@/lib/i18n";
import {useAuth} from "@/lib/auth";
import {useSelectedPatient} from "@/lib/selected-patient";
import {hasPermission} from "@/lib/permissions";
import {apiDate,shortDate} from "@/lib/utils";
import {useQuickCreate} from "@/lib/quick-create";
import {PatientDetailContent} from "@/components/patient/patient-detail-content";

function age(date?:string){
  if(!date)return null;
  const birth=new Date(`${date}T12:00:00`),today=new Date();
  let years=today.getFullYear()-birth.getFullYear();
  if(today.getMonth()<birth.getMonth()||(today.getMonth()===birth.getMonth()&&today.getDate()<birth.getDate()))years--;
  return Math.max(0,years);
}

export function PatientContextRail(){
  const {detail,clearPatient}=useSelectedPatient();
  const {openAppointment,openInvoice}=useQuickCreate();
  const {user}=useAuth();
  const {t,label}=useI18n();
  const [mobileOpen,setMobileOpen]=useState(false);
  const [fullRecordOpen,setFullRecordOpen]=useState(false);
  const visits=useMemo(()=>detail?.visits||[],[detail]);
  if(!detail)return null;
  const patient=detail.patient;
  const upcoming=detail.appointments.filter(item=>apiDate(item.start_time)>new Date()&&!['cancelled','no_show'].includes(item.status)).sort((a,b)=>a.start_time.localeCompare(b.start_time))[0];
  const last=visits.slice().sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
  const initials=patient.full_name.split(" ").map(part=>part[0]).slice(0,2).join("");
  const balance=(detail.invoices||[]).reduce((sum,item)=>sum+Number(item.balance_due||0),0);
  return <>
    <button className="patient-chip lg:hidden" onClick={()=>setMobileOpen(true)} aria-label={t("patientContext.openSummary")}>
      <span className="patient-avatar patient-avatar--small">{initials}</span>
      <span className="min-w-0 flex-1 text-start"><strong className="block truncate">{patient.full_name}</strong><span className="block truncate text-xs text-[var(--ink-500)]">{patient.patient_number||t("patients.noFileNumber")}</span></span>
      {patient.allergies&&<AlertTriangle size={17} className="text-[var(--danger)]"/>}<ChevronDown size={16}/>
    </button>
    <aside className={`patient-context ${mobileOpen?"patient-context--open":""}`} aria-label={t("patientContext.title")}>
      <div className="surface-header flex items-center justify-between px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[.08em] text-[var(--ink-500)]">{t("patientContext.title")}</p>
        <Button variant="ghost" className="min-h-9 px-2 lg:hidden" onClick={()=>setMobileOpen(false)} aria-label={t("common.close")}><ChevronDown size={18}/></Button>
      </div>
      <div className="scrollbar h-[calc(100%-57px)] overflow-y-auto">
        <div className="border-b border-[var(--line)] p-4">
          <div className="flex items-start gap-3">
            <span className="patient-avatar">{initials}</span>
            <div className="min-w-0 flex-1"><h2 className="truncate text-base font-bold text-[var(--ink-950)]">{patient.full_name}</h2><p className="mt-0.5 text-xs text-[var(--ink-500)]">{patient.patient_number||t("patients.noFileNumber")}</p><p className="mt-1 flex items-center gap-1 text-xs text-[var(--ink-700)]" dir="ltr"><Phone size={12}/>{patient.phone}</p></div>
          </div>
          {patient.allergies&&<div className="safety-stripe mt-4 bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface))] px-3 py-2 text-xs font-semibold text-[var(--danger)]" role="alert"><AlertTriangle className="me-1 inline" size={14}/>{t("patients.allergyWarningLabel")} {patient.allergies}</div>}
        </div>
        <dl className="patient-context__facts">
          <Fact label={t("patients.cpr")} value={patient.cpr_number||t("common.notRecorded")} dir="ltr"/>
          <Fact label={t("patients.ageDob")} value={patient.date_of_birth?`${age(patient.date_of_birth)} · ${shortDate(patient.date_of_birth)}`:t("common.notRecorded")}/>
          <Fact label={t("forms.gender")} value={patient.gender?label(patient.gender):t("common.notRecorded")}/>
          <Fact label={t("patientContext.lastVisit")} value={last?shortDate(last.created_at):t("common.none")}/>
          <Fact label={t("patientContext.nextAppointment")} value={upcoming?shortDate(upcoming.start_time):t("common.none")}/>
          {hasPermission(user,"billing.create")&&<Fact label={t("patientContext.openBalance")} value={balance?`${balance.toFixed(3)} BHD`:t("common.none")}/>} 
        </dl>
        <div className="space-y-2 border-t border-[var(--line)] p-4">
          <Button className="w-full" variant="secondary" onClick={()=>{setMobileOpen(false);setFullRecordOpen(true)}}><ExternalLink size={15}/>{t("patientContext.openRecord")}</Button>
          {hasPermission(user,"appointments.manage_own")||hasPermission(user,"appointments.manage_all")?<Button className="w-full" onClick={()=>{setMobileOpen(false);openAppointment({patient})}}><CalendarPlus size={15}/>{t("appointments.new")}</Button>:null}
          {hasPermission(user,"billing.create")&&<Button className="w-full" variant="secondary" onClick={()=>{setMobileOpen(false);openInvoice()}}><CreditCard size={15}/>{t("forms.createInvoice")}</Button>}
          <Button className="w-full" variant="ghost" onClick={()=>{clearPatient();setMobileOpen(false)}}><CircleX size={15}/>{t("patientContext.clear")}</Button>
        </div>
      </div>
    </aside>
    {mobileOpen&&<button className="patient-context-backdrop lg:hidden" onClick={()=>setMobileOpen(false)} aria-label={t("common.close")}/>}
    <Modal open={fullRecordOpen} onClose={()=>setFullRecordOpen(false)} title={patient.full_name} description={t("patientContext.openRecord")} size="max-w-6xl">
      <PatientDetailContent id={String(patient.id)} openFullPageHref={`/patients/${patient.id}`}/>
    </Modal>
  </>;
}

function Fact({label,value,dir}:{label:string;value:string;dir?:"ltr"}){return <div><dt>{label}</dt><dd dir={dir}>{value}</dd></div>}

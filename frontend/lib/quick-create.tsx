"use client";

import {createContext,useCallback,useContext,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {CalendarPlus} from "lucide-react";
import {api} from "./api";
import {useAuth} from "./auth";
import {useI18n} from "./i18n";
import {useSelectedPatient} from "./selected-patient";
import type {Patient,User} from "./types";
import {AppointmentForm,type AppointmentInitial} from "@/components/forms/appointment-form";
import {PatientForm} from "@/components/forms/patient-form";
import {InvoiceForm} from "@/components/forms/invoice-form";
import {DocumentUploadForm} from "@/components/forms/document-upload-form";
import {QualityForm} from "@/components/forms/quality-form";
import {Button} from "@/components/ui/button";
import {Modal} from "@/components/ui/modal";

type QuickCreate={
  openPatient:()=>void;
  openAppointment:(initial?:AppointmentInitial)=>void;
  openInvoice:()=>void;
  openDocument:()=>void;
  openIncident:()=>void;
  close:()=>void;
};

type Kind="patient"|"appointment"|"missing-provider"|"invoice"|"document"|"incident";

const Context=createContext<QuickCreate|null>(null);

export function QuickCreateProvider({children}:{children:React.ReactNode}){
  const {user}=useAuth();
  const {t}=useI18n();
  const selected=useSelectedPatient();
  const path=usePathname();
  const [kind,setKind]=useState<Kind|null>(null);
  const [initial,setInitial]=useState<AppointmentInitial|undefined>();
  const [dirty,setDirty]=useState(false);
  const close=useCallback(()=>{setKind(null);setDirty(false)},[]);
  useEffect(()=>{close()},[path,close]);

  const openPatient=useCallback(()=>{setDirty(false);setKind("patient")},[]);
  const openAppointment=useCallback((next?:AppointmentInitial)=>{
    const resolved={...next,patient:next?.patient||selected.detail?.patient};
    setInitial(resolved);setDirty(false);
    api<User[]>("/doctors").then(rows=>setKind(rows.length?"appointment":"missing-provider")).catch(()=>setKind("appointment"));
  },[selected.detail?.patient]);
  const openInvoice=useCallback(()=>{setDirty(false);setKind("invoice")},[]);
  const openDocument=useCallback(()=>{setDirty(false);setKind("document")},[]);
  const openIncident=useCallback(()=>{setDirty(false);setKind("incident")},[]);
  const value=useMemo(()=>({openPatient,openAppointment,openInvoice,openDocument,openIncident,close}),[openPatient,openAppointment,openInvoice,openDocument,openIncident,close]);

  const selectedPatient=selected.detail?.patient;

  return <Context.Provider value={value}>
    {children}
    <Modal open={kind==="patient"} dirty={dirty} onClose={close} title={t("quickCreate.addPatient")} description={t("quickCreate.patientDescription")} size="max-w-4xl">
      <div className="p-4 sm:p-5"><PatientForm compact onDirtyChange={setDirty} onCancel={()=>{if(!dirty||window.confirm(t("common.discardChanges")))close()}} onSaved={(patient:Patient)=>{setDirty(false);selected.selectPatient(patient);close()}}/></div>
    </Modal>
    <Modal open={kind==="appointment"} dirty={dirty} onClose={close} title={t("appointments.new")} description={t("quickCreate.appointmentDescription")} size="max-w-5xl">
      <div className="p-4 sm:p-5"><AppointmentForm initial={initial} onDirtyChange={setDirty} onCancel={close} onSaved={()=>{setDirty(false);close()}}/></div>
    </Modal>
    <Modal open={kind==="missing-provider"} onClose={close} title={t("noProvider.title")} description={t("noProvider.message")} size="max-w-lg">
      <div className="p-5">
        <div className="border-s-4 border-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_8%,var(--surface))] p-4 text-sm leading-6 text-[var(--ink-700)]">{user?.role==="owner"?t("noProvider.ownerGuidance"):t("noProvider.contactOwner")}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">{user?.role==="owner"&&<><Link onClick={close} className="button-base button-primary" href="/staff?invite=1&return=appointment"><CalendarPlus size={16}/>{t("noProvider.addDoctor")}</Link><Link onClick={close} className="button-base button-secondary" href="/settings">{t("noProvider.clinicSetup")}</Link></>}<Button variant="ghost" onClick={close}>{t("noProvider.notNow")}</Button></div>
      </div>
    </Modal>
    <Modal open={kind==="invoice"} dirty={dirty} onClose={close} title={t("forms.createInvoice")} description={t("quickCreate.invoiceDescription")} size="max-w-4xl">
      <div className="p-4 sm:p-5"><InvoiceForm onDirtyChange={setDirty} onCancel={close} onSaved={()=>{setDirty(false);window.dispatchEvent(new Event("clinicflow:patient-updated"));close()}}/></div>
    </Modal>
    <Modal open={kind==="document"} onClose={close} title={t("quickCreate.uploadDocument")} description={t("quickCreate.uploadDocumentDescription")} size="max-w-2xl">
      {selectedPatient?<DocumentUploadForm patientId={selectedPatient.id} onCancel={close} onSaved={()=>{window.dispatchEvent(new Event("clinicflow:patient-updated"));close()}}/>:<p className="p-5 text-sm text-[var(--ink-500)]">{t("quickCreate.selectPatientFirst")}</p>}
    </Modal>
    <Modal open={kind==="incident"} onClose={close} title={t("quickCreate.recordIncident")} description={t("quickCreate.recordIncidentDescription")}>
      <QualityForm kind="incident" onCancel={close} onSaved={()=>{window.dispatchEvent(new Event("clinicflow:incident-created"));close()}}/>
    </Modal>
  </Context.Provider>;
}

export function useQuickCreate(){
  const value=useContext(Context);
  if(!value)throw new Error("useQuickCreate must be used inside QuickCreateProvider");
  return value;
}

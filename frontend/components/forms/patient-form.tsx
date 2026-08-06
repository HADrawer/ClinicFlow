"use client";

import Link from "next/link";
import {FormEvent,useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {ApiError,api} from "@/lib/api";
import type {Patient} from "@/lib/types";
import {useI18n} from "@/lib/i18n";
import {Button} from "@/components/ui/button";
import {Field,Input,Textarea} from "@/components/ui/input";
import {Select} from "@/components/ui/select";
import {ErrorMessage} from "@/components/ui/feedback";

const blank={
  full_name:"",arabic_name:"",preferred_name:"",phone:"+973 ",cpr_number:"",
  date_of_birth:"",gender:"",nationality:"Bahraini",preferred_language:"en",
  communication_consent:false,treatment_consent_state:"not_recorded",allergies:"",
  chronic_conditions:"",current_medications:"",emergency_contact_name:"",
  emergency_contact_phone:"",notes:"",
};
const normalizeCpr=(value:string)=>value.replace(/\D/g,"");
const dateValue=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;

type PatientFormProps={
  patient?:Patient;
  onSaved?:(patient:Patient)=>void;
  onCancel?:()=>void;
  onDirtyChange?:(dirty:boolean)=>void;
  compact?:boolean;
};

export function PatientForm({patient,onSaved,onCancel,onDirtyChange,compact=false}:PatientFormProps){
  const router=useRouter();
  const {t}=useI18n();
  const [form,setForm]=useState({...blank,...patient});
  const [duplicates,setDuplicates]=useState<Patient[]>([]);
  const [acknowledged,setAcknowledged]=useState(false);
  const [error,setError]=useState("");
  const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const yesterday=useMemo(()=>{const date=new Date();date.setDate(date.getDate()-1);return dateValue(date)},[]);
  const set=(key:string,value:string|boolean)=>{setDirty(true);setFieldErrors(current=>({...current,[key]:""}));setForm(current=>({...current,[key]:value}))};

  useEffect(()=>{onDirtyChange?.(dirty)},[dirty,onDirtyChange]);
  useEffect(()=>{
    if(!dirty)return;
    const warn=(event:BeforeUnloadEvent)=>event.preventDefault();
    window.addEventListener("beforeunload",warn);
    return()=>window.removeEventListener("beforeunload",warn);
  },[dirty]);
  useEffect(()=>{
    if(patient)return;
    const timer=setTimeout(()=>{
      const phone=form.phone.replace(/\D/g,"");
      if(form.full_name.trim().length<2&&phone.length<=3&&!form.cpr_number&& !form.date_of_birth)return;
      const query=new URLSearchParams({name:form.full_name.trim(),phone:phone.length>3?form.phone.trim():"",cpr:normalizeCpr(form.cpr_number||""),date_of_birth:form.date_of_birth||""});
      api<Patient[]>(`/patients/duplicates/check?${query}`).then(rows=>{setDuplicates(rows);setAcknowledged(false)}).catch(()=>{});
    },350);
    return()=>clearTimeout(timer);
  },[patient,form.full_name,form.phone,form.cpr_number,form.date_of_birth]);

  async function submit(event:FormEvent){
    event.preventDefault();
    const nextErrors:Record<string,string>={};
    const cpr=normalizeCpr(form.cpr_number||"");
    if(!patient&&!cpr)nextErrors.cpr_number=t("validation.cprRequired");
    if(!patient&&!form.date_of_birth)nextErrors.date_of_birth=t("validation.dobRequired");
    if(form.date_of_birth&&form.date_of_birth>yesterday)nextErrors.date_of_birth=t("validation.dobPast");
    if(!patient&&!form.gender)nextErrors.gender=t("validation.genderRequired");
    if(Object.keys(nextErrors).length){setFieldErrors(nextErrors);setError(t("errors.reviewFields"));return}
    if(duplicates.length&&!acknowledged){setError(t("errors.reviewDuplicates"));return}
    setBusy(true);setError("");setFieldErrors({});
    try{
      const normalized={...form,cpr_number:cpr};
      const body=Object.fromEntries(Object.entries(normalized)
        .filter(([key])=>!["id","clinic_id","created_at","patient_number"].includes(key))
        .map(([key,value])=>[key,value===""?null:value]));
      const result=await api<Patient>(patient?`/patients/${patient.id}`:"/patients",{method:patient?"PUT":"POST",body:JSON.stringify(body)});
      setDirty(false);onDirtyChange?.(false);
      window.dispatchEvent(new Event("clinicflow:patient-updated"));
      if(onSaved)onSaved(result);else router.push(`/patients/${result.id}`);
    }catch(caught){
      if(caught instanceof ApiError)setFieldErrors(caught.fieldErrors);
      setError(caught instanceof Error?caught.message:t("errors.savePatient"));
      setBusy(false);
    }
  }

  const primary=<div className="grid gap-4 sm:grid-cols-2">
    <Field label={t("forms.fullLegalName")} required error={fieldErrors.full_name}><Input required aria-invalid={Boolean(fieldErrors.full_name)} value={form.full_name} onChange={event=>set("full_name",event.target.value)} autoFocus/></Field>
    <Field label={t("forms.cprNumber")} required={!patient} hint={t("forms.cprUniqueHint")} error={fieldErrors.cpr_number}><Input required={!patient} aria-invalid={Boolean(fieldErrors.cpr_number)} dir="ltr" value={form.cpr_number||""} onChange={event=>set("cpr_number",event.target.value)} onBlur={event=>set("cpr_number",normalizeCpr(event.target.value))} inputMode="numeric" autoComplete="off"/></Field>
    <Field label={t("patients.dateOfBirth")} required={!patient} error={fieldErrors.date_of_birth}><Input type="date" required={!patient} max={yesterday} aria-invalid={Boolean(fieldErrors.date_of_birth)} value={form.date_of_birth||""} onChange={event=>set("date_of_birth",event.target.value)}/></Field>
    <Field label={t("forms.gender")} required={!patient} error={fieldErrors.gender}><Select required={!patient} aria-invalid={Boolean(fieldErrors.gender)} value={form.gender||""} onChange={event=>set("gender",event.target.value)}><option value="">{t("common.notSet")}</option><option value="female">{t("gender.female")}</option><option value="male">{t("gender.male")}</option></Select></Field>
    <Field label={t("forms.mobileNumber")} required error={fieldErrors.phone}><Input dir="ltr" type="tel" required aria-invalid={Boolean(fieldErrors.phone)} value={form.phone} onChange={event=>set("phone",event.target.value)} placeholder={t("forms.examplePhone")}/></Field>
    <Field label={t("forms.nationality")}><Input value={form.nationality||""} onChange={event=>set("nationality",event.target.value)}/></Field>
  </div>;

  return <form onSubmit={submit} className="space-y-5" noValidate>
    <ErrorMessage message={error}/>
    {!patient&&duplicates.length>0&&<div role="alert" className="safety-stripe border border-[color-mix(in_srgb,var(--danger)_35%,var(--line))] bg-[color-mix(in_srgb,var(--danger)_7%,var(--surface))] p-4">
      <p className="font-semibold text-[var(--danger)]">{t("patients.duplicateTitle")}</p>
      <p className="mt-1 text-sm text-[var(--ink-700)]">{t("patients.duplicateDescription")}</p>
      <ul className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">{duplicates.map(item=><li key={item.id} className="py-2"><Link className="data-link text-sm" href={`/patients/${item.id}`} target="_blank">{item.full_name} · <span dir="ltr">{item.phone}</span> · {item.cpr_number||t("patients.noCpr")}</Link></li>)}</ul>
      <label className="mt-3 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={acknowledged} onChange={event=>setAcknowledged(event.target.checked)}/>{t("patients.duplicateAcknowledgement")}</label>
    </div>}
    {primary}
    {!compact&&<div className="grid gap-4 border-t border-[var(--line)] pt-5 sm:grid-cols-2">
      <Field label={t("forms.arabicName")}><Input dir="rtl" value={form.arabic_name||""} onChange={event=>set("arabic_name",event.target.value)}/></Field>
      <Field label={t("forms.preferredName")}><Input value={form.preferred_name||""} onChange={event=>set("preferred_name",event.target.value)}/></Field>
      <Field label={t("forms.preferredLanguage")}><Select value={form.preferred_language||"en"} onChange={event=>set("preferred_language",event.target.value)}><option value="en">{t("common.english")}</option><option value="ar">{t("common.arabic")}</option></Select></Field>
      <Field label={t("forms.consentState")}><Select value={form.treatment_consent_state||"not_recorded"} onChange={event=>set("treatment_consent_state",event.target.value)}><option value="not_recorded">{t("common.notRecorded")}</option><option value="accepted">{t("consent.accepted")}</option><option value="refused">{t("consent.refused")}</option><option value="revoked">{t("consent.revoked")}</option></Select></Field>
      <Field label={t("patients.allergies")}><Textarea value={form.allergies||""} onChange={event=>set("allergies",event.target.value)} placeholder={t("forms.exampleAllergy")}/></Field>
      <Field label={t("patients.chronicConditions")}><Textarea value={form.chronic_conditions||""} onChange={event=>set("chronic_conditions",event.target.value)} placeholder={t("forms.exampleConditions")}/></Field>
      <div className="sm:col-span-2"><Field label={t("patients.currentMedications")}><Textarea value={form.current_medications||""} onChange={event=>set("current_medications",event.target.value)}/></Field></div>
      <Field label={t("forms.emergencyContact")}><Input value={form.emergency_contact_name||""} onChange={event=>set("emergency_contact_name",event.target.value)}/></Field>
      <Field label={t("forms.emergencyPhone")}><Input dir="ltr" type="tel" value={form.emergency_contact_phone||""} onChange={event=>set("emergency_contact_phone",event.target.value)}/></Field>
      <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={Boolean(form.communication_consent)} onChange={event=>set("communication_consent",event.target.checked)}/>{t("patients.communicationConsent")}</label>
      <div className="sm:col-span-2"><Field label={t("forms.internalNotes")}><Textarea value={form.notes||""} onChange={event=>set("notes",event.target.value)}/></Field></div>
    </div>}
    <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-[var(--line)] bg-[var(--surface)] py-4">
      {onCancel&&<Button type="button" variant="secondary" onClick={onCancel}>{t("common.cancel")}</Button>}
      <Button disabled={busy||Boolean(duplicates.length&&!acknowledged)}>{busy?t("common.saving"):patient?t("patients.save"):t("patients.register")}</Button>
    </div>
  </form>;
}

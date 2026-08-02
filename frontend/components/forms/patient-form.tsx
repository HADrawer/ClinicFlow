"use client";

import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {api} from "@/lib/api";
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

export function PatientForm({patient,onSaved,onCancel}:{patient?:Patient;onSaved?:(patient:Patient)=>void;onCancel?:()=>void}){
  const router=useRouter();
  const {t}=useI18n();
  const [form,setForm]=useState({...blank,...patient});
  const [duplicates,setDuplicates]=useState<Patient[]>([]);
  const [acknowledged,setAcknowledged]=useState(false);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const set=(key:string,value:string|boolean)=>setForm(current=>({...current,[key]:value}));

  useEffect(()=>{
    if(patient)return;
    const timer=setTimeout(()=>{
      if(form.full_name.length<2&&!form.phone.trim()&&!form.cpr_number)return;
      const query=new URLSearchParams({name:form.full_name,phone:form.phone.trim(),cpr:form.cpr_number||"",date_of_birth:form.date_of_birth||""});
      api<Patient[]>(`/patients/duplicates/check?${query}`).then(rows=>{setDuplicates(rows);setAcknowledged(false)}).catch(()=>{});
    },350);
    return()=>clearTimeout(timer);
  },[patient,form.full_name,form.phone,form.cpr_number,form.date_of_birth]);

  async function submit(event:FormEvent){
    event.preventDefault();
    if(duplicates.length&&!acknowledged){setError(t("errors.reviewDuplicates"));return}
    setBusy(true);
    setError("");
    try{
      const body=Object.fromEntries(Object.entries(form)
        .filter(([key])=>!["id","clinic_id","created_at","patient_number"].includes(key))
        .map(([key,value])=>[key,value===""?null:value]));
      const result=await api<Patient>(patient?`/patients/${patient.id}`:"/patients",{method:patient?"PUT":"POST",body:JSON.stringify(body)});
      if(onSaved)onSaved(result);else router.push(`/patients/${result.id}`);
    }catch(error){
      setError(error instanceof Error?error.message:t("errors.savePatient"));
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="space-y-6">
    <ErrorMessage message={error}/>
    {!patient&&duplicates.length>0&&<div role="alert" className="safety-stripe border border-[#e6c2bd] bg-[#fff4f2] p-4">
      <p className="font-semibold text-[#963a35]">{t("patients.duplicateTitle")}</p>
      <p className="mt-1 text-sm text-[#763f38]">{t("patients.duplicateDescription")}</p>
      <ul className="mt-3 space-y-2">{duplicates.map(item=><li key={item.id}><Link className="text-sm font-semibold text-[#164e67] hover:underline" href={`/patients/${item.id}`} target="_blank">{item.full_name} · {item.phone} · {item.cpr_number||t("patients.noCpr")}</Link></li>)}</ul>
      <label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={acknowledged} onChange={event=>setAcknowledged(event.target.checked)}/>{t("patients.duplicateAcknowledgement")}</label>
    </div>}
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={t("forms.fullLegalName")} required><Input required value={form.full_name} onChange={event=>set("full_name",event.target.value)} autoFocus/></Field>
      <Field label={t("forms.arabicName")}><Input dir="rtl" value={form.arabic_name||""} onChange={event=>set("arabic_name",event.target.value)}/></Field>
      <Field label={t("forms.preferredName")}><Input value={form.preferred_name||""} onChange={event=>set("preferred_name",event.target.value)}/></Field>
      <Field label={t("forms.mobileNumber")} required><Input dir="ltr" type="tel" required value={form.phone} onChange={event=>set("phone",event.target.value)} placeholder={t("forms.examplePhone")}/></Field>
      <Field label={t("forms.cprNumber")} hint={t("forms.cprUniqueHint")}><Input value={form.cpr_number||""} onChange={event=>set("cpr_number",event.target.value)} inputMode="numeric"/></Field>
      <Field label={t("patients.dateOfBirth")}><Input type="date" value={form.date_of_birth||""} onChange={event=>set("date_of_birth",event.target.value)}/></Field>
      <Field label={t("forms.gender")}><Select value={form.gender||""} onChange={event=>set("gender",event.target.value)}><option value="">{t("common.notSet")}</option><option value="female">{t("gender.female")}</option><option value="male">{t("gender.male")}</option></Select></Field>
      <Field label={t("forms.nationality")}><Input value={form.nationality||""} onChange={event=>set("nationality",event.target.value)}/></Field>
      <Field label={t("forms.preferredLanguage")}><Select value={form.preferred_language||"en"} onChange={event=>set("preferred_language",event.target.value)}><option value="en">{t("common.english")}</option><option value="ar">{t("common.arabic")}</option></Select></Field>
      <Field label={t("forms.consentState")}><Select value={form.treatment_consent_state||"not_recorded"} onChange={event=>set("treatment_consent_state",event.target.value)}><option value="not_recorded">{t("common.notRecorded")}</option><option value="accepted">{t("consent.accepted")}</option><option value="refused">{t("consent.refused")}</option><option value="revoked">{t("consent.revoked")}</option></Select></Field>
      <Field label={t("patients.allergies")}><Textarea value={form.allergies||""} onChange={event=>set("allergies",event.target.value)} placeholder={t("forms.exampleAllergy")}/></Field>
      <Field label={t("patients.chronicConditions")}><Textarea value={form.chronic_conditions||""} onChange={event=>set("chronic_conditions",event.target.value)} placeholder={t("forms.exampleConditions")}/></Field>
      <div className="sm:col-span-2"><Field label={t("patients.currentMedications")}><Textarea value={form.current_medications||""} onChange={event=>set("current_medications",event.target.value)}/></Field></div>
      <Field label={t("forms.emergencyContact")}><Input value={form.emergency_contact_name||""} onChange={event=>set("emergency_contact_name",event.target.value)}/></Field>
      <Field label={t("forms.emergencyPhone")}><Input dir="ltr" type="tel" value={form.emergency_contact_phone||""} onChange={event=>set("emergency_contact_phone",event.target.value)}/></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={Boolean(form.communication_consent)} onChange={event=>set("communication_consent",event.target.checked)}/>{t("patients.communicationConsent")}</label>
      <div className="sm:col-span-2"><Field label={t("forms.internalNotes")}><Textarea value={form.notes||""} onChange={event=>set("notes",event.target.value)}/></Field></div>
    </div>
    <div className="flex justify-end gap-2 border-t border-[#d6e1de] pt-5">
      {onCancel&&<Button type="button" variant="secondary" onClick={onCancel}>{t("common.cancel")}</Button>}
      <Button disabled={busy||Boolean(duplicates.length&&!acknowledged)}>{busy?t("common.saving"):patient?t("patients.save"):t("patients.register")}</Button>
    </div>
  </form>;
}

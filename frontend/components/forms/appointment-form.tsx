"use client";

import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {useRouter,useSearchParams} from "next/navigation";
import {api} from "@/lib/api";
import {useAuth} from "@/lib/auth";
import {useI18n} from "@/lib/i18n";
import type {Appointment,Patient,Service,User} from "@/lib/types";
import {Button} from "@/components/ui/button";
import {Field,Input,Textarea} from "@/components/ui/input";
import {Select} from "@/components/ui/select";
import {ErrorMessage,Loading} from "@/components/ui/feedback";

const local=(iso?:string)=>iso?new Date(new Date(iso).getTime()-new Date(iso).getTimezoneOffset()*60000).toISOString().slice(0,16):"";
const bookingSources=["staff","phone","walk_in","whatsapp","referral","follow_up"] as const;

export function AppointmentForm({appointment}:{appointment?:Appointment}){
  const router=useRouter();
  const params=useSearchParams();
  const {user}=useAuth();
  const {t,label}=useI18n();
  const [refs,setRefs]=useState<{patients:Patient[];doctors:User[];services:Service[]}|null>(null);
  const [form,setForm]=useState({
    patient_id:String(appointment?.patient_id||params.get("patient")||""),
    doctor_id:String(appointment?.doctor_id||(user?.role==="doctor"?user.id:"")),
    service_id:String(appointment?.service_id||""),
    start_time:local(appointment?.start_time),end_time:local(appointment?.end_time),
    status:appointment?.status||"scheduled",reason:appointment?.reason||"",
    notes:appointment?.notes||"",room:appointment?.room||"",
    booking_source:appointment?.booking_source||"staff",conflict_override_reason:"",
  });
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    Promise.all([api<Patient[]>("/patients"),api<User[]>("/doctors"),api<{services:Service[]}>("/settings")])
      .then(([patients,doctors,settings])=>setRefs({patients,doctors,services:settings.services}))
      .catch(error=>setError(error instanceof Error?error.message:t("errors.load")));
  },[t]);

  const set=(key:string,value:string)=>setForm(current=>({...current,[key]:value}));
  async function submit(event:FormEvent){
    event.preventDefault();
    setBusy(true);
    setError("");
    try{
      const body={...form,patient_id:Number(form.patient_id),doctor_id:Number(form.doctor_id),service_id:Number(form.service_id),start_time:new Date(form.start_time).toISOString(),end_time:new Date(form.end_time).toISOString(),room:form.room||null,conflict_override_reason:form.conflict_override_reason||null};
      const result=await api<Appointment>(appointment?`/appointments/${appointment.id}`:"/appointments",{method:appointment?"PUT":"POST",body:JSON.stringify(body)});
      router.push(`/appointments/${result.id}`);
    }catch(error){
      setError(error instanceof Error?error.message:t("errors.saveAppointment"));
      setBusy(false);
    }
  }

  if(!refs&&!error)return <Loading label={t("common.loadingOptions")}/>;
  return <form onSubmit={submit} className="space-y-6">
    <ErrorMessage message={error}/>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={t("common.patient")} required>
        <Select required value={form.patient_id} onChange={event=>set("patient_id",event.target.value)}>
          <option value="">{t("forms.selectPatient")}</option>
          {refs?.patients.map(patient=><option value={patient.id} key={patient.id}>{patient.full_name} · {patient.patient_number||patient.phone}</option>)}
        </Select>
        <Link href="/patients/new" className="mt-2 inline-flex text-xs font-semibold text-[#0f625f] hover:underline">{t("forms.registerNewPatient")}</Link>
      </Field>
      <Field label={t("common.doctor")} required>
        <Select required disabled={user?.role==="doctor"&&!user.permissions.includes("appointments.manage_all")} value={form.doctor_id} onChange={event=>set("doctor_id",event.target.value)}>
          <option value="">{t("forms.selectDoctor")}</option>
          {refs?.doctors.map(doctor=><option value={doctor.id} key={doctor.id}>{doctor.full_name} · {doctor.specialty}</option>)}
        </Select>
      </Field>
      <Field label={t("common.service")} required>
        <Select required value={form.service_id} onChange={event=>set("service_id",event.target.value)}>
          <option value="">{t("forms.selectService")}</option>
          {refs?.services.map(service=><option value={service.id} key={service.id}>{service.name} · BHD {Number(service.price).toFixed(3)}</option>)}
        </Select>
      </Field>
      <Field label={t("forms.initialStatus")}><Select value={form.status} onChange={event=>set("status",event.target.value)}>{["requested","scheduled","confirmed","waitlisted"].map(status=><option value={status} key={status}>{label(status)}</option>)}</Select></Field>
      <Field label={t("forms.start")} required><Input type="datetime-local" value={form.start_time} onChange={event=>set("start_time",event.target.value)} required/></Field>
      <Field label={t("forms.end")} required><Input type="datetime-local" value={form.end_time} onChange={event=>set("end_time",event.target.value)} required/></Field>
      <Field label={t("forms.roomResource")}><Input value={form.room} onChange={event=>set("room",event.target.value)} placeholder={t("forms.exampleRoom")}/></Field>
      <Field label={t("forms.bookingSource")}><Select value={form.booking_source} onChange={event=>set("booking_source",event.target.value)}>{bookingSources.map(source=><option key={source} value={source}>{t(`booking.${source}`)}</option>)}</Select></Field>
      <div className="sm:col-span-2"><Field label={t("forms.visitReason")} required><Input value={form.reason} onChange={event=>set("reason",event.target.value)} required placeholder={t("forms.exampleReason")}/></Field></div>
      <div className="sm:col-span-2"><Field label={t("forms.internalNotes")}><Textarea value={form.notes} onChange={event=>set("notes",event.target.value)} placeholder={t("forms.exampleTeamInfo")}/></Field></div>
      <div className="sm:col-span-2"><Field label={t("forms.conflictOverride")} hint={t("forms.conflictOverrideHint")}><Input value={form.conflict_override_reason} onChange={event=>set("conflict_override_reason",event.target.value)}/></Field></div>
    </div>
    <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[#d6e1de] bg-white py-4">
      <Button type="button" variant="secondary" onClick={()=>router.back()}>{t("common.cancel")}</Button>
      <Button disabled={busy}>{busy?t("common.saving"):appointment?t("forms.saveSchedule"):t("appointments.create")}</Button>
    </div>
  </form>;
}

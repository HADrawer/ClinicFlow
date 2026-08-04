"use client";

import Link from "next/link";
import {FormEvent,useCallback,useEffect,useMemo,useState} from "react";
import {useRouter,useSearchParams} from "next/navigation";
import {CalendarPlus,Plus,Stethoscope,UserRound} from "lucide-react";
import {ApiError,api} from "@/lib/api";
import {useAuth} from "@/lib/auth";
import {useI18n} from "@/lib/i18n";
import {useSelectedPatient} from "@/lib/selected-patient";
import type {Appointment,Patient,Service,User} from "@/lib/types";
import {apiDate} from "@/lib/utils";
import {Button} from "@/components/ui/button";
import {Field,Input,Textarea} from "@/components/ui/input";
import {Select} from "@/components/ui/select";
import {ErrorMessage,Loading} from "@/components/ui/feedback";
import {SearchCombobox} from "@/components/ui/search-combobox";
import {DatePicker} from "@/components/ui/date-picker";
import {TimePicker} from "@/components/ui/time-picker";
import {Modal} from "@/components/ui/modal";
import {PatientForm} from "./patient-form";

const bookingSources=["staff","phone","walk_in","whatsapp","referral","follow_up"] as const;
const allowedDurations=[15,30,45] as const;
const dateValue=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const localParts=(iso?:string)=>{if(!iso)return {date:"",time:""};const date=apiDate(iso);return {date:dateValue(date),time:`${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`}};

export type AppointmentInitial={patient?:Patient;patientId?:number;date?:string;time?:string;doctorId?:number;room?:string};
type AppointmentFormProps={
  appointment?:Appointment;
  initial?:AppointmentInitial;
  onSaved?:(appointment:Appointment)=>void;
  onCancel?:()=>void;
  onDirtyChange?:(dirty:boolean)=>void;
};

export function AppointmentForm({appointment,initial,onSaved,onCancel,onDirtyChange}:AppointmentFormProps){
  const router=useRouter();
  const params=useSearchParams();
  const {user}=useAuth();
  const {t,label}=useI18n();
  const selected=useSelectedPatient();
  const parts=localParts(appointment?.start_time);
  const currentDuration=appointment?Math.round((apiDate(appointment.end_time).getTime()-apiDate(appointment.start_time).getTime())/60000):30;
  const initialPatientId=appointment?.patient_id||initial?.patient?.id||initial?.patientId||Number(params.get("patient"))||selected.detail?.patient.id||0;
  const [refs,setRefs]=useState<{doctors:User[];services:Service[]}|null>(null);
  const [patient,setPatient]=useState<Patient|null>(appointment?.patient||initial?.patient||selected.detail?.patient||null);
  const [doctor,setDoctor]=useState<User|null>(appointment?.doctor||null);
  const [form,setForm]=useState({
    patient_id:String(initialPatientId||""),
    doctor_id:String(appointment?.doctor_id||initial?.doctorId||(user?.role==="doctor"?user.id:"")),
    service_id:String(appointment?.service_id||""),
    date:parts.date||initial?.date||params.get("date")||"",
    time:parts.time||initial?.time||params.get("time")||"",
    duration:String(currentDuration),
    status:appointment?.status||"scheduled",reason:appointment?.reason||"",
    notes:appointment?.notes||"",room:appointment?.room||initial?.room||"",
    booking_source:appointment?.booking_source||"staff",conflict_override_reason:"",
  });
  const [error,setError]=useState("");
  const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [patientModal,setPatientModal]=useState(false);
  const [patientModalDirty,setPatientModalDirty]=useState(false);
  const today=useMemo(()=>dateValue(new Date()),[]);

  useEffect(()=>{onDirtyChange?.(dirty)},[dirty,onDirtyChange]);
  useEffect(()=>{
    if(!dirty)return;
    const warn=(event:BeforeUnloadEvent)=>event.preventDefault();
    window.addEventListener("beforeunload",warn);
    return()=>window.removeEventListener("beforeunload",warn);
  },[dirty]);
  useEffect(()=>{
    let live=true;
    Promise.all([api<User[]>("/doctors"),api<{services:Service[]}>("/settings")])
      .then(([doctors,settings])=>{if(!live)return;setRefs({doctors,services:settings.services.filter(service=>service.active)});const id=Number(form.doctor_id);if(id)setDoctor(appointment?.doctor||doctors.find(item=>item.id===id)||null)})
      .catch(caught=>setError(caught instanceof Error?caught.message:t("errors.load")));
    if(initialPatientId&&!patient)api<Patient[]>("/patients").then(rows=>{if(live)setPatient(rows.find(item=>item.id===initialPatientId)||null)}).catch(()=>{});
    return()=>{live=false};
  },[appointment?.doctor,form.doctor_id,initialPatientId,patient,t]);

  const set=useCallback((key:string,value:string)=>{setDirty(true);setFieldErrors(current=>({...current,[key]:""}));setForm(current=>({...current,[key]:value}))},[]);
  const loadPatients=useCallback((query:string)=>api<Patient[]>(`/patients?search=${encodeURIComponent(query)}`),[]);
  const loadDoctors=useCallback(async(query:string)=>{
    const normalized=query.trim().toLocaleLowerCase();
    return (refs?.doctors||[]).filter(item=>!normalized||`${item.full_name} ${item.specialty||""}`.toLocaleLowerCase().includes(normalized));
  },[refs?.doctors]);
  const patientLabel=useCallback((item:Patient)=>item.full_name,[]);
  const doctorLabel=useCallback((item:User)=>item.full_name,[]);
  const choosePatient=useCallback((next:Patient)=>{setPatient(next);set("patient_id",String(next.id))},[set]);
  const chooseDoctor=useCallback((next:User)=>{setDoctor(next);set("doctor_id",String(next.id))},[set]);

  function chooseService(value:string){
    set("service_id",value);
    const service=refs?.services.find(item=>String(item.id)===value);
    if(service&&allowedDurations.includes(service.duration_minutes as typeof allowedDurations[number]))set("duration",String(service.duration_minutes));
  }
  function cancel(){
    if(dirty&&!window.confirm(t("common.discardChanges")))return;
    if(onCancel)onCancel();else router.back();
  }
  async function submit(event:FormEvent){
    event.preventDefault();
    const nextErrors:Record<string,string>={};
    if(!form.patient_id)nextErrors.patient_id=t("validation.patientRequired");
    if(!form.doctor_id)nextErrors.doctor_id=t("validation.providerRequired");
    if(!form.service_id)nextErrors.service_id=t("validation.serviceRequired");
    if(!form.date)nextErrors.date=t("validation.dateRequired");
    if(!form.time)nextErrors.time=t("validation.timeRequired");
    const duration=Number(form.duration);
    if(!allowedDurations.includes(duration as typeof allowedDurations[number])&&!(appointment&&duration===currentDuration))nextErrors.duration=t("validation.durationAllowed");
    if(Object.keys(nextErrors).length){setFieldErrors(nextErrors);setError(t("errors.reviewFields"));return}
    setBusy(true);setError("");setFieldErrors({});
    try{
      const start=new Date(`${form.date}T${form.time}:00`);
      const end=new Date(start.getTime()+duration*60_000);
      const body={
        patient_id:Number(form.patient_id),doctor_id:Number(form.doctor_id),service_id:Number(form.service_id),
        start_time:start.toISOString(),end_time:end.toISOString(),status:form.status,reason:form.reason,
        notes:form.notes||null,room:form.room||null,booking_source:form.booking_source,
        conflict_override_reason:form.conflict_override_reason||null,
      };
      const result=await api<Appointment>(appointment?`/appointments/${appointment.id}`:"/appointments",{method:appointment?"PUT":"POST",body:JSON.stringify(body)});
      setDirty(false);onDirtyChange?.(false);window.dispatchEvent(new Event("clinicflow:appointment-updated"));
      if(patient)selected.selectPatient(patient);
      if(onSaved)onSaved(result);
      else if(appointment)window.location.assign(`/appointments/${result.id}`);
      else router.push(`/appointments/${result.id}`);
    }catch(caught){
      if(caught instanceof ApiError){setFieldErrors(caught.fieldErrors);if(caught.status===409)setError(t("errors.appointmentConflict"));else setError(caught.message)}
      else setError(caught instanceof Error?caught.message:t("errors.saveAppointment"));
      setBusy(false);
    }
  }

  if(!refs&&!error)return <Loading label={t("common.loadingOptions")}/>;
  if(refs&&!refs.doctors.length)return <NoProvider onCancel={onCancel}/>;
  const durations=appointment&&!allowedDurations.includes(currentDuration as typeof allowedDurations[number])?[...allowedDurations,currentDuration]:[...allowedDurations];
  return <>
    <form onSubmit={submit} className="space-y-5" noValidate>
      <ErrorMessage message={error}/>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field composite label={t("common.patient")} required error={fieldErrors.patient_id}>
          <SearchCombobox
            ariaLabel={t("patientSearch.label")}
            required value={patient} onChange={choosePatient} loadOptions={loadPatients}
            getKey={item=>item.id} getLabel={patientLabel}
            placeholder={t("patientSearch.placeholder")} emptyText={t("patientSearch.empty")}
            renderOption={item=><PatientOption patient={item}/>} action={<Button type="button" variant="ghost" className="w-full justify-start" onClick={()=>setPatientModal(true)}><Plus size={16}/>{t("patientSearch.addNew")}</Button>}
          />
        </Field>
        <Field composite label={t("appointmentForm.provider")} required error={fieldErrors.doctor_id}>
          <SearchCombobox
            ariaLabel={t("providerSearch.label")}
            required disabled={user?.role==="doctor"&&!user.permissions.includes("appointments.manage_all")}
            value={doctor} onChange={chooseDoctor} loadOptions={loadDoctors}
            getKey={item=>item.id} getLabel={doctorLabel}
            placeholder={t("providerSearch.placeholder")} emptyText={t("providerSearch.empty")}
            renderOption={item=><ProviderOption provider={item}/>}
          />
        </Field>
        <Field label={t("common.service")} required error={fieldErrors.service_id}>
          <Select required aria-invalid={Boolean(fieldErrors.service_id)} value={form.service_id} onChange={event=>chooseService(event.target.value)}><option value="">{t("forms.selectService")}</option>{refs?.services.map(service=><option value={service.id} key={service.id}>{service.name} · BHD {Number(service.price).toFixed(3)}</option>)}</Select>
        </Field>
        <Field label={t("forms.initialStatus")}><Select value={form.status} onChange={event=>set("status",event.target.value)}>{["requested","scheduled","confirmed","waitlisted"].map(status=><option value={status} key={status}>{label(status)}</option>)}</Select></Field>
      </div>

      <fieldset className="appointment-time-grid">
        <legend>{t("appointmentForm.scheduleLegend")}</legend>
        <Field composite label={t("appointmentForm.date")} required error={fieldErrors.date||fieldErrors.start_time}><DatePicker label={t("appointmentForm.date")} min={appointment?undefined:today} value={form.date} onChange={value=>set("date",value)}/></Field>
        <Field composite label={t("appointmentForm.startTime")} required error={fieldErrors.time||fieldErrors.start_time}><TimePicker label={t("appointmentForm.startTime")} date={form.date} workingHours={user?.clinic?.working_hours} value={form.time} onChange={value=>set("time",value)}/></Field>
        <Field composite label={t("forms.duration")} required error={fieldErrors.duration}>
          <div className="duration-selector" role="radiogroup" aria-label={t("forms.duration")}>{durations.map(value=><button type="button" role="radio" aria-checked={Number(form.duration)===value} className="duration-selector__option" key={value} onClick={()=>set("duration",String(value))}>{t("appointmentForm.minutes",{count:value})}</button>)}</div>
        </Field>
      </fieldset>

      <div className="grid gap-4 lg:grid-cols-2">
        <Field label={t("forms.roomResource")} hint={t("appointmentForm.roomHint")}><Input value={form.room} onChange={event=>set("room",event.target.value)} placeholder={t("forms.exampleRoom")}/></Field>
        <Field label={t("forms.bookingSource")}><Select value={form.booking_source} onChange={event=>set("booking_source",event.target.value)}>{bookingSources.map(source=><option key={source} value={source}>{t(`booking.${source}`)}</option>)}</Select></Field>
        <div className="lg:col-span-2"><Field label={t("forms.visitReason")} required error={fieldErrors.reason}><Input value={form.reason} onChange={event=>set("reason",event.target.value)} required placeholder={t("forms.exampleReason")}/></Field></div>
        <div className="lg:col-span-2"><Field label={t("forms.internalNotes")}><Textarea value={form.notes} onChange={event=>set("notes",event.target.value)} placeholder={t("forms.exampleTeamInfo")}/></Field></div>
        <div className="lg:col-span-2"><Field label={t("forms.conflictOverride")} hint={t("forms.conflictOverrideHint")}><Input value={form.conflict_override_reason} onChange={event=>set("conflict_override_reason",event.target.value)}/></Field></div>
      </div>
      <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-[var(--line)] bg-[var(--surface)] py-4">
        <Button type="button" variant="secondary" onClick={cancel}>{t("common.cancel")}</Button>
        <Button disabled={busy}>{busy?t("common.saving"):appointment?t("forms.saveSchedule"):t("appointments.create")}</Button>
      </div>
    </form>
    <Modal open={patientModal} dirty={patientModalDirty} onClose={()=>setPatientModal(false)} title={t("patients.register")} description={t("patientSearch.createDescription")} size="max-w-4xl">
      <div className="p-4 sm:p-5"><PatientForm compact onDirtyChange={setPatientModalDirty} onCancel={()=>{if(!patientModalDirty||window.confirm(t("common.discardChanges")))setPatientModal(false)}} onSaved={created=>{setPatientModalDirty(false);choosePatient(created);selected.selectPatient(created);setPatientModal(false)}}/></div>
    </Modal>
  </>;
}

function PatientOption({patient}:{patient:Patient}){const {t}=useI18n();return <span className="flex items-start gap-3 text-start"><span className="result-avatar"><UserRound size={16}/></span><span className="min-w-0"><strong className="block truncate text-sm text-[var(--ink-950)]">{patient.full_name}</strong><span className="mt-0.5 block truncate text-xs text-[var(--ink-500)]" dir="ltr">{patient.cpr_number||t("patients.noCpr")} · {patient.patient_number||t("patients.noFileNumber")} · {patient.phone}</span>{patient.date_of_birth&&<span className="mt-0.5 block text-xs text-[var(--ink-500)]">{patient.date_of_birth}</span>}</span></span>}
function ProviderOption({provider}:{provider:User}){const {t}=useI18n();return <span className="flex items-start gap-3 text-start"><span className="result-avatar"><Stethoscope size={16}/></span><span className="min-w-0"><strong className="block truncate text-sm text-[var(--ink-950)]">{provider.full_name}</strong><span className="mt-0.5 block text-xs text-[var(--ink-500)]">{provider.specialty||t("providerSearch.general")} · {t("providerSearch.active")}</span></span></span>}
function NoProvider({onCancel}:{onCancel?:()=>void}){const {user}=useAuth();const {t}=useI18n();return <div className="p-2 sm:p-4"><div className="border-s-4 border-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_8%,var(--surface))] p-4"><h3 className="font-bold text-[var(--ink-950)]">{t("noProvider.title")}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-700)]">{t("noProvider.message")}</p></div><div className="mt-5 flex flex-wrap justify-end gap-2">{user?.role==="owner"?<><Link onClick={onCancel} className="button-base button-primary" href="/staff?invite=1&return=appointment"><CalendarPlus size={16}/>{t("noProvider.addDoctor")}</Link><Link onClick={onCancel} className="button-base button-secondary" href="/settings">{t("noProvider.clinicSetup")}</Link></>:<p className="me-auto text-sm text-[var(--ink-500)]">{t("noProvider.contactOwner")}</p>}{onCancel&&<Button variant="ghost" onClick={onCancel}>{t("noProvider.notNow")}</Button>}</div></div>}

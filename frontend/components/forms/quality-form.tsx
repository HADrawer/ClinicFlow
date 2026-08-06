"use client";import {FormEvent,useState} from "react";import {api} from "@/lib/api";import {useAuth} from "@/lib/auth";import {dateTime} from "@/lib/utils";import {Button} from "@/components/ui/button";import {Field,Input,Textarea} from "@/components/ui/input";import {Select} from "@/components/ui/select";import {DatePicker} from "@/components/ui/date-picker";import {TimePicker} from "@/components/ui/time-picker";import {ErrorMessage} from "@/components/ui/feedback";

function todayParts(){const now=new Date();const pad=(n:number)=>String(n).padStart(2,"0");return {date:`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,time:`${pad(now.getHours())}:${pad(Math.floor(now.getMinutes()/15)*15%60)}`};}

export function QualityForm({kind,onCancel,onSaved}:{kind:"complaint"|"incident";onCancel:()=>void;onSaved:()=>void}){
  const {user}=useAuth();
  const initial=todayParts();
  const [form,setForm]=useState<Record<string,string|boolean>>(kind==="complaint"?{complainant:"",channel:"phone",category:"service",description:""}:{incident_type:"clinical_process",location:"",description:"",immediate_action:"",severity:"low",near_miss:false});
  // "Now" is the common case (recording an incident as it happens); "Other
  // time" reveals the same DatePicker + TimePicker pattern appointment
  // booking already uses, for a genuine custom date and hour.
  const [timeMode,setTimeMode]=useState<"now"|"custom">("now");
  const [occurredDate,setOccurredDate]=useState(initial.date);
  const [occurredTime,setOccurredTime]=useState(initial.time);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const set=(key:string,value:string|boolean)=>setForm(current=>({...current,[key]:value}));

  function resolvedOccurredAt():Date|null{
    if(timeMode==="now")return new Date();
    if(!occurredDate||!occurredTime)return null;
    const value=new Date(`${occurredDate}T${occurredTime}:00`);
    return Number.isNaN(value.getTime())?null:value;
  }

  async function submit(event:FormEvent){
    event.preventDefault();setError("");
    let body:Record<string,unknown>={...form};
    if(kind==="incident"){
      const occurredAt=resolvedOccurredAt();
      if(!occurredAt){setError("Choose a valid incident date and time.");return}
      if(occurredAt.getTime()>Date.now()+5*60000){setError("Incident time cannot be in the future.");return}
      body={...body,occurred_at:occurredAt.toISOString()};
    }
    setBusy(true);
    try{
      await api(`/quality/${kind==="complaint"?"complaints":"incidents"}`,{method:"POST",body:JSON.stringify(body)});
      onSaved();
    }catch(e){setError(e instanceof Error?e.message:"Unable to save record")}finally{setBusy(false)}
  }

  const occurredAt=kind==="incident"?resolvedOccurredAt():null;

  return <form className="space-y-4 p-5" onSubmit={submit}>
    <ErrorMessage message={error}/>
    {kind==="complaint"?<>
      <Field label="Complainant" required><Input value={String(form.complainant)} onChange={e=>set("complainant",e.target.value)} required/></Field>
      <Field label="Channel"><Select value={String(form.channel)} onChange={e=>set("channel",e.target.value)}><option value="phone">Phone</option><option value="in_person">In person</option><option value="email">Email</option></Select></Field>
      <Field label="Category" required><Input value={String(form.category)} onChange={e=>set("category",e.target.value)} required/></Field>
    </>:<>
      <Field label="Incident type" required><Input value={String(form.incident_type)} onChange={e=>set("incident_type",e.target.value)} required/></Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-[var(--ink-700)]">When did this happen?</legend>
        <div className="flex gap-2">
          <Button type="button" className="h-9" variant={timeMode==="now"?"primary":"secondary"} onClick={()=>setTimeMode("now")}>Now</Button>
          <Button type="button" className="h-9" variant={timeMode==="custom"?"primary":"secondary"} onClick={()=>setTimeMode("custom")}>Other time</Button>
        </div>
        {timeMode==="custom"&&<div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field composite label="Date" required><DatePicker label="Incident date" value={occurredDate} onChange={setOccurredDate}/></Field>
          <Field composite label="Time" required><TimePicker label="Incident time" date={occurredDate} workingHours={user?.clinic?.working_hours} value={occurredTime} onChange={setOccurredTime}/></Field>
        </div>}
        <p className="mt-2 text-xs text-[var(--ink-500)]">Recorded time: <strong className="text-[var(--ink-700)]">{occurredAt?dateTime(occurredAt.toISOString()):"—"}</strong></p>
      </fieldset>
      <Field label="Location" required><Input value={String(form.location)} onChange={e=>set("location",e.target.value)} required/></Field>
      <Field label="Severity"><Select value={String(form.severity)} onChange={e=>set("severity",e.target.value)}><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></Select></Field>
      <Field label="Immediate action" required><Textarea value={String(form.immediate_action)} onChange={e=>set("immediate_action",e.target.value)} required/></Field>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={Boolean(form.near_miss)} onChange={e=>set("near_miss",e.target.checked)}/>Near miss</label>
    </>}
    <Field label="Description" required><Textarea value={String(form.description)} onChange={e=>set("description",e.target.value)} required/></Field>
    <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
      <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button disabled={busy}>{busy?"Saving…":"Save record"}</Button>
    </div>
  </form>;
}

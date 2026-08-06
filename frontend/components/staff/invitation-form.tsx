"use client";
import {FormEvent,useState} from "react";
import {api} from "@/lib/api";
import type {Role,Service} from "@/lib/types";
import {titleCase} from "@/lib/utils";
import {Button} from "@/components/ui/button";
import {Field,Input} from "@/components/ui/input";
import {Select} from "@/components/ui/select";
import {ErrorMessage} from "@/components/ui/feedback";
import {PermissionEditor} from "@/components/staff/permission-editor";

export type Invitation={id:number;email:string;full_name:string;role:Role;status:string;expires_at:string;created_at:string;permissions:string[];demo_token?:string};

export function InvitationForm({services,catalog,onCancel,onSaved}:{services:Service[];catalog:Record<string,string[]>;onCancel:()=>void;onSaved:(result:Invitation)=>void}){
  const [form,setForm]=useState({full_name:"",email:"",role:"doctor",specialty:"",license_number:"",license_expiry:"",consultation_duration:"30",service_ids:[] as number[],permissions:[] as string[]});
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const set=(key:string,value:unknown)=>setForm(current=>({...current,[key]:value}));
  async function submit(event:FormEvent){
    event.preventDefault();setBusy(true);setError("");
    try{
      const profile_data=form.role==="doctor"?{specialty:form.specialty,license_number:form.license_number,license_expiry:form.license_expiry||null,consultation_duration:Number(form.consultation_duration),service_ids:form.service_ids,schedule:{sunday:[{start:"08:00",end:"16:00"}],monday:[{start:"08:00",end:"16:00"}],tuesday:[{start:"08:00",end:"16:00"}],wednesday:[{start:"08:00",end:"16:00"}],thursday:[{start:"08:00",end:"14:00"}]}}:{};
      const result=await api<Invitation>("/invitations",{method:"POST",body:JSON.stringify({email:form.email,full_name:form.full_name,role:form.role,profile_data,permissions:form.permissions})});
      onSaved(result);
    }catch(e){setError(e instanceof Error?e.message:"Unable to create invitation")}finally{setBusy(false)}
  }
  return <form className="space-y-5 p-5" onSubmit={submit}>
    <ErrorMessage message={error}/>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" required><Input autoFocus value={form.full_name} onChange={e=>set("full_name",e.target.value)} required/></Field>
      <Field label="Work email" required><Input type="email" value={form.email} onChange={e=>set("email",e.target.value)} required/></Field>
      <Field label="Role" required><Select value={form.role} onChange={e=>set("role",e.target.value)}>{["doctor","receptionist","nurse","accountant","pharmacist"].map(role=><option value={role} key={role}>{titleCase(role)}</option>)}</Select></Field>
      {form.role==="doctor"&&<>
        <Field label="Specialty" required><Input value={form.specialty} onChange={e=>set("specialty",e.target.value)} required/></Field>
        <Field label="License number" required><Input value={form.license_number} onChange={e=>set("license_number",e.target.value)} required/></Field>
        <Field label="License expiry" required><Input type="date" value={form.license_expiry} onChange={e=>set("license_expiry",e.target.value)} required/></Field>
        <Field label="Consultation duration"><Input type="number" min="5" max="480" value={form.consultation_duration} onChange={e=>set("consultation_duration",e.target.value)}/></Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium text-[var(--ink-700)]">Services</legend>
          <div className="grid gap-2 border border-[var(--line)] p-3 sm:grid-cols-2">
            {services.map(service=><label className="flex items-center gap-2 text-sm" key={service.id}><input type="checkbox" checked={form.service_ids.includes(service.id)} onChange={e=>set("service_ids",e.target.checked?[...form.service_ids,service.id]:form.service_ids.filter(id=>id!==service.id))}/>{service.name}</label>)}
          </div>
        </fieldset>
      </>}
      <div className="sm:col-span-2">
        <PermissionEditor value={form.permissions} onChange={next=>set("permissions",next)} catalog={catalog} description="Grant independent permissions in addition to this staff member's role. Role defaults always apply."/>
      </div>
    </div>
    <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
      <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button disabled={busy}>{busy?"Creating…":"Create single-use invitation"}</Button>
    </div>
  </form>;
}

"use client";
import {useState} from "react";
import {api} from "@/lib/api";
import type {Service} from "@/lib/types";
import {Button} from "@/components/ui/button";
import {Field,Input} from "@/components/ui/input";
import {ErrorMessage} from "@/components/ui/feedback";

export function ServiceForm({initial,editingId,onCancel,onSaved}:{initial?:Partial<Service>;editingId?:number;onCancel:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({
    name:initial?.name||"",
    price:initial?.price||"25.000",
    duration_minutes:String(initial?.duration_minutes??30),
    active:initial?.active??true,
  });
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  async function submit(event:React.FormEvent){
    event.preventDefault();
    setBusy(true);setError("");
    try{
      const payload=JSON.stringify({
        name:form.name,
        price:Number(form.price),
        duration_minutes:Number(form.duration_minutes),
        active:form.active,
      });
      if(editingId)await api(`/settings/services/${editingId}`,{method:"PUT",body:payload});
      else await api("/settings/services",{method:"POST",body:payload});
      onSaved();
    }catch(e){setError(e instanceof Error?e.message:"Unable to save service")}
    finally{setBusy(false)}
  }

  return <form className="space-y-4 p-5" onSubmit={submit}>
    <ErrorMessage message={error}/>
    <Field label="Service name" required>
      <Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/>
    </Field>
    <Field label="Price (BHD)" required>
      <Input type="number" step=".001" min="0" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} required/>
    </Field>
    <Field label="Duration (minutes)" required>
      <Input type="number" min="5" value={form.duration_minutes} onChange={e=>setForm({...form,duration_minutes:e.target.value})} required/>
    </Field>
    {editingId&&<label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-700)]">
      <input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/>
      Available for booking
    </label>}
    <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
      <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button disabled={busy}>{busy?"Saving…":editingId?"Save service":"Add service"}</Button>
    </div>
  </form>;
}

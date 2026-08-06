"use client";
import {useState} from "react";
import {api} from "@/lib/api";
import {Button} from "@/components/ui/button";
import {Field,Input} from "@/components/ui/input";
import {ErrorMessage} from "@/components/ui/feedback";

export type Company={id:number;name:string;active:boolean};

export function CompanyForm({initial,editingId,onCancel,onSaved}:{initial?:Partial<Company>;editingId?:number;onCancel:()=>void;onSaved:()=>void}){
  const [name,setName]=useState(initial?.name||"");
  const [active,setActive]=useState(initial?.active??true);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  async function submit(event:React.FormEvent){
    event.preventDefault();
    setBusy(true);setError("");
    try{
      const payload=JSON.stringify({name,active});
      if(editingId)await api(`/settings/insurance-companies/${editingId}`,{method:"PUT",body:payload});
      else await api("/settings/insurance-companies",{method:"POST",body:payload});
      onSaved();
    }catch(e){setError(e instanceof Error?e.message:"Unable to save insurance company")}
    finally{setBusy(false)}
  }

  return <form onSubmit={submit} className="space-y-4 p-5">
    <ErrorMessage message={error}/>
    <Field label="Company name" required><Input value={name} onChange={e=>setName(e.target.value)} required/></Field>
    <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-700)]">
      <input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>
      Accepting new claims
    </label>
    <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
      <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button disabled={busy}>{busy?"Saving…":editingId?"Save company":"Add company"}</Button>
    </div>
  </form>;
}

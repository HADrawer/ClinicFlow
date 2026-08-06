"use client";
import {useState} from "react";
import {api} from "@/lib/api";
import {PERMISSION_LABELS} from "@/lib/permissions";
import {dateTime,titleCase} from "@/lib/utils";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {ErrorMessage} from "@/components/ui/feedback";
import {PermissionEditor} from "@/components/staff/permission-editor";
import type {Invitation} from "@/components/staff/invitation-form";

export function InvitationDetails({invitation,catalog,onClose,onSaved}:{invitation:Invitation;catalog:Record<string,string[]>;onClose:()=>void;onSaved:()=>void}){
  const [permissions,setPermissions]=useState<string[]>(invitation.permissions);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const editable=invitation.status==="pending";
  const sortedOriginal=[...invitation.permissions].sort();
  const sortedCurrent=[...permissions].sort();
  const dirty=JSON.stringify(sortedOriginal)!==JSON.stringify(sortedCurrent);

  async function save(){
    setBusy(true);setError("");
    try{
      await api(`/invitations/${invitation.id}/permissions`,{method:"PATCH",body:JSON.stringify({permissions})});
      onSaved();
    }catch(e){setError(e instanceof Error?e.message:"Unable to update permissions")}finally{setBusy(false)}
  }

  return <div className="space-y-5 p-5">
    <ErrorMessage message={error}/>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">{invitation.full_name}</p>
        <p className="text-xs text-[var(--ink-500)]">{invitation.email}</p>
        <p className="mt-1 text-xs text-[var(--ink-500)]">{titleCase(invitation.role)} · expires {dateTime(invitation.expires_at)}</p>
      </div>
      <Badge value={invitation.status}/>
    </div>
    {editable?<PermissionEditor value={permissions} onChange={setPermissions} catalog={catalog} description="These permissions transfer to the staff account the moment this invitation is accepted."/>:<div>
      <p className="mb-2 text-sm font-medium text-[var(--ink-700)]">Assigned permissions</p>
      {invitation.permissions.length?<ul className="space-y-1.5">{invitation.permissions.map(name=><li className="text-sm" key={name}>{PERMISSION_LABELS[name]||name}</li>)}</ul>:<p className="text-sm text-[var(--ink-500)]">No additional permissions were assigned.</p>}
    </div>}
    <div className="flex items-center justify-between border-t border-[var(--line)] pt-4">
      <span className="text-xs text-[var(--ink-500)]">{editable?dirty?"Unsaved changes":"Up to date":`${permissions.length} permission${permissions.length===1?"":"s"} assigned`}</span>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
        {editable&&<Button disabled={busy||!dirty} onClick={save}>{busy?"Saving…":"Save permissions"}</Button>}
      </div>
    </div>
  </div>;
}

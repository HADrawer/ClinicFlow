"use client";import {useState} from "react";import {useParams} from "next/navigation";import {Printer} from "lucide-react";import {useApi} from "@/lib/hooks";import {api} from "@/lib/api";import type {Claim} from "@/lib/types";import {money,shortDate} from "@/lib/utils";import {PageHeader} from "@/components/ui/page-header";import {Card,CardHeader} from "@/components/ui/card";import {Badge} from "@/components/ui/badge";import {Button} from "@/components/ui/button";import {Field,Textarea} from "@/components/ui/input";import {ErrorMessage,Loading} from "@/components/ui/feedback";import {Modal} from "@/components/ui/modal";

const VALID_TRANSITIONS:Record<string,string[]>={
  draft:["submitted"],
  submitted:["approved","rejected"],
  approved:["paid"],
  rejected:["submitted"],
  paid:[],
};
const STATUS_LABEL:Record<string,string>={draft:"Draft",submitted:"Submitted",approved:"Approved",rejected:"Rejected",paid:"Paid"};

export default function ClaimDetail(){
  const {id}=useParams<{id:string}>();
  const {data,loading,error,reload}=useApi<Claim>(`/insurance/claims/${id}`);
  const [transition,setTransition]=useState<string|null>(null);
  const [rejectionReason,setRejectionReason]=useState("");
  const [busy,setBusy]=useState(false);
  const [transitionError,setTransitionError]=useState("");

  function openTransition(target:string){setTransition(target);setRejectionReason("");setTransitionError("")}

  async function confirmTransition(){
    if(!transition)return;
    setBusy(true);setTransitionError("");
    try{
      await api(`/insurance/claims/${id}/status`,{method:"PATCH",body:JSON.stringify({status:transition,rejection_reason:transition==="rejected"?(rejectionReason.trim()||undefined):undefined})});
      setTransition(null);
      reload();
    }catch(e){setTransitionError(e instanceof Error?e.message:"Unable to update claim status")}
    finally{setBusy(false)}
  }

  if(loading)return <Loading/>;
  if(!data)return <ErrorMessage message={error}/>;
  const nextStatuses=VALID_TRANSITIONS[data.status]||[];

  return <>
    <PageHeader title={`Claim CLM-${String(data.id).padStart(5,"0")}`} description={`${data.company.name} · ${data.policy_number}`} actions={<Button onClick={()=>window.print()}><Printer size={16}/>Print export</Button>}/>
    <ErrorMessage message={error}/>
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <Card className="print-card">
        <div className="flex justify-between border-b-[var(--line)] p-6">
          <div><p className="text-sm text-[var(--ink-500)]">Insurance claim</p><h2 className="mt-1 text-2xl font-bold">CLM-{String(data.id).padStart(5,"0")}</h2></div>
          <Badge value={data.status}/>
        </div>
        <div className="grid gap-6 p-6 sm:grid-cols-2">
          {[["Patient",data.invoice.patient.full_name],["Invoice",data.invoice.invoice_number],["Insurance company",data.company.name],["Policy number",data.policy_number],["Claim amount",money(data.claim_amount)],["Created",shortDate(data.created_at)],["Submitted",data.submitted_date?shortDate(data.submitted_date):"Not submitted"],["Paid",data.paid_date?shortDate(data.paid_date):"Not paid"]].map(([a,b])=>
            <div key={a}><p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">{a}</p><p className="mt-1 font-semibold text-[var(--ink-700)]">{b}</p></div>
          )}
        </div>
        {data.rejection_reason&&<div className="alert alert-danger m-6 text-sm"><strong>Rejection reason:</strong> {data.rejection_reason}</div>}
        <div className="m-6 border-t-[var(--line)] pt-5 text-xs text-[var(--ink-500)]">Export-ready claim summary generated from ClinicFlow clinic records.</div>
      </Card>
      <Card className="no-print">
        <CardHeader title="Update status" description="Only currently valid moves are offered"/>
        <div className="grid gap-2 p-4">
          {nextStatuses.length?nextStatuses.map(target=>
            <Button key={target} variant="secondary" onClick={()=>openTransition(target)}>Move to {STATUS_LABEL[target]}</Button>
          ):<p className="text-sm text-[var(--ink-500)]">{STATUS_LABEL[data.status]} is a final state for this claim.</p>}
        </div>
      </Card>
    </div>
    <Modal open={transition!==null} onClose={()=>setTransition(null)} title={transition?`Move claim to ${STATUS_LABEL[transition]}`:""} size="max-w-md">
      {transition&&<div className="p-5">
        <p className="text-sm leading-6 text-[var(--ink-700)]">
          Move <strong>CLM-{String(data.id).padStart(5,"0")}</strong> for <strong>{data.invoice.patient.full_name}</strong> from <strong>{STATUS_LABEL[data.status]}</strong> to <strong>{STATUS_LABEL[transition]}</strong>?
          {transition==="paid"&&" This records today's date as the payment date."}
          {transition==="submitted"&&data.status==="rejected"&&" This clears the previous rejection reason and resubmits the claim to the insurer."}
        </p>
        {transition==="rejected"&&<div className="mt-4">
          <Field label="Rejection reason" hint="Shown on the claim record; leave blank to use the default reason.">
            <Textarea value={rejectionReason} onChange={e=>setRejectionReason(e.target.value)} rows={3} placeholder="e.g. Missing pre-authorization documents"/>
          </Field>
        </div>}
        <ErrorMessage message={transitionError}/>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={()=>setTransition(null)}>Cancel</Button>
          <Button variant={transition==="rejected"?"danger":"primary"} disabled={busy} onClick={confirmTransition}>{busy?"Working…":`Confirm move to ${STATUS_LABEL[transition]}`}</Button>
        </div>
      </div>}
    </Modal>
  </>;
}

"use client";import Link from "next/link";import {useSearchParams} from "next/navigation";import {Suspense,useEffect,useState} from "react";import {ChevronLeft,ChevronRight,FilePlus2} from "lucide-react";import {useApi} from "@/lib/hooks";import type {Claim,Invoice} from "@/lib/types";import {money,shortDate} from "@/lib/utils";import {PageHeader} from "@/components/ui/page-header";import {Card,CardHeader} from "@/components/ui/card";import {Badge} from "@/components/ui/badge";import {Button} from "@/components/ui/button";import {DataTable} from "@/components/ui/data-table";import {Field,Input} from "@/components/ui/input";import {Select} from "@/components/ui/select";import {ErrorMessage,Loading} from "@/components/ui/feedback";import {Modal} from "@/components/ui/modal";import {ClaimForm} from "@/components/forms/claim-form";

const STATUS_OPTIONS=["draft","submitted","approved","rejected","paid"];
const LIMIT=25;

function Page(){
  const params=useSearchParams();
  const invoices=useApi<Invoice[]>("/billing/invoices");
  const companies=useApi<{id:number;name:string}[]>("/insurance/companies");
  const [open,setOpen]=useState(Boolean(params.get("invoice")));
  const [patient,setPatient]=useState("");
  const [debouncedPatient,setDebouncedPatient]=useState("");
  const [claimNumber,setClaimNumber]=useState("");
  const [debouncedClaimNumber,setDebouncedClaimNumber]=useState("");
  const [companyId,setCompanyId]=useState("");
  const [status,setStatus]=useState("");
  const [page,setPage]=useState(0);

  useEffect(()=>{const timer=window.setTimeout(()=>setDebouncedPatient(patient.trim()),300);return()=>window.clearTimeout(timer)},[patient]);
  useEffect(()=>{const timer=window.setTimeout(()=>setDebouncedClaimNumber(claimNumber.trim()),300);return()=>window.clearTimeout(timer)},[claimNumber]);
  useEffect(()=>{setPage(0)},[debouncedPatient,debouncedClaimNumber,companyId,status]);

  const query=new URLSearchParams();
  if(debouncedPatient)query.set("patient",debouncedPatient);
  if(debouncedClaimNumber)query.set("claim_number",debouncedClaimNumber);
  if(companyId)query.set("company_id",companyId);
  if(status)query.set("status",status);
  query.set("limit",String(LIMIT));
  query.set("offset",String(page*LIMIT));
  const claims=useApi<{items:Claim[];total:number}>(`/insurance/claims?${query.toString()}`);

  if(invoices.loading||companies.loading)return <Loading/>;
  const error=claims.error||invoices.error||companies.error;
  const total=claims.data?.total||0;
  const items=claims.data?.items||[];
  const rangeStart=total?page*LIMIT+1:0;
  const rangeEnd=Math.min(total,page*LIMIT+items.length);

  return <>
    <PageHeader title="Insurance claims" description="Track submissions, approvals, rejections and insurer payments." actions={<Button onClick={()=>setOpen(true)}><FilePlus2 size={16}/>New claim</Button>}/>
    <ErrorMessage message={error}/>
    <Card className="mb-5">
      <CardHeader title="Search & filter"/>
      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Patient name" composite>
          <Input type="search" placeholder="Search by patient" value={patient} onChange={e=>setPatient(e.target.value)}/>
        </Field>
        <Field label="Claim number" composite>
          <Input type="search" placeholder="e.g. 00012" value={claimNumber} onChange={e=>setClaimNumber(e.target.value)}/>
        </Field>
        <Field label="Insurance company" composite>
          <Select value={companyId} onChange={e=>setCompanyId(e.target.value)}>
            <option value="">All companies</option>
            {companies.data?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Status" composite>
          <Select value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}
          </Select>
        </Field>
      </div>
    </Card>
    <Card>
      {claims.loading?<Loading/>:<DataTable rows={items} keyOf={x=>x.id} empty="No claims match these filters" columns={[
        {key:"claim",header:"Claim",render:x=><Link className="font-semibold text-[var(--link)] hover:underline" href={`/insurance/claims/${x.id}`}>CLM-{String(x.id).padStart(5,"0")}</Link>},
        {key:"invoice",header:"Invoice",render:x=>x.invoice.invoice_number},
        {key:"patient",header:"Patient",render:x=>x.invoice.patient.full_name},
        {key:"insurer",header:"Insurer",render:x=>x.company.name},
        {key:"policy",header:"Policy",render:x=>x.policy_number},
        {key:"amount",header:"Amount",render:x=><span className="font-medium tabular">{money(x.claim_amount)}</span>},
        {key:"date",header:"Created",render:x=>shortDate(x.created_at)},
        {key:"status",header:"Status",render:x=><Badge value={x.status}/>},
      ]} />}
      {total>0&&<div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 text-xs text-[var(--ink-500)]">
        <span>Showing {rangeStart}–{rangeEnd} of {total}</span>
        <div className="flex gap-2">
          <Button variant="secondary" className="h-8 px-2" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}><ChevronLeft size={15}/>Previous</Button>
          <Button variant="secondary" className="h-8 px-2" disabled={rangeEnd>=total} onClick={()=>setPage(p=>p+1)}>Next<ChevronRight size={15}/></Button>
        </div>
      </div>}
    </Card>
    <Modal open={open} onClose={()=>setOpen(false)} title="New insurance claim" size="max-w-lg"><ClaimForm invoices={invoices.data||[]} companies={companies.data||[]} initialInvoice={params.get("invoice")||undefined} onCancel={()=>setOpen(false)} onSaved={()=>{setOpen(false);claims.reload()}}/></Modal>
  </>;
}
export default function Insurance(){return <Suspense fallback={<Loading/>}><Page/></Suspense>}

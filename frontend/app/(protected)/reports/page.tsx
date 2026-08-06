"use client";
import {useState} from "react";
import {Download} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {useAuth} from "@/lib/auth";
import {useApi} from "@/lib/hooks";
import {hasAnyPermission,hasPermission} from "@/lib/permissions";
import type {Appointment,Claim,Invoice,Patient} from "@/lib/types";
import {apiDate,money} from "@/lib/utils";
import {PageHeader} from "@/components/ui/page-header";
import {Card,CardHeader} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {DataTable} from "@/components/ui/data-table";
import {EmptyState} from "@/components/ui/empty-state";
import {ErrorMessage,Loading} from "@/components/ui/feedback";
import {Field,Input} from "@/components/ui/input";
import {MetricStrip} from "@/components/ui/metric-strip";

function inRange(value:string,from:Date,toExclusive:Date){
  const d=apiDate(value);
  return d>=from&&d<toExclusive;
}
function dayKey(value:string){return apiDate(value).toISOString().slice(0,10)}
function bucketDaily<T>(items:T[],pick:(item:T)=>string,from:Date,toExclusive:Date){
  const buckets:Record<string,number>={};
  for(let cursor=new Date(from);cursor<toExclusive;cursor.setDate(cursor.getDate()+1))buckets[cursor.toISOString().slice(0,10)]=0;
  for(const item of items){const key=dayKey(pick(item));if(key in buckets)buckets[key]++}
  return Object.entries(buckets).map(([date,count])=>({date,count}));
}
function sumDaily<T>(items:T[],pick:(item:T)=>string,amount:(item:T)=>number,from:Date,toExclusive:Date){
  const buckets:Record<string,number>={};
  for(let cursor=new Date(from);cursor<toExclusive;cursor.setDate(cursor.getDate()+1))buckets[cursor.toISOString().slice(0,10)]=0;
  for(const item of items){const key=dayKey(pick(item));if(key in buckets)buckets[key]+=amount(item)}
  return Object.entries(buckets).map(([date,total])=>({date,total}));
}
function chartLabel(date:React.ReactNode){const d=new Date(`${date}T00:00:00`);return `${d.getDate()}/${d.getMonth()+1}`}
function moneyLabel(value:unknown){return money(Number(Array.isArray(value)?value[0]:value)||0)}
function downloadCsv(filename:string,rows:(string|number)[][]){
  const csv=rows.map(row=>row.map(cell=>{
    const text=String(cell);
    return /[",\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
  }).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;link.download=filename;link.click();
  URL.revokeObjectURL(url);
}
const chartTooltipStyle={border:"1px solid var(--line)",borderRadius:3,fontSize:12,background:"var(--surface-raised)",color:"var(--ink-950)"} as const;
const axisTick={fontSize:10,fill:"var(--ink-500)"} as const;

export default function Reports(){
  const {user}=useAuth();
  const today=new Date();
  const defaultFrom=new Date(today);defaultFrom.setDate(defaultFrom.getDate()-29);
  const [fromDate,setFromDate]=useState(defaultFrom.toISOString().slice(0,10));
  const [toDate,setToDate]=useState(today.toISOString().slice(0,10));
  const todayStr=today.toISOString().slice(0,10);

  const fromDt=new Date(`${fromDate}T00:00:00`);
  const toDt=new Date(`${toDate}T00:00:00`);
  const toExclusiveDt=new Date(toDt);toExclusiveDt.setDate(toExclusiveDt.getDate()+1);
  const toExclusiveStr=toExclusiveDt.toISOString().slice(0,10);

  function quickRange(days:number){
    const end=new Date();
    const start=new Date();start.setDate(start.getDate()-(days-1));
    setFromDate(start.toISOString().slice(0,10));
    setToDate(end.toISOString().slice(0,10));
  }

  const can={
    patients:hasPermission(user,"patients.read"),
    appointments:hasAnyPermission(user,["appointments.read_own","appointments.read_all","appointments.manage_own","appointments.manage_all"]),
    billing:hasPermission(user,"billing.create"),
    claims:hasPermission(user,"claims.manage"),
    staff:user?.role==="owner"||hasPermission(user,"staff.manage"),
    prescriptions:user?.role==="owner"||user?.role==="doctor",
    pharmacy:Boolean(user?.clinic?.pharmacy_enabled)&&hasAnyPermission(user,["pharmacy.read","pharmacy.dispense","pharmacy.inventory_manage"]),
    quality:hasPermission(user,"quality.manage"),
  };
  const anyVisible=Object.values(can).some(Boolean);

  return <>
    <PageHeader title="Operational reports" description="Live summaries built directly from clinic records. Nothing shown here is estimated or simulated."/>
    <Card className="mb-5">
      <CardHeader title="Date range" description="Applies to activity-over-time sections below. Insurance claim status and current stock levels always reflect right now."/>
      <div className="flex flex-wrap items-end gap-3 p-4">
        <Field label="From"><Input type="date" value={fromDate} max={toDate} onChange={e=>setFromDate(e.target.value)}/></Field>
        <Field label="To"><Input type="date" value={toDate} min={fromDate} max={todayStr} onChange={e=>setToDate(e.target.value)}/></Field>
        <div className="flex gap-2 pb-0.5">
          <Button type="button" variant="secondary" className="h-9" onClick={()=>quickRange(7)}>7 days</Button>
          <Button type="button" variant="secondary" className="h-9" onClick={()=>quickRange(30)}>30 days</Button>
          <Button type="button" variant="secondary" className="h-9" onClick={()=>quickRange(90)}>90 days</Button>
        </div>
      </div>
    </Card>
    {!anyVisible&&<Card><EmptyState title="No report sections available" description="Your account doesn't have permission to view any operational reports yet."/></Card>}
    <div className="space-y-5">
      {can.appointments&&<AppointmentSection fromDate={fromDate} toDateExclusive={toExclusiveStr} fromDt={fromDt} toExclusiveDt={toExclusiveDt}/>}
      {can.patients&&<PatientActivitySection fromDt={fromDt} toExclusiveDt={toExclusiveDt}/>}
      {can.billing&&<RevenueSection fromDt={fromDt} toExclusiveDt={toExclusiveDt}/>}
      {can.claims&&<ClaimsSection/>}
      {can.staff&&<StaffActivitySection fromDate={fromDate} toDateExclusive={toExclusiveStr}/>}
      {can.prescriptions&&<PrescriptionsSection fromDt={fromDt} toExclusiveDt={toExclusiveDt}/>}
      {can.pharmacy&&<PharmacyActivitySection fromDt={fromDt} toExclusiveDt={toExclusiveDt}/>}
      {can.quality&&<QualitySection fromDt={fromDt} toExclusiveDt={toExclusiveDt}/>}
    </div>
  </>;
}

function AppointmentSection({fromDate,toDateExclusive,fromDt,toExclusiveDt}:{fromDate:string;toDateExclusive:string;fromDt:Date;toExclusiveDt:Date}){
  const query=new URLSearchParams({date_from:fromDate,date_to:toDateExclusive});
  const {data,loading,error}=useApi<Appointment[]>(`/appointments?${query.toString()}`);
  if(loading)return <Card><Loading/></Card>;
  if(!data)return <Card><ErrorMessage message={error}/></Card>;
  const total=data.length;
  const byStatus:Record<string,number>={};
  for(const item of data)byStatus[item.status]=(byStatus[item.status]||0)+1;
  const cancelled=(byStatus.cancelled||0)+(byStatus.no_show||0);
  const rate=total?(cancelled/total)*100:0;
  const trend=bucketDaily(data,item=>item.start_time,fromDt,toExclusiveDt);
  return <Card>
    <CardHeader title="Appointment volume & status" description="Appointments whose start time falls in the selected range."/>
    <div className="p-5">
      {!total?<EmptyState title="No appointments in this range" description="Widen the date range to see appointment activity."/>:<>
        <MetricStrip className="mb-5" items={[
          {label:"Total appointments",value:total},
          {label:"Completed",value:byStatus.completed||0},
          {label:"Cancelled",value:byStatus.cancelled||0,tone:"warning"},
          {label:"No-shows",value:byStatus.no_show||0,tone:"warning"},
          {label:"Cancel + no-show rate",value:`${rate.toFixed(1)}%`,tone:rate>15?"danger":"default"},
        ]}/>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{left:8,right:12}}>
              <CartesianGrid stroke="var(--line)" vertical={false}/>
              <XAxis dataKey="date" tickFormatter={chartLabel} tick={axisTick} axisLine={false} tickLine={false}/>
              <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false}/>
              <Tooltip labelFormatter={chartLabel} contentStyle={chartTooltipStyle}/>
              <Bar dataKey="count" fill="var(--gulf-teal)" maxBarSize={18}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {Object.entries(byStatus).map(([status,count])=><div key={status} className="flex items-center gap-2 border border-[var(--line)] px-3 py-1.5 text-xs"><Badge value={status}/><span className="tabular font-semibold">{count}</span></div>)}
        </div>
      </>}
    </div>
  </Card>;
}

function PatientActivitySection({fromDt,toExclusiveDt}:{fromDt:Date;toExclusiveDt:Date}){
  const {data,loading,error}=useApi<Patient[]>("/patients");
  if(loading)return <Card><Loading/></Card>;
  if(!data)return <Card><ErrorMessage message={error}/></Card>;
  const inRangePatients=data.filter(p=>inRange(p.created_at,fromDt,toExclusiveDt));
  const trend=bucketDaily(inRangePatients,p=>p.created_at,fromDt,toExclusiveDt);
  return <Card>
    <CardHeader title="Patient activity" description="New patient registrations over time, alongside the total roster."/>
    <div className="p-5">
      <MetricStrip className="mb-5" items={[
        {label:"Total patients",value:data.length},
        {label:"New in range",value:inRangePatients.length},
      ]}/>
      {inRangePatients.length?<div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trend} margin={{left:8,right:12}}>
            <CartesianGrid stroke="var(--line)" vertical={false}/>
            <XAxis dataKey="date" tickFormatter={chartLabel} tick={axisTick} axisLine={false} tickLine={false}/>
            <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false}/>
            <Tooltip labelFormatter={chartLabel} contentStyle={chartTooltipStyle}/>
            <Bar dataKey="count" fill="var(--clinical-navy)" maxBarSize={18}/>
          </BarChart>
        </ResponsiveContainer>
      </div>:<EmptyState title="No new patients in this range"/>}
    </div>
  </Card>;
}

function RevenueSection({fromDt,toExclusiveDt}:{fromDt:Date;toExclusiveDt:Date}){
  const {data,loading,error}=useApi<Invoice[]>("/billing/invoices");
  if(loading)return <Card><Loading/></Card>;
  if(!data)return <Card><ErrorMessage message={error}/></Card>;
  const inRangeInvoices=data.filter(inv=>inRange(inv.created_at,fromDt,toExclusiveDt));
  const billed=inRangeInvoices.reduce((sum,inv)=>sum+Number(inv.total_amount),0);
  const collected=inRangeInvoices.reduce((sum,inv)=>sum+Number(inv.paid_amount),0);
  const outstandingRange=inRangeInvoices.reduce((sum,inv)=>sum+Number(inv.balance_due),0);
  const outstandingAll=data.reduce((sum,inv)=>sum+Number(inv.balance_due),0);
  const byStatus:Record<string,number>={};
  for(const inv of inRangeInvoices)byStatus[inv.payment_status]=(byStatus[inv.payment_status]||0)+1;
  const trend=sumDaily(inRangeInvoices,inv=>inv.created_at,inv=>Number(inv.total_amount),fromDt,toExclusiveDt);
  return <Card>
    <CardHeader title="Revenue & invoices" description="Invoices created within the selected range."/>
    <div className="p-5">
      {!inRangeInvoices.length?<EmptyState title="No invoices in this range" description="Widen the date range to see billing activity."/>:<>
        <MetricStrip className="mb-5" items={[
          {label:"Invoiced",value:money(billed)},
          {label:"Collected",value:money(collected)},
          {label:"Outstanding (range)",value:money(outstandingRange),tone:outstandingRange>0?"warning":"default"},
          {label:"Outstanding (all time)",value:money(outstandingAll),tone:outstandingAll>0?"warning":"default"},
          {label:"Invoices",value:inRangeInvoices.length},
        ]}/>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{left:8,right:12}}>
              <CartesianGrid stroke="var(--line)" vertical={false}/>
              <XAxis dataKey="date" tickFormatter={chartLabel} tick={axisTick} axisLine={false} tickLine={false}/>
              <YAxis tick={axisTick} axisLine={false} tickLine={false}/>
              <Tooltip labelFormatter={chartLabel} formatter={moneyLabel} contentStyle={chartTooltipStyle}/>
              <Line type="monotone" dataKey="total" stroke="var(--gulf-teal)" strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {Object.entries(byStatus).map(([status,count])=><div key={status} className="flex items-center gap-2 border border-[var(--line)] px-3 py-1.5 text-xs"><Badge value={status}/><span className="tabular font-semibold">{count}</span></div>)}
        </div>
      </>}
    </div>
  </Card>;
}

function ClaimsSection(){
  const {data,loading,error}=useApi<{items:Claim[];total:number}>("/insurance/claims?limit=100&offset=0");
  if(loading)return <Card><Loading/></Card>;
  if(!data)return <Card><ErrorMessage message={error}/></Card>;
  const items=data.items;
  const byStatus:Record<string,number>={};
  const byCompany:Record<string,{count:number;amount:number}>={};
  let paidAmount=0;
  for(const claim of items){
    byStatus[claim.status]=(byStatus[claim.status]||0)+1;
    const key=claim.company.name;
    byCompany[key]=byCompany[key]||{count:0,amount:0};
    byCompany[key].count++;
    byCompany[key].amount+=Number(claim.claim_amount);
    if(claim.status==="paid")paidAmount+=Number(claim.claim_amount);
  }
  function exportCsv(){
    downloadCsv("insurance-claims-by-company.csv",[["Insurance company","Claims","Total amount (BHD)"],...Object.entries(byCompany).map(([name,stat])=>[name,stat.count,stat.amount.toFixed(3)])]);
  }
  return <Card>
    <CardHeader title="Insurance claims" description={`Current claim pipeline${data.total>items.length?` — showing the most recent ${items.length} of ${data.total} claims`:""}. Not limited by the date range above.`} action={items.length?<Button type="button" variant="secondary" className="h-9" onClick={exportCsv}><Download size={15}/>Export CSV</Button>:undefined}/>
    <div className="p-5">
      {!items.length?<EmptyState title="No insurance claims yet"/>:<>
        <MetricStrip className="mb-5" items={[
          {label:"Claims shown",value:items.length},
          {label:"Approved",value:byStatus.approved||0},
          {label:"Rejected",value:byStatus.rejected||0,tone:(byStatus.rejected||0)>0?"warning":"default"},
          {label:"Paid amount",value:money(paidAmount)},
        ]}/>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.08em] text-[var(--ink-500)]">By status</p>
            <div className="space-y-1.5">{Object.entries(byStatus).map(([status,count])=><div key={status} className="flex items-center justify-between border-b border-[var(--line)] py-1.5 text-sm"><Badge value={status}/><span className="tabular font-semibold">{count}</span></div>)}</div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.08em] text-[var(--ink-500)]">By insurer</p>
            <div className="space-y-1.5">{Object.entries(byCompany).map(([name,stat])=><div key={name} className="flex items-center justify-between border-b border-[var(--line)] py-1.5 text-sm"><span className="truncate">{name}</span><span className="tabular shrink-0">{stat.count} · {money(stat.amount)}</span></div>)}</div>
          </div>
        </div>
      </>}
    </div>
  </Card>;
}

type DoctorRow={doctor:string;total:number;completed:number;cancelled:number};
function StaffActivitySection({fromDate,toDateExclusive}:{fromDate:string;toDateExclusive:string}){
  const query=new URLSearchParams({date_from:fromDate,date_to:toDateExclusive});
  const {data,loading,error}=useApi<Appointment[]>(`/appointments?${query.toString()}`);
  if(loading)return <Card><Loading/></Card>;
  if(!data)return <Card><ErrorMessage message={error}/></Card>;
  const byDoctor:Record<string,DoctorRow>={};
  for(const item of data){
    const name=item.doctor?.full_name||"Unknown";
    byDoctor[name]=byDoctor[name]||{doctor:name,total:0,completed:0,cancelled:0};
    byDoctor[name].total++;
    if(item.status==="completed")byDoctor[name].completed++;
    if(item.status==="cancelled"||item.status==="no_show")byDoctor[name].cancelled++;
  }
  const rows=Object.values(byDoctor).sort((a,b)=>b.total-a.total);
  function exportCsv(){
    downloadCsv("staff-activity.csv",[["Doctor","Appointments","Completed","Cancelled / no-show"],...rows.map(r=>[r.doctor,r.total,r.completed,r.cancelled])]);
  }
  return <Card>
    <CardHeader title="Staff activity" description="Appointment load per doctor within the selected range." action={rows.length?<Button type="button" variant="secondary" className="h-9" onClick={exportCsv}><Download size={15}/>Export CSV</Button>:undefined}/>
    {rows.length?<DataTable rows={rows} keyOf={r=>r.doctor} columns={[
      {key:"doctor",header:"Doctor",render:r=><strong>{r.doctor}</strong>},
      {key:"total",header:"Appointments",render:r=>r.total},
      {key:"completed",header:"Completed",render:r=>r.completed},
      {key:"cancelled",header:"Cancelled / no-show",render:r=>r.cancelled},
    ]}/>:<div className="p-5"><EmptyState title="No staff activity in this range"/></div>}
  </Card>;
}

type PrescriptionRow={id:number;patient_id:number;status:string;created_at:string};
function PrescriptionsSection({fromDt,toExclusiveDt}:{fromDt:Date;toExclusiveDt:Date}){
  const {data,loading,error}=useApi<PrescriptionRow[]>("/prescriptions");
  if(loading)return <Card><Loading/></Card>;
  if(!data)return <Card><ErrorMessage message={error}/></Card>;
  const inRangeItems=data.filter(p=>inRange(p.created_at,fromDt,toExclusiveDt));
  const byStatus:Record<string,number>={};
  for(const p of inRangeItems)byStatus[p.status]=(byStatus[p.status]||0)+1;
  const uniquePatients=new Set(inRangeItems.map(p=>p.patient_id)).size;
  return <Card>
    <CardHeader title="Prescriptions" description="Prescriptions issued within the selected range."/>
    <div className="p-5">
      {!inRangeItems.length?<EmptyState title="No prescriptions in this range"/>:<>
        <MetricStrip items={[
          {label:"Prescriptions",value:inRangeItems.length},
          {label:"Unique patients",value:uniquePatients},
        ]}/>
        <div className="mt-5 flex flex-wrap gap-2">
          {Object.entries(byStatus).map(([status,count])=><div key={status} className="flex items-center gap-2 border border-[var(--line)] px-3 py-1.5 text-xs"><Badge value={status}/><span className="tabular font-semibold">{count}</span></div>)}
        </div>
      </>}
    </div>
  </Card>;
}

type DispenseRow={id:number;status:string;created_at:string};
type StockReport={stock_on_hand:number;inventory_value:string|number;expired_units:number};
function PharmacyActivitySection({fromDt,toExclusiveDt}:{fromDt:Date;toExclusiveDt:Date}){
  const dispensing=useApi<DispenseRow[]>("/pharmacy/dispensing");
  const stock=useApi<StockReport>("/pharmacy/reports/stock");
  if(dispensing.loading||stock.loading)return <Card><Loading/></Card>;
  if(!dispensing.data||!stock.data)return <Card><ErrorMessage message={dispensing.error||stock.error}/></Card>;
  const inRangeItems=dispensing.data.filter(d=>inRange(d.created_at,fromDt,toExclusiveDt));
  const byStatus:Record<string,number>={};
  for(const d of inRangeItems)byStatus[d.status]=(byStatus[d.status]||0)+1;
  return <Card>
    <CardHeader title="Pharmacy activity" description="Dispensing within the selected range, plus the current stock position."/>
    <div className="p-5">
      <MetricStrip className="mb-5" items={[
        {label:"Dispensed (range)",value:inRangeItems.length},
        {label:"Stock on hand",value:stock.data.stock_on_hand},
        {label:"Inventory value",value:money(stock.data.inventory_value)},
        {label:"Expired units",value:stock.data.expired_units,tone:stock.data.expired_units>0?"danger":"default"},
      ]}/>
      {inRangeItems.length>0&&<div className="flex flex-wrap gap-2">
        {Object.entries(byStatus).map(([status,count])=><div key={status} className="flex items-center gap-2 border border-[var(--line)] px-3 py-1.5 text-xs"><Badge value={status}/><span className="tabular font-semibold">{count}</span></div>)}
      </div>}
    </div>
  </Card>;
}

type IncidentRow={id:number;incident_type:string;occurred_at:string;severity:string;near_miss:boolean;status:string};
type ComplaintRow={id:number;category:string;channel:string;status:string;created_at:string};
function QualitySection({fromDt,toExclusiveDt}:{fromDt:Date;toExclusiveDt:Date}){
  const incidents=useApi<IncidentRow[]>("/quality/incidents");
  const complaints=useApi<ComplaintRow[]>("/quality/complaints");
  if(incidents.loading||complaints.loading)return <Card><Loading/></Card>;
  if(!incidents.data||!complaints.data)return <Card><ErrorMessage message={incidents.error||complaints.error}/></Card>;
  const rangeIncidents=incidents.data.filter(i=>inRange(i.occurred_at,fromDt,toExclusiveDt));
  const rangeComplaints=complaints.data.filter(c=>inRange(c.created_at,fromDt,toExclusiveDt));
  const nearMiss=rangeIncidents.filter(i=>i.near_miss).length;
  const bySeverity:Record<string,number>={};
  for(const i of rangeIncidents)bySeverity[i.severity]=(bySeverity[i.severity]||0)+1;
  return <Card>
    <CardHeader title="Quality incidents & complaints" description="Incidents (by when they occurred) and complaints (by when logged) within the selected range."/>
    <div className="p-5">
      {!rangeIncidents.length&&!rangeComplaints.length?<EmptyState title="No incidents or complaints in this range"/>:<>
        <MetricStrip className="mb-5" items={[
          {label:"Incidents",value:rangeIncidents.length},
          {label:"Near misses",value:nearMiss},
          {label:"Complaints",value:rangeComplaints.length},
        ]}/>
        <div className="flex flex-wrap gap-2">
          {Object.entries(bySeverity).map(([severity,count])=><div key={severity} className="flex items-center gap-2 border border-[var(--line)] px-3 py-1.5 text-xs"><Badge value={severity}/><span className="tabular font-semibold">{count}</span></div>)}
        </div>
      </>}
    </div>
  </Card>;
}

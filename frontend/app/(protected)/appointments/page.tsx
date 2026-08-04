"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {Ban,CalendarPlus,ChevronLeft,ChevronRight,Clock3,Edit3,ExternalLink,Search,UserCheck} from "lucide-react";
import {useApi} from "@/lib/hooks";
import {api} from "@/lib/api";
import {useAuth} from "@/lib/auth";
import {useI18n} from "@/lib/i18n";
import {useQuickCreate} from "@/lib/quick-create";
import {useSelectedPatient} from "@/lib/selected-patient";
import {hasPermission} from "@/lib/permissions";
import type {Appointment} from "@/lib/types";
import {apiDate,dateTime,dayNumber,localTime,monthYear,shortDate,weekdayShort} from "@/lib/utils";
import {PageHeader} from "@/components/ui/page-header";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {DataTable} from "@/components/ui/data-table";
import {ErrorMessage,Loading} from "@/components/ui/feedback";
import {Select} from "@/components/ui/select";
import {Modal} from "@/components/ui/modal";
import {Input} from "@/components/ui/input";
import {AppointmentForm} from "@/components/forms/appointment-form";

type Mode="day"|"week"|"month"|"list";
const statuses=["requested","scheduled","confirmed","checked_in","waiting","in_progress","completed","cancelled","no_show","rescheduled"];
const sameDay=(a:Date,b:Date)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const dayStart=(date:Date)=>new Date(date.getFullYear(),date.getMonth(),date.getDate());
const dateValue=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;

export default function Appointments(){
  const {user}=useAuth();
  const {t,label}=useI18n();
  const quick=useQuickCreate();
  const selectedPatient=useSelectedPatient();
  const {data,loading,error,reload}=useApi<Appointment[]>("/appointments");
  const [mode,setMode]=useState<Mode>("week");
  const [cursor,setCursor]=useState(()=>new Date());
  const [search,setSearch]=useState("");
  const [provider,setProvider]=useState("");
  const [room,setRoom]=useState("");
  const [statusFilter,setStatusFilter]=useState("");
  const [actionError,setActionError]=useState("");
  const [block,setBlock]=useState(false);
  const [active,setActive]=useState<Appointment|null>(null);
  const [editing,setEditing]=useState(false);
  const [editDirty,setEditDirty]=useState(false);
  useEffect(()=>{window.addEventListener("clinicflow:appointment-updated",reload);return()=>window.removeEventListener("clinicflow:appointment-updated",reload)},[reload]);
  const providers=useMemo(()=>[...new Map((data||[]).map(item=>[item.doctor.id,item.doctor])).values()],[data]);
  const rooms=useMemo(()=>[...new Set((data||[]).map(item=>item.room).filter(Boolean) as string[])].sort(),[data]);
  const rows=useMemo(()=>{
    if(!data)return[];
    const term=search.trim().toLocaleLowerCase();
    let filtered=data.filter(item=>(!provider||String(item.doctor_id)===provider)&&(!room||item.room===room)&&(!statusFilter||item.status===statusFilter)&&(!term||`${item.patient.full_name} ${item.patient.cpr_number||""} ${item.doctor.full_name} ${item.room||""} ${item.service.name}`.toLocaleLowerCase().includes(term)));
    if(mode==="list")return filtered;
    const start=dayStart(cursor);
    if(mode==="week")start.setDate(start.getDate()-start.getDay());
    if(mode==="month")start.setDate(1);
    const end=new Date(start);end.setDate(end.getDate()+(mode==="day"?1:mode==="week"?7:new Date(start.getFullYear(),start.getMonth()+1,0).getDate()));
    filtered=filtered.filter(item=>apiDate(item.start_time)>=start&&apiDate(item.start_time)<end);
    return filtered;
  },[data,cursor,mode,provider,room,statusFilter,search]);
  async function changeStatus(id:number,value:string){setActionError("");try{await api(`/appointments/${id}/status`,{method:"PATCH",body:JSON.stringify({status:value})});reload()}catch(caught){setActionError(caught instanceof Error?caught.message:t("errors.statusChange"))}}
  function shift(direction:number){setCursor(current=>{const next=new Date(current);if(mode==="month")next.setMonth(next.getMonth()+direction);else next.setDate(next.getDate()+direction*(mode==="week"?7:1));return next})}
  if(loading)return <Loading/>;
  const canBook=hasPermission(user,"appointments.manage_own")||hasPermission(user,"appointments.manage_all");
  const openSlot=(date:Date,hour:number)=>quick.openAppointment({date:dateValue(date),time:`${String(hour).padStart(2,"0")}:00`,doctorId:provider?Number(provider):undefined,room:room||undefined});
  return <>
    <PageHeader title={user?.role==="doctor"?t("appointments.doctorTitle"):t("appointments.title")} description={t("appointments.description")} actions={<>{user?.role==="doctor"&&<Button variant="secondary" onClick={()=>setBlock(true)}><Ban size={16}/>{t("appointments.blockTime")}</Button>}{canBook&&<Button onClick={()=>quick.openAppointment()}><CalendarPlus size={17}/>{t("appointments.new")}</Button>}</>}/>
    <ErrorMessage message={error||actionError}/>
    <Card>
      <div className="schedule-toolbar">
        <div className="schedule-toolbar__views" role="group" aria-label={t("appointments.viewLabel")}>{(["day","week","month","list"] as Mode[]).map(item=><button key={item} aria-pressed={mode===item} onClick={()=>setMode(item)}>{t(`appointments.${item}`)}</button>)}</div>
        {mode!=="list"&&<div className="schedule-toolbar__period"><Button aria-label={t("appointments.previousPeriod")} variant="secondary" className="min-h-9 px-2" onClick={()=>shift(-1)}><ChevronLeft className="directional-icon" size={17}/></Button><button className="min-w-40 px-2 text-sm font-semibold text-[var(--ink-700)]" onClick={()=>setCursor(new Date())}>{mode==="day"?shortDate(cursor.toISOString()):mode==="week"?t("appointments.weekOf",{date:shortDate(weekStart(cursor).toISOString())}):monthYear(cursor)}</button><Button aria-label={t("appointments.nextPeriod")} variant="secondary" className="min-h-9 px-2" onClick={()=>shift(1)}><ChevronRight className="directional-icon" size={17}/></Button></div>}
        <Button variant="ghost" className="min-h-9" onClick={()=>setCursor(new Date())}>{t("datePicker.today")}</Button>
      </div>
      <div className="schedule-filters" role="group" aria-label={t("appointments.filters")}>
        <label className="schedule-search"><span className="sr-only">{t("common.search")}</span><Search size={15}/><Input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder={t("appointments.searchPlaceholder")}/></label>
        <Select aria-label={t("appointments.providerFilter")} value={provider} onChange={event=>setProvider(event.target.value)}><option value="">{t("appointments.allProviders")}</option>{providers.map(item=><option value={item.id} key={item.id}>{item.full_name}</option>)}</Select>
        <Select aria-label={t("appointments.roomFilter")} value={room} onChange={event=>setRoom(event.target.value)}><option value="">{t("appointments.allRooms")}</option>{rooms.map(item=><option value={item} key={item}>{item}</option>)}</Select>
        <Select aria-label={t("appointments.statusFilter")} value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="">{t("appointments.allStatuses")}</option>{statuses.map(item=><option value={item} key={item}>{label(item)}</option>)}</Select>
      </div>
      {mode==="list"?<AppointmentTable rows={rows} status={changeStatus} open={setActive}/>:mode==="month"?<MonthCalendar cursor={cursor} rows={rows} open={setActive}/>:<CurrentCalendar cursor={cursor} rows={rows} mode={mode} open={setActive} openSlot={canBook?openSlot:undefined}/>}
    </Card>
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--ink-500)]"><span><strong className="text-[var(--ink-700)]">{t("appointments.keyboardSafe")}</strong> {t("appointments.listAvailable")}</span><span><strong className="text-[var(--ink-700)]">{t("appointments.times")}</strong> {t("appointments.localTimes")}</span></div>
    <Modal open={block} onClose={()=>setBlock(false)} title={t("appointments.blockSchedule")} size="max-w-lg"><BlockForm onCancel={()=>setBlock(false)} onSaved={()=>{setBlock(false);setActionError("")}}/></Modal>
    <Modal open={Boolean(active)} dirty={editDirty} onClose={()=>{setActive(null);setEditing(false)}} title={active?t("appointments.quickTitle",{id:active.id}):t("appointments.visitDetails")} description={active?dateTime(active.start_time):undefined} size={editing?"max-w-5xl":"max-w-xl"}>
      {active&&(editing?<div className="p-4 sm:p-5"><AppointmentForm appointment={active} onDirtyChange={setEditDirty} onCancel={()=>{setEditDirty(false);setEditing(false)}} onSaved={updated=>{setEditDirty(false);setActive(updated);setEditing(false);reload()}}/></div>:<QuickDetails appointment={active} onEdit={()=>setEditing(true)} onSelectPatient={()=>selectedPatient.selectPatient(active.patient)} onStatus={async value=>{await changeStatus(active.id,value);setActive(current=>current?{...current,status:value}:null)}}/>)}
    </Modal>
  </>;
}

function weekStart(date:Date){const result=dayStart(date);result.setDate(result.getDate()-result.getDay());return result}
function AppointmentTable({rows,status,open}:{rows:Appointment[];status:(id:number,value:string)=>void;open:(item:Appointment)=>void}){const {t,label}=useI18n();return <DataTable rows={rows} keyOf={item=>item.id} empty={t("appointments.noAppointments")} columns={[
  {key:"time",header:t("common.dateTime"),render:item=><button className="data-link text-start" onClick={()=>open(item)}>{dateTime(item.start_time)}</button>},
  {key:"patient",header:t("common.patient"),render:item=><Link className="data-link" href={`/patients/${item.patient.id}`}>{item.patient.full_name}</Link>},
  {key:"doctor",header:t("common.doctor"),render:item=>item.doctor.full_name},
  {key:"service",header:t("appointments.serviceRoom"),render:item=><div>{item.service.name}<p className="text-xs text-[var(--ink-500)]">{item.room||t("appointments.roomUnassigned")}</p></div>},
  {key:"reason",header:t("common.reason"),render:item=>item.reason},
  {key:"status",header:t("common.status"),render:item=><div className="flex items-center gap-2"><Badge value={item.status}/><Select aria-label={t("appointments.changeStatusFor",{name:item.patient.full_name})} className="h-8 w-32 text-xs" value={item.status} onChange={event=>status(item.id,event.target.value)}>{statuses.map(value=><option key={value} value={value}>{label(value)}</option>)}</Select></div>},
]}/>}

function CurrentCalendar({cursor,rows,mode,open,openSlot}:{cursor:Date;rows:Appointment[];mode:"day"|"week";open:(item:Appointment)=>void;openSlot?:((date:Date,hour:number)=>void)}){
  const {t}=useI18n();const start=mode==="week"?weekStart(cursor):dayStart(cursor);const days=Array.from({length:mode==="week"?7:1},(_,index)=>{const date=new Date(start);date.setDate(date.getDate()+index);return date});
  return <div className="scrollbar overflow-x-auto" tabIndex={0} role="region" aria-label={t("appointments.calendarRegion")}><div className="schedule-grid" style={{minWidth:mode==="week"?"980px":"620px",gridTemplateColumns:`84px repeat(${days.length},minmax(0,1fr))`}}>
    <div className="surface-muted border-b border-e border-[var(--line)] p-3 text-[10px] font-semibold uppercase text-[var(--ink-500)]">{t("appointments.time")}</div>
    {days.map(day=><div key={day.toISOString()} className={`border-b border-e border-[var(--line)] p-3 text-center ${sameDay(day,new Date())?"bg-[var(--teal-soft)]":"surface-muted"}`}><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-500)]">{weekdayShort(day)}</p><p className="mt-1 text-sm font-semibold text-[var(--ink-950)]">{dayNumber(day)}</p></div>)}
    {Array.from({length:12},(_,row)=>8+row).flatMap(hour=>[<div key={`time-${hour}`} className="surface-muted border-b border-e border-[var(--line)] p-2 text-end text-xs tabular text-[var(--ink-500)]">{String(hour).padStart(2,"0")}:00</div>,...days.map(day=>{const slot=rows.filter(item=>sameDay(apiDate(item.start_time),day)&&apiDate(item.start_time).getHours()===hour);return <div key={`${day.toISOString()}-${hour}`} className="schedule-slot">{slot.length?slot.map(item=><button type="button" onClick={()=>open(item)} key={item.id} className={`schedule-appointment schedule-appointment--${item.status}`}><span className="font-semibold tabular">{localTime(item.start_time)}</span><span className="ms-1">{item.patient.full_name}</span><span className="mt-0.5 block truncate text-[10px] opacity-75">{item.service.name} · {item.room||t("appointments.noRoom")}</span></button>):openSlot&&<button type="button" className="schedule-slot__empty" aria-label={t("appointments.createAt",{date:shortDate(day.toISOString()),time:`${String(hour).padStart(2,"0")}:00`})} onClick={()=>openSlot(day,hour)}><PlusSlot/></button>}</div>})])}
  </div></div>;
}
function PlusSlot(){return <span aria-hidden="true">+</span>}
function MonthCalendar({cursor,rows,open}:{cursor:Date;rows:Appointment[];open:(item:Appointment)=>void}){const first=new Date(cursor.getFullYear(),cursor.getMonth(),1);const gridStart=new Date(first);gridStart.setDate(first.getDate()-first.getDay());const days=Array.from({length:42},(_,index)=>{const date=new Date(gridStart);date.setDate(date.getDate()+index);return date});return <div className="grid min-w-[760px] grid-cols-7 overflow-x-auto">{days.slice(0,7).map(day=><div className="surface-muted border-b border-e border-[var(--line)] p-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-500)]" key={day.toISOString()}>{weekdayShort(day)}</div>)}{days.map(day=>{const items=rows.filter(item=>sameDay(apiDate(item.start_time),day));return <div className={`min-h-28 border-b border-e border-[var(--line)] p-2 ${day.getMonth()!==cursor.getMonth()?"surface-muted text-[var(--ink-500)]":""}`} key={day.toISOString()}><p className={`text-xs font-semibold ${sameDay(day,new Date())?"text-[var(--link)]":""}`}>{dayNumber(day)}</p><div className="mt-1 space-y-1">{items.slice(0,3).map(item=><button onClick={()=>open(item)} className="block w-full truncate border-s-2 border-[var(--gulf-teal)] bg-[var(--teal-soft)] px-1.5 py-1 text-start text-[10px] text-[var(--ink-700)]" key={item.id}>{localTime(item.start_time)} {item.patient.full_name}</button>)}{items.length>3&&<p className="text-[10px] font-semibold text-[var(--link)]">+{items.length-3}</p>}</div></div>})}</div>}

function QuickDetails({appointment,onEdit,onSelectPatient,onStatus}:{appointment:Appointment;onEdit:()=>void;onSelectPatient:()=>void;onStatus:(value:string)=>void}){const {t}=useI18n();return <div className="p-5"><div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-4"><div><button className="data-link text-base" onClick={onSelectPatient}>{appointment.patient.full_name}</button><p className="mt-1 text-xs text-[var(--ink-500)]" dir="ltr">{appointment.patient.patient_number} · {appointment.patient.cpr_number||t("patients.noCpr")}</p></div><Badge value={appointment.status}/></div><dl className="grid gap-4 py-5 text-sm sm:grid-cols-2"><Fact label={t("common.doctor")} value={appointment.doctor.full_name}/><Fact label={t("common.service")} value={appointment.service.name}/><Fact label={t("common.room")} value={appointment.room||t("common.unassigned")}/><Fact label={t("common.reason")} value={appointment.reason||t("common.none")}/></dl><div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-4"><Button variant="secondary" onClick={onEdit}><Edit3 size={15}/>{t("appointments.edit")}</Button>{["scheduled","confirmed"].includes(appointment.status)&&<Button variant="secondary" onClick={()=>onStatus("checked_in")}><UserCheck size={15}/>{t("appointments.checkIn")}</Button>}<Link className="button-base button-ghost" href={`/appointments/${appointment.id}`}><ExternalLink size={15}/>{t("appointments.openFull")}</Link></div></div>}
function Fact({label,value}:{label:string;value:string}){return <div><dt className="text-xs font-bold uppercase tracking-[.06em] text-[var(--ink-500)]">{label}</dt><dd className="mt-1 font-semibold text-[var(--ink-700)]">{value}</dd></div>}
function BlockForm({onCancel,onSaved}:{onCancel:()=>void;onSaved:()=>void}){const {t}=useI18n();const [form,setForm]=useState({start_time:"",end_time:"",kind:"blocked",reason:""});const [error,setError]=useState("");const [busy,setBusy]=useState(false);async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setError("");try{await api("/appointments/workflow/schedule-blocks",{method:"POST",body:JSON.stringify({...form,start_time:new Date(form.start_time).toISOString(),end_time:new Date(form.end_time).toISOString()})});onSaved()}catch(caught){setError(caught instanceof Error?caught.message:t("errors.blockTime"))}finally{setBusy(false)}}return <form className="space-y-4 p-5" onSubmit={submit}><ErrorMessage message={error}/><label className="block text-sm font-semibold">{t("common.type")}<Select className="mt-1.5" value={form.kind} onChange={event=>setForm({...form,kind:event.target.value})}><option value="blocked">{t("appointments.personalBlock")}</option><option value="leave">{t("appointments.leaveUnavailable")}</option><option value="break">{t("appointments.break")}</option></Select></label><label className="block text-sm font-semibold">{t("forms.start")}<Input className="mt-1.5" type="datetime-local" value={form.start_time} onChange={event=>setForm({...form,start_time:event.target.value})} required/></label><label className="block text-sm font-semibold">{t("forms.end")}<Input className="mt-1.5" type="datetime-local" value={form.end_time} onChange={event=>setForm({...form,end_time:event.target.value})} required/></label><label className="block text-sm font-semibold">{t("common.reason")}<Input className="mt-1.5" value={form.reason} onChange={event=>setForm({...form,reason:event.target.value})} required/></label><div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4"><Button type="button" variant="secondary" onClick={onCancel}>{t("common.cancel")}</Button><Button disabled={busy}><Clock3 size={16}/>{busy?t("common.saving"):t("appointments.blockTimeAction")}</Button></div></form>}

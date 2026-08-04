"use client";

import {useEffect,useId,useMemo,useRef,useState} from "react";
import {CalendarDays,ChevronLeft,ChevronRight} from "lucide-react";
import {useI18n} from "@/lib/i18n";

const atNoon=(value:string)=>new Date(`${value}T12:00:00`);
const valueOf=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const same=(a:Date,b:Date)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();

export function DatePicker({value,onChange,min,label,disabled}:{value:string;onChange:(value:string)=>void;min?:string;label:string;disabled?:boolean}){
  const {locale,t}=useI18n();
  const id=useId();
  const root=useRef<HTMLDivElement>(null);
  const selected=value?atNoon(value):null;
  const [open,setOpen]=useState(false);
  const [cursor,setCursor]=useState(()=>selected||new Date());
  useEffect(()=>{if(value)setCursor(atNoon(value))},[value]);
  useEffect(()=>{
    if(!open)return;
    const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};
    document.addEventListener("pointerdown",close);
    return()=>document.removeEventListener("pointerdown",close);
  },[open]);
  const days=useMemo(()=>{
    const first=new Date(cursor.getFullYear(),cursor.getMonth(),1,12);
    const start=new Date(first);start.setDate(1-first.getDay());
    return Array.from({length:42},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return date});
  },[cursor]);
  const weekdays=useMemo(()=>Array.from({length:7},(_,index)=>new Intl.DateTimeFormat(locale==="ar"?"ar-BH":"en-BH",{weekday:"narrow"}).format(new Date(2026,7,2+index))),[locale]);
  const formatter=new Intl.DateTimeFormat(locale==="ar"?"ar-BH":"en-BH",{dateStyle:"medium"});
  const monthFormatter=new Intl.DateTimeFormat(locale==="ar"?"ar-BH":"en-BH",{month:"long",year:"numeric"});
  const minDate=min?atNoon(min):null;
  return <div className="date-picker" ref={root}>
    <button id={id} type="button" disabled={disabled} className="control date-picker__trigger" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(current=>!current)}><CalendarDays size={16}/><span className={value?"":"text-[var(--ink-500)]"}>{selected?formatter.format(selected):t("datePicker.selectDate")}</span></button>
    {open&&<div role="dialog" aria-modal="false" aria-label={label} className="date-picker__popover" onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();setOpen(false)}}}>
      <div className="flex items-center justify-between border-b border-[var(--line)] p-2">
        <button type="button" className="date-picker__nav" aria-label={t("datePicker.previousMonth")} onClick={()=>setCursor(date=>new Date(date.getFullYear(),date.getMonth()-1,1))}><ChevronLeft className="directional-icon" size={17}/></button>
        <strong className="text-sm">{monthFormatter.format(cursor)}</strong>
        <button type="button" className="date-picker__nav" aria-label={t("datePicker.nextMonth")} onClick={()=>setCursor(date=>new Date(date.getFullYear(),date.getMonth()+1,1))}><ChevronRight className="directional-icon" size={17}/></button>
      </div>
      <div className="date-picker__grid px-2 pt-2" aria-hidden="true">{weekdays.map((day,index)=><span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="date-picker__grid p-2" role="grid">{days.map(day=>{
        const disabledDay=Boolean(minDate&&day<minDate);
        const isSelected=Boolean(selected&&same(selected,day));
        return <button type="button" role="gridcell" disabled={disabledDay} aria-selected={isSelected} className="date-picker__day" data-outside={day.getMonth()!==cursor.getMonth()} data-today={same(day,new Date())} key={day.toISOString()} onClick={()=>{onChange(valueOf(day));setOpen(false)}}>{new Intl.NumberFormat(locale==="ar"?"ar-BH":"en-BH").format(day.getDate())}</button>
      })}</div>
      <div className="border-t border-[var(--line)] p-2 text-end"><button type="button" className="px-2 py-1 text-xs font-bold text-[var(--link)]" onClick={()=>{const today=new Date();onChange(valueOf(today));setCursor(today);setOpen(false)}}>{t("datePicker.today")}</button></div>
    </div>}
  </div>;
}

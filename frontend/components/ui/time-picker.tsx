"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {ChevronDown,Clock3} from "lucide-react";
import {useI18n} from "@/lib/i18n";

function minutes(value:string){const [hour,minute]=value.split(":").map(Number);return hour*60+minute}
function timeValue(value:number){return `${String(Math.floor(value/60)).padStart(2,"0")}:${String(value%60).padStart(2,"0")}`}

export function TimePicker({value,onChange,label,workingHours,date,disabled}:{value:string;onChange:(value:string)=>void;label:string;workingHours?:Record<string,string>;date?:string;disabled?:boolean}){
  const {locale,t}=useI18n();
  const root=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false);
  useEffect(()=>{
    if(!open)return;
    const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};
    document.addEventListener("pointerdown",close);
    return()=>document.removeEventListener("pointerdown",close);
  },[open]);
  const options=useMemo(()=>{
    const day=date?new Intl.DateTimeFormat("en",{weekday:"long"}).format(new Date(`${date}T12:00:00`)).toLowerCase():"";
    const configured=workingHours?.[day]||"08:00–20:00";
    if(configured.toLowerCase().includes("closed"))return value?[value]:[];
    const found=configured.match(/(\d{1,2}:\d{2})\D+(\d{1,2}:\d{2})/);
    const start=found?minutes(found[1]):8*60,end=found?minutes(found[2]):20*60;
    const rows=[] as string[];
    for(let current=start;current<end;current+=15)rows.push(timeValue(current));
    if(value&&!rows.includes(value))rows.push(value);
    return rows.sort();
  },[workingHours,date,value]);
  const formatter=(time:string)=>new Intl.DateTimeFormat(locale==="ar"?"ar-BH":"en-BH",{hour:"2-digit",minute:"2-digit"}).format(new Date(`2026-01-01T${time}:00`));
  return <div className="time-picker" ref={root}>
    <button type="button" disabled={disabled} className="control time-picker__trigger" aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={()=>setOpen(current=>!current)}><Clock3 size={16}/><span className={value?"tabular":"text-[var(--ink-500)]"}>{value?formatter(value):t("timePicker.selectTime")}</span><ChevronDown className="ms-auto" size={16}/></button>
    {open&&<div className="time-picker__popover" role="listbox" aria-label={label} onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();setOpen(false)}}}>{options.length?<div className="grid max-h-64 grid-cols-3 gap-1 overflow-y-auto p-2">{options.map(time=><button type="button" role="option" aria-selected={time===value} className="time-picker__option tabular" key={time} onClick={()=>{onChange(time);setOpen(false)}}>{formatter(time)}</button>)}</div>:<p className="p-4 text-sm text-[var(--ink-500)]">{t("timePicker.closed")}</p>}</div>}
  </div>;
}

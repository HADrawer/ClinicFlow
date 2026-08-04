"use client";

import {useEffect,useId,useRef,useState} from "react";
import {Check,ChevronDown,Search} from "lucide-react";
import {Input} from "./input";
import {Loading} from "./feedback";
import {useI18n} from "@/lib/i18n";

type SearchComboboxProps<T>={
  value:T|null;
  onChange:(value:T)=>void;
  loadOptions:(query:string)=>Promise<T[]>;
  getKey:(option:T)=>string|number;
  getLabel:(option:T)=>string;
  renderOption:(option:T)=>React.ReactNode;
  placeholder:string;
  emptyText:string;
  action?:React.ReactNode;
  disabled?:boolean;
  required?:boolean;
  ariaLabel:string;
};

export function SearchCombobox<T>({value,onChange,loadOptions,getKey,getLabel,renderOption,placeholder,emptyText,action,disabled,required,ariaLabel}:SearchComboboxProps<T>){
  const {t}=useI18n();
  const listId=useId();
  const root=useRef<HTMLDivElement>(null);
  const [query,setQuery]=useState(value?getLabel(value):"");
  const [options,setOptions]=useState<T[]>([]);
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [active,setActive]=useState(0);

  useEffect(()=>{setQuery(value?getLabel(value):"")},[value,getLabel]);
  useEffect(()=>{
    if(!open||disabled)return;
    let current=true;
    const timer=window.setTimeout(async()=>{
      setLoading(true);
      try{const rows=await loadOptions(query.trim());if(current){setOptions(rows);setActive(0)}}finally{if(current)setLoading(false)}
    },query?280:0);
    return()=>{current=false;window.clearTimeout(timer)};
  },[query,open,disabled,loadOptions]);

  function choose(option:T){onChange(option);setQuery(getLabel(option));setOpen(false)}
  function onKeyDown(event:React.KeyboardEvent<HTMLInputElement>){
    if(event.key==="ArrowDown"){event.preventDefault();setOpen(true);setActive(index=>Math.min(options.length-1,index+1))}
    if(event.key==="ArrowUp"){event.preventDefault();setActive(index=>Math.max(0,index-1))}
    if(event.key==="Enter"&&open&&options[active]){event.preventDefault();choose(options[active])}
    if(event.key==="Escape"){event.preventDefault();setOpen(false);setQuery(value?getLabel(value):"")}
  }
  return <div ref={root} className="combobox">
    <div className="relative">
      <Search className="pointer-events-none absolute start-3 top-3 text-[var(--ink-500)]" size={16}/>
      <Input
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open&&options[active]?`${listId}-${getKey(options[active])}`:undefined}
        aria-required={required}
        disabled={disabled}
        value={query}
        placeholder={placeholder}
        className="ps-9 pe-9"
        onFocus={()=>setOpen(true)}
        onChange={event=>{setQuery(event.target.value);setOpen(true)}}
        onKeyDown={onKeyDown}
        onBlur={event=>{if(!root.current?.contains(event.relatedTarget as Node)){setOpen(false);setQuery(value?getLabel(value):"")}}}
      />
      <button type="button" tabIndex={-1} className="absolute end-1 top-1 grid h-8 w-8 place-items-center text-[var(--ink-500)]" onMouseDown={event=>event.preventDefault()} onClick={()=>setOpen(current=>!current)} aria-label={t("common.openOptions")}><ChevronDown size={16}/></button>
    </div>
    {open&&<div className="combobox__popover" id={listId} role="listbox" aria-label={ariaLabel}>
      {loading?<Loading label={t("common.searching")} />:options.length?<div className="max-h-72 overflow-y-auto py-1">{options.map((option,index)=>{
        const selected=value!==null&&getKey(value)===getKey(option);
        return <button
          type="button"
          role="option"
          aria-selected={selected}
          id={`${listId}-${getKey(option)}`}
          className={`combobox__option ${index===active?"combobox__option--active":""}`}
          key={getKey(option)}
          onMouseDown={event=>event.preventDefault()}
          onMouseEnter={()=>setActive(index)}
          onClick={()=>choose(option)}
        ><span className="min-w-0 flex-1">{renderOption(option)}</span>{selected&&<Check size={16} className="shrink-0 text-[var(--gulf-teal)]"/>}</button>})}</div>:<p className="px-4 py-5 text-center text-sm text-[var(--ink-500)]">{emptyText}</p>}
      {action&&<div className="border-t border-[var(--line)] p-2">{action}</div>}
    </div>}
  </div>;
}

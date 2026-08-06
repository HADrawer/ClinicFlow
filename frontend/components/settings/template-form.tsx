"use client";
import {useMemo,useRef,useState} from "react";
import {api} from "@/lib/api";
import {useApi} from "@/lib/hooks";
import {Button} from "@/components/ui/button";
import {Field,Input,Textarea} from "@/components/ui/input";
import {Select} from "@/components/ui/select";
import {ErrorMessage} from "@/components/ui/feedback";

export type Template={id:number;name:string;kind:string;language:string;body:string};

const SAMPLE_VALUES:Record<string,string>={
  patient_name:"Fatima Al-Sayed",
  doctor_name:"Dr. Ahmed Al-Khalifa",
  clinic_name:"ClinicFlow Medical Center",
  appointment_date:"2026-08-12",
  appointment_time:"10:30",
  service_name:"General consultation",
  invoice_number:"INV-2026-0142",
  amount:"25.000 BHD",
};

const TOKEN_RE=/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

function segments(body:string){
  const parts:{text:string;variable:boolean}[]=[];
  let last=0;
  for(const match of body.matchAll(TOKEN_RE)){
    if(match.index===undefined)continue;
    if(match.index>last)parts.push({text:body.slice(last,match.index),variable:false});
    parts.push({text:match[1],variable:true});
    last=match.index+match[0].length;
  }
  if(last<body.length)parts.push({text:body.slice(last),variable:false});
  return parts;
}

const KIND_OPTIONS=[
  {value:"reminder",label:"Appointment reminder"},
  {value:"no_show",label:"No-show follow-up"},
  {value:"prescription",label:"Prescription ready"},
  {value:"invoice",label:"Invoice / billing"},
  {value:"general",label:"General"},
];

export function TemplateForm({initial,editingId,onCancel,onSaved}:{initial?:Partial<Template>;editingId?:number;onCancel:()=>void;onSaved:()=>void}){
  const variables=useApi<Record<string,string>>("/settings/message-template-variables");
  const [name,setName]=useState(initial?.name||"");
  const [kind,setKind]=useState(initial?.kind||"reminder");
  const [language,setLanguage]=useState(initial?.language||"en");
  const [body,setBody]=useState(initial?.body||"");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const textareaRef=useRef<HTMLTextAreaElement>(null);
  const cursorRef=useRef({start:body.length,end:body.length});
  const [slash,setSlash]=useState<{index:number;query:string}|null>(null);
  const [slashActive,setSlashActive]=useState(0);

  const variableList=useMemo(()=>Object.entries(variables.data||{}),[variables.data]);
  const filteredSlash=useMemo(()=>{
    if(!slash)return [];
    const q=slash.query.toLowerCase();
    return variableList.filter(([key,label])=>key.includes(q)||label.toLowerCase().includes(q));
  },[slash,variableList]);

  function trackCursor(event:{currentTarget:HTMLTextAreaElement}){
    cursorRef.current={start:event.currentTarget.selectionStart,end:event.currentTarget.selectionEnd};
  }

  function insertAt(token:string,from:number,to:number){
    setBody(current=>current.slice(0,from)+token+current.slice(to));
    requestAnimationFrame(()=>{
      const el=textareaRef.current;
      if(!el)return;
      const pos=from+token.length;
      el.focus();
      el.setSelectionRange(pos,pos);
      cursorRef.current={start:pos,end:pos};
    });
  }

  function insertVariable(key:string){
    const token=`{{${key}}}`;
    if(slash){
      insertAt(token,slash.index,cursorRef.current.start);
      setSlash(null);
      return;
    }
    const {start,end}=cursorRef.current;
    insertAt(token,start,end);
  }

  function handleChange(event:React.ChangeEvent<HTMLTextAreaElement>){
    const value=event.target.value;
    setBody(value);
    const pos=event.target.selectionStart;
    cursorRef.current={start:pos,end:event.target.selectionEnd};
    const upToCursor=value.slice(0,pos);
    const match=/\/([a-zA-Z0-9_ ]*)$/.exec(upToCursor);
    setSlash(match?{index:pos-match[0].length,query:match[1]}:null);
    setSlashActive(0);
  }

  function handleKeyDown(event:React.KeyboardEvent<HTMLTextAreaElement>){
    if(!slash||!filteredSlash.length)return;
    if(event.key==="ArrowDown"){event.preventDefault();setSlashActive(i=>(i+1)%filteredSlash.length);}
    else if(event.key==="ArrowUp"){event.preventDefault();setSlashActive(i=>(i-1+filteredSlash.length)%filteredSlash.length);}
    else if(event.key==="Enter"){event.preventDefault();insertVariable(filteredSlash[slashActive][0]);}
    else if(event.key==="Escape"){setSlash(null);}
  }

  function handleDrop(event:React.DragEvent<HTMLTextAreaElement>){
    const key=event.dataTransfer.getData("text/clinicflow-variable");
    if(!key)return;
    event.preventDefault();
    const pos=event.currentTarget.selectionStart??body.length;
    insertAt(`{{${key}}}`,pos,pos);
  }

  const unsupported=useMemo(()=>{
    const known=new Set(Object.keys(variables.data||{}));
    const found=new Set<string>();
    for(const match of body.matchAll(TOKEN_RE))if(!known.has(match[1]))found.add(match[1]);
    return [...found];
  },[body,variables.data]);

  async function submit(event:React.FormEvent){
    event.preventDefault();
    if(unsupported.length)return;
    setBusy(true);setError("");
    try{
      const payload=JSON.stringify({name,kind,language,body});
      if(editingId)await api(`/settings/message-templates/${editingId}`,{method:"PUT",body:payload});
      else await api("/settings/message-templates",{method:"POST",body:payload});
      onSaved();
    }catch(e){setError(e instanceof Error?e.message:"Unable to save template")}
    finally{setBusy(false)}
  }

  return <form onSubmit={submit} className="space-y-4 p-5">
    <ErrorMessage message={error}/>
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Template name" required><Input value={name} onChange={e=>setName(e.target.value)} required/></Field>
      <Field label="Category">
        <Select value={kind} onChange={e=>setKind(e.target.value)}>
          {KIND_OPTIONS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
      </Field>
      <Field label="Language">
        <Select value={language} onChange={e=>setLanguage(e.target.value)}>
          <option value="en">English</option>
          <option value="ar">Arabic</option>
        </Select>
      </Field>
    </div>
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--ink-700)]">Message body</span>
        <span className="text-xs text-[var(--ink-500)]">Type &ldquo;/&rdquo; to search variables, click or drag one in</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {variableList.map(([key,label])=>
          <button key={key} type="button" draggable
            onDragStart={e=>e.dataTransfer.setData("text/clinicflow-variable",key)}
            onClick={()=>insertVariable(key)}
            title={label}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--line-strong)] bg-[var(--teal-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--link)] hover:bg-[var(--surface-secondary)]"
          >{`{{${key}}}`}</button>
        )}
      </div>
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={trackCursor}
          onClick={trackCursor}
          onDrop={handleDrop}
          onDragOver={e=>e.preventDefault()}
          rows={6}
          required
        />
        {slash&&filteredSlash.length>0&&<div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-[3px] border border-[var(--line-strong)] bg-[var(--surface)] shadow-lg">
          {filteredSlash.map(([key,label],i)=>
            <button key={key} type="button"
              className={`flex w-full flex-col items-start px-3 py-2 text-start text-sm ${i===slashActive?"bg-[var(--teal-soft)]":""}`}
              onMouseEnter={()=>setSlashActive(i)}
              onMouseDown={e=>{e.preventDefault();insertVariable(key)}}
            ><strong>{`{{${key}}}`}</strong><span className="text-xs text-[var(--ink-500)]">{label}</span></button>
          )}
        </div>}
      </div>
      {unsupported.length>0&&<p className="mt-1.5 text-xs font-semibold text-[var(--danger)]">Unsupported variables: {unsupported.join(", ")}</p>}
    </div>
    <div>
      <p className="mb-1.5 text-sm font-semibold text-[var(--ink-700)]">Preview with sample data</p>
      <div className="whitespace-pre-wrap rounded-[3px] border border-[var(--line)] bg-[var(--surface-secondary)] p-3 text-sm leading-6" dir={language==="ar"?"rtl":"ltr"}>
        {body?segments(body).map((segment,i)=>segment.variable
          ?<span key={i} className="rounded bg-[var(--teal-soft)] px-1 font-semibold text-[var(--link)]">{SAMPLE_VALUES[segment.text]??`{{${segment.text}}}`}</span>
          :<span key={i}>{segment.text}</span>
        ):<span className="text-[var(--ink-500)]">Nothing to preview yet.</span>}
      </div>
    </div>
    <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
      <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button disabled={busy||unsupported.length>0}>{busy?"Saving…":editingId?"Save template":"Create template"}</Button>
    </div>
  </form>;
}

"use client";
import {useEffect,useState} from "react";
import {ChevronDown,ChevronUp} from "lucide-react";
import {api} from "@/lib/api";
import {useApi} from "@/lib/hooks";
import {useAuth} from "@/lib/auth";
import type {Clinic} from "@/lib/types";
import {Button} from "@/components/ui/button";
import {Card,CardHeader} from "@/components/ui/card";
import {ErrorMessage} from "@/components/ui/feedback";
import {useI18n} from "@/lib/i18n";

type CatalogEntry={label:string;permissions:string[]};

export function QuickCreateSettings({clinic,onSaved}:{clinic:Clinic;onSaved:()=>void}){
  const {t}=useI18n();
  const {refresh}=useAuth();
  const catalog=useApi<Record<string,CatalogEntry>>("/clinics/me/quick-create-catalog");
  const [order,setOrder]=useState<string[]>(clinic.quick_create_actions);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [saved,setSaved]=useState(false);

  useEffect(()=>{setOrder(clinic.quick_create_actions)},[clinic.quick_create_actions]);

  const known=catalog.data||{};
  const enabled=order.filter(id=>id in known);
  const disabled=Object.keys(known).filter(id=>!order.includes(id));

  function toggle(id:string,on:boolean){
    setSaved(false);
    setOrder(current=>on?[...current,id]:current.filter(item=>item!==id));
  }
  function move(id:string,direction:-1|1){
    setSaved(false);
    setOrder(current=>{
      const index=current.indexOf(id);
      const target=index+direction;
      if(target<0||target>=current.length)return current;
      const next=[...current];
      [next[index],next[target]]=[next[target],next[index]];
      return next;
    });
  }

  async function save(){
    setBusy(true);setError("");setSaved(false);
    try{
      await api("/clinics/me/quick-create-config",{method:"PUT",body:JSON.stringify({actions:order})});
      await refresh();
      onSaved();
      setSaved(true);
    }catch(e){setError(e instanceof Error?e.message:"Unable to save Quick Create configuration")}
    finally{setBusy(false)}
  }

  if(catalog.loading)return null;

  return <Card>
    <CardHeader title={t("quickCreate.settingsTitle")} description={t("quickCreate.settingsDescription")}/>
    <div className="p-5">
      <ErrorMessage message={error||catalog.error}/>
      {saved&&<p role="status" className="mb-4 border-l-4 border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_8%,var(--surface))] px-4 py-2 text-sm text-[var(--success)]">Quick Create actions updated for everyone in this clinic.</p>}
      <p className="mb-2 text-xs font-bold uppercase tracking-[.08em] text-[var(--ink-500)]">Enabled, in display order</p>
      <div className="mb-4 space-y-2">
        {enabled.map((id,index)=><div key={id} className="flex items-center justify-between gap-3 border border-[var(--line)] p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{known[id]?.label||id}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button type="button" variant="secondary" className="h-8 px-2" disabled={index===0} onClick={()=>move(id,-1)} aria-label={`Move ${known[id]?.label||id} up`}><ChevronUp size={15}/></Button>
            <Button type="button" variant="secondary" className="h-8 px-2" disabled={index===enabled.length-1} onClick={()=>move(id,1)} aria-label={`Move ${known[id]?.label||id} down`}><ChevronDown size={15}/></Button>
            <Button type="button" variant="danger" className="h-8 px-2 text-xs" onClick={()=>toggle(id,false)}>Disable</Button>
          </div>
        </div>)}
        {!enabled.length&&<p className="text-sm text-[var(--ink-500)]">No Quick Create actions are enabled. Staff will see an empty Quick Create menu.</p>}
      </div>
      {disabled.length>0&&<>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.08em] text-[var(--ink-500)]">Available to enable</p>
        <div className="mb-4 space-y-2">
          {disabled.map(id=><div key={id} className="flex items-center justify-between gap-3 border border-dashed border-[var(--line)] p-3">
            <p className="text-sm font-medium text-[var(--ink-500)]">{known[id]?.label||id}</p>
            <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={()=>toggle(id,true)}>Enable</Button>
          </div>)}
        </div>
      </>}
      <div className="flex justify-end border-t border-[var(--line)] pt-4">
        <Button disabled={busy} onClick={save}>{busy?"Saving…":"Save Quick Create actions"}</Button>
      </div>
    </div>
  </Card>;
}

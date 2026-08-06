"use client";
import {PERMISSION_CATALOG,PERMISSION_LABELS} from "@/lib/permissions";

export function PermissionEditor({value,onChange,catalog=PERMISSION_CATALOG,description}:{value:string[];onChange:(next:string[])=>void;catalog?:Record<string,string[]>;description?:string}){
  const groups=Object.entries(catalog).filter(([,names])=>names.length>0);
  function toggle(name:string,checked:boolean){
    onChange(checked?[...new Set([...value,name])]:value.filter(item=>item!==name));
  }
  if(!groups.length)return <p className="text-sm text-[var(--ink-500)]">No additional permissions are available to grant.</p>;
  return <fieldset className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <legend className="mb-1 text-sm font-medium text-[var(--ink-700)]">Permissions</legend>
      <span className="text-xs font-semibold text-[var(--ink-500)]">{value.length} selected</span>
    </div>
    {description&&<p className="text-xs text-[var(--ink-500)]">{description}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map(([category,names])=><div className="border border-[var(--line)] p-3" key={category}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">{category}</p>
        <div className="space-y-1.5">
          {names.map(name=><label className="flex items-center gap-2 text-sm" key={name}>
            <input type="checkbox" checked={value.includes(name)} onChange={e=>toggle(name,e.target.checked)}/>
            {PERMISSION_LABELS[name]||name}
          </label>)}
        </div>
      </div>)}
    </div>
  </fieldset>;
}

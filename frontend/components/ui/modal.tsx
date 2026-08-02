"use client";

import {useEffect,useId,useRef} from "react";
import {X} from "lucide-react";
import {Button} from "./button";
import {translateEnglish,useI18n} from "@/lib/i18n";

export function Modal({open,onClose,title,children,size="max-w-2xl"}:{open:boolean;onClose:()=>void;title:string;children:React.ReactNode;size?:string}){
  const {locale,t}=useI18n();
  const titleId=useId();
  const panel=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement as HTMLElement|null;
    const key=(event:KeyboardEvent)=>{
      if(event.key==="Escape")onClose();
      if(event.key==="Tab"&&panel.current){
        const focusable=[...panel.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
        if(!focusable.length)return;
        const first=focusable[0],last=focusable.at(-1)!;
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener("keydown",key);
    requestAnimationFrame(()=>panel.current?.querySelector<HTMLElement>("button,input,select,textarea")?.focus());
    return()=>{document.removeEventListener("keydown",key);previous?.focus();};
  },[open,onClose]);

  if(!open)return null;
  return <div className="dialog-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" onMouseDown={onClose}>
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`dialog-panel max-h-[92vh] w-full ${size} overflow-y-auto outline-none`} onMouseDown={event=>event.stopPropagation()}>
      <div className="surface-header sticky top-0 z-10 flex items-center justify-between px-5 py-4">
        <h2 id={titleId} className="font-bold text-[var(--ink-950)]">{translateEnglish(title,locale)}</h2>
        <Button onClick={onClose} className="min-h-9 px-2.5" variant="ghost" aria-label={t("accessibility.closeDialog")}><X size={19}/></Button>
      </div>
      {children}
    </div>
  </div>;
}

export function ConfirmDialog({open,onClose,onConfirm,title,description,busy}:{open:boolean;onClose:()=>void;onConfirm:()=>void;title:string;description:string;busy?:boolean}){
  const {t}=useI18n();
  return <Modal open={open} onClose={onClose} title={title} size="max-w-md">
    <div className="p-5">
      <p className="text-sm leading-6 text-[var(--ink-700)]">{description}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="danger" disabled={busy} onClick={onConfirm}>{busy?t("common.working"):t("common.confirm")}</Button>
      </div>
    </div>
  </Modal>;
}

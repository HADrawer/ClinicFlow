"use client";

import {useCallback,useEffect,useId,useRef} from "react";
import {X} from "lucide-react";
import {Button} from "./button";
import {translateEnglish,useI18n} from "@/lib/i18n";

type ModalProps={
  open:boolean;
  onClose:()=>void;
  title:string;
  description?:string;
  children:React.ReactNode;
  size?:string;
  dirty?:boolean;
  kind?:"dialog"|"sheet";
};

export function Modal({open,onClose,title,description,children,size="max-w-2xl",dirty=false,kind="dialog"}:ModalProps){
  const {locale,t}=useI18n();
  const titleId=useId();
  const descriptionId=useId();
  const panel=useRef<HTMLDivElement>(null);
  const requestClose=useCallback(()=>{
    if(dirty&&!window.confirm(t("common.discardChanges")))return;
    onClose();
  },[dirty,onClose,t]);

  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const key=(event:KeyboardEvent)=>{
      const dialogs=[...document.querySelectorAll<HTMLElement>("[data-workspace-dialog]")];
      if(panel.current!==dialogs.at(-1))return;
      if(event.key==="Escape")requestClose();
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
    return()=>{document.removeEventListener("keydown",key);document.body.style.overflow=overflow;previous?.focus();};
  },[open,requestClose]);

  if(!open)return null;
  return <div className={`dialog-backdrop fixed inset-0 z-50 flex ${kind==="sheet"?"items-stretch justify-end":"items-center justify-center"} p-0 sm:p-4`} onMouseDown={requestClose}>
    <div data-workspace-dialog ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description?descriptionId:undefined} className={`dialog-panel dialog-panel--${kind} max-h-[100dvh] w-full ${size} overflow-y-auto outline-none sm:max-h-[92vh]`} onMouseDown={event=>event.stopPropagation()}>
      <div className="surface-header sticky top-0 z-20 flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="font-bold text-[var(--ink-950)]">{translateEnglish(title,locale)}</h2>
          {description&&<p id={descriptionId} className="mt-1 text-xs leading-5 text-[var(--ink-500)]">{translateEnglish(description,locale)}</p>}
        </div>
        <Button onClick={requestClose} className="min-h-9 shrink-0 px-2.5" variant="ghost" aria-label={t("accessibility.closeDialog")}><X size={19}/></Button>
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

"use client";
import {InputHTMLAttributes,TextareaHTMLAttributes} from "react";import {cn} from "@/lib/utils";
import {translateEnglish,useI18n} from "@/lib/i18n";
export function Input({className,...props}:InputHTMLAttributes<HTMLInputElement>){return <input className={cn("control h-10 w-full px-3 text-sm outline-none",className)} {...props}/>}
export function Textarea({className,...props}:TextareaHTMLAttributes<HTMLTextAreaElement>){return <textarea className={cn("control min-h-24 w-full px-3 py-2 text-sm outline-none",className)} {...props}/>}
export function Field({label,required,children,hint}:{label:string;required?:boolean;children:React.ReactNode;hint?:string}){const {locale}=useI18n();return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-[var(--ink-700)]">{translateEnglish(label,locale)}{required&&<span className="text-[var(--danger)]" aria-hidden="true"> *</span>}</span>{children}{hint&&<span className="mt-1.5 block text-xs leading-5 text-[var(--ink-500)]">{translateEnglish(hint,locale)}</span>}</label>}

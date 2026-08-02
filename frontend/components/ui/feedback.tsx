"use client";
import {translateEnglish,useI18n} from "@/lib/i18n";
export function ErrorMessage({message}:{message?:string}){const {locale}=useI18n();return message?<div role="alert" className="alert alert-danger">{translateEnglish(message,locale)}</div>:null}
export function Loading({label="Loading clinic data…"}:{label?:string}){const {locale}=useI18n();return <div role="status" aria-live="polite" className="flex min-h-64 items-center justify-center text-sm text-[var(--ink-500)]"><span className="me-3 h-5 w-5 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-[var(--gulf-teal)]"/>{translateEnglish(label,locale)}</div>}

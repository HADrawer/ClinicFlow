"use client";
import {translateEnglish,useI18n} from "@/lib/i18n";
export function ErrorMessage({message}:{message?:string}){const {locale}=useI18n();return message?<div role="alert" className="safety-stripe rounded-[4px] border border-[#e6c2bd] bg-[#fff4f2] px-4 py-3 text-sm text-[#963a35]">{translateEnglish(message,locale)}</div>:null}
export function Loading({label="Loading clinic data…"}:{label?:string}){const {locale}=useI18n();return <div role="status" aria-live="polite" className="flex min-h-64 items-center justify-center text-sm text-[#52656e]"><span className="me-3 h-5 w-5 animate-spin rounded-full border-2 border-[#c4d3cf] border-t-[#167d78]"/>{translateEnglish(label,locale)}</div>}

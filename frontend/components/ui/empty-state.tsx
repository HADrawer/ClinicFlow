"use client";
import {Inbox} from "lucide-react";
import {translateEnglish,useI18n} from "@/lib/i18n";
export function EmptyState({title="Nothing here yet",description,action}:{title?:string;description?:string;action?:React.ReactNode}){const {locale}=useI18n();return <div className="flex min-h-48 flex-col items-center justify-center px-6 py-12 text-center"><div className="empty-state__icon mb-3"><Inbox size={20}/></div><h3 className="font-semibold text-[var(--ink-950)]">{translateEnglish(title,locale)}</h3>{description&&<p className="mt-1 max-w-sm text-sm text-[var(--ink-500)]">{translateEnglish(description,locale)}</p>}{action&&<div className="mt-4">{action}</div>}</div>}

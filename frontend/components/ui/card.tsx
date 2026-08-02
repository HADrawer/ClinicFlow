"use client";
import {HTMLAttributes} from "react";import {cn} from "@/lib/utils";
import {translateEnglish,useI18n} from "@/lib/i18n";
export function Card({className,...props}:HTMLAttributes<HTMLDivElement>){return <div className={cn("surface-panel min-w-0 overflow-hidden",className)} {...props}/>}
export function CardHeader({title,description,action}:{title:string;description?:string;action?:React.ReactNode}){const {locale}=useI18n();return <div className="surface-header flex min-w-0 flex-col items-start justify-between gap-2 px-5 py-4 sm:flex-row sm:gap-4"><div className="min-w-0 flex-1"><h2 className="font-bold text-[var(--ink-950)]">{translateEnglish(title,locale)}</h2>{description&&<p className="mt-0.5 text-sm leading-5 text-[var(--ink-500)]">{translateEnglish(description,locale)}</p>}</div>{action&&<div className="shrink-0">{action}</div>}</div>}

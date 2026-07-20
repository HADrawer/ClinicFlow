"use client";
import {HTMLAttributes} from "react";import {cn} from "@/lib/utils";
import {translateEnglish,useI18n} from "@/lib/i18n";
export function Card({className,...props}:HTMLAttributes<HTMLDivElement>){return <div className={cn("min-w-0 overflow-hidden rounded-[6px] border border-[#d6e1de] bg-white shadow-[0_1px_2px_rgba(16,33,43,.04)]",className)} {...props}/>}
export function CardHeader({title,description,action}:{title:string;description?:string;action?:React.ReactNode}){const {locale}=useI18n();return <div className="flex min-w-0 flex-col items-start justify-between gap-2 border-b border-[#dce6e3] px-5 py-4 sm:flex-row sm:gap-4"><div className="min-w-0 flex-1"><h2 className="font-semibold text-[#10212b]">{translateEnglish(title,locale)}</h2>{description&&<p className="mt-0.5 text-sm text-[#52656e]">{translateEnglish(description,locale)}</p>}</div>{action&&<div className="shrink-0">{action}</div>}</div>}

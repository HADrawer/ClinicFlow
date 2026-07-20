"use client";
import {ButtonHTMLAttributes} from "react";import {cn} from "@/lib/utils";
import {translateEnglish,useI18n} from "@/lib/i18n";
const styles={primary:"bg-[#167d78] text-white border-[#167d78] hover:bg-[#0f625f]",secondary:"bg-white text-[#314854] border-[#b9cbc6] hover:bg-[#f5f7f6]",danger:"bg-white text-[#a33737] border-[#d9aaa3] hover:bg-[#fff2f0]",ghost:"bg-transparent text-[#526973] border-transparent hover:bg-[#eaf1ef]"};
export function Button({className,variant="primary",children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:keyof typeof styles}){const {locale}=useI18n();const content=typeof children==="string"?translateEnglish(children,locale):children;return <button className={cn("inline-flex min-h-10 items-center justify-center gap-2 rounded-[4px] border px-4 py-2 text-sm font-semibold shadow-[0_1px_0_rgba(16,33,43,.04)] disabled:pointer-events-none disabled:opacity-50",styles[variant],className)} {...props}>{content}</button>}

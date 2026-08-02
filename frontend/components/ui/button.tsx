"use client";
import {ButtonHTMLAttributes} from "react";import {cn} from "@/lib/utils";
import {translateEnglish,useI18n} from "@/lib/i18n";
const styles={primary:"button-primary",secondary:"button-secondary",danger:"button-danger",ghost:"button-ghost"};
export function Button({className,variant="primary",children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:keyof typeof styles}){const {locale}=useI18n();const content=typeof children==="string"?translateEnglish(children,locale):children;return <button className={cn("button-base",styles[variant],className)} {...props}>{content}</button>}

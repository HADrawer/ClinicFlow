"use client";

import type {CSSProperties,ReactNode} from "react";
import {translateEnglish,useI18n} from "@/lib/i18n";
import {cn} from "@/lib/utils";

export type Metric={label:string;value:ReactNode;tone?:"default"|"warning"|"danger"};

export function MetricStrip({items,label="Current measures",className}:{items:Metric[];label?:string;className?:string}){
  const {locale}=useI18n();
  return <section aria-label={translateEnglish(label,locale)} className={cn("metric-strip",className)} style={{"--metric-count":Math.min(items.length,5)} as CSSProperties}>{items.map((item,index)=><div className={cn("metric-strip__item",index===0&&"metric-strip__item--current",item.tone&&item.tone!=="default"&&`metric-strip__item--${item.tone}`)} key={item.label}><p className="metric-strip__label">{translateEnglish(item.label,locale)}</p><div className="metric-strip__value">{item.value}</div></div>)}</section>;
}

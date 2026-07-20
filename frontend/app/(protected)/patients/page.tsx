"use client";

import Link from "next/link";
import {useState} from "react";
import {Search,UserPlus} from "lucide-react";
import {useApi} from "@/lib/hooks";
import {useI18n} from "@/lib/i18n";
import type {Patient} from "@/lib/types";
import {shortDate} from "@/lib/utils";
import {PageHeader} from "@/components/ui/page-header";
import {Card} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {DataTable} from "@/components/ui/data-table";
import {ErrorMessage,Loading} from "@/components/ui/feedback";

export default function Patients(){
  const {t}=useI18n();
  const [search,setSearch]=useState("");
  const {data,loading,error}=useApi<Patient[]>(`/patients?search=${encodeURIComponent(search)}`);

  return <>
    <PageHeader
      title={t("patients.title")}
      description={t("patients.description")}
      actions={<Link href="/patients/new" className="inline-flex h-10 items-center gap-2 rounded-[4px] bg-[#167d78] px-4 text-sm font-semibold text-white hover:bg-[#0f625f]"><UserPlus size={17}/>{t("patients.register")}</Link>}
    />
    <Card>
      <div className="border-b border-[#d6e1de] bg-[#f8faf9] p-4">
        <label className="block max-w-md">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[.08em] text-[#52656e]">{t("patients.searchLabel")}</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute start-3 top-2.5 text-[#6f838b]" size={18}/>
            <Input className="ps-10" type="search" placeholder={t("patients.searchPlaceholder")} value={search} onChange={event=>setSearch(event.target.value)}/>
          </span>
        </label>
      </div>
      {loading?<Loading/>:error?<div className="p-4"><ErrorMessage message={error}/></div>:<DataTable
        rows={data||[]}
        keyOf={patient=>patient.id}
        empty={search?t("patients.noMatches"):t("patients.empty")}
        columns={[
          {key:"name",header:t("common.patient"),render:patient=><div><Link href={`/patients/${patient.id}`} className="font-semibold text-[#164e67] hover:underline">{patient.full_name}</Link><p className="mt-0.5 text-xs text-[#52656e]" dir="ltr">{patient.phone}</p></div>},
          {key:"cpr",header:t("patients.cpr"),render:patient=><span className="tabular" dir="ltr">{patient.cpr_number||"—"}</span>},
          {key:"dob",header:t("patients.dateOfBirth"),render:patient=>patient.date_of_birth?shortDate(patient.date_of_birth):"—"},
          {key:"nationality",header:t("forms.nationality"),render:patient=>patient.nationality||"—"},
          {key:"warnings",header:t("patients.medicalWarnings"),render:patient=><div className="flex flex-col gap-1">{patient.allergies&&<span className="safety-stripe bg-[#fff4f2] px-2 py-1 text-xs font-semibold text-[#963a35]">{t("patients.allergyWarningLabel")} {patient.allergies}</span>}{patient.chronic_conditions&&<span className="border-s-2 border-[#c58a2d] bg-[#fff8e9] px-2 py-1 text-xs font-medium text-[#805410]">{patient.chronic_conditions}</span>}{!patient.allergies&&!patient.chronic_conditions&&<span className="text-[#6f838b]">{t("common.none")}</span>}</div>},
          {key:"created",header:t("common.registered"),render:patient=>shortDate(patient.created_at)},
        ]}
      />}
    </Card>
  </>;
}

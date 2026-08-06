"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {CheckCircle2,Search,UserPlus} from "lucide-react";
import {useApi} from "@/lib/hooks";
import {useI18n} from "@/lib/i18n";
import {useAuth} from "@/lib/auth";
import {useQuickCreate} from "@/lib/quick-create";
import {useSelectedPatient} from "@/lib/selected-patient";
import {hasPermission} from "@/lib/permissions";
import type {Patient} from "@/lib/types";
import {shortDate} from "@/lib/utils";
import {PageHeader} from "@/components/ui/page-header";
import {Card} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {DataTable} from "@/components/ui/data-table";
import {ErrorMessage,Loading} from "@/components/ui/feedback";

export default function Patients(){
  const {t}=useI18n();
  const {user}=useAuth();
  const quick=useQuickCreate();
  const selected=useSelectedPatient();
  const [search,setSearch]=useState("");
  const [debounced,setDebounced]=useState("");
  useEffect(()=>{const timer=window.setTimeout(()=>setDebounced(search.trim()),300);return()=>window.clearTimeout(timer)},[search]);
  const {data,loading,error,reload}=useApi<Patient[]>(`/patients?search=${encodeURIComponent(debounced)}`);
  useEffect(()=>{window.addEventListener("clinicflow:patient-updated",reload);return()=>window.removeEventListener("clinicflow:patient-updated",reload)},[reload]);

  return <>
    <PageHeader
      title={t("patients.title")}
      description={t("patients.description")}
      actions={hasPermission(user,"patients.create")?<Button onClick={quick.openPatient}><UserPlus size={17}/>{t("patients.register")}</Button>:undefined}
    />
    <Card>
      <div className="surface-muted border-b border-[var(--line)] p-4">
        <label className="block max-w-lg">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[.08em] text-[var(--ink-500)]">{t("patients.searchLabel")}</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute start-3 top-2.5 text-[var(--ink-500)]" size={18}/>
            <Input className="ps-10" type="search" placeholder={t("patients.searchPlaceholder")} value={search} onChange={event=>setSearch(event.target.value)}/>
          </span>
        </label>
      </div>
      {loading?<Loading/>:error?<div className="p-4"><ErrorMessage message={error}/></div>:<DataTable
        rows={data||[]}
        keyOf={patient=>patient.id}
        empty={debounced?t("patients.noMatches"):t("patients.empty")}
        columns={[
          {key:"name",header:t("common.patient"),render:patient=><div><Link href={`/patients/${patient.id}`} className="data-link">{patient.full_name}</Link><p className="mt-0.5 text-xs text-[var(--ink-500)]" dir="ltr">{patient.phone}</p></div>},
          {key:"file",header:t("patients.fileNumber"),render:patient=><span className="tabular" dir="ltr">{patient.patient_number||"—"}</span>},
          {key:"cpr",header:t("patients.cpr"),render:patient=><span className="tabular" dir="ltr">{patient.cpr_number||"—"}</span>},
          {key:"dob",header:t("patients.dateOfBirth"),render:patient=>patient.date_of_birth?shortDate(patient.date_of_birth):"—"},
          {key:"warnings",header:t("patients.medicalWarnings"),render:patient=><div className="flex flex-col gap-1">{patient.allergies&&<span className="safety-stripe bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface))] px-2 py-1 text-xs font-semibold text-[var(--danger)]">{t("patients.allergyWarningLabel")} {patient.allergies}</span>}{patient.chronic_conditions&&<span className="border-s-2 border-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_8%,var(--surface))] px-2 py-1 text-xs font-medium text-[var(--warning)]">{patient.chronic_conditions}</span>}{!patient.allergies&&!patient.chronic_conditions&&<span className="text-[var(--ink-500)]">{t("common.none")}</span>}</div>},
          {key:"context",header:t("patientContext.title"),render:patient=><Button className="min-h-8 px-2 text-xs" variant={selected.detail?.patient.id===patient.id?"primary":"secondary"} onClick={()=>selected.selectPatient(patient)}><CheckCircle2 size={14}/>{selected.detail?.patient.id===patient.id?t("patientContext.selected"):t("patientContext.keep")}</Button>},
        ]}
      />}
    </Card>
  </>;
}

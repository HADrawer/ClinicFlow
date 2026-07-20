"use client";

import Link from "next/link";
import {FormEvent,useState} from "react";
import {useAuth} from "@/lib/auth";
import {useI18n} from "@/lib/i18n";
import {Button} from "@/components/ui/button";
import {Field,Input} from "@/components/ui/input";
import {ErrorMessage} from "@/components/ui/feedback";

export default function Register(){
  const {register}=useAuth();
  const {t}=useI18n();
  const [data,setData]=useState({clinic_name:"",full_name:"",email:"",phone:"+973 ",password:""});
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const set=(key:string,value:string)=>setData(current=>({...current,[key]:value}));

  async function submit(event:FormEvent){
    event.preventDefault();
    setBusy(true);
    setError("");
    try{await register(data)}catch(error){setError(error instanceof Error?error.message:t("errors.generic"));setBusy(false)}
  }

  return <div className="w-full max-w-lg">
    <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#167d78]">{t("app.clinicalCurrent")}</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-[-.03em] text-[#10212b]">{t("auth.createWorkspace")}</h1>
    <p className="mt-2 text-sm text-[#52656e]">{t("auth.createWorkspaceDescription")}</p>
    <form onSubmit={submit} className="mt-7 grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><ErrorMessage message={error}/></div>
      <div className="sm:col-span-2"><Field label={t("auth.clinicName")} required><Input autoFocus value={data.clinic_name} onChange={event=>set("clinic_name",event.target.value)} required/></Field></div>
      <Field label={t("auth.ownerName")} required><Input value={data.full_name} onChange={event=>set("full_name",event.target.value)} required/></Field>
      <Field label={t("auth.clinicPhone")} required><Input dir="ltr" type="tel" value={data.phone} onChange={event=>set("phone",event.target.value)} required/></Field>
      <div className="sm:col-span-2"><Field label={t("auth.workEmail")} required><Input dir="ltr" type="email" autoComplete="email" value={data.email} onChange={event=>set("email",event.target.value)} required/></Field></div>
      <div className="sm:col-span-2"><Field label={t("auth.password")} required hint={t("forms.eightCharacters")}><Input type="password" autoComplete="new-password" minLength={8} value={data.password} onChange={event=>set("password",event.target.value)} required/></Field></div>
      <div className="sm:col-span-2"><Button className="w-full" disabled={busy}>{busy?t("auth.creatingWorkspace"):t("auth.createWorkspaceAction")}</Button></div>
    </form>
    <p className="mt-5 text-center text-sm text-[#52656e]">{t("auth.alreadyRegistered")} <Link className="font-semibold text-[#0f625f] hover:underline" href="/login">{t("auth.signIn")}</Link></p>
  </div>;
}

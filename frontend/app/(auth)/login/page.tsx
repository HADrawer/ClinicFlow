"use client";

import Link from "next/link";
import {FormEvent,useState} from "react";
import {useAuth} from "@/lib/auth";
import {useI18n} from "@/lib/i18n";
import {Button} from "@/components/ui/button";
import {Field,Input} from "@/components/ui/input";
import {ErrorMessage} from "@/components/ui/feedback";

export default function Login(){
  const {login}=useAuth();
  const {t}=useI18n();
  const [email,setEmail]=useState("owner@clinicflow.test");
  const [password,setPassword]=useState("password123");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  async function submit(event:FormEvent){
    event.preventDefault();
    setBusy(true);
    setError("");
    try{await login(email,password)}catch(error){setError(error instanceof Error?error.message:t("errors.generic"));setBusy(false)}
  }

  return <div className="w-full max-w-md">
    <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#167d78]">{t("auth.secureAccess")}</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-[-.03em] text-[#10212b]">{t("auth.loginTitle")}</h1>
    <p className="mt-2 text-sm text-[#52656e]">{t("auth.loginDescription")}</p>
    <form onSubmit={submit} className="mt-8 space-y-5">
      <ErrorMessage message={error}/>
      <Field label={t("auth.email")} required><Input dir="ltr" type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} required/></Field>
      <div>
        <Field label={t("auth.password")} required><Input type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required/></Field>
        <div className="mt-2 text-end"><Link className="text-xs font-semibold text-[#0f625f] hover:underline" href="/forgot-password">{t("auth.forgotPassword")}</Link></div>
      </div>
      <Button className="w-full" disabled={busy}>{busy?t("auth.signingIn"):t("auth.signIn")}</Button>
    </form>
    <div className="mt-6 border-s-4 border-[#167d78] bg-[#f1f7f5] p-4 text-xs leading-5 text-[#526973]">
      <strong className="text-[#314854]">{t("auth.demoOwner")}</strong><br/><span dir="ltr">owner@clinicflow.test · password123</span>
    </div>
    <p className="mt-6 text-center text-sm text-[#52656e]">{t("auth.openingClinic")} <Link className="font-semibold text-[#0f625f] hover:underline" href="/register">{t("auth.createWorkspaceLink")}</Link></p>
  </div>;
}

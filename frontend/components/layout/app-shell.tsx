"use client";

import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {useEffect,useMemo,useState} from "react";
import {
  Activity,CalendarDays,CalendarPlus,ChevronDown,ClipboardList,Clock3,CreditCard,
  FileChartColumn,FlaskConical,LayoutDashboard,ListPlus,LogOut,Menu,
  MessageCircle,Pill,Plus,Settings,ShieldCheck,Stethoscope,UserPlus,Users,UsersRound,X,
} from "lucide-react";
import {useAuth} from "@/lib/auth";
import {cn,titleCase} from "@/lib/utils";
import type {Role} from "@/lib/types";
import {Loading} from "@/components/ui/feedback";
import {LanguageSwitcher,useI18n} from "@/lib/i18n";
import {ThemeSwitcher} from "@/lib/theme";
import {hasAnyPermission,hasPermission} from "@/lib/permissions";
import {useQuickCreate} from "@/lib/quick-create";
import {useSelectedPatient} from "@/lib/selected-patient";
import {PatientContextRail} from "./patient-context";

type NavItem={href:string;labelKey:string;icon:typeof Activity;roles:Role[];permissions?:string[];pharmacy?:boolean};
const groups:{labelKey:string;items:NavItem[]}[]=[
  {labelKey:"navigation.current",items:[
    {href:"/dashboard",labelKey:"navigation.dashboard",icon:LayoutDashboard,roles:["owner","doctor","receptionist","accountant","nurse","pharmacist"]},
    {href:"/appointments",labelKey:"navigation.appointments",icon:CalendarDays,roles:["owner","doctor","receptionist","nurse"],permissions:["appointments.read_own","appointments.read_all","appointments.manage_own","appointments.manage_all"]},
    {href:"/queue",labelKey:"navigation.queue",icon:Clock3,roles:["owner","doctor","receptionist","nurse"],permissions:["queue.manage"]},
    {href:"/waitlist",labelKey:"navigation.waitlist",icon:ListPlus,roles:["owner","doctor","receptionist"],permissions:["waitlist.manage"]},
  ]},
  {labelKey:"navigation.clinical",items:[
    {href:"/patients",labelKey:"navigation.patients",icon:Users,roles:["owner","doctor","receptionist","nurse"],permissions:["patients.read"]},
    {href:"/orders",labelKey:"navigation.orders",icon:FlaskConical,roles:["owner","doctor","nurse"],permissions:["orders.manage"]},
    {href:"/messages",labelKey:"navigation.messages",icon:MessageCircle,roles:["owner","doctor","receptionist"],permissions:["messages.create"]},
  ]},
  {labelKey:"navigation.operations",items:[
    {href:"/billing",labelKey:"navigation.billing",icon:CreditCard,roles:["owner","receptionist","accountant"],permissions:["billing.create"]},
    {href:"/insurance",labelKey:"navigation.insurance",icon:ShieldCheck,roles:["owner","accountant"],permissions:["claims.manage"]},
    {href:"/pharmacy",labelKey:"navigation.pharmacy",icon:Pill,roles:["owner","pharmacist"],permissions:["pharmacy.read","pharmacy.dispense","pharmacy.inventory_manage"],pharmacy:true},
    {href:"/staff",labelKey:"navigation.staff",icon:UsersRound,roles:["owner"],permissions:["staff.manage"]},
    {href:"/quality",labelKey:"navigation.quality",icon:ClipboardList,roles:["owner","receptionist","nurse"],permissions:["quality.manage"]},
    {href:"/reports",labelKey:"navigation.reports",icon:FileChartColumn,roles:["owner","accountant","pharmacist"],permissions:["reports.view"]},
    {href:"/settings",labelKey:"navigation.settings",icon:Settings,roles:["owner"]},
  ]},
];

const roleContext:Record<Role,string>={
  owner:"role.ownerContext",doctor:"role.doctorContext",receptionist:"role.receptionContext",
  accountant:"role.accountantContext",nurse:"role.nurseContext",pharmacist:"role.pharmacistContext",
};

export function AppShell({children}:{children:React.ReactNode}){
  const {user,loading,logout}=useAuth();
  const {t,label,isRtl}=useI18n();
  const path=usePathname();
  const router=useRouter();
  const quickCreate=useQuickCreate();
  const selected=useSelectedPatient();
  const [mobile,setMobile]=useState(false);
  const [profile,setProfile]=useState(false);
  const [quick,setQuick]=useState(false);

  useEffect(()=>{if(!loading&&!user)router.replace("/login")},[loading,user,router]);
  useEffect(()=>{setMobile(false);setProfile(false);setQuick(false)},[path]);
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setQuick(false)};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[]);
  const visible=useMemo(()=>groups
    .map(group=>({...group,items:group.items.filter(item=>user&&(item.roles.includes(user.role)||Boolean(item.permissions&&hasAnyPermission(user,item.permissions)))&&(!item.pharmacy||user.clinic?.pharmacy_enabled))}))
    .filter(group=>group.items.length),[user]);

  if(loading||!user)return <div className="min-h-screen bg-[var(--canvas)]"><Loading label={t("common.openingClinicFlow")}/></div>;
  const initials=user.full_name.split(" ").map(part=>part[0]).slice(0,2).join("");

  return <div className="app-frame">
    <header className="app-topbar lg:ps-[280px] lg:pe-6">
      <button className="desktop-hidden topbar-button me-2 lg:hidden" onClick={()=>setMobile(true)} aria-label={t("accessibility.openNavigation")}><Menu size={20}/></button>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-bold text-[var(--clinical-navy)]">{user.clinic?.name||t("app.name")}</span>
            <span className="hidden h-1 w-1 shrink-0 bg-[var(--gulf-teal)] sm:block"/>
            <span className="hidden truncate text-[11px] font-bold uppercase tracking-[.1em] text-[var(--ink-500)] sm:block">{t(roleContext[user.role])}</span>
          </div>
          <p className="hidden truncate text-[11px] text-[var(--ink-500)] md:block">{t("common.currentSession")} · {label(titleCase(user.role))}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="relative">
            <button className="button-base button-primary min-h-9 px-2.5 sm:px-3" aria-expanded={quick} aria-haspopup="menu" onClick={()=>{setQuick(current=>!current);setProfile(false)}}><Plus size={16}/><span className="hidden sm:inline">{t("quickCreate.label")}</span></button>
            {quick&&<div className="quick-create-menu" role="menu" aria-label={t("quickCreate.label")}>
              {hasPermission(user,"patients.create")&&<button role="menuitem" onClick={()=>{setQuick(false);quickCreate.openPatient()}}><UserPlus size={16}/><span><strong>{t("quickCreate.addPatient")}</strong><small>{t("quickCreate.addPatientHint")}</small></span></button>}
              {(hasPermission(user,"appointments.manage_own")||hasPermission(user,"appointments.manage_all"))&&<button role="menuitem" onClick={()=>{setQuick(false);quickCreate.openAppointment()}}><CalendarPlus size={16}/><span><strong>{t("appointments.new")}</strong><small>{t("quickCreate.appointmentHint")}</small></span></button>}
              {hasPermission(user,"staff.manage")&&<Link role="menuitem" href="/staff?invite=1"><UsersRound size={16}/><span><strong>{t("quickCreate.inviteStaff")}</strong><small>{t("quickCreate.inviteHint")}</small></span></Link>}
              {hasPermission(user,"billing.create")&&selected.detail&&<Link role="menuitem" href={`/billing/new?patient=${selected.detail.patient.id}`}><CreditCard size={16}/><span><strong>{t("forms.createInvoice")}</strong><small>{selected.detail.patient.full_name}</small></span></Link>}
            </div>}
          </div>
          <ThemeSwitcher label={t}/>
          <LanguageSwitcher compact/>
          <div className="relative">
            <button aria-expanded={profile} aria-haspopup="menu" onClick={()=>setProfile(current=>!current)} className="topbar-button">
              <span className="topbar-avatar">{initials}</span>
              <span className="hidden min-w-0 text-start sm:block">
                <span className="block max-w-44 truncate text-sm font-semibold text-[var(--ink-950)]">{user.full_name}</span>
                <span className="block text-[11px] text-[var(--ink-500)]">{label(titleCase(user.role))}</span>
              </span>
              <ChevronDown size={15} className="text-[var(--ink-500)]"/>
            </button>
            {profile&&<div className="profile-menu" role="menu">
              <div className="border-b border-[var(--line)] px-4 py-3 text-xs text-[var(--ink-500)]">
                <p className="font-bold text-[var(--ink-700)]">{t("common.currentSession")}</p>
                <p className="mt-1 truncate" dir="ltr">{user.email}</p>
              </div>
              <button role="menuitem" onClick={logout} className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-sm font-semibold text-[var(--danger)] hover:bg-[var(--surface-secondary)]">
                <LogOut size={16}/>{t("common.signOut")}
              </button>
            </div>}
          </div>
        </div>
      </div>
    </header>

    <aside className={cn("app-sidebar lg:translate-x-0",mobile?"translate-x-0":isRtl?"translate-x-full":"-translate-x-full")}>
      <div className="app-brand">
        <Link href="/dashboard" className="flex items-center gap-2.5 font-bold tracking-[-.01em] text-[var(--clinical-navy)]">
          <span className="app-brand__mark"><Activity size={19}/></span>
          <span>{t("app.name")}</span>
        </Link>
        <button className="desktop-hidden topbar-button lg:hidden" onClick={()=>setMobile(false)} aria-label={t("accessibility.closeNavigation")}><X size={20}/></button>
      </div>
      <nav aria-label={t("accessibility.primaryNavigation")} className="app-nav scrollbar">
        {visible.map(group=><div className="app-nav__group" key={group.labelKey}>
          <p className="app-nav__label">{t(group.labelKey)}</p>
          {group.items.map(item=>{
            const active=path===item.href||path.startsWith(item.href+"/");
            const Icon=item.icon;
            return <Link key={item.href} href={item.href} aria-current={active?"page":undefined} className="app-nav__item">
              <Icon size={17}/><span>{t(item.labelKey)}</span>
            </Link>;
          })}
        </div>)}
      </nav>
      <div className="app-sidebar__foot"><div className="flex items-center gap-2 text-[11px]"><Stethoscope size={14}/>{t("app.clinicianLed")}</div></div>
    </aside>

    {mobile&&<button className="fixed inset-0 z-30 bg-[#20283a]/55 lg:hidden" onClick={()=>setMobile(false)} aria-label={t("accessibility.closeOverlay")}/>}
    <main id="main-content" className={cn("app-main lg:ps-[260px]",selected.detail&&"app-main--patient")}><div className="app-workspace sm:p-5 lg:p-8">{children}</div></main>
    <PatientContextRail/>
  </div>;
}

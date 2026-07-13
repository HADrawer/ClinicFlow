"use client";

import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {useEffect,useMemo,useState} from "react";
import {
  Activity,CalendarDays,ChevronDown,ClipboardList,Clock3,CreditCard,
  FileChartColumn,FlaskConical,LayoutDashboard,LogOut,Menu,MessageCircle,
  ListPlus,Pill,Settings,ShieldCheck,Stethoscope,Users,UsersRound,X,
} from "lucide-react";
import {useAuth} from "@/lib/auth";
import {cn,titleCase} from "@/lib/utils";
import type {Role} from "@/lib/types";
import {Loading} from "@/components/ui/feedback";

type NavItem={href:string;label:string;icon:typeof Activity;roles:Role[];pharmacy?:boolean};
const groups:{label:string;items:NavItem[]}[]=[
  {label:"Current",items:[
    {href:"/dashboard",label:"Role overview",icon:LayoutDashboard,roles:["owner","doctor","receptionist","accountant","nurse","pharmacist"]},
    {href:"/appointments",label:"Schedule",icon:CalendarDays,roles:["owner","doctor","receptionist","nurse"]},
    {href:"/queue",label:"Queue",icon:Clock3,roles:["owner","doctor","receptionist","nurse"]},
    {href:"/waitlist",label:"Waitlist",icon:ListPlus,roles:["owner","doctor","receptionist"]},
  ]},
  {label:"Clinical",items:[
    {href:"/patients",label:"Patients",icon:Users,roles:["owner","doctor","receptionist","nurse"]},
    {href:"/orders",label:"Orders & referrals",icon:FlaskConical,roles:["owner","doctor","nurse"]},
    {href:"/messages",label:"Messages",icon:MessageCircle,roles:["owner","doctor","receptionist"]},
  ]},
  {label:"Operations",items:[
    {href:"/billing",label:"Billing",icon:CreditCard,roles:["owner","receptionist","accountant"]},
    {href:"/insurance",label:"Insurance",icon:ShieldCheck,roles:["owner","accountant"]},
    {href:"/pharmacy",label:"Pharmacy",icon:Pill,roles:["owner","pharmacist"],pharmacy:true},
    {href:"/staff",label:"Staff access",icon:UsersRound,roles:["owner"]},
    {href:"/quality",label:"Quality",icon:ClipboardList,roles:["owner","receptionist","nurse"]},
    {href:"/reports",label:"Reports",icon:FileChartColumn,roles:["owner","accountant","pharmacist"]},
    {href:"/settings",label:"Settings",icon:Settings,roles:["owner"]},
  ]},
];

const roleContext:Record<Role,string>={
  owner:"Clinic command",
  doctor:"Clinical session",
  receptionist:"Front desk current",
  accountant:"Revenue cycle",
  nurse:"Care coordination",
  pharmacist:"Dispensary current",
};

export function AppShell({children}:{children:React.ReactNode}){
  const {user,loading,logout}=useAuth();
  const path=usePathname();
  const router=useRouter();
  const [mobile,setMobile]=useState(false);
  const [profile,setProfile]=useState(false);
  useEffect(()=>{if(!loading&&!user)router.replace("/login")},[loading,user,router]);
  useEffect(()=>{setMobile(false)},[path]);
  const visible=useMemo(()=>groups.map(group=>({...group,items:group.items.filter(item=>user&&(item.roles.includes(user.role)&&(!item.pharmacy||user.clinic?.pharmacy_enabled)))})).filter(group=>group.items.length),[user]);
  if(loading||!user)return <div className="min-h-screen bg-white"><Loading label="Opening ClinicFlow…"/></div>;
  return <div className="min-h-screen bg-[#f5f7f6]">
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center border-b border-[#d6e1de] bg-white pl-3 pr-3 lg:pl-[268px] lg:pr-6">
      <button className="mr-2 rounded-[4px] p-2 text-[#526973] hover:bg-[#edf3f1] lg:hidden" onClick={()=>setMobile(true)} aria-label="Open navigation"><Menu size={21}/></button>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-[#163c52]">{user.clinic?.name||"ClinicFlow"}</span><span className="hidden h-1 w-1 bg-[#167d78] sm:block"/><span className="hidden text-xs font-medium uppercase tracking-[.08em] text-[#52656e] sm:block">{roleContext[user.role]}</span></div><p className="hidden truncate text-[11px] text-[#52656e] md:block">Authenticated clinic scope · {titleCase(user.role)}</p></div>
        <div className="relative"><button aria-expanded={profile} onClick={()=>setProfile(!profile)} className="flex items-center gap-2 rounded-[4px] border border-transparent px-2 py-1.5 hover:border-[#d6e1de] hover:bg-[#f8faf9]"><span className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-[#ddeeea] text-xs font-bold text-[#0f625f]">{user.full_name.split(" ").map(x=>x[0]).slice(0,2).join("")}</span><span className="hidden text-left sm:block"><span className="block text-sm font-medium text-[#10212b]">{user.full_name}</span><span className="block text-[11px] text-[#52656e]">{titleCase(user.role)}</span></span><ChevronDown size={15} className="text-[#52656e]"/></button>{profile&&<div className="absolute right-0 top-12 w-60 rounded-[5px] border border-[#cbdad6] bg-white p-1 shadow-xl"><div className="border-b border-[#e3ebe9] px-3 py-2.5 text-xs text-[#52656e]"><p className="font-semibold text-[#314854]">Current session</p><p className="mt-1 truncate">{user.email}</p></div><button onClick={logout} className="mt-1 flex w-full items-center gap-2 rounded-[3px] px-3 py-2 text-sm text-[#a33737] hover:bg-[#fff2f0]"><LogOut size={16}/>Sign out and revoke session</button></div>}</div>
      </div>
    </header>
    <aside className={cn("fixed inset-y-0 left-0 z-40 w-[252px] border-r border-[#25495b] bg-[#0d2c3d] text-white transition-transform lg:translate-x-0",mobile?"translate-x-0":"-translate-x-full")}>
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-5"><Link href="/dashboard" className="flex items-center gap-2.5 font-semibold tracking-[-.01em]"><span className="grid h-8 w-8 place-items-center rounded-[4px] bg-[#167d78]"><Activity size={19}/></span><span>ClinicFlow</span></Link><button className="rounded p-1 lg:hidden" onClick={()=>setMobile(false)} aria-label="Close navigation"><X size={20}/></button></div>
      <nav aria-label="Primary navigation" className="scrollbar h-[calc(100vh-112px)] overflow-y-auto px-3 py-4">{visible.map(group=><div className="mb-5" key={group.label}><p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-[#8db0ba]">{group.label}</p>{group.items.map(item=>{const active=path===item.href||path.startsWith(item.href+"/");const Icon=item.icon;return <Link key={item.href} href={item.href} aria-current={active?"page":undefined} className={cn("mb-0.5 flex items-center gap-3 rounded-[3px] border-l-2 px-3 py-2 text-sm font-medium",active?"border-[#42aaa3] bg-white/10 text-white":"border-transparent text-[#c7d9dd] hover:bg-white/[.06] hover:text-white")}><Icon size={17}/>{item.label}</Link>})}</div>)}</nav>
      <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-[#0a2736] px-4 py-3"><div className="flex items-center gap-2 text-[11px] text-[#9bb9c0]"><Stethoscope size={14}/>Clinical decisions remain clinician-led</div></div>
    </aside>
    {mobile&&<button className="fixed inset-0 z-30 bg-[#10212b]/45 lg:hidden" onClick={()=>setMobile(false)} aria-label="Close navigation overlay"/>}
    <main id="main-content" className="min-h-screen pt-16 lg:pl-[252px]"><div className="mx-auto max-w-[1600px] p-3 sm:p-5 lg:p-6">{children}</div></main>
  </div>;
}

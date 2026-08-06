"use client";
import {useEffect,useState} from "react";import {Copy,KeyRound,MailPlus,RefreshCw,ShieldOff,UserCheck,UserRoundPlus} from "lucide-react";import {api} from "@/lib/api";import {useApi} from "@/lib/hooks";import type {Service,User} from "@/lib/types";import {dateTime,titleCase} from "@/lib/utils";import {PageHeader} from "@/components/ui/page-header";import {Card,CardHeader} from "@/components/ui/card";import {Button} from "@/components/ui/button";import {Badge} from "@/components/ui/badge";import {DataTable} from "@/components/ui/data-table";import {Modal,ConfirmDialog} from "@/components/ui/modal";import {ErrorMessage,Loading} from "@/components/ui/feedback";import {InvitationForm,type Invitation} from "@/components/staff/invitation-form";import {InvitationDetails} from "@/components/staff/invitation-details";import {StaffProfileContent} from "@/components/staff/staff-profile-content";

type ConfirmAction={kind:"disable"|"reactivate"|"revoke"|"reset";user:User};
const CONFIRM_COPY:Record<ConfirmAction["kind"],{action:string;effect:string}>={
  disable:{action:"Disable staff access",effect:"They will be signed out everywhere immediately and cannot sign back in until reactivated. Historical records stay attached to their account."},
  reactivate:{action:"Reactivate staff access",effect:"They will be able to sign in again with their existing password."},
  revoke:{action:"Revoke active sessions",effect:"Every device currently signed in as this person will be signed out immediately. They can sign back in right away with their existing password."},
  reset:{action:"Send a password reset",effect:"A new single-use password-reset link is generated through the existing secure reset flow. Their current password keeps working until the link is used."},
};

export default function Staff(){
  const staff=useApi<User[]>("/staff");const invitations=useApi<Invitation[]>("/invitations");const settings=useApi<{services:Service[]}>("/settings");const catalog=useApi<Record<string,string[]>>("/staff/permission-catalog");
  const [open,setOpen]=useState(false);const [viewInvite,setViewInvite]=useState<Invitation|null>(null);const [viewStaff,setViewStaff]=useState<User|null>(null);
  const [confirmAction,setConfirmAction]=useState<ConfirmAction|null>(null);const [confirmBusy,setConfirmBusy]=useState(false);
  const [inviteLink,setInviteLink]=useState("");const [notice,setNotice]=useState("");const [error,setError]=useState("");
  useEffect(()=>{if(new URLSearchParams(window.location.search).get("invite")==="1")setOpen(true)},[]);
  if(staff.loading||invitations.loading||settings.loading||catalog.loading)return <Loading/>;

  async function status(user:User,active:boolean){setError("");try{await api(`/staff/${user.id}/status`,{method:"PATCH",body:JSON.stringify({active})});setNotice(`${user.full_name} ${active?"reactivated":"disabled; active sessions revoked"}.`);staff.reload()}catch(e){setError(e instanceof Error?e.message:"Unable to change access")}}
  async function revoke(user:User){try{await api(`/staff/${user.id}/revoke-sessions`,{method:"POST"});setNotice(`All sessions revoked for ${user.full_name}.`)}catch(e){setError(e instanceof Error?e.message:"Unable to revoke sessions")}}
  async function reset(user:User){try{const result=await api<{demo_token:string}>(`/staff/${user.id}/password-reset`,{method:"POST"});setInviteLink(`${window.location.origin}/reset-password?token=${encodeURIComponent(result.demo_token)}`);setNotice(`Development password reset link created for ${user.full_name}.`)}catch(e){setError(e instanceof Error?e.message:"Unable to create reset")}}

  async function runConfirmedAction(){
    if(!confirmAction)return;
    setConfirmBusy(true);
    try{
      if(confirmAction.kind==="disable")await status(confirmAction.user,false);
      else if(confirmAction.kind==="reactivate")await status(confirmAction.user,true);
      else if(confirmAction.kind==="revoke")await revoke(confirmAction.user);
      else await reset(confirmAction.user);
    }finally{setConfirmBusy(false);setConfirmAction(null)}
  }

  return <>
    <PageHeader title="Staff access" description="Invitation state, professional profile, permissions and active-session control." actions={<Button onClick={()=>setOpen(true)}><UserRoundPlus size={17}/>Invite staff member</Button>}/>
    <ErrorMessage message={error||staff.error||invitations.error||settings.error||catalog.error}/>
    {notice&&<div role="status" className="mb-4 border-l-4 border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_8%,var(--surface))] px-4 py-3 text-sm text-[var(--success)]">{notice}</div>}
    {inviteLink&&<div className="mb-4 flex flex-col gap-3 border border-[var(--line-strong)] bg-[var(--teal-soft)] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--link)]">Development-only link</p><p className="mt-1 truncate text-sm text-[var(--ink-700)]">{inviteLink}</p></div><Button variant="secondary" onClick={()=>navigator.clipboard.writeText(inviteLink)}><Copy size={16}/>Copy link</Button></div>}
    <div className="grid gap-5 xl:grid-cols-[1.45fr_.85fr]">
      <Card>
        <CardHeader title="Clinic team" description="Disabled accounts remain attached to historical records"/>
        <DataTable rows={staff.data||[]} keyOf={x=>x.id} columns={[
          {key:"staff",header:"Staff member",render:x=><div><button type="button" className="font-semibold text-[var(--link)] hover:underline" onClick={()=>setViewStaff(x)}>{x.full_name}</button><p className="mt-0.5 text-xs text-[var(--ink-500)]">{x.email}</p></div>},
          {key:"role",header:"Role & specialty",render:x=><div><p className="font-medium">{titleCase(x.role)}</p><p className="text-xs text-[var(--ink-500)]">{x.specialty||"General staff"}</p></div>},
          {key:"access",header:"Access",render:x=><Badge value={x.is_active?"accepted":"revoked"}/>},
          {key:"last",header:"Last login",render:x=>x.last_login_at?dateTime(x.last_login_at):"Never"},
          {key:"actions",header:"Actions",render:x=><div className="flex items-center gap-1">
            <Button aria-label={`${x.is_active?"Disable":"Reactivate"} ${x.full_name}`} title={x.is_active?"Disable":"Reactivate"} className="h-8 px-2" variant="secondary" onClick={()=>setConfirmAction({kind:x.is_active?"disable":"reactivate",user:x})}>{x.is_active?<ShieldOff size={15}/>:<UserCheck size={15}/>}</Button>
            <Button aria-label={`Reset password for ${x.full_name}`} title="Reset password" className="h-8 px-2" variant="secondary" onClick={()=>setConfirmAction({kind:"reset",user:x})}><KeyRound size={15}/></Button>
            <Button aria-label={`Revoke sessions for ${x.full_name}`} title="Revoke sessions" className="h-8 px-2" variant="secondary" onClick={()=>setConfirmAction({kind:"revoke",user:x})}><RefreshCw size={15}/></Button>
          </div>},
        ]} />
      </Card>
      <Card>
        <CardHeader title="Invitations" description="Single-use links expire automatically"/>
        <div className="divide-y divide-[var(--line)]">
          {invitations.data?.map(invite=><div className="p-4" key={invite.id}>
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{invite.full_name}</p><p className="truncate text-xs text-[var(--ink-500)]">{invite.email}</p></div><Badge value={invite.status}/></div>
            <p className="mt-2 text-xs text-[var(--ink-500)]">{titleCase(invite.role)} · expires {dateTime(invite.expires_at)} · {invite.permissions.length} permission{invite.permissions.length===1?"":"s"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="h-8 px-2 text-xs" variant="secondary" onClick={()=>setViewInvite(invite)}><KeyRound size={14}/>Permissions</Button>
              {invite.status==="pending"&&<><Button className="h-8 px-2 text-xs" variant="secondary" onClick={async()=>{const result=await api<Invitation>(`/invitations/${invite.id}/resend`,{method:"POST"});if(result.demo_token)setInviteLink(`${window.location.origin}/invite/${result.demo_token}`);invitations.reload()}}><MailPlus size={14}/>Resend</Button><Button className="h-8 px-2 text-xs" variant="danger" onClick={async()=>{await api(`/invitations/${invite.id}/revoke`,{method:"POST"});invitations.reload()}}>Revoke</Button></>}
            </div>
          </div>)}
          {!invitations.data?.length&&<p className="p-5 text-sm text-[var(--ink-500)]">No invitations created yet.</p>}
        </div>
      </Card>
    </div>
    <Modal open={open} onClose={()=>setOpen(false)} title="Invite clinic staff" size="max-w-3xl"><InvitationForm services={settings.data?.services||[]} catalog={catalog.data||{}} onCancel={()=>setOpen(false)} onSaved={(result)=>{setOpen(false);setInviteLink(`${window.location.origin}/invite/${result.demo_token}`);invitations.reload()}}/></Modal>
    <Modal open={viewInvite!==null} onClose={()=>setViewInvite(null)} title="Invitation details" size="max-w-2xl">{viewInvite&&<InvitationDetails invitation={viewInvite} catalog={catalog.data||{}} onClose={()=>setViewInvite(null)} onSaved={()=>{setViewInvite(null);invitations.reload()}}/>}</Modal>
    <Modal open={viewStaff!==null} onClose={()=>setViewStaff(null)} title="Staff profile" size="max-w-4xl">{viewStaff&&<StaffProfileContent id={String(viewStaff.id)} openFullPageHref={`/staff/${viewStaff.id}`}/>}</Modal>
    <ConfirmDialog
      open={confirmAction!==null}
      onClose={()=>setConfirmAction(null)}
      onConfirm={runConfirmedAction}
      busy={confirmBusy}
      title={confirmAction?CONFIRM_COPY[confirmAction.kind].action:""}
      description={confirmAction?`${CONFIRM_COPY[confirmAction.kind].action} for ${confirmAction.user.full_name} (${titleCase(confirmAction.user.role)})? ${CONFIRM_COPY[confirmAction.kind].effect}`:""}
    />
  </>;
}

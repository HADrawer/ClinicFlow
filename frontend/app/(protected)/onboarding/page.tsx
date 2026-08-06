"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCheck, ShieldCheck, UserRoundPlus } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import type { Clinic, Service } from "@/lib/types";
import { titleCase } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input } from "@/components/ui/input";
import { ErrorMessage, Loading } from "@/components/ui/feedback";
import { InvitationForm, type Invitation } from "@/components/staff/invitation-form";

const STEPS = [
  { id: "basics", label: "Clinic basics" },
  { id: "staff", label: "Add staff" },
  { id: "finish", label: "Finish setup" },
] as const;

export default function Onboarding() {
  const router = useRouter();
  const { refresh } = useAuth();
  const clinic = useApi<Clinic>("/clinics/me");
  const settings = useApi<{ services: Service[] }>("/settings");
  const catalog = useApi<Record<string, string[]>>("/staff/permission-catalog");
  const invitations = useApi<Invitation[]>("/invitations");
  const [step, setStep] = useState(0);
  const [invite, setInvite] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState("");

  if (clinic.loading || settings.loading || catalog.loading || invitations.loading) {
    return <Loading />;
  }

  async function finish() {
    setFinishing(true);
    setFinishError("");
    try {
      await api("/clinics/me/onboarding/complete", { method: "POST" });
      await refresh();
      router.replace("/dashboard");
    } catch (e) {
      setFinishError(e instanceof Error ? e.message : "Unable to complete setup");
    } finally {
      setFinishing(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Set up your clinic"
        description="A few quick steps before your team starts using ClinicFlow. Clinic basics are required; staff invitations are optional and can be completed later from Settings."
      />
      <ErrorMessage message={clinic.error || settings.error || catalog.error || invitations.error} />
      <ol className="mb-6 flex flex-wrap gap-3">
        {STEPS.map((item, index) => (
          <li key={item.id}>
            <button
              onClick={() => setStep(index)}
              className={`flex items-center gap-2 rounded-[4px] border px-3 py-2 text-sm font-semibold ${
                step === index
                  ? "border-[var(--gulf-teal)] bg-[var(--teal-soft)] text-[var(--link)]"
                  : "border-[var(--line)] text-[var(--ink-500)] hover:bg-[var(--surface-secondary)]"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  step > index ? "bg-[var(--gulf-teal)] text-white" : "border border-current"
                }`}
              >
                {step > index ? <Check size={12} /> : index + 1}
              </span>
              {item.label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && clinic.data && (
        <ClinicBasicsStep
          clinic={clinic.data}
          onSaved={() => {
            clinic.reload();
            setStep(1);
          }}
        />
      )}

      {step === 1 && (
        <Card>
          <CardHeader
            title="Invite your team"
            description="Send single-use invitations. Each teammate receives the existing account-activation email and sets their own password."
            action={
              <Button className="h-9" onClick={() => setInvite(true)}>
                <UserRoundPlus size={16} />
                Invite staff
              </Button>
            }
          />
          <div className="divide-y divide-[var(--line)]">
            {invitations.data?.map((item) => (
              <div className="flex items-center justify-between p-4 text-sm" key={item.id}>
                <div>
                  <p className="font-semibold">{item.full_name}</p>
                  <p className="text-xs text-[var(--ink-500)]">
                    {item.email} · {titleCase(item.role)}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase text-[var(--ink-500)]">
                  {item.status}
                </span>
              </div>
            ))}
            {!invitations.data?.length && (
              <p className="p-5 text-sm text-[var(--ink-500)]">
                No staff invited yet. You can invite doctors, nurses, receptionists and
                administrators now or later from Staff access.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--line)] p-4">
            <Button variant="secondary" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button variant="ghost" onClick={() => setStep(2)}>
              Skip for now
            </Button>
            <Button onClick={() => setStep(2)}>Continue</Button>
          </div>
        </Card>
      )}

      {step === 2 && clinic.data && (
        <Card>
          <CardHeader
            title="Setup summary"
            description="Review what's configured, then finish to open your dashboard."
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <SummaryItem label="Clinic name" value={clinic.data.name} icon={ShieldCheck} />
            <SummaryItem
              label="Working hours"
              value={
                Object.values(clinic.data.working_hours).some(Boolean)
                  ? "Configured"
                  : "Using defaults"
              }
              icon={ClipboardCheck}
            />
            <SummaryItem
              label="Staff invited"
              value={String(invitations.data?.length || 0)}
              icon={UserRoundPlus}
            />
            <SummaryItem
              label="Timezone"
              value={clinic.data.timezone}
              icon={ShieldCheck}
            />
          </div>
          <ErrorMessage message={finishError} />
          <div className="flex justify-end gap-2 border-t border-[var(--line)] p-4">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button disabled={finishing} onClick={finish}>
              {finishing ? "Finishing…" : "Finish setup"}
            </Button>
          </div>
        </Card>
      )}

      <Modal open={invite} onClose={() => setInvite(false)} title="Invite clinic staff" size="max-w-3xl">
        <InvitationForm
          services={settings.data?.services || []}
          catalog={catalog.data || {}}
          onCancel={() => setInvite(false)}
          onSaved={() => {
            setInvite(false);
            invitations.reload();
          }}
        />
      </Modal>
    </>
  );
}

function SummaryItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
}) {
  return (
    <div className="flex items-center gap-3 border border-[var(--line)] p-3">
      <Icon size={18} className="text-[var(--gulf-teal)]" />
      <div>
        <p className="text-xs uppercase tracking-wide text-[var(--ink-500)]">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

function ClinicBasicsStep({
  clinic,
  onSaved,
}: {
  clinic: Clinic;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(clinic);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/clinics/me", {
        method: "PUT",
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          phone: form.phone,
          contact_email: form.contact_email || null,
          timezone: form.timezone,
          logo_url: form.logo_url || null,
          working_hours: form.working_hours,
          pharmacy_enabled: form.pharmacy_enabled,
          feature_flags: form.feature_flags,
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save clinic basics");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Clinic basics"
        description="Contact details, address and working hours. You can refine these later from Settings."
      />
      <form className="space-y-5 p-5" onSubmit={submit}>
        <ErrorMessage message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Clinic name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Phone" required>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </Field>
          <Field label="Contact email">
            <Input
              type="email"
              value={form.contact_email || ""}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            />
          </Field>
          <Field label="Time zone" required>
            <Input
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              required
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address">
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
          </div>
        </div>
        <div>
          <h3 className="mb-3 font-semibold">Working hours</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(form.working_hours).map(([day, hours]) => (
              <Field key={day} label={titleCase(day)}>
                <Input
                  value={hours}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      working_hours: { ...form.working_hours, [day]: e.target.value },
                    })
                  }
                />
              </Field>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
          <Button disabled={busy}>{busy ? "Saving…" : "Save and continue"}</Button>
        </div>
      </form>
    </Card>
  );
}

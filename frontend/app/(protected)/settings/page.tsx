"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  Building2,
  Clock3,
  FileText,
  Plus,
  Shield,
  SunMoon,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { Clinic, Service, User } from "@/lib/types";
import { dateTime, money, titleCase } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { ErrorMessage, Loading } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { useI18n } from "@/lib/i18n";
import { ThemePreferenceControl } from "@/lib/theme";
type SettingsData = {
  services: Service[];
  insurance_companies: { id: number; name: string; active: boolean }[];
  message_templates: {
    id: number;
    name: string;
    kind: string;
    language: string;
    body: string;
  }[];
};
type Audit = {
  id: number;
  action: string;
  entity_type: string;
  entity_id?: number;
  created_at: string;
  user: User;
};
const tabs = [
  { id: "appearance", label: "Appearance", icon: SunMoon },
  { id: "clinic", label: "Clinic & flags", icon: Building2 },
  { id: "services", label: "Services", icon: Stethoscope },
  { id: "access", label: "Staff access", icon: UsersRound },
  { id: "templates", label: "Messages", icon: FileText },
  { id: "insurance", label: "Insurance", icon: Shield },
  { id: "audit", label: "Audit log", icon: Clock3 },
];
export default function Settings() {
  const {t}=useI18n();
  const [tab, setTab] = useState("appearance");
  const clinic = useApi<Clinic>("/clinics/me");
  const settings = useApi<SettingsData>("/settings");
  const audit = useApi<Audit[]>("/audit-logs");
  const [service, setService] = useState(false);
  if (clinic.loading || settings.loading || audit.loading) return <Loading />;
  return (
    <>
      <PageHeader
        title="Clinic settings"
        description="Tenant features, operational catalogs, communication templates and protected activity."
      />
      <ErrorMessage message={clinic.error || settings.error || audit.error} />
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit p-2">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-[3px] border-s-2 px-3 py-2.5 text-start text-sm font-medium ${tab === item.id ? "border-[var(--gulf-teal)] bg-[var(--teal-soft)] text-[var(--link)]" : "border-transparent text-[var(--ink-700)] hover:bg-[var(--surface-secondary)]"}`}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </Card>
        <div>
          {tab === "appearance" && (
            <Card>
              <CardHeader
                title={t("theme.appearance")}
                description={t("theme.workspaceDescription")}
              />
              <div className="max-w-xl p-6">
                <p className="mb-3 text-sm font-medium text-[#314854]">{t("theme.appearance")}</p>
                <ThemePreferenceControl label={t}/>
                <p className="mt-3 text-xs leading-5 text-[#52656e]">
                  {t("theme.systemDescription")}
                </p>
              </div>
            </Card>
          )}{" "}
          {tab === "clinic" && clinic.data && (
            <ClinicForm clinic={clinic.data} onSaved={clinic.reload} />
          )}{" "}
          {tab === "services" && (
            <Card>
              <CardHeader
                title="Services and prices"
                description="Available during appointment booking"
                action={
                  <Button className="h-9" onClick={() => setService(true)}>
                    <Plus size={15} />
                    Add service
                  </Button>
                }
              />
              <DataTable
                rows={settings.data?.services || []}
                keyOf={(item) => item.id}
                columns={[
                  {
                    key: "name",
                    header: "Service",
                    render: (item) => <strong>{item.name}</strong>,
                  },
                  {
                    key: "duration",
                    header: "Duration",
                    render: (item) => `${item.duration_minutes} min`,
                  },
                  {
                    key: "price",
                    header: "Price",
                    render: (item) => money(item.price),
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (item) => (
                      <Badge value={item.active ? "accepted" : "revoked"} />
                    ),
                  },
                ]}
              />
            </Card>
          )}{" "}
          {tab === "access" && (
            <Card>
              <CardHeader
                title="Staff lifecycle"
                description="Invitations, doctor profiles, permissions, disable/reactivate and sessions"
              />
              <div className="p-6">
                <p className="max-w-2xl text-sm text-[#526973]">
                  Staff accounts are managed through single-use invitations.
                  Direct temporary-password account creation is no longer used
                  for routine onboarding.
                </p>
                <Link
                  className="mt-5 inline-flex h-10 items-center rounded-[4px] bg-[#167d78] px-4 text-sm font-semibold text-white"
                  href="/staff"
                >
                  Open staff access
                </Link>
              </div>
            </Card>
          )}{" "}
          {tab === "templates" && (
            <Card>
              <CardHeader
                title="Message templates"
                description="Mock development delivery remains clearly labeled"
              />
              <div className="divide-y divide-[#e3ebe9]">
                {settings.data?.message_templates.map((item) => (
                  <div className="p-5" key={item.id}>
                    <div className="flex justify-between">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-[#52656e]">
                          {titleCase(item.kind)}
                        </p>
                      </div>
                      <span className="text-xs font-bold uppercase text-[#52656e]">
                        {item.language}
                      </span>
                    </div>
                    <p
                      className="mt-3 bg-[#f5f7f6] p-3 text-sm leading-6"
                      dir={item.language === "ar" ? "rtl" : "ltr"}
                    >
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}{" "}
          {tab === "insurance" && (
            <Card>
              <CardHeader
                title="Insurance companies"
                description="No direct insurer integration is claimed"
              />
              <DataTable
                rows={settings.data?.insurance_companies || []}
                keyOf={(item) => item.id}
                columns={[
                  {
                    key: "name",
                    header: "Company",
                    render: (item) => <strong>{item.name}</strong>,
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (item) => (
                      <Badge value={item.active ? "accepted" : "revoked"} />
                    ),
                  },
                ]}
              />
            </Card>
          )}{" "}
          {tab === "audit" && (
            <Card>
              <CardHeader
                title="Audit log"
                description="Recent protected-data and workflow actions"
              />
              <DataTable
                rows={audit.data || []}
                keyOf={(item) => item.id}
                columns={[
                  {
                    key: "date",
                    header: "Date & time",
                    render: (item) => dateTime(item.created_at),
                  },
                  {
                    key: "user",
                    header: "User",
                    render: (item) => item.user.full_name,
                  },
                  {
                    key: "action",
                    header: "Action",
                    render: (item) => titleCase(item.action.replace(".", " ")),
                  },
                  {
                    key: "entity",
                    header: "Record",
                    render: (item) =>
                      `${titleCase(item.entity_type)} #${item.entity_id || "—"}`,
                  },
                ]}
              />
            </Card>
          )}
        </div>
      </div>
      <Modal
        open={service}
        onClose={() => setService(false)}
        title="Add service"
        size="max-w-lg"
      >
        <ServiceForm
          onCancel={() => setService(false)}
          onSaved={() => {
            setService(false);
            settings.reload();
          }}
        />
      </Modal>
    </>
  );
}
function ClinicForm({
  clinic,
  onSaved,
}: {
  clinic: Clinic;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(clinic);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const featureNames = [
    "nursing_triage_enabled",
    "insurance_enabled",
    "lab_orders_enabled",
    "imaging_orders_enabled",
    "consent_enabled",
    "waitlist_enabled",
    "arabic_enabled",
    "whatsapp_mock_enabled",
  ];
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
          logo_url: form.logo_url || null,
          working_hours: form.working_hours,
          pharmacy_enabled: form.pharmacy_enabled,
          feature_flags: {
            ...form.feature_flags,
            pharmacy_enabled: form.pharmacy_enabled,
          },
        }),
      });
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to save clinic settings",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader
        title="Clinic profile and feature flags"
        description="Disabled modules are hidden and rejected by backend APIs"
      />
      <form className="space-y-6 p-5" onSubmit={submit}>
        <ErrorMessage message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Clinic name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Phone" required>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address" required>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
              />
            </Field>
          </div>
        </div>
        <fieldset>
          <legend className="mb-3 font-semibold">Feature access</legend>
          <div className="grid gap-2 border border-[#d6e1de] p-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-[#0f625f]">
              <input
                type="checkbox"
                checked={form.pharmacy_enabled}
                onChange={(e) =>
                  setForm({ ...form, pharmacy_enabled: e.target.checked })
                }
              />
              Pharmacy module
            </label>
            {featureNames.map((name) => (
              <label className="flex items-center gap-2 text-sm" key={name}>
                <input
                  type="checkbox"
                  checked={Boolean(form.feature_flags[name])}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      feature_flags: {
                        ...form.feature_flags,
                        [name]: e.target.checked,
                      },
                    })
                  }
                />
                {titleCase(name.replace("_enabled", ""))}
              </label>
            ))}
          </div>
        </fieldset>
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
                      working_hours: {
                        ...form.working_hours,
                        [day]: e.target.value,
                      },
                    })
                  }
                />
              </Field>
            ))}
          </div>
        </div>
        <div className="flex justify-end border-t border-[#d6e1de] pt-4">
          <Button disabled={busy}>
            {busy ? "Saving…" : "Save clinic settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
function ServiceForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    price: "25.000",
    duration_minutes: "30",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/settings/services", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          price: Number(form.price),
          duration_minutes: Number(form.duration_minutes),
          active: true,
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add service");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="space-y-4 p-5" onSubmit={submit}>
      <ErrorMessage message={error} />
      <Field label="Service name" required>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </Field>
      <Field label="Price (BHD)" required>
        <Input
          type="number"
          step=".001"
          min="0"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          required
        />
      </Field>
      <Field label="Duration (minutes)" required>
        <Input
          type="number"
          min="5"
          value={form.duration_minutes}
          onChange={(e) =>
            setForm({ ...form, duration_minutes: e.target.value })
          }
          required
        />
      </Field>
      <div className="flex justify-end gap-2 border-t border-[#d6e1de] pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={busy}>Add service</Button>
      </div>
    </form>
  );
}

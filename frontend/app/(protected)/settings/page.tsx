"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  Building2,
  Clock3,
  Copy,
  FileText,
  Pencil,
  Plus,
  Shield,
  SunMoon,
  Stethoscope,
  Trash2,
  UsersRound,
  Zap,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
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
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { useI18n } from "@/lib/i18n";
import { ThemePreferenceControl } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { ServiceForm } from "@/components/settings/service-form";
import { CompanyForm, type Company } from "@/components/settings/company-form";
import { TemplateForm, type Template } from "@/components/settings/template-form";
import { QuickCreateSettings } from "@/components/settings/quick-create-settings";

type SettingsData = {
  services: Service[];
  insurance_companies: Company[];
  message_templates: Template[];
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
  { id: "quickcreate", label: "Quick create", icon: Zap },
  { id: "audit", label: "Audit log", icon: Clock3 },
];

type ServiceUsage = { appointments: number; waitlist_entries: number };

export default function Settings() {
  const {t}=useI18n();
  const [tab, setTab] = useState("appearance");
  const clinic = useApi<Clinic>("/clinics/me");
  const settings = useApi<SettingsData>("/settings");
  const audit = useApi<Audit[]>("/audit-logs");

  const [serviceModal, setServiceModal] = useState<{ editing?: Service } | null>(null);
  const [serviceRemove, setServiceRemove] = useState<Service | null>(null);
  const [serviceUsage, setServiceUsage] = useState<ServiceUsage | null>(null);
  const [serviceUsageLoading, setServiceUsageLoading] = useState(false);
  const [serviceBusy, setServiceBusy] = useState(false);
  const [serviceError, setServiceError] = useState("");

  const [companyModal, setCompanyModal] = useState<{ editing?: Company } | null>(null);
  const [companyRemove, setCompanyRemove] = useState<Company | null>(null);
  const [companyBlocked, setCompanyBlocked] = useState(false);
  const [companyBusy, setCompanyBusy] = useState(false);
  const [companyError, setCompanyError] = useState("");

  const [templateModal, setTemplateModal] = useState<{ initial?: Partial<Template>; editingId?: number } | null>(null);
  const [templateRemove, setTemplateRemove] = useState<Template | null>(null);
  const [templateBusy, setTemplateBusy] = useState(false);

  if (clinic.loading || settings.loading || audit.loading) return <Loading />;

  async function openServiceRemove(service: Service) {
    setServiceRemove(service);
    setServiceError("");
    setServiceUsage(null);
    setServiceUsageLoading(true);
    try {
      setServiceUsage(await api<ServiceUsage>(`/settings/services/${service.id}/usage`));
    } catch {
      setServiceUsage({ appointments: 0, waitlist_entries: 0 });
    } finally {
      setServiceUsageLoading(false);
    }
  }
  const serviceInUse = serviceUsage ? serviceUsage.appointments + serviceUsage.waitlist_entries > 0 : false;
  async function confirmServiceRemove() {
    if (!serviceRemove) return;
    setServiceBusy(true);
    setServiceError("");
    try {
      if (serviceInUse) {
        await api(`/settings/services/${serviceRemove.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: serviceRemove.name,
            price: serviceRemove.price,
            duration_minutes: serviceRemove.duration_minutes,
            active: false,
          }),
        });
      } else {
        await api(`/settings/services/${serviceRemove.id}`, { method: "DELETE" });
      }
      settings.reload();
      setServiceRemove(null);
    } catch (e) {
      setServiceError(e instanceof Error ? e.message : "Unable to remove service");
    } finally {
      setServiceBusy(false);
    }
  }

  function openCompanyRemove(company: Company) {
    setCompanyRemove(company);
    setCompanyBlocked(false);
    setCompanyError("");
  }
  async function confirmCompanyRemove() {
    if (!companyRemove) return;
    setCompanyBusy(true);
    setCompanyError("");
    try {
      await api(`/settings/insurance-companies/${companyRemove.id}`, { method: "DELETE" });
      settings.reload();
      setCompanyRemove(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setCompanyBlocked(true);
      else setCompanyError(e instanceof Error ? e.message : "Unable to remove insurance company");
    } finally {
      setCompanyBusy(false);
    }
  }
  async function deactivateCompany() {
    if (!companyRemove) return;
    setCompanyBusy(true);
    setCompanyError("");
    try {
      await api(`/settings/insurance-companies/${companyRemove.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: companyRemove.name, active: false }),
      });
      settings.reload();
      setCompanyRemove(null);
    } catch (e) {
      setCompanyError(e instanceof Error ? e.message : "Unable to deactivate insurance company");
    } finally {
      setCompanyBusy(false);
    }
  }

  async function confirmTemplateRemove() {
    if (!templateRemove) return;
    setTemplateBusy(true);
    try {
      await api(`/settings/message-templates/${templateRemove.id}`, { method: "DELETE" });
      settings.reload();
      setTemplateRemove(null);
    } finally {
      setTemplateBusy(false);
    }
  }

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
                <p className="mb-3 text-sm font-medium text-[var(--ink-700)]">{t("theme.appearance")}</p>
                <ThemePreferenceControl label={t}/>
                <p className="mt-3 text-xs leading-5 text-[var(--ink-500)]">
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
                  <Button className="h-9" onClick={() => setServiceModal({})}>
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
                  {
                    key: "actions",
                    header: "Actions",
                    render: (item) => (
                      <div className="flex items-center gap-1">
                        <Button aria-label={`Edit ${item.name}`} title="Edit" className="h-8 px-2" variant="secondary" onClick={() => setServiceModal({ editing: item })}><Pencil size={14}/></Button>
                        <Button aria-label={`Remove ${item.name}`} title="Remove or deactivate" className="h-8 px-2" variant="danger" onClick={() => openServiceRemove(item)}><Trash2 size={14}/></Button>
                      </div>
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
                <p className="max-w-2xl text-sm text-[var(--ink-500)]">
                  Staff accounts are managed through single-use invitations.
                  Direct temporary-password account creation is no longer used
                  for routine onboarding.
                </p>
                <Link className="button-base button-primary mt-5" href="/staff">
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
                action={
                  <Button className="h-9" onClick={() => setTemplateModal({})}>
                    <Plus size={15} />
                    Add template
                  </Button>
                }
              />
              <div className="divide-y divide-[var(--line)]">
                {settings.data?.message_templates.map((item) => (
                  <div className="p-5" key={item.id}>
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-[var(--ink-500)]">
                          {titleCase(item.kind)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs font-bold uppercase text-[var(--ink-500)]">
                          {item.language}
                        </span>
                        <Button title="Edit" className="h-8 px-2" variant="secondary" onClick={() => setTemplateModal({ initial: item, editingId: item.id })}><Pencil size={14}/></Button>
                        <Button title="Duplicate" className="h-8 px-2" variant="secondary" onClick={() => setTemplateModal({ initial: { ...item, name: `${item.name} (copy)` } })}><Copy size={14}/></Button>
                        <Button title="Delete" className="h-8 px-2" variant="danger" onClick={() => setTemplateRemove(item)}><Trash2 size={14}/></Button>
                      </div>
                    </div>
                    <p
                      className="mt-3 bg-[var(--surface-secondary)] p-3 text-sm leading-6"
                      dir={item.language === "ar" ? "rtl" : "ltr"}
                    >
                      {item.body}
                    </p>
                  </div>
                ))}
                {!settings.data?.message_templates.length && (
                  <p className="p-5 text-sm text-[var(--ink-500)]">No message templates yet.</p>
                )}
              </div>
            </Card>
          )}{" "}
          {tab === "insurance" && (
            <Card>
              <CardHeader
                title="Insurance companies"
                description="No direct insurer integration is claimed"
                action={
                  <Button className="h-9" onClick={() => setCompanyModal({})}>
                    <Plus size={15} />
                    Add company
                  </Button>
                }
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
                  {
                    key: "actions",
                    header: "Actions",
                    render: (item) => (
                      <div className="flex items-center gap-1">
                        <Button aria-label={`Edit ${item.name}`} title="Edit" className="h-8 px-2" variant="secondary" onClick={() => setCompanyModal({ editing: item })}><Pencil size={14}/></Button>
                        <Button aria-label={`Remove ${item.name}`} title="Remove or deactivate" className="h-8 px-2" variant="danger" onClick={() => openCompanyRemove(item)}><Trash2 size={14}/></Button>
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          )}{" "}
          {tab === "quickcreate" && clinic.data && (
            <QuickCreateSettings clinic={clinic.data} onSaved={() => { clinic.reload(); }} />
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

      <Modal open={serviceModal !== null} onClose={() => setServiceModal(null)} title={serviceModal?.editing ? "Edit service" : "Add service"} size="max-w-lg">
        <ServiceForm
          initial={serviceModal?.editing}
          editingId={serviceModal?.editing?.id}
          onCancel={() => setServiceModal(null)}
          onSaved={() => { setServiceModal(null); settings.reload(); }}
        />
      </Modal>
      <Modal open={serviceRemove !== null} onClose={() => setServiceRemove(null)} title="Remove service" size="max-w-md">
        {serviceRemove && (
          <div className="p-5">
            {serviceUsageLoading ? (
              <Loading />
            ) : serviceInUse ? (
              <>
                <p className="text-sm leading-6 text-[var(--ink-700)]">
                  <strong>{serviceRemove.name}</strong> is used by {serviceUsage?.appointments || 0} appointment{serviceUsage?.appointments === 1 ? "" : "s"} and {serviceUsage?.waitlist_entries || 0} waitlist entr{serviceUsage?.waitlist_entries === 1 ? "y" : "ies"}. Deleting it is blocked to protect those records — deactivate it instead so it disappears from booking without breaking history.
                </p>
                <ErrorMessage message={serviceError} />
                <div className="mt-6 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setServiceRemove(null)}>{t("common.cancel")}</Button>
                  <Button variant="danger" disabled={serviceBusy} onClick={confirmServiceRemove}>{serviceBusy ? t("common.working") : "Deactivate service"}</Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm leading-6 text-[var(--ink-700)]">
                  Remove <strong>{serviceRemove.name}</strong>? It is not referenced by any appointment or waitlist entry. This cannot be undone.
                </p>
                <ErrorMessage message={serviceError} />
                <div className="mt-6 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setServiceRemove(null)}>{t("common.cancel")}</Button>
                  <Button variant="danger" disabled={serviceBusy} onClick={confirmServiceRemove}>{serviceBusy ? t("common.working") : "Delete service"}</Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal open={companyModal !== null} onClose={() => setCompanyModal(null)} title={companyModal?.editing ? "Edit insurance company" : "Add insurance company"} size="max-w-lg">
        <CompanyForm
          initial={companyModal?.editing}
          editingId={companyModal?.editing?.id}
          onCancel={() => setCompanyModal(null)}
          onSaved={() => { setCompanyModal(null); settings.reload(); }}
        />
      </Modal>
      <Modal open={companyRemove !== null} onClose={() => setCompanyRemove(null)} title="Remove insurance company" size="max-w-md">
        {companyRemove && (
          <div className="p-5">
            {companyBlocked ? (
              <p className="text-sm leading-6 text-[var(--ink-700)]">
                <strong>{companyRemove.name}</strong> has existing claims on file, so deleting it is blocked to protect those records. Deactivate it instead so it disappears from new claims without breaking history.
              </p>
            ) : (
              <p className="text-sm leading-6 text-[var(--ink-700)]">
                Remove <strong>{companyRemove.name}</strong>? This cannot be undone. If this insurer has existing claims, removal will be blocked automatically and you can deactivate it instead.
              </p>
            )}
            <ErrorMessage message={companyError} />
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCompanyRemove(null)}>{t("common.cancel")}</Button>
              {companyBlocked ? (
                <Button variant="danger" disabled={companyBusy} onClick={deactivateCompany}>{companyBusy ? t("common.working") : "Deactivate company"}</Button>
              ) : (
                <Button variant="danger" disabled={companyBusy} onClick={confirmCompanyRemove}>{companyBusy ? t("common.working") : "Delete company"}</Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={templateModal !== null} onClose={() => setTemplateModal(null)} title={templateModal?.editingId ? "Edit message template" : "New message template"} size="max-w-3xl">
        <TemplateForm
          initial={templateModal?.initial}
          editingId={templateModal?.editingId}
          onCancel={() => setTemplateModal(null)}
          onSaved={() => { setTemplateModal(null); settings.reload(); }}
        />
      </Modal>
      <ConfirmDialog
        open={templateRemove !== null}
        onClose={() => setTemplateRemove(null)}
        onConfirm={confirmTemplateRemove}
        busy={templateBusy}
        title="Delete message template"
        description={templateRemove ? `Delete "${templateRemove.name}"? This cannot be undone. It will no longer be offered when sending messages.` : ""}
      />
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
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState(clinic);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reopening, setReopening] = useState(false);
  async function reopenSetup() {
    setReopening(true);
    try {
      await api("/clinics/me/onboarding/reopen", { method: "POST" });
      router.push("/onboarding");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to reopen clinic setup");
      setReopening(false);
    }
  }
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
          contact_email: form.contact_email || null,
          timezone: form.timezone,
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
        action={
          user?.role === "owner" && (
            <Button
              type="button"
              variant="secondary"
              className="h-9"
              disabled={reopening}
              onClick={reopenSetup}
            >
              {reopening ? "Opening…" : "Reopen clinic setup"}
            </Button>
          )
        }
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
          <div className="grid gap-2 border border-[var(--line)] p-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--link)]">
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
        <div className="flex justify-end border-t border-[var(--line)] pt-4">
          <Button disabled={busy}>
            {busy ? "Saving…" : "Save clinic settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

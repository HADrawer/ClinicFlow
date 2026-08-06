"use client";
import Link from "next/link";
import {
  CalendarPlus,
  Clock3,
  Pill,
  Search,
  UserRoundPlus,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/hooks";
import type { DashboardData } from "@/lib/types";
import { dateTime, money, titleCase } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ErrorMessage, Loading } from "@/components/ui/feedback";
import {MetricStrip,type Metric} from "@/components/ui/metric-strip";
import {useI18n} from "@/lib/i18n";
const headings = {
  owner: [
    "dashboard.ownerTitle",
    "dashboard.ownerDescription",
  ],
  doctor: [
    "dashboard.doctorTitle",
    "dashboard.doctorDescription",
  ],
  receptionist: [
    "dashboard.receptionTitle",
    "dashboard.receptionDescription",
  ],
  accountant: [
    "dashboard.accountantTitle",
    "dashboard.accountantDescription",
  ],
  nurse: [
    "dashboard.nurseTitle",
    "dashboard.nurseDescription",
  ],
  pharmacist: [
    "dashboard.pharmacistTitle",
    "dashboard.pharmacistDescription",
  ],
} as const;
export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === "pharmacist") return <PharmacyDashboard />;
  return <ClinicDashboard />;
}
function ClinicDashboard() {
  const { user } = useAuth();
  const {t,label}=useI18n();
  const { data, loading, error } = useApi<DashboardData>(
    "/analytics/dashboard",
  );
  if (loading) return <Loading />;
  if (!data) return <ErrorMessage message={error} />;
  const heading = headings[user!.role];
  const role=user!.role;
  const stats:Metric[] = role==="owner"
    ? [
        [t("dashboard.today"), data.today_appointments],
        [t("dashboard.sevenDayAppointments"), data.week_appointments],
        [t("dashboard.monthCollected"), money(data.monthly_revenue)],
        [t("dashboard.outstanding"), money(data.outstanding_balances)],
        [t("dashboard.pendingInsurance"), money(data.pending_insurance)],
      ].map(([label,value])=>({label:String(label),value}))
    : role==="accountant"?[{label:t("dashboard.monthCollected"),value:money(data.monthly_revenue)},{label:t("dashboard.outstanding"),value:money(data.outstanding_balances),tone:"warning"},{label:t("dashboard.pendingInsurance"),value:money(data.pending_insurance)},{label:t("billing.paidInvoices"),value:data.payment_methods.length},{label:t("dashboard.noShowRate"),value:`${data.no_show_rate}%`}]
    : role==="receptionist"?[{label:t("dashboard.today"),value:data.today_appointments},{label:t("appointments.unconfirmed"),value:(data.status_breakdown.requested||0)+(data.status_breakdown.scheduled||0),tone:"warning"},{label:t("appointments.checkedIn"),value:data.status_breakdown.checked_in||0},{label:label("waiting"),value:data.status_breakdown.waiting||0},{label:t("dashboard.noShowRate"),value:`${data.no_show_rate}%`}]
    : role==="nurse"?[{label:t("dashboard.today"),value:data.today_appointments},{label:t("appointments.checkedIn"),value:data.status_breakdown.checked_in||0},{label:label("waiting"),value:data.status_breakdown.waiting||0,tone:"warning"},{label:label("in_progress"),value:data.status_breakdown.in_progress||0},{label:label("completed"),value:data.status_breakdown.completed||0}]
    : [{label:t("dashboard.today"),value:data.today_appointments},{label:t("dashboard.nextSevenDays"),value:data.week_appointments},{label:t("dashboard.waitingCheckedIn"),value:(data.status_breakdown.waiting||0)+(data.status_breakdown.checked_in||0),tone:"warning"},{label:label("completed"),value:data.status_breakdown.completed||0},{label:t("dashboard.noShowRate"),value:`${data.no_show_rate}%`}];
  const chart = Object.entries(data.status_breakdown).map(
    ([status, count]) => ({ status: label(status), count }),
  );
  return (
    <>
      <PageHeader
        title={t(heading[0])}
        description={t(heading[1])}
        actions={<RoleActions role={user!.role} />}
      />
      <MetricStrip items={stats} className="mb-5"/>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Card>
          <CardHeader
            title={
              role === "doctor"
                ? t("dashboard.myUpcoming")
                : role==="accountant"?t("dashboard.collectionPosition"):t("dashboard.upcoming")
            }
            description={role==="accountant"?t("dashboard.collectionDescription"):t("dashboard.upcomingDescription")}
            action={
              role!=="accountant"?<Link
                href="/appointments"
                className="text-sm font-semibold text-[var(--link)]"
              >
                {t("dashboard.openCalendar")}
              </Link>:<Link href="/billing" className="text-sm font-semibold text-[var(--link)]">{t("billing.open")}</Link>
            }
          />
          {role==="accountant"?<div className="divide-y divide-[var(--line)] px-5">{[[t("dashboard.monthCollected"),money(data.monthly_revenue)],[t("dashboard.outstanding"),money(data.outstanding_balances)],[t("dashboard.pendingInsurance"),money(data.pending_insurance)]].map(([label,value])=><div className="flex items-center justify-between py-4" key={label}><span className="text-sm text-[var(--ink-500)]">{label}</span><strong className="tabular text-[var(--ink-950)]">{value}</strong></div>)}</div>:<>
            <div className="hidden sm:block"><DataTable
              rows={data.upcoming_appointments}
              keyOf={(item) => item.id}
              columns={[
                {key:"time",header:t("common.dateTime"),render:item=><Link className="data-link" href={`/appointments/${item.id}`}>{dateTime(item.time)}</Link>},
                {key:"patient",header:t("common.patient"),render:item=>item.patient},
                {key:"doctor",header:t("common.doctor"),className:"hidden md:table-cell",render:item=>item.doctor},
                {key:"service",header:t("common.service"),className:"hidden md:table-cell",render:item=>item.service},
                {key:"status",header:t("common.status"),render:item=><Badge value={item.status}/>},
              ]}
            /></div>
            <div className="divide-y divide-[var(--line)] sm:hidden">{data.upcoming_appointments.map(item=><Link href={`/appointments/${item.id}`} className="block px-5 py-3" key={item.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-[var(--link)]">{item.patient}</p><p className="mt-0.5 text-xs text-[var(--ink-500)]">{dateTime(item.time)}</p></div><Badge value={item.status}/></div><p className="mt-2 truncate text-xs text-[var(--ink-500)]">{item.doctor} · {item.service}</p></Link>)}</div>
          </>}
        </Card>
        <Card>
          <CardHeader
              title={t("dashboard.statusPressure")}
              description={t("dashboard.statusPressureDescription")}
          />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chart}
                layout="vertical"
                margin={{ left: 8, right: 12 }}
              >
                <CartesianGrid stroke="var(--line)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "var(--ink-500)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="status"
                  width={78}
                  tick={{ fontSize: 10, fill: "var(--ink-500)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid var(--line)",
                    borderRadius: 3,
                    fontSize: 12,
                    background: "var(--surface-raised)",
                    color: "var(--ink-950)",
                  }}
                />
                <Bar dataKey="count" fill="var(--gulf-teal)" maxBarSize={18}>
                  <LabelList dataKey="count" position="right" fill="var(--ink-700)" fontSize={10}/>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      {user?.role === "owner" && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              title={t("dashboard.recentActivity")}
              description={t("dashboard.noPatientDetails")}
            />
            <div className="divide-y divide-[var(--line)] px-5">
              {data.recent_activity.map((item, index) => (
                <div className="py-3" key={index}>
                  <p className="text-sm font-medium text-[var(--ink-700)]">
                    {t(`audit.${item.action}`)===`audit.${item.action}`?titleCase(item.action.replaceAll(".", " ")):t(`audit.${item.action}`)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--ink-500)]">
                    {dateTime(item.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader
              title={t("dashboard.doctorWorkload")}
              description={t("dashboard.operationalVolume")}
            />
            <div className="divide-y divide-[var(--line)] px-5">
              {data.top_doctors.map((item) => (
                <div className="flex justify-between py-3" key={item.doctor}>
                  <span className="text-sm font-medium">{item.doctor}</span>
                  <span className="text-sm tabular text-[var(--ink-500)]">
                    {t("dashboard.appointmentCount",{count:item.appointments})}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
function RoleActions({ role }: { role: string }) {
  const {t}=useI18n();
  if (role === "owner")
    return (
      <>
        <Link
          className="button-base button-secondary"
          href="/staff"
        >
          <UserRoundPlus size={16} />
          {t("dashboard.manageStaff")}
        </Link>
        <NewAppointment />
      </>
    );
  if (role === "doctor")
    return (
      <>
        <Link
          className="button-base button-secondary"
          href="/queue"
        >
          <Clock3 size={16} />
          {t("dashboard.openQueue")}
        </Link>
        <NewAppointment />
      </>
    );
  if (role === "receptionist")
    return (
      <>
        <Link
          className="button-base button-secondary"
          href="/patients"
        >
          <Search size={16} />
          {t("dashboard.findPatient")}
        </Link>
        <NewAppointment />
      </>
    );
  if(role==="nurse")return <Link className="button-base button-secondary" href="/queue"><Clock3 size={16}/>{t("dashboard.openQueue")}</Link>;
  return null;
}
function NewAppointment() {
  const {t}=useI18n();
  return (
    <Link
      href="/appointments/new"
      className="button-base button-primary"
    >
      <CalendarPlus size={16} />
      {t("appointments.new")}
    </Link>
  );
}
type PharmacySummary = {
  awaiting_dispensing: number;
  low_stock: number;
  near_expiry: number;
  expired: number;
  out_of_stock: number;
  today_dispensing: number;
  pending_purchase_orders: number;
};
function PharmacyDashboard() {
  const {t}=useI18n();
  const { data, loading, error } = useApi<PharmacySummary>(
    "/pharmacy/dashboard",
  );
  if (loading) return <Loading />;
  if (!data) return <ErrorMessage message={error} />;
  return (
    <>
      <PageHeader
        title={t(headings.pharmacist[0])}
        description={t(headings.pharmacist[1])}
        actions={
          <Link
            href="/pharmacy/prescriptions"
            className="button-base button-primary"
          >
            <Pill size={16} />
            {t("pharmacy.dispensingQueue")}
          </Link>
        }
      />
      <MetricStrip items={[{label:t("pharmacy.awaitingDispensing"),value:data.awaiting_dispensing},{label:t("pharmacy.lowStockShort"),value:data.low_stock,tone:"warning"},{label:t("pharmacy.nearExpiryShort"),value:data.near_expiry,tone:"warning"},{label:t("pharmacy.expiredBlocked"),value:data.expired,tone:"danger"},{label:t("pharmacy.outOfStock"),value:data.out_of_stock,tone:"danger"},{label:t("pharmacy.dispensedToday"),value:data.today_dispensing},{label:t("pharmacy.pendingPurchases"),value:data.pending_purchase_orders}]} />
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Link
          href="/pharmacy/stock"
          className="surface-panel border-l-4 border-[var(--gulf-teal)] p-5 text-sm font-semibold text-[var(--ink-950)]"
        >
          Review batch stock
          <span className="mt-1 block text-xs font-normal text-[var(--ink-500)]">
            FEFO, expiry and quantity
          </span>
        </Link>
        <Link
          href="/pharmacy/purchases"
          className="surface-panel border-l-4 border-[var(--gulf-teal)] p-5 text-sm font-semibold text-[var(--ink-950)]"
        >
          Receive a purchase
          <span className="mt-1 block text-xs font-normal text-[var(--ink-500)]">
            Create traceable stock movements
          </span>
        </Link>
        <Link
          href="/pharmacy/medicines"
          className="surface-panel border-l-4 border-[var(--gulf-teal)] p-5 text-sm font-semibold text-[var(--ink-950)]"
        >
          Medicine catalog
          <span className="mt-1 block text-xs font-normal text-[var(--ink-500)]">
            Operational catalog, not clinical classification
          </span>
        </Link>
      </div>
    </>
  );
}

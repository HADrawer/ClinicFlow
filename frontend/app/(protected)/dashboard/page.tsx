"use client";
import Link from "next/link";
import {
  CalendarPlus,
  Clock3,
  FileClock,
  Pill,
  Search,
  ShieldAlert,
  UserRoundPlus,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
const headings = {
  owner: [
    "Clinic command",
    "Business, access, safety and operational exceptions from live records.",
  ],
  doctor: [
    "My clinical current",
    "Today’s schedule, waiting patients and clinical follow-up work.",
  ],
  receptionist: [
    "Front desk current",
    "Arrival, booking, confirmation and checkout work in one view.",
  ],
  accountant: [
    "Revenue cycle",
    "Collections, outstanding balances and insurer exposure.",
  ],
  nurse: [
    "Care coordination",
    "Arrivals, queue pressure and the clinic’s active appointment current.",
  ],
  pharmacist: [
    "Dispensary current",
    "Prescription, stock and expiry work requiring pharmacy attention.",
  ],
} as const;
export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === "pharmacist") return <PharmacyDashboard />;
  return <ClinicDashboard />;
}
function ClinicDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useApi<DashboardData>(
    "/analytics/dashboard",
  );
  if (loading) return <Loading />;
  if (!data) return <ErrorMessage message={error} />;
  const heading = headings[user!.role];
  const financial = user?.role === "owner" || user?.role === "accountant";
  const stats = financial
    ? [
        ["Today", data.today_appointments],
        ["7-day appointments", data.week_appointments],
        ["Month collected", money(data.monthly_revenue)],
        ["Outstanding", money(data.outstanding_balances)],
        ["Pending insurance", money(data.pending_insurance)],
      ]
    : [
        ["Today", data.today_appointments],
        ["Next 7 days", data.week_appointments],
        ["No-show rate", `${data.no_show_rate}%`],
        ["Assigned patients", data.new_patients],
        [
          "Waiting / checked in",
          (data.status_breakdown.waiting || 0) +
            (data.status_breakdown.checked_in || 0),
        ],
      ];
  const chart = Object.entries(data.status_breakdown).map(
    ([status, count]) => ({ status: titleCase(status), count }),
  );
  return (
    <>
      <PageHeader
        title={heading[0]}
        description={heading[1]}
        actions={<RoleActions role={user!.role} />}
      />
      <section
        aria-label="Current measures"
        className="mb-5 grid border border-[#d6e1de] bg-white sm:grid-cols-2 lg:grid-cols-5"
      >
        {stats.map(([label, value], index) => (
          <div
            className={`border-l-3 px-4 py-3 ${index === 0 ? "border-l-[#167d78]" : "border-l-transparent"} border-b border-r border-[#e3ebe9] last:border-r-0 sm:border-b-0`}
            key={String(label)}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#52656e]">
              {label}
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular text-[#163c52]">
              {value}
            </p>
          </div>
        ))}
      </section>
      <div className="grid gap-5 xl:grid-cols-[1.55fr_.8fr]">
        <Card>
          <CardHeader
            title={
              user?.role === "doctor"
                ? "My upcoming patients"
                : "Upcoming appointment current"
            }
            description="Confirmed, scheduled and active visits"
            action={
              <Link
                href="/appointments"
                className="text-sm font-semibold text-[#0f625f]"
              >
                Open calendar
              </Link>
            }
          />
          <DataTable
            rows={data.upcoming_appointments}
            keyOf={(item) => item.id}
            columns={[
              {
                key: "time",
                header: "Date & time",
                render: (item) => (
                  <Link
                    className="font-semibold text-[#164e67]"
                    href={`/appointments/${item.id}`}
                  >
                    {dateTime(item.time)}
                  </Link>
                ),
              },
              {
                key: "patient",
                header: "Patient",
                render: (item) => item.patient,
              },
              {
                key: "doctor",
                header: "Doctor",
                className: "hidden md:table-cell",
                render: (item) => item.doctor,
              },
              {
                key: "service",
                header: "Service",
                className: "hidden md:table-cell",
                render: (item) => item.service,
              },
              {
                key: "status",
                header: "Status",
                render: (item) => <Badge value={item.status} />,
              },
            ]}
          />
        </Card>
        <Card>
          <CardHeader
            title="Status pressure"
            description="Visible workload, not a decorative metric"
          />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chart}
                layout="vertical"
                margin={{ left: 8, right: 12 }}
              >
                <CartesianGrid stroke="#e3ebe9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#52656e" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="status"
                  width={78}
                  tick={{ fontSize: 10, fill: "#526973" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #cbdad6",
                    borderRadius: 3,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="#167d78" maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      {user?.role === "owner" && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Recent protected activity"
              description="No patient details are shown in this summary"
            />
            <div className="divide-y divide-[#e3ebe9] px-5">
              {data.recent_activity.map((item, index) => (
                <div className="py-3" key={index}>
                  <p className="text-sm font-medium text-[#314854]">
                    {titleCase(item.action.replace(".", " "))}
                  </p>
                  <p className="mt-0.5 text-xs text-[#52656e]">
                    {dateTime(item.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader
              title="Doctor workload"
              description="Operational appointment volume"
            />
            <div className="divide-y divide-[#e3ebe9] px-5">
              {data.top_doctors.map((item) => (
                <div className="flex justify-between py-3" key={item.doctor}>
                  <span className="text-sm font-medium">{item.doctor}</span>
                  <span className="text-sm tabular text-[#52656e]">
                    {item.appointments} appointments
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
  if (role === "owner")
    return (
      <>
        <Link
          className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-[#b9cbc6] bg-white px-4 text-sm font-semibold text-[#314854]"
          href="/staff"
        >
          <UserRoundPlus size={16} />
          Manage staff
        </Link>
        <NewAppointment />
      </>
    );
  if (role === "doctor")
    return (
      <>
        <Link
          className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-[#b9cbc6] bg-white px-4 text-sm font-semibold text-[#314854]"
          href="/queue"
        >
          <Clock3 size={16} />
          Open queue
        </Link>
        <NewAppointment />
      </>
    );
  if (role === "receptionist")
    return (
      <>
        <Link
          className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-[#b9cbc6] bg-white px-4 text-sm font-semibold text-[#314854]"
          href="/patients"
        >
          <Search size={16} />
          Find patient
        </Link>
        <NewAppointment />
      </>
    );
  return null;
}
function NewAppointment() {
  return (
    <Link
      href="/appointments/new"
      className="inline-flex h-10 items-center gap-2 rounded-[4px] bg-[#167d78] px-4 text-sm font-semibold text-white"
    >
      <CalendarPlus size={16} />
      New appointment
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
  const { data, loading, error } = useApi<PharmacySummary>(
    "/pharmacy/dashboard",
  );
  if (loading) return <Loading />;
  if (!data) return <ErrorMessage message={error} />;
  return (
    <>
      <PageHeader
        title={headings.pharmacist[0]}
        description={headings.pharmacist[1]}
        actions={
          <Link
            href="/pharmacy/prescriptions"
            className="inline-flex h-10 items-center gap-2 rounded-[4px] bg-[#167d78] px-4 text-sm font-semibold text-white"
          >
            <Pill size={16} />
            Dispensing queue
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Awaiting dispensing", data.awaiting_dispensing, Pill],
          ["Low stock", data.low_stock, ShieldAlert],
          ["Near expiry", data.near_expiry, FileClock],
          ["Expired — blocked", data.expired, ShieldAlert],
          ["Out of stock", data.out_of_stock, ShieldAlert],
          ["Dispensed today", data.today_dispensing, Pill],
          ["Pending purchases", data.pending_purchase_orders, FileClock],
        ].map(([label, value, Icon]: any[]) => (
          <Card
            className="border-t-3 border-t-[#167d78] p-4"
            key={String(label)}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#52656e]">
                {String(label)}
              </p>
              <Icon
                size={17}
                className={
                  String(label).includes("Expired")
                    ? "text-[#b74242]"
                    : "text-[#167d78]"
                }
              />
            </div>
            <p className="mt-3 text-2xl font-semibold tabular text-[#163c52]">
              {String(value)}
            </p>
          </Card>
        ))}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Link
          href="/pharmacy/stock"
          className="border-l-4 border-[#167d78] bg-white p-5 text-sm font-semibold text-[#163c52] shadow-sm"
        >
          Review batch stock
          <span className="mt-1 block text-xs font-normal text-[#52656e]">
            FEFO, expiry and quantity
          </span>
        </Link>
        <Link
          href="/pharmacy/purchases"
          className="border-l-4 border-[#167d78] bg-white p-5 text-sm font-semibold text-[#163c52] shadow-sm"
        >
          Receive a purchase
          <span className="mt-1 block text-xs font-normal text-[#52656e]">
            Create traceable stock movements
          </span>
        </Link>
        <Link
          href="/pharmacy/medicines"
          className="border-l-4 border-[#167d78] bg-white p-5 text-sm font-semibold text-[#163c52] shadow-sm"
        >
          Medicine catalog
          <span className="mt-1 block text-xs font-normal text-[#52656e]">
            Operational catalog, not clinical classification
          </span>
        </Link>
      </div>
    </>
  );
}

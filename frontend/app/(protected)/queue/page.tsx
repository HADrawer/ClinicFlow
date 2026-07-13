"use client";
import Link from "next/link";
import { useState } from "react";
import { Clock3, Play, SquareCheckBig } from "lucide-react";
import { useApi } from "@/lib/hooks";
import { api } from "@/lib/api";
import type { Appointment } from "@/lib/types";
import { dateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { ErrorMessage, Loading } from "@/components/ui/feedback";
type Queue = {
  id: number;
  appointment_id: number;
  patient_id: number;
  doctor_id: number;
  arrived_at: string;
  priority: number;
  room?: string;
  status: string;
};
export default function QueuePage() {
  const [now] = useState(() => Date.now());
  const queue = useApi<Queue[]>("/appointments/workflow/queue");
  const appointments = useApi<Appointment[]>("/appointments");
  if (queue.loading || appointments.loading) return <Loading />;
  const map = new Map(appointments.data?.map((item) => [item.id, item]));
  async function move(id: number, status: string) {
    await api(`/appointments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason: "Queue workflow" }),
    });
    queue.reload();
    appointments.reload();
  }
  return (
    <>
      <PageHeader
        title="Patient queue"
        description="Arrival order, wait duration, room and next clinical action without unnecessary clinical detail."
      />
      <ErrorMessage message={queue.error || appointments.error} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          [
            "Waiting now",
            queue.data?.filter((item) => item.status === "waiting").length || 0,
          ],
          [
            "In progress",
            queue.data?.filter((item) => item.status === "in_progress")
              .length || 0,
          ],
          [
            "Longest wait",
            `${Math.max(0, ...(queue.data || []).filter((item) => item.status === "waiting").map((item) => Math.floor((now - new Date(item.arrived_at).getTime()) / 60000)))} min`,
          ],
        ].map(([label, value]) => (
          <div
            className="border-t-3 border-[#167d78] bg-white p-4 shadow-[0_1px_2px_rgba(16,33,43,.04)]"
            key={label}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[#52656e]">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular text-[#163c52]">
              {value}
            </p>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader
          title="Current arrivals"
          description="Priority then arrival time"
        />
        <DataTable
          rows={queue.data || []}
          keyOf={(item) => item.id}
          empty="No patients waiting"
          columns={[
            {
              key: "patient",
              header: "Patient",
              render: (item) => {
                const appointment = map.get(item.appointment_id);
                return (
                  <div>
                    <Link
                      href={`/patients/${item.patient_id}`}
                      className="font-semibold text-[#164e67]"
                    >
                      {appointment?.patient.full_name ||
                        `Patient #${item.patient_id}`}
                    </Link>
                    <p className="text-xs text-[#52656e]">
                      {appointment?.service.name || "Scheduled service"}
                    </p>
                  </div>
                );
              },
            },
            {
              key: "arrival",
              header: "Arrival / wait",
              render: (item) => (
                <div>
                  <p className="font-medium tabular">
                    {dateTime(item.arrived_at)}
                  </p>
                  <p className="text-xs font-semibold text-[#9a6417]">
                    <Clock3 className="mr-1 inline" size={12} />
                    {Math.max(
                      0,
                      Math.floor(
                        (now - new Date(item.arrived_at).getTime()) /
                          60000,
                      ),
                    )}{" "}
                    min
                  </p>
                </div>
              ),
            },
            {
              key: "doctor",
              header: "Doctor",
              render: (item) =>
                map.get(item.appointment_id)?.doctor.full_name ||
                `Doctor #${item.doctor_id}`,
            },
            {
              key: "room",
              header: "Room",
              render: (item) => item.room || "Unassigned",
            },
            {
              key: "priority",
              header: "Priority",
              render: (item) =>
                item.priority ? `P${item.priority}` : "Routine",
            },
            {
              key: "status",
              header: "Status",
              render: (item) => <Badge value={item.status} />,
            },
            {
              key: "actions",
              header: "Actions",
              render: (item) => (
                <div className="flex gap-1">
                  {item.status === "waiting" && (
                    <Button
                      className="h-8 px-2"
                      onClick={() => move(item.appointment_id, "in_progress")}
                    >
                      <Play size={14} />
                      Call next
                    </Button>
                  )}
                  {item.status === "in_progress" && (
                    <Button
                      className="h-8 px-2"
                      onClick={() => move(item.appointment_id, "completed")}
                    >
                      <SquareCheckBig size={14} />
                      Complete
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}

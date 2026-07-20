"use client";
import { FormEvent, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { shortDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { Field, Input } from "@/components/ui/input";
import { ErrorMessage, Loading } from "@/components/ui/feedback";
import {MetricStrip} from "@/components/ui/metric-strip";
type Batch = {
  id: number;
  medicine_id: number;
  batch_number: string;
  expiry_date: string;
  quantity_received: number;
  quantity_available: number;
  storage_location?: string;
  status: string;
  quarantined: boolean;
};
type Medicine = {
  id: number;
  generic_name: string;
  brand_name?: string;
  strength: string;
  reorder_level: number;
};
export default function Stock() {
  const stock = useApi<Batch[]>("/pharmacy/stock");
  const medicines = useApi<Medicine[]>("/pharmacy/medicines");
  const [adjust, setAdjust] = useState<Batch | null>(null);
  if (stock.loading || medicines.loading) return <Loading />;
  const map = new Map(medicines.data?.map((item) => [item.id, item]));
  return (
    <>
      <PageHeader
        title="Batch stock"
        description="Expiry-first inventory with immutable movement trace and no negative stock."
      />
      <ErrorMessage message={stock.error || medicines.error} />
      <MetricStrip className="mb-4" items={[{label:"Available units",value:(stock.data||[]).reduce((sum,item)=>sum+item.quantity_available,0)},{label:"Expired units",value:(stock.data||[]).filter(item=>new Date(item.expiry_date)<=new Date()).reduce((sum,item)=>sum+item.quantity_available,0),tone:"danger"},{label:"Low-stock medicines",value:(medicines.data||[]).filter(medicine=>(stock.data||[]).filter(batch=>batch.medicine_id===medicine.id&&new Date(batch.expiry_date)>new Date()).reduce((sum,batch)=>sum+batch.quantity_available,0)<=medicine.reorder_level).length,tone:"warning"}]}/>
      <Card>
        <DataTable
          rows={stock.data || []}
          keyOf={(item) => item.id}
          columns={[
            {
              key: "medicine",
              header: "Medicine",
              render: (item) => {
                const medicine = map.get(item.medicine_id);
                return (
                  <div>
                    <p className="font-semibold text-[#10212b]">
                      {medicine?.generic_name ||
                        `Medicine #${item.medicine_id}`}{" "}
                      · {medicine?.strength}
                    </p>
                    <p className="text-xs text-[#52656e]">
                      {medicine?.brand_name || "Generic"}
                    </p>
                  </div>
                );
              },
            },
            {
              key: "batch",
              header: "Batch / location",
              render: (item) => (
                <div>
                  <p className="font-mono text-xs">{item.batch_number}</p>
                  <p className="text-xs text-[#52656e]">
                    {item.storage_location || "Unassigned"}
                  </p>
                </div>
              ),
            },
            {
              key: "expiry",
              header: "Expiry",
              render: (item) => {
                const expired = new Date(item.expiry_date) <= new Date();
                const near =
                  !expired &&
                  new Date(item.expiry_date).getTime() - Date.now() <
                    90 * 86400000;
                return (
                  <div>
                    <p
                      className={`font-medium tabular ${expired ? "text-[#b74242]" : near ? "text-[#9a6417]" : ""}`}
                    >
                      {shortDate(item.expiry_date)}
                    </p>
                    <Badge
                      value={
                        expired ? "expired" : near ? "pending" : "accepted"
                      }
                    />
                  </div>
                );
              },
            },
            {
              key: "quantity",
              header: "Available / received",
              render: (item) => (
                <div className="tabular">
                  <strong>{item.quantity_available}</strong>
                  <span className="text-[#52656e]">
                    {" "}
                    / {item.quantity_received}
                  </span>
                </div>
              ),
            },
            {
              key: "state",
              header: "Stock state",
              render: (item) => (
                <Badge value={item.quarantined ? "revoked" : item.status} />
              ),
            },
            {
              key: "actions",
              header: "Actions",
              render: (item) => (
                <Button
                  className="h-8 px-2"
                  variant="secondary"
                  onClick={() => setAdjust(item)}
                >
                  <SlidersHorizontal size={14} />
                  Adjust
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <Modal
        open={Boolean(adjust)}
        onClose={() => setAdjust(null)}
        title={`Adjust batch ${adjust?.batch_number || ""}`}
        size="max-w-md"
      >
        {adjust && (
          <Adjustment
            batch={adjust}
            onCancel={() => setAdjust(null)}
            onSaved={() => {
              setAdjust(null);
              stock.reload();
            }}
          />
        )}
      </Modal>
    </>
  );
}
function Adjustment({
  batch,
  onCancel,
  onSaved,
}: {
  batch: Batch;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/pharmacy/stock/${batch.id}/adjust`, {
        method: "POST",
        body: JSON.stringify({ quantity: Number(quantity), reason }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to adjust stock");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="space-y-4 p-5" onSubmit={submit}>
      <ErrorMessage message={error} />
      <p className="text-sm text-[#52656e]">
        Current available quantity:{" "}
        <strong className="tabular text-[#10212b]">
          {batch.quantity_available}
        </strong>
      </p>
      <Field
        label="Quantity change"
        required
        hint="Positive adds stock; negative removes stock."
      >
        <Input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
      </Field>
      <Field label="Reason" required>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          minLength={3}
        />
      </Field>
      <div className="flex justify-end gap-2 border-t border-[#d6e1de] pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={busy}>
          {busy ? "Recording…" : "Record adjustment"}
        </Button>
      </div>
    </form>
  );
}

"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Field, Modal, toast } from "@/components/ui";
import { uid, useCurrentUser, useDB, useStore } from "@/lib/store";
import { byId } from "@/lib/domain";
import { formatNumber, todayISO } from "@/lib/format";
import { MISSIONS, aviationAssets } from "@/lib/maintenance";
import type { FlightLog } from "@/lib/types";

/** Records a flight: adds a FlightLog and increments the aircraft's hours & cycles. */
export function FlightLogDialog({ open, onClose, assetId }: { open: boolean; onClose: () => void; assetId?: string }) {
  const db = useDB();
  const user = useCurrentUser()!;
  const mutate = useStore((s) => s.mutate);
  const fleet = aviationAssets(db).filter((a) => a.status !== "Diusulkan Hapus");
  const [aid, setAid] = useState(assetId ?? "");
  const [date, setDate] = useState(todayISO());
  const [mission, setMission] = useState<FlightLog["mission"]>("Latihan");
  const [hours, setHours] = useState("1,5");
  const [cycles, setCycles] = useState("1");
  const [pilot, setPilot] = useState("");
  const [route, setRoute] = useState("");
  const [touched, setTouched] = useState(false);

  const selected = assetId ?? aid;
  const asset = byId(db.assets, selected);
  const h = parseFloat(hours.replace(",", "."));
  const c = parseInt(cycles, 10);
  const errors: Record<string, string> = {};
  if (!selected) errors.asset = "Pilih pesawat.";
  if (!(h > 0 && h <= 30)) errors.hours = "Isi 0,1 – 30 jam.";
  if (!(c >= 0 && c <= 50)) errors.cycles = "Isi 0 – 50.";
  if (!date) errors.date = "Isi tanggal.";
  else if (date > todayISO()) errors.date = "Tanggal tidak boleh di masa depan.";
  if (pilot.trim().length < 3) errors.pilot = "Isi nama penerbang / operator.";

  const close = () => {
    setTouched(false); setHours("1,5"); setCycles("1"); setPilot(""); setRoute(""); setDate(todayISO());
    if (!assetId) setAid("");
    onClose();
  };
  const save = () => {
    setTouched(true);
    if (Object.keys(errors).length || !asset) return;
    mutate(
      (d) => {
        d.flightLogs.push({ id: uid("fl"), assetId: asset.id, date, mission, hours: h, cycles: c, pilot: pilot.trim(), route: route.trim() || "-", createdBy: user.id });
        const a = d.assets.find((x) => x.id === asset.id);
        if (a?.aviation) {
          a.aviation.flightHours = Math.round((a.aviation.flightHours + h) * 10) / 10;
          a.aviation.cycles += c;
          a.updatedAt = new Date().toISOString();
        }
      },
      { action: "Mencatat", module: "Jam Terbang", ref: asset.registration ?? asset.code, detail: `${formatNumber(h, 1)} jam · ${mission}` },
    );
    toast.success(`Penerbangan ${asset.registration ?? asset.code} dicatat (${formatNumber(h, 1)} jam)`);
    close();
  };
  const err = (k: string) => (touched ? errors[k] : undefined);

  const av = asset?.aviation;
  const next = av ? av.lastInspectionHours + av.inspectionIntervalHours : 0;
  const afterRemaining = av && h > 0 ? next - (av.flightHours + h) : undefined;

  return (
    <Modal open={open} onClose={close} title="Catat penerbangan" subtitle="Jam terbang & siklus pesawat akan bertambah" size="lg"
      footer={<><button className="btn btn-plain" onClick={close}>Batal</button><button className="btn btn-primary" onClick={save}><Icon name="check" />Simpan</button></>}>
      {av?.airworthiness === "Tidak Laik" && (
        <div className="alert critical"><Icon name="alert" />Pesawat ini berstatus <b>&nbsp;Tidak Laik&nbsp;</b>. Pastikan penerbangan ini adalah uji terbang yang diizinkan.</div>
      )}
      {afterRemaining !== undefined && afterRemaining <= 0 && (
        <div className="alert warning"><Icon name="alert" />Setelah penerbangan ini, pesawat melewati batas inspeksi berkala ({formatNumber(next)} jam).</div>
      )}
      <div className="form-grid">
        {!assetId && (
          <Field label="Pesawat" required error={err("asset")} span2>
            <select className="select" value={aid} onChange={(e) => setAid(e.target.value)}>
              <option value="">— Pilih pesawat —</option>
              {fleet.map((a) => <option key={a.id} value={a.id}>{a.registration} · {a.model} ({a.aviation!.airworthiness})</option>)}
            </select>
          </Field>
        )}
        <Field label="Tanggal" required error={err("date")}><input type="date" className="input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Misi" required>
          <select className="select" value={mission} onChange={(e) => setMission(e.target.value as FlightLog["mission"])}>{MISSIONS.map((m) => <option key={m}>{m}</option>)}</select>
        </Field>
        <Field label="Jam terbang" required error={err("hours")}><input className="input" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
        <Field label="Siklus (pendaratan)" required error={err("cycles")}><input className="input" inputMode="numeric" value={cycles} onChange={(e) => setCycles(e.target.value)} /></Field>
        <Field label="Penerbang / operator" required error={err("pilot")}><input className="input" value={pilot} onChange={(e) => setPilot(e.target.value)} placeholder="mis. Rizky Hidayat" /></Field>
        <Field label="Rute / area"><input className="input" value={route} onChange={(e) => setRoute(e.target.value)} placeholder="mis. Semarang – Makassar" /></Field>
      </div>
    </Modal>
  );
}

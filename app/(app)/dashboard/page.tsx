"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import "@/components/charts";
import { gridColor } from "@/components/charts";
import { Icon, type IconName } from "@/components/Icon";
import { Badge, EmptyState, Panel, StatCard } from "@/components/ui";
import { useCurrentUser, useDB } from "@/lib/store";
import { can } from "@/lib/permissions";
import {
  PRIORITY_TONE, WO_STATUS_LABEL, WO_STATUS_TONE, byId, depreciation, inspectionStatus, lowStockParts, pendingApprovalsFor, userName,
} from "@/lib/domain";
import { daysUntil, formatDate, formatDateLong, formatNumber, formatRupiahShort, monthLabel, timeAgo } from "@/lib/format";
import { SERIES, STATUS_COLORS, inScope, lastMonths, sum, unitScope } from "@/lib/reports";
import type { Airworthiness, Category } from "@/lib/types";

const GROUPS: Category["group"][] = ["Alutsista Udara", "Peralatan", "Kendaraan", "Properti", "Komponen"];
const AW: { key: Airworthiness; color: string }[] = [
  { key: "Laik", color: STATUS_COLORS.good },
  { key: "Laik Terbatas", color: STATUS_COLORS.warning },
  { key: "Tidak Laik", color: STATUS_COLORS.critical },
];

interface Attention { key: string; tone: "warning" | "critical"; icon: IconName; title: string; meta: string; href: string }

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

export default function DashboardPage() {
  const db = useDB();
  const user = useCurrentUser()!;
  const router = useRouter();
  const [unitId, setUnitId] = useState("");

  const d = useMemo(() => {
    const scope = unitScope(db, unitId);
    const assets = db.assets.filter((a) => a.status !== "Dihapus" && inScope(scope, a.unitId));
    const assetIds = new Set(assets.map((a) => a.id));
    const totalValue = sum(assets, (a) => a.acquisitionValue);
    const bookValue = sum(assets, (a) => depreciation(a).bookValue);
    const fleet = assets.filter((a) => a.aviation);
    const laik = fleet.filter((a) => a.aviation!.airworthiness === "Laik").length;
    const wos = scope ? db.workOrders.filter((w) => assetIds.has(w.assetId)) : db.workOrders;
    const activeWO = wos.filter((w) => ["baru", "dikerjakan", "menunggu_part"].includes(w.status));
    const overdueWO = activeWO.filter((w) => daysUntil(w.dueDate) < 0);

    const byGroup = GROUPS.map((g) => sum(assets.filter((a) => db.categories.find((c) => c.id === a.categoryId)?.group === g), (a) => a.acquisitionValue));

    const fleetCats = (["pesawat", "helikopter", "nirawak"] as const).map((cid) => ({
      label: db.categories.find((c) => c.id === cid)!.name,
      counts: AW.map((s) => fleet.filter((a) => a.categoryId === cid && a.aviation!.airworthiness === s.key).length),
    }));

    const m12 = lastMonths(12);
    const fleetIds = new Set(fleet.map((a) => a.id));
    const hours = m12.map((m) => sum(db.flightLogs.filter((f) => fleetIds.has(f.assetId) && f.date.startsWith(m.key)), (f) => f.hours));

    const m6 = lastMonths(6);
    const woCreated = m6.map((m) => wos.filter((w) => w.createdAt.slice(0, 7) === m.key).length);
    const woDone = m6.map((m) => wos.filter((w) => w.completedAt?.slice(0, 7) === m.key).length);

    // Needs attention
    const att: Attention[] = [];
    for (const w of overdueWO) {
      const a = byId(db.assets, w.assetId);
      att.push({ key: "wo" + w.id, tone: "critical", icon: "clipboard", title: `WO lewat target: ${w.no}`, meta: `${a?.name ?? "-"} · target ${formatDate(w.dueDate)}`, href: `/pemeliharaan/detail?id=${w.id}` });
    }
    for (const a of fleet) {
      const s = inspectionStatus(a);
      if (!s) continue;
      if (s.remainingHours <= a.aviation!.inspectionIntervalHours * 0.1) {
        att.push({ key: "insp" + a.id, tone: s.remainingHours <= 0 ? "critical" : "warning", icon: "plane", title: s.remainingHours <= 0 ? `Inspeksi berkala terlewat: ${a.registration}` : `Inspeksi berkala segera: ${a.registration}`, meta: s.remainingHours <= 0 ? `Lewat ${formatNumber(-s.remainingHours, 1)} jam terbang` : `Sisa ${formatNumber(s.remainingHours, 1)} jam terbang`, href: `/kelaikan/detail?id=${a.id}` });
      }
      if (s.certDays <= 30) {
        att.push({ key: "cert" + a.id, tone: s.certDays < 0 ? "critical" : "warning", icon: "shield", title: s.certDays < 0 ? `Sertifikat kelaikan kedaluwarsa: ${a.registration}` : `Sertifikat kelaikan berakhir: ${a.registration}`, meta: s.certDays < 0 ? `Berakhir ${formatDate(a.aviation!.certificateExpiry)}` : `${s.certDays} hari lagi · ${formatDate(a.aviation!.certificateExpiry)}`, href: `/kelaikan/detail?id=${a.id}` });
      }
    }
    for (const p of lowStockParts(db)) {
      att.push({ key: "prt" + p.id, tone: p.stock === 0 ? "critical" : "warning", icon: "package", title: `Stok di bawah minimum: ${p.name}`, meta: `${p.partNumber} · stok ${p.stock} / min. ${p.minStock} ${p.uom}`, href: `/suku-cadang/detail?id=${p.id}` });
    }
    for (const t of db.transfers) {
      if (t.type === "pinjam" && t.status === "diserahkan" && t.returnDate && daysUntil(t.returnDate) < 0 && t.assetIds.some((id) => assetIds.has(id) || !scope)) {
        att.push({ key: "trf" + t.id, tone: "critical", icon: "transfer", title: `Peminjaman lewat jatuh tempo: ${t.no}`, meta: `Harus kembali ${formatDate(t.returnDate)}`, href: `/mutasi/detail?id=${t.id}` });
      }
    }
    att.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "critical" ? -1 : 1));

    return { assets, totalValue, bookValue, fleet, laik, activeWO, overdueWO, byGroup, fleetCats, m12, hours, m6, woCreated, woDone, att, wos };
  }, [db, unitId]);

  const pending = pendingApprovalsFor(db, user);
  const pendingCount = pending.transfers.length + pending.disposals.length;
  const readiness = d.fleet.length ? Math.round((d.laik / d.fleet.length) * 100) : 0;
  const groupTotal = sum(d.byGroup, (v) => v);
  const myWOs = db.workOrders.filter((w) => w.assigneeId === user.id && ["baru", "dikerjakan", "menunggu_part"].includes(w.status));

  const quick: { href: string; label: string; icon: IconName; show: boolean }[] = [
    { href: "/aset/baru", label: "Daftarkan aset", icon: "plus", show: can(user.role, "asset.create") },
    { href: "/scan", label: "Scan QR aset", icon: "scan", show: true },
    { href: "/pemeliharaan/baru", label: "Buat work order", icon: "clipboard", show: can(user.role, "wo.create") },
    { href: "/kelaikan", label: "Catat jam terbang", icon: "plane", show: can(user.role, "flight.log") },
    { href: "/persetujuan", label: "Kotak persetujuan", icon: "inbox", show: user.role === "pimpinan" || user.role === "auditor" },
    { href: "/laporan", label: "Lihat laporan", icon: "file", show: can(user.role, "report.view") },
  ];

  const tooltipRupiah = { callbacks: { label: (c: { label: string; parsed: number }) => ` ${c.label}: ${formatRupiahShort(c.parsed)}` } };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{greeting()}, {user.name}</h1>
          <div className="subtitle">{formatDateLong(new Date())} · Ringkasan portofolio aset{unitId ? ` ${db.units.find((u) => u.id === unitId)?.name}` : " seluruh satuan"}</div>
        </div>
        <div className="page-actions">
          <select className="select" style={{ minWidth: 220 }} value={unitId} onChange={(e) => setUnitId(e.target.value)} aria-label="Filter satuan">
            <option value="">Semua satuan</option>
            {db.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      <div className="kpi-grid">
        <StatCard label="Total aset" icon="box" value={formatNumber(d.assets.length)} sub={<>Nilai perolehan {formatRupiahShort(d.totalValue)}<br />Nilai buku {formatRupiahShort(d.bookValue)}</>} onClick={() => router.push("/aset")} />
        <StatCard label="Kesiapan armada" icon="plane" accent={readiness >= 75 ? "#2F7D5B" : readiness >= 50 ? "#B57A1F" : "#A8503A"} value={`${readiness}%`} sub={`${d.laik} dari ${d.fleet.length} pesawat, heli & UAV berstatus Laik`} onClick={() => router.push("/kelaikan")} />
        <StatCard label="Work order aktif" icon="clipboard" accent={d.overdueWO.length ? "#A8503A" : undefined} value={formatNumber(d.activeWO.length)} sub={d.overdueWO.length ? <span className="text-critical">{d.overdueWO.length} lewat target selesai</span> : "Tidak ada yang lewat target"} onClick={() => router.push("/pemeliharaan")} />
        <StatCard label="Menunggu persetujuan saya" icon="inbox" accent={pendingCount ? "#B57A1F" : undefined} value={formatNumber(pendingCount)} sub={`${pending.transfers.length} mutasi/pinjam · ${pending.disposals.length} penghapusan`} onClick={() => router.push("/persetujuan")} />
      </div>

      <div className="row" style={{ marginBottom: 16, gap: 8 }}>
        {quick.filter((q) => q.show).map((q) => (
          <Link key={q.href} href={q.href} className="btn btn-secondary btn-sm"><Icon name={q.icon} />{q.label}</Link>
        ))}
      </div>

      {user.role === "teknisi" && (
        <Panel title="Tugas saya" subtitle="Work order yang ditugaskan kepada Anda" style={{ marginBottom: 16 }} actions={<Link className="link small" href="/pemeliharaan">Semua WO</Link>}>
          {myWOs.length === 0 ? <EmptyState icon="checkCircle" title="Tidak ada tugas terbuka" /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Nomor WO</th><th>Aset</th><th>Pekerjaan</th><th>Prioritas</th><th>Target</th><th>Status</th></tr></thead>
              <tbody>
                {myWOs.map((w) => {
                  const a = byId(db.assets, w.assetId);
                  const late = daysUntil(w.dueDate) < 0;
                  return (
                    <tr key={w.id} className="clickable" onClick={() => router.push(`/pemeliharaan/detail?id=${w.id}`)}>
                      <td className="cell-strong">{w.no}</td>
                      <td>{a?.name}<div className="cell-sub">{a?.code}</div></td>
                      <td>{w.title}</td>
                      <td><Badge tone={PRIORITY_TONE[w.priority]}>{w.priority}</Badge></td>
                      <td className={late ? "text-critical" : ""}>{formatDate(w.dueDate)}</td>
                      <td><Badge tone={WO_STATUS_TONE[w.status]}>{WO_STATUS_LABEL[w.status]}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </Panel>
      )}

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Panel title="Nilai aset per kelompok" subtitle="Nilai perolehan aset aktif">
          <div className="row" style={{ alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ position: "relative", width: 180, height: 180, flexShrink: 0 }}>
              <Doughnut
                data={{ labels: GROUPS, datasets: [{ data: d.byGroup, backgroundColor: SERIES, borderColor: "#fff", borderWidth: 2, hoverOffset: 4 }] }}
                options={{ cutout: "68%", plugins: { tooltip: tooltipRupiah } }}
              />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 17 }}>{formatRupiahShort(groupTotal)}</div>
                <div className="muted" style={{ fontSize: 10.5 }}>total</div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 9 }}>
              {GROUPS.map((g, i) => (
                <div key={g} className="row" style={{ justifyContent: "space-between", fontSize: 12.5, flexWrap: "nowrap" }}>
                  <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}><span className="legend-dot" style={{ background: SERIES[i] }} /><b>{g}</b></span>
                  <span className="muted nowrap">{formatRupiahShort(d.byGroup[i])} · {groupTotal ? Math.round((d.byGroup[i] / groupTotal) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Status kelaikan armada" subtitle="Jumlah unit per status kelaikan" actions={
          <div className="legend-row">{AW.map((s) => <span key={s.key} className="legend-item"><span className="legend-dot" style={{ background: s.color }} />{s.key}</span>)}</div>
        }>
          <div className="chart-box sm">
            <Bar
              data={{
                labels: d.fleetCats.map((c) => c.label),
                datasets: AW.map((s, i) => ({ label: s.key, data: d.fleetCats.map((c) => c.counts[i]), backgroundColor: s.color, borderColor: "#fff", borderWidth: { right: 2 }, borderSkipped: false, borderRadius: 0, maxBarThickness: 30 })),
              }}
              options={{
                indexAxis: "y",
                scales: { x: { stacked: true, grid: { color: gridColor }, ticks: { precision: 0 } }, y: { stacked: true, grid: { display: false } } },
                plugins: { tooltip: { mode: "index" } },
              }}
            />
          </div>
        </Panel>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Panel title="Jam terbang per bulan" subtitle={`Total 12 bulan terakhir: ${formatNumber(sum(d.hours, (h) => h), 1)} jam`}>
          <div className="chart-box">
            <Bar
              data={{ labels: d.m12.map((m) => monthLabel(m.year, m.month)), datasets: [{ label: "Jam terbang", data: d.hours.map((h) => Math.round(h * 10) / 10), backgroundColor: SERIES[0], borderRadius: 4, maxBarThickness: 26 }] }}
              options={{ scales: { x: { grid: { display: false } }, y: { grid: { color: gridColor }, beginAtZero: true } }, plugins: { tooltip: { callbacks: { label: (c) => ` ${formatNumber(c.parsed.y ?? 0, 1)} jam` } } } }}
            />
          </div>
        </Panel>

        <Panel title="Work order dibuat vs selesai" subtitle="6 bulan terakhir" actions={
          <div className="legend-row">
            <span className="legend-item"><span className="legend-dot" style={{ background: SERIES[0] }} />Dibuat</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: SERIES[1] }} />Selesai</span>
          </div>
        }>
          <div className="chart-box">
            <Bar
              data={{
                labels: d.m6.map((m) => monthLabel(m.year, m.month)),
                datasets: [
                  { label: "Dibuat", data: d.woCreated, backgroundColor: SERIES[0], borderRadius: 4, maxBarThickness: 22 },
                  { label: "Selesai", data: d.woDone, backgroundColor: SERIES[1], borderRadius: 4, maxBarThickness: 22 },
                ],
              }}
              options={{ datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.9 } }, scales: { x: { grid: { display: false } }, y: { grid: { color: gridColor }, beginAtZero: true, ticks: { precision: 0 } } }, plugins: { tooltip: { mode: "index", intersect: false } } }}
            />
          </div>
        </Panel>
      </div>

      <div className="layout-main-side">
        <Panel title="Perlu perhatian" subtitle={`${d.att.length} hal memerlukan tindak lanjut`}>
          {d.att.length === 0 ? <EmptyState icon="checkCircle" title="Semua terkendali">Tidak ada hal yang memerlukan tindak lanjut.</EmptyState> : (
            <div>
              {d.att.slice(0, 12).map((a) => (
                <AttentionRow key={a.key} item={a} />
              ))}
              {d.att.length > 12 && <div className="muted small" style={{ marginTop: 8 }}>+{d.att.length - 12} lainnya</div>}
            </div>
          )}
        </Panel>

        <Panel title="Aktivitas terbaru" actions={can(user.role, "audit.view") ? <Link className="link small" href="/audit">Jejak audit</Link> : undefined}>
          <div className="timeline">
            {db.audit.slice(0, 9).map((e) => (
              <div key={e.id} className="timeline-item">
                <div className="timeline-dot" />
                <div>
                  <div className="timeline-text">{e.action} · {e.module}{e.ref ? ` ${e.ref}` : ""}</div>
                  <div className="timeline-meta">{userName(db, e.userId)} · {timeAgo(e.at)}{e.detail ? ` · ${e.detail}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function AttentionRow({ item }: { item: Attention }): ReactNode {
  return (
    <Link href={item.href} className="row" style={{ padding: "10px 0", borderBottom: "1px solid var(--panel)", flexWrap: "nowrap", alignItems: "flex-start" }}>
      <div className="thumb" style={{ width: 34, height: 34, color: item.tone === "critical" ? "var(--critical)" : "var(--warning)" }}><Icon name={item.icon} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="cell-strong" style={{ fontSize: 13 }}>{item.title}</div>
        <div className="cell-sub">{item.meta}</div>
      </div>
      <Badge tone={item.tone}>{item.tone === "critical" ? "Kritis" : "Perhatian"}</Badge>
    </Link>
  );
}

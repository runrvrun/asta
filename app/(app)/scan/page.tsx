"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Badge, EmptyState, KV, PageHeader, Panel, toast } from "@/components/ui";
import { CATEGORY_ICON, Icon } from "@/components/Icon";
import { useCurrentUser, useDB } from "@/lib/store";
import { can } from "@/lib/permissions";
import {
  AIRWORTHINESS_TONE, ASSET_STATUS_TONE, CONDITION_TONE, WO_STATUS_LABEL, WO_STATUS_TONE,
  categoryName, locationName, unitName, userName,
} from "@/lib/domain";
import { AVIATION_CATEGORIES } from "@/lib/seed";
import { formatDateTime, timeAgo } from "@/lib/format";
import type { Asset, DB } from "@/lib/types";
import s from "./scan.module.css";

interface ScanRecord { code: string; at: string; assetId: string | null }
type CamState = "idle" | "starting" | "on" | "error";

const HISTORY_KEY = "asta-scan-history";

function findAsset(db: DB, raw: string): Asset | undefined {
  let code = raw.trim();
  // Accept links that carry the code, e.g. ".../aset/detail?id=..." or "...?code=PSW-..."
  const m = code.match(/[?&](?:code|kode)=([^&]+)/i);
  if (m) code = decodeURIComponent(m[1]);
  const idMatch = code.match(/[?&]id=([^&]+)/i);
  if (idMatch) return db.assets.find((a) => a.id === decodeURIComponent(idMatch[1]));
  const c = code.toLowerCase();
  return db.assets.find((a) => a.code.toLowerCase() === c || a.registration?.toLowerCase() === c);
}

type TorchCaps = MediaTrackCapabilities & { torch?: boolean };

export default function ScanPage() {
  const db = useDB();
  const user = useCurrentUser()!;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [cam, setCam] = useState<CamState>("idle");
  const [camError, setCamError] = useState("");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<{ code: string; assetId: string | null } | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(HISTORY_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load from sessionStorage after mount
      if (raw) setHistory(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const handleCode = useCallback((raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const asset = findAsset(db, code);
    setResult({ code, assetId: asset?.id ?? null });
    setHistory((h) => {
      const next = [{ code: asset?.code ?? code, at: new Date().toISOString(), assetId: asset?.id ?? null }, ...h.filter((x) => x.code !== (asset?.code ?? code))].slice(0, 10);
      try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    if (asset) toast.success(`Aset ditemukan: ${asset.code}`);
    else toast.error(`Kode “${code}” tidak terdaftar`);
  }, [db]);
  const handleCodeRef = useRef(handleCode);
  useEffect(() => { handleCodeRef.current = handleCode; }, [handleCode]);

  const startCamera = async () => {
    setCamError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCam("error");
      setCamError("Browser ini tidak mendukung akses kamera. Gunakan input manual atau buka melalui HTTPS.");
      return;
    }
    setCam("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();
      const track = stream.getVideoTracks()[0];
      const caps = (track?.getCapabilities?.() ?? {}) as TorchCaps;
      setTorchSupported(!!caps.torch);
      setCam("on");
      setResult(null);
      // Decode loop: grab a downscaled frame, run jsQR, repeat until a code is found or the camera stops.
      const loop = () => {
        if (!streamRef.current) return;
        if (video.readyState >= 2 && video.videoWidth) {
          const canvas = canvasRef.current ?? (canvasRef.current = document.createElement("canvas"));
          const scale = Math.min(1, 640 / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (found?.data) {
              if (navigator.vibrate) navigator.vibrate(80);
              stopCamera();
              setCam("idle");
              handleCodeRef.current(found.data);
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      stopCamera();
      setCam("error");
      const name = (err as DOMException)?.name;
      setCamError(
        name === "NotAllowedError" ? "Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser, lalu coba lagi."
          : name === "NotFoundError" || name === "OverconstrainedError" ? "Kamera tidak ditemukan pada perangkat ini. Gunakan input manual atau mode demo."
            : "Kamera tidak dapat dibuka. Pastikan tidak sedang dipakai aplikasi lain.",
      );
    }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(!torchOn);
    } catch {
      toast.error("Lampu kilat tidak dapat diaktifkan");
    }
  };

  const asset = result?.assetId ? db.assets.find((a) => a.id === result.assetId) : undefined;
  const demoAssets = db.assets.filter((a) => a.status !== "Dihapus").slice(0, 60);

  return (
    <>
      <PageHeader title="Scan QR Aset" subtitle="Pindai label QR untuk membuka data aset secara cepat di lapangan" />
      <div className={s.grid}>
        <div className="stack">
          <Panel>
            <div className={s.camera}>
              <video ref={videoRef} className={s.video} muted playsInline style={{ display: cam === "on" ? "block" : "none" }} />
              {cam === "on" ? (
                <>
                  <div className={s.top}>
                    <button className={s.pill} onClick={() => { stopCamera(); setCam("idle"); }}><Icon name="x" />Tutup</button>
                    {torchSupported && <button className={`${s.pill} ${torchOn ? s.pillActive : ""}`} onClick={toggleTorch}><Icon name="alert" />{torchOn ? "Lampu nyala" : "Lampu"}</button>}
                  </div>
                  <div className={s.frame}>
                    <div className={`${s.corner} ${s.tl}`} /><div className={`${s.corner} ${s.tr}`} /><div className={`${s.corner} ${s.bl}`} /><div className={`${s.corner} ${s.br}`} />
                    <div className={s.line} />
                  </div>
                  <div className={s.hint}>Arahkan kamera ke label QR aset</div>
                </>
              ) : (
                <div className={s.idle}>
                  <Icon name={cam === "error" ? "alert" : "camera"} />
                  {cam === "starting" ? <div>Membuka kamera…</div> : cam === "error" ? <div>{camError}</div> : <div>Kamera belum aktif</div>}
                  {cam !== "starting" && (
                    <button className="btn btn-primary" onClick={startCamera}><Icon name="scan" />{cam === "error" ? "Coba lagi" : "Mulai Pindai"}</button>
                  )}
                </div>
              )}
            </div>

            <form className="row" style={{ marginTop: 14, flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); handleCode(manual); }}>
              <input className="input" style={{ flex: 1 }} value={manual} onChange={(e) => setManual(e.target.value.toUpperCase())} placeholder="Ketik kode aset atau nomor registrasi" aria-label="Kode aset" />
              <button className="btn btn-primary" type="submit" disabled={!manual.trim()}>Cari</button>
            </form>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Coba demo (tanpa kamera)</label>
              <select className="select" value="" onChange={(e) => { if (e.target.value) { setManual(e.target.value); handleCode(e.target.value); } }}>
                <option value="">— Simulasikan pindai label aset —</option>
                {demoAssets.map((a) => <option key={a.id} value={a.code}>{a.code} · {a.name}</option>)}
              </select>
              <div className="field-hint">Atau buka label QR dari halaman detail aset di perangkat lain, lalu pindai dengan kamera.</div>
            </div>
          </Panel>

          <Panel title="Riwayat Pindai" subtitle="Tersimpan selama sesi browser ini">
            {history.length === 0 ? <div className="muted small">Belum ada aset yang dipindai.</div> : history.map((h) => {
              const a = h.assetId ? db.assets.find((x) => x.id === h.assetId) : undefined;
              return (
                <div key={h.code + h.at} className={s.histItem} onClick={() => { setManual(h.code); handleCode(h.code); }}>
                  <div className="thumb"><Icon name={a ? CATEGORY_ICON[a.categoryId] : "alert"} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cell-strong">{a ? a.name : "Tidak terdaftar"}</div>
                    <div className="cell-sub">{h.code} · {timeAgo(h.at)}</div>
                  </div>
                  <Icon name="chevronRight" size={16} />
                </div>
              );
            })}
            {history.length > 0 && <button className="btn btn-plain btn-sm" style={{ marginTop: 10 }} onClick={() => { setHistory([]); try { sessionStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ } }}>Bersihkan riwayat</button>}
          </Panel>
        </div>

        <div>
          {!result ? (
            <div className="panel"><EmptyState icon="scan" title="Belum ada hasil pindai">Pindai label QR atau masukkan kode aset untuk menampilkan detail.</EmptyState></div>
          ) : !asset ? (
            <div className="panel">
              <EmptyState icon="alert" title="Aset tidak ditemukan">Kode <b className="mono">{result.code}</b> tidak terdaftar di sistem. Periksa kembali label atau ketik kode secara manual.</EmptyState>
              {can(user.role, "asset.create") && <div className="row" style={{ justifyContent: "center" }}><Link className="btn btn-secondary" href="/aset/baru"><Icon name="plus" />Daftarkan aset baru</Link></div>}
            </div>
          ) : (
            <ScanResult db={db} asset={asset} role={user.role} />
          )}
        </div>
      </div>
    </>
  );
}

function ScanResult({ db, asset: a, role }: { db: DB; asset: Asset; role: import("@/lib/types").Role }) {
  const wos = db.workOrders.filter((w) => w.assetId === a.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt)).slice(0, 3);
  const activity = db.audit.filter((e) => e.ref === a.code || (a.registration && e.ref === a.registration)).slice(0, 4);
  const aviation = AVIATION_CATEGORIES.includes(a.categoryId);
  return (
    <div className="panel">
      <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap", gap: 14, marginBottom: 14 }}>
        <div className="thumb lg"><Icon name={CATEGORY_ICON[a.categoryId]} /></div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 16.5, fontWeight: 700, color: "var(--navy)" }}>{a.name}</div>
          <div className="cell-sub" style={{ fontWeight: 600 }}>{a.code}{a.registration ? ` · ${a.registration}` : ""}</div>
          <div className="row" style={{ gap: 6, marginTop: 8 }}>
            <Badge tone={ASSET_STATUS_TONE[a.status]}>{a.status}</Badge>
            <Badge tone={CONDITION_TONE[a.condition]}>{a.condition}</Badge>
            {a.aviation && <Badge tone={AIRWORTHINESS_TONE[a.aviation.airworthiness]}>{a.aviation.airworthiness}</Badge>}
          </div>
        </div>
      </div>
      <div className="kv-grid">
        <KV label="Kategori">{categoryName(db, a.categoryId)}</KV>
        <KV label="Merek / Model">{a.brand !== "-" ? `${a.brand} ${a.model}` : a.model}</KV>
        <KV label="Satuan">{unitName(db, a.unitId)}</KV>
        <KV label="Lokasi">{locationName(db, a.locationId)}</KV>
        <KV label="Penanggung Jawab">{userName(db, a.picId)}</KV>
        {a.aviation ? <KV label="Jam Terbang">{a.aviation.flightHours.toLocaleString("id-ID")} jam</KV> : <KV label="Tahun">{a.year}</KV>}
      </div>

      <div className={s.quick}>
        <Link className={s.qa} href={`/aset/detail?id=${a.id}`}><Icon name="eye" />Lihat detail</Link>
        {can(role, "wo.create") && <Link className={s.qa} href={`/pemeliharaan/baru?assetId=${a.id}`}><Icon name="wrench" />Buat WO</Link>}
        {aviation && can(role, "flight.log") && <Link className={s.qa} href={`/kelaikan/detail?id=${a.id}`}><Icon name="clock" />Catat jam terbang</Link>}
        {can(role, "transfer.create") && a.status === "Aktif" && <Link className={s.qa} href={`/mutasi/baru?assetId=${a.id}`}><Icon name="transfer" />Ajukan mutasi</Link>}
      </div>

      <div className="section-title" style={{ fontSize: 13.5 }}>Aktivitas Terakhir</div>
      {wos.length === 0 && activity.length === 0 && <div className="muted small" style={{ marginTop: 6 }}>Belum ada aktivitas tercatat.</div>}
      <div className="timeline" style={{ marginTop: 10 }}>
        {wos.map((w) => (
          <div key={w.id} className="timeline-item">
            <div className="timeline-dot" />
            <div>
              <div className="timeline-text"><Link className="link" style={{ fontWeight: 600 }} href={`/pemeliharaan/detail?id=${w.id}`}>{w.no}</Link> · {w.title} <Badge tone={WO_STATUS_TONE[w.status]}>{WO_STATUS_LABEL[w.status]}</Badge></div>
              <div className="timeline-meta">{formatDateTime(w.createdAt)}</div>
            </div>
          </div>
        ))}
        {activity.map((e) => (
          <div key={e.id} className="timeline-item">
            <div className="timeline-dot pending" />
            <div>
              <div className="timeline-text">{e.action}{e.detail ? ` — ${e.detail}` : ""}</div>
              <div className="timeline-meta">{formatDateTime(e.at)} · {userName(db, e.userId)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import QR from "qrcode";

/** Renders `value` as a QR image. Asset labels encode the asset code (e.g. "PSW-1989-0001"). */
export function QRCode({ value, size = 150 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    QR.toDataURL(value, { margin: 1, width: size * 2, color: { dark: "#0B2A4A", light: "#FFFFFF" } }).then(setSrc).catch(() => setSrc(""));
  }, [value, size]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={`QR ${value}`} width={size} height={size} /> : <div style={{ width: size, height: size }} />;
}

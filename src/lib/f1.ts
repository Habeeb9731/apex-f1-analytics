import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api";
import type { Driver } from "@/api";

export function useData<T>(key: unknown[], path: string, params: Record<string, any> = {}) {
  return useQuery({
    queryKey: [path, params, ...key],
    queryFn: ({ signal }) => api<T>(path, params, signal),
    enabled: Object.values(params).every((x) => x !== undefined),
  });
}

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/ grand prix/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }) =>
  new Date(iso).toLocaleDateString("en-GB", opts);

// Candidate photo URLs for a driver, best first.
// 1. OpenF1's link at a sharper size ("1col" is only 93px). The "d_driver_fallback_image" segment is dropped so a
//    missing photo 404s instead of silently returning F1's grey silhouette (which happens for some rookies).
// 2. F1's newer image CDN, face-cropped to a head-and-shoulders square. Team folders are the lowercased team name.
export function headshotSources(driver: Driver | undefined, year: number, size: "2col" | "4col" = "4col") {
  const url = driver?.headshot_url;
  if (!url) return [];
  const sources = [url.replace("/d_driver_fallback_image.png", "").replace(/\.transform\/[^/]+\/image\.png$/, `.transform/${size}/image.png`)];
  const code = url.match(/\/([a-z]{6}\d{2})\.png/)?.[1];
  const team = driver.team_name?.toLowerCase().replace(/[^a-z0-9]/g, "");
  const px = size === "2col" ? 206 : 432;
  if (code && team)
    sources.push(`https://media.formula1.com/image/upload/c_thumb,g_face,z_0.55,w_${px},h_${px}/q_auto/common/f1/${year}/${team}/${code}/${year}${team}${code}right.webp`);
  return sources;
}

// Walks headshotSources on load errors; src is undefined once every candidate has failed.
export function useHeadshot(driver: Driver | undefined, year = new Date().getFullYear(), size: "2col" | "4col" = "4col") {
  const sources = headshotSources(driver, year, size);
  const key = sources.join("|");
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [key]);
  return { src: sources[index] as string | undefined, onError: () => setIndex((i) => i + 1) };
}

export const pad2 = (n: number | string | null | undefined) => (n == null ? "—" : String(n).padStart(2, "0"));

export const byPosition = <T extends { position_current?: number }>(rows: T[]) =>
  [...rows].sort((a, b) => (a.position_current ?? 99) - (b.position_current ?? 99));

export const isPast = (iso?: string) => !!iso && new Date(iso).getTime() < Date.now();

// Re-renders the caller on an interval so time-based states (upcoming → live → done) update without a reload.
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function downloadCsv(name: string, rows: any[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const text = [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

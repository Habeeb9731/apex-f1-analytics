import { useEffect, useState } from "react";
import { MapIcon, Pause, Play } from "lucide-react";
import { curveCatmullRom, line as d3Line } from "d3";
import type { Driver } from "@/api";
import { teamColor } from "@/api";
import { useData } from "@/lib/f1";
import { ChartEmpty, DataNote, SelectField, driverOptions } from "@/components/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function CircuitView({ drivers, sessionKey }: { drivers: Driver[]; sessionKey?: number }) {
  const [driver, setDriver] = useState<number>();
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const d = drivers.find((x) => x.driver_number === driver) ?? drivers[0];
  const q = useData<any[]>([sessionKey, d?.driver_number], "/location", { session_key: sessionKey, driver_number: d?.driver_number });
  const points = q.data ?? [];
  const sampled = points.filter((_, i) => i % Math.max(1, Math.ceil(points.length / 1200)) === 0);
  const xs = sampled.map((p) => p.x ?? 0);
  const ys = sampled.map((p) => p.y ?? 0);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const coords = sampled.map((p) => ({
    x: 40 + ((p.x - minX) / (maxX - minX || 1)) * 720,
    y: 360 - ((p.y - minY) / (maxY - minY || 1)) * 320,
  }));
  const current = coords[Math.min(frame, coords.length - 1)];

  useEffect(() => {
    if (!playing || !coords.length) return;
    const timer = window.setInterval(() => setFrame((i) => (i >= coords.length - 1 ? 0 : i + 1)), Math.max(50, 300 / speed));
    return () => window.clearInterval(timer);
  }, [playing, coords.length, speed]);

  const path = d3Line<(typeof coords)[number]>()
    .x((p) => p.x)
    .y((p) => p.y)
    .curve(curveCatmullRom.alpha(0.35))(coords);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Historical circuit trace</CardTitle>
          <CardDescription>{d?.full_name || "Selected driver"} · recorded location samples</CardDescription>
          <CardAction className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:inline-flex">
              <MapIcon /> Approximate coordinates
            </Badge>
            <Badge variant="secondary">{points.length ? `${points.length} samples` : "No trace"}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          <SelectField
            label="Driver"
            value={d ? String(d.driver_number) : ""}
            onValueChange={(v) => {
              setDriver(Number(v));
              setFrame(0);
            }}
            options={driverOptions(drivers)}
            className="max-w-xs"
          />
          {coords.length > 2 ? (
            <div className="rounded-lg border bg-muted/30 p-2">
              <svg className="h-auto w-full" viewBox="0 0 800 400" role="img" aria-label="Approximate circuit path reconstructed from historical location coordinates">
                <path d={path || ""} fill="none" stroke="var(--border)" strokeWidth="14" strokeLinejoin="round" strokeLinecap="round" />
                <path d={path || ""} fill="none" stroke={teamColor(d)} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={current?.x} cy={current?.y} r="8" fill="var(--foreground)" stroke={teamColor(d)} strokeWidth="4" />
              </svg>
            </div>
          ) : (
            <ChartEmpty loading={q.isLoading} text="Location samples are not available for this session." className="min-h-72" />
          )}
        </CardContent>
        {coords.length > 2 && (
          <CardFooter className="flex-wrap gap-4">
            <Button size="sm" variant={playing ? "secondary" : "default"} onClick={() => setPlaying(!playing)}>
              {playing ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
              {playing ? "Pause" : "Play replay"}
            </Button>
            <Slider
              aria-label="Scrub historical replay"
              min={0}
              max={coords.length - 1}
              value={[Math.min(frame, coords.length - 1)]}
              onValueChange={(v) => setFrame(v[0] ?? 0)}
              className="min-w-40 flex-1"
            />
            <span className="w-24 text-right font-mono text-xs text-muted-foreground tabular-nums">
              {frame + 1} / {coords.length}
            </span>
            <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={String(speed)} onValueChange={(v) => v && setSpeed(Number(v))} aria-label="Replay speed">
              {[0.5, 1, 2, 4].map((v) => (
                <ToggleGroupItem key={v} value={String(v)} className="font-mono">
                  {v}×
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CardFooter>
        )}
      </Card>
      <DataNote>
        OpenF1 location coordinates are approximate. This trace is reconstructed from available samples; it does not claim an exact circuit boundary
        or start/finish location.
      </DataNote>
    </div>
  );
}

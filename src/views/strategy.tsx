import { Flag, Route, Timer } from "lucide-react";
import type { Driver } from "@/api";
import { teamColor } from "@/api";
import { pad2, useData } from "@/lib/f1";
import { cn } from "@/lib/utils";
import { ChartEmpty, DataNote, StatCard, TeamSwatch } from "@/components/dashboard";
import { MsPitStop, MsTimer, MsTire } from "@/components/material-icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const compounds: Record<string, string> = {
  soft: "bg-red-500 text-white",
  medium: "bg-yellow-400 text-black",
  hard: "bg-zinc-100 text-black ring-1 ring-zinc-300 ring-inset dark:ring-0",
  intermediate: "bg-green-500 text-black",
  wet: "bg-sky-500 text-white",
};

export function StrategyView({ drivers, sessionKey }: { drivers: Driver[]; sessionKey?: number }) {
  const q = useData<any[]>([sessionKey], "/stints", { session_key: sessionKey });
  const pit = useData<any[]>([sessionKey], "/pit", { session_key: sessionKey });
  const stints = q.data ?? [];
  const pitRecords = pit.data ?? [];
  const numbers = [...new Set(stints.map((s) => s.driver_number))];
  const max = Math.max(...stints.map((s) => s.lap_end ?? s.lap_start ?? 0), 1);
  const avgLane = pitRecords.length
    ? pitRecords.reduce((s, p) => s + (p.lane_duration ?? p.pit_duration ?? 0), 0) / pitRecords.length
    : null;
  const driverOf = (n: number) => drivers.find((d) => d.driver_number === n);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={MsTire} label="Drivers with stint data" value={pad2(numbers.length)} meta="Available in selected session" accent="var(--chart-1)" />
        <StatCard icon={MsPitStop} label="Recorded pit stops" value={pad2(pitRecords.length)} meta="Source pit records" accent="var(--chart-4)" />
        <StatCard
          icon={MsTimer}
          label="Avg pit lane time"
          value={avgLane != null ? `${avgLane.toFixed(2)}s` : "—"}
          meta={avgLane != null ? "Recorded lane duration" : "No pit duration data"}
          accent="var(--chart-3)"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Stint strategy</CardTitle>
          <CardDescription>Tire compounds and lap spans recorded by OpenF1</CardDescription>
          <CardAction className="hidden gap-1.5 md:flex">
            {Object.entries(compounds).map(([name, cls]) => (
              <Badge key={name} className={cn("capitalize", cls)}>
                {name === "intermediate" ? "Inter" : name}
              </Badge>
            ))}
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {stints.length ? (
            <ScrollArea className="w-full">
              <div className="min-w-[640px] space-y-1.5 pb-3">
                {numbers.map((n) => {
                  const d = driverOf(n);
                  const own = stints.filter((s) => s.driver_number === n);
                  return (
                    <div key={n} className="grid grid-cols-[4rem_1fr_4.5rem] items-center gap-3">
                      <span className="flex items-center gap-2 font-mono text-xs font-medium">
                        <TeamSwatch color={teamColor(d)} />
                        {d?.name_acronym || `#${n}`}
                      </span>
                      <div className="relative h-7 rounded-md bg-muted/60">
                        {own.map((s, i) => {
                          const start = s.lap_start ?? 1;
                          const end = s.lap_end ?? start;
                          const compound = (s.compound || "").toLowerCase();
                          return (
                            <Tooltip key={i}>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "absolute inset-y-0.5 flex items-center justify-center overflow-hidden rounded-sm border border-background px-1 text-[10px] font-medium",
                                    compounds[compound] ?? "bg-muted-foreground/40 text-foreground",
                                  )}
                                  style={{ left: `${((start - 1) / max) * 100}%`, width: `${Math.max(1, ((end - start + 1) / max) * 100)}%` }}
                                >
                                  <span className="truncate">{s.compound?.[0] ?? "?"}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {s.compound || "Unknown"} · laps {start}–{end}
                                {s.tyre_age_at_start != null && ` · ${s.tyre_age_at_start} laps old`}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                      <span className="text-right font-mono text-xs text-muted-foreground">
                        {Math.max(...own.map((s) => s.lap_end ?? 0))} laps
                      </span>
                    </div>
                  );
                })}
                <div className="grid grid-cols-[4rem_1fr_4.5rem] gap-3 pt-1">
                  <span />
                  <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                    {[1, Math.round(max / 4), Math.round(max / 2), Math.round((max * 3) / 4), max].map((v, i) => (
                      <span key={i}>{v}</span>
                    ))}
                  </div>
                </div>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          ) : (
            <ChartEmpty loading={q.isLoading} text="Tire stints are not available for this session." />
          )}
          <DataNote>Segment lengths reflect recorded lap_start and lap_end values. Hover a stint for details. Missing compounds are left unlabeled.</DataNote>
        </CardContent>
      </Card>

      <Card className="pb-0">
        <CardHeader>
          <CardTitle>Pit stop records</CardTitle>
          <CardDescription>Durations describe pit lane transit where provided by source</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {pitRecords.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-(--card-spacing)">Driver</TableHead>
                  <TableHead className="text-right">Lap</TableHead>
                  <TableHead className="text-right">Stop</TableHead>
                  <TableHead className="text-right">Pit lane</TableHead>
                  <TableHead className="pr-(--card-spacing) text-right">Stationary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pitRecords.map((p, i) => {
                  const d = driverOf(p.driver_number);
                  const lane = p.lane_duration ?? p.pit_duration;
                  return (
                    <TableRow key={i}>
                      <TableCell className="pl-(--card-spacing)">
                        <span className="flex items-center gap-2 font-medium">
                          <TeamSwatch color={teamColor(d)} />
                          {d?.full_name || `#${p.driver_number}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">{p.lap_number ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{i + 1}</TableCell>
                      <TableCell className="text-right font-mono">{lane != null ? `${lane}s` : "—"}</TableCell>
                      <TableCell className="pr-(--card-spacing) text-right font-mono">{p.stop_duration != null ? `${p.stop_duration}s` : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <ChartEmpty loading={pit.isLoading} text="Pit stop records are not available." className="mx-(--card-spacing) w-auto mb-(--card-spacing)" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

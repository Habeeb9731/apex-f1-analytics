import { useState, type CSSProperties, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { Driver, Session } from "@/api";
import { fmtLap, teamColor, timeMs } from "@/api";
import { useData } from "@/lib/f1";
import { ChartEmpty, DriverAvatar, SelectField, driverOptions, tooltipCursor } from "@/components/dashboard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function CompareView({ drivers, sessionKey, laps }: { drivers: Driver[]; sessionKey?: number; laps: any[] }) {
  const [a, setA] = useState<number>();
  const [b, setB] = useState<number>();
  const da = drivers.find((d) => d.driver_number === a) ?? drivers[0];
  const db = drivers.find((d) => d.driver_number === b) ?? drivers[1];

  const lapsOf = (d?: Driver) =>
    laps
      .filter((l) => l.driver_number === d?.driver_number && l.lap_duration)
      .map((l) => timeMs(l.lap_duration)!)
      .filter((x) => x > 0);
  const la = lapsOf(da);
  const lb = lapsOf(db);
  const data = Array.from({ length: Math.max(la.length, lb.length) }, (_, i) => ({
    lap: i + 1,
    A: la[i] ? la[i] / 1000 : null,
    B: lb[i] ? lb[i] / 1000 : null,
  }));
  const config = {
    A: { label: da?.name_acronym ?? "Driver A", color: teamColor(da) },
    B: { label: db?.name_acronym ?? "Driver B", color: teamColor(db) },
  } satisfies ChartConfig;

  const topSpeed = (d?: Driver) => {
    const v = laps.filter((l) => l.driver_number === d?.driver_number && l.st_speed != null).map((l) => l.st_speed);
    return v.length ? Math.max(...v) : null;
  };
  const bestSector = (d: Driver | undefined, field: string) => {
    const v = laps.filter((l) => l.driver_number === d?.driver_number && l[field] != null).map((l) => Number(l[field]));
    return v.length ? Math.min(...v) : null;
  };

  const pitQ = useData<any[]>([sessionKey], "/pit", { session_key: sessionKey });
  const pitA = (pitQ.data ?? []).filter((p) => p.driver_number === da?.driver_number);
  const pitB = (pitQ.data ?? []).filter((p) => p.driver_number === db?.driver_number);
  const resultsQ = useData<any[]>([sessionKey], "/session_result", { session_key: sessionKey });
  const sessionQ = useData<Session[]>([sessionKey], "/sessions", { session_key: sessionKey });
  const meetingKey = sessionQ.data?.[0]?.meeting_key;
  const weekendQ = useData<Session[]>([meetingKey], "/sessions", { meeting_key: meetingKey });
  const qualifying = weekendQ.data?.find((s) => s.session_name === "Qualifying");
  const gridQ = useData<any[]>([qualifying?.session_key], "/starting_grid", { session_key: qualifying?.session_key });
  const resultOf = (d?: Driver) => resultsQ.data?.find((r) => r.driver_number === d?.driver_number);
  const gridOf = (d?: Driver) => gridQ.data?.find((g) => g.driver_number === d?.driver_number);
  const laneTime = (rows: any[]) => rows.reduce((sum, p) => sum + (p.lane_duration ?? p.pit_duration ?? 0), 0);
  const bestA = la.length ? Math.min(...la) : null;
  const bestB = lb.length ? Math.min(...lb) : null;

  const metrics: [string, ReactNode, ReactNode][] = [
    ["Fastest lap", fmtLap(bestA), fmtLap(bestB)],
    ["Recorded laps", la.length, lb.length],
    ["Best speed trap", topSpeed(da) != null ? `${topSpeed(da)} km/h` : "—", topSpeed(db) != null ? `${topSpeed(db)} km/h` : "—"],
    ["Pit stops", pitA.length || "—", pitB.length || "—"],
    ["Total pit lane time", pitA.length ? `${laneTime(pitA).toFixed(1)}s` : "—", pitB.length ? `${laneTime(pitB).toFixed(1)}s` : "—"],
    ["Starting position", gridOf(da)?.position ?? "—", gridOf(db)?.position ?? "—"],
    ["Finishing position", resultOf(da)?.position ?? "—", resultOf(db)?.position ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
        <DriverCard label="Driver A" driver={da} drivers={drivers} onChange={setA} best={bestA} laps={la.length} top={topSpeed(da)} />
        <div className="flex items-center justify-center">
          <Badge variant="outline" className="size-10 rounded-full font-medium">
            VS
          </Badge>
        </div>
        <DriverCard label="Driver B" driver={db} drivers={drivers} onChange={setB} best={bestB} laps={lb.length} top={topSpeed(db)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lap time comparison</CardTitle>
          <CardDescription>Recorded laps · seconds · lower is faster</CardDescription>
        </CardHeader>
        <CardContent>
          {data.length ? (
            <ChartContainer config={config} className="aspect-auto h-80 w-full">
              <LineChart data={data} margin={{ left: -8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="lap" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} domain={["dataMin - 1", "dataMax + 1"]} tickFormatter={(v) => Number(v).toFixed(0)} />
                <ChartTooltip cursor={tooltipCursor} content={<ChartTooltipContent labelFormatter={(_, pl) => `Lap ${pl?.[0]?.payload?.lap}`} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line dataKey="A" stroke="var(--color-A)" strokeWidth={2} dot={false} connectNulls />
                <Line dataKey="B" stroke="var(--color-B)" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ChartContainer>
          ) : (
            <ChartEmpty loading={false} text="Lap times are not available in this session." />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="pb-0">
          <CardHeader>
            <CardTitle>Performance metrics</CardTitle>
            <CardDescription>Calculated from records in the selected session</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <HeadToHead da={da} db={db} rows={metrics} />
          </CardContent>
        </Card>
        <Card className="pb-0">
          <CardHeader>
            <CardTitle>Sector comparison</CardTitle>
            <CardDescription>Fastest recorded sector per driver · delta is A − B</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <HeadToHead
              da={da}
              db={db}
              rows={["duration_sector_1", "duration_sector_2", "duration_sector_3"].map((field, i) => {
                const x = bestSector(da, field);
                const y = bestSector(db, field);
                const delta = x != null && y != null ? Math.round((x - y) * 1000) : null;
                return [
                  <span className="flex items-center gap-2">
                    Sector {i + 1}
                    {delta != null && (
                      <Badge variant="secondary" className="font-mono">
                        {delta > 0 ? "+" : ""}
                        {delta}ms
                      </Badge>
                    )}
                  </span>,
                  x == null ? "—" : `${x.toFixed(3)}s`,
                  y == null ? "—" : `${y.toFixed(3)}s`,
                ];
              })}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function HeadToHead({ da, db, rows }: { da?: Driver; db?: Driver; rows: [ReactNode, ReactNode, ReactNode][] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-(--card-spacing)">Metric</TableHead>
          <TableHead className="text-right" style={{ color: teamColor(da) }}>
            {da?.name_acronym ?? "A"}
          </TableHead>
          <TableHead className="pr-(--card-spacing) text-right" style={{ color: teamColor(db) }}>
            {db?.name_acronym ?? "B"}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(([label, x, y], i) => (
          <TableRow key={i}>
            <TableCell className="pl-(--card-spacing) text-muted-foreground">{label}</TableCell>
            <TableCell className="text-right font-mono">{x}</TableCell>
            <TableCell className="pr-(--card-spacing) text-right font-mono">{y}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DriverCard({
  label,
  driver,
  drivers,
  onChange,
  best,
  laps,
  top,
}: {
  label: string;
  driver?: Driver;
  drivers: Driver[];
  onChange: (n: number) => void;
  best: number | null;
  laps: number;
  top: number | null;
}) {
  return (
    <Card className="relative" style={{ "--team": teamColor(driver) } as CSSProperties}>
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-(--team)" />
      <CardHeader>
        <SelectField
          label={label}
          value={driver ? String(driver.driver_number) : ""}
          onValueChange={(v) => onChange(Number(v))}
          options={driverOptions(drivers)}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <DriverAvatar driver={driver} className="size-16 ring-2 ring-(--team)" />
          <div className="min-w-0">
            <p className="text-2xl font-medium tracking-tight">{driver?.name_acronym ?? "—"}</p>
            <p className="truncate text-sm text-muted-foreground">{driver?.full_name ?? "Select a driver"}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              #{driver?.driver_number ?? "—"} · {driver?.team_name ?? "—"}
            </p>
          </div>
        </div>
        <Separator />
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Best lap", fmtLap(best)],
            ["Laps", laps || "—"],
            ["Speed trap", top ? `${top}` : "—"],
          ].map(([k, v]) => (
            <div key={k as string} className="space-y-1">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="font-mono text-sm font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

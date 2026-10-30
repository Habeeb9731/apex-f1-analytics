import { useState } from "react";
import { Activity } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { Driver, Session } from "@/api";
import { teamColor } from "@/api";
import { useData } from "@/lib/f1";
import { ChartEmpty, DataNote, SelectField, driverOptions, tooltipCursor } from "@/components/dashboard";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const WINDOW_MS = 5 * 60 * 1000;
const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const channels = [
  ["Speed", "km/h", "speed"],
  ["Throttle", "%", "throttle"],
  ["Brake", "0 / 1", "brake"],
  ["Engine RPM", "rpm", "rpm"],
  ["Gear", "1–8", "n_gear"],
  ["DRS status", "source code", "drs"],
] as const;

export function TelemetryView({ drivers, sessionKey }: { drivers: Driver[]; sessionKey?: number }) {
  const [a, setA] = useState<number>();
  const [b, setB] = useState<number>();
  const [windowStart, setWindowStart] = useState(0);
  const d1 = drivers.find((d) => d.driver_number === a) ?? drivers[0];
  const d2 = drivers.find((d) => d.driver_number === b) ?? drivers[1];
  const session = useData<Session[]>([sessionKey], "/sessions", { session_key: sessionKey }).data?.[0];
  const dateStart = session?.date_start ? new Date(new Date(session.date_start).getTime() + windowStart * WINDOW_MS) : undefined;
  const dateEnd = dateStart ? new Date(dateStart.getTime() + WINDOW_MS) : undefined;
  const range = { "date>=": dateStart?.toISOString(), "date<=": dateEnd?.toISOString() };
  const q1 = useData<any[]>([sessionKey, d1?.driver_number, windowStart], "/car_data", { session_key: sessionKey, driver_number: d1?.driver_number, ...range });
  const q2 = useData<any[]>([sessionKey, d2?.driver_number, windowStart], "/car_data", { session_key: sessionKey, driver_number: d2?.driver_number, ...range });

  const sample = (arr: any[]) =>
    arr.filter((_, i) => i % Math.max(1, Math.ceil(arr.length / 700)) === 0).map((x) => ({ t: new Date(x.date).getTime(), v: x }));
  const aa = sample(q1.data ?? []);
  const bb = sample(q2.data ?? []);
  // Align driver B to driver A by nearest source timestamp.
  const data = aa.map((x) => {
    const y = bb.reduce((best, v) => (Math.abs(v.t - x.t) < Math.abs(best.t - x.t) ? v : best), bb[0] ?? { t: 0, v: undefined });
    const row: Record<string, unknown> = { time: new Date(x.t).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }) };
    for (const [, , key] of channels) {
      row[`${key}A`] = x.v[key];
      row[`${key}B`] = y.v?.[key];
    }
    return row;
  });

  return (
    <div className="space-y-6">
      <Card size="sm">
        <CardContent className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_12rem_auto]">
          <SelectField label="Driver A" value={d1 ? String(d1.driver_number) : ""} onValueChange={(v) => setA(Number(v))} options={driverOptions(drivers)} />
          <SelectField label="Driver B" value={d2 ? String(d2.driver_number) : ""} onValueChange={(v) => setB(Number(v))} options={driverOptions(drivers)} />
          <SelectField
            label="5-minute window"
            value={String(windowStart)}
            onValueChange={(v) => setWindowStart(Number(v))}
            options={Array.from({ length: 24 }, (_, i) => ({ value: String(i), label: `${hhmm(i * 5)}–${hhmm(i * 5 + 5)}` }))}
          />
          <Badge variant="outline" className="h-9 justify-self-start">
            <Activity /> Time filtered at source
          </Badge>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {channels.map(([name, unit, key]) => {
          const config = {
            [`${key}A`]: { label: d1?.name_acronym ?? "A", color: teamColor(d1) },
            [`${key}B`]: { label: d2?.name_acronym ?? "B", color: teamColor(d2) },
          } satisfies ChartConfig;
          return (
            <Card key={key} size="sm">
              <CardHeader>
                <CardTitle>{name}</CardTitle>
                <CardDescription>{unit}</CardDescription>
                <CardAction>
                  <Badge variant="secondary">Historical</Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                {data.length ? (
                  <ChartContainer config={config} className="aspect-auto h-40 w-full">
                    <LineChart data={data} syncId="telemetry" margin={{ left: -16, right: 4 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="time" hide />
                      <YAxis width={44} tickLine={false} axisLine={false} />
                      <ChartTooltip cursor={tooltipCursor} content={<ChartTooltipContent indicator="line" />} />
                      <Line dataKey={`${key}A`} stroke={`var(--color-${key}A)`} dot={false} strokeWidth={1.5} connectNulls isAnimationActive={false} />
                      <Line dataKey={`${key}B`} stroke={`var(--color-${key}B)`} dot={false} strokeWidth={1.5} connectNulls isAnimationActive={false} />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <ChartEmpty loading={q1.isLoading || q2.isLoading} text="Telemetry is unavailable for this session." />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <DataNote>
        Telemetry traces are aligned by nearest source timestamp and downsampled for display. DRS values retain OpenF1's numeric codes;
        unknown codes are not interpreted.
      </DataNote>
    </div>
  );
}

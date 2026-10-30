import { Activity, CloudRain, CloudSun, Gauge, Thermometer, Wind } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useData } from "@/lib/f1";
import { ChartEmpty, DataNote, StatCard, tooltipCursor } from "@/components/dashboard";
import { MsGauge, MsHumidity, MsRain, MsRoad, MsThermostat, MsWind } from "@/components/material-icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const charts: { title: string; unit: string; config: ChartConfig }[] = [
  {
    title: "Air & track temperature",
    unit: "°C",
    config: { track: { label: "Track", color: "var(--chart-1)" }, air: { label: "Air", color: "var(--chart-3)" } },
  },
  { title: "Wind speed", unit: "m/s", config: { wind: { label: "Wind", color: "var(--chart-2)" } } },
  { title: "Rainfall", unit: "mm", config: { rain: { label: "Rainfall", color: "var(--chart-3)" } } },
];

export function WeatherView({ sessionKey }: { sessionKey?: number }) {
  const q = useData<any[]>([sessionKey], "/weather", { session_key: sessionKey });
  const rows = q.data ?? [];
  const data = rows
    .filter((_, i) => i % Math.max(1, Math.ceil(rows.length / 300)) === 0)
    .map((r) => ({
      time: new Date(r.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      air: r.air_temperature,
      track: r.track_temperature,
      rain: r.rainfall,
      wind: r.wind_speed,
    }));
  const latest = rows.at(-1);
  const fmt = (v: unknown, unit: string) => (v == null ? "—" : `${v}${unit}`);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={MsThermostat} label="Air temperature" value={fmt(latest?.air_temperature, "°C")} meta="Latest observation" accent="var(--chart-3)" />
        <StatCard icon={MsRoad} label="Track temperature" value={fmt(latest?.track_temperature, "°C")} meta="Latest observation" accent="var(--chart-1)" />
        <StatCard icon={MsHumidity} label="Humidity" value={fmt(latest?.humidity, "%")} meta="Relative humidity" accent="var(--chart-4)" />
        <StatCard icon={MsWind} label="Wind speed" value={fmt(latest?.wind_speed, " m/s")} meta={latest?.wind_direction != null ? `From ${latest.wind_direction}°` : undefined} accent="var(--chart-2)" />
        <StatCard
          icon={MsRain}
          label="Rainfall"
          value={latest ? (latest.rainfall ? "Rain observed" : "No rain record") : "—"}
          meta="Latest observation"
          accent="var(--chart-3)"
        />
        <StatCard icon={MsGauge} label="Pressure" value={fmt(latest?.pressure, " hPa")} meta="Atmospheric" accent="var(--chart-5)" />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {charts.map(({ title, unit, config }, i) => (
          <Card key={title} className={i === 0 ? "xl:col-span-2" : undefined}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>Historical weather observations · {unit}</CardDescription>
            </CardHeader>
            <CardContent>
              {data.length ? (
                <ChartContainer config={config} className="aspect-auto h-56 w-full">
                  <AreaChart data={data} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip cursor={tooltipCursor} content={<ChartTooltipContent indicator="line" />} />
                    {Object.keys(config).length > 1 && <ChartLegend content={<ChartLegendContent />} />}
                    {Object.keys(config).map((key) => (
                      <Area key={key} dataKey={key} type="monotone" stroke={`var(--color-${key})`} fill={`var(--color-${key})`} fillOpacity={0.15} strokeWidth={2} />
                    ))}
                  </AreaChart>
                </ChartContainer>
              ) : (
                <ChartEmpty loading={q.isLoading} text="Weather observations are unavailable." />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <DataNote>Values reflect recorded observations; comparisons with lap times are descriptive and do not establish causation.</DataNote>
    </div>
  );
}

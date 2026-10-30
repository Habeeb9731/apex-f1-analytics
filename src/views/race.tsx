import { useMemo, useState } from "react";
import { Download, Flag, Search } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { Driver, Meeting, Session } from "@/api";
import { teamColor } from "@/api";
import { downloadCsv, fmtDate, pad2, useData } from "@/lib/f1";
import { ChartEmpty, DataNote, TeamSwatch, tooltipCursor } from "@/components/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function RaceView({
  meeting,
  sessions,
  session,
  onSession,
  results,
  drivers,
}: {
  meeting?: Meeting;
  sessions: Session[];
  session?: Session;
  onSession: (s: Session) => void;
  results: any[];
  drivers: Driver[];
}) {
  const [query, setQuery] = useState("");
  const sessionKey = session?.session_key;
  const gridSession = sessions.find((s) => s.session_name === "Qualifying");
  const gridQ = useData<any[]>([gridSession?.session_key], "/starting_grid", { session_key: gridSession?.session_key });
  const gridMap = new Map((gridQ.data ?? []).map((g: any) => [g.driver_number, g.position]));
  const driverOf = (n: number) => drivers.find((x) => x.driver_number === n);
  const visible = results.filter((r) => {
    const d = driverOf(r.driver_number);
    return `${d?.full_name} ${d?.team_name}`.toLowerCase().includes(query.toLowerCase());
  });

  const posQ = useData<any[]>([sessionKey], "/position", { session_key: sessionKey });
  const { chart, series, config } = useMemo(() => {
    const points = posQ.data ?? [];
    const series = [...new Set(points.map((p) => p.driver_number))].slice(0, 7);
    const chart = [...new Set(points.map((p) => p.date))].map((date) => ({
      date: date.slice(11, 19),
      ...Object.fromEntries(points.filter((p) => p.date === date).map((p) => [`d${p.driver_number}`, p.position])),
    }));
    const config = Object.fromEntries(
      series.map((n) => {
        const d = drivers.find((x) => x.driver_number === n);
        return [`d${n}`, { label: d?.name_acronym ?? `#${n}`, color: teamColor(d) }];
      }),
    ) satisfies ChartConfig;
    return { chart, series, config };
  }, [posQ.data, drivers]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardDescription className="uppercase tracking-wider">
            {meeting?.country_name} · {session?.session_name}
          </CardDescription>
          <CardTitle className="text-2xl font-medium tracking-tight">{meeting?.meeting_name || "Race weekend"}</CardTitle>
          <CardDescription>
            {meeting?.circuit_short_name || meeting?.location}
            {meeting ? ` · ${fmtDate(meeting.date_start, { day: "numeric", month: "long", year: "numeric" })}` : ""}
          </CardDescription>
          <CardAction>
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Flag className="size-6" />
            </div>
          </CardAction>
        </CardHeader>
        {sessions.length > 0 && (
          <CardContent>
            <ScrollArea className="w-full">
              <Tabs
                value={sessionKey == null ? undefined : String(sessionKey)}
                onValueChange={(v) => {
                  const s = sessions.find((x) => String(x.session_key) === v);
                  if (s) onSession(s);
                }}
              >
                <TabsList>
                  {sessions.map((s) => (
                    <TabsTrigger key={s.session_key} value={String(s.session_key)}>
                      {s.session_name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </ScrollArea>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Session classification</CardTitle>
            <CardDescription>Official order from session results</CardDescription>
            <CardAction>
              <InputGroup className="w-44">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter drivers" aria-label="Filter drivers" />
              </InputGroup>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            {visible.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-(--card-spacing)">Pos</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead className="hidden md:table-cell">Team</TableHead>
                    <TableHead className="text-right">Grid</TableHead>
                    <TableHead className="text-right">Pts</TableHead>
                    <TableHead className="pr-(--card-spacing) text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((r, i) => {
                    const d = driverOf(r.driver_number);
                    const grid = gridMap.get(r.driver_number);
                    const gain = grid && r.position ? Number(grid) - r.position : null;
                    const status = r.dsq ? "DSQ" : r.dns ? "DNS" : r.dnf ? "DNF" : null;
                    return (
                      <TableRow key={r.driver_number}>
                        <TableCell className="pl-(--card-spacing) font-mono">{pad2(r.position ?? i + 1)}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2 font-medium">
                            <TeamSwatch color={teamColor(d)} />
                            {d?.full_name || `#${r.driver_number}`}
                          </span>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{d?.team_name || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{grid ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono">{r.points ?? "—"}</TableCell>
                        <TableCell className="pr-(--card-spacing) text-right">
                          <span className="inline-flex items-center gap-1.5">
                            {gain !== null && gain !== 0 && (
                              <span className={gain > 0 ? "font-mono text-xs text-emerald-600 dark:text-emerald-400" : "font-mono text-xs text-red-600 dark:text-red-400"}>
                                {gain > 0 ? `▲${gain}` : `▼${Math.abs(gain)}`}
                              </span>
                            )}
                            <Badge variant={status ? "destructive" : "secondary"}>{status ?? r.position_text ?? "Classified"}</Badge>
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <ChartEmpty loading={!results.length} text="No classification data is available." className="mx-(--card-spacing) w-auto" />
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" disabled={!visible.length} onClick={() => downloadCsv("classification.csv", visible)}>
              <Download data-icon="inline-start" /> Download CSV
            </Button>
          </CardFooter>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Position changes</CardTitle>
            <CardDescription>Recorded position samples · first {series.length || 7} drivers</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            {chart.length ? (
              <ChartContainer config={config} className="aspect-auto h-80 w-full">
                <LineChart data={chart} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" hide />
                  <YAxis reversed domain={[1, "dataMax"]} tickLine={false} axisLine={false} allowDecimals={false} />
                  <ChartTooltip cursor={tooltipCursor} content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {series.map((n) => (
                    <Line key={n} dataKey={`d${n}`} type="stepAfter" dot={false} stroke={`var(--color-d${n})`} strokeWidth={2} connectNulls />
                  ))}
                </LineChart>
              </ChartContainer>
            ) : (
              <ChartEmpty loading={posQ.isLoading} text="Position history is not available for this session." />
            )}
            <DataNote>Position samples are shown at source timestamps; alignment to lap boundaries is not inferred.</DataNote>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Race control timeline</CardTitle>
          <CardDescription>Official session messages and incidents</CardDescription>
        </CardHeader>
        <CardContent>
          <Timeline sessionKey={sessionKey} />
        </CardContent>
      </Card>
    </div>
  );
}

function Timeline({ sessionKey }: { sessionKey?: number }) {
  const q = useData<any[]>([sessionKey], "/race_control", { session_key: sessionKey });
  const rows = q.data ?? [];
  if (!rows.length) return <ChartEmpty loading={q.isLoading} text="Race control messages are unavailable." />;
  return (
    <ScrollArea className="h-96 pr-3">
      <ol className="relative ml-1.5 border-l">
        {rows.slice(0, 40).map((e, i) => (
          <li key={i} className="relative pb-4 pl-5 last:pb-0">
            <span className="absolute top-1.5 -left-[5px] size-2.5 rounded-full border-2 border-background bg-primary" />
            <div className="flex flex-wrap items-center gap-2">
              <time className="font-mono text-xs text-muted-foreground">
                {new Date(e.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </time>
              <Badge variant="outline">{e.category || e.flag || "Race control"}</Badge>
              {e.flag && e.category && <Badge variant="secondary">{e.flag}</Badge>}
            </div>
            <p className="mt-1 text-sm">{e.message}</p>
          </li>
        ))}
      </ol>
    </ScrollArea>
  );
}

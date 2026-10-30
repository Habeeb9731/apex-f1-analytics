import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { Trophy } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { Driver, Meeting, Session } from "@/api";
import { api, teamColor } from "@/api";
import { pad2, useData } from "@/lib/f1";
import { cn } from "@/lib/utils";
import { ChartEmpty, DataNote, TeamSwatch, tooltipCursor } from "@/components/dashboard";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Tab = "drivers" | "teams";
// Series keys become CSS variable names in ChartContainer, so strip spaces and punctuation from team names.
const teamKey = (name: string) => `t${String(name).replace(/\W+/g, "_")}`;

export function StandingsView({ drivers, champ, teams, year }: { drivers: Driver[]; champ: any[]; teams: any[]; year: number }) {
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(location.search).get("tab") === "teams" ? "teams" : "drivers"));
  const [selected, setSelected] = useState<string[]>([]);
  const sessionsQ = useData<Session[]>([year], "/sessions", { year });
  const meetingsQ = useData<Meeting[]>([year], "/meetings", { year });
  const gpKeys = new Set((meetingsQ.data ?? []).filter((m) => m.meeting_name.toLowerCase().includes("grand prix")).map((m) => m.meeting_key));
  const races = (sessionsQ.data ?? []).filter((s) => s.session_type === "Race" && gpKeys.has(s.meeting_key));

  const progressionQ = useQuery({
    queryKey: ["championship-progression", year, tab, races.map((r) => r.session_key)],
    enabled: races.length > 0,
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const endpoint = tab === "drivers" ? "/championship_drivers" : "/championship_teams";
      const keyOf = (x: any) => (tab === "drivers" ? `d${x.driver_number}` : teamKey(x.team_name));
      return Promise.all(
        races.map(async (r, i) => {
          try {
            const values = await api<any[]>(endpoint, { session_key: r.session_key });
            return { round: `R${i + 1}`, ...Object.fromEntries(values.map((v) => [keyOf(v), v.points_current])) };
          } catch {
            return { round: `R${i + 1}` };
          }
        }),
      );
    },
  });

  const teamColorOf = (name: string) => "#" + (drivers.find((d) => d.team_name === name)?.team_colour || "9298a5");
  const choices =
    tab === "drivers"
      ? champ.slice(0, 8).map((x) => {
          const d = drivers.find((v) => v.driver_number === x.driver_number);
          return { key: `d${x.driver_number}`, label: d?.name_acronym || `#${x.driver_number}`, color: teamColor(d) };
        })
      : teams.slice(0, 8).map((x) => ({ key: teamKey(x.team_name), label: x.team_name as string, color: teamColorOf(x.team_name) }));
  const selectedKeys = selected.length ? selected : choices.slice(0, 4).map((c) => c.key);
  const config = Object.fromEntries(choices.map((c) => [c.key, { label: c.label, color: c.color }])) satisfies ChartConfig;
  const rows = tab === "drivers" ? champ : teams;
  const lead = rows[0]?.points_current ?? 0;

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(v as Tab);
        setSelected([]);
      }}
      className="gap-6"
    >
      <TabsList>
        <TabsTrigger value="drivers">Drivers’ championship</TabsTrigger>
        <TabsTrigger value="teams">Constructors’ championship</TabsTrigger>
      </TabsList>
      <TabsContent value={tab} className="space-y-6">
        <Card className="pb-0">
          <CardHeader>
            <CardTitle>{tab === "drivers" ? "Drivers’ championship" : "Constructors’ championship"}</CardTitle>
            <CardDescription>Latest available historical snapshot · {year}</CardDescription>
            <CardAction>
              <Badge variant="outline">
                <Trophy /> OpenF1 snapshot
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4 px-0">
            {rows.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 pl-(--card-spacing)">Pos</TableHead>
                    <TableHead>{tab === "drivers" ? "Driver" : "Constructor"}</TableHead>
                    {tab === "drivers" && <TableHead className="hidden sm:table-cell">Team</TableHead>}
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="pr-(--card-spacing) text-right">Gap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((x, i) => {
                    const d = drivers.find((v) => v.driver_number === x.driver_number);
                    const color = tab === "drivers" ? teamColor(d) : teamColorOf(x.team_name);
                    return (
                      <TableRow key={x.driver_number ?? x.team_name ?? i}>
                        <TableCell className={cn("pl-(--card-spacing) font-mono", i === 0 && "text-primary")}>{pad2(x.position_current ?? i + 1)}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2 font-medium">
                            <TeamSwatch color={color} />
                            {tab === "drivers" ? x.full_name || d?.full_name || `#${x.driver_number}` : x.team_name}
                          </span>
                        </TableCell>
                        {tab === "drivers" && <TableCell className="hidden text-muted-foreground sm:table-cell">{x.team_name || d?.team_name || "—"}</TableCell>}
                        <TableCell className="text-right font-mono font-medium">{x.points_current ?? "—"}</TableCell>
                        <TableCell className="pr-(--card-spacing) text-right font-mono text-muted-foreground">
                          {i ? `−${Math.max(0, lead - (x.points_current ?? 0))}` : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <ChartEmpty loading={false} text="Historical championship snapshots are not available for this session." className="mx-(--card-spacing) w-auto" />
            )}
            <DataNote className="px-(--card-spacing) pb-(--card-spacing)">
              Standings are shown only when OpenF1 provides a snapshot for the selected session. No totals are reconstructed from partial data.
            </DataNote>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Championship progression</CardTitle>
            <CardDescription>Points after each completed race · historical snapshots only</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleGroup type="multiple" variant="outline" size="sm" value={selectedKeys} onValueChange={setSelected} className="flex-wrap">
              {choices.map((c) => (
                <ToggleGroupItem key={c.key} value={c.key} aria-label={`Toggle ${c.label}`}>
                  <span className="size-2 rounded-full" style={{ background: c.color }} />
                  {c.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {progressionQ.data?.length ? (
              <ChartContainer config={config} className="aspect-auto h-72 w-full">
                <LineChart data={progressionQ.data} margin={{ left: -8, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="round" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip cursor={tooltipCursor} content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {selectedKeys.map((key) => (
                    <Line
                      key={key}
                      dataKey={key}
                      type="monotone"
                      stroke={choices.find((c) => c.key === key)?.color ?? "var(--muted-foreground)"}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            ) : (
              <ChartEmpty
                loading={progressionQ.isLoading || sessionsQ.isLoading || meetingsQ.isLoading}
                text="Historical championship snapshots are not available for these rounds."
              />
            )}
            <DataNote>The chart uses OpenF1 championship totals after each race. Missing rounds stay missing; points are not reconstructed from results.</DataNote>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, CalendarDays, ChartNoAxesColumnIncreasing, ChevronRight, Flag, SquareArrowOutUpRight, Timer, Trophy } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { Driver, Meeting, Session } from "@/api";
import { teamColor } from "@/api";
import { fmtDate, isPast, pad2, useHeadshot } from "@/lib/f1";
import { cn } from "@/lib/utils";
import { ChartEmpty, DriverAvatar, SectionTitle, StatCard, TeamSwatch, tooltipCursor } from "@/components/dashboard";
import { MsCar, MsCheckered, MsMedal, MsTrophy } from "@/components/material-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const paceConfig = { lap_duration: { label: "Fastest lap (s)", color: "var(--chart-1)" } } satisfies ChartConfig;

export type OverviewProps = {
  year: number;
  meeting?: Meeting;
  grandPrixMeetings: Meeting[];
  completedCount: number;
  completedKeys: Set<number>;
  scheduledCount: number;
  raceSession?: Session;
  raceWinner?: Driver;
  raceWinnerPoints?: number;
  raceComplete: boolean;
  raceLoading: boolean;
  nextMeeting?: Meeting;
  champ: any[];
  champLoading: boolean;
  constructors: any[];
  standingsDrivers: Driver[];
  recentMeeting?: Meeting;
  recentResults: any[];
  recentResultsLoading: boolean;
  recentResultsError: unknown;
  recentDrivers: Driver[];
  byLap: { lap: number; lap_duration?: number }[];
  lapsLoading: boolean;
  onSelectMeeting: (key: number) => void;
};

export function OverviewView(p: OverviewProps) {
  const navigate = useNavigate();
  const round = p.grandPrixMeetings.findIndex((m) => m.meeting_key === p.meeting?.meeting_key) + 1;
  const leader = p.champ[0];
  const leaderDriver = p.standingsDrivers.find((d) => d.driver_number === leader?.driver_number);
  const recentPodium = p.recentResults.filter((r) => r.position && r.position <= 3).sort((a, b) => a.position - b.position);
  const recentWinner = p.recentDrivers.find((d) => d.driver_number === recentPodium[0]?.driver_number);

  return (
    <div className="space-y-6">
      {/* Selected Grand Prix winner */}
      <WinnerHero
        winner={p.raceWinner}
        points={p.raceWinnerPoints}
        kicker={
          p.raceWinner
            ? `Winner · ${p.meeting?.meeting_name ?? "Grand Prix"} · Round ${Math.max(0, round)}`
            : p.raceLoading
              ? "Loading winner…"
              : p.raceComplete
                ? "Winner data unavailable"
                : `${p.meeting?.meeting_name ?? "Grand Prix"} · race not completed`
        }
        meta={p.raceSession ? fmtDate(p.raceSession.date_start) : p.meeting ? fmtDate(p.meeting.date_start) : `${p.year} season`}
        year={p.year}
        onOpen={() => navigate(p.raceWinner ? "/drivers" : "/race")}
      />

      {/* Key metrics */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={MsTrophy}
          label="Championship leader"
          value={leaderDriver?.full_name || "—"}
          meta={leader ? `${leader.points_current ?? "—"} pts · ${leaderDriver?.team_name ?? ""}` : "Standings unavailable"}
          accent="var(--chart-1)"
        />
        <StatCard
          icon={MsCar}
          label="Constructor leader"
          value={p.constructors[0]?.team_name || "—"}
          meta={p.constructors[0]?.points_current != null ? `${p.constructors[0].points_current} pts · ${p.year}` : "No snapshot available"}
          accent="var(--chart-4)"
        />
        <StatCard
          icon={MsCheckered}
          label="Races completed"
          value={pad2(p.completedCount)}
          meta={`of ${p.scheduledCount || "—"} scheduled rounds`}
          accent="var(--chart-3)"
        />
        <StatCard
          icon={MsMedal}
          label="Latest winner"
          value={recentWinner?.name_acronym || (recentPodium[0] ? `#${recentPodium[0].driver_number}` : "—")}
          meta={p.recentMeeting?.meeting_name || "Latest completed race"}
          accent="var(--chart-2)"
        />
      </section>

      {/* Spotlight */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Up next</CardDescription>
            <CardTitle>Next race</CardTitle>
            <CardAction>
              <CalendarDays className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="flex-1">
            {p.nextMeeting ? (
              <div className="space-y-2">
                <Badge variant="outline" className="font-mono">
                  {fmtDate(p.nextMeeting.date_start).toUpperCase()}
                </Badge>
                <p className="text-xl font-medium tracking-tight">{p.nextMeeting.meeting_name}</p>
                <p className="text-sm text-muted-foreground">
                  {p.nextMeeting.circuit_short_name || p.nextMeeting.location} · {p.nextMeeting.country_name}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming event is listed for {p.year}.</p>
            )}
          </CardContent>
          {p.nextMeeting && (
            <CardFooter>
              <Button
                size="sm"
                onClick={() => {
                  p.onSelectMeeting(p.nextMeeting!.meeting_key);
                  navigate("/race");
                }}
              >
                Race weekend <ChevronRight data-icon="inline-end" />
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Recent finish</CardDescription>
            <CardTitle className="truncate">{p.recentMeeting?.meeting_name || "Race highlights"}</CardTitle>
            <CardAction>
              <Flag className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="flex-1">
            {recentPodium.length ? (
              <ItemGroup className="gap-1">
                {recentPodium.map((r) => {
                  const d = p.recentDrivers.find((x) => x.driver_number === r.driver_number);
                  return (
                    <Item key={r.driver_number} size="xs" className="px-0">
                      <ItemMedia>
                        <span className="w-5 font-mono text-xs text-muted-foreground">{pad2(r.position)}</span>
                        <DriverAvatar driver={d} />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{d?.full_name || `Driver ${r.driver_number}`}</ItemTitle>
                        <ItemDescription>{d?.team_name || "—"}</ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <span className="font-mono text-xs text-muted-foreground">
                          {r.gap_to_leader === 0 || r.position === 1 ? "WIN" : r.gap_to_leader != null ? `+${r.gap_to_leader}s` : "—"}
                        </span>
                      </ItemActions>
                    </Item>
                  );
                })}
              </ItemGroup>
            ) : (
              <ChartEmpty
                loading={p.recentResultsLoading}
                text={p.recentResultsError ? String((p.recentResultsError as Error).message) : "Race results are unavailable."}
                className="min-h-32"
              />
            )}
          </CardContent>
          <CardFooter>
            <Button variant="link" size="sm" className="px-0" onClick={() => navigate("/race")}>
              Open race explorer <ChevronRight data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Season at a glance</CardDescription>
            <CardTitle>Race calendar</CardTitle>
            <CardAction>
              <Badge variant="secondary">{p.grandPrixMeetings.length} rounds</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex-1 px-0">
            <ScrollArea className="h-56 px-(--card-spacing)">
              <div className="flex flex-col gap-0.5">
                {p.grandPrixMeetings.map((m, i) => {
                  const done = p.completedKeys.has(m.meeting_key);
                  const selected = m.meeting_key === p.meeting?.meeting_key;
                  return (
                    <Button
                      key={m.meeting_key}
                      variant={selected ? "secondary" : "ghost"}
                      size="sm"
                      className="h-8 justify-start gap-3 font-normal"
                      onClick={() => p.onSelectMeeting(m.meeting_key)}
                    >
                      <span className="w-5 font-mono text-xs text-muted-foreground">{pad2(i + 1)}</span>
                      <span className="w-12 font-mono text-xs text-muted-foreground">
                        {fmtDate(m.date_start, { day: "2-digit", month: "short" }).toUpperCase()}
                      </span>
                      <span className={cn("flex-1 truncate text-left", !done && "text-muted-foreground/60")}>{m.meeting_name}</span>
                      <span className={cn("size-1.5 rounded-full", done ? "bg-primary" : "bg-muted-foreground/40")} />
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Season progress</span>
              <span className="tabular-nums">
                {p.completedCount} / {p.grandPrixMeetings.length}
              </span>
            </div>
            <Progress value={p.grandPrixMeetings.length ? (p.completedCount / p.grandPrixMeetings.length) * 100 : 0} />
          </CardFooter>
        </Card>
      </section>

      {/* Championship */}
      <SectionTitle
        eyebrow="Championship battle"
        title={
          <span className="flex flex-wrap items-center gap-2">
            Drivers’ standings
            <Badge variant="outline" className="font-normal">
              after {p.recentMeeting?.meeting_name ?? "latest available round"}
            </Badge>
          </span>
        }
        action={
          <Button variant="ghost" size="sm" onClick={() => navigate("/standings")}>
            Full standings <ChevronRight data-icon="inline-end" />
          </Button>
        }
      />
      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Card className="pb-0">
          <CardHeader>
            <CardTitle>Driver championship</CardTitle>
            <CardDescription>Points earned · {p.year} season</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {p.champ.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14 pl-(--card-spacing)">Pos</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="pr-(--card-spacing) text-right">Gap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.champ.slice(0, 8).map((row, i) => {
                    const d = p.standingsDrivers.find((x) => x.driver_number === row.driver_number);
                    return (
                      <TableRow key={row.driver_number}>
                        <TableCell className={cn("pl-(--card-spacing) font-mono", i === 0 && "text-primary")}>
                          {pad2(row.position_current ?? i + 1)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <TeamSwatch color={teamColor(d)} className="h-7" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{row.full_name || d?.full_name || `Driver ${row.driver_number}`}</p>
                              <p className="truncate text-xs text-muted-foreground">{row.team_name || d?.team_name || "—"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">{row.points_current ?? "—"}</TableCell>
                        <TableCell className="pr-(--card-spacing) text-right font-mono text-muted-foreground">
                          {i === 0 ? "—" : `−${Math.max(0, (leader?.points_current ?? 0) - (row.points_current ?? 0))}`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <ChartEmpty loading={p.champLoading} text="Championship snapshots are unavailable." className="mx-(--card-spacing) w-auto mb-(--card-spacing)" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fastest lap by lap</CardTitle>
            <CardDescription>Best recorded lap duration per lap number · seconds</CardDescription>
            <CardAction>
              <Badge variant="outline">{p.byLap.length ? `${p.byLap.length} laps` : "Selected session"}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex-1">
            {p.byLap.length ? (
              <ChartContainer config={paceConfig} className="aspect-auto h-72 w-full">
                <AreaChart data={p.byLap} margin={{ left: -12, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="fillPace" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-lap_duration)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-lap_duration)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="lap" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} domain={["dataMin - 1", "dataMax + 1"]} tickFormatter={(v) => Number(v).toFixed(0)} />
                  <ChartTooltip cursor={tooltipCursor} content={<ChartTooltipContent labelFormatter={(_, pl) => `Lap ${pl?.[0]?.payload?.lap}`} />} />
                  <Area dataKey="lap_duration" type="monotone" stroke="var(--color-lap_duration)" fill="url(#fillPace)" strokeWidth={2} connectNulls />
                </AreaChart>
              </ChartContainer>
            ) : (
              <ChartEmpty loading={p.lapsLoading} text="Lap timing is not available for this session." className="h-full" />
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardDescription>Team battle</CardDescription>
          <CardTitle>Constructors’ standings</CardTitle>
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => navigate("/standings?tab=teams")}>
              Full table <SquareArrowOutUpRight data-icon="inline-end" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {p.constructors.length ? (
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {p.constructors.map((team, i) => {
                const color = "#" + (p.standingsDrivers.find((d) => d.team_name === team.team_name)?.team_colour || "9298a5");
                const share = ((team.points_current ?? 0) / (p.constructors[0]?.points_current || 1)) * 100;
                return (
                  <div key={team.team_name} className="space-y-1.5">
                    <div className="flex items-center gap-2.5 text-sm">
                      <span className="w-5 font-mono text-xs text-muted-foreground">{pad2(team.position_current ?? i + 1)}</span>
                      <TeamSwatch color={color} />
                      <span className="flex-1 truncate font-medium">{team.team_name}</span>
                      <span className="font-mono font-medium tabular-nums">{team.points_current ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">pts</span>
                    </div>
                    <Progress value={share} className="h-1 [&_[data-slot=progress-indicator]]:bg-(--team)" style={{ "--team": color } as CSSProperties} />
                  </div>
                );
              })}
            </div>
          ) : (
            <ChartEmpty loading={p.champLoading} text="Constructor snapshot unavailable for this session." />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <Separator className="flex-1" />
        <span className="flex items-center gap-2">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Data provided by OpenF1 · historical session data
        </span>
        <Separator className="flex-1" />
      </div>
    </div>
  );
}

// Pick black or white text depending on how light the team colour is.
function readableOn(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0b0c10" : "#ffffff";
}

function WinnerHero({
  winner,
  points,
  kicker,
  meta,
  year,
  onOpen,
}: {
  winner?: Driver;
  points?: number;
  kicker: string;
  meta: string;
  year: number;
  onOpen: () => void;
}) {
  const bg = winner ? teamColor(winner) : "#e10600";
  const fg = readableOn(bg);
  const name = winner?.full_name ?? "";
  const split = name.lastIndexOf(" ");
  const first = split > 0 ? name.slice(0, split) : "";
  const last = (split > 0 ? name.slice(split + 1) : name).toLowerCase().replace(/(^|[-\s])\p{L}/gu, (c) => c.toUpperCase());
  const { src: photo, onError: onPhotoError } = useHeadshot(winner, year);

  return (
    <div className={cn("relative", photo && "pt-10 md:pt-14")}>
      <div
        className="relative isolate min-h-52 overflow-hidden rounded-3xl p-6 md:min-h-60 md:p-8"
        style={{ background: bg, color: fg } as CSSProperties}
      >
        {/* depth: soft highlight and a darker left edge */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{ background: "radial-gradient(70% 140% at 75% 30%, rgb(255 255 255 / 0.22), transparent 60%), linear-gradient(90deg, rgb(0 0 0 / 0.12), transparent 55%)" }}
        />
        <span
          aria-hidden
          className="absolute right-[30%] -bottom-10 -z-10 pr-[0.18em] font-display text-[11rem] leading-none tracking-[-0.18em] opacity-10 select-none md:text-[14rem]"
        >
          {winner?.driver_number ?? "F1"}
        </span>

        <div className="relative flex h-full max-w-[60%] flex-col gap-5 md:max-w-[55%]">
          <p className="text-xs tracking-wide opacity-80">{kicker}</p>
          {winner ? (
            <h2 className="leading-[0.95] font-medium tracking-tight">
              {first && <span className="block text-3xl font-normal md:text-5xl">{first}</span>}
              <span className="block text-4xl md:text-6xl">{last}</span>
            </h2>
          ) : (
            <Trophy className="size-12 opacity-80" />
          )}
          <p className="text-sm opacity-80">{winner?.team_name ?? meta}</p>
          <div className="mt-auto flex items-baseline gap-3">
            {winner && points != null && (
              <span className="font-display text-xl">
                {points}
                <span className="ml-1 text-xs">Pts</span>
              </span>
            )}
            {winner && <span className="text-xs opacity-70">{meta}</span>}
          </div>
        </div>

        <Button
          size="icon"
          variant="ghost"
          aria-label={winner ? "View driver profile" : "Open race explorer"}
          onClick={onOpen}
          className="absolute top-5 right-5 z-20 rounded-full bg-white/20 text-inherit backdrop-blur hover:bg-white/30 hover:text-inherit dark:hover:bg-white/30"
        >
          <ArrowUpRight />
        </Button>
      </div>

      {photo && (
        <img
          key={photo}
          src={photo}
          alt={`${winner?.full_name}, race winner`}
          className="pointer-events-none absolute right-4 bottom-0 z-10 h-[88%] max-w-[45%] object-contain object-bottom drop-shadow-2xl md:right-20 md:h-full"
          onError={onPhotoError}
        />
      )}
    </div>
  );
}

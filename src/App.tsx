import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Activity, CalendarDays, ChevronRight, CloudSun, Flag, LayoutDashboard, Map as MapIcon, Route, Search, Star, Trophy, Users } from "lucide-react";
import type { Driver, Meeting, Session } from "./api";
import { byPosition, fmtDate, isPast, slugify, useData, useNow } from "@/lib/f1";
import { AppSidebar, type NavItem } from "@/components/app-sidebar";
import { AssistantWidget } from "@/components/assistant-widget";
import { SelectField } from "@/components/dashboard";
import { ThemeToggle } from "@/components/theme";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { OverviewView } from "@/views/overview";
import { RaceView } from "@/views/race";
import { CompareView } from "@/views/compare";
import { TelemetryView } from "@/views/telemetry";
import { StrategyView } from "@/views/strategy";
import { StandingsView } from "@/views/standings";
import { DriversView } from "@/views/drivers";
import { CircuitView } from "@/views/circuit";
import { WeatherView } from "@/views/weather";

const nav = [
  { name: "Overview", icon: LayoutDashboard, path: "/" },
  { name: "Race explorer", icon: Flag, path: "/race" },
  { name: "Driver comparison", icon: Users, path: "/compare" },
  { name: "Telemetry lab", icon: Activity, path: "/telemetry" },
  { name: "Tire strategy", icon: Route, path: "/strategy" },
  { name: "Championships", icon: Trophy, path: "/standings" },
  { name: "Driver profiles", icon: Star, path: "/drivers" },
  { name: "Circuit analysis", icon: MapIcon, path: "/circuit" },
  { name: "Weather & conditions", icon: CloudSun, path: "/weather" },
] as const satisfies readonly NavItem[];
const seasons = [2026, 2025, 2024, 2023];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeNav = nav.find((n) => n.path === location.pathname) ?? nav[0];
  const [year, setYear] = useState(Number(new URLSearchParams(location.search).get("year") || 2026));
  const [meetingKey, setMeetingKey] = useState<number>();
  const [sessionKey, setSessionKey] = useState<number | undefined>(Number(new URLSearchParams(location.search).get("session")) || undefined);
  const [sessionType, setSessionType] = useState("Race");
  const [search, setSearch] = useState("");

  // Season calendar
  const meetingsQ = useData<Meeting[]>([year], "/meetings", { year });
  const meetings = meetingsQ.data ?? [];
  const racesQ = useData<Session[]>([year], "/sessions", { year });
  const grandPrixMeetings = meetings.filter((m) => m.meeting_name.toLowerCase().includes("grand prix") && !m.is_cancelled);
  const now = useNow();
  // Sprints also have session_type "Race", so key off the main race session to decide when a weekend is done.
  const raceEndByMeeting = new Map(
    (racesQ.data ?? []).filter((s) => s.session_name === "Race").map((s) => [s.meeting_key, new Date(s.date_end || s.date_start).getTime()]),
  );
  const raceStatus = (m: Meeting): "done" | "live" | "upcoming" => {
    const end = raceEndByMeeting.get(m.meeting_key);
    if (end != null && end <= now) return "done";
    return new Date(m.date_start).getTime() <= now ? "live" : "upcoming";
  };
  const completedKeys = new Set(grandPrixMeetings.filter((m) => raceStatus(m) === "done").map((m) => m.meeting_key));
  const completed = grandPrixMeetings.filter((m) => completedKeys.has(m.meeting_key));
  const currentMeeting =
    grandPrixMeetings.find((m) => m.meeting_key === meetingKey) ??
    completed.at(-1) ??
    grandPrixMeetings.find((m) => raceStatus(m) !== "done") ??
    grandPrixMeetings.at(-1);
  const mkey = currentMeeting?.meeting_key;
  const nextMeeting = grandPrixMeetings.find((m) => raceStatus(m) === "upcoming");

  useEffect(() => {
    const race = new URLSearchParams(location.search).get("race")?.toLowerCase();
    if (!meetingKey && race) {
      const found = grandPrixMeetings.find((m) => slugify(m.meeting_name) === race);
      if (found) setMeetingKey(found.meeting_key);
    }
  }, [grandPrixMeetings, location.search, meetingKey]);

  // Selected weekend + session
  const sessionsQ = useData<Session[]>([mkey], "/sessions", { meeting_key: mkey });
  const sessions = sessionsQ.data ?? [];
  const raceSession = sessions.find((s) => s.session_type === "Race");
  const raceResultsQ = useData<any[]>([raceSession?.session_key], "/session_result", { session_key: raceSession?.session_key });
  const raceDriversQ = useData<Driver[]>([raceSession?.session_key], "/drivers", { session_key: raceSession?.session_key });
  const raceWinnerResult = (raceResultsQ.data ?? []).find((r) => r.position === 1);
  const raceWinner = raceDriversQ.data?.find((d) => d.driver_number === raceWinnerResult?.driver_number);
  const selectedSession =
    sessions.find((s) => s.session_key === sessionKey) ||
    sessions.filter((s) => s.session_type === sessionType).at(-1) ||
    sessions.find((s) => s.session_name === sessionType) ||
    sessions.at(-1);
  const skey = selectedSession?.session_key;
  const driversQ = useData<Driver[]>([skey], "/drivers", { session_key: skey });
  const drivers = driversQ.data ?? [];
  const resultsQ = useData<any[]>([skey], "/session_result", { session_key: skey });
  const results = resultsQ.data ?? [];
  const driverByNo = useMemo(() => new Map(drivers.map((d) => [d.driver_number, d])), [drivers]);
  const topResults = [...results].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));

  // Most recent completed race drives the championship snapshot
  const recentRaceSession = (racesQ.data ?? []).filter((s) => s.session_type === "Race" && isPast(s.date_end || s.date_start)).at(-1);
  const recentMeeting = meetings.find((m) => m.meeting_key === recentRaceSession?.meeting_key);
  const standingsSessionKey = recentRaceSession?.session_key ?? skey;
  const standingsDrivers = useData<Driver[]>([standingsSessionKey], "/drivers", { session_key: standingsSessionKey }).data ?? [];
  const champQ = useData<any[]>([standingsSessionKey], "/championship_drivers", { session_key: standingsSessionKey });
  const constructorsQ = useData<any[]>([standingsSessionKey], "/championship_teams", { session_key: standingsSessionKey });
  const champ = byPosition(champQ.data ?? []);
  const constructors = byPosition(constructorsQ.data ?? []);
  const recentResultQ = useData<any[]>([recentRaceSession?.session_key], "/session_result", { session_key: recentRaceSession?.session_key });
  const recentDriversQ = useData<Driver[]>([recentRaceSession?.session_key], "/drivers", { session_key: recentRaceSession?.session_key });

  useEffect(() => {
    if (!skey) return;
    const params = new URLSearchParams(location.search);
    params.set("year", String(year));
    if (currentMeeting) params.set("race", slugify(currentMeeting.meeting_name));
    params.set("session", String(skey));
    history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  }, [year, mkey, skey, currentMeeting, location.pathname]);

  const lapsQ = useData<any[]>([skey], "/laps", { session_key: skey });
  const laps = lapsQ.data ?? [];
  const byLap = useMemo(() => {
    const agg = new Map<number, { lap: number; lap_duration?: number }>();
    for (const l of laps) {
      if (l.lap_duration == null) continue;
      const row: { lap: number; lap_duration?: number } = agg.get(l.lap_number) ?? { lap: l.lap_number };
      row.lap_duration = row.lap_duration == null ? l.lap_duration : Math.min(row.lap_duration, l.lap_duration);
      agg.set(l.lap_number, row);
    }
    return [...agg.values()].sort((a, b) => a.lap - b.lap);
  }, [laps]);

  const [fav, setFav] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("apex-favs") || "[]");
    } catch {
      return [];
    }
  });
  function toggleFav(n: number) {
    const next = fav.includes(n) ? fav.filter((x) => x !== n) : [...fav, n];
    setFav(next);
    localStorage.setItem("apex-favs", JSON.stringify(next));
  }

  const selectMeeting = (key: number) => {
    setMeetingKey(key);
    setSessionKey(undefined);
  };
  const selectSession = (s: Session) => {
    setSessionKey(s.session_key);
    setSessionType(s.session_type);
  };
  const loading = meetingsQ.isLoading || sessionsQ.isLoading;
  const err = meetingsQ.error || sessionsQ.error;
  const page = activeNav.path;

  return (
    <SidebarProvider>
      <AppSidebar
        nav={nav}
        activePath={page}
        year={year}
        years={seasons}
        onYearChange={(y) => {
          setYear(y);
          setMeetingKey(undefined);
          setSessionKey(undefined);
        }}
        completed={completed.length}
        total={grandPrixMeetings.length}
        meeting={currentMeeting}
      />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb className="hidden md:block">
            <BreadcrumbList>
              <BreadcrumbItem>{year}</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="max-w-48 truncate">{currentMeeting?.meeting_name ?? "Season"}</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{activeNav.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-2">
            <SelectField
              label="Grand Prix"
              hideLabel
              value={mkey == null ? "" : String(mkey)}
              onValueChange={(v) => selectMeeting(Number(v))}
              options={grandPrixMeetings.map((m) => {
                const status = raceStatus(m);
                return {
                  value: String(m.meeting_key),
                  label: (
                    <span className={status === "upcoming" ? "flex w-full items-center gap-3 text-muted-foreground/60" : "flex w-full items-center gap-3"}>
                      {m.meeting_name}
                      {status === "live" && (
                        <span data-meta className="ml-auto flex items-center gap-1 text-xs text-primary">
                          <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Live
                        </span>
                      )}
                      {status === "upcoming" && (
                        <span data-meta className="ml-auto text-xs tabular-nums">
                          {fmtDate(m.date_start, { day: "2-digit", month: "short" })}
                        </span>
                      )}
                    </span>
                  ),
                };
              })}
              triggerClassName="[&_[data-meta]]:hidden"
              className="w-44 sm:w-56"
            />
            <InputGroup className="hidden w-56 sm:flex">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Search drivers"
                placeholder="Search drivers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigate("/drivers");
                }}
              />
            </InputGroup>
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-4 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-medium tracking-tight md:text-3xl">{page === "/" ? "Season overview" : activeNav.name}</h1>
              <p className="text-sm text-muted-foreground">
                {currentMeeting?.meeting_name || "Formula 1 season overview"} · {year} season
              </p>
            </div>
            <div className="flex items-end gap-2">
              <SelectField
                label="Session"
                value={selectedSession?.session_key == null ? "" : String(selectedSession.session_key)}
                onValueChange={(v) => {
                  const s = sessions.find((x) => x.session_key === Number(v));
                  if (s) selectSession(s);
                }}
                options={sessions.map((s) => ({ value: String(s.session_key), label: s.session_name }))}
                className="w-44"
              />
              {page !== "/race" && (
                <Button variant="outline" onClick={() => navigate("/race")}>
                  <CalendarDays data-icon="inline-start" /> Race weekend <ChevronRight data-icon="inline-end" />
                </Button>
              )}
            </div>
          </div>

          {err && (
            <Alert variant="destructive">
              <AlertTitle>Race data unavailable</AlertTitle>
              <AlertDescription>{String((err as Error).message)}</AlertDescription>
            </Alert>
          )}
          {loading && (
            <Alert>
              <Spinner />
              <AlertTitle>Loading historical meetings from OpenF1…</AlertTitle>
            </Alert>
          )}
          {!loading && !err && !selectedSession && (
            <Alert>
              <AlertTitle>No {sessionType.toLowerCase()} session available</AlertTitle>
              <AlertDescription>Select another session or Grand Prix.</AlertDescription>
            </Alert>
          )}

          {page === "/" && (
            <OverviewView
              year={year}
              meeting={currentMeeting}
              grandPrixMeetings={grandPrixMeetings}
              completedCount={completed.length}
              completedKeys={completedKeys}
              scheduledCount={meetings.length}
              raceSession={raceSession}
              raceWinner={raceWinner}
              raceWinnerPoints={raceWinnerResult?.points}
              raceComplete={isPast(raceSession?.date_end || raceSession?.date_start)}
              raceLoading={raceResultsQ.isLoading || raceDriversQ.isLoading}
              nextMeeting={nextMeeting}
              champ={champ}
              champLoading={champQ.isLoading}
              constructors={constructors}
              standingsDrivers={standingsDrivers}
              recentMeeting={recentMeeting}
              recentResults={recentResultQ.data ?? []}
              recentResultsLoading={recentResultQ.isLoading}
              recentResultsError={recentResultQ.error}
              recentDrivers={recentDriversQ.data ?? []}
              byLap={byLap}
              lapsLoading={lapsQ.isLoading}
              onSelectMeeting={selectMeeting}
            />
          )}
          {page === "/race" && (
            <RaceView meeting={currentMeeting} sessions={sessions} session={selectedSession} onSession={selectSession} results={topResults} drivers={drivers} />
          )}
          {page === "/compare" && <CompareView drivers={drivers} sessionKey={skey} laps={laps} />}
          {page === "/telemetry" && <TelemetryView drivers={drivers} sessionKey={skey} />}
          {page === "/strategy" && <StrategyView drivers={drivers} sessionKey={skey} />}
          {page === "/standings" && <StandingsView drivers={standingsDrivers} champ={champ} teams={constructors} year={year} />}
          {page === "/drivers" && <DriversView drivers={drivers} results={results} year={year} fav={fav} onToggleFav={toggleFav} search={search} />}
          {page === "/circuit" && <CircuitView drivers={drivers} sessionKey={skey} />}
          {page === "/weather" && <WeatherView sessionKey={skey} />}
        </main>

        <footer className="mt-auto flex flex-wrap justify-between gap-2 border-t py-4 pr-36 pl-4 text-xs text-muted-foreground md:pl-6">
          <span className="font-medium tracking-wide">APEX / F1 ANALYTICS</span>
          <span>Historical data provided by OpenF1</span>
          <span>{year} season archive</span>
        </footer>
      </SidebarInset>

      <AssistantWidget
        context={{
          year,
          grandPrix: currentMeeting?.meeting_name ?? null,
          country: currentMeeting?.country_name ?? null,
          session: selectedSession ? { name: selectedSession.session_name, type: selectedSession.session_type } : null,
          grandPrixOptions: grandPrixMeetings.map((m) => ({ meeting_key: m.meeting_key, name: m.meeting_name })),
          raceClassification: topResults.slice(0, 10).map((r: any) => ({
            position: r.position,
            driver: driverByNo.get(r.driver_number)?.full_name ?? `Driver ${r.driver_number}`,
            team: driverByNo.get(r.driver_number)?.team_name ?? null,
            points: r.points ?? null,
            gap: r.gap_to_leader ?? null,
          })),
          driverStandings: champ.slice(0, 10).map((r: any) => ({
            position: r.position_current,
            driver: r.full_name ?? standingsDrivers.find((d) => d.driver_number === r.driver_number)?.full_name ?? `Driver ${r.driver_number}`,
            team: r.team_name,
            points: r.points_current,
          })),
          constructorStandings: constructors.slice(0, 10).map((r: any) => ({ position: r.position_current, team: r.team_name, points: r.points_current })),
        }}
        onSelectRace={selectMeeting}
      />
    </SidebarProvider>
  );
}

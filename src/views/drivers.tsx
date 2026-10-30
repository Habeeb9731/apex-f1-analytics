import type { CSSProperties } from "react";
import { Star } from "lucide-react";
import type { Driver } from "@/api";
import { teamColor } from "@/api";
import { useHeadshot } from "@/lib/f1";
import { cn } from "@/lib/utils";
import { ChartEmpty, DataNote } from "@/components/dashboard";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";

export function DriversView({
  drivers,
  results,
  year,
  fav,
  onToggleFav,
  search,
}: {
  drivers: Driver[];
  results: any[];
  year: number;
  fav: number[];
  onToggleFav: (n: number) => void;
  search: string;
}) {
  const filtered = drivers
    .filter((d) => `${d.full_name} ${d.team_name} ${d.name_acronym}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(fav.includes(b.driver_number)) - Number(fav.includes(a.driver_number)));
  const resultOf = (n: number) => results.find((r) => r.driver_number === n);

  return (
    <div className="space-y-6">
      {search && (
        <p className="text-sm text-muted-foreground">
          {filtered.length} driver{filtered.length === 1 ? "" : "s"} matching “{search}”
        </p>
      )}
      {filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((d) => {
            const r = resultOf(d.driver_number);
            const isFav = fav.includes(d.driver_number);
            return (
              <Card key={d.driver_number} className="relative gap-0 pt-0" style={{ "--team": teamColor(d) } as CSSProperties}>
                <div className="relative h-44 overflow-hidden bg-gradient-to-b from-(--team)/35 to-transparent">
                  <span aria-hidden className="absolute right-2 -bottom-6 pr-[0.08em] text-[7rem] leading-none font-medium tracking-[-0.08em] text-foreground/5">
                    {d.driver_number}
                  </span>
                  <DriverPhoto driver={d} year={year} />
                </div>
                <CardHeader className="pt-4">
                  <CardDescription className="truncate">{d.team_name}</CardDescription>
                  <CardTitle className="text-xl font-medium tracking-tight">
                    {d.name_acronym} <span className="text-sm font-normal text-muted-foreground">#{d.driver_number}</span>
                  </CardTitle>
                  <CardAction>
                    <Toggle
                      size="sm"
                      pressed={isFav}
                      onPressedChange={() => onToggleFav(d.driver_number)}
                      aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star className={cn(isFav && "fill-primary text-primary")} />
                    </Toggle>
                  </CardAction>
                </CardHeader>
                <CardContent className="pb-4">
                  <p className="truncate text-sm font-medium">{d.full_name}</p>
                </CardContent>
                <CardFooter className="mt-auto grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Finish", r?.position ?? "—"],
                    ["Points", r?.points ?? "—"],
                    ["Status", r?.dsq ? "DSQ" : r?.dns ? "DNS" : r?.dnf ? "DNF" : r ? "OK" : "—"],
                  ].map(([k, v]) => (
                    <div key={k as string} className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">{k}</p>
                      <p className="font-mono text-sm font-medium">{v}</p>
                    </div>
                  ))}
                </CardFooter>
                {isFav && (
                  <Badge className="absolute top-3 left-3">
                    <Star className="fill-current" /> Favorite
                  </Badge>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <ChartEmpty loading={!drivers.length} text="No drivers match the search." />
      )}
      <DataNote>Profile stats come from the selected session classification, not a driver's career history. Year: {year}.</DataNote>
    </div>
  );
}

function DriverPhoto({ driver, year }: { driver: Driver; year: number }) {
  const { src, onError } = useHeadshot(driver, year);
  if (!src) return null;
  return <img key={src} src={src} alt={driver.full_name} onError={onError} className="absolute inset-x-0 bottom-0 mx-auto h-40 object-contain" />;
}

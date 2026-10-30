import type { ComponentType, ReactNode } from "react";
import { Activity, Info } from "lucide-react";
import { useHeadshot } from "@/lib/f1";
import { cn } from "@/lib/utils";
import type { Driver } from "@/api";
import { teamColor } from "@/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

export type Option = { value: string; label: ReactNode };

export function SelectField({
  label,
  value,
  onValueChange,
  options,
  className,
  triggerClassName,
  hideLabel,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  className?: string;
  triggerClassName?: string;
  hideLabel?: boolean;
}) {
  return (
    <Field className={cn("gap-1.5", className)}>
      <FieldLabel className={cn("text-xs font-medium text-muted-foreground", hideLabel && "sr-only")}>
        {label}
      </FieldLabel>
      <Select value={value || undefined} onValueChange={onValueChange}>
        <SelectTrigger aria-label={label} className={cn("w-full", triggerClassName)}>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options
            .filter((o) => o.value !== "")
            .map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function driverOptions(drivers: Driver[]): Option[] {
  return drivers.map((d) => ({
    value: String(d.driver_number),
    label: (
      <span className="flex items-center gap-2">
        <TeamSwatch color={teamColor(d)} />
        {d.name_acronym} · {d.full_name}
      </span>
    ),
  }));
}

export function TeamSwatch({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn("inline-block h-3.5 w-1 shrink-0 rounded-full", className)} style={{ background: color }} />;
}

export function DriverAvatar({ driver, year, className }: { driver?: Driver; year?: number; className?: string }) {
  const { src, onError } = useHeadshot(driver, year, "2col");
  return (
    <Avatar className={cn("bg-muted", className)}>
      {src && <AvatarImage key={src} src={src} alt="" className="object-cover object-top" onLoadingStatusChange={(s) => s === "error" && onError()} />}
      <AvatarFallback className="text-[10px] font-medium">{driver?.name_acronym ?? "—"}</AvatarFallback>
    </Avatar>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  meta,
  accent = "var(--chart-1)",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  accent?: string;
}) {
  return (
    <Card size="sm" className="relative">
      <span aria-hidden className="absolute inset-y-0 left-0 w-0.5" style={{ background: accent }} />
      <CardContent className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted" style={{ color: accent }}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-medium tracking-tight tabular-nums" title={typeof value === "string" ? value : undefined}>
            {value}
          </p>
          {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function ChartEmpty({ loading, text, className }: { loading: boolean; text: string; className?: string }) {
  return (
    <Empty className={cn("min-h-40 border border-dashed p-6", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">{loading ? <Spinner /> : <Activity />}</EmptyMedia>
        <EmptyDescription>{loading ? "Loading session data…" : text}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function DataNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 text-xs text-muted-foreground", className)}>
      <Info className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-1">
        {eyebrow && <p className="text-xs font-medium tracking-wider text-primary uppercase">{eyebrow}</p>}
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export const tooltipCursor = { stroke: "var(--border)" };

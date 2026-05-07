import { format } from "date-fns";
import { ko } from "date-fns/locale";

function parseItemDate(value: string | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatItemDate(
  value: string | Date | null | undefined,
  pattern = "PPP"
): string {
  if (!value) {
    return "-";
  }

  const parsed = parseItemDate(value);
  return parsed ? format(parsed, pattern, { locale: ko }) : "-";
}

export function formatItemDateNumeric(
  value: string | Date | null | undefined
): string {
  if (!value) {
    return "-";
  }

  const parsed = parseItemDate(value);
  if (!parsed) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

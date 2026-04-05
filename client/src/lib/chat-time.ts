import { format, isSameYear, isToday } from "date-fns";
import { ko } from "date-fns/locale";

export function parseChatDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatChatMessageTime(value?: string | null): string {
  const date = parseChatDate(value);
  return date ? format(date, "a h:mm", { locale: ko }) : "";
}

export function formatChatDateDivider(value?: string | null): string {
  const date = parseChatDate(value);
  return date ? format(date, "yyyy년 M월 d일", { locale: ko }) : "";
}

export function formatChatRoomTimestamp(value?: string | null): string {
  const date = parseChatDate(value);

  if (!date) {
    return "";
  }

  if (isToday(date)) {
    return format(date, "a h:mm", { locale: ko });
  }

  if (isSameYear(date, new Date())) {
    return format(date, "M월 d일", { locale: ko });
  }

  return format(date, "yyyy.MM.dd", { locale: ko });
}

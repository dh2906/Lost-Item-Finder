import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { isSameDay } from "date-fns";
import {
  ArrowLeft,
  Send,
  ChevronRight,
  CameraOff,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import {
  useChatMessages,
  useChatRooms,
  useSendChatMessage,
} from "@/hooks/use-chat";
import {
  formatChatDateDivider,
  formatChatMessageTime,
  parseChatDate,
} from "@/lib/chat-time";
import { cn } from "@/lib/utils";
import { MAX_CHAT_MESSAGE_LENGTH } from "@shared/chat";

export default function ChatRoomPage() {
  const [, params] = useRoute("/chat/:id");
  const roomId = Number(params?.id ?? 0);
  const { user } = useAuth();
  const { data: rooms = [] } = useChatRooms();
  const { data: messages = [], isLoading } = useChatMessages(roomId);
  const sendMessage = useSendChatMessage(roomId);
  const [content, setContent] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);

  const room = useMemo(
    () => rooms.find((entry) => entry.id === roomId),
    [rooms, roomId]
  );
  const messageGroups = useMemo(() => {
    return messages.reduce<
      Array<
        | { type: "date"; key: string; label: string }
        | { type: "message"; key: string; message: (typeof messages)[number] }
      >
    >((acc, message, index) => {
      const previousMessage = messages[index - 1];
      const currentDate = parseChatDate(message.createdAt);
      const previousDate = parseChatDate(previousMessage?.createdAt);

      if (
        currentDate &&
        (!previousDate || !isSameDay(currentDate, previousDate))
      ) {
        acc.push({
          type: "date",
          key: `date-${message.id}`,
          label: formatChatDateDivider(message.createdAt),
        });
      }

      acc.push({
        type: "message",
        key: `message-${message.id}`,
        message,
      });

      return acc;
    }, []);
  }, [messages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const submitMessage = () => {
    const nextValue = content.trim();
    if (
      !nextValue ||
      nextValue.length > MAX_CHAT_MESSAGE_LENGTH ||
      sendMessage.isPending ||
      isSubmittingRef.current
    ) {
      return;
    }

    isSubmittingRef.current = true;
    sendMessage.mutate(nextValue, {
      onSuccess: () => setContent(""),
      onSettled: () => {
        isSubmittingRef.current = false;
      },
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitMessage();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  };

  return (
    <Layout>
      <div className="container flex h-[calc(100dvh-120px)] min-h-0 flex-col overflow-hidden py-3 md:h-[calc(100dvh-124px)] md:py-4 xl:max-w-[960px]">
        <h1 className="sr-only">{room?.item ? `${room.item.title} 채팅` : "채팅"}</h1>
        <div className="mb-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="shrink-0 rounded-full hover:bg-secondary"
          >
            <Link href="/chats">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">채팅 목록</span>
            </Link>
          </Button>

          {room?.item ? (
            <Link
              href={`/item/${room.itemId}`}
              className="flex flex-1 items-center gap-3 rounded-2xl border border-border/70 bg-white/90 p-2 shadow-sm transition-all hover:bg-secondary/40 hover:shadow"
            >
              {" "}
              <div className="shrink-0">
                {room.item.imageUrl ? (
                  <img
                    src={room.item.imageUrl}
                    alt={room.item.title}
                    loading="eager"
                    decoding="async"
                    className="h-11 w-11 rounded-xl border border-border/50 object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/50 bg-secondary/50 text-muted-foreground">
                    <CameraOff className="h-5 w-5 opacity-50" />
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <p className="truncate text-sm font-bold text-foreground">
                  {room.item.title}
                </p>
                <p className="text-[11px] font-semibold text-primary">
                  {room.item.reportType === "found" ? "습득물" : "분실물"}
                </p>
              </div>
              <ChevronRight className="mr-2 h-5 w-5 shrink-0 text-muted-foreground/50" />
            </Link>
          ) : (
            <h1 className="truncate text-lg font-semibold flex-1">채팅</h1>
          )}
        </div>

        <Card className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border-border/70 bg-white/90">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
            <div
              ref={messagesContainerRef}
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-[24px] border border-border/70 bg-secondary/20 p-4"
            >
              {isLoading ? (
                <p className="text-sm text-muted-foreground">
                  메시지를 불러오는 중입니다.
                </p>
              ) : messages.length === 0 ? (
                <div className="m-auto max-w-sm text-center">
                  <Send className="mx-auto mb-3 h-8 w-8 text-muted-foreground/45" />
                  <p className="text-sm font-semibold text-foreground">
                    아직 메시지가 없습니다
                  </p>
                  <p className="mt-1 break-keep text-sm leading-6 text-muted-foreground [word-break:keep-all]">
                    물건 확인에 필요한 장소, 시간, 특징부터 간단히 남겨보세요.
                  </p>
                </div>
              ) : (
                messageGroups.map((entry) => {
                  if (entry.type === "date") {
                    return (
                      <div key={entry.key} className="flex justify-center py-1">
                        <span className="rounded-full border border-border/70 bg-white/90 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                          {entry.label}
                        </span>
                      </div>
                    );
                  }

                  const { message } = entry;
                  const isMine = message.senderId === user?.id;
                  const unreadCount = isMine && message.isRead !== 1 ? 1 : 0;
                  const timeLabel = formatChatMessageTime(message.createdAt);

                  return (
                    <div
                      key={entry.key}
                      className={cn(
                        "flex",
                        isMine ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "flex max-w-[88%] items-end gap-2",
                          isMine ? "flex-row" : "flex-row"
                        )}
                      >
                        {isMine ? (
                          <>
                            <div className="flex min-w-[2.5rem] flex-col items-end leading-none">
                              {unreadCount > 0 ? (
                                <span className="text-[11px] font-semibold text-amber-500">
                                  {unreadCount}
                                </span>
                              ) : null}
                              <span className="mt-1 text-[11px] text-muted-foreground">
                                {timeLabel}
                              </span>
                            </div>
                            <div
                              className={cn(
                                "max-w-[80%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-sm",
                                "bg-primary text-primary-foreground"
                              )}
                            >
                              <p>{message.content}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              className={cn(
                                "max-w-[80%] rounded-[22px] border border-border/70 bg-white px-4 py-3 text-sm leading-6 shadow-sm"
                              )}
                            >
                              <p>{message.content}</p>
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {timeLabel}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSubmit} className="shrink-0 space-y-3">
              <Textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={MAX_CHAT_MESSAGE_LENGTH}
                placeholder="메시지를 입력해 주세요"
                className="min-h-[84px] max-h-[140px] resize-none rounded-[22px]"
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {content.trim().length}/{MAX_CHAT_MESSAGE_LENGTH}자
                </p>
                <Button
                  type="submit"
                  disabled={
                    sendMessage.isPending ||
                    !content.trim() ||
                    content.trim().length > MAX_CHAT_MESSAGE_LENGTH
                  }
                  className="rounded-full"
                >
                  <Send className="mr-2 h-4 w-4" />
                  보내기
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

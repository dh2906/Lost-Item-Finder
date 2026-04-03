import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Send } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useChatMessages, useChatRooms, useSendChatMessage } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";

export default function ChatRoomPage() {
  const [, params] = useRoute("/chat/:id");
  const roomId = Number(params?.id ?? 0);
  const { user } = useAuth();
  const { data: rooms = [] } = useChatRooms();
  const { data: messages = [], isLoading } = useChatMessages(roomId);
  const sendMessage = useSendChatMessage(roomId);
  const [content, setContent] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const room = useMemo(() => rooms.find((entry) => entry.id === roomId), [rooms, roomId]);
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextValue = content.trim();
    if (!nextValue || sendMessage.isPending) {
      return;
    }

    sendMessage.mutate(nextValue, {
      onSuccess: () => setContent(""),
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      const nextValue = content.trim();
      if (!nextValue || sendMessage.isPending) {
        return;
      }

      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <Layout>
      <div className="container flex h-[calc(100dvh-120px)] min-h-0 flex-col overflow-hidden py-3 md:h-[calc(100dvh-124px)] md:py-4 xl:max-w-[960px]">
        <div className="mb-2 flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="w-fit rounded-full">
            <Link href="/chats">
              <ArrowLeft className="mr-1 h-4 w-4" />
              채팅 목록
            </Link>
          </Button>
          <h1 className="truncate text-lg font-semibold">
            {room?.item?.title ?? "채팅"}
          </h1>
        </div>

        <Card className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border-border/70 bg-white/90">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
            <div
              ref={messagesContainerRef}
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-[24px] border border-border/70 bg-secondary/20 p-4"
            >
              {isLoading ? (
                <p className="text-sm text-muted-foreground">메시지를 불러오는 중입니다.</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">아직 메시지가 없습니다. 먼저 말을 걸어보세요.</p>
              ) : (
                messages.map((message) => {
                  const isMine = message.senderId === user?.id;

                  return (
                    <div
                      key={message.id}
                      className={cn("flex", isMine ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-sm",
                          isMine
                            ? "bg-primary text-primary-foreground"
                            : "bg-white border border-border/70"
                        )}
                      >
                        <p>{message.content}</p>
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
                placeholder="메시지를 입력해 주세요"
                className="min-h-[84px] max-h-[140px] resize-none rounded-[22px]"
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={sendMessage.isPending || !content.trim()} className="rounded-full">
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

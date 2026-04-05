import { Link } from "wouter";
import { MessageCircle, Image as ImageIcon } from "lucide-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useChatRooms } from "@/hooks/use-chat";
import { formatChatRoomTimestamp } from "@/lib/chat-time";

export default function ChatsPage() {
  const { user } = useAuth();
  const { data: rooms = [], isLoading } = useChatRooms();

  return (
    <Layout>
      <div className="container py-8 xl:max-w-[960px]">
        <Card className="border-border/70 bg-white/90">
          <CardHeader>
            <CardTitle className="text-2xl">채팅 목록</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">
                채팅 목록을 불러오는 중입니다.
              </p>
            ) : rooms.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-[24px] border border-dashed border-border/70 px-6 py-16 text-center">
                <MessageCircle className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  아직 시작한 채팅이 없습니다.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rooms.map((room) => {
                  const previewText =
                    room.latestMessage?.content?.trim() ||
                    "아직 주고받은 메시지가 없습니다.";
                  const latestTimeLabel = formatChatRoomTimestamp(
                    room.latestMessage?.createdAt ?? room.updatedAt
                  );

                  const otherUser = room.otherUser; 
                  const imageUrl = room.item?.imageUrl;

                  return (
                    <Link key={room.id} href={`/chat/${room.id}`}>
                      <a className="block rounded-[20px] border border-border/70 bg-secondary/10 p-4 transition-colors hover:bg-secondary/30">
                        <div className="flex items-center gap-4">
                          <div className="shrink-0">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={room.item?.title || "물건 사진"}
                                className="h-14 w-14 rounded-xl border border-border/50 object-cover"
                              />
                            ) : (
                              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border/50 bg-secondary/50 text-muted-foreground">
                                <ImageIcon className="h-6 w-6 opacity-50" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground">
                                {otherUser?.nickname}
                              </p>
                              <span className="truncate text-xs text-muted-foreground max-w-[120px]">
                                {room.item?.title ?? `게시물 #${room.itemId}`}
                              </span>
                              {room.hasUnread && (
                                <span
                                  className="h-2 w-2 rounded-full bg-primary"
                                  aria-label="읽지 않은 메시지 있음"
                                />
                              )}
                            </div>
                            <p
                              className={`mt-1 truncate text-sm ${
                                room.hasUnread
                                  ? "font-medium text-foreground"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {previewText}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-2">
                            {latestTimeLabel && (
                              <span className="text-xs font-medium text-muted-foreground">
                                {latestTimeLabel}
                              </span>
                            )}
                            <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-muted-foreground border border-border/50 shadow-sm">
                              {room.item?.reportType === "found"
                                ? "습득물"
                                : "분실물"}
                            </span>
                          </div>
                        </div>
                      </a>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

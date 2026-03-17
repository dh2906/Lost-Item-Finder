import { useState, useEffect, useRef } from "react";
import { Link, useRoute } from "wouter";
import { Send, ArrowLeft, MessageSquare, AlertCircle } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ConversationSummary {
  id: number;
  itemId: number | null;
  itemTitle?: string;
  otherUserName: string;
  lastMessage?: string;
  unreadCount: number;
}

interface Message {
  id: number;
  senderId: number;
  content: string;
  createdAt: string;
  read: boolean;
}

function useConversations() {
  const [data, setData] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/conversations", { credentials: "include" })
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}

function useMessages(conversationId: number | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) return;
    setLoading(true);
    fetch(`/api/conversations/${conversationId}/messages`, { credentials: "include" })
      .then((r) => r.json())
      .then(setMessages)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [conversationId]);

  const sendMsg = async (content: string) => {
    if (!conversationId) return;
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const newMsg = await res.json();
      setMessages((prev) => [...prev, newMsg]);
    }
  };

  return { messages, loading, sendMsg };
}

export default function MessagesPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: conversations, loading: convLoading } = useConversations();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { messages, loading: msgLoading, sendMsg } = useMessages(selectedId);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (authLoading) return <Layout><div className="container py-20 text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></Layout>;

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container max-w-md py-20 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="mb-2 text-2xl font-semibold">로그인이 필요합니다</h1>
          <Button asChild><Link href="/login">로그인</Link></Button>
        </div>
      </Layout>
    );
  }

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setDraft("");
    try {
      await sendMsg(trimmed);
    } catch {
      toast({ variant: "destructive", title: "메시지 전송에 실패했습니다" });
    }
  };

  const selectedConv = conversations.find((c) => c.id === selectedId);

  return (
    <Layout>
      <div className="container max-w-5xl py-8">
        <Button variant="ghost" size="sm" asChild className="mb-5 rounded-full">
          <Link href="/">
            <ArrowLeft className="mr-1 h-4 w-4" />
            돌아가기
          </Link>
        </Button>

        <div className="grid h-[600px] gap-0 overflow-hidden rounded-2xl border border-border/70 shadow-sm lg:grid-cols-[280px_1fr]">
          {/* Conversation list */}
          <div className="flex flex-col border-r border-border/70 bg-white/90">
            <div className="border-b border-border/70 p-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <MessageSquare className="h-5 w-5 text-primary" />
                쿠편함
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {convLoading ? (
                <div className="space-y-2 p-3">
                  {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-30" />
                  대화 내역이 없습니다
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                      selectedId === conv.id && "bg-primary/5 border-l-2 border-primary"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{conv.otherUserName}</p>
                      {conv.itemTitle && <p className="truncate text-xs text-muted-foreground">{conv.itemTitle}</p>}
                      {conv.lastMessage && <p className="truncate text-xs text-muted-foreground mt-0.5">{conv.lastMessage}</p>}
                    </div>
                    {conv.unreadCount > 0 && (
                      <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[11px]">{conv.unreadCount}</Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className="flex flex-col bg-muted/20">
            {selectedId && selectedConv ? (
              <>
                <div className="border-b border-border/70 bg-white/90 px-5 py-3">
                  <p className="font-semibold">{selectedConv.otherUserName}</p>
                  {selectedConv.itemTitle && <p className="text-xs text-muted-foreground">{selectedConv.itemTitle}에 대한 대화</p>}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {msgLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  ) : messages.map((msg) => {
                    const isMe = msg.senderId === user?.id;
                    return (
                      <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm",
                          isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-white border border-border/70 rounded-bl-sm"
                        )}>
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
                <div className="border-t border-border/70 bg-white/90 p-3">
                  <div className="flex gap-2">
                    <Input
                      className="flex-1 rounded-full"
                      placeholder="메시지를 입력하세요..."
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                    />
                    <Button size="icon" className="rounded-full" onClick={handleSend} disabled={!draft.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="mb-3 h-12 w-12 opacity-20" />
                <p className="text-sm">대화를 선택하세요</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

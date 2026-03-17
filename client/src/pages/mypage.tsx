import { useState } from "react";
import { Link } from "wouter";
import { PackageOpen, Pencil, Trash2, CheckCircle, Circle, Eye } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMyItems, useUpdateItem, useDeleteItem } from "@/hooks/use-items";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function MyPage() {
  const { user, isAuthenticated } = useAuth();
  const { data: myItems, isLoading } = useMyItems();
  const updateMutation = useUpdateItem();
  const deleteMutation = useDeleteItem();
  const { toast } = useToast();

  const [tab, setTab] = useState<"all" | "found" | "lost">("all");
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">로그인 후 이용할 수 있습니다.</p>
          <Button asChild>
            <Link href="/login">로그인</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const filteredItems = (myItems ?? []).filter((item) => {
    if (tab === "all") return true;
    return item.reportType === tab;
  });

  const activeCount = (myItems ?? []).filter((i) => !i.status || i.status === "active").length;
  const resolvedCount = (myItems ?? []).filter((i) => i.status === "resolved").length;

  const handleToggleStatus = async (id: number, currentStatus: string | null) => {
    const newStatus = currentStatus === "resolved" ? "active" : "resolved";
    try {
      await updateMutation.mutateAsync({ id, data: { status: newStatus } });
      toast({
        title: newStatus === "resolved" ? "해결됨으로 표시했어요" : "다시 활성화했어요",
      });
    } catch {
      toast({ variant: "destructive", title: "상태 변경 실패" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget);
      toast({ title: "게시물이 삭제되었습니다" });
      setDeleteTarget(null);
    } catch {
      toast({ variant: "destructive", title: "삭제 실패" });
    }
  };

  return (
    <Layout>
      <div className="section-container">
        <div className="container max-w-4xl">
          {/* 프로필 헤더 */}
          <div className="mb-8 flex items-center gap-4 rounded-2xl border bg-white/80 p-6 shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-2xl font-bold text-primary">
              {user?.name?.[0] || user?.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold">{user?.name || user?.username}</h1>
              <p className="text-sm text-muted-foreground">{user?.username}</p>
              <div className="mt-2 flex gap-3 text-sm">
                <span className="text-muted-foreground">진행 중 <span className="font-semibold text-foreground">{activeCount}</span></span>
                <span className="text-muted-foreground">해결됨 <span className="font-semibold text-green-600">{resolvedCount}</span></span>
              </div>
            </div>
          </div>

          {/* 탭 */}
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold">내 게시물</h2>
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="h-9 rounded-full border border-border/60 bg-white p-0.5">
                <TabsTrigger value="all" className="rounded-full px-3 text-xs">
전체</TabsTrigger>
                <TabsTrigger value="found" className="rounded-full px-3 text-xs">습득물</TabsTrigger>
                <TabsTrigger value="lost" className="rounded-full px-3 text-xs">분실물</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
              <PackageOpen className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">등록한 게시물이 없어요</p>
              <p className="mt-1 text-sm text-muted-foreground">하단 버튼으로 첫 게시물을 등록해보세요.</p>
              <Button className="mt-4" asChild>
                <Link href="/report">게시물 등록하기</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const isResolved = item.status === "resolved";
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-4 rounded-xl border bg-white/80 p-4 shadow-sm transition-opacity",
                      isResolved && "opacity-60"
                    )}
                  >
                    {/* 이미지 썬네일 */}
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                          <PackageOpen className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={item.reportType === "found" ? "default" : "secondary"}
                          className="text-[11px]"
                        >
                          {item.reportType === "found" ? "습득" : "분실"}
                        </Badge>
                        {isResolved && (
                          <Badge variant="outline" className="text-[11px] text-green-600 border-green-200 bg-green-50">
                            해결됨
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.date ? format(new Date(item.date), "yyyy.MM.dd", { locale: ko }) : ""}
                        {item.location && ` · ${item.location}`}
                      </p>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        title="상세보기"
                        asChild
                      >
                        <Link href={`/item/${item.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8 rounded-lg",
                          isResolved ? "text-green-600" : "text-muted-foreground"
                        )}
                        title={isResolved ? "활성화" : "해결됨 표시"}
                        onClick={() => handleToggleStatus(item.id, item.status)}
                        disabled={updateMutation.isPending}
                      >
                        {isResolved ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                        title="삭제"
                        onClick={() => setDeleteTarget(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>게시물을 삭제하시겠어요?</DialogTitle>
            <DialogDescription>
              삭제하면 복구할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

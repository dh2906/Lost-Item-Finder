import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  PackageOpen,
  CheckCircle2,
  Trash2,
  Edit3,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyItems, useUpdateItem, useDeleteItem } from "@/hooks/use-items";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Item } from "@shared/schema";

type FilterTab = "all" | "found" | "lost" | "resolved";

function StatusBadge({ status }: { status: string | null }) {
  return status === "resolved" ? (
    <Badge className="bg-green-100 text-green-700 border-green-200">
      <CheckCircle2 className="mr-1 h-3 w-3" />
      해결
    </Badge>
  ) : (
    <Badge variant="outline" className="border-primary/30 text-primary">
      활성
    </Badge>
  );
}

function ItemRow({ item }: { item: Item }) {
  const { toast } = useToast();
  const updateMutation = useUpdateItem();
  const deleteMutation = useDeleteItem();

  const handleResolve = () => {
    updateMutation.mutate(
      { id: item.id, data: { status: item.status === "resolved" ? "active" : "resolved" } },
      {
        onSuccess: () =>
          toast({
            title: item.status === "resolved" ? "활성으로 변경되었습니다" : "해결된 게시물로 표시됩니다",
          }),
        onError: (err) => toast({ variant: "destructive", title: err.message }),
      }
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(item.id, {
      onSuccess: () => toast({ title: "게시물이 삭제되었습니다" }),
      onError: (err) => toast({ variant: "destructive", title: err.message }),
    });
  };

  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-xl border p-4 transition-colors",
        item.status === "resolved" ? "bg-muted/40 opacity-70" : "bg-white hover:border-primary/30"
      )}
    >
      {/* Thumbnail */}
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
            <PackageOpen className="h-6 w-6" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <Badge variant={item.reportType === "found" ? "default" : "secondary"} className="text-xs">
            {item.reportType === "found" ? "습득" : "분실"}
          </Badge>
          <StatusBadge status={item.status} />
          {item.itemCategory && (
            <span className="text-xs text-muted-foreground">{item.itemCategory}</span>
          )}
        </div>
        <h3 className="font-semibold truncate">{item.title}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          {item.location && <span className="mr-2">📍 {item.location}</span>}
          {item.date && (
            <span>{format(new Date(item.date), "yyyy.MM.dd", { locale: ko })}</span>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-full text-xs"
          onClick={handleResolve}
          disabled={updateMutation.isPending}
        >
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
          {item.status === "resolved" ? "활성으로" : "해결"}
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" asChild>
          <Link href={`/item/${item.id}`}>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>게시물을 삭제할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                "{item.title}" 게시물이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수
                없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90"
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default function MyPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: myItems, isLoading } = useMyItems();
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

  if (authLoading) {
    return (
      <Layout>
        <div className="container max-w-3xl py-20 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container max-w-md py-20 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="mb-2 text-2xl font-semibold">로그인이 필요합니다</h1>
          <p className="mb-6 text-muted-foreground">마이페이지를 보려면 로그인이 필요합니다.</p>
          <Button asChild>
            <Link href="/login">로그인하기</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const filtered = (myItems ?? []).filter((item) => {
    if (filterTab === "resolved") return item.status === "resolved";
    if (filterTab === "found") return item.reportType === "found" && item.status !== "resolved";
    if (filterTab === "lost") return item.reportType === "lost" && item.status !== "resolved";
    return true;
  });

  const stats = {
    total: myItems?.length ?? 0,
    active: myItems?.filter((i) => i.status !== "resolved").length ?? 0,
    resolved: myItems?.filter((i) => i.status === "resolved").length ?? 0,
  };

  return (
    <Layout>
      <div className="section-container">
        <div className="container max-w-3xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">마이페이지</h1>
            <p className="mt-1 text-muted-foreground">
              {user?.name || user?.username}님의 게시물 현황
            </p>
          </div>

          {/* Stats */}
          <div className="mb-8 grid grid-cols-3 gap-4">
            {[
              { label: "전체 게시물", value: stats.total },
              { label: "활성", value: stats.active },
              { label: "해결됨", value: stats.resolved },
            ].map(({ label, value }) => (
              <Card key={label} className="text-center">
                <CardContent className="pt-6">
                  <p className="text-3xl font-bold text-primary">{value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* My Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>나의 게시물</CardTitle>
              <Button size="sm" asChild className="rounded-full">
                <Link href="/report">게시물 등록</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as FilterTab)} className="mb-4">
                <TabsList className="h-9 rounded-full">
                  <TabsTrigger value="all" className="rounded-full text-xs">전체 ({stats.total})</TabsTrigger>
                  <TabsTrigger value="found" className="rounded-full text-xs">습득물</TabsTrigger>
                  <TabsTrigger value="lost" className="rounded-full text-xs">분실물</TabsTrigger>
                  <TabsTrigger value="resolved" className="rounded-full text-xs">해결됨 ({stats.resolved})</TabsTrigger>
                </TabsList>
              </Tabs>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <PackageOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground">게시물이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((item) => (
                    <ItemRow key={item.id} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

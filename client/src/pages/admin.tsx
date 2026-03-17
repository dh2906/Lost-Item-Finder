import { useEffect, useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Shield, Trash2, Users, Package, CheckCircle, BarChart3, AlertCircle } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { Item } from "@shared/schema";

interface AdminStats {
  totalItems: number;
  totalUsers: number;
  foundItems: number;
  lostItems: number;
  resolvedItems: number;
  dailyStats: { day: string; cnt: string }[];
  categoryStats: { item_category: string; cnt: string }[];
}

function useAdminStats() {
  const [data, setData] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/admin/stats", { credentials: "include" })
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);
  return { data, loading };
}

function useAdminItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/admin/items", { credentials: "include" })
      .then((r) => r.json())
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);
  const deleteItem = async (id: number) => {
    const res = await fetch(`/api/admin/items/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
    return res.ok;
  };
  return { items, loading, deleteItem };
}

export default function AdminPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { data: stats, loading: statsLoading } = useAdminStats();
  const { items, loading: itemsLoading, deleteItem } = useAdminItems();
  const { toast } = useToast();

  if (isLoading) return <Layout><div className="container py-20 text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></Layout>;

  if (!isAuthenticated || (user as any)?.role !== "admin") {
    return (
      <Layout>
        <div className="container max-w-md py-20 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h1 className="mb-2 text-2xl font-semibold">관리자만 접근 가능합니다</h1>
          <Button asChild><Link href="/">홈으로</Link></Button>
        </div>
      </Layout>
    );
  }

  const handleDelete = async (id: number) => {
    const ok = await deleteItem(id);
    toast({ title: ok ? "삭제 완료" : "삭제 실패", variant: ok ? "default" : "destructive" });
  };

  return (
    <Layout>
      <div className="container max-w-6xl py-8">
        <div className="mb-8 flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">관리자 대시보드</h1>
        </div>

        {/* Stats */}
        {!statsLoading && stats && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "전체 게시물", value: stats.totalItems, icon: Package },
              { label: "습득물", value: stats.foundItems, icon: Package },
              { label: "분실물", value: stats.lostItems, icon: Package },
              { label: "해결됨", value: stats.resolvedItems, icon: CheckCircle },
              { label: "전체 유저", value: stats.totalUsers, icon: Users },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{label}</span>
                  </div>
                  <p className="text-2xl font-bold">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Category stats */}
        {stats && stats.categoryStats.length > 0 && (
          <Card className="mb-8">
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />카테고리별 분포</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {stats.categoryStats.map(({ item_category, cnt }) => (
                  <div key={item_category} className="flex items-center gap-2 rounded-full border border-border/60 bg-white px-3 py-1.5">
                    <span className="text-sm font-medium">{item_category}</span>
                    <Badge variant="secondary">{cnt}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Item list */}
        <Card>
          <CardHeader><CardTitle>게시물 관리 ({items.length}건)</CardTitle></CardHeader>
          <CardContent>
            {itemsLoading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-white p-3">
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                      {item.imageUrl && <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={item.reportType === "found" ? "default" : "secondary"} className="text-xs">{item.reportType === "found" ? "습득" : "분실"}</Badge>
                        <span className="truncate text-sm font-medium">{item.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.location && `${item.location} · `}
                        {item.date && format(new Date(item.date), "yyyy.MM.dd", { locale: ko })}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>게시물을 삭제할까요?</AlertDialogTitle>
                          <AlertDialogDescription>"{item.title}" 게시물이 영구적으로 삭제됩니다.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive hover:bg-destructive/90">삭제</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

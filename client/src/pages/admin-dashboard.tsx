import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Ban,
  PackageSearch,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { buildUrl, api, type AdminDashboardResponse, type AdminItemsResponse, type AdminUsersResponse } from "@shared/routes";

const dashboardQueryKey = [api.admin.dashboard.path] as const;

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildQueryString(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function getRoleBadgeVariant(role: "member" | "admin") {
  return role === "admin" ? "warning" : "secondary";
}

function getStatusBadgeVariant(status: "active" | "suspended") {
  return status === "active" ? "success" : "destructive";
}

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [itemSearch, setItemSearch] = useState("");
  const [itemTypeFilter, setItemTypeFilter] = useState("all");

  const { data: dashboard, isLoading: isDashboardLoading } =
    useQuery<AdminDashboardResponse>({
      queryKey: dashboardQueryKey,
      queryFn: async () => {
        const res = await fetch(api.admin.dashboard.path, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("관리자 대시보드 데이터를 불러오지 못했습니다.");
        }
        return res.json();
      },
    });

  const { data: users = [], isLoading: isUsersLoading } =
    useQuery<AdminUsersResponse>({
      queryKey: [
        api.admin.users.path,
        userSearch,
        userRoleFilter,
        userStatusFilter,
      ],
      queryFn: async () => {
        const res = await fetch(
          `${api.admin.users.path}${buildQueryString({
            search: userSearch.trim() || undefined,
            role: userRoleFilter !== "all" ? userRoleFilter : undefined,
            status: userStatusFilter !== "all" ? userStatusFilter : undefined,
          })}`,
          {
            credentials: "include",
          }
        );
        if (!res.ok) {
          throw new Error("회원 목록을 불러오지 못했습니다.");
        }
        return res.json();
      },
    });

  const { data: items = [], isLoading: isItemsLoading } =
    useQuery<AdminItemsResponse>({
      queryKey: [api.admin.items.path, itemSearch, itemTypeFilter],
      queryFn: async () => {
        const res = await fetch(
          `${api.admin.items.path}${buildQueryString({
            search: itemSearch.trim() || undefined,
            type: itemTypeFilter !== "all" ? itemTypeFilter : undefined,
          })}`,
          {
            credentials: "include",
          }
        );
        if (!res.ok) {
          throw new Error("게시글 목록을 불러오지 못했습니다.");
        }
        return res.json();
      },
    });

  const updateUserMutation = useMutation({
    mutationFn: async (payload: {
      id: number;
      role?: "member" | "admin";
      status?: "active" | "suspended";
    }) => {
      const response = await apiRequest(
        "PATCH",
        buildUrl(api.admin.updateUser.path, { id: payload.id }),
        {
          role: payload.role,
          status: payload.status,
        }
      );
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      void queryClient.invalidateQueries({ queryKey: [api.admin.users.path] });
      toast({
        title: "회원 정보를 업데이트했습니다.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: error instanceof Error ? error.message : "회원 정보 업데이트에 실패했습니다.",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", buildUrl(api.admin.deleteItem.path, { id }));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      void queryClient.invalidateQueries({ queryKey: [api.admin.items.path] });
      toast({
        title: "게시글을 삭제했습니다.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: error instanceof Error ? error.message : "게시글 삭제에 실패했습니다.",
      });
    },
  });

  const statCards = [
    {
      title: "전체 회원",
      value: dashboard?.stats.totalUsers ?? 0,
      description: `활성 ${dashboard?.stats.activeUsers ?? 0}명 / 정지 ${
        dashboard?.stats.suspendedUsers ?? 0
      }명`,
      icon: Users,
    },
    {
      title: "관리자 계정",
      value: dashboard?.stats.adminUsers ?? 0,
      description: "운영 권한이 있는 계정 수",
      icon: Shield,
    },
    {
      title: "전체 게시글",
      value: dashboard?.stats.totalItems ?? 0,
      description: `분실 ${dashboard?.stats.lostItems ?? 0}건 / 습득 ${
        dashboard?.stats.foundItems ?? 0
      }건`,
      icon: PackageSearch,
    },
    {
      title: "최근 7일 등록",
      value: dashboard?.stats.recentItems ?? 0,
      description: "최근 일주일 신규 접수",
      icon: Activity,
    },
  ];

  return (
    <Layout>
      <section className="border-b border-border/70 bg-[linear-gradient(180deg,#fff7ed_0%,hsl(var(--background))_80%)]">
        <div className="container py-12 xl:max-w-[1440px]">
          <div className="max-w-3xl">
            <Badge variant="warning" className="mb-4">
              관리자 운영 대시보드
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              회원과 분실물 게시글을 한 곳에서 관리하세요
            </h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              관리자 계정은 회원 상태와 권한을 조정하고, 서비스에 등록된 분실물/습득물 게시글을 빠르게 점검하고 정리할 수 있습니다.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
              <Card key={card.title} className="border-white/70 bg-white/90">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardDescription>{card.title}</CardDescription>
                    <CardTitle className="mt-2 text-3xl">{isDashboardLoading ? "-" : card.value}</CardTitle>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <card.icon className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {card.description}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="container space-y-8 xl:max-w-[1440px]">
          <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">회원 관리</CardTitle>
                <CardDescription>
                  회원 권한을 관리하고 정지 계정을 즉시 처리할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="이름 또는 아이디 검색"
                  />
                  <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="권한 필터" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 권한</SelectItem>
                      <SelectItem value="member">일반 회원</SelectItem>
                      <SelectItem value="admin">관리자</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={userStatusFilter} onValueChange={setUserStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="상태 필터" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 상태</SelectItem>
                      <SelectItem value="active">활성</SelectItem>
                      <SelectItem value="suspended">정지</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>회원</TableHead>
                      <TableHead>권한</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>게시글 수</TableHead>
                      <TableHead>가입일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isUsersLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          회원 목록을 불러오는 중입니다.
                        </TableCell>
                      </TableRow>
                    ) : users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          조건에 맞는 회원이 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((member) => {
                        const isCurrentAdmin = user?.id === member.id;

                        return (
                          <TableRow key={member.id}>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-foreground">
                                  {member.name || member.username}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  @{member.username}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant={getRoleBadgeVariant(member.role)}>
                                  {member.role === "admin" ? "관리자" : "일반"}
                                </Badge>
                                <Select
                                  value={member.role}
                                  disabled={isCurrentAdmin || updateUserMutation.isPending}
                                  onValueChange={(value: "member" | "admin") => {
                                    if (value === member.role) {
                                      return;
                                    }
                                    updateUserMutation.mutate({
                                      id: member.id,
                                      role: value,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-8 w-[120px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="member">일반 회원</SelectItem>
                                    <SelectItem value="admin">관리자</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant={getStatusBadgeVariant(member.status)}>
                                  {member.status === "active" ? "활성" : "정지"}
                                </Badge>
                                <Select
                                  value={member.status}
                                  disabled={isCurrentAdmin || updateUserMutation.isPending}
                                  onValueChange={(value: "active" | "suspended") => {
                                    if (value === member.status) {
                                      return;
                                    }
                                    updateUserMutation.mutate({
                                      id: member.id,
                                      status: value,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-8 w-[120px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="active">활성</SelectItem>
                                    <SelectItem value="suspended">정지</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </TableCell>
                            <TableCell>{member.itemCount}</TableCell>
                            <TableCell>{formatDate(member.createdAt)}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">최근 관리 포인트</CardTitle>
                <CardDescription>
                  운영자가 먼저 확인하면 좋은 신규 회원과 최근 게시글입니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="font-medium text-foreground">최근 가입 회원</h3>
                  </div>
                  <div className="space-y-3">
                    {(dashboard?.recentUsers ?? []).map((member) => (
                      <div
                        key={member.id}
                        className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">
                              {member.name || member.username}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              @{member.username} · {formatDate(member.createdAt)}
                            </p>
                          </div>
                          <Badge variant={getRoleBadgeVariant(member.role)}>
                            {member.role === "admin" ? "관리자" : "회원"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <PackageSearch className="h-4 w-4 text-primary" />
                    <h3 className="font-medium text-foreground">최근 등록 게시글</h3>
                  </div>
                  <div className="space-y-3">
                    {(dashboard?.recentItems ?? []).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.ownerName || item.ownerUsername || "익명"} · {formatDate(item.date)}
                            </p>
                          </div>
                          <Badge variant={item.reportType === "lost" ? "info" : "warning"}>
                            {item.statusLabel}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">게시글 관리</CardTitle>
              <CardDescription>
                부적절하거나 중복된 분실물/습득물 게시글을 정리할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <Input
                  value={itemSearch}
                  onChange={(event) => setItemSearch(event.target.value)}
                  placeholder="제목, 설명, 위치 검색"
                />
                <Select value={itemTypeFilter} onValueChange={setItemTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="게시글 유형" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 게시글</SelectItem>
                    <SelectItem value="lost">분실 접수</SelectItem>
                    <SelectItem value="found">습득 접수</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>게시글</TableHead>
                    <TableHead>작성자</TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead>위치</TableHead>
                    <TableHead>등록일</TableHead>
                    <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isItemsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        게시글 목록을 불러오는 중입니다.
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        조건에 맞는 게시글이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-foreground">{item.title}</span>
                            <span className="line-clamp-1 text-xs text-muted-foreground">
                              {item.description || item.itemCategory || "설명 없음"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.ownerName || item.ownerUsername || "익명"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.reportType === "lost" ? "info" : "warning"}>
                            {item.statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.location || "-"}</TableCell>
                        <TableCell>{formatDate(item.date)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={deleteItemMutation.isPending}
                            onClick={() => {
                              const confirmedDelete = window.confirm(
                                "\uC774 \uAC8C\uC2DC\uAE00\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694? \uC774 \uC791\uC5C5\uC740 \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."
                              );
                              if (!confirmedDelete) {
                                return;
                              }
                              deleteItemMutation.mutate(item.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            삭제
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-amber-200 bg-amber-50/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-amber-600" />
                  관리자 계정 운영 규칙
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm leading-6 text-amber-900/80">
                <p>`ADMIN_USERNAMES` 환경변수에 포함된 아이디는 항상 관리자 권한으로 처리됩니다.</p>
                <p>현재 로그인한 관리자 계정은 스스로 정지할 수 없도록 막아 두었습니다.</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-slate-50/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Ban className="h-5 w-5 text-slate-700" />
                  정지 계정 동작
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm leading-6 text-slate-700">
                <p>정지된 계정은 다음 로그인부터 차단되며, 기존 세션도 재인증 시 접근할 수 없습니다.</p>
                <p>필요하면 상태를 다시 `활성`으로 바꿔 즉시 복구할 수 있습니다.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </Layout>
  );
}

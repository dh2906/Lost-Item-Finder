import { Suspense, lazy, useEffect } from "react";
import { Switch, Route } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { initFcm, onForegroundMessage } from "@/lib/fcm";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/home"));
const ReportPage = lazy(() => import("@/pages/report"));
const SearchPage = lazy(() => import("@/pages/search"));
const ItemsPage = lazy(() => import("@/pages/items"));
const ItemDetail = lazy(() => import("@/pages/item-detail"));
const ChatsPage = lazy(() => import("@/pages/chats"));
const ChatRoomPage = lazy(() => import("@/pages/chat-room"));
const MatchesPage = lazy(() => import("@/pages/matches"));
const EditItemPage = lazy(() => import("@/pages/edit-item"));
const LoginPage = lazy(() =>
  import("@/pages/login").then((module) => ({ default: module.LoginPage }))
);
const MyPage = lazy(() => import("@/pages/mypage"));
const AdminDashboardPage = lazy(() => import("@/pages/admin-dashboard"));
const ClaimReportPage = lazy(() => import("@/pages/claim-report"));
const RegisterPage = lazy(() =>
  import("@/pages/register").then((module) => ({
    default: module.RegisterPage,
  }))
);
const InstallPage = lazy(() => import("@/pages/install"));

function FoundReportPage() {
  return <ReportPage forcedType="found" />;
}

function LostReportPage() {
  return <ReportPage forcedType="lost" />;
}

function DefaultReportPage() {
  return <ReportPage />;
}

function PageLoadingFallback() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center bg-background px-5">
      <div className="rounded-xl border border-border bg-white px-5 py-4 text-sm font-semibold text-muted-foreground shadow-sm">
        페이지를 불러오는 중입니다
      </div>
    </div>
  );
}

const reportStepPattern = /\/(photo|info|location|confirm)$/;

function getTransitionKey(location: string): string {
  const [path, query = ""] = location.split("?");

  if (
    /^\/report\/(found|lost)\/(photo|info|location|confirm)$/.test(path) ||
    /^\/item\/\d+\/edit\/(photo|info|location|confirm)$/.test(path)
  ) {
    return `${path.replace(reportStepPattern, "")}${query ? `?${query}` : ""}`;
  }

  return location;
}

function getPageTitle(location: string): string {
  const path = location.split("?")[0];

  if (path === "/") return "Findy - 분실물 매칭 서비스";
  if (path === "/install") return "앱 설치 | Findy";
  if (path === "/report/found" || path.startsWith("/report/found/")) return "주운 물건 등록 | Findy";
  if (path === "/report/lost" || path.startsWith("/report/lost/")) return "잃어버린 물건 등록 | Findy";
  if (path === "/report" || path.startsWith("/report/")) return "물건 등록 | Findy";
  if (path === "/search") return "분실물 찾기 | Findy";
  if (path === "/items") return "습득물 찾기 | Findy";
  if (/^\/item\/\d+\/edit(\/.*)?$/.test(path)) return "게시글 수정 | Findy";
  if (path.startsWith("/item/")) return "게시글 상세 | Findy";
  if (path === "/mypage") return "마이페이지 | Findy";
  if (path === "/admin") return "관리자 | Findy";
  if (path === "/matches") return "매칭 후보 | Findy";
  if (path === "/chats") return "채팅 목록 | Findy";
  if (path.startsWith("/chat/")) return "채팅 | Findy";
  if (path === "/login") return "로그인 | Findy";
  if (path === "/register") return "회원가입 | Findy";
  if (path === "/claim-report") return "신고하기 | Findy";

  return "페이지를 찾을 수 없습니다 | Findy";
}

function Router() {
  const [location] = useLocation();
  const transitionKey = getTransitionKey(location);

  useEffect(() => {
    document.title = getPageTitle(location);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={transitionKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <Suspense fallback={<PageLoadingFallback />}>
          <Switch location={location}>
            <Route path="/" component={Home} />
            <Route path="/install" component={InstallPage} />
            <Route path="/report/found/:step">
              <ProtectedRoute>
                <FoundReportPage />
              </ProtectedRoute>
            </Route>
            <Route path="/report/found">
              <ProtectedRoute>
                <FoundReportPage />
              </ProtectedRoute>
            </Route>
            <Route path="/report/lost/:step">
              <ProtectedRoute>
                <LostReportPage />
              </ProtectedRoute>
            </Route>
            <Route path="/report/lost">
              <ProtectedRoute>
                <LostReportPage />
              </ProtectedRoute>
            </Route>
            <Route path="/report/:step">
              <ProtectedRoute>
                <DefaultReportPage />
              </ProtectedRoute>
            </Route>
            <Route path="/report">
              <ProtectedRoute>
                <DefaultReportPage />
              </ProtectedRoute>
            </Route>
            <Route path="/search" component={SearchPage} />
            <Route path="/items" component={ItemsPage} />
            <Route path="/item/:id/edit/:step">
              <ProtectedRoute>
                <EditItemPage />
              </ProtectedRoute>
            </Route>
            <Route path="/item/:id/edit">
              <ProtectedRoute>
                <EditItemPage />
              </ProtectedRoute>
            </Route>
            <Route path="/item/:id" component={ItemDetail} />
            <Route path="/mypage">
              <ProtectedRoute>
                <MyPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin">
              <ProtectedRoute requireAdmin>
                <AdminDashboardPage />
              </ProtectedRoute>
            </Route>
            <Route path="/claim-report">
              <ProtectedRoute>
                <ClaimReportPage />
              </ProtectedRoute>
            </Route>
            <Route path="/matches">
              <ProtectedRoute>
                <MatchesPage />
              </ProtectedRoute>
            </Route>
            <Route path="/chats">
              <ProtectedRoute>
                <ChatsPage />
              </ProtectedRoute>
            </Route>
            <Route path="/chat/:id">
              <ProtectedRoute>
                <ChatRoomPage />
              </ProtectedRoute>
            </Route>
            <Route path="/login" component={LoginPage} />
            <Route path="/register" component={RegisterPage} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function FcmInitializer() {
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user?.id) return;

    initFcm().catch((err) => console.error("[FCM] 초기화 실패:", err));

    const unsubscribe = onForegroundMessage(({ title, body, data }) => {
      console.log("[FCM] 포그라운드 메시지 수신:", { title, body, data });

      toast({
        title,
        description: body,
      });

      if (Notification.permission === "granted") {
        new Notification(title, {
          body,
          icon: "/icons/icon-192.png",
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id, toast]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <FcmInitializer />
        <Router />
        <PWAInstallBanner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

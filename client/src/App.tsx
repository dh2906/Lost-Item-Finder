import { useEffect } from "react";
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
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ReportPage from "@/pages/report";
import SearchPage from "@/pages/search";
import ItemsPage from "@/pages/items";
import ItemDetail from "@/pages/item-detail";
import ChatsPage from "@/pages/chats";
import ChatRoomPage from "@/pages/chat-room";
import MatchesPage from "@/pages/matches";
import EditItemPage from "@/pages/edit-item";
import { LoginPage } from "@/pages/login";
import MyPage from "@/pages/mypage";
import AdminDashboardPage from "@/pages/admin-dashboard";
import { RegisterPage } from "@/pages/register";
import { useLocation } from "wouter";

function FoundReportPage() {
  return <ReportPage forcedType="found" />;
}

function LostReportPage() {
  return <ReportPage forcedType="lost" />;
}

function DefaultReportPage() {
  return <ReportPage />;
}

function Router() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <Switch location={location}>
          <Route path="/" component={Home} />
          <Route path="/report/found">
            <ProtectedRoute>
              <FoundReportPage />
            </ProtectedRoute>
          </Route>
          <Route path="/report/lost">
            <ProtectedRoute>
              <LostReportPage />
            </ProtectedRoute>
          </Route>
          <Route path="/report">
            <ProtectedRoute>
              <DefaultReportPage />
            </ProtectedRoute>
          </Route>
          <Route path="/search" component={SearchPage} />
          <Route path="/items" component={ItemsPage} />
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

      if (Notification.permission === "granted") {
        new Notification(title, {
          body,
          icon: "/icons/icon-192.png",
        });
      } else {
        toast({
          title,
          description: body,
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

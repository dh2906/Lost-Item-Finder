import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { initFcm, onForegroundMessage } from "@/lib/fcm";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ReportPage from "@/pages/report";
import SearchPage from "@/pages/search";
import ItemsPage from "@/pages/items";
import ItemDetail from "@/pages/item-detail";
import ChatsPage from "@/pages/chats";
import ChatRoomPage from "@/pages/chat-room";
import { LoginPage } from "@/pages/login";
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
          <Route path="/report/found" component={FoundReportPage} />
          <Route path="/report/lost" component={LostReportPage} />
          <Route path="/report" component={DefaultReportPage} />
          <Route path="/search" component={SearchPage} />
          <Route path="/items" component={ItemsPage} />
          <Route path="/item/:id" component={ItemDetail} />
          <Route path="/chats" component={ChatsPage} />
          <Route path="/chat/:id" component={ChatRoomPage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/register" component={RegisterPage} />
          <Route component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

function FcmInitializer() {
  const { data: user } = useQuery<{ id: number } | null>({
    queryKey: ["/api/auth/me"],
  });
  const { toast } = useToast();

  useEffect(() => {
    if (!user?.id) return;

    // FCM 초기화 및 토큰 등록
    initFcm().catch((err) => console.error("[FCM] 초기화 실패:", err));

    // 포그라운드 상태에서 메시지 수신 시 토스트 알림 표시
    // (FCM은 앱이 포그라운드일 때 자동으로 알림을 띄우지 않으므로 직접 처리)
    const unsubscribe = onForegroundMessage(({ title, body, data }) => {
      console.log("[FCM] 포그라운드 메시지 수신:", { title, body, data });

      // 브라우저 Notification API로 직접 알림 표시
      if (Notification.permission === "granted") {
        new Notification(title, {
          body,
          icon: "/icon-192.png",
        });
      } else {
        // Notification 권한이 없으면 토스트로 대체
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
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

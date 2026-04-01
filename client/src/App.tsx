import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/protected-route";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ReportPage from "@/pages/report";
import SearchPage from "@/pages/search";
import ItemsPage from "@/pages/items";
import ItemDetail from "@/pages/item-detail";
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
            <ProtectedRoute><FoundReportPage /></ProtectedRoute>
          </Route>
          <Route path="/report/lost">
            <ProtectedRoute><LostReportPage /></ProtectedRoute>
          </Route>
          <Route path="/report">
            <ProtectedRoute><DefaultReportPage /></ProtectedRoute>
          </Route>
          <Route path="/search" component={SearchPage} />
          <Route path="/items" component={ItemsPage} />
          <Route path="/item/:id" component={ItemDetail} />
          <Route path="/mypage">
            <ProtectedRoute><MyPage /></ProtectedRoute>
          </Route>
          <Route path="/admin">
            <ProtectedRoute requireAdmin><AdminDashboardPage /></ProtectedRoute>
          </Route>
          <Route path="/login" component={LoginPage} />
          <Route path="/register" component={RegisterPage} />
          <Route component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

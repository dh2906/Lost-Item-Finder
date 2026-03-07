import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ReportPage from "@/pages/report";
import SearchPage from "@/pages/search";
import ItemDetail from "@/pages/item-detail";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/report" component={ReportPage} />
      <Route path="/search" component={SearchPage} />
      <Route path="/item/:id" component={ItemDetail} />
      <Route component={NotFound} />
    </Switch>
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

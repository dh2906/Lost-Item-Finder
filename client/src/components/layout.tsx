import { Link, useLocation } from "wouter";
import { Search, PlusCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/10">
      {/* Decorative background blurs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-[25%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <header className="sticky top-0 z-50 w-full border-b border-border/50 glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-primary/70 flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform duration-300">
              <Package className="w-5 h-5" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">Return<span className="text-primary">It</span></span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/">
              <Button variant={location === "/" ? "secondary" : "ghost"} className={cn("rounded-full font-medium", location === "/" && "bg-secondary text-foreground")}>
                Home
              </Button>
            </Link>
            <Link href="/report">
              <Button variant={location === "/report" ? "secondary" : "ghost"} className={cn("rounded-full font-medium text-primary hover:text-primary hover:bg-primary/10", location === "/report" && "bg-primary/10")}>
                Report Found
              </Button>
            </Link>
            <Link href="/search">
              <Button variant={location === "/search" ? "secondary" : "ghost"} className={cn("rounded-full font-medium", location === "/search" && "bg-secondary text-foreground")}>
                Find Lost Item
              </Button>
            </Link>
          </nav>

          <div className="flex md:hidden gap-2">
            <Link href="/report">
              <Button size="icon" variant="ghost" className="text-primary"><PlusCircle className="w-5 h-5" /></Button>
            </Link>
            <Link href="/search">
              <Button size="icon" variant="ghost"><Search className="w-5 h-5" /></Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col">
        {children}
      </main>

      <footer className="border-t border-border/50 bg-card/50 backdrop-blur-sm mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} ReturnIt Community. Helping people reunite with their belongings.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Powered by AI</span>
            <span>•</span>
            <span>Community Driven</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

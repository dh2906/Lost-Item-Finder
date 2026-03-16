import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-sm rounded-[28px] border border-border/70 bg-white/90 p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <AlertCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">페이지를 찾을 수 없습니다</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
        </p>
        <Link href="/">
          <Button variant="default" className="rounded-full px-6">
            홈으로 돌아가기
          </Button>
        </Link>
      </div>
    </div>
  );
}

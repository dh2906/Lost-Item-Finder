import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { api, type CreateClaimReportInput } from "@shared/routes";

export default function ClaimReportPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const initialItemId = Number(params.get("itemId") ?? "");
  const [itemId, setItemId] = useState(
    Number.isFinite(initialItemId) && initialItemId > 0 ? String(initialItemId) : ""
  );
  const [suspectedUserInfo, setSuspectedUserInfo] = useState("");
  const [incidentSummary, setIncidentSummary] = useState("");
  const [evidence, setEvidence] = useState("");
  const [contactInfo, setContactInfo] = useState("");

  const createMutation = useMutation({
    mutationFn: async (input: CreateClaimReportInput) => {
      const response = await apiRequest("POST", api.claimReports.create.path, input);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "신고가 접수되었습니다.",
        description: "관리자가 내용을 확인한 뒤 필요한 조치를 진행합니다.",
      });
      setLocation("/");
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "신고 접수에 실패했습니다.",
        description:
          error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
      });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedSummary = incidentSummary.trim();

    if (trimmedSummary.length < 10) {
      toast({
        variant: "destructive",
        title: "상황 설명을 조금 더 자세히 적어주세요.",
      });
      return;
    }

    const numericItemId = Number(itemId);
    createMutation.mutate({
      itemId: Number.isFinite(numericItemId) && numericItemId > 0 ? numericItemId : undefined,
      suspectedUserInfo: suspectedUserInfo.trim() || undefined,
      incidentSummary: trimmedSummary,
      evidence: evidence.trim() || undefined,
      contactInfo: contactInfo.trim() || undefined,
    });
  };

  return (
    <Layout>
      <section className="border-b border-border/70 bg-[linear-gradient(180deg,#fff7ed_0%,hsl(var(--background))_82%)]">
        <div className="container py-10 xl:max-w-[960px]">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                분실물 부정 수령 신고
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                누군가 분실자인 척 물건을 가져갔다고 의심되는 경우, 확인 가능한 정황과
                증거를 남겨주세요. 신고 내용은 관리자에게만 공개됩니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container py-8 xl:max-w-[960px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              신고 내용
            </CardTitle>
            <CardDescription>
              게시글 번호를 알고 있으면 함께 입력하면 처리에 도움이 됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="itemId">관련 게시글 번호</Label>
                  <Input
                    id="itemId"
                    inputMode="numeric"
                    placeholder="예: 123"
                    value={itemId}
                    onChange={(event) => setItemId(event.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suspectedUserInfo">의심 대상 정보</Label>
                  <Input
                    id="suspectedUserInfo"
                    placeholder="닉네임, 연락처, 채팅방 정보 등"
                    value={suspectedUserInfo}
                    onChange={(event) => setSuspectedUserInfo(event.target.value)}
                    maxLength={300}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="incidentSummary">
                  상황 설명 <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="incidentSummary"
                  placeholder="언제, 어떤 물건이, 어떤 방식으로 부정 수령되었다고 판단했는지 적어주세요."
                  value={incidentSummary}
                  onChange={(event) => setIncidentSummary(event.target.value)}
                  className="min-h-[180px] resize-none"
                  maxLength={2000}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="evidence">증거 및 참고 자료</Label>
                <Textarea
                  id="evidence"
                  placeholder="채팅 내용, 시간, 장소, 외부 링크, 캡처 파일 설명 등을 적어주세요."
                  value={evidence}
                  onChange={(event) => setEvidence(event.target.value)}
                  className="min-h-[120px] resize-none"
                  maxLength={2000}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactInfo">추가 연락처</Label>
                <Input
                  id="contactInfo"
                  placeholder="관리자가 추가 확인할 연락처가 있으면 입력"
                  value={contactInfo}
                  onChange={(event) => setContactInfo(event.target.value)}
                  maxLength={120}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="min-w-[160px] rounded-full"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      접수 중
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      신고 접수
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

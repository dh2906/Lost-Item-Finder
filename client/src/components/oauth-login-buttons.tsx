import { FcGoogle } from "react-icons/fc";
import { SiKakao, SiNaver } from "react-icons/si";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";

type OAuthProvider = "google" | "kakao" | "naver";

const providers: Array<{
  id: OAuthProvider;
  label: string;
  className: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    id: "google",
    label: "Google로 계속하기",
    className: "bg-white text-foreground hover:bg-secondary border border-border",
    icon: FcGoogle,
  },
  {
    id: "kakao",
    label: "Kakao로 계속하기",
    className: "bg-[#FEE500] text-[#191919] hover:bg-[#F6DC00]",
    icon: SiKakao,
  },
  {
    id: "naver",
    label: "Naver로 계속하기",
    className: "bg-[#03C75A] text-white hover:bg-[#02B350]",
    icon: SiNaver,
  },
];

function getOAuthUrl(provider: OAuthProvider, redirectTo: string) {
  const params = new URLSearchParams();
  if (redirectTo && redirectTo !== "/") {
    params.set("redirect", redirectTo);
  }

  const query = params.toString();
  return `/api/auth/oauth/${provider}${query ? `?${query}` : ""}`;
}

export function OAuthLoginButtons({ redirectTo = "/" }: { redirectTo?: string }) {
  const startOAuth = (provider: OAuthProvider) => {
    window.location.href = getOAuthUrl(provider, redirectTo);
  };

  return (
    <div className="space-y-3">
      {providers.map((provider) => {
        const Icon = provider.icon;
        return (
          <Button
            key={provider.id}
            type="button"
            className={`h-12 w-full rounded-full text-base font-semibold shadow-none ${provider.className}`}
            onClick={() => startOAuth(provider.id)}
          >
            <Icon className="mr-2 h-5 w-5" />
            {provider.label}
          </Button>
        );
      })}
    </div>
  );
}

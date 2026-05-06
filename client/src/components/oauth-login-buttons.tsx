import { FcGoogle } from "react-icons/fc";
import { SiKakao, SiNaver } from "react-icons/si";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { oauthProviders, type OAuthProvider } from "@shared/schema";

const providerMeta = {
  google: {
    label: "Google로 계속하기",
    className: "bg-white text-foreground hover:bg-secondary border border-border",
    icon: FcGoogle,
  },
  kakao: {
    label: "Kakao로 계속하기",
    className: "bg-[#FEE500] text-[#191919] hover:bg-[#F6DC00]",
    icon: SiKakao,
  },
  naver: {
    label: "Naver로 계속하기",
    className: "bg-[#03C75A] text-white hover:bg-[#02B350]",
    icon: SiNaver,
  },
} satisfies Record<
  OAuthProvider,
  {
    label: string;
    className: string;
    icon: ComponentType<{ className?: string }>;
  }
>;

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
      {oauthProviders.map((provider) => {
        const meta = providerMeta[provider];
        const Icon = meta.icon;
        return (
          <Button
            key={provider}
            type="button"
            className={`h-12 w-full rounded-full text-base font-semibold shadow-none ${meta.className}`}
            onClick={() => startOAuth(provider)}
          >
            <Icon className="mr-2 h-5 w-5" />
            {meta.label}
          </Button>
        );
      })}
    </div>
  );
}

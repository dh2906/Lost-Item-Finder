import { Express } from "express";
import passport from "passport";

/**
 * 소셜 로그인 OAuth 콜백 라우트 등록
 * KAKAO_CLIENT_ID, GOOGLE_CLIENT_ID/SECRET 환경변수 설정 시에만 동작
 */
export function registerSocialAuthRoutes(app: Express) {
  // --- Kakao ---
  if (process.env.KAKAO_CLIENT_ID) {
    app.get("/api/auth/kakao",
      passport.authenticate("kakao")
    );

    app.get("/api/auth/kakao/callback",
      passport.authenticate("kakao", { failureRedirect: "/login?error=kakao" }),
      (req, res) => {
        res.redirect("/");
      }
    );
  }

  // --- Google ---
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    app.get("/api/auth/google",
      passport.authenticate("google", { scope: ["profile", "email"] })
    );

    app.get("/api/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/login?error=google" }),
      (req, res) => {
        res.redirect("/");
      }
    );
  }
}

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { Express } from "express";
import { storage } from "./storage";
import { pool } from "./db";
import { User as UserType } from "@shared/schema";

const PostgresSessionStore = connectPg(session);

declare global {
  namespace Express {
    interface User extends UserType {}
  }
}

export function setupAuth(app: Express) {
  const sessionStore = new PostgresSessionStore({
    pool,
    tableName: "sessions",
    createTableIfMissing: true,
  });

  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.SESSION_SECURE === "true" || (process.env.NODE_ENV === "production" && process.env.SESSION_SECURE !== "false"),
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  // --- Local Strategy ---
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) return done(null, false, { message: "아이디가 존재하지 않습니다" });
        if (!user.password) return done(null, false, { message: "소셜 로그인 계정입니다. 해당 소셜 로그인을 이용해 주세요." });
        const isValid = await storage.verifyPassword(password, user.password);
        if (!isValid) return done(null, false, { message: "비밀번호가 올바르지 않습니다" });
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  // --- Kakao Strategy (conditional) ---
  // passport-kakao 설치 후 환경변수 KAKAO_CLIENT_ID 설정 시 활성화
  if (process.env.KAKAO_CLIENT_ID) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Strategy: KakaoStrategy } = require("passport-kakao");
      passport.use(
        new KakaoStrategy(
          {
            clientID: process.env.KAKAO_CLIENT_ID,
            callbackURL: process.env.KAKAO_CALLBACK_URL || "/api/auth/kakao/callback",
          },
          async (accessToken: string, refreshToken: string, profile: { id: string; displayName: string; _json?: { kakao_account?: { profile?: { thumbnail_image_url?: string } } } }, done: (err: Error | null, user?: UserType | false) => void) => {
            try {
              const providerId = String(profile.id);
              let user = await storage.getUserByProvider("kakao", providerId);
              if (!user) {
                user = await storage.createSocialUser({
                  username: `kakao_${providerId}`,
                  name: profile.displayName,
                  provider: "kakao",
                  providerId,
                  avatarUrl: profile._json?.kakao_account?.profile?.thumbnail_image_url ?? null,
                });
              }
              return done(null, user);
            } catch (err) {
              return done(err as Error);
            }
          }
        )
      );
    } catch (e) {
      console.warn("passport-kakao not installed, Kakao login disabled.");
    }
  }

  // --- Google Strategy (conditional) ---
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
      passport.use(
        new GoogleStrategy(
          {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
          },
          async (accessToken: string, refreshToken: string, profile: { id: string; displayName: string; photos?: { value: string }[] }, done: (err: Error | null, user?: UserType | false) => void) => {
            try {
              const providerId = String(profile.id);
              let user = await storage.getUserByProvider("google", providerId);
              if (!user) {
                user = await storage.createSocialUser({
                  username: `google_${providerId}`,
                  name: profile.displayName,
                  provider: "google",
                  providerId,
                  avatarUrl: profile.photos?.[0]?.value ?? null,
                });
              }
              return done(null, user);
            } catch (err) {
              return done(err as Error);
            }
          }
        )
      );
    } catch (e) {
      console.warn("passport-google-oauth20 not installed, Google login disabled.");
    }
  }

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}

export function isAuthenticated(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "로그인이 필요합니다" });
}

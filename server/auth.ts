import passport from "passport";
import session from "express-session";
import connectPg from "connect-pg-simple";
import {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
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
  const sessionSecure =
    process.env.SESSION_SECURE === "true"
      ? true
      : process.env.SESSION_SECURE === "false"
        ? false
        : "auto";

  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: sessionSecure,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user || user.status !== "active") {
        return done(null, false);
      }

      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}

export function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.isAuthenticated() && req.user?.status === "active") {
    return next();
  }

  res.status(401).json({ message: "로그인이 필요합니다." });
}

export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (
    req.isAuthenticated() &&
    req.user?.status === "active" &&
    req.user.role === "admin"
  ) {
    return next();
  }

  res.status(403).json({ message: "관리자 권한이 필요합니다." });
}

import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { ensureChatSchema, ensureItemMatchSchema, ensureVectorExtension } from "./db";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { setupAuth } from "./auth";
import { createServer } from "http";
import cors from "cors";
const app = express();
const httpServer = createServer(app);
const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || "50mb";

app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: requestBodyLimit,
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

const allowedOrigins = (process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:8080",
      "http://127.0.0.1:8080",
    ]);

const allowedOriginPatterns = [
  /^https:\/\/[a-z0-9-]+\.ngrok-free\.dev$/i,
  /^https:\/\/[a-z0-9-]+\.ngrok\.io$/i,
];

app.use(cors({
  origin: (origin, callback) => {
    const isPatternAllowed = origin
      ? allowedOriginPatterns.some((pattern) => pattern.test(origin))
      : false;

    if (!origin || allowedOrigins.includes(origin) || isPatternAllowed) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

app.use(express.urlencoded({ extended: false, limit: requestBodyLimit }));

// ngrok 인터스티셜 페이지 bypass: 크롤러(PWABuilder 등)도 실제 앱에 바로 접근 가능
app.use((_req, res, next) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  next();
});

// SW의 importScripts()가 동기적으로 로드하는 Firebase config 엔드포인트.
// Vite 미들웨어보다 반드시 먼저 등록해야 가로채기가 안 됨.
app.get("/firebase-config.js", (_req, res) => {
  const config = {
    apiKey: process.env.VITE_FIREBASE_API_KEY ?? "",
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.VITE_FIREBASE_APP_ID ?? "",
  };
  res.type("application/javascript");
  res.set("Cache-Control", "no-store");
  res.send(`self.FIREBASE_CONFIG = ${JSON.stringify(config)};`);
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await ensureVectorExtension();
  await ensureChatSchema();
  await ensureItemMatchSchema();
  setupAuth(app);
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "8080", 10);
  const host = process.env.HOST || "127.0.0.1";
  httpServer.listen(
    {
      port,
      host,
    },
    () => {
      log(`serving on http://${host}:${port}`);
    },
  );
})();

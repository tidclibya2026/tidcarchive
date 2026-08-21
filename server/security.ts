import { TRPCError } from "@trpc/server";
import type { Express, Request, Response } from "express";

type RateLimitEntry = { count: number; resetAt: number };
const rateLimitEntries = new Map<string, RateLimitEntry>();

function requestOrigin(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined;
  return forwardedIp || req.ip || req.socket?.remoteAddress || "unknown";
}

function rejectRateLimit(scope: string) {
  console.warn(`[Security] Rate limit exceeded for scope: ${scope}`);
  throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "تم تجاوز الحد المؤقت للطلبات. يرجى المحاولة لاحقاً." });
}

export function enforceRequestRateLimit(req: Request, scope: string, limit: number, windowMs: number) {
  const now = Date.now();
  const key = `${scope}:${requestOrigin(req)}`;
  const existing = rateLimitEntries.get(key);
  if (!existing || existing.resetAt <= now) {
    rateLimitEntries.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (existing.count >= limit) rejectRateLimit(scope);
  existing.count += 1;
}

export function enforceIdentifierRateLimit(scope: string, identifier: string, limit: number, windowMs: number) {
  const now = Date.now();
  const key = `${scope}:${identifier}`;
  const existing = rateLimitEntries.get(key);
  if (!existing || existing.resetAt <= now) {
    rateLimitEntries.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (existing.count >= limit) rejectRateLimit(scope);
  existing.count += 1;
}

export function resetSecurityRateLimits() {
  rateLimitEntries.clear();
}

function isSecureRequest(req: Request) {
  if (req.secure || req.protocol === "https") return true;
  const forwarded = req.headers["x-forwarded-proto"];
  return typeof forwarded === "string" && forwarded.split(",").some(value => value.trim().toLowerCase() === "https");
}

export function applySecurityHeaders(req: Request, res: Response, next: () => void) {
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' https://d36hbw14aib5lz.cloudfront.net data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' https://manus-analytics.com",
    "connect-src 'self' https://manus-analytics.com",
  ].join("; "));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=(), usb=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  if (isSecureRequest(req)) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}

export function configureSecurity(app: Express) {
  app.disable("x-powered-by");
  app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
  app.use(applySecurityHeaders);
}

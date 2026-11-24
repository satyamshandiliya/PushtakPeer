import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { adminAuth } from './firebase-admin.ts';

const RUNTIME_SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const SESSION_COOKIE_NAME = 'pp_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSessionSecret(): string {
  return process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : RUNTIME_SESSION_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedBuffer = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

export function signSessionToken(userId: number): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): { userId: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getSessionSecret())
      .update(payload)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof parsed.uid !== 'number' || typeof parsed.exp !== 'number') return null;
    if (Date.now() > parsed.exp) return null;
    return { userId: parsed.uid };
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      cookies[key] = decodeURIComponent(val);
    }
  }
  return cookies;
}

export function setSessionCookie(req: Request, res: Response, userId: number): void {
  const token = signSessionToken(userId);
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    (req.headers.origin?.startsWith('https://') ?? false);

  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];

  if (isHttps) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }

  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    (req.headers.origin?.startsWith('https://') ?? false);

  const parts = [`${SESSION_COOKIE_NAME}=`, 'HttpOnly', 'Path=/', 'Max-Age=0'];
  if (isHttps) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export interface SafeUser {
  id: number;
  uid: string;
  name: string;
  email: string;
  collegeName: string;
  isBuyer: boolean;
  isSeller: boolean;
  createdAt: Date;
}

export interface AuthRequest extends Request {
  authUser?: SafeUser;
}

export function toSafeUser(row: typeof users.$inferSelect): SafeUser {
  return {
    id: row.id,
    uid: row.uid,
    name: row.name,
    email: row.email,
    collegeName: row.collegeName,
    isBuyer: row.isBuyer,
    isSeller: row.isSeller,
    createdAt: row.createdAt,
  };
}

export async function resolveUserFromHeaders(
  cookieHeader: string | undefined,
  authHeader: string | undefined
): Promise<SafeUser | null> {
  // 1. Check Bearer token (Firebase ID token)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.slice('Bearer '.length).trim();
    if (idToken) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.uid, decoded.uid))
          .limit(1);
        if (existing[0]) {
          return toSafeUser(existing[0]);
        }
      } catch {
        // Fall through to cookie check
      }
    }
  }

  // 2. Check signed HttpOnly session cookie
  const cookies = parseCookies(cookieHeader);
  const rawSession = cookies[SESSION_COOKIE_NAME];
  if (!rawSession) return null;

  const verified = verifySessionToken(rawSession);
  if (!verified) return null;

  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, verified.userId))
      .limit(1);
    return rows[0] ? toSafeUser(rows[0]) : null;
  } catch (err) {
    console.error('Database user lookup failed during auth resolution:', err);
    return null;
  }
}

export function verifyCsrfForCookieMutation(req: Request): boolean {
  // Requests with Authorization Bearer are immune to ambient cookie CSRF
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return true;
  }
  const hasCookie = Boolean(parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME]);
  if (!hasCookie) return true;

  const requestedWith = req.headers['x-requested-with'];
  if (requestedWith === 'XMLHttpRequest' || requestedWith === 'PushtakPeer') {
    return true;
  }

  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }
  return false;
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  req.authUser = (await resolveUserFromHeaders(req.headers.cookie, req.headers.authorization)) ?? undefined;
  next();
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (!verifyCsrfForCookieMutation(req)) {
      return res.status(403).json({ error: 'Forbidden: Invalid request origin.' });
    }
  }

  const user = await resolveUserFromHeaders(req.headers.cookie, req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: 'Please log in to continue.' });
  }
  req.authUser = user;
  next();
}

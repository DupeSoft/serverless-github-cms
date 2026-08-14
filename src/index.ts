// src/index.ts

import { renderCmsPage } from "./cms/page";
import { renderCmsScript } from "./cms/script";
import { renderCmsStyle } from "./cms/style";

/** ---------- Minimal D1 typings (no external deps) ---------- */
type D1Result<T> = { results?: T[]; meta?: any };

interface D1Stmt {
  bind(...args: any[]): D1Stmt;
  run(): Promise<D1Result<Record<string, any>>>;
  first(): Promise<Record<string, any>>;
  all(): Promise<D1Result<Record<string, any>>>;
}

interface D1Database {
  prepare(sql: string): D1Stmt;
}

/** ---------- Env ---------- */
export interface Env {
  DB?: D1Database;
  // GitHub OAuth app
  GITHUB_OAUTH_CLIENT_ID: string;
  GITHUB_OAUTH_CLIENT_SECRET: string; // encrypted in CF
  // GitHub API (repo-scoped PAT limited to a single repo)
  GITHUB_TOKEN: string;
  // Session + allowlist
  SESSION_SECRET: string;
  ALLOWED_LOGIN: string;
}

/** ---------- Security Configuration ---------- */
// CRITICAL SECURITY FIX: Re-added missing write path allowlist
const ALLOWED_WRITE_PATHS = [
  '',            // Allow root files (index.html, style.css, etc.)
  'content/',
  'images/', 
  'public/',
  'assets/',
  'posts/',
  'blog/',
  'pages/',
  'data/',
  'docs/',
  'themes/',
  'templates/',
  'styles/',
  'scripts/',
  '_posts/',
  '_pages/',
  'site/',
  'src/',
  'static/',
  'media/'
];

/** ---------- Small utils ---------- */
const enc = new TextEncoder();
function u8(s: string) { return enc.encode(s); }

function b64(bytes: Uint8Array): string {
  // standard base64 (for GitHub file content API)
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64url(bytes: Uint8Array): string {
  // URL-safe base64 (for our session payloads)
  return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecodeToString(s: string): string {
  const pad = s.length % 4 === 2 ? "==" : s.length % 4 === 3 ? "=" : "";
  const b64s = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return atob(b64s);
}

function randB64u(n = 16) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return b64url(a);
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", u8(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const ab = await crypto.subtle.sign("HMAC", key, u8(payload));
  return b64url(new Uint8Array(ab));
}

async function issueSession(env: Env, login: string, csrf?: string | null, maxAgeSec = 8 * 60 * 60) {
  const now = Math.floor(Date.now() / 1000);
  const payloadObj: any = { sub: login, iat: now, exp: now + maxAgeSec, n: randB64u(12) };
  if (csrf) payloadObj.csrf = csrf;
  const payload = JSON.stringify(payloadObj);
  const sig = await hmac(env.SESSION_SECRET, payload);
  const body = b64url(u8(payload));
  return `v1.${body}.${sig}`;
}

async function verifySession(env: Env, token?: string | null) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const payloadJson = b64urlDecodeToString(parts[1]);
  const sig = await hmac(env.SESSION_SECRET, payloadJson);
  if (sig !== parts[2]) return null;
  const obj = JSON.parse(payloadJson);
  if (obj.exp < Math.floor(Date.now() / 1000)) return null;
  return obj as { sub: string; iat: number; exp: number; n: string; csrf?: string };
}

function parseCookies(req: Request) {
  const out: Record<string, string> = {};
  const raw = req.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1));
  }
  return out;
}

function cookieAttrs() { return "Path=/; SameSite=Lax; Secure;"; }
function cookieAttrsCms() { return "Path=/cms; SameSite=Lax; Secure;"; }

/** ---------- Path helpers ---------- */
function stripLeadingSlash(p: string) { return (p || "").replace(/^\/+/, ""); }
function ensureLeadingSlash(p: string) { p = p || ""; return p.startsWith("/") ? p : `/${p}`; }

/** ---------- JSON helpers ---------- */
function jsonResp(obj: any, status = 200, extraHeaders?: Record<string, string>) {
  const h = new Headers({ "Content-Type": "application/json", ...(extraHeaders || {}) });
  return new Response(JSON.stringify(obj), { status, headers: h });
}

/** Display helper: keep trailing zeros for numeric prices */
function normalizePriceDisplay(v: any): string {
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(2) : String(v);
  const s = String(v ?? "");
  // If purely numeric string, normalize to 2 decimals (e.g., "8.9" -> "8.90")
  if (/^-?\d+(?:\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n.toFixed(2);
  }
  return s;
}

/** ---------- Security headers / CORS ---------- */
function sameOrigin(request: Request) {
  try { return new URL(request.url).origin; } catch { return ""; }
}

function addSecurityHeaders(h: Headers, isHtml: boolean) {
  if (isHtml) {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-hashes' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com https://kit.fontawesome.com",
      "script-src-elem 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com https://kit.fontawesome.com",
      "script-src-attr 'self' 'unsafe-inline' 'unsafe-hashes'",
      "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com https://fonts.googleapis.com",
      "style-src-elem 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com https://fonts.googleapis.com",
      "font-src 'self' data: https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://fonts.gstatic.com https://use.fontawesome.com",
      "img-src 'self' data: blob: https://raw.githubusercontent.com https://raw.github.com https://avatars.githubusercontent.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
      "connect-src 'self' https://api.github.com https://raw.githubusercontent.com https://raw.github.com",
      "frame-src 'self' blob: https://*.instagram.com https://*.facebook.com https://*.google.com https://*.youtube.com",
      "media-src 'self' data: blob: https://raw.githubusercontent.com https://raw.github.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'"
    ].join("; ");
    h.set("Content-Security-Policy", csp);
  } else {
    h.set("X-Frame-Options", "SAMEORIGIN");
  }

  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "no-referrer");
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  h.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
}

function withSec(resp: Response, request: Request, opts?: { html?: boolean }) {
  const origin = request.headers.get("Origin") || "";
  const self = sameOrigin(request);
  const h = new Headers(resp.headers);
  if (origin && origin === self) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Access-Control-Allow-Credentials", "true");
  } else {
    h.delete("Access-Control-Allow-Origin");
    h.delete("Access-Control-Allow-Credentials");
  }

  h.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, x-csrf-token");
  h.set("Vary", "Origin");
  addSecurityHeaders(h, !!opts?.html);
  return new Response(resp.body, { status: resp.status, headers: h });
}

function requireCsrf(request: Request, sess: any): string | null {
  const m = request.method.toUpperCase();
  if (m === "POST" || m === "PUT" || m === "DELETE") {
    const header = request.headers.get("x-csrf-token") || "";
    const expected = (sess && typeof sess.csrf === "string") ? sess.csrf : "";
    if (!header || !expected || header !== expected) return "CSRF check failed";
  }
  return null;
}

/** ---------- GitHub API helper (uses repo-scoped PAT) ---------- */
async function gh(env: Env, url: string, init?: RequestInit) {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "cms",
  };
  if (env.GITHUB_TOKEN) headers["Authorization"] = `token ${env.GITHUB_TOKEN}`;
  const merged: RequestInit = { ...(init || {}), headers: { ...headers, ...(init?.headers as any || {}) } };
  return fetch(url, merged);
}

/** ---------- Session / allowlist ---------- */
async function requireSession(request: Request, env: Env) {
  const s = await verifySession(env, parseCookies(request).session);
  if (!s) return null;
  if (env.ALLOWED_LOGIN && s.sub !== env.ALLOWED_LOGIN) return null;
  return s;
}

/** ---------- Repo helpers ---------- */
async function ghList(env: Env, repo: string, ref: string, dir: string) {
  const api = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(dir)}?ref=${encodeURIComponent(ref || "main")}`;
  const r = await gh(env, api, { method: "GET" });
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

async function listImagesRecursive(env: Env, repo: string, ref: string, rootDir: string) {
  const out: any[] = [];
  const stack: string[] = [stripLeadingSlash(rootDir)];
  const extRe = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

  while (stack.length) {
    const dir = stack.pop()!;
    const entries = await ghList(env, repo, ref, dir);
    for (const e of entries) {
      if (e.type === "dir") stack.push(e.path);
      else if (e.type === "file" && extRe.test(e.name || "")) out.push(e);
    }
  }
  return out;
}

async function resolveSingleRepo(env: Env): Promise<{ repo: string; ref: string } | null> {
  const r = await gh(
    env,
    "https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator,organization_member",
    { method: "GET" }
  );

  if (!r.ok) return null;

  const arr = (await r.json()) as any[];

  const repo = (arr || []).find(
    (x: any) => x && x.full_name === "USERNAME-PLACEHOLDER/REPOPLACEHOLDER"
  );

  if (repo) {
    return {
      repo: repo.full_name,
      ref: repo.default_branch || "main"
    };
  }

  return null;
}

/** ---------- OAuth routes ---------- */
async function handleLogin(request: Request, env: Env) {
  const url = new URL(request.url);
  const redirectUri = new URL("/oauth/callback", url.origin).toString();
  const state = randB64u(16);
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.GITHUB_OAUTH_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("state", state);

  const headers = new Headers({ Location: authorize.toString() });
  headers.append("Set-Cookie", `oauth_state=${state}; ${cookieAttrs()}; HttpOnly; Max-Age=600`);
  return withSec(new Response(null, { status: 302, headers }), request);
}

async function handleOauthCallback(request: Request, env: Env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const cookies = parseCookies(request);

  if (!code || !state || !cookies["oauth_state"] || cookies["oauth_state"] !== state) {
    return withSec(jsonResp({ ok: false, error: "oauth_state_mismatch" }, 400), request);
  }

  const redirectUri = new URL("/oauth/callback", url.origin).toString();
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Accept": "application/json" },
    body: new URLSearchParams({
      client_id: env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      state,
    }),
  });

  if (!tokenRes.ok) return withSec(jsonResp({ ok: false, error: "oauth_exchange_failed" }, 502), request);

  const tokenJson = await tokenRes.json() as any;
  const accessToken = tokenJson.access_token as string | undefined;
  if (!accessToken) {
  return withSec(
    jsonResp({
      ok: false,
      error: tokenJson.error || "no_access_token",
      description: tokenJson.error_description || "",
      error_uri: tokenJson.error_uri || ""
    }, 502),
    request
  );
}

  const me = await fetch("https://api.github.com/user", {
    headers: { "Authorization": `Bearer ${accessToken}`, "User-Agent": "cms", "Accept": "application/vnd.github+json" },
  });

  if (!me.ok) return withSec(jsonResp({ ok: false, error: "user_fetch_failed" }, 502), request);

  const user = await me.json() as any;
  const login = (user && user.login) ? String(user.login) : "";

  if (!login || (env.ALLOWED_LOGIN && login !== env.ALLOWED_LOGIN)) {
    return withSec(jsonResp({ ok: false, error: "unauthorized_user" }, 403), request);
  }

  const csrfVal = randB64u(16);
  const session = await issueSession(env, login, csrfVal);
  const headers = new Headers({ Location: "/cms" });
  headers.append("Set-Cookie", `session=${session}; ${cookieAttrs()}; HttpOnly; Max-Age=${8 * 60 * 60}`);
  headers.append("Set-Cookie", `oauth_state=; ${cookieAttrs()}; HttpOnly; Max-Age=0`);
  headers.append("Set-Cookie", `csrf=${csrfVal}; ${cookieAttrsCms()}; Max-Age=${8 * 60 * 60}`);
  return withSec(new Response(null, { status: 302, headers }), request);
}

/** ---------- GitHub edit helpers (auto-sha & JSON guarantees) ---------- */
async function getCurrentSha(env: Env, repo: string, ref: string, cleanPath: string): Promise<string | null> {
  const api = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(cleanPath)}?ref=${encodeURIComponent(ref || "main")}`;
  const r = await gh(env, api, { method: "GET" });
  if (!r.ok) return null;
  const j = await r.json() as any;
  return (j && typeof j.sha === "string") ? j.sha : null;
}

async function putFileJson(env: Env, api: string, payload: any) {
  const r = await gh(env, api, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const txt = await r.text();
  let data: any = null;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  return { r, data };
}

async function upsertFile(request: Request, env: Env, body: any) {
  const { repo, ref, path } = body || {};
  let { content, content_b64 } = body || {};

  if (!repo || !path || (typeof content !== "string" && typeof content_b64 !== "string")) {
    return withSec(jsonResp({ ok: false, error: "missing_params" }, 400), request);
  }

  // Support either raw text (content) or pre-encoded base64 (content_b64) from the client.
  const cleanPath = stripLeadingSlash(String(path));

  // CRITICAL SECURITY FIX: Re-added missing path validation
  const isAllowedPath = ALLOWED_WRITE_PATHS.some(allowedPath => {
    if (allowedPath === '') {
      return !cleanPath.includes('/'); // Root files only
    }
    return cleanPath.startsWith(allowedPath);
  });

  if (!isAllowedPath) {
    return withSec(jsonResp({
      ok: false,
      error: "path_not_allowed",
      message: `Write access denied. Allowed paths: ${ALLOWED_WRITE_PATHS.filter(p => p !== '').join(', ')}, and root files`,
      attempted_path: cleanPath
    }, 403), request);
  }

  const branch = (body && body.ref) || ref || "main";
  const api = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(cleanPath)}`;
  let sha = body.sha || await getCurrentSha(env, repo, branch, cleanPath);

  const payloadBase = {
    message: body.message || `cms: update ${cleanPath}`,
    content: (typeof content_b64 === "string") ? content_b64 : b64(u8(String(content))),
    branch: branch
  } as any;

  let payload = { ...payloadBase, ...(sha ? { sha } : {}) };
  let { r, data } = await putFileJson(env, api, payload);

  if ((!r.ok && (r.status === 409 || r.status === 422)) &&
      (!sha || (data && /sha/i.test(JSON.stringify(data))))) {
    sha = await getCurrentSha(env, repo, branch, cleanPath);
    payload = { ...payloadBase, ...(sha ? { sha } : {}) };
    ({ r, data } = await putFileJson(env, api, payload));
  }

  return withSec(jsonResp({ ok: r.ok, status: r.status, ...data }, r.status), request);
}

/** ---------- Main fetch ---------- */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return withSec(new Response(null, { status: 204 }), request);

    if (request.method === "GET" && url.pathname === "/") return new Response(null, { status: 302, headers: { Location: "/cms" } });

    // OAuth
    if (request.method === "GET" && url.pathname === "/login") return handleLogin(request, env);
    if (request.method === "GET" && url.pathname === "/oauth/callback") return handleOauthCallback(request, env);

    // CSRF prime
    if (request.method === "POST" && url.pathname === "/csrf/prime") {
      const sess = await requireSession(request, env);
      if (!sess) return withSec(jsonResp({ ok: false, error: "auth_required" }, 401), request);

      const headers = new Headers({ "Content-Type": "application/json" });
      const csrfVal = randB64u(16);
      const newSession = await issueSession(env, sess.sub, csrfVal);
      headers.append("Set-Cookie", `session=${newSession}; ${cookieAttrs()}; HttpOnly; Max-Age=${8 * 60 * 60}`);
      headers.append("Set-Cookie", `csrf=${csrfVal}; ${cookieAttrsCms()}; Max-Age=${8 * 60 * 60}`);
      return withSec(new Response(JSON.stringify({ ok: true }), { status: 200, headers }), request);
    }

    // Favicon
    if (request.method === "GET" && url.pathname === "/favicon.ico") {
      const bin = Uint8Array.from([71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,0,0,0,33,249,4,1,0,0,1,0,44,0,0,0,0,1,0,1,0,0,2,2,76,1,0,59]);
      return withSec(new Response(bin, { status: 200, headers: { "Content-Type": "image/gif" } }), request);
    }

    // CMS assets
    if (request.method === "GET" && url.pathname === "/cms") {
      const sess = await requireSession(request, env);
      if (!sess) return handleLogin(request, env);
      const pageOut = renderCmsPage();
      const resp = pageOut instanceof Response
        ? pageOut
        : new Response(pageOut, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      return withSec(resp, request, { html: true });
    }

    if (request.method === "GET" && url.pathname === "/cms/script.js") {
      const jsOut = renderCmsScript();
      const resp = jsOut instanceof Response
        ? jsOut
        : new Response(jsOut, { status: 200, headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" } });
      return withSec(resp, request);
    }

    if (request.method === "GET" && url.pathname === "/cms/style.css") {
      const cssOut = renderCmsStyle();
      const resp = cssOut instanceof Response
        ? cssOut
        : new Response(cssOut, { status: 200, headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "no-store" } });
      return withSec(resp, request);
    }

    /** -------- Menu (D1) -------- */
    if (request.method === "GET" && url.pathname === "/menu") {
      const sess = await requireSession(request, env);
      if (!sess) return withSec(jsonResp({ ok: false, error: "auth_required" }, 401), request);

      try {
        if (!env.DB) {
          return withSec(jsonResp([], 200), request);
        }

        const { results } = await env.DB
          .prepare("SELECT id, section, title, description, price FROM menu_items ORDER BY id")
          .all();
        return withSec(jsonResp((results || []).map((r: any) => ({ ...r, price: normalizePriceDisplay(r?.price) })), 200), request);
      } catch (e: any) {
        return withSec(jsonResp({ ok: false, error: "select_failed", message: String(e?.message || e) }, 500), request);
      }
    }

    if (request.method === "PUT" && (url.pathname === "/menu" || /^\/menu\/[0-9]+$/.test(url.pathname))) {
      const sess = await requireSession(request, env);
      if (!sess) return withSec(jsonResp({ ok: false, error: "auth_required" }, 401), request);

      { const err = requireCsrf(request, sess); if (err) return withSec(jsonResp({ ok: false, error: "csrf" }, 403), request); }

      if (!env.DB) return withSec(jsonResp({ ok: false, error: "db_missing" }, 501), request);

      try {
        const body = await (async () => { try { return await request.json(); } catch { return {}; } })() as any;
        const pathId = url.pathname.split("/")[2];
        const id = Number((body && body.id) ? body.id : pathId);

        if (!id || Number.isNaN(id)) {
          return withSec(jsonResp({ ok: false, error: "invalid_id" }, 400), request);
        }

        const toStr = (v: any) => (v ?? "").toString();
        const fields: string[] = [];
        const params: any[] = [];

        if (body.section !== undefined) { fields.push("section = ?"); params.push(toStr(body.section).trim()); }
        if (body.title !== undefined) { fields.push("title = ?"); params.push(toStr(body.title).trim()); }
        if (body.description !== undefined) { fields.push("description = ?"); params.push(toStr(body.description).trim()); }
        if (body.price !== undefined) { fields.push("price = ?"); params.push(toStr(body.price).trim()); }

        if (!fields.length) {
          return withSec(jsonResp({ ok: false, error: "no_fields" }, 400), request);
        }

        params.push(id);
        const sql = `UPDATE menu_items SET ${fields.join(", ")} WHERE id = ?`;
        await env.DB.prepare(sql).bind(...params).run();

        const row = await env.DB
          .prepare("SELECT id, section, title, description, price FROM menu_items WHERE id = ?")
          .bind(id).first();

        return withSec(jsonResp(row ? { ...row, price: normalizePriceDisplay((row as any).price) } : {}, 200), request);
      } catch (e: any) {
        return withSec(jsonResp({ ok: false, error: "update_failed", message: String(e?.message || e) }, 500), request);
      }
    }

    /** -------- GitHub repo helpers -------- */
    if (request.method === "GET" && url.pathname === "/github/resolve-repo") {
      const sess = await requireSession(request, env);
      if (!sess) return withSec(jsonResp({ ok: false, error: "auth_required" }, 401), request);

      const r = await resolveSingleRepo(env);
      if (!r) return withSec(jsonResp({ ok: false, error: "ambiguous_or_none" }, 400), request);
      return withSec(jsonResp(r, 200), request);
    }

    // List directory contents (non-recursive)
    if (request.method === "POST" && url.pathname === "/github/list-contents") {
      const sess = await requireSession(request, env);
      if (!sess) return withSec(jsonResp({ ok: false, error: "auth_required" }, 401), request);

      const { repo, ref, dir } = await (async () => { try { return await request.json(); } catch { return {}; } })() as any;
      if (!repo) return withSec(jsonResp({ ok: false, error: "missing_repo" }, 400), request);

      const api = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(dir || "")}?ref=${encodeURIComponent(ref || "main")}`;
      const r = await gh(env, api, { method: "GET" });
      const text = await r.text();

      // Try to return JSON always
      try {
        const j = JSON.parse(text);
        return withSec(jsonResp(j, r.status), request);
      } catch {
        return withSec(jsonResp({ ok: r.ok, status: r.status, raw: text }, r.status), request);
      }
    }

    // Get a file (raw text)
    if (request.method === "POST" && url.pathname === "/github/get-file") {
      const sess = await requireSession(request, env);
      if (!sess) return withSec(jsonResp({ ok: false, error: "auth_required" }, 401), request);

      const { repo, ref, path } = await (async () => { try { return await request.json(); } catch { return {}; } })() as any;
      if (!repo || !path) return withSec(jsonResp({ ok: false, error: "missing_params" }, 400), request);

      const cleanPath = stripLeadingSlash(String(path));
      const raw = `https://raw.githubusercontent.com/${repo}/${ref || "main"}/${cleanPath}`;
      const res = await fetch(raw, { headers: { "User-Agent": "cms" } });
      const body = await res.text();

      // Always return JSON wrapper so front-end can JSON.parse safely if it expects that
      return withSec(jsonResp({ ok: res.ok, status: res.status, content: body }, res.status), request);
    }

    // List images (recursive) + normalized paths + ready-to-use CMS src
    if (request.method === "POST" && url.pathname === "/github/list-images") {
      const sess = await requireSession(request, env);
      if (!sess) return withSec(jsonResp({ ok: false, error: "auth_required" }, 401), request);

      const { repo, ref, folder } = await (async () => { try { return await request.json(); } catch { return {}; } })() as any;
      if (!repo) return withSec(jsonResp({ ok: false, error: "missing_repo" }, 400), request);

      const branch = ref || "main";
      const root = stripLeadingSlash((folder && String(folder)) || "images");
      const list = await listImagesRecursive(env, repo, branch, root);

      const images = list.map(e => {
        const repoPath = stripLeadingSlash(e.path);
        const webPath = ensureLeadingSlash(e.path);
        const cmsPath = `/images/${repoPath.replace(/^images\/?/, "")}`;
        const cms_src = `${cmsPath}?repo=${encodeURIComponent(repo)}&ref=${encodeURIComponent(branch)}`;
        const display_url = cms_src;

        return {
          name: e.name,
          path: webPath,
          repo_path: repoPath,
          cms_src,
          display_url,
          src: display_url,
          url: display_url,
          download_url: e.download_url || "",
          sha: e.sha || ""
        };
      });

      return withSec(jsonResp(images, 200), request);
    }

    // EDIT/CREATE via unified upsert (auto sha)
    if (request.method === "POST" && (url.pathname === "/github/edit-file" || url.pathname === "/github/create-file")) {
      const sess = await requireSession(request, env);
      if (!sess) return withSec(jsonResp({ ok: false, error: "auth_required" }, 401), request);

      { const err = requireCsrf(request, sess); if (err) return withSec(jsonResp({ ok: false, error: "csrf" }, 403), request); }

      const body = await (async () => { try { return await request.json(); } catch { return {}; } })();
      return upsertFile(request, env, body);
    }

    // DELETE file
    if (request.method === "POST" && url.pathname === "/github/delete-file") {
      const sess = await requireSession(request, env);
      if (!sess) return withSec(jsonResp({ ok: false, error: "auth_required" }, 401), request);

      { const err = requireCsrf(request, sess); if (err) return withSec(jsonResp({ ok: false, error: "csrf" }, 403), request); }

      const { repo, ref, path, sha, message } = await (async () => { try { return await request.json(); } catch { return {}; } })() as any;
      if (!repo || !path || !sha) return withSec(jsonResp({ ok: false, error: "missing_params" }, 400), request);

      const cleanPath = stripLeadingSlash(String(path));

      // CRITICAL SECURITY FIX: Re-added missing path validation for delete operations
      const isAllowedPath = ALLOWED_WRITE_PATHS.some(allowedPath => {
        if (allowedPath === '') {
          return !cleanPath.includes('/'); // Root files only
        }
        return cleanPath.startsWith(allowedPath);
      });

      if (!isAllowedPath) {
        return withSec(jsonResp({
          ok: false,
          error: "path_not_allowed",
          message: `Delete access denied. Allowed paths: ${ALLOWED_WRITE_PATHS.filter(p => p !== '').join(', ')}, and root files`,
          attempted_path: cleanPath
        }, 403), request);
      }

      const api = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(cleanPath)}`;
      const payload = { message: message || `cms: delete ${cleanPath}`, sha, branch: ref || "main" };
      const r = await gh(env, api, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const txt = await r.text();

      let data: any = null;
      try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
      return withSec(jsonResp({ ok: r.ok, status: r.status, ...data }, r.status), request);
    }

    /** -------- Image proxy (same-origin thumbnails / "in use" gallery) -------- */
    if (request.method === "GET" && url.pathname.startsWith("/images/")) {
      const sess = await requireSession(request, env);
      if (!sess) return withSec(jsonResp({ ok: false, error: "auth_required" }, 401), request);

      let repo = url.searchParams.get("repo") || "";
      let ref = url.searchParams.get("ref") || "";
      if (!repo) {
        const r = await resolveSingleRepo(env);
        if (r) { repo = r.repo; ref = ref || r.ref; }
      }

      if (!repo) return withSec(jsonResp({ ok: false, error: "missing_repo" }, 400), request);

      const fallbackQP =
        url.searchParams.get("path") ||
        url.searchParams.get("p") ||
        url.searchParams.get("repo_path") ||
        url.searchParams.get("rp") || "";

      const underRaw = url.pathname.slice("/images/".length);
      let under = underRaw ? decodeURIComponent(underRaw) : decodeURIComponent(fallbackQP);
      under = stripLeadingSlash(under || "");
      if (under.toLowerCase().startsWith("images/")) under = under.slice("images/".length);
      if (!under) return withSec(jsonResp({ ok: false, error: "missing_image_path" }, 400), request);

      const repoPath = `images/${under}`;
      const rawUrl = `https://raw.githubusercontent.com/${repo}/${ref || "main"}/${repoPath}`;

      const out = Response.redirect(rawUrl, 302);
      const h = new Headers(out.headers);
      h.set("Cache-Control", "public, max-age=300, stale-while-revalidate=300");
      h.set("X-Resolved-Image-Path", repoPath);
      return withSec(new Response(null, { status: 302, headers: h }), request);
    }

       /** -------- Preview proxy (raw.githubusercontent.com) -------- */
    if (request.method === "GET" && url.pathname.startsWith("/proxy/")) {
      const sess = await requireSession(request, env);
      if (!sess) {
        return withSec(
          jsonResp({ ok: false, error: "auth_required" }, 401),
          request
        );
      }

      const restRaw = url.pathname.slice("/proxy/".length);
      const rest = stripLeadingSlash(decodeURIComponent(restRaw));

      let repo = url.searchParams.get("repo") || "";
      let ref = url.searchParams.get("ref") || "";

      if (!repo) {
        const r = await resolveSingleRepo(env);
        if (r) {
          repo = r.repo;
          ref = ref || r.ref;
        }
      }

      if (!repo) {
        return withSec(
          jsonResp({ ok: false, error: "missing_repo" }, 400),
          request
        );
      }

      const rawUrl =
        `https://raw.githubusercontent.com/${repo}/${ref || "main"}/${rest}`;

      const ghHeaders: Record<string, string> = {
        "User-Agent": "cms"
      };

      if (env.GITHUB_TOKEN) {
        ghHeaders["Authorization"] = `token ${env.GITHUB_TOKEN}`;
      }

      const res = await fetch(rawUrl, { headers: ghHeaders });
      const h = new Headers(res.headers);

      // GitHub Raw may return source files as text/plain.
      // Since this Worker sends X-Content-Type-Options: nosniff,
      // explicitly set the correct MIME type for preview assets.
      const lower = rest.toLowerCase();

      if (lower.endsWith(".css")) {
        h.set("Content-Type", "text/css; charset=utf-8");
      } else if (lower.endsWith(".js")) {
        h.set("Content-Type", "application/javascript; charset=utf-8");
      } else if (lower.endsWith(".html") || lower.endsWith(".htm")) {
        h.set("Content-Type", "text/html; charset=utf-8");
      } else if (lower.endsWith(".json")) {
        h.set("Content-Type", "application/json; charset=utf-8");
      } else if (lower.endsWith(".svg")) {
        h.set("Content-Type", "image/svg+xml");
      } else if (lower.endsWith(".png")) {
        h.set("Content-Type", "image/png");
      } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
        h.set("Content-Type", "image/jpeg");
      } else if (lower.endsWith(".gif")) {
        h.set("Content-Type", "image/gif");
      } else if (lower.endsWith(".webp")) {
        h.set("Content-Type", "image/webp");
      } else if (lower.endsWith(".mp4")) {
        h.set("Content-Type", "video/mp4");
      } else if (lower.endsWith(".webm")) {
        h.set("Content-Type", "video/webm");
      }

      h.delete("content-security-policy");
      h.delete("content-security-policy-report-only");
      h.delete("x-frame-options");

      return withSec(
        new Response(res.body, {
          status: res.status,
          headers: h
        }),
        request
      );
    }

    /** -------- Fallback for accidental /undefined image src -------- */
    if (request.method === "GET" && url.pathname === "/undefined") {
      const bin = Uint8Array.from([
        71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0,
        33, 249, 4, 1, 0, 0, 1, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2,
        76, 1, 0, 59
      ]);

      return withSec(
        new Response(bin, {
          status: 200,
          headers: {
            "Content-Type": "image/gif"
          }
        }),
        request
      );
    }

    return withSec(
      jsonResp({ ok: false, error: "not_found" }, 404),
      request
    );
  },
};
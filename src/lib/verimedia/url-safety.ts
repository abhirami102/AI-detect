/**
 * SSRF protection for the "analyze a media URL" path.
 * Blocks non-HTTP schemes, credentials, non-standard ports, and any host that
 * resolves to a private / loopback / link-local / reserved address literal.
 */

export interface UrlCheck {
  ok: boolean;
  reason?: string;
  url?: URL;
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const ALLOWED_PORTS = new Set(["", "80", "443", "8443"]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa", ".onion"];

function isPrivateIPv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => Number.isNaN(p) || p > 255)) return true; // malformed → refuse
  const [a, b] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true;
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!h.includes(":")) return false;
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fe80") || h.startsWith("fc") || h.startsWith("fd")) return true;
  if (h.startsWith("::ffff:")) return isPrivateIPv4(h.slice(7));
  return false;
}

export function checkMediaUrl(raw: string): UrlCheck {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "Enter a URL." };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "That is not a valid URL." };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return {
      ok: false,
      reason: `Blocked scheme "${url.protocol}". Only http and https are allowed.`,
    };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "URLs with embedded credentials are refused." };
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    return { ok: false, reason: `Blocked port "${url.port}".` };
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, reason: "Blocked host: internal address." };
  }
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: "Blocked host: internal address." };
  }
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) {
    return { ok: false, reason: "Blocked host: private or reserved IP range." };
  }
  if (!host.includes(".") && !host.includes(":")) {
    return { ok: false, reason: "Blocked host: unqualified hostname." };
  }

  return { ok: true, url };
}

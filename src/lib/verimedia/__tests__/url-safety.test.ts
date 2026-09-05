import { describe, expect, it } from "vitest";
import { checkMediaUrl } from "../url-safety";

const blocked = [
  "http://localhost/a.jpg",
  "http://127.0.0.1/a.jpg",
  "http://0.0.0.0/a.jpg",
  "http://10.0.0.5/a.jpg",
  "http://192.168.1.20/a.jpg",
  "http://172.16.4.4/a.jpg",
  "http://169.254.169.254/latest/meta-data/",
  "http://100.64.0.1/a.jpg",
  "http://[::1]/a.jpg",
  "http://[fd00::1]/a.jpg",
  "http://router.local/a.jpg",
  "http://intranet/a.jpg",
  "http://example.onion/a.jpg",
  "file:///etc/passwd",
  "ftp://example.com/a.jpg",
  "javascript:alert(1)",
  "http://user:pass@example.com/a.jpg",
  "http://example.com:22/a.jpg",
];

describe("SSRF protection", () => {
  it.each(blocked)("blocks %s", (url) => {
    const r = checkMediaUrl(url);
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it("allows a plain public https media URL", () => {
    const r = checkMediaUrl("https://example.com/clip.mp4");
    expect(r.ok).toBe(true);
    expect(r.url?.hostname).toBe("example.com");
  });

  it("allows explicit standard ports", () => {
    expect(checkMediaUrl("https://example.com:443/a.jpg").ok).toBe(true);
    expect(checkMediaUrl("http://example.com:80/a.jpg").ok).toBe(true);
  });

  it("rejects garbage input", () => {
    expect(checkMediaUrl("not a url").ok).toBe(false);
    expect(checkMediaUrl("").ok).toBe(false);
  });
});

export default {
  async fetch(request, env) {
    const method = request.method.toUpperCase();
    const url    = new URL(request.url);

    // ── OPTIONS ──────────────────────────────────────────────────────────────
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "DAV":            "1, 2",
          "MS-Author-Via":  "DAV",
          "Allow":          "OPTIONS, GET, HEAD, PROPFIND",
          "Content-Length": "0",
          "Content-Type":   "text/plain",
        },
      });
    }

    // ── PROPFIND ──────────────────────────────────────────────────────────────
    if (method === "PROPFIND") {
      const depth = request.headers.get("Depth") ?? "infinity";

      const resp = await env.ASSETS.fetch(
        new Request(new URL("/propfind.xml", url.origin))
      );

      if (!resp.ok) {
        return new Response("propfind.xml missing — run the generate workflow", {
          status: 500,
        });
      }

      let xml = await resp.text();

      if (depth === "0" && url.pathname !== "/") {
        xml = filterDepth0(xml, url.pathname);
      }

      return new Response(xml, {
        status: 207,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "DAV":          "1, 2",
        },
      });
    }

    // ── everything else → static assets ──────────────────────────────────────
    if (method === "GET" || method === "HEAD") {
      return env.ASSETS.fetch(request);
    }

    return new Response(null, {
      status: 501,
      headers: { "DAV": "1, 2" },
    });
  },
};

function filterDepth0(xml, targetPath) {
  const escaped = targetPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<D:response>[\\s\\S]*?<D:href>${escaped}<\\/D:href>[\\s\\S]*?<\\/D:response>`,
    "g"
  );
  const matches = xml.match(re) ?? [];
  return [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<D:multistatus xmlns:D="DAV:">`,
    ...matches,
    `</D:multistatus>`,
  ].join("\n");
}

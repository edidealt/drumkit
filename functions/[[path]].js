export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "DAV": "1",
        "Allow": "OPTIONS, GET, HEAD, PROPFIND",
        "MS-Author-Via": "DAV",
        "Content-Length": "0",
      },
    });
  }

  if (method === "PROPFIND") {
    const depth = request.headers.get("Depth") ?? "infinity";
    const assetReq = new Request(new URL("/propfind.xml", url.origin));
    const resp = await env.ASSETS.fetch(assetReq);

    if (!resp.ok) {
      return new Response("propfind.xml not found — run the generate workflow", {
        status: 500,
      });
    }

    let xml = await resp.text();

    if (depth === "0" && url.pathname !== "/") {
      xml = filterPropfindDepth0(xml, url.pathname);
    }

    return new Response(xml, {
      status: 207,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "DAV": "1",
      },
    });
  }

  if (method === "GET" || method === "HEAD") {
    return env.ASSETS.fetch(request);
  }

  return new Response(null, {
    status: 501,
    headers: { "DAV": "1" },
  });
}

function filterPropfindDepth0(xml, targetPath) {
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

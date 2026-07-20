/**
 * Cloudflare Worker Reverse Proxy for Vani AI
 * Target Backend: Render (https://model-vina.onrender.com)
 *
 * How it works:
 * Any request to https://vina.aayushmishra5510c.workers.dev gets forwarded
 * automatically to https://model-vina.onrender.com with full request/response headers.
 */

export default {
  async fetch(request, env, ctx) {
    const RENDER_BACKEND = env.NEXT_PUBLIC_API_BASE_URL || "https://model-vina.onrender.com";
    const url = new URL(request.url);

    // Construct target URL on Render backend
    const targetUrl = `${RENDER_BACKEND}${url.pathname}${url.search}`;

    // Clone and prepare headers
    const newHeaders = new Headers(request.headers);
    newHeaders.set("Host", "model-vina.onrender.com");

    // Handle CORS preflight options request
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: newHeaders,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
      redirect: "follow",
    });

    try {
      const response = await fetch(proxyRequest);

      // Create mutable response to inject CORS headers
      const modifiedResponse = new Response(response.body, response);
      modifiedResponse.headers.set("Access-Control-Allow-Origin", "*");
      modifiedResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

      return modifiedResponse;
    } catch (err) {
      return new Response(JSON.stringify({ error: "Failed to fetch backend service on Render", details: err.message }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

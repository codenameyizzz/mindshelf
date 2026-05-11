import { scrapeMetadata } from "../src/server/scrape";

export default {
  async fetch(request: Request) {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, {
        status: 405,
        headers: {
          Allow: "POST",
        },
      });
    }

    const { url } = await request.json().catch(() => ({ url: "" }));

    if (!url) {
      return Response.json({ error: "URL is required" }, { status: 400 });
    }

    try {
      return Response.json(await scrapeMetadata(url));
    } catch {
      return Response.json(
        { error: "Failed to fetch metadata. Make sure the URL is accessible." },
        { status: 500 }
      );
    }
  },
};

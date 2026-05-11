import axios from "axios";
import * as cheerio from "cheerio";

const IMAGE_CACHE_LIMIT = 650 * 1024;

function detectPlatform(url: string, source?: string) {
  const target = `${source || ""} ${url}`.toLowerCase();

  if (target.includes("youtube.com") || target.includes("youtu.be")) {
    return "YouTube";
  }

  if (target.includes("instagram.com")) {
    return "Instagram";
  }

  return "Web";
}

function toAbsoluteUrl(value: string | undefined, baseUrl: string) {
  if (!value) {
    return "";
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

function getInstagramMediaCandidate(pageUrl: string) {
  const match = pageUrl.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
  return match ? `https://www.instagram.com/p/${match[1]}/media/?size=l` : "";
}

function getYouTubeImageCandidate(pageUrl: string) {
  try {
    const parsed = new URL(pageUrl);
    const id = parsed.hostname.includes("youtu.be") ? parsed.pathname.replace("/", "") : parsed.searchParams.get("v");
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
  } catch {
    return "";
  }
}

function getFaviconCandidate(pageUrl: string) {
  const source = new URL(pageUrl).hostname;
  return `https://www.google.com/s2/favicons?domain=${source}&sz=256`;
}

function readJsonLdImage($: cheerio.CheerioAPI, pageUrl: string) {
  let image = "";

  $('script[type="application/ld+json"]').each((_, element) => {
    if (image) return;

    try {
      const value = JSON.parse($(element).text());
      const nodes = Array.isArray(value) ? value : [value, ...(Array.isArray(value?.["@graph"]) ? value["@graph"] : [])];

      for (const node of nodes) {
        const rawImage = node?.image;
        const candidate = Array.isArray(rawImage) ? rawImage[0] : rawImage?.url || rawImage;

        if (typeof candidate === "string") {
          image = toAbsoluteUrl(candidate, pageUrl);
          break;
        }
      }
    } catch {
      // Ignore malformed structured data and continue with standard metadata.
    }
  });

  return image;
}

async function fetchImageData(imageUrl: string) {
  if (!imageUrl) {
    return "";
  }

  try {
    const response = await axios.get<ArrayBuffer>(imageUrl, {
      responseType: "arraybuffer",
      timeout: 5000,
      maxContentLength: IMAGE_CACHE_LIMIT,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });

    const contentType = String(response.headers["content-type"] || "image/jpeg");
    const bytes = Buffer.from(response.data);

    if (!contentType.startsWith("image/") || bytes.byteLength > IMAGE_CACHE_LIMIT) {
      return "";
    }

    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return "";
  }
}

function buildFallbackMetadata(rawUrl: string) {
  const pageUrl = new URL(rawUrl).toString();
  const source = new URL(pageUrl).hostname.replace(/^www\./, "");
  const platform = detectPlatform(pageUrl, source);
  const fallbackThumbnail =
    (platform === "Instagram" ? getInstagramMediaCandidate(pageUrl) : "") ||
    (platform === "YouTube" ? getYouTubeImageCandidate(pageUrl) : "") ||
    getFaviconCandidate(pageUrl);

  return {
    pageUrl,
    source,
    platform,
    fallbackThumbnail,
  };
}

async function scrapeMetadata(rawUrl: string) {
  try {
    const pageUrl = new URL(rawUrl).toString();
    const platform = detectPlatform(pageUrl);
    const response = await axios.get(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 5000,
    });

    const html = response.data;
    const $ = cheerio.load(html);
    const source = new URL(pageUrl).hostname.replace(/^www\./, "");
    const imageCandidates = [
      $('meta[property="og:image:secure_url"]').attr("content"),
      $('meta[property="og:image"]').attr("content"),
      $('meta[name="twitter:image"]').attr("content"),
      $('meta[name="twitter:image:src"]').attr("content"),
      $('meta[itemprop="image"]').attr("content"),
      $('link[rel="image_src"]').attr("href"),
      readJsonLdImage($, pageUrl),
      platform === "Instagram" ? getInstagramMediaCandidate(pageUrl) : "",
      platform === "YouTube" ? getYouTubeImageCandidate(pageUrl) : "",
    ]
      .map((candidate) => toAbsoluteUrl(candidate, pageUrl))
      .filter(Boolean);
    const thumbnailCandidates = [
      $('link[rel="apple-touch-icon"]').attr("href"),
      $('link[rel="icon"]').attr("href"),
      $('link[rel="shortcut icon"]').attr("href"),
      getFaviconCandidate(pageUrl),
    ]
      .map((candidate) => toAbsoluteUrl(candidate, pageUrl))
      .filter(Boolean);
    const image = imageCandidates[0] || thumbnailCandidates[0] || "";
    const thumbnail = thumbnailCandidates[0] || image || "";
    const imageData = await fetchImageData(image) || await fetchImageData(thumbnail);

    return {
      title: $("title").text() || $('meta[property="og:title"]').attr("content") || $('meta[name="twitter:title"]').attr("content") || "No Title Found",
      description: $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || $('meta[name="twitter:description"]').attr("content") || "No Description Found",
      image,
      imageData,
      thumbnail,
      source,
      platform,
      url: pageUrl,
    };
  } catch {
    const { pageUrl, source, platform, fallbackThumbnail } = buildFallbackMetadata(rawUrl);
    const imageData = await fetchImageData(fallbackThumbnail);

    return {
      title: platform === "Instagram" ? "Instagram Post" : "Saved Web Link",
      description: "A saved link with a generated browser thumbnail.",
      image: fallbackThumbnail,
      imageData,
      thumbnail: fallbackThumbnail,
      source,
      platform,
      url: pageUrl,
    };
  }
}

export default {
  async fetch(request: Request) {
    if (request.method !== "POST") {
      return Response.json(
        { error: "Method not allowed" },
        {
          status: 405,
          headers: {
            Allow: "POST",
          },
        }
      );
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

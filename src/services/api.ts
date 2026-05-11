import { ContentCategory, ContentMetadata, ContentPlatform, SavedContent } from "../types";

export async function fetchMetadata(url: string): Promise<ContentMetadata> {
  const response = await fetch("/api/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to fetch metadata");
  }

  return response.json();
}

export function detectPlatform(url: string, source?: string): ContentPlatform {
  const target = `${source || ""} ${url}`.toLowerCase();

  if (target.includes("youtube.com") || target.includes("youtu.be")) {
    return "YouTube";
  }

  if (target.includes("instagram.com")) {
    return "Instagram";
  }

  return "Web";
}

function normalizeCategory(category: string): ContentCategory {
  const categoryMap: Record<string, ContentCategory> = {
    Belajar: "Learning",
    Hiburan: "Entertainment",
    "Referensi Kerja": "Work Reference",
    Lainnya: "Other",
    Learning: "Learning",
    Entertainment: "Entertainment",
    "Work Reference": "Work Reference",
    Other: "Other",
  };

  return categoryMap[category] || "Other";
}

export function normalizeSavedItem(item: SavedContent): SavedContent {
  return {
    ...item,
    platform: item.platform || detectPlatform(item.url, item.source),
    category: normalizeCategory(item.category),
    originalImage: item.originalImage || item.image,
  };
}

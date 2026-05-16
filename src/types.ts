export interface ContentMetadata {
  title: string;
  description: string;
  image: string;
  imageData?: string;
  thumbnail: string;
  source: string;
  url: string;
  platform: ContentPlatform;
}

export type ContentCategory = string;
export type ContentPlatform = "YouTube" | "Instagram" | "Web";

export interface SavedContent {
  id: string;
  url: string;
  title: string;
  description: string;
  image: string;
  originalImage?: string;
  source: string;
  platform: ContentPlatform;
  category: ContentCategory;
  reason: string;
  savedAt: number;
  isRead: boolean;
  completedAt?: number;
}

export interface UserStats {
  totalSaved: number;
  totalCompleted: number;
  categoryBreakdown: Record<string, number>;
}

export const IMAGE_CACHE_LIMIT = 100 * 1024 * 1024;
export const IMAGE_DOWNLOAD_LIMIT = 5 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export interface ImageCredit {
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
}
export interface OnlineImageRecord {
  key: string;
  bytes: ArrayBuffer | null;
  mime: string;
  credit: ImageCredit | null;
  lastUsed: number;
  missingUntil: number;
}
export interface OnlineImageStore {
  read: (key: string) => Promise<OnlineImageRecord | null>;
  write: (record: OnlineImageRecord) => Promise<void>;
  clear: () => Promise<void>;
  stats: () => Promise<{ bytes: number; count: number }>;
  enabled: () => Promise<boolean>;
  setEnabled: (value: boolean) => Promise<void>;
}

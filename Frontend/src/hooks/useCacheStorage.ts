const CACHE_NAME = "admin-log-files-v1";

export interface CachedFile {
  public_id: string;
  name: string;
  size: number;
  secure_url: string;
  format: string;
  created_at: string;
}

export async function cacheFileList(files: CachedFile[]): Promise<void> {
  if (!("caches" in window)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    const metaResponse = new Response(JSON.stringify(files), {
      headers: { "Content-Type": "application/json" },
    });
    await cache.put("/admin/log-files/metadata", metaResponse);
  } catch (err) {
    console.warn("[CacheStorage] Failed to cache file list:", err);
  }
}

export async function cacheFileDownload(file: CachedFile): Promise<boolean> {
  if (!("caches" in window)) return false;
  try {
    const cache = await caches.open(CACHE_NAME);
    const existing = await cache.match(file.secure_url);
    if (existing) return true;

    const response = await fetch(file.secure_url, { mode: "cors" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await cache.put(file.secure_url, response);
    return true;
  } catch (err) {
    console.warn(`[CacheStorage] Failed to cache ${file.name}:`, err);
    return false;
  }
}

export async function getCachedFileList(): Promise<CachedFile[]> {
  if (!("caches" in window)) return [];
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match("/admin/log-files/metadata");
    if (!response) return [];
    return response.json();
  } catch {
    return [];
  }
}

export async function removeCachedFile(secure_url: string): Promise<void> {
  if (!("caches" in window)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(secure_url);
  } catch (err) {
    console.warn("[CacheStorage] Failed to remove cached file:", err);
  }
}

export async function listCachedKeys(): Promise<string[]> {
  if (!("caches" in window)) return [];
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    return keys.map((r) => r.url);
  } catch {
    return [];
  }
}

export async function clearCache(): Promise<void> {
  if (!("caches" in window)) return;
  await caches.delete(CACHE_NAME);
}
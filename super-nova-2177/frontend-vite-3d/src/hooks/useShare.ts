// src/hooks/useShare.ts
import bus from "../lib/bus";
import type { Post } from "../types";
import {
  sharePost as shareCore,
  type ShareOptions,
} from "../lib/share";

/**
 * Back-compat overloads:
 * - sharePost(url, title?)
 * - sharePost(Post | ShareOptions | string)
 * Returns true if sharing/copy succeeded, false otherwise.
 */
export function sharePost(url: string, title?: string): Promise<boolean>;
export function sharePost(arg: Post | ShareOptions | string, title?: never): Promise<boolean>;
export async function sharePost(
  arg: Post | ShareOptions | string,
  title?: string,
): Promise<boolean> {
  try {
    // Old signature: (url: string, title?: string)
    if (typeof arg === "string" && (title === undefined || typeof title === "string")) {
      return await shareCore({ url: arg || (typeof location !== "undefined" ? location.href : ""), title });
    }
    // New unified signature: (Post | ShareOptions | string)
    return await shareCore(arg);
  } catch {
    // Ensure a consistent boolean on unexpected errors
    return false;
  }
}

/**
 * Repost helper – keeps existing event semantics.
 */
export function repostPost(id: string | number) {
  bus.emit("feed:repost", id);
}

/**
 * Optional tiny hook for convenient imports.
 */
export function useShare() {
  return {
    sharePost,
    repostPost,
  };
}

export type { ShareOptions };

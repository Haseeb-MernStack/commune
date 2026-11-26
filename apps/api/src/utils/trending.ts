/** Trending score for posts on the Explore page. */
export const TRENDING_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The most recent posts in the window that are scored in memory. */
export const TRENDING_MAX_CANDIDATES = 200;

export interface TrendingPostInput {
  likeCount: number;
  commentCount: number;
  createdAt: Date | string;
}

/**
 * Score of a post at a moment: likes plus twice the comments, decayed by age in hours, so a
 * newer post with less engagement can outrank an older one. Posts outside the window are
 * never scored (see listTrendingPosts).
 */
export function trendingScore(post: TrendingPostInput, now: Date = new Date()): number {
  const ageMs = now.getTime() - new Date(post.createdAt).getTime();
  const ageHours = Math.max(0, ageMs / 3_600_000);
  return (post.likeCount + 2 * post.commentCount) / (1 + ageHours);
}

/** The given posts ordered by score, highest first. The input is not changed. */
export function sortTrending<T extends TrendingPostInput>(
  posts: T[],
  now: Date = new Date(),
): T[] {
  return [...posts].sort((a, b) => trendingScore(b, now) - trendingScore(a, now));
}

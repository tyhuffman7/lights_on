import type { StreamBook } from "./types.ts";
import { fresh } from "./books.ts";
export function freshnessResearch(
  book: StreamBook | undefined,
  mono: number,
  wall: number,
  maxAgeMs: number,
  streamHealthy: boolean,
) {
  if (!book || book.connection !== "LIVE" || !streamHealthy)
    return "CONNECTION_UNHEALTHY";
  if (!book.valid) return "SEQUENCE_INVALID";
  if (fresh(book, mono, wall, maxAgeMs)) return "STRICT_EXECUTION_FRESH";
  if (mono < book.receivedMono || wall < book.receivedAt)
    return "CLOCK_ANOMALY";
  if (mono - book.receivedMono > maxAgeMs)
    return "HEALTHY_RESTING_BOOK_RESEARCH";
  if (book.exchangeAt !== null && wall - book.exchangeAt > maxAgeMs)
    return "EXCHANGE_TIMESTAMP_OLD";
  return "BOOK_TRULY_STALE";
}

import { z } from "zod";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  readFileSync,
  openSync,
  writeFileSync,
  closeSync,
  unlinkSync,
  mkdirSync,
} from "node:fs";
import { dirname } from "node:path";
const id = z.string().regex(/^[a-zA-Z0-9_.-]{1,220}$/);
export const configSchema = z
  .object({
    database: z.string().default("research-data/research.sqlite"),
    port: z.number().int().min(1024).max(65535).default(8789),
    metadataIntervalMs: z.number().int().min(10000).default(60000),
    reconciliationIntervalMs: z.number().int().min(10000).default(60000),
    maxAgeMs: z.number().int().min(1).max(10000).default(2000),
    reserve: z.number().int().min(0).max(10000).default(100),
    minProfit: z.number().int().min(0).default(1),
    minRoi: z.number().min(0).default(1),
    bankrolls: z
      .array(z.number().int().positive().max(100000000))
      .default([1000000, 2500000, 5000000, 10000000]),
    markets: z
      .array(
        z.object({
          kalshi: id,
          poly: id,
          inverted: z.boolean().default(false),
        }),
      )
      .default([]),
  })
  .strict();
export type ObserverConfig = z.infer<typeof configSchema>;
export function readConfig(path: string): ObserverConfig {
  return configSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}
export function lease(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const lock = new DatabaseSync(path + ".lease.sqlite");
  const token = randomUUID();
  try {
    lock.exec(
      "PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS observer_lease(id INTEGER PRIMARY KEY CHECK(id=1),pid INTEGER NOT NULL,token TEXT NOT NULL); BEGIN IMMEDIATE;",
    );
    const owner = lock
      .prepare("SELECT pid FROM observer_lease WHERE id=1")
      .get() as { pid: number } | undefined;
    if (owner) {
      let gone = false;
      try {
        process.kill(owner.pid, 0);
      } catch (error) {
        gone = (error as NodeJS.ErrnoException).code === "ESRCH";
      }
      if (!gone)
        throw new Error(
          "Another observer owns this database; owner liveness could not be disproven",
        );
    }
    lock
      .prepare(
        "INSERT INTO observer_lease VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET pid=excluded.pid,token=excluded.token",
      )
      .run(process.pid, token);
    lock.exec("COMMIT");
  } catch (error) {
    try {
      lock.exec("ROLLBACK");
    } catch {}
    lock.close();
    throw error;
  }
  return () => {
    lock
      .prepare("DELETE FROM observer_lease WHERE id=1 AND token=?")
      .run(token);
    lock.close();
  };
}

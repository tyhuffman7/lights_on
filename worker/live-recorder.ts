import { freshnessResearch } from "../lib/research/freshness.ts";
import type { ResearchActivity } from "../lib/research/review.ts";
import { serialize } from "node:v8";
import { Worker } from "node:worker_threads";
import { randomUUID } from "node:crypto";
import { evaluate } from "../lib/research/detector.ts";
import { isVerified, type MappingRegistry } from "../lib/research/mappings.ts";
import type {
  StreamBook,
  Evaluation,
  Mapping,
  ResearchConfig,
} from "../lib/research/types.ts";
import type { Telemetry } from "./telemetry.ts";
export class LiveRecorder {
  sessionId = randomUUID();
  path: string;
  readBusy = false;
  databaseSample: { at: number; bytes: number } | null = null;
  worker: Worker;
  registry: MappingRegistry;
  config: ResearchConfig;
  telemetry: Telemetry;
  index = new Map<string, Mapping[]>();
  books = new Map<string, StreamBook>();
  pending = new Map<
    number,
    {
      resolve: (x: any) => void;
      reject: (e: Error) => void;
      at: number;
      bytes: number;
      receivedMono?: number;
    }
  >();
  backlogBytes = 0;
  lastAckAt = Date.now();
  onFailure: () => void;
  activity: Record<string, ResearchActivity> = {};
  rawActive = new Set<string>();
  streamHealthy: (venue: string, id: string) => boolean = () => false;
  storage: Record<string, number> = {};
  next = 0;
  failed = false;
  closing = false;
  maxPending: number;
  ready: Promise<void>;
  constructor(
    path: string,
    registry: MappingRegistry,
    config: ResearchConfig,
    telemetry: Telemetry,
    onFailure: () => void,
    maxPending = 2000,
    mode = "live",
  ) {
    this.path = path;
    this.onFailure = onFailure;
    this.registry = registry;
    this.config = config;
    this.telemetry = telemetry;
    this.maxPending = maxPending;
    this.worker = new Worker(
      new URL("./persistence-thread.ts", import.meta.url),
      {
        workerData: {
          path,
          config,
          sessionId: this.sessionId,
          at: Date.now(),
          mode,
        },
        execArgv: ["--experimental-strip-types"],
      },
    );
    this.ready = new Promise((resolve, reject) => {
      this.worker.on("message", (m) => {
        if (m.ready) {
          resolve();
          return;
        }
        const p = this.pending.get(m.id);
        if (!p) return;
        this.pending.delete(m.id);
        this.backlogBytes -= p.bytes;
        this.lastAckAt = Date.now();
        if (m.storage) this.storage = m.storage;
        telemetry.sample("persistenceAck", performance.now() - p.at);
        telemetry.sample("persistenceWrite", m.writeMs);
        if (p.receivedMono !== undefined)
          telemetry.sample(
            "receiveToPersistenceAck",
            performance.now() - p.receivedMono,
          );
        if (m.error) {
          p.reject(new Error(m.error));
          if (m.error !== "REQUEST_FAILED") fail();
        } else p.resolve(m.result);
      });
      const fail = () => {
        this.failed = true;
        reject(new Error("Persistence worker unavailable"));
        for (const p of this.pending.values())
          p.reject(new Error("Persistence worker unavailable"));
        this.pending.clear();
        this.backlogBytes = 0;
        onFailure();
      };
      this.worker.on("error", fail);
      this.worker.on("exit", (code) => {
        if (!this.closing) fail();
      });
    });
    this.ready.catch(() => {});
  }
  async read(kind: string, data: any) {
    if (kind === "capacity")
      while (this.readBusy && !this.closing)
        await new Promise((resolve) => setTimeout(resolve, 25));
    if (this.readBusy) throw new Error("Report reader busy");
    this.readBusy = true;
    let reader: Worker | undefined;
    try {
      await this.send("barrier", {});
      reader = new Worker(new URL("./query-thread.ts", import.meta.url), {
        workerData: {
          path: this.path,
          kind,
          data: { ...data, sessionId: data.sessionId ?? this.sessionId },
        },
        execArgv: ["--experimental-strip-types"],
      });
      const result: any = await new Promise((resolve, reject) => {
        reader!.once("message", (m) =>
          m.error
            ? reject(new Error("Research query failed"))
            : resolve(m.result),
        );
        reader!.once("error", () =>
          reject(new Error("Research reader failed")),
        );
        reader!.once("exit", (code) => {
          if (code !== 0) reject(new Error("Research reader exited"));
        });
      });
      if (
        result?.database &&
        result.database.growthBytesPerSecond === undefined
      ) {
        const bytes = result.database.bytes + result.database.walBytes,
          at = Date.now();
        result.database.growthBytesPerSecond = this.databaseSample
          ? (bytes - this.databaseSample.bytes) /
            ((at - this.databaseSample.at) / 1000)
          : null;
        this.databaseSample = { at, bytes };
      }
      return result;
    } finally {
      this.readBusy = false;
      if (reader) await reader.terminate();
    }
  }
  send(kind: string, data: any): Promise<any> {
    if (
      this.path !== ":memory:" &&
      [
        "report",
        "sessions",
        "opportunities",
        "detail",
        "csv",
        "activity",
        "capacity",
        "review",
      ].includes(kind)
    )
      return this.read(kind, data);
    if (this.failed && kind !== "stop")
      return Promise.reject(new Error("Persistence failed"));
    if (this.pending.size >= this.maxPending && kind !== "stop") {
      this.failed = true;
      this.onFailure();
      this.telemetry.count("PERSISTENCE_OVERFLOW");
      return Promise.reject(new Error("Persistence backlog limit"));
    }
    const id = ++this.next;
    const payload = Uint8Array.from(serialize({ id, kind, data }));
    if (
      this.backlogBytes + payload.byteLength > 64 * 1024 * 1024 &&
      kind !== "stop"
    ) {
      this.failed = true;
      this.onFailure();
      return Promise.reject(new Error("Persistence byte limit"));
    }
    this.backlogBytes += payload.byteLength;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve,
        reject,
        at: performance.now(),
        bytes: payload.byteLength,
        receivedMono: kind === "book" ? data.book.receivedMono : undefined,
      });
      this.worker.postMessage({ payload }, [payload.buffer]);
    });
  }
  enqueue(kind: string, data: any) {
    void this.send(kind, data).catch(() => {
      this.failed = true;
      this.onFailure();
    });
  }
  patchMapping(m: Mapping) {
    const previous = this.registry.get(m.id);
    const keys = new Set(
      [previous?.pair.a, previous?.pair.b, m.pair.a, m.pair.b]
        .filter(Boolean)
        .map((market) => `${market!.venue}:${market!.id}`),
    );
    for (const key of keys) {
      const entries = (this.index.get(key) ?? []).filter((x) => x.id !== m.id);
      if ([m.pair.a, m.pair.b].some((x) => `${x.venue}:${x.id}` === key))
        entries.push(m);
      if (entries.length) this.index.set(key, entries);
      else this.index.delete(key);
    }
  }
  reindex() {
    this.index.clear();
    const ms = this.registry.list();
    for (const m of ms)
      for (const market of [m.pair.a, m.pair.b]) {
        const key = `${market.venue}:${market.id}`;
        this.index.set(key, [...(this.index.get(key) ?? []), m]);
      }
    this.enqueue("index", ms);
  }
  update(book: StreamBook) {
    if (this.failed) throw new Error("Persistence unavailable");
    const started = performance.now();
    this.telemetry.sample("processingLag", started - book.receivedMono);
    const key = `${book.venue}:${book.marketId}`;
    this.books.set(key, structuredClone(book));
    const evaluations: Record<string, Evaluation[]> = {};
    for (const m of this.index.get(key) ?? []) {
      const a = this.books.get(`kalshi:${m.pair.a.id}`),
        b = this.books.get(`poly:${m.pair.b.id}`);
      if (a && b) {
        evaluations[m.id] = evaluate(
          m.pair,
          a,
          b,
          this.config,
          book.receivedMono,
          book.receivedAt,
          isVerified(m),
        );
        this.telemetry.count("evaluations", 2);
        const activity = (this.activity[m.id] ??= {});
        activity.updates = (activity.updates ?? 0) + 1;
        activity.depth = Math.min(
          a.yes.reduce((n, l) => n + l.quantity, 0) +
            a.no.reduce((n, l) => n + l.quantity, 0),
          b.yes.reduce((n, l) => n + l.quantity, 0) +
            b.no.reduce((n, l) => n + l.quantity, 0),
        );
        for (const e of evaluations[m.id]) {
          if (e.reasons.includes("SIZING_WORK_LIMIT"))
            this.telemetry.count("SIZING_WORK_LIMIT");
          const key = m.id + ":" + e.orientation;
          const raw =
            m.active &&
            !!e.bestGross &&
            e.bestGross.grossProfit > 0 &&
            !e.reasons.some((r) =>
              ["BOOK_STALE", "MARKET_CLOSED", "UNSUPPORTED_QUANTITY"].includes(
                r,
              ),
            );
          if (raw) {
            if (!this.rawActive.has(key))
              activity.count = (activity.count ?? 0) + 1;
            this.rawActive.add(key);
          } else this.rawActive.delete(key);
        }
        const states = [a, b].map((leg) =>
          freshnessResearch(
            leg,
            book.receivedMono,
            book.receivedAt,
            this.config.maxAgeMs,
            this.streamHealthy(leg.venue, leg.marketId),
          ),
        );
        for (const state of states) this.telemetry.count(state);
        if (
          states.includes("HEALTHY_RESTING_BOOK_RESEARCH") &&
          states.every(
            (s) =>
              s === "STRICT_EXECUTION_FRESH" ||
              s === "HEALTHY_RESTING_BOOK_RESEARCH",
          )
        ) {
          // Sizing is independent of the freshness flag and already computed above.
          // Count rejected raw observations without running sizing a second time.
          const rejected = evaluations[m.id].filter(
            (e) =>
              m.active &&
              e.bestGross &&
              e.bestGross.grossProfit > 0 &&
              !e.reasons.some((r) =>
                [
                  "MARKET_CLOSED",
                  "UNSUPPORTED_QUANTITY",
                  "SIZING_WORK_LIMIT",
                ].includes(r),
              ),
          ).length;
          if (rejected)
            this.telemetry.count(
              "strictBookAgeOnlyRejectedEvaluations",
              rejected,
            );
        }
      }
    }
    this.enqueue("book", { book, evaluations });
    this.telemetry.count("bookUpdates");
    this.telemetry.sample("evaluation", performance.now() - started);
    const processingMs = performance.now() - book.receivedMono;
    this.telemetry.sample("processing", processingMs);
    this.telemetry.sample(
      book.valid ? "validBookProcessing" : "invalidBookProcessing",
      processingMs,
    );
  }
  tick(wall: number, mono: number, force = false) {
    this.enqueue("tick", { wall, mono, force });
  }
  diagnostic(kind: string, body: unknown) {
    this.enqueue("diagnostic", { kind, body, at: Date.now() });
  }
  report(sessionId?: string) {
    return this.send("report", { sessionId });
  }
  analyze(mono: number) {
    this.enqueue("analyze", { mono });
  }
  async stop(wall: number, mono: number) {
    if (this.closing) return;
    this.closing = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.send("stop", { wall, mono }),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Persistence shutdown timed out")),
            15000,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
      await this.worker.terminate();
    }
  }
  get backlog() {
    return this.pending.size;
  }
}

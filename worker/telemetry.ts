import { platform, arch, cpus } from "node:os";
import { monitorEventLoopDelay } from "node:perf_hooks";
export function percentiles(values: number[]) {
  const a = [...values].sort((x, y) => x - y);
  const p = (n: number) =>
    a.length ? a[Math.min(a.length - 1, Math.floor((a.length - 1) * n))] : null;
  return { count: a.length, p50: p(0.5), p95: p(0.95), p99: p(0.99) };
}
export class Telemetry {
  started: number;
  sampleOffsets: Record<string, number> = {};
  windowAt: number;
  windowCounts: Record<string, number> = {};
  now: () => number;
  counters: Record<string, number> = {};
  samples: Record<string, number[]> = {};
  loop = monitorEventLoopDelay({ resolution: 10 });
  cpu = process.cpuUsage();
  constructor(now = () => performance.now()) {
    this.now = now;
    this.started = this.windowAt = now();
    this.loop.enable();
  }
  count(key: string, n = 1) {
    this.counters[key] = (this.counters[key] ?? 0) + n;
  }
  sample(key: string, n: number) {
    if (!Number.isFinite(n)) return;
    const a = (this.samples[key] ??= []);
    if (a.length < 10000) a.push(n);
    else {
      const offset = this.sampleOffsets[key] ?? 0;
      a[offset] = n;
      this.sampleOffsets[key] = (offset + 1) % 10000;
    }
  }
  snapshot(advanceWindow = false) {
    const at = this.now();
    const seconds = Math.max(0, (at - this.started) / 1000);
    const windowSeconds = Math.max(0, (at - this.windowAt) / 1000);
    const intervalRates = Object.fromEntries(
      Object.entries(this.counters).map(([k, v]) => [
        k,
        windowSeconds ? (v - (this.windowCounts[k] ?? 0)) / windowSeconds : 0,
      ]),
    );
    const interval = {
      startMono: this.windowAt,
      endMono: at,
      durationMs: windowSeconds * 1000,
    };
    if (advanceWindow) {
      this.windowAt = at;
      this.windowCounts = { ...this.counters };
    }
    const cpu = process.cpuUsage(this.cpu);
    return {
      at: Date.now(),
      host: {
        platform: platform(),
        arch: arch(),
        cpu: cpus()[0]?.model,
        runtime: process.version,
      },
      clockUncertainty:
        "Unknown wall-clock offset; exchange-to-receive is not one-way latency; monotonic values are process-local",
      interval,
      intervalRates,
      uptimeMs: seconds * 1000,
      counters: { ...this.counters },
      rates: Object.fromEntries(
        Object.entries(this.counters).map(([k, v]) => [
          k,
          seconds ? v / seconds : 0,
        ]),
      ),
      latencyMs: Object.fromEntries(
        Object.entries(this.samples).map(([k, v]) => [k, percentiles(v)]),
      ),
      eventLoopMs: {
        p50: this.loop.percentile(50) / 1e6,
        p95: this.loop.percentile(95) / 1e6,
        p99: this.loop.percentile(99) / 1e6,
        max: this.loop.max / 1e6,
      },
      cpuPercent: seconds ? (cpu.user + cpu.system) / (seconds * 1e4) : 0,
      memory: process.memoryUsage(),
      sampleLimit: 10000,
    };
  }
  close() {
    this.loop.disable();
  }
}

import WebSocket from "ws";
import { createPrivateKey, sign, constants } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Venue } from "../lib/arb/types.ts";
export const endpoints = {
  kalshi: "wss://external-api-ws.kalshi.com/trade-api/ws/v2",
  poly: "wss://api.polymarket.us/v1/ws/markets",
};
export function authHeaders(
  venue: Venue,
  env: Record<string, string | undefined> = process.env,
  at = Date.now(),
): Record<string, string> {
  const timestamp = String(at);
  if (venue === "kalshi") {
    const key = env.KALSHI_KEY_ID,
      pem =
        env.KALSHI_PRIVATE_KEY ??
        (env.KALSHI_PRIVATE_KEY_PATH
          ? readFileSync(env.KALSHI_PRIVATE_KEY_PATH, "utf8")
          : null);
    if (!key || !pem)
      throw new Error("Kalshi read-stream credentials are missing");
    const signature = sign(
      "sha256",
      Buffer.from(`${timestamp}GET/trade-api/ws/v2`),
      { key: pem, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
    ).toString("base64");
    return {
      "KALSHI-ACCESS-KEY": key,
      "KALSHI-ACCESS-TIMESTAMP": timestamp,
      "KALSHI-ACCESS-SIGNATURE": signature,
    };
  }
  const key = env.POLYMARKET_KEY_ID,
    secret = env.POLYMARKET_SECRET_KEY;
  if (!key || !secret)
    throw new Error("Polymarket US read-stream credentials are missing");
  const raw = Buffer.from(secret, "base64");
  if (raw.length !== 32 && raw.length !== 64)
    throw new Error("Invalid PM-US secret key format");
  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      raw.subarray(0, 32),
    ]),
    format: "der",
    type: "pkcs8",
  });
  return {
    "X-PM-Access-Key": key,
    "X-PM-Timestamp": timestamp,
    "X-PM-Signature": sign(
      null,
      Buffer.from(`${timestamp}GET/v1/ws/markets`),
      privateKey,
    ).toString("base64"),
  };
}
export function subscriptions(
  venue: Venue,
  ids: string[],
): Record<string, any>[] {
  const messages: Record<string, any>[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const group = ids.slice(i, i + 100),
      id = i / 100 + 1;
    messages.push(
      venue === "kalshi"
        ? {
            id,
            cmd: "subscribe",
            params: { channels: ["orderbook_delta"], market_tickers: group },
          }
        : {
            subscribe: {
              requestId: `books-${id}`,
              subscriptionType: "SUBSCRIPTION_TYPE_MARKET_DATA",
              marketSlugs: group,
              responsesDebounced: false,
            },
          },
    );
  }
  return messages;
}
type Options = {
  venue: Venue;
  ids: string[];
  url?: string;
  headers: () => Record<string, string>;
  onMessage: (message: Record<string, any>, wall: number, mono: number) => void;
  onInvalid: (reason: string) => void;
  onDiagnostic: (kind: string, body: unknown) => void;
  retryMs?: number;
  heartbeatMs?: number;
  heartbeatTimeoutMs?: number;
};
export class StreamConnection {
  options: Options;
  socket: WebSocket | null = null;
  retry: ReturnType<typeof setTimeout> | null = null;
  heartbeat: ReturnType<typeof setInterval> | null = null;
  stopped = true;
  attempt = 0;
  lastPong = 0;
  connectedAt = 0;
  lastMessage = 0;
  pingAt = 0;
  rttMs: number | null = null;
  health() {
    return {
      venue: this.options.venue,
      markets: this.options.ids.length,
      connected: this.socket?.readyState === WebSocket.OPEN,
      heartbeatAgeMs: performance.now() - this.lastPong,
      lastMessageAgeMs: this.lastMessage
        ? performance.now() - this.lastMessage
        : null,
      rttMs: this.rttMs,
    };
  }
  constructor(options: Options) {
    this.options = options;
  }
  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }
  private connect() {
    if (this.stopped) return;
    try {
      const ws = new WebSocket(
        this.options.url ?? endpoints[this.options.venue],
        {
          headers: this.options.headers(),
          handshakeTimeout: 15000,
          maxPayload: 16 * 1024 * 1024,
        },
      );
      this.socket = ws;
      ws.on("open", () => {
        this.connectedAt = performance.now();
        this.lastPong = this.connectedAt;
        for (const m of subscriptions(this.options.venue, this.options.ids))
          ws.send(JSON.stringify(m));
        this.options.onDiagnostic("CONNECTED", {
          venue: this.options.venue,
          markets: this.options.ids.length,
        });
        this.heartbeat = setInterval(() => {
          if (
            performance.now() - this.lastPong >
            (this.options.heartbeatTimeoutMs ?? 15000)
          ) {
            this.recover("HEARTBEAT_TIMEOUT");
            return;
          }
          if (ws.readyState === WebSocket.OPEN) {
            this.pingAt = performance.now();
            ws.ping();
          }
        }, this.options.heartbeatMs ?? 5000);
      });
      ws.on("pong", () => {
        this.lastPong = performance.now();
        if (this.pingAt) this.rttMs = this.lastPong - this.pingAt;
      });
      ws.on("message", (bytes) => {
        const wall = Date.now(),
          mono = performance.now();
        this.lastMessage = mono;
        try {
          const message = JSON.parse(bytes.toString());
          if (message.type === "error" || message.error)
            throw new Error("Venue subscription rejected");
          this.options.onMessage(message, wall, mono);
        } catch (error) {
          const reason =
            error instanceof Error && /sequence/i.test(error.message)
              ? "SEQUENCE_RECOVERY"
              : "PARSER_RECOVERY";
          this.options.onDiagnostic(reason, { venue: this.options.venue });
          this.recover(reason);
        }
      });
      ws.on("error", () => {
        this.options.onDiagnostic("STREAM_ERROR", {
          venue: this.options.venue,
        });
      });
      ws.on("close", () => {
        if (this.stopped) return;
        if (this.heartbeat) clearInterval(this.heartbeat);
        this.heartbeat = null;
        this.options.onInvalid("DISCONNECTED");
        if (this.stopped) return;
        if (performance.now() - this.connectedAt > 30000) this.attempt = 0;
        const delay = Math.min(
          30000,
          (this.options.retryMs ?? 500) * 2 ** Math.min(this.attempt++, 6),
        );
        this.options.onDiagnostic("RECONNECT", {
          venue: this.options.venue,
          delayMs: delay,
        });
        this.retry = setTimeout(() => this.connect(), delay);
      });
    } catch {
      this.options.onInvalid("AUTH_CONFIGURATION");
      this.options.onDiagnostic("AUTH_CONFIGURATION", {
        venue: this.options.venue,
      });
      this.retry = setTimeout(() => this.connect(), 30000);
    }
  }
  recover(reason: string) {
    this.options.onInvalid(reason);
    this.socket?.terminate();
  }
  stop() {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.retry = null;
    this.heartbeat = null;
    this.socket?.terminate();
  }
}

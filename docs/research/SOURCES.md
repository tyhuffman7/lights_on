# Official interface references

Reviewed September 10, 2026. These sources inform adapter protocol and fee assumptions, not evidence of profitability.

- [Kalshi WebSocket quick start](https://docs.kalshi.com/getting_started/quick_start_websockets): production URL, authenticated GET handshake, RSA-PSS signing, ping/pong and reconnect guidance.
- [Kalshi order-book updates](https://docs.kalshi.com/websockets/orderbook-updates): fixed-point snapshots and additive deltas, subscription IDs/sequences, snapshot recovery. The worker resubscribes after a gap rather than combining an unsequenced REST snapshot with queued deltas.
- [Kalshi fees](https://kalshi.com/fee-schedule): supported fee schedules; research retains series-provided multiplier/type and rejects unknown schedules.
- [PM-US markets WebSocket](https://docs.polymarket.us/api-reference/websocket/markets): authenticated U.S. endpoint, full displayed-depth replacements, groups of at most 100 markets, debouncing disabled for research. Lite feeds are not executable depth.
- [PM-US authentication](https://docs.polymarket.us/api-reference/authentication): Ed25519 signing of timestamp, method and path, with locally held credentials.
- [PM-US fees](https://docs.polymarket.us/fees): symmetric taker formula and cent rounding, with cumulative collected-fee cap. Research records the rounded cumulative upper bound because L2 cannot reveal each underlying fill.

The institutional PM-US stream uses a separate interface and access arrangement. This implementation targets the documented U.S. retail WebSocket, not international Polymarket and not the institutional stream.

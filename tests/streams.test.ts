import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocketServer } from "ws";
import {
  StreamConnection,
  subscriptions,
  authHeaders,
} from "../worker/streams.ts";
import { generateKeyPairSync, verify, constants } from "node:crypto";

test("Subscription batches remove pair caps and PM disables debouncing", () => {
  const ids = Array.from({ length: 205 }, (_, i) => String(i));
  const p = subscriptions("poly", ids);
  assert.equal(p.length, 3);
  assert.equal(p[0].subscribe.responsesDebounced, false);
  assert.equal(p[2].subscribe.marketSlugs.length, 5);
  assert.equal(
    subscriptions("kalshi", ids)[0].params.channels[0],
    "orderbook_delta",
  );
});
test("Handshake signatures use GET-only paths and configured local keys", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const headers = authHeaders(
    "kalshi",
    {
      KALSHI_KEY_ID: "id",
      KALSHI_PRIVATE_KEY: privateKey
        .export({ format: "pem", type: "pkcs8" })
        .toString(),
    },
    1234,
  );
  assert.equal(
    verify(
      "sha256",
      Buffer.from("1234GET/trade-api/ws/v2"),
      {
        key: publicKey,
        padding: constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 32,
      },
      Buffer.from(headers["KALSHI-ACCESS-SIGNATURE"], "base64"),
    ),
    true,
  );
  assert.throws(() => authHeaders("poly", {}, 1234), /credentials/);
});
test("Live socket consumes frames, invalidates on disconnect and reconnects", async () => {
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await once(server, "listening");
  const address = server.address();
  let connections = 0,
    updates = 0,
    invalidations = 0;
  server.on("connection", (ws) => {
    connections++;
    ws.on("message", () => {
      ws.send(JSON.stringify({ marketData: { marketSlug: "x" } }));
      if (connections === 1) ws.close();
    });
  });
  const stream = new StreamConnection({
    venue: "poly",
    ids: ["x"],
    url: `ws://127.0.0.1:${address.port}`,
    headers: () => ({}),
    onMessage: () => {
      updates++;
    },
    onInvalid: () => {
      invalidations++;
    },
    onDiagnostic: () => {},
    retryMs: 10,
    heartbeatMs: 50,
    heartbeatTimeoutMs: 200,
  });
  stream.start();
  const deadline = Date.now() + 2500;
  while ((connections < 2 || updates < 2) && Date.now() < deadline)
    await new Promise((r) => setTimeout(r, 10));
  stream.stop();
  for (const client of server.clients) client.terminate();
  await new Promise((r) => server.close(r));
  assert.ok(connections >= 2);
  assert.ok(updates >= 2);
  assert.ok(invalidations >= 1);
});

test('Fair dispatch drains a 600-frame burst in order without freshening receipt evidence',async()=>{
 const server=new WebSocketServer({port:0,host:'127.0.0.1'});await once(server,'listening');const address=server.address();assert(address&&typeof address!=='string');
 const seen:{id:number;wall:number;mono:number;exchangeAt:number}[]=[],errors:string[]=[];
 server.on('connection',ws=>ws.once('message',()=>{for(let i=0;i<600;i++)ws.send(JSON.stringify({id:i,exchangeAt:123}));}));
 const stream=new StreamConnection({venue:'kalshi',ids:['x'],url:`ws://127.0.0.1:${address.port}`,headers:()=>({}),onMessage:(m,wall,mono)=>seen.push({id:m.id,wall,mono,exchangeAt:m.exchangeAt}),onInvalid:r=>errors.push(r),onDiagnostic:()=>{},retryMs:10000});
 try{stream.start();const deadline=Date.now()+3000;while(seen.length<600&&!errors.length&&Date.now()<deadline)await new Promise(r=>setTimeout(r,5));assert.deepEqual(errors,[]);assert.deepEqual(seen.map(x=>x.id),Array.from({length:600},(_,i)=>i));assert(seen.every(x=>x.exchangeAt===123));assert(new Set(seen.map(x=>x.mono)).size<600);assert((stream.ingress?.maximumDepth??600)<512);
 }finally{stream.stop();for(const c of server.clients)c.terminate();await new Promise<void>(r=>server.close(()=>r()));}
});

test('Slow consumer invalidates deferred socket bytes instead of assigning fresh callbacks',async()=>{
 const server=new WebSocketServer({port:0,host:'127.0.0.1'});await once(server,'listening');const address=server.address();assert(address&&typeof address!=='string');
 let consumed=0;const errors:string[]=[];server.on('connection',ws=>ws.once('message',()=>{for(let i=0;i<600;i++)ws.send(JSON.stringify({id:i}));}));
 const stream=new StreamConnection({venue:'kalshi',ids:['x'],url:`ws://127.0.0.1:${address.port}`,headers:()=>({}),onMessage:()=>{if(++consumed===1){const until=performance.now()+2100;while(performance.now()<until){}}},onInvalid:r=>errors.push(r),onDiagnostic:()=>{},retryMs:10000});
 try{stream.start();const deadline=Date.now()+5000;while(!errors.length&&Date.now()<deadline)await new Promise(r=>setTimeout(r,5));assert(errors.includes('TRANSPORT_BACKLOG_STALE'));assert.equal(consumed,1);
 }finally{stream.stop();for(const c of server.clients)c.terminate();await new Promise<void>(r=>server.close(()=>r()));}
});

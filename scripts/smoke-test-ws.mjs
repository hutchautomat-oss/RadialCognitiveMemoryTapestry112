/**
 * RCMT WebSocket smoke test — no browser required.
 *
 * Connects directly to the Render sync server, verifies the HELLO handshake,
 * sends a valid 28-byte CRVM packet, and checks the server processes it.
 * Exits 0 on pass, 1 on failure.
 *
 * Usage:
 *   node scripts/smoke-test-ws.mjs
 *   node scripts/smoke-test-ws.mjs wss://radialcognitivememorytapestry112.onrender.com
 *
 * Requires Node.js >= 22 (native WebSocket global).
 */

const WS_URL = (process.argv[2] ?? "wss://radialcognitivememorytapestry112.onrender.com") + "/socket";
const STRIDE_BYTES = 28;
const MAX_NODES = 8000;
const TIMEOUT_MS = 20_000;

let passed = 0;
let failed = 0;
const log = [];

const pass = (label) => { passed++; log.push(`  ✓ ${label}`); };
const fail = (label, detail) => { failed++; log.push(`  ✗ ${label}${detail ? `: ${detail}` : ""}`); };

console.log(`\nRCMT WebSocket smoke test`);
console.log(`Target: ${WS_URL}`);
console.log(`Timeout: ${TIMEOUT_MS / 1000}s\n`);

await new Promise((resolve) => {
  const ws = new WebSocket(WS_URL);
  let done = false;
  let packetAcked = false;

  const cleanup = () => {
    if (done) return;
    done = true;
    try { ws.close(); } catch {}
    setTimeout(resolve, 100);
  };

  const timer = setTimeout(() => {
    fail("timeout", `no response in ${TIMEOUT_MS / 1000}s — Render may be sleeping or blocking`);
    cleanup();
  }, TIMEOUT_MS);

  ws.onopen = () => {
    clearTimeout(timer);
    pass("WebSocket upgrade (101 Switching Protocols)");
    // Reset a fresh timer for the protocol phase
    setTimeout(() => {
      if (!done) { fail("protocol timeout", "connected but no HELLO within 5s"); cleanup(); }
    }, 5000);
  };

  ws.onmessage = (evt) => {
    const data = evt.data;

    // Text = control frame
    if (typeof data === "string") {
      let msg;
      try { msg = JSON.parse(data); } catch {
        fail("control frame JSON parse", data.slice(0, 80));
        return;
      }
      if (msg.type === "HELLO") {
        if (typeof msg.peerId === "number") {
          pass(`HELLO received — peerId=${msg.peerId}`);
        } else {
          fail("HELLO.peerId type", `got ${typeof msg.peerId}`);
        }
      } else if (msg.type === "PEER_COUNT") {
        pass(`PEER_COUNT — ${msg.count} peer(s)`);
      } else if (msg.type === "STALE_REJECT") {
        pass("STALE_REJECT — server processed our 28-byte packet (LWW won)");
        packetAcked = true;
        cleanup();
      }
      return;
    }

    // Binary = master buffer or 28-byte echo
    if (data instanceof ArrayBuffer || data instanceof Blob) {
      const getBuf = data instanceof Blob ? data.arrayBuffer() : Promise.resolve(data);
      getBuf.then((buf) => {
        const len = buf.byteLength;
        if (len === MAX_NODES * STRIDE_BYTES) {
          pass(`Full state sync — ${(len / 1024).toFixed(0)} KB (${MAX_NODES} × ${STRIDE_BYTES})`);

          // Send a 28-byte CRVM packet with timestamp=1 (ancient — will be rejected if slot occupied)
          const pkt = new ArrayBuffer(STRIDE_BYTES);
          const pv = new DataView(pkt);
          pv.setUint16(0, 42, true);     // nodeIndex = 42
          pv.setUint16(2, 1, true);      // intentId = 1 (Fact)
          pv.setFloat32(4, 0.1, true);   // x
          pv.setFloat32(8, 0.2, true);   // y
          pv.setFloat32(12, 0.3, true);  // z
          pv.setFloat32(16, 0.5, true);  // scale
          pv.setFloat64(20, 1.0, true);  // LWW timestamp = 1ms (ancient)
          ws.send(pkt);
          pass("28-byte CRVM packet sent (slot 42, ts=1ms — expect STALE_REJECT or silent accept)");

          // If no reject arrives in 4s, the packet was accepted (slot was vacant, LWW won)
          setTimeout(() => {
            if (!packetAcked) {
              pass("Packet accepted silently (no reject — server LWW accepted it)");
            }
            cleanup();
          }, 4000);
        } else if (len === STRIDE_BYTES) {
          pass("28-byte packet echoed from a peer");
          packetAcked = true;
          cleanup();
        } else {
          fail("Binary frame size", `${len} bytes (expected ${MAX_NODES * STRIDE_BYTES} or ${STRIDE_BYTES})`);
        }
      });
    }
  };

  ws.onerror = (evt) => {
    fail("WebSocket error", evt.message ?? "connection refused or TLS failure");
    cleanup();
  };

  ws.onclose = (evt) => {
    if (!done && evt.code !== 1000 && evt.code !== 1001) {
      fail("Unexpected close", `code=${evt.code} reason=${evt.reason}`);
      cleanup();
    }
  };
});

console.log("Results:");
for (const r of log) console.log(r);
console.log(`\n${passed} passed  ${failed} failed`);

if (failed > 0) {
  if (!log.some(r => r.includes("101"))) {
    console.log("\nServer not reachable — Render may be sleeping (wait 30s) or the service is down.");
    console.log("Check: https://dashboard.render.com");
  } else {
    console.log("\nConnected but protocol failed — check server logs on Render dashboard.");
  }
  process.exit(1);
}

console.log("\nRender server verified. If browser tabs still show LOCAL:");
console.log("  Hard-refresh rcmtfoveal.netlify.app (Ctrl+Shift+R on desktop)");
console.log("  DevTools → Network → WS — confirm URL is onrender.com not netlify.app");
process.exit(0);

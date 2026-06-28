// Tiny public flow-meter for the LIVE Marlin Oyster enclave demo.
//
// The Oyster enclave runs in the cloud and fetches SENSOR_URL (our mod.rs does
// `reqwest::get(SENSOR_URL)` and reads `json["liters"]`). It needs a *public* URL, so we expose
// this via a cloudflared quick-tunnel. Returns { "liters": N } with HTTP 200 on ANY GET path
// (so the enclave's /health_check connectivity probe to the tunnel root also shows green).
// Control the reading for the demo: `POST /set { "liters": <n> }`.
import http from 'node:http';

let liters = Number(process.env.SENSOR_LITERS ?? 100000);
const PORT = Number(process.env.PORT ?? 8799);

const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('access-control-allow-origin', '*');
  if (req.method === 'POST' && req.url.startsWith('/set')) {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const j = JSON.parse(body || '{}');
        if (j.liters != null && !Number.isNaN(Number(j.liters))) liters = Number(j.liters);
      } catch {}
      console.error(`[oyster-sensor] liters set to ${liters}`);
      res.end(JSON.stringify({ liters }));
    });
    return;
  }
  res.end(JSON.stringify({ liters }));
});

server.listen(PORT, () => console.error(`[oyster-sensor] listening :${PORT} (liters=${liters})`));

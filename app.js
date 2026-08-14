const SHEET_ID = "1N_ugyAVVy6C2BpSJoxpIRBkcCGt_xG64hvHy7LYiNrw";
const ENDPOINT = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
const canvas = document.querySelector("#phoenix-canvas");
const context = canvas.getContext("2d");
const image = new Image();
let reveal = null;
let targetCount = 360;

function parsePayload(payload) {
  const match = payload.match(/setResponse\((.*)\);?\s*$/s);
  if (!match) throw new Error("Unexpected Google Sheet response");
  return JSON.parse(match[1]).table.rows.map((row) => ({ region: Number(row.c?.[0]?.v ?? 0), rsvps: Number(row.c?.[1]?.v ?? 0), target: Number(row.c?.[2]?.v ?? 0), percent: Number(row.c?.[3]?.v ?? 0) })).filter((row) => row.region >= 1 && row.region <= 9);
}

function render(rows) {
  const total = rows.reduce((sum, row) => sum + row.rsvps, 0);
  const target = rows.reduce((sum, row) => sum + row.target, 0);
  targetCount = Math.max(1, target);
  reveal = target ? Math.min(1, total / target) : 0;
  document.querySelector("#region-list").innerHTML = rows.map((row) => `<li class="region-row"><b>Region ${row.region}</b><strong>${Math.round(row.percent * 100)}%</strong><div class="bar"><i style="width:${Math.min(100, row.percent * 100)}%"></i></div></li>`).join("");
  document.querySelector("#rsvp-total").textContent = total.toLocaleString();
  document.querySelector("#rsvp-target").textContent = target.toLocaleString();
  document.querySelector("#overall-progress").textContent = `${(reveal * 100).toFixed(1)}%`;
  document.querySelector("#progress-ring").style.setProperty("--progress", `${reveal * 100}%`);
  document.querySelector("#progress-fill").style.width = `${reveal * 100}%`;
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(now).replaceAll('/', '-');
  const time = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(now);
  document.querySelector("#updated-time").textContent = `as of ${date}, ${time}`;
  document.querySelector("#loading-message").hidden = true;
  draw();
}

function draw() {
  if (!image.complete || reveal === null) return;
  const box = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(box.width * ratio); canvas.height = Math.round(box.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, box.width, box.height);
  const scale = Math.min(box.width / image.width, box.height / image.height);
  const width = image.width * scale, height = image.height * scale, x = (box.width - width) / 2, y = (box.height - height) / 2;
  context.globalAlpha = .32; context.filter = "grayscale(1) brightness(.85)"; context.drawImage(image, x, y, width, height); context.globalAlpha = 1; context.filter = "none";
  const columns = 20, rows = Math.ceil(targetCount / columns), lit = Math.round(targetCount * reveal), tileW = width / columns, tileH = height / rows;
  for (let n = 0; n < lit; n++) { const row = rows - 1 - Math.floor(n / columns), col = n % columns; context.save(); context.beginPath(); context.roundRect(x + col * tileW + .6, y + row * tileH + .6, tileW - 1.2, tileH - 1.2, 1.4); context.clip(); context.drawImage(image, x, y, width, height); context.restore(); }
}

async function refresh() { const response = await fetch(ENDPOINT, { cache: "no-store" }); if (!response.ok) throw new Error("RSVP feed unavailable"); render(parsePayload(await response.text())); }
image.src = "phoenix-cleaned.png"; image.onload = draw; window.addEventListener("resize", draw); refresh().catch(() => { document.querySelector("#loading-message").textContent = "Live RSVP progress is temporarily unavailable."; }); window.setInterval(() => refresh().catch(() => {}), 60_000);

const SHEET_ID = "1N_ugyAVVy6C2BpSJoxpIRBkcCGt_xG64hvHy7LYiNrw";
const ENDPOINT = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
const canvas = document.querySelector("#phoenix-canvas");
const context = canvas.getContext("2d");
const image = new Image();
let latest = null;

function parsePayload(payload) {
  const match = payload.match(/setResponse\((.*)\);?\s*$/s);
  if (!match) throw new Error("Unexpected Google Sheet response");
  return JSON.parse(match[1]).table.rows.map((row) => ({
    region: Number(row.c?.[0]?.v ?? 0),
    rsvps: Number(row.c?.[1]?.v ?? 0),
    target: Number(row.c?.[2]?.v ?? 0),
    percent: Number(row.c?.[3]?.v ?? 0),
  })).filter((row) => row.region >= 1 && row.region <= 9);
}

function render(data) {
  const total = data.reduce((sum, row) => sum + row.rsvps, 0);
  const target = data.reduce((sum, row) => sum + row.target, 0);
  const progress = target ? Math.min(1, total / target) : 0;
  document.querySelector("#region-list").innerHTML = data.map((row) => `<li class="region"><span>REGION ${row.region}</span><strong>${Math.round(row.percent * 100)}%</strong></li>`).join("");
  document.querySelector("#rsvp-total").textContent = total.toLocaleString();
  document.querySelector("#rsvp-target").textContent = target.toLocaleString();
  document.querySelector("#overall-progress").textContent = `${Math.round(progress * 100)}%`;
  document.querySelector("#loading-message").hidden = true;
  latest = progress;
  draw();
}

function draw() {
  if (!image.complete || latest === null) return;
  const bounds = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * ratio); canvas.height = Math.round(bounds.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const scale = Math.min(bounds.width / image.width, bounds.height / image.height);
  const width = image.width * scale, height = image.height * scale;
  const x = (bounds.width - width) / 2, y = (bounds.height - height) / 2;
  context.filter = "grayscale(1) brightness(.36) contrast(1.08)";
  context.drawImage(image, x, y, width, height);
  context.filter = "none";
  const columns = 16, rows = 23, totalTiles = columns * rows;
  const litTiles = Math.round(totalTiles * latest);
  const tileW = width / columns, tileH = height / rows;
  for (let i = 0; i < litTiles; i++) {
    const row = rows - 1 - Math.floor(i / columns);
    const col = i % columns;
    context.save(); context.beginPath(); context.rect(x + col * tileW, y + row * tileH, tileW + .5, tileH + .5); context.clip();
    context.drawImage(image, x, y, width, height); context.restore();
  }
}

async function refresh() {
  const response = await fetch(ENDPOINT, { cache: "no-store" });
  if (!response.ok) throw new Error("RSVP feed unavailable");
  render(parsePayload(await response.text()));
}

image.src = "phoenix-cleaned.png";
image.onload = draw;
window.addEventListener("resize", draw);
refresh().catch(() => { document.querySelector("#loading-message").textContent = "Live RSVP progress is temporarily unavailable."; });
window.setInterval(() => refresh().catch(() => {}), 60_000);

const SHEET_ID = "1N_ugyAVVy6C2BpSJoxpIRBkcCGt_xG64hvHy7LYiNrw";
const ENDPOINT = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
const canvas = document.querySelector("#phoenix-canvas");
const context = canvas.getContext("2d");
const headerCanvas = document.querySelector("#header-phoenix");
const headerContext = headerCanvas.getContext("2d");
const image = new Image();
let reveal = null;
let targetCount = 360;
const tileCache = new Map();

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
  const tiles = getPhoenixTiles(targetCount);
  const lit = Math.min(tiles.length, Math.round(targetCount * reveal));
  tiles.forEach((tile, index) => {
    const tileX = x + tile.x * scale, tileY = y + tile.y * scale, tileW = tile.w * scale, tileH = tile.h * scale;
    context.save(); context.beginPath(); context.roundRect(tileX + .4, tileY + .4, tileW - .8, tileH - .8, 1); context.clip();
    if (index >= lit) { context.globalAlpha = .34; context.filter = "grayscale(1) brightness(.9)"; }
    context.drawImage(image, x, y, width, height); context.restore();
    context.strokeStyle = index < lit ? "rgba(10, 6, 30, .48)" : "rgba(205, 192, 255, .18)";
    context.lineWidth = .75; context.strokeRect(tileX + .4, tileY + .4, tileW - .8, tileH - .8);
  });
}

function drawHeaderPhoenix() {
  if (!image.complete) return;
  const box = headerCanvas.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const ratio = window.devicePixelRatio || 1;
  headerCanvas.width = Math.round(box.width * ratio); headerCanvas.height = Math.round(box.height * ratio);
  headerContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  headerContext.clearRect(0, 0, box.width, box.height);
  // A denser source keeps the moving pixel-art phoenix crisp on high-resolution displays.
  const pixelsWide = 120, pixelsHigh = Math.round(pixelsWide * image.height / image.width);
  const source = document.createElement("canvas"); source.width = pixelsWide; source.height = pixelsHigh;
  const sourceContext = source.getContext("2d"); sourceContext.imageSmoothingEnabled = false;
  sourceContext.drawImage(image, 0, 0, pixelsWide, pixelsHigh);
  headerContext.imageSmoothingEnabled = false;
  const scale = Math.min(box.width / pixelsWide, box.height / pixelsHigh);
  const width = pixelsWide * scale, height = pixelsHigh * scale;
  headerContext.drawImage(source, (box.width - width) / 2, (box.height - height) / 2, width, height);
}

function getPhoenixTiles(count) {
  const requested = Math.max(1, Math.round(count));
  if (tileCache.has(requested)) return tileCache.get(requested);
  const mask = document.createElement("canvas"); mask.width = image.width; mask.height = image.height;
  const maskContext = mask.getContext("2d", { willReadFrequently: true }); maskContext.drawImage(image, 0, 0);
  const pixels = maskContext.getImageData(0, 0, image.width, image.height).data;
  const alphaAt = (pointX, pointY) => pixels[(Math.min(image.height - 1, Math.max(0, Math.floor(pointY))) * image.width + Math.min(image.width - 1, Math.max(0, Math.floor(pointX)))) * 4 + 3];
  const candidatesFor = (columns) => {
    const rows = Math.round(columns * image.height / image.width), cellW = image.width / columns, cellH = image.height / rows, candidates = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const left = col * cellW, top = row * cellH;
      const samples = [alphaAt(left + cellW * .5, top + cellH * .5), alphaAt(left + cellW * .2, top + cellH * .2), alphaAt(left + cellW * .8, top + cellH * .2), alphaAt(left + cellW * .2, top + cellH * .8), alphaAt(left + cellW * .8, top + cellH * .8)];
      const coverage = samples.filter((alpha) => alpha > 24).length;
      if (coverage >= 2) candidates.push({ x: left, y: top, w: cellW, h: cellH, coverage, rank: ((col * 73856093) ^ (row * 19349663)) >>> 0 });
    }
    return candidates;
  };
  let candidates = [];
  for (let columns = 12; columns <= 90; columns++) { const attempt = candidatesFor(columns); if (attempt.length >= requested) { candidates = attempt; break; } }
  const tiles = candidates.sort((a, b) => b.coverage - a.coverage || a.rank - b.rank).slice(0, requested).sort((a, b) => b.y - a.y || a.x - b.x);
  tileCache.set(requested, tiles); return tiles;
}

async function refresh() { const response = await fetch(ENDPOINT, { cache: "no-store" }); if (!response.ok) throw new Error("RSVP feed unavailable"); render(parsePayload(await response.text())); }
image.src = "phoenix-cleaned.png"; image.onload = () => { draw(); drawHeaderPhoenix(); }; window.addEventListener("resize", () => { draw(); drawHeaderPhoenix(); }); refresh().catch(() => { document.querySelector("#loading-message").textContent = "Live RSVP progress is temporarily unavailable."; }); window.setInterval(() => refresh().catch(() => {}), 60_000);

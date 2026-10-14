// Artwork for the deck in the "fall class" scrapbook style: paint-blob title labels, cut-out
// stickers, a star bullet and the cover collage. Everything is drawn here from shapes, the
// StableSave screenshots and open-source icons (Phosphor via react-icons); nothing is traced
// from other decks.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const opentype = require("opentype.js");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const Pi = require("react-icons/pi");

const ROOT = path.join(__dirname, "..");
const FONTS = path.join(ROOT, "assets", "fonts");
const anton = opentype.loadSync(path.join(FONTS, "Anton-Regular.ttf"));

const COLORS = {
  bg: "#1C1C1C",
  green: "#3DDC97",
  greenDeep: "#17704A",
  yellow: "#F2C14E",
  orange: "#EE8A43",
  purple: "#A47CF3",
  pink: "#F49AC1",
  white: "#F2F2F2",
};

/** Small deterministic random generator, so every build draws the same shapes. */
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const f1 = (n) => n.toFixed(1);

/** Smooth closed path through points (Catmull-Rom as cubic Béziers). */
function closedPath(pts) {
  const n = pts.length;
  let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f1(c1[0])},${f1(c1[1])} ${f1(c2[0])},${f1(c2[1])} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return `${d}Z`;
}

/**
 * A wobbly paint-splash outline: a rounded rectangle whose edge is pushed in and out by a few
 * low-frequency waves (so it reads as one blob, not a jagged star) plus one or two bulges.
 */
function splashPoints(cx, cy, rx, ry, rand, { n = 40, wobble = 0.13, bulges = 2 } = {}) {
  const waves = [2, 3, 5, 7].map((f, i) => ({ f, a: (wobble / (i + 1)) * (0.6 + rand() * 0.8), p: rand() * Math.PI * 2 }));
  const bumps = Array.from({ length: bulges }, () => ({ at: rand() * Math.PI * 2, h: 0.12 + rand() * 0.14, w: 0.22 + rand() * 0.15 }));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let k = 1;
    for (const w of waves) k += w.a * Math.sin(w.f * t + w.p);
    for (const b of bumps) {
      const d = Math.atan2(Math.sin(t - b.at), Math.cos(t - b.at));
      k += b.h * Math.exp(-(d * d) / (2 * b.w * b.w));
    }
    const c = Math.cos(t);
    const s = Math.sin(t);
    // Squarish ends (exponent < 1) so the blob holds a line of text across its width.
    const x = cx + rx * k * Math.sign(c) * Math.pow(Math.abs(c), 0.58);
    const y = cy + ry * k * Math.sign(s) * Math.pow(Math.abs(s), 0.85);
    pts.push([x, y]);
  }
  return pts;
}

/** SVG for a paint blob filling a w×h box (px), with a misregistered dark outline. */
function blobSvg(w, h, seed, { pad = 0.08, outline = true, fill = COLORS.green, line = COLORS.greenDeep } = {}) {
  const rand = rng(seed);
  const px = w * pad;
  const py = h * pad * 1.4;
  const cx = w / 2 - w * 0.02;
  const cy = h / 2 - h * 0.03;
  const rx = w / 2 - px * 1.5;
  const ry = h / 2 - py * 1.6;
  const main = closedPath(splashPoints(cx, cy, rx, ry, rand));
  const ring = closedPath(splashPoints(cx + w * 0.03, cy + h * 0.1, rx * 1.01, ry * 0.98, rand, { wobble: 0.12, bulges: 1 }));
  const stroke = Math.max(2.5, h * 0.025);
  return `<path d="${main}" fill="${fill}"/>${outline ? `<path d="${ring}" fill="none" stroke="${line}" stroke-width="${f1(stroke)}" stroke-linejoin="round"/>` : ""}`;
}

/** PNG data URI of a title blob, sized in inches. */
async function blob(wIn, hIn, seed, opts) {
  const scale = 150;
  const w = Math.round(wIn * scale);
  const h = Math.round(hIn * scale);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${blobSvg(w, h, seed, opts)}</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

/**
 * A title blob whose green fill covers a line of text `textW` inches wide, plus `margin` on each
 * side, across the middle band where the letters sit. Returns the image and the fill's inner
 * left/right edges (inches from the image's left edge) so the caller can line it up with the text.
 */
async function titleBlob(textW, hIn, seed, { margin = 0.3, marginLeft = margin, marginRight = margin } = {}) {
  const scale = 150;
  const render = (wIn) =>
    sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(wIn * scale)}" height="${Math.round(hIn * scale)}">${blobSvg(wIn * scale, hIn * scale, seed)}</svg>`)).png();
  // The shape scales linearly in x with the width, so measure once and scale.
  const probeW = textW * 1.4 + 1.2;
  const { data, info } = await render(probeW).raw().toBuffer({ resolveWithObject: true });
  let left = 0;
  let right = info.width;
  for (let y = Math.round(info.height * 0.35); y <= Math.round(info.height * 0.65); y++) {
    let first = -1;
    let last = -1;
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (data[i + 3] > 200 && data[i + 1] > 180) {
        if (first < 0) first = x;
        last = x;
      }
    }
    if (first >= 0) {
      left = Math.max(left, first);
      right = Math.min(right, last);
    }
  }
  const k = (textW + marginLeft + marginRight) / ((right - left) / scale);
  const w = probeW * k;
  const png = await render(w).toBuffer();
  return { data: "image/png;base64," + png.toString("base64"), w, h: hIn, left: (left / scale) * k, right: (right / scale) * k };
}

/** Width in inches of `text` set in Anton at `pt` points. */
function antonWidth(text, pt) {
  return anton.getAdvanceWidth(text, pt) / 72;
}

/** Anton text as an SVG path (for text baked into images). */
function antonPath(text, x, baseline, size, fill) {
  return `<path d="${anton.getPath(text, x, baseline, size).toPathData(1)}" fill="${fill}"/>`;
}

function iconSvg(Component, color, size, x, y) {
  const inner = ReactDOMServer.renderToStaticMarkup(React.createElement(Component, { size, color }));
  return inner.replace("<svg", `<svg x="${x}" y="${y}"`);
}

const STICKER_ART = {
  coin: () => {
    const g = anton.getPath("$", 0, 0, 230);
    const bb = g.getBoundingBox();
    const dx = 256 - (bb.x1 + bb.x2) / 2;
    const dy = 256 - (bb.y1 + bb.y2) / 2;
    return `<circle cx="256" cy="256" r="176" fill="#E9AE2C"/><circle cx="256" cy="248" r="168" fill="${COLORS.yellow}"/>
      <circle cx="256" cy="248" r="136" fill="none" stroke="#D29A1E" stroke-width="10"/>
      ${antonPath("$", dx, dy - 8, 230, "#B97F12")}
      <path d="M150 170 A 130 130 0 0 1 230 120" fill="none" stroke="#FFF6D6" stroke-width="14" stroke-linecap="round" opacity="0.8"/>`;
  },
  piggy: () => iconSvg(Pi.PiPiggyBankFill, COLORS.pink, 400, 56, 56),
  sprout: () => iconSvg(Pi.PiPlantFill, COLORS.green, 400, 56, 56),
  shield: () => iconSvg(Pi.PiShieldCheckFill, COLORS.purple, 400, 56, 56),
  vault: () => iconSvg(Pi.PiVaultFill, COLORS.orange, 380, 66, 66),
  sparkle: () => iconSvg(Pi.PiSparkleFill, COLORS.yellow, 400, 56, 56),
  bolt: () => iconSvg(Pi.PiLightningFill, COLORS.yellow, 400, 56, 56),
  chart: () => iconSvg(Pi.PiChartLineUpFill, COLORS.green, 380, 66, 66),
};

/** A die-cut sticker: the art on a white border with a soft shadow, optionally rotated. */
async function stickerPng(name, { rotate = 0, border = 34 } = {}) {
  const size = 512;
  const art = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${STICKER_ART[name]()}</svg>`)).png().toBuffer();
  const alpha = await sharp(art).extractChannel(3).toBuffer();
  const mask = await sharp(alpha).blur(border / 2).threshold(4).blur(1.2).toBuffer();
  const white = await sharp({ create: { width: size, height: size, channels: 3, background: "#ffffff" } }).joinChannel(mask).png().toBuffer();
  const shadowMask = await sharp(mask).blur(9).linear(0.5, 0).toBuffer();
  const shadow = await sharp({ create: { width: size, height: size, channels: 3, background: "#000000" } }).joinChannel(shadowMask).png().toBuffer();
  const layered = await sharp({ create: { width: size + 24, height: size + 24, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: shadow, left: 16, top: 20 },
      { input: white, left: 6, top: 6 },
      { input: art, left: 6, top: 6 },
    ])
    .png()
    .toBuffer();
  return rotate ? sharp(layered).rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer() : layered;
}

/** Eight-point star used as the bullet, like a hand-stamped asterisk. */
async function starPng(color = COLORS.orange) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? 120 : 52;
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2 + 0.2;
    pts.push(`${f1(128 + r * Math.cos(a))},${f1(128 + r * Math.sin(a))}`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><polygon points="${pts.join(" ")}" fill="${color}" stroke="${color}" stroke-width="14" stroke-linejoin="round"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** A screenshot as a cut-out: white border, drop shadow, slight rotation. */
async function cutout(file, widthPx, rotate, { border = 12, crop } = {}) {
  let img = sharp(file);
  if (crop) img = img.extract(crop);
  const body = await img.resize({ width: widthPx }).png().toBuffer();
  const framed = await sharp(body).extend({ top: border, bottom: border, left: border, right: border, background: "#ffffff" }).png().toBuffer();
  const { width, height } = await sharp(framed).metadata();
  const shadow = await sharp({ create: { width: width + 60, height: height + 60, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.55 } } }).png().toBuffer(), left: 34, top: 38 }])
    .blur(10)
    .png()
    .toBuffer();
  const layered = await sharp(shadow).composite([{ input: framed, left: 20, top: 20 }]).png().toBuffer();
  return sharp(layered).rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

/** Code fragments scattered behind the collage, in IBM Plex Mono outlines. */
function codeSvg(lines, x, y, size, color, rotate = 0) {
  const mono = opentype.loadSync(path.join(FONTS, "IBMPlexMono-Regular.ttf"));
  const paths = lines.map((line, i) => `<path d="${mono.getPath(line, x, y + i * size * 1.45, size).toPathData(1)}" fill="${color}"/>`).join("");
  return rotate ? `<g transform="rotate(${rotate} ${x} ${y})">${paths}</g>` : paths;
}

/** Cover collage for the right half of the title slide (px at 200 per inch). */
async function coverCollage({ widthIn, heightIn, screens, lockup }) {
  const W = Math.round(widthIn * 200);
  const H = Math.round(heightIn * 200);
  const layers = [];
  const place = (input, left, top) => layers.push({ input, left: Math.round(left), top: Math.round(top) });
  const sticker = async (name, rotate, width) => sharp(await stickerPng(name, { rotate })).resize({ width }).png().toBuffer();
  const clear = { r: 0, g: 0, b: 0, alpha: 0 };

  // Code fragments and doodles at the back.
  const back = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${codeSvg(['seeds = ["vault", mint,', '         risk_profile]', 'LIQUIDITY_BUFFER_BPS = 2_000'], W - 540, 70, 24, "#707070")}
    ${codeSvg(['rebalance(vault, pool)', '  // only toward the strategy', 'instant_limit: 2_000 / 24h'], 36, H - 190, 24, "#626262")}
    <path d="M 470 430 C 520 470, 540 540, 600 590" fill="none" stroke="#F2F2F2" stroke-width="6" stroke-linecap="round"/>
    <path d="M 600 590 l -30 -4 M 600 590 l -6 -30" fill="none" stroke="#F2F2F2" stroke-width="6" stroke-linecap="round"/>
    <path d="M ${W - 330} 600 q 30 -40 70 -10 t 70 -6 t 70 -4" fill="none" stroke="${COLORS.green}" stroke-width="6" stroke-linecap="round"/>
    <g stroke="${COLORS.yellow}" stroke-width="6" stroke-linecap="round">
      <line x1="760" y1="110" x2="745" y2="70"/>
      <line x1="790" y1="120" x2="805" y2="80"/>
      <line x1="805" y1="150" x2="845" y2="138"/>
    </g>
  </svg>`;
  place(Buffer.from(back), 0, 0);

  // Screenshot cut-outs.
  place(await cutout(screens.home, 370, -7), -16, 30);
  place(await cutout(screens.pools, 600, 4, { crop: { left: 0, top: 0, width: 1696, height: 640 } }), W - 600, 250);
  place(await cutout(screens.share, 560, -4), W * 0.34, H - 430);

  // The big label, with the logo above it.
  const bw = W * 0.9;
  const bh = 380;
  const textSize = 180;
  const label = "DEMO DAY";
  const tw = anton.getAdvanceWidth(label, textSize);
  const blobLayer = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(bw)}" height="${bh}">${blobSvg(bw, bh, 7, { pad: 0.05 })}
    ${antonPath(label, (bw - tw) / 2 - 12, bh / 2 + textSize * 0.36 - 8, textSize, "#FFFFFF")}</svg>`;
  place(await sharp(Buffer.from(blobLayer)).rotate(-3, { background: clear }).png().toBuffer(), W * 0.04, 690);
  const logo = await sharp(lockup).resize({ height: 52 }).png().toBuffer();
  const logoMeta = await sharp(logo).metadata();
  place(logo, (W - logoMeta.width) / 2 + 40, 626);

  // Stickers on top.
  place(await sticker("sprout", 10, 190), 540, 40);
  place(await sticker("sparkle", 0, 110), 400, 330);
  place(await sticker("shield", 8, 180), W - 250, 1010);
  place(await sticker("coin", -12, 230), 60, 1060);
  place(await sticker("piggy", -8, 220), W - 250, H - 280);

  return sharp({ create: { width: W, height: H, channels: 4, background: clear } }).composite(layers).png().toBuffer();
}

module.exports = { COLORS, blob, titleBlob, antonWidth, stickerPng, starPng, coverCollage, STICKER_ART };

if (require.main === module) {
  // Preview sheet: node art.js <out-dir>
  (async () => {
    const out = process.argv[2] || ".";
    fs.mkdirSync(out, { recursive: true });
    const b = Buffer.from((await blob(6.5, 1.1, 3)).split(",")[1], "base64");
    fs.writeFileSync(path.join(out, "blob.png"), b);
    for (const name of Object.keys(STICKER_ART)) fs.writeFileSync(path.join(out, `sticker-${name}.png`), await stickerPng(name, { rotate: 8 }));
    fs.writeFileSync(path.join(out, "star.png"), await starPng());
    const S = (f) => path.join(ROOT, "assets", "screens", f);
    fs.writeFileSync(
      path.join(out, "collage.png"),
      await coverCollage({
        widthIn: 6.9,
        heightIn: 7.5,
        screens: { home: S("01-home-hero.png"), pools: S("12-vault-pools.png"), share: S("11-share-card.png") },
        lockup: path.join(ROOT, "assets", "graphics", "logo-lockup.png"),
      }),
    );
    console.log("wrote previews to", out);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

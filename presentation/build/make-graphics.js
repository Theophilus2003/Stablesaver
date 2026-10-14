// Original graphics for the deck: logo mark, cover art, section glow. Rendered from SVG with sharp.
const sharp = require("sharp");
const path = require("path");
const out = (f) => path.join(__dirname, "..", "assets", "graphics", f);

const mark = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
  <defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#9945FF"/><stop offset="1" stop-color="#14F195"/></linearGradient></defs>
  <rect x="3" y="14.5" width="18" height="6" rx="3" fill="url(#g)" opacity="0.38"/>
  <rect x="5" y="9" width="14" height="6" rx="3" fill="url(#g)" opacity="0.68"/>
  <rect x="7" y="3.5" width="10" height="6" rx="3" fill="url(#g)"/>
</svg>`;

// Cover: deep navy, two soft glows, a few rising "yield" curves and protocol nodes on the right.
function cover(w, h) {
  const curves = [];
  for (let i = 0; i < 7; i++) {
    const y0 = h * (0.86 - i * 0.045);
    const lift = 120 + i * 38;
    curves.push(`<path d="M ${w * 0.38} ${y0} C ${w * 0.58} ${y0}, ${w * 0.66} ${y0 - lift * 0.4}, ${w * 0.78} ${y0 - lift * 0.75} S ${w * 0.95} ${y0 - lift * 1.35}, ${w * 1.02} ${y0 - lift * 1.5}"
      fill="none" stroke="url(#line)" stroke-width="${i === 3 ? 3 : 1.4}" opacity="${i === 3 ? 0.95 : 0.28 + i * 0.04}"/>`);
  }
  const nodes = [[0.70, 0.30], [0.80, 0.18], [0.90, 0.34], [0.83, 0.46], [0.95, 0.12]]
    .map(([x, y], i) => `<circle cx="${w * x}" cy="${h * y}" r="${i === 1 ? 7 : 5}" fill="${i % 2 ? "#14F195" : "#9945FF"}" opacity="0.85"/>`).join("");
  const links = [[0.70, 0.30, 0.80, 0.18], [0.80, 0.18, 0.90, 0.34], [0.90, 0.34, 0.83, 0.46], [0.83, 0.46, 0.70, 0.30], [0.80, 0.18, 0.95, 0.12]]
    .map(([a, b, c, d]) => `<line x1="${w * a}" y1="${h * b}" x2="${w * c}" y2="${h * d}" stroke="#9AA7BD" stroke-opacity="0.22" stroke-width="1.2"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="p" cx="0.12" cy="0.1" r="0.7"><stop offset="0" stop-color="#9945FF" stop-opacity="0.38"/><stop offset="1" stop-color="#9945FF" stop-opacity="0"/></radialGradient>
    <radialGradient id="q" cx="0.92" cy="0.95" r="0.65"><stop offset="0" stop-color="#14F195" stop-opacity="0.22"/><stop offset="1" stop-color="#14F195" stop-opacity="0"/></radialGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9945FF" stop-opacity="0"/><stop offset="0.45" stop-color="#9945FF"/><stop offset="1" stop-color="#14F195"/></linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="#0B1020"/>
  <rect width="${w}" height="${h}" fill="url(#p)"/>
  <rect width="${w}" height="${h}" fill="url(#q)"/>
  ${curves.join("")}${links}${nodes}
</svg>`;
}

// Quiet background for content slides: navy with one faint purple glow top-right.
function plain(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><radialGradient id="p" cx="0.95" cy="0" r="0.55"><stop offset="0" stop-color="#9945FF" stop-opacity="0.16"/><stop offset="1" stop-color="#9945FF" stop-opacity="0"/></radialGradient></defs>
  <rect width="${w}" height="${h}" fill="#0B1020"/><rect width="${w}" height="${h}" fill="url(#p)"/></svg>`;
}

// Purple-to-green gradient strip, used inside the metric highlight on the closing slide.
function gradient(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9945FF"/><stop offset="1" stop-color="#14F195"/></linearGradient></defs><rect width="${w}" height="${h}" rx="${h / 2}" fill="url(#g)"/></svg>`;
}

(async () => {
  await sharp(Buffer.from(mark(512))).png().toFile(out("logo-mark.png"));
  await sharp(Buffer.from(cover(1920, 1080))).png().toFile(out("cover-bg.png"));
  await sharp(Buffer.from(plain(1920, 1080))).png().toFile(out("content-bg.png"));
  await sharp(Buffer.from(gradient(1200, 24))).png().toFile(out("gradient-pill.png"));
  console.log("graphics done");
})();

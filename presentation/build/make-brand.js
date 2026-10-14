// StableSave brand files: the "Level" mark (a spirit-level vial with a centred bubble) plus an outlined Sora SemiBold
// wordmark. Writes SVG and PNG files to apps/web/public/brand, the site favicon and the Apple touch icon.
const fs = require("fs");
const path = require("path");
const opentype = require("opentype.js");
const sharp = require("sharp");

const pub = path.join(__dirname, "..", "..", "apps", "web", "public");
const out = path.join(pub, "brand");
fs.mkdirSync(out, { recursive: true });

const GREEN = "#3DDC97"; // on dark grounds
const DEEP = "#0E8A57"; // on light grounds
const INK_LIGHT = "#F2F5F3"; // wordmark on dark
const INK_DARK = "#0C1410"; // wordmark on light
const TILE = "#0A0F0C"; // app icon ground

// Wordmark: "StableSave", Sora 600, tracking -0.035em, outlined so it needs no font.
const font = opentype.loadSync(path.join(__dirname, "node_modules/@fontsource/sora/files/sora-latin-600-normal.woff"));
const SIZE = 100;
const TRACK = -0.035 * SIZE;
const glyphs = font.stringToGlyphs("StableSave");
const scale = SIZE / font.unitsPerEm;
const word = new opentype.Path();
let x = 0;
glyphs.forEach((g, i) => {
  word.extend(g.getPath(x, 0, SIZE));
  x += g.advanceWidth * scale + TRACK;
  if (i < glyphs.length - 1) x += font.getKerningValue(g, glyphs[i + 1]) * scale;
});
const bb = word.getBoundingBox();
const shift = (p) => {
  p.commands.forEach((c) => {
    for (const k of ["x", "x1", "x2"]) if (k in c) c[k] -= bb.x1;
    for (const k of ["y", "y1", "y2"]) if (k in c) c[k] -= bb.y1;
  });
  return p;
};
// Drop the zero-length line segments opentype.js emits before each curve.
const clean = (p) => {
  let cx = null;
  let cy = null;
  p.commands = p.commands.filter((c) => {
    const keep = !(c.type === "L" && Math.abs(c.x - cx) < 0.01 && Math.abs(c.y - cy) < 0.01);
    if ("x" in c) [cx, cy] = [c.x, c.y];
    return keep;
  });
  return p;
};
const wordD = clean(shift(word)).toPathData(1);
const wordW = +(bb.x2 - bb.x1).toFixed(2);
const wordH = +(bb.y2 - bb.y1).toFixed(2);
const baseline = +(-bb.y1).toFixed(2); // baseline's distance from the top of the wordmark
const capH = (font.tables.os2.sCapHeight || 700) * scale;

// Mark, drawn on a 24-unit grid. `ticks` off for small sizes.
function mark(color, { ticks = true, stroke = 1.8, fillOpacity = 0.14 } = {}) {
  const t = ticks
    ? `<line x1="7.4" y1="9.7" x2="7.4" y2="14.3" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-opacity="0.6"/>` +
      `<line x1="16.6" y1="9.7" x2="16.6" y2="14.3" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-opacity="0.6"/>`
    : "";
  return (
    `<rect x="2.2" y="6.6" width="19.6" height="10.8" rx="5.4" fill="${color}" fill-opacity="${fillOpacity}" stroke="${color}" stroke-width="${stroke}"/>` +
    t +
    `<circle cx="12" cy="12" r="${ticks ? 3 : 3.2}" fill="${color}"/>`
  );
}
// Tight box around the vial including its stroke.
const MARK_BOX = { x: 1.3, y: 5.7, w: 21.4, h: 12.6 };

const svg = (w, h, body, label = "StableSave") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">${body}</svg>\n`;

const files = {};

// Mark alone (tight box).
for (const [name, color] of [["stablesave-mark.svg", GREEN], ["stablesave-mark-light.svg", DEEP]]) {
  files[name] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_BOX.x} ${MARK_BOX.y} ${MARK_BOX.w} ${MARK_BOX.h}" width="${MARK_BOX.w * 10}" height="${MARK_BOX.h * 10}" role="img" aria-label="StableSave">${mark(color)}</svg>\n`;
}

// App icon: dark rounded tile, mark at 72% of the tile.
const icon = (rx) => svg(512, 512, `<rect width="512" height="512" rx="${rx}" fill="${TILE}"/><g transform="translate(71 71) scale(15.42)">${mark(GREEN)}</g>`);
files["stablesave-icon.svg"] = icon(116);
files["stablesave-icon-square.svg"] = icon(0); // full bleed, for platforms that round corners themselves

// Favicon: 32-unit tile, no ticks so it stays crisp at 16 px.
files["favicon.svg"] = svg(32, 32, `<rect width="32" height="32" rx="7" fill="${TILE}"/><g transform="translate(2.67 2.67) scale(1.111)">${mark(GREEN, { ticks: false, stroke: 2.1 })}</g>`);

// Lockups. Wordmark at 56 px font size; the mark is centred on the capital height.
function lockup(markColor, inkColor, pad = 0) {
  const fs_ = 56;
  const k = fs_ / SIZE;
  const ww = wordW * k;
  const wh = wordH * k;
  const base = baseline * k;
  const cap = capH * k;
  const markH = 52.9; // vial height, a little taller than the capitals
  const ms = markH / MARK_BOX.h;
  const markW = MARK_BOX.w * ms;
  const gap = 24;
  const top = Math.min(0, base - cap / 2 - markH / 2); // the mark may reach above the wordmark
  const markY = base - cap / 2 - markH / 2 - top;
  const wordY = -top;
  const H = Math.max(markY + markH, wordY + wh);
  const W = markW + gap + ww;
  const body =
    `<g transform="translate(${pad} ${pad})">` +
    `<g transform="translate(${(-MARK_BOX.x * ms).toFixed(2)} ${(markY - MARK_BOX.y * ms).toFixed(2)}) scale(${ms.toFixed(4)})">${mark(markColor)}</g>` +
    `<g transform="translate(${(markW + gap).toFixed(2)} ${wordY.toFixed(2)}) scale(${k})"><path d="${wordD}" fill="${inkColor}"/></g>` +
    `</g>`;
  return svg(+(W + pad * 2).toFixed(1), +(H + pad * 2).toFixed(1), body);
}
files["stablesave-logo-dark.svg"] = lockup(GREEN, INK_LIGHT);
files["stablesave-logo-light.svg"] = lockup(DEEP, INK_DARK);

for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(out, name), body);
fs.writeFileSync(path.join(pub, "icon.svg"), files["favicon.svg"]);

(async () => {
  const png = (name, file, opts = {}) =>
    sharp(Buffer.from(files[name]), { density: opts.density ?? 300 })
      .resize(opts.width ? { width: opts.width } : undefined)
      .png()
      .toFile(file);
  await png("stablesave-icon.svg", path.join(out, "stablesave-icon-512.png"), { width: 512, density: 72 });
  await png("stablesave-icon-square.svg", path.join(pub, "apple-icon.png"), { width: 180, density: 72 });
  await png("stablesave-mark.svg", path.join(out, "stablesave-mark-512.png"), { width: 512, density: 600 });
  await png("stablesave-logo-dark.svg", path.join(out, "stablesave-logo-dark.png"), { width: 1200 });
  await png("stablesave-logo-light.svg", path.join(out, "stablesave-logo-light.png"), { width: 1200 });
  // Path data for the site's <Wordmark> component.
  console.log(JSON.stringify({ d: wordD, width: wordW, height: wordH }));
})();

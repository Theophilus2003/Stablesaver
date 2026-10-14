// StableSave demo day deck, in a scrapbook "class notes" style: charcoal background, Anton
// headings on green paint blobs, IBM Plex Mono labels, Archivo text, tilted cards and stickers.
// Run from this folder: npm install, then npm run deck. Speaker notes live in notes.json.
// Facts come from "StableSave — Project Review Guide" and the StableSave code. Screenshots are of
// the real interface from a local build with demo data; every slide that shows one says so.
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const pptxgen = require("pptxgenjs");
const Lu = require("react-icons/lu");
const { applyTheme } = require("./apply-theme");
const art = require("./art");

const ROOT = path.join(__dirname, "..");
const ASSET = (...p) => path.join(ROOT, "assets", ...p);
const OUT = path.join(ROOT, "StableSave-Demo-Day.pptx");
const NOTES = JSON.parse(fs.readFileSync(path.join(__dirname, "notes.json"), "utf8"));

const HEX = {
  bg: "1C1C1C",
  surface: "262626",
  raised: "2F2F2F",
  border: "3D3D3D",
  white: "F2F2F2",
  muted: "A3A3A3",
  sub: "C9C9C9",
  green: "3DDC97",
  yellow: "F2C14E",
  orange: "EE8A43",
  purple: "A47CF3",
  red: "F0616D",
  ink: "141414",
  greenTint: "1F2B25",
  yellowTint: "2B2719",
  orangeTint: "2D2219",
  purpleTint: "26212F",
};

const THEME = {
  name: "StableSave Scrapbook",
  headFontFace: "Anton",
  bodyFontFace: "Archivo",
  colors: {
    dk1: HEX.bg,
    lt1: HEX.white,
    dk2: HEX.surface,
    lt2: HEX.muted,
    accent1: HEX.green,
    accent2: HEX.yellow,
    accent3: HEX.orange,
    accent4: HEX.purple,
    accent5: HEX.raised,
    accent6: HEX.border,
    hlink: HEX.green,
    folHlink: HEX.purple,
  },
};

const MONO = "IBM Plex Mono";
const MONO_SEMI = "IBM Plex Mono SemiBold";
const DISPLAY = "Anton";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.author = "Theo";
pres.company = "StableSave";
pres.title = "StableSave — Demo Day";
pres.subject = "Stablecoin yield intelligence and a Solana vault prototype";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };

const C = pres.SchemeColor;
const BG = C.text1;
const INK = C.background1;
const MUTED = C.background2;
const SURFACE = C.text2;
const GREEN = C.accent1;
const YELLOW = C.accent2;
const ORANGE = C.accent3;
const PURPLE = C.accent4;
const RAISED = C.accent5;
const BORDER = C.accent6;
const S = pres.ShapeType;

const W = 13.333;
const H = 7.5;
const X0 = 0.75;
const CW = W - 2 * X0; // 11.833
const TOP = 2.55; // content starts under the blob title and its subtitle
const TOTAL = 18;
let page = 0;

/* ---------------------------------------------------------------- helpers */

async function size(file) {
  const m = await sharp(file).metadata();
  return { w: m.width, h: m.height };
}

/** Fit an image of px size into a box, keeping its ratio; returns x, y, w, h (centred). */
function fit(px, box) {
  const r = Math.min(box.w / px.w, box.h / px.h);
  const w = px.w * r;
  const h = px.h * r;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

async function icon(Component, hex, px = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Component, { size: px, color: `#${hex}` }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

const hardShadow = () => ({ type: "outer", blur: 0, offset: 5, angle: 45, color: "080808", opacity: 0.85 });

function text(slide, value, opts) {
  slide.addText(value, { isTextBox: true, margin: 0, fontSize: 14, color: INK, valign: "top", ...opts });
}

function mono(slide, value, opts) {
  text(slide, value, { fontFace: MONO, fontSize: 10.5, charSpacing: 2, color: MUTED, ...opts });
}

/** "plain **bold** plain" → runs: plain in `base`, bold in white. */
function rich(str, base = HEX.sub, opts = {}) {
  return str
    .split("**")
    .map((t, i) => ({ text: t, options: { color: i % 2 ? INK : base, bold: i % 2 === 1, ...opts } }))
    .filter((r) => r.text.length > 0);
}

function card(slide, { x, y, w, h, fill = SURFACE, line = BORDER, radius = 0.12, rotate, shadow, name }) {
  slide.addShape(S.roundRect, {
    x, y, w, h,
    fill: { color: fill },
    line: { color: line, width: 1.25 },
    rectRadius: radius,
    ...(rotate ? { rotate } : {}),
    ...(shadow ? { shadow: hardShadow() } : {}),
    objectName: name,
  });
}

/** Card label: small mono caps in a colour. */
function label(slide, value, { x, y, w, color = GREEN, size: fontSize = 10 }) {
  mono(slide, value.toUpperCase(), { x, y, w, h: 0.26, fontSize, color, charSpacing: 2.5 });
}

/** Tinted note with an accent bar and mono text. */
function callout(slide, runs, { x, y, w, h, tone = "green", fontSize = 10.5 }) {
  const tint = { green: HEX.greenTint, yellow: HEX.yellowTint, orange: HEX.orangeTint, purple: HEX.purpleTint }[tone];
  const bar = { green: GREEN, yellow: YELLOW, orange: ORANGE, purple: PURPLE }[tone];
  slide.addShape(S.rect, { x, y, w, h, fill: { color: tint }, line: { color: tint, width: 0 }, objectName: `callout-${tone}` });
  slide.addShape(S.rect, { x, y, w: 0.05, h, fill: { color: bar }, line: { color: bar, width: 0 } });
  text(slide, runs, { x: x + 0.25, y: y + 0.06, w: w - 0.45, h: h - 0.12, fontFace: MONO, fontSize, color: HEX.sub, valign: "middle", lineSpacingMultiple: 1.15 });
}

/** A strip of coloured tape with a mono label, slightly crooked. */
function tape(slide, value, { x, y, w, h = 0.36, color = YELLOW, textColor = HEX.ink, rotate = -2, fontSize = 10 }) {
  slide.addText(value, {
    shape: S.rect, x, y, w, h, rotate,
    fill: { color }, line: { color, width: 0 },
    fontFace: MONO_SEMI, fontSize, color: textColor, charSpacing: 2.5,
    align: "center", valign: "middle", margin: 0, isTextBox: true,
  });
}

function dashed(slide, { x, y, w }) {
  slide.addShape(S.line, { x, y, w, h: 0, line: { color: HEX.border, width: 1, dashType: "dash" } });
}

function pageNumber(slide) {
  page += 1;
  const n = String(page).padStart(2, "0");
  mono(slide, `${n} / ${TOTAL}`, { x: W - X0 - 1.4, y: 6.98, w: 1.4, h: 0.26, fontSize: 9.5, color: "6E6E6E", align: "right", charSpacing: 2 });
}

function numberBadge(slide, { x, y, n, d = 0.36, fontSize = 11 }) {
  slide.addText(String(n), {
    shape: S.ellipse, x, y, w: d, h: d,
    fill: { color: GREEN }, line: { color: BG, width: 1.5 },
    fontFace: MONO_SEMI, color: HEX.ink, fontSize, align: "center", valign: "middle", margin: 0, isTextBox: true,
    objectName: `badge-${n}`,
  });
}

/* ---------------------------------------------------------------- layouts */

function header() {
  return [
    { image: { x: X0, y: 0.31, w: 0.22, h: 0.22, path: ASSET("graphics", "logo-mark.png") } },
    { text: { text: "STABLESAVE", options: { x: X0 + 0.34, y: 0.29, w: 1.5, h: 0.26, fontFace: MONO_SEMI, fontSize: 10.5, color: GREEN, charSpacing: 3, margin: 0, valign: "middle" } } },
    { text: { text: "·  DEMO DAY", options: { x: X0 + 1.74, y: 0.29, w: 2.5, h: 0.26, fontFace: MONO, fontSize: 10.5, color: MUTED, charSpacing: 3, margin: 0, valign: "middle" } } },
  ];
}

function defineLayouts() {
  pres.defineSlideMaster({ title: "COVER", background: { color: HEX.bg }, objects: [] });
  pres.defineSlideMaster({
    title: "CONTENT",
    background: { color: HEX.bg },
    objects: [
      ...header(),
      { placeholder: { options: { name: "title", type: "title", x: X0, y: 0.7, w: CW, h: 0.66, fontFace: DISPLAY, fontSize: 34, color: INK, align: "left", valign: "middle", margin: 0 }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "DIVIDER",
    background: { color: HEX.bg },
    objects: [
      ...header(),
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 3.17, w: W - 1, h: 1.0, fontFace: DISPLAY, fontSize: 54, color: INK, align: "center", valign: "middle", margin: 0 }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "CLOSE",
    background: { color: HEX.bg },
    objects: [
      ...header(),
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 1.08, w: W - 1, h: 1.1, fontFace: DISPLAY, fontSize: 62, color: INK, align: "center", valign: "middle", margin: 0 }, text: "" } },
    ],
  });
}

/* ---------------------------------------------------------------- slides */

async function main() {
  defineLayouts();

  // Artwork: stickers and the star bullet as files (reusable in PowerPoint), the cover collage.
  const stickerDir = ASSET("graphics", "stickers");
  fs.mkdirSync(stickerDir, { recursive: true });
  const stickers = {};
  for (const name of Object.keys(art.STICKER_ART)) {
    const file = path.join(stickerDir, `${name}.png`);
    fs.writeFileSync(file, await art.stickerPng(name));
    stickers[name] = file;
  }
  const star = ASSET("graphics", "star-bullet.png");
  fs.writeFileSync(star, await art.starPng());
  const collageFile = ASSET("graphics", "cover-collage.png");
  const COLLAGE_X = 6.45;
  fs.writeFileSync(
    collageFile,
    await art.coverCollage({
      widthIn: W - COLLAGE_X,
      heightIn: H,
      screens: { home: ASSET("screens", "01-home-hero.png"), pools: ASSET("screens", "12-vault-pools.png"), share: ASSET("screens", "11-share-card.png") },
      lockup: ASSET("graphics", "logo-lockup.png"),
    }),
  );

  const shots = {};
  for (const f of fs.readdirSync(ASSET("screens"))) shots[f.replace(/\.png$/, "")] = { file: ASSET("screens", f), px: await size(ASSET("screens", f)) };
  const qr = ASSET("graphics", "qr-stablesaver.png");

  const ic = {
    wallet: await icon(Lu.LuWallet, HEX.white),
    code: await icon(Lu.LuCodeXml, HEX.purple),
    check: await icon(Lu.LuShieldCheck, HEX.green),
    users: await icon(Lu.LuUsers, HEX.green),
    layers: await icon(Lu.LuLayers, HEX.green),
    timer: await icon(Lu.LuTimer, HEX.green),
    pause: await icon(Lu.LuCirclePause, HEX.green),
    key: await icon(Lu.LuKeyRound, HEX.green),
    calc: await icon(Lu.LuCalculator, HEX.green),
    test: await icon(Lu.LuFlaskConical, HEX.green),
  };

  const sticker = (s, name, { x, y, w, rotate = 0 }) =>
    s.addImage({ path: stickers[name], x, y, w, h: w, rotate, altText: `${name} sticker`, objectName: `sticker-${name}` });

  /** Title on a green paint blob, plus an optional subtitle with **bold** phrases. */
  async function title(s, value, sub, seed) {
    // Snug on the left (the blob's rounded end adds its own room), generous on the right.
    const b = await art.titleBlob(art.antonWidth(value, 34), 1.12, seed, { marginLeft: 0.1, marginRight: 0.35 });
    s.addImage({ data: b.data, x: X0 - 0.1 - b.left, y: 0.46, w: b.w, h: b.h, altText: "", objectName: "title-blob" });
    s.addText(value, { placeholder: "title" });
    if (sub) text(s, rich(sub), { x: X0, y: 1.62, w: 8.6, h: 0.7, fontSize: 17, lineSpacingMultiple: 1.0 });
  }

  /** Bullet list with the orange star; items are "**head**: rest" strings. */
  function bullets(s, items, { x, y, w, rowH, fontSize = 14, gap = 0 }) {
    items.forEach((item, i) => {
      const iy = y + i * (rowH + gap);
      s.addImage({ path: star, x, y: iy + (fontSize / 72) * 0.28, w: 0.17, h: 0.17, altText: "" });
      text(s, rich(item, INK), { x: x + 0.32, y: iy, w: w - 0.32, h: rowH, fontSize, lineSpacingMultiple: 1.05 });
    });
  }

  /** A screenshot on a dark frame with a hard shadow; optional slight tilt. */
  function screenshot(s, key, box, { alt, name, rotate = 0 }) {
    const sh = shots[key];
    const f = fit(sh.px, box);
    s.addShape(S.roundRect, {
      x: f.x - 0.05, y: f.y - 0.05, w: f.w + 0.1, h: f.h + 0.1, rectRadius: 0.08,
      fill: { color: "0E0E0E" }, line: { color: BORDER, width: 1.25 }, shadow: hardShadow(),
      ...(rotate ? { rotate } : {}), objectName: `${name}-frame`,
    });
    s.addImage({ path: sh.file, ...f, altText: alt, objectName: name, ...(rotate ? { rotate } : {}) });
    return f;
  }

  async function divider(n, value, sub, stickerSet, notes, section) {
    const s = pres.addSlide({ masterName: "DIVIDER", sectionTitle: section });
    mono(s, `CHAPTER ${String(n).padStart(2, "0")}`, { x: 0, y: 2.62, w: W, h: 0.3, fontFace: MONO_SEMI, fontSize: 11, color: YELLOW, align: "center", charSpacing: 5 });
    const b = await art.titleBlob(art.antonWidth(value, 54), 1.6, 40 + n, { margin: 0.45 });
    s.addImage({ data: b.data, x: W / 2 - (b.left + b.right) / 2, y: 2.88, w: b.w, h: b.h, altText: "", objectName: "title-blob" });
    s.addText(value, { placeholder: "title" });
    text(s, rich(sub), { x: 2.2, y: 4.62, w: W - 4.4, h: 0.7, fontSize: 18, align: "center" });
    for (const st of stickerSet) sticker(s, st.name, st);
    pageNumber(s);
    s.addNotes(notes);
  }

  /* ---------- 1. Cover ---------- */
  pres.addSection({ title: "Opening" });
  {
    const s = pres.addSlide({ masterName: "COVER", sectionTitle: "Opening" });
    s.addImage({ path: collageFile, x: COLLAGE_X, y: 0, w: W - COLLAGE_X, h: H, altText: "Collage: StableSave screens, a DEMO DAY label, code snippets and stickers", objectName: "collage" });
    tape(s, "STABLESAVE  ·  DEMO DAY", { x: X0, y: 1.05, w: 3.55, h: 0.38, rotate: -2.5, fontSize: 10.5 });
    const big = Math.min(118, Math.floor((5.4 * 118) / art.antonWidth("STABLE", 118)));
    text(s, [
      { text: "STABLE", options: { color: INK, breakLine: true } },
      { text: "SAVE", options: { color: GREEN } },
    ], { x: X0, y: 1.78, w: 5.6, h: 3.2, fontFace: DISPLAY, fontSize: big, lineSpacingMultiple: 0.86, objectName: "wordmark" });
    mono(s, "STABLECOIN YIELD  ·  SOLANA VAULT PROTOTYPE", { x: X0, y: 5.05, w: 5.6, h: 0.3, fontFace: MONO_SEMI, fontSize: 10.5, color: GREEN, charSpacing: 2.5 });
    text(s, rich("Know the risk **before you chase the yield.**"), { x: X0, y: 5.42, w: 5.5, h: 0.45, fontSize: 19 });
    text(s, [
      { text: "Theo", options: { bold: true, color: INK } },
      { text: "   stablesaver-web.vercel.app", options: { color: MUTED, fontFace: MONO, fontSize: 11, charSpacing: 1 } },
    ], { x: X0, y: 6.3, w: 5.5, h: 0.35, fontSize: 14, valign: "middle", objectName: "presenter" });
    s.addNotes(NOTES.cover);
    page += 1;
  }

  /* ---------- 2. Problem ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Opening" });
    await title(s, "YIELD IS EASY TO FIND", "Knowing **what you're taking on** is the hard part.", 11);
    // The headline number everyone sees, as a tilted card.
    s.addText([
      { text: "WHAT YOU SEE", options: { fontFace: MONO, fontSize: 10, color: GREEN, charSpacing: 2.5, breakLine: true } },
      { text: "A BIG APY", options: { fontFace: DISPLAY, fontSize: 60, color: GREEN, breakLine: true } },
      { text: "One number on a dashboard, usually the highest one.", options: { fontSize: 15, color: INK, breakLine: true } },
      { text: " ", options: { fontSize: 8, breakLine: true } },
      { text: "CONCEPTUAL ILLUSTRATION", options: { fontFace: MONO, fontSize: 9, color: MUTED, charSpacing: 2 } },
    ], {
      shape: S.roundRect, rectRadius: 0.14, x: X0 + 0.15, y: TOP + 0.2, w: 4.3, h: 3.3, rotate: -2.5,
      fill: { color: SURFACE }, line: { color: BORDER, width: 1.25 }, shadow: hardShadow(),
      margin: [18, 22, 18, 22], valign: "middle", isTextBox: true, objectName: "seen-card",
    });
    sticker(s, "chart", { x: X0 + 3.75, y: TOP - 0.25, w: 1.15, rotate: 12 });

    const RX = X0 + 5.35;
    const RW = CW - 5.35;
    label(s, "What you take on", { x: RX, y: TOP + 0.02, w: RW, color: YELLOW });
    const items = [
      "**Scattered**: options sit across many protocols and networks",
      "**Higher isn't better**: a higher APY can mean more risk, not a better deal",
      "**Fees bite**: network fees can wipe out the return on a small deposit",
      "**Hard to compare**: security, liquidity, maturity and strategy complexity hide in docs",
      "**No framework**: beginners have no clear way to weigh any of it",
    ];
    bullets(s, items, { x: RX, y: TOP + 0.45, w: RW, rowH: 0.62, fontSize: 15, gap: 0.12 });
    items.slice(0, -1).forEach((_, i) => dashed(s, { x: RX + 0.32, y: TOP + 0.45 + (i + 1) * 0.74 - 0.08, w: RW - 0.32 }));
    pageNumber(s);
    s.addNotes(NOTES.problem);
  }

  /* ---------- 3. Agenda ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Opening" });
    await title(s, "AGENDA", null, 12);
    const rows = [
      ["The comparison app", "Compare yield, risk and what you keep after fees. Live today."],
      ["The Solana vault", "A separate devnet prototype where the program enforces the rules."],
      ["Demo and what's next", "What works today, what's missing, and the order I'll fix it in."],
    ];
    const LW = 7.4;
    rows.forEach(([head, body], i) => {
      const y = 2.45 + i * 1.22;
      mono(s, `0${i + 1}`, { x: X0, y: y + 0.06, w: 0.6, h: 0.32, fontFace: MONO_SEMI, fontSize: 14, color: GREEN, charSpacing: 1 });
      text(s, head, { x: X0 + 0.75, y, w: LW - 0.75, h: 0.42, fontSize: 22, bold: true });
      text(s, body, { x: X0 + 0.75, y: y + 0.45, w: LW - 0.75, h: 0.35, fontSize: 14, color: HEX.sub });
      dashed(s, { x: X0, y: y + 1.0, w: LW });
    });
    sticker(s, "coin", { x: 9.35, y: 2.2, w: 1.75, rotate: -10 });
    sticker(s, "sprout", { x: 11.0, y: 3.2, w: 1.35, rotate: 12 });
    sticker(s, "shield", { x: 9.75, y: 4.35, w: 1.35, rotate: 6 });
    tape(s, "3 PARTS · 1 LIVE DEMO", { x: 9.45, y: 6.05, w: 2.8, h: 0.36, rotate: 3, color: GREEN, fontSize: 10 });
    pageNumber(s);
    s.addNotes(NOTES.agenda);
  }

  /* ---------- 4. Chapter 01 ---------- */
  pres.addSection({ title: "Comparison app" });
  await divider(1, "THE COMPARISON APP", "Live today: compare yield, risk and **what you keep after fees**.", [
    { name: "sprout", x: 10.75, y: 0.95, w: 1.3, rotate: 14 },
    { name: "coin", x: 1.2, y: 4.55, w: 1.45, rotate: -12 },
    { name: "sparkle", x: 10.9, y: 5.35, w: 0.95, rotate: 0 },
  ], NOTES.chapter1, "Comparison app");

  /* ---------- 5. Solution ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Comparison app" });
    await title(s, "ONE PLACE TO COMPARE", "Yield, risk and **what you keep after fees**, side by side.", 13);
    const f = screenshot(s, "01-home-hero", { x: X0 + 0.1, y: TOP - 0.05, w: 3.0, h: 3.85 }, { alt: "StableSave home screen: amount entry, estimated yearly earnings, and the risk preference selector", name: "shot-home", rotate: -2 });
    mono(s, "REAL INTERFACE · DEMO DATA", { x: X0, y: f.y + f.h + 0.22, w: 3.4, h: 0.25, fontSize: 8.5, color: "7A7A7A", align: "center", charSpacing: 1.5 });

    const SX = X0 + 3.65;
    const SW = 3.95;
    label(s, "How it works", { x: SX, y: TOP, w: SW });
    const steps = ["Enter a stablecoin amount", "Pick a risk preference", "Compare the options", "Check the grade and its reasons", "See earnings after fees", "Continue to the official app"];
    steps.forEach((st, i) => {
      const y = TOP + 0.42 + i * 0.6;
      mono(s, `0${i + 1}`, { x: SX, y: y + 0.03, w: 0.5, h: 0.3, fontFace: MONO_SEMI, fontSize: 12, color: GREEN, charSpacing: 1 });
      text(s, st, { x: SX + 0.55, y, w: SW - 0.55, h: 0.36, fontSize: 15, bold: true, valign: "middle" });
      if (i < steps.length - 1) dashed(s, { x: SX, y: y + 0.48, w: SW });
    });

    const PX = SX + SW + 0.4;
    const PW = W - X0 - PX;
    [
      ["No wallet or sign-up", "Comparing needs nothing but an amount.", GREEN],
      ["Never holds your funds", "You deposit from your own wallet, on the protocol's own app.", YELLOW],
    ].forEach(([head, body, color], i) => {
      const y = TOP + i * 1.98;
      card(s, { x: PX, y, w: PW, h: 1.75, name: `promise-${i}` });
      label(s, head, { x: PX + 0.3, y: y + 0.3, w: PW - 0.6, color });
      text(s, body, { x: PX + 0.3, y: y + 0.7, w: PW - 0.6, h: 0.85, fontSize: 15 });
    });
    pageNumber(s);
    s.addNotes(NOTES.solution);
  }

  /* ---------- 6. Walkthrough ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Comparison app" });
    await title(s, "FROM BALANCE TO DECISION", "In a few clicks: **ranked, graded and after fees**.", 14);
    const boxY = TOP - 0.05;
    const boxH = 3.55;
    const fa = screenshot(s, "01-home-hero", { x: X0 + 0.25, y: boxY, w: 2.2, h: boxH }, { alt: "Amount, stablecoin and risk preference", name: "walk-home" });
    const fb = screenshot(s, "02-options-list", { x: X0 + 2.85, y: boxY, w: 3.6, h: boxH }, { alt: "Ranked options with grade, network, deposits, rate and yearly estimate", name: "walk-list" });
    const fc = screenshot(s, "03-detail-rate", { x: X0 + 6.75, y: boxY, w: 2.0, h: boxH }, { alt: "Option detail: rate history, and what $1,000 could earn after fees", name: "walk-detail" });
    numberBadge(s, { x: fa.x - 0.24, y: fa.y + fa.h * 0.335, n: 1 });
    numberBadge(s, { x: fa.x - 0.24, y: fa.y + fa.h * 0.895, n: 2 });
    numberBadge(s, { x: fb.x + fb.w - 0.14, y: fb.y - 0.16, n: 3 });
    numberBadge(s, { x: fb.x - 0.24, y: fb.y + fb.h * 0.115, n: 4 });
    numberBadge(s, { x: fc.x - 0.24, y: fc.y + fc.h * 0.37, n: 5 });
    numberBadge(s, { x: fc.x - 0.24, y: fc.y + fc.h * 0.72, n: 6 });

    const LX = X0 + 9.2;
    const legend = [
      ["Amount", "$1,000 of USDC here"],
      ["Risk preference", "Safe, Balanced or Bigger"],
      ["Ranked options", "Best fit, rate or safety"],
      ["A–D grade", "Next to network, deposits"],
      ["Rate history", "30 or 90 days, daily"],
      ["After fees", "What you'd keep a year"],
    ];
    legend.forEach(([head, body], i) => {
      const y = boxY + i * 0.6;
      numberBadge(s, { x: LX, y: y + 0.03, n: i + 1, d: 0.3, fontSize: 10 });
      text(s, head, { x: LX + 0.42, y, w: 2.2, h: 0.28, fontSize: 13, bold: true });
      text(s, body, { x: LX + 0.42, y: y + 0.27, w: 2.2, h: 0.26, fontSize: 11, color: MUTED });
    });
    callout(s, [
      { text: "Worked example (demo data): ", options: { bold: true, color: INK } },
      { text: "$1,000 USDC, Balanced, 8.33%: " },
      { text: "about +$83 a year after fees", options: { bold: true, color: GREEN } },
      { text: ". Estimated, not promised." },
    ], { x: X0, y: boxY + boxH + 0.3, w: CW, h: 0.5, tone: "green" });
    pageNumber(s);
    s.addNotes(NOTES.walkthrough);
  }

  /* ---------- 7. Risk engine ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Comparison app" });
    await title(s, "HOW THE GRADE WORKS", "A high APY should never tell the whole story: **the weakest factor always counts**.", 15);
    const factors = [
      ["Protocol maturity", 14], ["Smart contract security", 14], ["Total value locked", 12], ["Liquidity", 12], ["Incident history", 12],
      ["Strategy complexity", 10], ["Oracle dependencies", 9], ["Concentration", 9], ["Yield stability", 8],
    ];
    card(s, { x: X0, y: TOP, w: 5.75, h: 4.15, name: "weights-card" });
    label(s, "Nine factors · % of the score", { x: X0 + 0.3, y: TOP + 0.25, w: 5.2 });
    s.addChart(pres.ChartType.bar, [{ name: "Weight", labels: factors.map((f) => f[0]).reverse(), values: factors.map((f) => f[1]).reverse() }], {
      x: X0 + 0.12, y: TOP + 0.55, w: 5.5, h: 3.5,
      barDir: "bar", chartColors: [HEX.green], barGapWidthPct: 45,
      showValue: true, dataLabelPosition: "outEnd", dataLabelColor: HEX.white, dataLabelFontSize: 11, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: '0"%"',
      catAxisLabelColor: HEX.white, catAxisLabelFontSize: 11.5, catAxisLabelFontFace: "+mn-lt", catAxisLineShow: false,
      valAxisHidden: true, valAxisMaxVal: 16, valAxisMinVal: 0, valGridLine: { style: "none" }, catGridLine: { style: "none" },
      showLegend: false, showTitle: false, objectName: "weights-chart",
    });

    const RX = X0 + 6.1;
    const RW = CW - 6.1;
    card(s, { x: RX, y: TOP, w: RW, h: 1.3, name: "formula-card" });
    label(s, "How the score is built", { x: RX + 0.3, y: TOP + 0.2, w: RW - 0.6, color: YELLOW });
    text(s, [
      { text: "Score = " },
      { text: "75%", options: { color: GREEN } },
      { text: " weighted average", options: { breakLine: true } },
      { text: "          + " },
      { text: "25%", options: { color: ORANGE } },
      { text: " weakest factor" },
    ], { x: RX + 0.3, y: TOP + 0.5, w: RW - 0.6, h: 0.68, fontSize: 17, bold: true, valign: "middle" });

    const bands = [["A", "80+", GREEN, -2], ["B", "65–79", YELLOW, 1.5], ["C", "50–64", ORANGE, -1], ["D", "<50", HEX.red, 2]];
    const bw = (RW - 0.45) / 4;
    bands.forEach(([g, range, col, rot], i) => {
      s.addText([
        { text: g, options: { fontFace: DISPLAY, fontSize: 38, color: col, breakLine: true } },
        { text: range, options: { fontFace: MONO, fontSize: 10, color: HEX.sub, charSpacing: 1.5 } },
      ], {
        shape: S.roundRect, rectRadius: 0.1, x: RX + i * (bw + 0.15), y: TOP + 1.55, w: bw, h: 1.02, rotate: rot,
        fill: { color: SURFACE }, line: { color: BORDER, width: 1.25 }, shadow: hardShadow(),
        align: "center", valign: "middle", margin: 2, lineSpacingMultiple: 0.9, isTextBox: true, objectName: `band-${g}`,
      });
    });
    callout(s, [
      { text: "One weak factor (demo data): ", options: { bold: true, color: INK } },
      { text: "Kamino JLP Market averages " },
      { text: "81", options: { bold: true, color: GREEN } },
      { text: ", an A on its own. Concentration scores " },
      { text: "37", options: { bold: true, color: HEX.red } },
      { text: ", so the final score is " },
      { text: "70: grade B", options: { bold: true, color: INK } },
      { text: "." },
    ], { x: RX, y: TOP + 2.85, w: RW, h: 0.8, tone: "yellow" });
    text(s, rich("**Hard caps** can override the score (no public audits: at most C). Inputs the data doesn't cover are marked \"Not verified\" and scored cautiously, never guessed.", MUTED), {
      x: RX, y: TOP + 3.75, w: RW, h: 0.45, fontSize: 11,
    });
    pageNumber(s);
    s.addNotes(NOTES.risk);
  }

  /* ---------- 8. Net earnings ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Comparison app" });
    await title(s, "THE RETURN AFTER COSTS", "On a small deposit, **fees can cost more than you earn**.", 16);
    const f = screenshot(s, "05-fees-ethereum-100", { x: X0 + 0.05, y: TOP + 0.05, w: 6.55, h: 2.2 }, { alt: "Filtered to Ethereum with $100: Aave V3 at 4.10% shows minus $7.90 a year and the note 'Fees cost more than you'd earn'", name: "shot-fees", rotate: -1.2 });
    mono(s, "REAL INTERFACE · LOCAL BUILD, DEMO DATA · $100 OF USDC, ETHEREUM", { x: X0, y: f.y + f.h + 0.2, w: 6.6, h: 0.25, fontSize: 8.5, color: "7A7A7A", charSpacing: 1.5 });
    callout(s, [
      { text: "Marked, not hidden: ", options: { bold: true, color: YELLOW } },
      { text: "$100 at 4.10% earns about $4.10 a year. Getting in and out of Ethereum is estimated at $12, so the app says " },
      { text: "\"Fees cost more than you'd earn.\"", options: { bold: true, color: INK } },
    ], { x: X0, y: TOP + 2.85, w: 6.6, h: 1.0, tone: "yellow" });

    const RX = X0 + 7.1;
    const RW = CW - 7.1;
    [
      ["ETHEREUM · $100 AT 4.10%", "−$7.90", HEX.red, "$4.10 interest − $12.00 network fees (est.)", 1.5],
      ["SOLANA · $100 AT 4.10%", "+$4.08", GREEN, "$4.10 interest − $0.02 network fees (est.)", -1.5],
    ].forEach(([head, value, col, body, rot], i) => {
      s.addText([
        { text: head, options: { fontFace: MONO, fontSize: 10, color: HEX.sub, charSpacing: 2, breakLine: true } },
        { text: value, options: { fontFace: DISPLAY, fontSize: 52, color: col, breakLine: true } },
        { text: body, options: { fontSize: 13, color: INK } },
      ], {
        shape: S.roundRect, rectRadius: 0.12, x: RX, y: TOP + 0.05 + i * 2.05, w: RW, h: 1.8, rotate: rot,
        fill: { color: SURFACE }, line: { color: BORDER, width: 1.25 }, shadow: hardShadow(),
        align: "center", valign: "middle", margin: 4, lineSpacingMultiple: 0.95, isTextBox: true, objectName: `ledger-${i}`,
      });
    });
    mono(s, "Illustrative: the same 4.10% with StableSave's per-network fee estimates for one deposit and one withdrawal. Estimates, not live gas prices.", {
      x: X0, y: 6.42, w: CW, h: 0.3, fontSize: 9, color: "7A7A7A", charSpacing: 0.5,
    });
    pageNumber(s);
    s.addNotes(NOTES.fees);
  }

  /* ---------- 9. New in the comparison app ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Comparison app" });
    await title(s, "FOUR MORE QUESTIONS", "Answered **before you deposit**.", 17);
    const gap = 0.3;
    const cw = (CW - gap) / 2;
    const ch = 1.82;
    const TX = 2.45;
    const features = [
      { label: "Find idle money", color: GREEN, q: "Is money sitting idle in my wallet?", body: "Paste any Solana address: read-only, and it fills the calculator.", shot: "08-idle-money", alt: "Find idle money: this wallet holds $1,240.51 USDC and $300 USDT, earning nothing; about +$103 a year on Kamino" },
      { label: "Can I withdraw today?", color: YELLOW, q: "Can I get my money out today?", body: "Cash free in the lending pool right now, versus your amount.", shot: "10-withdraw-today", alt: "Can I withdraw today? Yes, today: $31.8M is free to withdraw right now; 87% of the pool is lent out" },
      { label: "US T-bill comparison", color: PURPLE, q: "Is it worth the crypto risk?", body: "Every list starts with US Treasury bills, from the Treasury's own data.", chart: true },
      { label: "Share my estimate", color: ORANGE, q: "Can I show someone?", body: "One click copies a link that previews as this card.", shot: "11-share-card", alt: "Share card: On $1,000 USDC, I could earn +$83.28 a year at 8.33% on Kamino, Solana, grade B" },
    ];
    features.forEach((ft, i) => {
      const x = X0 + (i % 2) * (cw + gap);
      const y = TOP + Math.floor(i / 2) * (ch + gap);
      card(s, { x, y, w: cw, h: ch, name: `feature-${i}` });
      label(s, ft.label, { x: x + 0.28, y: y + 0.22, w: TX, color: ft.color, size: 9.5 });
      text(s, ft.q, { x: x + 0.28, y: y + 0.5, w: TX - 0.1, h: 0.55, fontSize: 15, bold: true, lineSpacingMultiple: 0.95 });
      text(s, ft.body, { x: x + 0.28, y: y + 1.1, w: TX - 0.1, h: 0.6, fontSize: 11.5, color: MUTED });
      const box = { x: x + TX + 0.4, y: y + 0.18, w: cw - TX - 0.6, h: ch - 0.36 };
      if (ft.chart) {
        // Demo data, same as the screenshots: T-bills vs the top options for $1,000, Balanced.
        const rows = [["US T-bills", 4.0], ["Kamino · A", 5.15], ["Drift · A", 5.57], ["Kamino JLP · B", 8.33]];
        s.addChart(pres.ChartType.bar, [{ name: "Rate", labels: rows.map((r) => r[0]).reverse(), values: rows.map((r) => r[1]).reverse() }], {
          ...box, barDir: "bar", chartColors: [HEX.green, HEX.green, HEX.green, HEX.muted], barGapWidthPct: 40,
          showValue: true, dataLabelPosition: "outEnd", dataLabelColor: HEX.white, dataLabelFontSize: 10, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: '0.00"%"',
          catAxisLabelColor: HEX.white, catAxisLabelFontSize: 10, catAxisLabelFontFace: "+mn-lt", catAxisLineShow: false,
          valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 10.5, valGridLine: { style: "none" }, catGridLine: { style: "none" },
          showLegend: false, showTitle: false, objectName: "tbill-chart",
        });
      } else {
        const sh = shots[ft.shot];
        const f = fit(sh.px, box);
        s.addShape(S.roundRect, { x: f.x - 0.04, y: f.y - 0.04, w: f.w + 0.08, h: f.h + 0.08, rectRadius: 0.06, fill: { color: "0E0E0E" }, line: { color: BORDER, width: 1 } });
        s.addImage({ path: sh.file, ...f, altText: ft.alt, objectName: ft.shot });
      }
    });
    mono(s, "REAL INTERFACE · LOCAL BUILD, DEMO DATA · THE WALLET SCAN USED A STAND-IN BALANCE", { x: X0, y: TOP + 2 * ch + gap + 0.12, w: CW, h: 0.25, fontSize: 8.5, color: "7A7A7A", charSpacing: 1.5 });
    pageNumber(s);
    s.addNotes(NOTES.questions);
  }

  /* ---------- 10. Chapter 02 ---------- */
  pres.addSection({ title: "Solana vault" });
  await divider(2, "THE SOLANA VAULT", "A separate **devnet prototype**: the program enforces the rules.", [
    { name: "vault", x: 10.7, y: 1.0, w: 1.35, rotate: 10 },
    { name: "shield", x: 1.25, y: 4.6, w: 1.3, rotate: -10 },
    { name: "bolt", x: 11.0, y: 5.35, w: 0.95, rotate: 8 },
  ], NOTES.chapter2, "Solana vault");

  /* ---------- 11. Solana engineering ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solana vault" });
    await title(s, "THE VAULT PROGRAM", "A separate Anchor prototype on devnet: **the program enforces the rules**.", 18);
    const y0 = TOP;
    const UW = { x: X0, y: y0 + 0.8, w: 2.1, h: 1.5 };
    card(s, { ...UW, fill: RAISED, name: "wallet" });
    s.addImage({ data: ic.wallet, x: UW.x + 0.25, y: UW.y + 0.22, w: 0.4, h: 0.4, altText: "Wallet" });
    text(s, "User wallet", { x: UW.x + 0.25, y: UW.y + 0.72, w: UW.w - 0.4, h: 0.3, fontSize: 15, bold: true });
    text(s, "Signs every user action", { x: UW.x + 0.25, y: UW.y + 1.03, w: UW.w - 0.4, h: 0.3, fontSize: 11, color: MUTED });
    tape(s, "DEVNET · UNAUDITED", { x: UW.x - 0.05, y: UW.y + UW.h + 0.45, w: 2.2, h: 0.34, rotate: -3, fontSize: 9 });
    tape(s, "PRACTICE POOLS", { x: UW.x + 0.15, y: UW.y + UW.h + 0.92, w: 1.8, h: 0.34, rotate: 2, color: PURPLE, textColor: HEX.ink, fontSize: 9 });

    const P = { x: X0 + 3.05, y: y0, w: 4.6, h: 4.1 };
    card(s, { ...P, line: PURPLE, name: "program" });
    s.addImage({ data: ic.code, x: P.x + 0.3, y: P.y + 0.25, w: 0.38, h: 0.38, altText: "Program" });
    text(s, "StableSave Vault program", { x: P.x + 0.8, y: P.y + 0.2, w: P.w - 1, h: 0.3, fontSize: 15, bold: true });
    mono(s, "ANCHOR · DEVNET · 16 INSTRUCTIONS", { x: P.x + 0.8, y: P.y + 0.52, w: P.w - 1, h: 0.24, fontSize: 8.5, charSpacing: 1.5 });
    label(s, "Program-enforced checks", { x: P.x + 0.3, y: P.y + 0.95, w: P.w - 0.6 });
    bullets(s, [
      "Not paused",
      "Deposit ≥ minimum, under the vault cap",
      "Instant: 2,000 per wallet, 50,000 per vault / 24 h",
      "Bigger: request, wait 30 min, then execute",
      "Shares priced with a virtual offset",
    ], { x: P.x + 0.3, y: P.y + 1.28, w: P.w - 0.55, rowH: 0.36, gap: 0.06, fontSize: 12.5 });
    text(s, rich("**Admin:** authority (settings, unpause, two-step handover) · guardian (pause only)", YELLOW), {
      x: P.x + 0.3, y: P.y + P.h - 0.6, w: P.w - 0.6, h: 0.45, fontSize: 10.5,
    });

    const ax = UW.x + UW.w;
    const aw = P.x - ax;
    s.addShape(S.line, { x: ax + 0.05, y: UW.y + 0.5, w: aw - 0.1, h: 0, line: { color: HEX.green, width: 1.75, endArrowType: "triangle" }, objectName: "arrow-in" });
    s.addShape(S.line, { x: ax + 0.05, y: UW.y + 1.0, w: aw - 0.1, h: 0, line: { color: HEX.muted, width: 1.25, beginArrowType: "triangle" }, objectName: "arrow-out" });
    mono(s, "deposit", { x: ax + 0.05, y: UW.y + 0.18, w: aw - 0.1, h: 0.25, fontSize: 9.5, color: GREEN, align: "center", charSpacing: 1 });
    mono(s, "withdraw", { x: ax + 0.05, y: UW.y + 1.07, w: aw - 0.1, h: 0.25, fontSize: 9.5, align: "center", charSpacing: 1 });

    const AX = X0 + 8.05;
    const AW = CW - 8.05;
    const accts = [
      ["Vault PDA", '["vault", mint, risk_profile]', "Roles, limits, strategy, share totals", INK],
      ["Reserve + practice pools", '["reserve"] · ["pool", protocol]', "20% kept liquid; the rest split by strategy weight. Only the vault signs transfers out", GREEN],
      ["UserPosition PDA", '["position", vault, owner]', "One depositor's shares and pending withdrawal", INK],
    ];
    const ah = 1.24;
    accts.forEach(([name, seeds, body, color], i) => {
      const y = y0 + i * (ah + 0.19);
      card(s, { x: AX, y, w: AW, h: ah, name: `acct-${i}` });
      text(s, name, { x: AX + 0.25, y: y + 0.13, w: AW - 0.5, h: 0.28, fontSize: 14, bold: true, color });
      mono(s, seeds, { x: AX + 0.25, y: y + 0.42, w: AW - 0.5, h: 0.24, fontSize: 9.5, color: PURPLE, charSpacing: 0 });
      text(s, body, { x: AX + 0.25, y: y + 0.68, w: AW - 0.45, h: 0.5, fontSize: 11, color: MUTED });
      s.addShape(S.line, { x: P.x + P.w + 0.05, y: y + ah / 2, w: AX - (P.x + P.w) - 0.1, h: 0, line: { color: HEX.border, width: 1.25, endArrowType: "oval" }, objectName: `link-${i}` });
    });
    pageNumber(s);
    s.addNotes(NOTES.vault);
  }

  /* ---------- 12. Practice pools and the Blink ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solana vault" });
    await title(s, "EVERY DEPOSIT, SPLIT", "Into practice pools by strategy, **and a test proves it** on every change.", 19);
    const LW = 6.6;
    const fp = screenshot(s, "12-vault-pools", { x: X0 + 0.05, y: TOP + 0.02, w: LW - 0.1, h: 2.95 }, {
      alt: "Where the vault's money is: $100.00 in total; $20.00 kept liquid for withdrawals; Kamino practice pool $36.00 at 5.20%; MarginFi $24.00 at 5.90%; Save $20.00 at 5.05%",
      name: "shot-pools", rotate: -1.2,
    });
    const fb = screenshot(s, "13-blink", { x: X0 + 0.05, y: fp.y + fp.h + 0.3, w: LW - 0.1, h: 0.82 }, {
      alt: "Deposit from a link: a Solana Blink anyone with test USDC can use from a post or a QR code. Copy link, Try it",
      name: "shot-blink", rotate: 1,
    });
    mono(s, "REAL INTERFACE · POOLS CARD SHOWS THE REHEARSAL'S SPLIT", { x: X0, y: fb.y + fb.h + 0.18, w: LW, h: 0.25, fontSize: 8.5, color: "7A7A7A", charSpacing: 1.5 });

    const RX = X0 + LW + 0.4;
    const RW = CW - LW - 0.4;
    const RH = 4.05;
    card(s, { x: RX, y: TOP, w: RW, h: RH, line: GREEN, name: "rehearsal-card" });
    label(s, "Checked on every change", { x: RX + 0.3, y: TOP + 0.22, w: RW - 0.6 });
    text(s, "A real deposit and withdrawal on a local Solana validator, in GitHub Actions (test USDC)", { x: RX + 0.3, y: TOP + 0.5, w: RW - 0.6, h: 0.45, fontSize: 11.5, color: MUTED });
    s.addChart(pres.ChartType.bar, [
      { name: "Kept liquid", labels: ["After depositing 100", "After withdrawing 40"].reverse(), values: [20, 0].reverse() },
      { name: "In practice pools", labels: ["After depositing 100", "After withdrawing 40"].reverse(), values: [80, 60].reverse() },
    ], {
      x: RX + 0.15, y: TOP + 0.98, w: RW - 0.3, h: 1.5,
      barDir: "bar", barGrouping: "stacked", chartColors: [HEX.muted, HEX.green], barGapWidthPct: 45,
      showValue: true, dataLabelPosition: "ctr", dataLabelColor: HEX.ink, dataLabelFontSize: 11, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "0;;;",
      catAxisLabelColor: HEX.white, catAxisLabelFontSize: 10.5, catAxisLabelFontFace: "+mn-lt", catAxisLineShow: false,
      valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 100, valGridLine: { style: "none" }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "b", legendColor: HEX.white, legendFontSize: 10.5, legendFontFace: "+mn-lt",
      showTitle: false, objectName: "rehearsal-chart",
    });
    const checks = [
      ["Split by strategy", "80 into three pools, 20 kept liquid"],
      ["Pools top up withdrawals", "The 20 short came back from the pools"],
      ["The books match", "Wallet 940 and pools 60, read on-chain"],
    ];
    checks.forEach(([head, body], i) => {
      const y = TOP + 2.62 + i * 0.47;
      s.addImage({ data: ic.check, x: RX + 0.3, y: y + 0.03, w: 0.28, h: 0.28, altText: "Passed" });
      text(s, [
        { text: head, options: { bold: true, color: INK, breakLine: true } },
        { text: body, options: { color: MUTED, fontSize: 10.5 } },
      ], { x: RX + 0.72, y, w: RW - 0.95, h: 0.46, fontSize: 12.5, lineSpacingMultiple: 0.95 });
    });
    pageNumber(s);
    s.addNotes(NOTES.pools);
  }

  /* ---------- 13. Safety controls ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solana vault" });
    await title(s, "SECURITY IS TRADE-OFFS", "Not a badge: **each control buys safety at a cost**.", 20);
    const controls = [
      [ic.check, "On-chain checks", "Pause, minimum and cap", "Rejects bad deposits and exits"],
      [ic.users, "2,000 per wallet / 24 h", "Instant withdrawal limit", "Limits a stolen wallet"],
      [ic.layers, "50,000 per vault / 24 h", "Instant limit, all users", "Slows a bank run"],
      [ic.timer, "30-minute timelock", "Above the instant limits", "Time to react; big exits wait"],
      [ic.pause, "Guardian pause", "Only the authority unpauses", "Fast stop; no escape hatch yet"],
      [ic.key, "Role-based admin", "Two-step authority handover", "One powerful key today"],
      [ic.calc, "Virtual share offset", "1,000 shares, 1 asset", "Stops share-price inflation"],
      [ic.test, "Automated tests", "14 unit + 10 integration", "Plus a local deploy rehearsal"],
    ];
    const cols = 4;
    const gap = 0.22;
    const cw = (CW - gap * (cols - 1)) / cols;
    const ch = 1.62;
    controls.forEach(([img, head, sub, trade], i) => {
      const x = X0 + (i % cols) * (cw + gap);
      const y = TOP + Math.floor(i / cols) * (ch + gap);
      card(s, { x, y, w: cw, h: ch, name: `control-${i}` });
      s.addImage({ data: img, x: x + 0.25, y: y + 0.22, w: 0.32, h: 0.32, altText: head });
      text(s, head, { x: x + 0.25, y: y + 0.65, w: cw - 0.45, h: 0.3, fontSize: 14, bold: true });
      text(s, sub, { x: x + 0.25, y: y + 0.95, w: cw - 0.45, h: 0.26, fontSize: 11.5, color: MUTED });
      text(s, trade, { x: x + 0.25, y: y + 1.24, w: cw - 0.4, h: 0.26, fontSize: 11.5, color: GREEN });
    });
    callout(s, [
      { text: "Not yet: ", options: { bold: true, color: ORANGE } },
      { text: "audit · multisig authority · strategy-change delay · pause escape hatch · fuzz testing", options: { color: INK } },
      { text: "   (everything above runs on devnet only)" },
    ], { x: X0, y: TOP + 2 * ch + gap + 0.25, w: CW, h: 0.5, tone: "orange", fontSize: 9.5 });
    pageNumber(s);
    s.addNotes(NOTES.security);
  }

  /* ---------- 14. Chapter 03 ---------- */
  pres.addSection({ title: "Demo and roadmap" });
  await divider(3, "DEMO & WHAT'S NEXT", "What works today, **what's missing**, and what I build next.", [
    { name: "chart", x: 10.75, y: 0.95, w: 1.3, rotate: -8 },
    { name: "piggy", x: 1.15, y: 4.5, w: 1.5, rotate: 8 },
    { name: "sparkle", x: 11.0, y: 5.35, w: 0.95, rotate: 0 },
  ], NOTES.chapter3, "Demo and roadmap");

  /* ---------- 15. Live demo ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Demo and roadmap" });
    await title(s, "LET'S SEE IT WORK", "Part A is **live**. Part B is a **devnet prototype**. Keep them separate.", 21);
    const colW = (CW - 0.35) / 2;
    const parts = [
      {
        tag: "A · LIVE", color: GREEN, title: "Comparison app", url: "stablesaver-web.vercel.app", shot: "01-home-hero",
        alt: "Comparison app home: amount, estimated earnings and risk preference",
        steps: ["Find idle money in a wallet", "Switch Safe / Balanced / Bigger", "Open an option: grade, withdraw", "Compare with US T-bills", "$100 + Ethereum: fees win", "Share my estimate"],
      },
      {
        tag: "B · DEVNET PROTOTYPE", color: PURPLE, title: "Vault", url: "Wallet on Solana devnet", shot: "06-vault-withdraw",
        alt: "Vault withdraw screen: 2,000 now, the rest after a 30-minute timelock",
        steps: ["Connect a devnet wallet", "Deposit: split into pools", "Where the money is", "Collect interest, rebalance", "Withdraw: pools top up", "Deposit from a Blink"],
      },
    ];
    const ch = 3.75;
    parts.forEach((p, i) => {
      const x = X0 + i * (colW + 0.35);
      card(s, { x, y: TOP + 0.05, w: colW, h: ch, name: `demo-${i}` });
      tape(s, p.tag, { x: x + 0.2, y: TOP - 0.1, w: i === 0 ? 1.35 : 2.6, h: 0.34, color: p.color, rotate: i === 0 ? -3 : 2, fontSize: 9 });
      text(s, p.title, { x: x + 0.3, y: TOP + 0.42, w: 3.3, h: 0.38, fontSize: 19, bold: true });
      mono(s, p.url, { x: x + 0.3, y: TOP + 0.82, w: 3.3, h: 0.24, fontSize: 9.5, color: p.color, charSpacing: 0.5 });
      p.steps.forEach((st, k) => {
        const y = TOP + 1.22 + k * 0.42;
        mono(s, `0${k + 1}`, { x: x + 0.3, y: y + 0.04, w: 0.42, h: 0.26, fontFace: MONO_SEMI, fontSize: 10.5, color: p.color, charSpacing: 0.5 });
        text(s, st, { x: x + 0.75, y, w: 2.85, h: 0.34, fontSize: 12.5, valign: "middle" });
      });
      const sh = shots[p.shot];
      const f = fit(sh.px, { x: x + 3.7, y: TOP + 0.3, w: colW - 3.95, h: ch - 0.5 });
      s.addShape(S.roundRect, { x: f.x - 0.04, y: f.y - 0.04, w: f.w + 0.08, h: f.h + 0.08, rectRadius: 0.06, fill: { color: "0E0E0E" }, line: { color: BORDER, width: 1 } });
      s.addImage({ path: sh.file, ...f, altText: p.alt, objectName: `demo-shot-${i}` });
    });
    text(s, [
      { text: "Devnet tokens have no value. ", options: { bold: true, color: YELLOW } },
      { text: "Practice pools pay fixed practice rates, not market yield. Thumbnails: local build (demo data; vault in simulated preview).", options: { color: MUTED } },
    ], { x: X0, y: TOP + ch + 0.22, w: CW, h: 0.35, fontSize: 11 });
    pageNumber(s);
    s.addNotes(NOTES.demo);
  }

  /* ---------- 16. Status ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Demo and roadmap" });
    await title(s, "LIVE, DEVNET, NOT YET", "What's real, what's experimental, and **what's missing**.", 22);
    const cols = [
      { head: "Live", color: GREEN, items: ["Stablecoin opportunity comparison", "Risk grades and their reasons", "Fee-adjusted earnings estimates", "Withdraw-today check, T-bill row", "Idle-money scan, share cards"] },
      { head: "Devnet prototype", color: PURPLE, items: ["Anchor vault program", "Deposits, shares, limits, timelock", "Split into practice pools on-chain", "Deposit Blink (Solana Action)", "Pause and authority controls"] },
      { head: "Not yet implemented", color: ORANGE, items: ["CPI into Kamino, MarginFi, Drift and Save", "Market yield through the vault", "Production security assurances"] },
    ];
    const gap = 0.28;
    const cw = (CW - 2 * gap) / 3;
    const ch = 2.75;
    cols.forEach((c, i) => {
      const x = X0 + i * (cw + gap);
      card(s, { x, y: TOP, w: cw, h: ch, name: `status-${i}` });
      label(s, c.head, { x: x + 0.3, y: TOP + 0.24, w: cw - 0.6, color: c.color, size: 10.5 });
      bullets(s, c.items, { x: x + 0.3, y: TOP + 0.62, w: cw - 0.45, rowH: c.items.length > 3 ? 0.36 : 0.58, gap: 0.06, fontSize: 12.5 });
    });
    const LY = TOP + ch + 0.3;
    label(s, "Also worth knowing", { x: X0, y: LY, w: 4, color: MUTED });
    const lims = ["One data source", "Fixed network-fee estimates", "Weights not back-tested", "Ranks on today's APY, not 30-day avg", "Bridge costs and risk not modelled", "Admin and upgrade-key risk"];
    const lw = (CW - 0.2 * 2) / 3;
    lims.forEach((l, i) => {
      const x = X0 + (i % 3) * (lw + 0.2);
      const y = LY + 0.36 + Math.floor(i / 3) * 0.48;
      s.addText(l, {
        shape: S.roundRect, rectRadius: 0.18, x, y, w: lw, h: 0.38,
        fill: { color: BG }, line: { color: BORDER, width: 1, dashType: "dash" },
        fontFace: MONO, fontSize: 9.5, color: INK, align: "center", valign: "middle", margin: 0, charSpacing: 0.5, isTextBox: true,
      });
    });
    pageNumber(s);
    s.addNotes(NOTES.status);
  }

  /* ---------- 17. Roadmap ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Demo and roadmap" });
    await title(s, "WHAT COMES NEXT", "Safety first, then **the feature that makes the vault real**.", 23);
    const phases = [
      { n: "01", head: "Safety and correctness", color: GREEN, items: ["Escape hatch if a vault stays paused", "close_position to refund rent", "Fuzz the share math and limits"] },
      { n: "02", head: "Better recommendations", color: YELLOW, items: ["Rank on the 30-day average APY", "Flag options that need funds moved between networks", "Back-test grades against past exploits"] },
      { n: "03", head: "Vault integration", color: ORANGE, items: ["Swap a practice pool for one real Kamino strategy", "Tested against the real Kamino program", "Same rebalance and on-chain balances"] },
      { n: "04", head: "Admin and expansion", color: PURPLE, items: ["Multisig authority", "Delay on strategy changes", "Alerts, read-only portfolio, more tokens"] },
    ];
    const gap = 0.3;
    const pw = (CW - 3 * gap) / 4;
    const rots = [-1.5, 1.2, -1, 1.5];
    phases.forEach((p, i) => {
      const x = X0 + i * (pw + gap);
      s.addText([
        { text: p.n, options: { fontFace: DISPLAY, fontSize: 44, color: p.color, breakLine: true } },
        { text: `PHASE ${i + 1}`, options: { fontFace: MONO, fontSize: 9.5, color: HEX.sub, charSpacing: 2.5, breakLine: true } },
        { text: p.head, options: { fontSize: 15, bold: true, color: INK, breakLine: true } },
        { text: " ", options: { fontSize: 6, breakLine: true } },
        ...p.items.map((it, k) => ({ text: it, options: { fontSize: 12, color: HEX.sub, bullet: { indent: 12 }, paraSpaceAfter: 5, breakLine: k < p.items.length - 1 } })),
      ], {
        shape: S.roundRect, rectRadius: 0.12, x, y: TOP + 0.05, w: pw, h: 3.55, rotate: rots[i],
        fill: { color: SURFACE }, line: { color: BORDER, width: 1.25 }, shadow: hardShadow(),
        align: "left", valign: "top", margin: [14, 16, 14, 16], lineSpacingMultiple: 1.0, isTextBox: true, objectName: `phase-${i}`,
      });
    });
    tape(s, "PLANNED WORK", { x: X0, y: TOP + 3.92, w: 1.9, h: 0.34, color: ORANGE, rotate: -2, fontSize: 9 });
    text(s, "None of this is built yet. Safety first, then the feature that makes the vault real.", { x: X0 + 2.15, y: TOP + 3.9, w: CW - 2.15, h: 0.36, fontSize: 12, italic: true, color: MUTED, valign: "middle" });
    pageNumber(s);
    s.addNotes(NOTES.roadmap);
  }

  /* ---------- 18. Closing ---------- */
  pres.addSection({ title: "Close" });
  {
    const s = pres.addSlide({ masterName: "CLOSE", sectionTitle: "Close" });
    const value = "THANK YOU!";
    const b = await art.titleBlob(art.antonWidth(value, 62), 1.75, 61, { margin: 0.5 });
    s.addImage({ data: b.data, x: W / 2 - (b.left + b.right) / 2, y: 0.78, w: b.w, h: b.h, altText: "", objectName: "title-blob" });
    s.addText(value, { placeholder: "title" });
    text(s, rich("Make stablecoin yield easier to understand **before making it easier to chase.**"), { x: 2.0, y: 2.65, w: W - 4.0, h: 0.75, fontSize: 19, align: "center" });
    // QR as a sticker.
    const q = { x: W / 2 - 1.2, y: 3.55, w: 2.4, h: 2.4 };
    s.addShape(S.roundRect, { ...q, rectRadius: 0.16, rotate: 3, fill: { color: "FFFFFF" }, line: { color: "FFFFFF", width: 0 }, shadow: hardShadow(), objectName: "qr-card" });
    s.addImage({ path: qr, x: q.x + 0.18, y: q.y + 0.18, w: q.w - 0.36, h: q.h - 0.36, rotate: 3, altText: "QR code linking to stablesaver-web.vercel.app" });
    mono(s, "SCAN TO TRY IT  ·  STABLESAVER-WEB.VERCEL.APP", { x: 0, y: 6.2, w: W, h: 0.28, fontFace: MONO_SEMI, fontSize: 11, color: GREEN, align: "center", charSpacing: 2.5 });
    text(s, "Feedback welcome on risk scoring, vault security, and which integration to build next.", { x: 2.5, y: 6.52, w: W - 5, h: 0.3, fontSize: 12.5, color: MUTED, align: "center" });
    sticker(s, "coin", { x: 1.6, y: 3.9, w: 1.6, rotate: -14 });
    sticker(s, "sprout", { x: 2.3, y: 0.9, w: 1.15, rotate: 10 });
    sticker(s, "piggy", { x: 10.2, y: 4.0, w: 1.7, rotate: 8 });
    sticker(s, "shield", { x: 10.6, y: 1.0, w: 1.15, rotate: -6 });
    sticker(s, "sparkle", { x: 8.35, y: 3.75, w: 0.85, rotate: 0 });
    pageNumber(s);
    s.addNotes(NOTES.close);
  }

  if (page !== TOTAL) throw new Error(`TOTAL is ${TOTAL} but the deck has ${page} slides`);
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

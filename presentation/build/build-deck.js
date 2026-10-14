// StableSave demo day deck. Run from this folder: npm install, then npm run graphics && npm run deck
// Facts come from "StableSave — Project Review Guide" and the StableSave code. Screenshots are of the
// real interface from a local build with demo data; every slide that shows one says so.
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const pptxgen = require("pptxgenjs");
const Lu = require("react-icons/lu");
const { applyTheme } = require("./apply-theme");

const ROOT = path.join(__dirname, "..");
const ASSET = (...p) => path.join(ROOT, "assets", ...p);
const OUT = path.join(ROOT, "StableSave-Demo-Day.pptx");

const HEX = {
  navy: "0B1020",
  surface: "131C31",
  raised: "1B2640",
  border: "26324F",
  purple: "9945FF",
  green: "14F195",
  white: "F5F7FB",
  muted: "9AA7BD",
  amber: "F5B942",
  red: "F0616D",
};

const THEME = {
  name: "StableSave",
  headFontFace: "Inter",
  bodyFontFace: "Inter",
  colors: {
    dk1: HEX.navy,
    lt1: HEX.white,
    dk2: HEX.surface,
    lt2: HEX.muted,
    accent1: HEX.purple,
    accent2: HEX.green,
    accent3: HEX.amber,
    accent4: HEX.red,
    accent5: HEX.raised,
    accent6: HEX.border,
    hlink: HEX.green,
    folHlink: HEX.purple,
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.author = "Theo";
pres.company = "StableSave";
pres.title = "StableSave — Demo Day";
pres.subject = "Stablecoin yield intelligence and a Solana vault prototype";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };

const C = pres.SchemeColor;
const INK = C.background1; // soft white text on the dark deck
const MUTED = C.background2;
const SURFACE = C.text2;
const NAVY = C.text1;
const PURPLE = C.accent1;
const GREEN = C.accent2;
const AMBER = C.accent3;
const RED = C.accent4;
const RAISED = C.accent5;
const BORDER = C.accent6;
const S = pres.ShapeType;

const W = 13.333;
const X0 = 0.6;
const CW = W - 2 * X0; // content width 12.133
const TOP = 1.72; // content starts under a two-line title

/* ---------------------------------------------------------------- helpers */

async function size(file) {
  const m = await sharp(file).metadata();
  return { w: m.width, h: m.height };
}

/** Fit an image of px size into a box, keeping its ratio; returns x, y, w, h (centred). */
function fit(px, box, align = "center") {
  const r = Math.min(box.w / px.w, box.h / px.h);
  const w = px.w * r;
  const h = px.h * r;
  const x = align === "left" ? box.x : box.x + (box.w - w) / 2;
  const y = box.y + (box.h - h) / 2;
  return { x, y, w, h };
}

async function icon(Component, hex, px = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Component, { size: px, color: `#${hex}` }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

function text(slide, value, opts) {
  slide.addText(value, { isTextBox: true, margin: 0, fontSize: 14, color: INK, valign: "top", ...opts });
}

function card(slide, { x, y, w, h, fill = SURFACE, line = BORDER, radius = 0.14, name, transparency }) {
  slide.addShape(S.roundRect, {
    x, y, w, h,
    fill: { color: fill, ...(transparency !== undefined ? { transparency } : {}) },
    line: { color: line, width: 0.75 },
    rectRadius: radius,
    objectName: name,
  });
}

function chip(slide, { x, y, w, h = 0.34, label, color, fill, fontSize = 10.5, name }) {
  slide.addText(label, {
    shape: S.roundRect, rectRadius: h / 2, x, y, w, h,
    fill: { color: fill ?? NAVY }, line: { color, width: 1 },
    color, fontSize, bold: true, align: "center", valign: "middle", margin: 0, charSpacing: 1,
    objectName: name, isTextBox: true,
  });
}

function numberBadge(slide, { x, y, n, color = GREEN, d = 0.36, fontSize = 13 }) {
  slide.addText(String(n), {
    shape: S.ellipse, x, y, w: d, h: d,
    fill: { color }, line: { color: NAVY, width: 1.5 },
    color: NAVY, bold: true, fontSize, align: "center", valign: "middle", margin: 0, isTextBox: true,
    objectName: `badge-${n}`,
  });
}

function screenshot(slide, file, px, box, { alt, name }) {
  const f = fit(px, box);
  card(slide, { x: f.x - 0.06, y: f.y - 0.06, w: f.w + 0.12, h: f.h + 0.12, fill: NAVY, line: BORDER, radius: 0.12, name: `${name}-frame` });
  slide.addImage({ path: file, ...f, altText: alt, objectName: name });
  return f;
}

function caption(slide, value, { x, y, w, align = "left", color = MUTED }) {
  text(slide, value, { x, y, w, h: 0.3, fontSize: 10, color, align, italic: true });
}

/* ---------------------------------------------------------------- layouts */

function defineLayouts() {
  pres.defineSlideMaster({
    title: "COVER",
    background: { path: ASSET("graphics", "cover-bg.png") },
    objects: [],
  });
  pres.defineSlideMaster({
    title: "CONTENT",
    background: { path: ASSET("graphics", "content-bg.png") },
    margin: [0.4, 0.6, 0.7, 0.6],
    objects: [
      { image: { x: X0, y: 7.0, w: 0.2, h: 0.2, path: ASSET("graphics", "logo-mark.png") } },
      { text: { text: "StableSave · Demo Day", options: { x: X0 + 0.3, y: 6.97, w: 4, h: 0.26, fontSize: 10, color: MUTED, margin: 0, valign: "middle" } } },
      {
        placeholder: {
          options: { name: "title", type: "title", x: X0, y: 0.42, w: CW, h: 1.15, fontSize: 32, bold: true, color: INK, align: "left", valign: "top", margin: 0, lineSpacingMultiple: 0.95 },
          text: "",
        },
      },
    ],
    slideNumber: { x: W - X0 - 0.6, y: 6.97, w: 0.6, h: 0.26, fontSize: 10, color: MUTED, align: "right", margin: 0 },
  });
}

/* ---------------------------------------------------------------- slides */

async function main() {
  defineLayouts();
  const shots = {};
  for (const f of fs.readdirSync(ASSET("screens"))) shots[f.replace(/\.png$/, "")] = { file: ASSET("screens", f), px: await size(ASSET("screens", f)) };
  const qr = ASSET("graphics", "qr-stablesaver.png");
  const mark = ASSET("graphics", "logo-mark.png");
  const ic = {
    layers: await icon(Lu.LuLayers, HEX.muted),
    trend: await icon(Lu.LuTrendingUp, HEX.green),
    receipt: await icon(Lu.LuReceipt, HEX.amber),
    shield: await icon(Lu.LuShieldAlert, HEX.amber),
    compass: await icon(Lu.LuCompass, HEX.muted),
    wallet: await icon(Lu.LuWallet, HEX.white),
    gauge: await icon(Lu.LuGauge, HEX.green),
    code: await icon(Lu.LuCodeXml, HEX.purple),
    lock: await icon(Lu.LuLock, HEX.green),
    users: await icon(Lu.LuUsers, HEX.green),
    timer: await icon(Lu.LuTimer, HEX.green),
    pause: await icon(Lu.LuCirclePause, HEX.green),
    key: await icon(Lu.LuKeyRound, HEX.green),
    calc: await icon(Lu.LuCalculator, HEX.green),
    test: await icon(Lu.LuFlaskConical, HEX.green),
    check: await icon(Lu.LuShieldCheck, HEX.green),
    bars: await icon(Lu.LuChartBar, HEX.green),
    vault: await icon(Lu.LuVault, HEX.purple),
    msg: await icon(Lu.LuMessageSquare, HEX.green),
  };

  /* ---------- 1. Cover ---------- */
  pres.addSection({ title: "Opening" });
  {
    const s = pres.addSlide({ masterName: "COVER", sectionTitle: "Opening" });
    s.addImage({ path: mark, x: X0, y: 0.62, w: 0.46, h: 0.46, altText: "StableSave logo: three stacked coins", objectName: "logo-mark" });
    text(s, "StableSave", { x: X0 + 0.6, y: 0.62, w: 4, h: 0.46, fontSize: 24, bold: true, valign: "middle", objectName: "wordmark" });
    text(s, "STABLECOIN YIELD INTELLIGENCE  +  SOLANA VAULT PROTOTYPE", { x: X0, y: 2.05, w: 8, h: 0.3, fontSize: 11, bold: true, color: GREEN, charSpacing: 2, objectName: "descriptor" });
    text(s, [
      { text: "Know the risk before you ", options: { color: INK } },
      { text: "chase the yield.", options: { color: GREEN } },
    ], { x: X0, y: 2.45, w: 7.6, h: 2.1, fontSize: 52, bold: true, lineSpacingMultiple: 0.92, objectName: "headline" });
    text(s, "A simpler way to compare stablecoin yield opportunities, understand risk, and see what remains after fees.", {
      x: X0, y: 4.75, w: 6.4, h: 0.9, fontSize: 18, color: MUTED, lineSpacingMultiple: 1.15, objectName: "subhead",
    });
    text(s, [
      { text: "Theo", options: { bold: true, color: INK, breakLine: true } },
      { text: "Demo Day · stablesaver-web.vercel.app", options: { color: MUTED } },
    ], { x: X0, y: 6.25, w: 6, h: 0.6, fontSize: 13, objectName: "presenter" });
    s.addNotes([
      "TIME: about 20 seconds.",
      "",
      "Key message: StableSave helps people see the risk and the real return before they chase a headline rate.",
      "",
      "Talking points:",
      "- Hi, I'm Theo. This is StableSave.",
      "- It has two parts, and I'll keep them separate all the way through: a comparison app that is live today, and a Solana vault that is a devnet prototype.",
      "- One line to remember: know the risk before you chase the yield.",
      "",
      "Transition: Let's start with why this matters.",
    ].join("\n"));
  }

  /* ---------- 2. Problem ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Opening" });
    s.addText([{ text: "Finding yield is easy.", options: { breakLine: true } }, { text: "Knowing what you're taking on is harder" }], { placeholder: "title" });

    // Left: the headline rate everyone sees.
    const L = { x: X0, y: TOP + 0.05, w: 4.6, h: 4.95 };
    card(s, { ...L, fill: SURFACE, line: BORDER, name: "seen-card" });
    text(s, "WHAT YOU SEE", { x: L.x + 0.4, y: L.y + 0.4, w: 3.8, h: 0.3, fontSize: 11, bold: true, color: MUTED, charSpacing: 2 });
    text(s, "A big APY", { x: L.x + 0.4, y: L.y + 0.9, w: 3.8, h: 0.6, fontSize: 30, bold: true, color: GREEN });
    text(s, "One number on a dashboard, usually the highest one.", { x: L.x + 0.4, y: L.y + 1.55, w: 3.8, h: 0.7, fontSize: 15, color: INK });
    s.addImage({ data: ic.trend, x: L.x + 0.4, y: L.y + 2.55, w: 1.25, h: 1.25, altText: "Rising line icon" });
    text(s, "Conceptual illustration", { x: L.x + 0.4, y: L.y + 4.35, w: 3.8, h: 0.3, fontSize: 10, italic: true, color: MUTED });

    // Right: what sits behind it.
    const items = [
      [ic.layers, "Scattered", "Options sit across many protocols and networks."],
      [ic.trend, "Higher isn't better", "A higher APY can mean more risk, not a better deal."],
      [ic.receipt, "Fees bite", "Network fees can wipe out the return on a small deposit."],
      [ic.shield, "Hard to compare", "Security, liquidity, maturity and strategy complexity hide in docs."],
      [ic.compass, "No framework", "Beginners have no clear way to weigh any of it."],
    ];
    const RX = X0 + 4.95;
    const RW = CW - 4.95;
    text(s, "WHAT YOU TAKE ON", { x: RX, y: L.y + 0.02, w: RW, h: 0.3, fontSize: 11, bold: true, color: AMBER, charSpacing: 2 });
    const rowH = 0.86;
    items.forEach(([img, head, body], i) => {
      const y = L.y + 0.45 + i * (rowH + 0.06);
      card(s, { x: RX, y, w: RW, h: rowH, fill: SURFACE, line: BORDER, radius: 0.12, name: `risk-${i}` });
      s.addImage({ data: img, x: RX + 0.25, y: y + 0.23, w: 0.4, h: 0.4, altText: head });
      text(s, head, { x: RX + 0.85, y: y + 0.14, w: 2.4, h: 0.6, fontSize: 16, bold: true, valign: "middle" });
      text(s, body, { x: RX + 3.25, y: y + 0.14, w: RW - 3.45, h: 0.6, fontSize: 14, color: MUTED, valign: "middle" });
    });
    s.addNotes([
      "TIME: about 40 seconds.",
      "",
      "Key message: the headline rate is the easy part. The risk and the costs behind it are the hard part.",
      "",
      "Talking points:",
      "- If you hold USDC or USDT, finding a rate is easy. Every app shows you one big number.",
      "- What's hard is everything behind it: options are spread across many protocols and networks.",
      "- A higher APY can simply mean more risk.",
      "- Network fees can wipe out the return on a small deposit. I'll show a real example in a minute.",
      "- Security, liquidity, how long a protocol has been live, and how complex its strategy is are all hard to compare.",
      "- Beginners don't have a framework for any of it.",
      "",
      "Note: no market statistics on this slide on purpose. The left card is a concept, not a real pool.",
      "",
      "Transition: So here's what StableSave does about it.",
    ].join("\n"));
  }

  /* ---------- 3. Solution ---------- */
  pres.addSection({ title: "Product" });
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Product" });
    s.addText([{ text: "One place to compare yield, risk,", options: { breakLine: true } }, { text: "and estimated net earnings" }], { placeholder: "title" });
    const sh = shots["01-home-hero"];
    const f = screenshot(s, sh.file, sh.px, { x: X0 + 0.1, y: TOP, w: 3.5, h: 4.75 }, { alt: "StableSave home screen: amount entry, estimated yearly earnings, and the risk preference selector", name: "shot-home" });
    caption(s, "Real interface · local build, demo data", { x: f.x - 0.06, y: f.y + f.h + 0.12, w: f.w + 0.6 });

    const steps = [
      "Enter a stablecoin amount",
      "Pick a risk preference",
      "Compare the options",
      "Check the grade and its reasons",
      "See earnings after fees",
      "Continue to the official app",
    ];
    const SX = X0 + 4.3;
    const colW = 3.6;
    steps.forEach((label, i) => {
      const col = i < 3 ? 0 : 1;
      const row = i % 3;
      const x = SX + col * (colW + 0.35);
      const y = TOP + 0.05 + row * 0.98;
      card(s, { x, y, w: colW, h: 0.8, fill: SURFACE, line: BORDER, radius: 0.12, name: `step-${i + 1}` });
      numberBadge(s, { x: x + 0.22, y: y + 0.22, n: i + 1, color: i === 5 ? GREEN : PURPLE });
      text(s, label, { x: x + 0.75, y: y + 0.1, w: colW - 0.9, h: 0.6, fontSize: 15, bold: true, valign: "middle" });
    });
    // Two promises.
    const PY = TOP + 3.15;
    const pw = (colW * 2 + 0.35 - 0.3) / 2;
    [
      [ic.wallet, "No wallet or sign-up", "Comparing needs nothing but an amount."],
      [ic.check, "Never holds your funds", "You deposit from your own wallet, on the protocol's own app."],
    ].forEach(([img, head, body], i) => {
      const x = SX + i * (pw + 0.3);
      card(s, { x, y: PY, w: pw, h: 1.78, fill: RAISED, line: BORDER, radius: 0.14, name: `promise-${i}` });
      s.addImage({ data: img, x: x + 0.3, y: PY + 0.3, w: 0.42, h: 0.42, altText: head });
      text(s, head, { x: x + 0.3, y: PY + 0.8, w: pw - 0.6, h: 0.3, fontSize: 15, bold: true, color: GREEN });
      text(s, body, { x: x + 0.3, y: PY + 1.1, w: pw - 0.5, h: 0.4, fontSize: 12.5, color: MUTED });
    });
    s.addNotes([
      "TIME: about 35 seconds.",
      "",
      "Key message: one screen shows the rate, the risk grade, and what you'd actually keep after fees.",
      "",
      "Talking points:",
      "- You type an amount and choose a stablecoin. You pick how much risk you're comfortable with: Play it safe, Balanced, or Go bigger.",
      "- StableSave ranks the options, gives each one an A to D grade with its reasons, and shows estimated earnings after network fees.",
      "- When you're ready, it sends you to the protocol's official app. You deposit from your own wallet.",
      "- Two promises: no wallet or sign-up just to compare, and StableSave never holds anyone's money in this flow.",
      "",
      "Honesty note: this screenshot is the real interface running locally with demo data, so the numbers are illustrative. The live site shows live DefiLlama data.",
      "",
      "Transition: Let me walk through the screens.",
    ].join("\n"));
  }

  /* ---------- 4. Walkthrough ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Product" });
    s.addText("From a balance to a more informed decision", { placeholder: "title" });
    const boxY = TOP - 0.05;
    const boxH = 4.3;
    const a = shots["01-home-hero"];
    const b = shots["02-options-list"];
    const c = shots["03-detail-rate"];
    const fa = screenshot(s, a.file, a.px, { x: X0 + 0.15, y: boxY, w: 2.45, h: boxH }, { alt: "Amount, stablecoin and risk preference", name: "walk-home" });
    const fb = screenshot(s, b.file, b.px, { x: X0 + 2.95, y: boxY, w: 4.2, h: boxH }, { alt: "Ranked options with grade, network, deposits, rate and yearly estimate", name: "walk-list" });
    const fc = screenshot(s, c.file, c.px, { x: X0 + 7.45, y: boxY, w: 2.2, h: boxH }, { alt: "Option detail: rate history, and what $1,000 could earn after fees", name: "walk-detail" });

    // Numbered callouts placed on the features they point at.
    numberBadge(s, { x: fa.x - 0.24, y: fa.y + fa.h * 0.335, n: 1 });
    numberBadge(s, { x: fa.x - 0.24, y: fa.y + fa.h * 0.895, n: 2 });
    numberBadge(s, { x: fb.x + fb.w - 0.14, y: fb.y - 0.16, n: 3 });
    numberBadge(s, { x: fb.x - 0.24, y: fb.y + fb.h * 0.115, n: 4 });
    numberBadge(s, { x: fc.x - 0.24, y: fc.y + fc.h * 0.37, n: 5 });
    numberBadge(s, { x: fc.x - 0.24, y: fc.y + fc.h * 0.72, n: 6 });

    // Legend on the right.
    const LX = X0 + 9.95;
    const legend = [
      ["Amount", "$1,000 of USDC here"],
      ["Risk preference", "Safe, Balanced or Bigger"],
      ["Ranked options", "Sort: best fit, rate, safety"],
      ["A–D grade", "Next to network, deposits"],
      ["Rate history", "30 or 90 days, daily"],
      ["After fees", "What you'd keep a year"],
    ];
    legend.forEach(([head, body], i) => {
      const y = boxY + i * 0.74;
      numberBadge(s, { x: LX, y: y + 0.02, n: i + 1, d: 0.3, fontSize: 11 });
      text(s, head, { x: LX + 0.42, y, w: 1.75, h: 0.3, fontSize: 13, bold: true });
      text(s, body, { x: LX + 0.42, y: y + 0.3, w: 1.75, h: 0.3, fontSize: 10.5, color: MUTED });
    });

    // Worked example strip.
    const EY = boxY + boxH + 0.3;
    card(s, { x: X0, y: EY, w: CW, h: 0.62, fill: RAISED, line: BORDER, radius: 0.1, name: "worked-example" });
    text(s, [
      { text: "Worked example (demo data):  ", options: { bold: true, color: INK } },
      { text: "$1,000 USDC, Balanced → 8.33% → ", options: { color: MUTED } },
      { text: "about +$83 a year after fees", options: { color: GREEN, bold: true } },
      { text: ". Estimated, not promised.", options: { color: MUTED } },
    ], { x: X0 + 0.3, y: EY + 0.08, w: CW - 0.6, h: 0.46, fontSize: 13, valign: "middle" });
    s.addNotes([
      "TIME: about 45 seconds.",
      "",
      "Key message: in a few clicks you go from a balance to a ranked, graded, fee-adjusted choice.",
      "",
      "Walk the numbers on the slide:",
      "1. Enter the amount and stablecoin. Here, $1,000 of USDC.",
      "2. Pick a risk preference. Balanced is selected.",
      "3. Options are ranked for that preference.",
      "4. Every row shows its A to D grade, network and deposits, plus the rate and a yearly estimate.",
      "5. Open any option: you get 30 or 90 days of daily rate history, so you can see whether today's rate is normal.",
      "6. And what $1,000 could earn after the network fees to get in and out.",
      "",
      "The detail panel then explains the grade factor by factor (\"How risky is it?\"), adds a plain risk warning, steps to deposit safely, and quick facts. Note: the review guide calls these \"Why this grade?\" and \"What could go wrong?\". The current interface uses the new headings.",
      "",
      "Honesty: the worked example uses demo data. Say \"estimated\" every time. Rates change.",
      "",
      "Transition: The grade is the core of this, so here's how it works.",
    ].join("\n"));
  }

  /* ---------- 5. Risk engine ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Product" });
    s.addText("A high APY should never tell the whole story", { placeholder: "title" });

    const factors = [
      ["Protocol maturity", 14],
      ["Smart contract security", 14],
      ["Total value locked", 12],
      ["Liquidity", 12],
      ["Incident history", 12],
      ["Strategy complexity", 10],
      ["Oracle dependencies", 9],
      ["Concentration", 9],
      ["Yield stability", 8],
    ];
    card(s, { x: X0, y: TOP, w: 6.2, h: 4.95, fill: SURFACE, line: BORDER, name: "weights-card" });
    text(s, "Nine factors, weighted (% of the score)", { x: X0 + 0.3, y: TOP + 0.22, w: 5.6, h: 0.35, fontSize: 15, bold: true });
    s.addChart(pres.ChartType.bar, [{ name: "Weight", labels: factors.map((f) => f[0]).reverse(), values: factors.map((f) => f[1]).reverse() }], {
      x: X0 + 0.15, y: TOP + 0.6, w: 5.9, h: 4.25,
      barDir: "bar",
      chartColors: [HEX.purple],
      barGapWidthPct: 45,
      showValue: true,
      dataLabelPosition: "outEnd",
      dataLabelColor: HEX.white,
      dataLabelFontSize: 11,
      dataLabelFontFace: "+mn-lt",
      dataLabelFormatCode: '0"%"',
      catAxisLabelColor: HEX.white,
      catAxisLabelFontSize: 11.5,
      catAxisLabelFontFace: "+mn-lt",
      catAxisLineShow: false,
      valAxisHidden: true,
      valAxisMaxVal: 16,
      valAxisMinVal: 0,
      valGridLine: { style: "none" },
      catGridLine: { style: "none" },
      showLegend: false,
      showTitle: false,
      objectName: "weights-chart",
    });

    const RX = X0 + 6.55;
    const RW = CW - 6.55;
    // Formula
    card(s, { x: RX, y: TOP, w: RW, h: 1.72, fill: RAISED, line: BORDER, name: "formula-card" });
    text(s, "HOW THE SCORE IS BUILT", { x: RX + 0.3, y: TOP + 0.2, w: RW - 0.6, h: 0.28, fontSize: 10.5, bold: true, color: MUTED, charSpacing: 2 });
    text(s, [
      { text: "Score = ", options: { color: INK } },
      { text: "75%", options: { color: PURPLE, bold: true } },
      { text: " weighted average", options: { color: INK, breakLine: true } },
      { text: "      + ", options: { color: INK } },
      { text: "25%", options: { color: AMBER, bold: true } },
      { text: " weakest factor", options: { color: INK } },
    ], { x: RX + 0.3, y: TOP + 0.5, w: RW - 0.6, h: 0.75, fontSize: 17, bold: true });
    text(s, "So one bad area pulls the grade down.", { x: RX + 0.3, y: TOP + 1.3, w: RW - 0.6, h: 0.3, fontSize: 12.5, color: MUTED });

    // Grade bands
    const bands = [["A", "80+", GREEN], ["B", "65–79", "D7C65E"], ["C", "50–64", "E8955C"], ["D", "<50", RED]];
    const bw = (RW - 0.45) / 4;
    bands.forEach(([g, range, col], i) => {
      const x = RX + i * (bw + 0.15);
      const y = TOP + 1.9;
      card(s, { x, y, w: bw, h: 0.95, fill: SURFACE, line: col, radius: 0.12, name: `band-${g}` });
      text(s, g, { x, y: y + 0.08, w: bw, h: 0.48, fontSize: 24, bold: true, color: col, align: "center" });
      text(s, range, { x, y: y + 0.56, w: bw, h: 0.3, fontSize: 12, color: MUTED, align: "center" });
    });

    // Example
    const EY = TOP + 3.0;
    card(s, { x: RX, y: EY, w: RW, h: 1.32, fill: SURFACE, line: BORDER, name: "example-card" });
    text(s, "ONE WEAK FACTOR (DEMO DATA)", { x: RX + 0.3, y: EY + 0.18, w: RW - 0.6, h: 0.28, fontSize: 10.5, bold: true, color: AMBER, charSpacing: 2 });
    text(s, [
      { text: "Kamino JLP Market: weighted average ", options: { color: MUTED } },
      { text: "81", options: { color: GREEN, bold: true } },
      { text: " (an A on its own). Concentration scores ", options: { color: MUTED } },
      { text: "37", options: { color: RED, bold: true } },
      { text: ", so the final score is ", options: { color: MUTED } },
      { text: "70: grade B", options: { color: INK, bold: true } },
      { text: ".", options: { color: MUTED } },
    ], { x: RX + 0.3, y: EY + 0.48, w: RW - 0.6, h: 0.8, fontSize: 13.5, lineSpacingMultiple: 1.05 });

    // Caps + unknowns
    text(s, [
      { text: "Hard caps can override the score ", options: { bold: true, color: INK } },
      { text: "(e.g. no public audits: at most C). Inputs the data doesn't cover are marked \"Not verified\" and scored cautiously, never guessed.", options: { color: MUTED } },
    ], { x: RX, y: EY + 1.44, w: RW, h: 0.62, fontSize: 12 });
    s.addNotes([
      "TIME: about 50 seconds.",
      "",
      "Key message: the grade can't be gamed by one shiny number, because the weakest factor always counts.",
      "",
      "Talking points:",
      "- Every option gets a score from 0 to 100 across nine factors. The biggest weights are protocol maturity and smart contract security at 14% each. Yield stability is the smallest at 8%.",
      "- 75% of the score is the weighted average. The other 25% is the single weakest factor. That's deliberate: one bad area should pull the grade down.",
      "- Scores map to grades: A is 80 and above, B 65 to 79, C 50 to 64, D below 50.",
      "- Hard caps override the number. No public audits, unrepaid losses or a first-loss insurance fund: at most C. Live under six months, or one key can change the code: at most C+. 98% or more lent out: at most B minus. Three or more unverified inputs: at most B.",
      "- If the data doesn't cover an input, it's labelled Not verified and scored cautiously. Never guessed.",
      "",
      "The example is from the demo data on screen: an average of 81 would be an A, but concentration scores 37, so the final score is 70, a B. (0.75 x 81 + 0.25 x 37 = 70.)",
      "",
      "Be honest if asked: the weights are my judgement. I haven't back-tested them against past exploits yet. That's on the roadmap.",
      "",
      "Transition: The other half of a good decision is cost.",
    ].join("\n"));
  }

  /* ---------- 6. Net earnings ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Product" });
    s.addText("The return that matters is the return after costs", { placeholder: "title" });
    const sh = shots["05-fees-ethereum-100"];
    const f = screenshot(s, sh.file, sh.px, { x: X0 + 0.06, y: TOP + 0.06, w: 7.4, h: 2.45 }, { alt: "Filtered to Ethereum with $100: Aave V3 at 4.10% shows minus $7.90 a year and the note 'Fees cost more than you'd earn'", name: "shot-fees" });
    caption(s, "Real interface · local build, demo data · $100 of USDC, Ethereum", { x: f.x, y: f.y + f.h + 0.1, w: 7 });
    const NX = X0 + 7.85;
    const NW = CW - 7.85;
    card(s, { x: NX, y: TOP, w: NW, h: f.h + 0.12, fill: SURFACE, line: AMBER, name: "fees-callout" });
    text(s, "MARKED, NOT HIDDEN", { x: NX + 0.3, y: TOP + 0.25, w: NW - 0.6, h: 0.28, fontSize: 10.5, bold: true, color: AMBER, charSpacing: 2 });
    text(s, [
      { text: "$100 at 4.10% earns about $4.10 a year. Getting in and out of Ethereum is estimated at $12. ", options: { color: INK } },
      { text: "So the app says: \"Fees cost more than you'd earn.\"", options: { color: AMBER, bold: true } },
    ], { x: NX + 0.3, y: TOP + 0.65, w: NW - 0.55, h: 1.75, fontSize: 14, lineSpacingMultiple: 1.1 });

    // Two ledgers: same rate, same $100, two networks.
    const LY = f.y + f.h + 0.5;
    const cols = ["Headline rate", "A year's interest", "Network fees (est.)", "What you keep"];
    const rows = [
      ["Ethereum", "4.10%", "$4.10", "−$12.00", "−$7.90", RED],
      ["Solana", "4.10%", "$4.10", "−$0.02", "+$4.08", GREEN],
    ];
    const labelW = 1.8;
    const cw = (CW - labelW) / 4;
    cols.forEach((h, i) => text(s, h, { x: X0 + labelW + i * cw - 0.15, y: LY, w: cw - 0.1, h: 0.3, fontSize: 11.5, bold: true, color: MUTED, align: "right" }));
    rows.forEach(([net, rate, gross, fee, keep, col], r) => {
      const y = LY + 0.36 + r * 0.66;
      card(s, { x: X0, y, w: CW, h: 0.56, fill: SURFACE, line: BORDER, radius: 0.1, name: `ledger-${net}` });
      text(s, net, { x: X0 + 0.25, y: y + 0.08, w: labelW - 0.3, h: 0.4, fontSize: 15, bold: true, valign: "middle" });
      [rate, gross, fee, keep].forEach((v, i) => text(s, v, {
        x: X0 + labelW + i * cw - 0.15, y: y + 0.08, w: cw - 0.1, h: 0.4, fontSize: 16, align: "right", valign: "middle",
        bold: i === 3, color: i === 3 ? col : i === 2 ? AMBER : INK,
      }));
    });
    text(s, "Illustrative: $100 at the same 4.10% rate, using StableSave's per-network fee estimates for one deposit and one withdrawal. Estimates, not live gas prices.", {
      x: X0, y: LY + 1.78, w: CW, h: 0.3, fontSize: 11, italic: true, color: MUTED,
    });
    s.addNotes([
      "TIME: about 35 seconds.",
      "",
      "Key message: a good rate on an expensive network can lose you money on a small deposit.",
      "",
      "Talking points:",
      "- This is the example from my review guide: enter $100 and filter to Ethereum.",
      "- At 4.10%, $100 earns about $4.10 in a year. StableSave's estimate for getting in and out on Ethereum is about $12. So you'd be $7.90 down, and the app marks the option: \"Fees cost more than you'd earn\".",
      "- The same rate on Solana, where the estimate is about two cents, keeps about $4.08.",
      "- That's why ranking uses yield after fees, so small deposits aren't sent to expensive networks.",
      "",
      "Be precise: the screenshot uses demo data, and the Solana row is an illustration at the same rate. Network fees are fixed per-network estimates for one deposit and one withdrawal, not live gas prices. Bridging costs aren't counted yet.",
      "",
      "Transition: That's the comparison app, which is live. Now the second, separate part: the Solana vault.",
    ].join("\n"));
  }

  /* ---------- 7. Solana engineering ---------- */
  pres.addSection({ title: "Solana vault" });
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solana vault" });
    s.addText([{ text: "A separate Anchor vault prototype", options: { breakLine: true } }, { text: "brings the project on-chain" }], { placeholder: "title" });

    const y0 = TOP + 0.1;
    // User wallet
    const UW = { x: X0, y: y0 + 1.05, w: 2.15, h: 1.6 };
    card(s, { ...UW, fill: RAISED, line: BORDER, name: "wallet" });
    s.addImage({ data: ic.wallet, x: UW.x + 0.25, y: UW.y + 0.25, w: 0.42, h: 0.42, altText: "Wallet" });
    text(s, "User wallet", { x: UW.x + 0.25, y: UW.y + 0.78, w: UW.w - 0.4, h: 0.3, fontSize: 15, bold: true });
    text(s, "Signs every user action", { x: UW.x + 0.25, y: UW.y + 1.1, w: UW.w - 0.4, h: 0.3, fontSize: 11, color: MUTED });
    // Status, kept in sight next to the diagram.
    const SY = UW.y + UW.h + 0.45;
    card(s, { x: UW.x, y: SY, w: UW.w, h: 1.25, fill: SURFACE, line: AMBER, name: "status-card" });
    text(s, ["Devnet prototype", "Unaudited", "No yield yet"].map((t, k, all) => ({ text: t, options: { breakLine: k < all.length - 1 } })), {
      x: UW.x + 0.25, y: SY + 0.15, w: UW.w - 0.4, h: 0.95, fontSize: 13, bold: true, color: AMBER, valign: "middle", paraSpaceAfter: 2,
    });

    // Program box
    const P = { x: X0 + 3.25, y: y0, w: 4.55, h: 4.85 };
    card(s, { ...P, fill: SURFACE, line: PURPLE, name: "program" });
    s.addImage({ data: ic.code, x: P.x + 0.3, y: P.y + 0.25, w: 0.4, h: 0.4, altText: "Program" });
    text(s, "StableSave Vault program", { x: P.x + 0.82, y: P.y + 0.22, w: P.w - 1, h: 0.3, fontSize: 15, bold: true });
    text(s, "Anchor · Solana devnet · 13 instructions", { x: P.x + 0.82, y: P.y + 0.52, w: P.w - 1, h: 0.28, fontSize: 11, color: MUTED });
    text(s, "PROGRAM-ENFORCED CHECKS", { x: P.x + 0.3, y: P.y + 1.0, w: P.w - 0.6, h: 0.28, fontSize: 10, bold: true, color: GREEN, charSpacing: 2 });
    const checks = [
      "Not paused",
      "Deposit ≥ minimum, under the vault cap",
      "Instant: 2,000 per wallet, 50,000 per vault / 24 h",
      "Bigger: request, wait 30 min, then execute",
      "Shares priced with a virtual offset",
    ];
    checks.forEach((c, i) => {
      const y = P.y + 1.36 + i * 0.58;
      s.addImage({ data: ic.check, x: P.x + 0.3, y: y + 0.04, w: 0.26, h: 0.26, altText: "Check" });
      text(s, c, { x: P.x + 0.7, y, w: P.w - 0.95, h: 0.42, fontSize: 12.5 });
    });
    text(s, "Admin: authority (settings, unpause, two-step handover) · guardian (pause only)", {
      x: P.x + 0.3, y: P.y + P.h - 0.62, w: P.w - 0.6, h: 0.45, fontSize: 10.5, color: AMBER,
    });

    // Arrows wallet -> program
    const ax = UW.x + UW.w;
    const aw = P.x - ax;
    s.addShape(S.line, { x: ax + 0.05, y: UW.y + 0.55, w: aw - 0.1, h: 0, line: { color: HEX.green, width: 1.75, endArrowType: "triangle" }, objectName: "arrow-in" });
    s.addShape(S.line, { x: ax + 0.05, y: UW.y + 1.05, w: aw - 0.1, h: 0, line: { color: HEX.muted, width: 1.25, beginArrowType: "triangle" }, objectName: "arrow-out" });
    text(s, "deposit", { x: ax + 0.1, y: UW.y + 0.22, w: aw - 0.2, h: 0.28, fontSize: 10.5, color: GREEN, align: "center" });
    text(s, "withdraw", { x: ax + 0.1, y: UW.y + 1.12, w: aw - 0.2, h: 0.28, fontSize: 10.5, color: MUTED, align: "center" });

    // Accounts
    const AX = X0 + 8.75;
    const AW = CW - 8.75;
    const accts = [
      ["Vault PDA", '["vault", mint, risk_profile]', "Roles, limits, strategy, share totals"],
      ["Reserve PDA", '["reserve", vault]', "The deposited tokens; only the vault signs transfers out"],
      ["UserPosition PDA", '["position", vault, owner]', "One depositor's shares and pending withdrawal"],
    ];
    const ah = 1.47;
    accts.forEach(([name, seeds, body], i) => {
      const y = y0 + i * (ah + 0.2);
      card(s, { x: AX, y, w: AW, h: ah, fill: SURFACE, line: BORDER, name: `acct-${i}` });
      text(s, name, { x: AX + 0.25, y: y + 0.15, w: AW - 0.5, h: 0.3, fontSize: 14, bold: true, color: i === 1 ? GREEN : INK });
      text(s, seeds, { x: AX + 0.25, y: y + 0.47, w: AW - 0.5, h: 0.28, fontSize: 10.5, color: PURPLE, fontFace: "Courier New" });
      text(s, body, { x: AX + 0.25, y: y + 0.78, w: AW - 0.5, h: 0.5, fontSize: 11.5, color: MUTED });
      s.addShape(S.line, { x: P.x + P.w + 0.05, y: y + ah / 2, w: AX - (P.x + P.w) - 0.1, h: 0, line: { color: HEX.border, width: 1.25, endArrowType: "oval" }, objectName: `link-${i}` });
    });
    s.addNotes([
      "TIME: about 50 seconds.",
      "",
      "SAY THIS CLEARLY: this is a separate component, and it's a devnet prototype. It does not earn yield and it is not audited.",
      "",
      "Key message: the rules of the vault are enforced on-chain by the program, not by the website.",
      "",
      "Talking points:",
      "- The vault is one Anchor program on Solana devnet with 13 instructions.",
      "- It uses three kinds of account. These are PDAs: program-derived addresses, which only the program can sign for.",
      "  - Vault: the settings. Who the admins are, the limits, the strategy weights, the share totals. One per token and risk level.",
      "  - Reserve: holds the deposited tokens. Only the vault can sign a transfer out.",
      "  - UserPosition: one depositor's shares and any pending withdrawal.",
      "- The user signs a deposit or a withdrawal from their wallet. The program checks it's not paused, the deposit is at least the minimum and under the cap, and the withdrawal fits the instant limits. Anything larger goes through a 30-minute timelock.",
      "- Two admin roles: the authority changes settings and is the only one who can unpause. The guardian can only pause.",
      "",
      "Do NOT claim: that deposits earn yield, that funds go to Kamino, MarginFi, Drift or Save yet, or that it's audited. The allocator isn't built; deposits stay in the reserve.",
      "",
      "Transition: Each of those controls is a trade-off, so let me be explicit about them.",
    ].join("\n"));
  }

  /* ---------- 8. Safety controls ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solana vault" });
    s.addText("Security is not a badge. It is a set of explicit trade-offs", { placeholder: "title" });
    const controls = [
      [ic.check, "On-chain checks", "Pause, minimum and cap", "Rejects bad deposits and exits"],
      [ic.users, "2,000 per wallet / 24 h", "Instant withdrawal limit", "Limits a stolen wallet"],
      [ic.layers, "50,000 per vault / 24 h", "Instant limit, all users", "Slows a bank run"],
      [ic.timer, "30-minute timelock", "Above the instant limits", "Time to react; big exits wait"],
      [ic.pause, "Guardian pause", "Only the authority unpauses", "Fast stop; no escape hatch yet"],
      [ic.key, "Role-based admin", "Two-step authority handover", "One powerful key today"],
      [ic.calc, "Virtual share offset", "1,000 shares, 1 asset", "Stops share-price inflation"],
      [ic.test, "Automated tests", "10 unit + 5 integration", "Plus a local deploy rehearsal"],
    ];
    const cols = 4;
    const gap = 0.25;
    const cw = (CW - gap * (cols - 1)) / cols;
    const ch = 2.02;
    controls.forEach(([img, head, sub, trade], i) => {
      const x = X0 + (i % cols) * (cw + gap);
      const y = TOP + Math.floor(i / cols) * (ch + gap);
      card(s, { x, y, w: cw, h: ch, fill: SURFACE, line: BORDER, name: `control-${i}` });
      s.addImage({ data: img, x: x + 0.25, y: y + 0.25, w: 0.36, h: 0.36, altText: head });
      text(s, head, { x: x + 0.25, y: y + 0.72, w: cw - 0.45, h: 0.32, fontSize: 14, bold: true });
      text(s, sub, { x: x + 0.25, y: y + 1.05, w: cw - 0.45, h: 0.3, fontSize: 11.5, color: MUTED });
      text(s, trade, { x: x + 0.25, y: y + 1.48, w: cw - 0.45, h: 0.3, fontSize: 11.5, color: GREEN });
    });
    const NY = TOP + 2 * ch + gap + 0.2;
    card(s, { x: X0, y: NY, w: CW, h: 0.58, fill: SURFACE, line: AMBER, radius: 0.1, name: "not-yet" });
    text(s, [
      { text: "Not yet: ", options: { bold: true, color: AMBER } },
      { text: "audit · multisig authority · strategy-change delay · pause escape hatch · fuzz testing", options: { color: INK } },
      { text: "   (everything above runs on devnet only)", options: { color: MUTED } },
    ], { x: X0 + 0.3, y: NY + 0.08, w: CW - 0.6, h: 0.42, fontSize: 13, valign: "middle" });
    s.addNotes([
      "TIME: about 40 seconds.",
      "",
      "Key message: every control buys safety with something else, and I can name the cost of each one.",
      "",
      "Talking points (pick three, don't read all eight):",
      "- Two instant-withdrawal limits: 2,000 per wallet and 50,000 per vault every 24 hours. They limit the damage from a stolen wallet and slow a bank run. The cost: large withdrawals are slower.",
      "- Above the limits there's a 30-minute timelock: time to react before a big outflow. The cost: users wait.",
      "- The guardian can pause; only the authority can unpause. A fast emergency stop that one key can't abuse. The cost: today there's no escape hatch if the vault stays paused.",
      "- Shares use 1,000 virtual shares and 1 virtual asset, so the first depositor can't inflate the share price. The cost: tiny rounding losses.",
      "- Only the program's upgrade authority can create vaults, so nobody can front-run vault creation. The cost: that's a single powerful key.",
      "- Tests: 10 unit and 5 integration tests run against the compiled program on every change, and an automated job deploys it to a local test network and makes a real deposit and withdrawal.",
      "",
      "Do NOT call it audited or production-ready. Bottom line on the slide: devnet only.",
      "",
      "Transition: Enough slides. Let's look at it working.",
    ].join("\n"));
  }

  /* ---------- 9. Live demo ---------- */
  pres.addSection({ title: "Demo" });
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Demo" });
    s.addText("Let's see what works today", { placeholder: "title" });
    const colW = (CW - 0.4) / 2;
    const parts = [
      {
        tag: "A · LIVE", color: GREEN, title: "Comparison app", url: "stablesaver-web.vercel.app",
        shot: shots["01-home-hero"], alt: "Comparison app home: amount, estimated earnings and risk preference",
        steps: ["Open the site", "Enter an amount", "Switch Safe / Balanced / Bigger", "Open an option: the grade", "Show earnings after fees", "$100 + Ethereum: fees win"],
      },
      {
        tag: "B · DEVNET PROTOTYPE", color: PURPLE, title: "Vault", url: "Wallet on Solana devnet",
        shot: shots["06-vault-withdraw"], alt: "Vault withdraw screen: 2,000 now, the rest after a 30-minute timelock",
        steps: ["Switch wallet to devnet", "Open Vault", "Connect the wallet", "Deposit test tokens", "Show the position", "Withdraw: 2,000 now, rest waits"],
      },
    ];
    parts.forEach((p, i) => {
      const x = X0 + i * (colW + 0.4);
      card(s, { x, y: TOP, w: colW, h: 4.65, fill: SURFACE, line: BORDER, name: `demo-${i}` });
      chip(s, { x: x + 0.3, y: TOP + 0.28, w: i === 0 ? 1.05 : 2.25, label: p.tag, color: p.color, fontSize: 9.5 });
      text(s, p.title, { x: x + 0.3, y: TOP + 0.78, w: 3.4, h: 0.4, fontSize: 20, bold: true });
      text(s, p.url, { x: x + 0.3, y: TOP + 1.18, w: 3.4, h: 0.3, fontSize: 11.5, color: p.color });
      p.steps.forEach((st, k) => {
        const y = TOP + 1.65 + k * 0.47;
        numberBadge(s, { x: x + 0.3, y: y + 0.02, n: k + 1, d: 0.3, fontSize: 10.5, color: p.color });
        text(s, st, { x: x + 0.72, y, w: 2.9, h: 0.36, fontSize: 13, valign: "middle" });
      });
      const f = fit(p.shot.px, { x: x + 3.75, y: TOP + 0.3, w: colW - 4.0, h: 4.05 });
      card(s, { x: f.x - 0.05, y: f.y - 0.05, w: f.w + 0.1, h: f.h + 0.1, fill: NAVY, line: BORDER, radius: 0.1 });
      s.addImage({ path: p.shot.file, ...f, altText: p.alt, objectName: `demo-shot-${i}` });
    });
    const NY = TOP + 4.82;
    text(s, [
      { text: "Devnet tokens have no value. ", options: { bold: true, color: AMBER } },
      { text: "The vault doesn't move funds into yield protocols yet. Thumbnails: local build (demo data; vault in simulated preview).", options: { color: MUTED } },
    ], { x: X0, y: NY, w: CW, h: 0.4, fontSize: 11.5 });
    s.addNotes([
      "TIME: 15 seconds for the slide; the live demo itself takes 3 to 4 minutes if there's time. If time is short, skip Part B and show this slide only.",
      "",
      "SAY: Part A is live. Part B is a devnet prototype. Keep them separate.",
      "",
      "PART A — live comparison app (stablesaver-web.vercel.app)",
      "1. Open the site. Point out: no wallet or sign-up.",
      "2. Type an amount, e.g. $1,000, USDC.",
      "3. Click Play it safe, then Balanced, then Go bigger. The recommendation and the list change.",
      "4. Open the top option. Show the rate chart (drag across it), then \"How risky is it?\": the grade and each factor.",
      "5. Show \"What $1,000 could earn\" and \"You'd keep in a year\" after network fees.",
      "6. Type $100 and pick the Ethereum chip. If the live data still shows it, an option is marked \"Fees cost more than you'd earn\". If it doesn't, say so and move on.",
      "",
      "PART B — devnet vault",
      "Before the talk: Vercel has the three devnet variables set and redeployed; Solflare is on devnet with test tokens and a little devnet SOL; do one dry run.",
      "1. Show the wallet is on devnet (Solflare: Settings, Network, Devnet).",
      "2. Open Vault. The badge should say Devnet, not Preview.",
      "3. Connect the wallet.",
      "4. Deposit some test tokens; approve in the wallet.",
      "5. Show the position.",
      "6. Withdraw more than 2,000: 2,000 arrives now, the rest is requested and unlocks in 30 minutes. Don't wait for it live.",
      "",
      "Say out loud: devnet tokens have no value, and the vault doesn't deploy funds into Kamino or the others yet, so nothing earns here.",
      "",
      "Backup if the network fails: use these screenshots and the recorded run if you made one.",
    ].join("\n"));
  }

  /* ---------- 10. Status ---------- */
  pres.addSection({ title: "Status and roadmap" });
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Status and roadmap" });
    s.addText("What is live, what is experimental, and what comes next", { placeholder: "title" });
    const cols = [
      { head: "Live", color: GREEN, items: ["Stablecoin opportunity comparison", "DefiLlama-backed pool data", "Risk grades and explanations", "Fee-adjusted earnings estimates", "Optional API endpoints"] },
      { head: "Devnet prototype", color: PURPLE, items: ["Anchor vault program", "Deposits and shares", "Withdrawal limits and timelock", "Pause and authority controls"] },
      { head: "Not yet implemented", color: AMBER, items: ["Allocator into lending protocols", "Real yield through the vault", "Deployed balances read on-chain, not reported by an admin", "Production security assurances"] },
    ];
    const gap = 0.3;
    const cw = (CW - 2 * gap) / 3;
    const ch = 3.35;
    cols.forEach((c, i) => {
      const x = X0 + i * (cw + gap);
      card(s, { x, y: TOP, w: cw, h: ch, fill: SURFACE, line: c.color, name: `status-${i}` });
      text(s, c.head, { x: x + 0.3, y: TOP + 0.25, w: cw - 0.6, h: 0.4, fontSize: 18, bold: true, color: c.color });
      text(s, c.items.map((t, k) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: k < c.items.length - 1 } })), {
        x: x + 0.3, y: TOP + 0.8, w: cw - 0.55, h: ch - 1.0, fontSize: 13.5, paraSpaceAfter: 7, color: INK,
      });
    });
    const LY = TOP + ch + 0.3;
    text(s, "ALSO WORTH KNOWING", { x: X0, y: LY, w: 4, h: 0.28, fontSize: 10.5, bold: true, color: MUTED, charSpacing: 2 });
    const lims = ["One data source", "Fixed network-fee estimates", "Weights not back-tested", "Ranks on today's APY, not the 30-day average", "Bridge costs and risk not modelled", "Admin and upgrade-key risk"];
    const lw = (CW - 0.2 * 2) / 3;
    lims.forEach((l, i) => {
      const x = X0 + (i % 3) * (lw + 0.2);
      const y = LY + 0.38 + Math.floor(i / 3) * 0.5;
      s.addText(l, {
        shape: S.roundRect, rectRadius: 0.1, x, y, w: lw, h: 0.4,
        fill: { color: RAISED }, line: { color: BORDER, width: 0.75 },
        fontSize: 11.5, color: INK, align: "center", valign: "middle", margin: 0, isTextBox: true,
      });
    });
    s.addNotes([
      "TIME: about 35 seconds.",
      "",
      "Key message: I know exactly what's real, what's experimental and what's missing. That's a strength, not an apology.",
      "",
      "Talking points:",
      "- Live today: the comparison, DefiLlama-backed pool data, the grades with their reasons, fee-adjusted estimates, and an optional API (/v1/opportunities, /v1/estimate, /v1/strategies).",
      "- Devnet prototype: the Anchor vault with deposits, shares, withdrawal limits, the timelock, pause and authority controls.",
      "- Not yet: the allocator, so the vault earns nothing. Deployed balances must be read on-chain. Today deployed_assets is zero, and if an admin reported it, the share price would be whatever the admin says. That's why it has to be on-chain. And no production security assurances: no audit.",
      "- Other limits: one data source, fixed fee estimates, weights that are my judgement and not back-tested, ranking on today's APY rather than the 30-day average, bridging not modelled, and admin and upgrade-key risk.",
      "",
      "Transition: Here's the order I'll fix them in.",
    ].join("\n"));
  }

  /* ---------- 11. Roadmap ---------- */
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Status and roadmap" });
    s.addText([{ text: "From useful comparison tool", options: { breakLine: true } }, { text: "to a more complete on-chain system" }], { placeholder: "title" });
    const phases = [
      { n: "Phase 1", head: "Safety and correctness", color: GREEN, items: ["Escape hatch if a vault stays paused", "close_position to refund rent", "Fuzz the share math and limits"] },
      { n: "Phase 2", head: "Better recommendations", color: GREEN, items: ["Rank on the 30-day average APY", "Flag options that need funds moved between networks", "Back-test grades against past exploits"] },
      { n: "Phase 3", head: "Vault integration", color: PURPLE, items: ["One real Kamino lending strategy", "Tested against the real Kamino program on a local validator", "Deployed balance read on-chain"] },
      { n: "Phase 4", head: "Admin and expansion", color: PURPLE, items: ["Multisig authority", "Delay on strategy changes", "Blinks, alerts, read-only portfolio, more tokens"] },
    ];
    const gap = 0.28;
    const pw = (CW - 3 * gap) / 4;
    const lineY = TOP + 0.35;
    s.addShape(S.line, { x: X0 + 0.2, y: lineY, w: CW - 0.4, h: 0, line: { color: HEX.border, width: 2 }, objectName: "timeline" });
    phases.forEach((p, i) => {
      const x = X0 + i * (pw + gap);
      s.addShape(S.ellipse, { x: x + 0.2, y: lineY - 0.13, w: 0.26, h: 0.26, fill: { color: p.color }, line: { color: NAVY, width: 2 }, objectName: `dot-${i}` });
      text(s, p.n.toUpperCase(), { x: x + 0.6, y: lineY - 0.15, w: pw - 0.6, h: 0.3, fontSize: 11, bold: true, color: p.color, charSpacing: 2 });
      const y = lineY + 0.45;
      card(s, { x, y, w: pw, h: 3.95, fill: SURFACE, line: BORDER, name: `phase-${i}` });
      text(s, p.head, { x: x + 0.28, y: y + 0.28, w: pw - 0.5, h: 0.7, fontSize: 17, bold: true });
      p.items.forEach((it, k) => {
        const iy = y + 1.15 + k * 0.88;
        s.addShape(S.ellipse, { x: x + 0.3, y: iy + 0.09, w: 0.12, h: 0.12, fill: { color: p.color }, line: { color: p.color, width: 0 } });
        text(s, it, { x: x + 0.55, y: iy, w: pw - 0.8, h: 0.78, fontSize: 13, color: INK });
      });
    });
    chip(s, { x: X0, y: lineY + 4.55, w: 1.75, h: 0.32, label: "PLANNED WORK", color: AMBER, fontSize: 9.5, name: "planned-chip" });
    text(s, "None of this is built yet. Safety first, then the feature that makes the vault real.", { x: X0 + 2.0, y: lineY + 4.55, w: CW - 2.0, h: 0.32, fontSize: 12, italic: true, color: MUTED, valign: "middle" });
    s.addNotes([
      "TIME: about 30 seconds.",
      "",
      "Key message: the roadmap goes straight at the weaknesses I just listed. Safety first, then the feature that makes the vault real.",
      "",
      "Talking points:",
      "- Phase 1, safety: an escape hatch so withdrawals reopen if a vault stays paused too long; close_position to refund account rent; fuzz testing the share math and withdrawal limits.",
      "- Phase 2, recommendations: rank on the 30-day average instead of today's rate; flag options that need funds moved between networks; back-test the grades against past exploits.",
      "- Phase 3, the vault: one real Kamino lending integration, tested against the real Kamino program on a local validator, with the deployed balance read on-chain.",
      "- Phase 4: a multisig authority and a delay on strategy changes, then Solana Actions and Blinks, rate and grade alerts, a read-only portfolio view, and more tokens such as USDT and Token-2022.",
      "",
      "All of this is planned, none of it is built yet. Don't give dates you can't commit to.",
      "",
      "Transition: To wrap up.",
    ].join("\n"));
  }

  /* ---------- 12. Closing ---------- */
  pres.addSection({ title: "Close" });
  {
    const s = pres.addSlide({ masterName: "COVER", sectionTitle: "Close" });
    s.addImage({ path: mark, x: X0, y: 0.62, w: 0.4, h: 0.4, altText: "StableSave logo" });
    text(s, "StableSave", { x: X0 + 0.55, y: 0.62, w: 4, h: 0.4, fontSize: 20, bold: true, valign: "middle" });
    text(s, "Make stablecoin yield easier to understand before making it easier to chase.", {
      x: X0, y: 1.55, w: 8.2, h: 1.7, fontSize: 36, bold: true, lineSpacingMultiple: 0.95,
    });
    const contrib = [
      [ic.bars, "Simpler comparison", "Yield options in one place, ranked for your risk."],
      [ic.gauge, "Risk grades that show trade-offs", "A–D, with the reasons, and unknowns never guessed."],
      [ic.vault, "A separate Solana vault prototype", "Controlled deposits and withdrawals on devnet."],
    ];
    contrib.forEach(([img, head, body], i) => {
      const y = 3.55 + i * 0.82;
      s.addImage({ data: img, x: X0, y: y + 0.05, w: 0.4, h: 0.4, altText: head });
      text(s, head, { x: X0 + 0.6, y, w: 6.8, h: 0.32, fontSize: 16, bold: true });
      text(s, body, { x: X0 + 0.6, y: y + 0.33, w: 6.8, h: 0.3, fontSize: 12.5, color: MUTED });
    });
    // QR card
    const QX = W - X0 - 3.3;
    card(s, { x: QX, y: 1.55, w: 3.3, h: 4.35, fill: SURFACE, line: BORDER, transparency: 10, name: "qr-card" });
    s.addImage({ path: qr, x: QX + 0.45, y: 1.85, w: 2.4, h: 2.4, altText: "QR code linking to stablesaver-web.vercel.app" });
    text(s, "Try it now", { x: QX + 0.3, y: 4.42, w: 2.7, h: 0.32, fontSize: 15, bold: true, align: "center" });
    text(s, "stablesaver-web.vercel.app", { x: QX + 0.2, y: 4.75, w: 2.9, h: 0.3, fontSize: 12, color: GREEN, align: "center" });
    text(s, "Feedback welcome on risk scoring, vault security, and which integration to build next.", {
      x: QX + 0.25, y: 5.12, w: 2.8, h: 0.7, fontSize: 10.5, color: MUTED, align: "center",
    });
    text(s, [
      { text: "Theo", options: { bold: true, color: INK } },
      { text: "   ·   StableSave — Know the risk before you chase the yield.", options: { color: MUTED } },
    ], { x: X0, y: 6.45, w: 9, h: 0.4, fontSize: 13 });
    s.addNotes([
      "TIME: about 25 seconds, then questions.",
      "",
      "Key message: StableSave makes yield easier to understand before it makes yield easier to chase.",
      "",
      "Talking points:",
      "- Three things: simpler comparison across yield options; risk grades that show the trade-offs; and a separate Solana vault prototype that explores controlled deposits and withdrawals.",
      "- Scan the code to try it. No wallet needed.",
      "- I'd love feedback on three things: the risk scoring, the vault's security model, and which integration I should build next.",
      "- Close: StableSave. Know the risk before you chase the yield. Thank you.",
      "",
      "Likely questions and honest answers:",
      "- Does the vault earn yield? Not yet. Deposits stay in the reserve; the Kamino allocator is the next major build.",
      "- Is it audited? No. It's a devnet prototype.",
      "- Who controls the vault? One authority key today, plus a guardian that can only pause. A multisig and a delay on strategy changes are planned.",
      "- Why trust the grades? They're transparent: every factor and its reason is shown, and unknowns lower the grade. The weights are my judgement and not back-tested yet.",
      "- Why only DefiLlama? It covers every network without an API key. The trade-off is a single point of failure.",
    ].join("\n"));
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

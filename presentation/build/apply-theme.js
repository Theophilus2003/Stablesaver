// Writes the deck's theme colours into ppt/theme/theme1.xml. pptxgenjs sets the theme fonts but
// always writes Office's default palette, so scheme colours need this step after writeFile().
const fs = require("fs");
const JSZip = require(require.resolve("jszip", { paths: [require.resolve("pptxgenjs")] }));

const SLOTS = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];

async function applyTheme(file, theme) {
  for (const k of SLOTS) {
    if (!/^[0-9A-F]{6}$/i.test(theme.colors[k] ?? "")) throw new Error(`theme colour ${k} must be six hex digits`);
  }
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const part = "ppt/theme/theme1.xml";
  const xml = await zip.file(part).async("string");
  const scheme = `<a:clrScheme name="${theme.name}">${SLOTS.map((k) => `<a:${k}><a:srgbClr val="${theme.colors[k].toUpperCase()}"/></a:${k}>`).join("")}</a:clrScheme>`;
  const out = xml.replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, () => scheme);
  if (!out.includes(scheme)) throw new Error(`${part} has no colour scheme to replace`);
  zip.file(part, out);
  fs.writeFileSync(file, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

module.exports = { applyTheme };

// Bundles the Vite build into one self-contained HTML fragment (inline CSS +
// JS, no <html>/<head>/<body>) for hosting as a claude.ai Artifact.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
const html = readFileSync(join(dist, "index.html"), "utf8");
const cssHref = html.match(/<link rel="stylesheet"[^>]*href="\/?([^"]+)"/)?.[1];
const jsSrc = html.match(/<script type="module"[^>]*src="\/?([^"]+)"/)?.[1];
if (!cssHref || !jsSrc) throw new Error("Could not find built CSS/JS in dist/index.html — run `vite build` first.");

const css = readFileSync(join(dist, cssHref), "utf8");
const js = readFileSync(join(dist, jsSrc), "utf8").replace(/<\/script/gi, "<\\/script");

const out = `<title>ScamShield</title>
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
mkdirSync("dist-artifact", { recursive: true });
writeFileSync("dist-artifact/scamshield.html", out);
console.log(`dist-artifact/scamshield.html (${(out.length / 1024).toFixed(0)} KB)`);

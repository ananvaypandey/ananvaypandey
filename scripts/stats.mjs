import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const USER = process.env.GH_USER || "ananvaypandey";
const TOKEN = process.env.GITHUB_TOKEN || "";
const API = "https://api.github.com";

const headers = {
  "User-Agent": "ananvay-profile-stats",
  Accept: "application/vnd.github+json",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function api(path) {
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${res.statusText}`);
  return res.json();
}

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function num(n) {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

const user = await api(`/users/${USER}`);
const repos = [];
for (let page = 1; page < 20; page++) {
  const batch = await api(`/users/${USER}/repos?per_page=100&page=${page}&sort=updated`);
  repos.push(...batch);
  if (batch.length < 100) break;
}

const own = repos.filter((r) => !r.fork);
const stars = own.reduce((a, r) => a + (r.stargazers_count || 0), 0);
const langCount = new Map();
for (const r of own) {
  if (!r.language) continue;
  langCount.set(r.language, (langCount.get(r.language) || 0) + 1);
}
const allLangs = [...langCount.entries()].sort((a, b) => b[1] - a[1]);
const langs = allLangs.slice(0, 5);
const langTotal = allLangs.reduce((a, [, c]) => a + c, 0) || 1;
const since = new Date(user.created_at).getFullYear();

const defs = `
    <filter id="w" x="-6%" y="-6%" width="112%" height="112%">
      <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" seed="7" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="ws" x="-6%" y="-6%" width="112%" height="112%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="3" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <pattern id="g" width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="3" r="1" fill="#9a9281" opacity="0.2"/>
      <circle cx="14" cy="11" r="0.7" fill="#9a9281" opacity="0.14"/>
    </pattern>`;

const HAND = "'Comic Sans MS','Segoe Print','Bradley Hand','Chalkboard SE',cursive";
const MONO = "'Courier New',monospace";

function statsSvg() {
  const items = [
    ["repositories", num(user.public_repos)],
    ["stars earned", num(stars)],
    ["followers", num(user.followers)],
    ["following", num(user.following)],
  ];
  const boxes = items
    .map(([label, val], i) => {
      const x = 60 + i * 282;
      return `
    <g transform="translate(${x} 92)">
      <rect width="234" height="116" rx="14" fill="#fdfaf0" stroke="#211f1a" stroke-width="2.5" filter="url(#w)"/>
      <text x="117" y="54" text-anchor="middle" font-family="${HAND}" font-size="44" font-weight="700" fill="#3151c2">${esc(val)}</text>
      <text x="117" y="88" text-anchor="middle" font-family="${MONO}" font-size="13" letter-spacing="1" fill="#7a7365">${esc(label)}</text>
    </g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240" role="img" aria-label="GitHub stats for ${esc(USER)}">
  <defs>${defs}
  </defs>
  <rect width="1200" height="240" fill="#f6f1e3"/>
  <rect width="1200" height="240" fill="url(#g)"/>
  <rect x="16" y="16" width="1168" height="208" rx="18" fill="none" stroke="#211f1a" stroke-width="3" filter="url(#w)"/>

  <text x="60" y="66" font-family="${HAND}" font-size="30" fill="#211f1a" filter="url(#ws)">the ledger</text>
  <path d="M60 76 q 30 8 60 0" fill="none" stroke="#cf4a33" stroke-width="3" stroke-linecap="round" filter="url(#ws)"/>
  <text x="1140" y="64" text-anchor="end" font-family="${MONO}" font-size="12" fill="#9a9281">scribbling since ${since} &#183; refreshed by a little robot</text>
  ${boxes}
</svg>
`;
}

function langsSvg() {
  const colors = ["#3151c2", "#cf4a33", "#f2c14e", "#4e7a5e", "#211f1a"];
  const rows = langs
    .map(([name, count], i) => {
      const pct = count / langTotal;
      const w = Math.max(48, Math.round(pct * 720));
      const y = 118 + i * 32;
      return `
    <text x="70" y="${y + 15}" font-family="${HAND}" font-size="18" fill="#211f1a">${esc(name)}</text>
    <rect x="270" y="${y}" width="720" height="18" rx="9" fill="none" stroke="#9a9281" stroke-width="1.4" stroke-dasharray="3 7"/>
    <rect x="270" y="${y}" width="${w}" height="18" rx="9" fill="${colors[i % colors.length]}" opacity="0.9" filter="url(#w)"/>
    <text x="1110" y="${y + 14}" text-anchor="end" font-family="${MONO}" font-size="13" fill="#7a7365">${Math.round(pct * 100)}%</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 1200 300" role="img" aria-label="Top languages for ${esc(USER)}">
  <defs>${defs}
  </defs>
  <rect width="1200" height="300" fill="#f6f1e3"/>
  <rect width="1200" height="300" fill="url(#g)"/>
  <rect x="16" y="16" width="1168" height="268" rx="18" fill="none" stroke="#211f1a" stroke-width="3" filter="url(#w)"/>

  <text x="60" y="66" font-family="${HAND}" font-size="30" fill="#211f1a" filter="url(#ws)">ink by language</text>
  <path d="M60 76 q 30 8 60 0" fill="none" stroke="#cf4a33" stroke-width="3" stroke-linecap="round" filter="url(#ws)"/>
  <text x="1140" y="64" text-anchor="end" font-family="${MONO}" font-size="12" fill="#9a9281">primary language of ${own.length} public repos</text>
  ${rows}
</svg>
`;
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
writeFileSync(join(outDir, "stats.svg"), statsSvg());
writeFileSync(join(outDir, "langs.svg"), langsSvg());
console.log(
  `wrote stats.svg + langs.svg for ${USER} — ${own.length} own repos, ${stars} stars, top langs: ${langs
    .map(([n]) => n)
    .join(", ")}`,
);

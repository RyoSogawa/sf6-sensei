// 使い捨て検証スクリプト（throwaway probe）
// 目的: SuperCombo `SF6_FrameData` 全行を取得し、正規化の難所
//   (1) advantage 系の HTML/wiki マークアップ除去・数値化
//   (2) frames の条件値 "11(13)" 分解
//   (3) cancel / guard コード解析
//   (4) moveType -> category マップ
// が全 2306 技に対して破綻しないかをレポートする。
//
// 実行: node scripts/normalize-probe.mjs
// 本実装ではなく、ここで得た知見を packages/scraper の正規化に落とす。

// アクセス方針: spec.md「取得の許諾とアクセス方針」を厳守。
// `srk.shib.live/api.php` のみ・正直な識別 UA・低頻度・偽装しない。
const API = "https://srk.shib.live/api.php";
const UA = "sf6-sensei/0.1 (+https://github.com/RyoSogawa/sf6-sensei) personal-noncommercial";

const FIELDS = [
  "moveId", "chara", "input", "name", "moveType", "damage",
  "startup", "active", "recovery", "total",
  "hitAdv", "blockAdv", "punishAdv", "perfParryAdv",
  "guard", "cancel", "DRcancelHit", "DRcancelBlk",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchAllRows() {
  const rows = [];
  const limit = 500;
  for (let offset = 0; ; offset += limit) {
    const url =
      `${API}?action=cargoquery&tables=SF6_FrameData` +
      `&fields=${encodeURIComponent(FIELDS.join(","))}` +
      `&order_by=${encodeURIComponent("_rowID")}&limit=${limit}&offset=${offset}&format=json`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status} at offset ${offset}`);
    const json = await res.json();
    const batch = (json.cargoquery ?? []).map((r) => r.title);
    rows.push(...batch);
    if (batch.length < limit) break;
    await sleep(150); // be polite
  }
  return rows;
}

// --- 正規化関数（プロトタイプ） ---

// HTML タグと wiki 強調 ''' を除去
const stripMarkup = (s) =>
  String(s ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/'''?/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

// advantage を数値化。数値化できなければ null + rawText を返す
function parseAdvantage(raw) {
  const text = stripMarkup(raw);
  const m = text.match(/^[+]?(-?\d+)$/);
  return { value: m ? Number(m[1]) : null, text };
}

// frames: 主値 + 括弧内の条件値。"11(13)" -> {primary:11, alt:13}
function parseFrames(raw) {
  const text = stripMarkup(raw);
  const primary = text.match(/-?\d+/);
  const complex = /[^\d()\s+*x~-]/.test(text) || /[+*x~]/.test(text);
  return { primary: primary ? Number(primary[0]) : null, text, complex };
}

const CANCEL_MAP = {
  Chn: "chain", Sp: "special", SA: "super", TC: "target_combo",
  DR: "drive_rush", "-": "none", CA: "critical_art",
};
const GUARD_MAP = { L: "low", H: "high", LH: "low_high", T: "throw", Throw: "throw", "-": "none", Air: "air" };

function parseCancel(raw) {
  const text = stripMarkup(raw);
  if (!text || text === "-") return { codes: [], unknown: [] };
  const tokens = text.split(/\s+/);
  const codes = [], unknown = [];
  for (const t of tokens) (CANCEL_MAP[t] ? codes : unknown).push(CANCEL_MAP[t] ?? t);
  return { codes, unknown };
}

function parseGuard(raw) {
  const text = stripMarkup(raw);
  if (!text) return { value: null, unknown: [] };
  return GUARD_MAP[text]
    ? { value: GUARD_MAP[text], unknown: [] }
    : { value: null, unknown: [text] };
}

// --- レポート ---
function add(map, key) { map.set(key, (map.get(key) ?? 0) + 1); }
function topEntries(map, n = 30) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([k, v]) => `    ${JSON.stringify(k)}: ${v}`).join("\n");
}

async function main() {
  console.log("Fetching all SF6_FrameData rows...");
  const rows = await fetchAllRows();
  console.log(`Fetched ${rows.length} rows.\n`);

  const advFields = ["hitAdv", "blockAdv", "punishAdv", "perfParryAdv", "DRcancelHit", "DRcancelBlk"];
  const frameFields = ["startup", "active", "recovery", "total"];

  const advNonNumeric = new Map();   // フィールド別 数値化できなかった値
  const advCounts = {};              // フィールド別 numeric / nonNumeric / empty
  const frameComplex = new Map();    // 複雑な frames 表記
  const frameNullPrimary = [];       // 主値が取れなかった行
  const moveTypes = new Map();
  const cancelUnknown = new Map();
  const guardUnknown = new Map();
  const residualMarkup = [];         // 除去後も < > ' が残る = regex 漏れ

  for (const f of advFields) advCounts[f] = { numeric: 0, nonNumeric: 0, empty: 0 };

  for (const row of rows) {
    for (const f of advFields) {
      const rawText = String(row[f] ?? "");
      if (!stripMarkup(rawText)) { advCounts[f].empty++; continue; }
      const { value, text } = parseAdvantage(rawText);
      if (value === null) { advCounts[f].nonNumeric++; add(advNonNumeric, `${f}=${text}`); }
      else advCounts[f].numeric++;
      if (/[<>']/.test(stripMarkup(rawText))) residualMarkup.push(`${f}: ${rawText}`);
    }
    for (const f of frameFields) {
      const { primary, text, complex } = parseFrames(row[f]);
      if (text && primary === null) frameNullPrimary.push(`${row.chara} ${row.input} ${f}="${text}"`);
      if (complex && text) add(frameComplex, `${f}=${text}`);
    }
    add(moveTypes, row.moveType ?? "(none)");
    for (const u of parseCancel(row.cancel).unknown) add(cancelUnknown, u);
    for (const u of parseGuard(row.guard).unknown) add(guardUnknown, u);
  }

  console.log("=== advantage fields: numeric / non-numeric / empty ===");
  for (const f of advFields) console.log(`  ${f}:`, advCounts[f]);

  console.log("\n=== distinct NON-NUMERIC advantage values (after markup strip) ===");
  console.log(topEntries(advNonNumeric));

  console.log("\n=== residual markup after strip (should be empty) ===");
  console.log(residualMarkup.length ? residualMarkup.slice(0, 20).join("\n") : "  (none — strip is clean)");

  console.log("\n=== distinct moveType values ===");
  console.log(topEntries(moveTypes, 50));

  console.log("\n=== complex frame notations (sample) ===");
  console.log(topEntries(frameComplex, 25));

  console.log("\n=== frames where primary number not extracted ===");
  console.log(frameNullPrimary.length ? frameNullPrimary.slice(0, 20).join("\n") : "  (none)");

  console.log("\n=== unknown cancel tokens ===");
  console.log(cancelUnknown.size ? topEntries(cancelUnknown) : "  (none — all tokens mapped)");

  console.log("\n=== unknown guard values ===");
  console.log(guardUnknown.size ? topEntries(guardUnknown) : "  (none — all mapped)");
}

main().catch((e) => { console.error(e); process.exit(1); });

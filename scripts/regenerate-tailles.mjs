#!/usr/bin/env node
// Regénère les rappels de taille (base "🗓️ Interventions" de Notion) à partir
// des fenêtres définies sur la base "🌱 Plantes" (champ "Config taille").
//
// À lancer ~1×/an (ex. chaque janvier). Génère les plages pour l'année en cours
// (celles encore à venir) + l'année suivante. Idempotent : on peut le relancer
// sans créer de doublons.
//
// PRÉREQUIS (setup unique) :
//   1. Créer une intégration interne Notion : https://www.notion.so/my-integrations
//   2. Partager les 2 bases avec cette intégration (menu ••• > Connexions).
//   3. Exporter le token :  export NOTION_TOKEN="secret_xxx"
//
// USAGE :
//   node regenerate-tailles.mjs            # applique les changements
//   node regenerate-tailles.mjs --dry-run  # affiche ce qui serait fait, sans écrire

const TOKEN = process.env.NOTION_TOKEN;
const DRY_RUN = process.argv.includes("--dry-run");

// --- Identifiants des bases (ne pas modifier sauf refonte) ---
const PLANTES_DB = "19ef89222c964471bb6456ae2f618bce";
const INTERVENTIONS_DB = "6b1aba77041b4935889e8988553e54fe";

// --- Noms des propriétés (doivent correspondre à Notion) ---
const P = {
  titre: "Plante",
  config: "Config taille",
  interTitre: "Intervention",
  date: "Date",
  plante: "Plante", // relation dans Interventions
  fait: "Fait",
  typeTaille: "Type de taille",
  typeInter: "Type d'intervention",
};

const NOTION = "https://api.notion.com/v1";
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, "0");
const lastDay = (year, month) => new Date(year, month, 0).getDate(); // month 1-based

async function api(method, path, body) {
  const res = await fetch(`${NOTION}${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${txt}`);
  }
  await sleep(340); // respecter la limite de débit de Notion (~3 req/s)
  return res.json();
}

// Parcourt toutes les pages d'une base (pagination).
async function queryAll(dbId, filter) {
  const out = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (filter) body.filter = filter;
    if (cursor) body.start_cursor = cursor;
    const data = await api("POST", `/databases/${dbId}/query`, body);
    out.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return out;
}

// "05-06:après floraison | 10:entretien" -> [{start:5,end:6,type:...}, {start:10,end:10,type:...}]
function parseConfig(raw) {
  if (!raw) return [];
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf(":");
      const months = idx === -1 ? part : part.slice(0, idx);
      const type = idx === -1 ? "entretien" : part.slice(idx + 1).trim();
      const [a, b] = months.trim().split("-").map((n) => parseInt(n, 10));
      return { start: a, end: b || a, type };
    })
    .filter((w) => w.start >= 1 && w.start <= 12 && w.end >= 1 && w.end <= 12);
}

const richText = (prop) => (prop?.rich_text || []).map((t) => t.plain_text).join("");
const title = (prop) => (prop?.title || []).map((t) => t.plain_text).join("");

async function main() {
  if (!TOKEN) {
    console.error("❌ NOTION_TOKEN manquant. Voir les prérequis en tête du fichier.");
    process.exit(1);
  }

  const today = new Date();
  const todayISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const years = [today.getFullYear(), today.getFullYear() + 1];
  console.log(`📅 Regénération pour ${years.join(" et ")} (à partir du ${todayISO})${DRY_RUN ? " [DRY-RUN]" : ""}\n`);

  // 1) Lire les plantes et calculer les occurrences souhaitées.
  const plantes = await queryAll(PLANTES_DB);
  const desired = [];
  for (const page of plantes) {
    const nom = title(page.properties[P.titre]);
    const windows = parseConfig(richText(page.properties[P.config]));
    for (const w of windows) {
      for (const year of years) {
        const start = `${year}-${pad(w.start)}-01`;
        const end = `${year}-${pad(w.end)}-${pad(lastDay(year, w.end))}`;
        if (start < todayISO) continue; // on ne crée pas de rappel dans le passé
        desired.push({ plantId: page.id, nom, start, end, type: w.type });
      }
    }
  }
  desired.sort((a, b) => a.start.localeCompare(b.start));
  console.log(`🌱 ${plantes.length} plantes → ${desired.length} rappels à générer.`);

  // 2) Archiver les anciens rappels de TAILLE futurs et non faits (pour éviter les doublons).
  //    On préserve : les tailles déjà cochées "Fait", les rappels passés, et les autres
  //    types d'intervention (arrosage, traitement…).
  const stale = await queryAll(INTERVENTIONS_DB, {
    and: [
      { property: P.typeInter, select: { equals: "Taille" } },
      { property: P.fait, checkbox: { equals: false } },
      { property: P.date, date: { on_or_after: todayISO } },
    ],
  });
  console.log(`🧹 ${stale.length} anciens rappels à remplacer.`);

  if (DRY_RUN) {
    for (const d of desired) console.log(`  + ${d.start}→${d.end}  ${d.nom} (${d.type})`);
    console.log("\n[DRY-RUN] Aucune écriture effectuée.");
    return;
  }

  for (const s of stale) {
    await api("PATCH", `/pages/${s.id}`, { archived: true });
  }

  // 3) Créer les nouveaux rappels.
  let created = 0;
  for (const d of desired) {
    await api("POST", `/pages`, {
      parent: { database_id: INTERVENTIONS_DB },
      properties: {
        [P.interTitre]: { title: [{ text: { content: `✂️ ${d.nom}` } }] },
        [P.date]: { date: { start: d.start, end: d.end } },
        [P.plante]: { relation: [{ id: d.plantId }] },
        [P.typeTaille]: { select: { name: d.type } },
        [P.typeInter]: { select: { name: "Taille" } },
      },
    });
    created++;
  }

  console.log(`\n✅ Terminé : ${stale.length} archivés, ${created} créés.`);
}

main().catch((e) => {
  console.error("\n❌ Échec :", e.message);
  process.exit(1);
});

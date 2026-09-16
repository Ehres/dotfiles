# Tamago — idées d'évolution

Brainstorm du 2026-09-11. Aucune de ces idées n'est engagée : ce fichier sert de
backlog. Une idée retenue passe par un spec dans `docs/superpowers/specs/`
avant implémentation.

## État des lieux

Ce que Tamago fait aujourd'hui :

- Sprite ASCII 11×5 (`core/sprites.ts`), 5 stades linéaires pilotés par l'XP
  cumulé (`core/stage.ts`) : egg → hatchling → young → adult → elder.
- 6 activités de session (`core/state.ts`) : idle, thinking, working, waiting,
  hurt, sleeping. Animation des yeux et d'une "marque" à côté de la tête.
- Transitions et comptage purs (`core/transition.ts`, `core/count.ts`), translator SDK → événements internes ciblés par session
  (`adapter/translate.ts`), persistance multi-instances avec lock et rename
  atomique (`adapter/store.ts`, `core/merge.ts`).
- Deux vues Solid : sidebar (`view/sidebar.tsx`, slot `sidebar_footer`) et
  home (`view/home.tsx`, slot `home_bottom`). Un toast à chaque évolution.
- Species tirée à l'éclosion et stockée (`core/species.ts`) : cat et owl en
  common, dragon en legendary ; le Pace de la Rarity ralentit le Growth
  (`core/stage.ts`) ; un corps par Species et par Stage, œuf commun
  (`core/sprites.ts`) ; Cue `hatched` et toast de révélation.

Compteurs persistés dans `Career` : sessions, prompts, tools par kind
(read/edit/bash/other), filesEdited, errors, hatchedAt.

## Ce que l'API OpenCode 1.18 offre et qu'on n'utilise pas

Source : `@opencode-ai/plugin/dist/tui.d.ts` et `@opencode-ai/sdk` v2.

- `api.state.session` : `todo(id)`, `diff(id)` (fichiers modifiés avec
  additions/deletions), `status(id)`, `permission(id)`, `question(id)`,
  `messages(id)`. Permet de réagir à l'état de session sans lire le contenu
  des prompts.
- `api.keymap.registerLayer({ commands, bindings })` : commandes dans la
  palette et raccourcis clavier. `api.command` est déprécié.
- `api.ui.DialogAlert`, `DialogConfirm`, `DialogPrompt`, `DialogSelect`,
  `api.ui.dialog` (stack) : écrans modaux.
- `api.attention.notify` et `api.attention.soundboard.registerPack` :
  notifications système et sons personnalisés.
- `api.kv.get/set` : petites préférences persistées côté TUI (mute, nom).
- Slots non utilisés : `session_prompt_right`, `home_prompt_right`,
  `sidebar_content`, `app_bottom`, `home_footer`.
- Événements SDK intéressants non souscrits : `todo.updated`, `session.diff`,
  `session.compacted`, `session.next.reasoning.started/ended`,
  `session.next.retried`, `session.next.step.failed`, `question.asked`,
  `vcs.branch.updated`, `lsp.updated`, `file.watcher.updated`.

## Idées

### 1. Bulle de dialogue

**Fait le 2026-09-14**, templates locaux et mode muet, voir
`docs/superpowers/specs/2026-09-14-tamago-bubble-design.md`. La variante LLM
ci-dessous reste une idée.

Une bulle ASCII à côté du sprite dans la sidebar, avec une queue vers la tête :

```
   .---.      .------------------.
  ( o o )  o (  Tu me laisses ?   )
   \ ^ /      '------------------'
    '-'
```

Deux sources possibles pour le texte.

**Templates locaux, zéro LLM (recommandé en première étape).** Des phrases par
activité et par événement, choisies au hasard avec un cooldown. Exemples :

| Déclencheur                              | Exemple de phrase          |
| ---------------------------------------- | -------------------------- |
| `permission_asked`                       | "Tu me laisses ?"          |
| 3 `tool_failed` en 30 s                  | "Ça s'acharne..."          |
| `session.compacted`                      | "J'ai la tête vide"        |
| réveil après `sleeping`                  | "Mmh ? Déjà ?"             |
| diff de session > N fichiers             | "C'est un gros chantier"   |
| tous les todos cochés                    | "Et voilà."                |
| évolution                                | "Je me sens... différent." |

Avantages : aucun coût, aucune latence, aucune fuite de contenu.

**Génération LLM via `api.client`.** Comme Claude Buddy. Coût en tokens et
risque d'envoyer du contexte. À réserver éventuellement à `session_idle`, avec
un résumé agrégé (compteurs, nombre de fichiers) et jamais le texte des
messages.

Décisions à prendre : durée d'affichage (opencode-pets utilise 5 s), fréquence
maximale (une bulle toutes les 10 s), retour à la ligne selon la largeur de la
sidebar, mode muet persistant via `api.kv`.

### 1b. Réponse à la permission

**Fait le 2026-09-15.** Cues `granted` et `denied`, fenêtre de 30 s, une
réponse par question, seulement si la bulle « May I? » est réellement sortie.

Quand Tamago a demandé « May I? » et que l'utilisateur répond dans les 30 s,
une seconde bulle répond à la réponse : `granted` (« Thanks! », « On it. »)
sur `once`/`always`, `denied` (« Oh. Okay. », « Fair enough. ») sur `reject`.

- `permission_replied` gagne `granted: boolean` ; `permission.replied` porte
  déjà `reply: "once" | "always" | "reject"`.
- Deux Cues de priorité 2 pour remplacer la bulle « May I? » malgré la
  fenêtre de silence ; sans question posée récemment, aucune réponse, donc pas
  de bulle à chaque permission.
- Touche `core/events.ts`, `core/voice.ts`, `adapter/translate.ts` et leurs
  tests ; rien dans `index.tsx` ni les vues.

### 2. Personnalité et nom

**Fait le 2026-09-15**, voir `docs/superpowers/specs/2026-09-15-tamago-character-design.md`.
Deux traits calculés, jamais stockés : Temperament par hash de `hatchedAt`,
Vocation (Craft par table de poids, Stance par ratio questions / prompts) à
partir de `young`. Surfaces : bulles, pet, carte. La sidebar ne change pas.

Aujourd'hui `name` vient des options du plugin. Tirer un tempérament à
l'éclosion (sarcastique, encourageant, stoïque) qui filtre les templates de la
bulle, stocké dans `career.json`.

Variante sans aléatoire : la personnalité dérive des compteurs réels.

- `bash` domine → "hacker"
- `read` domine → "bibliothécaire"
- `edit` domine → "scribe"
- ratio erreurs élevé → "cicatrisé"

Référence : Claude Buddy utilise 5 stats (DEBUGGING, PATIENCE, CHAOS, WISDOM,
SNARK) tirées de façon déterministe depuis l'id utilisateur, et un nom plus une
personnalité générés une fois par LLM puis persistés.

Le pet (idée 6) est le premier endroit où le tempérament se voit : chaque
tempérament a sa propre famille de réactions.

### 3. Évolutions ramifiées

**Abandonnée le 2026-09-16.** La Species (idée 12) est la seule chose qui
dessine le corps ; deux systèmes qui redessinent le corps ne cohabitent pas.
Le Craft s'exprime par la voix et la carte, éventuellement par une marque,
jamais par la forme.

### 4. Accessoires et rareté

Un chapeau ou une aura débloquée à des jalons : 1 000 outils, 100 sessions,
première session après minuit. Rendu sur la ligne 0 du sprite, à la place de la
marque actuelle.

Préalable posé le 2026-09-15 (audit) : la ligne 0 porte déjà la marque
d'Activity et le cœur du pet, et une `Frame` est une liste de chaînes
monochromes. Avant les accessoires, passer la `Frame` en segments typés (corps,
yeux, marque, accessoire) dans `core/sprites.ts`, rendus par `view/portrait.tsx`
et `view/card.tsx`. Refactor différé : rien ne le demande tant que 4 ou 10 n'est
pas retenu.

Référence : Claude Buddy a 8 chapeaux gatés par rareté (Common 60 %, Uncommon
25 %, Rare 10 %, Epic 4 %, Legendary 1 %) et une variante "shiny" à 1 % avec
shimmer arc-en-ciel. Ici on préférerait un déblocage par achievements plutôt
que par tirage.

### 5. Achievements et streaks

`Career` a déjà tous les compteurs. Ajouter `lastSeenDay`, `streak`, et une
liste d'achievements débloqués avec toast à l'obtention.

Candidats :

- "Night owl" : session après minuit
- "Centurion" : 100 prompts
- "Marathon" : session > 1 h
- "Polyglotte" : 5 extensions de fichiers différentes (nécessite d'observer
  `file.edited`)
- "Phénix" : 10 erreurs dans une session puis session idle sans erreur
- "Tool master" : tous les kinds utilisés

Attention : `core/merge.ts` doit gérer l'union des achievements et le max des
streaks lors du merge multi-instances, ce qu'il ne fait pas aujourd'hui.

Référence : l'issue Claude Code #59081 propose streaks quotidiens, badges,
événements saisonniers et un "journal" hebdomadaire écrit par le pet.

### 6. Interaction directe (commandes)

Via `api.keymap.registerLayer`, dans la palette. **`mute`, `card` et `pet`
faits le 2026-09-15.** Le pet n'est pas une Bubble : la bulle est la voix de
la session, le pet vient de l'utilisateur, donc il se voit sur le sprite
lui-même (yeux `^ ^` et `♥` à la place de la marque, 2 s, dans toute la
fenêtre). La carte montre l'identité seule : sprite, stade, XP, âge, barre.
Les compteurs détaillés n'intéressent pas. **`rename` fait le 2026-09-15** :
le Nom vit dans la Career (`name: { value, at }`), le plus récent gagne au
merge, ce qui reste commutatif.

- ~~`tamago.pet`~~ : cœur flottant 2 s au-dessus du sprite (comme `/buddy pet`).
  Geste d'interaction pur, décidé le 2026-09-15 : il ne compte rien et ne
  change rien à la Career, Tamago n'ayant aucun besoin à satisfaire. Sa valeur
  vient de la réaction, qui doit varier selon le tempérament (idée 2) : le pet
  devient la manière de découvrir qui est son Tamago. Sans personnalité, une
  réaction unique suffit pour poser le geste.
- ~~`tamago.card`~~ : carte d'identité (sprite, stade, XP, âge). Les
  achievements s'y ajouteront avec l'idée 5.
- ~~`tamago.rename`~~ : `DialogPrompt`, nom stocké dans `career.json`
- ~~`tamago.mute`~~ : bulle silencieuse
- ~~`tamago.reset`~~ : remplacé le 2026-09-16 par `tamago.hatch` et
  `tamago.switch` du lot 2 de l'idée 12. On n'efface jamais une Career : on
  en éclot une nouvelle à côté, si tous les Tamago de la machine sont elder.

Excellent rapport valeur/effort après la bulle.

### 7. Réactions plus fines aux événements

Enrichir le reducer et le translator :

- `question.asked` → activité "curious", yeux `? ?` (le compteur et l'attente
  existent depuis l'idée 2 ; reste la bulle)
- `session.next.retried` → activité "dizzy", yeux `@ @`
- `session.compacted` → bâillement bref
- `todo.updated` avec tout coché → célébration courte
- `session.next.reasoning.started` → "thinking" plus fiable que `prompt_sent`
- `vcs.branch.updated` → petit clin d'œil

Animations de transition : un flash `*` autour du sprite à l'évolution au lieu
du seul toast. Une animation d'éclosion au premier lancement.

### 8. Vue home enrichie

Aujourd'hui sprite + barre d'XP. Ajouter un journal court : "Hier : 42 prompts,
13 fichiers, 2 erreurs", plus l'âge en jours depuis `hatchedAt`.

Nécessite un historique par jour dans `career.json` (fenêtre glissante de 30
jours) et sa règle de merge.

### 9. Sons et notifications

`api.attention.soundboard.registerPack` permet un pack : bip d'éclosion, cri à
l'erreur, ronflement à l'endormissement. À limiter à l'évolution et à
`permission_asked` pour ne pas agacer. Respecter `tuiConfig.attention.enabled`.

### 10. Rendu et couleur

Le sprite est monochrome par activité. OpenTUI permet des `<span>` colorés :
yeux d'une couleur, corps d'une autre, accessoire en `theme.warning`. Les stades
supérieurs pourraient utiliser des caractères de dessin de boîte, avec repli
ASCII si nécessaire.

Même préalable que l'idée 4 : la `Frame` en segments.

### 11. Gamification : Milestones, Draws, Picks et Traits

Direction posée le 2026-09-15, précisée le même jour, voir `CONTEXT.md` et
`docs/superpowers/specs/2026-09-15-tamago-milestones-design.md`. Pas de run
par OpenCode session : une session n'a pas de fin, n'est pas comparable à une
autre et s'ouvre gratuitement.

**Le drift.** Le deck-building a été abandonné comme forme : sans run, une
carte n'a nulle part où être jouée et devient un badge. Ce qu'on garde du
genre, c'est le choix « 1 parmi 3 » et les synergies ; ce qu'on laisse, c'est
la collection comptée. Une collection, si elle revient, ce sera plusieurs
Tamago sur une machine.

**Fondations faites le 2026-09-15**, tables vides, runtime inchangé :

- `Career.picks` : un Pick par Milestone, `{ trait, at }`, le plus ancien gagne
  au merge (`core/pick.ts`, miroir inversé de `latest()`).
- `core/milestone.ts` : Milestones calculés depuis les compteurs, par Stage ou
  par mesure (sessions, prompts, filesEdited, questions, tools, xp ; jamais
  errors).
- `core/trait.ts` : Traits tenus et éligibles, synergies par `needs`.
- `core/draw.ts` : Draw déterministe (FNV-1a sur `hatchedAt:milestone`,
  mulberry32, Fisher-Yates), `pending` pour la file des Milestones à offrir.

**Reste à faire**, dans cet ordre :

- Le premier Milestone réel (l'Évolution vers hatchling) et deux ou trois
  Traits de Voice ; la Bubble qui annonce un Draw pending puis le
  `DialogSelect` ; le Pick fait comme un rename (`addDelta` puis `show`).
- L'effet des Traits sur les trois surfaces : `voice.ts` choisit ses phrases
  par Trait tenu en plus du Temperament, le Sprite gagne une marque, un Cue
  s'active.
- Les Traits tenus sur la carte (`tamago.card`).
- Les Milestones par événement (« premier bash après minuit »), non dérivables
  des compteurs : une map `reached` fusionnée par plus ancienne date, même forme
  que `picks`.
- Contraintes qui tiennent : pas de mort, jamais de retrait sur la Career,
  aucun Trait n'est une punition, pas de lecture de contenu, merge commutatif,
  pas de re-roll.

### 12. Species : créatures, rareté, roster et feuille de caractère

Brainstorm du 2026-09-15 et 2026-09-16. Une **Species** est ce qu'un Tamago
est, décidée à l'éclosion, jamais changée : un corps par Stage à partir de
hatchling (l'œuf est commun et ne révèle rien), une **Rarity** parmi common,
uncommon, rare, epic, legendary qui fixe le poids de tirage (60 / 25 / 10 /
4 / 1) et le **Pace** (1 / 0,8 / 0,5 / 0,4 / 0,25) : plus rare, plus lent à
grandir, jamais l'inverse, pour que le commun ne soit pas la punition de la
majorité. La Species est stockée dans la Career pour qu'ajouter une Species
ne réassigne jamais un Tamago existant ; une Career sans Species est le
`cat` de référence. Pas de re-roll : la seule façon d'avoir une autre Species
est un nouvel œuf, donc une nouvelle Career.

Quatre lots :

1. **Species visuelle**, **fait le 2026-09-16**, voir
   `docs/superpowers/specs/2026-09-15-tamago-species-design.md`. Table,
   tirage, stockage, Pace, Sprites de cat / owl / dragon, révélation à
   hatchling. Seul, il ne se voit qu'à une nouvelle éclosion.
2. **Roster.** Plusieurs Careers sur la machine, une seule active ; Delta
   ciblé par identifiant de Career, pour qu'une fenêtre ouverte avant une
   éclosion crédite encore l'ancien Tamago ; migration du `career.json`
   actuel ; commandes `tamago.hatch` (porte : au plus un Tamago sous elder à
   la fois) et `tamago.switch` (`DialogSelect` : nom, Species, Rarity,
   Stage). Rend le lot 1 jouable et donne un sens à la Rarity.
3. **Feuille de caractère.** Huit colonnes tirées depuis `hatchedAt` : quatre
   colonnes Temperament lues au maximum, quatre colonnes de comportement lues
   en valeur, Énergie (`SLEEP_MS`, `FAST_MS` / `SLOW_MS`), Bavardage
   (`QUIET_MS`, `BUBBLE_MS`), Sensibilité (`HURT_MS`, `STREAK_COUNT`),
   Patience (`LONG_WORK_MS`). La Species ajoute ses modificateurs par colonne
   (+1, –3) et la valeur médiane redonne le comportement d'aujourd'hui. À
   modificateurs nuls, la feuille doit redonner exactement le Temperament
   actuel : la colonne du Temperament historique reçoit la valeur haute du
   tirage, les trois autres se tirent en dessous.
4. **Enrichissements.** Phrases signature par Species mêlées à celles du
   Temperament, dessin des Species suivantes jusqu'à la vingtaine, vue de
   collection, œuf teinté par Rarity.

Contraintes qui tiennent : aucune Species n'est une punition, pas de lecture
de contenu, merge commutatif, pas de re-roll, jamais de retrait sur la Career,
donc jamais de suppression d'une Career du roster.

## Ordre recommandé

1. ~~Bulle avec templates locaux, plus mode muet.~~ Fait.
1b. ~~Réponse à la permission.~~ Fait.
2. ~~Commandes dans la palette : pet, card, mute, rename.~~ Fait.
3. ~~Species visuelle (idée 12, lot 1).~~ Fait.
4. Roster (idée 12, lot 2) : ce qui rend les Species jouables.
5. Feuille de caractère (idée 12, lot 3), une fois plusieurs Species sous les
   yeux.
6. Gamification (idée 11) : le premier Milestone et le `DialogSelect` ; les
   Traits de Voice s'écriront contre la feuille.
7. Achievements et streak, avec le journal (idée 8), après une semaine d'usage
   réel des Species.
8. Enrichissements Species (idée 12, lot 4), accessoires et couleur (idées 4
   et 10) sur la `Frame` en segments.

## Références

- Claude Buddy mechanics : https://claudefa.st/blog/guide/mechanics/claude-buddy
- Claude Code /buddy (DEV) : https://dev.to/raxxostudios/claude-code-buddy-the-terminal-tamagotchi-that-broke-the-internet-2lgj
- usik/tamagotchi (soins, 6 stades, branches, hooks agents) : https://github.com/usik/tamagotchi
- opencode-pets (bulles contextuelles, moods depuis SSE) : https://github.com/varoyik/opencode-pets
- Claude Code issue #59081, compagnon adaptatif : https://github.com/anthropics/claude-code/issues/59081
- opencode-better-sidebar (exemples de plugins TUI) : https://github.com/streetturtle/opencode-better-sidebar
- OpenCode issue #28902, slots TUI : https://github.com/anomalyco/opencode/issues/28902

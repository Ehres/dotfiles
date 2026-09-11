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

### 2. Personnalité et nom

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

### 3. Évolutions ramifiées

Les 5 stades sont linéaires. Le Tamagotchi original branche la forme adulte
selon la qualité des soins. Ici la branche dépendrait du ratio d'outils :

- "scribe" si edit domine
- "shell" si bash domine
- "sage" si read domine
- chemin "maudit" si errors / tools est élevé

Implémentation : indexer `BODIES` par stade + branche au lieu du stade seul. La
branche se calcule depuis `Counters`, comme `stage()`.

### 4. Accessoires et rareté

Un chapeau ou une aura débloquée à des jalons : 1 000 outils, 100 sessions,
première session après minuit. Rendu sur la ligne 0 du sprite, à la place de la
marque actuelle.

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

Via `api.keymap.registerLayer`, dans la palette :

- `tamago.pet` : cœur flottant 2 s au-dessus du sprite (comme `/buddy pet`)
- `tamago.card` : `DialogAlert` avec la carte complète (sprite, stade, XP,
  compteurs par outil, âge, achievements)
- `tamago.rename` : `DialogPrompt`, nom stocké dans `career.json` ou `api.kv`
- `tamago.mute` / `tamago.unmute` : bulle silencieuse
- `tamago.reset` : `DialogConfirm` puis œuf frais

Excellent rapport valeur/effort après la bulle.

### 7. Réactions plus fines aux événements

Enrichir le reducer et le translator :

- `question.asked` → activité "curious", yeux `? ?`
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

## Ordre recommandé

1. Bulle avec templates locaux, plus mode muet. Pose la mécanique "événement →
   réaction ponctuelle" dont dépendent 5, 6 et 7.
2. Commandes dans la palette : pet, card, mute, rename.
3. Achievements et streak, qui alimentent ensuite accessoires et branches.
4. Personnalité et branches, une fois qu'on a vu ce que les compteurs racontent
   après une semaine d'usage réel.

## Références

- Claude Buddy mechanics : https://claudefa.st/blog/guide/mechanics/claude-buddy
- Claude Code /buddy (DEV) : https://dev.to/raxxostudios/claude-code-buddy-the-terminal-tamagotchi-that-broke-the-internet-2lgj
- usik/tamagotchi (soins, 6 stades, branches, hooks agents) : https://github.com/usik/tamagotchi
- opencode-pets (bulles contextuelles, moods depuis SSE) : https://github.com/varoyik/opencode-pets
- Claude Code issue #59081, compagnon adaptatif : https://github.com/anthropics/claude-code/issues/59081
- opencode-better-sidebar (exemples de plugins TUI) : https://github.com/streetturtle/opencode-better-sidebar
- OpenCode issue #28902, slots TUI : https://github.com/anomalyco/opencode/issues/28902

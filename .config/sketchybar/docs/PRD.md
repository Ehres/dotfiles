# PRD — Plugin Brew Updates pour SketchyBar

## Contexte

La barre SketchyBar actuelle affiche des informations système (clock, battery,
volume), réseau (WiFi, VPN) et communication (mail, messages, Slack). Il manque
un indicateur de santé des paquets Homebrew pour savoir d'un coup d'œil si des
mises à jour sont disponibles et à quel point elles sont critiques.

## Objectif

Créer un plugin SketchyBar qui surveille les mises à jour Homebrew disponibles
et affiche une icône dont la couleur reflète la **gravité sémantique** des bumps
de version détectés (patch, minor, major), accompagnée du nombre total de paquets
outdated.

## Comportement

### États et affichage

| État                  | Icône | Couleur    | Token           | Label | Visibilité    |
| --------------------- | ----- | ---------- | --------------- | ----- | ------------- |
| 0 outdated            | —     | —          | —               | —     | `drawing=off` |
| Patches uniquement    | 󰏗     | Bleu (SKY) | `$STATUS_INFO`  | `{n}` | `drawing=on`  |
| ≥ 1 mise à jour minor | 󰏗     | Jaune      | `$ICON_WARNING` | `{n}` | `drawing=on`  |
| ≥ 1 mise à jour major | 󰏗     | Rouge      | `$ICON_ERROR`   | `{n}` | `drawing=on`  |

- La couleur est déterminée par le **pire type de bump** détecté parmi tous les
  paquets outdated.
- Le label `{n}` affiche le **nombre total** de paquets outdated (formulas +
  casks combinés, sans distinction).

### Classification des versions

Pour chaque paquet outdated, le script compare la version installée à la version
disponible en splitant sur `.` (semver : `major.minor.patch`) :

- **Major** : le premier segment diffère (ex : `20.x.x` → `22.x.x`)
- **Minor** : le deuxième segment diffère, le premier est identique
  (ex : `20.10.x` → `20.12.x`)
- **Patch** : seul le troisième segment (ou au-delà) diffère
  (ex : `20.10.0` → `20.10.3`)

### Versions non-semver

Les paquets dont la version ne respecte pas le format semver (dates comme
`2024.1.15`, release candidates comme `1.0rc2`, `HEAD`, numéro simple) sont
classifiés comme **major** par prudence.

### Paquets pinned

Les paquets marqués comme **pinned** dans Homebrew sont **exclus** du comptage
et de la classification. Ils sont volontairement maintenus à une version fixe.

## Spécifications techniques

### Fichiers à créer

| Fichier                   | Description                |
| ------------------------- | -------------------------- |
| `plugins/brew_updates.sh` | Script principal du plugin |

### Fichiers à modifier

| Fichier        | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `sketchybarrc` | Ajouter l'item `brew_updates` après le communication group |

### Position dans la barre

L'item est positionné **après le communication group** (mail, messages, Slack),
tout à gauche des items de droite. C'est un **item standalone** avec son propre
background (`"${item_bg[@]}"`), identique au pattern des AirPods.

```
... | communication_group | spacer | 󰏗 brew_updates |
```

### Fréquence de rafraîchissement

**Toutes les 30 minutes** (`update_freq=1800`). La commande `brew outdated` est
coûteuse en réseau et CPU ; 30 minutes est un bon compromis entre réactivité et
performance.

### Action au clic

Aucune. Pas de `click_script`.

### Dépendances

- **python3** (natif macOS) pour parser le JSON de `brew outdated --json=v2` et
  effectuer la comparaison semver. Aucune dépendance externe à installer.
- **Homebrew** (`brew`) doit être dans le PATH.

### Architecture du script

1. **Sourcer** les color tokens via `$CONFIG_DIR/colors/components.sh`
2. **Exécuter** `brew outdated --json=v2` pour obtenir formulas et casks en JSON
3. **Parser** le JSON avec python3 embarqué :
   - Itérer sur chaque paquet (formulas + casks)
   - Ignorer les paquets pinned
   - Pour chaque paquet : extraire version installée et version disponible
   - Classifier le bump en patch / minor / major
   - Retourner le nombre total et le pire niveau de bump
4. **Mapper** le niveau au token de couleur correspondant
5. **Mettre à jour** SketchyBar via `sketchybar --set "$NAME" ...`

### Gestion des erreurs

| Cas                         | Comportement               |
| --------------------------- | -------------------------- |
| `brew` absent du PATH       | `exit 0` — item inchangé   |
| Erreur réseau / timeout     | `exit 0` — item inchangé   |
| JSON invalide ou vide       | `exit 0` — item inchangé   |
| python3 absent (improbable) | `exit 0` — item inchangé   |
| 0 paquets outdated          | `drawing=off` — item caché |

### Design tokens utilisés

Le plugin s'intègre dans le système de design tokens existant à 3 niveaux
(palette → semantic → components) sans nécessiter de nouveau token :

- `$STATUS_INFO` (SKY / bleu) — patches
- `$ICON_WARNING` (YELLOW) — minors
- `$ICON_ERROR` (RED) — majors
- `$STANDALONE_ICON_PADDING` — padding icône
- `"${item_bg[@]}"` — background standalone

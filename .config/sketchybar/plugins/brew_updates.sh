#!/bin/sh

source "$CONFIG_DIR/colors/components.sh"

# ── PATH: garantir que brew et jq sont trouvables ──
# SketchyBar hérite d'un PATH minimal de launchd.
for p in /opt/homebrew/bin /usr/local/bin; do
	case ":$PATH:" in
	*":$p:"*) ;;
	*) PATH="$p:$PATH" ;;
	esac
done

ICON="󰏗"

# ── Récupérer les paquets outdated (JSON) ──
# Pas de `brew update` — on utilise l'index local déjà caché.
# IMPORTANT: brew est lancé via `zsh -l` car Homebrew 5.x plante dans
# l'environnement launchd de SketchyBar (Ruby $CHILD_STATUS est nil
# après IO.popen dans hardware.rb). zsh -l charge l'environnement
# complet qui résout ce problème.
BREW_JSON=$(/bin/zsh -l -c 'brew outdated --json=v2' 2>/dev/null)
[ -z "$BREW_JSON" ] && exit 0

# ── Extraire les paires "installed current" avec jq ──
# Formulae : exclure les pinned, prendre la dernière version installée
# Casks    : pas de champ pinned, prendre la dernière version installée
# Normaliser : strip suffixe brew (_N) et métadonnées cask (,token,...)
PAIRS=$(echo "$BREW_JSON" | jq -r '
  def normalize: split(",")[0] | sub("_[0-9]+$"; "");
  [
    (.formulae // [] | map(select(.pinned != true)) | .[] |
      { i: (.installed_versions // [] | last // empty), c: .current_version }),
    (.casks // [] | .[] |
      { i: (.installed_versions // [] | if type == "array" then last else . end // empty | tostring),
        c: (.current_version // empty | tostring) })
  ]
  | .[]
  | select(.i != null and .c != null)
  | (.i | normalize) as $ni | (.c | normalize) as $nc
  | select($ni != $nc)
  | "\($ni) \($nc)"
' 2>/dev/null)

# Rien à traiter → cacher l'item et le spacer
if [ -z "$PAIRS" ]; then
	sketchybar --set "$NAME" drawing=off \
		--set spacer_comm_updates drawing=off
	exit 0
fi

# ── Classifier chaque paire en patch/minor/major avec awk ──
RESULT=$(echo "$PAIRS" | awk '
BEGIN { count = 0; worst = 0 }
{
  # Split versions sur "."
  n1 = split($1, a, ".")
  n2 = split($2, b, ".")

  # Pad à 3 segments
  for (i = n1 + 1; i <= 3; i++) a[i] = "0"
  for (i = n2 + 1; i <= 3; i++) b[i] = "0"

  # Vérifier que les 3 segments sont numériques
  numeric = 1
  for (i = 1; i <= 3; i++) {
    if (a[i] !~ /^[0-9]+$/ || b[i] !~ /^[0-9]+$/) {
      numeric = 0
      break
    }
  }

  count++

  if (!numeric) {
    # Non-semver → major par prudence
    level = 3
  } else if (a[1]+0 != b[1]+0) {
    level = 3  # major
  } else if (a[2]+0 != b[2]+0) {
    level = 2  # minor
  } else {
    level = 1  # patch
  }

  if (level > worst) worst = level
}
END { print count, worst }
')

COUNT=$(echo "$RESULT" | awk '{print $1}')
LEVEL=$(echo "$RESULT" | awk '{print $2}')

# ── Mapper le niveau au token de couleur + visibilité ──
if [ "$COUNT" -eq 0 ] 2>/dev/null || [ "$COUNT" = "" ]; then
	sketchybar --set "$NAME" drawing=off \
		--set spacer_comm_updates drawing=off
	exit 0
fi

case "$LEVEL" in
3) ICON_COLOR="$ICON_ERROR" ;;   # ≥1 major
2) ICON_COLOR="$ICON_WARNING" ;; # ≥1 minor
*) ICON_COLOR="$STATUS_INFO" ;;  # patches uniquement
esac

sketchybar --set "$NAME" \
	icon="$ICON" \
	label="$COUNT" \
	icon.color="$ICON_COLOR" \
	drawing=on \
	--set spacer_comm_updates drawing=on

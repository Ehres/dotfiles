# Sketchybar Configuration

## Color Design System

Colors are organized in 3 layers following a design token architecture.
Each layer sources the previous one; plugins only need to source `components.sh`.

```
colors/
  palette.sh       Layer 1 — Primitive tokens (Catppuccin Macchiato)
  semantic.sh      Layer 2 — Semantic tokens (status, connectivity)
  components.sh    Layer 3 — Component tokens (sketchybar UI elements)
```

Format: `0xAARRGGBB` (AA=alpha, RR=red, GG=green, BB=blue).

## How to use in a plugin

```bash
source "$CONFIG_DIR/colors/components.sh"

# Use component tokens
ICON_COLOR="$ICON_OK"
```

## How to change the theme

Edit `colors/palette.sh` only. Semantic and component mappings stay the same.
For example, to switch to Catppuccin Mocha, replace the hex values in `palette.sh`.

## How to add a new color token

1. If it maps to an existing palette color, add a semantic token in `semantic.sh`
2. If it's a new UI concern, add a component token in `components.sh`
3. Never hardcode `0x...` values outside of `colors/`

## Spacing Design System

Spacing and layout values follow the same 3-layer token architecture as colors.
Each layer sources the previous one; `sketchybarrc` sources `components.sh`.

```
spacing/
  scale.sh         Layer 1 — Primitive tokens (normalized spacing scale)
  semantic.sh      Layer 2 — Semantic tokens (padding, gaps, shapes, sizing)
  components.sh    Layer 3 — Component tokens (sketchybar UI elements)
```

Scale: `0  1  2  4  8  12  16  24  32  40` (pixels).

### How to use in sketchybarrc

```bash
source "$CONFIG_DIR/spacing/components.sh"

# Use component tokens
sketchybar --bar height=$BAR_HEIGHT
```

### How to adjust spacing

Edit `spacing/scale.sh` to change the base scale values.
All semantic and component tokens derive from the scale automatically.
Never hardcode pixel values outside of `spacing/`.

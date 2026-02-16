#!/bin/bash

# ┌─────────────────────────────────────────────┐
# │  Semantic Tokens                              │
# │  Maps meaning to spacing primitives           │
# └─────────────────────────────────────────────┘

source "${BASH_SOURCE[0]%/*}/scale.sh"

# Padding (inner spacing within elements)
export PADDING_TIGHT=$SPACE_2XS
export PADDING_DEFAULT=$SPACE_XS
export PADDING_RELAXED=$SPACE_SM

# Gaps (spacing between elements)
export GAP_NONE=$SPACE_NONE
export GAP_DEFAULT=$SPACE_XS

# Shapes
export RADIUS_DEFAULT=$SPACE_SM

# Sizing
export HEIGHT_ITEM=$SPACE_XL
export HEIGHT_BAR=$SPACE_3XL
export WIDTH_SEPARATOR=$SPACE_3XS

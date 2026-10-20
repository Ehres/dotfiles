# Sources de l'axolotl

D'où vient chaque image de ce dossier, pour pouvoir la retoucher ou l'animer
avec pixler plus tard. Même règle que pour le chat
(`docs/sprites/cat/SOURCES.md`) : on garde l'identifiant du tirage, pas son
lien, et une retouche faite ici doit être refaite sur toute image éditée ou
animée depuis le tirage.

Un axolotl chibi, assis, de face, aux quatre stades, tiré à `maxColors: 16`
avec des dégradés. pixler dessine les bouches en noir (un trait, ou deux
points aux coins) : celles du hatchling et du young sont repeintes en un trait
droit de quatre pixels, mauve-rose atténué, comme la bouche de l'adult.
L'âge ne se lit pas par la couleur seule (trois elders rose fané faisaient
tous jeunes) : l'elder porte des sourcils et une moustache, tirés blancs et
broussailleux, puis réduits et pâlis à la main.

Les couleurs portent l'âge : pêche pâle pour le hatchling, rose vif pour le
young, rose framboise pour l'adult, rose fané pour l'elder.

Les quatre stades posent sur la ligne 31.

| Stade | Tirage | Image | Retouche locale |
| --- | --- | --- | --- |
| hatchling | `gen_3b382d0f-71c2-45f3-9b62-03379dd2349f` | 2 | bouche (12..15,14) de noir en `#ad5b85` ; puis descendu de trois pixels |
| young | `gen_3ba77343-850d-4b10-b8bd-762bb4021cbe` | 0 | les deux points de bouche (12,13) et (17,13) rendus à la peau `#f9b3bf`, trait (13..16,13) en `#ad5b85` ; puis descendu de trois pixels |
| adult | `gen_615aa57a-be74-447e-8533-36dc8336868f` | 2 | descendu de deux pixels |
| elder | `gen_163da93b-cc51-4c94-9b4f-e12ef4a0137e` | 0 | sourcils : (9,7), (10,7), (17,7), (18,7), (19,7), (8,8), (16,8), (20,8) rendus à la peau `#f0ac9d`, (10,8), (11,8), (17,8) pâlis en `#f6d9d3` ; moustache : (10,13), (16,13) rendus à la peau `#f0ac9d`, (11,13), (12,13), (14,13), (15,13) pâlis en `#f6d9d3`, pointes (9,14), (10,14), (15,14), (16,14), (17,14) rendues à l'ombre `#e49690` ; puis descendu d'un pixel |

Les coordonnées sont en pixels, comptées à partir de 0 depuis le coin en haut
à gauche, sur le tirage avant qu'il soit descendu. Tous les tirages sont faits
à `maxColors: 16`, `transparent: true`, `count: 3`.

## Prompts

pixler refuse un prompt de plus de 300 caractères.

**hatchling**

```
Baby axolotl, extremely chibi, giant round head on a tiny body, pale pastel pink skin with soft gradients, three small soft pink gills on each side of its head, tiny smile, pink blush, two identical big round black eyes with white highlights, sitting, front view, full body, thick dark outline
```

**young**

```
Young axolotl, chibi, sitting upright, big round head, bright pink skin with soft gradients, three feathery pink gills on each side of its head, small smile, pale belly, pink blush, two identical round black eyes with white highlights, front view, full body, thick dark outline
```

**adult**

```
Adult axolotl, chibi, sitting upright, soft pink skin with soft gradients, three feathery magenta gills on each side of its wide head, wide gentle smile, pale pink belly, small legs, pink blush, two identical round black eyes with white highlights, front view, full body, thick dark outline
```

**elder**

```
Old axolotl, chibi, sitting upright, faded dusty rose skin with soft gradients, bushy white eyebrows, a droopy white moustache, faded pink gills with white tips on each side of its head, pink blush, two identical round black eyes with white highlights, front view, full body, thick dark outline
```

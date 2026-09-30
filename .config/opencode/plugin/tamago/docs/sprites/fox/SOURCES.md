# Sources du renard

D'où vient chaque image de ce dossier, pour pouvoir la retoucher ou l'animer
avec pixler plus tard. Même règle que pour le chat
(`docs/sprites/cat/SOURCES.md`) : on garde l'identifiant du tirage, pas son
lien, et une retouche faite ici doit être refaite sur toute image éditée ou
animée depuis le tirage.

Les couleurs portent l'âge : le young est orange vif, l'adult roux profond,
l'elder orange pâle aux oreilles grises, avec une canne. Le young est un
tirage d'adult : orange vif, il faisait jeune. L'adult et l'elder sont tirés
à 16 couleurs avec des dégradés, pour plus de détail ; le hatchling et le
young à 12, en aplats. L'import les ramène tous à la même palette de 16.

Les quatre stades posent sur la ligne 31 : les oreilles de l'elder touchent
la ligne 0, il ne pouvait pas monter.

| Stade | Tirage | Image | Taille | Retouche locale |
| --- | --- | --- | --- | --- |
| hatchling | `gen_d4c34478-5a89-4f0d-8dfc-15023dc643e4` | 2 | 20 × 20 | posé dans le 32 × 32, centré, sa dernière ligne sur la ligne 31 |
| young | `gen_30f2b369-f00e-4653-86f9-ebd49cabebfd` | 0 | 32 × 32 | descendu d'un pixel |
| adult | `gen_d93818f7-d06f-4e6d-bbc9-be5139f489d4` | 0 | 32 × 32 | c'est l'`edit` des yeux de `gen_d1edf789-3e33-4f6a-b7b8-9a1bcf7effdb` image 0 ; puis, avant la descente d'un pixel : les deux reflets posés hors des yeux, (9,8) et (14,8), repeints en `#f3622e` ; x 6 à 10 des lignes 8 à 11 recopiés en miroir sur x 14 à 18 autour de x = 12 ; (7,10) et (17,10) repeints en `#f3622e` ; les deux yeux redessinés en 2 × 3, x 8-9 et x 15-16 des lignes 9 à 11, en `#060d26`, leurs reflets `#fdfdfb` tous deux en haut à gauche, (8,9) et (15,9), pour qu'ils regardent devant eux |
| elder | `gen_8530e99c-3b1d-4c21-a924-84de38aff1b1` | 0 | 32 × 32 | aucune |

Les coordonnées sont en pixels, comptées à partir de 0 depuis le coin en haut
à gauche. Tous les tirages sont faits à `transparent: true`, `count: 3`.

## Prompts

pixler refuse un prompt de plus de 300 caractères.

**hatchling** — `maxColors: 12`, tiré en `20 × 20`

```
Tiny baby fox cub, soft pale orange very fluffy fur, cream face, huge head on a tiny round body, small rounded ears, short stubby tail, sitting upright, super chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young** — `maxColors: 12`, demandé comme adult

```
Orange fox, pointed snout, large triangular ears, thick white-tipped tail, sitting upright, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**adult** — `maxColors: 16` ; puis l'`edit` :

```
Adult red fox, detailed fur, deep rust red coat with soft colour gradients, white cheeks, cream chest bib, black ear backs, black socks, long slender snout, almond eyes, bushy tail shading to a white tip, sitting upright, chibi, front view, full body, thick dark outline
```

```
Redraw both eyes as two identical, well-formed, slightly rounder black eyes with a small white highlight, set symmetrically; keep everything else unchanged
```

**elder** — `maxColors: 16`

```
Old fox, pale faded orange coat streaked with grey, soft colour gradients, grey white muzzle, bushy white eyebrows, sly half-closed eyes, holding a small wooden cane in its front paw, slight three-quarter view, sitting upright, chibi, full body, thick dark outline
```

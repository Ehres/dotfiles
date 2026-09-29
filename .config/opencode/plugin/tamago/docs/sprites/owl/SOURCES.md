# Sources de la chouette

D'où vient chaque image de ce dossier, pour pouvoir la retoucher ou l'animer
avec pixler plus tard. Même règle que pour le chat
(`docs/sprites/cat/SOURCES.md`) : on garde l'identifiant du tirage, pas son
lien, et une retouche faite ici doit être refaite sur toute image éditée ou
animée depuis le tirage.

| Stade | Tirage | Image | Retouche locale |
| --- | --- | --- | --- |
| hatchling | `gen_278b00a8-a3c5-403a-a3ee-4f043ce86688` | 0 | aucune |
| young | `gen_ec9fa81c-f9a8-4b25-b30f-86cbf100833d` | 0 | l'œil gauche (x 9 à 14, y 6 à 11) remplacé par l'œil droit en miroir autour de x = 15,5 ; un reflet blanc ajouté en (11, 8) et en (20, 8) |
| adult | `gen_8268d960-a988-461d-aab5-549cb4e901b0` | 0 | la patte droite, noire d'un bloc : ligne 29, x 18 et 20 repeints de l'orange de (11, 29), x 19 du clair de (13, 29) |
| elder | `gen_a41a411b-ea9a-48c3-97cd-13cd323808e6` | 0 | l'œil gauche (x 9 à 14, y 7 à 12) remplacé par l'œil droit en miroir autour de x = 15,5 |

Les coordonnées sont en pixels, comptées à partir de 0 depuis le coin en haut
à gauche. Tous les tirages sont faits à `32 × 32`, `maxColors: 12`,
`transparent: true`, `count: 1`.

## Prompts

**hatchling**

```
Brown owl as a tiny newborn chick, a small fluffy ball of pale grey down, huge head, no ear tufts, no wings showing, standing upright, super chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Brown owl as a fledgling, patchy down among brown feathers, ear tufts just appearing, short wings, standing upright, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**adult**

```
Brown owl, round body, tufted ears, small hooked beak, folded wings, standing upright, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Brown owl in old age, bleached ragged feathers, half-closed eyes, one ear tuft bent, standing upright, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

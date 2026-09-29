# Sources du hamster

D'où vient chaque image de ce dossier, pour pouvoir la retoucher ou l'animer
avec pixler plus tard. Même règle que pour le chat
(`docs/sprites/cat/SOURCES.md`) : on garde l'identifiant du tirage, pas son
lien, et une retouche faite ici doit être refaite sur toute image éditée ou
animée depuis le tirage.

Trois écarts avec les Species précédents :

- **Le young est un tirage du hatchling.** Le premier prompt de nouveau-né a
  donné un hamster à peine plus petit que l'adulte ; il a été gardé comme
  young.
- **Le hatchling est tiré en `20 × 20`.** Pixler remplit toujours la toile :
  à 32 × 32, le bébé avait la taille du young. Tiré sur une toile plus petite
  puis posé dans le cadre, il fait les deux tiers du young.
- **L'elder a une canne, et il est de trois quarts vers la gauche.** Sans
  objet, pixler dessinait un adulte : il n'a suivi ni le museau gris ni les
  paupières lourdes. La canne et les taches grises se lisent tout de suite.

| Stade | Tirage | Image | Taille | Retouche locale |
| --- | --- | --- | --- | --- |
| hatchling | `gen_af5d432f-1fc4-47fc-a080-997f5cc05217` | 1 | 20 × 20 | sur le 20 × 20 : l'œil gauche redessiné comme le droit — (7,7) en reflet `#fcf9f0`, (8,8) en noir `#190d28` — et les pixels hors silhouette effacés : (1,8) (2,8) (1,9) (2,9) (18,7) (18,9) (18,10) (18,14) (18,15) ; puis l'image posée dans le 32 × 32, décalée de (5, 12) : centrée sur ses colonnes, sa dernière ligne sur la ligne 31 |
| young | `gen_20b0b47c-51a6-40fa-b634-9e650d6fd658` | 1 | 32 × 32 | aucune |
| adult | `gen_5efaca22-548f-4c7e-b6e1-efbd421fa313` | 1 | 32 × 32 | aucune |
| elder | `gen_7f185a94-6d95-4006-8e18-07c9bad77665` | 0 | 32 × 32 | aucune |

Les coordonnées sont en pixels, comptées à partir de 0 depuis le coin en haut
à gauche. Tous les tirages sont faits à `maxColors: 12`, `transparent: true`,
`count: 3`.

## Prompts

pixler refuse un prompt de plus de 300 caractères.

**hatchling**

```
Golden hamster as a tiny baby hamster, pale cream fluffy fur, huge head on a tiny round body, stubby paws, no tail, sitting upright, super chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young** — demandé comme nouveau-né :

```
Golden hamster as a tiny newborn pup, bare pink skin, almost no fur, ears sealed flat, sitting upright, super chibi, head twice as large as its tiny body, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**adult**

```
Golden hamster, round body, tiny round ears, full cheek pouches, small pink paws, sitting upright, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Old golden hamster, faded pale beige fur with grey patches, bushy white eyebrows, half-closed sleepy eyes, hunched, leaning on a tiny wooden cane, sitting upright, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading
```

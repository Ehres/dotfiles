# Sources du hérisson

D'où vient chaque image de ce dossier, pour pouvoir la retoucher ou l'animer
avec pixler plus tard. Même règle que pour le chat
(`docs/sprites/cat/SOURCES.md`) : on garde l'identifiant du tirage, pas son
lien, et une retouche faite ici doit être refaite sur toute image éditée ou
animée depuis le tirage.

Un hérisson chibi, de face, aux quatre stades, tiré à `maxColors: 16` avec
des dégradés. Un premier adulte de trois quarts a été abandonné : son œil
éloigné, quelques pixels à cette taille, n'est jamais sorti bien formé, ni
de trois `edit` ni de deux retouches à la main. De face, les deux yeux sont
symétriques. Le young est un tirage d'adult qui faisait jeune ; l'elder a les
yeux plissés en sourire.

Les couleurs portent l'âge : piquants crème et rose pour le hatchling, brun
moyen pour le young, brun profond pour l'adult, gris argenté pour l'elder,
avec une canne.

Les quatre stades posent sur la ligne 31.

| Stade | Tirage | Image | Retouche locale |
| --- | --- | --- | --- |
| hatchling | `gen_ce5cc670-5568-4cf0-88d8-d81ba12abbd6` | 2 | descendu d'un pixel |
| young | `gen_2a0bbc14-2431-4317-a598-6a0cae5cfd60` | 0 | descendu d'un pixel |
| adult | `gen_2a0bbc14-2431-4317-a598-6a0cae5cfd60` | 2 | aucune |
| elder | `gen_f4417a4e-5015-441b-ac1f-444e326626a7` | 2 | descendu d'un pixel |

Les coordonnées sont en pixels, comptées à partir de 0 depuis le coin en haut
à gauche. Tous les tirages sont faits à `maxColors: 16`, `transparent: true`,
`count: 3`.

## Prompts

pixler refuse un prompt de plus de 300 caractères.

**hatchling**

```
Baby hedgehog, extremely chibi, giant round head on a tiny body, soft pale cream and light pink spine tufts with soft gradients, cream face, pink ears and blush, tiny black nose, two identical big round black eyes with highlights, sitting, front view, full body, thick dark outline
```

**young** et **adult** — le même tirage, images 0 et 2

```
Adult hedgehog, chibi, big tufts of brown spines with soft gradients, cream face and belly, pink ears and blush, small black nose, two identical detailed eyes with brown iris, black pupil and white highlights, sitting, front view facing the viewer, full body, thick dark outline
```

**elder**

```
Old hedgehog, chibi, tufts of silver grey spines with soft gradients, pale cream face, bushy white eyebrows, pink ears, black nose, leaning on a tiny wooden cane, two identical round black eyes with highlights, sitting, front view, full body, thick dark outline
```

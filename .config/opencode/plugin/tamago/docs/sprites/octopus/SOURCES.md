# Sources de la pieuvre

D'où vient chaque image de ce dossier, pour pouvoir la retoucher ou l'animer
avec pixler plus tard. Même règle que pour le chat
(`docs/sprites/cat/SOURCES.md`) : on garde l'identifiant du tirage, pas son
lien, et une retouche faite ici doit être refaite sur toute image éditée ou
animée depuis le tirage.

Une pieuvre chibi, de face, aux quatre stades, tirée à `maxColors: 16` avec
des dégradés. Le hatchling, tout en tête, remplit le cadre : un adulte plus
petit a été retiré en demandant une tête qui remplit le cadre et des bras
étalés jusqu'aux bords, sans que pixler grossisse vraiment la tête. Le young
ressemble à l'adulte de silhouette ; la couleur porte l'écart.

Les couleurs portent l'âge : rose pâle pour le hatchling, lilas pour le
young, violet pour l'adult, mauve fané pour l'elder. Un elder à canne, puis
un elder gris argenté, ont été écartés : la canne n'était pas voulue, et le
gris cassait la continuité de couleur avec l'adulte.

Les quatre stades posent sur la ligne 31.

| Stade | Tirage | Image | Retouche locale |
| --- | --- | --- | --- |
| hatchling | `gen_c41dd301-72b0-4829-b7a1-2f49ab282de0` | 2 | aucune |
| young | `gen_dc048121-117e-4e61-b6fd-b798579d1d6f` | 2 | `retouch.ts frame` : descendu de trois pixels, recentré |
| adult | `gen_b0eba18f-d601-418a-b0a3-64de09ac65b2` | 2 | `retouch.ts frame` : descendu de trois pixels, recentré |
| elder | `gen_996eb651-d8e9-430f-b361-43fd7df7f55e` | 1 | `retouch.ts frame` : descendu de quatre pixels, recentré |

Les coordonnées sont en pixels, comptées à partir de 0 depuis le coin en haut
à gauche. Tous les tirages sont faits à `maxColors: 16`, `transparent: true`,
`count: 3`.

## Prompts

pixler refuse un prompt de plus de 300 caractères.

**hatchling**

```
Baby octopus, extremely chibi, giant round head on a tiny body, pale lilac and soft pink with soft gradients, a few tiny stubby curled arms, pink blush, two identical big round black eyes with white highlights, front view facing the viewer, full body, thick dark outline
```

**young**

```
Young octopus, chibi, big round head with soft gradients, bright lavender and lilac, six short curling arms, pink blush, two identical big round black eyes with white highlights, front view facing the viewer, full body, thick dark outline
```

**adult**

```
Adult octopus, chibi, large round domed purple head with soft gradients filling the frame, eight curling arms spread wide to the edges, light lilac belly, pink blush, two identical big round black eyes with white highlights, front view facing the viewer, full body, thick dark outline
```

**elder**

```
Old octopus, chibi, round head with soft gradients, faded dusty mauve purple skin, slightly paler and muted than a young purple octopus, eight curling arms, pink blush, two identical round black eyes with white highlights, front view facing the viewer, full body, thick dark outline
```

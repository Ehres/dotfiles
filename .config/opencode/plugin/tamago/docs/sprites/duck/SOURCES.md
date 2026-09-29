# Sources du canard

D'où vient chaque image de ce dossier, pour pouvoir la retoucher ou l'animer
avec pixler plus tard. Même règle que pour le chat
(`docs/sprites/cat/SOURCES.md`) : on garde l'identifiant du tirage, pas son
lien, et une retouche faite ici doit être refaite sur toute image éditée ou
animée depuis le tirage.

Le canard est un colvert, et le seul Species de trois quarts : les quatre
stades regardent vers la gauche et ne montrent qu'un œil. Un canard jaune de
face sortait toujours en poussin, et un colvert demandé de face sortait de
trois quarts ; on a gardé la pose que pixler dessine bien.

| Stade | Tirage | Image | Retouche locale |
| --- | --- | --- | --- |
| hatchling | `gen_394a6d46-8674-45ff-9cd4-46cc94af3674` | 0 | le trait sombre de l'aile, seize pixels à l'intérieur du corps — (16,14) (20,17) (22,18) (15,19) (23,19) (15,20) (24,20) (16,21) (25,21) (17,22) (18,22) (25,22) (19,23) (20,23) (21,23) (22,23) — repeint en `#e8985c`, l'orangé du duvet |
| young | `gen_a1b8f644-99ff-4419-8bec-7559336562e9` | 0 | aucune |
| adult | `gen_bf0d6a5c-d7d9-48da-a834-8432cf41e4c5` | 0 | aucune |
| elder | `gen_a5377086-8d19-4537-a9a8-4bad5b8be29e` | 0 | l'image entière retournée en miroir horizontal : pixler l'a tourné vers la droite |

Les coordonnées sont en pixels, comptées à partir de 0 depuis le coin en haut
à gauche. Tous les tirages sont faits à `32 × 32`, `maxColors: 12`,
`transparent: true`, `count: 1`.

## Prompts

pixler refuse un prompt de plus de 300 caractères.

**hatchling**

```
Mallard duck as a newly hatched duckling, fluffy yellow down with brown patches, tiny wings, small neat orange bill with a dark outline, head twice as large as its tiny body, three-quarter view facing left, standing, super chibi, full body, thick dark outline, solid flat colour areas, no shading
```

**young**

```
Young mallard drake, green head coming in, thin white neck ring, brown chest, grey body with a few tufts of yellow down left, short wings, yellow bill, three-quarter view facing left, standing, chibi, full body, thick dark outline, solid flat colour areas, no shading, big round black eye
```

**adult** — demandé de face, sorti de trois quarts :

```
Mallard duck, glossy green head, white neck ring, brown chest, grey body, yellow bill, orange webbed feet, facing the viewer, both eyes visible, standing upright, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder** — sorti tourné vers la droite, retourné :

```
Old mallard drake, faded dull green head, greying chest and body, ragged feathers, heavy drooping eyelid, hunched, yellow bill, three-quarter view facing left, standing, chibi, full body, thick dark outline, solid flat colour areas, no shading
```

# Sources du manchot

D'où vient chaque image de ce dossier, pour pouvoir la retoucher ou l'animer
avec pixler plus tard. Même règle que pour le chat
(`docs/sprites/cat/SOURCES.md`) : on garde l'identifiant du tirage, pas son
lien, et une retouche faite ici doit être refaite sur toute image éditée ou
animée depuis le tirage.

Un manchot empereur, chibi, de face, aux quatre stades, tiré à
`maxColors: 16` avec des dégradés. Le hatchling est tiré en 32 × 32 en chibi
très prononcé : en 20 × 20, il perdait son détail. Le young est un tirage
d'adult qui faisait jeune. L'adult est un `edit` de l'elder, qui retire la
canne et rajeunit le plumage : les tirages d'adult sortaient soit trop bébés,
soit d'un autre style que les trois autres stades.

Les quatre stades posent sur la ligne 31.

| Stade | Tirage | Image | Retouche locale |
| --- | --- | --- | --- |
| hatchling | `gen_83057211-c813-4a1e-a9f5-a2302f291898` | 0 | descendu d'un pixel |
| young | `gen_5be08c94-20ea-4da3-97fc-81d62013246a` | 0 | aucune |
| adult | `gen_26f41370-3e0d-4e36-abfe-1ca432ec4223` | 0 | descendu d'un pixel ; c'est l'`edit` de l'elder, `gen_3e4a3d29-19bc-4f7c-98a4-19882cb2c335` image 2 |
| elder | `gen_3e4a3d29-19bc-4f7c-98a4-19882cb2c335` | 2 | aucune |

## La palette

Elle n'est pas celle que `scripts/import.ts` déduit des quatre images : les
32 couleurs de l'`edit` y prenaient trop de place, et la canne de l'elder et
l'orange du young disparaissaient. C'est la palette déduite des quatre stades
avant l'`edit`, dont les trois couleurs les moins employées par les autres
stades — `#91a9bf`, `#c73309`, `#6c7e91` — sont remplacées par le bleu marine
`#032758`, le jaune `#fde601` et le bleu pâle du ventre `#b7d0e7` de l'adult.
Chaque stade est importé dessus avec `--palette` :

```
#fbf6e2,#273449,#0f1e38,#c0cdd5,#e8d9d5,#475265,#032758,#fbe084,#050620,#beaeaa,#fb9421,#9a8b9a,#b7d0e7,#982818,#fd9089,#fde601
```

Les reflets bleu vif de l'adult (`#1ba8fa`) n'y ont pas de place : ils
deviennent bleu marine.

## Prompts

pixler refuse un prompt de plus de 300 caractères. Tous les tirages sont
faits à `maxColors: 16`, `transparent: true`, `count: 3`.

**hatchling**

```
Baby emperor penguin chick, extremely chibi, giant round head on a tiny fluffy body, fluffy silver grey down all over, black head cap, white face mask, tiny dark beak, stubby flippers, big round shiny black eyes with white highlights, sitting, front view, full body, thick dark outline
```

**young** — un tirage d'adult

```
Adult emperor penguin, glossy black back and head with soft gradients, white face and belly, yellow neck patch, short flippers, orange beak and feet, standing upright facing the viewer, both eyes open, big round shiny black eyes with white highlights, chibi, front view, full body, thick dark outline
```

**elder**

```
Old emperor penguin, faded greyish black plumage with soft gradients, worn white belly, pale yellow neck patch, bushy white eyebrows, slightly hunched, leaning on a tiny wooden cane, both eyes open, round black eyes with white highlights, chibi, front view, full body, thick dark outline
```

**adult** — l'`edit` de l'elder :

```
Remove the cane and make it stand straight as a younger adult: glossy blue black plumage, bright white belly, vivid yellow neck patch; keep the face, the eyes and the proportions unchanged
```

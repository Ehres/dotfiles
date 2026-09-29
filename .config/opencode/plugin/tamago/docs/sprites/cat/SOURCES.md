# Sources du chat

D'où vient chaque image de ce dossier, pour pouvoir la retoucher ou l'animer
avec pixler plus tard.

On garde l'identifiant du tirage, pas son lien : les liens expirent en moins
d'une heure, l'identifiant non. `get_job` redonne un lien frais, et `edit` et
`animate` prennent l'identifiant et le numéro de l'image.

Pixler ne connaît que l'image telle qu'il l'a tirée. Une retouche faite ici
n'existe pas chez lui : une image éditée ou animée depuis le tirage doit la
recevoir à nouveau.

| Stade | Tirage | Image | Retouche locale |
| --- | --- | --- | --- |
| hatchling | `gen_2f0d3b4e-c6ae-4854-a15b-a946c866cd90` | 0 | l'œil gauche (x 8 à 11, y 11 à 14) remplacé par l'œil droit en miroir autour de x = 14 |
| young | `gen_2007308e-501a-491b-8b15-ba5f0e15f4f2` | 0 | aucune |
| adult | `gen_17ff69af-8b2b-4114-9f78-cb399d0e0b37` | 0 | le pixel (x 19, y 11) qui dépassait à gauche de l'œil droit, repeint en pelage |
| elder | `gen_cec0ed33-b36a-4fd7-96ba-d024eea5530b` | 0 | la deuxième queue, en bas à gauche, effacée : x 0 à 4 des lignes 26 à 29, et les lignes 30 et 31 entières |

Les coordonnées sont en pixels, comptées à partir de 0 depuis le coin en haut
à gauche. Tous les tirages sont faits à `32 × 32`, `maxColors: 12`,
`transparent: true`, `count: 1`.

## Prompts

**hatchling**

```
Grey tabby cat as a newborn kitten, head twice as large as its tiny body, ears folded flat, tail a short stub, sitting, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Grey tabby cat as a playful half-grown kitten, super chibi, big round head on a small slim body, oversized upright ears, thin legs, thin straight tail, sitting, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**adult**

```
Grey tabby cat, round body, pointed ears, short striped tail curled at its side, sitting upright, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Grey tabby cat in old age, grey muzzle, heavy-lidded eyes, sagging belly, thin ragged tail, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

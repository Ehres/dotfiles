# Prompts de génération des sprites

Vingt espèces, quatre stades chacune. L'œuf n'est pas ici : il est commun à
toutes les espèces et se dessine une seule fois.

## Comment ça marche

Pour chaque espèce : **quatre tirages**, un par stade, puis **une commande
d'import** qui déduit la palette commune des quatre images et les ramène
toutes dessus.

Une image coûte un crédit à `count: 1`. La formule gratuite en donne cinq
par jour, soit une espèce par jour avec une reprise ; l'abonnement à 8 $ en
donne 800 par mois, assez pour les vingt espèces en une fois.

## Réglages de l'outil

Ils ne s'écrivent pas dans le prompt :

| Réglage | Valeur |
| --- | --- |
| `type` | `Sprite` |
| `width` / `height` | `32` / `32` |
| `maxColors` | `12` |
| `transparent` | `true` |
| `count` | `3` avec l'abonnement, `1` en gratuit |

Avec `count: 3`, garde la meilleure des trois. Le coût d'un tirage à trois
variantes n'a pas encore été vérifié : regarde le compteur de crédits au
premier.

## Ce qu'on a appris sur pixler

Mesuré sur le chat, le 2026-09-29 :

- **12 couleurs.** À 16, le modèle garde ses ombres : dix des seize couleurs du
  premier chat étaient des nuances presque identiques. À 8, il perd des traits
  réels : le turquoise des yeux avait disparu.
- **Pas de transformation.** L'outil de modification d'image (`edit`) n'a pas
  de réglage de couleurs, redessine librement, et a abîmé le chaton. Quatre
  tirages séparés donnent quatre images propres ; c'est l'import qui leur
  donne une palette commune.
- **Pas de consigne négative.** « Laisse le haut vide » n'a jamais été
  respecté : le modèle ne sait pas s'abstenir de dessiner quelque part. Les
  coins réservés à la marque et au badge sortent libres d'eux-mêmes, et le
  test du catalogue les vérifie de toute façon.
- **Les liens expirent en moins d'une heure.** Télécharge l'image dès que le
  tirage est fini.

## Le bloc de style

Chaque prompt se termine par :

> `chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart`

- **`chibi`** — la tête fait entre un tiers et la moitié de la hauteur. À
  32 pixels, c'est ce qui laisse de la place pour des yeux lisibles.
- **`big round black eyes set wide apart`** — chaque espèce dessine ses
  expressions sur ses yeux ; il faut qu'ils soient assez grands.
- **`solid flat colour areas, no shading`** — des aplats plutôt que des
  dégradés, pour que la palette commune reste petite.

Le début du prompt — *Grey tabby cat*, *Red dragon* — est **identique pour les
quatre stades** d'une espèce. C'est ce qui les fait ressembler à la même
créature : ne le change pas d'un stade à l'autre.

## Import

Range les images dans `docs/sprites/<espèce>/<stade>.png` : ce sont les
sources, versionnées pour pouvoir réimporter si le format ou la palette change
un jour. Puis une commande par espèce, les quatre images ensemble :

```sh
node scripts/import.ts docs/sprites/cat/{adult,hatchling,young,elder}.png
```

L'outil imprime la palette une fois, puis les quatre dessins, prêts à coller.
Pour refaire un seul stade plus tard sans toucher à la palette déjà en place :

```sh
node scripts/import.ts elder.png --palette "#rrggbb,#rrggbb,…"
```

## Après l'import

L'import donne la palette et les quatre dessins. Une espèce redessinée a besoin
de trois choses de plus dans son entrée, dans
`core/creature/species/<rareté>.ts`.

**1. Les ancres de chaque stade** : `head`, `left_eye`, `right_eye`, en
pixels. Dans le dessin imprimé, le numéro de la ligne est `y` et la position du
caractère est `x`, tous deux comptés à partir de 0. Un œil s'ancre sur son coin
en haut à gauche. La tête s'ancre sur un point du visage, à la ligne 5 au plus
tôt : le cœur du câlin se dessine dans les cinq lignes au-dessus.

**2. Ses propres expressions**, à la place de `expressions:
DEFAULT_EXPRESSIONS`. Celles par défaut peignent avec la couleur n°5 de la
palette, qui était l'œil des anciens dessins et n'est plus rien de précis :
sans ce remplacement, un carré de couleur au hasard apparaît sur les yeux à
chaque clignement. Le minimum :

```ts
expressions: {
  open: [[]], // les yeux tels qu'ils sont dessinés
  shut: [[
    { at: "left_eye", pixels: ["111", "000", "111"] },
    { at: "right_eye", pixels: ["111", "000", "111"] },
  ]],
},
```

Les chiffres sont des indices de la palette de l'espèce : ici `1` pour la
couleur du pelage, `0` pour celle du contour. Le patch prend la taille de
l'œil qu'il recouvre. Les autres expressions (`hurt`, `sleeping`, `waiting`…)
sont facultatives et reprennent `open` quand elles manquent. Si les yeux d'un
stade ont une autre taille, ce stade peut porter ses propres `expressions`.

**3. Les zones qui bougent** (`motion` : la queue, les oreilles). Retire celles
héritées des anciens dessins, ou replace-les sur le nouveau : une zone mal
placée fait glisser un morceau du corps à chaque battement.

Puis `pnpm test`, qui refuse une ancre manquante, un patch qui sort du cadre,
une tête trop haute ou un coin réservé occupé, et
`node scripts/preview.ts cat adult` pour voir le résultat.

---

## common

### 1. cat — chat

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Grey tabby cat, round body, pointed ears, short striped tail curled at its side, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Grey tabby cat as a newborn kitten, head twice as large as its tiny body, ears folded flat, tail a short stub, sitting, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Grey tabby cat as a lanky adolescent, ears upright and oversized, long legs, tail thin and straight, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Grey tabby cat in old age, grey muzzle, heavy-lidded eyes, sagging belly, thin ragged tail, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 2. owl — chouette

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Brown owl, round body, tufted ears, small hooked beak, folded wings, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Brown owl as a chick, a ball of pale grey down, no ear tufts, no wings showing, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Brown owl as a fledgling, patchy down among brown feathers, ear tufts just appearing, short wings, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Brown owl in old age, bleached ragged feathers, half-closed eyes, one ear tuft bent, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 3. frog — grenouille

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Green frog, wide round body, bulging cheeks, long folded hind legs, webbed toes, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Green frog as a tadpole, no legs at all, a long flat tail, a smooth round head, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Green frog as a froglet, hind legs grown, small front legs, a short tail stub still attached, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Green frog in old age, dull mottled skin, heavy jowls, slouched posture, drooping eyelids, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 4. duck — canard

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Yellow duck, round fluffy body, small wings at its sides, orange beak and webbed feet, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Yellow duck as a newly hatched chick, head twice as large as its tiny body, no wings, one curl of down on top, sitting, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Yellow duck as a half-grown duckling, head and body the same size, short wings held out, standing tall, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Yellow duck in old age, pale faded plumage, drooping eyelids, hunched back, dulled beak, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 5. hamster — hamster

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Golden hamster, round body, tiny round ears, full cheek pouches, small pink paws, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Golden hamster as a newborn pup, bare pink skin, almost no fur, ears sealed flat, curled up, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Golden hamster as a young hamster, short thin fur, empty flat cheek pouches, ears large for its head, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Golden hamster in old age, thin patchy fur, heavy-lidded eyes, slack empty pouches, rounded back, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 6. snail — escargot

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Pale snail with a shell on its back, a thick spiral shell, two long eye stalks, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Pale snail with a shell on its back as a baby, a smooth shell barely coiled, a tiny body, very short eye stalks, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Pale snail with a shell on its back as a young snail, one clear spiral turn in the shell, a longer body, eye stalks fully out, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Pale snail with a shell on its back in old age, a mossy cracked shell, a shrunken body, drooping eye stalks, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

---

## uncommon

### 7. fox — renard

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Orange fox, pointed snout, large triangular ears, thick white-tipped tail, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Orange fox as a cub, fluffy coat, small rounded ears, a short stubby tail, a blunt muzzle, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Orange fox as a young fox, ears grown large, long thin legs, tail long but thin, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Orange fox in old age, a white muzzle, a dull thinning coat, a sparse tail, sunken cheeks, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 8. penguin — manchot

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Black and white penguin, round belly, short flippers at its sides, orange beak and feet, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Black and white penguin as a chick, a ball of grey down, no flippers showing, a tiny dark beak, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Black and white penguin as a juvenile, mottled grey and white plumage, short flippers, a pale beak, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Black and white penguin in old age, worn dull plumage, a stooped back, a faded beak, drooping eyelids, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 9. octopus — pieuvre

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Purple octopus, round domed head, eight short curling arms, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Purple octopus as a hatchling, a tiny head, only four short stubby arms, pale lilac, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Purple octopus as a young octopus, six longer thinner arms, the head still small for them, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Purple octopus in old age, pale mottled skin, slack drooping arms, a sagging head, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 10. bat — chauve-souris

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Dark purple bat, round furry body, huge ears, small folded wings, two tiny fangs, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Dark purple bat as a pup, bare pink skin, ears folded down, wings tucked tight, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Dark purple bat as a young bat, fur grown in, oversized upright ears, small thin wings, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Dark purple bat in old age, torn wing membranes, grizzled grey fur, squinting eyes, a worn ear, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 11. hedgehog — hérisson

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Brown hedgehog, round body covered in short spines, a small pointed snout, tiny paws, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Brown hedgehog as a hoglet, pink skin, soft white spines barely showing, curled up, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Brown hedgehog as a young hedgehog, short brown spines, a small snout, oversized paws, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Brown hedgehog in old age, grey spines with several missing, a drooping snout, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 12. axolotl — axolotl

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Pale pink axolotl, round body, feathery red gills fanning from its head, tiny legs, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Pale pink axolotl as a larva, no legs, stubby gill buds, a long flat tail, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Pale pink axolotl as a juvenile, front legs only, gills half grown, a slender body, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Pale pink axolotl in old age, dull grey-pink skin, thin drooping gills, a scarred tail, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

---

## rare

### 13. robot — robot

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Boxy metal robot, rounded square head, a single antenna, segmented arms, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Boxy metal robot as a bare chassis, no arms, no antenna, unpainted metal, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Boxy metal robot half assembled, both arms attached, still no antenna, unpainted panels, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Boxy metal robot worn out, rusted pitted plating, a bent antenna, a dented head, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 14. ghost — fantôme

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Pale white ghost, round head, a short wavy trailing tail instead of legs, no arms, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Pale white ghost as a small wisp, a round blob, no tail, smooth edges, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Pale white ghost as a young ghost, a defined head, a short tail beginning to form, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Pale white ghost ancient, frayed tattered edges, a faded body, drooping eyes, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 15. jellyfish — méduse

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Pale blue jellyfish, a domed bell, a ring of short frilled tentacles beneath, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Pale blue jellyfish as a polyp, a tiny smooth bell, no tentacles at all, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Pale blue jellyfish as a young jellyfish, short even tentacles, a bell with faint ridges, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Pale blue jellyfish in old age, a torn bell, broken uneven tentacles, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 16. chameleon — caméléon

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Green chameleon, round body, a tightly curled tail, a crest along its back, gripping feet, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Green chameleon as a hatchling, no crest, a short straight tail, an oversized head, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Green chameleon as a young chameleon, a small crest appearing, a tail beginning to curl, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Green chameleon in old age, faded patchy colour, a worn crest, a stiff tail, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

---

## epic

### 17. phoenix — phénix

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Orange and gold phoenix, round body, a flame-shaped crest, spread wings, long tail feathers, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Orange and gold phoenix as a chick, smouldering grey down with ember specks, no crest, no tail, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Orange and gold phoenix as a young phoenix, orange feathers coming in, a small crest, short wings, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Orange and gold phoenix ancient, ash-grey feathers, a dim crest, a drooping tail, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 18. kraken — kraken

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Deep blue kraken, a large domed head, thick coiling tentacles, two small horns, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Deep blue kraken as a hatchling, a small round head, four short tentacles, no horns, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Deep blue kraken as a young kraken, six thicker tentacles, horn buds pushing through, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Deep blue kraken ancient, a scarred head, one tentacle stubbed short, a chipped horn, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 19. unicorn — licorne

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
White unicorn, round body, a spiral horn, a flowing pastel mane, tiny hooves, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
White unicorn as a foal, the horn a small rounded bud, a fuzzy short mane, legs folded under it, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
White unicorn as a young unicorn, a straight unspiralled horn, a longer mane, lanky legs, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
White unicorn in old age, a dull white coat, a chipped horn, a thin grey mane, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

---

## legendary

### 20. dragon — dragon

- [ ] adult  - [ ] hatchling  - [ ] young  - [ ] elder

**adult**

```
Red dragon, round body, curved horns, spread bat wings, a spiked tail, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Red dragon as a hatchling, no wings at all, soft pale scales, stubby horn buds, a short tail, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Red dragon as a young dragon, small wing stubs, horns piercing through, a thin tail, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Red dragon ancient, dulled scales, one chipped horn, tattered wing membranes, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

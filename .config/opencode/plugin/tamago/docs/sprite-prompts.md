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
- **Juger chaque tirage à la taille réelle.** `node scripts/preview.ts --png
  a.png b.png` dessine les PNG bruts côte à côte, deux pixels par caractère
  comme dans OpenCode, avant tout import.
- **Les liens expirent en moins d'une heure.** Télécharge l'image dès que le
  tirage est fini, et note l'identifiant du tirage dans le `SOURCES.md` de
  l'espèce : c'est lui qui servira à la retoucher ou à l'animer.
- **Une posture commune.** Sans `sitting upright`, l'adulte est sorti couché et
  de trois quarts, à côté de trois stades assis de face.
- **Le young reste un chaton.** `lanky adolescent` et `long legs` ont donné un
  chat plus mûr que l'adulte ; `super chibi, big round head on a small slim
  body` le place entre le hatchling et l'adulte.
- **Retoucher ici plutôt qu'éditer.** Un œil raté ou une queue en trop se
  corrigent en quelques pixels sur le PNG — un œil recopié en miroir, une zone
  effacée — là où `edit` redessine toute l'image.
- **Juger sur le rendu importé.** La palette commune garde les 16 couleurs les
  plus employées : une couleur rare disparaît à l'import. Les yeux bleus de
  l'adulte grenouille et le ventre jaune de son young y sont passés. Montrer
  les quatre stades importés avant d'écrire l'espèce, pas seulement les PNG.
- **Le jaune fait un poussin.** Un canard jaune sort en poussin à tous les
  stades ; un colvert adulte (tête verte, corps gris) se lit tout de suite
  comme un adulte, et son caneton jaune comme un bébé. Choisir les couleurs
  de l'adulte pour qu'elles ne soient pas celles du petit.
- **Certains animaux ne se dessinent pas de face.** Le colvert demandé
  « facing the viewer » est sorti trois fois de trois quarts. Garder la pose
  que pixler réussit, la même pour les quatre stades, plutôt que payer des
  tirages contre elle ; un tirage tourné du mauvais côté se retourne en
  miroir, gratuitement.
- **300 caractères au plus** par prompt : pixler refuse au-delà.
- **Pixler remplit toujours la toile.** Un bébé tiré en 32 × 32 a la taille
  de l'adulte, quel que soit le prompt. Pour un stade plus petit, tirer sur
  une toile plus petite (le hatchling hamster en 20 × 20) puis le poser dans
  le cadre, centré, sur la même ligne du bas que les autres stades.
- **L'âge se dessine par des objets et des couleurs.** « Bare pink skin »,
  « grey muzzle », « heavy-lidded eyes » n'ont rien changé : le hamster
  sortait doré et bien réveillé. Une canne et des taches grises en ont fait
  un vieux du premier coup.
- **`edit` réussit une retouche localisée.** Sur l'escargot, « mets un œil au
  bout de chaque antenne, enlève celui de la tête » a été suivi deux fois sans
  abîmer le reste. Il rend toujours 32 couleurs ; l'import les ramène à la
  palette commune. Il reste à éviter pour tout ce qui touche l'image entière.
- **La couleur porte l'âge.** Sur le renard, un orange vif fait un jeune, un
  roux profond un adulte, un orange pâle aux oreilles grises un vieux. Un
  premier adulte orange vif est devenu le young.
- **16 couleurs pour le détail.** Le propriétaire a voulu plus de détail et
  des dégradés sur l'adulte renard : `maxColors: 16`, sans « flat colour, no
  shading » dans le prompt. L'import en garde une partie : juger sur le
  rendu importé.
- **Des yeux qui regardent devant.** Deux yeux en miroir parfait louchent
  (chacun regarde de son côté) ; les deux reflets du même côté, et deux yeux
  de même forme, les font regarder devant.
- **Le bébé à taille normale.** Le propriétaire n'aime pas les petits
  hatchlings en 20 × 20 : ils perdent leur détail. Sur le manchot, un
  hatchling en 32 × 32 « extremely chibi, giant round head on a tiny body »
  dit bébé par ses proportions, pas par sa taille.
- **Un stade tiré d'un autre par `edit`.** Quand les tirages d'adult sortent
  trop bébés ou d'un autre style, un `edit` de l'elder qui retire la canne et
  rajeunit le plumage donne un adulte du même dessin.
- **Choisir la palette à la main.** Les 32 couleurs d'un `edit` peuvent
  évincer de la palette commune des couleurs rares mais visibles des autres
  stades (la canne, un bec). Partir de la palette sans l'`edit`, y remplacer
  les couleurs les moins employées par celles de l'image éditée, et importer
  chaque stade avec `--palette`.

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
en haut à gauche, et ses patchs doivent couvrir tout l'œil dessiné, reflets et
bas de l'œil compris : mesure-le sur ses quatre côtés. Un cadre trop court
d'une ligne laisse cette ligne visible sous chaque expression — c'est arrivé à
l'adulte et à l'elder du chat. La tête s'ancre sur un point du visage, à la ligne 5 au plus
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
sont facultatives et reprennent `open` quand elles manquent — `sleeping` compris :
sans elle, la créature dort les yeux ouverts. Si les yeux d'un stade ont une
autre taille, ce stade peut porter ses propres `expressions`.

Pour un regard qui bouge (`thinking`), déplacer l'œil dessiné d'un pixel
marche mieux que le redessiner plus petit : il garde sa forme. Le patch est
alors plus grand que l'œil d'une ligne et d'une colonne, et s'ancre sur un
point à lui (`left_gaze`, `right_gaze`). Le chat en donne l'exemple.

**3. Les zones qui bougent** (`motion` : la queue, les oreilles). Retire celles
héritées des anciens dessins, ou replace-les sur le nouveau : une zone mal
placée fait glisser un morceau du corps à chaque battement.

Deux commandes font le gros du travail sur les yeux, décrites dans
`AGENTS.md` :

```sh
node scripts/eyes.ts frog --check --ink 0,c,d          # chaque cadre tient-il tout l'œil ?
node scripts/eyes.ts frog young cross --size 5x5 --ink 0,c,d --skin 7
```

La première mesure l'œil dessiné depuis chaque ancre et nomme les cadres trop
petits ; elle a trouvé cinq cadres sur huit trop courts sur la grenouille. La
seconde imprime les patches d'un regard (`shut`, `cross`, `caret`, `arc`,
`lid`, `shine`, `glance`) sans jamais toucher au contour de la silhouette.
Donne toujours `--skin` quand l'œil est cerné de foncé : sans lui, l'œil
effacé prend la couleur du cerne.

Puis `pnpm test`, qui refuse une ancre manquante, un patch qui sort du cadre,
une tête trop haute ou un coin réservé occupé, et, pour voir le résultat :

```sh
node scripts/preview.ts frog --live all    # les quatre stades animés, chaque regard à tour de rôle
```

---

## common

### 1. cat — chat

- [x] adult  - [x] hatchling  - [x] young  - [x] elder

Tirages et retouches : `docs/sprites/cat/SOURCES.md`.

**adult**

```
Grey tabby cat, round body, pointed ears, short striped tail curled at its side, sitting upright, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Grey tabby cat as a newborn kitten, head twice as large as its tiny body, ears folded flat, tail a short stub, sitting, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Grey tabby cat as a playful half-grown kitten, super chibi, big round head on a small slim body, oversized upright ears, thin legs, thin straight tail, sitting, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Grey tabby cat in old age, grey muzzle, heavy-lidded eyes, sagging belly, thin ragged tail, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 2. owl — chouette

- [x] adult  - [x] hatchling  - [x] young  - [x] elder

Tirages et retouches : `docs/sprites/owl/SOURCES.md`.

**adult**

```
Brown owl, round body, tufted ears, small hooked beak, folded wings, standing upright, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Brown owl as a tiny newborn chick, a small fluffy ball of pale grey down, huge head, no ear tufts, no wings showing, standing upright, super chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Brown owl as a fledgling, patchy down among brown feathers, ear tufts just appearing, short wings, standing upright, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Brown owl in old age, bleached ragged feathers, half-closed eyes, one ear tuft bent, standing upright, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 3. frog — grenouille

- [x] adult  - [x] hatchling  - [x] young  - [x] elder

Tirages et retouches : `docs/sprites/frog/SOURCES.md`.

**adult**

```
Green frog, wide round body, bulging cheeks, long folded hind legs, webbed toes, sitting, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Green tadpole, just a round green blob like a big droplet with two eyes on top and a thin tail curling to one side, no legs, no arms, no body, super chibi, front view, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Green frog as a tadpole seen from the front, a big round head with a small wiggly tail curling to one side, no legs at all, super chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Green frog in old age, dull mottled skin, heavy jowls, slouched posture, drooping eyelids, sitting, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

### 4. duck — canard

- [x] adult  - [x] hatchling  - [x] young  - [x] elder

Tirages et retouches : `docs/sprites/duck/SOURCES.md`. Un colvert de trois
quarts, un seul œil visible : voir ce fichier pour le pourquoi.

**adult**

```
Mallard duck, glossy green head, white neck ring, brown chest, grey body, yellow bill, orange webbed feet, facing the viewer, both eyes visible, standing upright, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling**

```
Mallard duck as a newly hatched duckling, fluffy yellow down with brown patches, tiny wings, small neat orange bill with a dark outline, head twice as large as its tiny body, three-quarter view facing left, standing, super chibi, full body, thick dark outline, solid flat colour areas, no shading
```

**young**

```
Young mallard drake, green head coming in, thin white neck ring, brown chest, grey body with a few tufts of yellow down left, short wings, yellow bill, three-quarter view facing left, standing, chibi, full body, thick dark outline, solid flat colour areas, no shading, big round black eye
```

**elder**

```
Old mallard drake, faded dull green head, greying chest and body, ragged feathers, heavy drooping eyelid, hunched, yellow bill, three-quarter view facing left, standing, chibi, full body, thick dark outline, solid flat colour areas, no shading
```

### 5. hamster — hamster

- [x] adult  - [x] hatchling  - [x] young  - [x] elder

Tirages et retouches : `docs/sprites/hamster/SOURCES.md`. Le hatchling est
tiré en 20 × 20, le young vient d'un prompt de nouveau-né, l'elder a une canne.

**adult**

```
Golden hamster, round body, tiny round ears, full cheek pouches, small pink paws, sitting upright, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling** — tiré en `20 × 20`

```
Golden hamster as a tiny baby hamster, pale cream fluffy fur, huge head on a tiny round body, stubby paws, no tail, sitting upright, super chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young**

```
Golden hamster as a tiny newborn pup, bare pink skin, almost no fur, ears sealed flat, sitting upright, super chibi, head twice as large as its tiny body, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Old golden hamster, faded pale beige fur with grey patches, bushy white eyebrows, half-closed sleepy eyes, hunched, leaning on a tiny wooden cane, sitting upright, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading
```

### 6. snail — escargot

- [x] adult  - [x] hatchling  - [x] young  - [x] elder

Tirages, `edit` et retouches : `docs/sprites/snail/SOURCES.md`. De profil vers
la droite, les yeux au bout des antennes ; hatchling en 20 × 20, young en
26 × 26.

**adult** — puis un `edit` pour les yeux

```
Pale snail with a shell on its back, a thick spiral shell, two long eye stalks, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**hatchling** — tiré en `20 × 20`

```
Pale snail with a shell on its back as a tiny baby snail, a smooth shell barely coiled, very short eye stalks with one big round black eye on the tip of each, side view facing right, super chibi, full body, thick dark outline, solid flat colour areas, no shading
```

**young** — tiré en `26 × 26`

```
Pale snail with a shell on its back as a young snail, a plain spiral shell with one clear turn, a longer body, eye stalks fully out with one big round black eye on the tip of each, side view facing right, chibi, full body, thick dark outline, solid flat colour areas, no shading
```

**elder** — puis un `edit` pour les yeux

```
Old snail, faded grey cracked shell with green moss patches, pale wrinkled body, drooping eye stalks with one big round black eye on the tip of each, bushy white eyebrows, side view facing right, chibi, full body, thick dark outline, solid flat colour areas, no shading
```

---

## uncommon

### 7. fox — renard

- [x] adult  - [x] hatchling  - [x] young  - [x] elder

Tirages, `edit` et retouches : `docs/sprites/fox/SOURCES.md`. Le young est un
tirage d'adult, l'adult et l'elder sont à 16 couleurs avec des dégradés.

**adult** — `maxColors: 16`, puis un `edit` des yeux

```
Adult red fox, detailed fur, deep rust red coat with soft colour gradients, white cheeks, cream chest bib, black ear backs, black socks, long slender snout, almond eyes, bushy tail shading to a white tip, sitting upright, chibi, front view, full body, thick dark outline
```

**hatchling** — tiré en `20 × 20`

```
Tiny baby fox cub, soft pale orange very fluffy fur, cream face, huge head on a tiny round body, small rounded ears, short stubby tail, sitting upright, super chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young** — un tirage d'adult

```
Orange fox, pointed snout, large triangular ears, thick white-tipped tail, sitting upright, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder** — `maxColors: 16`, puis un `edit` des yeux

```
Old fox, pale faded orange coat streaked with grey, soft colour gradients, grey white muzzle, bushy white eyebrows, sly half-closed eyes, holding a small wooden cane in its front paw, slight three-quarter view, sitting upright, chibi, full body, thick dark outline
```

### 8. penguin — manchot

- [x] adult  - [x] hatchling  - [x] young  - [x] elder

Tirages, `edit`, palette choisie à la main : `docs/sprites/penguin/SOURCES.md`.
Le young est un tirage d'adult, l'adult un `edit` de l'elder.

**adult** — un `edit` de l'elder

```
Remove the cane and make it stand straight as a younger adult: glossy blue black plumage, bright white belly, vivid yellow neck patch; keep the face, the eyes and the proportions unchanged
```

**hatchling** — `32 × 32`, chibi très prononcé

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

# Sources de l'escargot

D'où vient chaque image de ce dossier, pour pouvoir la retoucher ou l'animer
avec pixler plus tard. Même règle que pour le chat
(`docs/sprites/cat/SOURCES.md`) : on garde l'identifiant du tirage, pas son
lien, et une retouche faite ici doit être refaite sur toute image éditée ou
animée depuis le tirage.

L'escargot est de profil, tourné vers la droite, aux quatre stades : demandé
de face, pixler l'a dessiné de profil trois fois sur trois. Ses yeux sont au
bout des antennes. Pixler les mettait sur la tête : l'adult et l'elder ont été
corrigés par un `edit`, qui a cette fois fait ce qu'on lui demandait sans
abîmer le reste. Le hatchling et le young sont gardés tels que tirés.

Le hatchling et le young sont tirés sur une toile plus petite (20 × 20 et
26 × 26), puis posés dans le cadre 32 × 32, centrés sur leurs colonnes. Les
quatre stades posent sur la ligne 30 : à la ligne 29, l'œil droit de l'adult
entrait dans la case du badge, en haut à droite.

| Stade | Tirage | Image | Taille | Retouche locale |
| --- | --- | --- | --- | --- |
| hatchling | `gen_6ff8cafe-5eec-4add-b413-9c8a4e94e88d` | 1 | 20 × 20 | posé dans le 32 × 32, décalé de (6, 15) |
| young | `gen_6a9031c6-eadd-4baa-b1fa-3dea39103715` | 2 | 26 × 26 | posé dans le 32 × 32, décalé de (3, 10) ; un reflet `#fdfbfa` ajouté au bout de l'antenne droite, en (27, 19), pour qu'elle cligne comme la gauche |
| adult | `gen_918f797b-8936-4210-8b5d-4d6d6e34890d` | 0 | 32 × 32 | c'est l'`edit` de `gen_13ae2ee3-ba40-4431-acdf-b72bf9d590fa` image 1 ; descendu d'un pixel ; un reflet `#fdfbfa` ajouté à l'œil gauche, en (24, 4), qui n'en avait pas |
| elder | `gen_f0876bbb-0742-4c57-a6e5-d1b7dfd707a3` | 0 | 32 × 32 | c'est l'`edit` de `gen_a53e1526-c415-46fe-94a3-f7a84d8ba111` image 2 ; descendu de 4 pixels ; les deux reflets, que le détourage avait rendus transparents, rebouchés en `#fdfbfa`, en (24, 10) et (29, 11) |

Les coordonnées sont en pixels, comptées à partir de 0 depuis le coin en haut
à gauche. Tous les tirages sont faits à `maxColors: 12`, `transparent: true`,
`count: 3` ; un `edit` n'a pas de réglage de couleurs et rend 32 couleurs, que
l'import ramène à la palette commune.

## Prompts

pixler refuse un prompt de plus de 300 caractères.

**hatchling**

```
Pale snail with a shell on its back as a tiny baby snail, a smooth shell barely coiled, very short eye stalks with one big round black eye on the tip of each, side view facing right, super chibi, full body, thick dark outline, solid flat colour areas, no shading
```

**young**

```
Pale snail with a shell on its back as a young snail, a plain spiral shell with one clear turn, a longer body, eye stalks fully out with one big round black eye on the tip of each, side view facing right, chibi, full body, thick dark outline, solid flat colour areas, no shading
```

**adult** — demandé de face, sorti de profil ; puis l'`edit` :

```
Pale snail with a shell on its back, a thick spiral shell, two long eye stalks, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

```
Put one big round black eye with a white highlight on the tip of each of the two eye stalks, remove the eye from the head, and make the shell spiral a plain spiral with no face
```

**elder** — puis l'`edit` :

```
Old snail, faded grey cracked shell with green moss patches, pale wrinkled body, drooping eye stalks with one big round black eye on the tip of each, bushy white eyebrows, side view facing right, chibi, full body, thick dark outline, solid flat colour areas, no shading
```

```
Put one big round black eye with a white highlight on the tip of each of the two drooping eye stalks, and remove the eye from the head
```

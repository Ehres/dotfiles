# Sources de la chauve-souris

D'où vient chaque image de ce dossier, pour pouvoir la retoucher ou l'animer
avec pixler plus tard. Même règle que pour le chat
(`docs/sprites/cat/SOURCES.md`) : on garde l'identifiant du tirage, pas son
lien, et une retouche faite ici doit être refaite sur toute image éditée ou
animée depuis le tirage.

Une chauve-souris chibi, de face, aux quatre stades, tirée à `maxColors: 16`
avec des dégradés. Le hatchling et le young viennent du même tirage d'adult :
l'un faisait bébé, l'autre jeune. Pour l'adult, demander de grandes ailes
déployées rétrécit le corps (pixler remplit la largeur avec les ailes, le
visage tombe à quelques pixels) ; des ailes levées de chaque côté de la tête
gardent le corps assez grand. L'elder reste dans le violet, avec des touffes
blanches sur la tête, et sans canne.

Les couleurs portent l'âge : violet sombre et rond pour le hatchling,
gris-mauve pour le young, violet profond pour l'adult, mauve fané pour
l'elder.

Les quatre stades posent sur la ligne 31.

| Stade | Tirage | Image | Retouche locale |
| --- | --- | --- | --- |
| hatchling | `gen_40c362a6-13b6-49b3-90e0-9dd57724b764` | 2 | descendu de deux pixels |
| young | `gen_40c362a6-13b6-49b3-90e0-9dd57724b764` | 1 | descendu de deux pixels |
| adult | `gen_d25f0e16-2b79-498a-b268-f75d8c421dab` | 0 | œil droit recopié en miroir sur le gauche : (12,13), (12,14), (12,15), (13,15) en `#090720`, (13,14) en reflet `#fdfdfd`, (14,15) rendu à la peau `#63537f` ; puis descendu de quatre pixels |
| elder | `gen_b7051556-cdc7-4415-b878-015f5f0dd3ed` | 1 | descendu de trois pixels |

Les coordonnées sont en pixels, comptées à partir de 0 depuis le coin en haut
à gauche, sur le tirage avant qu'il soit descendu. Tous les tirages sont faits
à `maxColors: 16`, `transparent: true`, `count: 3`.

## Palette

L'import commun fusionnait le violet du visage de l'adult (`#63537f`) avec un
gris-mauve voisin, et l'adult virait au terne. La palette déduite n'avait que
quinze couleurs : `#63537f` y est ajouté en seizième, et chaque stade est
importé avec `--palette` :

```
#5e4f67,#3f3357,#051025,#ac97ad,#9e768b,#d36d84,#953463,#fd7d83,#cb4c69,#835b74,#fcfaea,#fd4377,#7c6b95,#e1c7c8,#f5aab6,#63537f
```

## Prompts

pixler refuse un prompt de plus de 300 caractères.

**hatchling** et **young** — le même tirage, images 2 et 1

```
Adult bat, chibi, round fluffy dark purple body with soft gradients, huge pointed ears with pink insides, small folded wings, two tiny white fangs, pink blush, two identical big round black eyes with white highlights, front view facing the viewer, full body, thick dark outline
```

**adult**

```
Adult bat, chibi, deep violet fur with soft gradients, big body filling the whole frame, large wings raised up beside its head, big pointed ears with pink insides, two tiny white fangs, two identical round black eyes with white highlights, front view, full body, thick dark outline
```

**elder**

```
Old bat, chibi, faded dusty violet fur with soft gradients, white tufts on its head, large wings raised up beside its head with a small tear, big pointed ears with pink insides, two identical round black eyes with white highlights, front view, full body, thick dark outline
```

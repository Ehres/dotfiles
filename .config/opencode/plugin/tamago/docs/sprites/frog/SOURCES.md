# Sources de la grenouille

D'où vient chaque image de ce dossier, pour pouvoir la retoucher ou l'animer
avec pixler plus tard. Même règle que pour le chat
(`docs/sprites/cat/SOURCES.md`) : on garde l'identifiant du tirage, pas son
lien.

| Stade | Tirage | Image | Retouche locale |
| --- | --- | --- | --- |
| hatchling | `gen_ffb85979-be21-4528-9b33-a8b9d20750ae` | 0 | aucune |
| young | `gen_73b195dd-0126-43fe-9bbc-adf8027fdc99` | 0 | aucune |
| adult | `gen_0f5a6ce5-233d-415d-94b2-bf6fbf0ffd55` | 0 | aucune |
| elder | `gen_73c4c946-f28f-4ff8-a664-7915f9d79751` | 0 | aucune |

Tous les tirages sont faits à `32 × 32`, `maxColors: 12`, `transparent: true`,
`count: 1`.

Les quatre images comptent 48 couleurs à elles toutes ; la palette commune en
garde 16. L'import a sacrifié les couleurs rares : les yeux bleus de l'adulte
et le ventre jaune pâle du young sont devenus vert-gris et beige dans le jeu.
Choix assumé, pris en voyant le rendu importé. Pour les retrouver, fournir sa
propre palette à `scripts/import.ts --palette`.

## Prompts

**hatchling** — les deux prompts « tadpole » de la doc ont donné une grenouille
couchée de profil, puis une jeune grenouille à queue (gardée comme young).
Celui-ci ne parle plus de grenouille :

```
Green tadpole, just a round green blob like a big droplet with two eyes on top and a thin tail curling to one side, no legs, no arms, no body, super chibi, front view, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**young** — tiré pour le hatchling :

```
Green frog as a tadpole seen from the front, a big round head with a small wiggly tail curling to one side, no legs at all, super chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**adult**

```
Green frog, wide round body, bulging cheeks, long folded hind legs, webbed toes, sitting, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

**elder**

```
Green frog in old age, dull mottled skin, heavy jowls, slouched posture, drooping eyelids, sitting, chibi, front view, full body, thick dark outline, solid flat colour areas, no shading, big round black eyes set wide apart
```

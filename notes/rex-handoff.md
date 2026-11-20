# Rex : premier essai du copy mode

L’utilisateur veut essayer Rex progressivement comme alternative à Ghostty + tmux. Son critère décisif : remonter dans l’historique, sélectionner du texte et le copier sans souris, en gardant `Ctrl+B` comme leader. Aucun essai dans Rex ni changement de configuration n’a encore été effectué.

## Prochaine session : tester un seul raccourci

1. Ouvrir un shell dans Rex. `echo "$TMUX"` doit être vide : le [`.zshrc`](../.zshrc) peut rattacher automatiquement le shell à tmux. Au besoin, définir `NO_TMUX=1` dans l’environnement du shell avant le démarrage de zsh.
2. Ajouter cette ligne à `~/.config/rex/init.lua`, puis recharger la configuration :

   ```lua
   rex.bind("ctrl+b>[", "pane.copy_mode.enter")
   ```

3. Afficher un log de plusieurs écrans. Appuyer sur `Ctrl+B`, relâcher, puis taper `[`. Remonter avec `Ctrl+U`, sélectionner une ligne avec `V`, étendre la sélection avec `k`, puis copier et quitter avec `y`. Coller dans un éditeur pour vérifier que les bonnes lignes ont été copiées.

Si le leader ne fonctionne pas, essayer le raccourci natif `Cmd+Shift+C` pour distinguer un problème de binding d’un problème de disponibilité du copy mode. La documentation macOS confirme le mode natif ; sa version minimale n’a pas été vérifiée.

S’arrêter après cet essai et demander si le geste convient. Les popups et la navigation entre Neovim et les panes Rex pourront attendre. `yrr` copie déjà `file:line` [depuis Neovim](../.config/nvim/lua/plugins/copy-reference.lua) sans dépendre de tmux.

## Références

- [Copy mode natif de Rex sur macOS](https://www.superlogical.com/rex/docs/reference/mac-actions#action-pane-copy-mode-enter)
- [Séquences de touches avec leader](https://www.superlogical.com/rex/docs/customize/key-sequences)
- [Emplacement et rechargement de la configuration](https://www.superlogical.com/rex/docs/customize/config)

## Suggested skills

- `find-docs` : à charger via le Skill tool si le comportement observé diffère de la documentation ou si la syntaxe du binding doit être vérifiée.

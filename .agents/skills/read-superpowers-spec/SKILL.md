---
name: read-superpowers-spec
description: Use when asking the user to read, look over, review, or approve a Superpowers design spec, so it can be opened in a tmux side pane first.
---

Before asking the user to review a Superpowers spec, set `spec_path` to its exact path and run:

```sh
bash "$HOME/.agents/skills/read-superpowers-spec/open-spec.sh" "$spec_path"
```

If opening fails, report the error and give the path, then ask the user to read the spec normally. Outside tmux, give the path and ask the user to read it normally. If the file is missing, do not request review. Otherwise ask for review, mentioning the path. Do not wait for Neovim to close. Later plugins may restore lint diagnostics.

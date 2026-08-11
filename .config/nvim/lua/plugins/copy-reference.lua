return {
  "cajames/copy-reference.nvim",
  opts = {},
  -- Upstream keymaps, on trial. `yr` in visual mode makes `y` an ambiguous
  -- prefix, so every visual yank stalls for `timeoutlen` (300ms here) before
  -- firing. If that gets annoying, drop these for a `<leader>fC*` entry
  -- alongside the other path helpers in config/keymaps.lua.
  keys = {
    { "yr", "<cmd>CopyReference file<cr>", mode = { "n", "v" }, desc = "Copy file path" },
    { "yrr", "<cmd>CopyReference line<cr>", mode = { "n", "v" }, desc = "Copy file:line reference" },
  },
  cmd = "CopyReference",
}

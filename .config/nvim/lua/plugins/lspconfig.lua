return {
  "neovim/nvim-lspconfig",
  opts = {
    inlay_hints = { enabled = false },
    servers = {
      tsc = { enabled = true, mason = false },
      vtsls = { enabled = false },
    },
  },
}

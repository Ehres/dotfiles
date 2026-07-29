-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here

-- Disable inlay hints to avoid TypeScript 5.5.2 bug
-- vim.lsp.inlay_hint.enable(false)

-- Root detection: prefer the git top-level so grep/find/explorer all scope to the
-- whole monorepo instead of the LSP-detected package/lib root. Falls back to cwd.
vim.g.root_spec = { ".git", "cwd" }

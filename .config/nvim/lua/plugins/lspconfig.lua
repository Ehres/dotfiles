local function find_frontend_checkout(root_dir)
  if not root_dir then
    return nil
  end

  local workspace_file = vim.fs.find("pnpm-workspace.yaml", { path = root_dir, upward = true })[1]
  if not workspace_file then
    return nil
  end

  local workspace_root = vim.fs.dirname(workspace_file)
  if root_dir ~= workspace_root .. "/packages/apps/frontend" then
    return nil
  end

  if vim.fn.filereadable(workspace_root .. "/packages/libs/pharaoh-next/src/styles/theme.scoped.css") ~= 1 then
    return nil
  end

  return workspace_root
end

return {
  "neovim/nvim-lspconfig",
  opts = {
    inlay_hints = { enabled = false },
    servers = {
      tsc = { enabled = true, mason = false },
      vtsls = { enabled = false },
      tailwindcss = {
        before_init = function(_, new_config)
          new_config.settings = new_config.settings or {}
          new_config.settings = vim.tbl_deep_extend("keep", new_config.settings, {
            editor = { tabSize = vim.lsp.util.get_effective_tabstop() },
          })

          local workspace_root = find_frontend_checkout(new_config.root_dir)
          if workspace_root then
            new_config.settings.tailwindCSS = new_config.settings.tailwindCSS or {}
            new_config.settings.tailwindCSS.experimental = new_config.settings.tailwindCSS.experimental or {}
            new_config.settings.tailwindCSS.experimental.configFile = {
              [workspace_root .. "/packages/libs/pharaoh-next/src/styles/theme.scoped.css"] = workspace_root
                .. "/packages/apps/frontend/src/**",
            }
          end
        end,
      },
    },
  },
}

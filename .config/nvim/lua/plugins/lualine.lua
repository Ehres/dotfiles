return {
  "nvim-lualine/lualine.nvim",
  opts = function(_, opts)
    opts.options = vim.tbl_deep_extend("force", opts.options or {}, {
      theme = "auto",
      component_separators = "",
      section_separators = { left = "", right = "" },
    })

    -- opencode's session status. Added here rather than from opencode.lua's
    -- config(): a require("lualine").setup() over there loaded lualine eagerly
    -- and replaced every section, making the result depend on load order.
    -- Wrapped in a function so opencode is only required when the component is
    -- first drawn.
    opts.sections = opts.sections or {}
    opts.sections.lualine_z = opts.sections.lualine_z or {}
    table.insert(opts.sections.lualine_z, 1, function()
      local ok, opencode = pcall(require, "opencode")
      return ok and opencode.statusline() or ""
    end)
  end,
}

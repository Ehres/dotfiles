return {
  "nvim-lualine/lualine.nvim",
  opts = {
    options = {
      theme = "auto",
      component_separators = "",
      section_separators = { left = "", right = "" },
    },
    sections = {
      lualine_a = { { "mode", separator = { left = "" }, right_padding = 2 } },
      lualine_b = { "branch", "diff", "diagnostics" },
      lualine_x = { "location" },
      lualine_y = { "progress", "filetype" },
      lualine_z = {},
    },
    inactive_sections = {
      --   lualine_a = { "filename" },
      --   lualine_b = {},
      --   lualine_c = {},
      --   lualine_x = {},
      --   lualine_y = {},
      -- lualine_z = { "location" },
    },
    tabline = {},
    winbar = {},
    inactive_winbar = {},
    extensions = {},
  },
}

return {
  "folke/tokyonight.nvim",
  opts = {
    transparent = true,
    styles = {
      sidebars = "transparent",
      floats = "dark",
    },
    on_highlights = function(hl, c)
      hl.CursorLineNr = {
        fg = c.orange,
        bold = true,
      }
      hl.LineNrAbove = {
        fg = c.cyan,
        bold = false,
      }
      hl.LineNrBelow = {
        fg = c.cyan,
        bold = false,
      }
    end,
  },
}

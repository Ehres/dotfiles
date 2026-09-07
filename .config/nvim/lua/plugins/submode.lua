return {
  "pogyomo/submode.nvim",
  version = "6.4.3",
  commit = "d3cd2ceed6e2379caba6ec2e75dc50a9a832be63",
  lazy = true,
  keys = {
    { "<leader>wr", desc = "Resize windows" },
  },
  config = function()
    local submode = require("submode")

    submode.create("WinResize", {
      mode = "n",
      enter = "<leader>wr",
      leave = { "<Esc>" },
      default = function(register)
        register(">", "<Cmd>vertical resize +10<CR>")
        register("<", "<Cmd>vertical resize -10<CR>")
        register("+", "<Cmd>resize +10<CR>")
        register("-", "<Cmd>resize -10<CR>")
      end,
    })
  end,
}

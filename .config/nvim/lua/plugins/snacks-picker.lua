return {
  "folke/snacks.nvim",
  opts = {
    picker = {
      enabled = true,
      win = {
        input = {
          keys = {
            ["<C-h>"] = { "toggle_hidden", mode = { "i", "n" } },
            ["<C-i>"] = { "toggle_ignored", mode = { "i", "n" } },
          },
        },
      },
    },
  },
  keys = {
    {
      "<leader><space>",
      function()
        Snacks.picker.files({
          hidden = true,
          ignore = {
            ".git/",
            "node_modules/",
            ".DS_Store",
            "*.log",
            "*.tmp",
            "*.cache",
            "__pycache__/",
            "*.pyc",
            ".venv/",
            ".env",
            "dist/",
            "build/",
            "target/",
            ".next/",
            ".nuxt/",
            "coverage/",
          },
        })
      end,
      desc = "Find Files (with hidden and ignore patterns)",
    },
  },
}

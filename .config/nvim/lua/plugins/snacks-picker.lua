return {
  "folke/snacks.nvim",
  opts = {
    picker = {
      enabled = true,
      sources = {
        grep = { hidden = false, ignored = false },
      },
      win = {
        input = {
          keys = {
            ["<C-h>"] = { "toggle_hidden", mode = { "i", "n" } },
            ["<C-g>"] = { "toggle_ignored", mode = { "i", "n" } },
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
          ignored = false,
          hidden = false,
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
    {
      "<leader>sf",
      function()
        vim.ui.input({ prompt = "Grep in folder (glob ok, e.g. frontend or */frontend): " }, function(input)
          if not input or input == "" then
            return
          end

          local pattern = input:find("[/*]") and input or ("**/" .. input)
          local cwd = vim.fn.getcwd()
          local matches = vim.fn.globpath(cwd, pattern, false, true)
          matches = vim.tbl_filter(function(p)
            return vim.fn.isdirectory(p) == 1 and not p:match("/node_modules/") and not p:match("/%.git/")
          end, matches)

          if #matches == 0 then
            vim.notify("No matching folder for: " .. input, vim.log.levels.WARN)
            return
          end

          local function grep_in(dir)
            Snacks.picker.grep({ dirs = { dir } })
          end

          if #matches == 1 then
            grep_in(matches[1])
            return
          end

          vim.ui.select(matches, {
            prompt = "Select folder:",
            format_item = function(p)
              return vim.fn.fnamemodify(p, ":.")
            end,
          }, function(choice)
            if choice then
              grep_in(choice)
            end
          end)
        end)
      end,
      desc = "Grep (folder, glob)",
    },
  },
}

local nav_panes = { left = "L", down = "D", up = "U", right = "R" }

-- The explorer's list/input are floats, so `wincmd h/j/k/l` always just leaves
-- the float instead of honouring the direction. vim-tmux-navigator therefore
-- never sees a tab-page edge and never forwards to tmux. Do it by hand.
local function nav(dir)
  return function(picker)
    local pos = picker.layout.root.opts.position or "left"
    local toward_editor = (pos == "left" and dir == "right") or (pos == "right" and dir == "left")
    local main = toward_editor and picker.main or nil
    if main and vim.api.nvim_win_is_valid(main) and main ~= vim.api.nvim_get_current_win() then
      vim.api.nvim_set_current_win(main)
      return
    end
    if vim.env.TMUX then
      local socket = vim.split(vim.env.TMUX, ",")[1]
      vim.system({ "tmux", "-S", socket, "select-pane", "-" .. nav_panes[dir] })
    end
  end
end

return {
  "folke/snacks.nvim",
  opts = {
    picker = {
      enabled = true,
      sources = {
        grep = { hidden = false, ignored = false },
        explorer = {
          actions = {
            nav_left = nav("left"),
            nav_down = nav("down"),
            nav_up = nav("up"),
            nav_right = nav("right"),
          },
          win = {
            list = {
              keys = {
                ["<C-h>"] = "nav_left",
                ["<C-j>"] = "nav_down",
                ["<C-k>"] = "nav_up",
                ["<C-l>"] = "nav_right",
              },
            },
          },
        },
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
    -- disable LazyVim's default snacks grep, replaced by fff live grep
    { "<leader>/", false },
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

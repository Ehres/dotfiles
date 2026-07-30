return {
  "NickvanDyke/opencode.nvim",
  version = "*",
  dependencies = {
    {
      "folke/snacks.nvim",
      optional = true,
      opts = {
        input = {
          enabled = true,
        },
        picker = {
          actions = {
            opencode_send = function(picker)
              local items = vim.tbl_map(function(item)
                return item.file
                  and require("opencode").format({ path = item.file, from = item.pos, to = item.end_pos })
                  or item.text
              end, picker:selected({ fallback = true }))
              require("opencode").prompt(table.concat(items, ", ") .. " ")
            end,
          },
          win = {
            input = {
              keys = {
                ["<a-a>"] = { "opencode_send", mode = { "n", "i" } },
              },
            },
          },
        },
      },
    },
  },
  config = function()
    local opencode_cmd = "opencode --port"

    local function tmux_start()
      local handle = vim.fn.system("tmux split-window -h -d -P -F '#{pane_id}' " .. vim.fn.shellescape(opencode_cmd))
      vim.g.opencode_tmux_pane = vim.trim(handle)
    end

    local function tmux_stop()
      local pane = vim.g.opencode_tmux_pane
      if pane then
        vim.fn.system("tmux kill-pane -t " .. vim.fn.shellescape(pane))
        vim.g.opencode_tmux_pane = nil
      end
    end

    local function tmux_pane_exists()
      local pane = vim.g.opencode_tmux_pane
      if not pane then
        return false
      end
      local result =
        vim.fn.system("tmux display-message -t " .. vim.fn.shellescape(pane) .. " -p '#{pane_id}' 2>/dev/null")
      return vim.trim(result) ~= ""
    end

    ---@type opencode.Opts
    vim.g.opencode_opts = {
      server = {
        start = tmux_start,
      },
    }

    -- Required for `opts.events.reload`
    vim.opt.autoread = true

    -- Toggle opencode (server.toggle was removed in v0.11.0; wire it manually)
    vim.keymap.set({ "n", "t" }, "<leader>ot", function()
      if tmux_pane_exists() then
        tmux_stop()
      else
        tmux_start()
      end
    end, { desc = "Toggle opencode" })

    -- Ask opencode (free-form)
    vim.keymap.set("n", "<leader>oA", function()
      require("opencode").ask()
    end, { desc = "Ask opencode" })

    -- Ask opencode about context (cursor or selection)
    vim.keymap.set({ "n", "v" }, "<leader>oa", function()
      require("opencode").ask("@this: ")
    end, { desc = "Ask opencode about this" })

    -- New session
    vim.keymap.set("n", "<leader>on", function()
      require("opencode").command("session.new")
    end, { desc = "New opencode session" })

    -- Scroll messages
    vim.keymap.set("n", "<S-C-u>", function()
      require("opencode").command("session.half.page.up")
    end, { desc = "Scroll opencode up" })

    vim.keymap.set("n", "<S-C-d>", function()
      require("opencode").command("session.half.page.down")
    end, { desc = "Scroll opencode down" })

    -- Submit / clear current prompt
    vim.keymap.set("n", "<leader>o<CR>", function()
      require("opencode").command("prompt.submit")
    end, { desc = "Submit opencode prompt" })

    vim.keymap.set("n", "<leader>ox", function()
      require("opencode").command("prompt.clear")
    end, { desc = "Clear opencode prompt" })

    -- Select (picker for all opencode actions)
    vim.keymap.set({ "n", "v" }, "<leader>os", function()
      require("opencode").select()
    end, { desc = "Select opencode action" })

    -- Operator (range with dot-repeat)
    vim.keymap.set({ "n", "x" }, "go", function()
      return require("opencode").operator("@this ")
    end, { desc = "Add range to opencode", expr = true })

    vim.keymap.set("n", "goo", function()
      return require("opencode").operator("@this ") .. "_"
    end, { desc = "Add line to opencode", expr = true })

    -- Explain code (custom prompt)
    vim.keymap.set("n", "<leader>oe", function()
      require("opencode").prompt("Explain @this and its context")
    end, { desc = "Explain this code" })

    -- The statusline component lives in lua/plugins/lualine.lua: calling
    -- require("lualine").setup() from here forced lualine to load at startup and
    -- replaced its sections wholesale, so whichever plugin configured it last won.
  end,
}

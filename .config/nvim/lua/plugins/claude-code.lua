return {
  "coder/claudecode.nvim",
  dependencies = { "folke/snacks.nvim" },
  config = true,
  keys = {
    { "<leader>a", nil, desc = "AI/Claude Code" },
    { "<leader>at", "<cmd>ClaudeCode<cr>", desc = "Toggle Claude" },
    { "<leader>ar", "<cmd>ClaudeCode --resume<cr>", desc = "Resume Claude" },
    { "<leader>aC", "<cmd>ClaudeCode --continue<cr>", desc = "Continue Claude" },
    { "<leader>am", "<cmd>ClaudeCodeSelectModel<cr>", desc = "Select Claude model" },
    { "<leader>ab", "<cmd>ClaudeCodeAdd %<cr>", desc = "Add current buffer" },
    { "<leader>as", "<cmd>ClaudeCodeSend<cr>", mode = "v", desc = "Send to Claude" },
    {
      "<leader>as",
      "<cmd>ClaudeCodeTreeAdd<cr>",
      desc = "Add file",
      ft = { "NvimTree", "neo-tree", "oil", "minifiles", "netrw", "Explorer", "snacks_picker_list" },
    },
    -- Diff management
    { "<leader>aa", "<cmd>ClaudeCodeDiffAccept<cr>", desc = "Accept diff" },
    { "<leader>ad", "<cmd>ClaudeCodeDiffDeny<cr>", desc = "Deny diff" },
  },
  opts = {
    terminal = {
      provider = "external",
      provider_opts = {
        external_terminal_cmd = function()
          return {
            "bash",
            "-c",
            [[
              pane_id=$(tmux split-window -d -h -P -F '#{pane_id}' "claude --ide --dangerously-skip-permissions")
              trap "tmux kill-pane -t $pane_id 2>/dev/null" EXIT
              while tmux list-panes -F '#{pane_id}' 2>/dev/null | grep -qF "$pane_id"; do
                sleep 1
              done
            ]],
          }
        end,
      },
    },
  },
}

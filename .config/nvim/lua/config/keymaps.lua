-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here

-- ~/.config/nvim/lua/config/keymaps.lua
-- Copy current file path helpers using <leader>fC*

local function copy_to_clipboard(str, label)
  if str == nil or str == "" then
    vim.notify("Nothing to copy (" .. label .. ")", vim.log.levels.WARN)
    return
  end
  vim.fn.setreg("+", str)
  vim.notify(("Copied %s: %s"):format(label, str))
end

-- Relative path to current working directory
vim.keymap.set("n", "<leader>fCr", function()
  copy_to_clipboard(vim.fn.expand("%"), "relative path")
end, { desc = "Copy file relative path" })

-- Absolute path
vim.keymap.set("n", "<leader>fCa", function()
  copy_to_clipboard(vim.fn.expand("%:p"), "absolute path")
end, { desc = "Copy file absolute path" })

-- File name (tail)
vim.keymap.set("n", "<leader>fCn", function()
  copy_to_clipboard(vim.fn.expand("%:t"), "file name")
end, { desc = "Copy file name" })

-- Directory of current file
vim.keymap.set("n", "<leader>fCD", function()
  copy_to_clipboard(vim.fn.expand("%:p:h"), "file directory")
end, { desc = "Copy file directory" })

-- Git repo-relative path (falls back to CWD-relative)
vim.keymap.set("n", "<leader>fCR", function()
  local rel = vim.fn.expand("%")
  -- Try to compute path relative to git top-level
  local git_root = vim.fn.systemlist("git rev-parse --show-toplevel")[1]
  if git_root and git_root ~= "" and vim.v.shell_error == 0 then
    local abs = vim.fn.expand("%:p")
    if vim.startswith(abs, git_root .. "/") or abs == git_root then
      rel = abs:sub(#git_root + 2) -- remove "<git_root>/"
    end
    copy_to_clipboard(rel, "git repo-relative path")
  else
    copy_to_clipboard(rel, "relative path")
  end
end, { desc = "Copy file path (repo-relative if in git)" })

local M = {}

function M.focus_pane(direction)
  local result = vim.system({ "rex", "focus", "-s", vim.env.REX_SESSION, direction }, { text = true }):wait()
  if result.code ~= 0 then
    vim.notify(vim.trim(result.stderr), vim.log.levels.WARN)
  end
end

local function navigate(direction, motion)
  local current = vim.api.nvim_get_current_win()
  vim.cmd("wincmd " .. motion)
  if vim.api.nvim_get_current_win() == current then
    M.focus_pane(direction)
  end
end

function M.setup()
  for direction, motion in pairs({ left = "h", down = "j", up = "k", right = "l" }) do
    vim.keymap.set("n", "<C-" .. motion .. ">", function()
      navigate(direction, motion)
    end, { desc = "Focus split or Rex pane " .. direction })
  end
end

return M

local passthrough = { fzf = true, view = true, vi = true, vim = true, vimx = true, nvim = true, lvim = true }
local directions = { h = "left", j = "down", k = "up", l = "right" }

rex.action({
  name = "navigate_pane",
  title = "Navigate Pane",
  args = { motion = "string" },
  run = function(ctx, args)
    local process = rex.block.call("com.superlogical.terminal", "process", { block_id = ctx.block_id })
    local name = process and process.foreground and process.foreground.name or ""
    name = name:lower():gsub("^g?%.?", ""):gsub("%-wrapped$", ""):gsub("diff$", "")
    if passthrough[name] then
      rex.client.queue("pane.send_key", { key = "ctrl+" .. args.motion })
    else
      rex.client.queue("pane.focus", { direction = directions[args.motion] })
    end
  end,
})

for motion in pairs(directions) do
  rex.bind("ctrl+" .. motion, "navigate_pane", { motion = motion })
end

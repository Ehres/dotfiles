rex.action({
  name = "open_lazygit",
  title = "Open lazygit",
  run = function(ctx)
    local process = assert(rex.block.call("com.superlogical.terminal", "process", { block_id = ctx.block_id }))
    local cwd = assert(process.foreground and process.foreground.cwd, "Cannot determine the active pane's directory")
    return assert(rex.call("session.new_layer", {
      session_id = ctx.session_id,
      window_id = ctx.window_id,
      bounds = { 0.05, 0.05, 0.9, 0.9 },
      focus = true,
      layout = rex.layout.block({
        flavor = "com.superlogical.terminal.shell",
        label = "lazygit",
        options = { cwd = cwd, command = { "lazygit" } },
      }),
    }))
  end,
})

require("dash")
require("lazygit")
require("pane-navigation")

-- Match Ghostty: OpenCode uses F6 to cycle favorite models.
rex.bind("ctrl+m", "pane.send_key", { key = "f6" })
rex.bind("cmd+h", "client.tab.previous")
rex.bind("cmd+l", "client.tab.next")

rex.mode("leader", { exclusive = true })
rex.bind("ctrl+b", "client.mode.enter", { name = "leader", once = true })
rex.bind("leader/ctrl+b", "pane.send_key", { key = "ctrl+b" })
rex.bind("leader/[", "pane.copy_mode.enter")
rex.bind("leader/s", "session.switch")
rex.bind("leader/d", "toggle_dash")
rex.bind("leader/g", "open_lazygit")
rex.bind("leader/-", "pane.split.down")
rex.bind("leader/\\", "pane.split.right")
rex.bind("leader/z", "pane.zoom")
rex.bind("leader/r", "client.mode.enter", { name = "resize" })
rex.unbind("cmd+shift+p")
rex.bind("leader/shift+;", "client.palette.toggle") -- : on the ABC layout

rex.mode("resize", { exclusive = true })
rex.bind("resize/h", "pane.resize", { direction = "left" })
rex.bind("resize/j", "pane.resize", { direction = "down" })
rex.bind("resize/k", "pane.resize", { direction = "up" })
rex.bind("resize/l", "pane.resize", { direction = "right" })
rex.bind("resize/=", "pane.balance")

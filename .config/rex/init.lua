rex.mode("leader", { exclusive = true })
rex.bind("ctrl+b", "client.mode.enter", { name = "leader", once = true })
rex.bind("leader/ctrl+b", "pane.send_key", { key = "ctrl+b" })

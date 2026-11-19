rex.mode("leader", { exclusive = true })
rex.bind("ctrl+b", "client.mode.enter", { name = "leader", once = true })
rex.bind("leader/ctrl+b", "pane.send_key", { key = "ctrl+b" })
rex.bind("leader/n", "client.tab.next")
rex.bind("leader/p", "client.tab.previous")
rex.bind("leader/s", "session.switch")
rex.unbind("cmd+shift+p")
rex.bind("leader/shift+;", "client.palette.toggle") -- : on the ABC layout

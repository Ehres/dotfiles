rex.action({
  name = "open_pane_link",
  title = "Ouvrir un lien du panneau",
  args = { copy = "boolean?" },
  run = function(ctx, args)
    local helper = os.getenv("HOME") .. "/.config/rex/pane-links.py"
    local process = rex.block.call("com.superlogical.terminal", "process", { block_id = ctx.block_id })
    local cwd = process and process.foreground and process.foreground.cwd
    local result = assert(rex.exec({ "/usr/bin/python3", helper, ctx.session_id, ctx.block_id, cwd or "" }))
    assert(result.ok, result.stderr)

    local items = {}
    local rows = rex.json.decode(result.stdout)
    for index, row in ipairs(rows) do
      local location = row.target
      if row.line then
        location = location .. ":" .. row.line .. (row.column and ":" .. row.column or "")
      end
      row.location = location
      table.insert(items, {
        id = tostring(index),
        title = row.title,
        subtitle = location ~= row.title and location or nil,
        icon = row.kind == "web" and "globe" or "document",
      })
    end

    local choice = rex.ui.pick({
      title = args.copy and "Copier un lien (historique inclus)" or "Liens du panneau (historique inclus)",
      placeholder = #items > 0 and "Filtrer les liens et fichiers" or "Aucun lien ou fichier",
      items = items,
    })
    if not choice then return end
    local row = rows[tonumber(choice)]
    if args.copy then
      local copied = assert(rex.exec({ "/usr/bin/pbcopy" }, { stdin = row.location }))
      assert(copied.ok, copied.stderr)
      return
    end
    if row.kind == "web" then
      local opened = assert(rex.exec({ "/usr/bin/open", row.target }))
      assert(opened.ok, opened.stderr)
      return
    end

    local command = { "nvim" }
    if row.line then
      table.insert(command, string.format("+call cursor(%d,%d)", row.line, row.column or 1))
    end
    table.insert(command, "--")
    table.insert(command, row.target)
    -- Allow the native picker to finish dismissing before requesting keyboard focus.
    local delay = assert(rex.exec({ "/bin/sleep", "0.25" }))
    assert(delay.ok, delay.stderr)
    return assert(rex.call("session.new_layer", {
      session_id = ctx.session_id,
      window_id = ctx.window_id,
      bounds = { 0.05, 0.05, 0.9, 0.9 },
      focus = true,
      layout = rex.layout.block({
        flavor = "com.superlogical.terminal.shell",
        label = "Neovim",
        options = { cwd = cwd, command = command },
      }),
    }))
  end,
})

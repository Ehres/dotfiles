rex.action({
  name = "open_pane_link",
  title = "Ouvrir un lien du panneau",
  run = function(ctx)
    local helper = os.getenv("HOME") .. "/.config/rex/pane-links.py"
    local result = assert(rex.exec({ "/usr/bin/python3", helper, ctx.session_id, ctx.block_id }))
    assert(result.ok, result.stderr)

    local items = {}
    for url, label in result.stdout:gmatch("([^\t\n]+)\t([^\n]*)\n") do
      table.insert(items, {
        id = url,
        title = label ~= "" and label or url,
        subtitle = label ~= "" and url or nil,
        icon = "link",
      })
    end

    local url = rex.ui.pick({
      title = "Liens du panneau (historique inclus)",
      placeholder = #items > 0 and "Filtrer les liens" or "Aucun lien HTTP ou HTTPS",
      items = items,
    })
    if url then
      local opened = assert(rex.exec({ "/usr/bin/open", url }))
      assert(opened.ok, opened.stderr)
    end
  end,
})

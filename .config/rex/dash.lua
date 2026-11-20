local previous_session = {}

local function create_dash()
  local session = assert(rex.call("session.create", {
    label = "dash",
    initial_windows = { {
      window_label = "gh dash",
      layout = rex.layout.block({
        flavor = "com.superlogical.terminal.shell",
        options = { command = { "gh", "dash", "--config", os.getenv("HOME") .. "/.config/gh-dash/config.yml" } },
      }),
    } },
  }))
  return session.session_id
end

rex.action({
  name = "toggle_dash",
  title = "Toggle gh dash",
  run = function(ctx)
    local sessions = assert(rex.call("session.list"))
    local dash, previous
    for _, session in ipairs(sessions.sessions) do
      if session.label == "dash" then dash = session.session_id end
      if session.session_id == previous_session[ctx.client_id] then previous = session.session_id end
    end

    if dash and ctx.session_id == dash then
      if previous then
        rex.client.queue("session.select", { session_id = previous })
      else
        rex.client.queue("session.switch")
      end
    else
      previous_session[ctx.client_id] = ctx.session_id
      rex.client.queue("session.select", { session_id = dash or create_dash() })
    end
  end,
})

-- Remember work sessions per client, so a visit to Dash does not replace either one.
local history = {}

local function remember_work(ctx, sessions)
  for _, session in ipairs(sessions) do
    if session.session_id == ctx.session_id and session.label ~= "dash" then
      local recent = history[ctx.client_id] or {}
      for i, id in ipairs(recent) do
        if id == ctx.session_id then table.remove(recent, i); break end
      end
      table.insert(recent, 1, ctx.session_id)
      history[ctx.client_id] = recent
      break
    end
  end
end

local function previous_work(ctx, sessions)
  for _, id in ipairs(history[ctx.client_id] or {}) do
    for _, session in ipairs(sessions) do
      if id ~= ctx.session_id and session.session_id == id and session.label ~= "dash" then
        return id
      end
    end
  end
end

rex.action({
  name = "switch_work_session",
  title = "Change session",
  run = function(ctx)
    remember_work(ctx, assert(rex.call("session.list")).sessions)
    rex.client.queue("session.switch")
  end,
})

rex.action({
  name = "previous_work_session",
  title = "Return to previous work session",
  run = function(ctx)
    local sessions = assert(rex.call("session.list")).sessions
    remember_work(ctx, sessions)
    local previous = previous_work(ctx, sessions)
    if previous then
      rex.client.queue("session.select", { session_id = previous })
    else
      -- No recorded visit yet. Only jump if the destination is unambiguous.
      local candidate
      for _, session in ipairs(sessions) do
        if session.label ~= "dash" and session.session_id ~= ctx.session_id then
          if candidate then return rex.client.queue("session.switch") end
          candidate = session.session_id
        end
      end
      if candidate then rex.client.queue("session.select", { session_id = candidate }) end
    end
  end,
})

rex.action({
  name = "dash_reviewer_picker",
  title = "Choose a PR reviewer",
  args = { mode = "string", repo = "string", pr = "number" },
  run = function(ctx, args)
    return assert(rex.call("session.new_layer", {
      session_id = ctx.session_id,
      window_id = ctx.window_id,
      bounds = { 0.2, 0.2, 0.6, 0.6 },
      focus = true,
      layout = rex.layout.block({
        flavor = "com.superlogical.terminal.shell",
        label = args.repo .. "#" .. args.pr,
        options = { command = {
          os.getenv("HOME") .. "/scripts/gh-dash-reviewers", "--in-popup", args.mode, args.repo, tostring(args.pr),
        } },
      }),
    }))
  end,
})

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
    end

    if dash and ctx.session_id == dash then
      previous = previous_work(ctx, sessions.sessions)
      if previous then
        rex.client.queue("session.select", { session_id = previous })
      else
        rex.client.queue("session.switch")
      end
    else
      remember_work(ctx, sessions.sessions)
      rex.client.queue("session.select", { session_id = dash or create_dash() })
    end
  end,
})

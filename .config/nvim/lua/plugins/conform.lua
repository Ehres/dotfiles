local package_name_cache = {}

local function package_name_matches(package_dir, expected_name)
  local cache_key = package_dir .. "\0" .. expected_name
  local cached = package_name_cache[cache_key]
  if cached ~= nil then
    return cached
  end

  local package_file = io.open(package_dir .. "/package.json", "r")
  if not package_file then
    package_name_cache[cache_key] = false
    return false
  end

  local contents = package_file:read("*a")
  package_file:close()

  local ok, package = pcall(vim.json.decode, contents)
  local matches = ok and type(package) == "table" and package.name == expected_name
  package_name_cache[cache_key] = matches
  return matches
end

local function tailwind_context(filename)
  local normalized = vim.fs.normalize(filename)

  local frontend_marker = "/packages/apps/frontend/"
  local _, frontend_end = normalized:find(frontend_marker, 1, true)
  if frontend_end and package_name_matches(normalized:sub(1, frontend_end - 1), "@orus.eu/frontend") then
    local relative = normalized:sub(frontend_end + 1)
    local is_migration_file = relative:match("^src/.-%-v2/.+%.tsx?$")
      or relative:match("^src/modules/.+%.tsx?$")
      or relative:match("^src/shared/.+%.tsx?$")
      or relative:match("^src/lib/pharaoh%-next/.+%.tsx?$")

    if is_migration_file then
      return {
        root = normalized:sub(1, frontend_end - 1),
        sequence = { "oxfmt", "orus_oxlint_fix" },
      }
    end
  end

  local pharaoh_marker = "/packages/libs/pharaoh-next/"
  local _, pharaoh_end = normalized:find(pharaoh_marker, 1, true)
  if pharaoh_end and package_name_matches(normalized:sub(1, pharaoh_end - 1), "@orus.eu/pharaoh-next") then
    local relative = normalized:sub(pharaoh_end + 1)
    local is_component_file = relative:match("^src/components/ui/.+%.tsx?$")
      or relative:match("^src/components/patterns/.+%.tsx?$")
    local is_story = relative:match("%.stories%.tsx?$")

    if is_component_file and not is_story then
      return {
        root = normalized:sub(1, pharaoh_end - 1),
        sequence = { "oxfmt", "orus_oxlint_fix" },
      }
    end
  end
end

local function package_root(_, ctx)
  local context = tailwind_context(ctx.filename)
  return context and context.root or nil
end

local function has_tailwind_context(_, ctx)
  return tailwind_context(ctx.filename) ~= nil
end

local function formatters_for(bufnr)
  local context = tailwind_context(vim.api.nvim_buf_get_name(bufnr))
  if context then
    return context.sequence
  end

  return { "oxfmt", "prettier", stop_after_first = true }
end

local function tailwind_formatters_for(bufnr)
  local context = tailwind_context(vim.api.nvim_buf_get_name(bufnr))
  return context and context.sequence or {}
end

local tailwind_format_state = {}

local function notification_id(bufnr)
  return "orus-tailwind-format-" .. bufnr
end

local function notify_format_started(bufnr)
  vim.notify("Formatting Tailwind…", vim.log.levels.INFO, {
    id = notification_id(bufnr),
    title = "Format on save",
    timeout = 0,
  })
end

local function notify_format_result(bufnr, err)
  if err then
    vim.notify("Tailwind formatting failed: " .. err, vim.log.levels.ERROR, {
      id = notification_id(bufnr),
      title = "Format on save",
      timeout = 5000,
    })
    return
  end

  vim.notify("Tailwind formatted", vim.log.levels.INFO, {
    id = notification_id(bufnr),
    title = "Format on save",
    timeout = 1500,
  })
end

local function absolute_filename(filename)
  return vim.fs.normalize(vim.fn.fnamemodify(filename, ":p"))
end

local function formatter_error(name, result)
  local output = vim.trim(result.stderr or "")
  if output == "" then
    output = vim.trim(result.stdout or "")
  end

  if output ~= "" then
    return name .. ": " .. output
  end

  if result.signal and result.signal ~= 0 then
    return ("%s terminated by signal %d"):format(name, result.signal)
  end

  return ("%s exited with code %s"):format(name, tostring(result.code))
end

local function start_tailwind_job(bufnr, request)
  local state = tailwind_format_state[bufnr]
  if not state then
    return
  end

  state.running = true
  state.running_id = request.id
  notify_format_started(bufnr)

  local function finish(err)
    vim.schedule(function()
      if tailwind_format_state[bufnr] ~= state or state.running_id ~= request.id then
        return
      end

      state.running = false
      state.running_id = nil
      local pending = state.pending
      state.pending = nil

      if err then
        notify_format_result(bufnr, err)
      elseif not pending and state.latest_id == request.id and vim.api.nvim_buf_is_valid(bufnr) then
        local current_filename = absolute_filename(vim.api.nvim_buf_get_name(bufnr))
        if current_filename == request.filename then
          local ok, reload_err = pcall(vim.api.nvim_buf_call, bufnr, function()
            vim.cmd("edit!")
          end)
          if not ok then
            notify_format_result(bufnr, tostring(reload_err))
          else
            notify_format_result(bufnr)
          end
        else
          notify_format_result(bufnr)
        end
      end

      if pending then
        start_tailwind_job(bufnr, pending)
      end
    end)
  end

  local function run_oxlint()
    local ok, process_or_err = pcall(vim.system, {
      "pnpm",
      "exec",
      "tooling",
      "run",
      "oxlint",
      "--config",
      "oxlint.config.ts",
      "--fix",
      request.filename,
    }, { cwd = request.root, text = true }, function(result)
      if result.code ~= 0 or (result.signal and result.signal ~= 0) then
        finish(formatter_error("Oxlint", result))
      else
        finish()
      end
    end)

    if not ok then
      finish("Oxlint: " .. tostring(process_or_err))
    end
  end

  local ok, process_or_err = pcall(vim.system, {
    "pnpm",
    "exec",
    "oxfmt",
    "--write",
    request.filename,
  }, { cwd = request.root, text = true }, function(result)
    if result.code ~= 0 or (result.signal and result.signal ~= 0) then
      finish(formatter_error("Oxfmt", result))
    else
      run_oxlint()
    end
  end)

  if not ok then
    finish("Oxfmt: " .. tostring(process_or_err))
  end
end

local function queue_tailwind_job(bufnr, filename)
  local context = tailwind_context(filename)
  if not context then
    return
  end

  local state = tailwind_format_state[bufnr]
  if not state then
    state = { next_id = 0 }
    tailwind_format_state[bufnr] = state
  end

  state.next_id = state.next_id + 1
  local request = {
    id = state.next_id,
    filename = filename,
    root = context.root,
  }
  state.latest_id = request.id

  if state.running then
    state.pending = request
  else
    start_tailwind_job(bufnr, request)
  end
end

local function oxlint_formatter()
  return {
    command = "pnpm",
    args = { "exec", "tooling", "run", "oxlint", "--config", "oxlint.config.ts", "--fix", "$FILENAME" },
    stdin = false,
    cwd = package_root,
    require_cwd = true,
    condition = has_tailwind_context,
    exit_codes = { 0 },
  }
end

local function eslint_formatter()
  return {
    command = "pnpm",
    args = { "exec", "tooling", "run", "eslint", "--ext", "ts,tsx,md,mdx", "--fix", "$FILENAME" },
    stdin = false,
    tmpfile_format = "conform.$RANDOM.$FILENAME",
    cwd = package_root,
    require_cwd = true,
    condition = has_tailwind_context,
    exit_codes = { 0 },
  }
end

local function format_tailwind(bufnr)
  if tailwind_context(vim.api.nvim_buf_get_name(bufnr)) then
    return
  end
end

local function fix_eslint(bufnr)
  if not tailwind_context(vim.api.nvim_buf_get_name(bufnr)) then
    vim.notify("ESLint fixes are unavailable for this buffer", vim.log.levels.WARN, {
      title = "Orus ESLint",
    })
    return
  end

  local conform = require("conform")
  local formatter_info = conform.get_formatter_info("orus_eslint_fix", bufnr)
  if not formatter_info.available then
    vim.notify(formatter_info.available_msg or "ESLint formatter unavailable", vim.log.levels.ERROR, {
      title = "Orus ESLint",
    })
    return
  end

  conform.format({
    bufnr = bufnr,
    formatters = { "orus_eslint_fix" },
    timeout_ms = 15000,
    async = false,
  })
end

LazyVim.on_very_lazy(function()
  LazyVim.format.register({
    name = "orus-tailwind",
    priority = 200,
    primary = true,
    format = format_tailwind,
    sources = tailwind_formatters_for,
  })

  vim.api.nvim_create_user_command("OrusEslintFix", function()
    fix_eslint(vim.api.nvim_get_current_buf())
  end, {
    desc = "Fix the current Orus buffer with ESLint",
  })

  local group = vim.api.nvim_create_augroup("OrusTailwindFormat", { clear = true })
  vim.api.nvim_create_autocmd("BufWipeout", {
    group = group,
    callback = function(args)
      tailwind_format_state[args.buf] = nil
    end,
  })
  vim.api.nvim_create_autocmd("BufWritePost", {
    group = group,
    callback = function(args)
      local filename = absolute_filename(args.file ~= "" and args.file or vim.api.nvim_buf_get_name(args.buf))
      queue_tailwind_job(args.buf, filename)
    end,
  })
end)

return {
  {
    "stevearc/conform.nvim",
    opts = function(_, opts)
      opts.formatters_by_ft = opts.formatters_by_ft or {}
      opts.formatters = opts.formatters or {}

      opts.formatters.orus_oxlint_fix = oxlint_formatter()
      opts.formatters.orus_eslint_fix = eslint_formatter()

      for _, ft in ipairs({ "javascript", "javascriptreact", "typescript", "typescriptreact" }) do
        opts.formatters_by_ft[ft] = formatters_for
      end
    end,
  },
}

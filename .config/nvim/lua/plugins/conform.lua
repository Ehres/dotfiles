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
    vim.notify("Tailwind formatting failed", vim.log.levels.ERROR, {
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
  local context = tailwind_context(vim.api.nvim_buf_get_name(bufnr))
  if not context then
    return
  end

  notify_format_started(bufnr)
  local conform = require("conform")
  for _, formatter_name in ipairs(context.sequence) do
    local formatter_info = conform.get_formatter_info(formatter_name, bufnr)
    if not formatter_info.available then
      notify_format_result(bufnr, formatter_info.available_msg or "Formatter unavailable")
      return
    end
  end

  conform.format({
    bufnr = bufnr,
    formatters = context.sequence,
    timeout_ms = 15000,
    async = false,
    quiet = true,
  }, function(err)
    notify_format_result(bufnr, err)
  end)
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

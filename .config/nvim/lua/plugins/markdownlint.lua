return {
  {
    "mfussenegger/nvim-lint",
    opts = function(_, opts)
      local function project_root(filename)
        return vim.fs.root(filename, { ".git" })
      end

      local function under_docs(filename)
        local root = project_root(filename)
        if not root then
          return false
        end

        local path = vim.fs.normalize(filename)
        local docs = vim.fs.normalize(root .. "/docs")

        return vim.startswith(path, docs .. "/")
      end

      opts.linters = opts.linters or {}
      opts.linters["markdownlint-cli2"] = vim.tbl_deep_extend("force", opts.linters["markdownlint-cli2"] or {}, {
        args = {
          "--config",
          function()
            local filename = vim.api.nvim_buf_get_name(0)
            local root = assert(project_root(filename))
            return root .. "/.markdownlint-cli2.jsonc"
          end,
          "-",
        },
        condition = function(ctx)
          return under_docs(ctx.filename)
        end,
      })
    end,
  },
}

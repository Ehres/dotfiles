-- Tests and stories get their own icon instead of the generic React one.
-- mini.icons tries the longest dotted extension first ("test.tsx" before "tsx").
local test = { glyph = "󰙨", hl = "MiniIconsYellow" }
local story = { glyph = "󰗚", hl = "MiniIconsPurple" }
local story_doc = { glyph = "", hl = "MiniIconsPurple" }

local extension = { mdx = story_doc }
for _, ext in ipairs({ "ts", "tsx", "js", "jsx" }) do
  extension["test." .. ext] = test
  extension["spec." .. ext] = test
  extension["stories." .. ext] = story
end

return {
  "nvim-mini/mini.icons",
  opts = { extension = extension },
}

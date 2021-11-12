-- quarto-post.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.13'

-- required modules
text = require 'text'

-- global state
postState = {}

-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
  dofile(path .. script)
end
import("bootstrap.lua")
import("latexdiv.lua")
import("foldcode.lua")
import("book-cleanup.lua")
import("ipynb.lua")
import("ojs.lua")
import("reveal.lua")
import("../common/params.lua")
import("../common/table.lua")
import("../common/pandoc.lua")
import("../common/figures.lua")
import("../common/meta.lua")
import("../common/debug.lua")
import("../common/json.lua")
-- [/import]

initParams()

return {
  bookCleanup(),
  combineFilters({
    latexDiv(),
    foldCode(),
    bootstrap(),
    ipynb(),
    reveal()
  }),
  ojs()
}




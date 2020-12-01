-- crossref.lua
-- Copyright (C) 2020 by RStudio, PBC

-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*/)")
  dofile(path .. script)
end
import("global.lua")
import("index.lua")
import("sections.lua")
import("figures.lua")
import("tables.lua")
import("equations.lua")
import("listings.lua")
import("theorems.lua")
import("refs.lua")
import("meta.lua")
import("format.lua")
import("options.lua")
import("../common/pandoc.lua")
import("../common/table.lua")
import("../common/debug.lua")
-- [/import]

-- required modules
text = require 'text'

-- chain of filters
return {
  initOptions(),
  subfigures(),
  combineFilters({
    sections(),
    figures(),
    tables(),
    equations(),
    listings(),
    theorems()
  }),
  resolveRefs(),
  metaInject(),
}


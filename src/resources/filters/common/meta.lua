-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- constants
kHeaderIncludes = "header-includes"
kIncludeBefore = "include-before"
kIncludeAfter = "include-after"

function ensureIncludes(meta, includes)
  if not meta[includes] then
    meta[includes] = pandoc.MetaList({})
  elseif meta[includes].t == "MetaInlines" or 
         meta[includes].t == "MetaBlocks" then
    meta[includes] = pandoc.MetaList({meta[includes]})
  end
end

-- add a header include as a raw block
function addInclude(meta, format, includes, include)
  if isHtmlOutput() then
    blockFormat = "html"
  else
    blockFormat = format
  end  
  meta[includes]:insert(pandoc.MetaBlocks(pandoc.RawBlock(blockFormat, include)))
end

-- conditionally include a package
function usePackage(pkg)
  return "\\@ifpackageloaded{" .. pkg .. "}{}{\\usepackage{" .. pkg .. "}}"
end

function usePackageWithOption(pkg, option)
  return "\\@ifpackageloaded{" .. pkg .. "}{}{\\usepackage[" .. option .. "]{" .. pkg .. "}}"
end

function metaInjectLatex(meta, func)
  if isLatexOutput() then
    function inject(tex)
      addInclude(meta, "tex", kHeaderIncludes, tex)
    end
    inject("\\makeatletter")
    func(inject)
    inject("\\makeatother")
  end
end

function metaInjectLatexBefore(meta, func)
  metaInjectRawLatex(meta, kIncludeBefore, func)
end

function metaInjectLatexAfter(meta, func)
  metaInjectRawLatex(meta, kIncludeAfter, func)
end

function metaInjectRawLatex(meta, include, func)
  if isLatexOutput() then
    function inject(tex)
      addInclude(meta, "tex", include, tex)
    end
    func(inject)
  end
end


function metaInjectHtml(meta, func)
  if isHtmlOutput() then
    function inject(html)
      addInclude(meta, "html", kHeaderIncludes, html)
    end
    func(inject)
  end
end

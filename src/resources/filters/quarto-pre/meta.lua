-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function quartoPreMetaInject()
  return {
    Meta = function(meta)

      -- injection awesomebox for captions, if needed
      if preState.hasCallouts and isLatexOutput() then
        metaInjectLatex(meta, function(inject)
          inject(
            usePackageWithOption("tcolorbox", "many")
          )
          inject(
            usePackage("fontawesome5")
          )
          inject(
            "\\definecolor{quarto-callout-color}{HTML}{" .. kColorUnknown .. "}\n" ..
            "\\definecolor{quarto-callout-note-color}{HTML}{" .. kColorNote .. "}\n" ..
            "\\definecolor{quarto-callout-important-color}{HTML}{" .. kColorImportant .. "}\n" ..
            "\\definecolor{quarto-callout-warning-color}{HTML}{" .. kColorWarning .."}\n" ..
            "\\definecolor{quarto-callout-tip-color}{HTML}{" .. kColorTip .."}\n" ..
            "\\definecolor{quarto-callout-caution-color}{HTML}{" .. kColorCaution .. "}\n"
          )
        end)
      end

      metaInjectLatex(meta, function(inject)
        if preState.usingTikz then
          inject(usePackage("tikz"))
        end
      end)
      return meta
    end
  }
end


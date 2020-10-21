/*
* format.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/
import {
  kFigDpi,
  kFigFormat,
  kFigHeight,
  kFigWidth,
  kKeepTex,
  kKeepYaml,
  kMdExtensions,
  kOutputExt,
  kShowCode,
  kShowError,
  kShowWarning,
} from "../config/constants.ts";

// pandoc output format
export interface Format {
  [kFigWidth]?: number;
  [kFigHeight]?: number;
  [kFigFormat]?: "png" | "pdf";
  [kFigDpi]?: number;
  [kShowCode]?: boolean;
  [kShowWarning]?: boolean;
  [kShowError]?: boolean;
  [kKeepTex]?: boolean;
  [kKeepYaml]?: boolean;
  [kKeepTex]?: boolean;
  [kOutputExt]?: string;

  // pandoc
  pandoc?: FormatPandoc;

  // per-format pandoc metadata (also allowed at root)
  [key: string]: unknown;
}

export interface FormatPandoc {
  from?: string;
  to?: string;
  [kMdExtensions]?: string;
  [key: string]: unknown;
}

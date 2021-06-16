/*
* platform.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export function isMingw() {
  return isWindows() && !!Deno.env.get("MSYSTEM");
}

export function isWindows() {
  return Deno.build.os === "windows";
}

export function isRStudio() {
  return !!Deno.env.get("RSTUDIO_VERSION");
}

export function isInteractiveTerminal() {
  return Deno.isatty(Deno.stderr.rid);
}

export function isInteractiveSession() {
  return isRStudio() || isInteractiveTerminal();
}

export function isGithubAction() {
  return Deno.env.get("GITHUB_ACTIONS") === "true";
}

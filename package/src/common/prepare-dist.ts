/*
* prepare-dist.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join } from "path/mod.ts";
import { copySync, ensureDirSync } from "fs/mod.ts";

import { Configuration } from "../common/config.ts";
import { buildFilter } from "./package-filters.ts";
import { bundle } from "../util/deno.ts";
import { info } from "log/mod.ts";

export async function prepareDist(
  config: Configuration,
) {
  // Move the supporting files into place
  info("\nMoving supporting files");
  supportingFiles(config);
  info("");

  // Create the deno bundle
  const input = join(config.directoryInfo.src, "quarto.ts");
  const output = join(config.directoryInfo.bin, "quarto.js");
  info("\nCreating Deno Bundle");
  info(output);
  await bundle(
    input,
    output,
    config,
  );
  info("");

  // Inline the LUA Filters and move them into place
  info("\nCreating Inlined LUA Filters");
  inlineFilters(config);
  info("");

  // Write a version file to share
  info(`Writing version: ${config.version}`);
  Deno.writeTextFileSync(
    join(config.directoryInfo.share, "version"),
    config.version,
  );
  info("");
}

function supportingFiles(config: Configuration) {
  // Move information and share resources into place
  const filesToCopy = [
    {
      from: join(config.directoryInfo.root, "COPYING.md"),
      to: join(config.directoryInfo.dist, "COPYING.md"),
    },
    {
      from: join(config.directoryInfo.root, "COPYRIGHT"),
      to: join(config.directoryInfo.dist, "COPYRIGHT"),
    },
    {
      from: join(config.directoryInfo.src, "resources"),
      to: config.directoryInfo.share,
    },
  ];

  // Gather supporting files
  filesToCopy.forEach((fileToCopy) => {
    const dir = dirname(fileToCopy.to);
    info(`Ensuring dir ${dir} exists`);
    ensureDirSync(dir);

    info(`Copying ${fileToCopy.from} to ${fileToCopy.to}`);
    copySync(fileToCopy.from, fileToCopy.to, { overwrite: true });
  });

  // Cleanup the filters directory, which contains filter source that will be
  // compiled later
  const pathsToClean = [
    join(config.directoryInfo.share, "filters"),
  ];
  pathsToClean.forEach((path) => Deno.removeSync(path, { recursive: true }));
}

interface Filter {
  // The name of the filter (the LUA file and perhaps the directory)
  name: string;

  // An optional name of the directory, if it is not the name of the LUA filter
  dir?: string;
}

function inlineFilters(config: Configuration) {
  info("Building inlined filters");
  const outDir = join(config.directoryInfo.share, "filters");
  const filtersToInline: Filter[] = [
    { name: "init" },
    { name: "quarto-pre" },
    { name: "crossref" },
    { name: "layout" },
    { name: "quarto-post" },
    { name: "pagebreak", dir: "rmarkdown" },
  ];

  filtersToInline.forEach((filter) => {
    info(filter);
    buildFilter(
      join(
        config.directoryInfo.src,
        "resources",
        "filters",
        filter.dir || filter.name,
        `${filter.name}.lua`,
      ),
      join(outDir, filter.dir || filter.name, `${filter.name}.lua`),
    );
  });
}

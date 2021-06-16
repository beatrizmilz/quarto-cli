/*
* jupyter.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { extname, join } from "path/mod.ts";

import { existsSync } from "fs/mod.ts";

import { readYamlFromMarkdown } from "../../core/yaml.ts";
import { isInteractiveSession, isWindows } from "../../core/platform.ts";
import { partitionMarkdown } from "../../core/pandoc/pandoc-partition.ts";

import { dirAndStem, removeIfExists } from "../../core/path.ts";
import { runningInCI } from "../../core/ci-info.ts";

import { Metadata } from "../../config/metadata.ts";

import {
  DependenciesOptions,
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngine,
  ExecutionTarget,
  kQmdExtensions,
  PandocIncludes,
  PostProcessOptions,
} from "../engine.ts";
import {
  isJupyterNotebook,
  jupyterAssets,
  jupyterFromFile,
  jupyterToMarkdown,
  kJupyterNotebookExtensions,
  quartoMdToJupyter,
} from "../../core/jupyter/jupyter.ts";
import {
  kExecuteDaemon,
  kExecuteEnabled,
  kFigDpi,
  kFigFormat,
  kIncludeAfterBody,
  kIncludeInHeader,
  kKeepHidden,
  kKeepIpynb,
  kPreferHtml,
} from "../../config/constants.ts";
import {
  Format,
  isHtmlCompatible,
  isHtmlOutput,
  isLatexOutput,
  isMarkdownOutput,
} from "../../config/format.ts";
import { restorePreservedHtml } from "../../core/jupyter/preserve.ts";

import {
  executeKernelKeepalive,
  executeKernelOneshot,
} from "./jupyter-kernel.ts";
import {
  includesForJupyterWidgetDependencies,
  JupyterWidgetDependencies,
} from "../../core/jupyter/widgets.ts";

const kJupyterEngine = "jupyter";

export const jupyterEngine: ExecutionEngine = {
  name: kJupyterEngine,

  defaultExt: ".qmd",

  defaultYaml: (kernel?: string) => [
    `jupyter: ${kernel || "python3"}`,
  ],

  validExtensions: () => kJupyterNotebookExtensions.concat(kQmdExtensions),

  claimsExtension: (ext: string) => {
    return kJupyterNotebookExtensions.includes(ext.toLowerCase());
  },

  claimsLanguage: (_language: string) => {
    return false;
  },

  target: async (
    file: string,
  ): Promise<ExecutionTarget | undefined> => {
    // if this is a text markdown file then create a notebook for use as the execution target
    if (isQmdFile(file)) {
      // write a transient notebook
      const [fileDir, fileStem] = dirAndStem(file);
      const notebook = join(fileDir, fileStem + ".ipynb");
      const target = {
        source: file,
        input: notebook,
        data: { transient: true },
      };
      await createNotebookforTarget(target);
      return target;
    } else if (isJupyterNotebook(file)) {
      return {
        source: file,
        input: file,
        data: { transient: false },
      };
    } else {
      return undefined;
    }
  },

  metadata: async (file: string): Promise<Metadata> => {
    // read metadata
    if (isJupyterNotebook(file)) {
      return readYamlFromMarkdown(await markdownFromNotebook(file));
    } else {
      return readYamlFromMarkdown(Deno.readTextFileSync(file));
    }
  },

  partitionedMarkdown: async (file: string) => {
    if (isJupyterNotebook(file)) {
      return partitionMarkdown(await markdownFromNotebook(file));
    } else {
      return partitionMarkdown(Deno.readTextFileSync(file));
    }
  },

  execute: async (options: ExecuteOptions): Promise<ExecuteResult> => {
    // create the target input if we need to (could have been removed
    // by the cleanup step of another render in this invocation)
    if (isQmdFile(options.target.source) && !existsSync(options.target.input)) {
      await createNotebookforTarget(options.target);
    }

    // determine execution behavior
    const execute = options.format.execute[kExecuteEnabled] !== false;
    if (execute) {
      // jupyter back end requires full path to input (to ensure that
      // keepalive kernels are never re-used across multiple inputs
      // that happen to share a hash)
      const execOptions = {
        ...options,
        target: {
          ...options.target,
          input: Deno.realPathSync(options.target.input),
        },
      };

      // use daemon by default if we are in an interactive session (terminal
      // or rstudio) on posix and not running in a CI system. note that
      // execlude windows b/c in some configurations the process won't have
      // permission to create and bind to a tcp/ip port. we could overcome
      // this by using named pipes (no deno support for this yet though)
      let executeDaemon = options.format.execute[kExecuteDaemon];
      if (executeDaemon === null || executeDaemon === undefined) {
        executeDaemon = isInteractiveSession() &&
          !isWindows() && !runningInCI();
      }
      if (executeDaemon === false || executeDaemon === 0) {
        await executeKernelOneshot(execOptions);
      } else {
        await executeKernelKeepalive(execOptions);
      }
    }

    // convert to markdown and write to target
    const nb = jupyterFromFile(options.target.input);
    const assets = jupyterAssets(
      options.target.input,
      options.format.pandoc.to,
    );
    // NOTE: for perforance reasons the 'nb' is mutated in place
    // by jupyterToMarkdown (we don't want to make a copy of a
    // potentially very large notebook) so should not be relied
    // on subseuqent to this call
    const result = jupyterToMarkdown(
      nb,
      {
        language: nb.metadata.kernelspec.language,
        assets,
        execute: options.format.execute,
        keepHidden: options.format.render[kKeepHidden],
        toHtml: isHtmlCompatible(options.format),
        toLatex: isLatexOutput(options.format.pandoc),
        toMarkdown: isMarkdownOutput(options.format.pandoc),
        figFormat: options.format.execute[kFigFormat],
        figDpi: options.format.execute[kFigDpi],
      },
    );

    // return dependencies as either includes or raw dependencies
    let includes: PandocIncludes | undefined;
    let engineDependencies: Array<unknown> | undefined;
    if (options.dependencies) {
      includes = executeResultIncludes(result.dependencies);
    } else {
      engineDependencies = executeResultEngineDependencies(result.dependencies);
    }

    // if it's a transient notebook then remove it
    // (unless keep-ipynb was specified)
    cleanupNotebook(options.target, options.format);

    // return results
    return {
      markdown: result.markdown,
      supporting: [join(assets.base_dir, assets.supporting_dir)],
      filters: [],
      includes,
      engineDependencies,
      preserve: result.htmlPreserve,
      postProcess: result.htmlPreserve &&
        (Object.keys(result.htmlPreserve).length > 0),
    };
  },

  executeTargetSkipped: cleanupNotebook,

  dependencies: (options: DependenciesOptions) => {
    const includes: PandocIncludes = {};
    if (options.dependencies) {
      const includeFiles = includesForJupyterWidgetDependencies(
        options.dependencies as JupyterWidgetDependencies[],
      );
      if (includeFiles.inHeader) {
        includes[kIncludeInHeader] = [includeFiles.inHeader];
      }
      if (includeFiles.afterBody) {
        includes[kIncludeAfterBody] = [includeFiles.afterBody];
      }
    }
    return Promise.resolve({
      includes,
    });
  },

  postprocess: (options: PostProcessOptions) => {
    // read the output file
    let output = Deno.readTextFileSync(options.output);

    // substitute
    output = restorePreservedHtml(
      output,
      options.preserve,
    );

    // re-write the output
    Deno.writeTextFileSync(options.output, output);

    return Promise.resolve();
  },

  canFreeze: true,

  keepFiles: (input: string) => {
    if (!isJupyterNotebook(input) && !input.endsWith(`.${kJupyterEngine}.md`)) {
      const [fileDir, fileStem] = dirAndStem(input);
      return [join(fileDir, fileStem + ".ipynb")];
    }
  },
};

function isQmdFile(file: string) {
  const ext = extname(file);
  return kQmdExtensions.includes(ext);
}

async function createNotebookforTarget(target: ExecutionTarget) {
  const nb = await quartoMdToJupyter(target.source, true);
  Deno.writeTextFileSync(target.input, JSON.stringify(nb, null, 2));
}

function cleanupNotebook(target: ExecutionTarget, format: Format) {
  // remove transient notebook if appropriate
  const data = target.data as JupyterTargetData;
  if (data.transient) {
    if (!format.execute[kKeepIpynb]) {
      removeIfExists(target.input);
    }
  }
}

interface JupyterTargetData {
  transient: boolean;
}

function executeResultIncludes(
  widgetDependencies?: JupyterWidgetDependencies,
): PandocIncludes | undefined {
  if (widgetDependencies) {
    const includes: PandocIncludes = {};
    const includeFiles = includesForJupyterWidgetDependencies(
      [widgetDependencies],
    );
    if (includeFiles.inHeader) {
      includes[kIncludeInHeader] = [includeFiles.inHeader];
    }
    if (includeFiles.afterBody) {
      includes[kIncludeAfterBody] = [includeFiles.afterBody];
    }
    return includes;
  } else {
    return undefined;
  }
}

function executeResultEngineDependencies(
  widgetDependencies?: JupyterWidgetDependencies,
): Array<unknown> | undefined {
  if (widgetDependencies) {
    return [widgetDependencies];
  } else {
    return undefined;
  }
}

async function markdownFromNotebook(file: string) {
  const decoder = new TextDecoder("utf-8");
  const nbContents = await Deno.readFile(file);
  const nb = JSON.parse(decoder.decode(nbContents));
  const cells = nb.cells as Array<{ cell_type: string; source: string[] }>;
  const markdown = cells.reduce((md, cell) => {
    if (["markdown", "raw"].includes(cell.cell_type)) {
      return md + "\n" + cell.source.join("");
    } else {
      return md;
    }
  }, "");
  return markdown;
}

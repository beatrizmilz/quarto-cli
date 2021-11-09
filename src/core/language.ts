/*
* language.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync, expandGlobSync } from "fs/mod.ts";
import { extname, join } from "path/mod.ts";

import {
  kLanguageDefaults,
  kLanguageDefaultsKeys,
} from "../config/constants.ts";
import { FormatLanguage, Metadata } from "../config/types.ts";
import { dirAndStem } from "./path.ts";
import { resourcePath } from "./resources.ts";
import { readYaml } from "./yaml.ts";
import { mergeConfigs } from "./config.ts";

export function readLanguageTranslations(
  translationFile: string,
  lang?: string,
): { language: FormatLanguage; files: string[] } {
  // read and parse yaml if it exists (track files read)
  const files: string[] = [];
  const maybeReadYaml = (file: string) => {
    if (existsSync(file)) {
      files.push(Deno.realPathSync(file));
      return readYaml(file) as FormatLanguage;
    } else {
      return {} as FormatLanguage;
    }
  };

  // read the original file
  const language = maybeReadYaml(translationFile);

  // determine additional variations to read
  const ext = extname(translationFile);
  const [dir, stem] = dirAndStem(translationFile);
  const variations: string[] = [];
  if (lang) {
    // enumerate variations dictated by this lang
    const subtags = lang.split("-");
    for (let i = 0; i < subtags.length; i++) {
      variations.push(subtags.slice(0, i + 1).join("-"));
    }
  } else {
    // enumerate all variations
    const glob = stem + "-*" + ext;
    const variationRe = new RegExp(
      "^" + stem + "-(.*?)" + ext,
    );
    for (
      const entry of expandGlobSync(glob, {
        root: dir,
        includeDirs: false,
        caseInsensitive: true,
      })
    ) {
      const match = entry.name.match(variationRe);
      if (match) {
        variations.push(match[1]);
      }
    }
  }

  // read the variations
  for (const variation of variations) {
    const translations = maybeReadYaml(
      join(dir, stem + "-" + variation + ext),
    );
    Object.keys(translations).forEach((key) => {
      // top level entries use the variation key
      if (kLanguageDefaultsKeys.includes(key)) {
        language[variation] = language[variation] || {};
        (language[variation] as FormatLanguage)[key] = translations[key];
        // objects use variation key + subkey
      } else if (typeof translations[key] === "object") {
        const targetKey = variation + "-" + key;
        language[targetKey] = language[targetKey] || {};
        language[targetKey] = {
          ...language[targetKey] as Record<string, unknown>,
          ...translations[key] as Record<string, unknown>,
        };
      }
    });
  }

  return { language, files };
}

export function readDefaultLanguageTranslations(lang: string) {
  return readLanguageTranslations(
    resourcePath(join("language", "_language.yml")),
    lang,
  );
}

export function resolveLanguageMetadata(metadata: Metadata, dir: string) {
  if (typeof (metadata[kLanguageDefaults]) === "string") {
    const translationsFile = join(dir, metadata[kLanguageDefaults] as string);
    if (!existsSync(translationsFile)) {
      throw new Error(
        "Specified 'language' file does not exist: " + translationsFile,
      );
    }
    const translations = readLanguageTranslations(translationsFile);
    metadata[kLanguageDefaults] = translations.language;
    return translations.files;
  } else if (typeof (metadata[kLanguageDefaults]) !== "object") {
    metadata[kLanguageDefaults] = {};
    return [];
  } else {
    return [];
  }
}

export function translationsForLang(language: FormatLanguage, lang: string) {
  // start with the defaults
  let translations = {} as FormatLanguage;
  Object.keys(language).forEach((key) => {
    if (kLanguageDefaultsKeys.includes(key)) {
      translations[key] = language[key];
    }
  });

  // merge any variations (starting with most general)
  const subtags = lang.split("-");
  for (let i = 0; i < subtags.length; i++) {
    const variation = subtags.slice(0, i + 1).join("-");
    if (typeof (language[variation]) === "object") {
      translations = mergeConfigs(
        translations,
        language[variation],
      );
    }
  }

  return translations;
}

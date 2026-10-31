// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
const UNSUPPORTED_PATTERNS = [
  /(^|\s)[&*][A-Za-z0-9_-]+/,
  /(^|\s)!{1,2}[A-Za-z0-9_-]+/,
  /^\s*<<\s*:/,
  /(^|\s)[|>]\s*(?:#.*)?$/,
];

function stripComment(line) {
  let quote = null;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && quote === '"') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "#" && (index === 0 || /\s/.test(line[index - 1]))) {
      return line.slice(0, index).trimEnd();
    }
  }
  return line.trimEnd();
}

function splitKeyValue(content, lineNumber) {
  let quote = null;
  let escaped = false;
  let squareDepth = 0;
  let curlyDepth = 0;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && quote === '"') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "[") squareDepth += 1;
    if (character === "]") squareDepth -= 1;
    if (character === "{") curlyDepth += 1;
    if (character === "}") curlyDepth -= 1;
    if (character === ":" && squareDepth === 0 && curlyDepth === 0) {
      const key = content.slice(0, index).trim();
      const value = content.slice(index + 1).trim();
      if (!key) throw new Error(`YAML line ${lineNumber}: mapping key is empty.`);
      return [parseKey(key, lineNumber), value];
    }
  }
  throw new Error(`YAML line ${lineNumber}: expected a mapping entry with ':'.`);
}

function parseKey(raw, lineNumber) {
  const key = parseScalar(raw, lineNumber);
  if (typeof key !== "string" || !key.trim()) {
    throw new Error(`YAML line ${lineNumber}: mapping keys must be non-empty strings.`);
  }
  return key;
}

function parseQuoted(raw, lineNumber) {
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`YAML line ${lineNumber}: invalid double-quoted string (${error.message}).`);
    }
  }
  if (!raw.endsWith("'")) {
    throw new Error(`YAML line ${lineNumber}: unterminated single-quoted string.`);
  }
  return raw.slice(1, -1).replaceAll("''", "'");
}

function normalizeInlineYamlToJson(raw) {
  return raw
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_.-]*)(\s*:)/g, '$1"$2"$3')
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, value) => JSON.stringify(value));
}

function parseScalar(raw, lineNumber) {
  const value = raw.trim();
  if (!value) return undefined;
  if (value.startsWith('"') || value.startsWith("'")) return parseQuoted(value, lineNumber);
  if (value === "null" || value === "Null" || value === "NULL" || value === "~") return null;
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  if (/^[-+]?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value)) return Number(value);
  if (value.startsWith("[") || value.startsWith("{")) {
    try {
      return JSON.parse(normalizeInlineYamlToJson(value));
    } catch (error) {
      throw new Error(`YAML line ${lineNumber}: invalid inline collection (${error.message}).`);
    }
  }
  return value;
}

function preprocess(text) {
  const lines = [];
  const normalized = text.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n").replaceAll("\r", "\n");

  for (const [zeroIndex, originalLine] of normalized.split("\n").entries()) {
    const lineNumber = zeroIndex + 1;
    if (originalLine.includes("\t")) {
      throw new Error(`YAML line ${lineNumber}: tabs are not allowed for indentation.`);
    }
    const withoutComment = stripComment(originalLine);
    if (!withoutComment.trim()) continue;
    for (const pattern of UNSUPPORTED_PATTERNS) {
      if (pattern.test(withoutComment)) {
        throw new Error(`YAML line ${lineNumber}: anchors, aliases, tags, merge keys, and block scalars are not supported.`);
      }
    }
    const indent = withoutComment.match(/^ */u)?.[0].length ?? 0;
    if (indent % 2 !== 0) {
      throw new Error(`YAML line ${lineNumber}: indentation must use multiples of two spaces.`);
    }
    lines.push({
      indent,
      content: withoutComment.slice(indent),
      lineNumber,
    });
  }
  return lines;
}

function parseBlock(lines, startIndex, indent) {
  if (startIndex >= lines.length) return { value: {}, nextIndex: startIndex };
  const first = lines[startIndex];
  const isSequence = first.content === "-" || first.content.startsWith("- ");
  const container = isSequence ? [] : {};
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    if (line.indent < indent) break;
    if (line.indent > indent) {
      throw new Error(`YAML line ${line.lineNumber}: unexpected indentation.`);
    }

    const lineIsSequence = line.content === "-" || line.content.startsWith("- ");
    if (lineIsSequence !== isSequence) {
      throw new Error(`YAML line ${line.lineNumber}: cannot mix sequence and mapping entries at the same indentation.`);
    }

    if (isSequence) {
      const itemContent = line.content.slice(1).trim();
      if (!itemContent) {
        const next = lines[index + 1];
        if (!next || next.indent <= indent) {
          container.push(null);
          index += 1;
          continue;
        }
        const parsed = parseBlock(lines, index + 1, next.indent);
        container.push(parsed.value);
        index = parsed.nextIndex;
        continue;
      }

      const looksLikeMapping = (() => {
        try {
          splitKeyValue(itemContent, line.lineNumber);
          return true;
        } catch {
          return false;
        }
      })();

      if (!looksLikeMapping) {
        container.push(parseScalar(itemContent, line.lineNumber));
        index += 1;
        continue;
      }

      const [key, rawValue] = splitKeyValue(itemContent, line.lineNumber);
      const item = {};
      if (rawValue) {
        item[key] = parseScalar(rawValue, line.lineNumber);
        index += 1;
      } else {
        const next = lines[index + 1];
        if (next && next.indent > indent) {
          const parsed = parseBlock(lines, index + 1, next.indent);
          item[key] = parsed.value;
          index = parsed.nextIndex;
        } else {
          item[key] = {};
          index += 1;
        }
      }

      while (index < lines.length && lines[index].indent > indent) {
        const childIndent = lines[index].indent;
        if (childIndent !== indent + 2) {
          throw new Error(`YAML line ${lines[index].lineNumber}: sequence mapping entries must be indented by two spaces.`);
        }
        const [childKey, childRawValue] = splitKeyValue(lines[index].content, lines[index].lineNumber);
        if (Object.hasOwn(item, childKey)) {
          throw new Error(`YAML line ${lines[index].lineNumber}: duplicate key '${childKey}'.`);
        }
        if (childRawValue) {
          item[childKey] = parseScalar(childRawValue, lines[index].lineNumber);
          index += 1;
        } else {
          const nested = lines[index + 1];
          if (nested && nested.indent > childIndent) {
            const parsed = parseBlock(lines, index + 1, nested.indent);
            item[childKey] = parsed.value;
            index = parsed.nextIndex;
          } else {
            item[childKey] = {};
            index += 1;
          }
        }
      }
      container.push(item);
      continue;
    }

    const [key, rawValue] = splitKeyValue(line.content, line.lineNumber);
    if (Object.hasOwn(container, key)) {
      throw new Error(`YAML line ${line.lineNumber}: duplicate key '${key}'.`);
    }
    if (rawValue) {
      container[key] = parseScalar(rawValue, line.lineNumber);
      index += 1;
      continue;
    }

    const next = lines[index + 1];
    if (!next || next.indent <= indent) {
      container[key] = {};
      index += 1;
      continue;
    }
    const parsed = parseBlock(lines, index + 1, next.indent);
    container[key] = parsed.value;
    index = parsed.nextIndex;
  }

  return { value: container, nextIndex: index };
}

export function parseYaml(text) {
  const lines = preprocess(text);
  if (lines.length === 0) return {};
  if (lines[0].indent !== 0) {
    throw new Error(`YAML line ${lines[0].lineNumber}: the document must start at indentation level zero.`);
  }
  const parsed = parseBlock(lines, 0, 0);
  if (parsed.nextIndex !== lines.length) {
    throw new Error(`YAML line ${lines[parsed.nextIndex]?.lineNumber ?? "?"}: could not parse complete document.`);
  }
  return parsed.value;
}

function quoteYamlString(value) {
  if (/^[A-Za-z0-9_./-]+$/.test(value) && !/^(true|false|null|~)$/i.test(value)) return value;
  return JSON.stringify(value);
}

function serializeScalar(value) {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return quoteYamlString(String(value));
}

export function stringifyYaml(value, indent = 0) {
  const prefix = " ".repeat(indent);
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          const serialized = stringifyYaml(item, indent + 2);
          const [first, ...rest] = serialized.split("\n");
          return `${prefix}- ${first.trimStart()}${rest.length ? `\n${rest.join("\n")}` : ""}`;
        }
        return `${prefix}- ${serializeScalar(item)}`;
      })
      .join("\n");
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, child]) => {
        const renderedKey = quoteYamlString(key);
        if (child && typeof child === "object") {
          return `${prefix}${renderedKey}:\n${stringifyYaml(child, indent + 2)}`;
        }
        return `${prefix}${renderedKey}: ${serializeScalar(child)}`;
      })
      .join("\n");
  }

  return `${prefix}${serializeScalar(value)}`;
}

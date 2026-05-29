import type { Blockquote, Content, Paragraph, Root, RootContent, Text } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import {
  defaultAliases,
  defaultTitles,
  type NoteData,
  type NoteSource,
  type NoteType,
  type RemarkNotesOptions,
} from "./types.js";

export type {
  NoteData,
  NoteSource,
  NoteType,
  RemarkNotesOptions,
} from "./types.js";

type NormalizedOptions = {
  validate: boolean;
  aliases: Record<string, NoteType>;
  titles: Record<NoteType, string>;
};

type DirectiveNode = {
  type?: string;
  data?: unknown;
  name?: string;
  label?: string;
  attributes?: Record<string, unknown>;
  children?: Content[];
};

const githubAlertPattern = /^\s*\[!([A-Za-z]+)\][ \t]*(?:\r?\n)?/;
const qiitaInlinePattern = /^:::note(?:\s+([A-Za-z]+))?[ \t]*\r?\n([\s\S]*?)\r?\n:::[ \t]*$/;
const qiitaStartPattern = /^:::note(?:\s+([A-Za-z]+))?[ \t]*$/;
const qiitaEndPattern = /^:::[ \t]*$/;

function message(file: VFile, reason: string, node: unknown, fatal = true): void {
  const vfileMessage = file.message(reason);
  vfileMessage.fatal = fatal;
  vfileMessage.source = "remark-notes";
  vfileMessage.ruleId = "notes";
}

function normalizeType(value: string | undefined, options: NormalizedOptions): NoteType | undefined {
  if (!value) {
    return undefined;
  }

  return options.aliases[value.trim().toLowerCase()];
}

function noteData(type: NoteType, source: NoteSource, options: NormalizedOptions): NoteData {
  return {
    type,
    title: options.titles[type],
    source,
  };
}

function titleParagraph(data: NoteData): Paragraph {
  return {
    type: "paragraph",
    data: {
      hName: "p",
      hProperties: {
        className: ["remark-note-title"],
      },
    },
    children: [{ type: "text", value: data.title }],
  };
}

function attachNote(node: { data?: unknown }, data: NoteData): void {
  const existing = typeof node.data === "object" && node.data !== null
    ? node.data as Record<string, unknown>
    : {};
  const currentNote = typeof existing.note === "object" && existing.note !== null
    ? existing.note as Record<string, unknown>
    : {};

  node.data = {
    ...existing,
    hName: "div",
    hProperties: {
      className: ["remark-note", `remark-note-${data.type}`],
      dataNoteType: data.type,
      dataNoteSource: data.source,
    },
    note: {
      ...currentNote,
      ...data,
    },
  };
}

function firstText(paragraph: Paragraph): Text | undefined {
  const child = paragraph.children[0];
  return child?.type === "text" ? child : undefined;
}

function paragraphText(node: RootContent): string | undefined {
  if (node.type !== "paragraph" || node.children.length !== 1) {
    return undefined;
  }

  const child = node.children[0];
  return child.type === "text" ? child.value : undefined;
}

function paragraph(value: string): Paragraph {
  return {
    type: "paragraph",
    children: [{ type: "text", value }],
  };
}

function noteContainer(data: NoteData, children: RootContent[]): Blockquote {
  const node: Blockquote = {
    type: "blockquote",
    children: [titleParagraph(data), ...(children as Blockquote["children"])],
  };
  attachNote(node, data);
  return node;
}

function normalizeGithubAlert(node: Blockquote, file: VFile, options: NormalizedOptions): boolean {
  const first = node.children[0];
  if (first?.type !== "paragraph") {
    return false;
  }

  const text = firstText(first);
  if (!text) {
    return false;
  }

  const match = text.value.match(githubAlertPattern);
  if (!match) {
    return false;
  }

  const type = normalizeType(match[1], options);
  if (!type) {
    if (options.validate) {
      message(file, `Unknown GitHub alert type "${match[1]}"`, node);
    }
    return false;
  }

  const data = noteData(type, "github-alert", options);
  text.value = text.value.slice(match[0].length);
  if (text.value.length === 0) {
    first.children.shift();
  }
  if (first.children.length === 0) {
    node.children.shift();
  }

  attachNote(node, data);
  node.children.unshift(titleParagraph(data));
  return true;
}

function normalizeDirective(node: DirectiveNode, file: VFile, options: NormalizedOptions): boolean {
  if (node.type !== "containerDirective" || node.name !== "note") {
    return false;
  }

  const rawType = typeof node.label === "string" && node.label.length > 0
    ? node.label
    : typeof node.attributes?.type === "string"
      ? node.attributes.type
      : "note";
  const type = normalizeType(rawType, options);
  if (!type) {
    if (options.validate) {
      message(file, `Unknown Qiita note type "${rawType}"`, node);
    }
    return false;
  }

  const data = noteData(type, "qiita-note", options);
  attachNote(node, data);
  node.children?.unshift(titleParagraph(data));
  return true;
}

function normalizeQiitaNote(
  rawType: string | undefined,
  children: RootContent[],
  file: VFile,
  node: unknown,
  options: NormalizedOptions,
): Blockquote | undefined {
  const type = normalizeType(rawType ?? "note", options);
  if (!type) {
    if (options.validate) {
      message(file, `Unknown Qiita note type "${rawType}"`, node);
    }
    return undefined;
  }

  return noteContainer(noteData(type, "qiita-note", options), children);
}

function normalizeQiitaPseudoNotes(tree: Root, file: VFile, options: NormalizedOptions): void {
  for (let index = 0; index < tree.children.length; index += 1) {
    const node = tree.children[index];
    const text = paragraphText(node);
    if (text === undefined) {
      continue;
    }

    const inlineMatch = text.match(qiitaInlinePattern);
    if (inlineMatch) {
      const content = inlineMatch[2].trim();
      const note = normalizeQiitaNote(
        inlineMatch[1],
        content.length > 0 ? [paragraph(content)] : [],
        file,
        node,
        options,
      );
      if (note) {
        tree.children.splice(index, 1, note);
      }
      continue;
    }

    const startMatch = text.match(qiitaStartPattern);
    if (!startMatch) {
      continue;
    }

    const endIndex = tree.children.findIndex((child, childIndex) => (
      childIndex > index && paragraphText(child)?.match(qiitaEndPattern)
    ));
    if (endIndex === -1) {
      if (options.validate) {
        message(file, "Missing Qiita note closing fence", node);
      }
      continue;
    }

    const note = normalizeQiitaNote(
      startMatch[1],
      tree.children.slice(index + 1, endIndex),
      file,
      node,
      options,
    );
    if (note) {
      tree.children.splice(index, endIndex - index + 1, note);
    }
  }
}

const remarkNotes: Plugin<[RemarkNotesOptions?], Root> = (options = {}) => {
  const normalized: NormalizedOptions = {
    validate: options.validate ?? true,
    aliases: {
      ...defaultAliases,
      ...options.aliases,
    },
    titles: {
      ...defaultTitles,
      ...options.titles,
    },
  };

  return (tree: Root, file: VFile) => {
    normalizeQiitaPseudoNotes(tree, file, normalized);

    visit(tree, (node: unknown) => {
      const content = node as Content;
      if (content.type === "blockquote") {
        normalizeGithubAlert(content, file, normalized);
        return;
      }

      normalizeDirective(node as DirectiveNode, file, normalized);
    });
  };
};

export default remarkNotes;

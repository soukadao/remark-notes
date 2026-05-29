import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Root } from "mdast";
import remarkDirective from "remark-directive";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { VFile } from "vfile";
import remarkNotes from "../src/index.js";

const fixtureDir = join(import.meta.dir, "fixtures");

function fixture(name: string): string {
  return readFileSync(join(fixtureDir, name), "utf8");
}

function createTree(markdown: string, options = {}) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkDirective)
    .use(remarkNotes, options);

  const file = new VFile({ value: markdown, path: "fixture.md" });
  const tree = processor.parse(file) as Root;
  const result = processor.runSync(tree, file) as Root;
  return { tree: result, file };
}

describe("remarkNotes", () => {
  test("normalizes GitHub alerts", () => {
    const { tree, file } = createTree(fixture("github-alert.md"));
    expect(file.messages).toHaveLength(0);

    const note = tree.children[0];
    expect(note?.data?.note).toEqual({
      type: "note",
      title: "Note",
      source: "github-alert",
    });
    expect(note?.data?.hProperties).toEqual({
      className: ["remark-note", "remark-note-note"],
      dataNoteType: "note",
      dataNoteSource: "github-alert",
    });
    expect(note.type).toBe("blockquote");
    expect(note.children[0]?.type).toBe("paragraph");
  });

  test("normalizes GitHub warning alerts", () => {
    const { tree, file } = createTree(fixture("github-warning-inline.md"));
    expect(file.messages).toHaveLength(0);

    const note = tree.children[0];
    expect(note?.data?.note).toEqual({
      type: "warning",
      title: "Warning",
      source: "github-alert",
    });
  });

  test("normalizes Qiita note directives", () => {
    const { tree, file } = createTree(fixture("qiita-note.md"));
    expect(file.messages).toHaveLength(0);

    const note = tree.children[0];
    expect(note?.data?.note).toEqual({
      type: "warning",
      title: "Warning",
      source: "qiita-note",
    });
    expect(note?.data?.hName).toBe("div");
  });

  test("wraps Qiita note blocks", () => {
    const { tree, file } = createTree(fixture("qiita-note-blocks.md"));
    expect(file.messages).toHaveLength(0);

    const note = tree.children[0];
    expect(tree.children).toHaveLength(1);
    expect(note?.data?.note).toEqual({
      type: "caution",
      title: "Caution",
      source: "qiita-note",
    });
    expect(note.type).toBe("blockquote");
    expect(note.children.some((child) => child.type === "list")).toBe(true);
  });

  test("reports unknown note types", () => {
    const { file } = createTree(fixture("invalid-note.md"));
    expect(file.messages.some((message) => message.fatal === true && /Unknown Qiita note type/.test(message.reason))).toBe(true);
  });

  test("supports custom aliases and titles", () => {
    const { tree, file } = createTree(fixture("invalid-note.md"), {
      aliases: { mystery: "important" },
      titles: { important: "重要" },
    });
    expect(file.messages).toHaveLength(0);
    expect(tree.children[0]?.data?.note).toEqual({
      type: "important",
      title: "重要",
      source: "qiita-note",
    });
  });

  test("suppresses validation messages when validate is false", () => {
    const { file } = createTree(fixture("invalid-note.md"), { validate: false });
    expect(file.messages).toHaveLength(0);
  });
});

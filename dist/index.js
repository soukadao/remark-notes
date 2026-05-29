import { visit } from "unist-util-visit";
import { defaultAliases, defaultTitles, } from "./types.js";
const githubAlertPattern = /^\s*\[!([A-Za-z]+)\][ \t]*(?:\r?\n)?/;
const qiitaInlinePattern = /^:::note(?:\s+([A-Za-z]+))?[ \t]*\r?\n([\s\S]*?)\r?\n:::[ \t]*$/;
const qiitaStartPattern = /^:::note(?:\s+([A-Za-z]+))?[ \t]*$/;
const qiitaEndPattern = /^:::[ \t]*$/;
function message(file, reason, node, fatal = true) {
    const vfileMessage = file.message(reason);
    vfileMessage.fatal = fatal;
    vfileMessage.source = "remark-notes";
    vfileMessage.ruleId = "notes";
}
function normalizeType(value, options) {
    if (!value) {
        return undefined;
    }
    return options.aliases[value.trim().toLowerCase()];
}
function noteData(type, source, options) {
    return {
        type,
        title: options.titles[type],
        source,
    };
}
function titleParagraph(data) {
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
function attachNote(node, data) {
    const existing = typeof node.data === "object" && node.data !== null
        ? node.data
        : {};
    const currentNote = typeof existing.note === "object" && existing.note !== null
        ? existing.note
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
function firstText(paragraph) {
    const child = paragraph.children[0];
    return child?.type === "text" ? child : undefined;
}
function paragraphText(node) {
    if (node.type !== "paragraph" || node.children.length !== 1) {
        return undefined;
    }
    const child = node.children[0];
    return child.type === "text" ? child.value : undefined;
}
function paragraph(value) {
    return {
        type: "paragraph",
        children: [{ type: "text", value }],
    };
}
function noteContainer(data, children) {
    const node = {
        type: "blockquote",
        children: [titleParagraph(data), ...children],
    };
    attachNote(node, data);
    return node;
}
function normalizeGithubAlert(node, file, options) {
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
function normalizeDirective(node, file, options) {
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
function normalizeQiitaNote(rawType, children, file, node, options) {
    const type = normalizeType(rawType ?? "note", options);
    if (!type) {
        if (options.validate) {
            message(file, `Unknown Qiita note type "${rawType}"`, node);
        }
        return undefined;
    }
    return noteContainer(noteData(type, "qiita-note", options), children);
}
function normalizeQiitaPseudoNotes(tree, file, options) {
    for (let index = 0; index < tree.children.length; index += 1) {
        const node = tree.children[index];
        const text = paragraphText(node);
        if (text === undefined) {
            continue;
        }
        const inlineMatch = text.match(qiitaInlinePattern);
        if (inlineMatch) {
            const content = inlineMatch[2].trim();
            const note = normalizeQiitaNote(inlineMatch[1], content.length > 0 ? [paragraph(content)] : [], file, node, options);
            if (note) {
                tree.children.splice(index, 1, note);
            }
            continue;
        }
        const startMatch = text.match(qiitaStartPattern);
        if (!startMatch) {
            continue;
        }
        const endIndex = tree.children.findIndex((child, childIndex) => (childIndex > index && paragraphText(child)?.match(qiitaEndPattern)));
        if (endIndex === -1) {
            if (options.validate) {
                message(file, "Missing Qiita note closing fence", node);
            }
            continue;
        }
        const note = normalizeQiitaNote(startMatch[1], tree.children.slice(index + 1, endIndex), file, node, options);
        if (note) {
            tree.children.splice(index, endIndex - index + 1, note);
        }
    }
}
const remarkNotes = (options = {}) => {
    const normalized = {
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
    return (tree, file) => {
        normalizeQiitaPseudoNotes(tree, file, normalized);
        visit(tree, (node) => {
            const content = node;
            if (content.type === "blockquote") {
                normalizeGithubAlert(content, file, normalized);
                return;
            }
            normalizeDirective(node, file, normalized);
        });
    };
};
export default remarkNotes;

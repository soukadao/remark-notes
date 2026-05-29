export type NoteType = "note" | "tip" | "important" | "warning" | "caution";

export type NoteSource = "github-alert" | "qiita-note";

export type NoteData = {
  type: NoteType;
  title: string;
  source: NoteSource;
};

export type RemarkNotesOptions = {
  validate?: boolean;
  aliases?: Record<string, NoteType>;
  titles?: Partial<Record<NoteType, string>>;
};

export const defaultTitles: Record<NoteType, string> = {
  note: "Note",
  tip: "Tip",
  important: "Important",
  warning: "Warning",
  caution: "Caution",
};

export const defaultAliases: Record<string, NoteType> = {
  note: "note",
  info: "note",
  tip: "tip",
  important: "important",
  warn: "warning",
  warning: "warning",
  alert: "caution",
  caution: "caution",
};

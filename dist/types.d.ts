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
export declare const defaultTitles: Record<NoteType, string>;
export declare const defaultAliases: Record<string, NoteType>;
//# sourceMappingURL=types.d.ts.map
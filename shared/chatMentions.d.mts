export type MentionMatcher = { pattern: RegExp | null; idsByName: Map<string,string|null> };
export function buildMentionMatcher(users: ReadonlyArray<{id:string;name:string}>): MentionMatcher;
export function chatTextParts(text: string, matcher?: MentionMatcher): Array<
  {kind:'text';text:string} | {kind:'link';text:string;href:string} | {kind:'mention';text:string;userId:string}
>;

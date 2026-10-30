export function textLinkParts(value: string): Array<{ kind: 'text'; text: string } | { kind: 'link'; text: string; href: string }>;

/**
 * Extract text sections from the active session branch.
 *
 * Pure data shaping: given the branch entries, return one `ROLE:\n<text>`
 * section per user/assistant message that has visible text. Tool-call and
 * image blocks collapse to short markers so the clipboard copy stays readable
 * without losing the fact that they happened.
 */

import type {
  SessionEntry,
  SessionMessageEntry,
} from "@earendil-works/pi-coding-agent";

/** The content payload we read off a session message. */
export type MessageContent = string | ReadonlyArray<ContentBlock>;

export type SessionBranch = ReadonlyArray<SessionEntry>;

export interface CopySection {
  readonly role: string;
  readonly text: string;
}

const IMAGE_MARKER = "[image]";
const THINKING_MARKER = "[thinking]";

interface ContentBlock {
  readonly type?: string;
  readonly text?: unknown;
}

interface MessageLike {
  readonly role: string;
  readonly content: MessageContent;
}

function textFromContent(content: MessageContent): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((block) => textFromBlock(block as ContentBlock))
    .filter(Boolean)
    .join("\n");
}

function textFromBlock(block: ContentBlock): string {
  const { type } = block;
  if (type === "text" && typeof block.text === "string") return block.text;
  if (type === "image") return IMAGE_MARKER;
  if (type === "thinking") return THINKING_MARKER;
  return "";
}

function isMessageEntry(entry: SessionEntry): entry is SessionMessageEntry {
  return entry.type === "message";
}

function messageLike(entry: SessionMessageEntry): MessageLike {
  // `AgentMessage` is a broad union whose members do not all expose `content`
  // in the published types; we read defensively here.
  return entry.message as unknown as MessageLike;
}

/**
 * Collect user and assistant messages from a branch into copy-ready sections.
 * Entries without a message, with other roles, or with no text after trimming
 * are dropped.
 */
export function collectCopySections(branch: SessionBranch): CopySection[] {
  const sections: CopySection[] = [];

  for (const entry of branch) {
    if (!isMessageEntry(entry)) continue;
    const message = messageLike(entry);
    if (message.role !== "user" && message.role !== "assistant") continue;

    const text = textFromContent(message.content).trim();
    if (!text) continue;

    sections.push({ role: message.role.toUpperCase(), text });
  }

  return sections;
}

export const SECTION_SEPARATOR = "\n\n---\n\n";

/** Join sections into a single clipboard payload. */
export function formatCopyPayload(
  sections: ReadonlyArray<CopySection>,
): string {
  return sections
    .map((section) => `${section.role}:\n${section.text}`)
    .join(SECTION_SEPARATOR);
}

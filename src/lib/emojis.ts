/**
 * 评论表情候选表。
 *
 * 刻意不做成可配置的：博客评论的表情就是"语气词"，几十个够用了，
 * 引入表情选择器依赖（emoji-mart / picker）要几十 KB，不划算。
 * 选的都是跨平台显示差别不大的常见字符，避开 ZWJ 组合（👨‍👩‍👧 这类在部分系统上会裂开）。
 */

export const EMOJI_GROUPS: { key: string; items: readonly string[] }[] = [
  {
    key: "mood",
    items: ["😀", "😄", "😊", "😍", "🤔", "😭", "😡", "😱", "😴", "🤯", "😎", "🥳", "😇", "🙃", "😋", "😜", "🤗", "😐", "😏", "🫠"],
  },
  {
    key: "gesture",
    items: ["👍", "👎", "👌", "✌️", "🤝", "🙏", "👏", "💪", "🫡", "🤌"],
  },
  {
    key: "misc",
    items: ["❤️", "💔", "✨", "🎉", "🔥", "⭐", "🌈", "💯", "🎁", "🍺", "🍚", "☕", "🐱", "🐶", "🌙", "⚡"],
  },
] as const;

/** 展平后的全部表情（用于判断是否需要插入空格分隔） */
export const ALL_EMOJIS: readonly string[] = EMOJI_GROUPS.flatMap((group) => group.items);

export function isEmoji(char: string): boolean {
  return ALL_EMOJIS.includes(char);
}

/**
 * 把表情插进指定 textarea 的光标处。
 *
 * 通过 DOM 直接改 value 并派发 `input` 事件 —— 这样受控 / 非受控的
 * textarea 都能正确同步（评论表单是非受控的，提交时读 FormData）。
 */
export function insertEmojiAtCursor(textareaId: string, emoji: string): void {
  const el = document.getElementById(textareaId);
  if (!(el instanceof HTMLTextAreaElement)) {
    return;
  }

  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const before = el.value.slice(0, start);
  const after = el.value.slice(end);

  // 表情前若紧跟一个文字，补一个空格，避免 "好的👌" 这种粘在一起
  const prefix = before && !/\s$/.test(before) ? " " : "";
  const next = `${before}${prefix}${emoji}${after}`;

  el.value = next;
  const caret = (before + prefix + emoji).length;
  el.setSelectionRange(caret, caret);
  el.focus();
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

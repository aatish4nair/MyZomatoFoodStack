// An opening bracket, then everything up to its matching close (or the end of the string if unclosed).
const BRACKETED = /\([^)]*(?:\)|$)|\[[^\]]*(?:\]|$)|\{[^}]*(?:\}|$)/g;

/**
 * Item name for display (e.g. search placeholder suggestions): removes every bracketed
 * part such as "(Half)" or "[2 Ps]" and tidies the whitespace left behind.
 * The original name is not modified and should be kept in the underlying data.
 * Returns an empty string when nothing readable is left.
 */
export function toDisplayName(itemName: string): string {
  let name = itemName;
  // Repeat so nested brackets like "Thali (Veg (Large))" are fully removed.
  for (let previous = ''; previous !== name;) {
    previous = name;
    name = name.replace(BRACKETED, ' ');
  }
  return name
    .replace(/[)\]}]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[\s,.;:\-–—]+|[\s,;:\-–—]+$/g, '')
    .trim();
}

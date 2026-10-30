export const STORY_WIDTH = 720;
export const STORY_HEIGHT = 1280;
// Leave room for the reader header and the editor toolbar.
export const STORY_TEXT_BOUNDS = { left: 32, right: 688, top: 160, bottom: 1040 };

/** One layout, in export coordinates, for both the editor and the saved image. */
export function layoutStoryText(overlay, measure) {
  const bounds = STORY_TEXT_BOUNDS;
  const maxWidth = bounds.right - bounds.left;
  const maxHeight = bounds.bottom - bounds.top;
  function wrap(size) {
    const lines = [];
    for (const paragraph of overlay.text.split('\n')) {
      let line = '';
      for (const char of Array.from(paragraph)) {
        if (line && measure(line + char, size) > maxWidth) {
          lines.push(line); line = char;
        } else line += char;
      }
      lines.push(line);
    }
    return lines;
  }
  let fontSize = overlay.size * 2;
  let lines = wrap(fontSize);
  // Very long text must fit vertically as well as horizontally.
  while (lines.length * fontSize * 1.5 > maxHeight) {
    fontSize *= .9;
    lines = wrap(fontSize);
  }
  const width = Math.min(maxWidth, Math.max(1, ...lines.map(line => measure(line, fontSize))));
  const height = lines.length * fontSize * 1.5;
  const x = Math.max(bounds.left + width / 2, Math.min(bounds.right - width / 2, overlay.x / 100 * STORY_WIDTH));
  const y = Math.max(bounds.top + height / 2, Math.min(bounds.bottom - height / 2, overlay.y / 100 * STORY_HEIGHT));
  return { lines, fontSize, width, height, x, y, lineHeight: fontSize * 1.5 };
}

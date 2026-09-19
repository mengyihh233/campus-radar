/**
 * ui/icons.js — 内联 SVG 图标集
 *
 * 刻意不使用 emoji：图形在各平台渲染不一致，且无法继承主题色。
 * 全部图标均为 24×24 线性风格，stroke 使用 currentColor，随文字颜色变化。
 */

const PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5 16.6 16.6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>',
  'map-pin': '<path d="M12 21s6.5-5.4 6.5-10a6.5 6.5 0 1 0-13 0C5.5 15.6 12 21 12 21Z"/><circle cx="12" cy="11" r="2.4"/>',
  users:
    '<path d="M16.5 20v-1.8a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.2V20"/><circle cx="9.75" cy="8" r="3.4"/><path d="M21 20v-1.8a3.6 3.6 0 0 0-2.7-3.5"/><path d="M15.3 4.4a3.6 3.6 0 0 1 0 6.9"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0"/>',
  star: '<path d="m12 3.6 2.7 5.5 6 .9-4.35 4.24 1.03 6L12 17.4l-5.38 2.83 1.03-6L3.3 10l6-.9Z"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  'chevron-right': '<path d="m9 5 7 7-7 7"/>',
  'chevron-down': '<path d="m5 9 7 7 7-7"/>',
  'chevron-left': '<path d="m15 5-7 7 7 7"/>',
  'arrow-left': '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
  alert: '<path d="M12 4.5 2.8 20h18.4Z"/><path d="M12 10v4.2"/><circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none"/>',
  'alert-circle':
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.8v5"/><circle cx="12" cy="16" r="0.9" fill="currentColor" stroke="none"/>',
  'shield-alert':
    '<path d="M12 3 4.5 6v5.4c0 4.4 3.1 8.1 7.5 9.6 4.4-1.5 7.5-5.2 7.5-9.6V6Z"/><path d="M12 8.5v4"/><circle cx="12" cy="15.6" r="0.9" fill="currentColor" stroke="none"/>',
  'shield-check':
    '<path d="M12 3 4.5 6v5.4c0 4.4 3.1 8.1 7.5 9.6 4.4-1.5 7.5-5.2 7.5-9.6V6Z"/><path d="m9 11.8 2.2 2.2 4-4.4"/>',
  shield: '<path d="M12 3 4.5 6v5.4c0 4.4 3.1 8.1 7.5 9.6 4.4-1.5 7.5-5.2 7.5-9.6V6Z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2"/><circle cx="12" cy="8.2" r="0.9" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  filter: '<path d="M3.5 5h17l-6.5 7.6V19l-4 2v-8.4Z"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2.2"/><path d="M3.5 9.8h17"/><path d="M8 3.2v3.4M16 3.2v3.4"/>',
  link: '<path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.2"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.2"/>',
  trash:
    '<path d="M4.5 6.5h15"/><path d="M9 6.5V4.8h6v1.7"/><path d="M6.5 6.5 7.6 20h8.8l1.1-13.5"/><path d="M10.4 10.5v5.6M13.6 10.5v5.6"/>',
  edit: '<path d="M4.5 19.5h4L19 9a2.1 2.1 0 0 0-3-3L5.5 16.5Z"/><path d="M14.6 7.4 17.5 10.3"/>',
  refresh:
    '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4.5V10h-5.5"/>',
  trophy:
    '<path d="M7.5 4.5h9v4.6a4.5 4.5 0 0 1-9 0Z"/><path d="M7.5 6H5a2 2 0 0 0 2.5 3.4"/><path d="M16.5 6H19a2 2 0 0 1-2.5 3.4"/><path d="M12 13.6V17"/><path d="M8.8 19.8h6.4"/>',
  mic: '<rect x="9.2" y="3.5" width="5.6" height="10" rx="2.8"/><path d="M5.5 11.4a6.5 6.5 0 0 0 13 0"/><path d="M12 17.9v2.6"/>',
  book: '<path d="M4.5 5.2A2.2 2.2 0 0 1 6.7 3h12.8v15.4H6.7a2.2 2.2 0 0 0-2.2 2.2Z"/><path d="M4.5 5.2v15.4"/>',
  heart:
    '<path d="M12 19.5S4 15 4 9.9A4.2 4.2 0 0 1 12 7.7a4.2 4.2 0 0 1 8 2.2c0 5.1-8 9.6-8 9.6Z"/>',
  folder: '<path d="M3.5 6.8A2 2 0 0 1 5.5 4.8h3.9l2 2.4h7.1a2 2 0 0 1 2 2v7.9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>',
  spark: '<path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.9L12 18.4l-1.8-5.7L4.5 10.8 10.2 9Z"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1 1-1.1 1.8v.4"/><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none"/>',
  lock: '<rect x="4.8" y="10.5" width="14.4" height="10" rx="2.2"/><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7"/>',
  logout: '<path d="M14.5 4.5H19a1.8 1.8 0 0 1 1.8 1.8v11.4A1.8 1.8 0 0 1 19 19.5h-4.5"/><path d="M10 16.2 14.2 12 10 7.8"/><path d="M14.2 12H3.6"/>',
  list: '<path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12"/><circle cx="4.4" cy="6.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.4" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.4" cy="17.5" r="1.2" fill="currentColor" stroke="none"/>',
  layers: '<path d="m12 3.5 8.5 4.6L12 12.7 3.5 8.1Z"/><path d="m4.6 12.6 7.4 4 7.4-4"/><path d="m4.6 16.6 7.4 4 7.4-4"/>',
  eye: '<path d="M2.5 12S6 6.2 12 6.2 21.5 12 21.5 12 18 17.8 12 17.8 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.9"/>',
  flag: '<path d="M6 20.5V4.2"/><path d="M6 5.2h10.5l-1.6 3.4 1.6 3.4H6"/>',
  inbox:
    '<path d="M3.5 13.5h4l1.4 2.4h6.2l1.4-2.4h4"/><path d="M3.5 13.5 6 5.5h12l2.5 8v5a1.8 1.8 0 0 1-1.8 1.8H5.3A1.8 1.8 0 0 1 3.5 18.5Z"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7.5" y="12" width="3" height="5" rx="0.8"/><rect x="13" y="8.5" width="3" height="8.5" rx="0.8"/>',
  bolt: '<path d="M13.4 3 5.8 13.4h5.3L10.6 21l7.6-10.4h-5.3Z"/>',
  compass:
    '<circle cx="12" cy="12" r="8.5"/><path d="m15.4 8.6-2.1 4.7-4.7 2.1 2.1-4.7Z"/>',
  send: '<path d="M20.5 3.5 3.8 10.2l6.3 2.4 2.4 6.3Z"/><path d="m10.1 12.6 4.8-4.8"/>',
  'graduation-cap':
    '<path d="m12 4.2 9 4.3-9 4.3-9-4.3Z"/><path d="M6.6 10.9v4.4c0 1.5 2.4 2.7 5.4 2.7s5.4-1.2 5.4-2.7v-4.4"/><path d="M21 8.5v5"/>',
  tag: '<path d="M11.3 3.8H20v8.7l-8.4 8.4a1.6 1.6 0 0 1-2.3 0l-6.4-6.4a1.6 1.6 0 0 1 0-2.3Z"/><circle cx="16" cy="8" r="1.4"/>',
  file: '<path d="M13.5 3.5H7a1.8 1.8 0 0 0-1.8 1.8v13.4A1.8 1.8 0 0 0 7 20.5h10a1.8 1.8 0 0 0 1.8-1.8V8.8Z"/><path d="M13.5 3.5v5.3h5.3"/>',
  key: '<circle cx="8.2" cy="15.8" r="3.7"/><path d="m10.9 13.1 8.6-8.6"/><path d="m16.6 7.4 2.4 2.4"/><path d="m14.2 9.8 2.4 2.4"/>',
  radio: '<circle cx="12" cy="12" r="2.2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4"/><path d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>',
  clipboard:
    '<rect x="5.5" y="4.8" width="13" height="15.4" rx="2"/><path d="M9.2 4.8V3.5h5.6v1.3"/><path d="M9 11h6M9 15h4"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 4.4V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3Z"/>',
  dot: '<circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/>',
  sun: '<circle cx="12" cy="12" r="4.4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/>',
  moon: '<path d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a8.6 8.6 0 1 0 11 11Z"/>',
};

/**
 * 生成图标 SVG
 * @param {string} name 图标名
 * @param {number} size 像素尺寸
 * @param {object} [options] { fill: boolean, stroke: number }
 */
export function icon(name, size = 16, options = {}) {
  const body = PATHS[name] || PATHS.dot;
  const fill = options.fill ? 'currentColor' : 'none';
  const strokeWidth = options.stroke || 1.8;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

export const ICON_NAMES = Object.keys(PATHS);

/**
 * config.js — 运行时配置
 *
 * 本应用支持两种运行方式，界面与功能完全一致：
 *
 *   local  —— 纯静态模式（默认）
 *              数据保存在浏览器 localStorage，不需要任何服务器。
 *              可直接部署到 GitHub Pages / 任意静态托管，双击 index.html 亦可运行。
 *
 *   remote —— 前后端分离模式
 *              数据保存在远端后端（EdgeOne Makers 云函数 + Blob 存储），
 *              需要额外配置 window.__CAMPUS_RADAR_API_BASE__。
 *
 * 切换方式：修改 index.html 中的 window.__CAMPUS_RADAR_MODE__。
 */

const MODES = ['local', 'remote'];
const DEFAULT_MODE = 'local';

function readConfig() {
  if (typeof window === 'undefined') {
    return { mode: DEFAULT_MODE, apiBase: '' };
  }

  const rawMode = window.__CAMPUS_RADAR_MODE__;
  const mode = MODES.includes(rawMode) ? rawMode : DEFAULT_MODE;

  const rawBase = window.__CAMPUS_RADAR_API_BASE__;
  const apiBase =
    typeof rawBase === 'string' && rawBase.trim() ? rawBase.trim().replace(/\/+$/, '') : '';

  return { mode, apiBase };
}

const config = readConfig();

export const MODE = config.mode;
export const API_BASE = config.apiBase;

export const IS_LOCAL = MODE === 'local';

/** 是否需要为跨域做准备（仅远端模式下、且后端不同源时有意义） */
export function isCrossOrigin() {
  if (IS_LOCAL) return false;
  if (!API_BASE) return false;
  if (typeof location === 'undefined') return false;
  try {
    return new URL(API_BASE).origin !== location.origin;
  } catch {
    return false;
  }
}

/**
 * 配置不完整时的提示。
 * 远端模式下却没有填后端地址，用户只会看到「无法连接」而不知道原因。
 */
export function configWarning() {
  if (IS_LOCAL) return '';
  if (API_BASE) return '';
  return (
    '当前运行在 remote 模式，但没有配置后端地址。' +
    '请在 index.html 中设置 window.__CAMPUS_RADAR_API_BASE__，' +
    '或把 window.__CAMPUS_RADAR_MODE__ 改回 "local" 使用纯静态模式。'
  );
}

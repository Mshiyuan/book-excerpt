$(() => {
  // 作为酒馆扩展直接跑在酒馆主文档里，不再经过酒馆助手的沙箱 iframe——
  // mainDoc/mainWin 本来就等价于 window.parent.document/window.parent，这里改指向后
  // 下面所有 mainDoc.*/mainWin.* 调用（含 localStorage 的 key 名）行为完全不变。
  const mainDoc = document;
  const mainWin = window;

  const SCRIPT_ID = 'book-excerpt';
  const SCRIPT_NAME = '书摘';
  const VERSION = '1.3.0';
  const LS_SETTINGS = `${SCRIPT_ID}:settings`;
  const LS_NOTES = `${SCRIPT_ID}:notes`;
  // 本次脚本实例的代号。酒馆助手可能在不刷新页面的情况下重建脚本 iframe（热更新/切聊天等），
  // 旧 iframe realm 一死，父文档里常驻 UI 绑的旧监听器就会静默失效（闭包里的 setTimeout 永远不回调）。
  // 所有常驻父文档的 UI 都打上 data-be-gen 标记：发现标记不是本实例就拆掉重建，杜绝"僵尸监听器"。
  const RUN_ID = `${VERSION}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 7)}`;
  const stampGen = (el) => { try { el.dataset.beGen = RUN_ID; } catch (e) {} return el; };
  const isStaleGen = (el) => { try { return el.dataset.beGen !== RUN_ID; } catch (e) { return true; } };

  // ---------- 默认设置 ----------
  const DEFAULT_SETTINGS = {
    template: 'classic',           // 排版：classic / inkwhite / note / jinshu / calendar
    colorPreset: 'paper-warm',     // 颜色配色（固定搭配 id 或 'custom'）
    customBg: '#f5f1e8',           // 自定义背景色
    customFgEnabled: false,        // 自定义字色开关
    customFg: '#222222',           // 自定义字色
    palette: 'macaron',            // 划线色系：morandi/macaron/mondrian/memphis/matisse
    avatarType: 'user',            // 头像类型：user / char / custom
    customAvatar: '',              // 自定义头像 dataURL（avatarType==='custom' 时使用）
    font: 'follow_theme',
    quoteFontSize: 19,             // 正文字号 px（14~22）
    quoteLineHeight: 2.05,         // 正文行距（1.5~2.3）
    quoteLetterSpacing: 0.04,      // 正文字间距 em（0~0.15）
    cardWidth: 440,                // 书摘整体宽度 px（针对竖屏排版，300~440）
    showWatermark: true,           // 是否显示水印
    watermarkText: 'SillyTavern',  // 水印文字（可改成任何内容）
    showThoughtQuote: true,        // 想法书摘：原句区是否显示引用符号（“）
    maskOn: false,                 // 正文打码：分享时隐去名字（总开关）
    maskStyle: 'block',            // 打码形式：block 涂黑 / symbol 符号 / custom 自定义符号
    maskCustomChar: '✕',           // 自定义符号（maskStyle==='custom' 时按字数重复）
    maskUser: true,                // 打码用户名（自身 userName + 出处里自定义的用户名）
    maskChar: true,                // 打码角色名（自身 charName + 出处里自定义的作者名）
    maskExtra: '',                 // 额外打码词（逗号/顿号/空格分隔）
    maskSource: false,             // 是否同时打码出处显示的用户名/作者
    highlightStyle: 'underline',   // underline | marker
    stripStyle: true,
    underlineColor: '#95b6d6',
    markerColor: '#ffdc6e',
    thoughtLineColor: '#ffdc6e',  // 只想法虚线颜色
    thoughtBoost: true,            // 有想法的划线提升明度
    showAvatar: true,
    showDate: true,
    showSourceTitle: false,        // 是否显示书名
    showSourceChapter: false,      // 是否显示章名
    sourceUser: '',                // 用户名（留空用 {{user}}）
    sourceAuthor: '',              // 作者（留空用 {{char}}）
    sourceTitle: '',               // 书名
    sourceChapter: '',             // 章名
    customTemplates: [],           // 用户导入的自定义模板 [{id, name, css}]
    customFonts: [],               // 用户导入的自定义字体 [{id, name, css, fontFamily}]
    lastStyle: '',                 // 上次实际用的划线样式（空=回退到 highlightStyle）
    lastColor: '',                 // 上次实际用的划线颜色（空=用 style 对应的默认色）
    saveMode: 'download',          // 保存图片方式：download 下载文件 / popup 弹图长按保存（部分内嵌浏览器不支持下载时用）
    keepDelLine: false,            // 书摘卡片是否保留原文的删除线（del/s 划掉效果）
    mergeEnabled: false,           // 划线合并：点划线可加入合并篮子 + 悬浮篮子入口（默认关，不影响现有用户界面）
    mergeDefaultTarget: '',        // 合并完成后默认动作：'' 每次询问 / 'note' 直接存为笔记 / 'card' 直接生成书摘
    mergeDeleteOriginal: ''        // 合并后原划线怎么处理：'' 每次询问 / 'delete' 删除原划线 / 'keep' 保留原划线
  };

  // ---------- 模板（仅排版，颜色独立）----------
  const TEMPLATES = {
    classic:   { name: '经典' },
    portrait:  { name: '人像' },
    landscape: { name: '横幅' },
    mixtape:   { name: '磁带' },
    filmframe: { name: '影帧' },
    verse:     { name: '诗笺' },
    jinshu:    { name: '锦书' },
    calendar:  { name: '日历' }
  };

  // ---------- 颜色配色（17 个固定搭配 + 自定义）----------
  // 参考用户给的色环：浅底配深字、深底配浅字；部分搭配带辅助色（accent）
  const COLOR_PRESETS = [
    // —— 第一行（亮系）
    { id: 'pure-white',  name: '纯白', bg: '#ffffff', fg: '#222222', sub: '#999999', avatarBg: '#eeeeee' },
    { id: 'blue-white',  name: '蓝白', bg: '#ffffff', fg: '#2a6cb0', sub: '#7aa3cc', avatarBg: '#e3eef9' },
    { id: 'ink-black',   name: '墨黑', bg: '#1f1f1f', fg: '#cfcfcf', sub: '#808080', avatarBg: '#2a2a2a' },
    { id: 'paper-warm',  name: '米白', bg: '#f0ebe0', fg: '#3a3a3a', sub: '#999088', avatarBg: '#d8d2c4' },
    { id: 'deep-purple', name: '夜紫', bg: '#262638', fg: '#e8e6f0', sub: '#9a96b3', avatarBg: '#37374f' },
    // —— 第二行
    { id: 'classic',     name: '经典', bg: '#2a2a2a', fg: '#e8d9b8', sub: '#8a8175', avatarBg: '#3a3a3a' },
    { id: 'silver',      name: '银灰', bg: '#bcbcbc', fg: '#2e2e2e', sub: '#6a6a6a', avatarBg: '#a8a8a8' },
    { id: 'cobalt',      name: '钴蓝', bg: '#0e468f', fg: '#ffffff', sub: '#b9c8de', avatarBg: '#1e58a3' },
    { id: 'navy',        name: '深蓝', bg: '#152554', fg: '#cfc8e0', sub: '#7e8aa8', avatarBg: '#24356a' },
    // —— 第三行
    { id: 'mid-gray',    name: '中灰', bg: '#a8a8a8', fg: '#ffffff', sub: '#e0e0e0', avatarBg: '#959595' },
    { id: 'fog',         name: '雾灰', bg: '#dedede', fg: '#3a3a3a', sub: '#8a8a8a', avatarBg: '#c6c6c6' },
    { id: 'mist-green',  name: '青白', bg: '#c3d1c8', fg: '#3a4a40', sub: '#7e8a82', avatarBg: '#aebbb3' },
    { id: 'pine',        name: '松绿', bg: '#3d6b56', fg: '#ffffff', sub: '#b4c8bd', avatarBg: '#4d7a66' },
    // —— 第四行
    { id: 'wine',        name: '酒红', bg: '#6a1a25', fg: '#e8d4c0', sub: '#b4827d', avatarBg: '#7e2330' },
    { id: 'plum',        name: '紫雾', bg: '#574870', fg: '#e8d5e8', sub: '#9d8db5', avatarBg: '#6d5f8a' },
    { id: 'blush',       name: '胭脂', bg: '#e8b4b8', fg: '#3a2530', sub: '#8a5d63', avatarBg: '#d99a9f' },
    { id: 'apricot',     name: '杏橙', bg: '#e6a565', fg: '#3d2810', sub: '#8a5e30', avatarBg: '#cf9258' }
  ];

  // ---------- 字体 ----------
  const FONTS = {
    songti: {
      name: '思源宋体',
      css: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif',
      stylesheet: 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600&display=swap'
    },
    kinghwa: {
      name: '京华老宋体',
      css: '"KingHwaOldSong", "Noto Serif SC", "Songti SC", serif',
      stylesheet: 'https://fontsapi.zeoseven.com/309/main/result.css'
    },
    wenkai: {
      name: '霞鹜文楷',
      css: '"LXGW WenKai", "Kaiti SC", "STKaiti", cursive',
      stylesheet: 'https://fontsapi.zeoseven.com/292/main/result.css'
    },
    cangerjinkai: {
      name: '仓耳今楷',
      css: '"TsangerJinKai05", "Kaiti SC", "STKaiti", cursive',
      stylesheet: 'https://fontsapi.zeoseven.com/14/main/result.css'
    },
    sans: {
      name: '思源黑体',
      css: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
      stylesheet: ''
    },
    pingfang_shaohua: {
      name: '平方韶华',
      css: '"PING FANG SHAO HUA", "Kaiti SC", "STKaiti", cursive',
      stylesheet: 'https://fontsapi.zeoseven.com/157/main/result.css'
    },
    follow_theme: {
      name: '跟随酒馆',
      css: '',          // 运行时通过 CSS 变量动态读取
      stylesheet: ''
    }
  };

  // 计算当前实际使用的颜色（bg / fg / sub / avatarBg）
  // 规则：
  //  · 选了某个固定预设 → 直接用预设的 bg+fg 搭配
  //  · 选了自定义颜色 → bg 用 customBg；
  //    若开启了"自定义字色"，fg=customFg；否则按 bg 明度自动选黑/奶白
  function resolveColors() {
    const useCustom = settings.colorPreset === 'custom';
    if (!useCustom) {
      const p = COLOR_PRESETS.find(x => x.id === settings.colorPreset)
             || COLOR_PRESETS.find(x => x.id === 'paper-warm');
      return { ...p };
    }
    const bg = settings.customBg || '#f5f1e8';
    const lum = parseLuminance(bg);
    const autoFg = (lum != null && lum > 0.55) ? '#1a1a1a' : '#f0e6c6';
    const fg = settings.customFgEnabled ? (settings.customFg || autoFg) : autoFg;
    const subLum = parseLuminance(fg);
    const sub = mixColor(fg, bg, 0.55); // 子色：fg 和 bg 的混合
    return { bg, fg, sub, avatarBg: mixColor(fg, bg, 0.85) };
  }

  // 在 fg 和 bg 之间混合（t=0 是 fg，t=1 是 bg）
  function mixColor(c1, c2, t) {
    const a = hexToRgb(c1), b = hexToRgb(c2);
    if (!a || !b) return c1;
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bl = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r},${g},${bl})`;
  }
  function hexToRgb(hex) {
    if (!hex) return null;
    let h = hex.trim().replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6) return null;
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    if ([r,g,b].some(v => isNaN(v))) return null;
    return { r, g, b };
  }

  function loadFontStylesheets() {
    Object.entries(FONTS).forEach(([k, f]) => {
      if (!f.stylesheet) return;
      const id = `be-font-${k}`;
      if (mainDoc.getElementById(id)) return;
      const link = mainDoc.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = f.stylesheet;
      mainDoc.head.appendChild(link);
    });
    injectCustomFontStyles();
  }

  // 把所有自定义字体的 @import 语句注入 <style>（只注入 @import，不污染全局样式）
  function injectCustomFontStyles() {
    let el = mainDoc.getElementById('be-custom-font-style');
    if (!el) {
      el = mainDoc.createElement('style');
      el.id = 'be-custom-font-style';
      mainDoc.head.appendChild(el);
    }
    const list = Array.isArray(settings.customFonts) ? settings.customFonts : [];
    el.textContent = list.map(f => {
      const css = f.css || '';
      // 只提取 @import 行，避免影响全局样式
      return css.split('\n').filter(l => l.trim().startsWith('@import')).join('\n');
    }).join('\n');
  }

  // ---------- 设置 ----------
  function loadSettings() {
    try {
      const raw = mainWin.localStorage.getItem(LS_SETTINGS);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      const parsed = JSON.parse(raw);
      const s = { ...DEFAULT_SETTINGS, ...parsed };
      // 已移除「马赛克」形式，旧设置归一到涂黑
      if (s.maskStyle === 'mosaic') s.maskStyle = 'block';
      // 旧的 maskAuto 单开关（同时管 user+char）→ 拆成 maskUser / maskChar
      if (parsed.maskAuto !== undefined && parsed.maskUser === undefined && parsed.maskChar === undefined) {
        s.maskUser = s.maskChar = (parsed.maskAuto !== false);
      }
      delete s.maskAuto;
      return s;
    } catch { return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); }
  }
  function saveSettings(s) {
    try { mainWin.localStorage.setItem(LS_SETTINGS, JSON.stringify(s)); } catch (e) {}
  }
  let settings = loadSettings();

  // ---------- 笔记数据 ----------
  // 把旧的 note.thought (string) 迁移成 note.thoughts (array)
  function migrateNote(n) {
    if (!n) return n;
    if (!Array.isArray(n.thoughts)) {
      const t = (n.thought || '').trim();
      n.thoughts = t ? [{ id: 't' + Date.now() + Math.random().toString(36).slice(2,5), text: t, ts: n.ts || Date.now() }] : [];
    }
    return n;
  }
  // 内存缓存：避免 localStorage 写失败时全链路雪崩（点划线没反应、笔记本空白）
  let _notesCache = null;
  let _storageWarned = false;
  function loadNotes() {
    if (_notesCache) return _notesCache;
    let raw = {};
    try {
      const stored = mainWin.localStorage.getItem(LS_NOTES);
      if (stored) raw = JSON.parse(stored);
    } catch (e) {
      console.warn('[书摘] 笔记读取失败：', e);
      if (!_storageWarned) {
        _storageWarned = true;
        toast('笔记读取失败，可能是数据损坏或存储权限被禁用', 'error');
      }
    }
    Object.values(raw).forEach(ch => {
      if (!ch || !Array.isArray(ch.items)) return;
      ch.items.forEach(migrateNote);
    });
    _notesCache = raw;
    return raw;
  }
  function saveNotes(n) {
    _notesCache = n; // 内存缓存先更新，确保本会话功能可用
    try {
      mainWin.localStorage.setItem(LS_NOTES, JSON.stringify(n));
    } catch (e) {
      console.warn('[书摘] 笔记保存失败：', e);
      if (!_storageWarned) {
        _storageWarned = true;
        const msg = (e && e.name === 'QuotaExceededError')
          ? '存储已满，请到 设置→数据 导出备份并清空'
          : '保存到 localStorage 失败，本次有效，刷新后会丢失。请检查浏览器存储权限/隐私模式';
        toast(msg, 'error');
      }
    }
  }
  function addThought(charKey, noteId, text) {
    const notes = loadNotes();
    const it = notes[charKey]?.items.find(x => x.id === noteId);
    if (!it) return null;
    migrateNote(it);
    const t = { id: 't' + Date.now() + Math.random().toString(36).slice(2,5), text: text.trim(), ts: Date.now() };
    it.thoughts.push(t);
    saveNotes(notes);
    return t;
  }
  function updateThought(charKey, noteId, thoughtId, text) {
    const notes = loadNotes();
    const it = notes[charKey]?.items.find(x => x.id === noteId);
    if (!it) return;
    migrateNote(it);
    const t = it.thoughts.find(x => x.id === thoughtId);
    if (t) { t.text = text.trim(); t.ts = Date.now(); saveNotes(notes); }
  }
  function removeThought(charKey, noteId, thoughtId) {
    const notes = loadNotes();
    const it = notes[charKey]?.items.find(x => x.id === noteId);
    if (!it) return;
    migrateNote(it);
    it.thoughts = it.thoughts.filter(x => x.id !== thoughtId);
    saveNotes(notes);
  }
  function addNote(note) {
    const notes = loadNotes();
    const ctx = getContext();
    const key = ctx.charKey || 'unknown';
    if (!notes[key]) {
      notes[key] = { name: ctx.charName || '未知角色', avatar: ctx.charAvatar || '', items: [] };
    }
    notes[key].name = ctx.charName || notes[key].name;
    notes[key].avatar = ctx.charAvatar || notes[key].avatar;
    note.id = note.id || ('n' + Date.now() + Math.random().toString(36).slice(2, 6));
    note.ts = note.ts || Date.now();
    note.chatId = note.chatId || ctx.chatId || '';   // 存档名
    notes[key].items.push(note);
    saveNotes(notes);
    return note;
  }
  function updateNote(charKey, id, patch) {
    const notes = loadNotes();
    if (!notes[charKey]) return;
    const it = notes[charKey].items.find(x => x.id === id);
    if (it) { Object.assign(it, patch); saveNotes(notes); }
  }
  function removeNote(charKey, id) {
    const notes = loadNotes();
    if (!notes[charKey]) return;
    notes[charKey].items = notes[charKey].items.filter(x => x.id !== id);
    if (!notes[charKey].items.length) delete notes[charKey];
    saveNotes(notes);
  }

  // ---------- 工具 ----------
  function toast(msg, type = 'info') {
    try {
      const t = mainWin.toastr;
      if (t && t[type]) t[type](msg, '', { timeOut: 2200, positionClass: 'toast-top-center' });
    } catch (e) {}
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeRegExp(s) {
    return String(s == null ? '' : s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  // ====== 名字打码：分享时隐去角色/用户名 ======
  // 收集要打码的目标词：自动取角色名/用户名（含出处里自定义的名字）+ 额外补充词
  function buildMaskTargets() {
    const names = [];
    const push = n => { const v = (n == null ? '' : String(n)).trim(); if (v) names.push(v); };
    if (settings.maskUser || settings.maskChar) {
      const ctx = getContext();
      if (settings.maskUser) { push(ctx.userName); push(settings.sourceUser); }
      if (settings.maskChar) { push(ctx.charName); push(settings.sourceAuthor); }
    }
    String(settings.maskExtra || '').split(/[,，、;；\s]+/)
      .forEach(w => { const v = w.trim(); if (v) names.push(v); });
    // 去重 + 长的先匹配，避免短名把长名截断
    return [...new Set(names)].sort((a, b) => b.length - a.length);
  }
  // 一段文字的视觉宽度（em）：CJK/全角算 1，ASCII 字母数字算 0.55，其余 0.6
  function visualEmWidth(str) {
    let w = 0;
    for (const ch of String(str)) {
      if (/[⺀-鿿豈-﫿　-〿＀-￯]/.test(ch)) w += 1;
      else if (/[A-Za-z0-9]/.test(ch)) w += 0.55;
      else w += 0.6;
    }
    return Math.max(0.8, +w.toFixed(2));
  }
  // 单个命中目标 → 打码后的 HTML 片段
  // 涂黑：空的 inline-block + 显式 em 宽度。不放真实文字——一来 html2canvas 对
  //   inline-block 里的文字会量歪、把块撑得过宽；二来空块就是个纯色圆角矩形盒，
  //   作为原子盒永不跨行，导出不会糊成一大片。宽度按字符视觉宽度算，贴合原名长度。
  // 符号/自定义：纯文字替换，按字数重复。
  function maskGlyph(name) {
    const style = settings.maskStyle || 'block';
    const len = Math.max(1, [...String(name)].length);
    if (style === 'symbol' || style === 'custom') {
      const sym = (style === 'custom' ? ([...String(settings.maskCustomChar || '').trim()][0]) : '') || '●';
      return `<span class="be-mask be-mask-${style}">${escapeHtml(sym.repeat(len))}</span>`;
    }
    return `<span class="be-mask be-mask-block" style="width:${visualEmWidth(name)}em"></span>`;
  }
  // 正文/想法：命中名字替换成打码块，其余正常转义
  function maskText(text) {
    const t = (text == null ? '' : String(text));
    if (!settings.maskOn) return escapeHtml(t);
    const targets = buildMaskTargets();
    if (!targets.length) return escapeHtml(t);
    const re = new RegExp(targets.map(escapeRegExp).join('|'), 'g');
    let out = '', last = 0, m;
    while ((m = re.exec(t)) !== null) {
      if (m.index > last) out += escapeHtml(t.slice(last, m.index));
      out += maskGlyph(m[0]);
      last = m.index + m[0].length;
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    if (last < t.length) out += escapeHtml(t.slice(last));
    return out;
  }
  // 出处显示的用户名/作者：仅当「同时打码出处」开启时才打码，否则正常转义
  function maskNameDisplay(name, fallback) {
    const raw = (name == null ? '' : String(name)).trim() ? String(name) : '';
    if (settings.maskOn && settings.maskSource && raw) return maskGlyph(raw);
    return escapeHtml(raw || fallback || '');
  }
  function formatDate(d = new Date()) {
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }
  // 把数字转大写中文（用于墨白模板的竖排日期：二〇二六·五月·二十一日）
  function numToChinese(n) {
    const digits = '〇一二三四五六七八九';
    return String(n).split('').map(d => digits[+d] || d).join('');
  }
  function dayToChinese(d) {
    if (d <= 10) return ['', '一','二','三','四','五','六','七','八','九','十'][d];
    if (d < 20) return '十' + ['','一','二','三','四','五','六','七','八','九'][d-10];
    if (d === 20) return '二十';
    if (d < 30) return '二十' + ['','一','二','三','四','五','六','七','八','九'][d-20];
    if (d === 30) return '三十';
    return '三十' + ['','一'][d-30];
  }
  function monthToChinese(m) {
    return ['','一','二','三','四','五','六','七','八','九','十','十一','十二'][m] + '月';
  }
  function toChineseDate(d) {
    return `${numToChinese(d.getFullYear())}年 · ${monthToChinese(d.getMonth()+1)} · ${dayToChinese(d.getDate())}日`;
  }

  function formatDateTime(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  // ---------- 上下文（注意：头像用 user 的）----------
  function getUserAvatarUrl() {
    try {
      // 方法1：从当前聊天里 is_user 的最后一条消息上拿（ST 给 .mes 的 .avatar img 设的就是缩略图 URL）
      const userMes = mainDoc.querySelector('.mes[is_user="true"] .avatar img');
      if (userMes && userMes.src) return userMes.src;
      // 方法2：从 persona 面板里拿（已选中的）
      const sel = mainDoc.querySelector('#user_avatar_block .avatar.selected img, .persona_avatar_block.selected img, #persona_avatar_block_default img');
      if (sel && sel.src) return sel.src;
      // 方法3：从 SillyTavern 全局变量构造缩略图 URL（ST 用 /thumbnail?type=persona&file=...）
      const av = mainWin.user_avatar;
      if (av) return `/thumbnail?type=persona&file=${encodeURIComponent(av)}`;
    } catch (e) {}
    return '';
  }

  // 把上传的图片文件压缩到 ≤320px 方形 JPEG dataURL（避免 localStorage 5MB 上限）
  // 上传后调用：const dataUrl = await fileToCompressedAvatar(file);
  function fileToCompressedAvatar(file, maxSize = 320, quality = 0.85) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('请选择图片文件'));
        return;
      }
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('读取文件失败'));
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('图片解码失败'));
        img.onload = () => {
          try {
            const w0 = img.naturalWidth, h0 = img.naturalHeight;
            if (!w0 || !h0) { reject(new Error('图片尺寸无效')); return; }
            // 居中裁成方形再缩放
            const side = Math.min(w0, h0);
            const sx = (w0 - side) / 2, sy = (h0 - side) / 2;
            const out = Math.min(maxSize, side);
            const canvas = mainDoc.createElement('canvas');
            canvas.width = out; canvas.height = out;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
            // 透明图（png）用透明 webp 退到 png，否则 jpeg
            const hasAlpha = /\/png$|\/webp$|\/gif$/i.test(file.type);
            const mime = hasAlpha ? 'image/png' : 'image/jpeg';
            const dataUrl = canvas.toDataURL(mime, quality);
            resolve(dataUrl);
          } catch (e) { reject(e); }
        };
        img.src = String(fr.result || '');
      };
      fr.readAsDataURL(file);
    });
  }

  // 把图片 url 转 data URL（避免截图时 CORS 把头像变 [object Event]）
  const _avatarCache = new Map();
  async function urlToDataUrl(url) {
    if (!url) return '';
    if (_avatarCache.has(url)) return _avatarCache.get(url);
    try {
      const resp = await fetch(url, { credentials: 'same-origin' });
      if (!resp.ok) throw new Error('fetch ' + resp.status);
      const blob = await resp.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(blob);
      });
      _avatarCache.set(url, dataUrl);
      return dataUrl;
    } catch (e) {
      _avatarCache.set(url, '');
      return '';
    }
  }

  function getContext() {
    let charName = '', userName = '', charAvatar = '', userAvatar = '', charKey = '', chatId = '';
    try {
      const ctx = (typeof mainWin.SillyTavern !== 'undefined' && mainWin.SillyTavern.getContext)
        ? mainWin.SillyTavern.getContext() : null;
      if (ctx) {
        const ch = ctx.characters?.[ctx.characterId];
        charName = ch?.name || mainWin.name2 || '';
        if (ch?.avatar) {
          charAvatar = `/thumbnail?type=avatar&file=${encodeURIComponent(ch.avatar)}`;
          charKey = ch.avatar;
        }
        userName = ctx.name1 || mainWin.name1 || '';
        chatId = ctx.chatId || '';
      } else {
        charName = mainWin.name2 || '';
        userName = mainWin.name1 || '';
      }
    } catch (e) {}
    userAvatar = getUserAvatarUrl();
    if (!charKey) charKey = charName || 'unknown';
    return { charName, userName, charAvatar, userAvatar, charKey, chatId };
  }

  // ---------- 样式 ----------
  // 生成 SVG dataURI（波浪线、虚线），颜色由 settings 决定
  function wavyDataUri(color) {
    const c = color || '#c9a76a';
    // viewBox 24x5，波长大让线条疏一点
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 5'><path d='M0,2.5 Q6,-0.5 12,2.5 T24,2.5' stroke='${c}' stroke-width='1.2' fill='none' stroke-linecap='round'/></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  function dashDataUri(color) {
    const c = color || '#ffdc6e';
    // 12 宽 viewBox：line 长度 7，间距 5，比浏览器原生 dashed 间距更宽
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 2'><line x1='0' y1='1' x2='7' y2='1' stroke='${c}' stroke-width='1'/></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  // 通过 :root 注入主题强调色 / 划线色 / 荧光色变量，配色全部跟随设置
  function buildStyle() {
    const accent  = settings.underlineColor || '#95b6d6';
    const marker  = settings.markerColor || '#ffdc6e';
    const thoughtLine = settings.thoughtLineColor || marker;
    const wavyUri = wavyDataUri(accent);
    const dashUri = dashDataUri(thoughtLine);
    return `
    :root {
      --be-accent: ${accent};
      --be-accent-soft: ${hexA(accent, 0.18)};
      --be-marker: ${marker};
      --be-marker-soft: ${hexA(marker, 0.55)};
      --be-thought-line: ${thoughtLine};
    }

    /* 主题感知：跟随 SillyTavern 主题。当外层判定为日间（浅色）时，
       插件 UI 用白底+深字；夜间用深底+浅字。 */
    body:not(.be-light-theme) {
      --be-panel-bg: #111111;
      --be-panel-fg: #e6e6e6;
      --be-panel-sub: #cfcfcf;
      --be-panel-border: rgba(255,255,255,0.10);
      --be-panel-divider: rgba(255,255,255,0.08);
      --be-panel-row-bg: rgba(255,255,255,0.06);
      --be-panel-row-bg-hover: rgba(255,255,255,0.10);
      --be-panel-input-bg: rgba(255,255,255,0.06);
      --be-panel-input-border: rgba(255,255,255,0.15);
      --be-panel-empty-fg: #cfcfcf;
      --be-panel-tab-fg: #e6e6e6;
      --be-panel-placeholder: rgba(230,230,230,0.4);
      --be-panel-scroll: rgba(255,255,255,0.20);
      --be-thought-bg: #161616;
      --be-thought-fg: #e0e0e0;
      --be-thought-border: rgba(255,255,255,0.12);
      --be-btn-bg: rgba(255,255,255,0.12);
      --be-btn-bg-hover: rgba(255,255,255,0.20);
      --be-btn-border: rgba(255,255,255,0.20);
      --be-btn-fg: #fff;
    }
    body.be-light-theme {
      --be-panel-bg: #ffffff;
      --be-panel-fg: #2a2a2a;
      --be-panel-sub: #6b6b6b;
      --be-panel-border: rgba(0,0,0,0.10);
      --be-panel-divider: rgba(0,0,0,0.08);
      --be-panel-row-bg: rgba(0,0,0,0.04);
      --be-panel-row-bg-hover: rgba(0,0,0,0.08);
      --be-panel-input-bg: rgba(0,0,0,0.04);
      --be-panel-input-border: rgba(0,0,0,0.12);
      --be-panel-empty-fg: #6b6b6b;
      --be-panel-tab-fg: #2a2a2a;
      --be-panel-placeholder: rgba(0,0,0,0.35);
      --be-panel-scroll: rgba(0,0,0,0.20);
      --be-thought-bg: #ffffff;
      --be-thought-fg: #2a2a2a;
      --be-thought-border: rgba(0,0,0,0.12);
      --be-btn-bg: rgba(0,0,0,0.06);
      --be-btn-bg-hover: rgba(0,0,0,0.10);
      --be-btn-border: rgba(0,0,0,0.15);
      --be-btn-fg: #2a2a2a;
    }

    /* ===== 浮动工具栏（仿微信阅读 · 紧凑版） ===== */
    #be-float-bar {
      /* absolute + scrollY 偏移：Firefox 在 body 有 transform 时 fixed 会被重 anchor 到 body 而非视口，
         导致 bar 出现在屏幕外、并撑大 body 触发滚动条跳动。absolute 各浏览器表现一致。 */
      position: absolute; z-index: 2147483600;
      display: none;
      background: #2b2b2b;
      border-radius: 10px;
      box-shadow: 0 4px 18px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3);
      padding: 3px 2px;
      font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
      user-select: none;
      gap: 0;
    }
    #be-float-bar.show { display: flex; }
    /* 默认：工具栏在选区下方时，箭头在工具栏顶部、朝上指向文字 */
    #be-float-bar::after {
      content: ''; position: absolute;
      top: -5px; left: var(--arrow-left, 50%); transform: translateX(-50%);
      width: 0; height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-bottom: 5px solid #2b2b2b;
    }
    /* 在选区上方时，箭头在工具栏底部、朝下指向文字 */
    #be-float-bar.arrow-bottom::after {
      top: auto; bottom: -5px;
      border-bottom: none;
      border-top: 5px solid #2b2b2b;
    }
    #be-float-bar .be-fbtn {
      background: transparent; border: none;
      color: #f0f0f0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 2px;
      padding: 4px 9px;
      font-size: 10px; cursor: pointer;
      border-radius: 5px;
      transition: background 0.12s;
      min-width: 40px;
      font-family: inherit;
      letter-spacing: 0.02em;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    #be-float-bar .be-fbtn:hover,
    #be-float-bar .be-fbtn:active {
      background: rgba(255,255,255,0.10);
    }
    #be-float-bar .be-fbtn svg {
      width: 15px; height: 15px;
      stroke: currentColor; fill: none;
      stroke-width: 1.6;
      stroke-linecap: round; stroke-linejoin: round;
    }
    #be-float-bar .be-fbtn-divider {
      width: 1px; background: rgba(255,255,255,0.12);
      margin: 6px 0;
    }
    /* ===== 点击划线弹出的改样式工具栏 ===== */
    #be-hl-bar {
      position: absolute;
      z-index: 2147483601;
      background: #2b2b2b;
      border-radius: 12px;
      padding: 8px 6px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      display: none;
      font-family: -apple-system, "PingFang SC", sans-serif;
      user-select: none;
      max-width: 92vw;
    }
    #be-hl-bar.show { display: block; }
    #be-hl-bar::after {
      content: ''; position: absolute;
      top: -5px; left: var(--arrow-left, 24px);
      width: 0; height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-bottom: 5px solid #2b2b2b;
    }
    #be-hl-bar.arrow-bottom::after {
      top: auto; bottom: -5px;
      border-top: 5px solid #2b2b2b; border-bottom: none;
    }
    .be-hl-row1 {
      display: flex; align-items: center; gap: 0;
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding: 0 4px 6px;
      border-bottom: 1px solid rgba(255,255,255,0.12);
      margin-bottom: 6px;
    }
    .be-hl-row1::-webkit-scrollbar { display: none; }
    .be-hl-row1 button {
      background: transparent; border: none; color: #f0f0f0;
      padding: 6px 10px; font-size: 12px;
      cursor: pointer; font-family: inherit;
      white-space: nowrap;
      flex-shrink: 0;
      letter-spacing: 0.03em;
      -webkit-tap-highlight-color: transparent;
    }
    .be-hl-row1 button:hover { color: var(--be-accent); }
    .be-hl-row1 button.danger { color: #ff9b9b; }
    .be-hl-row1 button.active { color: var(--be-accent); font-weight: 600; }
    .be-hl-row2 {
      display: flex; align-items: center; gap: 0;
      padding: 0 2px;
    }
    .be-hl-st {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
      border: 2px solid transparent;
      display: inline-flex; align-items: center; justify-content: center;
      cursor: pointer; margin: 0 3px;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }
    .be-hl-st.active { border-color: var(--be-accent); }
    .be-hl-sample {
      font-size: 13px; font-weight: 600;
      color: #fff;
      padding-bottom: 2px;
      line-height: 1;
    }
    .be-hl-sample.sample-underline { border-bottom: 1.5px solid #fff; }
    .be-hl-sample.sample-wavy {
      background: transparent url("${wavyDataUri('#ffffff')}") repeat-x 0 100%;
      background-size: 16px 4px;
      padding-bottom: 4px;
    }
    .be-hl-sample.sample-marker {
      background: linear-gradient(to bottom, transparent 60%, rgba(255,255,255,0.5) 60%, rgba(255,255,255,0.5) 95%, transparent 95%);
      padding: 0 1px;
    }
    .be-hl-divider {
      width: 1px; height: 20px;
      background: rgba(255,255,255,0.15);
      margin: 0 8px;
      flex: 0 0 auto;
    }
    .be-hl-col {
      width: 22px; height: 22px;
      border-radius: 50%;
      margin: 0 3px;
      border: 2px solid transparent;
      cursor: pointer;
      position: relative;
      padding: 0;
      flex: 0 0 auto;
      -webkit-tap-highlight-color: transparent;
    }
    .be-hl-col.active::after {
      content: ''; position: absolute;
      inset: -2px;
      border: 2px solid #fff;
      border-radius: 50%;
    }
    .be-hl-col.rainbow {
      background: conic-gradient(red, orange, yellow, green, cyan, blue, magenta, red);
      color: rgba(255,255,255,0.85);
      font-size: 14px; line-height: 1;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    .be-hl-col-input {
      position: absolute;
      inset: 0;
      width: 100%; height: 100%;
      opacity: 0;
      cursor: pointer;
      border: 0; padding: 0; margin: 0;
      background: transparent;
    }

    /* ===== 划线样式 ===== */
    .be-highlight {
      cursor: pointer;
      padding: 0 1px;
      transition: opacity 0.15s;
    }
    .be-highlight:hover { opacity: 0.8; }
    /* 下划线样式（用 --be-line 变量，便于单 note 改色） */
    .be-highlight.style-underline {
      border-bottom: 2px solid var(--be-line, var(--be-accent));
    }
    .be-highlight.style-underline.has-thought {
      border-bottom-width: 2px;
      filter: brightness(1.15);
    }
    /* 只想法不划线：SVG 虚线（大间距，覆盖所有 style 组合）
       想法+划线时（不带 thought-only），虚线不应用 */
    .be-highlight.thought-only,
    .be-highlight.thought-only.style-underline,
    .be-highlight.thought-only.style-wavy,
    .be-highlight.thought-only.style-marker,
    .be-highlight.strip-style.thought-only,
    .be-highlight.strip-style.thought-only.style-underline,
    .be-highlight.strip-style.thought-only.style-wavy,
    .be-highlight.strip-style.thought-only.style-marker {
      background: transparent url("${dashUri}") repeat-x 0 100% !important;
      background-size: 12px 2px !important;
      padding-bottom: 3px !important;
      border-bottom: none !important;
      text-decoration: none !important;
    }
    /* 有想法的划线提升明度（可关）*/
    .be-thought-boost .be-highlight.has-thought:not(.thought-only) {
      filter: brightness(1.18) saturate(1.15);
    }
    /* 荧光笔样式（用 --be-line-soft 变量） */
    .be-highlight.style-marker {
      background: linear-gradient(to bottom, transparent 55%, var(--be-line-soft, var(--be-marker-soft)) 55%, var(--be-line-soft, var(--be-marker-soft)) 95%, transparent 95%);
      border-radius: 1px;
    }
    .be-highlight.style-marker.has-thought {
      filter: brightness(1.1) saturate(1.2);
    }
    /* 波浪线样式（SVG，比浏览器原生 wavy 疏） */
    .be-highlight.style-wavy {
      text-decoration: none;
      border-bottom: none;
      background: transparent url("${wavyUri}") repeat-x 0 100%;
      background-size: 24px 5px;
      padding-bottom: 4px;
    }
    .be-highlight.strip-style.style-wavy {
      text-decoration: none !important;
      border-bottom: none !important;
      background: transparent url("${wavyUri}") repeat-x 0 100% !important;
      background-size: 24px 5px !important;
      padding-bottom: 4px !important;
    }
    /* 剥离特殊格式（让斜体/引号/加粗等不再"花" ） */
    .be-highlight.strip-style,
    .be-highlight.strip-style * {
      color: inherit !important;
      background-color: transparent !important;
      text-shadow: none !important;
      font-weight: inherit !important;
      font-style: inherit !important;
      letter-spacing: inherit !important;
      text-decoration: none !important;
    }
    .be-highlight.strip-style.style-underline {
      border-bottom: 2px solid var(--be-line, var(--be-accent)) !important;
    }
    .be-highlight.strip-style.style-marker {
      background: linear-gradient(to bottom, transparent 55%, var(--be-line-soft, var(--be-marker-soft)) 55%, var(--be-line-soft, var(--be-marker-soft)) 95%, transparent 95%) !important;
    }
    .be-highlight.strip-style q::before,
    .be-highlight.strip-style q::after { content: '' !important; }

    /* ===== 想法输入框 ===== */
    /* 注意：ST 在 html 上加了 transform，使 position:fixed 相对 html 而非 viewport，
       这里仿照 ST 自己的 #shadow_popup 用 position:absolute + 100dvh 处理 */
    #be-thought-mask {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100vh; height: 100dvh;
      z-index: 2147483640;
      background: rgba(0,0,0,0.65);
      display: none; align-items: center; justify-content: center;
      padding: 16px; box-sizing: border-box;
    }
    #be-thought-mask.open { display: flex; }
    #be-thought-box {
      background: var(--be-thought-bg);
      color: var(--be-thought-fg);
      border: 1px solid var(--be-thought-border);
      border-radius: 10px; padding: 18px;
      max-width: 480px; width: 100%;
      max-height: calc(100dvh - 32px);
      box-sizing: border-box;
      overflow-y: auto;
      font-family: var(--mainFontFamily, sans-serif);
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    }
    #be-thought-box .be-thought-title {
      font-size: 14px; letter-spacing: 0.1em;
      margin-bottom: 10px; opacity: 0.85;
    }
    #be-thought-box .be-thought-quote {
      font-size: 13px; line-height: 1.7; opacity: 0.85;
      padding: 10px 12px; margin-bottom: 12px;
      background: var(--be-accent-soft);
      border-left: 3px solid var(--be-accent);
      max-height: 100px; overflow-y: auto;
      white-space: pre-wrap; word-break: break-word;
      border-radius: 0 4px 4px 0;
      color: var(--be-thought-fg);
    }
    #be-thought-box textarea {
      width: 100%; min-height: 100px; box-sizing: border-box;
      background: var(--be-panel-input-bg);
      border: 1px solid var(--be-panel-input-border);
      color: var(--be-thought-fg); padding: 10px; border-radius: 6px;
      font-family: inherit; font-size: 13px; line-height: 1.7;
      resize: vertical;
    }
    #be-thought-box .be-thought-actions {
      display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px;
    }

    /* ===== 划线查看抽屉（点击划线弹出） ===== */
    #be-viewer-mask {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100vh; height: 100dvh;
      z-index: 2147483639;
      background: rgba(0,0,0,0.45);
      display: none;
      box-sizing: border-box;
    }
    #be-viewer-mask.open { display: block; }
    #be-viewer {
      position: absolute;
      left: 50%; transform: translate(-50%, -50%);
      top: 50%;
      width: calc(100% - 16px); max-width: 640px;
      max-height: 80dvh; overflow-y: auto;
      background: var(--be-panel-bg);
      color: var(--be-panel-fg);
      border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
      font-family: inherit;
      padding: 16px 18px 12px;
      box-sizing: border-box;
    }
    #be-viewer .be-vw-quote {
      font-size: 15px; line-height: 1.7;
      padding: 8px 0 12px;
      border-bottom: 1px solid var(--be-panel-divider);
      white-space: pre-wrap; word-break: break-word;
      max-height: 28dvh; overflow-y: auto;
    }
    #be-viewer .be-vw-quote::before { content: '“'; opacity: 0.5; }
    #be-viewer .be-vw-quote::after  { content: '”'; opacity: 0.5; }
    #be-viewer .be-vw-actions {
      display: flex; gap: 0;
      padding: 8px 0;
      border-bottom: 1px solid var(--be-panel-divider);
      margin-bottom: 8px;
    }
    #be-viewer .be-vw-actions button {
      flex: 1;
      background: transparent;
      border: none; color: var(--be-panel-fg);
      cursor: pointer;
      font-family: inherit; font-size: 12px;
      padding: 8px 4px;
      letter-spacing: 0.04em;
      opacity: 0.85;
    }
    #be-viewer .be-vw-actions button:hover { opacity: 1; color: var(--be-accent); }
    #be-viewer .be-vw-actions button.danger { color: #ff9b9b; }
    #be-viewer .be-vw-thoughts { max-height: 36dvh; overflow-y: auto; }
    #be-viewer .be-vw-thought {
      padding: 10px 12px; border-radius: 8px;
      background: var(--be-panel-row-bg);
      margin-bottom: 8px;
      cursor: pointer;
      border-left: 3px solid var(--be-accent);
    }
    #be-viewer .be-vw-thought .be-vw-thought-text {
      font-size: 13px; line-height: 1.65;
      white-space: pre-wrap; word-break: break-word;
    }
    #be-viewer .be-vw-thought .be-vw-thought-foot {
      display: flex; align-items: center; gap: 8px;
      margin-top: 4px;
    }
    #be-viewer .be-vw-thought .be-vw-thought-meta {
      flex: 1;
      font-size: 11px; opacity: 0.65;
      color: var(--be-panel-sub);
    }
    #be-viewer .be-vw-thought-share {
      background: transparent; border: none;
      color: var(--be-panel-sub);
      cursor: pointer; padding: 2px 8px;
      font-size: 13px;
      border-radius: 4px;
      opacity: 0.75;
    }
    #be-viewer .be-vw-thought-share:hover { color: var(--be-accent); opacity: 1; }
    #be-viewer .be-vw-location {
      text-align: center;
      font-size: 11px; opacity: 0.65;
      color: var(--be-panel-sub);
      padding: 8px 0 10px;
      letter-spacing: 0.06em;
      border-bottom: 1px solid var(--be-panel-divider);
    }
    #be-viewer .be-vw-empty {
      text-align: center; padding: 18px 8px;
      font-size: 12px; opacity: 0.6;
      color: var(--be-panel-sub);
    }
    #be-viewer .be-vw-close {
      position: absolute; top: 8px; right: 10px;
      background: transparent; border: none;
      color: var(--be-panel-sub);
      font-size: 22px; cursor: pointer; opacity: 0.7;
      line-height: 1;
    }
    #be-viewer .be-vw-close:hover { opacity: 1; }

    /* ===== 导入自定义模板对话框 ===== */
    .be-import-tpl-mask {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100vh; height: 100dvh;
      z-index: 2147483641;
      background: rgba(0,0,0,0.65);
      display: none; align-items: center; justify-content: center;
      padding: 16px; box-sizing: border-box;
    }
    .be-import-tpl-mask.open { display: flex; }
    .be-import-tpl-box {
      background: var(--be-thought-bg);
      color: var(--be-thought-fg);
      border: 1px solid var(--be-thought-border);
      border-radius: 10px; padding: 18px;
      max-width: 560px; width: 100%;
      max-height: calc(100dvh - 32px); overflow-y: auto;
      box-sizing: border-box;
      font-family: var(--mainFontFamily, sans-serif);
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    }
    .be-import-tpl-box textarea {
      width: 100%; box-sizing: border-box;
      background: var(--be-panel-input-bg);
      border: 1px solid var(--be-panel-input-border);
      color: var(--be-thought-fg);
      padding: 8px 10px; border-radius: 6px;
      font-family: ui-monospace, "Cascadia Code", Menlo, Consolas, monospace;
      font-size: 12px; line-height: 1.6;
      resize: vertical;
    }

    /* ===== 出处编辑（复用 thought-mask 的样式） ===== */
    #be-source-mask {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100vh; height: 100dvh;
      z-index: 2147483641;
      background: rgba(0,0,0,0.65);
      display: none; align-items: center; justify-content: center;
      padding: 16px; box-sizing: border-box;
    }
    #be-source-mask.open { display: flex; }
    #be-source-box {
      background: var(--be-thought-bg);
      color: var(--be-thought-fg);
      border: 1px solid var(--be-thought-border);
      border-radius: 10px; padding: 18px;
      max-width: 440px; width: 100%;
      max-height: calc(100dvh - 32px);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      box-sizing: border-box;
      font-family: var(--mainFontFamily, sans-serif);
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
      /* 同 #be-card-wrap 的防闪白方案：模糊蒙版上的滚动盒 + 内部高度动画（折叠区）时，
         部分机型瓦片重光栅化跟不上会闪出白色矩形块。translateZ 给盒子自己的持久栅格纹理，
         isolation 断开与背后 backdrop-filter 层的合成耦合。静态属性，无每帧开销。 */
      transform: translateZ(0);
      isolation: isolate;
    }
    #be-source-box .be-src-title {
      font-size: 14px; letter-spacing: 0.1em;
      margin-bottom: 14px; opacity: 0.9;
    }
    #be-source-box .be-src-field { margin-bottom: 12px; }
    #be-source-box .be-src-field label {
      display: block; font-size: 12px; opacity: 0.75;
      margin-bottom: 4px; letter-spacing: 0.05em;
    }
    #be-source-box .be-src-field input[type=text] {
      width: 100%; box-sizing: border-box;
      background: var(--be-panel-input-bg);
      border: 1px solid var(--be-panel-input-border);
      color: var(--be-thought-fg);
      padding: 8px 10px; border-radius: 6px;
      font-family: inherit; font-size: 13px;
    }
    #be-source-box .be-src-row {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; margin-bottom: 14px;
    }
    /* 折叠输入框：勾选开关后滑出。
       只过渡 max-height（纯重绘）——不要 transform/opacity，
       它们会在低端机上临时提升合成层，导致切换时大半屏闪一下「屏幕故障」。 */
    #be-source-box .be-src-collapse {
      max-height: 0; overflow: hidden;
      transition: max-height 0.25s ease;
    }
    #be-source-box .be-src-collapse.open {
      max-height: 120px;
    }
    /* 打码折叠区字段多（4~5 项），单独给足高度，展开时不被裁切 */
    #be-source-box #be-src-mask-wrap.open { max-height: 640px; }
    #be-source-box .be-src-actions {
      display: flex; gap: 8px; justify-content: flex-end;
    }
    #be-source-box .be-src-avatar-row {
      display: flex; align-items: center; gap: 10px;
    }
    #be-source-box .be-src-avatar-preview {
      width: 48px; height: 48px; border-radius: 50%;
      background-size: cover; background-position: center;
      background-color: var(--be-panel-input-bg);
      border: 1px solid var(--be-panel-input-border);
      flex: 0 0 auto;
    }
    #be-source-box .be-src-avatar-preview.empty::after {
      content: '?';
      display: flex; align-items: center; justify-content: center;
      width: 100%; height: 100%;
      font-size: 18px; opacity: 0.4;
    }

    /* ===== 划线合并：悬浮篮子入口 + 篮子清单 ===== */
    /* body/html 在 ST 里不滚动（内部靠 #chat 自己滚），absolute 贴 body 角落等效于视觉上"固定"，
       不需要额外监听 scroll 重算位置——同 #be-mask 等全屏蒙版的既有做法，见 [[project_st_fixed_position_trap]] */
    #be-merge-badge {
      position: absolute; right: 14px; bottom: 90px;
      z-index: 2147483620;
      width: 44px; height: 44px; border-radius: 50%;
      background: var(--be-accent, #c9a76a);
      color: #fff;
      display: none; align-items: center; justify-content: center;
      box-shadow: 0 4px 14px rgba(0,0,0,0.4);
      cursor: pointer; user-select: none;
      font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
      -webkit-tap-highlight-color: transparent;
    }
    #be-merge-badge.show { display: flex; }
    #be-merge-badge .be-merge-badge-n {
      font-size: 15px; font-weight: 600;
    }
    .be-merge-sheet-mask {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100vh; height: 100dvh;
      z-index: 2147483642;
      background: rgba(0,0,0,0.65);
      display: none; align-items: center; justify-content: center;
      padding: 16px; box-sizing: border-box;
    }
    .be-merge-sheet-mask.open { display: flex; }
    .be-merge-box {
      background: var(--be-thought-bg);
      color: var(--be-thought-fg);
      border: 1px solid var(--be-thought-border);
      border-radius: 10px; padding: 18px;
      max-width: 440px; width: 100%;
      max-height: calc(100dvh - 32px); overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      box-sizing: border-box;
      font-family: var(--mainFontFamily, sans-serif);
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
      transform: translateZ(0);
      isolation: isolate;
    }
    .be-merge-list { margin: 4px 0 14px; }
    .be-merge-item {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid var(--be-thought-border);
    }
    .be-merge-item:last-child { border-bottom: none; }
    .be-merge-item-text {
      flex: 1; font-size: 13px; line-height: 1.5; opacity: 0.9;
    }
    .be-merge-item-del {
      flex: 0 0 auto;
      width: 22px; height: 22px; border-radius: 50%;
      border: none; background: rgba(128,128,128,0.2); color: inherit;
      font-size: 14px; line-height: 1; cursor: pointer;
    }
    .be-merge-target-mask {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100vh; height: 100dvh;
      z-index: 2147483643;
      background: rgba(0,0,0,0.65);
      display: none; align-items: center; justify-content: center;
      padding: 16px; box-sizing: border-box;
    }
    .be-merge-target-mask.open { display: flex; }
    .be-merge-target-box {
      background: var(--be-thought-bg);
      color: var(--be-thought-fg);
      border: 1px solid var(--be-thought-border);
      border-radius: 10px; padding: 18px;
      max-width: 360px; width: 100%;
      box-sizing: border-box;
      font-family: var(--mainFontFamily, sans-serif);
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    }
    .be-merge-target-opts {
      display: flex; gap: 8px;
    }
    .be-merge-target-opts .be-btn { flex: 1; }
    .be-merge-hint {
      font-size: 11px; opacity: 0.6;
      margin: 10px 0 6px;
    }
    .be-merge-remember-row {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; opacity: 0.85; cursor: pointer;
    }
    .be-merge-remember-dot {
      flex: 0 0 auto;
      width: 18px; height: 18px; border-radius: 50%;
      border: 1px solid var(--be-thought-border);
      background: transparent; padding: 0; cursor: pointer;
    }
    .be-merge-remember-dot.checked {
      background: var(--be-accent, #c9a76a);
      border-color: var(--be-accent, #c9a76a);
    }

    /* ===== 合并书摘可直接编辑正文 ===== */
    .be-quote-editable {
      outline: 1px dashed var(--be-thought-border);
      outline-offset: 6px;
      border-radius: 2px;
      cursor: text;
    }
    .be-quote-editable:focus { outline-style: solid; }

    /* ===== 笔记本"合并模式"：卡片左侧多一个勾选圈 ===== */
    .be-note-card.be-merge-pickable { cursor: pointer; }
    .be-merge-check {
      flex: 0 0 auto;
      width: 20px; height: 20px; border-radius: 50%;
      border: 1px solid var(--be-thought-border);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; margin-right: 4px; align-self: center;
    }
    .be-note-card.be-merge-picked .be-merge-check {
      background: var(--be-accent, #c9a76a);
      border-color: var(--be-accent, #c9a76a);
      color: #fff;
    }

    /* ===== 书摘卡片预览（修复超屏） ===== */
    #be-mask {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100vh; height: 100dvh;
      z-index: 2147483630;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(6px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
    }
    #be-mask.open { display: flex; }
    /* ===== 弹图保存浮层（保存方式=弹图长按 / 下载失败兜底） =====
       ⚠ 不能用 position:fixed：ST 给 <html> 挂了 -webkit-transform: translateZ(0)
       （style.css "fix for chrome flickering on blurred divs"），transform 使 html 成为
       fixed 后代的包含块 → fixed 锚到 html 盒而非视口，移动端会偏上裁切。
       统一走本脚本蒙版家族的 absolute + 100dvh 模式。 */
    #be-imgpop {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100vh; height: 100dvh;
      z-index: 2147483645;
      background: rgba(0,0,0,0.82);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 12px; padding: 20px; box-sizing: border-box;
    }
    #be-imgpop img {
      max-width: 92vw; max-height: 76vh; max-height: 76dvh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.5);
      /* 长按菜单必须可用：显式恢复 callout/选择/拖拽 */
      -webkit-touch-callout: default;
      -webkit-user-select: auto; user-select: auto;
      pointer-events: auto;
    }
    #be-imgpop .be-imgpop-tip {
      color: rgba(255,255,255,0.85); font-size: 13px;
      letter-spacing: 0.05em;
    }
    #be-imgpop #be-imgpop-close {
      min-width: 96px;
    }
    /* 书摘卡片内的原文删除线段 */
    .be-card .be-quote s.be-del,
    .be-card .be-quote-orig s.be-del {
      text-decoration: line-through;
      text-decoration-thickness: 1px;
    }
    /* 拖动排版滑块期间临时关掉背景模糊：backdrop-filter 在其背后内容变化时会被
       Chromium 反复重算，部分机型上间歇性闪白(行距最明显，字距偶发)。拖动时关掉、
       停手 200ms 后恢复——#be-mask 本身有 rgba(0,0,0,0.7) 底色，关掉模糊几乎无感。 */
    body.be-typo-dragging #be-mask,
    body.be-typo-dragging #be-panel {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    #be-modal {
      width: min(440px, 100%);
      max-height: 100%;
      display: flex; flex-direction: column;
      gap: 10px;
      box-sizing: border-box;
    }
    #be-card-wrap {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      border-radius: 12px;
      box-shadow: 0 16px 50px rgba(0,0,0,0.55);
      -webkit-overflow-scrolling: touch;
      /* 提升为独立合成层：把卡片(及文字重排)的重绘与父级 #be-mask 的 backdrop-filter
         解耦——否则拖字号/行距改变卡片高度时会连带触发祖先 backdrop-filter 重算，
         在部分机型上间歇性闪白。translateZ 给它自己的栅格纹理，isolation 断开 blend 影响。 */
      transform: translateZ(0);
      isolation: isolate;
    }
    #be-card-wrap::-webkit-scrollbar { width: 4px; }
    #be-card-wrap::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }

    /* ===== 卡片主体（5 套排版共用基础） ===== */
    .be-card {
      padding: 36px 32px 28px;
      box-sizing: border-box;
      min-height: 380px;
      display: flex; flex-direction: column;
      position: relative;
    }
    .be-card .be-quote {
      font-size: var(--be-quote-size, 19px);
      line-height: var(--be-quote-lh, 2.05);
      letter-spacing: var(--be-quote-ls, 0.04em);
      white-space: pre-wrap; word-break: break-word;
    }
    .be-card .be-quote p { margin: 0 0 0.6em; text-indent: 2em; }
    .be-card .be-quote p:last-child { margin-bottom: 0; }

    /* 想法书摘模式：想法在上（大字），原句在下（小字带引号边线）
       字号/行距跟随正文滑块：想法 = 正文×1.15，原句 = 正文×0.85，行距共用 --be-quote-lh */
    .be-card .be-thought-main {
      font-size: calc(var(--be-quote-size, 19px) * 1.15);
      font-weight: 600;
      line-height: var(--be-quote-lh, 1.55);
      letter-spacing: var(--be-quote-ls, 0.03em);
      margin-bottom: 28px;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .be-card .be-quote-orig {
      font-size: calc(var(--be-quote-size, 19px) * 0.85);
      line-height: var(--be-quote-lh, 1.85);
      letter-spacing: var(--be-quote-ls, 0.04em);
      opacity: 0.78;
      padding: 22px 0 0 16px;
      border-left: 2px solid currentColor;
      word-break: break-word;
      position: relative;
    }
    .be-card .be-quote-orig p { text-indent: 0; margin: 0 0 0.4em; }
    .be-card .be-quote-orig::before {
      content: '“';
      position: absolute;
      left: 8px; top: -8px;
      font-size: 52px;
      line-height: 1;
      opacity: 0.55;
      font-family: serif;
    }
    /* 关闭原句引用符号：隐藏伪元素引号，并取消为它预留的上内边距 */
    .be-card.be-no-thought-quote .be-quote-orig::before { content: none; }
    .be-card.be-no-thought-quote .be-quote-orig { padding-top: 4px; }

    /* ===== 名字打码 ===== */
    /* 涂黑：空的定宽 inline-block 圆角块。宽度由内联 style 给（≈原名长度），
       作为原子盒永不跨行，导出(html2canvas)不会糊成一大片，也不会被量歪撑宽。 */
    .be-card .be-mask-block {
      display: inline-block;
      width: 2em;
      height: 1em;
      vertical-align: -0.12em;
      background: var(--be-card-fg, #333);
      border-radius: 3px;
    }
    /* 符号/自定义符号：纯文字替换 */
    .be-card .be-mask-symbol,
    .be-card .be-mask-custom { letter-spacing: 0.04em; opacity: 0.82; }
    .be-card .be-avatar {
      width: 44px; height: 44px; border-radius: 50%;
      background-size: cover; background-position: center;
      flex: 0 0 auto;
    }
    .be-card .be-char-avatar {
      display: none;
      width: 44px; height: 44px; border-radius: 50%;
      background-size: cover; background-position: center;
      flex: 0 0 auto;
    }
    .be-card .be-watermark {
      font-size: 11px; opacity: 0.55;
      letter-spacing: 0.12em;
      margin-top: 22px;
    }

    /* ----- 经典 ----- */
    .be-card.tpl-classic .be-head {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 28px;
    }
    .be-card.tpl-classic .be-name { font-size: 17px; letter-spacing: 0.05em; line-height: 1.3; }
    .be-card.tpl-classic .be-date { font-size: 12px; opacity: 0.75; margin-top: 4px; letter-spacing: 0.04em; }
    .be-card.tpl-classic .be-quote { flex: 1; margin-bottom: 26px; }
    .be-card.tpl-classic .be-source { font-size: 13px; line-height: 1.85; letter-spacing: 0.08em; }
    .be-card.tpl-classic .be-source .title::before { content: '／ '; }
    .be-card.tpl-classic .be-source .author { padding-left: 1.4em; margin-top: 3px; }

    /* ----- 人像 portrait：顶部大圆头像 + 居中名字 + 引文 ----- */
    .be-card.tpl-portrait {
      padding: 36px 30px 28px;
      text-align: center;
    }
    .be-card.tpl-portrait .be-pt-avatar {
      width: 84px; height: 84px;
      border-radius: 50%;
      background-size: cover; background-position: center;
      margin: 0 auto 16px;
      box-shadow: 0 0 0 4px rgba(127,127,127,0.12);
    }
    .be-card.tpl-portrait .be-pt-name {
      font-size: 20px; font-weight: 600;
      letter-spacing: 0.06em;
      line-height: 1.3;
    }
    .be-card.tpl-portrait .be-pt-date {
      font-size: 12px; opacity: 0.7;
      margin-top: 4px; letter-spacing: 0.05em;
    }
    .be-card.tpl-portrait .be-pt-line {
      width: 36px; height: 1px;
      opacity: 0.45;
      margin: 18px auto 22px;
    }
    .be-card.tpl-portrait .be-quote {
      text-align: left;
      font-size: var(--be-quote-size, 18px);
      line-height: var(--be-quote-lh, 2.05);
    }
    .be-card.tpl-portrait .be-source {
      margin-top: 26px;
      font-size: 13px; letter-spacing: 0.08em;
      text-align: center;
    }
    .be-card.tpl-portrait .be-source .title::before { content: '／ '; }
    .be-card.tpl-portrait .be-source .author { opacity: 0.75; margin-top: 4px; }
    .be-card.tpl-portrait .be-watermark { text-align: center; }

    /* ----- 横幅 landscape：双头像居中 ----- */
    .be-card.tpl-landscape {
      padding: 32px 28px 24px;
      text-align: center;
    }
    .be-card.tpl-landscape .be-ls-avatars {
      display: flex; justify-content: center; gap: 14px;
      margin-bottom: 16px;
    }
    .be-card.tpl-landscape .be-ls-avatar {
      width: 72px; height: 72px;
      border-radius: 50%;
      background-size: cover; background-position: center;
      box-shadow: 0 0 0 3px rgba(127,127,127,0.10);
    }
    .be-card.tpl-landscape .be-ls-names {
      font-size: 16px; font-weight: 600;
      letter-spacing: 0.06em;
    }
    .be-card.tpl-landscape .be-ls-names .be-ls-x {
      opacity: 0.4; margin: 0 10px; font-weight: 400;
    }
    .be-card.tpl-landscape .be-ls-date {
      font-size: 12px; opacity: 0.7;
      margin-top: 4px; letter-spacing: 0.05em;
    }
    .be-card.tpl-landscape .be-ls-line {
      width: 36px; height: 1px; opacity: 0.4;
      margin: 18px auto 22px;
    }
    .be-card.tpl-landscape .be-quote {
      text-align: left;
      font-size: var(--be-quote-size, 17px);
      line-height: var(--be-quote-lh, 1.95);
    }
    .be-card.tpl-landscape .be-source {
      margin-top: 24px;
      font-size: 13px; letter-spacing: 0.08em;
      text-align: center;
    }
    .be-card.tpl-landscape .be-source .title::before { content: '／ '; }
    .be-card.tpl-landscape .be-watermark {
      margin-top: 22px;
      text-align: center;
    }

    /* ----- 磁带 mixtape：左 mono 信息条 + 右主文 ----- */
    .be-card.tpl-mixtape { padding: 28px 28px 22px; }
    .be-card.tpl-mixtape .be-mt-tape {
      height: 12px;
      background: repeating-linear-gradient(90deg,
        currentColor 0 8px,
        transparent 8px 14px);
      opacity: 0.35;
      margin: 0 -10px 22px;
    }
    .be-card.tpl-mixtape .be-mt-tape.bottom { margin: 22px -10px 14px; }
    .be-card.tpl-mixtape .be-head {
      display: grid;
      grid-template-columns: 110px 1fr;
      gap: 18px;
    }
    .be-card.tpl-mixtape .be-mt-left {
      font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
      font-size: 11px;
      letter-spacing: 0.12em;
      line-height: 1.85;
    }
    .be-card.tpl-mixtape .be-mt-track {
      font-size: 16px; font-weight: 700;
      letter-spacing: 0.22em;
      margin-bottom: 2px;
    }
    .be-card.tpl-mixtape .be-mt-side {
      font-size: 9px;
      letter-spacing: 0.22em;
      margin-bottom: 12px;
      opacity: 0.7;
    }
    .be-card.tpl-mixtape .be-quote {
      padding-left: 16px;
      border-left: 3px solid currentColor;
      font-size: var(--be-quote-size, 17px);
      line-height: var(--be-quote-lh, 1.95);
    }
    .be-card.tpl-mixtape .be-quote p { text-indent: 0; }
    .be-card.tpl-mixtape .be-mt-wm {
      font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
      font-size: 9px;
      letter-spacing: 0.22em;
    }

    /* ----- 影帧 filmframe：黑条胶片孔 + 居中斜体 ----- */
    .be-card.tpl-filmframe { padding: 0; min-height: 460px; }
    .be-card.tpl-filmframe .be-ff-bar {
      height: 24px;
      background: #0c0c0c;
      display: flex; align-items: center;
      justify-content: space-around;
      padding: 0 10px;
    }
    .be-card.tpl-filmframe .be-ff-hole {
      width: 12px; height: 8px;
      background: var(--be-card-bg, #fff);
      border-radius: 1px;
    }
    .be-card.tpl-filmframe .be-ff-body {
      padding: 38px 32px 22px;
      text-align: center;
    }
    .be-card.tpl-filmframe .be-quote {
      font-size: var(--be-quote-size, 18px);
      line-height: var(--be-quote-lh, 1.95);
      letter-spacing: var(--be-quote-ls, 0.04em);
      font-style: italic;
    }
    .be-card.tpl-filmframe .be-quote p { text-indent: 0; }
    .be-card.tpl-filmframe .be-ff-foot {
      padding: 16px 32px 10px;
      text-align: center;
      font-size: 11px;
      line-height: 1.85;
      letter-spacing: 0.18em;
    }
    .be-card.tpl-filmframe .be-ff-who {
      font-size: 15px; font-weight: 600;
      letter-spacing: 0.12em;
      margin-bottom: 4px;
    }
    .be-card.tpl-filmframe .be-ff-wm {
      background: #0c0c0c;
      color: rgba(255,255,255,0.85);
      font-size: 10px;
      padding: 8px 18px;
      letter-spacing: 0.22em;
      text-align: right;
    }

    /* ----- 诗笺 verse：主文竖排 + 右侧装饰边栏 ----- */
    .be-card.tpl-verse { padding: 32px 28px 22px; }
    .be-card.tpl-verse .be-head {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      align-items: flex-start;
    }
    .be-card.tpl-verse .be-quote {
      writing-mode: vertical-rl;
      text-orientation: upright;
      font-size: var(--be-quote-size, 19px);
      letter-spacing: 0.18em;
      line-height: var(--be-quote-lh, 2);
      max-height: 380px;
    }
    .be-card.tpl-verse .be-quote p {
      text-indent: 2em; margin: 0 10px 0 0;
    }
    .be-card.tpl-verse .be-vs-side {
      writing-mode: vertical-rl;
      text-orientation: upright;
      font-size: 12px;
      letter-spacing: 0.32em;
      border-left: 1px solid currentColor;
      padding: 8px 10px 8px 14px;
      display: flex; flex-direction: column; gap: 14px;
      opacity: 0.85;
    }
    .be-card.tpl-verse .be-vs-side .vs-name {
      font-size: 15px;
    }
    .be-card.tpl-verse .be-vs-foot {
      margin-top: 22px;
      border-top: 1px solid currentColor;
      padding-top: 10px;
      font-size: 11px;
      letter-spacing: 0.12em;
      opacity: 0.55;
    }

    /* ----- 锦书 ----- */
    .be-card.tpl-jinshu { padding-top: 30px; }
    .be-card.tpl-jinshu .be-head {
      display: flex; gap: 16px;
      margin-bottom: 28px;
      align-items: flex-start;
    }
    .be-card.tpl-jinshu .be-vtitle {
      writing-mode: vertical-rl;
      text-orientation: upright;
      font-size: 26px; letter-spacing: 0.4em;
      line-height: 1.05; font-weight: 500;
    }
    .be-card.tpl-jinshu .be-vauthor {
      writing-mode: vertical-rl;
      text-orientation: upright;
      font-size: 12px; letter-spacing: 0.3em;
      opacity: 0.7; padding-top: 4px;
    }
    .be-card.tpl-jinshu .be-quote { flex: 1; margin-bottom: 12px; }
    .be-card.tpl-jinshu .be-source { font-size: 12px; letter-spacing: 0.08em; }
    .be-card.tpl-jinshu .be-source .title::before { content: '／ '; }
    .be-card.tpl-jinshu .be-divider {
      height: 1px; background: currentColor; opacity: 0.2;
      margin: 16px 0 10px;
    }
    .be-card.tpl-jinshu .be-foot { font-size: 11px; letter-spacing: 0.06em; opacity: 0.7; }

    /* ----- 日历 ----- */
    .be-card.tpl-calendar .be-head {
      text-align: center; margin: 6px 0 26px;
    }
    .be-card.tpl-calendar .be-cal-day {
      font-size: 62px; font-weight: 700;
      line-height: 1; letter-spacing: -0.02em;
      font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
    }
    .be-card.tpl-calendar .be-cal-monyr {
      font-size: 17px; letter-spacing: 0.2em;
      margin-top: 8px;
      font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
      font-weight: 600;
    }
    .be-card.tpl-calendar .be-cal-weekday { font-size: 12px; opacity: 0.72; margin-top: 6px; letter-spacing: 0.15em; }
    .be-card.tpl-calendar .be-cal-line {
      width: 36px; height: 1px; background: currentColor; opacity: 0.35;
      margin: 14px auto 0;
    }
    .be-card.tpl-calendar .be-quote { flex: 1; margin: 26px 0 22px; }
    .be-card.tpl-calendar .be-source { text-align: center; font-size: 13px; line-height: 1.9; letter-spacing: 0.08em; }
    .be-card.tpl-calendar .be-source .title { font-size: 14px; }
    .be-card.tpl-calendar .be-source .author { opacity: 0.7; margin-top: 2px; }
    .be-card.tpl-calendar .be-watermark { text-align: center; margin-top: 24px; }

    /* ===== modal 底部抽屉（仿微信阅读：主题/字体/背景，实时预览） ===== */
    #be-drawer {
      position: absolute; left: 0; right: 0; bottom: 0;
      background: var(--be-panel-bg);
      color: var(--be-panel-fg);
      border-top-left-radius: 14px;
      border-top-right-radius: 14px;
      box-shadow: 0 -8px 24px rgba(0,0,0,0.4);
      transform: translateY(100%);
      transition: transform 0.22s ease-out;
      z-index: 2147483635;
      max-height: 80dvh; overflow-y: auto;
      padding: 8px 16px 16px;
      box-sizing: border-box;
      font-family: var(--mainFontFamily, sans-serif);
      display: none;
    }
    #be-drawer.show { display: block; }
    #be-drawer.in { transform: translateY(0); }
    #be-drawer .be-drawer-handle {
      width: 36px; height: 4px; border-radius: 2px;
      background: var(--be-panel-divider);
      margin: 4px auto 12px;
    }
    #be-drawer .be-sec { margin-bottom: 14px; }
    #be-drawer .be-sec h4 {
      font-size: 11px; letter-spacing: 0.22em;
      margin: 0 0 8px; font-weight: normal;
      color: var(--be-panel-sub); opacity: 0.85;
    }
    #be-drawer .be-drawer-row {
      display: flex; gap: 8px; flex-wrap: nowrap;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    #be-drawer .be-drawer-row::-webkit-scrollbar { height: 4px; }
    #be-drawer .be-drawer-row::-webkit-scrollbar-thumb { background: var(--be-panel-scroll); border-radius: 2px; }
    #be-drawer .be-drawer-chip {
      flex: 0 0 auto;
      padding: 10px 18px; border-radius: 8px;
      background: var(--be-panel-row-bg);
      color: var(--be-panel-fg);
      font-size: 13px; cursor: pointer;
      border: 2px solid transparent;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }
    #be-drawer .be-drawer-chip.active {
      border-color: var(--be-accent);
      color: var(--be-accent);
    }
    /* 字号/行距/宽度实时调节（A——A / 紧——松 / 窄——宽），抽屉与独立浮层共用 */
    #be-typo-sheet {
      position: absolute; left: 0; right: 0; bottom: 0;
      background: var(--be-panel-bg);
      color: var(--be-panel-fg);
      border-top-left-radius: 14px;
      border-top-right-radius: 14px;
      box-shadow: 0 -8px 24px rgba(0,0,0,0.4);
      transform: translateY(100%);
      transition: transform 0.22s ease-out;
      z-index: 2147483636;
      padding: 8px 16px 16px;
      box-sizing: border-box;
      font-family: var(--mainFontFamily, sans-serif);
      display: none;
    }
    #be-typo-sheet.show { display: block; }
    #be-typo-sheet.in { transform: translateY(0); }
    #be-typo-sheet .be-drawer-handle {
      width: 36px; height: 4px; border-radius: 2px;
      background: var(--be-panel-divider);
      margin: 4px auto 12px;
    }
    #be-typo-sheet .be-sec { margin-bottom: 6px; }
    #be-typo-sheet .be-sec h4 {
      font-size: 11px; letter-spacing: 0.22em;
      margin: 0 0 10px; font-weight: normal;
      color: var(--be-panel-sub); opacity: 0.85;
    }
    #be-typo-sheet .be-drawer-confirm {
      margin-top: 12px;
      width: 100%; padding: 10px;
      background: transparent; border: none;
      color: var(--be-panel-fg);
      font-size: 14px; cursor: pointer;
      border-top: 1px solid var(--be-panel-divider);
    }
    #be-drawer .be-drawer-typo,
    #be-typo-sheet .be-drawer-typo {
      display: flex; align-items: center; gap: 12px;
      padding: 6px 2px;
    }
    #be-drawer .be-drawer-typo + .be-drawer-typo,
    #be-typo-sheet .be-drawer-typo + .be-drawer-typo { margin-top: 2px; }
    #be-drawer .be-drawer-typo input[type=range],
    #be-typo-sheet .be-drawer-typo input[type=range] { flex: 1; min-width: 0; }
    #be-drawer .be-dt-ico,
    #be-typo-sheet .be-dt-ico {
      flex: 0 0 auto; min-width: 18px; text-align: center;
      opacity: 0.7; color: var(--be-panel-sub);
    }
    #be-drawer .be-dt-val,
    #be-typo-sheet .be-dt-val {
      flex: 0 0 auto; min-width: 40px; text-align: right;
      font-size: 11px; opacity: 0.6; letter-spacing: normal;
    }
    #be-drawer .be-drawer-confirm {
      margin-top: 14px;
      width: 100%; padding: 10px;
      background: transparent; border: none;
      color: var(--be-panel-fg);
      font-size: 14px;
      cursor: pointer;
      border-top: 1px solid var(--be-panel-divider);
    }

    /* 操作按钮（在黑遮罩上，固定深底浅字，不跟主题） */
    #be-actions {
      flex: 0 0 auto;
      display: flex; gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }
    #be-actions .be-btn {
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.32);
      color: #fff;
    }
    #be-actions .be-btn:hover { background: rgba(255,255,255,0.28); }
    #be-actions .be-btn.primary {
      background: var(--be-accent); color: #1a1a1a; border-color: var(--be-accent);
    }
    #be-actions .be-btn.primary:hover { filter: brightness(1.08); background: var(--be-accent); }
    .be-btn {
      background: var(--be-btn-bg);
      border: none;
      color: var(--be-btn-fg); padding: 8px 16px; font-size: 13px;
      border-radius: 20px; cursor: pointer;
      font-family: inherit; letter-spacing: 0.05em;
      transition: all 0.18s ease;
      -webkit-tap-highlight-color: transparent;
      white-space: nowrap;
    }
    .be-btn:hover { background: var(--be-btn-bg-hover); transform: translateY(-1px); }
    .be-btn:active { transform: translateY(0); }
    .be-btn.primary {
      background: var(--be-accent); color: #1a1a1a;
      font-weight: 500;
    }
    .be-btn.primary:hover { filter: brightness(1.08); }
    .be-btn.danger { color: #ff9b9b; }
    .be-btn.danger:hover { background: rgba(255,80,80,0.12); }

    /* ===== 设置/笔记本面板 ===== */
    #be-panel {
      position: absolute; top: 5dvh; right: 3vw;
      width: min(440px, 94vw); max-height: 88dvh;
      background: var(--be-panel-bg);
      color: var(--be-panel-fg);
      backdrop-filter: blur(24px) saturate(1.4);
      -webkit-backdrop-filter: blur(24px) saturate(1.4);
      border: 1px solid var(--be-panel-border);
      border-radius: 22px;
      font-family: inherit;
      box-shadow: 0 24px 64px rgba(0,0,0,0.3);
      z-index: 2147483620; display: none; flex-direction: column;
      overflow: hidden;
    }
    #be-panel.open { display: flex; }

    #be-panel .be-p-head {
      display: flex; align-items: center; padding: 18px 18px 10px; gap: 8px;
    }
    #be-panel .be-p-title {
      flex: 1; font-size: 17px; font-weight: 600;
      letter-spacing: 0.02em; color: var(--be-panel-fg);
    }
    #be-panel .be-p-back {
      background: transparent; border: none; color: inherit;
      cursor: pointer; opacity: 0.55; font-size: 22px;
      padding: 0 4px; line-height: 1;
      transition: opacity 0.15s;
    }
    #be-panel .be-p-back:hover { opacity: 1; }

    /* pill tabs */
    #be-panel .be-p-tabs {
      display: flex; gap: 6px;
      padding: 0 16px 14px;
    }
    #be-panel .be-p-tabs button {
      flex: 1; background: var(--be-panel-row-bg); border: none;
      color: var(--be-panel-sub);
      padding: 9px; font-size: 13px; cursor: pointer;
      letter-spacing: 0.06em;
      border-radius: 12px;
      font-family: inherit;
      transition: all 0.2s ease;
    }
    #be-panel .be-p-tabs button.active {
      background: var(--be-accent-soft);
      color: var(--be-accent);
      font-weight: 500;
    }

    #be-panel .be-p-body {
      padding: 2px 18px 24px;
      overflow-y: auto; flex: 1; color: var(--be-panel-fg);
    }
    @keyframes be-body-in { from { opacity: 0; } to { opacity: 1; } }
    .be-body-anim { animation: be-body-in 0.18s ease; }
    #be-panel .be-p-body::-webkit-scrollbar { width: 3px; }
    #be-panel .be-p-body::-webkit-scrollbar-thumb {
      background: var(--be-panel-scroll); border-radius: 2px;
    }

    .be-sec { margin-bottom: 24px; }
    .be-sec h4 {
      font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase;
      opacity: 0.4; margin: 0 0 12px; font-weight: 600;
      color: var(--be-panel-sub);
    }
    .be-row {
      display: flex; align-items: center; gap: 10px;
      min-height: 42px; font-size: 13px; color: var(--be-panel-fg);
    }
    .be-row > label:first-child { flex: 1; cursor: pointer; color: inherit; }
    .be-row input[type=color] {
      width: 32px; height: 28px; padding: 2px;
      border: none; background: transparent;
      border-radius: 8px; cursor: pointer;
    }

    /* Toggle switch */
    .be-toggle {
      position: relative;
      display: inline-flex;
      width: 46px; height: 26px;
      flex: 0 0 auto;
    }
    .be-toggle input { opacity: 0; position: absolute; width: 0; height: 0; }
    .be-slider {
      position: absolute; inset: 0;
      background: var(--be-panel-row-bg-hover);
      border-radius: 26px; cursor: pointer;
      transition: background 0.22s ease;
    }
    .be-slider::before {
      content: '';
      position: absolute;
      width: 20px; height: 20px;
      left: 3px; top: 3px;
      background: #fff;
      border-radius: 50%;
      box-shadow: 0 1px 5px rgba(0,0,0,0.22);
      transition: transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1);
    }
    .be-toggle input:checked + .be-slider { background: var(--be-accent); }
    .be-toggle input:checked + .be-slider::before { transform: translateX(20px); }

    /* Radio pill group */
    .be-radio-group {
      display: flex; gap: 3px;
      background: var(--be-panel-row-bg);
      border-radius: 12px; padding: 3px;
    }
    .be-radio-opt {
      flex: 1; background: transparent; border: none;
      color: var(--be-panel-sub);
      padding: 5px 12px; font-size: 12px;
      cursor: pointer; border-radius: 9px;
      font-family: inherit;
      transition: all 0.18s ease;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .be-radio-opt.active {
      background: var(--be-panel-bg);
      color: var(--be-panel-fg);
      font-weight: 500;
      box-shadow: 0 1px 4px rgba(0,0,0,0.12);
    }

    /* 设置面板里的自定义头像预览 */
    .be-avatar-preview {
      width: 44px; height: 44px; border-radius: 50%;
      background-size: cover; background-position: center;
      background-color: var(--be-panel-input-bg);
      border: 1px solid var(--be-panel-input-border);
      flex: 0 0 auto;
    }
    .be-avatar-preview.empty::after {
      content: '?';
      display: flex; align-items: center; justify-content: center;
      width: 100%; height: 100%;
      font-size: 18px; opacity: 0.4;
    }
    /* 字号/行距数值显示 */
    .be-row .be-val {
      font-size: 11px; opacity: 0.7;
      margin-left: 4px;
      letter-spacing: normal;
    }
    .be-row input[type=range] {
      flex: 1.2; max-width: 160px;
    }
    /* 排版预设：小字（不再是大按钮） */
    .be-typo-presets {
      display: flex; gap: 16px;
      margin: -4px 0 6px;
      font-size: 11px; letter-spacing: 0.1em;
    }
    .be-typo-presets span {
      cursor: pointer; opacity: 0.5;
      color: var(--be-panel-sub);
      transition: opacity 0.15s ease, color 0.15s ease;
    }
    .be-typo-presets span:hover { opacity: 0.95; color: var(--be-accent); }
    /* 竖排标签修复：标题在上、输入框整行在下 */
    .be-row.be-row-stack {
      flex-direction: column; align-items: stretch; gap: 6px;
      min-height: 0; padding: 6px 0;
    }
    .be-row.be-row-stack > label:first-child {
      flex: 0 0 auto; cursor: default;
      font-size: 12px; opacity: 0.85;
    }

    /* 模板/字体/色系卡片通用 */
    .be-tpl-grid {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .be-tpl-card {
      padding: 16px 6px;
      border-radius: 14px;
      border: 1.5px solid transparent;
      cursor: pointer; font-size: 12px;
      letter-spacing: 0.06em; text-align: center;
      background: var(--be-panel-row-bg);
      color: var(--be-panel-fg);
      transition: all 0.16s ease;
    }
    .be-tpl-card:hover { background: var(--be-panel-row-bg-hover); }
    .be-tpl-card.active {
      border-color: var(--be-accent);
      background: var(--be-accent-soft);
      color: var(--be-accent);
    }
    .be-tpl-card.be-tpl-import {
      background: transparent;
      border: 1.5px dashed var(--be-panel-input-border);
      color: var(--be-panel-sub); font-size: 11px;
    }
    .be-tpl-card.be-tpl-import:hover { border-color: var(--be-accent); color: var(--be-accent); }

    .be-tpl-group { margin-top: 10px; }
    .be-tpl-group-head {
      display: flex; align-items: center; gap: 6px;
      cursor: pointer; font-size: 12px; opacity: 0.6;
      padding: 6px 0; letter-spacing: 0.06em;
      color: var(--be-panel-sub); user-select: none;
    }
    .be-tpl-group-head .be-caret {
      display: inline-block; width: 0; height: 0;
      border-left: 4px solid currentColor;
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
      transition: transform 0.15s;
    }
    .be-tpl-group.open .be-caret { transform: rotate(90deg); }
    .be-tpl-group-body { display: none; padding-top: 6px; }
    .be-tpl-group.open .be-tpl-group-body { display: block; }
    .be-about-sec { margin-bottom: 12px; }
    .be-about-sec:last-child { margin-bottom: 0; }
    .be-about-h {
      font-size: 12px; font-weight: 600;
      color: var(--be-panel-fg); margin-bottom: 3px;
    }
    .be-about-p {
      font-size: 11.5px; line-height: 1.7; opacity: 0.75;
      color: var(--be-panel-sub);
    }
    .be-about-author {
      margin-top: 14px; padding-top: 10px;
      border-top: 1px solid var(--be-panel-divider);
      font-size: 11px; opacity: 0.55;
      color: var(--be-panel-sub); letter-spacing: 0.04em;
    }
    .be-tpl-custom-row {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 10px; border-radius: 12px;
      background: var(--be-panel-row-bg);
      margin-bottom: 6px; cursor: pointer;
      transition: background 0.15s;
    }
    .be-tpl-custom-row:hover, .be-font-custom-row:hover { background: var(--be-panel-row-bg-hover); }
    .be-tpl-custom-row.active, .be-font-custom-row.active { background: var(--be-accent-soft); }
    .be-tpl-custom-row .be-tpl-custom-name, .be-font-custom-row .be-tpl-custom-name { flex: 1; font-size: 13px; }
    .be-tpl-custom-row button, .be-font-custom-row button {
      background: transparent; border: none;
      color: var(--be-panel-sub); cursor: pointer;
      padding: 2px 6px; font-size: 12px; opacity: 0.6;
    }
    .be-tpl-custom-row button:hover, .be-font-custom-row button:hover { opacity: 1; color: #ff9b9b; }
    .be-font-custom-row {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 10px; border-radius: 12px;
      background: var(--be-panel-row-bg);
      margin-bottom: 6px; cursor: pointer;
      transition: background 0.15s;
    }

    .be-font-grid {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .be-font-card {
      padding: 10px 6px;
      background: var(--be-panel-row-bg);
      border-radius: 14px;
      border: 1.5px solid transparent;
      cursor: pointer; font-size: 13px;
      text-align: center;
      transition: all 0.16s ease;
      color: var(--be-panel-fg);
    }
    .be-font-card:hover { background: var(--be-panel-row-bg-hover); }
    .be-font-card.active {
      border-color: var(--be-accent);
      background: var(--be-accent-soft);
      color: var(--be-accent);
    }

    .be-palette-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .be-palette-card {
      padding: 10px;
      background: var(--be-panel-row-bg);
      border-radius: 14px;
      border: 1.5px solid transparent;
      cursor: pointer;
      transition: all 0.16s ease;
    }
    .be-palette-card:hover { background: var(--be-panel-row-bg-hover); }
    .be-palette-card.active { border-color: var(--be-accent); background: var(--be-accent-soft); }
    .be-palette-name { font-size: 12px; color: var(--be-panel-fg); margin-bottom: 6px; letter-spacing: 0.05em; }
    .be-palette-row { display: flex; gap: 4px; }
    .be-palette-dot { width: 16px; height: 16px; border-radius: 50%; display: inline-block; }

    .be-color-grid {
      display: grid; grid-template-columns: repeat(5, 1fr);
      gap: 8px; padding: 2px;
    }
    .be-color-dot {
      width: 100%; aspect-ratio: 1 / 1;
      max-width: 52px; justify-self: center;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 16px; font-weight: 600;
      border: 2px solid transparent;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.07) inset;
      transition: transform 0.14s;
      user-select: none;
    }
    .be-color-dot:hover { transform: scale(1.08); }
    .be-color-dot.active { border-color: var(--be-accent); }
    .be-color-dot.rainbow {
      background: conic-gradient(
        hsl(0,100%,50%), hsl(30,100%,50%), hsl(60,100%,50%),
        hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%),
        hsl(300,100%,50%), hsl(360,100%,50%)
      );
      -webkit-mask: radial-gradient(circle, transparent 36%, #000 37%);
      mask: radial-gradient(circle, transparent 36%, #000 37%);
      border: none !important;
      box-shadow: none;
      color: transparent;
    }
    .be-color-dot.rainbow.active {
      outline: 2px solid var(--be-accent);
      outline-offset: 2px;
    }

    #be-panel select, #be-panel input[type=text] {
      background: var(--be-panel-input-bg);
      border: 1px solid var(--be-panel-input-border);
      color: var(--be-panel-fg);
      padding: 7px 10px; border-radius: 12px; font-size: 13px;
      font-family: inherit;
    }
    #be-panel input[type=text] { flex: 1; }
    #be-panel input[type=text]::placeholder { color: var(--be-panel-placeholder); }

    /* ===== 笔记本 ===== */
    .be-search {
      display: flex; gap: 6px; margin-bottom: 12px;
    }
    .be-search input { flex: 1; }
    .be-empty {
      text-align: center; padding: 40px 16px; opacity: 0.7;
      font-size: 13px; letter-spacing: 0.1em;
      color: var(--be-panel-empty-fg);
    }
    .be-char-card {
      display: flex; gap: 12px; padding: 12px;
      background: var(--be-panel-row-bg);
      border-radius: 8px; margin-bottom: 10px;
      cursor: pointer; transition: background 0.15s;
      align-items: center;
    }
    .be-char-card:hover { background: var(--be-panel-row-bg-hover); }
    .be-char-card .be-char-avatar {
      width: 48px; height: 48px; border-radius: 6px;
      background-size: cover; background-position: center;
      background-color: var(--be-panel-row-bg);
      flex: 0 0 auto;
    }
    .be-char-card .be-char-info { flex: 1; min-width: 0; }
    .be-char-card .be-char-count { font-size: 11px; opacity: 0.75; letter-spacing: 0.08em; color: var(--be-panel-sub); }
    .be-char-card .be-char-count .num { font-size: 16px; color: var(--be-accent); margin-right: 4px; }
    .be-char-card .be-char-name {
      font-size: 14px; letter-spacing: 0.05em;
      margin-top: 2px; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
      color: var(--be-panel-fg);
    }
    .be-char-card .be-char-meta { font-size: 11px; opacity: 0.65; margin-top: 2px; color: var(--be-panel-sub); }

    /* ===== 角色笔记面板（仿微信阅读） ===== */
    .be-char-head {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 4px;
    }
    .be-char-title {
      flex: 1; font-size: 17px; font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--be-panel-fg);
    }
    .be-filter-btn {
      background: transparent;
      border: 1px solid var(--be-panel-input-border);
      border-radius: 14px;
      padding: 4px 12px;
      color: var(--be-panel-sub);
      font-size: 12px; cursor: pointer;
      font-family: inherit;
    }
    .be-filter-btn:hover { color: var(--be-accent); border-color: var(--be-accent); }
    .be-filter-btn.active { color: var(--be-accent); border-color: var(--be-accent); }
    .be-char-stats {
      font-size: 12px; opacity: 0.7;
      color: var(--be-panel-sub);
      margin-bottom: 14px; letter-spacing: 0.04em;
    }
    .be-group-title {
      font-size: 14px; font-weight: 600;
      margin: 18px 0 8px; padding-left: 2px;
      color: var(--be-panel-fg);
      letter-spacing: 0.04em;
    }
    .be-group-title:first-child { margin-top: 4px; }
    .be-note-card {
      display: flex; gap: 12px;
      background: var(--be-panel-row-bg);
      border-radius: 12px;
      padding: 14px 14px;
      margin-bottom: 10px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .be-note-card:hover { background: var(--be-panel-row-bg-hover); }
    .be-note-icon {
      flex: 0 0 auto;
      width: 22px; height: 22px;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px;
      color: var(--be-panel-sub);
    }
    .be-note-icon.is-line { color: var(--be-accent); }
    .be-note-icon.is-thought { color: var(--be-marker); }
    .be-note-icon .be-icon-A {
      font-size: 14px; font-weight: 700;
      font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
      line-height: 1;
    }
    .be-note-icon .be-fa-comment { font-size: 13px; }

    .be-note-foot {
      display: flex; align-items: center; gap: 8px;
      margin-top: 8px;
      font-size: 11px;
      color: var(--be-panel-sub);
    }
    .be-note-time { flex: 1; opacity: 0.65; letter-spacing: 0.02em; }
    .be-note-share {
      background: transparent; border: none;
      color: var(--be-panel-sub);
      cursor: pointer; padding: 2px 8px;
      font-size: 13px;
      opacity: 0.75;
      border-radius: 4px;
      transition: color 0.12s;
    }
    .be-note-share:hover { color: var(--be-accent); opacity: 1; }
    .be-note-body { flex: 1; min-width: 0; }
    .be-note-merged-tag {
      display: inline-block;
      font-size: 10px; letter-spacing: 0.05em;
      color: var(--be-accent);
      border: 1px solid var(--be-accent);
      border-radius: 8px;
      padding: 1px 7px;
      margin-bottom: 6px;
    }
    .be-note-thought-text {
      font-size: 14px; font-weight: 600;
      color: var(--be-panel-fg);
      margin-bottom: 6px; line-height: 1.5;
      word-break: break-word;
    }
    .be-note-quote {
      font-size: 13px; line-height: 1.6;
      color: var(--be-panel-fg);
      border-left: 3px solid var(--be-panel-divider);
      padding-left: 10px;
      word-break: break-word;
    }
    .be-note-quote.plain { border-left: none; padding-left: 0; }
    .be-note-more {
      font-size: 11px; opacity: 0.6;
      color: var(--be-panel-sub);
      margin-top: 6px;
    }

    /* ===== 筛选弹窗 ===== */
    .be-filter-mask {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100vh; height: 100dvh;
      z-index: 2147483641;
      background: rgba(0,0,0,0.4);
      display: none;
    }
    .be-filter-mask.open { display: block; }
    .be-filter-sheet {
      position: absolute; left: 0; right: 0; bottom: 0;
      background: var(--be-panel-bg);
      color: var(--be-panel-fg);
      border-top-left-radius: 18px;
      border-top-right-radius: 18px;
      padding: 6px 18px 20px;
      box-shadow: 0 -8px 24px rgba(0,0,0,0.4);
      font-family: var(--mainFontFamily, sans-serif);
    }
    .be-filter-handle {
      width: 40px; height: 4px;
      background: var(--be-panel-divider);
      border-radius: 2px;
      margin: 6px auto 14px;
    }
    .be-filter-h {
      text-align: center; font-size: 15px;
      font-weight: 600; margin-bottom: 18px;
      color: var(--be-panel-fg);
    }
    .be-filter-kinds {
      display: grid; grid-template-columns: repeat(2, 1fr);
      gap: 10px; margin-bottom: 18px;
    }
    .be-filter-kind {
      background: var(--be-panel-row-bg);
      border: 1.5px solid transparent;
      color: var(--be-panel-fg);
      border-radius: 10px;
      padding: 12px;
      font-size: 14px;
      cursor: pointer;
      font-family: inherit;
    }
    .be-filter-kind.active {
      border-color: var(--be-accent);
      color: var(--be-accent);
    }
    .be-filter-block {
      background: var(--be-panel-row-bg);
      border-radius: 12px;
      padding: 14px 14px;
      margin-bottom: 14px;
    }
    .be-filter-label {
      font-size: 12px; opacity: 0.7;
      color: var(--be-panel-sub);
      margin-bottom: 10px;
    }
    .be-filter-styles { display: flex; gap: 14px; }
    .be-fs-chip {
      width: 44px; height: 44px;
      border-radius: 50%;
      background: var(--be-panel-row-bg-hover);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      color: var(--be-panel-fg);
      border: 2px solid transparent;
    }
    .be-fs-chip.active { border-color: var(--be-accent); }
    .be-fs-icon {
      display: inline-flex; flex-direction: column;
      align-items: center; line-height: 1;
      font-size: 15px; font-weight: 600;
    }
    .be-fs-icon .line-solid {
      width: 14px; height: 2px;
      background: currentColor;
      margin-bottom: 2px;
    }
    .be-fs-icon .line-wavy {
      width: 14px; height: 4px;
      margin-bottom: 0;
      background:
        radial-gradient(circle at 2px 4px, transparent 2px, currentColor 2px, currentColor 3px, transparent 3px) 0 0 / 6px 4px repeat-x;
    }
    .be-fs-icon .line-marker {
      width: 14px; height: 4px;
      background: currentColor;
      opacity: 0.4;
      margin-bottom: 2px;
    }
    .be-filter-colors {
      display: flex; gap: 14px; flex-wrap: wrap;
    }
    .be-fc-dot {
      width: 32px; height: 32px;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid transparent;
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.85);
      font-size: 16px; line-height: 1;
    }
    .be-fc-dot.rainbow {
      background: conic-gradient(red, orange, yellow, green, cyan, blue, magenta, red);
      color: transparent;
    }
    .be-fc-dot.active { border-color: var(--be-accent); }
    .be-filter-actions {
      display: grid; grid-template-columns: 1fr 2fr;
      gap: 10px; margin-top: 4px;
    }
    .be-filter-reset, .be-filter-confirm {
      padding: 12px;
      border: none; border-radius: 10px;
      font-family: inherit; font-size: 14px;
      cursor: pointer;
    }
    .be-filter-reset {
      background: var(--be-panel-row-bg);
      color: var(--be-panel-fg);
    }
    .be-filter-confirm {
      background: var(--be-accent);
      color: #1a1a1a; font-weight: 500;
    }

    .be-filter-tabs { display: flex; gap: 4px; margin-bottom: 12px; }
    .be-filter-tabs button {
      flex: 1; background: var(--be-panel-row-bg);
      border: none; color: var(--be-panel-sub);
      padding: 6px; font-size: 12px;
      cursor: pointer; border-radius: 4px;
      font-family: inherit;
      letter-spacing: 0.08em;
    }
    .be-filter-tabs button.active {
      background: var(--be-accent-soft); color: var(--be-accent);
    }
    .be-note-item {
      padding: 12px;
      background: var(--be-panel-row-bg);
      border-radius: 6px; margin-bottom: 10px;
      border-left: 3px solid var(--be-accent);
    }
    .be-note-item.highlight { border-left-color: var(--be-accent); }
    .be-note-item.highlight.has-thought { border-left-color: var(--be-marker); }
    .be-note-text {
      font-size: 13px; line-height: 1.75;
      white-space: pre-wrap; word-break: break-word;
      color: var(--be-panel-fg);
    }
    .be-note-thought {
      font-size: 12px; opacity: 0.95;
      margin-top: 8px; padding-top: 8px;
      border-top: 1px dashed var(--be-panel-divider);
      line-height: 1.65;
      color: var(--be-accent);
    }
    .be-note-meta {
      display: flex; gap: 8px; align-items: center;
      font-size: 11px; opacity: 0.75;
      margin-top: 8px; letter-spacing: 0.06em;
      color: var(--be-panel-sub);
    }
    .be-note-actions {
      margin-left: auto; display: flex; gap: 4px;
    }
    .be-note-actions button {
      background: transparent; border: none; color: inherit;
      cursor: pointer; font-size: 11px;
      padding: 2px 6px; opacity: 0.7;
      font-family: inherit;
    }
    .be-note-actions button:hover { opacity: 1; color: var(--be-accent); }
  `;
  }

  // 把 hex 颜色转 rgba（用于半透明派生色）
  function hexA(hex, a) {
    if (!hex || typeof hex !== 'string') return `rgba(201,167,106,${a})`;
    let h = hex.trim();
    if (h.startsWith('#')) h = h.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6) return `rgba(201,167,106,${a})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some(v => isNaN(v))) return `rgba(201,167,106,${a})`;
    return `rgba(${r},${g},${b},${a})`;
  }

  function injectStyle() {
    let el = mainDoc.getElementById('be-style');
    if (!el) {
      el = mainDoc.createElement('style');
      el.id = 'be-style';
      mainDoc.head.appendChild(el);
    }
    el.textContent = buildStyle();
    injectCustomTemplateStyles();
    detectAndApplyTheme();
  }
  // 把所有自定义模板的 CSS 拼进单独的 <style>
  function injectCustomTemplateStyles() {
    let el = mainDoc.getElementById('be-custom-style');
    if (!el) {
      el = mainDoc.createElement('style');
      el.id = 'be-custom-style';
      mainDoc.head.appendChild(el);
    }
    const list = Array.isArray(settings.customTemplates) ? settings.customTemplates : [];
    el.textContent = list.map(t => `\n/* ${(t.name||'').replace(/\*\//g,'')} */\n${t.css || ''}`).join('\n');
  }
  // 主题色/划线色变了时调用一下，把变量重写
  function refreshStyle() {
    injectStyle();
  }

  // 根据 ST 主题背景亮度判断当前是日间/夜间，给 body 加上 .be-light-theme
  function detectAndApplyTheme() {
    try {
      const body = mainDoc.body;
      if (!body) return;
      const cs = mainWin.getComputedStyle(body);
      const bg = cs.backgroundColor || '';
      // 优先用 ST 主题变量
      const tint = cs.getPropertyValue('--SmartThemeBlurTintColor').trim() || bg;
      const lum = parseLuminance(tint) ?? parseLuminance(bg);
      if (lum == null) return;
      // 阈值：>0.55 视作浅色（日间）
      body.classList.toggle('be-light-theme', lum > 0.55);
    } catch (e) {}
  }
  function parseLuminance(color) {
    if (!color) return null;
    let m = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
    if (m) {
      const r = +m[1], g = +m[2], b = +m[3];
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }
    m = color.trim().match(/^#?([0-9a-f]{3,8})$/i);
    if (m) {
      let h = m[1];
      if (h.length === 3) h = h.split('').map(c => c + c).join('');
      if (h.length < 6) return null;
      const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }
    return null;
  }

  // ---------- 选区监听 ----------
  let lastText = '';
  let lastRichText = '';   // 与 lastText 同源、但用 \u0001…\u0002 标记出原文删除线段（仅书摘卡片渲染用；为空表示选区内没有删除线）
  let lastRange = null;
  let selDebounce = null;
  // 划线合并篮子：{ key, text, rich, source: 'sel'|'note', noteId? } 的内存数组，不落盘。
  // iframe 被酒馆助手重建（热更新/切聊天）会随实例一起清空，属于可接受的边界情况。
  let mergeBasket = [];
  // 删除线段哨兵字符（U+0001/U+0002，正常聊天文本不会出现）。只活在内存变量里，
  // 绝不写入笔记存储（存储一律用纯 text），也绝不进入最终 HTML（渲染时被替换/剥除）。
  const DEL_O = String.fromCharCode(1);
  const DEL_C = String.fromCharCode(2);
  const stripDelMarks = (s) => String(s || '').split(DEL_O).join('').split(DEL_C).join('');

  function isInsideChat(node) {
    if (!node) return false;
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return false;
    if (el.closest('#be-float-bar, #be-mask, #be-panel, #be-thought-mask')) return false;
    return !!el.closest('.mes_text, .mes_block, .mes');
  }

  // 取选区文本：直接在原 DOM 上按 range 边界遍历真实 text node 的 nodeValue。
  // 不用 sel.toString()（Firefox 含 ::before/::after 字符），也不用 range.cloneContents()
  // （Firefox 会把 <q>::before/::after 的伪元素 content 当真 text node 灌进 fragment）。
  // 真实 DOM 的 text node 永远不会包含伪元素 content，从源头绕开两个差异。
  // 返回 { text, rich }：text 为纯文本；rich 在原文删除线(del/s/strike)内的片段外
  // 包上 \u0001…\u0002 哨兵标记（每个 text node 单独成对，绝不跨换行），
  // 仅供书摘卡片按需渲染删除线效果；存进笔记的一律是纯 text，旧数据/还原匹配不受影响。
  function getRangeText(range) {
    const BLOCK = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'TR']);
    const startN = range.startContainer, startO = range.startOffset;
    const endN = range.endContainer, endO = range.endOffset;
    let out = '', rich = '';
    const sliceText = (node) => {
      let v = node.nodeValue || '';
      if (node === startN && node === endN) v = v.substring(startO, endO);
      else if (node === startN) v = v.substring(startO);
      else if (node === endN) v = v.substring(0, endO);
      return v;
    };
    const takeText = (node) => {
      const v = sliceText(node);
      if (!v) return;
      out += v;
      let struck = false;
      try { struck = !!(node.parentElement && node.parentElement.closest('del, s, strike')); } catch (e) {}
      rich += struck ? (DEL_O + v + DEL_C) : v;
    };
    const walk = (node) => {
      if (node.nodeType === 3) {
        if (range.intersectsNode(node)) takeText(node);
        return;
      }
      if (node.nodeType !== 1) return;
      if (!range.intersectsNode(node)) return;
      const tag = node.tagName;
      if (tag === 'BR') { out += '\n'; rich += '\n'; return; }
      for (const c of node.childNodes) walk(c);
      if (BLOCK.has(tag)) { out += '\n'; rich += '\n'; }
    };
    const root = range.commonAncestorContainer;
    if (root.nodeType === 3) takeText(root);
    else walk(root);
    const text = out.replace(/\n{2,}/g, '\n').trim();
    // 相邻标记对合并；没有删除线时 rich 置空（用真假值即可判断）
    rich = rich.replace(new RegExp(DEL_C + DEL_O, "g"), '').replace(/\n{2,}/g, '\n').trim();
    if (rich.indexOf(DEL_O) === -1) rich = '';
    return { text, rich };
  }

  function checkSelection() {
    const sel = mainWin.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { hideBar(); return; }
    let range;
    try { range = sel.getRangeAt(0); } catch { hideBar(); return; }
    if (!isInsideChat(range.startContainer) && !isInsideChat(range.endContainer)) {
      hideBar(); return;
    }
    const picked = getRangeText(range);
    const text = picked.text;
    if (!text || text.length < 1) { hideBar(); return; }
    lastText = text;
    lastRichText = picked.rich;
    lastRange = range.cloneRange();
    const rects = range.getClientRects();
    const rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    showBar(rect);
  }
  function scheduleCheck(delay = 80) {
    if (selDebounce) clearTimeout(selDebounce);
    selDebounce = setTimeout(checkSelection, delay);
  }

  // SVG 图标
  const ICONS = {
    underline: '<svg viewBox="0 0 24 24"><path d="M6 4v8a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>',
    thought:   '<svg viewBox="0 0 24 24"><path d="M12 20l-4 0a4 4 0 0 1-4-4l0-7a4 4 0 0 1 4-4l8 0a4 4 0 0 1 4 4l0 7a4 4 0 0 1-4 4l-2 0-2 3z"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="14" x2="13" y2="14"/></svg>',
    excerpt:   '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2l6 0a2 2 0 0 1 2 2l0 16-4-3-4 3 0-16z"/><path d="M14 8l4 0a2 2 0 0 1 2 2l0 11-4-3"/></svg>'
  };

  function ensureBar() {
    let bar = mainDoc.getElementById('be-float-bar');
    if (bar && !isStaleGen(bar)) return bar;
    if (bar) { try { bar.remove(); } catch (e) {} }   // 旧脚本实例残留：监听器已死，重建
    bar = stampGen(mainDoc.createElement('div'));
    bar.id = 'be-float-bar';
    bar.innerHTML = `
      <button class="be-fbtn" data-act="highlight" type="button">${ICONS.underline}<span>划线</span></button>
      <span class="be-fbtn-divider"></span>
      <button class="be-fbtn" data-act="thought" type="button">${ICONS.thought}<span>想法</span></button>
      <span class="be-fbtn-divider"></span>
      <button class="be-fbtn" data-act="excerpt" type="button">${ICONS.excerpt}<span>书摘</span></button>
    `;
    // 关键修复：触摸/鼠标按下时只阻止选区被清空，不阻止 click 默认行为
    // 让点击在 pointerup 上立刻派发（用 once 防重）
    const fireAction = (act) => {
      if (!lastText) return;
      // 已划线区域再次点击"划线"→ 删除该划线
      if (act === 'highlight') {
        const existingId = findHighlightIdInRange(lastRange);
        if (existingId) {
          const it = findNoteById(existingId);
          // 在「只想法」区域点划线 → 转为普通划线（保留想法）
          if (it && it.thoughtOnly) {
            updateNote(it.charKey, existingId, { thoughtOnly: false });
            mainDoc.querySelectorAll(`.be-highlight[data-be-id="${existingId}"]`).forEach(el => {
              el.classList.remove('thought-only');
            });
            toast('已添加划线', 'success');
          } else {
            // 普通划线区域 → 删除
            deleteHighlightById(existingId);
          }
          hideBar();
          try { mainWin.getSelection().removeAllRanges(); } catch (e) {}
          return;
        }
        const note = createHighlight(lastText, lastRange);
        if (note) toast('已划线', 'success');
      } else if (act === 'excerpt') {
        openExcerptModal(lastText);
      } else if (act === 'thought') {
        // 已在划线上 → 在该 note 上新增一条想法
        const existingId = findHighlightIdInRange(lastRange);
        if (existingId) {
          const it = findNoteById(existingId);
          if (it) {
            openThoughtEditor(existingId, it.text, null);
          } else {
            // 孤儿划线（记录已丢失）→ 不静默无反应，给用户兜底提示
            toast('该划线的记录已丢失（点击划线本身清除后重试）', 'error');
          }
        } else {
          // 新选区 → 创建一条「只想法」标记（虚线样式），再开编辑器写想法
          const note = createHighlight(lastText, lastRange, { thoughtOnly: true });
          if (note) openThoughtEditor(note.id, lastText, null);
        }
      }
      hideBar();
      try { mainWin.getSelection().removeAllRanges(); } catch (e) {}
    };
    // 阻止 pointerdown 在按钮内时清空选区（关键：不阻止下游的 click）
    bar.addEventListener('pointerdown', e => {
      // 阻止默认行为以保留选区，但允许 button 内的点击事件继续派发
      e.preventDefault();
    });
    bar.querySelectorAll('.be-fbtn').forEach(b => {
      const handler = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const act = b.getAttribute('data-act');
        // 一次响应即处理，避免 click/touchend 重复触发
        if (b._beBusy) return;
        b._beBusy = true;
        setTimeout(() => { b._beBusy = false; }, 300);
        fireAction(act);
      };
      // 同时绑 click 与 touchend：触屏直接 touchend 触发，鼠标走 click
      b.addEventListener('click', handler);
      b.addEventListener('touchend', handler, { passive: false });
    });
    mainDoc.body.appendChild(bar);
    return bar;
  }

  // 选区是否落在已有划线 span 内（返回 note id，否则 null）
  function findHighlightIdInRange(range) {
    if (!range) return null;
    try {
      const startEl = range.startContainer.nodeType === 1
        ? range.startContainer
        : range.startContainer.parentElement;
      const endEl = range.endContainer.nodeType === 1
        ? range.endContainer
        : range.endContainer.parentElement;
      const startSpan = startEl?.closest('.be-highlight');
      const endSpan = endEl?.closest('.be-highlight');
      // 同一条划线（包括跨段的多 span）
      if (startSpan && endSpan) {
        const sid = startSpan.getAttribute('data-be-id');
        const eid = endSpan.getAttribute('data-be-id');
        if (sid && sid === eid) return sid;
      }
    } catch (e) {}
    return null;
  }

  // 解除一条划线（可能由多个 span 组成）
  // 把 style 和 color 应用到一个 span（inline style）
  function applySpanColor(span, style, color) {
    // 清掉所有可能残留
    ['background', 'background-image', 'background-color', 'background-size',
     'background-repeat', 'background-position', 'border-bottom-color',
     'padding-bottom', '--be-line', '--be-line-soft'].forEach(p => {
      try { span.style.removeProperty(p); } catch (e) {}
    });
    if (!color) return;
    if (style === 'underline') {
      span.style.setProperty('--be-line', color);
    } else if (style === 'marker') {
      span.style.setProperty('--be-line-soft', hexA(color, 0.55));
    } else if (style === 'wavy') {
      // wavy 需要重设 SVG dataURI（颜色嵌在 SVG 里）
      span.style.setProperty('background-image', `url("${wavyDataUri(color)}")`, 'important');
    }
  }

  // 切换某条 note 的样式和颜色，立即应用到所有 spans，并存到 note
  function applyStyleAndColor(noteId, newStyle, newColor) {
    const note = findNoteById(noteId);
    if (!note) return;
    const spans = mainDoc.querySelectorAll(`.be-highlight[data-be-id="${noteId}"]`);
    spans.forEach(span => {
      // 切换 style-class
      span.classList.remove('style-underline', 'style-wavy', 'style-marker');
      span.classList.add(`style-${newStyle || 'underline'}`);
      applySpanColor(span, newStyle, newColor);
    });
    updateNote(note.charKey, noteId, { style: newStyle, color: newColor });
    // 记忆这次的选择，下次新建划线沿用（不污染用户在设置→默认样式 里设的值）
    settings.lastStyle = newStyle || '';
    settings.lastColor = newColor || '';
    saveSettings(settings);
  }

  function unwrapHighlightSpans(id) {
    const spans = mainDoc.querySelectorAll(`.be-highlight[data-be-id="${id}"]`);
    const parents = new Set();
    spans.forEach(span => {
      const parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
      parents.add(parent);
    });
    parents.forEach(p => { try { p.normalize(); } catch (e) {} });
  }

  // 删除指定 id 的划线（DOM 与存储）
  // 解耦：即使笔记记录已丢失（localStorage 写失败导致），只要 DOM 里还有 span，也要能清掉。
  function deleteHighlightById(id) {
    const note = findNoteById(id);
    const spans = mainDoc.querySelectorAll(`.be-highlight[data-be-id="${id}"]`);
    if (!note && !spans.length) return;
    if (note) removeNote(note.charKey, id);
    unwrapHighlightSpans(id);
    toast(note ? '已删除划线' : '已清除残留划线（记录已丢失）', 'success');
    if (mainDoc.getElementById('be-panel')?.classList.contains('open')) renderPanel();
  }

  function showBar(rect) {
    const bar = ensureBar();
    bar.classList.add('show');
    bar.classList.remove('arrow-bottom');
    bar.style.left = '-9999px';
    bar.style.top = '-9999px';
    // 同步读取尺寸：Firefox 在 display:none iframe 里不会触发 RAF，必须用同步 reflow 拿尺寸
    const bw = bar.offsetWidth || 160;
    const bh = bar.offsetHeight || 40;
    const vw = mainWin.innerWidth;
    const vh = mainWin.innerHeight;
    // 默认放选区下方，紧贴一些（距离 6px），箭头朝上指向文字
    let left = (rect.left + rect.right) / 2 - bw / 2;
    let top = rect.bottom + 6;
    let arrowBottom = false;
    // 如果下方放不下，放上方（箭头朝下）
    if (top + bh + 4 > vh) {
      top = rect.top - bh - 6;
      arrowBottom = true;
    }
    // 边界保护
    left = Math.max(8, Math.min(left, vw - bw - 8));
    const arrowLeft = (rect.left + rect.right) / 2 - left;
    bar.style.setProperty('--arrow-left', `${Math.max(16, Math.min(bw - 16, arrowLeft))}px`);
    if (top < 8) top = 8;
    bar.style.left = (left + (mainWin.scrollX || 0)) + 'px';
    bar.style.top = (top + (mainWin.scrollY || 0)) + 'px';
    if (arrowBottom) bar.classList.add('arrow-bottom');
  }

  function hideBar() {
    const bar = mainDoc.getElementById('be-float-bar');
    if (bar) bar.classList.remove('show');
  }

  // ---------- 划线合并篮子（settings.mergeEnabled 关时功能完全不触发）----------
  // 篮子本身不落盘：纯粹是"导出前临时拼接"，不产生新的持久化数据结构，
  // iframe 被酒馆助手重建（热更新/切聊天）会随实例一起清空，属于可接受的边界情况。
  function basketKeyFor(item) {
    return item.noteId ? ('note:' + item.noteId) : null;
  }
  function addToMergeBasket(item) {
    if (!item || !item.text) return;
    const key = basketKeyFor(item);
    if (key && mergeBasket.some(x => basketKeyFor(x) === key)) {
      toast('已在合并篮子里', 'info');
      return;
    }
    mergeBasket.push({
      key: key || ('sel' + Date.now() + Math.random().toString(36).slice(2, 6)),
      text: item.text,
      rich: item.rich || '',
      source: item.source || 'sel',
      noteId: item.noteId || ''
    });
    updateMergeBadge();
    toast(`已加入合并（${mergeBasket.length}）`, 'success');
  }
  function removeFromMergeBasket(key) {
    mergeBasket = mergeBasket.filter(x => x.key !== key);
    updateMergeBadge();
  }
  function clearMergeBasket() {
    mergeBasket = [];
    updateMergeBadge();
  }
  function isInMergeBasket(noteId) {
    return mergeBasket.some(x => x.noteId === noteId);
  }

  function ensureMergeBadge() {
    let badge = mainDoc.getElementById('be-merge-badge');
    if (badge && !isStaleGen(badge)) return badge;
    if (badge) { try { badge.remove(); } catch (e) {} }
    badge = stampGen(mainDoc.createElement('div'));
    badge.id = 'be-merge-badge';
    badge.innerHTML = `<span class="be-merge-badge-n">0</span>`;
    badge.addEventListener('click', openMergeSheet);
    mainDoc.body.appendChild(badge);
    return badge;
  }
  function updateMergeBadge() {
    const n = mergeBasket.length;
    if (!settings.mergeEnabled || n === 0) {
      mainDoc.getElementById('be-merge-badge')?.classList.remove('show');
      return;
    }
    const badge = ensureMergeBadge();
    const numEl = badge.querySelector('.be-merge-badge-n');
    if (numEl) numEl.textContent = String(n);
    badge.classList.add('show');
  }

  function openMergeSheet() {
    let mask = mainDoc.getElementById('be-merge-sheet');
    if (mask && isStaleGen(mask)) { try { mask.remove(); } catch (e) {} mask = null; }
    if (!mask) {
      mask = stampGen(mainDoc.createElement('div'));
      mask.id = 'be-merge-sheet';
      mask.className = 'be-merge-sheet-mask';
      mainDoc.body.appendChild(mask);
      mask.addEventListener('click', e => { if (e.target === mask) mask.classList.remove('open'); });
    } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    detectAndApplyTheme();
    renderMergeSheet(mask);
    mask.classList.add('open');
  }
  function renderMergeSheet(mask) {
    mask.innerHTML = `
      <div class="be-merge-box">
        <div class="be-src-title">合并篮子（${mergeBasket.length}）</div>
        <div class="be-merge-list">
          ${mergeBasket.length ? mergeBasket.map(it => `
            <div class="be-merge-item" data-key="${escapeHtml(it.key)}">
              <div class="be-merge-item-text">${escapeHtml((it.text || '').slice(0, 60))}${it.text.length > 60 ? '…' : ''}</div>
              <button class="be-merge-item-del" data-key="${escapeHtml(it.key)}" title="移除">×</button>
            </div>
          `).join('') : `<div class="be-empty">篮子还是空的<br><span style="font-size:11px;">点已有划线上的"加入合并"，或在笔记本里勾选加入</span></div>`}
        </div>
        <div class="be-src-actions">
          <button class="be-btn" id="be-merge-clear" ${mergeBasket.length ? '' : 'disabled'}>清空</button>
          <button class="be-btn primary" id="be-merge-go" ${mergeBasket.length ? '' : 'disabled'}>合并（${mergeBasket.length}）</button>
        </div>
      </div>
    `;
    mask.querySelectorAll('.be-merge-item-del').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        removeFromMergeBasket(b.getAttribute('data-key'));
        renderMergeSheet(mask);
      });
    });
    mask.querySelector('#be-merge-clear')?.addEventListener('click', () => {
      clearMergeBasket();
      mask.classList.remove('open');
    });
    mask.querySelector('#be-merge-go')?.addEventListener('click', () => {
      mask.classList.remove('open');
      finalizeMergeFlow();
    });
  }

  // 合并收尾，两步问询，每步都能"记住"跳过：
  // 1) 存为笔记（进笔记本，不出图）还是生成书摘（直接开卡导出）—— settings.mergeDefaultTarget
  // 2) 原来那几条散乱划线要不要删掉 —— settings.mergeDeleteOriginal
  function finalizeMergeFlow() {
    if (mergeBasket.length < 1) return;
    const target = settings.mergeDefaultTarget;
    if (target === 'note' || target === 'card') {
      proceedToDeleteOriginalStep(target);
    } else {
      openMergeTargetChooser();
    }
  }
  function proceedToDeleteOriginalStep(target) {
    const pref = settings.mergeDeleteOriginal;
    if (pref === 'delete' || pref === 'keep') {
      runMergeTarget(target, pref === 'delete');
    } else {
      openMergeDeleteChooser(target);
    }
  }
  // 真正执行合并：读一份篮子快照，先做目标动作（存笔记/开书摘卡），
  // 再按 deleteOriginal 决定要不要把原来那几条划线删掉——顺序上"先产出、再清理"，避免清理动作影响到还没读完的数据。
  function runMergeTarget(target, deleteOriginal) {
    if (mergeBasket.length < 1) return;
    const items = mergeBasket.slice();
    const mergedText = items.map(x => x.text).join('\n\n');
    const mergedRich = items.map(x => x.rich || x.text).join('\n\n');
    const count = items.length;
    clearMergeBasket();
    mainDoc.getElementById('be-merge-sheet')?.classList.remove('open');
    mainDoc.getElementById('be-merge-target-mask')?.classList.remove('open');
    if (target === 'note') {
      addNote({ type: 'highlight', text: mergedText, thoughts: [], merged: true, mergedCount: count, style: settings.lastStyle || settings.highlightStyle });
    } else {
      lastText = mergedText;
      openExcerptModal(mergedText, { richText: mergedRich, editable: true });
    }
    if (deleteOriginal) {
      items.forEach(it => {
        if (!it.noteId) return;
        const note = findNoteById(it.noteId);
        if (note) removeNote(note.charKey, it.noteId);
        unwrapHighlightSpans(it.noteId);
      });
    }
    const doneMsg = target === 'note' ? '已存为笔记' : '已生成书摘';
    toast(deleteOriginal ? `${doneMsg}，原有 ${count} 条划线已删除` : doneMsg, 'success');
    if (panelView === 'char') fillCharNotes();
  }
  function openMergeTargetChooser() {
    let mask = mainDoc.getElementById('be-merge-target-mask');
    if (mask && isStaleGen(mask)) { try { mask.remove(); } catch (e) {} mask = null; }
    if (!mask) {
      mask = stampGen(mainDoc.createElement('div'));
      mask.id = 'be-merge-target-mask';
      mask.className = 'be-merge-target-mask';
      mainDoc.body.appendChild(mask);
      mask.addEventListener('click', e => { if (e.target === mask) mask.classList.remove('open'); });
    } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    detectAndApplyTheme();
    mask.innerHTML = `
      <div class="be-merge-target-box">
        <div class="be-src-title">合并方式（共 ${mergeBasket.length} 条）</div>
        <div class="be-merge-target-opts">
          <button class="be-btn" id="be-merge-to-note">存为笔记</button>
          <button class="be-btn primary" id="be-merge-to-card">生成书摘</button>
        </div>
        <div class="be-merge-hint">可在设置中更改</div>
        <label class="be-merge-remember-row">
          <button type="button" class="be-merge-remember-dot" id="be-merge-remember-dot"></button>
          <span>记住这次选择，以后不再询问</span>
        </label>
      </div>
    `;
    const dot = mask.querySelector('#be-merge-remember-dot');
    dot.addEventListener('click', () => dot.classList.toggle('checked'));
    mask.querySelector('#be-merge-to-note').addEventListener('click', () => {
      if (dot.classList.contains('checked')) { settings.mergeDefaultTarget = 'note'; saveSettings(settings); }
      proceedToDeleteOriginalStep('note');
    });
    mask.querySelector('#be-merge-to-card').addEventListener('click', () => {
      if (dot.classList.contains('checked')) { settings.mergeDefaultTarget = 'card'; saveSettings(settings); }
      proceedToDeleteOriginalStep('card');
    });
    mask.classList.add('open');
  }
  function openMergeDeleteChooser(target) {
    let mask = mainDoc.getElementById('be-merge-target-mask');
    if (mask && isStaleGen(mask)) { try { mask.remove(); } catch (e) {} mask = null; }
    if (!mask) {
      mask = stampGen(mainDoc.createElement('div'));
      mask.id = 'be-merge-target-mask';
      mask.className = 'be-merge-target-mask';
      mainDoc.body.appendChild(mask);
      mask.addEventListener('click', e => { if (e.target === mask) mask.classList.remove('open'); });
    } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    detectAndApplyTheme();
    mask.innerHTML = `
      <div class="be-merge-target-box">
        <div class="be-src-title">是否保留原有划线？</div>
        <div class="be-merge-target-opts">
          <button class="be-btn primary" id="be-merge-keep-orig">保留原划线</button>
          <button class="be-btn danger" id="be-merge-del-orig">删除原划线</button>
        </div>
        <div class="be-merge-hint">可在设置中更改</div>
        <label class="be-merge-remember-row">
          <button type="button" class="be-merge-remember-dot" id="be-merge-del-remember-dot"></button>
          <span>记住这次选择，以后不再询问</span>
        </label>
      </div>
    `;
    const dot = mask.querySelector('#be-merge-del-remember-dot');
    dot.addEventListener('click', () => dot.classList.toggle('checked'));
    mask.querySelector('#be-merge-keep-orig').addEventListener('click', () => {
      if (dot.classList.contains('checked')) { settings.mergeDeleteOriginal = 'keep'; saveSettings(settings); }
      runMergeTarget(target, false);
    });
    mask.querySelector('#be-merge-del-orig').addEventListener('click', () => {
      if (dot.classList.contains('checked')) { settings.mergeDeleteOriginal = 'delete'; saveSettings(settings); }
      runMergeTarget(target, true);
    });
    mask.classList.add('open');
  }

  mainDoc.addEventListener('selectionchange', () => scheduleCheck(120));
  mainDoc.addEventListener('mouseup', () => scheduleCheck(30));
  mainDoc.addEventListener('touchend', () => scheduleCheck(120));
  mainWin.addEventListener('scroll', () => {
    if (lastRange) {
      try {
        const sel = mainWin.getSelection();
        if (sel && !sel.isCollapsed) {
          const rects = lastRange.getClientRects();
          const rect = rects.length ? rects[rects.length-1] : lastRange.getBoundingClientRect();
          showBar(rect);
          return;
        }
      } catch (e) {}
    }
    hideBar();
  }, true);

  // ---------- 划线 ----------
  function createHighlight(text, range, opts = {}) {
    if (!range) return null;
    const ctx = getContext();
    const msgEl = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement)?.closest('.mes');
    const msgId = msgEl?.getAttribute('mesid') || '';
    const thoughtOnly = !!opts.thoughtOnly;
    // 优先沿用上次实际使用的样式/颜色，没用过则回退到设置里的默认
    const useStyle = settings.lastStyle || settings.highlightStyle;
    const useColor = settings.lastColor || '';
    const note = addNote({
      type: 'highlight',
      text,
      thoughts: [],
      thoughtOnly,
      msgId,
      style: useStyle,
      color: useColor,
      stripStyle: settings.stripStyle
    });
    try {
      const spans = wrapRange(range, note.id, useStyle, settings.stripStyle, false, thoughtOnly, useColor);
      if (spans && spans.length > 1) {
        const segments = spans.map(s => s.textContent).filter(t => t && t.replace(/\s/g, ''));
        updateNote(ctx.charKey, note.id, { segments });
        note.segments = segments;
      }
    } catch (e) { console.warn('[BookExcerpt] wrap failed', e); }
    return note;
  }

  function wrapRange(range, id, style = 'underline', strip = true, hasThought = false, thoughtOnly = false, color = '') {
    const className = `be-highlight style-${style}${strip ? ' strip-style' : ''}${hasThought ? ' has-thought' : ''}${thoughtOnly ? ' thought-only' : ''}`;
    const attachHandlers = (span) => {
      span.className = className;
      span.setAttribute('data-be-id', id);
      stampGen(span);   // 实例标记：脚本重建后 restoreHighlights 据此识别死监听器并重绑
      applySpanColor(span, style, color);
      span.addEventListener('click', e => {
        e.stopPropagation();
        openHlBar(id, span);
      });
      return span;
    };

    // 单容器：可直接 surround（同一段落内）
    try {
      const span = attachHandlers(mainDoc.createElement('span'));
      range.surroundContents(span);
      return [span];
    } catch (e) {}

    // 跨段落 / 跨节点：逐 text-node 分段包裹，避免把 <p> 等块级元素塞进 inline <span>
    const spans = [];
    const startNode = range.startContainer;
    const startOffset = range.startOffset;
    const endNode = range.endContainer;
    const endOffset = range.endOffset;

    // 收集 range 内所有非空 text node
    const textNodes = [];
    const root = range.commonAncestorContainer;
    const walker = mainDoc.createTreeWalker(
      root.nodeType === 1 ? root : root.parentNode,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
          if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
          // 跳过已划线 span 里的（避免重复）
          if (node.parentElement && node.parentElement.closest('.be-highlight')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);

    for (const node of textNodes) {
      let from = 0;
      let to = node.nodeValue.length;
      if (node === startNode && startNode.nodeType === 3) from = startOffset;
      if (node === endNode && endNode.nodeType === 3) to = endOffset;
      if (to <= from) continue;
      // 跳过空白：保留含可见字符的段
      const seg = node.nodeValue.slice(from, to);
      if (!seg.replace(/\s/g, '')) continue;

      let target = node;
      // 切出 [from, to) 的子段
      if (from > 0) {
        target = target.splitText(from);
        to -= from;
      }
      if (to < target.nodeValue.length) {
        target.splitText(to);
      }
      const span = attachHandlers(mainDoc.createElement('span'));
      target.parentNode.insertBefore(span, target);
      span.appendChild(target);
      spans.push(span);
    }
    return spans;
  }

  function findNoteById(id) {
    const notes = loadNotes();
    for (const k of Object.keys(notes)) {
      const it = notes[k].items.find(x => x.id === id);
      if (it) return { ...it, charKey: k };
    }
    return null;
  }

  // 在 mes 中找到一段文字并包裹（用于还原单段划线）
  function wrapTextInMes(mes, target, it) {
    const walker = mainDoc.createTreeWalker(mes, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.parentElement && node.parentElement.closest('.be-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    const hasThought = (it.thoughts || []).length > 0 || !!(it.thought || '').trim();
    while ((node = walker.nextNode())) {
      const idx = node.nodeValue.indexOf(target);
      if (idx >= 0) {
        const range = mainDoc.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + target.length);
        wrapRange(range, it.id, it.style || 'underline', it.stripStyle !== false, hasThought, !!it.thoughtOnly, it.color || '');
        return true;
      }
    }
    return false;
  }

  // 重启时还原划线
  // 整体再包一层防御：任何异常（上下文取不到、数据异常等）都不允许炸穿到启动流程/事件回调，
  // 最坏情况是划线没还原，绝不能把酒馆搞挂
  function restoreHighlights() {
    try { restoreHighlightsInner(); }
    catch (e) { console.warn('[BookExcerpt] restoreHighlights failed:', e); }
  }
  function restoreHighlightsInner() {
    const ctx = getContext();
    const notes = loadNotes();
    const ch = notes[ctx.charKey];
    if (!ch) return;
    ch.items.filter(x => x.type === 'highlight').forEach(it => {
      try {
        if (!it.msgId) return;
        const mes = mainDoc.querySelector(`.mes[mesid="${it.msgId}"] .mes_text`);
        if (!mes) return;
        const existing = mes.querySelectorAll(`.be-highlight[data-be-id="${it.id}"]`);
        if (existing.length) {
          // span 已在，但可能是上一个脚本实例包的（监听器已死）：克隆剥掉旧监听、重绑新的
          existing.forEach(sp => {
            if (!isStaleGen(sp)) return;
            const clone = stampGen(sp.cloneNode(true));
            clone.addEventListener('click', e => {
              e.stopPropagation();
              openHlBar(it.id, clone);
            });
            try { sp.parentNode.replaceChild(clone, sp); } catch (e) {}
          });
          return;
        }
        // 多段：按 segments 依次匹配；缺则尝试按行拆分 text
        const segments = Array.isArray(it.segments) && it.segments.length
          ? it.segments
          : (it.text || '').split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
        if (segments.length > 1) {
          segments.forEach(seg => wrapTextInMes(mes, seg, it));
        } else {
          wrapTextInMes(mes, it.text, it);
        }
        // 应用 thought-only 视觉样式（虚线）
        if (it.thoughtOnly) {
          mes.querySelectorAll(`.be-highlight[data-be-id="${it.id}"]`).forEach(el => el.classList.add('thought-only'));
        }
        if ((it.thoughts || []).length || (it.thought || '').trim()) {
          mes.querySelectorAll(`.be-highlight[data-be-id="${it.id}"]`).forEach(el => el.classList.add('has-thought'));
        }
      } catch (e) {}
    });
  }

  // ---------- 想法编辑器 ----------
  function ensureThoughtMask() {
    let mask = mainDoc.getElementById('be-thought-mask');
    if (mask && !isStaleGen(mask)) return mask;
    if (mask) { try { mask.remove(); } catch (e) {} }   // 旧脚本实例残留：监听器已死，重建
    mask = stampGen(mainDoc.createElement('div'));
    mask.id = 'be-thought-mask';
    mask.innerHTML = `
      <div id="be-thought-box">
        <div class="be-thought-title">写下你的想法</div>
        <div class="be-thought-quote" id="be-thought-quote"></div>
        <textarea id="be-thought-ta" placeholder="此刻读到这里，你想到的是……"></textarea>
        <div class="be-thought-actions">
          <button class="be-btn danger" id="be-thought-del">删除划线</button>
          <button class="be-btn" id="be-thought-excerpt">做成书摘</button>
          <button class="be-btn" id="be-thought-cancel">取消</button>
          <button class="be-btn primary" id="be-thought-save">保存</button>
        </div>
      </div>
    `;
    mainDoc.body.appendChild(mask);
    mask.addEventListener('click', e => {
      if (e.target === mask) mask.classList.remove('open');
    });
    return mask;
  }

  // openThoughtEditor 新签名：(noteId, text, thoughtId | null)
  // thoughtId === null 表示新增一条；非空表示编辑指定一条
  function openThoughtEditor(noteId, text, thoughtId) {
    const mask = ensureThoughtMask();
    if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    detectAndApplyTheme();
    mask.querySelector('#be-thought-quote').textContent = text;

    const note = findNoteById(noteId);
    let current = '';
    if (thoughtId && note?.thoughts) {
      const t = note.thoughts.find(x => x.id === thoughtId);
      if (t) current = t.text || '';
    }

    const ta = mask.querySelector('#be-thought-ta');
    ta.value = current;
    // 单独想法编辑下：「删除划线」按钮改成「删除此想法」（仅当编辑已有想法时显示）
    const delBtn = mask.querySelector('#be-thought-del');
    if (thoughtId) {
      delBtn.textContent = '删除此想法';
      delBtn.style.display = '';
    } else {
      delBtn.style.display = 'none';
    }
    mask.classList.add('open');
    setTimeout(() => ta.focus(), 50);

    const closeIt = () => mask.classList.remove('open');
    const reNew = (sel, fn) => {
      const el = mask.querySelector(sel);
      const clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);
      clone.addEventListener('click', fn);
    };
    reNew('#be-thought-cancel', closeIt);
    reNew('#be-thought-excerpt', () => {
      const val = ta.value.trim();
      const note = findNoteById(noteId);
      const original = note?.text || text;
      closeIt();
      // 关闭其他遮罩，确保 modal 在最上
      mainDoc.getElementById('be-viewer-mask')?.classList.remove('open');
      lastText = original;
      openExcerptModal(original, { thoughtText: val });
    });
    reNew('#be-thought-save', () => {
      const ctx = getContext();
      const val = ta.value.trim();
      if (!val) {
        // 空 → 视为取消（编辑时也不创建/不更新）
        closeIt();
        return;
      }
      if (thoughtId) {
        updateThought(ctx.charKey, noteId, thoughtId, val);
        toast('想法已保存', 'success');
      } else {
        addThought(ctx.charKey, noteId, val);
        toast('已新增想法', 'success');
      }
      // 同步划线 span 的 has-thought 类
      const after = findNoteById(noteId);
      const hasAny = !!(after && after.thoughts && after.thoughts.length);
      mainDoc.querySelectorAll(`.be-highlight[data-be-id="${noteId}"]`).forEach(el => {
        el.classList.toggle('has-thought', hasAny);
      });
      closeIt();
      // 若 viewer 在打开，刷新内容
      if (mainDoc.getElementById('be-viewer-mask')?.classList.contains('open')) {
        renderHighlightViewer(noteId);
      }
      if (mainDoc.getElementById('be-panel')?.classList.contains('open')) renderPanel();
    });
    reNew('#be-thought-del', () => {
      if (!thoughtId) return;
      if (!mainWin.confirm('删除这条想法？')) return;
      const ctx = getContext();
      removeThought(ctx.charKey, noteId, thoughtId);
      const after = findNoteById(noteId);
      const hasAny = !!(after && after.thoughts && after.thoughts.length);
      mainDoc.querySelectorAll(`.be-highlight[data-be-id="${noteId}"]`).forEach(el => {
        el.classList.toggle('has-thought', hasAny);
      });
      toast('已删除想法', 'success');
      closeIt();
      if (mainDoc.getElementById('be-viewer-mask')?.classList.contains('open')) {
        renderHighlightViewer(noteId);
      }
      if (mainDoc.getElementById('be-panel')?.classList.contains('open')) renderPanel();
    });
  }

  // ----- 点击划线弹出的改样式工具栏 -----
  let _hlBarCloser = null;
  function openHlBar(noteId, anchorEl) {
    const note = findNoteById(noteId);
    if (!note) {
      // 笔记记录已丢失（多半是 localStorage 写失败），但 DOM 上的 span 还在 → 给条出路允许清掉
      const span = anchorEl || mainDoc.querySelector(`.be-highlight[data-be-id="${noteId}"]`);
      if (!span) return;
      if (mainWin.confirm('这条划线的笔记记录已丢失（可能是浏览器存储权限被禁用或已满）。\n要清除它吗？')) {
        deleteHighlightById(noteId);
      }
      return;
    }
    let bar = mainDoc.getElementById('be-hl-bar');
    if (!bar) {
      bar = mainDoc.createElement('div');
      bar.id = 'be-hl-bar';
      mainDoc.body.appendChild(bar);
    } else if (bar.parentNode !== mainDoc.body || bar.nextSibling) {
      mainDoc.body.appendChild(bar);
    }
    renderHlBar(bar, noteId);
    // 定位（贴近 anchorEl 下方；不够则上方）
    const anchor = anchorEl || mainDoc.querySelector(`.be-highlight[data-be-id="${noteId}"]`);
    const rect = anchor ? anchor.getBoundingClientRect() : { left: 100, top: 100, right: 200, bottom: 120 };
    bar.classList.add('show');
    bar.classList.remove('arrow-bottom');
    bar.style.left = '-9999px'; bar.style.top = '-9999px';
    // 同步读取尺寸：Firefox 在 display:none iframe 里不会触发 RAF
    const bw = bar.offsetWidth;
    const bh = bar.offsetHeight;
    const vw = mainWin.innerWidth;
    const vh = mainWin.innerHeight;
    let left = (rect.left + rect.right) / 2 - bw / 2;
    let top = rect.bottom + 8;
    let arrowBottom = false;
    if (top + bh + 4 > vh) {
      top = rect.top - bh - 8;
      arrowBottom = true;
    }
    left = Math.max(8, Math.min(left, vw - bw - 8));
    const arrowLeft = (rect.left + rect.right) / 2 - left;
    bar.style.setProperty('--arrow-left', `${Math.max(16, Math.min(bw - 16, arrowLeft))}px`);
    if (top < 8) top = 8;
    bar.style.left = left + 'px';
    bar.style.top = (top + (mainWin.scrollY || 0)) + 'px';
    if (arrowBottom) bar.classList.add('arrow-bottom');
    // 点击外部关闭
    if (_hlBarCloser) mainDoc.removeEventListener('pointerdown', _hlBarCloser, true);
    _hlBarCloser = (e) => {
      if (!bar.contains(e.target) && !e.target.closest('.be-highlight')) {
        closeHlBar();
      }
    };
    setTimeout(() => mainDoc.addEventListener('pointerdown', _hlBarCloser, true), 60);
  }
  function closeHlBar() {
    const bar = mainDoc.getElementById('be-hl-bar');
    if (bar) bar.classList.remove('show');
    if (_hlBarCloser) { mainDoc.removeEventListener('pointerdown', _hlBarCloser, true); _hlBarCloser = null; }
  }
  function renderHlBar(bar, noteId) {
    const note = findNoteById(noteId);
    if (!note) return;
    const curStyle = note.style || 'underline';
    const curColor = String(note.color || '').toLowerCase();
    const isThoughtOnly = !!note.thoughtOnly;
    const initialCustomColor = note.color || settings.underlineColor || '#c9a76a';
    bar.innerHTML = `
      <div class="be-hl-row1">
        <button data-act="copy">复制</button>
        ${isThoughtOnly
          ? `<button data-act="addline">划线</button>`
          : `<button data-act="del" class="danger">删除划线</button>`}
        <button data-act="thought">写想法</button>
        <button data-act="view">想法列表</button>
        <button data-act="excerpt">书摘</button>
        ${settings.mergeEnabled ? `<button data-act="merge" class="${isInMergeBasket(noteId) ? 'active' : ''}">${isInMergeBasket(noteId) ? '已加入合并' : '加入合并'}</button>` : ''}
      </div>
      <div class="be-hl-row2">
        <button class="be-hl-st ${curStyle==='underline'?'active':''}" data-st="underline" title="下划线"><span class="be-hl-sample sample-underline">A</span></button>
        <button class="be-hl-st ${curStyle==='wavy'?'active':''}" data-st="wavy" title="波浪线"><span class="be-hl-sample sample-wavy">A</span></button>
        <button class="be-hl-st ${curStyle==='marker'?'active':''}" data-st="marker" title="荧光笔"><span class="be-hl-sample sample-marker">A</span></button>
        <span class="be-hl-divider"></span>
        ${getPaletteColors().map(c => `<button class="be-hl-col ${curColor===c.toLowerCase()?'active':''}" data-col="${c}" style="background:${c};"></button>`).join('')}
        <span class="be-hl-col rainbow" title="自定义颜色">
          +
          <input type="color" class="be-hl-col-input" value="${escapeHtml(initialCustomColor)}">
        </span>
      </div>
    `;
    bar.querySelectorAll('.be-hl-row1 button').forEach(b => {
      b.addEventListener('click', () => {
        const act = b.getAttribute('data-act');
        const fresh = findNoteById(noteId);
        if (!fresh) return;
        if (act === 'copy') {
          try { mainWin.navigator.clipboard.writeText(fresh.text || ''); toast('已复制', 'success'); }
          catch (e) { toast('复制失败', 'error'); }
          closeHlBar();
        } else if (act === 'del') {
          if (mainWin.confirm('删除这条划线？')) { deleteHighlightById(noteId); closeHlBar(); }
        } else if (act === 'addline') {
          // 仅想法 → 转为带划线
          updateNote(fresh.charKey, noteId, { thoughtOnly: false });
          mainDoc.querySelectorAll(`.be-highlight[data-be-id="${noteId}"]`).forEach(el => {
            el.classList.remove('thought-only');
          });
          toast('已添加划线', 'success');
          renderHlBar(bar, noteId);
        } else if (act === 'thought') {
          closeHlBar();
          openThoughtEditor(noteId, fresh.text, null);
        } else if (act === 'view') {
          closeHlBar();
          openHighlightViewer(noteId);
        } else if (act === 'excerpt') {
          closeHlBar();
          lastText = fresh.text;
          openExcerptModal(fresh.text);
        } else if (act === 'merge') {
          // 不关闭工具条：允许连续点几条划线快速加入同一个篮子
          if (isInMergeBasket(noteId)) removeFromMergeBasket('note:' + noteId);
          else addToMergeBasket({ text: fresh.text, source: 'note', noteId });
          renderHlBar(bar, noteId);
        }
      });
    });
    bar.querySelectorAll('.be-hl-st').forEach(b => {
      b.addEventListener('click', () => {
        const st = b.getAttribute('data-st');
        const fresh = findNoteById(noteId);
        applyStyleAndColor(noteId, st, fresh?.color || '');
        renderHlBar(bar, noteId);
      });
    });
    bar.querySelectorAll('.be-hl-col[data-col]').forEach(b => {
      b.addEventListener('click', () => {
        const v = b.getAttribute('data-col');
        const fresh = findNoteById(noteId);
        applyStyleAndColor(noteId, fresh?.style || 'underline', v);
        renderHlBar(bar, noteId);
      });
    });
    // 自定义颜色：input 嵌入彩虹按钮，用户实际点击就是 input（不再走 .click()，避免兼容性问题）
    const customInput = bar.querySelector('.be-hl-col-input');
    if (customInput) {
      const onChange = () => {
        const fresh = findNoteById(noteId);
        applyStyleAndColor(noteId, fresh?.style || 'underline', customInput.value);
      };
      customInput.addEventListener('input', onChange);
      customInput.addEventListener('change', onChange);
      // 阻止外部 pointerdown 在 color picker 弹出过程中关闭 hl-bar
      customInput.addEventListener('pointerdown', e => e.stopPropagation());
      customInput.addEventListener('click', e => e.stopPropagation());
    }
  }

  // ----- 划线查看抽屉（点击划线弹出）-----
  function openHighlightViewer(noteId) {
    let mask = mainDoc.getElementById('be-viewer-mask');
    if (mask && isStaleGen(mask)) { try { mask.remove(); } catch (e) {} mask = null; }   // 旧脚本实例残留：重建
    if (!mask) {
      mask = stampGen(mainDoc.createElement('div'));
      mask.id = 'be-viewer-mask';
      mask.innerHTML = `<div id="be-viewer"></div>`;
      mainDoc.body.appendChild(mask);
      mask.addEventListener('click', e => {
        if (e.target === mask) mask.classList.remove('open');
      });
    } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    detectAndApplyTheme();
    renderHighlightViewer(noteId);
    mask.classList.add('open');
  }
  function renderHighlightViewer(noteId) {
    const mask = mainDoc.getElementById('be-viewer-mask');
    if (!mask) return;
    const note = findNoteById(noteId);
    if (!note) { mask.classList.remove('open'); return; }
    const viewer = mask.querySelector('#be-viewer');
    const thoughts = Array.isArray(note.thoughts) ? note.thoughts.slice().sort((a,b)=>(b.ts||0)-(a.ts||0)) : [];
    // 位置信息：存档名 + 楼层
    const _chatId = note.chatId || '';
    const _floor = (note.msgId !== undefined && note.msgId !== '') ? `第 ${parseInt(note.msgId) + 1} 楼` : '';
    const _locationParts = [_chatId, _floor].filter(Boolean);
    const _locationHtml = _locationParts.length
      ? `<div class="be-vw-location"><i class="fa-solid fa-location-dot" style="margin-right:5px;"></i>${escapeHtml(_locationParts.join(' · '))}</div>`
      : '';
    viewer.innerHTML = `
      <button class="be-vw-close" id="be-vw-close">×</button>
      <div class="be-vw-quote">${escapeHtml(note.text || '')}</div>
      ${_locationHtml}
      <div class="be-vw-actions">
        <button data-act="copy">复制</button>
        <button data-act="thought">写想法</button>
        <button data-act="excerpt">书摘</button>
        <button data-act="del" class="danger">${note.thoughtOnly ? '删除' : '删划线'}</button>
      </div>
      <div class="be-vw-thoughts">
        ${thoughts.length
          ? thoughts.map(t => `
              <div class="be-vw-thought" data-tid="${t.id}">
                <div class="be-vw-thought-text">${escapeHtml(t.text || '')}</div>
                <div class="be-vw-thought-foot">
                  <span class="be-vw-thought-meta">${formatDateTime(t.ts)}</span>
                  <button class="be-vw-thought-share" data-share-tid="${t.id}" title="把这条想法做成书摘"><i class="fa-solid fa-share-nodes"></i></button>
                </div>
              </div>
            `).join('')
          : `<div class="be-vw-empty">还没有想法 · 点击上方「写想法」新增一条</div>`}
      </div>
    `;
    viewer.querySelector('#be-vw-close').addEventListener('click', () => mask.classList.remove('open'));
    viewer.querySelectorAll('.be-vw-actions button').forEach(b => {
      b.addEventListener('click', () => {
        const act = b.getAttribute('data-act');
        if (act === 'copy') {
          try { mainWin.navigator.clipboard.writeText(note.text || ''); toast('已复制', 'success'); }
          catch (e) { toast('复制失败', 'error'); }
        } else if (act === 'thought') {
          openThoughtEditor(noteId, note.text, null);
        } else if (act === 'excerpt') {
          lastText = note.text;
          mask.classList.remove('open');
          openExcerptModal(note.text);
        } else if (act === 'del') {
          if (!mainWin.confirm('删除这条划线和它的所有想法？')) return;
          removeNote(note.charKey, noteId);
          unwrapHighlightSpans(noteId);
          mask.classList.remove('open');
          toast('已删除', 'success');
          if (mainDoc.getElementById('be-panel')?.classList.contains('open')) renderPanel();
        }
      });
    });
    viewer.querySelectorAll('.be-vw-thought').forEach(el => {
      el.addEventListener('click', e => {
        // 点分享按钮不要打开编辑器
        if (e.target.closest('.be-vw-thought-share')) return;
        const tid = el.getAttribute('data-tid');
        openThoughtEditor(noteId, note.text, tid);
      });
    });
    viewer.querySelectorAll('.be-vw-thought-share').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        const tid = b.getAttribute('data-share-tid');
        const t = (note.thoughts || []).find(x => x.id === tid);
        if (!t) return;
        mask.classList.remove('open');
        lastText = note.text;
        openExcerptModal(note.text, { thoughtText: t.text || '' });
      });
    });
  }

  // ---------- 书摘卡片 ----------
  // 编辑出处对话框（三字段：用户名、作者、书名 + 显示书名开关）
  function openSourceEditor() {
    let mask = mainDoc.getElementById('be-source-mask');
    // 非本脚本实例创建的弹窗（旧版本/旧 iframe 残留）一律拆掉重建。
    // v1.2.12 起用 data-be-gen 实例标记代替旧的 SCHEMA_PROBE 探针：改 schema 不再需要手动换探针，
    // 同时根治「脚本 iframe 重建后旧监听器静默失效」的整类问题。
    if (mask && isStaleGen(mask)) { try { mask.remove(); } catch (e) {} mask = null; }
    if (!mask) {
      mask = stampGen(mainDoc.createElement('div'));
      mask.id = 'be-source-mask';
      mask.innerHTML = `
        <div id="be-source-box">
          <div class="be-src-title">编辑出处</div>
          <div class="be-src-field">
            <label>头像类型</label>
            <div class="be-radio-group" id="be-src-avatar-type">
              <button type="button" class="be-radio-opt" data-v="user">用户</button>
              <button type="button" class="be-radio-opt" data-v="char">角色</button>
              <button type="button" class="be-radio-opt" data-v="custom">自定义</button>
            </div>
          </div>
          <div class="be-src-collapse" id="be-src-avatar-wrap">
            <div class="be-src-field be-src-avatar-field">
              <label>自定义头像</label>
              <div class="be-src-avatar-row">
                <div class="be-src-avatar-preview" id="be-src-avatar-preview"></div>
                <button class="be-btn" id="be-src-avatar-upload">上传图片</button>
                <button class="be-btn" id="be-src-avatar-clear">清除</button>
              </div>
            </div>
          </div>
          <div class="be-src-field">
            <label>用户名（留空使用 ${escapeHtml('{{user}}')}）</label>
            <input type="text" id="be-src-user" placeholder="">
          </div>
          <div class="be-src-field">
            <label>作者（留空使用 ${escapeHtml('{{char}}')}）</label>
            <input type="text" id="be-src-author" placeholder="">
          </div>
          <div class="be-src-row">
            <input type="checkbox" id="be-src-showtitle">
            <label for="be-src-showtitle">显示书名</label>
          </div>
          <div class="be-src-collapse" id="be-src-title-wrap">
            <div class="be-src-field">
              <label>书名 / 作品名</label>
              <input type="text" id="be-src-title" placeholder="书名将显示在卡片上">
            </div>
          </div>
          <div class="be-src-row">
            <input type="checkbox" id="be-src-showchapter">
            <label for="be-src-showchapter">显示章名</label>
          </div>
          <div class="be-src-collapse" id="be-src-chapter-wrap">
            <div class="be-src-field">
              <label>章名（部分模板会显示在书名/作者旁）</label>
              <input type="text" id="be-src-chapter" placeholder="章名将显示在卡片上">
            </div>
          </div>
          <div class="be-src-row">
            <input type="checkbox" id="be-src-showwm">
            <label for="be-src-showwm">显示水印</label>
          </div>
          <div class="be-src-collapse" id="be-src-wm-wrap">
            <div class="be-src-field">
              <label>水印文字</label>
              <input type="text" id="be-src-wmtext" placeholder="留空默认 SillyTavern">
            </div>
          </div>
          <div class="be-src-row">
            <input type="checkbox" id="be-src-mask">
            <label for="be-src-mask">正文打码（分享时隐去名字）</label>
          </div>
          <div class="be-src-collapse" id="be-src-mask-wrap">
            <div class="be-src-field">
              <label>打码对象</label>
              <div class="be-src-row" style="margin-bottom:6px;">
                <input type="checkbox" id="be-src-mask-obj-user">
                <label for="be-src-mask-obj-user">用户名</label>
              </div>
              <div class="be-src-row" style="margin-bottom:6px;">
                <input type="checkbox" id="be-src-mask-obj-char">
                <label for="be-src-mask-obj-char">角色名</label>
              </div>
              <div class="be-src-row" style="margin-bottom:0;">
                <input type="checkbox" id="be-src-mask-source">
                <label for="be-src-mask-source">出处显示的用户名 / 作者</label>
              </div>
            </div>
            <div class="be-src-field">
              <label>额外打码词</label>
              <input type="text" id="be-src-mask-extra" placeholder="逗号分隔，如昵称、地名">
            </div>
            <div class="be-src-field">
              <label>打码形式</label>
              <div class="be-radio-group" id="be-src-mask-style">
                <button type="button" class="be-radio-opt" data-v="block">涂黑</button>
                <button type="button" class="be-radio-opt" data-v="symbol">符号</button>
                <button type="button" class="be-radio-opt" data-v="custom">自定义</button>
              </div>
            </div>
            <div class="be-src-field" id="be-src-mask-char-field">
              <label>自定义符号</label>
              <input type="text" id="be-src-mask-char" placeholder="例如 ✕ ※ ＊ ▩">
            </div>
          </div>
          <div class="be-src-row">
            <input type="checkbox" id="be-src-keepdel">
            <label for="be-src-keepdel">保留原文删除线（书摘内显示划掉效果）</label>
          </div>
          <div class="be-src-field">
            <label>保存图片方式（下载没反应时换「弹图长按」）</label>
            <div class="be-radio-group" id="be-src-savemode">
              <button type="button" class="be-radio-opt" data-v="download">下载文件</button>
              <button type="button" class="be-radio-opt" data-v="popup">弹图长按</button>
            </div>
          </div>
          <div class="be-src-actions">
            <button class="be-btn" id="be-src-cancel">取消</button>
            <button class="be-btn primary" id="be-src-save">保存</button>
          </div>
        </div>
      `;
      mainDoc.body.appendChild(mask);
      mask.addEventListener('click', e => { if (e.target === mask) mask.classList.remove('open'); });
      // 勾选「显示书名/章名/水印」才滑出对应输入框（绑定一次即可，元素常驻）
      const bindCollapse = (cbId, wrapId) => {
        const cb = mask.querySelector('#' + cbId);
        const wrap = mask.querySelector('#' + wrapId);
        if (cb && wrap) cb.addEventListener('change', () => {
          // 折叠动画期间临时关掉背后 #be-mask/#be-panel 的 backdrop-filter，
          // 否则 Chromium 在盒子高度连续变化时反复重算模糊 → 一瞬间闪白（用户反馈：关正文打码时闪白）
          markTypoDragging(350);
          wrap.classList.toggle('open', cb.checked);
        });
      };
      bindCollapse('be-src-mask', 'be-src-mask-wrap');
      bindCollapse('be-src-showtitle', 'be-src-title-wrap');
      bindCollapse('be-src-showchapter', 'be-src-chapter-wrap');
      bindCollapse('be-src-showwm', 'be-src-wm-wrap');
    } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    detectAndApplyTheme();
    const ctx = getContext();
    mask.querySelector('#be-src-user').value = settings.sourceUser || '';
    mask.querySelector('#be-src-user').placeholder = ctx.userName || '{{user}}';
    mask.querySelector('#be-src-author').value = settings.sourceAuthor || '';
    mask.querySelector('#be-src-author').placeholder = ctx.charName || '{{char}}';
    mask.querySelector('#be-src-title').value = settings.sourceTitle || '';
    mask.querySelector('#be-src-showtitle').checked = !!settings.showSourceTitle;
    mask.querySelector('#be-src-chapter').value = settings.sourceChapter || '';
    mask.querySelector('#be-src-showchapter').checked = !!settings.showSourceChapter;
    mask.querySelector('#be-src-showwm').checked = settings.showWatermark !== false;
    mask.querySelector('#be-src-wmtext').value = settings.watermarkText || '';
    // 打码字段回显
    mask.querySelector('#be-src-mask').checked = !!settings.maskOn;
    mask.querySelector('#be-src-mask-char').value = settings.maskCustomChar || '';
    mask.querySelector('#be-src-mask-extra').value = settings.maskExtra || '';
    mask.querySelector('#be-src-mask-source').checked = !!settings.maskSource;
    // 打码对象回显（user / char 各自独立，可都选可都不选）
    mask.querySelector('#be-src-mask-obj-user').checked = !!settings.maskUser;
    mask.querySelector('#be-src-mask-obj-char').checked = !!settings.maskChar;
    mask.querySelector('#be-src-keepdel').checked = !!settings.keepDelLine;
    // 保存方式高亮
    const syncSaveMode = () => {
      const sm = settings.saveMode === 'popup' ? 'popup' : 'download';
      mask.querySelectorAll('#be-src-savemode .be-radio-opt')
        .forEach(b => b.classList.toggle('active', b.getAttribute('data-v') === sm));
    };
    // 打码形式高亮 + 仅「自定义」时显示符号输入框
    const syncMaskStyle = () => {
      const st = settings.maskStyle || 'block';
      mask.querySelectorAll('#be-src-mask-style .be-radio-opt')
        .forEach(b => b.classList.toggle('active', b.getAttribute('data-v') === st));
      const cf = mask.querySelector('#be-src-mask-char-field');
      if (cf) cf.style.display = (st === 'custom') ? '' : 'none';
    };
    // 同步折叠区初始展开状态
    mask.querySelector('#be-src-avatar-wrap').classList.toggle('open', (settings.avatarType || 'user') === 'custom');
    mask.querySelector('#be-src-mask-wrap').classList.toggle('open', !!settings.maskOn);
    mask.querySelector('#be-src-title-wrap').classList.toggle('open', !!settings.showSourceTitle);
    mask.querySelector('#be-src-chapter-wrap').classList.toggle('open', !!settings.showSourceChapter);
    mask.querySelector('#be-src-wm-wrap').classList.toggle('open', settings.showWatermark !== false);

    // 头像预览回显
    const updateAvatarPreview = () => {
      const prev = mask.querySelector('#be-src-avatar-preview');
      if (!prev) return;
      prev.style.backgroundImage = settings.customAvatar ? `url('${settings.customAvatar}')` : '';
      prev.classList.toggle('empty', !settings.customAvatar);
    };
    updateAvatarPreview();

    mask.classList.add('open');

    const close = () => mask.classList.remove('open');
    const reNew = (sel, fn) => {
      const el = mask.querySelector(sel);
      const clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);
      clone.addEventListener('click', fn);
    };
    reNew('#be-src-cancel', close);
    // 头像类型：用 reNew 克隆掉旧监听，再用事件委托处理三个 pill
    reNew('#be-src-avatar-type', (e) => {
      const btn = e.target.closest('.be-radio-opt');
      if (!btn) return;
      settings.avatarType = btn.getAttribute('data-v');
      saveSettings(settings);
      mask.querySelectorAll('#be-src-avatar-type .be-radio-opt')
          .forEach(b => b.classList.toggle('active', b === btn));
      // 仅「自定义」头像类型才滑出上传栏
      mask.querySelector('#be-src-avatar-wrap').classList.toggle('open', settings.avatarType === 'custom');
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
    });
    // 克隆后重新打高亮（克隆发生在上一步，这里查到的是新节点）
    mask.querySelectorAll('#be-src-avatar-type .be-radio-opt')
        .forEach(b => b.classList.toggle('active', (settings.avatarType || 'user') === b.getAttribute('data-v')));
    // 打码形式：reNew 克隆掉旧监听后用事件委托处理四个 pill
    reNew('#be-src-mask-style', (e) => {
      const btn = e.target.closest('.be-radio-opt');
      if (!btn) return;
      settings.maskStyle = btn.getAttribute('data-v');
      saveSettings(settings);
      syncMaskStyle();
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
    });
    syncMaskStyle();  // 克隆后重新打高亮 + 同步符号输入框显隐
    // 保存方式：点击即存（与打码形式同款交互）
    reNew('#be-src-savemode', (e) => {
      const btn = e.target.closest('.be-radio-opt');
      if (!btn) return;
      settings.saveMode = btn.getAttribute('data-v') === 'popup' ? 'popup' : 'download';
      saveSettings(settings);
      syncSaveMode();
    });
    syncSaveMode();
    reNew('#be-src-avatar-upload', () => {
      const inp = mainDoc.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.addEventListener('change', async ev => {
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;
        try {
          const dataUrl = await fileToCompressedAvatar(f);
          settings.customAvatar = dataUrl;
          // 一旦上传过头像，没切到 custom 类型时也提示用户去切
          saveSettings(settings);
          updateAvatarPreview();
          if (mainDoc.getElementById('be-card')) renderCard(lastText);
          toast(settings.avatarType === 'custom' ? '已更新自定义头像' : '已保存，到设置面板把头像类型切到「自定义」', 'success');
        } catch (e) {
          toast('上传失败：' + (e?.message || e), 'error');
        }
      });
      inp.click();
    });
    reNew('#be-src-avatar-clear', () => {
      if (!settings.customAvatar) { toast('还没上传头像', 'info'); return; }
      if (!mainWin.confirm('清除自定义头像？')) return;
      settings.customAvatar = '';
      saveSettings(settings);
      updateAvatarPreview();
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
    });
    reNew('#be-src-save', () => {
      settings.sourceUser  = mask.querySelector('#be-src-user').value.trim();
      settings.sourceAuthor = mask.querySelector('#be-src-author').value.trim();
      settings.sourceTitle = mask.querySelector('#be-src-title').value.trim();
      settings.showSourceTitle = mask.querySelector('#be-src-showtitle').checked;
      settings.sourceChapter = mask.querySelector('#be-src-chapter').value.trim();
      settings.showSourceChapter = mask.querySelector('#be-src-showchapter').checked;
      settings.showWatermark = mask.querySelector('#be-src-showwm').checked;
      settings.watermarkText = mask.querySelector('#be-src-wmtext').value;
      settings.maskOn = mask.querySelector('#be-src-mask').checked;
      settings.maskUser = mask.querySelector('#be-src-mask-obj-user').checked;
      settings.maskChar = mask.querySelector('#be-src-mask-obj-char').checked;
      settings.maskCustomChar = mask.querySelector('#be-src-mask-char').value;
      settings.maskExtra = mask.querySelector('#be-src-mask-extra').value;
      settings.maskSource = mask.querySelector('#be-src-mask-source').checked;
      settings.keepDelLine = mask.querySelector('#be-src-keepdel').checked;
      saveSettings(settings);
      close();
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
    });
  }

  // modal 底部抽屉：模板 / 字体 / 背景色（实时预览）
  function openTemplateDrawer() {
    const mask = mainDoc.getElementById('be-mask');
    if (!mask) return;
    let drawer = mainDoc.getElementById('be-drawer');
    if (!drawer) {
      drawer = mainDoc.createElement('div');
      drawer.id = 'be-drawer';
      mask.appendChild(drawer);
    }
    renderDrawer(drawer);
    drawer.classList.add('show');
    // 同步 reflow 后再加 in 类：让 CSS transition 仍能触发（不依赖 RAF）
    void drawer.offsetWidth;
    drawer.classList.add('in');
    // 点击 modal 空白处关掉抽屉（先于 modal 关闭）
    const closeDrawer = () => {
      drawer.classList.remove('in');
      setTimeout(() => drawer.classList.remove('show'), 220);
      mask.removeEventListener('click', maskClickGuard, true);
    };
    const maskClickGuard = (e) => {
      // 点在抽屉自身内不关闭；点在 modal 卡片或外侧关闭
      if (!drawer.contains(e.target)) { closeDrawer(); }
    };
    setTimeout(() => mask.addEventListener('click', maskClickGuard, true), 50);
    drawer._closeFn = closeDrawer;
  }

  function renderDrawer(drawer) {
    const list = Array.isArray(settings.customTemplates) ? settings.customTemplates : [];
    drawer.innerHTML = `
      <div class="be-drawer-handle"></div>
      <div class="be-sec">
        <h4>主题</h4>
        <div class="be-drawer-row" id="be-drawer-tpl">
          ${Object.entries(TEMPLATES).map(([k, v]) => `
            <div class="be-drawer-chip ${settings.template===k?'active':''}" data-k="${k}">${v.name}</div>
          `).join('')}
          ${list.map(t => {
            const id = `custom-${t.id}`;
            return `<div class="be-drawer-chip ${settings.template===id?'active':''}" data-k="${id}">${escapeHtml(t.name)}</div>`;
          }).join('')}
        </div>
      </div>
      <div class="be-sec">
        <h4>字体</h4>
        <div class="be-drawer-row" id="be-drawer-font">
          ${Object.entries(FONTS).map(([k, v]) => {
            const rawCss = k === 'follow_theme'
              ? (() => { try { const _el = mainDoc.querySelector('.mes_text') || mainDoc.body; return mainWin.getComputedStyle(_el).fontFamily || 'inherit'; } catch(e){ return 'inherit'; } })()
              : v.css;
            const safeCss = (rawCss || '').replace(/"/g, "'");
            return `<div class="be-drawer-chip ${settings.font===k?'active':''}" data-k="${k}"
                 style="${safeCss?`font-family:${safeCss};`:''}">${v.name}</div>`;
          }).join('')}
          ${(settings.customFonts||[]).map(f => {
            const fid = `custom-${f.id}`;
            return `<div class="be-drawer-chip ${settings.font===fid?'active':''}" data-k="${fid}"
                 style="font-family:${escapeHtml(f.fontFamily||'inherit')};">${escapeHtml(f.name||'未命名')}</div>`;
          }).join('')}
        </div>
      </div>
      <div class="be-sec">
        <h4>颜色</h4>
        <div class="be-drawer-row" id="be-drawer-color">
          ${COLOR_PRESETS.map(p => `
            <div class="be-drawer-chip be-color-chip ${settings.colorPreset===p.id?'active':''}" data-k="${p.id}"
                 style="background:${p.bg};color:${p.fg};">A</div>
          `).join('')}
          <div class="be-drawer-chip be-color-chip rainbow ${settings.colorPreset==='custom'?'active':''}" data-k="custom" title="自定义">●</div>
        </div>
      </div>
      <button class="be-drawer-confirm" id="be-drawer-confirm">确定</button>
    `;
    const apply = () => {
      saveSettings(settings);
      renderCard(lastText);
    };
    drawer.querySelectorAll('#be-drawer-tpl .be-drawer-chip').forEach(el => {
      el.addEventListener('click', () => {
        settings.template = el.getAttribute('data-k');
        drawer.querySelectorAll('#be-drawer-tpl .be-drawer-chip').forEach(x => x.classList.remove('active'));
        el.classList.add('active');
        apply();
      });
    });
    drawer.querySelectorAll('#be-drawer-font .be-drawer-chip').forEach(el => {
      el.addEventListener('click', () => {
        settings.font = el.getAttribute('data-k');
        drawer.querySelectorAll('#be-drawer-font .be-drawer-chip').forEach(x => x.classList.remove('active'));
        el.classList.add('active');
        apply();
      });
    });
    drawer.querySelectorAll('#be-drawer-color .be-drawer-chip').forEach(el => {
      el.addEventListener('click', () => {
        settings.colorPreset = el.getAttribute('data-k');
        drawer.querySelectorAll('#be-drawer-color .be-drawer-chip').forEach(x => x.classList.remove('active'));
        el.classList.add('active');
        apply();
      });
    });
    drawer.querySelector('#be-drawer-confirm').addEventListener('click', () => drawer._closeFn && drawer._closeFn());
  }

  // 排版微调浮层：字号 / 行距 / 整体宽度（独立小弹层，不挤占模板抽屉，保留卡片可见）
  function openTypoSheet() {
    const mask = mainDoc.getElementById('be-mask');
    if (!mask) return;
    // 若模板抽屉开着，先收起，避免两个浮层叠在一起
    const drawer = mainDoc.getElementById('be-drawer');
    if (drawer && drawer._closeFn && drawer.classList.contains('in')) drawer._closeFn();

    let sheet = mainDoc.getElementById('be-typo-sheet');
    if (!sheet) {
      sheet = mainDoc.createElement('div');
      sheet.id = 'be-typo-sheet';
      mask.appendChild(sheet);
    }
    const size = Number(settings.quoteFontSize) || 19;
    const lh = Number(settings.quoteLineHeight) || 2.05;
    const ls = isFinite(Number(settings.quoteLetterSpacing)) ? Number(settings.quoteLetterSpacing) : 0.04;
    const cw = Number(settings.cardWidth) || 440;
    sheet.innerHTML = `
      <div class="be-drawer-handle"></div>
      <div class="be-sec">
        <h4>字号 · 行距 · 字距 · 宽度</h4>
        <div class="be-drawer-typo">
          <span class="be-dt-ico" style="font-size:12px;">A</span>
          <input type="range" id="be-ts-qsize" min="14" max="22" step="1" value="${size}">
          <span class="be-dt-ico" style="font-size:18px;">A</span>
          <span class="be-dt-val" id="be-ts-qsize-val">${size}px</span>
        </div>
        <div class="be-drawer-typo">
          <span class="be-dt-ico">紧</span>
          <input type="range" id="be-ts-qlh" min="1.5" max="2.3" step="0.05" value="${lh}">
          <span class="be-dt-ico">松</span>
          <span class="be-dt-val" id="be-ts-qlh-val">${lh}</span>
        </div>
        <div class="be-drawer-typo">
          <span class="be-dt-ico" style="letter-spacing:0;">字距</span>
          <input type="range" id="be-ts-qls" min="0" max="0.15" step="0.01" value="${ls}">
          <span class="be-dt-ico" style="letter-spacing:0.18em;">字 距</span>
          <span class="be-dt-val" id="be-ts-qls-val">${ls}em</span>
        </div>
        <div class="be-drawer-typo">
          <span class="be-dt-ico" style="font-size:12px;">窄</span>
          <input type="range" id="be-ts-width" min="300" max="440" step="10" value="${cw}">
          <span class="be-dt-ico" style="font-size:12px;">宽</span>
          <span class="be-dt-val" id="be-ts-width-val">${cw}px</span>
        </div>
      </div>
      <button class="be-drawer-confirm" id="be-ts-confirm">确定</button>
    `;
    const apply = () => { markTypoDragging(); saveSettingsDebounced(); applyTypoLive(); };
    sheet.querySelector('#be-ts-qsize').addEventListener('input', e => {
      settings.quoteFontSize = Number(e.target.value);
      sheet.querySelector('#be-ts-qsize-val').textContent = e.target.value + 'px';
      apply();
    });
    sheet.querySelector('#be-ts-qlh').addEventListener('input', e => {
      settings.quoteLineHeight = Number(e.target.value);
      sheet.querySelector('#be-ts-qlh-val').textContent = e.target.value;
      apply();
    });
    sheet.querySelector('#be-ts-qls').addEventListener('input', e => {
      settings.quoteLetterSpacing = Number(e.target.value);
      sheet.querySelector('#be-ts-qls-val').textContent = e.target.value + 'em';
      apply();
    });
    sheet.querySelector('#be-ts-width').addEventListener('input', e => {
      settings.cardWidth = Number(e.target.value);
      sheet.querySelector('#be-ts-width-val').textContent = e.target.value + 'px';
      apply();
    });
    // 松手(change)立即落盘一次，兜住防抖未触发就关闭的情况
    ['#be-ts-qsize', '#be-ts-qlh', '#be-ts-qls', '#be-ts-width'].forEach(id => {
      sheet.querySelector(id)?.addEventListener('change', () => saveSettings(settings));
    });

    sheet.classList.add('show');
    void sheet.offsetWidth;
    sheet.classList.add('in');
    const closeSheet = () => {
      sheet.classList.remove('in');
      setTimeout(() => sheet.classList.remove('show'), 220);
      mask.removeEventListener('click', guard, true);
    };
    const guard = (e) => { if (!sheet.contains(e.target)) closeSheet(); };
    setTimeout(() => mask.addEventListener('click', guard, true), 50);
    sheet._closeFn = closeSheet;
    sheet.querySelector('#be-ts-confirm').addEventListener('click', closeSheet);
  }

  function openExcerptModal(text, opts = {}) {
    currentThoughtText = opts.thoughtText || '';
    // 合并书摘走 opts.richText（多段拼接后的富文本）；单条书摘沿用旧逻辑——
    // 只有当最近一次选区的富文本与本次文本对得上时才启用（防止从笔记本重开时错配）
    currentRichText = (opts.richText != null) ? opts.richText
      : ((lastRichText && stripDelMarks(lastRichText) === text) ? lastRichText : '');
    // 合并书摘默认可直接编辑正文（改连接词等）；单条书摘不受影响，保持只读展示
    currentEditable = !!opts.editable;
    const mask = ensureMask();
    if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    detectAndApplyTheme();
    mask.classList.add('open');
    renderCard(text);
    if (currentEditable) toast('可直接点击文字进行修改，例如调整连接词', 'info');
    warmupForSave().catch(() => {});
  }

  // 预热（modal 打开时立刻做）：拉 lib、等字体、把头像转 data URL
  let _saveWarmup = null;
  function warmupForSave() {
    if (_saveWarmup) return _saveWarmup;
    _saveWarmup = (async () => {
      // 1. h2c 预加载
      const libP = loadH2C().catch(() => null);
      // 2. 字体就绪
      const fontP = (mainDoc.fonts && mainDoc.fonts.ready)
        ? Promise.race([mainDoc.fonts.ready, new Promise(r => setTimeout(r, 800))])
        : Promise.resolve();
      // 3. 头像预加载到浏览器图片缓存（sandbox 里再 new Image 时命中缓存）
      const card = mainDoc.getElementById('be-card');
      const avP = (async () => {
        if (!card) return;
        const av = card.querySelector('.be-avatar');
        if (!av || !av.style || !av.style.backgroundImage) return;
        const m = av.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
        if (!m || !m[1] || m[1].startsWith('data:')) return;
        await new Promise((res) => {
          const preImg = new Image();
          preImg.crossOrigin = 'anonymous';
          preImg.onload = preImg.onerror = () => res();
          preImg.src = m[1];
          setTimeout(res, 2000);
        });
      })();
      await Promise.all([libP, fontP, avP]);
    })();
    // 关闭 modal 后重置（这样下次打开重新预热确保最新状态）
    return _saveWarmup;
  }
  function clearWarmup() { _saveWarmup = null; }
  function closeModal() {
    mainDoc.getElementById('be-mask')?.classList.remove('open');
    currentThoughtText = '';
    currentRichText = '';
    currentEditable = false;
    clearWarmup();
  }
  function ensureMask() {
    let mask = mainDoc.getElementById('be-mask');
    // 非本脚本实例创建的蒙版（脚本热更新/iframe 重建后残留）一律拆掉重建：
    // 旧实例绑的监听器闭包引用已死 realm 的 setTimeout 等，点了会静默失效
    if (mask && !isStaleGen(mask)) return mask;
    if (mask) { try { mask.remove(); } catch (e) {} }
    mask = stampGen(mainDoc.createElement('div'));
    mask.id = 'be-mask';
    mask.innerHTML = `
      <div id="be-modal">
        <div id="be-card-wrap"></div>
        <div id="be-actions">
          <button class="be-btn" id="be-cancel">取消</button>
          <button class="be-btn" id="be-edit-source">编辑出处</button>
          <button class="be-btn" id="be-open-settings">⚙ 模板</button>
          <button class="be-btn" id="be-open-typo">字号</button>
          <button class="be-btn primary" id="be-save">保存图片</button>
        </div>
      </div>
    `;
    mainDoc.body.appendChild(mask);
    mask.addEventListener('click', e => { if (e.target === mask) closeModal(); });
    mainDoc.getElementById('be-cancel').addEventListener('click', closeModal);
    mainDoc.getElementById('be-save').addEventListener('click', saveAsImage);
    mainDoc.getElementById('be-open-settings').addEventListener('click', openTemplateDrawer);
    mainDoc.getElementById('be-open-typo').addEventListener('click', openTypoSheet);
    mainDoc.getElementById('be-edit-source').addEventListener('click', openSourceEditor);
    return mask;
  }

  // 把引文按空行/换行拆为多段，每段做一个 <p>
  // 段内若含删除线哨兵标记（…），把标记段渲染成 <s>，其余按原逻辑打码+转义；
  // 哨兵永远不会出现在最终 HTML 里（成对替换，收尾兜底剥除）。
  function quoteParaHtml(p) {
    if (p.indexOf(DEL_O) === -1) return maskText(stripDelMarks(p));
    const re = new RegExp(DEL_O + '([^' + DEL_O + DEL_C + ']*)' + DEL_C, 'g');
    let html = '', last = 0, m;
    while ((m = re.exec(p)) !== null) {
      if (m.index > last) html += maskText(stripDelMarks(p.slice(last, m.index)));
      if (m[1]) html += `<s class="be-del">${maskText(m[1])}</s>`;
      last = m.index + m[0].length;
    }
    if (last < p.length) html += maskText(stripDelMarks(p.slice(last)));
    return html;
  }
  function quoteHtml(text) {
    const paras = String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
    if (!paras.length) return '';
    return paras.map(p => `<p>${quoteParaHtml(p)}</p>`).join('');
  }

  // 想法书摘模式：当前激活的想法文本
  let currentThoughtText = '';
  // 当前书摘的富文本（带删除线哨兵标记）。仅当与传入 renderCard 的纯文本严格对应时才使用，
  // 从笔记本重开书摘等没有富文本来源的路径自动回落纯文本。
  let currentRichText = '';
  // 当前书摘是否允许直接编辑正文（.be-quote 设为 contenteditable）。目前只有"合并书摘"会传 true，
  // 单条书摘保持只读——编辑内容只存在于当次弹窗的实时 DOM 里，不回写 note.text，关闭即丢弃。
  let currentEditable = false;

  // 实时排版：字号/行距/字距/宽度全由 CSS 变量 + 容器宽度驱动，可直接改现有 DOM。
  // 拖动滑块走这里，不再每次 input 都 renderCard 重建整张卡片(头像<img>/背景重绘)——
  // 那正是快速拖动时滑条闪白光的根因。
  function applyTypoLive() {
    const wrap = mainDoc.getElementById('be-card-wrap');
    if (!wrap) return;
    const cardEl = wrap.querySelector('.be-card');
    if (cardEl) {
      const qSize = Number(settings.quoteFontSize);
      const qLh = Number(settings.quoteLineHeight);
      const qLs = Number(settings.quoteLetterSpacing);
      if (isFinite(qSize) && qSize > 0) cardEl.style.setProperty('--be-quote-size', qSize + 'px');
      if (isFinite(qLh) && qLh > 0) cardEl.style.setProperty('--be-quote-lh', qLh);
      if (isFinite(qLs) && qLs >= 0) cardEl.style.setProperty('--be-quote-ls', qLs + 'em');
      // 给滚动容器一个等于卡片背景的不透明底色：字号/行距会改变卡片高度，触发
      // #be-card-wrap(带 box-shadow+圆角+overflow 的合成层)重新光栅化，若它本身无背景色，
      // 重绘瞬间会默认填白 → 拖动时闪白光。填上卡片色后重绘就是卡片色，不再闪。
      const cbg = cardEl.style.getPropertyValue('--be-card-bg');
      if (cbg) wrap.style.background = cbg;
    }
    const cw = Number(settings.cardWidth);
    if (isFinite(cw) && cw > 0) {
      wrap.style.width = cw + 'px';
      wrap.style.maxWidth = '100%';
      wrap.style.alignSelf = 'center';
    } else {
      wrap.style.width = '';
      wrap.style.maxWidth = '';
      wrap.style.alignSelf = '';
    }
  }

  // 持久化防抖：settings 含 customAvatar(base64 头像) 等大字段，每次 input 都
  // JSON.stringify + 同步写 localStorage 会把主线程卡到丢帧。拖动只更新内存值并实时
  // 套用样式，停手 250ms 后再落盘一次（松手 change 事件另有一次兜底落盘）。
  let _typoSaveT = 0;
  // 合并书摘正文编辑防抖：见 renderCard 里 .be-quote 的 input 监听
  let _quoteEditT = 0;
  function saveSettingsDebounced() {
    if (_typoSaveT) mainWin.clearTimeout(_typoSaveT);
    _typoSaveT = mainWin.setTimeout(() => { _typoSaveT = 0; saveSettings(settings); }, 250);
  }

  // 拖动排版滑块/触发折叠动画时给 body 挂 .be-typo-dragging：CSS 据此临时关掉背景 backdrop-filter，
  // 避免其在内容重排时反复重算导致间歇闪白。每次触发刷新计时，hold 毫秒后摘掉恢复模糊。
  // （出处弹窗折叠区 transition 250ms，调用方传 350 盖住整段动画）
  let _typoDragT = 0;
  function markTypoDragging(hold = 200) {
    try { mainDoc.body.classList.add('be-typo-dragging'); } catch (e) {}
    if (_typoDragT) mainWin.clearTimeout(_typoDragT);
    _typoDragT = mainWin.setTimeout(() => {
      _typoDragT = 0;
      try { mainDoc.body.classList.remove('be-typo-dragging'); } catch (e) {}
    }, hold);
  }

  function renderCard(text) {
    const wrap = mainDoc.getElementById('be-card-wrap');
    if (!wrap) return;
    // 模板 id：内置或 custom-<id>
    const isCustomTpl = String(settings.template || '').startsWith('custom-');
    const tplId = isCustomTpl
      ? settings.template
      : (TEMPLATES[settings.template] ? settings.template : 'classic');
    const c = resolveColors();
    const _fontKey = settings.font || 'kinghwa';
    let _fontCss;
    if (_fontKey === 'follow_theme') {
      // 直接读正文元素的计算字体，比 CSS 变量更可靠
      const _mesEl = mainDoc.querySelector('.mes_text') || mainDoc.querySelector('#chat') || mainDoc.body;
      _fontCss = mainWin.getComputedStyle(_mesEl).fontFamily || 'sans-serif';
    } else if (_fontKey.startsWith('custom-')) {
      const _cfId = _fontKey.slice(7);
      const _cf = (settings.customFonts || []).find(x => x.id === _cfId);
      _fontCss = _cf?.fontFamily || 'sans-serif';
    } else {
      _fontCss = (FONTS[_fontKey] || FONTS.kinghwa).css;
    }
    const font = { css: _fontCss };
    const ctx = getContext();

    // 三字段出处
    const userName   = settings.sourceUser   || ctx.userName || '';
    const authorName = settings.sourceAuthor || ctx.charName || '';
    const bookName   = settings.showSourceTitle ? (settings.sourceTitle || '') : '';
    const chapter    = settings.showSourceChapter ? (settings.sourceChapter || '') : '';
    const dateText = `摘录于 ${formatDate()}`;

    // 头像（按设置选 user / char / custom）
    const avatarUrl = (() => {
      if (settings.avatarType === 'custom') return settings.customAvatar || '';
      if (settings.avatarType === 'char') return ctx.charAvatar || '';
      return ctx.userAvatar || '';
    })();
    const avatarStyle = avatarUrl
      ? `background-image:url('${avatarUrl}');background-color:${c.avatarBg};`
      : `background:${c.avatarBg};`;

    // 水印：只有关闭「显示水印」开关才隐藏；开关开着时留空则回退到默认 SillyTavern
    const wmText = (settings.showWatermark !== false)
      ? (String(settings.watermarkText || '').trim() || 'SillyTavern')
      : '';
    const watermark = wmText ? `<div class="be-watermark">${escapeHtml(wmText)}</div>` : '';
    // q：根据是否有想法文本，决定渲染样式
    //  · 普通：直接展示引文
    //  · 想法书摘：大字想法在上 + 小字原句在下（带引号边线）
    // 「保留原文删除线」开启且富文本与当前文本对应时，用带哨兵标记的富文本渲染
    const useRich = !!settings.keepDelLine && currentRichText && stripDelMarks(currentRichText) === text;
    const quotePart = quoteHtml(useRich ? currentRichText : text);
    const q = currentThoughtText
      ? `<div class="be-thought-main">${maskText(currentThoughtText)}</div>
         <div class="be-quote-orig">${quotePart}</div>`
      : quotePart;

    // 经典 / 手札 出处行：书名 · 章名（若章名开启），否则书名 + "摘录"占位 或省略
    const sourceLine = (() => {
      const parts = [];
      if (bookName) parts.push(escapeHtml(bookName));
      if (chapter) parts.push(escapeHtml(chapter));
      return parts.join(' · ');
    })();

    let inner = '';
    if (isCustomTpl) {
      // 自定义模板：提供通用 HTML 结构，用户 CSS 自行控制布局/隐藏
      const cnDate = toChineseDate(new Date());
      const userAvStyle = ctx.userAvatar
        ? `background-image:url('${ctx.userAvatar}');background-color:${c.avatarBg};`
        : `background:${c.avatarBg};`;
      const charAvStyle = ctx.charAvatar
        ? `background-image:url('${ctx.charAvatar}');background-color:${c.avatarBg};`
        : `background:${c.avatarBg};`;
      inner = `
        <div class="be-head">
          ${settings.showAvatar ? `<div class="be-avatar" style="${userAvStyle}"></div>` : ''}
          ${settings.showAvatar ? `<div class="be-char-avatar" style="${charAvStyle}"></div>` : ''}
          <div class="be-meta">
            <div class="be-name">${maskNameDisplay(userName, '')}</div>
            ${settings.showDate ? `<div class="be-date" style="color:${c.sub};">${dateText}</div>` : ''}
            ${settings.showDate ? `<div class="be-date-cn" style="color:${c.sub};">${cnDate}</div>` : ''}
          </div>
        </div>
        <div class="be-quote">${q}</div>
        <div class="be-source" style="color:${c.sub};">
          ${bookName ? `<div class="title">${escapeHtml(bookName)}</div>` : ''}
          ${chapter ? `<div class="chapter">${escapeHtml(chapter)}</div>` : ''}
          ${authorName ? `<div class="author">${maskNameDisplay(authorName, '')}</div>` : ''}
        </div>
        ${watermark}
      `;
    } else if (tplId === 'classic') {
      inner = `
        <div class="be-head">
          ${settings.showAvatar ? `<div class="be-avatar" style="${avatarStyle}"></div>` : ''}
          <div class="be-meta">
            <div class="be-name">${maskNameDisplay(userName, '未命名')}</div>
            ${settings.showDate ? `<div class="be-date" style="color:${c.sub};">${dateText}</div>` : ''}
          </div>
        </div>
        <div class="be-quote">${q}</div>
        ${(sourceLine || authorName) ? `
        <div class="be-source" style="color:${c.sub};">
          ${sourceLine ? `<div class="title">${sourceLine}</div>` : ''}
          ${authorName ? `<div class="author">${maskNameDisplay(authorName, '')}</div>` : ''}
        </div>` : ''}
        ${watermark}
      `;
    } else if (tplId === 'portrait') {
      // 人像：顶部大圆头像居中 + 用户名 + 日期 + 引文 + 出处
      inner = `
        ${settings.showAvatar ? `<div class="be-pt-avatar" style="${avatarStyle}"></div>` : ''}
        <div class="be-pt-name">${maskNameDisplay(userName, '未命名')}</div>
        ${settings.showDate ? `<div class="be-pt-date" style="color:${c.sub};">${dateText}</div>` : ''}
        <div class="be-pt-line" style="background:currentColor;"></div>
        <div class="be-quote">${q}</div>
        ${(sourceLine || authorName) ? `
        <div class="be-source" style="color:${c.sub};">
          ${sourceLine ? `<div class="title">${sourceLine}</div>` : ''}
          ${authorName ? `<div class="author">${maskNameDisplay(authorName, '')}</div>` : ''}
        </div>` : ''}
        ${watermark}
      `;
    } else if (tplId === 'landscape') {
      // 横幅：上方双头像（user + char）居中 + 居中名字、日期、引文、出处
      const userAvUrl = ctx.userAvatar || '';
      const charAvUrl = ctx.charAvatar || '';
      const av1Style = userAvUrl
        ? `background-image:url('${userAvUrl}');background-color:${c.avatarBg};`
        : `background:${c.avatarBg};`;
      const av2Style = charAvUrl
        ? `background-image:url('${charAvUrl}');background-color:${c.avatarBg};`
        : `background:${c.avatarBg};`;
      inner = `
        ${settings.showAvatar ? `<div class="be-ls-avatars">
          <div class="be-ls-avatar" style="${av1Style}"></div>
          <div class="be-ls-avatar" style="${av2Style}"></div>
        </div>` : ''}
        <div class="be-ls-names">
          ${userName ? `<span>${maskNameDisplay(userName, '')}</span>` : ''}
          ${(userName && authorName) ? `<span class="be-ls-x">&middot;</span>` : ''}
          ${authorName ? `<span>${maskNameDisplay(authorName, '')}</span>` : ''}
        </div>
        ${settings.showDate ? `<div class="be-ls-date" style="color:${c.sub};">${dateText}</div>` : ''}
        <div class="be-ls-line" style="background:currentColor;"></div>
        <div class="be-quote">${q}</div>
        ${sourceLine ? `<div class="be-source" style="color:${c.sub};"><div class="title">${sourceLine}</div></div>` : ''}
        ${watermark}
      `;
    } else if (tplId === 'mixtape') {
      // 磁带：左侧 mono 信息条，右侧主文带左边线
      const d = new Date();
      const dateMonYr = `${String(d.getDate()).padStart(2,'0')} ${d.toLocaleString('en-US',{month:'short'}).toUpperCase()} ${d.getFullYear()}`;
      inner = `
        <div class="be-mt-tape"></div>
        <div class="be-head">
          <div class="be-mt-left" style="color:${c.sub};">
            <div class="be-mt-track" style="color:${c.fg};">TRACK A</div>
            <div class="be-mt-side">SIDE 001</div>
            ${userName ? `<div>USER · ${maskNameDisplay(userName, '')}</div>` : ''}
            ${authorName ? `<div>BY · ${maskNameDisplay(authorName, '')}</div>` : ''}
            ${bookName ? `<div>FROM · ${escapeHtml(bookName)}</div>` : ''}
            ${chapter ? `<div>CHAP · ${escapeHtml(chapter)}</div>` : ''}
            ${settings.showDate ? `<div>${dateMonYr}</div>` : ''}
          </div>
          <div class="be-quote">${q}</div>
        </div>
        <div class="be-mt-tape bottom"></div>
        ${wmText ? `<div class="be-watermark be-mt-wm">// ${escapeHtml(wmText)} · MIXTAPE</div>` : ''}
      `;
    } else if (tplId === 'filmframe') {
      // 影帧：顶部底部黑条 + 胶片孔，正文居中斜体带引号，底部标题/作者
      const holes = '<div class="be-ff-hole"></div>'.repeat(14);
      inner = `
        <div class="be-ff-bar">${holes}</div>
        <div class="be-ff-body">
          <div class="be-quote">${q}</div>
        </div>
        <div class="be-ff-bar">${holes}</div>
        <div class="be-ff-foot" style="color:${c.sub};">
          <div class="be-ff-who" style="color:${c.fg};">${maskNameDisplay(authorName || userName, '')}</div>
          ${(bookName || chapter) ? `<div>${[bookName, chapter].filter(Boolean).map(escapeHtml).join(' · ')}</div>` : ''}
          ${settings.showDate ? `<div>${dateText}</div>` : ''}
        </div>
        ${wmText ? `<div class="be-watermark be-ff-wm">${escapeHtml(wmText)}</div>` : ''}
      `;
    } else if (tplId === 'verse') {
      // 诗笺：主文竖排 + 右侧装饰边栏（用户名/作者/日期/书名 竖排）
      const cnDate = settings.showDate ? toChineseDate(new Date()) : '';
      inner = `
        <div class="be-head">
          <div class="be-quote">${q}</div>
          <div class="be-vs-side" style="color:${c.sub};">
            ${userName ? `<span class="vs-name" style="color:${c.fg};">${maskNameDisplay(userName, '')}</span>` : ''}
            ${authorName ? `<span>${maskNameDisplay(authorName, '')} · 著</span>` : ''}
            ${bookName ? `<span>${escapeHtml(bookName)}</span>` : ''}
            ${chapter ? `<span>${escapeHtml(chapter)}</span>` : ''}
            ${cnDate ? `<span>${cnDate}</span>` : ''}
          </div>
        </div>
        ${wmText ? `<div class="be-vs-foot" style="color:${c.sub};">${escapeHtml(wmText)} · 摘录</div>` : ''}
        <div class="be-watermark" style="display:none;"></div>
      `;
    } else if (tplId === 'jinshu') {
      inner = `
        <div class="be-head">
          <div class="be-vtitle">${escapeHtml(bookName || authorName || '摘录')}</div>
          ${authorName ? `<div class="be-vauthor" style="color:${c.sub};">${maskNameDisplay(authorName, '')}</div>` : ''}
        </div>
        <div class="be-quote">${q}</div>
        ${chapter ? `<div class="be-source" style="color:${c.sub};"><div class="title">${escapeHtml(chapter)}</div></div>` : ''}
        <div class="be-divider"></div>
        <div class="be-foot" style="color:${c.sub};">${maskNameDisplay(userName, '')} · ${dateText}</div>
        ${watermark}
      `;
    } else if (tplId === 'calendar') {
      const d = new Date();
      const day = d.getDate();
      const monyr = `${d.toLocaleString('en-US',{month:'short'}).toUpperCase()} ${d.getFullYear()}`;
      const wk = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][d.getDay()];
      inner = `
        <div class="be-head">
          <div class="be-cal-day">${day}</div>
          <div class="be-cal-monyr">${monyr}</div>
          <div class="be-cal-weekday" style="color:${c.sub};">${wk}</div>
          <div class="be-cal-line"></div>
        </div>
        <div class="be-quote">${q}</div>
        <div class="be-source" style="color:${c.sub};">
          ${bookName ? `<div class="title">《${escapeHtml(bookName)}》</div>` : ''}
          ${authorName ? `<div class="author">${maskNameDisplay(authorName, '')}</div>` : ''}
        </div>
        ${watermark}
      `;
    }

    // 字号 / 行距：注意 font.css 含双引号，直接插进 style="" 会把后面的自定义属性截断
    // （这就是之前拖动字号/行距无效的根因）。这里把字体的双引号转成单引号，
    // 并额外用 JS setProperty 兜底设置 --be-quote-size/lh，确保一定生效。
    const fontCssAttr = String(font.css || '').replace(/"/g, "'");

    // 想法书摘：原句引用符号可关
    const noQuoteCls = (settings.showThoughtQuote === false) ? ' be-no-thought-quote' : '';
    wrap.innerHTML = `
      <div class="be-card tpl-${tplId}${noQuoteCls}" id="be-card"
           style="background:${c.bg};color:${c.fg};font-family:${fontCssAttr};--be-card-bg:${c.bg};--be-card-fg:${c.fg};">
        ${inner}
      </div>
    `;
    // 字号/行距/字距(CSS 变量) + 整体宽度(外层容器居中)：与拖动滑块共用同一套应用逻辑
    applyTypoLive();
    // 强制把字体应用到 .be-quote（防止某些环境样式被 user-agent 覆盖）
    const quoteEl = wrap.querySelector('.be-quote');
    if (quoteEl) {
      quoteEl.style.fontFamily = font.css;
      // 合并书摘：正文可直接编辑（改连接词等）。保存图片截的是这份实时 DOM，天然拿到编辑结果；
      // 但切模板/换配色等操作会用 lastText 整个重建 wrap.innerHTML，会把编辑内容冲掉——
      // 所以编辑时要把最新文字同步回 lastText，让"重建"重建出的还是编辑后的版本。
      quoteEl.contentEditable = currentEditable ? 'true' : 'false';
      quoteEl.classList.toggle('be-quote-editable', currentEditable);
      if (currentEditable) {
        quoteEl.addEventListener('input', () => {
          if (_quoteEditT) mainWin.clearTimeout(_quoteEditT);
          _quoteEditT = mainWin.setTimeout(() => {
            _quoteEditT = 0;
            lastText = quoteEl.innerText || quoteEl.textContent || '';
          }, 300);
        });
      }
    }
  }

  // ---------- 截图（纯 html2canvas，本地随包优先，CDN 兜底） ----------
  // v0.6.1：去掉 html-to-image —— 它内部 fetch 远程字体/资源经常挂起，留下未清理 buffer 易导致 OOM/闪退
  // v1.3.0（扩展化）：扩展仓库自带一份 lib/html2canvas.min.js，同源加载不受网络/代理影响，
  // 是这份列表里第一个候选；下面 4 个 CDN 镜像保留原样当兜底（本地文件万一缺失/被清理时还能用）。
  let LOCAL_H2C_URL = '';
  try { LOCAL_H2C_URL = new URL('./lib/html2canvas.min.js', import.meta.url).href; } catch (e) {}
  const H2C_LIB_URLS = [
    LOCAL_H2C_URL,
    'https://cdn.staticfile.org/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdn.bootcdn.net/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js'
  ].filter(Boolean);
  const SCRIPT_LOAD_TIMEOUT_MS = 6000;
  let _h2cPromise = null;

  // CDN 竞速加载：先试第一个源，1.2s 没成功再把其余源全部并行发出，谁先加载成功用谁。
  // 旧的串行逐个试在代理/弱网下最坏 4×6s，必撞上外层 8s 超时（用户反馈"开梯子就保存失败"的根因）。
  // 网络通畅时首源秒回，不多花一字节流量；同一份库重复执行是幂等覆盖，无副作用。
  const CDN_STAGGER_MS = 1200;
  function loadOneOf(urls, globalName) {
    return new Promise((resolve, reject) => {
      if (mainWin[globalName]) return resolve(mainWin[globalName]);
      let settled = false;
      let failed = 0;
      const tags = [];
      let staggerTimer = null;
      const finish = (ok, val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        clearTimeout(staggerTimer);
        tags.forEach(s => {
          s.onload = s.onerror = null;
          if (!ok || !s._beWinner) { try { s.remove(); } catch (e) {} }
        });
        ok ? resolve(val) : reject(new Error('截图库加载失败，请检查网络'));
      };
      const timeoutTimer = setTimeout(() => finish(false), SCRIPT_LOAD_TIMEOUT_MS);
      const launch = (url) => {
        if (settled) return;
        const s = mainDoc.createElement('script');
        s.src = url;
        s.async = true;
        s.onload = () => {
          if (settled) { try { s.remove(); } catch (e) {} return; }
          if (mainWin[globalName]) { s._beWinner = true; finish(true, mainWin[globalName]); }
          else if (++failed >= urls.length) finish(false);
        };
        s.onerror = () => {
          if (settled) return;
          try { s.remove(); } catch (e) {}
          if (++failed >= urls.length) finish(false);
        };
        tags.push(s);
        mainDoc.head.appendChild(s);
      };
      launch(urls[0]);
      if (urls.length > 1) {
        staggerTimer = setTimeout(() => {
          if (!settled) urls.slice(1).forEach(launch);
        }, CDN_STAGGER_MS);
      }
    });
  }
  function loadH2C() {
    if (mainWin.html2canvas) return Promise.resolve(mainWin.html2canvas);
    if (_h2cPromise) return _h2cPromise;
    _h2cPromise = loadOneOf(H2C_LIB_URLS, 'html2canvas')
      .catch(err => { _h2cPromise = null; throw err; });
    return _h2cPromise;
  }

  // 给 Promise 套一个超时，避免库本身卡住（toPng/h2c 偶发卡死）
  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error(`${label || '操作'} 超时（${ms}ms）`)), ms))
    ]);
  }

  // 把错误对象格式化成人话
  function fmtErr(e) {
    if (!e) return '未知错误';
    if (typeof e === 'string') return e;
    if (e.message) return e.message;
    if (e.type) return `加载资源失败 (${e.type})`;
    try { return JSON.stringify(e); } catch { return String(e); }
  }

  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl).split(',');
    const mime = (parts[0].match(/:(.*?);/) || [, 'image/png'])[1];
    const bin = atob(parts[1] || '');
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }
  // 触发下载：优先用 Blob URL（而非 data: URL）。
  // 个别 iOS/内嵌浏览器点 data: 下载会把顶层文档导航到图片本身 → 承载脚本的酒馆助手 iframe 被卸载、
  // 需刷新；Blob URL 更稳，更可能走「保存文件/存图」而非导航。
  // 入参可为 Blob（优先，省去 base64 往返）或 data: URL（兜底）。
  //
  // ⚠ 关键：本脚本跑在酒馆助手 iframe 里，但 <a> 挂在父文档（mainDoc = window.parent）。
  // blob: URL 是按「创建它的 realm/document」注册的——必须用父窗口的 URL（mainWin.URL）注册，
  // 否则父文档里的 <a> 取不到这个 blob，移动端(iOS Edge/WebKit、安卓)会导出 0 字节空文件。
  // 桌面同源浏览器宽松，仍能解析，所以本机(Via)测不出来。
  // ⚠ Blob 判定不能用 `instanceof Blob`：canvas.toBlob 的 Blob 诞生在【父窗口 realm】
  // （h2c 加载进父窗口，输出 canvas 属于父文档），而本脚本 iframe realm 的 Blob 构造器
  // 和它不是同一个，跨 realm instanceof 恒为 false → v1.2.8~1.2.11 在真·iframe 隔离的
  // 环境（iOS Safari/云酒馆/TT 等）会静默走空、没有任何下载动作。改用鸭子类型判定。
  function isBlobLike(x) {
    return !!x && typeof x === 'object' && typeof x.size === 'number' &&
           typeof x.type === 'string' && typeof x.slice === 'function';
  }
  // 返回 true = 已触发下载点击；false = 连可用的 href 都没拿到（调用方应走弹图兜底）
  function triggerDownload(blobOrDataUrl, fname) {
    const PURL = mainWin.URL || mainWin.webkitURL || URL;
    let href, blobUrl = null;
    let blob = isBlobLike(blobOrDataUrl) ? blobOrDataUrl : null;
    if (!blob && typeof blobOrDataUrl === 'string') {
      try { blob = dataUrlToBlob(blobOrDataUrl); } catch (e) {}
    }
    if (blob) {
      // 统一在父文档 realm 重包一层再注册，保证「blob 的 realm = 注册的 realm = <a> 所在文档」；
      // 重包失败（个别引擎不认跨 realm BlobPart）则退回直接注册原 blob
      let regBlob = blob;
      try {
        if (mainWin.Blob && !(blob instanceof mainWin.Blob)) {
          regBlob = new mainWin.Blob([blob], { type: blob.type || 'application/octet-stream' });
        }
      } catch (e) { regBlob = blob; }
      try { blobUrl = PURL.createObjectURL(regBlob); }
      catch (e) {
        try { blobUrl = PURL.createObjectURL(blob); } catch (e2) {}
      }
      href = blobUrl;
    }
    // 实在拿不到 blob URL，且原始入参是 data: URL → 兜底直接用（可能触发 iOS 导航，但至少存得到）
    if (!href && typeof blobOrDataUrl === 'string') href = blobOrDataUrl;
    if (!href) return false;
    const a = mainDoc.createElement('a');
    a.href = href; a.download = fname; a.rel = 'noopener';
    mainDoc.body.appendChild(a); a.click(); a.remove();
    if (blobUrl) setTimeout(() => { try { PURL.revokeObjectURL(blobUrl); } catch (e) {} }, 10000);
    return true;
  }
  // 把 canvas 编码成 Blob：优先 toBlob（异步、后台编码，不阻塞主线程；避免巨大 base64 字符串
  // 与逐字节循环造成的页面卡死）。toBlob 不可用/返回 null 时回退同步 toDataURL。
  function canvasToImage(canvas, mime) {
    return new Promise((resolve) => {
      if (canvas.toBlob) {
        try {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else resolve(canvas.toDataURL(mime)); // 编码失败兜底
          }, mime);
          return;
        } catch (e) {}
      }
      resolve(canvas.toDataURL(mime));
    });
  }

  // 弹图保存：全屏浮层展示成品图（data: URL 内联，不导航不下载），手机长按存相册、电脑右键另存。
  // 供「保存方式=弹图长按」以及下载路径失败时的自动兜底使用。每次全新创建，无常驻监听。
  function showImagePopup(dataUrl) {
    const old = mainDoc.getElementById('be-imgpop');
    if (old) { try { old.remove(); } catch (e) {} }
    const pop = stampGen(mainDoc.createElement('div'));
    pop.id = 'be-imgpop';
    pop.innerHTML = `
      <div class="be-imgpop-tip">长按图片保存到相册 · 电脑右键另存为</div>
      <img alt="书摘图片">
      <button class="be-btn" id="be-imgpop-close">关闭</button>
    `;
    pop.querySelector('img').src = dataUrl;
    mainDoc.body.appendChild(pop);
    const close = () => { try { pop.remove(); } catch (e) {} };
    pop.addEventListener('click', (e) => { if (e.target === pop) close(); });
    pop.querySelector('#be-imgpop-close').addEventListener('click', close);
  }

  // 头像处理：放弃 background-image，改用 <img>
  // dataURL natural size = CSS 尺寸 × dpr，正好等于 h2c 最终输出像素数，让 1024 原图一次缩放到位（无二次降采样）
  // 同时处理多种头像类（经典 .be-avatar / 人像 .be-pt-avatar / 横幅 .be-ls-avatar）
  async function processAvatarInClone(cardClone, idoc) {
    const avs = cardClone.querySelectorAll('.be-avatar, .be-pt-avatar, .be-ls-avatar, .be-char-avatar');
    for (const av of avs) {
      try { await processOneAvatar(av, idoc); } catch (e) {}
    }
  }
  async function processOneAvatar(av, idoc) {
    if (!av || !av.style || !av.style.backgroundImage) return;
    const m = av.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
    if (!m || !m[1]) return;
    const url = m[1];
    const cssW = av.offsetWidth || (av.classList.contains('be-pt-avatar') ? 84 : av.classList.contains('be-ls-avatar') ? 72 : 44);
    const cssH = av.offsetHeight || cssW;
    const dpr = Math.min(mainWin.devicePixelRatio || 1, 2);
    const sizeW = Math.round(cssW * dpr);
    const sizeH = Math.round(cssH * dpr);
    // 圆形/方形保持，但 dataURL 都是矩形
    const isRound = (parseFloat(getComputedStyleSafe(av, 'border-top-left-radius')) || 0) > cssW / 4
                 || av.style.borderRadius === '50%';
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('avatar load failed'));
        i.src = url;
        setTimeout(() => rej(new Error('avatar load timeout')), 3000);
      });
      const c = mainDoc.createElement('canvas');
      c.width = sizeW; c.height = sizeH;
      const ctx = c.getContext('2d');
      // cover：取较短边居中裁剪
      const sw = img.naturalWidth, sh = img.naturalHeight;
      const scale = Math.max(sizeW / sw, sizeH / sh);
      const dw = sw * scale, dh = sh * scale;
      const dx = (sizeW - dw) / 2, dy = (sizeH - dh) / 2;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, dx, dy, dw, dh);
      const dataUrl = c.toDataURL('image/png');
      c.width = c.height = 0;
      av.style.backgroundImage = 'none';
      av.innerHTML = '';
      const imgEl = idoc.createElement('img');
      imgEl.src = dataUrl;
      imgEl.style.cssText = `width:${cssW}px;height:${cssH}px;display:block;border-radius:${isRound?'50%':'inherit'};`;
      av.appendChild(imgEl);
    } catch (e) {
      console.warn('[BookExcerpt] avatar process failed', e);
    }
  }
  function getComputedStyleSafe(el, prop) {
    try { return mainWin.getComputedStyle(el).getPropertyValue(prop); } catch (e) { return ''; }
  }

  // iframe 沙箱渲染：把卡片 clone 到隔离 iframe，只带卡片自己的 CSS
  // 关键收益：不再扫 ST 主文档 7000 行 CSS，速度 10x+
  async function renderInSandbox(card, bg, dpr, h2c) {
    const iframe = mainDoc.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    // 导出宽度：优先用用户设定的整体宽度（竖屏排版），否则回退到卡片实际宽度
    const cardW = Math.max(Number(settings.cardWidth) || card.offsetWidth || 440, 280);
    const cardH = Math.max(card.offsetHeight || 600, 400);
    iframe.style.cssText = `position:fixed;left:-99999px;top:0;width:${cardW + 4}px;height:${cardH + 4}px;border:0;visibility:hidden;`;
    mainDoc.body.appendChild(iframe);
    try {
      const idoc = iframe.contentDocument;
      // 复制书摘自己的样式表
      const fontLinks = Array.from(mainDoc.querySelectorAll('link[id^="be-font-"]'))
        .map(l => `<link rel="stylesheet" href="${l.href}">`).join('');
      const styleText = (mainDoc.getElementById('be-style')?.textContent || '') +
                        '\n' +
                        (mainDoc.getElementById('be-custom-style')?.textContent || '');
      idoc.open();
      idoc.write(`<!DOCTYPE html><html><head>
        <meta charset="utf-8">
        ${fontLinks}
        <style>html,body{margin:0;padding:0;background:${bg};}body{font-family:${mainWin.getComputedStyle(card).fontFamily};}</style>
        <style>${styleText}</style>
      </head><body></body></html>`);
      idoc.close();
      // 等基础布局（不用 RAF：Firefox 在隐藏 iframe 里不触发 RAF）
      await new Promise(r => setTimeout(r, 16));
      // 把卡片 clone 进去（inline style 都会带过去）
      const cardClone = card.cloneNode(true);
      // 防导出文字偏挤（用户反馈：导出后字凑得很近）：部分引擎/沙箱环境里 letter-spacing、
      // line-height（尤其 em / 倍数值）在 html2canvas 下没吃到预览那套样式，导致导出比预览更挤。
      // 这里把预览里【已算好】的 字距 / 行距 / 字号 px 值冻结成内联样式带进沙箱，
      // 导出就和预览一致，不依赖沙箱 CSS 是否完整生效。
      try {
        const FREEZE_SEL = '.be-quote, .be-quote p, .be-thought-main, .be-quote-orig, .be-quote-orig p';
        const srcEls = card.querySelectorAll(FREEZE_SEL);
        const dstEls = cardClone.querySelectorAll(FREEZE_SEL);
        for (let i = 0; i < srcEls.length && i < dstEls.length; i++) {
          const cs = mainWin.getComputedStyle(srcEls[i]);
          ['fontSize', 'lineHeight', 'letterSpacing'].forEach(p => {
            const v = cs[p];
            if (v && v !== 'normal') dstEls[i].style[p] = v;
          });
        }
      } catch (e) {}
      // 强制导出宽度 = 用户设定宽度（预览容器在窄屏上可能更窄，导出要按设定值）
      cardClone.style.width = cardW + 'px';
      cardClone.style.maxWidth = 'none';
      idoc.body.appendChild(cardClone);
      // 在 clone 上把头像换成清晰 <img>（不影响主文档预览）
      await processAvatarInClone(cardClone, idoc);
      // 宽度变化会改变高度，重排后按内容真实高度调整 iframe（h2c 按元素尺寸截，留足空间即可）
      await new Promise(r => setTimeout(r, 16));
      iframe.style.height = (cardClone.scrollHeight + 4) + 'px';
      // 等字体（iframe 自己的字体加载）
      try {
        await Promise.race([
          (idoc.fonts && idoc.fonts.ready) || Promise.resolve(),
          new Promise(r => setTimeout(r, 600))
        ]);
      } catch (e) {}
      // 再让浏览器布局/绘制一帧
      await new Promise(r => setTimeout(r, 16));
      const canvas = await h2c(cardClone, {
        backgroundColor: bg,
        scale: dpr,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 0,
        logging: false,
        // 用 iframe 自身 window/document（关键：避免 h2c 用主文档样式）
        windowWidth: cardClone.scrollWidth,
        windowHeight: cardClone.scrollHeight
      });
      return canvas;
    } finally {
      try { iframe.remove(); } catch (e) {}
    }
  }

  async function saveAsImage() {
    const card = mainDoc.getElementById('be-card');
    if (!card) return;
    // 合并书摘正文可编辑：截图前失焦，避免把光标/输入法候选框截进图里
    const editableQuote = card.querySelector('.be-quote[contenteditable="true"]');
    if (editableQuote) { try { editableQuote.blur(); } catch (e) {} }
    const btn = mainDoc.getElementById('be-save');
    const oldText = btn.textContent;
    btn.textContent = '生成中…';
    btn.disabled = true;
    // 关键：yield 主线程两帧，让"生成中"立即重绘出来（setTimeout 替代 RAF，兼容隐藏 iframe）
    await new Promise(r => setTimeout(r, 32));
    await new Promise(r => setTimeout(r, 0));

    const safetyTimer = setTimeout(() => {
      if (btn.disabled) {
        btn.textContent = oldText;
        btn.disabled = false;
        toast('生成超时，请重试', 'error');
      }
    }, 30000);

    try {
      const tplBg = resolveColors().bg;
      const ts = new Date();
      const fname = `书摘_${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}_${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}.png`;
      try { await withTimeout(warmupForSave(), 3000, '预热'); } catch (e) {}
      const dpr = Math.min(mainWin.devicePixelRatio || 1, 2);

      try {
        const h2c = await withTimeout(loadH2C(), 8000, '加载截图库');
        // iframe 沙箱渲染 —— 主提速点；头像在 sandbox clone 内单独处理
        let canvas;
        try {
          canvas = await withTimeout(renderInSandbox(card, tplBg, dpr, h2c), 15000, '生成图片');
        } catch (eSandbox) {
          console.warn('[BookExcerpt] 沙箱渲染失败，退回主文档:', eSandbox);
          // 兜底：在主文档离屏 clone 上跑，clone 里同样把头像换成清晰 <img>，
          // 避免兜底路径直接截 background-image 头像导致清晰度下降
          const clone = card.cloneNode(true);
          clone.style.cssText += ';position:fixed;left:-99999px;top:0;visibility:hidden;';
          mainDoc.body.appendChild(clone);
          try {
            await processAvatarInClone(clone, mainDoc);
            await new Promise(r => setTimeout(r, 16));
            canvas = await withTimeout(h2c(clone, {
              backgroundColor: tplBg,
              scale: dpr,
              useCORS: true,
              allowTaint: true,
              imageTimeout: 0,
              logging: false
            }), 15000, '生成图片');
          } finally {
            try { clone.remove(); } catch (e) {}
          }
        }
        if ((settings.saveMode === 'popup')) {
          // 弹图长按模式：不走下载器（部分内嵌浏览器无视 <a download> / 下载管理器拒收 blob:）
          const dataUrl = canvas.toDataURL('image/png');
          try { canvas.width = canvas.height = 0; } catch (e) {}
          showImagePopup(dataUrl);
        } else {
          const img = await canvasToImage(canvas, 'image/png');
          let ok = false;
          try { ok = triggerDownload(img, fname); } catch (e) { ok = false; }
          if (ok) {
            try { canvas.width = canvas.height = 0; } catch (e) {}
            toast('已保存图片', 'success');
          } else {
            // 下载路径彻底走不通 → 自动降级弹图，别再假报成功
            const dataUrl = (typeof img === 'string') ? img : canvas.toDataURL('image/png');
            try { canvas.width = canvas.height = 0; } catch (e) {}
            showImagePopup(dataUrl);
            toast('下载未能触发，已自动切换为弹图，请长按保存', 'info');
          }
        }
      } catch (e2) {
        console.error('[BookExcerpt] 截图失败:', e2);
        toast('保存失败：' + fmtErr(e2), 'error');
      }
    } finally {
      clearTimeout(safetyTimer);
      btn.textContent = oldText;
      btn.disabled = false;
    }
  }

  // ---------- 笔记本/设置 面板 ----------
  let panelView = 'notes';
  let currentCharKey = null;
  let noteFilter = 'all';
  let searchKey = '';

  function openPanel(view = 'notes') {
    panelView = view;
    currentCharKey = null;
    let panel = mainDoc.getElementById('be-panel');
    if (!panel) {
      panel = mainDoc.createElement('div');
      panel.id = 'be-panel';
      mainDoc.body.appendChild(panel);
    } else if (panel.parentNode !== mainDoc.body || panel.nextSibling) {
      mainDoc.body.appendChild(panel);
    }
    detectAndApplyTheme();
    panel.classList.add('open');
    renderPanel();
  }
  function closePanel() {
    mainDoc.getElementById('be-panel')?.classList.remove('open');
  }

  function renderPanel() {
    const panel = mainDoc.getElementById('be-panel');
    if (!panel) return;
    if (panelView === 'char') return renderCharNotes(panel);
    panel.innerHTML = `
      <div class="be-p-head">
        <span class="be-p-title">书摘</span>
        <button class="be-btn" id="be-p-close">×</button>
      </div>
      <div class="be-p-tabs">
        <button data-v="notes" class="${panelView === 'notes' ? 'active' : ''}">笔记本</button>
        <button data-v="settings" class="${panelView === 'settings' ? 'active' : ''}">设置</button>
      </div>
      <div class="be-p-body" id="be-p-body"></div>
    `;
    panel.querySelector('#be-p-close').addEventListener('click', closePanel);
    panel.querySelectorAll('.be-p-tabs button').forEach(b => {
      b.addEventListener('click', () => {
        const newView = b.getAttribute('data-v');
        if (newView === panelView) return;
        panelView = newView;
        panel.querySelectorAll('.be-p-tabs button').forEach(x => x.classList.toggle('active', x === b));
        if (panelView === 'notes') renderNotesList();
        else renderSettings();
        const body = mainDoc.getElementById('be-p-body');
        if (body) {
          body.classList.remove('be-body-anim');
          void body.offsetWidth;
          body.classList.add('be-body-anim');
        }
      });
    });
    if (panelView === 'notes') renderNotesList();
    else renderSettings();
  }

  // 渲染"自定义字体"折叠区
  let _customFontOpen = false;
  function renderCustomFontGroup() {
    const list = Array.isArray(settings.customFonts) ? settings.customFonts : [];
    if (!list.length) return '';
    return `
      <div class="be-tpl-group ${_customFontOpen ? 'open' : ''}" id="be-font-group">
        <div class="be-tpl-group-head" id="be-font-group-head">
          <span class="be-caret"></span>
          <span>自定义字体（${list.length}）</span>
        </div>
        <div class="be-tpl-group-body">
          ${list.map(f => {
            const fid = `custom-${f.id}`;
            const active = settings.font === fid;
            return `
              <div class="be-font-custom-row ${active?'active':''}" data-k="${fid}">
                <span class="be-tpl-custom-name" style="font-family:${escapeHtml(f.fontFamily || 'inherit')};">${escapeHtml(f.name || '未命名')}</span>
                <button data-fdel="${f.id}" title="删除">×</button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
  function deleteCustomFont(fid) {
    const list = (settings.customFonts || []).filter(f => f.id !== fid);
    settings.customFonts = list;
    if (settings.font === `custom-${fid}`) settings.font = 'kinghwa';
    saveSettings(settings);
    injectCustomFontStyles();
    renderSettings();
  }

  // "使用说明"折叠区：脱离酒馆助手后，说明/版本号不再依赖宿主工具的展示位，自己在面板底部带一份
  let _aboutOpen = false;
  function renderAboutGroup() {
    return `
      <div class="be-tpl-group ${_aboutOpen ? 'open' : ''}" id="be-about-group">
        <div class="be-tpl-group-head" id="be-about-group-head">
          <span class="be-caret"></span>
          <span>使用说明 · v${VERSION}</span>
        </div>
        <div class="be-tpl-group-body">
          <div class="be-about-sec">
            <div class="be-about-h">划线 / 想法</div>
            <div class="be-about-p">选中聊天里的文字，浮动栏点"划线"（可选下划线/波浪线/荧光笔样式和颜色）或"想法"。点已有划线会弹出工具栏：复制、删划线、写想法、想法列表、做书摘。</div>
          </div>
          <div class="be-about-sec">
            <div class="be-about-h">划线合并</div>
            <div class="be-about-p">设置里开启后，点已有划线的工具栏上会多一个"加入合并"；笔记本详情页也能勾选批量加入。攒够了点悬浮篮子或笔记本的"完成"，选择存为笔记本条目还是直接生成书摘卡片，也可以选是否删除原来的散乱划线，这两步都能勾选"记住"跳过下次询问。</div>
          </div>
          <div class="be-about-sec">
            <div class="be-about-h">书摘卡片</div>
            <div class="be-about-p">浮动栏"书摘"或点已有划线的工具栏都能生成卡片。模板/颜色/字体/字号在此设置面板调，也可在卡片预览页临时改。支持正文打码、保留删除线、自定义模板导入（JSON/CSS，选择器写 .be-card.be-custom）。</div>
          </div>
          <div class="be-about-sec">
            <div class="be-about-h">笔记本</div>
            <div class="be-about-p">扩展菜单"书摘笔记"进入，按角色查看所有划线/想法，支持搜索和按类型/样式/颜色筛选。</div>
          </div>
          <div class="be-about-sec">
            <div class="be-about-h">数据</div>
            <div class="be-about-p">所有内容存在浏览器 localStorage，不上传服务器。设置 - 数据 里可以导出/导入/清空。</div>
          </div>
          <div class="be-about-sec be-about-author">作者：时鸢</div>
        </div>
      </div>
    `;
  }

  // 渲染"自定义模板"折叠区
  let _customTplOpen = false;
  function renderCustomTemplateGroup() {
    const list = Array.isArray(settings.customTemplates) ? settings.customTemplates : [];
    if (!list.length) return '';
    return `
      <div class="be-tpl-group ${_customTplOpen ? 'open' : ''}" id="be-tpl-group">
        <div class="be-tpl-group-head" id="be-tpl-group-head">
          <span class="be-caret"></span>
          <span>自定义模板（${list.length}）</span>
        </div>
        <div class="be-tpl-group-body">
          ${list.map(t => {
            const id = `custom-${t.id}`;
            const active = settings.template === id;
            return `
              <div class="be-tpl-custom-row ${active?'active':''}" data-k="${id}">
                <span class="be-tpl-custom-name">${escapeHtml(t.name || '未命名')}</span>
                <button data-export="${t.id}" title="导出为 JSON">⬇</button>
                <button data-del="${t.id}" title="删除">×</button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // 导入自定义字体（名称 + 完整 CSS 片段）
  function openImportFontDialog() {
    const MASK_ID = 'be-import-font-mask';
    let mask = mainDoc.getElementById(MASK_ID);
    if (!mask) {
      mask = mainDoc.createElement('div');
      mask.id = MASK_ID;
      mask.className = 'be-import-tpl-mask';
      mask.innerHTML = `
        <div class="be-import-tpl-box">
          <div class="be-src-title">导入自定义字体</div>
          <div class="be-src-field">
            <label>字体名称</label>
            <input type="text" id="be-imp-font-name" placeholder="">
          </div>
          <div class="be-src-field">
            <label>CSS 代码（粘贴 @import 行 + font-family 声明）</label>
            <textarea id="be-imp-font-css" rows="6"
              placeholder='@import url("https://fontsapi.zeoseven.com/2/main/result.css");\n\nbody {\n  font-family: "LXGW ZhenKai GB";\n  font-weight: normal;\n}'></textarea>
          </div>
          <div class="be-src-field" style="font-size:11px;opacity:0.7;">
            脚本只会提取 @import 行注入全局，font-family 名称从声明中自动识别。
          </div>
          <div class="be-src-actions">
            <button class="be-btn" id="be-imp-font-cancel">取消</button>
            <button class="be-btn primary" id="be-imp-font-save">保存</button>
          </div>
        </div>
      `;
      mainDoc.body.appendChild(mask);
      mask.addEventListener('click', e => { if (e.target === mask) mask.classList.remove('open'); });
    } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    detectAndApplyTheme();
    mask.querySelector('#be-imp-font-name').value = '';
    mask.querySelector('#be-imp-font-css').value = '';
    mask.classList.add('open');

    const close = () => mask.classList.remove('open');
    const reNew = (sel, fn) => {
      const el = mask.querySelector(sel);
      const clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);
      clone.addEventListener('click', fn);
    };
    reNew('#be-imp-font-cancel', close);
    reNew('#be-imp-font-save', () => {
      const name = mask.querySelector('#be-imp-font-name').value.trim() || '未命名';
      const css = mask.querySelector('#be-imp-font-css').value.trim();
      if (!css) { toast('CSS 不能为空', 'error'); return; }
      // 从 CSS 里提取 font-family 值
      const fm = css.match(/font-family\s*:\s*([^;]+)/);
      const fontFamily = fm ? fm[1].trim() : 'sans-serif';
      const id = 'f' + Date.now() + Math.random().toString(36).slice(2, 5);
      const list = Array.isArray(settings.customFonts) ? settings.customFonts : [];
      list.push({ id, name, css, fontFamily });
      settings.customFonts = list;
      settings.font = `custom-${id}`;
      saveSettings(settings);
      injectCustomFontStyles();
      _customFontOpen = true;
      close();
      renderSettings();
      toast('已导入字体', 'success');
    });
  }

  // 导入自定义模板（名称 + CSS）
  function openImportTemplateDialog() {
    let mask = mainDoc.getElementById('be-import-tpl-mask');
    if (!mask) {
      mask = mainDoc.createElement('div');
      mask.id = 'be-import-tpl-mask';
      mask.className = 'be-import-tpl-mask';
      mask.innerHTML = `
        <div class="be-import-tpl-box">
          <div class="be-src-title">导入自定义模板</div>
          <div class="be-src-field">
            <label>模板名称</label>
            <input type="text" id="be-imp-name" placeholder="例如：我的模板">
          </div>
          <div class="be-src-field">
            <label>CSS（选择器使用 .be-card.tpl-custom-&lt;你的 id&gt; 或 .be-card.be-custom）</label>
            <textarea id="be-imp-css" rows="10" placeholder=".be-card.be-custom { padding: 40px; }
.be-card.be-custom .be-quote { font-size: 22px; }"></textarea>
          </div>
          <div class="be-src-field" style="font-size:11px;opacity:0.7;">
            可用结构：.be-head / .be-avatar / .be-name / .be-date / .be-date-cn / .be-quote / .be-source .title / .be-source .chapter / .be-source .author / .be-watermark
          </div>
          <div class="be-src-actions">
            <button class="be-btn" id="be-imp-cancel">取消</button>
            <button class="be-btn" id="be-imp-file">从文件导入</button>
            <button class="be-btn primary" id="be-imp-save">保存</button>
          </div>
        </div>
      `;
      mainDoc.body.appendChild(mask);
      mask.addEventListener('click', e => { if (e.target === mask) mask.classList.remove('open'); });
    } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    detectAndApplyTheme();
    mask.querySelector('#be-imp-name').value = '';
    mask.querySelector('#be-imp-css').value = '';
    mask.classList.add('open');

    const close = () => mask.classList.remove('open');
    const reNew = (sel, fn) => {
      const el = mask.querySelector(sel);
      const clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);
      clone.addEventListener('click', fn);
    };
    reNew('#be-imp-cancel', close);
    reNew('#be-imp-file', () => {
      const inp = mainDoc.createElement('input');
      inp.type = 'file';
      inp.accept = '.css,.json,text/css,application/json';
      inp.addEventListener('change', ev => {
        const f = ev.target.files[0]; if (!f) return;
        const fr = new FileReader();
        fr.onload = () => {
          let css = String(fr.result || '');
          let name = f.name.replace(/\.(css|json)$/i, '');
          // 如果是 json 格式 {name, css}
          try {
            const j = JSON.parse(css);
            if (j && typeof j === 'object' && j.css) {
              name = j.name || name;
              css = j.css;
            }
          } catch (e) {}
          mask.querySelector('#be-imp-name').value = name;
          mask.querySelector('#be-imp-css').value = css;
        };
        fr.readAsText(f);
      });
      inp.click();
    });
    reNew('#be-imp-save', () => {
      const name = mask.querySelector('#be-imp-name').value.trim() || '未命名';
      let css = mask.querySelector('#be-imp-css').value.trim();
      if (!css) { toast('CSS 不能为空', 'error'); return; }
      const id = 't' + Date.now() + Math.random().toString(36).slice(2, 5);
      // 把 .be-custom 选择器替换成本模板的实际 id 选择器
      const selector = `.be-card.tpl-custom-${id}`;
      css = css.replace(/\.be-card\.be-custom\b/g, selector);
      const list = Array.isArray(settings.customTemplates) ? settings.customTemplates : [];
      list.push({ id, name, css });
      settings.customTemplates = list;
      saveSettings(settings);
      injectCustomTemplateStyles();
      _customTplOpen = true;
      close();
      renderSettings();
      toast('已导入模板', 'success');
    });
  }

  function deleteCustomTemplate(tid) {
    const list = (settings.customTemplates || []).filter(t => t.id !== tid);
    settings.customTemplates = list;
    // 如果删的是当前选中的，退回经典
    if (settings.template === `custom-${tid}`) settings.template = 'classic';
    saveSettings(settings);
    injectCustomTemplateStyles();
    renderSettings();
    if (mainDoc.getElementById('be-card')) renderCard(lastText);
  }

  function renderSettings() {
    const body = mainDoc.getElementById('be-p-body');
    if (!body) return;
    const _savedScroll = body.scrollTop;
    const isCustomColor = settings.colorPreset === 'custom';

    body.innerHTML = `
      <div class="be-sec">
        <h4>模板（排版）</h4>
        <div class="be-tpl-grid">
          ${Object.entries(TEMPLATES).map(([k, v]) => `
            <div class="be-tpl-card ${settings.template===k?'active':''}" data-k="${k}">${v.name}</div>
          `).join('')}
          <div class="be-tpl-card be-tpl-import" id="be-tpl-import">+ 导入</div>
        </div>
        ${renderCustomTemplateGroup()}
      </div>

      <div class="be-sec">
        <h4>颜色</h4>
        <div class="be-color-grid">
          ${COLOR_PRESETS.map(p => `
            <div class="be-color-dot ${settings.colorPreset===p.id?'active':''}" data-k="${p.id}"
                 title="${escapeHtml(p.name)}"
                 style="background:${p.bg};color:${p.fg};">A</div>
          `).join('')}
          <div class="be-color-dot rainbow ${isCustomColor?'active':''}" data-k="custom" title="自定义"></div>
        </div>
        <div class="be-row" style="margin-top:10px;">
          <label style="flex:1;">自定义背景</label>
          <input type="color" id="be-custom-bg" value="${escapeHtml(settings.customBg || '#f5f1e8')}" ${isCustomColor?'':'disabled'}>
        </div>
        <div class="be-row">
          <label style="flex:1;">自定义字体颜色</label>
          <label class="be-toggle" ${isCustomColor?'':'style="opacity:0.4;pointer-events:none;"'}>
            <input type="checkbox" id="be-custom-fg-on" ${settings.customFgEnabled?'checked':''} ${isCustomColor?'':'disabled'}>
            <span class="be-slider"></span>
          </label>
          <input type="color" id="be-custom-fg" value="${escapeHtml(settings.customFg || '#222222')}" ${(isCustomColor && settings.customFgEnabled)?'':'disabled'} style="margin-left:8px;">
        </div>
        <div class="be-row" style="font-size:11px;opacity:0.7;">
          <span>关闭"自定义字色"时，按背景明度自动配深/浅字</span>
        </div>
      </div>

      <div class="be-sec">
        <h4>字体</h4>
        <div class="be-font-grid">
          ${Object.entries(FONTS).map(([k, v]) => {
            const rawCss = k === 'follow_theme'
              ? (() => { try { const _el = mainDoc.querySelector('.mes_text') || mainDoc.body; return mainWin.getComputedStyle(_el).fontFamily || 'inherit'; } catch(e){ return 'inherit'; } })()
              : v.css;
            const safeCss = (rawCss || '').replace(/"/g, "'");
            return `<div class="be-font-card ${settings.font===k?'active':''}" data-k="${k}"
                 style="${safeCss ? `font-family:${safeCss};` : ''}">${escapeHtml(v.name)}</div>`;
          }).join('')}
          <div class="be-font-card be-tpl-import" id="be-font-import">+ 导入字体</div>
        </div>
        ${renderCustomFontGroup()}
      </div>

      <div class="be-sec">
        <h4>划线色系（筛选/工具栏的 5 色）</h4>
        <div class="be-palette-grid">
          ${Object.entries(PALETTE_SCHEMES).map(([k, v]) => `
            <div class="be-palette-card ${settings.palette===k?'active':''}" data-k="${k}">
              <div class="be-palette-name">${v.name}</div>
              <div class="be-palette-row">
                ${v.colors.map(c => `<span class="be-palette-dot" style="background:${c};"></span>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="be-sec">
        <h4>划线样式</h4>
        <div class="be-row">
          <div class="be-radio-group" id="be-hl-group">
            <button class="be-radio-opt ${settings.highlightStyle==='underline'?'active':''}" data-v="underline">下划线</button>
            <button class="be-radio-opt ${settings.highlightStyle==='wavy'?'active':''}" data-v="wavy">波浪线</button>
            <button class="be-radio-opt ${settings.highlightStyle==='marker'?'active':''}" data-v="marker">荧光笔</button>
          </div>
        </div>
        <div class="be-row">
          <label style="flex:1;">下划线颜色</label>
          <input type="color" id="be-color-underline" value="${escapeHtml(settings.underlineColor || '#c9a76a')}">
          <button class="be-btn" id="be-color-underline-reset" style="padding:3px 8px;font-size:11px;">还原</button>
        </div>
        <div class="be-row">
          <label style="flex:1;">荧光笔颜色</label>
          <input type="color" id="be-color-marker" value="${escapeHtml(settings.markerColor || '#ffdc6e')}">
          <button class="be-btn" id="be-color-marker-reset" style="padding:3px 8px;font-size:11px;">还原</button>
        </div>
        <div class="be-row">
          <label style="flex:1;">想法虚线颜色（只想法没划线时）</label>
          <input type="color" id="be-color-thought" value="${escapeHtml(settings.thoughtLineColor || '#ffdc6e')}">
        </div>
        <div class="be-row">
          <label style="flex:1;">有想法的划线自动提升明度</label>
          <label class="be-toggle">
            <input type="checkbox" id="be-thought-boost" ${settings.thoughtBoost?'checked':''}>
            <span class="be-slider"></span>
          </label>
        </div>
        <div class="be-row">
          <label style="flex:1;">划线穿过特殊格式时剥离原样式</label>
          <label class="be-toggle">
            <input type="checkbox" id="be-strip" ${settings.stripStyle?'checked':''}>
            <span class="be-slider"></span>
          </label>
        </div>
      </div>

      <div class="be-sec">
        <h4>排版</h4>
        <div class="be-typo-presets">
          <span data-typo="compact">紧凑</span>
          <span data-typo="normal">默认</span>
          <span data-typo="loose">宽松</span>
        </div>
        <div class="be-row">
          <label style="flex:1;">正文字号 <span class="be-val" id="be-qsize-val">${Number(settings.quoteFontSize)||19}px</span></label>
          <input type="range" id="be-qsize" min="14" max="22" step="1" value="${Number(settings.quoteFontSize)||19}">
        </div>
        <div class="be-row">
          <label style="flex:1;">行距 <span class="be-val" id="be-qlh-val">${Number(settings.quoteLineHeight)||2.05}</span></label>
          <input type="range" id="be-qlh" min="1.5" max="2.3" step="0.05" value="${Number(settings.quoteLineHeight)||2.05}">
        </div>
        <div class="be-row">
          <label style="flex:1;">字间距 <span class="be-val" id="be-qls-val">${isFinite(Number(settings.quoteLetterSpacing))?Number(settings.quoteLetterSpacing):0.04}em</span></label>
          <input type="range" id="be-qls" min="0" max="0.15" step="0.01" value="${isFinite(Number(settings.quoteLetterSpacing))?Number(settings.quoteLetterSpacing):0.04}">
        </div>
        <div class="be-row">
          <label style="flex:1;">整体宽度 <span class="be-val" id="be-qwidth-val">${Number(settings.cardWidth)||440}px</span></label>
          <input type="range" id="be-qwidth" min="300" max="440" step="10" value="${Number(settings.cardWidth)||440}">
        </div>
      </div>

      <div class="be-sec">
        <h4>显示</h4>
        <div class="be-row">
          <label style="flex:1;">显示头像</label>
          <label class="be-toggle">
            <input type="checkbox" id="be-show-avatar" ${settings.showAvatar?'checked':''}>
            <span class="be-slider"></span>
          </label>
        </div>
        <div class="be-row">
          <label style="flex:1;">头像类型</label>
          <div class="be-radio-group" id="be-avatar-type-group">
            <button class="be-radio-opt ${(settings.avatarType||'user')==='user'?'active':''}" data-v="user">用户</button>
            <button class="be-radio-opt ${settings.avatarType==='char'?'active':''}" data-v="char">角色</button>
            <button class="be-radio-opt ${settings.avatarType==='custom'?'active':''}" data-v="custom">自定义</button>
          </div>
        </div>
        <div class="be-row" id="be-custom-avatar-row" style="${settings.avatarType==='custom'?'':'display:none;'}">
          <div class="be-avatar-preview ${settings.customAvatar?'':'empty'}" id="be-avatar-preview"
               style="${settings.customAvatar?`background-image:url('${settings.customAvatar}');`:''}"></div>
          <div style="flex:1;display:flex;gap:6px;">
            <button class="be-btn" id="be-avatar-upload">上传图片</button>
            <button class="be-btn" id="be-avatar-clear" ${settings.customAvatar?'':'disabled'}>清除</button>
          </div>
        </div>
        <div class="be-row">
          <label style="flex:1;">显示日期</label>
          <label class="be-toggle">
            <input type="checkbox" id="be-show-date" ${settings.showDate?'checked':''}>
            <span class="be-slider"></span>
          </label>
        </div>
        <div class="be-row">
          <label style="flex:1;">显示书名（需在「编辑出处」里填写）</label>
          <label class="be-toggle">
            <input type="checkbox" id="be-show-booktitle" ${settings.showSourceTitle?'checked':''}>
            <span class="be-slider"></span>
          </label>
        </div>
        <div class="be-row">
          <label style="flex:1;">显示水印</label>
          <label class="be-toggle">
            <input type="checkbox" id="be-show-watermark" ${settings.showWatermark!==false?'checked':''}>
            <span class="be-slider"></span>
          </label>
        </div>
        <div class="be-row be-row-stack">
          <label>水印文字</label>
          <input type="text" id="be-watermark-text" value="${escapeHtml(settings.watermarkText || '')}"
                 placeholder="留空默认显示 SillyTavern"
                 style="width:100%;box-sizing:border-box;background:var(--be-panel-input-bg);border:1px solid var(--be-panel-input-border);color:inherit;padding:7px 10px;border-radius:6px;font-size:13px;">
        </div>
        <div class="be-row">
          <label style="flex:1;">想法书摘·原句引用符号</label>
          <label class="be-toggle">
            <input type="checkbox" id="be-show-thought-quote" ${settings.showThoughtQuote!==false?'checked':''}>
            <span class="be-slider"></span>
          </label>
        </div>
      </div>

      <div class="be-sec">
        <h4>出处</h4>
        <div class="be-row" style="font-size:12px;opacity:0.8;">
          <span style="flex:1;">用户名：${escapeHtml(settings.sourceUser || '（默认：{{user}}）')}</span>
        </div>
        <div class="be-row" style="font-size:12px;opacity:0.8;">
          <span style="flex:1;">作者：${escapeHtml(settings.sourceAuthor || '（默认：{{char}}）')}</span>
        </div>
        <div class="be-row" style="font-size:12px;opacity:0.8;">
          <span style="flex:1;">书名：${escapeHtml(settings.sourceTitle || '（未填，不显示）')}</span>
        </div>
        <div class="be-row" style="gap:6px;">
          <button class="be-btn" id="be-edit-source-btn">编辑出处</button>
        </div>
      </div>

      <div class="be-sec">
        <h4>划线合并</h4>
        <div class="be-row">
          <label style="flex:1;">把不连续的几句话拼成一条书摘</label>
          <label class="be-toggle">
            <input type="checkbox" id="be-merge-enabled" ${settings.mergeEnabled?'checked':''}>
            <span class="be-slider"></span>
          </label>
        </div>
        <div class="be-row" style="font-size:11px;opacity:0.7;">
          <span>开启后：点已有划线可"加入合并"，笔记本里也能勾选加入；关闭后界面完全不变</span>
        </div>
        <div id="be-merge-opts-block" style="${settings.mergeEnabled ? '' : 'display:none;'}">
          <div class="be-row" style="margin-top:8px;">
            <label style="flex:1;">合并完成后</label>
          </div>
          <div class="be-row">
            <div class="be-radio-group" id="be-merge-target-group" style="width:100%;">
              <button type="button" class="be-radio-opt ${!settings.mergeDefaultTarget?'active':''}" data-v="">每次询问</button>
              <button type="button" class="be-radio-opt ${settings.mergeDefaultTarget==='note'?'active':''}" data-v="note">存为笔记</button>
              <button type="button" class="be-radio-opt ${settings.mergeDefaultTarget==='card'?'active':''}" data-v="card">生成书摘</button>
            </div>
          </div>
          <div class="be-row" style="margin-top:8px;">
            <label style="flex:1;">合并后原划线</label>
          </div>
          <div class="be-row">
            <div class="be-radio-group" id="be-merge-delorig-group" style="width:100%;">
              <button type="button" class="be-radio-opt ${!settings.mergeDeleteOriginal?'active':''}" data-v="">每次询问</button>
              <button type="button" class="be-radio-opt ${settings.mergeDeleteOriginal==='delete'?'active':''}" data-v="delete">删除原划线</button>
              <button type="button" class="be-radio-opt ${settings.mergeDeleteOriginal==='keep'?'active':''}" data-v="keep">保留原划线</button>
            </div>
          </div>
        </div>
      </div>

      <div class="be-sec">
        <h4>数据</h4>
        <div class="be-row" style="gap:6px;">
          <button class="be-btn" id="be-export-all">导出全部</button>
          <button class="be-btn" id="be-import-all">导入</button>
          <button class="be-btn danger" id="be-clear-all">清空</button>
        </div>
      </div>

      <div class="be-sec">
        ${renderAboutGroup()}
      </div>
    `;

    // 绑定
    body.querySelectorAll('.be-tpl-card').forEach(el => {
      if (el.id === 'be-tpl-import') {
        el.addEventListener('click', openImportTemplateDialog);
        return;
      }
      el.addEventListener('click', () => {
        settings.template = el.getAttribute('data-k');
        saveSettings(settings);
        renderSettings();
        if (mainDoc.getElementById('be-card')) renderCard(lastText);
      });
    });
    body.querySelector('#be-tpl-group-head')?.addEventListener('click', () => {
      _customTplOpen = !_customTplOpen;
      body.querySelector('#be-tpl-group')?.classList.toggle('open', _customTplOpen);
    });
    body.querySelectorAll('.be-tpl-custom-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('button[data-del]')) return;
        settings.template = row.getAttribute('data-k');
        saveSettings(settings);
        renderSettings();
        if (mainDoc.getElementById('be-card')) renderCard(lastText);
      });
    });
    body.querySelectorAll('.be-tpl-custom-row button[data-del]').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        const tid = b.getAttribute('data-del');
        if (!mainWin.confirm('删除这个自定义模板？')) return;
        deleteCustomTemplate(tid);
      });
    });
    body.querySelectorAll('.be-tpl-custom-row button[data-export]').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        const tid = b.getAttribute('data-export');
        try {
          const tpl = (settings.customTemplates || []).find(x => x.id === tid);
          if (!tpl) { toast('找不到模板', 'error'); return; }
          // 转义 id 里的 regex 特殊字符
          const idEsc = String(tpl.id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const cssOut = (tpl.css || '').replace(
            new RegExp('\\.be-card\\.tpl-custom-' + idEsc, 'g'),
            '.be-card.be-custom'
          );
          const payload = { name: tpl.name || '未命名', css: cssOut };
          const text = JSON.stringify(payload, null, 2);
          const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
          const dlName = String(tpl.name || '模板').replace(/[\\/:*?"<>|]/g, '_') + '.json';
          triggerDownload(blob, dlName);
          toast('已导出 ' + dlName, 'success');
        } catch (err) {
          console.error('[BookExcerpt] export failed', err);
          toast('导出失败：' + (err?.message || err), 'error');
        }
      });
    });
    body.querySelectorAll('.be-color-dot').forEach(el => {
      el.addEventListener('click', () => {
        settings.colorPreset = el.getAttribute('data-k');
        saveSettings(settings);
        renderSettings();
        if (mainDoc.getElementById('be-card')) renderCard(lastText);
      });
    });
    body.querySelector('#be-custom-bg')?.addEventListener('input', e => {
      settings.customBg = e.target.value;
      saveSettings(settings);
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
    });
    body.querySelector('#be-custom-fg-on')?.addEventListener('change', e => {
      settings.customFgEnabled = e.target.checked;
      saveSettings(settings);
      renderSettings();
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
    });
    body.querySelector('#be-custom-fg')?.addEventListener('input', e => {
      settings.customFg = e.target.value;
      saveSettings(settings);
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
    });
    body.querySelectorAll('.be-font-card').forEach(el => {
      if (el.id === 'be-font-import') return;
      el.addEventListener('click', () => {
        settings.font = el.getAttribute('data-k');
        saveSettings(settings);
        loadFontStylesheets();
        renderSettings();
        if (mainDoc.getElementById('be-card')) renderCard(lastText);
      });
    });
    body.querySelector('#be-font-import')?.addEventListener('click', openImportFontDialog);
    body.querySelector('#be-font-group-head')?.addEventListener('click', () => {
      _customFontOpen = !_customFontOpen;
      body.querySelector('#be-font-group')?.classList.toggle('open', _customFontOpen);
    });
    body.querySelector('#be-about-group-head')?.addEventListener('click', () => {
      _aboutOpen = !_aboutOpen;
      body.querySelector('#be-about-group')?.classList.toggle('open', _aboutOpen);
    });
    body.querySelectorAll('.be-font-custom-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('button[data-fdel]')) return;
        settings.font = row.getAttribute('data-k');
        saveSettings(settings);
        injectCustomFontStyles();
        renderSettings();
        if (mainDoc.getElementById('be-card')) renderCard(lastText);
      });
    });
    body.querySelectorAll('.be-font-custom-row button[data-fdel]').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        const fid = b.getAttribute('data-fdel');
        if (!mainWin.confirm('删除这个自定义字体？')) return;
        deleteCustomFont(fid);
      });
    });
    body.querySelectorAll('.be-palette-card').forEach(el => {
      el.addEventListener('click', () => {
        settings.palette = el.getAttribute('data-k');
        saveSettings(settings);
        renderSettings();
      });
    });
    body.querySelectorAll('#be-hl-group .be-radio-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        settings.highlightStyle = btn.getAttribute('data-v');
        saveSettings(settings);
        body.querySelectorAll('#be-hl-group .be-radio-opt').forEach(b => b.classList.toggle('active', b === btn));
      });
    });
    body.querySelector('#be-color-underline')?.addEventListener('input', e => {
      settings.underlineColor = e.target.value;
      saveSettings(settings);
      refreshStyle();
    });
    body.querySelector('#be-color-underline-reset')?.addEventListener('click', () => {
      settings.underlineColor = DEFAULT_SETTINGS.underlineColor;
      saveSettings(settings); refreshStyle(); renderSettings();
    });
    body.querySelector('#be-color-marker')?.addEventListener('input', e => {
      settings.markerColor = e.target.value;
      saveSettings(settings); refreshStyle();
    });
    body.querySelector('#be-color-marker-reset')?.addEventListener('click', () => {
      settings.markerColor = DEFAULT_SETTINGS.markerColor;
      saveSettings(settings); refreshStyle(); renderSettings();
    });
    body.querySelector('#be-color-thought')?.addEventListener('input', e => {
      settings.thoughtLineColor = e.target.value;
      saveSettings(settings); refreshStyle();
    });
    body.querySelector('#be-thought-boost')?.addEventListener('change', e => {
      settings.thoughtBoost = e.target.checked;
      saveSettings(settings);
      mainDoc.body.classList.toggle('be-thought-boost', settings.thoughtBoost);
    });
    body.querySelector('#be-strip')?.addEventListener('change', e => {
      settings.stripStyle = e.target.checked;
      saveSettings(settings);
    });
    body.querySelector('#be-show-avatar')?.addEventListener('change', e => {
      settings.showAvatar = e.target.checked;
      saveSettings(settings);
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
    });
    body.querySelectorAll('#be-avatar-type-group .be-radio-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        settings.avatarType = btn.getAttribute('data-v');
        saveSettings(settings);
        body.querySelectorAll('#be-avatar-type-group .be-radio-opt').forEach(b => b.classList.toggle('active', b === btn));
        const row = body.querySelector('#be-custom-avatar-row');
        if (row) row.style.display = settings.avatarType === 'custom' ? '' : 'none';
        if (mainDoc.getElementById('be-card')) renderCard(lastText);
      });
    });
    body.querySelector('#be-avatar-upload')?.addEventListener('click', () => {
      const inp = mainDoc.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.addEventListener('change', async ev => {
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;
        try {
          const dataUrl = await fileToCompressedAvatar(f);
          settings.customAvatar = dataUrl;
          saveSettings(settings);
          const prev = body.querySelector('#be-avatar-preview');
          if (prev) {
            prev.style.backgroundImage = `url('${dataUrl}')`;
            prev.classList.remove('empty');
          }
          const clr = body.querySelector('#be-avatar-clear');
          if (clr) clr.disabled = false;
          if (mainDoc.getElementById('be-card')) renderCard(lastText);
          toast('已上传头像', 'success');
        } catch (e) {
          toast('上传失败：' + (e?.message || e), 'error');
        }
      });
      inp.click();
    });
    body.querySelector('#be-avatar-clear')?.addEventListener('click', () => {
      if (!settings.customAvatar) return;
      if (!mainWin.confirm('清除自定义头像？')) return;
      settings.customAvatar = '';
      saveSettings(settings);
      const prev = body.querySelector('#be-avatar-preview');
      if (prev) { prev.style.backgroundImage = ''; prev.classList.add('empty'); }
      const clr = body.querySelector('#be-avatar-clear');
      if (clr) clr.disabled = true;
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
    });
    // 字号 / 行距 / 字距 / 排版预设
    const applyTypo = (size, lh, ls) => {
      settings.quoteFontSize = size;
      settings.quoteLineHeight = lh;
      settings.quoteLetterSpacing = ls;
      saveSettings(settings);
      const sEl = body.querySelector('#be-qsize'); if (sEl) sEl.value = size;
      const lEl = body.querySelector('#be-qlh'); if (lEl) lEl.value = lh;
      const lsEl = body.querySelector('#be-qls'); if (lsEl) lsEl.value = ls;
      const sV = body.querySelector('#be-qsize-val'); if (sV) sV.textContent = size + 'px';
      const lV = body.querySelector('#be-qlh-val'); if (lV) lV.textContent = lh;
      const lsV = body.querySelector('#be-qls-val'); if (lsV) lsV.textContent = ls + 'em';
      applyTypoLive();
    };
    body.querySelector('#be-qsize')?.addEventListener('input', e => {
      const v = Number(e.target.value);
      settings.quoteFontSize = v;
      markTypoDragging();
      saveSettingsDebounced();
      const sV = body.querySelector('#be-qsize-val'); if (sV) sV.textContent = v + 'px';
      applyTypoLive();
    });
    body.querySelector('#be-qlh')?.addEventListener('input', e => {
      const v = Number(e.target.value);
      settings.quoteLineHeight = v;
      markTypoDragging();
      saveSettingsDebounced();
      const lV = body.querySelector('#be-qlh-val'); if (lV) lV.textContent = v;
      applyTypoLive();
    });
    body.querySelector('#be-qls')?.addEventListener('input', e => {
      const v = Number(e.target.value);
      settings.quoteLetterSpacing = v;
      markTypoDragging();
      saveSettingsDebounced();
      const lsV = body.querySelector('#be-qls-val'); if (lsV) lsV.textContent = v + 'em';
      applyTypoLive();
    });
    body.querySelector('#be-qwidth')?.addEventListener('input', e => {
      const v = Number(e.target.value);
      settings.cardWidth = v;
      markTypoDragging();
      saveSettingsDebounced();
      const wV = body.querySelector('#be-qwidth-val'); if (wV) wV.textContent = v + 'px';
      applyTypoLive();
    });
    // 松手(change)立即落盘一次，兜住防抖未触发就关闭的情况
    ['#be-qsize', '#be-qlh', '#be-qls', '#be-qwidth'].forEach(id => {
      body.querySelector(id)?.addEventListener('change', () => saveSettings(settings));
    });
    body.querySelectorAll('[data-typo]').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.getAttribute('data-typo');
        if (k === 'compact') applyTypo(16, 1.7, 0.02);
        else if (k === 'loose') applyTypo(21, 2.3, 0.08);
        else applyTypo(19, 2.05, 0.04);
      });
    });
    body.querySelector('#be-show-watermark')?.addEventListener('change', e => {
      settings.showWatermark = e.target.checked;
      saveSettings(settings);
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
    });
    body.querySelector('#be-watermark-text')?.addEventListener('input', e => {
      settings.watermarkText = e.target.value;
      saveSettings(settings);
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
    });
    body.querySelector('#be-show-thought-quote')?.addEventListener('change', e => {
      settings.showThoughtQuote = e.target.checked;
      saveSettings(settings);
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
    });
    body.querySelector('#be-show-date')?.addEventListener('change', e => {
      settings.showDate = e.target.checked;
      saveSettings(settings);
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
    });
    body.querySelector('#be-show-booktitle')?.addEventListener('change', e => {
      settings.showSourceTitle = e.target.checked;
      saveSettings(settings);
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
    });
    body.querySelector('#be-merge-enabled')?.addEventListener('change', e => {
      settings.mergeEnabled = e.target.checked;
      saveSettings(settings);
      // 关掉开关时把篮子清空、悬浮徽标一并收起，不留任何痕迹
      if (!settings.mergeEnabled) clearMergeBasket();
      else updateMergeBadge();
      renderSettings();
      if (panelView === 'char') renderPanel();
    });
    body.querySelectorAll('#be-merge-target-group .be-radio-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        settings.mergeDefaultTarget = btn.getAttribute('data-v');
        saveSettings(settings);
        body.querySelectorAll('#be-merge-target-group .be-radio-opt').forEach(b => b.classList.toggle('active', b === btn));
      });
    });
    body.querySelectorAll('#be-merge-delorig-group .be-radio-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        settings.mergeDeleteOriginal = btn.getAttribute('data-v');
        saveSettings(settings);
        body.querySelectorAll('#be-merge-delorig-group .be-radio-opt').forEach(b => b.classList.toggle('active', b === btn));
      });
    });
    body.querySelector('#be-edit-source-btn')?.addEventListener('click', () => {
      // 关掉/不关 panel 无所谓——出处对话框 z-index 比 panel 高
      openSourceEditor();
      // 监听 source dialog 关闭后刷新设置面板里的预览文本
      const watch = setInterval(() => {
        const m = mainDoc.getElementById('be-source-mask');
        if (!m || !m.classList.contains('open')) {
          clearInterval(watch);
          renderSettings();
        }
      }, 300);
    });
    body.querySelector('#be-export-all')?.addEventListener('click', exportNotes);
    body.querySelector('#be-import-all')?.addEventListener('click', importNotes);
    body.querySelector('#be-clear-all')?.addEventListener('click', () => {
      if (!mainWin.confirm('确定清空所有笔记？此操作不可恢复。')) return;
      mainWin.localStorage.removeItem(LS_NOTES);
      mainDoc.querySelectorAll('.be-highlight').forEach(span => {
        const p = span.parentNode;
        while (span.firstChild) p.insertBefore(span.firstChild, span);
        p.removeChild(span); p.normalize();
      });
      toast('已清空', 'success');
    });
    body.scrollTop = _savedScroll;
  }

  // 防抖刷新列表区（input 节点保持不动，输入法不会被关）
  let _searchDebounce = null;
  function renderNotesList() {
    const body = mainDoc.getElementById('be-p-body');
    if (!body) return;
    const notes = loadNotes();
    const keys = Object.keys(notes).filter(k => notes[k].items.some(it => it.type !== 'excerpt'));
    const totalNotes = keys.reduce((s, k) => s + notes[k].items.filter(it => it.type !== 'excerpt').length, 0);
    if (!keys.length) {
      body.innerHTML = `<div class="be-empty">还没有笔记<br><span style="font-size:11px;">在聊天中选中文字即可创建划线或想法</span></div>`;
      return;
    }
    // 只渲染头部 + 搜索框 + 列表容器；列表内容单独 fill
    body.innerHTML = `
      <div style="font-size:12px;opacity:0.6;margin-bottom:14px;text-align:center;letter-spacing:0.1em;">
        ${totalNotes} 条笔记 · 留在了 ${keys.length} 个角色身上
      </div>
      <div class="be-search">
        <input type="text" id="be-search" placeholder="搜索文字或想法..." value="${escapeHtml(searchKey)}">
      </div>
      <div id="be-notes-list"></div>
    `;
    fillNotesList();
    const searchEl = body.querySelector('#be-search');
    if (searchEl) {
      // 用 input 但 debounce，并且只 fill 列表区，不重建 input
      searchEl.addEventListener('input', e => {
        searchKey = e.target.value;
        clearTimeout(_searchDebounce);
        _searchDebounce = setTimeout(fillNotesList, 200);
      });
    }
  }

  function fillNotesList() {
    const list = mainDoc.getElementById('be-notes-list');
    if (!list) return;
    const notes = loadNotes();
    const keys = Object.keys(notes).filter(k => notes[k].items.some(it => it.type !== 'excerpt'));
    list.innerHTML = keys.sort((a, b) => {
      const ta = Math.max(...notes[a].items.map(x => x.ts || 0));
      const tb = Math.max(...notes[b].items.map(x => x.ts || 0));
      return tb - ta;
    }).map(k => {
      const ch = notes[k];
      const visibleItems = ch.items.filter(it => it.type !== 'excerpt');
      if (searchKey) {
        const hits = visibleItems.filter(it => (it.text || '').includes(searchKey) || (it.thoughts || []).some(t => (t.text||'').includes(searchKey)));
        if (!hits.length) return '';
      }
      const count = visibleItems.length;
      if (!count) return '';
      const lastTs = Math.max(...visibleItems.map(x => x.ts || 0));
      const avatarStyle = ch.avatar ? `background-image:url('${ch.avatar}');` : '';
      return `
        <div class="be-char-card" data-key="${escapeHtml(k)}">
          <div class="be-char-avatar" style="${avatarStyle}"></div>
          <div class="be-char-info">
            <div class="be-char-count"><span class="num">${count}</span> 条笔记</div>
            <div class="be-char-name">${escapeHtml(ch.name)}</div>
            <div class="be-char-meta">最近 ${formatDateTime(lastTs)}</div>
          </div>
        </div>
      `;
    }).join('');
    list.querySelectorAll('.be-char-card').forEach(card => {
      card.addEventListener('click', () => {
        currentCharKey = card.getAttribute('data-key');
        panelView = 'char';
        renderPanel();
      });
    });
  }

  // 角色面板的筛选状态（仅在该角色面板里使用，重渲染保留）
  const charFilter = {
    kind: 'all',           // all | highlight | thought
    style: 'all',          // all | underline | wavy | marker
    color: 'all',          // all | <hex> | custom
    searchKey: ''
  };
  // 笔记本"合并模式"：开启后点笔记卡片是加入/移出合并篮子，而不是打开详情。
  // 每次重新进入角色面板都复位，避免退出再进来时忘记自己还在合并模式里。
  let charMergeMode = false;

  function renderCharNotes(panel) {
    const notes = loadNotes();
    const ch = notes[currentCharKey];
    if (!ch) { panelView = 'notes'; return renderPanel(); }
    charMergeMode = false;
    panel.innerHTML = `
      <div class="be-p-head">
        <button class="be-p-back" id="be-back">‹</button>
        <span class="be-p-title">笔记</span>
        <button class="be-btn" id="be-p-close">×</button>
      </div>
      <div class="be-p-body" id="be-char-body">
        <div class="be-char-head">
          <div class="be-char-title">${escapeHtml(ch.name)}</div>
          ${settings.mergeEnabled ? `<button class="be-filter-btn" id="be-merge-mode-btn">合并</button>` : ''}
          <button class="be-filter-btn" id="be-filter-btn">筛选</button>
        </div>
        <div class="be-char-stats" id="be-char-stats"></div>
        <div class="be-search">
          <input type="text" id="be-search-char" placeholder="在该角色内搜索…" value="${escapeHtml(charFilter.searchKey)}">
        </div>
        <div id="be-char-notes"></div>
      </div>
    `;
    panel.querySelector('#be-back').addEventListener('click', () => { panelView = 'notes'; renderPanel(); });
    panel.querySelector('#be-p-close').addEventListener('click', closePanel);
    panel.querySelector('#be-filter-btn').addEventListener('click', () => openFilterSheet(() => fillCharNotes()));
    panel.querySelector('#be-merge-mode-btn')?.addEventListener('click', e => {
      const wasOn = charMergeMode;
      charMergeMode = !charMergeMode;
      e.target.textContent = charMergeMode ? '完成' : '合并';
      e.target.classList.toggle('active', charMergeMode);
      fillCharNotes();
      // 关闭合并模式（点"完成"）且篮子里有内容 → 直接进入合并收尾，不用再去找悬浮篮子
      if (wasOn && !charMergeMode && mergeBasket.length > 0) finalizeMergeFlow();
    });
    const searchEl = panel.querySelector('#be-search-char');
    if (searchEl) {
      searchEl.addEventListener('input', e => {
        charFilter.searchKey = e.target.value;
        clearTimeout(_searchDebounce);
        _searchDebounce = setTimeout(fillCharNotes, 200);
      });
    }
    fillCharNotes();
  }

  function fillCharNotes() {
    const notes = loadNotes();
    const ch = notes[currentCharKey];
    if (!ch) return;
    const allItems = ch.items.filter(it => it.type !== 'excerpt');
    const hasAnyThought = it => (it.thoughts || []).length > 0;

    const items = allItems.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .filter(it => {
        if (charFilter.kind === 'highlight') return !it.thoughtOnly;
        if (charFilter.kind === 'thought') return hasAnyThought(it) || it.thoughtOnly;
        return true;
      })
      .filter(it => {
        if (charFilter.style === 'all') return true;
        return (it.style || 'underline') === charFilter.style;
      })
      .filter(it => {
        if (charFilter.color === 'all') return true;
        const c = (it.style === 'marker') ? (it.markerColor || settings.markerColor) : (it.underlineColor || settings.underlineColor);
        if (charFilter.color === 'custom') {
          // 非推荐颜色
          return !getPaletteColors().map(x=>x.toLowerCase()).includes((c || '').toLowerCase());
        }
        return (c || '').toLowerCase() === charFilter.color.toLowerCase();
      })
      .filter(it => !charFilter.searchKey
        || (it.text || '').includes(charFilter.searchKey)
        || (it.thoughts || []).some(t => (t.text||'').includes(charFilter.searchKey)));

    // 统计
    const totalH = allItems.filter(x => !x.thoughtOnly).length;
    const totalT = allItems.reduce((s, x) => s + (x.thoughts?.length || 0), 0) + allItems.filter(x => x.thoughtOnly).length;
    const stats = mainDoc.getElementById('be-char-stats');
    if (stats) stats.innerHTML = `${totalH} 条划线 · ${totalT} 条想法`;

    // 按 msgId 分组，msgId 不存或重复用"未分组"
    const groups = {};
    const order = [];
    for (const it of items) {
      const gk = it.msgId || '__nogroup__';
      if (!(gk in groups)) { groups[gk] = []; order.push(gk); }
      groups[gk].push(it);
    }

    const list = mainDoc.getElementById('be-char-notes');
    if (!list) return;
    if (!items.length) {
      list.innerHTML = `<div class="be-empty">没有符合条件的笔记</div>`;
      return;
    }
    list.innerHTML = order.map(gk => {
      const arr = groups[gk];
      const first = arr[0];
      const groupTitle = first.bookName || first.chapterName || '';
      return `
        ${groupTitle ? `<div class="be-group-title">${escapeHtml(groupTitle)}</div>` : ''}
        ${arr.map(it => {
          const ths = it.thoughts || [];
          const hasThought = ths.length > 0 || !!it.thoughtOnly;
          // 想法：FA fa-comment (\\f075)；划线：字母 A
          const iconInner = hasThought
            ? `<i class="fa-solid fa-comment be-fa-comment"></i>`
            : `<span class="be-icon-A">A</span>`;
          const picked = charMergeMode && isInMergeBasket(it.id);
          return `
            <div class="be-note-card ${charMergeMode ? 'be-merge-pickable' : ''} ${picked ? 'be-merge-picked' : ''}" data-id="${it.id}">
              ${charMergeMode ? `<div class="be-merge-check">${picked ? '✓' : ''}</div>` : ''}
              <div class="be-note-icon ${hasThought ? 'is-thought' : 'is-line'}">${iconInner}</div>
              <div class="be-note-body">
                ${it.merged ? `<div class="be-note-merged-tag">合并 · ${it.mergedCount || ''} 段</div>` : ''}
                ${ths.length ? `<div class="be-note-thought-text">${escapeHtml(ths[0].text)}</div>` : ''}
                <div class="be-note-quote ${ths.length ? '' : 'plain'}">${escapeHtml(it.text)}</div>
                ${ths.length > 1 ? `<div class="be-note-more">+${ths.length - 1} 条想法</div>` : ''}
                <div class="be-note-foot">
                  <span class="be-note-time">${formatDateTime(it.ts)}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      `;
    }).join('');
    list.querySelectorAll('.be-note-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        if (charMergeMode) {
          if (isInMergeBasket(id)) {
            removeFromMergeBasket('note:' + id);
          } else {
            const it = allItems.find(x => x.id === id);
            if (it) addToMergeBasket({ text: it.text, source: 'note', noteId: id });
          }
          fillCharNotes();
          return;
        }
        openHighlightViewer(id);
      });
    });
  }

  // 划线色系（5 色系 × 每色系 5 色），顺序与微信阅读不同
  const PALETTE_SCHEMES = {
    morandi:   { name: '莫兰迪',   colors: ['#c9a9a3', '#b5a8c4', '#c2b393', '#9eb3a5', '#a8b5c4'] },
    macaron:   { name: '马卡龙',   colors: ['#f4a3a8', '#c9a4e8', '#f5c97a', '#9adcb0', '#86c4e8'] },
    mondrian:  { name: '蒙德里安', colors: ['#d63f3c', '#f5c93e', '#2a64a6', '#7a4ba0', '#e88a3c'] },
    memphis:   { name: '孟菲斯',   colors: ['#ff6b9d', '#9b5fe0', '#ffc347', '#3acfa0', '#3aa8d8'] },
    matisse:   { name: '马蒂斯',   colors: ['#b94c44', '#d4a13e', '#e88a52', '#3c8d6b', '#1b5e7e'] }
  };
  function getPaletteColors() {
    const p = PALETTE_SCHEMES[settings.palette] || PALETTE_SCHEMES.morandi;
    return p.colors;
  }

  function openFilterSheet(onChange) {
    let mask = mainDoc.getElementById('be-filter-mask');
    if (!mask) {
      mask = mainDoc.createElement('div');
      mask.id = 'be-filter-mask';
      mask.className = 'be-filter-mask';
      mainDoc.body.appendChild(mask);
      mask.addEventListener('click', e => { if (e.target === mask) mask.classList.remove('open'); });
    } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    const kind = charFilter.kind;
    const style = charFilter.style;
    const color = (charFilter.color || 'all').toLowerCase();
    mask.innerHTML = `
      <div class="be-filter-sheet">
        <div class="be-filter-handle"></div>
        <div class="be-filter-h">筛选你要的笔记</div>
        <div class="be-filter-kinds">
          <button class="be-filter-kind ${kind==='highlight'?'active':''}" data-k="highlight">划线</button>
          <button class="be-filter-kind ${kind==='thought'?'active':''}" data-k="thought">想法</button>
        </div>
        <div class="be-filter-block">
          <div class="be-filter-label">划线类型</div>
          <div class="be-filter-styles">
            <div class="be-fs-chip ${style==='underline'?'active':''}" data-v="underline" title="下划线">
              <span class="be-fs-icon"><span class="line-solid"></span>A</span>
            </div>
            <div class="be-fs-chip ${style==='wavy'?'active':''}" data-v="wavy" title="波浪线">
              <span class="be-fs-icon"><span class="line-wavy"></span>A</span>
            </div>
            <div class="be-fs-chip ${style==='marker'?'active':''}" data-v="marker" title="荧光笔">
              <span class="be-fs-icon"><span class="line-marker"></span>A</span>
            </div>
          </div>
          <div class="be-filter-label" style="margin-top:14px;">划线颜色</div>
          <div class="be-filter-colors">
            ${getPaletteColors().map(c => `<div class="be-fc-dot ${color===c.toLowerCase()?'active':''}" data-v="${c}" style="background:${c};"></div>`).join('')}
            <div class="be-fc-dot rainbow ${color==='custom'?'active':''}" data-v="custom" title="自定义颜色">●</div>
          </div>
        </div>
        <div class="be-filter-actions">
          <button class="be-filter-reset" id="be-filter-reset">重 置</button>
          <button class="be-filter-confirm" id="be-filter-confirm">确 定</button>
        </div>
      </div>
    `;
    mask.classList.add('open');
    const close = () => mask.classList.remove('open');

    mask.querySelectorAll('.be-filter-kind').forEach(b => {
      b.addEventListener('click', () => {
        const k = b.getAttribute('data-k');
        // 再次点击同一类型取消
        charFilter.kind = (charFilter.kind === k) ? 'all' : k;
        mask.querySelectorAll('.be-filter-kind').forEach(x => x.classList.toggle('active', x.getAttribute('data-k') === charFilter.kind));
      });
    });
    mask.querySelectorAll('.be-fs-chip').forEach(b => {
      b.addEventListener('click', () => {
        const v = b.getAttribute('data-v');
        charFilter.style = (charFilter.style === v) ? 'all' : v;
        mask.querySelectorAll('.be-fs-chip').forEach(x => x.classList.toggle('active', x.getAttribute('data-v') === charFilter.style));
      });
    });
    mask.querySelectorAll('.be-fc-dot').forEach(b => {
      b.addEventListener('click', () => {
        const v = b.getAttribute('data-v');
        charFilter.color = (charFilter.color === v) ? 'all' : v;
        mask.querySelectorAll('.be-fc-dot').forEach(x => x.classList.toggle('active', x.getAttribute('data-v') === charFilter.color));
      });
    });
    mask.querySelector('#be-filter-reset').addEventListener('click', () => {
      charFilter.kind = 'all'; charFilter.style = 'all'; charFilter.color = 'all';
      onChange && onChange();
      close();
    });
    mask.querySelector('#be-filter-confirm').addEventListener('click', () => {
      onChange && onChange();
      close();
    });
  }

  function exportNotes() {
    const notes = loadNotes();
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `书摘笔记_${formatDate().replace(/\//g, '')}.json`);
    toast('已导出', 'success');
  }
  function importNotes() {
    const input = mainDoc.createElement('input');
    input.type = 'file'; input.accept = 'application/json';
    input.addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const obj = JSON.parse(fr.result);
          if (!obj || typeof obj !== 'object') throw new Error('格式错误');
          const cur = loadNotes();
          // merge
          Object.keys(obj).forEach(k => {
            if (!cur[k]) cur[k] = obj[k];
            else {
              cur[k].items = cur[k].items.concat(obj[k].items.filter(x => !cur[k].items.find(y => y.id === x.id)));
            }
          });
          saveNotes(cur);
          renderPanel();
          toast('导入完成', 'success');
        } catch (e) { toast('导入失败：' + e.message, 'error'); }
      };
      fr.readAsText(f);
    });
    input.click();
  }

  // ---------- 菜单入口 ----------
  function injectMenuEntry() {
    const tryInject = () => {
      const menu = mainDoc.getElementById('extensionsMenu');
      if (!menu) return false;
      const old = mainDoc.getElementById('be-menu-entry');
      if (old && !isStaleGen(old)) return true;
      if (old) { try { old.remove(); } catch (e) {} }   // 旧脚本实例残留：监听器已死，重建
      const div = stampGen(mainDoc.createElement('div'));
      div.id = 'be-menu-entry';
      div.className = 'list-group-item flex-container flexGap5 interactable';
      div.tabIndex = 0;
      div.innerHTML = `<div class="fa-fw fa-solid fa-bookmark extensionsMenuExtensionButton"></div><span>书摘笔记</span>`;
      div.addEventListener('click', () => openPanel('notes'));
      menu.appendChild(div);
      return true;
    };
    if (!tryInject()) {
      const interval = setInterval(() => { if (tryInject()) clearInterval(interval); }, 800);
      setTimeout(() => clearInterval(interval), 60000);
    }
  }

  $(window).on('pagehide', () => {
    ['be-float-bar', 'be-mask', 'be-thought-mask', 'be-source-mask', 'be-panel', 'be-style', 'be-menu-entry',
     'be-hl-bar', 'be-viewer-mask', 'be-imgpop', 'be-merge-badge', 'be-merge-sheet', 'be-merge-target-mask'].forEach(id => {
      mainDoc.getElementById(id)?.remove();
    });
  });

  // ---------- 启动 ----------
  injectStyle();
  loadFontStylesheets();
  // 应用「有想法划线提升明度」class
  if (settings.thoughtBoost) {
    try { mainDoc.body.classList.add('be-thought-boost'); } catch (e) {}
  }
  // 预加载截图库（不阻塞）
  setTimeout(() => { loadH2C().catch(() => {}); }, 1500);

  // 防抖还原（避免多个事件同时触发导致重复包裹）
  let _restoreTimer = null;
  function scheduleRestore(delay = 200) {
    clearTimeout(_restoreTimer);
    _restoreTimer = setTimeout(restoreHighlights, delay);
  }

  setTimeout(() => {
    injectMenuEntry();
    restoreHighlights();
    // 启动后多次重试，覆盖 ST 慢渲染场景
    setTimeout(restoreHighlights, 1500);
    setTimeout(restoreHighlights, 3000);
    toast(`${SCRIPT_NAME} v${VERSION} 已加载`, 'success');
  }, 800);

  // 消息渲染后重新还原划线
  try {
    const eventSource = mainWin.eventSource;
    const eventTypes = mainWin.event_types;
    if (eventSource && eventTypes) {
      const onEvts = [
        'MESSAGE_RECEIVED', 'MESSAGE_SWIPED', 'CHAT_CHANGED',
        'MESSAGE_DELETED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED',
        'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED',
        'MESSAGE_SENT', 'CHAT_LOADED'
      ];
      onEvts.forEach(name => {
        const t = eventTypes[name];
        if (t) eventSource.on(t, () => scheduleRestore(300));
      });
    }
  } catch (e) {}

  // 兜底：MutationObserver 监听 #chat 内的 .mes 增加，自动还原
  try {
    const chatRoot = mainDoc.querySelector('#chat') || mainDoc.body;
    if (chatRoot) {
      const mo = new MutationObserver(muts => {
        let needs = false;
        for (const m of muts) {
          if (m.addedNodes && m.addedNodes.length) {
            for (const n of m.addedNodes) {
              if (n.nodeType !== 1) continue;
              if (n.classList?.contains('mes') || n.querySelector?.('.mes_text')) {
                needs = true; break;
              }
            }
          }
          if (needs) break;
        }
        if (needs) scheduleRestore(300);
      });
      mo.observe(chatRoot, { childList: true, subtree: true });
    }
  } catch (e) {}
});

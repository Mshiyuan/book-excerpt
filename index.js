$(() => {
  const mainDoc = document;
  const mainWin = window;

  const SCRIPT_ID = 'book-excerpt';
  const SCRIPT_NAME = '书摘';
  const VERSION = '1.5.0';
  const LS_SETTINGS = `${SCRIPT_ID}:settings`;
  const LS_NOTES = `${SCRIPT_ID}:notes`;
  const LS_CANVASES = `${SCRIPT_ID}:canvases`;
  // 自由排版功能只在原生扩展形态下开放：Tavern Helper 脚本形态没有 lib/ 目录随包分发这回事，
  // interact.js/Cropper.js 只能内嵌字符串或走 CDN，为这一个功能牺牲太大，所以脚本形态里这个常量
  // 永远是 false（这行本身也绝不能出现 import.meta 这类模块语法，会导致脚本形态直接解析失败）。
  // 扩展仓库生成 index.js 时会把这一行 patch 成 true。
  const IS_EXTENSION = true;
  // 自由排版依赖的两个 vendor 库本地地址，同样只能靠扩展构建 patch 注入（import.meta.url），
  // 脚本形态下永远是空字符串——反正 IS_EXTENSION=false 时功能入口本身就不可达，这两个值不会被用到。
  let LOCAL_INTERACT_URL = '';
  try { LOCAL_INTERACT_URL = new URL('./lib/interact.min.js', import.meta.url).href; } catch (e) {}
  let LOCAL_CROPPER_URL = '';
  try { LOCAL_CROPPER_URL = new URL('./lib/cropper.min.js', import.meta.url).href; } catch (e) {}
  let LOCAL_CROPPER_CSS_URL = '';
  try { LOCAL_CROPPER_CSS_URL = new URL('./lib/cropper.min.css', import.meta.url).href; } catch (e) {}
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
    customBg: '#f5f1e8',           // 自定义背景色（旧版单份自定义配色，仅作迁移源，见 customColors）
    customFgEnabled: false,        // 自定义字色开关（同上，仅作迁移源）
    customFg: '#222222',           // 自定义字色（同上，仅作迁移源）
    customColors: [],              // 用户保存的自定义配色列表 [{id, name, bg, fg, fgEnabled}]
    palette: 'macaron',            // 划线色系：morandi/macaron/mondrian/memphis/matisse
    avatarType: 'user',            // 头像类型：user / char / custom
    customAvatar: '',              // 自定义头像：'idb:<key>'（图片本体在 IndexedDB）；旧版是 dataURL，启动时自动迁移
    exportScale: 3,                // 保存图片时传给 html2canvas 的 scale 倍率（2~5，用户可调；1x太糊已去掉）
    font: 'follow_theme',
    quoteFontSize: 19,             // 正文字号 px（11~22）
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
    selectMode: 'drag',            // 取词方式：drag 原生拖选（默认）/ tap 两点定位（先点起点再点终点，供手机端长文本精确取词）
    underlineColor: '#95b6d6',
    markerColor: '#ffdc6e',
    themeColor: '#95b6d6',         // 插件自身UI主题色（--be-accent），跟 underlineColor 解耦，默认值保持一致避免老用户升级视觉跳变
    followTavernTheme: false,      // 开启后划线时弹出的浮动工具条背景/字色跟随酒馆当前主题，不影响设置面板/笔记本/主题色
    creatorMode: false,            // 开发者模式：开启后自定义模板编辑支持CSS实时预览 + 类名查询器
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
    sourceScope: 'global',         // 出处设定的生效范围：global(全局，默认，跟旧版一致) / character(按角色区分) / chat(按角色+聊天区分)
    sourceByChar: {},              // sourceScope!=='global' 时才用到：{[charKey]: {...出处字段}} 或 {[charKey]: {[chatId]: {...}}}（chat 模式再嵌一层）
    customTemplates: [],           // 用户导入的自定义模板 [{id, name, css}]
    customFonts: [],               // 用户导入的自定义字体 [{id, name, css, fontFamily}]
    lastStyle: '',                 // 上次实际用的划线样式（空=回退到 highlightStyle）
    lastColor: '',                 // 上次实际用的划线颜色（空=用 style 对应的默认色）
    saveMode: 'download',          // 保存图片方式：download 下载文件 / popup 弹图长按保存（部分内嵌浏览器不支持下载时用）
    keepDelLine: false,            // 书摘卡片是否保留原文的删除线（del/s 划掉效果）
    mergeEnabled: true,            // 划线合并：点划线可加入合并篮子 + 悬浮篮子入口（v1.4.0 起默认开，老用户已保存的选择不受影响）
    mergeDefaultTarget: '',        // 合并完成后默认动作：'' 每次询问 / 'note' 直接存为笔记 / 'card' 直接生成书摘
    mergeDeleteOriginal: '',       // 合并后原划线怎么处理：'' 每次询问 / 'delete' 删除原划线 / 'keep' 保留原划线
    highlightDisabled: false,      // 划线总开关（关闭时不影响已有划线显示，只关掉“选中文字弹浮动栏”这一步，供与其它选中类插件冲突的用户使用）
    freeformEnabled: false,        // 自由排版总开关（默认关，只在扩展形态下才可能出现入口；仅 Tavern Helper 脚本形态下这个字段永远不会被用到）
    // 自由排版存的版式模板，用独立字段而不是塞进 customTemplates——那个数组被卡片主题抽屉/设置里的
    // "自定义模板"列表/导出弹窗等好几处已有 UI 直接遍历渲染，混进去会在那些地方出现不认识的条目
    freeformTemplates: [],
    hiddenTemplates: [],           // 被隐藏的模板 key（默认 'classic' / 导入 'custom-<id>' 都行）
    hiddenColorPresets: [],        // 被用户隐藏的内置配色 id 列表（COLOR_PRESETS 的 id）
    templateOrder: [],             // 模板排序（默认+导入统一，存 key；没排过的按 默认→导入 的原顺序排在后面）
    templateFavorites: []          // 收藏的模板 key 列表（跟 settings.template 同格式：'classic' / 'custom-<id>'），选模板时排在最前
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
  function resolveCustomColor(bg, fgEnabled, fgVal) {
    bg = bg || '#f5f1e8';
    const lum = parseLuminance(bg);
    const autoFg = (lum != null && lum > 0.55) ? '#1a1a1a' : '#f0e6c6';
    const fg = fgEnabled ? (fgVal || autoFg) : autoFg;
    const sub = mixColor(fg, bg, 0.55); // 子色：fg 和 bg 的混合
    return { bg, fg, sub, avatarBg: mixColor(fg, bg, 0.85) };
  }
  function resolveColors() {
    if (settings.colorPreset === 'custom') {
      return resolveCustomColor(settings.customBg, settings.customFgEnabled, settings.customFg);
    }
    if (typeof settings.colorPreset === 'string' && settings.colorPreset.indexOf('saved-') === 0) {
      const item = (settings.customColors || []).find(x => x.id === settings.colorPreset.slice(6));
      if (item) return resolveCustomColor(item.bg, item.fgEnabled, item.fg);
    }
    const p = COLOR_PRESETS.find(x => x.id === settings.colorPreset)
           || COLOR_PRESETS.find(x => x.id === 'paper-warm');
    return { ...p };
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
      // v1.5.0：保存清晰度默认 2x→3x。老存档里的 2 基本都是当初整份设置落盘时顺带存进去的默认值，
      // 只在第一次升级时提到 3；之后用户自己改回 2 不会再被覆盖
      if (!parsed._scaleDefault3) {
        if (!(Number(s.exportScale) > 2)) s.exportScale = 3;
        s._scaleDefault3 = true;
      }
      // 收藏改成跟 settings.template 同一套 key（'classic' / 'custom-<id>'），默认模板以后也能收藏
      const toKey = f => (TEMPLATES[f] || String(f).startsWith('custom-')) ? f : `custom-${f}`;
      if (Array.isArray(s.templateFavorites)) s.templateFavorites = s.templateFavorites.map(toKey);
      // 排序同理：旧版只给导入模板排序、存的是裸 id
      if (Array.isArray(s.templateOrder)) s.templateOrder = s.templateOrder.map(toKey);
      delete s.avatarQuality;
      return s;
    } catch { return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); }
  }
  // 写失败不能再静默吞掉：之前图片塞在 settings 里撑爆 5MB 后，之后所有设置改动都悄悄存不进去
  let _settingsSaveWarned = false;
  function saveSettings(s) {
    try {
      mainWin.localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
      _settingsSaveWarned = false;
    } catch (e) {
      console.warn('[BookExcerpt] 设置保存失败', e);
      if (!_settingsSaveWarned) {
        _settingsSaveWarned = true;
        try { toast('设置没能保存：浏览器存储空间不足或被禁用', 'error'); } catch (e2) {}
      }
    }
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
  // forceKey：指定笔记要归档到哪个角色桶，不传则用"当前实际激活角色"（原来的行为）。
  // 合并流程用得到——合并篮子里的条目可能来自笔记本里翻出来的、并非此刻激活角色的历史划线，
  // 这种情况下要归档回它们各自本来所属的角色，而不是一律塞进"现在活跃的角色"（v1.6.0 修复的 bug）。
  function addNote(note, forceKey) {
    const notes = loadNotes();
    const ctx = getContext();
    const key = forceKey || ctx.charKey || 'unknown';
    const isActiveChar = key === (ctx.charKey || 'unknown');
    if (!notes[key]) {
      notes[key] = { name: (isActiveChar ? ctx.charName : '') || '未知角色', avatar: (isActiveChar ? ctx.charAvatar : '') || '', items: [] };
    }
    // 只有"确实是当前激活角色自己的桶"才用 ctx 里的最新名字/头像去覆盖——
    // 强制指定成别的角色时，绝不能拿"此刻活跃角色"的名字头像去污染另一个角色的桶
    if (isActiveChar) {
      notes[key].name = ctx.charName || notes[key].name;
      notes[key].avatar = ctx.charAvatar || notes[key].avatar;
    }
    note.id = note.id || ('n' + Date.now() + Math.random().toString(36).slice(2, 6));
    note.ts = note.ts || Date.now();
    note.chatId = note.chatId || (isActiveChar ? ctx.chatId : '') || '';   // 存档名
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

  // ---------- 自由排版：画布草稿数据（仅扩展形态用得到，跟 notes 同一套读写/防抖/失败提示模式）----------
  let _canvasesCache = null;
  let _canvasStorageWarned = false;
  function loadCanvases() {
    if (_canvasesCache) return _canvasesCache;
    let raw = {};
    try {
      const stored = mainWin.localStorage.getItem(LS_CANVASES);
      if (stored) raw = JSON.parse(stored);
    } catch (e) {
      console.warn('[书摘] 自由排版草稿读取失败：', e);
      if (!_canvasStorageWarned) {
        _canvasStorageWarned = true;
        toast('自由排版草稿读取失败，可能是数据损坏或存储权限被禁用', 'error');
      }
    }
    _canvasesCache = raw;
    return raw;
  }
  function saveCanvases(all) {
    _canvasesCache = all;
    try {
      mainWin.localStorage.setItem(LS_CANVASES, JSON.stringify(all));
      return true;
    } catch (e) {
      console.warn('[书摘] 自由排版草稿保存失败：', e);
      if (!_canvasStorageWarned) {
        _canvasStorageWarned = true;
        const msg = (e && e.name === 'QuotaExceededError')
          ? '自由排版草稿存储已满，删掉几张不用的图片元素或旧草稿再试'
          : '保存草稿失败，本次编辑有效，刷新后会丢失。请检查浏览器存储权限/隐私模式';
        toast(msg, 'error');
      }
      return false;
    }
  }
  let _canvasSaveT = 0;
  function saveCanvasesDebounced() {
    if (_canvasSaveT) mainWin.clearTimeout(_canvasSaveT);
    _canvasSaveT = mainWin.setTimeout(() => { _canvasSaveT = 0; saveCanvases(_canvasesCache); }, 400);
  }
  function newCanvasId() { return 'fc' + Date.now() + Math.random().toString(36).slice(2, 6); }
  function createCanvas(width, height, name) {
    const all = loadCanvases();
    const id = newCanvasId();
    all[id] = {
      id, name: name || '未命名排版', createdAt: Date.now(), updatedAt: Date.now(),
      width, height,
      bg: { color: '#ffffff', image: '' },
      elements: []
    };
    saveCanvases(all);
    return all[id];
  }
  function deleteCanvas(id) {
    const all = loadCanvases();
    delete all[id];
    saveCanvases(all);
  }
  function renameCanvas(id, name) {
    const all = loadCanvases();
    if (!all[id]) return;
    all[id].name = name || all[id].name;
    all[id].updatedAt = Date.now();
    saveCanvases(all);
  }
  function touchCanvas(id) {
    const all = loadCanvases();
    if (!all[id]) return;
    all[id].updatedAt = Date.now();
    saveCanvasesDebounced();
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
      const src = getSourceValues();
      if (settings.maskUser) { push(ctx.userName); push(src.sourceUser); }
      if (settings.maskChar) { push(ctx.charName); push(src.sourceAuthor); }
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

  // ---------- 用户上传图片的存储（IndexedDB）----------
  // 以前头像/模板图片压成 dataURL 塞进 settings（localStorage 总共才 5MB），多传几张就超额，
  // 而 saveSettings 吞掉了写入异常——表现就是"有的图传不上/刷新后没了"，甚至连带之后所有设置都存不进去。
  // 现在图片本体放 IndexedDB（没有这个量级的上限），settings 里只存 'idb:<key>' 引用；
  // 也不再为了省空间硬压到 320/900/1600px + JPEG 0.85（那是"上传后变糊"的原因），尽量保留原图，
  // 导出时再按用户选的倍率去缩放，清晰度自然跟着倍率走。
  const IMG_DB_NAME = 'book-excerpt-images';
  const IMG_STORE = 'images';
  let _imgDbP = null;
  function imgDb() {
    if (_imgDbP) return _imgDbP;
    _imgDbP = new Promise((resolve, reject) => {
      let req;
      try { req = mainWin.indexedDB.open(IMG_DB_NAME, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => { try { req.result.createObjectStore(IMG_STORE); } catch (e) {} };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB 打开失败'));
    });
    _imgDbP.catch(() => { _imgDbP = null; });
    return _imgDbP;
  }
  function imgTx(mode, fn) {
    return imgDb().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(IMG_STORE, mode);
      const store = tx.objectStore(IMG_STORE);
      let result;
      const req = fn(store);
      if (req) req.onsuccess = () => { result = req.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('IndexedDB 写入失败'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB 写入被中止'));
    }));
  }
  // 存 {type, data:ArrayBuffer} 而不是 Blob：脚本形态跑在助手 iframe 里，跨 realm 的 Blob 容易出怪问题，
  // 取出来时统一用 mainWin.Blob + mainWin.URL 在主文档 realm 里重建（见 [[project_blob_download_realm_bug]]）
  const imgPut = (key, rec) => imgTx('readwrite', s => s.put(rec, key));
  const imgGet = (key) => imgTx('readonly', s => s.get(key));
  const imgDel = (key) => imgTx('readwrite', s => s.delete(key)).catch(() => {});
  const _imgUrlCache = new Map();
  const _imgLoading = new Map();
  function imgRefKey(ref) {
    return (typeof ref === 'string' && ref.startsWith('idb:')) ? ref.slice(4) : '';
  }
  // 同步取可显示的 URL：旧数据(dataURL/普通URL)原样返回；idb 引用已加载就返回 blob URL，
  // 没加载就先返回空串并异步加载，加载好后调 onReady 让调用方重渲染一次
  function imgUrlSync(ref, onReady) {
    if (!ref) return '';
    const key = imgRefKey(ref);
    if (!key) return ref;
    if (_imgUrlCache.has(key)) return _imgUrlCache.get(key);
    if (!_imgLoading.has(key)) {
      const p = imgGet(key).then(rec => {
        if (rec && rec.data) {
          const blob = new mainWin.Blob([rec.data], { type: rec.type || 'image/png' });
          _imgUrlCache.set(key, mainWin.URL.createObjectURL(blob));
        }
      }).catch(e => console.warn('[BookExcerpt] 读取图片失败', key, e));
      _imgLoading.set(key, p);
      p.finally(() => _imgLoading.delete(key));
    }
    if (onReady) _imgLoading.get(key).then(() => { if (_imgUrlCache.has(key)) onReady(); });
    return '';
  }
  function imgForget(ref) {
    const key = imgRefKey(ref);
    if (!key) return;
    const url = _imgUrlCache.get(key);
    if (url) { try { mainWin.URL.revokeObjectURL(url); } catch (e) {} }
    _imgUrlCache.delete(key);
    imgDel(key);
  }
  function isImageFile(file) {
    if (!file) return false;
    if (/^image\//.test(file.type || '')) return true;
    return /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name || '');
  }
  function decodeImageFile(file) {
    return new Promise((resolve, reject) => {
      const url = mainWin.URL.createObjectURL(file);
      const img = new mainWin.Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => {
        try { mainWin.URL.revokeObjectURL(url); } catch (e) {}
        const heic = /heic|heif/i.test(file.type || '') || /\.(heic|heif)$/i.test(file.name || '');
        reject(new Error(heic ? '浏览器不支持 HEIC 格式，请先转成 JPG/PNG 再上传' : '图片解码失败（格式不受支持或文件已损坏）'));
      };
      img.src = url;
    });
  }
  function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('图片编码失败')), mime, quality);
      } catch (e) { reject(e); }
    });
  }
  // kind='avatar'：居中裁方形，边长最多 1024（头像显示最大约 84px，5x 导出也才 420px，1024 绰绰有余）；
  // kind='slot'：不裁剪；原图 ≤3MB 且最长边 ≤3200 直接原样保存（零损失），否则等比缩到 3200 再高质量编码
  async function saveImageFile(file, kind) {
    if (!isImageFile(file)) throw new Error('请选择图片文件');
    const { img, url } = await decodeImageFile(file);
    try {
      const w0 = img.naturalWidth, h0 = img.naturalHeight;
      if (!w0 || !h0) throw new Error('图片尺寸无效');
      const hasAlpha = /png|webp|gif|avif/i.test(file.type || '') || /\.(png|webp|gif|avif)$/i.test(file.name || '');
      let blob;
      if (kind === 'slot' && file.size <= 3 * 1024 * 1024 && Math.max(w0, h0) <= 3200 && /^image\/(jpeg|png|webp|gif)$/i.test(file.type || '')) {
        blob = file;
      } else {
        const canvas = mainDoc.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        if (kind === 'avatar') {
          const side = Math.min(w0, h0);
          const out = Math.min(1024, side);
          canvas.width = out; canvas.height = out;
          ctx.drawImage(img, (w0 - side) / 2, (h0 - side) / 2, side, side, 0, 0, out, out);
        } else {
          const scale = Math.min(1, 3200 / Math.max(w0, h0));
          canvas.width = Math.max(1, Math.round(w0 * scale));
          canvas.height = Math.max(1, Math.round(h0 * scale));
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        blob = await canvasToBlob(canvas, hasAlpha ? 'image/png' : 'image/jpeg', 0.95);
        canvas.width = canvas.height = 0;
      }
      const data = await blob.arrayBuffer();
      const key = `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      await imgPut(key, { type: blob.type || (hasAlpha ? 'image/png' : 'image/jpeg'), data });
      _imgUrlCache.set(key, mainWin.URL.createObjectURL(new mainWin.Blob([data], { type: blob.type || 'image/png' })));
      return 'idb:' + key;
    } finally {
      try { mainWin.URL.revokeObjectURL(url); } catch (e) {}
    }
  }
  // 旧版存在 settings 里的 dataURL（头像、模板图片）搬进 IndexedDB，给 localStorage 腾空间
  async function dataUrlToIdb(dataUrl, kind) {
    const m = String(dataUrl).match(/^data:([^;,]+)(;base64)?,(.*)$/s);
    if (!m) return '';
    const bin = m[2] ? mainWin.atob(m[3]) : decodeURIComponent(m[3]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const key = `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    await imgPut(key, { type: m[1], data: bytes.buffer });
    return 'idb:' + key;
  }
  async function setCustomAvatarFromFile(file) {
    const ref = await saveImageFile(file, 'avatar');
    const old = settings.customAvatar;
    settings.customAvatar = ref;
    if (old && old !== ref) imgForget(old);
    saveSettings(settings);
    return ref;
  }
  function clearCustomAvatar() {
    imgForget(settings.customAvatar);
    settings.customAvatar = '';
    saveSettings(settings);
  }
  // 启动时一次性：把旧版塞在 settings 里的 dataURL 图片搬到 IndexedDB，并把 slotImages 的 key 换成新格式
  async function migrateImagesToIdb() {
    let changed = false;
    try {
      if (typeof settings.customAvatar === 'string' && settings.customAvatar.startsWith('data:')) {
        settings.customAvatar = await dataUrlToIdb(settings.customAvatar, 'avatar');
        changed = true;
      }
      for (const tpl of (settings.customTemplates || [])) {
        if (!tpl.slotImages) continue;
        if (migrateSlotKeys(tpl)) changed = true;
        for (const k of Object.keys(tpl.slotImages)) {
          const v = tpl.slotImages[k];
          if (typeof v === 'string' && v.startsWith('data:')) {
            tpl.slotImages[k] = await dataUrlToIdb(v, 'slot');
            changed = true;
          }
        }
      }
    } catch (e) {
      console.warn('[BookExcerpt] 旧图片迁移到 IndexedDB 失败，继续沿用 dataURL', e);
    }
    if (changed) {
      saveSettings(settings);
      injectCustomTemplateStyles();
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
    }
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

  const SOURCE_FIELDS = ['sourceUser', 'sourceAuthor', 'sourceTitle', 'sourceChapter', 'showSourceTitle', 'showSourceChapter'];
  // 出处设置默认是全局单一值（sourceScope==='global'，完全不变旧行为）；打开"按角色"/"按角色+聊天"
  // 区分后，读写改走 settings.sourceByChar，形状照抄 book-excerpt:notes 按角色分桶的既有模式。
  // 所有读"出处"字段的地方都要改成调 getSourceValues()，不能再直接读 settings.sourceXxx。
  function getSourceValues() {
    if (settings.sourceScope !== 'character' && settings.sourceScope !== 'chat') return settings;
    const ctx = getContext();
    const key = ctx.charKey || 'unknown';
    const charBucket = (settings.sourceByChar || {})[key] || {};
    if (settings.sourceScope === 'chat') {
      const chatKey = ctx.chatId || 'unknown';
      return charBucket[chatKey] || {};
    }
    return charBucket;
  }
  function setSourceValues(patch) {
    if (settings.sourceScope !== 'character' && settings.sourceScope !== 'chat') {
      Object.assign(settings, patch);
      saveSettings(settings);
      return;
    }
    const ctx = getContext();
    const key = ctx.charKey || 'unknown';
    if (!settings.sourceByChar) settings.sourceByChar = {};
    if (settings.sourceScope === 'chat') {
      if (!settings.sourceByChar[key]) settings.sourceByChar[key] = {};
      const chatKey = ctx.chatId || 'unknown';
      settings.sourceByChar[key][chatKey] = { ...(settings.sourceByChar[key][chatKey] || {}), ...patch };
    } else {
      settings.sourceByChar[key] = { ...(settings.sourceByChar[key] || {}), ...patch };
    }
    saveSettings(settings);
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
  // 注意：--be-accent 只驱动"插件自己UI"（设置面板/笔记本/悬浮按钮等），跟卡片本身的配色方案完全独立；
  // 之前这里直接读 underlineColor 导致"改划线颜色"意外带着把插件UI主题色也改了，现在拆成独立的 themeColor 字段。
  function buildStyle() {
    const accent = settings.themeColor || '#95b6d6';
    const marker  = settings.markerColor || '#ffdc6e';
    const thoughtLine = settings.thoughtLineColor || marker;
    const wavyUri = wavyDataUri(accent);
    const dashUri = dashDataUri(thoughtLine);
    // 浮动工具条默认深色；「跟随酒馆主题」开着时不在这里改，而是每次弹出时由 applyTavernFloatStyle()
    // 现场采样酒馆真实的下拉框/h4 元素的计算样式（含美化贴图）写到工具条的内联样式上，覆盖这里的默认值
    const floatBg = '#2b2b2b';
    const floatFg = '#f0f0f0';
    const floatDivider = 'rgba(255,255,255,0.12)';
    return `
    :root {
      --be-accent: ${accent};
      --be-accent-soft: ${hexA(accent, 0.18)};
      --be-marker: ${marker};
      --be-marker-soft: ${hexA(marker, 0.55)};
      --be-thought-line: ${thoughtLine};
      --be-float-bg: ${floatBg};
      --be-float-fg: ${floatFg};
      --be-float-divider: ${floatDivider};
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
    /* --be-float-bg/--be-float-fg：默认写死深色；"跟随酒馆主题"开着时在 buildStyle() 里改成
       var(--black30a)/var(--SmartThemeBodyColor)，只影响这几条选区弹出的浮动工具条，不影响设置面板/笔记本 */
    #be-float-bar, #be-card-hl-bar, #be-pick-step-bar {
      /* absolute + scrollY 偏移：Firefox 在 body 有 transform 时 fixed 会被重 anchor 到 body 而非视口，
         导致 bar 出现在屏幕外、并撑大 body 触发滚动条跳动。absolute 各浏览器表现一致。 */
      position: absolute; z-index: 2147483600;
      display: none;
      background: var(--be-float-bg, #2b2b2b);
      border-radius: 10px;
      box-shadow: 0 4px 18px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3);
      padding: 3px 2px;
      font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
      user-select: none;
      gap: 0;
    }
    #be-float-bar.show, #be-card-hl-bar.show, #be-pick-step-bar.show { display: flex; }
    /* 默认：工具栏在选区下方时，箭头在工具栏顶部、朝上指向文字 */
    #be-float-bar::after, #be-card-hl-bar::after, #be-pick-step-bar::after {
      content: ''; position: absolute;
      top: -5px; left: var(--arrow-left, 50%); transform: translateX(-50%);
      width: 0; height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-bottom: 5px solid var(--be-float-arrow, var(--be-float-bg, #2b2b2b));
    }
    /* 在选区上方时，箭头在工具栏底部、朝下指向文字 */
    #be-float-bar.arrow-bottom::after, #be-card-hl-bar.arrow-bottom::after, #be-pick-step-bar.arrow-bottom::after {
      top: auto; bottom: -5px;
      border-bottom: none;
      border-top: 5px solid var(--be-float-arrow, var(--be-float-bg, #2b2b2b));
    }
    #be-float-bar .be-fbtn, #be-card-hl-bar .be-fbtn, #be-pick-step-bar .be-fbtn {
      background: transparent; border: none;
      color: var(--be-float-fg, #f0f0f0);
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
    #be-float-bar .be-fbtn:hover, #be-card-hl-bar .be-fbtn:hover, #be-pick-step-bar .be-fbtn:hover,
    #be-float-bar .be-fbtn:active, #be-card-hl-bar .be-fbtn:active, #be-pick-step-bar .be-fbtn:active {
      background: rgba(128,128,128,0.18);
    }
    #be-float-bar .be-fbtn svg, #be-card-hl-bar .be-fbtn svg, #be-pick-step-bar .be-fbtn svg {
      width: 15px; height: 15px;
      stroke: currentColor; fill: none;
      stroke-width: 1.6;
      stroke-linecap: round; stroke-linejoin: round;
    }
    /* 卡片二次高亮的工具条要浮在 #be-mask（书摘卡片弹窗，z-index 2147483630）之上才能点到，
       之前跟 #be-float-bar 共用同一个较低的 z-index，导致弹窗一直挡住它、点了没反应 */
    #be-card-hl-bar { z-index: 2147483640; }
    #be-float-bar .be-fbtn-divider, #be-card-hl-bar .be-fbtn-divider, #be-pick-step-bar .be-fbtn-divider {
      width: 1px; background: var(--be-float-divider, rgba(128,128,128,0.25));
      margin: 6px 0;
    }
    /* ===== 点击划线弹出的改样式工具栏 ===== */
    #be-hl-bar, #be-card-hl-pop {
      position: absolute;
      z-index: 2147483601;
      background: var(--be-float-bg, #2b2b2b);
      border-radius: 12px;
      padding: 8px 6px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      display: none;
      font-family: -apple-system, "PingFang SC", sans-serif;
      user-select: none;
      max-width: 92vw;
      box-sizing: border-box;
    }
    /* 卡片二次高亮的样式弹窗开在书摘弹窗（#be-mask, 2147483630）里，要压在它上面 */
    #be-card-hl-pop { z-index: 2147483641; }
    #be-hl-bar.show, #be-card-hl-pop.show { display: block; }
    #be-hl-bar::after, #be-card-hl-pop::after {
      content: ''; position: absolute;
      top: -5px; left: var(--arrow-left, 24px);
      width: 0; height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-bottom: 5px solid var(--be-float-arrow, var(--be-float-bg, #2b2b2b));
    }
    #be-hl-bar.arrow-bottom::after, #be-card-hl-pop.arrow-bottom::after {
      top: auto; bottom: -5px;
      border-top: 5px solid var(--be-float-arrow, var(--be-float-bg, #2b2b2b)); border-bottom: none;
    }
    .be-hl-row2-scroll {
      overflow-x: auto; -webkit-overflow-scrolling: touch;
      scrollbar-width: none; padding-bottom: 2px;
    }
    .be-hl-row2-scroll::-webkit-scrollbar { display: none; }
    /* row1 是"复制/删除划线/写想法/..."这一排菜单式操作，视觉上当一个小标题栏处理：跟随酒馆主题时
       底部分隔线也换成酒馆自己的描边色，看起来更像酒馆原生的分组标题而不是一整块纯黑工具条 */
    .be-hl-row1 {
      display: flex; align-items: center; gap: 0;
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding: 0 4px 6px;
      border-bottom: 1px solid var(--be-float-divider, rgba(255,255,255,0.12));
      margin-bottom: 6px;
    }
    .be-hl-row1::-webkit-scrollbar { display: none; }
    .be-hl-row1 button {
      font-weight: var(--be-float-fw, normal);
      background: transparent; border: none; color: var(--be-float-fg, #f0f0f0);
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
      color: var(--be-float-fg, #fff);
      padding-bottom: 2px;
      line-height: 1;
    }
    .be-hl-sample.sample-underline { border-bottom: 1.5px solid currentColor; }
    .be-hl-sample.sample-bold { font-weight: 900; font-size: 14px; }
    /* 卡片二次高亮的新样式：只改字色，不画线也不铺底 */
    .be-highlight.style-fontcolor { border-bottom: none; background: none; }
    /* 卡片选区工具条上的文字图标（下划线/荧光笔/字色/加粗） */
    .be-chl-ico { display: block; font-size: 14px; font-weight: 600; line-height: 15px; height: 15px; }
    .be-chl-ico-u { border-bottom: 1.5px solid currentColor; line-height: 13px; }
    .be-chl-ico-m { background: linear-gradient(to bottom, transparent 55%, rgba(255,220,110,0.7) 55%, rgba(255,220,110,0.7) 95%, transparent 95%); padding: 0 2px; }
    .be-chl-ico-c { color: #e8a0a0; }
    .be-chl-ico-b { font-weight: 900; }
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
      background: var(--be-float-divider, rgba(255,255,255,0.15));
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

    /* 正则直接渲染在消息里的状态栏常写 user-select:none，长按选不中字就弹不出划线工具条。
       划线功能开着时只对文字类元素放开选择，按钮/输入框不动（关闭划线功能时这段不输出） */
    ${settings.highlightDisabled ? '' : `
    .mes_text :where(div, span, p, li, td, th, dd, dt, font, b, i, em, strong, small, u, s, del, ins, mark, sub, sup, label, blockquote, pre, code, h1, h2, h3, h4, h5, h6, section, article, details, summary) {
      -webkit-user-select: text !important; user-select: text !important;
    }`}

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
      min-width: 20px; height: 20px; padding: 0 3px; border-radius: 10px;
      border: 1px solid var(--be-thought-border);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 600; margin-right: 4px; align-self: center;
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
    #be-drawer .be-drawer-sep {
      flex: 0 0 auto;
      display: flex; align-items: center;
      color: var(--be-panel-sub); opacity: 0.5;
      padding: 0 2px;
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
    #be-actions .be-btn.active { background: var(--be-accent); color: #1a1a1a; border-color: var(--be-accent); }
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

    /* 设置面板二级分组 tab：比上面的主 tab 弱一级，字更小、更紧凑，一眼看出是下一层级 */
    .be-settings-subtabs {
      display: flex; gap: 4px;
      margin: 2px 0 18px;
      border-bottom: 1px solid var(--be-panel-divider);
    }
    .be-settings-subtabs button {
      flex: 1; background: transparent; border: none;
      color: var(--be-panel-sub);
      padding: 8px 4px; font-size: 12px; cursor: pointer;
      font-family: inherit;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: color 0.15s ease, border-color 0.15s ease;
    }
    .be-settings-subtabs button.active {
      color: var(--be-accent);
      border-bottom-color: var(--be-accent);
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
    /* 酒馆美化主题常直接给所有 h4 加贴图/边框/字色（有的还带 !important），会渗进本插件的分区标题；
       设置面板/笔记本不跟随酒馆主题，这里把这些装饰清掉 */
    .be-sec h4 {
      background: none !important; border: none !important; box-shadow: none !important;
      text-shadow: none !important; border-image: none !important; padding: 0 !important;
      color: var(--be-panel-sub) !important; font-weight: 600 !important;
    }
    .be-sec h4::before, .be-sec h4::after { content: none !important; }
    /* 面板里的 .be-row 等写了 display，会盖掉浏览器默认的 [hidden] 隐藏，这里统一兜回来 */
    #be-panel [hidden], #be-tpl-preview [hidden] { display: none !important; }
    .be-sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .be-sec-head h4 { margin: 0; flex: 1; }
    .be-sec-head-btns { display: flex; gap: 6px; }
    .be-mini-btn {
      background: var(--be-panel-row-bg); color: var(--be-panel-fg);
      border: 1px solid transparent; border-radius: 999px;
      padding: 4px 12px; font-size: 12px; cursor: pointer; font-family: inherit;
      -webkit-tap-highlight-color: transparent;
    }
    .be-mini-btn:hover { background: var(--be-panel-row-bg-hover); }
    .be-mini-btn.active { background: var(--be-accent); color: #1a1a1a; }
    .be-subh {
      font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
      color: var(--be-panel-sub); opacity: 0.75; margin: 14px 0 2px;
    }
    .be-subh:first-of-type { margin-top: 0; }
    .be-row.be-hint { min-height: 0; font-size: 11px; opacity: 0.7; padding: 2px 0 6px; }
    .be-text-in {
      width: 100%; box-sizing: border-box;
      background: var(--be-panel-input-bg); border: 1px solid var(--be-panel-input-border);
      color: inherit; padding: 7px 10px; border-radius: 8px; font-size: 13px; font-family: inherit;
    }
    /* 模板列表：默认和导入的统一成长条，平时折叠 */
    .be-tl-current {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; border-radius: 12px; cursor: pointer;
      background: var(--be-panel-row-bg); font-size: 13px;
      -webkit-tap-highlight-color: transparent;
    }
    .be-tl-current > span:first-child { flex: 1; }
    .be-tl-current .be-caret {
      display: inline-block; width: 0; height: 0;
      border-left: 4px solid transparent; border-right: 4px solid transparent;
      border-top: 5px solid currentColor; opacity: 0.6; transition: transform 0.15s;
    }
    .be-tl-current.open .be-caret { transform: rotate(180deg); }
    .be-tl-body { padding-top: 8px; }
    .be-tl-hint { font-size: 11px; opacity: 0.65; margin: 0 2px 8px; line-height: 1.6; }
    .be-tl-list { display: flex; flex-direction: column; gap: 6px; }
    .be-tl-sep { text-align: center; opacity: 0.45; margin: 4px 0; line-height: 1; }
    .be-tl-row {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 10px 9px 12px; border-radius: 12px;
      background: var(--be-panel-row-bg); cursor: pointer; font-size: 13px;
      border: 1.5px solid transparent;
      transition: background 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .be-tl-row:hover { background: var(--be-panel-row-bg-hover); }
    .be-tl-row.active { border-color: var(--be-accent); background: var(--be-accent-soft); }
    .be-tl-row.dragging { opacity: 0.85; box-shadow: 0 6px 18px rgba(0,0,0,0.35); position: relative; z-index: 1; }
    .be-tl-row-hidden { cursor: default; }
    .be-tl-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .be-tl-star { color: #ffb400; font-size: 12px; }
    .be-tl-tag {
      font-size: 10px; padding: 1px 6px; border-radius: 6px;
      background: rgba(128,128,128,0.18); color: var(--be-panel-sub); flex: 0 0 auto;
    }
    .be-tl-handle {
      display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 26px; margin-left: -4px; cursor: grab; opacity: 0.5;
      touch-action: none; flex: 0 0 auto;
    }
    .be-tl-handle svg { width: 12px; height: 12px; fill: currentColor; }
    .be-tl-row button {
      background: transparent; border: none; color: var(--be-panel-sub);
      cursor: pointer; padding: 2px 6px; font-size: 15px; line-height: 1; flex: 0 0 auto;
      font-family: inherit;
    }
    .be-tl-fav.on, .be-tl-fav:hover { color: #ffb400; }
    .be-tl-prev svg { width: 17px; height: 17px; stroke: currentColor; fill: none; stroke-width: 1.7; display: block; }
    .be-tl-prev:hover, .be-tl-more:hover { color: var(--be-accent); }
    .be-tl-row .be-mini-btn { font-size: 11px; padding: 3px 10px; }
    #be-tl-menu {
      position: absolute; z-index: 2147483646; display: none; flex-direction: column;
      min-width: 110px; padding: 6px; border-radius: 12px;
      background: var(--be-panel-bg, #1b1b1b); color: var(--be-panel-fg, #eee);
      border: 1px solid var(--be-panel-border, rgba(255,255,255,0.1));
      box-shadow: 0 10px 30px rgba(0,0,0,0.45);
      font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    }
    #be-tl-menu.show { display: flex; }
    #be-tl-menu button {
      background: transparent; border: none; color: inherit; text-align: left;
      padding: 9px 12px; border-radius: 8px; font-size: 13px; cursor: pointer; font-family: inherit;
    }
    #be-tl-menu button:hover { background: var(--be-panel-row-bg-hover, rgba(255,255,255,0.08)); }
    #be-tl-menu button.danger { color: #ff8a8a; }
    /* 模板预览弹窗 */
    #be-tpl-preview {
      position: absolute; top: 0; left: 0; width: 100%; height: 100vh; height: 100dvh;
      z-index: 2147483646; display: none; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.6); padding: 16px; box-sizing: border-box;
    }
    #be-tpl-preview.open { display: flex; }
    #be-tpl-preview .be-tpv-box {
      width: min(380px, 92vw); max-height: 88dvh; overflow: auto;
      background: var(--be-panel-bg, #1b1b1b); color: var(--be-panel-fg, #eee);
      border-radius: 18px; padding: 12px 14px 14px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    }
    #be-tpl-preview .be-tpv-head { display: flex; align-items: center; font-size: 14px; margin-bottom: 10px; }
    #be-tpl-preview .be-tpv-head span { flex: 1; font-weight: 600; }
    #be-tpl-preview .be-tpv-close { background: transparent; border: none; color: inherit; font-size: 20px; cursor: pointer; line-height: 1; }
    #be-tpl-preview .be-tpv-stage { width: 100%; overflow: hidden; position: relative; }
    #be-tpl-preview .be-tpv-scale { transform-origin: top left; pointer-events: none; }
    #be-tpl-preview .be-tpv-foot { display: flex; justify-content: flex-end; margin-top: 12px; }
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
    .be-inspect-hl { outline: 2px solid #ff5050 !important; outline-offset: -1px; }
    #be-inspect-tip {
      position: fixed; z-index: 2147483647;
      background: rgba(0,0,0,0.85); color: #fff;
      font-size: 11px; padding: 3px 7px; border-radius: 5px;
      pointer-events: none; display: none; max-width: 70vw;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #be-inspect-tip.show { display: block; }
    /* 开发者模式：可拖动/缩放的悬浮CSS编辑小窗 */
    #be-css-float {
      position: absolute; z-index: 2147483644;
      display: none; flex-direction: column;
      background: #232323; color: #eee;
      border-radius: 10px; overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.55);
      min-width: 220px; min-height: 160px;
      font-family: -apple-system, "PingFang SC", sans-serif;
    }
    #be-css-float.show { display: flex; }
    #be-css-float .be-css-float-head {
      display: flex; align-items: center; gap: 4px;
      padding: 8px 10px; background: #2f2f2f; cursor: move;
      font-size: 12px; letter-spacing: 0.04em; user-select: none;
      touch-action: none;
    }
    #be-css-float .be-css-float-head button {
      background: transparent; border: none; color: #ccc;
      font-size: 15px; cursor: pointer; line-height: 1; padding: 2px 4px;
      border-radius: 4px;
    }
    #be-css-float .be-css-float-head button:hover { background: rgba(255,255,255,0.1); }
    #be-css-float .be-css-float-head button.active { background: var(--be-accent); color: #1a1a1a; }
    #be-css-float textarea {
      flex: 1; resize: none; border: none; outline: none;
      background: #1c1c1c; color: #d8d8d8;
      font-family: ui-monospace, "SFMono-Regular", Consolas, monospace;
      font-size: 12px; padding: 8px; line-height: 1.5;
    }
    #be-css-float .be-css-float-foot {
      display: flex; gap: 8px; padding: 6px 8px; background: #2a2a2a;
    }
    #be-css-float .be-css-float-foot .be-btn { flex: 1; padding: 6px; font-size: 12px; }
    .be-css-resize {
      position: absolute; width: 18px; height: 18px;
      touch-action: none;
    }
    .be-css-resize-se { right: 0; bottom: 0; cursor: se-resize; }
    .be-css-resize-sw { left: 0; bottom: 0; cursor: sw-resize; }
    .be-css-resize-ne { right: 0; top: 0; cursor: ne-resize; }
    .be-css-resize-nw { left: 0; top: 0; cursor: nw-resize; }
    /* 模板图片槽：一个位置有多张图/已换过图时弹的小选择框（在书摘弹窗里，要压在 #be-mask 上面） */
    #be-slot-chooser {
      position: absolute; z-index: 2147483642;
      display: none; flex-direction: column; gap: 6px;
      min-width: 200px; max-width: 86vw;
      padding: 10px; border-radius: 12px;
      background: var(--be-panel-bg, #1b1b1b); color: var(--be-panel-fg, #eee);
      box-shadow: 0 8px 28px rgba(0,0,0,0.5);
      font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    }
    #be-slot-chooser.show { display: flex; }
    #be-slot-chooser .be-slot-chooser-title { font-size: 12px; opacity: 0.6; letter-spacing: 0.06em; }
    #be-slot-chooser .be-slot-row { display: flex; align-items: center; gap: 8px; }
    #be-slot-chooser .be-slot-thumb {
      width: 36px; height: 36px; border-radius: 6px; flex: 0 0 auto;
      background: #555 center / cover no-repeat;
    }
    #be-slot-chooser .be-slot-name { flex: 1; font-size: 13px; }
    #be-slot-chooser .be-btn { padding: 4px 10px; font-size: 12px; }
    /* 可点击换图的提示：不能动 position、不能占用 ::before/::after——模板自己常用它们摆位置/画装饰图，
       改了会把模板排版和装饰顶掉。只给指针形状 + 桌面端悬停时压一层内阴影变暗。 */
    .be-avatar-clickable, .be-tpl-slot:not(.be-card) { cursor: pointer; }
    @media (hover: hover) {
      .be-avatar-clickable:hover, .be-tpl-slot:not(.be-card):hover { box-shadow: inset 0 0 0 999px rgba(0,0,0,0.25); }
    }

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
    .be-tpl-drag-handle { cursor: grab; opacity: 0.35; padding: 0 4px; display: inline-flex; align-items: center; flex: 0 0 auto; }
    .be-tpl-drag-handle svg { width: 11px; height: 11px; fill: currentColor; }
    .be-tpl-custom-row.dragover { outline: 2px dashed var(--be-accent); outline-offset: -2px; }
    .be-tpl-custom-row button.be-tpl-fav { opacity: 0.5; }
    .be-tpl-custom-row button.be-tpl-fav:hover { opacity: 1; color: #ffb400; }
    .be-tpl-custom-row button.be-tpl-fav.active { opacity: 1; color: #ffb400; }
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
    .be-color-dot-wrap {
      position: relative; width: 100%; aspect-ratio: 1 / 1; max-width: 52px; justify-self: center;
    }
    .be-color-dot-wrap .be-color-dot { position: absolute; inset: 0; max-width: none; }
    .be-color-del {
      position: absolute; top: -4px; right: -4px; z-index: 1;
      width: 16px; height: 16px; border-radius: 50%;
      background: rgba(0,0,0,0.6); color: #fff;
      font-size: 11px; line-height: 16px; text-align: center;
      cursor: pointer; user-select: none;
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

    /* ===== 自由排版 ===== */
    #be-fc-mask {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100vh; height: 100dvh;
      background: rgba(0,0,0,0.5);
      display: none; align-items: stretch; justify-content: stretch;
      z-index: 2147483640;
    }
    #be-fc-mask.open { display: flex; }
    #be-fc-body {
      position: relative; /* 图层抽屉靠这个定位锚点做绝对定位悬浮，不挤占编辑区纵向空间 */
      flex: 1; display: flex; flex-direction: column;
      min-height: 0; /* flex 子元素默认 min-height:auto，内容比可用空间高时会把自己撑爆而不是内部滚动，这里必须清零 */
      max-height: 100vh; max-height: 100dvh; /* 不完全依赖 flex 传高度，参照 #be-panel 的写法加一层硬上限兜底 */
      background: var(--be-panel-bg); color: var(--be-panel-fg);
      overflow: hidden;
    }
    .be-fc-listhead {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px; border-bottom: 1px solid var(--be-panel-divider);
      flex: 0 0 auto;
    }
    .be-fc-title { flex: 1; font-size: 15px; font-weight: 600; text-align: center; }
    .be-fc-newrow { padding: 14px 16px 0; flex: 0 0 auto; }
    .be-fc-newrow .be-btn { width: 100%; }
    .be-fc-grid {
      flex: 1; min-height: 0; overflow-y: auto; align-content: start; padding: 14px 16px 24px;
      display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px;
    }
    .be-fc-card {
      position: relative; cursor: pointer;
      background: var(--be-panel-row-bg); border-radius: 10px; padding: 8px;
      transition: background 0.15s;
    }
    .be-fc-card:hover { background: var(--be-panel-row-bg-hover); }
    .be-fc-thumb {
      width: 100%; aspect-ratio: 3 / 4; border-radius: 6px;
      display: flex; align-items: flex-end; justify-content: flex-end;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.08) inset;
      margin-bottom: 6px;
    }
    .be-fc-thumb-size { font-size: 10px; opacity: 0.5; padding: 4px; color: #000; }
    .be-fc-card-name { font-size: 12px; font-weight: 500; }
    .be-fc-card-meta { font-size: 10px; opacity: 0.6; margin-top: 2px; }
    .be-fc-card-del {
      position: absolute; top: 4px; right: 4px;
      width: 20px; height: 20px; border-radius: 50%; border: none;
      background: rgba(0,0,0,0.55); color: #fff; font-size: 12px; line-height: 20px;
      cursor: pointer; opacity: 0; transition: opacity 0.15s;
    }
    .be-fc-card:hover .be-fc-card-del { opacity: 1; }

    .be-fc-toolbar {
      flex: 0 0 auto; display: flex; align-items: center; gap: 4px; padding: 6px 10px;
      border-bottom: 1px solid var(--be-panel-divider);
    }
    .be-fc-toolbar-spacer { flex: 1; }
    .be-fc-icon-btn {
      width: 40px; height: 40px; min-width: 40px; flex: none; /* >=40px 可点击高度，移动端最低触摸目标 */
      display: flex; align-items: center; justify-content: center;
      background: var(--be-panel-row-bg); border: none; border-radius: 10px;
      color: var(--be-panel-fg); font-size: 16px; line-height: 1; cursor: pointer;
      font-family: inherit;
    }
    .be-fc-icon-btn:disabled { opacity: 0.35; cursor: default; }
    .be-fc-icon-btn.primary { background: var(--be-accent); color: #1a1a1a; font-weight: 600; font-size: 20px; }
    .be-fc-icon-btn.danger:not(:disabled) { color: #ff9b9b; }
    .be-fc-menu-wrap { position: relative; }
    .be-fc-dropdown {
      display: none; flex-direction: column; gap: 2px;
      position: absolute; top: 44px; left: 0; min-width: 150px;
      background: var(--be-panel-bg); border: 1px solid var(--be-panel-divider); border-radius: 12px;
      padding: 6px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); z-index: 20;
    }
    .be-fc-dropdown.open { display: flex; }
    .be-fc-dropdown-right { left: auto; right: 0; }
    .be-fc-dropdown button {
      background: none; border: none; color: var(--be-panel-fg); text-align: left;
      padding: 10px 12px; border-radius: 8px; font-size: 13px; font-family: inherit;
      cursor: pointer; white-space: nowrap; min-height: 40px;
    }
    .be-fc-dropdown button:hover { background: var(--be-panel-row-bg-hover); }
    .be-fc-dropdown button.primary { background: var(--be-accent); color: #1a1a1a; font-weight: 600; }
    .be-fc-dropdown-row {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 8px 12px; font-size: 12px;
    }
    .be-fc-canvas-wrap {
      flex: 1; min-height: 0; overflow: auto; padding: 24px;
      display: flex; align-items: flex-start; justify-content: center;
      background: repeating-conic-gradient(#8884 0% 25%, transparent 0% 50%) 0 0/20px 20px;
    }
    .be-fc-canvas {
      position: relative; flex: 0 0 auto;
      box-shadow: 0 4px 24px rgba(0,0,0,0.25);
      touch-action: none;
      /* 故意不在这裁 overflow：拖缩放/旋转手柄有一部分悬浮在元素框外，靠近画布边缘的元素若被裁掉
         手柄会抓不到。导出时另外在沙箱克隆节点上单独裁（fcExportCanvas 里加 overflow:hidden），
         两边各取所需，不用二选一。 */
    }
    .be-fc-empty-hint {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      text-align: center; font-size: 14px; line-height: 1.8; color: #999;
      pointer-events: none; /* 空状态提示不该挡住画布本身的点击/框选 */
      white-space: nowrap;
    }
    .be-fc-empty-hint b { color: var(--be-accent); font-size: 20px; }
    .be-fc-el {
      position: absolute; box-sizing: border-box;
      touch-action: none;
    }
    .be-fc-el.locked { touch-action: auto; }
    .be-fc-el.selected { outline: 1.5px dashed var(--be-accent); }
    .be-fc-text-body {
      width: 100%; height: 100%; box-sizing: border-box;
      outline: none; overflow: hidden; word-break: break-word;
      cursor: default; pointer-events: none;  /* 未编辑时事件穿透给外层 .be-fc-el 拖拽用 */
    }
    .be-fc-text-body[contenteditable="true"] {
      pointer-events: auto; cursor: text;
      box-shadow: 0 0 0 1.5px var(--be-accent) inset;
    }
    .be-fc-el-img {
      width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none;
    }
    .be-fc-handle {
      /* 视觉尺寸从早期的 12px 放大到 22px——原尺寸在移动端手指根本点不准，这是用户反馈"不知道怎么操作"
         的一部分原因，不是"不知道该做什么"，是压根戳不中。 */
      position: absolute; width: 22px; height: 22px; border-radius: 50%;
      background: #fff; box-shadow: 0 0 0 1.5px var(--be-accent);
      display: none; z-index: 2;
    }
    .be-fc-el.selected .be-fc-handle { display: block; }
    .be-fc-handle-nw { left: -11px; top: -11px; cursor: nwse-resize; }
    .be-fc-handle-ne { right: -11px; top: -11px; cursor: nesw-resize; }
    .be-fc-handle-sw { left: -11px; bottom: -11px; cursor: nesw-resize; }
    .be-fc-handle-se { right: -11px; bottom: -11px; cursor: nwse-resize; }
    .be-fc-handle-rotate {
      /* 旋转手柄是真正的手势触发目标（不像四角只是视觉提示，实际缩放靠 interact.js 的边缘检测），
         单独给到比其它手柄更大的尺寸 */
      width: 26px; height: 26px;
      left: 50%; top: -36px; margin-left: -13px; cursor: grab;
      background: var(--be-accent); box-shadow: none;
    }
    .be-fc-el.locked .be-fc-handle { display: none; }

    .be-fc-proppanel {
      flex: 0 0 auto; padding: 8px 16px; border-bottom: 1px solid var(--be-panel-divider);
      max-height: 40vh; overflow-y: auto;
    }
    .be-fc-prop-row {
      display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;
      font-size: 12px;
    }
    .be-fc-prop-row label { opacity: 0.8; flex: 0 0 auto; }
    .be-fc-prop-row select {
      background: var(--be-panel-input-bg); border: 1px solid var(--be-panel-input-border);
      color: inherit; border-radius: 6px; font-size: 12px; padding: 3px 4px; max-width: 110px;
    }
    .be-fc-prop-row input[type="number"] {
      background: var(--be-panel-input-bg); border: 1px solid var(--be-panel-input-border);
      color: inherit; border-radius: 6px; font-size: 12px; padding: 3px 4px;
    }
    .be-fc-prop-btn {
      background: var(--be-panel-row-bg); border: none; color: var(--be-panel-fg);
      border-radius: 6px; padding: 4px 9px; font-size: 12px; cursor: pointer; font-family: inherit;
    }
    .be-fc-prop-btn.active { background: var(--be-accent-soft); color: var(--be-accent); }
    .be-fc-prop-sep { width: 1px; height: 16px; background: var(--be-panel-divider); margin: 0 2px; }
    .be-fc-prop-sep-row { height: 1px; background: var(--be-panel-divider); margin: 6px 0; }
    #be-fc-export-scale {
      background: var(--be-panel-row-bg); border: 1px solid var(--be-panel-divider); color: var(--be-panel-fg);
      border-radius: 6px; padding: 5px 6px; font-size: 12px; font-family: inherit;
    }
    .be-fc-crop-area { width: 100%; height: 380px; overflow: hidden; margin: 8px 0; background: #000; }
    .be-fc-crop-area > img { display: block; max-width: 100%; }
    .be-fc-tpl-list { display: flex; flex-direction: column; gap: 6px; max-height: 160px; overflow-y: auto; }
    .be-fc-tpl-item {
      display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
      background: var(--be-panel-row-bg); border: 1px solid var(--be-panel-divider); color: var(--be-panel-fg);
      border-radius: 8px; padding: 8px 10px; font-family: inherit; cursor: pointer; text-align: left;
    }
    .be-fc-tpl-item:hover { background: var(--be-accent-soft); }
    .be-fc-tpl-item-name { font-size: 13px; }
    .be-fc-tpl-item-meta { font-size: 11px; opacity: 0.6; }
    .be-fc-multibar {
      align-items: center; gap: 8px; flex-wrap: wrap;
      padding: 6px 10px; background: var(--be-panel-row-bg); border-radius: 8px; margin: 0 0 8px;
      font-size: 12px;
    }
    .be-fc-multibar-align { display: flex; gap: 4px; flex-wrap: wrap; }
    .be-fc-align-btn {
      background: var(--be-panel-row-bg); border: 1px solid var(--be-panel-divider);
      color: var(--be-panel-fg); border-radius: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer;
      min-height: 40px; /* 移动端最低触摸目标 */
    }
    .be-fc-layers {
      display: none; /* 图层面板改成悬浮抽屉：不用的时候完全不占编辑区空间，用 .open 类切换显隐 */
      position: absolute; top: 50px; right: 10px; z-index: 15;
      width: min(280px, calc(100% - 20px)); max-height: 60vh; overflow-y: auto;
      background: var(--be-panel-bg); border: 1px solid var(--be-panel-divider); border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    .be-fc-layers.open { display: block; }
    .be-fc-layer-row {
      display: flex; align-items: center; gap: 8px; padding: 6px 10px; cursor: pointer;
      min-height: 40px; box-sizing: border-box; /* 移动端最低触摸目标 */
      border-bottom: 1px solid var(--be-panel-divider);
    }
    .be-fc-layer-row:last-child { border-bottom: none; }
    .be-fc-layer-row.selected { background: var(--be-accent-soft); }
    .be-fc-layer-row.dragover { outline: 2px dashed var(--be-accent); outline-offset: -2px; }
    .be-fc-layer-icon { font-size: 14px; }
    .be-fc-layer-name { flex: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .be-fc-layer-thumb { width: 28px; height: 28px; object-fit: cover; border-radius: 4px; flex: none; }
    .be-fc-layer-lock {
      background: none; border: none; cursor: pointer; font-size: 15px; opacity: 0.6;
      width: 36px; height: 36px; flex: none; /* 移动端最低触摸目标 */
    }
    .be-fc-layer-lock.active { opacity: 1; }
    .be-fc-selbox {
      position: absolute; border: 1px dashed var(--be-accent); background: var(--be-accent-soft);
      opacity: 0.5; pointer-events: none; z-index: 500;
    }
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
    el.textContent = list.map(t => `\n/* ${(t.name||'').replace(/\*\//g,'')} */\n${applySlotImagesToCss(t, t.css || '')}`).join('\n');
  }
  // 主题色/划线色变了时调用一下，把变量重写
  function refreshStyle() {
    injectStyle();
  }

  // ---------- 自定义模板图片槽：按 CSS 里引用的图片 URL 来换图 ----------
  // 旧做法是"找到带背景图的选择器→给元素写内联 background-image"，有三个坑：
  //  · 模板用 !important 声明背景时，内联样式压不过 → 预览不变，但导出读的是内联值 → 下载成了新图（预览/下载不一致）
  //  · ::before/::after 上的装饰图（很常见）querySelectorAll 选不中 → 这类图根本点不出上传
  //  · 一条规则里多张图 / 用 var(--x) 传图 → 只能整条替换或识别不到
  // 新做法：把"换图"定义为把模板 CSS 里某个 url(...) 换成用户上传的图，注入样式时直接改写 CSS 文本。
  // 预览和导出（沙箱会复制 #be-custom-style）用的是同一份改写后的 CSS，优先级/伪元素/变量全都天然正确。
  const CSS_URL_RE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]*?))\s*\)/g;
  function cssUrlRaw(m) { return String(m[1] ?? m[2] ?? m[3] ?? '').trim(); }
  // 模板 CSS 里所有"图片"URL（跳过 @import 和 @font-face 里的字体链接）
  function extractTemplateImageUrls(css) {
    const cleaned = String(css || '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@import[^;]*;/gi, '')
      .replace(/@font-face\s*\{[^}]*\}/gi, '');
    const out = [];
    const seen = new Set();
    let m;
    CSS_URL_RE.lastIndex = 0;
    while ((m = CSS_URL_RE.exec(cleaned))) {
      const raw = cssUrlRaw(m);
      if (!raw || seen.has(raw)) continue;
      seen.add(raw);
      out.push(raw);
    }
    return out;
  }
  function applySlotImagesToCss(tpl, css) {
    const map = tpl && tpl.slotImages;
    if (!map || !Object.keys(map).length) return css;
    CSS_URL_RE.lastIndex = 0;
    return String(css).replace(CSS_URL_RE, (whole, a, b, c) => {
      const raw = String(a ?? b ?? c ?? '').trim();
      const ref = map[raw];
      if (!ref) return whole;
      const url = imgUrlSync(ref, () => {
        injectCustomTemplateStyles();
        if (mainDoc.getElementById('be-card')) renderCard(lastText);
      });
      return url ? `url("${url}")` : whole;
    });
  }
  function resolveCssUrl(raw) {
    if (/^(data:|blob:)/i.test(raw)) return raw;
    try { return new URL(raw, mainDoc.baseURI).href; } catch (e) { return raw; }
  }
  function computedUrls(cs) {
    const out = [];
    ['backgroundImage', 'borderImageSource', 'maskImage', 'webkitMaskImage', 'listStyleImage', 'content'].forEach(p => {
      const v = cs && cs[p];
      if (!v || v === 'none' || v.indexOf('url(') < 0) return;
      let m;
      CSS_URL_RE.lastIndex = 0;
      while ((m = CSS_URL_RE.exec(v))) out.push(cssUrlRaw(m));
    });
    return out;
  }
  function currentTemplate() {
    if (!String(settings.template || '').startsWith('custom-')) return null;
    const tid = settings.template.slice(7);
    return (settings.customTemplates || []).find(t => t.id === tid) || null;
  }
  // 旧版 slotImages 的 key 是选择器、值是 dataURL；改成以 CSS 里的原始图片 URL 为 key
  function migrateSlotKeys(tpl) {
    const map = tpl.slotImages;
    if (!map) return false;
    const urls = new Set(extractTemplateImageUrls(tpl.css));
    let changed = false;
    const next = {};
    Object.keys(map).forEach(k => {
      if (urls.has(k)) { next[k] = map[k]; return; }
      // 当作选择器：找到这条规则里的第一张图
      const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rule = String(tpl.css || '').match(new RegExp(esc + '\\s*\\{([^}]*)\\}'));
      let m;
      CSS_URL_RE.lastIndex = 0;
      if (rule && (m = CSS_URL_RE.exec(rule[1]))) next[cssUrlRaw(m)] = map[k];
      changed = true;
    });
    if (changed) tpl.slotImages = next;
    return changed;
  }
  // 渲染完卡片后调用：找出卡片里哪些元素（含 ::before/::after）实际显示着模板里的图片，
  // 记到元素上，点击时据此知道"点的是哪张图"。卡片正文 .be-quote 里的点击留给选字/二次高亮，不参与。
  function markTemplateSlots(wrap) {
    const tpl = currentTemplate();
    const card = wrap && wrap.querySelector('#be-card');
    if (!tpl || !card) return;
    const map = tpl.slotImages || {};
    const shownToRaw = new Map();
    extractTemplateImageUrls(tpl.css).forEach(raw => {
      shownToRaw.set(resolveCssUrl(raw), raw);
      const ref = map[raw];
      const replaced = ref ? imgUrlSync(ref) : '';
      if (replaced) shownToRaw.set(replaced, raw);
    });
    if (!shownToRaw.size) return;
    [card, ...card.querySelectorAll('*')].forEach(el => {
      if (el.closest('.be-quote')) return;
      const found = [];
      [null, '::before', '::after'].forEach(pseudo => {
        let cs;
        try { cs = mainWin.getComputedStyle(el, pseudo); } catch (e) { return; }
        if (pseudo && (!cs.content || cs.content === 'none')) return;
        computedUrls(cs).forEach(u => {
          const raw = shownToRaw.get(u) || shownToRaw.get(resolveCssUrl(u));
          if (raw && !found.includes(raw)) found.push(raw);
        });
      });
      if (found.length) {
        el.classList.add('be-tpl-slot');
        el._beSlotUrls = found;
      }
    });
    const anySlot = card.classList.contains('be-tpl-slot') || card.querySelector('.be-tpl-slot');
    if (anySlot && !settings._slotHintShown) {
      settings._slotHintShown = true;
      saveSettings(settings);
      toast('提示：这个模板里的图片可以直接点卡片上的图片区域更换', 'info');
    }
  }
  function collectSlotCandidates(target, card) {
    const out = [];
    for (let el = target; el && el.nodeType === 1; el = el.parentElement) {
      (el._beSlotUrls || []).forEach(raw => { if (!out.includes(raw)) out.push(raw); });
      if (el === card) break;
    }
    return out;
  }
  function pickImageFile() {
    return new Promise(resolve => {
      const input = mainDoc.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', e => resolve((e.target.files && e.target.files[0]) || null));
      input.click();
    });
  }
  async function replaceTemplateImage(raw) {
    const tpl = currentTemplate();
    if (!tpl) return;
    const f = await pickImageFile();
    if (!f) return;
    try {
      const ref = await saveImageFile(f, 'slot');
      tpl.slotImages = tpl.slotImages || {};
      const old = tpl.slotImages[raw];
      tpl.slotImages[raw] = ref;
      if (old && old !== ref) imgForget(old);
      saveSettings(settings);
      injectCustomTemplateStyles();
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
      toast('已替换图片', 'success');
    } catch (err) {
      toast('上传失败：' + (err?.message || err), 'error');
    }
  }
  function restoreTemplateImage(raw) {
    const tpl = currentTemplate();
    if (!tpl || !tpl.slotImages || !tpl.slotImages[raw]) return;
    imgForget(tpl.slotImages[raw]);
    delete tpl.slotImages[raw];
    saveSettings(settings);
    injectCustomTemplateStyles();
    if (mainDoc.getElementById('be-card')) renderCard(lastText);
    toast('已恢复原图', 'success');
  }
  function closeSlotChooser() {
    mainDoc.getElementById('be-slot-chooser')?.classList.remove('show');
  }
  // 一个位置叠了多张图（多图模板、元素+伪元素、外层背景）或这张图已经换过时，先让用户选"换哪张/恢复原图"
  function openSlotChooser(cands, x, y) {
    const tpl = currentTemplate();
    if (!tpl) return;
    const map = tpl.slotImages || {};
    let box = mainDoc.getElementById('be-slot-chooser');
    if (!box) {
      box = mainDoc.createElement('div');
      box.id = 'be-slot-chooser';
      mainDoc.body.appendChild(box);
      mainDoc.addEventListener('pointerdown', e => {
        const b = mainDoc.getElementById('be-slot-chooser');
        if (b && b.classList.contains('show') && !b.contains(e.target)) closeSlotChooser();
      }, true);
    } else if (box.parentNode !== mainDoc.body || box.nextSibling) {
      mainDoc.body.appendChild(box);
    }
    box.innerHTML = `
      <div class="be-slot-chooser-title">更换图片</div>
      ${cands.map((raw, i) => {
        const ref = map[raw];
        const shown = (ref && imgUrlSync(ref)) || resolveCssUrl(raw);
        return `
          <div class="be-slot-row" data-i="${i}">
            <span class="be-slot-thumb" style="background-image:url('${String(shown).replace(/'/g, '%27')}');"></span>
            <span class="be-slot-name">图 ${i + 1}${ref ? '（已替换）' : ''}</span>
            <button type="button" class="be-btn" data-act="replace" data-i="${i}">换图</button>
            ${ref ? `<button type="button" class="be-btn" data-act="restore" data-i="${i}">恢复</button>` : ''}
          </div>`;
      }).join('')}
    `;
    box.querySelectorAll('button[data-act]').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        const raw = cands[Number(b.getAttribute('data-i'))];
        closeSlotChooser();
        if (b.getAttribute('data-act') === 'replace') replaceTemplateImage(raw);
        else restoreTemplateImage(raw);
      });
    });
    box.classList.add('show');
    const bw = box.offsetWidth, bh = box.offsetHeight;
    const left = Math.max(8, Math.min(x - bw / 2, mainWin.innerWidth - bw - 8));
    const top = Math.max(8, Math.min(y + 12, mainWin.innerHeight - bh - 8));
    box.style.left = (left + (mainWin.scrollX || 0)) + 'px';
    box.style.top = (top + (mainWin.scrollY || 0)) + 'px';
  }
  function onCardSlotClick(e) {
    const card = mainDoc.getElementById('be-card');
    if (!card || !card.contains(e.target)) return;
    if (e.target.closest('.be-quote, .be-avatar-clickable, .be-card-hl')) return;
    try { const sel = mainWin.getSelection(); if (sel && !sel.isCollapsed) return; } catch (err) {}
    const cands = collectSlotCandidates(e.target, card);
    if (!cands.length) return;
    e.stopPropagation();
    const map = (currentTemplate() || {}).slotImages || {};
    if (cands.length === 1 && !map[cands[0]]) replaceTemplateImage(cands[0]);
    else openSlotChooser(cands, e.clientX, e.clientY);
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
  let lastRangeFrame = null;   // lastRange 若来自状态栏 iframe，记这个 iframe 元素；mainDoc 选区时为 null
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
    if (settings.highlightDisabled) { hideBar(); return; }
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
    lastRangeFrame = null;
    const rects = range.getClientRects();
    const rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    // 两点定位模式：正常拖选（比如长按拖出选区）先记开头/结尾，拼出最终 Range 后才弹平时那条 划线/想法/书摘 工具栏，
    // 不是另开一套点按坐标的机制——原生选区本来就能用，问题只出在"选太长/太短不好调"，所以复用选区本身分两步做就够了
    if (settings.selectMode === 'tap') { hideBar(); showPickStepBar(rect); }
    else { hidePickStepBar(); showBar(rect); }
  }
  function scheduleCheck(delay = 80) {
    if (selDebounce) clearTimeout(selDebounce);
    selDebounce = setTimeout(dispatchSelectionCheck, delay);
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
    const spans = queryAllHighlightSpans(`.be-highlight[data-be-id="${noteId}"]`);
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
    const spans = queryAllHighlightSpans(`.be-highlight[data-be-id="${id}"]`);
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
    const spans = queryAllHighlightSpans(`.be-highlight[data-be-id="${id}"]`);
    if (!note && !spans.length) return;
    if (note) removeNote(note.charKey, id);
    unwrapHighlightSpans(id);
    toast(note ? '已删除划线' : '已清除残留划线（记录已丢失）', 'success');
    if (mainDoc.getElementById('be-panel')?.classList.contains('open')) renderPanel();
  }

  // ---------- 跟随酒馆主题：现场采样酒馆真实元素的样式 ----------
  // 不猜变量名：直接找一个酒馆自己的下拉框(select) / h4 标题，读它的计算样式——这样用户装的美化主题
  // （给 select/h4 加的贴图 background-image、边框、border-image、阴影、毛玻璃）都会原样带过来。
  // select 本身常是半透明（ST 默认 --black30a），真实观感是"它叠在所在面板背景上"，所以要沿祖先往上
  // 把每层背景（颜色+贴图）按顺序叠起来，直到遇到不透明的一层，否则挪到聊天区上方就成了透明的。
  function splitCssList(v) {
    const out = [];
    let depth = 0, cur = '';
    for (const ch of String(v || '')) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function parseCssColor(c) {
    const m = String(c || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.some(isNaN)) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function findTavernSample(kind) {
    const sels = kind === 'select'
      ? ['#themes', '#left-nav-panel select', '.drawer-content select', 'select.text_pole', 'select']
      : ['#left-nav-panel h4', '#rm_api_block h4', '.drawer-content h4', 'h4'];
    for (const s of sels) {
      let list;
      try { list = mainDoc.querySelectorAll(s); } catch (e) { continue; }
      for (const el of list) {
        if (!el.closest('[id^="be-"]')) return el;
      }
    }
    return null;
  }
  function collectTavernBgStack(el) {
    const layers = [];
    let blur = '';
    let node = el;
    let alphaLeft = 1;
    const pushLayers = (cs) => {
      const imgs = splitCssList(cs.backgroundImage);
      const sizes = splitCssList(cs.backgroundSize);
      const poss = splitCssList(cs.backgroundPosition);
      const reps = splitCssList(cs.backgroundRepeat);
      imgs.forEach((img, i) => {
        if (!img || img === 'none') return;
        if (/down-arrow/i.test(img)) return; // ST 下拉框自带的小箭头图标，不是背景贴图
        layers.push({
          image: img,
          size: sizes.length ? sizes[i % sizes.length] : 'auto',
          position: poss.length ? poss[i % poss.length] : '0% 0%',
          repeat: reps.length ? reps[i % reps.length] : 'repeat'
        });
      });
    };
    while (node && node.nodeType === 1) {
      let cs;
      try { cs = mainWin.getComputedStyle(node); } catch (e) { break; }
      pushLayers(cs);
      if (node === el) {
        ['::before', '::after'].forEach(pseudo => {
          try {
            const pcs = mainWin.getComputedStyle(node, pseudo);
            if (pcs && pcs.content && pcs.content !== 'none') pushLayers(pcs);
          } catch (e) {}
        });
      }
      const col = parseCssColor(cs.backgroundColor);
      if (col && col.a > 0) {
        layers.push({ color: col });
        alphaLeft *= (1 - col.a);
      }
      if (!blur) {
        const bf = cs.backdropFilter || cs.webkitBackdropFilter;
        if (bf && bf !== 'none') blur = bf;
      }
      if (alphaLeft < 0.02) break;
      node = node.parentElement;
    }
    return { layers, blur, alphaLeft };
  }
  function blendLayerColors(layers, base) {
    // 从最底层往上把纯色层按 alpha 叠出一个近似实色，给小三角箭头用（箭头是 border 画的，没法贴图）
    let r = base.r, g = base.g, b = base.b;
    for (let i = layers.length - 1; i >= 0; i--) {
      const c = layers[i].color;
      if (!c) continue;
      r = c.r * c.a + r * (1 - c.a);
      g = c.g * c.a + g * (1 - c.a);
      b = c.b * c.a + b * (1 - c.a);
    }
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }
  const TAVERN_FLOAT_PROPS = [
    'background-image', 'background-size', 'background-position', 'background-repeat', 'background-color',
    'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius', 'box-shadow',
    'backdrop-filter', '-webkit-backdrop-filter', 'text-shadow',
    'border-image-source', 'border-image-slice', 'border-image-width', 'border-image-outset', 'border-image-repeat',
    '--be-float-fg', '--be-float-arrow', '--be-float-divider', '--be-float-fw'
  ];
  // 采样结果缓存：只在第一次用到、开关切换、或酒馆主题变化时重新读一次，弹工具条时直接套缓存
  const _tavernStyleCache = new Map();
  let _tavernStyleObserver = null;
  function invalidateTavernStyleCache() { _tavernStyleCache.clear(); }
  function watchTavernThemeChanges() {
    if (_tavernStyleObserver) return;
    try {
      // 酒馆换主题/改美化：会改 <head> 里的样式（custom-style 等）或 :root/body 上的内联变量和 class
      _tavernStyleObserver = new mainWin.MutationObserver(muts => {
        for (const m of muts) {
          const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
          if (t && t.id && t.id.startsWith('be-')) continue; // 自己注入的样式变化不算
          invalidateTavernStyleCache();
          return;
        }
      });
      _tavernStyleObserver.observe(mainDoc.head, { childList: true, subtree: true, characterData: true });
      _tavernStyleObserver.observe(mainDoc.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
      _tavernStyleObserver.observe(mainDoc.body, { attributes: true, attributeFilter: ['style'] });
    } catch (e) {}
  }
  function computeTavernFloatProps(kind) {
    const sample = findTavernSample(kind);
    if (!sample) return null;
    let cs;
    try { cs = mainWin.getComputedStyle(sample); } catch (e) { return null; }
    const out = [];
    const set = (p, v) => out.push([p, v]);
    const { layers, blur, alphaLeft } = collectTavernBgStack(sample);
    // 一路叠到 body 都还很透明（主题把面板做成了纯透明）时，垫一层酒馆的 UI 背景色，
    // 否则工具条浮在聊天文字上面根本看不清
    if (alphaLeft > 0.5 && !blur) {
      const tint = parseCssColor(mainWin.getComputedStyle(mainDoc.body).getPropertyValue('--SmartThemeBlurTintColor'));
      layers.push({ color: tint ? { ...tint, a: 1 } : { r: 23, g: 23, b: 23, a: 1 } });
    }
    const imgs = [], sizes = [], poss = [], reps = [];
    layers.forEach(l => {
      if (l.color) {
        const c = l.color;
        imgs.push(`linear-gradient(rgba(${c.r}, ${c.g}, ${c.b}, ${c.a}), rgba(${c.r}, ${c.g}, ${c.b}, ${c.a}))`);
        sizes.push('auto'); poss.push('0% 0%'); reps.push('repeat');
      } else {
        imgs.push(l.image); sizes.push(l.size); poss.push(l.position); reps.push(l.repeat);
      }
    });
    if (imgs.length) {
      set('background-color', 'transparent');
      set('background-image', imgs.join(', '));
      set('background-size', sizes.join(', '));
      set('background-position', poss.join(', '));
      set('background-repeat', reps.join(', '));
    }
    if (blur) { set('backdrop-filter', blur); set('-webkit-backdrop-filter', blur); }
    ['top', 'right', 'bottom', 'left'].forEach(side => {
      const w = cs.getPropertyValue(`border-${side}-width`);
      const st = cs.getPropertyValue(`border-${side}-style`);
      const c = cs.getPropertyValue(`border-${side}-color`);
      if (st && st !== 'none' && parseFloat(w) > 0) set(`border-${side}`, `${w} ${st} ${c}`);
    });
    const radius = cs.getPropertyValue('border-top-left-radius');
    if (radius && parseFloat(radius) > 0) set('border-radius', cs.borderRadius);
    if (cs.boxShadow && cs.boxShadow !== 'none') set('box-shadow', cs.boxShadow);
    if (cs.textShadow && cs.textShadow !== 'none') set('text-shadow', cs.textShadow);
    if (cs.borderImageSource && cs.borderImageSource !== 'none') {
      set('border-image-source', cs.borderImageSource);
      set('border-image-slice', cs.borderImageSlice);
      set('border-image-width', cs.borderImageWidth);
      set('border-image-outset', cs.borderImageOutset);
      set('border-image-repeat', cs.borderImageRepeat);
    }
    set('--be-float-fg', cs.color);
    const fg = parseCssColor(cs.color);
    if (fg) set('--be-float-divider', `rgba(${fg.r}, ${fg.g}, ${fg.b}, 0.2)`);
    set('--be-float-arrow', blendLayerColors(layers, { r: 43, g: 43, b: 43 }));
    if (kind === 'h4') set('--be-float-fw', cs.fontWeight);
    return out;
  }
  function applyTavernFloatStyle(el, kind) {
    if (!el) return;
    TAVERN_FLOAT_PROPS.forEach(p => { try { el.style.removeProperty(p); } catch (e) {} });
    if (!settings.followTavernTheme) return;
    watchTavernThemeChanges();
    if (!_tavernStyleCache.has(kind)) _tavernStyleCache.set(kind, computeTavernFloatProps(kind));
    const props = _tavernStyleCache.get(kind);
    if (props) props.forEach(([p, v]) => el.style.setProperty(p, v));
  }

  function showBar(rect) {
    const bar = ensureBar();
    applyTavernFloatStyle(bar, 'select');
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

  // ---------- 两点定位取词（设置里"取词方式"=两点定位时启用）----------
  // 不是另起一套点坐标的交互：直接复用原生拖选本身已经能选中文字这件事，只是把
  // "选中就直接划线"拆成两步——先正常拖选一次当开头，点"设为开头"记下这段的起点；
  // 再拖选一次当结尾，点"设为结尾"用它的终点拼出最终 Range，然后走回平时的 划线/想法/书摘 工具栏。
  let pickPendingStart = null; // {node, offset}，null 表示还没记开头
  function ensurePickStepBar() {
    let bar = mainDoc.getElementById('be-pick-step-bar');
    if (bar) return bar;
    bar = mainDoc.createElement('div');
    bar.id = 'be-pick-step-bar';
    bar.addEventListener('pointerdown', e => { e.preventDefault(); });
    mainDoc.body.appendChild(bar);
    return bar;
  }
  function hidePickStepBar() {
    mainDoc.getElementById('be-pick-step-bar')?.classList.remove('show');
  }
  function resetPickPending() {
    pickPendingStart = null;
    hidePickStepBar();
  }
  function handlePickStepMain() {
    if (!lastRange) return;
    if (!pickPendingStart) {
      pickPendingStart = { node: lastRange.startContainer, offset: lastRange.startOffset, frame: lastRangeFrame };
      hidePickStepBar();
      try { (lastRangeFrame ? frameSelWin(lastRangeFrame) : mainWin).getSelection().removeAllRanges(); } catch (e) {}
      toast('已设置开头，请再选中结尾的词语', 'info');
      return;
    }
    const endRange = lastRange;
    const endFrame = lastRangeFrame;
    // 开头和结尾要在同一个文档里（同在聊天正文，或同在一个状态栏 iframe 里）才能拼成一个选区
    if (pickPendingStart.frame !== endFrame) {
      toast('开头和结尾不在同一段文字里（比如一个在状态栏、一个在正文），请重新开始', 'error');
      resetPickPending();
      return;
    }
    const doc = (pickPendingStart.node && pickPendingStart.node.ownerDocument) || mainDoc;
    const range = doc.createRange();
    try {
      range.setStart(pickPendingStart.node, pickPendingStart.offset);
      range.setEnd(endRange.endContainer, endRange.endOffset);
      if (range.collapsed) {
        range.setStart(endRange.startContainer, endRange.startOffset);
        range.setEnd(pickPendingStart.node, pickPendingStart.offset);
      }
    } catch (err) {
      toast('两次选择不在同一段文字里，构造失败，请重新开始', 'error');
      resetPickPending();
      return;
    }
    resetPickPending();
    const picked = getRangeText(range);
    if (!picked.text || !picked.text.length) { toast('没选到文字，请重新开始', 'error'); return; }
    lastText = picked.text;
    lastRichText = picked.rich;
    lastRange = range.cloneRange();
    lastRangeFrame = endFrame;
    const rects = range.getClientRects();
    const rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    showBar(endFrame ? translateFrameRect(rect, endFrame) : rect);
  }
  function showPickStepBar(rect) {
    const bar = ensurePickStepBar();
    const label = pickPendingStart ? '设为结尾' : '设为开头';
    bar.innerHTML = `
      <button class="be-fbtn" type="button" data-act="main">${ICONS.underline}<span>${label}</span></button>
      ${pickPendingStart ? '<span class="be-fbtn-divider"></span><button class="be-fbtn" type="button" data-act="cancel">✕<span>取消</span></button>' : ''}
    `;
    applyTavernFloatStyle(bar, 'select');
    const bindTap = (el, fn) => {
      const handler = e => { e.stopPropagation(); e.preventDefault(); fn(); };
      el.addEventListener('click', handler);
      el.addEventListener('touchend', handler, { passive: false });
    };
    bindTap(bar.querySelector('[data-act="main"]'), handlePickStepMain);
    const cancelBtn = bar.querySelector('[data-act="cancel"]');
    if (cancelBtn) {
      bindTap(cancelBtn, () => {
        resetPickPending();
        try { mainWin.getSelection().removeAllRanges(); } catch (e) {}
        toast('已取消，重新选择开头', 'info');
      });
    }
    bar.classList.add('show');
    bar.classList.remove('arrow-bottom');
    bar.style.left = '-9999px';
    bar.style.top = '-9999px';
    const bw = bar.offsetWidth || 100;
    const bh = bar.offsetHeight || 40;
    const vw = mainWin.innerWidth;
    const vh = mainWin.innerHeight;
    let left = (rect.left + rect.right) / 2 - bw / 2;
    let top = rect.bottom + 6;
    let arrowBottom = false;
    if (top + bh + 4 > vh) { top = rect.top - bh - 6; arrowBottom = true; }
    left = Math.max(8, Math.min(left, vw - bw - 8));
    const arrowLeft = (rect.left + rect.right) / 2 - left;
    bar.style.setProperty('--arrow-left', `${Math.max(16, Math.min(bw - 16, arrowLeft))}px`);
    if (top < 8) top = 8;
    bar.style.left = (left + (mainWin.scrollX || 0)) + 'px';
    bar.style.top = (top + (mainWin.scrollY || 0)) + 'px';
    if (arrowBottom) bar.classList.add('arrow-bottom');
  }

  // ---------- 卡片正文二次高亮（第13条）----------
  // 跟聊天记录划线是两套完全独立的机制：这里选中的是已经生成好的书摘卡片正文（.be-quote），
  // 高亮效果只加在这次弹窗的实时 DOM 上，不创建 note、不落盘——跟"编辑正文"关闭弹窗即丢弃是同一个设计。
  let cardHlRange = null;
  // 卡片二次高亮的样式：underline/wavy/marker 沿用聊天划线那套 class；fontcolor 只改字色（不画线）；
  // bold 是独立开关，可以叠加在任何样式上。同一次选区可能被拆成多个 span（跨节点），用 data-chl 编组，改样式时整组一起改。
  function applyCardHlStyle(span, style, color, bold) {
    span.className = `be-highlight style-${style} be-card-hl`;
    span.dataset.st = style;
    span.dataset.col = color || '';
    span.dataset.bold = bold ? '1' : '';
    applySpanColor(span, style === 'fontcolor' ? '' : style, style === 'fontcolor' ? '' : color);
    span.style.color = (style === 'fontcolor' && color) ? color : '';
    span.style.fontWeight = bold ? '700' : '';
  }
  function cardHlGroup(gid) {
    return Array.from(mainDoc.querySelectorAll(`.be-card-hl[data-chl="${gid}"]`));
  }
  function wrapCardRange(range, style, color, bold) {
    const doc = (range.startContainer && range.startContainer.ownerDocument) || mainDoc;
    const gid = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const makeSpan = () => {
      const span = doc.createElement('span');
      span.dataset.chl = gid;
      applyCardHlStyle(span, style, color, bold);
      span.addEventListener('click', e => {
        e.stopPropagation();
        openCardHlPop(gid, span);
      });
      return span;
    };
    try {
      const span = makeSpan();
      range.surroundContents(span);
      return [span];
    } catch (e) {}
    // 跨节点兜底：逐 text node 分段包裹（跟 wrapRange 同一套 TreeWalker 逻辑，只是不挂 data-be-id/笔记联动）
    const spans = [];
    const startNode = range.startContainer, startOffset = range.startOffset;
    const endNode = range.endContainer, endOffset = range.endOffset;
    const root = range.commonAncestorContainer;
    const walker = doc.createTreeWalker(
      root.nodeType === 1 ? root : root.parentNode,
      NodeFilter.SHOW_TEXT,
      { acceptNode(node) {
          if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
          if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
          if (node.parentElement && node.parentElement.closest('.be-highlight')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        } }
    );
    let n; const textNodes = [];
    while ((n = walker.nextNode())) textNodes.push(n);
    for (const node of textNodes) {
      let from = 0, to = node.nodeValue.length;
      if (node === startNode && startNode.nodeType === 3) from = startOffset;
      if (node === endNode && endNode.nodeType === 3) to = endOffset;
      if (to <= from) continue;
      const seg = node.nodeValue.slice(from, to);
      if (!seg.replace(/\s/g, '')) continue;
      let target = node;
      if (from > 0) { target = target.splitText(from); to -= from; }
      if (to < target.nodeValue.length) target.splitText(to);
      const span = makeSpan();
      target.parentNode.insertBefore(span, target);
      span.appendChild(target);
      spans.push(span);
    }
    return spans;
  }
  function ensureCardHlBar() {
    let bar = mainDoc.getElementById('be-card-hl-bar');
    if (bar) return bar;
    bar = mainDoc.createElement('div');
    bar.id = 'be-card-hl-bar';
    bar.innerHTML = `
      <button class="be-fbtn" data-act="underline" type="button"><span class="be-chl-ico be-chl-ico-u">A</span><span>下划线</span></button>
      <span class="be-fbtn-divider"></span>
      <button class="be-fbtn" data-act="marker" type="button"><span class="be-chl-ico be-chl-ico-m">A</span><span>荧光笔</span></button>
      <span class="be-fbtn-divider"></span>
      <button class="be-fbtn" data-act="fontcolor" type="button"><span class="be-chl-ico be-chl-ico-c">A</span><span>字色</span></button>
      <span class="be-fbtn-divider"></span>
      <button class="be-fbtn" data-act="bold" type="button"><span class="be-chl-ico be-chl-ico-b">B</span><span>加粗</span></button>
    `;
    bar.addEventListener('pointerdown', e => { e.preventDefault(); });
    const fireAction = (act) => {
      if (!cardHlRange) return;
      let style = act, color = '', bold = false;
      if (act === 'marker') color = settings.markerColor || '#ffdc6e';
      else if (act === 'underline') color = settings.underlineColor || '#95b6d6';
      else if (act === 'fontcolor') color = settings.underlineColor || '#95b6d6';
      else if (act === 'bold') { style = 'fontcolor'; bold = true; }
      try { wrapCardRange(cardHlRange, style, color, bold); } catch (e) {}
      hideCardHlBar();
      try { mainWin.getSelection().removeAllRanges(); } catch (e) {}
    };
    bar.querySelectorAll('.be-fbtn').forEach(b => {
      const handler = (e) => {
        e.stopPropagation(); e.preventDefault();
        if (b._beBusy) return;
        b._beBusy = true;
        setTimeout(() => { b._beBusy = false; }, 300);
        fireAction(b.getAttribute('data-act'));
      };
      b.addEventListener('click', handler);
      b.addEventListener('touchend', handler, { passive: false });
    });
    mainDoc.body.appendChild(bar);
    return bar;
  }
  function showCardHlBar(rect) {
    const bar = ensureCardHlBar();
    applyTavernFloatStyle(bar, 'select');
    bar.classList.add('show');
    bar.classList.remove('arrow-bottom');
    bar.style.left = '-9999px';
    bar.style.top = '-9999px';
    const bw = bar.offsetWidth || 120;
    const bh = bar.offsetHeight || 40;
    const vw = mainWin.innerWidth;
    const vh = mainWin.innerHeight;
    let left = (rect.left + rect.right) / 2 - bw / 2;
    let top = rect.bottom + 6;
    let arrowBottom = false;
    if (top + bh + 4 > vh) { top = rect.top - bh - 6; arrowBottom = true; }
    left = Math.max(8, Math.min(left, vw - bw - 8));
    const arrowLeft = (rect.left + rect.right) / 2 - left;
    bar.style.setProperty('--arrow-left', `${Math.max(16, Math.min(bw - 16, arrowLeft))}px`);
    if (top < 8) top = 8;
    bar.style.left = (left + (mainWin.scrollX || 0)) + 'px';
    bar.style.top = (top + (mainWin.scrollY || 0)) + 'px';
    if (arrowBottom) bar.classList.add('arrow-bottom');
  }
  function hideCardHlBar() {
    mainDoc.getElementById('be-card-hl-bar')?.classList.remove('show');
    cardHlRange = null;
  }
  function checkCardSelection(range) {
    const picked = getRangeText(range);
    if (!picked.text || !picked.text.length) { hideCardHlBar(); return; }
    cardHlRange = range.cloneRange();
    const rects = range.getClientRects();
    const rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    showCardHlBar(rect);
  }

  // 二次点击卡片里的高亮：弹出跟聊天划线工具条同款的"样式+颜色"那一排，外加删除和加粗
  let _cardHlPopCloser = null;
  function closeCardHlPop() {
    mainDoc.getElementById('be-card-hl-pop')?.classList.remove('show');
    if (_cardHlPopCloser) { mainDoc.removeEventListener('pointerdown', _cardHlPopCloser, true); _cardHlPopCloser = null; }
  }
  function renderCardHlPop(pop, gid) {
    const spans = cardHlGroup(gid);
    if (!spans.length) { closeCardHlPop(); return; }
    const first = spans[0];
    const st = first.dataset.st || 'underline';
    const col = String(first.dataset.col || '').toLowerCase();
    const bold = first.dataset.bold === '1';
    const initialCustom = first.dataset.col || settings.underlineColor || '#95b6d6';
    pop.innerHTML = `
      <div class="be-hl-row1">
        <button data-act="del" class="danger">删除划线</button>
      </div>
      <div class="be-hl-row2 be-hl-row2-scroll">
        <button class="be-hl-st ${st==='underline'?'active':''}" data-st="underline" title="下划线"><span class="be-hl-sample sample-underline">A</span></button>
        <button class="be-hl-st ${st==='wavy'?'active':''}" data-st="wavy" title="波浪线"><span class="be-hl-sample sample-wavy">A</span></button>
        <button class="be-hl-st ${st==='marker'?'active':''}" data-st="marker" title="荧光笔"><span class="be-hl-sample sample-marker">A</span></button>
        <button class="be-hl-st ${st==='fontcolor'?'active':''}" data-st="fontcolor" title="只改字色"><span class="be-hl-sample sample-fontcolor" style="color:${escapeHtml(first.dataset.col || '#e8a0a0')};">A</span></button>
        <button class="be-hl-st ${bold?'active':''}" data-act="bold" title="加粗"><span class="be-hl-sample sample-bold">B</span></button>
        <span class="be-hl-divider"></span>
        ${getPaletteColors().map(c => `<button class="be-hl-col ${col===c.toLowerCase()?'active':''}" data-col="${c}" style="background:${c};"></button>`).join('')}
        <span class="be-hl-col rainbow" title="自定义颜色">
          +
          <input type="color" class="be-hl-col-input" value="${escapeHtml(initialCustom)}">
        </span>
      </div>
    `;
    const applyAll = (nextSt, nextCol, nextBold) => {
      cardHlGroup(gid).forEach(s => applyCardHlStyle(s, nextSt, nextCol, nextBold));
    };
    pop.querySelector('[data-act="del"]').addEventListener('click', () => {
      cardHlGroup(gid).forEach(s => {
        const parent = s.parentNode;
        if (!parent) return;
        while (s.firstChild) parent.insertBefore(s.firstChild, s);
        parent.removeChild(s);
        try { parent.normalize(); } catch (e) {}
      });
      closeCardHlPop();
    });
    pop.querySelectorAll('.be-hl-st[data-st]').forEach(b => {
      b.addEventListener('click', () => {
        const nextSt = b.getAttribute('data-st');
        // 从"只改字色"切到画线样式、或反过来时，没选过颜色就给一个该样式的默认色，免得切过去看不见
        let nextCol = first.dataset.col;
        if (!nextCol) nextCol = nextSt === 'marker' ? (settings.markerColor || '#ffdc6e') : (settings.underlineColor || '#95b6d6');
        applyAll(nextSt, nextCol, first.dataset.bold === '1');
        renderCardHlPop(pop, gid);
      });
    });
    pop.querySelector('[data-act="bold"]').addEventListener('click', () => {
      applyAll(first.dataset.st || 'underline', first.dataset.col, first.dataset.bold !== '1');
      renderCardHlPop(pop, gid);
    });
    pop.querySelectorAll('.be-hl-col[data-col]').forEach(b => {
      b.addEventListener('click', () => {
        applyAll(first.dataset.st || 'underline', b.getAttribute('data-col'), first.dataset.bold === '1');
        renderCardHlPop(pop, gid);
      });
    });
    const customInput = pop.querySelector('.be-hl-col-input');
    if (customInput) {
      const onChange = () => applyAll(first.dataset.st || 'underline', customInput.value, first.dataset.bold === '1');
      customInput.addEventListener('input', onChange);
      customInput.addEventListener('change', onChange);
      customInput.addEventListener('pointerdown', e => e.stopPropagation());
      customInput.addEventListener('click', e => e.stopPropagation());
    }
  }
  function openCardHlPop(gid, anchor) {
    hideCardHlBar();
    let pop = mainDoc.getElementById('be-card-hl-pop');
    if (!pop) {
      pop = mainDoc.createElement('div');
      pop.id = 'be-card-hl-pop';
      pop.addEventListener('pointerdown', e => {
        if (!e.target.closest('input')) e.preventDefault();
      });
      mainDoc.body.appendChild(pop);
    } else if (pop.parentNode !== mainDoc.body || pop.nextSibling) {
      mainDoc.body.appendChild(pop);
    }
    renderCardHlPop(pop, gid);
    applyTavernFloatStyle(pop, 'h4');
    const rect = anchor.getBoundingClientRect();
    pop.classList.add('show');
    pop.classList.remove('arrow-bottom');
    pop.style.left = '-9999px'; pop.style.top = '-9999px';
    const bw = pop.offsetWidth, bh = pop.offsetHeight;
    const vw = mainWin.innerWidth, vh = mainWin.innerHeight;
    let left = (rect.left + rect.right) / 2 - bw / 2;
    let top = rect.bottom + 8;
    let arrowBottom = false;
    if (top + bh + 4 > vh) { top = rect.top - bh - 8; arrowBottom = true; }
    left = Math.max(8, Math.min(left, vw - bw - 8));
    const arrowLeft = (rect.left + rect.right) / 2 - left;
    pop.style.setProperty('--arrow-left', `${Math.max(16, Math.min(bw - 16, arrowLeft))}px`);
    if (top < 8) top = 8;
    pop.style.left = (left + (mainWin.scrollX || 0)) + 'px';
    pop.style.top = (top + (mainWin.scrollY || 0)) + 'px';
    if (arrowBottom) pop.classList.add('arrow-bottom');
    if (_cardHlPopCloser) mainDoc.removeEventListener('pointerdown', _cardHlPopCloser, true);
    _cardHlPopCloser = (e) => {
      if (!pop.contains(e.target) && !e.target.closest('.be-card-hl')) closeCardHlPop();
    };
    setTimeout(() => mainDoc.addEventListener('pointerdown', _cardHlPopCloser, true), 60);
  }

  // 导出前（只动 clone，不碰预览）：把卡片二次高亮逐字拆成单字 span。
  // html2canvas 给行内元素画背景/边框时用的是整个元素的外接矩形，不按行切片——一段跨两行的高亮，
  // 荧光笔（linear-gradient 背景）会被画成横跨两行的一整块，下划线（border-bottom）只画在外接框最底下一行。
  // 拆成单字后每个 span 只占一行，画出来就跟预览一致。只处理 .be-card-hl，别的元素不受影响。
  function splitCardHlForExport(root) {
    const doc = root.ownerDocument;
    root.querySelectorAll('.be-card-hl').forEach(span => {
      const cls = span.className;
      const css = span.getAttribute('style') || '';
      const walker = doc.createTreeWalker(span, NodeFilter.SHOW_TEXT);
      const texts = [];
      let t;
      while ((t = walker.nextNode())) texts.push(t);
      const allChars = [];
      texts.forEach(tn => {
        const frag = doc.createDocumentFragment();
        for (const ch of Array.from(tn.nodeValue || '')) {
          const s = doc.createElement('span');
          s.className = cls;
          s.setAttribute('style', css);
          s.style.paddingLeft = '0';
          s.style.paddingRight = '0';
          s.textContent = ch;
          frag.appendChild(s);
          allChars.push(s);
        }
        tn.parentNode.replaceChild(frag, tn);
      });
      // 原来整段左右各 1px 内边距，拆开后只保留在首尾字上，保证排版宽度跟预览一模一样
      if (allChars.length) {
        allChars[0].style.paddingLeft = '1px';
        allChars[allChars.length - 1].style.paddingRight = '1px';
      }
      span.className = '';
      span.removeAttribute('style');
    });
  }
  // 选区分流：卡片正文（.be-quote，且不在"编辑正文"模式下，避免跟改字光标冲突）走二次高亮，
  // 其它一律沿用原有的聊天划线判定（checkSelection 内部自己会用 isInsideChat 再筛一遍）
  function dispatchSelectionCheck() {
    const sel = mainWin.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed && !currentEditable) {
      let range = null;
      try { range = sel.getRangeAt(0); } catch (e) {}
      if (range) {
        const quote = mainDoc.querySelector('#be-card .be-quote');
        if (quote && quote.contains(range.commonAncestorContainer)) {
          hideBar();
          checkCardSelection(range);
          return;
        }
      }
    }
    hideCardHlBar();
    checkSelection();
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
      noteId: item.noteId || '',
      charKey: item.charKey || '',   // 这条高亮本来属于哪个角色——合并存笔记时按这个归档，不是按"当前激活角色"
      chatId: item.chatId || ''
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
  function mergeBasketOrder(noteId) {
    const idx = mergeBasket.findIndex(x => x.noteId === noteId);
    return idx === -1 ? 0 : idx + 1;
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
    if (target === 'note' || target === 'card' || target === 'both') {
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
    let splitCount = 0;
    if (target === 'note' || target === 'both') {
      splitCount = saveMergedAsNotes(items);
    }
    if (target === 'card' || target === 'both') {
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
    const doneMsg = target === 'both' ? '已存为笔记并生成书摘' : (target === 'note' ? '已存为笔记' : '已生成书摘');
    toast(deleteOriginal ? `${doneMsg}，原有 ${count} 条划线已删除` : doneMsg, 'success');
    if (splitCount > 1) toast(`合并的划线来自 ${splitCount} 个不同角色，已自动拆成 ${splitCount} 条笔记分别归档`, 'info');
    if (panelView === 'char') fillCharNotes();
  }
  // 按来源角色分组分别存成笔记，不再一律存进"当前实际激活角色"的桶——合并篮子里的条目可能是从
  // 笔记本翻出来的、属于别的角色（甚至没有激活角色，归到 unknown）的历史划线，混在一起合并时
  // 要按各自本来所属的角色拆开保存。返回实际拆出的笔记条数（用于提示用户是否发生了拆分）。
  function saveMergedAsNotes(items) {
    const ctx = getContext();
    const groups = new Map(); // charKey -> items[]
    items.forEach(it => {
      const key = it.charKey || ctx.charKey || 'unknown';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(it);
    });
    groups.forEach((groupItems, key) => {
      const text = groupItems.map(x => x.text).join('\n\n');
      addNote({
        type: 'highlight', text, thoughts: [], merged: true, mergedCount: groupItems.length,
        style: settings.lastStyle || settings.highlightStyle,
        chatId: groupItems[0]?.chatId || ''
      }, key);
    });
    return groups.size;
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
        <div class="be-merge-target-opts" style="margin-top:6px;">
          <button class="be-btn" id="be-merge-to-both">两者都要</button>
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
    mask.querySelector('#be-merge-to-both').addEventListener('click', () => {
      if (dot.classList.contains('checked')) { settings.mergeDefaultTarget = 'both'; saveSettings(settings); }
      proceedToDeleteOriginalStep('both');
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

  // ---------- 状态栏 iframe 划线（best-effort）----------
  // 部分正则/自定义 HTML 渲染的状态栏用 iframe/srcdoc 做样式隔离，iframe 有自己独立的 document/Selection，
  // 挂在 mainDoc 上的选区监听完全看不到里面的选区变化——这里尽力去发现同源 iframe，把选区监听/划线包裹
  // 扩展进去；跨域 iframe 天然读不到内容，直接跳过，不报错不阻塞其它功能。
  // 已知限制：iframe 通常随消息重新渲染整个替换（比如正则重跑），已经划的线大概率跟着旧 iframe 一起消失，
  // 不像消息正文那样有 restoreHighlights 做内容匹配复原——这里只保证"当次能选中、能划线、当次会话内可见"。
  const trackedFrames = new Set(); // 普通 Set（不是 WeakSet）：删除/改样式划线时要能遍历已跟踪的 iframe 文档
  const frameDocMap = new WeakMap(); // document -> 对应的 iframe 元素，供“点击已有划线”时反查坐标换算
  function queryAllHighlightSpans(selector) {
    // 已划线的 span 可能分布在 mainDoc，也可能在某个状态栏 iframe 自己的文档里，
    // 删除/改样式这类操作要能一并找到，不然会出现"笔记记录删了、iframe 里视觉上还留着"的不一致
    let out = Array.from(mainDoc.querySelectorAll(selector));
    trackedFrames.forEach(iframeEl => {
      const d = frameSelDoc(iframeEl);
      if (!d) return;
      try { out = out.concat(Array.from(d.querySelectorAll(selector))); } catch (e) {}
    });
    return out;
  }

  function frameSelDoc(iframeEl) {
    try { return iframeEl.contentDocument || null; } catch (e) { return null; }
  }
  function frameSelWin(iframeEl) {
    try { return iframeEl.contentWindow || null; } catch (e) { return null; }
  }
  function isInsideChatFrame(iframeEl) {
    // iframe 自己的文档里不会有 .mes_text/.mes 这些 class，要回到主文档看这个 iframe 元素本身挂在哪
    try { return !!iframeEl.closest('.mes_text, .mes_block, .mes'); } catch (e) { return false; }
  }
  function translateFrameRect(rect, iframeEl) {
    let off;
    try { off = iframeEl.getBoundingClientRect(); } catch (e) { off = { left: 0, top: 0 }; }
    return {
      left: rect.left + off.left, right: rect.right + off.left,
      top: rect.top + off.top, bottom: rect.bottom + off.top
    };
  }
  function checkSelectionInFrame(iframeEl) {
    if (settings.highlightDisabled) return;
    if (!isInsideChatFrame(iframeEl)) return;
    const win = frameSelWin(iframeEl);
    if (!win) return;
    let sel;
    try { sel = win.getSelection(); } catch (e) { return; }
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { hideBar(); return; }
    let range;
    try { range = sel.getRangeAt(0); } catch (e) { return; }
    const picked = getRangeText(range);
    const text = picked.text;
    if (!text || text.length < 1) { hideBar(); return; }
    lastText = text;
    lastRichText = picked.rich;
    lastRange = range.cloneRange();
    lastRangeFrame = iframeEl;
    const rects = range.getClientRects();
    const rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    const r2 = translateFrameRect(rect, iframeEl);
    if (settings.selectMode === 'tap') { hideBar(); showPickStepBar(r2); }
    else { hidePickStepBar(); showBar(r2); }
  }
  let frameSelDebounce = null;
  function scheduleFrameCheck(iframeEl, delay = 80) {
    if (frameSelDebounce) clearTimeout(frameSelDebounce);
    frameSelDebounce = setTimeout(() => checkSelectionInFrame(iframeEl), delay);
  }
  // 状态栏（酒馆助手把正则/代码块渲染成 .mes_text .TH-render > iframe）划线不弹工具条的两个根因：
  //  1) iframe 的文档会被整个换掉：元素刚插进来时是 about:blank，srcdoc/blob 加载完才是真内容；状态栏刷新也会重新加载。
  //     旧代码只在第一次给"当时那个文档"绑监听，并把 iframe 元素记为已接管——文档一换，监听跟着旧文档死掉，且永不重绑。
  //  2) 酒馆助手是消息渲染完之后才异步插 iframe，旧代码只在"新增整条消息"时扫描，晚插入的 iframe 根本没被发现。
  // 现在：按文档绑定（WeakSet 记录已绑过的文档），iframe 每次 load 都检查一遍；并且聊天区里一出现 iframe 就立即接管。
  const boundFrameDocs = new WeakSet();
  const FRAME_SELECTABLE_CSS = `
    body, body :where(div, span, p, li, td, th, dd, dt, font, b, i, em, strong, small, u, s, del, ins, mark, sub, sup, label, blockquote, pre, code, h1, h2, h3, h4, h5, h6, section, article, details, summary) {
      -webkit-user-select: text !important; user-select: text !important;
    }`;
  function bindFrameDoc(iframeEl) {
    const doc = frameSelDoc(iframeEl);
    if (!doc || boundFrameDocs.has(doc)) return; // 跨域读不到 / 这个文档已经绑过
    if (doc.readyState === 'loading') return;      // 还在加载，等 load 事件
    boundFrameDocs.add(doc);
    trackedFrames.add(iframeEl);
    frameDocMap.set(doc, iframeEl);
    try {
      doc.addEventListener('selectionchange', () => scheduleFrameCheck(iframeEl, 120));
      doc.addEventListener('mouseup', () => scheduleFrameCheck(iframeEl, 30));
      doc.addEventListener('touchend', () => scheduleFrameCheck(iframeEl, 120));
      // 有些状态栏自己写了 user-select:none，长按根本选不中字——只对文字类元素放开，按钮/输入框不动
      if (doc.head && !doc.getElementById('be-frame-selectable')) {
        const st = doc.createElement('style');
        st.id = 'be-frame-selectable';
        st.textContent = FRAME_SELECTABLE_CSS;
        doc.head.appendChild(st);
      }
    } catch (e) {}
  }
  function trackIframeForSelection(iframeEl) {
    if (!iframeEl) return;
    if (!iframeEl._beFrameWatched) {
      iframeEl._beFrameWatched = true;
      iframeEl.addEventListener('load', () => bindFrameDoc(iframeEl));
    }
    bindFrameDoc(iframeEl);
  }
  function scanForStatusBarFrames(root) {
    try {
      (root || mainDoc).querySelectorAll('.mes_text iframe').forEach(trackIframeForSelection);
    } catch (e) {}
  }
  // 聊天区里任何时候插入 iframe（包括插在已经存在的消息里）都马上接管，不等下一次消息事件
  let _frameScanT = 0;
  function scheduleFrameScan() {
    if (_frameScanT) return;
    _frameScanT = setTimeout(() => { _frameScanT = 0; scanForStatusBarFrames(); }, 60);
  }

  // ---------- 划线 ----------
  function createHighlight(text, range, opts = {}) {
    if (!range) return null;
    const ctx = getContext();
    // 选区若来自状态栏 iframe，range 所在文档里没有 .mes 祖先（iframe 自己的 document 不认识这个 class），
    // 要回到 iframe 元素本身在主文档里的位置去找
    let msgEl = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement)?.closest('.mes');
    if (!msgEl && lastRangeFrame) {
      try { msgEl = lastRangeFrame.closest('.mes'); } catch (e) {}
    }
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
    // 选区所在的实际 document——正常情况下就是 mainDoc；若来自状态栏 iframe 则是那个 iframe 自己的 document，
    // 包裹用的 <span>/TreeWalker 都要用这个 document 创建，不能永远假设是 mainDoc
    const doc = (range.startContainer && range.startContainer.ownerDocument) || mainDoc;
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
      const span = attachHandlers(doc.createElement('span'));
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
    const walker = doc.createTreeWalker(
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
      const span = attachHandlers(doc.createElement('span'));
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
    scanForStatusBarFrames(); // 同一批触发时机顺带扫一遍新出现的状态栏 iframe（消息渲染/切聊天/DOM 变化）
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
    applyTavernFloatStyle(bar, 'h4');
    // 定位（贴近 anchorEl 下方；不够则上方）
    const anchor = anchorEl || mainDoc.querySelector(`.be-highlight[data-be-id="${noteId}"]`);
    // 划线 span 若在状态栏 iframe 里，getBoundingClientRect 是相对 iframe 自身视口的，要换算成 mainDoc 坐标
    const anchorFrame = anchor && anchor.ownerDocument !== mainDoc ? frameDocMap.get(anchor.ownerDocument) : null;
    const rect = anchor
      ? (anchorFrame ? translateFrameRect(anchor.getBoundingClientRect(), anchorFrame) : anchor.getBoundingClientRect())
      : { left: 100, top: 100, right: 200, bottom: 120 };
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
          else {
            const mCtx = getContext();
            addToMergeBasket({ text: fresh.text, source: 'note', noteId, charKey: mCtx.charKey, chatId: mCtx.chatId });
          }
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
    const src = getSourceValues();
    mask.querySelector('#be-src-user').value = src.sourceUser || '';
    mask.querySelector('#be-src-user').placeholder = ctx.userName || '{{user}}';
    mask.querySelector('#be-src-author').value = src.sourceAuthor || '';
    mask.querySelector('#be-src-author').placeholder = ctx.charName || '{{char}}';
    mask.querySelector('#be-src-title').value = src.sourceTitle || '';
    mask.querySelector('#be-src-showtitle').checked = !!src.showSourceTitle;
    mask.querySelector('#be-src-chapter').value = src.sourceChapter || '';
    mask.querySelector('#be-src-showchapter').checked = !!src.showSourceChapter;
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
    mask.querySelector('#be-src-title-wrap').classList.toggle('open', !!src.showSourceTitle);
    mask.querySelector('#be-src-chapter-wrap').classList.toggle('open', !!src.showSourceChapter);
    mask.querySelector('#be-src-wm-wrap').classList.toggle('open', settings.showWatermark !== false);

    // 头像预览回显
    const updateAvatarPreview = () => {
      const prev = mask.querySelector('#be-src-avatar-preview');
      if (!prev) return;
      const url = imgUrlSync(settings.customAvatar, updateAvatarPreview);
      prev.style.backgroundImage = url ? `url('${url}')` : '';
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
          await setCustomAvatarFromFile(f);
          // 一旦上传过头像，没切到 custom 类型时也提示用户去切
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
      clearCustomAvatar();
      updateAvatarPreview();
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
    });
    reNew('#be-src-save', () => {
      // 出处这几个字段按 sourceScope 走（全局/按角色/按角色+聊天），其它设置维持全局不变
      setSourceValues({
        sourceUser: mask.querySelector('#be-src-user').value.trim(),
        sourceAuthor: mask.querySelector('#be-src-author').value.trim(),
        sourceTitle: mask.querySelector('#be-src-title').value.trim(),
        showSourceTitle: mask.querySelector('#be-src-showtitle').checked,
        sourceChapter: mask.querySelector('#be-src-chapter').value.trim(),
        showSourceChapter: mask.querySelector('#be-src-showchapter').checked
      });
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
    drawer.innerHTML = `
      <div class="be-drawer-handle"></div>
      <div class="be-sec">
        <h4>主题</h4>
        <div class="be-drawer-row" id="be-drawer-tpl">
          ${(() => {
            const { favs, rest } = getTemplatePickerEntries();
            const chip = e => `<div class="be-drawer-chip ${settings.template===e.key?'active':''}" data-k="${e.key}">${e.fav?'★ ':''}${escapeHtml(e.name)}</div>`;
            const parts = favs.map(chip);
            if (favs.length && rest.length) parts.push('<span class="be-drawer-sep">·</span>');
            parts.push(...rest.map(chip));
            return parts.join('');
          })()}
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
          ${(settings.customColors||[]).map(c => `
            <div class="be-drawer-chip be-color-chip ${settings.colorPreset===('saved-'+c.id)?'active':''}" data-k="saved-${c.id}"
                 style="background:${c.bg};color:${c.fg};" title="${escapeHtml(c.name||'自定义配色')}">A</div>
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
    const scale = Math.max(2, Math.min(5, Number(settings.exportScale) || 2));
    sheet.innerHTML = `
      <div class="be-drawer-handle"></div>
      <div class="be-sec">
        <h4>字号 · 行距 · 字距 · 宽度</h4>
        <div class="be-drawer-typo">
          <span class="be-dt-ico" style="font-size:12px;">A</span>
          <input type="range" id="be-ts-qsize" min="11" max="22" step="1" value="${size}">
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
        <div class="be-row" style="margin-top:6px;">
          <label style="flex:1;">保存清晰度</label>
          <div class="be-radio-group" id="be-ts-scale-group">
            <button type="button" class="be-radio-opt ${scale===2?'active':''}" data-v="2">2x</button>
            <button type="button" class="be-radio-opt ${scale===3?'active':''}" data-v="3">3x</button>
            <button type="button" class="be-radio-opt ${scale===4?'active':''}" data-v="4">4x</button>
            <button type="button" class="be-radio-opt ${scale===5?'active':''}" data-v="5">5x</button>
          </div>
        </div>
        <div class="be-row" style="font-size:11px;opacity:0.7;">
          <span>倍率越高保存出来的图越清晰，但生成更慢、文件更大；手机屏幕一般 2x/3x 够用，想放大看细节可以选 4x/5x</span>
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
    sheet.querySelectorAll('#be-ts-scale-group .be-radio-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        settings.exportScale = Number(btn.getAttribute('data-v')) || 2;
        saveSettings(settings);
        sheet.querySelectorAll('#be-ts-scale-group .be-radio-opt').forEach(b => b.classList.toggle('active', b === btn));
      });
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

  // 单条书摘默认只读展示；点"编辑正文"手动开关，避免默认可编辑时不小心碰到光标误改内容。
  // 合并书摘默认已经是可编辑的（见 openExcerptModal 里 editable:true），这个按钮同样能把它关掉。
  function toggleQuoteEdit() {
    currentEditable = !currentEditable;
    renderCard(lastText);
    toast(currentEditable ? '已开启编辑，可直接点文字修改' : '已关闭编辑', 'info');
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
    hideCardHlBar();
    closeCardHlPop();
    closeSlotChooser();
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
          <button class="be-btn" id="be-toggle-edit">✎ 编辑正文</button>
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
    mainDoc.getElementById('be-toggle-edit').addEventListener('click', toggleQuoteEdit);
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

  // 只负责拼卡片 HTML，不碰页面：书摘弹窗（renderCard）和设置里的模板预览共用
  // opts.tplKey 指定模板（默认当前模板）；opts.preview 时不带 id、不用想法/删除线这些"当前这次摘录"的状态
  function buildCardMarkup(text, opts = {}) {
    const tplKey = opts.tplKey || settings.template;
    const isCustomTpl = String(tplKey || '').startsWith('custom-');
    const tplId = isCustomTpl
      ? tplKey
      : (TEMPLATES[tplKey] ? tplKey : 'classic');
    const thoughtText = opts.preview ? '' : currentThoughtText;
    const richText = opts.preview ? '' : currentRichText;
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

    // 三字段出处（按 sourceScope 可能来自全局设置，也可能是当前角色/角色+聊天各自存的）
    const src = getSourceValues();
    const userName   = src.sourceUser   || ctx.userName || '';
    const authorName = src.sourceAuthor || ctx.charName || '';
    const bookName   = src.showSourceTitle ? (src.sourceTitle || '') : '';
    const chapter    = src.showSourceChapter ? (src.sourceChapter || '') : '';
    const dateText = `摘录于 ${formatDate()}`;

    // 头像（按设置选 user / char / custom）
    const avatarUrl = (() => {
      if (settings.avatarType === 'custom') {
        return imgUrlSync(settings.customAvatar, () => { if (mainDoc.getElementById('be-card')) renderCard(lastText); });
      }
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
    const useRich = !!settings.keepDelLine && richText && stripDelMarks(richText) === text;
    const quotePart = quoteHtml(useRich ? richText : text);
    const q = thoughtText
      ? `<div class="be-thought-main">${maskText(thoughtText)}</div>
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
      // 头像统一走「头像类型」设置（与内置模板一致），.be-char-avatar 只保留占位、不再固定塞角色头像
      const cnDate = toChineseDate(new Date());
      inner = `
        <div class="be-head">
          ${settings.showAvatar ? `<div class="be-avatar" style="${avatarStyle}"></div>` : ''}
          ${settings.showAvatar ? `<div class="be-char-avatar" style="background:${c.avatarBg};display:none;"></div>` : ''}
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
    const html = `
      <div class="be-card tpl-${tplId}${noQuoteCls}" ${opts.preview ? '' : 'id="be-card"'}
           style="background:${c.bg};color:${c.fg};font-family:${fontCssAttr};--be-card-bg:${c.bg};--be-card-fg:${c.fg};">
        ${inner}
      </div>
    `;
    return { html, fontCss: font.css };
  }

  function renderCard(text) {
    const wrap = mainDoc.getElementById('be-card-wrap');
    if (!wrap) return;
    const built = buildCardMarkup(text);
    const font = { css: built.fontCss };
    wrap.innerHTML = built.html;
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
      const editBtn = mainDoc.getElementById('be-toggle-edit');
      if (editBtn) editBtn.classList.toggle('active', currentEditable);
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
    // 自定义模板图片槽：找出卡片上实际显示着模板图片的元素，点击即可换图（wrap 本身不会重建，监听只绑一次）
    markTemplateSlots(wrap);
    if (!wrap._beSlotBound) {
      wrap._beSlotBound = true;
      wrap.addEventListener('click', onCardSlotClick);
    }
    // 头像区域：不分内置/自定义模板，点一下都能直接换图（等价于设置里"自定义头像"上传，只是从预览触发更直接）
    wrap.querySelectorAll('.be-avatar, .be-pt-avatar, .be-ls-avatar, .be-char-avatar').forEach(el => {
      el.classList.add('be-avatar-clickable');
      el.addEventListener('click', e => {
        e.stopPropagation();
        handleAvatarClickUpload();
      });
    });
  }
  function handleAvatarClickUpload() {
    const input = mainDoc.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        settings.avatarType = 'custom';
        await setCustomAvatarFromFile(f);
        if (mainDoc.getElementById('be-panel')?.classList.contains('open')) renderSettings();
        if (mainDoc.getElementById('be-card')) renderCard(lastText);
        toast('已更换头像', 'success');
      } catch (err) {
        toast('上传失败：' + (err?.message || err), 'error');
      }
    });
    input.click();
  }

  // ---------- 截图（纯 html2canvas，CN 镜像优先） ----------
  // v0.6.1：去掉 html-to-image —— 它内部 fetch 远程字体/资源经常挂起，留下未清理 buffer 易导致 OOM/闪退
  let LOCAL_H2C_URL = '';
  try { LOCAL_H2C_URL = new URL('./lib/html2canvas.min.js', import.meta.url).href; } catch (e) {}
  const H2C_LIB_URLS = [
    LOCAL_H2C_URL,
    'https://cdn.staticfile.org/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdn.bootcdn.net/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js'
  ];
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

  let _interactPromise = null;
  function loadInteract() {
    if (mainWin.interact) return Promise.resolve(mainWin.interact);
    if (_interactPromise) return _interactPromise;
    _interactPromise = loadOneOf([LOCAL_INTERACT_URL].filter(Boolean), 'interact')
      .catch(err => { _interactPromise = null; throw err; });
    return _interactPromise;
  }
  let _cropperPromise = null;
  function loadCropperAssets() {
    if (mainWin.Cropper) return Promise.resolve(mainWin.Cropper);
    if (_cropperPromise) return _cropperPromise;
    _cropperPromise = (async () => {
      if (LOCAL_CROPPER_CSS_URL && !mainDoc.getElementById('be-cropper-css')) {
        const link = mainDoc.createElement('link');
        link.id = 'be-cropper-css';
        link.rel = 'stylesheet';
        link.href = LOCAL_CROPPER_CSS_URL;
        mainDoc.head.appendChild(link);
      }
      return loadOneOf([LOCAL_CROPPER_URL].filter(Boolean), 'Cropper');
    })().catch(err => { _cropperPromise = null; throw err; });
    return _cropperPromise;
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
    const raw = typeof e === 'string' ? e
      : (e.message || (e.type ? `加载资源失败 (${e.type})` : (() => { try { return JSON.stringify(e); } catch { return String(e); } })()));
    // 头像图片跨域没带 CORS 头，画布被污染后 toBlob/toDataURL 会抛这类错误，给个能自查的提示，
    // 而不是一句笼统的"保存失败"——极少数用户反馈过导出失败但复现不了，多半是这类环境问题。
    if (/tainted|SecurityError|cross-origin|insecure/i.test(raw)) {
      return `${raw}（可能是头像图片跨域导致，可尝试换一张头像或改用"用户/角色头像"再试）`;
    }
    return raw;
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
  async function processAvatarInClone(cardClone, idoc, exportScale) {
    const avs = cardClone.querySelectorAll('.be-avatar, .be-pt-avatar, .be-ls-avatar, .be-char-avatar');
    for (const av of avs) {
      try { await processOneAvatar(av, idoc, exportScale); } catch (e) {}
    }
  }
  async function processOneAvatar(av, idoc, exportScale) {
    if (!av || !av.style || !av.style.backgroundImage) return;
    const m = av.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
    if (!m || !m[1]) return;
    const url = m[1];
    const cssW = av.offsetWidth || (av.classList.contains('be-pt-avatar') ? 84 : av.classList.contains('be-ls-avatar') ? 72 : 44);
    const cssH = av.offsetHeight || cssW;
    // 头像预渲染的清晰度要跟最终导出倍率对齐——不然 html2canvas 把整卡放大 exportScale 倍时，
    // 头像这张只按旧的固定 2x 预渲染的位图会被二次放大糊掉，跟卡片其它文字的清晰度对不上
    const dpr = Math.max(2, Math.min(5, Number(exportScale) || 2));
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
        // 原来只冻结固定的几个正文选择器（.be-quote 等），标题/日期/出处/水印这些装饰性文字的
        // letter-spacing 没被覆盖到，同样的沙箱问题只是文字短不容易被注意到。改成覆盖卡片内
        // 全部元素（含卡片自身），一劳永逸，不用每加一个模板/新元素就要再补一次这份名单。
        // card/cardClone 是同一份结构 cloneNode(true) 出来的，querySelectorAll('*') 的顺序完全一致。
        const srcEls = [card, ...card.querySelectorAll('*')];
        const dstEls = [cardClone, ...cardClone.querySelectorAll('*')];
        for (let i = 0; i < srcEls.length && i < dstEls.length; i++) {
          const cs = mainWin.getComputedStyle(srcEls[i]);
          ['fontSize', 'lineHeight', 'letterSpacing'].forEach(p => {
            const v = cs[p];
            if (v && v !== 'normal') dstEls[i].style[p] = v;
          });
        }
      } catch (e) {}
      // 必须在上面按元素顺序配对冻结样式之后再拆（拆完 clone 的元素顺序就跟原卡片对不上了）
      try { splitCardHlForExport(cardClone); } catch (e) {}
      // 强制导出宽度 = 用户设定宽度（预览容器在窄屏上可能更窄，导出要按设定值）
      cardClone.style.width = cardW + 'px';
      cardClone.style.maxWidth = 'none';
      idoc.body.appendChild(cardClone);
      // 诗笺（竖排 vertical-rl）专属：正文放在 grid 的 1fr 轨道里，轨道宽度被卡片整体宽度写死后，
      // 文字一多会向左新增竖排列——但那部分列超出了 1fr 轨道的固定宽度，html2canvas 按元素包围盒截图会直接裁掉。
      // 这里先把轨道临时换成 max-content 量出正文真实需要的宽度，再把卡片整体宽度放大到能装下所有列，
      // 避免动其它模板（其余模板都是纵向撑高，不存在这个问题）。
      if (cardClone.classList.contains('tpl-verse')) {
        try {
          const head = cardClone.querySelector('.be-head');
          const quoteEl = cardClone.querySelector('.be-quote');
          if (head && quoteEl) {
            head.style.gridTemplateColumns = 'max-content auto';
            void cardClone.offsetHeight; // 强制回流，量的是渲染框本身，不受 scrollWidth 只统计右/下溢出的限制
            const neededQuoteW = quoteEl.getBoundingClientRect().width;
            const cardCs = mainWin.getComputedStyle(cardClone);
            const headPad = parseFloat(cardCs.paddingLeft || '0') + parseFloat(cardCs.paddingRight || '0');
            const sideEl = cardClone.querySelector('.be-vs-side');
            const sideW = sideEl ? sideEl.getBoundingClientRect().width : 0;
            const headCs = mainWin.getComputedStyle(head);
            const gap = parseFloat(headCs.columnGap || headCs.gap || '16') || 16;
            const neededCardW = Math.ceil(neededQuoteW + sideW + gap + headPad) + 8;
            head.style.gridTemplateColumns = ''; // 量完恢复成原本的 1fr auto，视觉排版比例不变
            if (neededCardW > cardW) {
              cardClone.style.width = neededCardW + 'px';
              iframe.style.width = (neededCardW + 4) + 'px';
            }
          }
        } catch (e) {}
      }
      // 在 clone 上把头像换成清晰 <img>（不影响主文档预览）
      await processAvatarInClone(cardClone, idoc, dpr);
      // 宽度变化会改变高度，重排后按内容真实高度调整 iframe（h2c 按元素尺寸截，留足空间即可）
      // 设备卡顿/长文本下 16ms 不一定够一次真实重排，适当加长
      await new Promise(r => setTimeout(r, 32));
      iframe.style.height = (cardClone.scrollHeight + 4) + 'px';
      // 等字体（iframe 自己的字体加载）：慢网/自定义字体首次加载可能来不及，适当放宽超时给更多机会加载完，
      // 超时仍继续（不阻塞保存），只是尽量减少"极少数环境下用了 fallback 字体导致排版跟预览不一致"的概率
      try {
        await Promise.race([
          (idoc.fonts && idoc.fonts.ready) || Promise.resolve(),
          new Promise(r => setTimeout(r, 1800))
        ]);
      } catch (e) {}
      // 再让浏览器布局/绘制一帧（设备卡顿/长文本下 16ms 不一定够一次真实重排，适当加长）
      await new Promise(r => setTimeout(r, 32));
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
      // 导出清晰度不再跟随 devicePixelRatio 封顶在 2x——很多手机 dpr>=3，旧逻辑白白扔掉三分之一分辨率，
      // 改成纯粹的用户可选倍率（「字号」抽屉里的"清晰度"），默认 2 跟旧逻辑大多数场景观感一致
      const dpr = Math.max(2, Math.min(5, Number(settings.exportScale) || 2));

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
          try { splitCardHlForExport(clone); } catch (e) {}
          mainDoc.body.appendChild(clone);
          try {
            await processAvatarInClone(clone, mainDoc, dpr);
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

  // 自定义配色列表：内置 17 色永远不可删；这里只管理用户另存的配色，删除激活项时回退到内置默认色
  function deleteCustomColor(cid) {
    settings.customColors = (settings.customColors || []).filter(c => c.id !== cid);
    if (settings.colorPreset === 'saved-' + cid) settings.colorPreset = 'paper-warm';
    saveSettings(settings);
    renderSettings();
    if (mainDoc.getElementById('be-card')) renderCard(lastText);
  }
  function hideColorPreset(pid) {
    const hidden = new Set(settings.hiddenColorPresets || []);
    hidden.add(pid);
    settings.hiddenColorPresets = Array.from(hidden);
    if (settings.colorPreset === pid) settings.colorPreset = 'paper-warm';
    saveSettings(settings);
    renderSettings();
    if (mainDoc.getElementById('be-card')) renderCard(lastText);
  }
  function restoreColorPreset(pid) {
    settings.hiddenColorPresets = (settings.hiddenColorPresets || []).filter(k => k !== pid);
    saveSettings(settings);
    renderSettings();
  }
  let _hiddenColorOpen = false;
  let _colorOrganize = false;
  let _customColorOpen = false;
  function renderHiddenColorGroup() {
    const hidden = (settings.hiddenColorPresets || []).map(id => COLOR_PRESETS.find(p => p.id === id)).filter(Boolean);
    if (!hidden.length) return '';
    return `
      <div class="be-tpl-group ${_hiddenColorOpen ? 'open' : ''}" id="be-hidden-color-group">
        <div class="be-tpl-group-head" id="be-hidden-color-group-head">
          <span class="be-caret"></span>
          <span>已隐藏的默认配色（${hidden.length}）</span>
        </div>
        <div class="be-tpl-group-body">
          ${hidden.map(p => `
            <div class="be-tpl-custom-row" data-k="">
              <span class="be-tpl-custom-name">${escapeHtml(p.name)}</span>
              <button data-restore-color="${p.id}" title="恢复显示">↺ 恢复</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  function openSaveColorDialog() {
    const MASK_ID = 'be-save-color-mask';
    let mask = mainDoc.getElementById(MASK_ID);
    if (!mask) {
      mask = mainDoc.createElement('div');
      mask.id = MASK_ID;
      mask.className = 'be-import-tpl-mask';
      mask.innerHTML = `
        <div class="be-import-tpl-box">
          <div class="be-src-title">保存当前配色</div>
          <div class="be-src-field">
            <label>配色名称</label>
            <input type="text" id="be-save-color-name" placeholder="自定义配色">
          </div>
          <div class="be-src-actions">
            <button class="be-btn" id="be-save-color-cancel">取消</button>
            <button class="be-btn primary" id="be-save-color-save">保存</button>
          </div>
        </div>
      `;
      mainDoc.body.appendChild(mask);
      mask.addEventListener('click', e => { if (e.target === mask) mask.classList.remove('open'); });
    } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    detectAndApplyTheme();
    const list = Array.isArray(settings.customColors) ? settings.customColors : [];
    mask.querySelector('#be-save-color-name').value = `自定义${list.length + 1}`;
    mask.classList.add('open');

    const close = () => mask.classList.remove('open');
    const reNew = (sel, fn) => {
      const el = mask.querySelector(sel);
      const clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);
      clone.addEventListener('click', fn);
    };
    reNew('#be-save-color-cancel', close);
    reNew('#be-save-color-save', () => {
      const curList = Array.isArray(settings.customColors) ? settings.customColors : [];
      const name = mask.querySelector('#be-save-color-name').value.trim() || `自定义${curList.length + 1}`;
      const id = 'c' + Date.now() + Math.random().toString(36).slice(2, 5);
      const newList = curList.slice();
      newList.push({ id, name, bg: settings.customBg || '#f5f1e8', fg: settings.customFg || '#222222', fgEnabled: !!settings.customFgEnabled });
      settings.customColors = newList;
      settings.colorPreset = 'saved-' + id;
      saveSettings(settings);
      close();
      renderSettings();
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
      toast('已保存配色', 'success');
    });
  }

  // 设置面板二级分组：外观 / 划线 / 功能与数据。纯内存状态，不落盘，重开面板/切主 Tab 都保留上次选的分组
  let settingsGroup = 'card';

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
            <div class="be-about-p">选中聊天里的文字，浮动栏点"划线"（可选下划线/波浪线/荧光笔样式和颜色）或"想法"。点已有划线会弹出工具栏：复制、删划线、写想法、想法列表、做书摘。跟其它选中类插件冲突时可在设置里一键关闭划线功能。正则/酒馆助手渲染的状态栏（包括 iframe 里的）也能选字划线、做书摘；状态栏刷新后里面的划线不一定还在。手机上拖选不准可以在「划线」页改用两点定位。</div>
          </div>
          <div class="be-about-sec">
            <div class="be-about-h">划线合并</div>
            <div class="be-about-p">默认开启：点已有划线的工具栏上有"加入合并"，笔记本详情页也能勾选批量加入（选中会显示加入顺序的数字）。攒够了点悬浮篮子或笔记本的"完成"，选择存为笔记本条目还是直接生成书摘卡片，也可以选是否删除原来的散乱划线，这两步都能勾选"记住"跳过下次询问，不需要可在设置里关掉。</div>
          </div>
          <div class="be-about-sec">
            <div class="be-about-h">书摘卡片</div>
            <div class="be-about-p">浮动栏"书摘"或点已有划线的工具栏都能生成卡片。模板/配色/字体/排版/卡片内容/打码都在「书摘卡片」页，也可在卡片预览页临时改。模板列表里 👁 可预览；点「整理」可拖动排序、☆收藏（选模板时排最前）、隐藏或管理导入的模板。自定义模板（JSON/CSS，选择器写 .be-card.be-custom）里引用的图片、以及头像，都能直接点卡片上的对应位置换图。卡片正文还能再选中局部加下划线/荧光笔/字色/加粗。</div>
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

  // ---------- 模板管理（默认模板和导入的模板统一成一张列表）----------
  // key 跟 settings.template 同格式：默认模板 'classic'，导入模板 'custom-<id>'。
  // templateOrder / templateFavorites / hiddenTemplates 都存 key，默认和导入的一起排序、收藏、隐藏。
  const ICON_DOTS4 = '<svg viewBox="0 0 12 12"><circle cx="3" cy="3" r="1.4"/><circle cx="9" cy="3" r="1.4"/><circle cx="3" cy="9" r="1.4"/><circle cx="9" cy="9" r="1.4"/></svg>';
  const ICON_EYE = '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  let _tplListOpen = false;
  let _tplOrganize = false;
  let _hiddenTplOpen = false;
  function getAllTemplateEntries() {
    const favSet = new Set(settings.templateFavorites || []);
    const hidden = new Set(settings.hiddenTemplates || []);
    const natural = [
      ...Object.entries(TEMPLATES).map(([k, v]) => ({ key: k, name: v.name, isDefault: true })),
      ...(settings.customTemplates || []).map(t => ({ key: `custom-${t.id}`, name: t.name || '未命名', isDefault: false, tid: t.id }))
    ];
    const order = settings.templateOrder || [];
    const idx = k => { const i = order.indexOf(k); return i < 0 ? Infinity : i; };
    return natural
      .map((e, i) => ({ ...e, fav: favSet.has(e.key), hidden: hidden.has(e.key), _n: i }))
      .sort((a, b) => (idx(a.key) - idx(b.key)) || (a._n - b._n));
  }
  // 列表/选模板共用的顺序：收藏的排最前，其余按用户排的顺序；隐藏的单独列出
  function getTemplateListEntries() {
    const all = getAllTemplateEntries();
    const shown = all.filter(e => !e.hidden);
    return { favs: shown.filter(e => e.fav), rest: shown.filter(e => !e.fav), hidden: all.filter(e => e.hidden) };
  }
  function getTemplatePickerEntries() {
    const { favs, rest } = getTemplateListEntries();
    return { favs, rest };
  }
  function templateNameOf(key) {
    const e = getAllTemplateEntries().find(x => x.key === key);
    return e ? e.name : (TEMPLATES.classic.name);
  }
  function toggleTemplateFavorite(key) {
    const favs = new Set(settings.templateFavorites || []);
    if (favs.has(key)) favs.delete(key); else favs.add(key);
    settings.templateFavorites = Array.from(favs);
    saveSettings(settings);
    renderSettings();
  }
  function hideTemplate(key) {
    const hidden = new Set(settings.hiddenTemplates || []);
    hidden.add(key);
    settings.hiddenTemplates = Array.from(hidden);
    // 隐藏的正好是当前用的模板：退到列表里第一个还显示着的
    if (settings.template === key) {
      const { favs, rest } = getTemplateListEntries();
      settings.template = (favs[0] || rest[0] || { key: 'classic' }).key;
    }
    saveSettings(settings);
    renderSettings();
    if (mainDoc.getElementById('be-card')) renderCard(lastText);
  }
  function restoreTemplate(key) {
    settings.hiddenTemplates = (settings.hiddenTemplates || []).filter(k => k !== key);
    saveSettings(settings);
    renderSettings();
  }
  function exportCustomTemplate(tid) {
    try {
      const tpl = (settings.customTemplates || []).find(x => x.id === tid);
      if (!tpl) { toast('找不到模板', 'error'); return; }
      const text = JSON.stringify(templateToPortable(tpl), null, 2);
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const dlName = String(tpl.name || '模板').replace(/[\\/:*?"<>|]/g, '_') + '.json';
      triggerDownload(blob, dlName);
      toast('已导出 ' + dlName, 'success');
    } catch (err) {
      console.error('[BookExcerpt] export failed', err);
      toast('导出失败：' + (err?.message || err), 'error');
    }
  }
  function editCustomTemplate(tid) {
    // 开发者模式下用可拖动的悬浮CSS编辑窗（能跟卡片预览同屏），否则走普通弹窗
    if (settings.creatorMode) openCssFloatEditor(tid);
    else openImportTemplateDialog(tid);
  }
  function renderTemplateRow(e, org) {
    const active = settings.template === e.key;
    return `
      <div class="be-tl-row ${active ? 'active' : ''}" data-k="${e.key}">
        ${org ? `<span class="be-tl-handle" title="按住拖动排序">${ICON_DOTS4}</span>
                 <button type="button" class="be-tl-fav ${e.fav ? 'on' : ''}" data-fav="${e.key}" title="${e.fav ? '取消收藏' : '收藏'}">${e.fav ? '★' : '☆'}</button>`
              : (e.fav ? '<span class="be-tl-star">★</span>' : '')}
        <span class="be-tl-name">${escapeHtml(e.name)}</span>
        ${e.isDefault ? '<span class="be-tl-tag">默认</span>' : ''}
        ${org ? `<button type="button" class="be-tl-more" data-more="${e.key}" title="更多操作">⋯</button>`
              : `<button type="button" class="be-tl-prev" data-prev="${e.key}" title="预览">${ICON_EYE}</button>`}
      </div>`;
  }
  function renderTemplateSection() {
    const { favs, rest, hidden } = getTemplateListEntries();
    const org = _tplOrganize;
    const open = _tplListOpen || org;
    return `
      <div class="be-sec" id="be-tpl-sec">
        <div class="be-sec-head">
          <h4>模板</h4>
          <span class="be-sec-head-btns">
            <button type="button" class="be-mini-btn ${org ? 'active' : ''}" id="be-tpl-organize">${org ? '完成' : '整理'}</button>
            <button type="button" class="be-mini-btn" id="be-tpl-import">+ 导入</button>
          </span>
        </div>
        <div class="be-tl-current ${open ? 'open' : ''}" id="be-tl-toggle">
          <span>当前：<b>${escapeHtml(templateNameOf(settings.template))}</b></span>
          <span class="be-caret"></span>
        </div>
        <div class="be-tl-body" ${open ? '' : 'hidden'}>
          ${org ? '<div class="be-tl-hint">按住左边的四点拖动排序；☆ 收藏（选模板时排最前）；⋯ 里可以隐藏、编辑、导出、删除</div>' : ''}
          <div class="be-tl-list" data-group="fav">${favs.map(e => renderTemplateRow(e, org)).join('')}</div>
          ${favs.length && rest.length ? '<div class="be-tl-sep">·</div>' : ''}
          <div class="be-tl-list" data-group="rest">${rest.map(e => renderTemplateRow(e, org)).join('')}</div>
          ${hidden.length ? `
          <div class="be-tpl-group ${_hiddenTplOpen ? 'open' : ''}" id="be-hidden-tpl-group">
            <div class="be-tpl-group-head" id="be-hidden-tpl-group-head">
              <span class="be-caret"></span>
              <span>已隐藏（${hidden.length}）</span>
            </div>
            <div class="be-tpl-group-body">
              ${hidden.map(e => `
                <div class="be-tl-row be-tl-row-hidden">
                  <span class="be-tl-name">${escapeHtml(e.name)}</span>
                  ${e.isDefault ? '<span class="be-tl-tag">默认</span>' : ''}
                  <button type="button" class="be-mini-btn" data-restore-tpl="${e.key}">恢复</button>
                </div>`).join('')}
            </div>
          </div>` : ''}
        </div>
      </div>`;
  }
  function commitTemplateOrderFromDom(sec) {
    const keys = Array.from(sec.querySelectorAll('.be-tl-list .be-tl-row')).map(r => r.getAttribute('data-k'));
    const hiddenKeys = getAllTemplateEntries().filter(e => e.hidden).map(e => e.key);
    settings.templateOrder = keys.concat(hiddenKeys);
    saveSettings(settings);
  }
  // 手指/鼠标拖动排序：用 pointer 事件自己做，不用 HTML5 draggable（那套在手机浏览器上基本拖不动）。
  // 收藏组和其余组各自内部排，拖动时直接在 DOM 里挪行，松手后按 DOM 顺序落盘。
  function bindTemplateDrag(sec) {
    sec.querySelectorAll('.be-tl-handle').forEach(h => {
      h.addEventListener('pointerdown', e => {
        e.preventDefault();
        const row = h.closest('.be-tl-row');
        const list = row.parentElement;
        const scroller = sec.closest('#be-p-body') || sec.parentElement;
        // 不用 setPointerCapture：拖动时要在 DOM 里挪这一行，挪动会让手柄暂时脱离文档，浏览器随之丢掉捕获，
        // 后续 move/up 就收不到了。直接在 document 上监听，跟指针落在哪个元素上无关。
        const pid = e.pointerId;
        row.classList.add('dragging');
        const onMove = ev => {
          if (ev.pointerId !== pid) return;
          ev.preventDefault();
          const y = ev.clientY;
          const box = scroller.getBoundingClientRect();
          if (y < box.top + 40) scroller.scrollTop -= 12;
          else if (y > box.bottom - 40) scroller.scrollTop += 12;
          const others = Array.from(list.children).filter(r => r !== row);
          let before = null;
          for (const r of others) {
            const rc = r.getBoundingClientRect();
            if (y < rc.top + rc.height / 2) { before = r; break; }
          }
          if (before) { if (row.nextSibling !== before) list.insertBefore(row, before); }
          else if (list.lastElementChild !== row) list.appendChild(row);
        };
        const onUp = ev => {
          if (ev.pointerId !== pid) return;
          mainDoc.removeEventListener('pointermove', onMove, true);
          mainDoc.removeEventListener('pointerup', onUp, true);
          mainDoc.removeEventListener('pointercancel', onUp, true);
          row.classList.remove('dragging');
          commitTemplateOrderFromDom(sec);
        };
        mainDoc.addEventListener('pointermove', onMove, { capture: true, passive: false });
        mainDoc.addEventListener('pointerup', onUp, true);
        mainDoc.addEventListener('pointercancel', onUp, true);
      });
    });
  }
  function closeTplMenu() {
    mainDoc.getElementById('be-tl-menu')?.classList.remove('show');
  }
  function openTplMenu(key, anchor) {
    const entry = getAllTemplateEntries().find(e => e.key === key);
    if (!entry) return;
    let menu = mainDoc.getElementById('be-tl-menu');
    if (!menu) {
      menu = mainDoc.createElement('div');
      menu.id = 'be-tl-menu';
      mainDoc.body.appendChild(menu);
      mainDoc.addEventListener('pointerdown', ev => {
        const m = mainDoc.getElementById('be-tl-menu');
        if (m && m.classList.contains('show') && !m.contains(ev.target) && !ev.target.closest('.be-tl-more')) closeTplMenu();
      }, true);
    } else if (menu.parentNode !== mainDoc.body || menu.nextSibling) {
      mainDoc.body.appendChild(menu);
    }
    const acts = entry.isDefault
      ? [['hide', '隐藏']]
      : [['edit', '编辑CSS'], ['export', '导出'], ['hide', '隐藏'], ['del', '删除']];
    menu.innerHTML = acts.map(([a, t]) => `<button type="button" data-act="${a}" class="${a === 'del' ? 'danger' : ''}">${t}</button>`).join('');
    menu.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        const a = b.getAttribute('data-act');
        closeTplMenu();
        if (a === 'hide') hideTemplate(key);
        else if (a === 'edit') editCustomTemplate(entry.tid);
        else if (a === 'export') exportCustomTemplate(entry.tid);
        else if (a === 'del') { if (mainWin.confirm(`删除模板「${entry.name}」？`)) deleteCustomTemplate(entry.tid); }
      });
    });
    menu.classList.add('show');
    const r = anchor.getBoundingClientRect();
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    let left = Math.min(r.right - mw, mainWin.innerWidth - mw - 8);
    let top = r.bottom + 4;
    if (top + mh > mainWin.innerHeight - 8) top = r.top - mh - 4;
    menu.style.left = (Math.max(8, left) + (mainWin.scrollX || 0)) + 'px';
    menu.style.top = (Math.max(8, top) + (mainWin.scrollY || 0)) + 'px';
  }
  // 模板预览：用固定示例文字 + 当前头像/名字，按该模板渲染一张缩小的卡片
  const PREVIEW_SAMPLE_TEXT = '我们终将走向同一片海。潮水会记住所有被说出口的话，也会原谅那些没来得及说的。';
  function closeTplPreview() {
    mainDoc.getElementById('be-tpl-preview')?.classList.remove('open');
  }
  function openTplPreview(key) {
    let mask = mainDoc.getElementById('be-tpl-preview');
    if (!mask) {
      mask = mainDoc.createElement('div');
      mask.id = 'be-tpl-preview';
      mask.addEventListener('click', e => { if (e.target === mask || e.target.closest('.be-tpv-close')) closeTplPreview(); });
      mainDoc.body.appendChild(mask);
    } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    const cw = Number(settings.cardWidth) || 440;
    const built = buildCardMarkup(PREVIEW_SAMPLE_TEXT, { tplKey: key, preview: true });
    mask.innerHTML = `
      <div class="be-tpv-box">
        <div class="be-tpv-head"><span>${escapeHtml(templateNameOf(key))}</span><button type="button" class="be-tpv-close">×</button></div>
        <div class="be-tpv-stage"><div class="be-tpv-scale" style="width:${cw}px;">${built.html}</div></div>
        <div class="be-tpv-foot">
          <button type="button" class="be-btn primary" id="be-tpv-use">用这个模板</button>
        </div>
      </div>`;
    const card = mask.querySelector('.be-card');
    if (card) {
      const qs = Number(settings.quoteFontSize), ql = Number(settings.quoteLineHeight), qls = Number(settings.quoteLetterSpacing);
      if (qs > 0) card.style.setProperty('--be-quote-size', qs + 'px');
      if (ql > 0) card.style.setProperty('--be-quote-lh', ql);
      if (qls >= 0) card.style.setProperty('--be-quote-ls', qls + 'em');
      const q = card.querySelector('.be-quote');
      if (q) q.style.fontFamily = built.fontCss;
    }
    mask.classList.add('open');
    const stage = mask.querySelector('.be-tpv-stage');
    const scaler = mask.querySelector('.be-tpv-scale');
    const scale = Math.min(1, (stage.clientWidth || 300) / cw);
    scaler.style.transform = `scale(${scale})`;
    stage.style.height = Math.ceil(scaler.offsetHeight * scale) + 'px';
    mask.querySelector('#be-tpv-use').addEventListener('click', () => {
      settings.template = key;
      saveSettings(settings);
      closeTplPreview();
      renderSettings();
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
    });
  }
  function bindTemplateSection(body) {
    const sec = body.querySelector('#be-tpl-sec');
    if (!sec) return;
    sec.querySelector('#be-tpl-import')?.addEventListener('click', () => openImportTemplateDialog());
    sec.querySelector('#be-tpl-organize')?.addEventListener('click', () => {
      _tplOrganize = !_tplOrganize;
      if (!_tplOrganize) _tplListOpen = true;
      closeTplMenu();
      renderSettings();
    });
    sec.querySelector('#be-tl-toggle')?.addEventListener('click', () => {
      if (_tplOrganize) return;
      _tplListOpen = !_tplListOpen;
      renderSettings();
    });
    sec.querySelectorAll('.be-tl-list .be-tl-row').forEach(row => {
      row.addEventListener('click', e => {
        if (_tplOrganize || e.target.closest('button, .be-tl-handle')) return;
        settings.template = row.getAttribute('data-k');
        saveSettings(settings);
        renderSettings();
        if (mainDoc.getElementById('be-card')) renderCard(lastText);
      });
    });
    sec.querySelectorAll('[data-prev]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      openTplPreview(b.getAttribute('data-prev'));
    }));
    sec.querySelectorAll('[data-fav]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      toggleTemplateFavorite(b.getAttribute('data-fav'));
    }));
    sec.querySelectorAll('[data-more]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      openTplMenu(b.getAttribute('data-more'), b);
    }));
    sec.querySelector('#be-hidden-tpl-group-head')?.addEventListener('click', () => {
      _hiddenTplOpen = !_hiddenTplOpen;
      sec.querySelector('#be-hidden-tpl-group')?.classList.toggle('open', _hiddenTplOpen);
    });
    sec.querySelectorAll('[data-restore-tpl]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      restoreTemplate(b.getAttribute('data-restore-tpl'));
    }));
    if (_tplOrganize) bindTemplateDrag(sec);
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
  // 开发者模式：CSS 实时编辑用的临时预览 <style>，跟 #be-custom-style（已保存的）分开，取消/保存后都会清掉
  function clearTplLivePreview() {
    mainDoc.getElementById('be-tpl-live-preview')?.remove();
  }
  function applyTplLivePreview(id, rawCss) {
    let el = mainDoc.getElementById('be-tpl-live-preview');
    if (!el) {
      el = mainDoc.createElement('style');
      el.id = 'be-tpl-live-preview';
      mainDoc.head.appendChild(el);
    }
    const selector = `.be-card.tpl-custom-${id}`;
    const tpl = (settings.customTemplates || []).find(t => t.id === id);
    el.textContent = applySlotImagesToCss(tpl, String(rawCss || '').replace(/\.be-card\.be-custom\b/g, selector));
  }
  // 类名查询器：开发者模式下的检查工具，悬停高亮 + 显示类名，点击复制
  let _inspectorActive = false;
  function inspectorHoverHandler(e) {
    const card = mainDoc.getElementById('be-card');
    if (!card) return;
    const el = e.target;
    if (!el || !card.contains(el)) return;
    mainDoc.querySelectorAll('.be-inspect-hl').forEach(x => x.classList.remove('be-inspect-hl'));
    el.classList.add('be-inspect-hl');
    let tip = mainDoc.getElementById('be-inspect-tip');
    if (!tip) { tip = mainDoc.createElement('div'); tip.id = 'be-inspect-tip'; mainDoc.body.appendChild(tip); }
    const cls = Array.from(el.classList).filter(c => c !== 'be-inspect-hl').join('.');
    tip.textContent = el.tagName.toLowerCase() + (cls ? '.' + cls : '') + '（点击复制）';
    const rect = el.getBoundingClientRect();
    tip.style.left = Math.max(4, rect.left) + 'px';
    tip.style.top = Math.max(4, rect.top - 24) + 'px';
    tip.classList.add('show');
  }
  function inspectorClickHandler(e) {
    const card = mainDoc.getElementById('be-card');
    if (!card || !card.contains(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    const el = e.target;
    const cls = Array.from(el.classList).filter(c => c !== 'be-inspect-hl').join('.');
    const full = el.tagName.toLowerCase() + (cls ? '.' + cls : '');
    try { mainWin.navigator.clipboard.writeText(full); toast('已复制：' + full, 'success'); }
    catch (err) { toast(full, 'success'); }
  }
  function enableClassInspector() {
    if (_inspectorActive) return;
    _inspectorActive = true;
    mainDoc.addEventListener('mouseover', inspectorHoverHandler, true);
    mainDoc.addEventListener('click', inspectorClickHandler, true);
  }
  function disableClassInspector() {
    if (!_inspectorActive) return;
    _inspectorActive = false;
    mainDoc.removeEventListener('mouseover', inspectorHoverHandler, true);
    mainDoc.removeEventListener('click', inspectorClickHandler, true);
    mainDoc.querySelectorAll('.be-inspect-hl').forEach(x => x.classList.remove('be-inspect-hl'));
    mainDoc.getElementById('be-inspect-tip')?.classList.remove('show');
  }

  // ---------- 开发者模式：可拖动/缩放的悬浮 CSS 编辑小窗（编辑已有自定义模板时用，代替原来的整页弹窗） ----------
  // 好处是能跟书摘卡片预览（#be-mask）同屏出现：小窗挡住哪块就拖开，边改边看实时效果，不用两个弹窗来回切
  function bindCssFloatDrag(win) {
    const handle = win.querySelector('#be-css-float-drag');
    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    const start = (e) => {
      if (e.target.closest('button')) return;
      dragging = true;
      const p = e.touches ? e.touches[0] : e;
      sx = p.clientX; sy = p.clientY;
      const rect = win.getBoundingClientRect();
      ox = rect.left; oy = rect.top;
      e.preventDefault();
    };
    const move = (e) => {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - sx, dy = p.clientY - sy;
      const vw = mainWin.innerWidth, vh = mainWin.innerHeight;
      const left = Math.max(0, Math.min(ox + dx, vw - 40));
      const top = Math.max(0, Math.min(oy + dy, vh - 40));
      win.style.left = (left + (mainWin.scrollX || 0)) + 'px';
      win.style.top = (top + (mainWin.scrollY || 0)) + 'px';
      e.preventDefault();
    };
    const end = () => { dragging = false; };
    handle.addEventListener('mousedown', start);
    handle.addEventListener('touchstart', start, { passive: false });
    mainDoc.addEventListener('mousemove', move);
    mainDoc.addEventListener('touchmove', move, { passive: false });
    mainDoc.addEventListener('mouseup', end);
    mainDoc.addEventListener('touchend', end);
  }
  function bindCssFloatResize(win) {
    const dirs = { se: [1, 1], sw: [-1, 1], ne: [1, -1], nw: [-1, -1] };
    Object.keys(dirs).forEach(dir => {
      const handle = win.querySelector('.be-css-resize-' + dir);
      if (!handle) return;
      const [dx0, dy0] = dirs[dir];
      let sx = 0, sy = 0, sw = 0, sh = 0, sl = 0, st = 0, active = false;
      const start = (e) => {
        active = true;
        const p = e.touches ? e.touches[0] : e;
        sx = p.clientX; sy = p.clientY;
        const rect = win.getBoundingClientRect();
        sw = rect.width; sh = rect.height; sl = rect.left; st = rect.top;
        e.preventDefault(); e.stopPropagation();
      };
      const move = (e) => {
        if (!active) return;
        const p = e.touches ? e.touches[0] : e;
        const dx = (p.clientX - sx) * dx0;
        const dy = (p.clientY - sy) * dy0;
        const newW = Math.max(220, sw + dx);
        const newH = Math.max(160, sh + dy);
        win.style.width = newW + 'px';
        win.style.height = newH + 'px';
        // 往左/往上拖大时要同步挪 left/top，不然窗口看起来像从右下角长出来的
        if (dx0 < 0) win.style.left = (sl - (newW - sw) + (mainWin.scrollX || 0)) + 'px';
        if (dy0 < 0) win.style.top = (st - (newH - sh) + (mainWin.scrollY || 0)) + 'px';
        e.preventDefault();
      };
      const end = () => { active = false; };
      handle.addEventListener('mousedown', start);
      handle.addEventListener('touchstart', start, { passive: false });
      mainDoc.addEventListener('mousemove', move);
      mainDoc.addEventListener('touchmove', move, { passive: false });
      mainDoc.addEventListener('mouseup', end);
      mainDoc.addEventListener('touchend', end);
    });
  }
  function closeCssFloatEditor() {
    clearTplLivePreview();
    disableClassInspector();
    mainDoc.getElementById('be-css-float')?.classList.remove('show');
  }
  function openCssFloatEditor(tplId) {
    const tpl = (settings.customTemplates || []).find(t => t.id === tplId);
    if (!tpl) { toast('找不到这个模板', 'error'); return; }
    // 要有卡片可看才叫"实时预览"：切到这个模板，没有摘录文本时先垫一段示例文字
    settings.template = `custom-${tplId}`;
    saveSettings(settings);
    if (!lastText) lastText = '这是一段示例文字，用来看模板效果——字号、颜色、行距、边距都会实时更新在卡片上。';
    openExcerptModal(lastText);

    let win = mainDoc.getElementById('be-css-float');
    if (!win) {
      win = mainDoc.createElement('div');
      win.id = 'be-css-float';
      win.innerHTML = `
        <div class="be-css-float-head" id="be-css-float-drag">
          <span>实时改CSS</span>
          <span style="flex:1;"></span>
          <button type="button" id="be-css-float-inspect" title="类名查询器：点开后在卡片上悬停/点击可查看类名">🔍</button>
          <button type="button" id="be-css-float-close" title="关闭">×</button>
        </div>
        <textarea id="be-css-float-textarea" spellcheck="false"></textarea>
        <div class="be-css-float-foot">
          <button class="be-btn" id="be-css-float-cancel">取消</button>
          <button class="be-btn primary" id="be-css-float-save">保存</button>
        </div>
        <div class="be-css-resize be-css-resize-se"></div>
        <div class="be-css-resize be-css-resize-sw"></div>
        <div class="be-css-resize be-css-resize-ne"></div>
        <div class="be-css-resize be-css-resize-nw"></div>
      `;
      mainDoc.body.appendChild(win);
      bindCssFloatDrag(win);
      bindCssFloatResize(win);
      win.querySelector('#be-css-float-inspect').addEventListener('click', e => {
        if (_inspectorActive) { disableClassInspector(); e.currentTarget.classList.remove('active'); }
        else { enableClassInspector(); e.currentTarget.classList.add('active'); }
      });
      win.querySelector('#be-css-float-close').addEventListener('click', closeCssFloatEditor);
      win.querySelector('#be-css-float-cancel').addEventListener('click', closeCssFloatEditor);
    } else if (win.parentNode !== mainDoc.body || win.nextSibling) {
      mainDoc.body.appendChild(win);
    }
    if (!win.style.width) {
      const vw = mainWin.innerWidth;
      win.style.width = Math.min(300, vw - 24) + 'px';
      win.style.height = '320px';
      win.style.left = Math.max(8, (vw - 300) / 2) + (mainWin.scrollX || 0) + 'px';
      win.style.top = (72 + (mainWin.scrollY || 0)) + 'px';
    }
    const ta = win.querySelector('#be-css-float-textarea');
    ta.value = tpl.css || '';
    applyTplLivePreview(tplId, ta.value);
    win.classList.add('show');

    let liveT = 0;
    ta.oninput = () => {
      if (liveT) mainWin.clearTimeout(liveT);
      liveT = mainWin.setTimeout(() => { liveT = 0; applyTplLivePreview(tplId, ta.value); }, 250);
    };
    win.querySelector('#be-css-float-save').onclick = () => {
      const css = ta.value.trim();
      if (!css) { toast('CSS 不能为空', 'error'); return; }
      const idx = (settings.customTemplates || []).findIndex(t => t.id === tplId);
      if (idx < 0) { toast('模板已被删除', 'error'); return; }
      settings.customTemplates[idx] = { ...settings.customTemplates[idx], css };
      saveSettings(settings);
      clearTplLivePreview();
      injectCustomTemplateStyles();
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
      toast('已保存', 'success');
    };
  }

  // editId 传入时是"编辑已有自定义模板"，不传是"新建"；开发者模式开着时额外提供CSS实时预览
  function openImportTemplateDialog(editId) {
    const editing = !!editId;
    const existing = editing ? (settings.customTemplates || []).find(t => t.id === editId) : null;
    if (editing && !existing) { toast('找不到这个模板', 'error'); return; }
    const dev = !!settings.creatorMode;
    let mask = mainDoc.getElementById('be-import-tpl-mask');
    if (!mask) {
      mask = mainDoc.createElement('div');
      mask.id = 'be-import-tpl-mask';
      mask.className = 'be-import-tpl-mask';
      mainDoc.body.appendChild(mask);
      mask.addEventListener('click', e => { if (e.target === mask) mask.querySelector('#be-imp-cancel')?.click(); });
    } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    // 每次打开都重建内容：开发者模式随时可能被切换，缓存的旧 DOM 不会自动跟着变
    mask.innerHTML = `
      <div class="be-import-tpl-box">
        <div class="be-src-title">${editing ? '编辑自定义模板' : '导入自定义模板'}</div>
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
        ${dev ? `
        <div class="be-src-field" style="font-size:11px;opacity:0.75;">
          开发者模式：改动会实时预览（如果当前卡片预览正好用的是这个模板）；未点"保存"前不会真正写入。
        </div>
        ` : ''}
        <div class="be-src-actions">
          <button class="be-btn" id="be-imp-cancel">取消</button>
          <button class="be-btn" id="be-imp-file">从文件导入</button>
          <button class="be-btn primary" id="be-imp-save">保存</button>
        </div>
      </div>
    `;
    detectAndApplyTheme();
    mask.querySelector('#be-imp-name').value = existing ? (existing.name || '') : '';
    mask.querySelector('#be-imp-css').value = existing ? (existing.css || '') : '';
    mask.classList.add('open');
    disableClassInspector();

    const activeId = editing ? editId : ('t' + Date.now() + Math.random().toString(36).slice(2, 5));
    let liveT = 0;
    const scheduleLivePreview = () => {
      if (!dev) return;
      if (liveT) mainWin.clearTimeout(liveT);
      liveT = mainWin.setTimeout(() => {
        liveT = 0;
        applyTplLivePreview(activeId, mask.querySelector('#be-imp-css').value);
      }, 250);
    };
    if (dev) {
      mask.querySelector('#be-imp-css').addEventListener('input', scheduleLivePreview);
      if (editing) applyTplLivePreview(activeId, existing.css || '');
    }

    const close = () => {
      mask.classList.remove('open');
      clearTplLivePreview();
      disableClassInspector();
    };
    mask.querySelector('#be-imp-cancel').addEventListener('click', close);
    mask.querySelector('#be-imp-file').addEventListener('click', () => {
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
          scheduleLivePreview();
        };
        fr.readAsText(f);
      });
      inp.click();
    });
    mask.querySelector('#be-imp-save').addEventListener('click', () => {
      const name = mask.querySelector('#be-imp-name').value.trim() || '未命名';
      let css = mask.querySelector('#be-imp-css').value.trim();
      if (!css) { toast('CSS 不能为空', 'error'); return; }
      const id = activeId;
      // 把 .be-custom 选择器替换成本模板的实际 id 选择器
      const selector = `.be-card.tpl-custom-${id}`;
      css = css.replace(/\.be-card\.be-custom\b/g, selector);
      const list = Array.isArray(settings.customTemplates) ? settings.customTemplates.slice() : [];
      if (editing) {
        const idx = list.findIndex(t => t.id === id);
        const slotImages = list[idx] && list[idx].slotImages;
        if (idx >= 0) list[idx] = { id, name, css, ...(slotImages ? { slotImages } : {}) };
        else list.push({ id, name, css });
      } else {
        list.push({ id, name, css });
      }
      settings.customTemplates = list;
      saveSettings(settings);
      clearTplLivePreview();
      injectCustomTemplateStyles();
      _tplListOpen = true;
      mask.classList.remove('open');
      disableClassInspector();
      renderSettings();
      if (mainDoc.getElementById('be-card')) renderCard(lastText);
      toast(editing ? '已保存修改' : '已导入模板', 'success');
    });
  }

  function deleteCustomTemplate(tid) {
    const doomed = (settings.customTemplates || []).find(t => t.id === tid);
    if (doomed && doomed.slotImages) Object.values(doomed.slotImages).forEach(imgForget);
    const list = (settings.customTemplates || []).filter(t => t.id !== tid);
    settings.customTemplates = list;
    const key = `custom-${tid}`;
    settings.templateFavorites = (settings.templateFavorites || []).filter(k => k !== key);
    settings.hiddenTemplates = (settings.hiddenTemplates || []).filter(k => k !== key);
    settings.templateOrder = (settings.templateOrder || []).filter(k => k !== key);
    // 如果删的是当前选中的，退回经典
    if (settings.template === key) settings.template = 'classic';
    saveSettings(settings);
    injectCustomTemplateStyles();
    renderSettings();
    if (mainDoc.getElementById('be-card')) renderCard(lastText);
  }

  // 设置面板分两层：壳层（Tab 条，只建一次，切分组时不重建、不参与动画）+ 内容层（真正随分组变化的部分）。
  function renderSettings() {
    const panelBody = mainDoc.getElementById('be-p-body');
    if (!panelBody) return;
    let content = panelBody.querySelector('#be-settings-content');
    if (!content) {
      panelBody.innerHTML = `
        <div class="be-settings-subtabs">
          <button type="button" data-g="card" class="${settingsGroup==='card'?'active':''}">书摘卡片</button>
          <button type="button" data-g="highlight" class="${settingsGroup==='highlight'?'active':''}">划线</button>
          <button type="button" data-g="general" class="${settingsGroup==='general'?'active':''}">通用</button>
        </div>
        <div id="be-settings-content"></div>
      `;
      panelBody.querySelectorAll('.be-settings-subtabs button').forEach(el => {
        el.addEventListener('click', () => {
          const g = el.getAttribute('data-g');
          if (g === settingsGroup) return;
          settingsGroup = g;
          panelBody.querySelectorAll('.be-settings-subtabs button').forEach(b => b.classList.toggle('active', b === el));
          // 跟"笔记本/设置"顶部主 Tab 切换用同一套手法：内容瞬间换掉（没有旧内容残留/重叠这回事），
          // 只在新内容上补一个入场淡入，跟主 Tab 切换的手感保持一致——那个切换用户没意见，直接照搬。
          panelBody.scrollTop = 0;
          renderSettingsGroupContent(mainDoc.getElementById('be-settings-content'));
          const freshContent = mainDoc.getElementById('be-settings-content');
          if (freshContent) {
            freshContent.classList.remove('be-body-anim');
            void freshContent.offsetWidth;
            freshContent.classList.add('be-body-anim');
          }
        });
      });
      content = panelBody.querySelector('#be-settings-content');
    }
    renderSettingsGroupContent(content);
  }

  function renderSettingsGroupContent(container) {
    const body = container; // 下面沿用原来 body.querySelector(...) 的写法，body 现在指内容容器而不是 #be-p-body
    const isCustomColor = settings.colorPreset === 'custom';
    const srcVals = getSourceValues();
    const avatarPreviewUrl = imgUrlSync(settings.customAvatar, () => {
      const p = mainDoc.getElementById('be-avatar-preview');
      const u = imgUrlSync(settings.customAvatar);
      if (p && u) { p.style.backgroundImage = `url('${u}')`; p.classList.remove('empty'); }
    });

    const toggleHtml = (id, on, extra = '') => `<label class="be-toggle"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${extra}><span class="be-slider"></span></label>`;
    const textInput = (id, val, ph) => `<input type="text" class="be-text-in" id="${id}" value="${escapeHtml(val || '')}" placeholder="${escapeHtml(ph || '')}">`;
    const hint = (t) => `<div class="be-row be-hint"><span>${t}</span></div>`;
    const expScale = Math.max(2, Math.min(5, Number(settings.exportScale) || 3));

    body.innerHTML = `
      ${settingsGroup === 'card' ? `
      ${renderTemplateSection()}

      <div class="be-sec" id="be-color-sec">
        <div class="be-sec-head">
          <h4>配色</h4>
          <span class="be-sec-head-btns">
            <button type="button" class="be-mini-btn ${_colorOrganize ? 'active' : ''}" id="be-color-organize">${_colorOrganize ? '完成' : '整理'}</button>
          </span>
        </div>
        <div class="be-color-grid">
          ${COLOR_PRESETS.filter(p => !(settings.hiddenColorPresets||[]).includes(p.id)).map(p => `
            <div class="be-color-dot-wrap">
              <div class="be-color-dot ${settings.colorPreset===p.id?'active':''}" data-k="${p.id}"
                   title="${escapeHtml(p.name)}" style="background:${p.bg};color:${p.fg};">A</div>
              ${_colorOrganize ? `<span class="be-color-del" data-chide="${p.id}" title="隐藏这个默认配色">×</span>` : ''}
            </div>
          `).join('')}
          ${(settings.customColors || []).map(c => `
            <div class="be-color-dot-wrap">
              <div class="be-color-dot ${settings.colorPreset === ('saved-' + c.id)?'active':''}" data-k="saved-${c.id}"
                   title="${escapeHtml(c.name || '自定义配色')}" style="background:${c.bg};color:${c.fg};">A</div>
              ${_colorOrganize ? `<span class="be-color-del" data-cdel="${c.id}" title="删除这份自定义配色">×</span>` : ''}
            </div>
          `).join('')}
          <div class="be-color-dot rainbow ${isCustomColor?'active':''}" data-k="custom" title="自定义"></div>
        </div>
        ${_colorOrganize ? hint('点 × 隐藏默认配色、删除自己存的配色；整理完点「完成」') : ''}
        ${renderHiddenColorGroup()}
        <div class="be-tpl-group ${(_customColorOpen || isCustomColor) ? 'open' : ''}" id="be-custom-color-group">
          <div class="be-tpl-group-head" id="be-custom-color-head"><span class="be-caret"></span><span>自定义配色（点彩虹圆圈后可调）</span></div>
          <div class="be-tpl-group-body">
            <div class="be-row">
              <label style="flex:1;">背景色</label>
              <input type="color" id="be-custom-bg" value="${escapeHtml(settings.customBg || '#f5f1e8')}" ${isCustomColor?'':'disabled'}>
            </div>
            <div class="be-row">
              <label style="flex:1;">自定义字色</label>
              <label class="be-toggle" ${isCustomColor?'':'style="opacity:0.4;pointer-events:none;"'}>
                <input type="checkbox" id="be-custom-fg-on" ${settings.customFgEnabled?'checked':''} ${isCustomColor?'':'disabled'}>
                <span class="be-slider"></span>
              </label>
              <input type="color" id="be-custom-fg" value="${escapeHtml(settings.customFg || '#222222')}" ${(isCustomColor && settings.customFgEnabled)?'':'disabled'} style="margin-left:8px;">
            </div>
            ${hint('关闭"自定义字色"时，按背景明度自动配深/浅字')}
            <div class="be-row">
              <button class="be-btn" id="be-save-color" ${isCustomColor?'':'disabled'} style="${isCustomColor?'':'opacity:0.4;'}">保存当前配色，以后一键复用</button>
            </div>
          </div>
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
        <h4>排版</h4>
        <div class="be-typo-presets">
          <span data-typo="compact">紧凑</span>
          <span data-typo="normal">默认</span>
          <span data-typo="loose">宽松</span>
        </div>
        <div class="be-row">
          <label style="flex:1;">正文字号 <span class="be-val" id="be-qsize-val">${Number(settings.quoteFontSize)||19}px</span></label>
          <input type="range" id="be-qsize" min="11" max="22" step="1" value="${Number(settings.quoteFontSize)||19}">
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
        <div class="be-row">
          <label style="flex:1;">保存清晰度</label>
          <div class="be-radio-group" id="be-panel-scale-group">
            ${[2, 3, 4, 5].map(v => `<button type="button" class="be-radio-opt ${expScale===v?'active':''}" data-v="${v}">${v}x</button>`).join('')}
          </div>
        </div>
        ${hint('倍率越高保存的图越清晰，但生成更慢、文件更大；跟卡片编辑页「字号」里的是同一个设置')}
      </div>

      <div class="be-sec">
        <h4>卡片内容</h4>
        <div class="be-subh">头像</div>
        <div class="be-row">
          <label style="flex:1;">显示头像</label>
          ${toggleHtml('be-show-avatar', settings.showAvatar)}
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
               style="${avatarPreviewUrl?`background-image:url('${avatarPreviewUrl}');`:''}"></div>
          <div style="flex:1;display:flex;gap:6px;">
            <button class="be-btn" id="be-avatar-upload">上传图片</button>
            <button class="be-btn" id="be-avatar-clear" ${settings.customAvatar?'':'disabled'}>清除</button>
          </div>
        </div>
        <div class="be-row">
          <label style="flex:1;">显示日期</label>
          ${toggleHtml('be-show-date', settings.showDate)}
        </div>

        <div class="be-subh">出处</div>
        <div class="be-row be-row-stack">
          <label>用户名（留空用 {{user}}）</label>
          ${textInput('be-src-in-user', srcVals.sourceUser, '')}
        </div>
        <div class="be-row be-row-stack">
          <label>作者（留空用 {{char}}）</label>
          ${textInput('be-src-in-author', srcVals.sourceAuthor, '')}
        </div>
        <div class="be-row">
          <label style="flex:1;">显示书名</label>
          ${toggleHtml('be-show-booktitle', srcVals.showSourceTitle)}
        </div>
        <div class="be-row be-row-stack" id="be-src-in-title-row" ${srcVals.showSourceTitle ? '' : 'hidden'}>
          ${textInput('be-src-in-title', srcVals.sourceTitle, '书名 / 作品名')}
        </div>
        <div class="be-row">
          <label style="flex:1;">显示章名</label>
          ${toggleHtml('be-show-chapter', srcVals.showSourceChapter)}
        </div>
        <div class="be-row be-row-stack" id="be-src-in-chapter-row" ${srcVals.showSourceChapter ? '' : 'hidden'}>
          ${textInput('be-src-in-chapter', srcVals.sourceChapter, '章名（部分模板会显示在书名/作者旁）')}
        </div>
        <div class="be-row" style="margin-top:4px;">
          <label style="flex:1;">出处按什么区分</label>
        </div>
        <div class="be-row">
          <div class="be-radio-group" id="be-source-scope-group" style="width:100%;">
            <button type="button" class="be-radio-opt ${(settings.sourceScope||'global')==='global'?'active':''}" data-v="global">全局统一</button>
            <button type="button" class="be-radio-opt ${settings.sourceScope==='character'?'active':''}" data-v="character">按角色</button>
            <button type="button" class="be-radio-opt ${settings.sourceScope==='chat'?'active':''}" data-v="chat">按角色+聊天</button>
          </div>
        </div>
        ${hint('选"按角色"/"按角色+聊天"后，上面填的出处只属于当前角色/聊天；切回"全局统一"就用回全局那一份')}

        <div class="be-subh">水印</div>
        <div class="be-row">
          <label style="flex:1;">显示水印</label>
          ${toggleHtml('be-show-watermark', settings.showWatermark !== false)}
        </div>
        <div class="be-row be-row-stack">
          ${textInput('be-watermark-text', settings.watermarkText, '留空默认显示 SillyTavern')}
        </div>

        <div class="be-subh">其它</div>
        <div class="be-row">
          <label style="flex:1;">想法书摘·原句引用符号</label>
          ${toggleHtml('be-show-thought-quote', settings.showThoughtQuote !== false)}
        </div>
        <div class="be-row">
          <label style="flex:1;">保留原文删除线</label>
          ${toggleHtml('be-keepdel', !!settings.keepDelLine)}
        </div>
      </div>

      <div class="be-sec">
        <h4>打码</h4>
        <div class="be-row">
          <label style="flex:1;">正文打码（分享时隐去名字）</label>
          ${toggleHtml('be-mask-on', !!settings.maskOn)}
        </div>
        <div id="be-mask-opts" ${settings.maskOn ? '' : 'hidden'}>
          <div class="be-row">
            <label style="flex:1;">打码用户名</label>
            ${toggleHtml('be-mask-user', settings.maskUser !== false)}
          </div>
          <div class="be-row">
            <label style="flex:1;">打码角色名</label>
            ${toggleHtml('be-mask-char', settings.maskChar !== false)}
          </div>
          <div class="be-row">
            <label style="flex:1;">同时打码出处里的用户名/作者</label>
            ${toggleHtml('be-mask-source', !!settings.maskSource)}
          </div>
          <div class="be-row be-row-stack">
            <label>额外打码词</label>
            ${textInput('be-mask-extra', settings.maskExtra, '逗号分隔，如昵称、地名')}
          </div>
          <div class="be-row">
            <label style="flex:1;">打码形式</label>
            <div class="be-radio-group" id="be-mask-style-group">
              <button type="button" class="be-radio-opt ${(settings.maskStyle||'block')==='block'?'active':''}" data-v="block">涂黑</button>
              <button type="button" class="be-radio-opt ${settings.maskStyle==='symbol'?'active':''}" data-v="symbol">符号</button>
              <button type="button" class="be-radio-opt ${settings.maskStyle==='custom'?'active':''}" data-v="custom">自定义</button>
            </div>
          </div>
          <div class="be-row be-row-stack" id="be-mask-char-row" ${settings.maskStyle === 'custom' ? '' : 'hidden'}>
            ${textInput('be-mask-char-in', settings.maskCustomChar, '例如 ✕ ※ ＊ ▩')}
          </div>
        </div>
      </div>
      ` : ''}

      ${settingsGroup === 'highlight' ? `
      <div class="be-sec">
        <h4>基本</h4>
        <div class="be-row">
          <label style="flex:1;">关闭划线功能</label>
          ${toggleHtml('be-highlight-disabled', !!settings.highlightDisabled)}
        </div>
        ${hint('只影响"选中文字弹出划线小工具栏"这一步，已有的划线、笔记本、书摘卡片都不受影响')}
        <div class="be-row" style="margin-top:6px;">
          <label style="flex:1;">取词方式</label>
          <div class="be-radio-group" id="be-selectmode-group">
            <button type="button" class="be-radio-opt ${(settings.selectMode||'drag')==='drag'?'active':''}" data-v="drag">拖选</button>
            <button type="button" class="be-radio-opt ${settings.selectMode==='tap'?'active':''}" data-v="tap">两点定位</button>
          </div>
        </div>
        ${hint('两点定位：拖选一小段当开头点"设为开头"，再拖选一小段当结尾点"设为结尾"，两段之间全部选中——适合手机端长文本')}
      </div>

      <div class="be-sec">
        <h4>默认样式</h4>
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
          <label style="flex:1;">想法虚线颜色（只写想法没划线时）</label>
          <input type="color" id="be-color-thought" value="${escapeHtml(settings.thoughtLineColor || '#ffdc6e')}">
        </div>
        <div class="be-row">
          <label style="flex:1;">有想法的划线自动提升明度</label>
          ${toggleHtml('be-thought-boost', !!settings.thoughtBoost)}
        </div>
        <div class="be-row">
          <label style="flex:1;">划线穿过特殊格式时剥离原样式</label>
          ${toggleHtml('be-strip', !!settings.stripStyle)}
        </div>
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
        <h4>工具条外观</h4>
        <div class="be-row">
          <label style="flex:1;">跟随酒馆主题</label>
          ${toggleHtml('be-follow-tavern-theme', !!settings.followTavernTheme)}
        </div>
        ${hint('开启后：划线时弹出的小工具条仿酒馆下拉框、点划线弹出的工具栏仿酒馆 h4 标题（含美化主题的贴图/边框/字色）；关闭则是默认深色。不影响设置面板和笔记本')}
      </div>

      <div class="be-sec">
        <h4>划线合并</h4>
        <div class="be-row">
          <label style="flex:1;">把不连续的几句话拼成一条书摘</label>
          ${toggleHtml('be-merge-enabled', !!settings.mergeEnabled)}
        </div>
        ${hint('开启后：点已有划线可"加入合并"，笔记本里也能勾选加入；关闭后界面完全不变')}
        <div id="be-merge-opts-block" style="${settings.mergeEnabled ? '' : 'display:none;'}">
          <div class="be-row" style="margin-top:8px;">
            <label style="flex:1;">合并完成后</label>
          </div>
          <div class="be-row">
            <div class="be-radio-group" id="be-merge-target-group" style="width:100%;">
              <button type="button" class="be-radio-opt ${!settings.mergeDefaultTarget?'active':''}" data-v="">每次询问</button>
              <button type="button" class="be-radio-opt ${settings.mergeDefaultTarget==='note'?'active':''}" data-v="note">存为笔记</button>
              <button type="button" class="be-radio-opt ${settings.mergeDefaultTarget==='card'?'active':''}" data-v="card">生成书摘</button>
              <button type="button" class="be-radio-opt ${settings.mergeDefaultTarget==='both'?'active':''}" data-v="both">两者都要</button>
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
      ` : ''}

      ${settingsGroup === 'general' ? `
      <div class="be-sec">
        <h4>插件界面</h4>
        <div class="be-row">
          <label style="flex:1;">主题色</label>
          <input type="color" id="be-theme-color" value="${escapeHtml(settings.themeColor || '#95b6d6')}">
        </div>
        ${hint('设置面板、笔记本、悬浮按钮等插件界面的强调色；不影响卡片本身的配色')}
      </div>

      <div class="be-sec">
        <h4>保存图片</h4>
        <div class="be-row">
          <div class="be-radio-group" id="be-savemode-group">
            <button type="button" class="be-radio-opt ${(settings.saveMode||'download')==='download'?'active':''}" data-v="download">下载文件</button>
            <button type="button" class="be-radio-opt ${settings.saveMode==='popup'?'active':''}" data-v="popup">弹图长按</button>
          </div>
        </div>
        ${hint('下载没反应的内嵌浏览器可以换「弹图长按」')}
      </div>

      <div class="be-sec">
        <h4>数据</h4>
        <div class="be-subh">笔记</div>
        <div class="be-row" style="gap:6px;">
          <button class="be-btn" id="be-export-all">导出全部</button>
          <button class="be-btn" id="be-import-all">导入</button>
          <button class="be-btn danger" id="be-clear-all">清空</button>
        </div>
        <div class="be-subh">模板 · 字体 · 配色</div>
        <div class="be-row" style="gap:6px;">
          <button class="be-btn" id="be-export-bundle">打包导出</button>
          <button class="be-btn" id="be-import-bundle">批量导入</button>
        </div>
        ${hint('打包的是所有导入的模板、字体和自己存的配色，不含笔记')}
      </div>

      <div class="be-sec">
        <h4>高级</h4>
        <div class="be-row">
          <label style="flex:1;">开发者模式</label>
          ${toggleHtml('be-creator-mode', !!settings.creatorMode)}
        </div>
        ${hint('开启后，模板「整理」里的"编辑CSS"会打开可拖动缩放的悬浮编辑窗，跟卡片预览同屏实时看效果，还带类名查询器')}
        ${IS_EXTENSION ? `
        <div class="be-row" style="margin-top:6px;">
          <label style="flex:1;">自由排版（实验功能）</label>
          ${toggleHtml('be-freeform-enabled', !!settings.freeformEnabled)}
        </div>
        ${hint('开启后扩展菜单会多一个"自由排版"入口；关闭后入口消失，不影响已存的草稿')}
        ` : ''}
      </div>

      <div class="be-sec">
        ${renderAboutGroup()}
      </div>
      ` : ''}
    `;

    // 绑定
    bindTemplateSection(body);
    body.querySelector('#be-color-organize')?.addEventListener('click', () => {
      _colorOrganize = !_colorOrganize;
      renderSettings();
    });
    body.querySelector('#be-custom-color-head')?.addEventListener('click', () => {
      _customColorOpen = !body.querySelector('#be-custom-color-group')?.classList.contains('open');
      body.querySelector('#be-custom-color-group')?.classList.toggle('open', _customColorOpen);
    });
    body.querySelectorAll('.be-color-dot').forEach(el => {
      el.addEventListener('click', () => {
        settings.colorPreset = el.getAttribute('data-k');
        saveSettings(settings);
        renderSettings();
        if (mainDoc.getElementById('be-card')) renderCard(lastText);
      });
    });
    body.querySelectorAll('.be-color-del[data-cdel]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        deleteCustomColor(el.getAttribute('data-cdel'));
      });
    });
    body.querySelectorAll('.be-color-del[data-chide]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        hideColorPreset(el.getAttribute('data-chide'));
      });
    });
    body.querySelector('#be-hidden-color-group-head')?.addEventListener('click', () => {
      _hiddenColorOpen = !_hiddenColorOpen;
      body.querySelector('#be-hidden-color-group')?.classList.toggle('open', _hiddenColorOpen);
    });
    body.querySelectorAll('#be-hidden-color-group button[data-restore-color]').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        restoreColorPreset(b.getAttribute('data-restore-color'));
      });
    });
    body.querySelector('#be-save-color')?.addEventListener('click', () => {
      if (settings.colorPreset !== 'custom') return;
      openSaveColorDialog();
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
    body.querySelector('#be-theme-color')?.addEventListener('input', e => {
      settings.themeColor = e.target.value;
      saveSettings(settings);
      refreshStyle();
    });
    body.querySelector('#be-follow-tavern-theme')?.addEventListener('change', e => {
      settings.followTavernTheme = e.target.checked;
      invalidateTavernStyleCache();
      saveSettings(settings);
      refreshStyle();
      renderSettings();
    });
    body.querySelector('#be-creator-mode')?.addEventListener('change', e => {
      settings.creatorMode = e.target.checked;
      saveSettings(settings);
      renderSettings();
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
    body.querySelectorAll('#be-savemode-group .be-radio-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        settings.saveMode = btn.getAttribute('data-v') === 'popup' ? 'popup' : 'download';
        saveSettings(settings);
        body.querySelectorAll('#be-savemode-group .be-radio-opt').forEach(b => b.classList.toggle('active', b === btn));
      });
    });
    body.querySelector('#be-freeform-enabled')?.addEventListener('change', e => {
      settings.freeformEnabled = e.target.checked;
      saveSettings(settings);
      injectMenuEntry(); // 开关状态变了，菜单入口要跟着增/减
    });
    body.querySelector('#be-avatar-upload')?.addEventListener('click', () => {
      const inp = mainDoc.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.addEventListener('change', async ev => {
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;
        try {
          await setCustomAvatarFromFile(f);
          const prev = body.querySelector('#be-avatar-preview');
          const url = imgUrlSync(settings.customAvatar);
          if (prev && url) {
            prev.style.backgroundImage = `url('${url}')`;
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
      clearCustomAvatar();
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
    // 卡片内容 · 出处：直接在面板里填（编辑出处弹窗保留为卡片编辑页的快捷入口，改的是同一份）
    let _srcInT = 0;
    const refreshCard = () => { if (mainDoc.getElementById('be-card')) renderCard(lastText); };
    [['#be-src-in-user', 'sourceUser'], ['#be-src-in-author', 'sourceAuthor'],
     ['#be-src-in-title', 'sourceTitle'], ['#be-src-in-chapter', 'sourceChapter']].forEach(([sel, field]) => {
      body.querySelector(sel)?.addEventListener('input', e => {
        const v = e.target.value.trim();
        if (_srcInT) mainWin.clearTimeout(_srcInT);
        _srcInT = mainWin.setTimeout(() => { _srcInT = 0; setSourceValues({ [field]: v }); refreshCard(); }, 250);
      });
    });
    body.querySelector('#be-show-booktitle')?.addEventListener('change', e => {
      setSourceValues({ showSourceTitle: e.target.checked });
      body.querySelector('#be-src-in-title-row').hidden = !e.target.checked;
      refreshCard();
    });
    body.querySelector('#be-show-chapter')?.addEventListener('change', e => {
      setSourceValues({ showSourceChapter: e.target.checked });
      body.querySelector('#be-src-in-chapter-row').hidden = !e.target.checked;
      refreshCard();
    });
    body.querySelector('#be-keepdel')?.addEventListener('change', e => {
      settings.keepDelLine = e.target.checked;
      saveSettings(settings);
      refreshCard();
    });
    // 打码
    const maskToggle = (sel, field) => body.querySelector(sel)?.addEventListener('change', e => {
      settings[field] = e.target.checked;
      saveSettings(settings);
      if (field === 'maskOn') body.querySelector('#be-mask-opts').hidden = !e.target.checked;
      refreshCard();
    });
    maskToggle('#be-mask-on', 'maskOn');
    maskToggle('#be-mask-user', 'maskUser');
    maskToggle('#be-mask-char', 'maskChar');
    maskToggle('#be-mask-source', 'maskSource');
    body.querySelector('#be-mask-extra')?.addEventListener('input', e => {
      settings.maskExtra = e.target.value;
      saveSettings(settings);
      refreshCard();
    });
    body.querySelector('#be-mask-char-in')?.addEventListener('input', e => {
      settings.maskCustomChar = e.target.value;
      saveSettings(settings);
      refreshCard();
    });
    body.querySelectorAll('#be-mask-style-group .be-radio-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        settings.maskStyle = btn.getAttribute('data-v');
        saveSettings(settings);
        body.querySelectorAll('#be-mask-style-group .be-radio-opt').forEach(b => b.classList.toggle('active', b === btn));
        body.querySelector('#be-mask-char-row').hidden = settings.maskStyle !== 'custom';
        refreshCard();
      });
    });
    body.querySelectorAll('#be-panel-scale-group .be-radio-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        settings.exportScale = Number(btn.getAttribute('data-v')) || 3;
        saveSettings(settings);
        body.querySelectorAll('#be-panel-scale-group .be-radio-opt').forEach(b => b.classList.toggle('active', b === btn));
      });
    });
    body.querySelector('#be-highlight-disabled')?.addEventListener('change', e => {
      settings.highlightDisabled = e.target.checked;
      saveSettings(settings);
      if (settings.highlightDisabled) { hideBar(); resetPickPending(); }
      refreshStyle(); // 状态栏"允许选字"那段样式跟着划线开关走
    });
    body.querySelectorAll('#be-selectmode-group .be-radio-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        settings.selectMode = btn.getAttribute('data-v') === 'tap' ? 'tap' : 'drag';
        saveSettings(settings);
        resetPickPending();
        body.querySelectorAll('#be-selectmode-group .be-radio-opt').forEach(b => b.classList.toggle('active', b === btn));
      });
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
    body.querySelectorAll('#be-source-scope-group .be-radio-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        settings.sourceScope = btn.getAttribute('data-v');
        saveSettings(settings);
        body.querySelectorAll('#be-source-scope-group .be-radio-opt').forEach(b => b.classList.toggle('active', b === btn));
        renderSettingsGroupContent(body); // 范围一变，预览文本要立刻换成对应角色/聊天那份
        if (mainDoc.getElementById('be-card')) renderCard(lastText);
      });
    });
    body.querySelector('#be-export-all')?.addEventListener('click', exportNotes);
    body.querySelector('#be-import-all')?.addEventListener('click', importNotes);
    body.querySelector('#be-export-bundle')?.addEventListener('click', exportTemplateBundle);
    body.querySelector('#be-import-bundle')?.addEventListener('click', importTemplateBundle);
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
              ${charMergeMode ? `<div class="be-merge-check">${picked ? mergeBasketOrder(it.id) : ''}</div>` : ''}
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
            if (it) addToMergeBasket({ text: it.text, source: 'note', noteId: id, charKey: currentCharKey, chatId: it.chatId || '' });
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

  // ---------- 模板/字体/颜色 批量导入导出（打包一份 JSON，跟"导出全部"笔记数据完全独立）----------
  function templateToPortable(t) {
    const idEsc = String(t.id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cssOut = (t.css || '').replace(new RegExp('\\.be-card\\.tpl-custom-' + idEsc, 'g'), '.be-card.be-custom');
    return { name: t.name || '未命名', css: cssOut };
  }
  function portableToTemplate(p) {
    const id = 't' + Date.now() + Math.random().toString(36).slice(2, 5);
    const css = (p.css || '').replace(/\.be-card\.be-custom\b/g, `.be-card.tpl-custom-${id}`);
    return { id, name: p.name || '未命名', css };
  }
  function exportTemplateBundle() {
    const payload = {
      type: 'book-excerpt-bundle',
      version: 1,
      templates: (settings.customTemplates || []).map(templateToPortable),
      fonts: (settings.customFonts || []).map(f => ({ name: f.name || '未命名', css: f.css || '', fontFamily: f.fontFamily || '' })),
      colors: (settings.customColors || []).map(c => ({ name: c.name || '自定义配色', bg: c.bg, fg: c.fg, fgEnabled: !!c.fgEnabled }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    triggerDownload(blob, `书摘模板包_${formatDate().replace(/\//g, '')}.json`);
    toast('已导出', 'success');
  }
  function importTemplateBundle() {
    const input = mainDoc.createElement('input');
    input.type = 'file'; input.accept = 'application/json';
    input.addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const obj = JSON.parse(fr.result);
          if (!obj || typeof obj !== 'object') throw new Error('格式错误');
          const tpls = Array.isArray(obj.templates) ? obj.templates : [];
          const fonts = Array.isArray(obj.fonts) ? obj.fonts : [];
          const colors = Array.isArray(obj.colors) ? obj.colors : [];
          const newTpls = tpls.map(portableToTemplate);
          const newFonts = fonts.map(fo => ({
            id: 'f' + Date.now() + Math.random().toString(36).slice(2, 5),
            name: fo.name || '未命名', css: fo.css || '', fontFamily: fo.fontFamily || 'sans-serif'
          }));
          const newColors = colors.map(c => ({
            id: 'c' + Date.now() + Math.random().toString(36).slice(2, 5),
            name: c.name || '自定义配色', bg: c.bg, fg: c.fg, fgEnabled: !!c.fgEnabled
          }));
          settings.customTemplates = (settings.customTemplates || []).concat(newTpls);
          settings.customFonts = (settings.customFonts || []).concat(newFonts);
          settings.customColors = (settings.customColors || []).concat(newColors);
          saveSettings(settings);
          injectCustomTemplateStyles();
          renderSettings();
          toast(`已导入：模板 ${newTpls.length} / 字体 ${newFonts.length} / 配色 ${newColors.length}`, 'success');
        } catch (err) { toast('导入失败：' + (err?.message || err), 'error'); }
      };
      fr.readAsText(f);
    });
    input.click();
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

  // ---------- 自由排版 ----------
  // 尺寸预设：常见分享比例，最后一项是自定义
  const FC_SIZE_PRESETS = [
    { key: '3-4', name: '竖版 3:4', w: 900, h: 1200 },
    { key: '1-1', name: '正方形 1:1', w: 1000, h: 1000 },
    { key: '2-3', name: '海报 2:3', w: 900, h: 1350 },
    { key: 'custom', name: '自定义', w: 0, h: 0 }
  ];

  let fcView = 'list';        // 'list' | 'editor'
  let fcCurrentId = null;

  function ensureFcMask() {
    let mask = mainDoc.getElementById('be-fc-mask');
    if (mask && !isStaleGen(mask)) return mask;
    if (mask) { try { mask.remove(); } catch (e) {} }
    mask = stampGen(mainDoc.createElement('div'));
    mask.id = 'be-fc-mask';
    mask.innerHTML = `<div id="be-fc-body"></div>`;
    mainDoc.body.appendChild(mask);
    return mask;
  }

  function openFreeformList() {
    const mask = ensureFcMask();
    if (mask.parentNode !== mainDoc.body || mask.nextSibling) mainDoc.body.appendChild(mask);
    detectAndApplyTheme();
    fcView = 'list';
    fcCurrentId = null;
    mask.classList.add('open');
    renderFreeform();
  }
  function closeFreeform() {
    mainDoc.getElementById('be-fc-mask')?.classList.remove('open');
  }

  function renderFreeform() {
    const mask = mainDoc.getElementById('be-fc-mask');
    const body = mask?.querySelector('#be-fc-body');
    if (!body) return;
    if (fcView === 'editor' && fcCurrentId) renderFreeformEditorView(body);
    else renderFreeformListView(body);
  }

  function renderFreeformListView(body) {
    const all = loadCanvases();
    const list = Object.values(all).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    body.innerHTML = `
      <div class="be-fc-listhead">
        <span class="be-fc-title">自由排版</span>
        <button class="be-btn" id="be-fc-close">×</button>
      </div>
      <div class="be-fc-newrow">
        <button class="be-btn primary" id="be-fc-new">+ 新建画布</button>
      </div>
      ${list.length ? `
      <div class="be-fc-grid">
        ${list.map(c => `
          <div class="be-fc-card" data-id="${c.id}">
            <div class="be-fc-thumb" style="background:${escapeHtml(c.bg?.color || '#f0ebe0')};">
              <span class="be-fc-thumb-size">${c.width}×${c.height}</span>
            </div>
            <div class="be-fc-card-name">${escapeHtml(c.name || '未命名排版')}</div>
            <div class="be-fc-card-meta">${formatDateTime(c.updatedAt)} · ${(c.elements||[]).length} 个元素</div>
            <button class="be-fc-card-del" data-id="${c.id}" title="删除">×</button>
          </div>
        `).join('')}
      </div>
      ` : `<div class="be-empty">还没有自由排版草稿<br><span style="font-size:11px;">点上面"+ 新建画布"开始</span></div>`}
    `;
    body.querySelector('#be-fc-close').addEventListener('click', closeFreeform);
    body.querySelector('#be-fc-new').addEventListener('click', openNewCanvasDialog);
    body.querySelectorAll('.be-fc-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.be-fc-card-del')) return;
        openFreeformEditor(card.getAttribute('data-id'));
      });
    });
    body.querySelectorAll('.be-fc-card-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (!mainWin.confirm('删除这份自由排版草稿？此操作不可恢复。')) return;
        deleteCanvas(id);
        renderFreeform();
        toast('已删除', 'success');
      });
    });
  }

  function openNewCanvasDialog() {
    const MASK_ID = 'be-fc-new-mask';
    let mask = mainDoc.getElementById(MASK_ID);
    if (!mask) {
      mask = mainDoc.createElement('div');
      mask.id = MASK_ID;
      mask.className = 'be-import-tpl-mask';
      mask.innerHTML = `
        <div class="be-import-tpl-box">
          <div class="be-src-title">新建自由排版</div>
          <div class="be-src-field">
            <label>名称</label>
            <input type="text" id="be-fc-new-name" placeholder="未命名排版">
          </div>
          <div class="be-src-field">
            <label>画布尺寸</label>
            <div class="be-radio-group" id="be-fc-size-group">
              ${FC_SIZE_PRESETS.map(p => `<button type="button" class="be-radio-opt" data-k="${p.key}">${p.name}</button>`).join('')}
            </div>
          </div>
          <div class="be-src-field" id="be-fc-custom-size-field" style="display:none;">
            <label>自定义宽 × 高（像素）</label>
            <div class="be-row" style="gap:8px;">
              <input type="number" id="be-fc-custom-w" min="200" max="3000" value="900" style="width:90px;">
              <span>×</span>
              <input type="number" id="be-fc-custom-h" min="200" max="3000" value="1200" style="width:90px;">
            </div>
          </div>
          <div class="be-src-field" id="be-fc-tpl-field" style="display:none;">
            <label>或直接从已存的版式模板新建</label>
            <div class="be-fc-tpl-list" id="be-fc-tpl-list"></div>
          </div>
          <div class="be-src-actions">
            <button class="be-btn" id="be-fc-new-cancel">取消</button>
            <button class="be-btn primary" id="be-fc-new-confirm">创建空白画布</button>
          </div>
        </div>
      `;
      mainDoc.body.appendChild(mask);
      mask.addEventListener('click', e => { if (e.target === mask) mask.classList.remove('open'); });
    } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    detectAndApplyTheme();
    mask.querySelector('#be-fc-new-name').value = '';
    let chosenPreset = FC_SIZE_PRESETS[0];
    mask.querySelectorAll('#be-fc-size-group .be-radio-opt').forEach((b, i) => b.classList.toggle('active', i === 0));
    mask.querySelector('#be-fc-custom-size-field').style.display = 'none';
    mask.classList.add('open');

    const tplList = mask.querySelector('#be-fc-tpl-list');
    const tplField = mask.querySelector('#be-fc-tpl-field');
    const templates = Array.isArray(settings.freeformTemplates) ? settings.freeformTemplates : [];
    if (templates.length) {
      tplField.style.display = '';
      tplList.innerHTML = templates.map(t => `
        <button type="button" class="be-fc-tpl-item" data-tid="${t.id}">
          <span class="be-fc-tpl-item-name">${escapeHtml(t.name)}</span>
          <span class="be-fc-tpl-item-meta">${t.width}×${t.height} · ${t.elements.length} 个元素</span>
        </button>
      `).join('');
      tplList.querySelectorAll('.be-fc-tpl-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const tpl = templates.find(t => t.id === btn.getAttribute('data-tid'));
          if (!tpl) return;
          const canvas = fcCreateCanvasFromTemplate(tpl);
          mask.classList.remove('open');
          openFreeformEditor(canvas.id);
        });
      });
    } else {
      tplField.style.display = 'none';
      tplList.innerHTML = '';
    }

    const close = () => mask.classList.remove('open');
    const reNew = (sel, fn) => {
      const el = mask.querySelector(sel);
      const clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);
      clone.addEventListener('click', fn);
      return clone;
    };
    mask.querySelectorAll('#be-fc-size-group .be-radio-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        chosenPreset = FC_SIZE_PRESETS.find(p => p.key === btn.getAttribute('data-k')) || FC_SIZE_PRESETS[0];
        mask.querySelectorAll('#be-fc-size-group .be-radio-opt').forEach(b => b.classList.toggle('active', b === btn));
        mask.querySelector('#be-fc-custom-size-field').style.display = chosenPreset.key === 'custom' ? '' : 'none';
      });
    });
    reNew('#be-fc-new-cancel', close);
    reNew('#be-fc-new-confirm', () => {
      const name = mask.querySelector('#be-fc-new-name').value.trim() || '未命名排版';
      let w = chosenPreset.w, h = chosenPreset.h;
      if (chosenPreset.key === 'custom') {
        w = Math.max(200, Math.min(3000, Number(mask.querySelector('#be-fc-custom-w').value) || 900));
        h = Math.max(200, Math.min(3000, Number(mask.querySelector('#be-fc-custom-h').value) || 1200));
      }
      const canvas = createCanvas(w, h, name);
      close();
      openFreeformEditor(canvas.id);
    });
  }

  // 从存好的版式模板新建一份真正可编辑的画布：id 全部重新生成（不能沿用模板里的 id，
  // 不然同一个模板新建两次会撞 id），图片元素在存模板时就已经被清成空占位框，这里原样落地即可。
  function fcCreateCanvasFromTemplate(tpl) {
    const all = loadCanvases();
    const id = newCanvasId();
    const elements = (tpl.elements || []).map(srcEl => ({ ...srcEl, id: fcNewElId() }));
    all[id] = {
      id, name: tpl.name || '未命名排版', createdAt: Date.now(), updatedAt: Date.now(),
      width: tpl.width, height: tpl.height,
      bg: tpl.bg ? { ...tpl.bg } : { color: '#ffffff', image: '' },
      elements
    };
    saveCanvases(all);
    return all[id];
  }

  // 存为模板：图片元素只留版式（位置/宽高/旋转），不带真实图片数据，变成空占位框等用户重新填图；
  // 文字元素留全部样式，但把具体文字内容换成占位提示，模板复用的是"排版"，不是这一次写的具体内容。
  function fcBuildTemplateElementsFromCanvas(canvas) {
    return canvas.elements.map(el => {
      if (el.type === 'image') {
        return { id: el.id, type: 'image', x: el.x, y: el.y, w: el.w, h: el.h, rotate: el.rotate || 0, z: el.z || 0 };
      }
      return {
        id: el.id, type: 'text', x: el.x, y: el.y, w: el.w, h: el.h, rotate: el.rotate || 0, z: el.z || 0,
        html: '双击编辑文字',
        fontSize: el.fontSize, fontFamily: el.fontFamily, lineHeight: el.lineHeight, letterSpacing: el.letterSpacing,
        align: el.align, color: el.color, highlightBg: el.highlightBg, opacity: el.opacity, locked: false,
        paragraphPreset: el.paragraphPreset, textStroke: el.textStroke ? { ...el.textStroke } : null,
        writingMode: el.writingMode || 'horizontal-tb'
      };
    });
  }

  function openSaveTemplateDialog() {
    const canvas = fcGetCanvas();
    if (!canvas) return;
    if (!canvas.elements.length) { toast('画布还是空的，先加点内容再存模板', 'info'); return; }
    const MASK_ID = 'be-fc-savetpl-mask';
    let mask = mainDoc.getElementById(MASK_ID);
    if (!mask) {
      mask = mainDoc.createElement('div');
      mask.id = MASK_ID;
      mask.className = 'be-import-tpl-mask';
      mask.innerHTML = `
        <div class="be-import-tpl-box">
          <div class="be-src-title">存为版式模板</div>
          <div class="be-src-field">
            <label>模板名称</label>
            <input type="text" id="be-fc-savetpl-name" placeholder="未命名模板">
          </div>
          <div class="be-fc-prop-row" style="font-size:11px;opacity:0.7;">
            <span>图片会变成空占位框（不保存真实图片数据），文字保留样式但清空具体内容——存的是版式，不是这一次的正文</span>
          </div>
          <div class="be-src-actions">
            <button class="be-btn" id="be-fc-savetpl-cancel">取消</button>
            <button class="be-btn primary" id="be-fc-savetpl-confirm">保存</button>
          </div>
        </div>
      `;
      mainDoc.body.appendChild(mask);
      mask.addEventListener('click', e => { if (e.target === mask) mask.classList.remove('open'); });
    } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    detectAndApplyTheme();
    mask.querySelector('#be-fc-savetpl-name').value = canvas.name || '';
    mask.classList.add('open');

    const reNew = (sel, fn) => {
      const el = mask.querySelector(sel);
      const clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);
      clone.addEventListener('click', fn);
    };
    reNew('#be-fc-savetpl-cancel', () => mask.classList.remove('open'));
    reNew('#be-fc-savetpl-confirm', () => {
      const name = mask.querySelector('#be-fc-savetpl-name').value.trim() || '未命名模板';
      const tpl = {
        id: 'ft' + Date.now() + Math.random().toString(36).slice(2, 6),
        name, createdAt: Date.now(),
        width: canvas.width, height: canvas.height,
        bg: canvas.bg ? { ...canvas.bg } : { color: '#ffffff', image: '' },
        elements: fcBuildTemplateElementsFromCanvas(canvas)
      };
      const list = Array.isArray(settings.freeformTemplates) ? settings.freeformTemplates : [];
      list.push(tpl);
      settings.freeformTemplates = list;
      saveSettings(settings);
      mask.classList.remove('open');
      toast('已存为版式模板', 'success');
    });
  }

  function openFreeformEditor(id) {
    fcCurrentId = id;
    fcView = 'editor';
    fcUndoStack = [];
    fcRedoStack = [];
    fcPanelUndoDirty = false;
    touchCanvas(id);
    renderFreeform();
  }

  // ---- 编辑器状态（模块级，跟着当前打开的画布走）----
  let fcSelected = null;      // 当前单选元素 id（跟 fcMultiSelected 互斥：多选时这个是 null）
  let fcMultiSelected = [];   // 多选元素 id 列表，长度 >1 才算真正处于多选态
  let fcEditingId = null;     // 正在编辑文字内容的元素 id（双击进入，失焦提交退出；编辑期间该元素不可拖）
  let fcInteractBound = false; // interact.js 手势只需要绑定一次（selector 委托，元素重建后自动生效）
  let fcRotating = null;      // 旋转手势临时状态
  let fcBoxSelect = null;     // 框选拖拽临时状态 { startX, startY, curX, curY, moved, shiftKey }（画布本地坐标）
  let fcLayerDragId = null;   // 图层面板拖拽排序临时状态
  let fcUndoStack = [];       // 撤销栈：每项是当时 canvas.elements 的深拷贝快照，上限 FC_UNDO_LIMIT
  let fcRedoStack = [];       // 重做栈：发生新动作（fcPushUndo 被调用）时清空
  const FC_UNDO_LIMIT = 50;

  function fcGetCanvas() { return loadCanvases()[fcCurrentId] || null; }
  function fcCanvasEl() { return mainDoc.getElementById('be-fc-canvas'); }
  function fcFindElement(id) {
    const c = fcGetCanvas();
    return c ? c.elements.find(e => e.id === id) : null;
  }
  function fcNewElId() { return 'e' + Date.now() + Math.random().toString(36).slice(2, 6); }
  function fcMaxZ() {
    const c = fcGetCanvas();
    if (!c || !c.elements.length) return 0;
    return Math.max(...c.elements.map(e => e.z || 0));
  }
  function fcCommitElement() {
    // 一次手势（拖拽/缩放/旋转）结束时调用：写回 updatedAt + 防抖落盘
    const c = fcGetCanvas();
    if (!c) return;
    c.updatedAt = Date.now();
    saveCanvasesDebounced();
  }

  // 在即将发生的改动应用之前调用，把改动前的 elements 深拷贝压进撤销栈。数据模型都是纯 JSON
  // （图片是已经压缩好的 dataURL 字符串），JSON.parse(JSON.stringify(...)) 深拷贝足够快也足够安全。
  function fcPushUndo() {
    const canvas = fcGetCanvas();
    if (!canvas) return;
    fcUndoStack.push(JSON.parse(JSON.stringify(canvas.elements)));
    if (fcUndoStack.length > FC_UNDO_LIMIT) fcUndoStack.shift();
    fcRedoStack = [];
    fcSyncUndoButtons();
  }
  function fcUndo() {
    const canvas = fcGetCanvas();
    if (!canvas || !fcUndoStack.length) return;
    fcRedoStack.push(JSON.parse(JSON.stringify(canvas.elements)));
    if (fcRedoStack.length > FC_UNDO_LIMIT) fcRedoStack.shift();
    canvas.elements = fcUndoStack.pop();
    fcSelected = null;
    fcMultiSelected = [];
    fcCommitElement();
    renderFcElements();
    renderFcPropPanel();
    fcSyncUndoButtons();
  }
  function fcRedo() {
    const canvas = fcGetCanvas();
    if (!canvas || !fcRedoStack.length) return;
    fcUndoStack.push(JSON.parse(JSON.stringify(canvas.elements)));
    if (fcUndoStack.length > FC_UNDO_LIMIT) fcUndoStack.shift();
    canvas.elements = fcRedoStack.pop();
    fcSelected = null;
    fcMultiSelected = [];
    fcCommitElement();
    renderFcElements();
    renderFcPropPanel();
    fcSyncUndoButtons();
  }
  function fcSyncUndoButtons() {
    const undoBtn = mainDoc.getElementById('be-fc-undo');
    const redoBtn = mainDoc.getElementById('be-fc-redo');
    if (undoBtn) undoBtn.disabled = fcUndoStack.length === 0;
    if (redoBtn) redoBtn.disabled = fcRedoStack.length === 0;
  }

  function renderFreeformEditorView(body) {
    const canvas = fcGetCanvas();
    if (!canvas) { fcView = 'list'; renderFreeformListView(body); return; }
    fcSelected = null;
    body.innerHTML = `
      <div class="be-fc-listhead">
        <button class="be-btn" id="be-fc-back">‹ 返回</button>
        <span class="be-fc-title">${escapeHtml(canvas.name)}</span>
        <button class="be-btn" id="be-fc-close">×</button>
      </div>
      <div class="be-fc-toolbar">
        <button class="be-fc-icon-btn" id="be-fc-undo" disabled title="撤销 (Ctrl+Z)">↩</button>
        <button class="be-fc-icon-btn" id="be-fc-redo" disabled title="重做 (Ctrl+Shift+Z)">↪</button>
        <div class="be-fc-menu-wrap">
          <button class="be-fc-icon-btn primary" id="be-fc-add-toggle" title="添加文字/图片">+</button>
          <div class="be-fc-dropdown" id="be-fc-add-menu">
            <button type="button" id="be-fc-add-text">📝 文字</button>
            <button type="button" id="be-fc-add-image">🖼️ 图片</button>
            <button type="button" id="be-fc-split-image">✂️ 裂图</button>
          </div>
        </div>
        <button class="be-fc-icon-btn" id="be-fc-layers-toggle" title="图层">▤</button>
        <button class="be-fc-icon-btn danger" id="be-fc-del-selected" disabled title="删除选中">🗑️</button>
        <span class="be-fc-toolbar-spacer"></span>
        <div class="be-fc-menu-wrap">
          <button class="be-fc-icon-btn" id="be-fc-more-toggle" title="更多">⋯</button>
          <div class="be-fc-dropdown be-fc-dropdown-right" id="be-fc-more-menu">
            <button type="button" id="be-fc-save-template">💾 存为模板</button>
            <div class="be-fc-dropdown-row">
              <span>导出倍率</span>
              <select id="be-fc-export-scale" title="导出倍率">
                <option value="1">1x</option>
                <option value="2" selected>2x</option>
                <option value="3">3x</option>
              </select>
            </div>
            <button type="button" class="primary" id="be-fc-export">⬇️ 导出图片</button>
          </div>
        </div>
      </div>
      <div class="be-fc-layers" id="be-fc-layers"></div>
      <div class="be-fc-multibar" id="be-fc-multibar" style="display:none;">
        <span id="be-fc-multibar-count"></span>
        <div class="be-fc-multibar-align">
          <button type="button" class="be-fc-align-btn" data-align="left">左对齐</button>
          <button type="button" class="be-fc-align-btn" data-align="hcenter">水平居中</button>
          <button type="button" class="be-fc-align-btn" data-align="right">右对齐</button>
          <button type="button" class="be-fc-align-btn" data-align="top">顶对齐</button>
          <button type="button" class="be-fc-align-btn" data-align="vcenter">垂直居中</button>
          <button type="button" class="be-fc-align-btn" data-align="bottom">底对齐</button>
        </div>
      </div>
      <div class="be-fc-proppanel" id="be-fc-proppanel" style="display:none;"></div>
      <div class="be-fc-canvas-wrap">
        <div class="be-fc-canvas" id="be-fc-canvas" style="width:${canvas.width}px;height:${canvas.height}px;background:${escapeHtml(canvas.bg?.color || '#ffffff')};"></div>
      </div>
    `;
    body.querySelector('#be-fc-back').addEventListener('click', () => { fcView = 'list'; renderFreeform(); });
    body.querySelector('#be-fc-close').addEventListener('click', closeFreeform);
    body.querySelector('#be-fc-undo').addEventListener('click', fcUndo);
    body.querySelector('#be-fc-redo').addEventListener('click', fcRedo);
    body.querySelector('#be-fc-export').addEventListener('click', () => { fcCloseAllDropdowns(); fcExportCanvas(); });
    body.querySelector('#be-fc-save-template').addEventListener('click', () => { fcCloseAllDropdowns(); openSaveTemplateDialog(); });
    body.querySelector('#be-fc-add-text').addEventListener('click', () => { fcCloseAllDropdowns(); fcAddTextElement(); });
    body.querySelector('#be-fc-add-image').addEventListener('click', () => { fcCloseAllDropdowns(); fcAddImageElement(); });
    body.querySelector('#be-fc-split-image').addEventListener('click', () => { fcCloseAllDropdowns(); fcOpenSplitDialog(); });
    body.querySelector('#be-fc-del-selected').addEventListener('click', fcDeleteSelected);
    body.querySelector('#be-fc-layers-toggle').addEventListener('click', () => {
      fcCloseAllDropdowns();
      const panel = mainDoc.getElementById('be-fc-layers');
      if (!panel) return;
      const showing = panel.classList.contains('open');
      fcCloseLayersPanel();
      if (!showing) { panel.classList.add('open'); renderFcLayersPanel(); }
    });
    // 工具条里"+"和"更多"是两个下拉菜单：点触发按钮开关自己，点其它任何地方（含另一个菜单）全部收起，
    // 不用逐个菜单单独判断，document 上挂一个统一的"点了菜单外面就关"监听器最省心
    body.querySelector('#be-fc-add-toggle').addEventListener('click', e => {
      e.stopPropagation();
      fcToggleDropdown('be-fc-add-menu');
    });
    body.querySelector('#be-fc-more-toggle').addEventListener('click', e => {
      e.stopPropagation();
      fcToggleDropdown('be-fc-more-menu');
    });
    mainDoc.addEventListener('click', fcOutsideDropdownClick);
    body.querySelectorAll('.be-fc-align-btn').forEach(btn => {
      btn.addEventListener('click', () => fcAlignSelected(btn.getAttribute('data-align')));
    });

    renderFcElements();
    fcInitInteract();
    fcSyncUndoButtons();

    const canvasEl = fcCanvasEl();
    canvasEl.addEventListener('pointerdown', fcCanvasPointerDown);
    canvasEl.addEventListener('dblclick', fcCanvasDblClick);
    canvasEl.addEventListener('focusout', fcCanvasFocusOut);
    mainDoc.addEventListener('pointermove', fcCanvasPointerMove);
    mainDoc.addEventListener('pointerup', fcCanvasPointerUp);
    mainDoc.addEventListener('keydown', fcHandleUndoRedoKey);
  }

  // ---- 工具条的"+"/"更多"下拉菜单 + 图层抽屉：统一开关逻辑，点菜单外任意位置全部收起 ----
  function fcToggleDropdown(id) {
    const el = mainDoc.getElementById(id);
    if (!el) return;
    const willOpen = !el.classList.contains('open');
    fcCloseAllDropdowns();
    if (willOpen) el.classList.add('open');
  }
  function fcCloseAllDropdowns() {
    ['be-fc-add-menu', 'be-fc-more-menu'].forEach(id => {
      const el = mainDoc.getElementById(id);
      if (el) el.classList.remove('open');
    });
  }
  function fcCloseLayersPanel() {
    const panel = mainDoc.getElementById('be-fc-layers');
    if (panel) panel.classList.remove('open');
  }
  // 用 composedPath() 而不是 e.target.closest()：点图层面板某一行会触发 fcSelect → renderFcLayersPanel
  // 把面板 innerHTML 整个重建，被点的那个行节点在事件冒泡过程中就已经被摘掉了（parentNode 变 null），
  // 这时候再用 closest() 网上找，孤立节点找不到 .be-fc-layers 祖先，会被误判成"点在面板外面"从而自己把自己关掉。
  // composedPath() 是事件派发那一刻就拍好的快照，不受后续 DOM 变动影响，才是稳的写法。
  function fcOutsideDropdownClick(e) {
    const path = (typeof e.composedPath === 'function') ? e.composedPath() : [e.target];
    const hasAncestor = (pred) => path.some(n => n && n.nodeType === 1 && pred(n));
    if (!hasAncestor(n => n.classList && n.classList.contains('be-fc-menu-wrap'))) fcCloseAllDropdowns();
    if (!hasAncestor(n => n.id === 'be-fc-layers' || n.id === 'be-fc-layers-toggle')) fcCloseLayersPanel();
  }

  // 编辑文字时 Ctrl+Z 应该走浏览器原生 contenteditable 的文字撤销，不能被画布级撤销抢走，
  // 所以 fcEditingId 有值（正在编辑文字）时直接放行不拦截
  function fcHandleUndoRedoKey(e) {
    if (fcView !== 'editor' || fcEditingId) return;
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
    e.preventDefault();
    if (e.shiftKey) fcRedo(); else fcUndo();
  }

  // 双击文字进入编辑（这期间该元素不可拖，靠 .be-fc-text-body[contenteditable=true] 的 pointer-events
  // 切换 + interact.js draggable 的 ignoreFrom 配合实现，不用手动打断拖拽手势）
  function fcCanvasDblClick(e) {
    // 未编辑态下 .be-fc-text-body 是 pointer-events:none，点击命中的其实是外层 .be-fc-el 包裹层，
    // 所以要从包裹层往下找文字子元素，不能用 closest() 往上找（文字层是子级，不是祖先）
    const wrap = e.target.closest('.be-fc-el');
    if (!wrap) return;
    const textEl = wrap.querySelector('.be-fc-text-body');
    if (!textEl) return;
    const id = wrap.getAttribute('data-id');
    const el = fcFindElement(id);
    if (!el || el.locked) return;
    fcPushUndo(); // 进入编辑前存一份快照：整个打字会话当一次撤销，不逐字记录
    fcEditingId = id;
    textEl.setAttribute('contenteditable', 'true');
    textEl.focus();
  }
  function fcCanvasFocusOut(e) {
    const textEl = e.target.closest && e.target.closest('.be-fc-text-body');
    if (!textEl || textEl.getAttribute('contenteditable') !== 'true') return;
    const wrap = textEl.closest('.be-fc-el');
    const id = wrap?.getAttribute('data-id');
    const el = fcFindElement(id);
    if (el) el.html = fcSanitizeHtml(textEl.innerHTML);
    textEl.setAttribute('contenteditable', 'false');
    fcEditingId = null;
    fcCommitElement();
  }
  // 富文本白名单净化：只留 b/i/u/s/span[style 里只允许 color/font-family]/p/br，防止贴入乱七八糟的标签
  function fcSanitizeHtml(html) {
    try {
      const tmp = mainDoc.createElement('div');
      tmp.innerHTML = html;
      const ALLOWED_TAGS = new Set(['B', 'I', 'U', 'S', 'SPAN', 'P', 'BR', 'STRONG', 'EM', 'STRIKE', 'UL', 'OL', 'LI', 'DIV', 'FONT']);
      const walk = (node) => {
        Array.from(node.childNodes).forEach(child => {
          if (child.nodeType === 1) {
            if (!ALLOWED_TAGS.has(child.tagName)) {
              // 不认识的标签：保留子内容，剥掉标签本身
              while (child.firstChild) node.insertBefore(child.firstChild, child);
              node.removeChild(child);
              return;
            }
            // 只保留 style 里的 color / font-family，丢掉别的（防止贴进来的富文本带一堆布局属性）
            const style = child.getAttribute('style') || '';
            const kept = [];
            const colorM = style.match(/color\s*:\s*[^;]+/i);
            const fontM = style.match(/font-family\s*:\s*[^;]+/i);
            if (colorM) kept.push(colorM[0]);
            if (fontM) kept.push(fontM[0]);
            // execCommand('foreColor') 在个别引擎下会退化成 <font color="..">（老式属性写法，不是 style），转成 style 保留下来
            const colorAttr = child.getAttribute('color');
            if (colorAttr && !colorM) kept.push(`color:${colorAttr}`);
            if (kept.length) child.setAttribute('style', kept.join(';'));
            else child.removeAttribute('style');
            ['class', 'id', 'onclick', 'onerror', 'color', 'face', 'size'].forEach(a => child.removeAttribute(a));
            walk(child);
          }
        });
      };
      walk(tmp);
      return tmp.innerHTML;
    } catch (e) { return escapeHtml(html); }
  }

  // ---- 属性面板：选中文字元素时出现，逐字样式（加粗/斜体/下划线/删除线/颜色）靠浏览器原生
  // execCommand 对当前选区包裹，段落级属性（字号/字体/行距/字距/对齐/高亮底色/描边）直接改数据。----
  function renderFcPropPanel() {
    const panel = mainDoc.getElementById('be-fc-proppanel');
    if (!panel) return;
    fcBindPanelUndoDelegation(panel);
    if (fcMultiSelected.length > 1) { panel.innerHTML = ''; panel.style.display = 'none'; return; } // 多选态只显示批量工具条，不显示单元素属性面板
    const el = fcSelected ? fcFindElement(fcSelected) : null;
    if (!el) { panel.innerHTML = ''; panel.style.display = 'none'; return; }
    panel.style.display = '';
    if (el.type === 'text') {
      panel.innerHTML = fcTextPropPanelHtml(el);
      bindFcTextPropPanel(panel, el);
    } else {
      panel.innerHTML = fcImagePropPanelHtml(el);
      bindFcImagePropPanel(panel, el);
    }
    bindFcCommonProp(panel, el);
  }

  // 属性面板里的滑块/数字框/颜色选择器这类"连续输入"控件（拖一下会连续触发一串 input 事件），
  // 撤销栈不能每个 input 事件都存一份快照（会瞬间灌爆 50 条上限，还导致撤销一次只退一丁点）。
  // 用捕获阶段监听（比控件自己的 input 监听器先跑一步）在一次"编辑会话"的第一个 input 事件时存一份
  // 快照，同个会话后续的 input 都跳过，直到 change 事件（松手/失焦/选择器关闭）标志会话结束。
  // 用 panel 容器一次性代理绑定（dataset 打标防止每次重渲染重复绑定），不用逐个控件手动加。
  let fcPanelUndoDirty = false;
  function fcBindPanelUndoDelegation(panel) {
    if (panel.dataset.undoBound) return;
    panel.dataset.undoBound = '1';
    panel.addEventListener('input', () => {
      if (!fcPanelUndoDirty) { fcPushUndo(); fcPanelUndoDirty = true; }
    }, true);
    panel.addEventListener('change', () => { fcPanelUndoDirty = false; }, true);
  }

  function fcTextPropPanelHtml(el) {
    const fontOptions = [
      `<option value="">跟随默认</option>`,
      ...Object.values(FONTS).map(v => `<option value="${escapeHtml(v.css)}" ${el.fontFamily===v.css?'selected':''}>${escapeHtml(v.name)}</option>`),
      ...(settings.customFonts||[]).map(f => `<option value="${escapeHtml(f.fontFamily||'')}" ${el.fontFamily===f.fontFamily?'selected':''}>${escapeHtml(f.name||'自定义')}</option>`)
    ].join('');
    const presets = [['','正文'],['quote','引用'],['h1','标题1'],['h2','标题2'],['ul','无序列表'],['ol','有序列表']];
    return `
      <div class="be-fc-prop-row">
        <button type="button" class="be-fc-prop-btn" data-fmt="bold" title="加粗"><b>B</b></button>
        <button type="button" class="be-fc-prop-btn" data-fmt="italic" title="斜体"><i>I</i></button>
        <button type="button" class="be-fc-prop-btn" data-fmt="underline" title="下划线"><u>U</u></button>
        <button type="button" class="be-fc-prop-btn" data-fmt="strikeThrough" title="删除线"><s>S</s></button>
        <span class="be-fc-prop-sep"></span>
        <button type="button" class="be-fc-prop-btn ${el.align==='left'?'active':''}" data-align="left">左</button>
        <button type="button" class="be-fc-prop-btn ${el.align==='center'?'active':''}" data-align="center">中</button>
        <button type="button" class="be-fc-prop-btn ${el.align==='right'?'active':''}" data-align="right">右</button>
        <span class="be-fc-prop-sep"></span>
        <button type="button" class="be-fc-prop-btn ${el.writingMode==='vertical-rl'?'active':''}" id="be-fc-writing-toggle" title="竖排文字">竖排</button>
      </div>
      <div class="be-fc-prop-row" style="font-size:10px;opacity:0.6;">
        <span>加粗/斜体/下划线/删除线/文字色：双击文字进入编辑、选中要改的那几个字，再点上面按钮——逐字生效，不是整个框一个样</span>
      </div>
      <div class="be-fc-prop-row">
        <label>颜色</label><input type="color" id="be-fc-color" value="${el.color||'#222222'}" title="选区颜色 / 默认字色">
        <button type="button" class="be-btn" id="be-fc-eyedropper" style="padding:3px 8px;font-size:11px;" title="从屏幕任意位置取色">🎨吸管</button>
        <label>字号</label><input type="number" id="be-fc-fontsize" min="8" max="120" value="${el.fontSize||18}" style="width:56px;">
        <label>字体</label><select id="be-fc-fontfamily">${fontOptions}</select>
      </div>
      <div class="be-fc-prop-row">
        <label>高亮底色</label><input type="color" id="be-fc-hlbg" value="${el.highlightBg&&el.highlightBg!=='transparent'?el.highlightBg:'#fff3a0'}">
        <button type="button" class="be-btn" id="be-fc-hlbg-clear" style="padding:3px 8px;font-size:11px;">清除高亮</button>
      </div>
      <div class="be-fc-prop-row">
        <label>行高</label><input type="range" id="be-fc-lh" min="1" max="2.6" step="0.05" value="${el.lineHeight||1.6}">
        <label>字距</label><input type="range" id="be-fc-ls" min="0" max="0.3" step="0.01" value="${el.letterSpacing||0}">
      </div>
      <div class="be-fc-prop-row">
        <label>段落</label>
        <div class="be-radio-group" id="be-fc-preset-group">
          ${presets.map(([k,name]) => `<button type="button" class="be-radio-opt ${el.paragraphPreset===k?'active':''}" data-p="${k}">${name}</button>`).join('')}
        </div>
      </div>
      <div class="be-fc-prop-row">
        <label class="be-toggle"><input type="checkbox" id="be-fc-stroke-on" ${el.textStroke?'checked':''}><span class="be-slider"></span></label>
        <label>描边</label>
        <input type="color" id="be-fc-stroke-color" value="${el.textStroke?el.textStroke.color:'#000000'}" ${el.textStroke?'':'disabled'}>
        <input type="number" id="be-fc-stroke-width" min="0.5" max="6" step="0.5" value="${el.textStroke?el.textStroke.width:1}" style="width:50px;" ${el.textStroke?'':'disabled'}>
      </div>
      ${fcCommonPropRowHtml(el)}
    `;
  }

  function fcRefreshSelectedNode() {
    // 段落级属性改完，不用整画布重建（会丢正在编辑的焦点），只更新当前这一个节点的行内样式
    const el = fcFindElement(fcSelected);
    if (!el) return;
    const node = mainDoc.getElementById('fc-el-' + el.id);
    const textEl = node?.querySelector('.be-fc-text-body');
    if (!textEl) return;
    textEl.style.fontSize = (el.fontSize||18) + 'px';
    textEl.style.fontFamily = el.fontFamily ? el.fontFamily.replace(/"/g,"'") : 'inherit';
    textEl.style.lineHeight = el.lineHeight || 1.6;
    textEl.style.letterSpacing = (el.letterSpacing||0) + 'em';
    textEl.style.textAlign = el.align || 'left';
    textEl.style.color = el.color || '#222222';
    textEl.style.background = el.highlightBg || 'transparent';
    textEl.style.webkitTextStroke = el.textStroke ? `${el.textStroke.width||1}px ${el.textStroke.color||'#000'}` : '';
    textEl.style.fontWeight = (el.paragraphPreset === 'h1' || el.paragraphPreset === 'h2') ? '700' : '';
    textEl.style.writingMode = el.writingMode === 'vertical-rl' ? 'vertical-rl' : 'horizontal-tb';
  }

  function bindFcTextPropPanel(panel, el) {
    // 点面板上的按钮（非 input/select）时不能让 contenteditable 失焦——失焦会清掉当前选区/退出编辑态，
    // 格式化按钮就再也找不到要作用于哪段文字了。inputs/select 保留原生焦点行为，不然颜色/下拉选不了。
    panel.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('mousedown', e => e.preventDefault());
    });
    const ensureEditing = () => {
      if (fcEditingId !== el.id) {
        toast('先双击文字进入编辑，选中要改的文字再点格式按钮', 'info');
        return false;
      }
      return true;
    };
    panel.querySelectorAll('[data-fmt]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!ensureEditing()) return;
        fcPushUndo();
        try { mainDoc.execCommand('styleWithCSS', false, true); } catch (e) {}
        try { mainDoc.execCommand(btn.getAttribute('data-fmt')); } catch (e) {}
      });
    });
    panel.querySelector('#be-fc-color')?.addEventListener('input', e => {
      const cur = fcFindElement(fcSelected);
      if (!cur) return;
      if (fcEditingId === el.id) {
        try {
          mainDoc.execCommand('styleWithCSS', false, true);
          const sel = mainWin.getSelection();
          if (sel && !sel.isCollapsed) { mainDoc.execCommand('foreColor', false, e.target.value); return; }
        } catch (err) {}
      }
      cur.color = e.target.value;
      fcRefreshSelectedNode();
      fcCommitElement();
    });
    panel.querySelectorAll('[data-align]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cur = fcFindElement(fcSelected);
        if (!cur) return;
        fcPushUndo();
        cur.align = btn.getAttribute('data-align');
        panel.querySelectorAll('[data-align]').forEach(b => b.classList.toggle('active', b === btn));
        fcRefreshSelectedNode();
        fcCommitElement();
      });
    });
    panel.querySelector('#be-fc-writing-toggle')?.addEventListener('click', () => {
      const cur = fcFindElement(fcSelected);
      if (!cur) return;
      fcPushUndo();
      cur.writingMode = cur.writingMode === 'vertical-rl' ? 'horizontal-tb' : 'vertical-rl';
      renderFcPropPanel();
      fcRefreshSelectedNode();
      fcCommitElement();
    });
    panel.querySelector('#be-fc-eyedropper')?.addEventListener('click', () => fcPickColorForText(el));
    panel.querySelector('#be-fc-fontsize')?.addEventListener('input', e => {
      const cur = fcFindElement(fcSelected);
      if (!cur) return;
      cur.fontSize = Math.max(8, Math.min(120, Number(e.target.value) || 18));
      fcRefreshSelectedNode();
      fcCommitElement();
    });
    panel.querySelector('#be-fc-fontfamily')?.addEventListener('change', e => {
      const cur = fcFindElement(fcSelected);
      if (!cur) return;
      cur.fontFamily = e.target.value;
      fcRefreshSelectedNode();
      fcCommitElement();
    });
    panel.querySelector('#be-fc-hlbg')?.addEventListener('input', e => {
      const cur = fcFindElement(fcSelected);
      if (!cur) return;
      cur.highlightBg = e.target.value;
      fcRefreshSelectedNode();
      fcCommitElement();
    });
    panel.querySelector('#be-fc-hlbg-clear')?.addEventListener('click', () => {
      const cur = fcFindElement(fcSelected);
      if (!cur) return;
      fcPushUndo();
      cur.highlightBg = '';
      fcRefreshSelectedNode();
      fcCommitElement();
    });
    panel.querySelector('#be-fc-lh')?.addEventListener('input', e => {
      const cur = fcFindElement(fcSelected);
      if (!cur) return;
      cur.lineHeight = Number(e.target.value);
      fcRefreshSelectedNode();
      fcCommitElement();
    });
    panel.querySelector('#be-fc-ls')?.addEventListener('input', e => {
      const cur = fcFindElement(fcSelected);
      if (!cur) return;
      cur.letterSpacing = Number(e.target.value);
      fcRefreshSelectedNode();
      fcCommitElement();
    });
    panel.querySelectorAll('#be-fc-preset-group .be-radio-opt').forEach(btn => {
      btn.addEventListener('click', () => fcApplyParagraphPreset(btn.getAttribute('data-p')));
    });
    panel.querySelector('#be-fc-stroke-on')?.addEventListener('change', e => {
      const cur = fcFindElement(fcSelected);
      if (!cur) return;
      cur.textStroke = e.target.checked ? { color: '#000000', width: 1 } : null;
      renderFcPropPanel();
      fcRefreshSelectedNode();
      fcCommitElement();
    });
    panel.querySelector('#be-fc-stroke-color')?.addEventListener('input', e => {
      const cur = fcFindElement(fcSelected);
      if (!cur || !cur.textStroke) return;
      cur.textStroke.color = e.target.value;
      fcRefreshSelectedNode();
      fcCommitElement();
    });
    panel.querySelector('#be-fc-stroke-width')?.addEventListener('input', e => {
      const cur = fcFindElement(fcSelected);
      if (!cur || !cur.textStroke) return;
      cur.textStroke.width = Number(e.target.value) || 1;
      fcRefreshSelectedNode();
      fcCommitElement();
    });
  }

  // 段落预设：引用块用真实引号文本节点（不是 CSS 伪元素）；列表用真实 ul/ol/li 但符号手写成字面字符
  // （不依赖浏览器原生 ::marker 渲染，跟伪元素同理，html2canvas 支持不可靠）；标题只是字号/字重预设。
  function fcApplyParagraphPreset(preset) {
    const el = fcFindElement(fcSelected);
    if (!el || el.type !== 'text') return;
    fcPushUndo();
    const node = mainDoc.getElementById('fc-el-' + el.id);
    const textEl = node?.querySelector('.be-fc-text-body');
    const currentHtml = textEl ? textEl.innerHTML : (el.html || '');
    el.paragraphPreset = preset;
    if (preset === 'h1') el.fontSize = Math.max(el.fontSize || 18, 32);
    else if (preset === 'h2') el.fontSize = Math.max(el.fontSize || 18, 24);
    if (preset === 'quote') {
      el.html = `“${currentHtml}”`;
    } else if (preset === 'ul' || preset === 'ol') {
      const plain = (textEl ? textEl.innerText : currentHtml.replace(/<[^>]+>/g, '')) || '';
      let lines = plain.split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) lines = [''];
      const tag = preset === 'ul' ? 'ul' : 'ol';
      el.html = `<${tag} style="list-style:none;margin:0;padding:0;">` +
        lines.map((line, i) => `<li>${preset === 'ul' ? '• ' : (i + 1) + '. '}${escapeHtml(line)}</li>`).join('') +
        `</${tag}>`;
    }
    fcCommitElement();
    renderFcElements();
    renderFcPropPanel();
  }

  const FC_IMG_FILTERS = [
    ['', '原图'],
    ['grayscale(1)', '黑白'],
    ['sepia(0.6) contrast(1.05)', '复古'],
    ['contrast(1.3) saturate(1.2)', '高对比']
  ];
  const FC_IMG_MASKS = [['', '无'], ['circle', '圆形'], ['rounded', '圆角']];

  function fcImagePropPanelHtml(el) {
    return `
      <div class="be-fc-prop-row">
        <button type="button" class="be-btn" id="be-fc-img-recrop" style="padding:4px 10px;font-size:12px;">重新裁剪</button>
        <button type="button" class="be-btn" id="be-fc-img-reset" style="padding:4px 10px;font-size:12px;">重置为原图</button>
      </div>
      <div class="be-fc-prop-row">
        <label>边框</label>
        <input type="number" id="be-fc-img-border-w" min="0" max="20" value="${el.border?el.border.width:0}" style="width:50px;">
        <input type="color" id="be-fc-img-border-c" value="${el.border?el.border.color:'#ffffff'}">
      </div>
      <div class="be-fc-prop-row">
        <label>滤镜</label>
        <div class="be-radio-group" id="be-fc-img-filter-group">
          ${FC_IMG_FILTERS.map(([v,name]) => `<button type="button" class="be-radio-opt ${((el.filter||'')===v)?'active':''}" data-f="${escapeHtml(v)}">${name}</button>`).join('')}
        </div>
      </div>
      <div class="be-fc-prop-row">
        <label>遮罩</label>
        <div class="be-radio-group" id="be-fc-img-mask-group">
          ${FC_IMG_MASKS.map(([v,name]) => `<button type="button" class="be-radio-opt ${((el.maskShape||'')===v)?'active':''}" data-m="${escapeHtml(v)}">${name}</button>`).join('')}
        </div>
      </div>
      <div class="be-fc-prop-row" style="font-size:10px;opacity:0.6;">
        <span>滤镜/遮罩会直接把效果画进图片本身（不是实时 CSS 特效），预览和导出永远长一个样</span>
      </div>
      ${fcCommonPropRowHtml(el)}
    `;
  }

  // ---- 两类元素共用的控件：复制/粘贴样式（格式刷）、锁定、透明度。拼进各自面板模板末尾，
  // 由 renderFcPropPanel 在类型专属的 bind 函数跑完后统一绑定一次。----
  let fcStyleClipboard = null; // { type: 'text'|'image', style: {...} }，只能同类型粘贴
  function fcCommonPropRowHtml(el) {
    const canPaste = fcStyleClipboard && fcStyleClipboard.type === el.type;
    return `
      <div class="be-fc-prop-sep-row"></div>
      <div class="be-fc-prop-row">
        <button type="button" class="be-btn" id="be-fc-copy-style" style="padding:3px 8px;font-size:11px;" title="复制这个元素的样式（不含内容）">复制样式</button>
        <button type="button" class="be-btn" id="be-fc-paste-style" style="padding:3px 8px;font-size:11px;" ${canPaste ? '' : 'disabled'} title="把复制的样式应用到当前选中元素">粘贴样式</button>
        <button type="button" class="be-btn ${el.locked?'active':''}" id="be-fc-lock-toggle" style="padding:3px 8px;font-size:11px;">${el.locked ? '🔒 已锁定' : '🔓 锁定'}</button>
      </div>
      <div class="be-fc-prop-row">
        <label>透明度</label>
        <input type="range" id="be-fc-opacity" min="0.1" max="1" step="0.05" value="${el.opacity==null?1:el.opacity}">
      </div>
    `;
  }
  function bindFcCommonProp(panel, el) {
    panel.querySelector('#be-fc-copy-style')?.addEventListener('click', () => fcCopyStyle(el));
    panel.querySelector('#be-fc-paste-style')?.addEventListener('click', () => fcPasteStyle(el));
    panel.querySelector('#be-fc-lock-toggle')?.addEventListener('click', () => {
      fcPushUndo();
      el.locked = !el.locked;
      fcCommitElement();
      renderFcElements();
      renderFcPropPanel();
    });
    panel.querySelector('#be-fc-opacity')?.addEventListener('input', e => {
      el.opacity = Number(e.target.value);
      const node = mainDoc.getElementById('fc-el-' + el.id);
      if (node) node.style.opacity = el.opacity;
      fcCommitElement();
    });
  }
  function fcCopyStyle(el) {
    if (el.type === 'text') {
      fcStyleClipboard = {
        type: 'text',
        style: {
          fontSize: el.fontSize, fontFamily: el.fontFamily, color: el.color, align: el.align,
          lineHeight: el.lineHeight, letterSpacing: el.letterSpacing, highlightBg: el.highlightBg,
          textStroke: el.textStroke ? { ...el.textStroke } : null,
          writingMode: el.writingMode || 'horizontal-tb'
        }
      };
    } else {
      fcStyleClipboard = {
        type: 'image',
        style: { border: el.border ? { ...el.border } : null, filter: el.filter || '', maskShape: el.maskShape || '' }
      };
    }
    toast('已复制样式', 'success');
    renderFcPropPanel();
  }
  function fcPasteStyle(el) {
    if (!fcStyleClipboard || fcStyleClipboard.type !== el.type) return;
    fcPushUndo();
    if (el.type === 'text') {
      Object.assign(el, fcStyleClipboard.style);
      el.textStroke = fcStyleClipboard.style.textStroke ? { ...fcStyleClipboard.style.textStroke } : null;
      fcCommitElement();
      renderFcElements();
      renderFcPropPanel();
    } else {
      el.border = fcStyleClipboard.style.border ? { ...fcStyleClipboard.style.border } : null;
      el.filter = fcStyleClipboard.style.filter;
      el.maskShape = fcStyleClipboard.style.maskShape;
      fcBakeImageEffects(el); // 滤镜/遮罩要重新烧录到目标图片自己的像素上，fcBakeImageEffects 内部已经会 commit+重渲染
    }
    toast('已应用样式', 'success');
  }

  // ---- 吸管取色：优先用系统级 EyeDropper（能吸屏幕任意位置），不支持的浏览器降级成
  // "点一下画布上的某个位置采样那一点颜色"（对着画布截一张位图，点击换算成位图坐标读像素）----
  async function fcPickColorForText(el) {
    // 记住目标元素 id，别在回调里现读 fcSelected——取色降级路径要点一下画布，
    // 那一下点击会先经过 fcCanvasPointerDown/Up 的"点空白处取消选中"逻辑（pointerup 比 click 先触发），
    // 等我们的取色回调跑起来时 fcSelected 早就被清空了，踩过这个坑。
    const targetId = el.id;
    const applyColor = (cur, hex) => {
      fcPushUndo();
      cur.color = hex;
      fcSelected = targetId; // 取色期间选中态可能被上面说的那套逻辑清空，这里找补回来，面板才能正确刷新回这个元素
      fcSyncSelectionUI();
      fcRefreshSelectedNode();
      fcCommitElement();
      renderFcPropPanel();
    };
    if (mainWin.EyeDropper) {
      try {
        const ed = new mainWin.EyeDropper();
        const result = await ed.open();
        const cur = fcFindElement(targetId);
        if (!cur || !result || !result.sRGBHex) return;
        applyColor(cur, result.sRGBHex);
      } catch (e) { /* 用户按 Esc 取消，静默即可 */ }
      return;
    }
    toast('当前浏览器不支持系统取色器，改成点一下画布上想要的颜色来取色', 'info');
    fcArmCanvasColorSample(hex => {
      const cur = fcFindElement(targetId);
      if (!cur) return;
      applyColor(cur, hex);
    });
  }
  function fcArmCanvasColorSample(callback) {
    const canvasEl = fcCanvasEl();
    if (!canvasEl) return;
    loadH2C().then(h2c => h2c(canvasEl, { backgroundColor: null, scale: 1, useCORS: true, allowTaint: true, logging: false }))
      .then(bitmap => {
        const handler = (e) => {
          canvasEl.removeEventListener('click', handler, true);
          const rect = canvasEl.getBoundingClientRect();
          const bx = Math.min(bitmap.width - 1, Math.max(0, Math.round((e.clientX - rect.left) / rect.width * bitmap.width)));
          const by = Math.min(bitmap.height - 1, Math.max(0, Math.round((e.clientY - rect.top) / rect.height * bitmap.height)));
          try {
            const data = bitmap.getContext('2d').getImageData(bx, by, 1, 1).data;
            const hex = '#' + [data[0], data[1], data[2]].map(v => v.toString(16).padStart(2, '0')).join('');
            callback(hex);
          } catch (err) { toast('取色采样失败', 'error'); }
        };
        canvasEl.addEventListener('click', handler, true);
      })
      .catch(() => toast('取色采样失败', 'error'));
  }

  function fcRefreshSelectedImageNode() {
    const el = fcFindElement(fcSelected);
    if (!el) return;
    const node = mainDoc.getElementById('fc-el-' + el.id);
    const imgNode = node?.querySelector('.be-fc-el-img');
    if (!imgNode) return;
    imgNode.style.border = el.border ? `${el.border.width}px solid ${el.border.color}` : 'none';
    imgNode.style.boxSizing = 'border-box';
  }

  function bindFcImagePropPanel(panel, el) {
    panel.querySelectorAll('button').forEach(btn => btn.addEventListener('mousedown', e => e.preventDefault()));
    panel.querySelector('#be-fc-img-recrop')?.addEventListener('click', () => {
      const cur = fcFindElement(fcSelected);
      if (!cur) return;
      const img = new Image();
      img.onload = () => openFcCropDialog(img, { mode: 'recrop', elId: cur.id });
      img.onerror = () => toast('原图加载失败，无法重新裁剪', 'error');
      img.src = cur.originalSrc;
    });
    panel.querySelector('#be-fc-img-reset')?.addEventListener('click', () => {
      const cur = fcFindElement(fcSelected);
      if (!cur) return;
      fcPushUndo();
      cur.src = cur.originalSrc;
      cur.filter = '';
      cur.maskShape = '';
      fcCommitElement();
      renderFcElements();
      renderFcPropPanel();
    });
    panel.querySelector('#be-fc-img-border-w')?.addEventListener('input', e => {
      const cur = fcFindElement(fcSelected);
      if (!cur) return;
      const width = Math.max(0, Math.min(20, Number(e.target.value) || 0));
      if (width <= 0) cur.border = null;
      else cur.border = { width, color: (cur.border && cur.border.color) || '#ffffff' };
      fcRefreshSelectedImageNode();
      fcCommitElement();
    });
    panel.querySelector('#be-fc-img-border-c')?.addEventListener('input', e => {
      const cur = fcFindElement(fcSelected);
      if (!cur) return;
      if (!cur.border) cur.border = { width: 4, color: e.target.value };
      else cur.border.color = e.target.value;
      fcRefreshSelectedImageNode();
      fcCommitElement();
    });
    panel.querySelectorAll('#be-fc-img-filter-group .be-radio-opt').forEach(btn => {
      btn.addEventListener('click', () => fcApplyImageFilter(btn.getAttribute('data-f')));
    });
    panel.querySelectorAll('#be-fc-img-mask-group .be-radio-opt').forEach(btn => {
      btn.addEventListener('click', () => fcApplyImageMask(btn.getAttribute('data-m')));
    });
  }

  function fcApplyImageFilter(filterCss) {
    const el = fcFindElement(fcSelected);
    if (!el || el.type !== 'image') return;
    fcPushUndo();
    el.filter = filterCss;
    fcBakeImageEffects(el);
  }
  function fcApplyImageMask(maskShape) {
    const el = fcFindElement(fcSelected);
    if (!el || el.type !== 'image') return;
    fcPushUndo();
    el.maskShape = maskShape;
    fcBakeImageEffects(el);
  }
  function fcRoundedRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // 滤镜/遮罩不做成实时 CSS 效果，而是在"应用"这一步用离屏 canvas 把效果真正画成新位图替换 src——
  // html2canvas 对 CSS filter/mask-image 支持不可靠（project_html2canvas_export_limits 的教训），
  // 烧录成静态图之后预览和导出看到的是同一张图，不存在"预览好看导出走样"的问题。
  function fcBakeImageEffects(el) {
    const img = new Image();
    img.onerror = () => toast('图片效果处理失败', 'error');
    img.onload = () => {
      try {
        const off = mainDoc.createElement('canvas');
        off.width = img.naturalWidth || 1;
        off.height = img.naturalHeight || 1;
        const ctx = off.getContext('2d');
        const hasMask = !!el.maskShape;
        if (el.maskShape === 'circle') {
          ctx.save();
          ctx.beginPath();
          const r = Math.min(off.width, off.height) / 2;
          ctx.arc(off.width / 2, off.height / 2, r, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
        } else if (el.maskShape === 'rounded') {
          ctx.save();
          const rad = Math.min(off.width, off.height) * 0.12;
          fcRoundedRectPath(ctx, 0, 0, off.width, off.height, rad);
          ctx.clip();
        }
        if (el.filter) ctx.filter = el.filter;
        ctx.drawImage(img, 0, 0);
        if (hasMask) ctx.restore();
        el.src = fcCanvasToCompressedUrl(off, { png: hasMask });
        fcCommitElement();
        renderFcElements();
        renderFcPropPanel();
      } catch (e) {
        toast('图片效果处理失败：' + (e?.message || e), 'error');
      }
    };
    img.src = el.originalSrc;
  }

  function fcElementHtml(el) {
    const common = `id="fc-el-${el.id}" class="be-fc-el be-fc-el-${el.type} ${el.id===fcSelected?'selected':''} ${el.locked?'locked':''}" data-id="${el.id}"
      style="left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;transform:rotate(${el.rotate||0}deg);z-index:${el.z||0};opacity:${el.opacity==null?1:el.opacity};"`;
    const handles = `
      <div class="be-fc-handle be-fc-handle-nw" data-h="nw"></div>
      <div class="be-fc-handle be-fc-handle-ne" data-h="ne"></div>
      <div class="be-fc-handle be-fc-handle-sw" data-h="sw"></div>
      <div class="be-fc-handle be-fc-handle-se" data-h="se"></div>
      <div class="be-fc-handle be-fc-handle-rotate" data-h="rotate"></div>
    `;
    if (el.type === 'text') {
      const editable = el.id === fcEditingId;
      const strokeCss = el.textStroke ? `-webkit-text-stroke:${el.textStroke.width||1}px ${el.textStroke.color||'#000'};` : '';
      const weightCss = el.paragraphPreset === 'h1' || el.paragraphPreset === 'h2' ? 'font-weight:700;' : '';
      const writingCss = el.writingMode === 'vertical-rl' ? 'writing-mode:vertical-rl;' : '';
      return `<div ${common}>
        <div class="be-fc-text-body" contenteditable="${editable ? 'true' : 'false'}" style="font-size:${el.fontSize||18}px;font-family:${el.fontFamily?el.fontFamily.replace(/"/g,"'"):'inherit'};line-height:${el.lineHeight||1.6};letter-spacing:${el.letterSpacing||0}em;text-align:${el.align||'left'};color:${el.color||'#222222'};background:${el.highlightBg||'transparent'};${strokeCss}${weightCss}${writingCss}">${el.html || '双击编辑文字'}</div>
        ${handles}
      </div>`;
    }
    if (el.type === 'image') {
      const borderCss = el.border ? `border:${el.border.width}px solid ${el.border.color};box-sizing:border-box;` : '';
      return `<div ${common}>
        <img class="be-fc-el-img" src="${el.src||''}" draggable="false" alt="" style="${borderCss}">
        ${handles}
      </div>`;
    }
    return '';
  }

  function renderFcElements() {
    const canvas = fcGetCanvas();
    const canvasEl = fcCanvasEl();
    if (!canvas || !canvasEl) return;
    const emptyHint = canvas.elements.length ? '' :
      `<div class="be-fc-empty-hint">点左上角 <b>+</b> 号<br>添加文字或图片</div>`;
    canvasEl.innerHTML = emptyHint + canvas.elements.slice().sort((a, b) => (a.z||0) - (b.z||0)).map(fcElementHtml).join('');
    fcSyncSelectionUI();
  }

  // 单选/多选状态变化后要同步的三处 UI：画布元素的 .selected 高亮、删除按钮可用性、多选工具条显隐、图层面板
  function fcSyncSelectionUI() {
    const canvasEl = fcCanvasEl();
    const selSet = fcMultiSelected.length > 1 ? new Set(fcMultiSelected) : new Set(fcSelected ? [fcSelected] : []);
    if (canvasEl) {
      canvasEl.querySelectorAll('.be-fc-el').forEach(n => n.classList.toggle('selected', selSet.has(n.getAttribute('data-id'))));
    }
    const delBtn = mainDoc.getElementById('be-fc-del-selected');
    if (delBtn) delBtn.disabled = selSet.size === 0;
    const multibar = mainDoc.getElementById('be-fc-multibar');
    if (multibar) {
      const active = fcMultiSelected.length > 1;
      multibar.style.display = active ? 'flex' : 'none';
      if (active) {
        const countEl = mainDoc.getElementById('be-fc-multibar-count');
        if (countEl) countEl.textContent = `已选中 ${fcMultiSelected.length} 个`;
      }
    }
    renderFcLayersPanel();
  }

  // shift+点选：累加/移除到多选集合；集合缩到 <=1 个元素时自动退回单选态
  function fcToggleMultiSelect(id) {
    const idx = fcMultiSelected.indexOf(id);
    if (idx >= 0) {
      fcMultiSelected.splice(idx, 1);
    } else {
      if (fcMultiSelected.length === 0 && fcSelected && fcSelected !== id) fcMultiSelected.push(fcSelected);
      fcMultiSelected.push(id);
    }
    if (fcMultiSelected.length <= 1) {
      fcSelected = fcMultiSelected[0] || null;
      fcMultiSelected = [];
    } else {
      fcSelected = null;
    }
    fcSyncSelectionUI();
    renderFcPropPanel();
  }

  // 对齐基准是选中集合自身的包围盒（不是画布），跟用户描述的"批量对齐"一致
  function fcAlignSelected(mode) {
    if (fcMultiSelected.length < 2) return;
    const els = fcMultiSelected.map(fcFindElement).filter(Boolean);
    if (els.length < 2) return;
    fcPushUndo();
    const minX = Math.min(...els.map(e => e.x));
    const maxX = Math.max(...els.map(e => e.x + e.w));
    const minY = Math.min(...els.map(e => e.y));
    const maxY = Math.max(...els.map(e => e.y + e.h));
    els.forEach(e => {
      if (e.locked) return;
      if (mode === 'left') e.x = minX;
      else if (mode === 'right') e.x = maxX - e.w;
      else if (mode === 'hcenter') e.x = Math.round(minX + (maxX - minX - e.w) / 2);
      else if (mode === 'top') e.y = minY;
      else if (mode === 'bottom') e.y = maxY - e.h;
      else if (mode === 'vcenter') e.y = Math.round(minY + (maxY - minY - e.h) / 2);
      const node = mainDoc.getElementById('fc-el-' + e.id);
      if (node) { node.style.left = e.x + 'px'; node.style.top = e.y + 'px'; }
    });
    fcCommitElement();
  }

  // ---- 图层面板：按 z 倒序（顶层在前）列出元素，点击选中，拖拽行调整层级，独立的锁定开关 ----
  function renderFcLayersPanel() {
    const panel = mainDoc.getElementById('be-fc-layers');
    if (!panel) return;
    const canvas = fcGetCanvas();
    if (!canvas) { panel.innerHTML = ''; return; }
    const sorted = canvas.elements.slice().sort((a, b) => (b.z || 0) - (a.z || 0));
    const selSet = fcMultiSelected.length > 1 ? new Set(fcMultiSelected) : new Set(fcSelected ? [fcSelected] : []);
    panel.innerHTML = sorted.length ? sorted.map(el => {
      const icon = el.type === 'text' ? '📝' : '🖼️';
      let preview;
      if (el.type === 'text') {
        const tmp = mainDoc.createElement('div');
        tmp.innerHTML = el.html || '';
        const text = (tmp.textContent || '').trim() || '(空文字)';
        preview = `<span class="be-fc-layer-name">${escapeHtml(text.slice(0, 12))}</span>`;
      } else {
        preview = `<img class="be-fc-layer-thumb" src="${el.src || ''}" alt="">`;
      }
      return `
        <div class="be-fc-layer-row ${selSet.has(el.id) ? 'selected' : ''}" draggable="true" data-id="${el.id}">
          <span class="be-fc-layer-icon">${icon}</span>
          ${preview}
          <button type="button" class="be-fc-layer-lock ${el.locked ? 'active' : ''}" data-id="${el.id}" title="锁定/解锁">${el.locked ? '🔒' : '🔓'}</button>
        </div>
      `;
    }).join('') : `<div class="be-empty" style="padding:12px;font-size:12px;">还没有元素</div>`;

    panel.querySelectorAll('.be-fc-layer-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.be-fc-layer-lock')) return;
        fcSelect(row.getAttribute('data-id'));
      });
      row.addEventListener('dragstart', () => { fcLayerDragId = row.getAttribute('data-id'); });
      row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('dragover'); });
      row.addEventListener('dragleave', () => row.classList.remove('dragover'));
      row.addEventListener('drop', e => {
        e.preventDefault();
        row.classList.remove('dragover');
        const targetId = row.getAttribute('data-id');
        if (!fcLayerDragId || fcLayerDragId === targetId) return;
        fcReorderLayer(fcLayerDragId, targetId, e);
        fcLayerDragId = null;
      });
    });
    panel.querySelectorAll('.be-fc-layer-lock').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const el = fcFindElement(btn.getAttribute('data-id'));
        if (!el) return;
        fcPushUndo();
        el.locked = !el.locked;
        fcCommitElement();
        renderFcElements();
      });
    });
  }

  function fcReorderLayer(dragId, targetId, e) {
    const canvas = fcGetCanvas();
    if (!canvas) return;
    const sorted = canvas.elements.slice().sort((a, b) => (b.z || 0) - (a.z || 0)); // 显示顺序：顶层在前
    const fromIdx = sorted.findIndex(el => el.id === dragId);
    if (fromIdx < 0) return;
    fcPushUndo();
    const [moved] = sorted.splice(fromIdx, 1);
    const rowEl = mainDoc.querySelector(`.be-fc-layer-row[data-id="${targetId}"]`);
    let insertBefore = true;
    if (rowEl && e) {
      const rect = rowEl.getBoundingClientRect();
      insertBefore = (e.clientY - rect.top) < rect.height / 2;
    }
    const toIdx = sorted.findIndex(el => el.id === targetId);
    if (toIdx < 0) return;
    sorted.splice(insertBefore ? toIdx : toIdx + 1, 0, moved);
    // 按显示顺序重新分配 z：列表最后一项（最底层）z=1，第一项（最顶层）z 最大
    sorted.forEach((el, idx) => { el.z = sorted.length - idx; });
    fcCommitElement();
    renderFcElements();
  }

  function fcAddTextElement() {
    const canvas = fcGetCanvas();
    if (!canvas) return;
    fcPushUndo();
    const el = {
      id: fcNewElId(), type: 'text', x: Math.round(canvas.width/2 - 100), y: Math.round(canvas.height/2 - 30),
      w: 200, h: 60, rotate: 0, z: fcMaxZ() + 1,
      html: '双击编辑文字', fontSize: 18, fontFamily: '', lineHeight: 1.6, letterSpacing: 0, align: 'left',
      color: '#222222', highlightBg: '', opacity: 1, locked: false,
      paragraphPreset: '', textStroke: null,  // textStroke: null 或 { color, width }
      writingMode: 'horizontal-tb'
    };
    canvas.elements.push(el);
    fcSelected = el.id;
    fcCommitElement();
    renderFcElements();
    renderFcPropPanel();
  }

  function fcDeleteSelected() {
    const canvas = fcGetCanvas();
    if (!canvas) return;
    const ids = fcMultiSelected.length > 1 ? fcMultiSelected.slice() : (fcSelected ? [fcSelected] : []);
    if (!ids.length) return;
    fcPushUndo();
    canvas.elements = canvas.elements.filter(e => !ids.includes(e.id));
    fcSelected = null;
    fcMultiSelected = [];
    fcCommitElement();
    renderFcElements();
    renderFcPropPanel();
  }

  // ---------- 图片：上传/裁剪/裂图/效果 ----------
  function fcFileToImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('请选择图片文件')); return; }
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('读取文件失败'));
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('图片解码失败'));
        img.onload = () => resolve(img);
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function fcCanvasToCompressedUrl(canvas, opts = {}) {
    return opts.png ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
  }

  function fcAddImageElement() {
    const inp = mainDoc.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.addEventListener('change', async ev => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      try {
        const img = await fcFileToImage(f);
        openFcCropDialog(img, { mode: 'new' });
      } catch (e) {
        toast('图片读取失败：' + (e?.message || e), 'error');
      }
    });
    inp.click();
  }

  let _fcCropper = null;
  function openFcCropDialog(img, opts) {
    loadCropperAssets().then(CropperLib => {
      const MASK_ID = 'be-fc-crop-mask';
      let mask = mainDoc.getElementById(MASK_ID);
      if (!mask) {
        mask = mainDoc.createElement('div');
        mask.id = MASK_ID;
        mask.className = 'be-import-tpl-mask';
        mask.innerHTML = `
          <div class="be-import-tpl-box">
            <div class="be-src-title">裁剪图片</div>
            <div class="be-fc-crop-area"><img id="be-fc-crop-img" alt=""></div>
            <div class="be-src-field">
              <label>比例</label>
              <div class="be-radio-group" id="be-fc-crop-aspect-group">
                <button type="button" class="be-radio-opt active" data-a="0">自由</button>
                <button type="button" class="be-radio-opt" data-a="1">1:1</button>
                <button type="button" class="be-radio-opt" data-a="${4 / 3}">4:3</button>
                <button type="button" class="be-radio-opt" data-a="${16 / 9}">16:9</button>
              </div>
            </div>
            <div class="be-src-actions">
              <button class="be-btn" id="be-fc-crop-cancel">取消</button>
              <button class="be-btn primary" id="be-fc-crop-confirm">确定</button>
            </div>
          </div>
        `;
        mainDoc.body.appendChild(mask);
        mask.addEventListener('click', e => { if (e.target === mask) fcCloseCropDialog(); });
      } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
        mainDoc.body.appendChild(mask);
      }
      detectAndApplyTheme();
      mask.classList.add('open');

      const imgEl = mask.querySelector('#be-fc-crop-img');
      const initCropper = () => {
        if (_fcCropper) { _fcCropper.destroy(); _fcCropper = null; }
        _fcCropper = new CropperLib(imgEl, { viewMode: 1, autoCropArea: 0.9, background: false });
      };
      imgEl.onload = initCropper;
      imgEl.src = img.src;

      const reNew = (sel, fn) => {
        const el = mask.querySelector(sel);
        const clone = el.cloneNode(true);
        el.parentNode.replaceChild(clone, el);
        clone.addEventListener('click', fn);
        return clone;
      };
      const oldGroup = mask.querySelector('#be-fc-crop-aspect-group');
      const group = oldGroup.cloneNode(true);
      oldGroup.parentNode.replaceChild(group, oldGroup);
      group.querySelectorAll('.be-radio-opt').forEach((b, i) => b.classList.toggle('active', i === 0));
      group.querySelectorAll('.be-radio-opt').forEach(btn => {
        btn.addEventListener('click', () => {
          group.querySelectorAll('.be-radio-opt').forEach(b => b.classList.toggle('active', b === btn));
          const a = Number(btn.getAttribute('data-a'));
          if (_fcCropper) _fcCropper.setAspectRatio(a || NaN);
        });
      });
      reNew('#be-fc-crop-cancel', fcCloseCropDialog);
      reNew('#be-fc-crop-confirm', () => {
        if (!_fcCropper) return;
        try {
          const outCanvas = _fcCropper.getCroppedCanvas({ maxWidth: 1600, maxHeight: 1600 });
          if (!outCanvas) { toast('裁剪失败', 'error'); return; }
          const aspect = outCanvas.width / outCanvas.height;
          const dataUrl = fcCanvasToCompressedUrl(outCanvas, {});
          fcCloseCropDialog();
          fcCommitCroppedImage(dataUrl, aspect, opts);
        } catch (e) {
          toast('裁剪失败：' + (e?.message || e), 'error');
        }
      });
    }).catch(e => toast('裁剪组件加载失败：' + (e?.message || e), 'error'));
  }

  function fcCloseCropDialog() {
    const mask = mainDoc.getElementById('be-fc-crop-mask');
    if (mask) mask.classList.remove('open');
    if (_fcCropper) { _fcCropper.destroy(); _fcCropper = null; }
  }

  function fcCommitCroppedImage(dataUrl, aspect, opts) {
    const canvas = fcGetCanvas();
    if (!canvas) return;
    fcPushUndo();
    if (opts && opts.mode === 'recrop' && opts.elId) {
      const el = fcFindElement(opts.elId);
      if (!el) return;
      el.originalSrc = dataUrl;
      el.src = dataUrl;
      el.filter = '';
      el.maskShape = '';
      fcSelected = el.id;
    } else {
      const w = 240;
      const h = Math.round(w / (aspect || 1));
      const el = {
        id: fcNewElId(), type: 'image',
        x: Math.round(canvas.width / 2 - w / 2), y: Math.round(canvas.height / 2 - h / 2),
        w, h, rotate: 0, z: fcMaxZ() + 1,
        originalSrc: dataUrl, src: dataUrl, filter: '', maskShape: '', border: null, opacity: 1, locked: false
      };
      canvas.elements.push(el);
      fcSelected = el.id;
    }
    fcCommitElement();
    renderFcElements();
    renderFcPropPanel();
  }

  function fcOpenSplitDialog() {
    const inp = mainDoc.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.addEventListener('change', async ev => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      try {
        const img = await fcFileToImage(f);
        openFcSplitConfigDialog(img);
      } catch (e) {
        toast('图片读取失败：' + (e?.message || e), 'error');
      }
    });
    inp.click();
  }

  function openFcSplitConfigDialog(img) {
    const MASK_ID = 'be-fc-split-mask';
    let mask = mainDoc.getElementById(MASK_ID);
    if (!mask) {
      mask = mainDoc.createElement('div');
      mask.id = MASK_ID;
      mask.className = 'be-import-tpl-mask';
      mask.innerHTML = `
        <div class="be-import-tpl-box">
          <div class="be-src-title">裂图（自动切分成多张图片元素）</div>
          <div class="be-src-field">
            <label>切分方式</label>
            <div class="be-radio-group" id="be-fc-split-mode-group">
              <button type="button" class="be-radio-opt active" data-m="cols">纵向等份</button>
              <button type="button" class="be-radio-opt" data-m="rows">横向等份</button>
              <button type="button" class="be-radio-opt" data-m="grid">网格</button>
            </div>
          </div>
          <div class="be-src-field">
            <label id="be-fc-split-n-label">份数</label>
            <input type="number" id="be-fc-split-n" min="2" max="6" value="2" style="width:70px;">
          </div>
          <div class="be-src-actions">
            <button class="be-btn" id="be-fc-split-cancel">取消</button>
            <button class="be-btn primary" id="be-fc-split-confirm">生成</button>
          </div>
        </div>
      `;
      mainDoc.body.appendChild(mask);
      mask.addEventListener('click', e => { if (e.target === mask) mask.classList.remove('open'); });
    } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    detectAndApplyTheme();
    mask.classList.add('open');
    mask.querySelector('#be-fc-split-n').value = '2';
    mask.querySelector('#be-fc-split-n-label').textContent = '份数';

    let chosenMode = 'cols';
    const reNew = (sel, fn) => {
      const el = mask.querySelector(sel);
      const clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);
      clone.addEventListener('click', fn);
      return clone;
    };
    const oldGroup = mask.querySelector('#be-fc-split-mode-group');
    const group = oldGroup.cloneNode(true);
    oldGroup.parentNode.replaceChild(group, oldGroup);
    group.querySelectorAll('.be-radio-opt').forEach((b, i) => b.classList.toggle('active', i === 0));
    group.querySelectorAll('.be-radio-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        chosenMode = btn.getAttribute('data-m');
        group.querySelectorAll('.be-radio-opt').forEach(b => b.classList.toggle('active', b === btn));
        mask.querySelector('#be-fc-split-n-label').textContent = chosenMode === 'grid' ? '每边份数（N×N）' : '份数';
      });
    });
    reNew('#be-fc-split-cancel', () => mask.classList.remove('open'));
    reNew('#be-fc-split-confirm', () => {
      const n = Math.max(2, Math.min(6, Number(mask.querySelector('#be-fc-split-n').value) || 2));
      mask.classList.remove('open');
      fcExecuteSplit(img, chosenMode, n);
    });
  }

  function fcExecuteSplit(img, mode, n) {
    const canvas = fcGetCanvas();
    if (!canvas) return;
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    if (!w0 || !h0) { toast('图片尺寸无效', 'error'); return; }
    fcPushUndo();
    let cols = 1, rows = 1;
    if (mode === 'cols') { cols = n; rows = 1; }
    else if (mode === 'rows') { cols = 1; rows = n; }
    else { cols = n; rows = n; }
    const tileW0 = w0 / cols, tileH0 = h0 / rows;
    const totalW = 360;
    const tileW = totalW / cols;
    const tileH = tileW * (tileH0 / tileW0);
    const totalH = tileH * rows;
    const startX = Math.round(canvas.width / 2 - totalW / 2);
    const startY = Math.round(canvas.height / 2 - totalH / 2);
    let created = 0, lastEl = null, z = fcMaxZ();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const off = mainDoc.createElement('canvas');
        off.width = Math.max(1, Math.round(tileW0));
        off.height = Math.max(1, Math.round(tileH0));
        const ctx = off.getContext('2d');
        ctx.drawImage(img, c * tileW0, r * tileH0, tileW0, tileH0, 0, 0, off.width, off.height);
        const dataUrl = fcCanvasToCompressedUrl(off, {});
        z += 1;
        const el = {
          id: fcNewElId(), type: 'image',
          x: Math.round(startX + c * tileW), y: Math.round(startY + r * tileH),
          w: Math.round(tileW), h: Math.round(tileH), rotate: 0, z,
          originalSrc: dataUrl, src: dataUrl, filter: '', maskShape: '', border: null, opacity: 1, locked: false
        };
        canvas.elements.push(el);
        lastEl = el;
        created += 1;
      }
    }
    if (lastEl) fcSelected = lastEl.id;
    fcCommitElement();
    renderFcElements();
    renderFcPropPanel();
    toast(`已生成 ${created} 张切片`, 'success');
  }

  function fcSelect(id) {
    fcSelected = id;
    fcMultiSelected = [];
    fcSyncSelectionUI();
    renderFcPropPanel();
  }

  function fcCanvasPointerDown(e) {
    const handle = e.target.closest('.be-fc-handle-rotate');
    if (handle) {
      const wrap = handle.closest('.be-fc-el');
      const id = wrap?.getAttribute('data-id');
      const el = fcFindElement(id);
      if (!el || el.locked) return;
      fcPushUndo();
      const rect = wrap.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      fcRotating = { id, cx, cy, startAngle: el.rotate || 0, startPointerAngle: Math.atan2(e.clientY - cy, e.clientX - cx) };
      e.preventDefault();
      return;
    }
    const t = e.target.closest('.be-fc-el');
    if (t && !e.target.closest('.be-fc-handle')) {
      const id = t.getAttribute('data-id');
      if (e.shiftKey) {
        fcToggleMultiSelect(id);
      } else if (!(fcMultiSelected.length > 1 && fcMultiSelected.includes(id))) {
        // 点的不是已有多选集合里的成员才收回成单选；点已选中的组内成员保留整组选中，方便直接拖走整组
        fcSelect(id);
      }
    } else if (e.target === fcCanvasEl()) {
      const canvasEl = fcCanvasEl();
      const rect = canvasEl.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      fcBoxSelect = { startX: x, startY: y, curX: x, curY: y, moved: false, shiftKey: e.shiftKey };
    }
  }
  function fcCanvasPointerMove(e) {
    if (fcRotating) {
      const ang = Math.atan2(e.clientY - fcRotating.cy, e.clientX - fcRotating.cx);
      const deltaDeg = (ang - fcRotating.startPointerAngle) * 180 / Math.PI;
      const el = fcFindElement(fcRotating.id);
      if (!el) return;
      el.rotate = Math.round(fcRotating.startAngle + deltaDeg);
      const node = mainDoc.getElementById('fc-el-' + el.id);
      if (node) node.style.transform = `rotate(${el.rotate}deg)`;
      return;
    }
    if (fcBoxSelect) {
      const canvasEl = fcCanvasEl();
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      fcBoxSelect.curX = e.clientX - rect.left;
      fcBoxSelect.curY = e.clientY - rect.top;
      if (!fcBoxSelect.moved && (Math.abs(fcBoxSelect.curX - fcBoxSelect.startX) > 3 || Math.abs(fcBoxSelect.curY - fcBoxSelect.startY) > 3)) {
        fcBoxSelect.moved = true;
      }
      fcRenderSelBox();
    }
  }
  function fcCanvasPointerUp() {
    if (fcRotating) {
      fcRotating = null;
      fcCommitElement();
      return;
    }
    if (fcBoxSelect) {
      if (fcBoxSelect.moved) {
        const canvas = fcGetCanvas();
        const x1 = Math.min(fcBoxSelect.startX, fcBoxSelect.curX), x2 = Math.max(fcBoxSelect.startX, fcBoxSelect.curX);
        const y1 = Math.min(fcBoxSelect.startY, fcBoxSelect.curY), y2 = Math.max(fcBoxSelect.startY, fcBoxSelect.curY);
        const hitIds = (canvas ? canvas.elements : [])
          .filter(el => el.x < x2 && el.x + el.w > x1 && el.y < y2 && el.y + el.h > y1)
          .map(el => el.id);
        if (fcBoxSelect.shiftKey) {
          if (fcSelected && !fcMultiSelected.includes(fcSelected)) fcMultiSelected.push(fcSelected);
          hitIds.forEach(id => { if (!fcMultiSelected.includes(id)) fcMultiSelected.push(id); });
        } else {
          fcMultiSelected = hitIds.slice();
        }
        if (fcMultiSelected.length <= 1) {
          fcSelected = fcMultiSelected[0] || null;
          fcMultiSelected = [];
        } else {
          fcSelected = null;
        }
        fcSyncSelectionUI();
        renderFcPropPanel();
      } else {
        fcSelect(null); // 没有真正拖动 = 点击空白处，保留原来的"点空白取消选中"行为
      }
      fcBoxSelect = null;
      fcRenderSelBox();
    }
  }
  // 框选拖拽中的可视矩形反馈；fcBoxSelect 为空或还没真正拖动时清掉残留的框
  function fcRenderSelBox() {
    const canvasEl = fcCanvasEl();
    if (!canvasEl) return;
    if (!fcBoxSelect || !fcBoxSelect.moved) {
      const old = mainDoc.getElementById('be-fc-selbox');
      if (old) old.remove();
      return;
    }
    let box = mainDoc.getElementById('be-fc-selbox');
    if (!box) {
      box = mainDoc.createElement('div');
      box.id = 'be-fc-selbox';
      box.className = 'be-fc-selbox';
      canvasEl.appendChild(box);
    }
    const x1 = Math.min(fcBoxSelect.startX, fcBoxSelect.curX), x2 = Math.max(fcBoxSelect.startX, fcBoxSelect.curX);
    const y1 = Math.min(fcBoxSelect.startY, fcBoxSelect.curY), y2 = Math.max(fcBoxSelect.startY, fcBoxSelect.curY);
    box.style.left = x1 + 'px'; box.style.top = y1 + 'px';
    box.style.width = (x2 - x1) + 'px'; box.style.height = (y2 - y1) + 'px';
  }

  // 轻量吸附：拖拽中心贴近画布中心线 / 其它元素中心时吸附，range 内没有候选时返回 null（不吸附）
  function fcSnapTargetFn(x, y, interaction) {
    const canvas = fcGetCanvas();
    const canvasEl = fcCanvasEl();
    if (!canvas || !canvasEl) return null;
    const range = 8;
    const rect = canvasEl.getBoundingClientRect();
    const ccx = rect.left + rect.width / 2, ccy = rect.top + rect.height / 2;
    let sx = null, sy = null;
    if (Math.abs(x - ccx) < range) sx = ccx;
    if (Math.abs(y - ccy) < range) sy = ccy;
    const draggedId = interaction?.element?.getAttribute('data-id');
    canvas.elements.forEach(el => {
      if (el.id === draggedId) return;
      const node = mainDoc.getElementById('fc-el-' + el.id);
      if (!node) return;
      const r = node.getBoundingClientRect();
      const ecx = r.left + r.width / 2, ecy = r.top + r.height / 2;
      if (sx === null && Math.abs(x - ecx) < range) sx = ecx;
      if (sy === null && Math.abs(y - ecy) < range) sy = ecy;
    });
    if (sx === null && sy === null) return null;
    return { x: sx === null ? x : sx, y: sy === null ? y : sy };
  }

  async function fcInitInteract() {
    if (fcInteractBound) return;
    let interactLib;
    try { interactLib = await loadInteract(); } catch (e) { console.warn('[书摘] interact.js 加载失败：', e); return; }
    if (!interactLib || fcInteractBound) return;
    fcInteractBound = true;
    const canvasEl = fcCanvasEl();
    interactLib('.be-fc-el', { context: canvasEl })
      .draggable({
        listeners: {
          start(event) {
            const target = event.target.closest('.be-fc-el');
            const id = target?.getAttribute('data-id');
            const el = id && fcFindElement(id);
            if (!el || el.locked) return;
            fcPushUndo(); // 手势开始时存一次快照，不在 move 里高频存
          },
          move(event) {
            const target = event.target.closest('.be-fc-el');
            if (!target) return;
            const id = target.getAttribute('data-id');
            const el = fcFindElement(id);
            if (!el || el.locked) return;
            // 拖的是多选集合里的成员时，同一份位移增量施加给集合内每个未锁定元素（"批量移动"）
            const group = (fcMultiSelected.length > 1 && fcMultiSelected.includes(id)) ? fcMultiSelected : [id];
            group.forEach(gid => {
              const gEl = fcFindElement(gid);
              if (!gEl || gEl.locked) return;
              gEl.x += event.dx;
              gEl.y += event.dy;
              const node = gid === id ? target : mainDoc.getElementById('fc-el-' + gid);
              if (node) { node.style.left = gEl.x + 'px'; node.style.top = gEl.y + 'px'; }
            });
          },
          end() { fcCommitElement(); }
        },
        modifiers: [
          interactLib.modifiers.snap({
            targets: [fcSnapTargetFn],
            relativePoints: [{ x: 0.5, y: 0.5 }],
            offset: 'self'
          })
        ],
        ignoreFrom: '.be-fc-handle, .be-fc-text-body'
      })
      .resizable({
        edges: { left: true, right: true, top: true, bottom: true },
        ignoreFrom: '.be-fc-text-body[contenteditable="true"]',
        listeners: {
          start(event) {
            const target = event.target.closest('.be-fc-el');
            const id = target?.getAttribute('data-id');
            const el = id && fcFindElement(id);
            if (!el || el.locked) return;
            fcPushUndo();
          },
          move(event) {
            const target = event.target.closest('.be-fc-el');
            if (!target) return;
            const id = target.getAttribute('data-id');
            const el = fcFindElement(id);
            if (!el || el.locked) return;
            el.w = Math.round(event.rect.width);
            el.h = Math.round(event.rect.height);
            el.x += event.deltaRect.left;
            el.y += event.deltaRect.top;
            target.style.width = el.w + 'px';
            target.style.height = el.h + 'px';
            target.style.left = el.x + 'px';
            target.style.top = el.y + 'px';
          },
          end() { fcCommitElement(); }
        },
        modifiers: [
          interactLib.modifiers.restrictSize({ min: { width: 24, height: 24 } })
        ]
      });
  }

  // ---------- 导出 ----------
  // 沙箱思路跟卡片导出的 renderInSandbox 一致（隐藏 iframe + 把书摘自己的样式表/字体复制进去 + html2canvas
  // 截图），但自由画布是固定尺寸的独立"画布"而不是一段跟随内容撑高的卡片，所以另起一个专用实现而不是
  // 直接调用 renderInSandbox（那个函数里头像 clone / 诗笺竖排量宽度这些逻辑跟自由画布毫无关系）。
  // 字体：内置字体是 <link id="be-font-*"> 引入的外部样式表，自定义上传字体是 #be-custom-font-style
  // 里的 @import 规则——两者都要复制进沙箱 iframe 自己的文档，不然 @font-face 只在主文档生效，
  // iframe 是独立的样式作用域，看不到主文档 import 过的字体。
  async function fcRenderInSandbox(canvasEl, canvasData, scale, h2c) {
    const iframe = mainDoc.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    const w = canvasData.width, h = canvasData.height;
    iframe.style.cssText = `position:fixed;left:-99999px;top:0;width:${w + 4}px;height:${h + 4}px;border:0;visibility:hidden;`;
    mainDoc.body.appendChild(iframe);
    try {
      const idoc = iframe.contentDocument;
      const fontLinks = Array.from(mainDoc.querySelectorAll('link[id^="be-font-"]'))
        .map(l => `<link rel="stylesheet" href="${l.href}">`).join('');
      const styleText = (mainDoc.getElementById('be-style')?.textContent || '') + '\n' +
                        (mainDoc.getElementById('be-custom-font-style')?.textContent || '');
      idoc.open();
      idoc.write(`<!DOCTYPE html><html><head>
        <meta charset="utf-8">
        ${fontLinks}
        <style>html,body{margin:0;padding:0;background:transparent;}</style>
        <style>${styleText}</style>
      </head><body></body></html>`);
      idoc.close();
      await new Promise(r => setTimeout(r, 16));
      const clone = canvasEl.cloneNode(true);
      // 清掉只在编辑态才有意义的东西：缩放/旋转手柄、选中框、框选残留矩形、还处于编辑态的 contenteditable
      clone.querySelectorAll('.be-fc-handle').forEach(n => n.remove());
      clone.querySelectorAll('.be-fc-el').forEach(n => n.classList.remove('selected'));
      const selbox = clone.querySelector('.be-fc-selbox');
      if (selbox) selbox.remove();
      const emptyHint = clone.querySelector('.be-fc-empty-hint');
      if (emptyHint) emptyHint.remove();
      clone.querySelectorAll('[contenteditable]').forEach(n => n.setAttribute('contenteditable', 'false'));
      clone.style.width = w + 'px';
      clone.style.height = h + 'px';
      clone.style.boxShadow = 'none';
      clone.style.overflow = 'hidden'; // 编辑器里为了手柄可抓故意没裁，导出这裁到画布边界
      idoc.body.appendChild(clone);
      await new Promise(r => setTimeout(r, 16));
      try {
        await Promise.race([
          (idoc.fonts && idoc.fonts.ready) || Promise.resolve(),
          new Promise(r => setTimeout(r, 1800))
        ]);
      } catch (e) {}
      await new Promise(r => setTimeout(r, 32));
      const canvas = await h2c(clone, {
        backgroundColor: canvasData.bg?.color || '#ffffff',
        scale,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 0,
        logging: false,
        windowWidth: w,
        windowHeight: h
      });
      return canvas;
    } finally {
      try { iframe.remove(); } catch (e) {}
    }
  }

  async function fcExportCanvas() {
    const canvasData = fcGetCanvas();
    const canvasEl = fcCanvasEl();
    if (!canvasData || !canvasEl) return;
    // 导出前失焦，避免把光标/输入法候选框截进图里
    const editing = canvasEl.querySelector('.be-fc-text-body[contenteditable="true"]');
    if (editing) { try { editing.blur(); } catch (e) {} }
    const btn = mainDoc.getElementById('be-fc-export');
    const oldText = btn ? btn.textContent : '';
    if (btn) { btn.textContent = '生成中…'; btn.disabled = true; }
    await new Promise(r => setTimeout(r, 32));
    try {
      const scaleSel = mainDoc.getElementById('be-fc-export-scale');
      const scale = Math.max(1, Math.min(3, Number(scaleSel?.value) || 2));
      const h2c = await withTimeout(loadH2C(), 8000, '加载截图库');
      const rendered = await withTimeout(fcRenderInSandbox(canvasEl, canvasData, scale, h2c), 20000, '生成图片');
      const ts = new Date();
      const fname = `书摘_排版_${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}_${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}.png`;
      if (settings.saveMode === 'popup') {
        const dataUrl = rendered.toDataURL('image/png');
        try { rendered.width = rendered.height = 0; } catch (e) {}
        showImagePopup(dataUrl);
      } else {
        const img = await canvasToImage(rendered, 'image/png');
        let ok = false;
        try { ok = triggerDownload(img, fname); } catch (e) { ok = false; }
        if (ok) {
          try { rendered.width = rendered.height = 0; } catch (e) {}
          toast('已导出图片', 'success');
        } else {
          const dataUrl = (typeof img === 'string') ? img : rendered.toDataURL('image/png');
          try { rendered.width = rendered.height = 0; } catch (e) {}
          showImagePopup(dataUrl);
          toast('下载未能触发，已自动切换为弹图，请长按保存', 'info');
        }
      }
    } catch (e) {
      console.error('[书摘] 自由排版导出失败:', e);
      toast('导出失败：' + fmtErr(e), 'error');
    } finally {
      if (btn) { btn.textContent = oldText; btn.disabled = false; }
    }
  }

  // ---------- 菜单入口 ----------
  function injectMenuEntry() {
    const tryInject = () => {
      const menu = mainDoc.getElementById('extensionsMenu');
      if (!menu) return false;
      const old = mainDoc.getElementById('be-menu-entry');
      if (!old || isStaleGen(old)) {
        if (old) { try { old.remove(); } catch (e) {} }   // 旧脚本实例残留：监听器已死，重建
        const div = stampGen(mainDoc.createElement('div'));
        div.id = 'be-menu-entry';
        div.className = 'list-group-item flex-container flexGap5 interactable';
        div.tabIndex = 0;
        div.innerHTML = `<div class="fa-fw fa-solid fa-bookmark extensionsMenuExtensionButton"></div><span>书摘笔记</span>`;
        div.addEventListener('click', () => openPanel('notes'));
        menu.appendChild(div);
      }
      // 自由排版入口：仅扩展形态 + 设置里开着才出现，关掉就撤掉，不留痕迹
      const wantFreeform = IS_EXTENSION && settings.freeformEnabled;
      const oldFc = mainDoc.getElementById('be-menu-entry-freeform');
      if (!wantFreeform) {
        if (oldFc) { try { oldFc.remove(); } catch (e) {} }
      } else if (!oldFc || isStaleGen(oldFc)) {
        if (oldFc) { try { oldFc.remove(); } catch (e) {} }
        const divFc = stampGen(mainDoc.createElement('div'));
        divFc.id = 'be-menu-entry-freeform';
        divFc.className = 'list-group-item flex-container flexGap5 interactable';
        divFc.tabIndex = 0;
        divFc.innerHTML = `<div class="fa-fw fa-solid fa-object-group extensionsMenuExtensionButton"></div><span>自由排版</span>`;
        divFc.addEventListener('click', () => openFreeformList());
        menu.appendChild(divFc);
      }
      return true;
    };
    if (!tryInject()) {
      const interval = setInterval(() => { if (tryInject()) clearInterval(interval); }, 800);
      setTimeout(() => clearInterval(interval), 60000);
    }
  }

  $(window).on('pagehide', () => {
    ['be-float-bar', 'be-mask', 'be-thought-mask', 'be-source-mask', 'be-panel', 'be-style', 'be-menu-entry',
     'be-hl-bar', 'be-viewer-mask', 'be-imgpop', 'be-merge-badge', 'be-merge-sheet', 'be-merge-target-mask',
     'be-menu-entry-freeform', 'be-fc-mask', 'be-pick-step-bar', 'be-card-hl-bar', 'be-css-float',
     'be-card-hl-pop', 'be-slot-chooser', 'be-tl-menu', 'be-tpl-preview'].forEach(id => {
      mainDoc.getElementById(id)?.remove();
    });
  });

  // ---------- 启动 ----------
  injectStyle();
  migrateImagesToIdb();
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
              if (n.tagName === 'IFRAME' || n.querySelector?.('iframe')) scheduleFrameScan();
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

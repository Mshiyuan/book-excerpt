$(() => {
  const mainDoc = document;
  const mainWin = window;

  const SCRIPT_ID = 'book-excerpt';
  const SCRIPT_NAME = '书摘';
  const VERSION = '1.6.0';
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
    maskWordStyle: {},             // 逐词打码样式：{[词]: {style:'block'|'symbol'|'custom', char}}，没设的词跟随 maskStyle
    maskSource: false,             // 是否同时打码出处显示的用户名/作者
    highlightStyle: 'underline',   // underline | marker
    stripStyle: true,
    pickEnabled: true,             // 两点选线：划线浮动栏多一个"设为开头/设为结尾"，长句用它、短句照常拖选
    underlineColor: '#95b6d6',
    markerColor: '#ffdc6e',
    themeColor: '#95b6d6',         // 插件自身UI主题色（--be-accent），跟 underlineColor 解耦，默认值保持一致避免老用户升级视觉跳变
    followTavernTheme: true,       // 划线相关浮动栏仿酒馆下拉框样式；不影响设置面板/笔记本/主题色
    creatorMode: true,             // 开发者模式：模板列表出现编辑CSS按钮，悬浮窗实时预览 + 类名查询器
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
    sourceHistory: {},             // 出处/水印各字段收藏过的值：{user|author|title|chapter|watermark: [{v, pin}]}，编辑出处里点 ☆ 收藏、点 ▾ 选
    sourcePresets: [],             // 出处组合：[{id, name, user, author, title, showTitle, chapter, showChapter, wm, showWm}]，一键套用
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
    layoutImgReplace: 'ask',       // 书摘弹窗里点自由排版的图片换图：ask 每次询问 / once 仅本次导出 / save 保存到模板
    layoutTemplates: [],           // 自由排版的版式模板（整页富文本 + 浮动贴纸）：[{id, name, v:2, page, doc, floats}]，模板 key 为 'layout-<id>'
    hiddenTemplates: [],           // 被隐藏的模板 key（默认 'classic' / 导入 'custom-<id>' 都行）
    hiddenColorPresets: [],        // 被用户隐藏的内置配色 id 列表（COLOR_PRESETS 的 id）
    templateOrder: [],             // 模板排序（默认+导入统一，存 key），只有 templateOrderManual 为 true 才生效
    templateOrderManual: false,    // 用户在模板列表里拖动过才为 true；否则固定 默认模板在前、导入模板在后
    templateFavorites: [],         // 收藏的模板 key 列表（跟 settings.template 同格式：'classic' / 'custom-<id>'），选模板时排在最前
    floatBarCustom: false,         // 自定义悬浮栏按钮（高级设置，默认关）：开着时按 floatBarLayout 排序/隐藏
    floatBarLayout: [],            // [{id:'highlight'|'thought'|'excerpt'|'pick', hidden}]，没列到的按钮自动排在后面
    recentColors: [],              // 取色器「最近使用」（最多 16 个）
    savedSwatches: [],             // 取色器「我的色板」
    colorPickerTab: 'classic',     // 取色器上次用的方式：classic 经典 / disc 色盘 / value 参数 / palette 调色板
    dataDirSync: true,             // 同步到酒馆数据目录（data/<用户>/user/files/）：浏览器存储照旧，另存一份双保险
    dailyReview: false,            // 随机回顾：每天第一次打开酒馆时推一条旧笔记
    lastDailyReview: '',           // 上次推送的日期（YYYY-MM-DD），一天只推一次
    jumpNoConfirm: false,          // 跳回原文要切换聊天/角色时不再弹确认（确认框里勾「以后不再提醒」）
    panelAnim: 'fade',             // 切换笔记本/设置、设置三个小类时的动画：fade 淡入淡出 / slide 滑动
    panelHome: 'notes',            // 点「书摘笔记」先显示：notes 笔记本主页 / char 当前角色（没有笔记或没开聊天时回落主页）/ settings 设置
    heatScale: 'auto',             // 热力图深浅：auto 按记得最多的那天自适应 / fixed 固定上限
    heatMax: 50,                   // heatScale=fixed 时最深一格代表的条数
    // 一次性迁移标记：新安装直接带上，存下来的设置里有它就不会再被迁移逻辑改动
    _scaleDefault3: true,
    _defaults150b: true
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
      // v1.5.0 开发期间这几项的默认值改过（两点选线、跟随酒馆主题、开发者模式都改成默认开），
      // 这几个设置都是 1.5.0 才新增的，只有测试版存档里有旧值，升一次到新默认
      if (!parsed._defaults150b) {
        s.pickEnabled = true;
        s.followTavernTheme = true;
        s.creatorMode = true;
        s._defaults150b = true;
      }
      delete s.selectMode;
      // 迁移结果立刻写回，否则用户没改过设置时每次加载都会重新迁移一遍（会覆盖掉之后的手动选择）
      if (!parsed._scaleDefault3 || !parsed._defaults150b) {
        try { mainWin.localStorage.setItem(LS_SETTINGS, JSON.stringify(s)); } catch (e) {}
      }
      return s;
    } catch { return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); }
  }
  // 写失败不能再静默吞掉：之前图片塞在 settings 里撑爆 5MB 后，之后所有设置改动都悄悄存不进去
  let _settingsSaveWarned = false;
  function saveSettings(s) {
    try {
      mainWin.localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
      _settingsSaveWarned = false;
      try { scheduleMirror('settings'); } catch (e2) {}
    } catch (e) {
      console.warn('[BookExcerpt] 设置保存失败', e);
      if (!_settingsSaveWarned) {
        _settingsSaveWarned = true;
        try { toast('设置没能保存：浏览器存储空间不足或被禁用', 'error'); } catch (e2) {}
      }
    }
  }
  // ---------- 同步到酒馆数据目录（双保险） ----------
  // 浏览器里的 localStorage / IndexedDB 读写一行不改；每次保存后防抖 3 秒，再用酒馆自带的
  // /api/files/upload 往 data/<用户>/user/files/ 写一份。本地开酒馆就是本机硬盘，跟角色卡、聊天记录放在一起，
  // 清浏览器缓存、换浏览器都不会丢。读回来走 /user/files/<文件名>（酒馆登录后才能访问自己的目录）。
  const MIRROR_FILES = { notes: 'book-excerpt-notes.json', settings: 'book-excerpt-settings.json' };
  const MIRROR_IMG_PREFIX = 'book-excerpt-img-';
  const LS_MIRROR = `${SCRIPT_ID}:mirror`;   // {synced:{notes,settings}, images:{key:file}, lastOk, lastErr}
  function mirrorMeta() {
    try { const m = JSON.parse(mainWin.localStorage.getItem(LS_MIRROR) || '{}'); return { synced: {}, images: {}, ...m }; }
    catch (e) { return { synced: {}, images: {} }; }
  }
  function saveMirrorMeta(m) { try { mainWin.localStorage.setItem(LS_MIRROR, JSON.stringify(m)); } catch (e) {} }
  function mirrorHeaders() {
    try {
      const ctx = mainWin.SillyTavern && mainWin.SillyTavern.getContext ? mainWin.SillyTavern.getContext() : null;
      if (ctx && typeof ctx.getRequestHeaders === 'function') return ctx.getRequestHeaders();
    } catch (e) {}
    return null;
  }
  function mirrorOn() {
    let on = true;
    try { on = settings.dataDirSync !== false; } catch (e) {}   // settings 还没初始化时（TDZ）按默认开
    return on && !!mirrorHeaders();
  }
  function bytesToBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return mainWin.btoa(bin);
  }
  async function mirrorUpload(name, bytes) {
    const headers = mirrorHeaders();
    if (!headers) throw new Error('无法获取酒馆请求头');
    const res = await mainWin.fetch('/api/files/upload', {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, data: bytesToBase64(bytes) })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }
  async function mirrorFetch(name, asJson = true) {
    const res = await mainWin.fetch(`/user/files/${name}?t=${Date.now()}`, { cache: 'no-store', headers: mirrorHeaders() || {} });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return asJson ? res.json() : res.arrayBuffer();
  }
  let _mirrorWarned = false;
  function mirrorFailed(e) {
    const m = mirrorMeta(); m.lastErr = String((e && e.message) || e); saveMirrorMeta(m);
    console.warn('[书摘] 同步到酒馆数据目录失败', e);
    if (!_mirrorWarned) { _mirrorWarned = true; try { toast('同步到酒馆数据目录失败，浏览器里的数据不受影响', 'warning'); } catch (e2) {} }
  }
  // force=false（自动同步）时：这个浏览器从没和数据目录同步过、而目录里已经有备份，就不覆盖——
  // 典型情况是新浏览器拒绝了恢复，随手划一笔就把原来完整的备份冲掉。要覆盖请在设置里手动「立即备份」。
  let _mirrorBlockedWarned = false;
  async function mirrorWrite(kind, force = false) {
    if (!force && !(mirrorMeta().synced || {})[kind]) {
      const existing = await mirrorFetch(MIRROR_FILES[kind]).catch(() => null);
      if (existing && existing.app === 'book-excerpt') {
        if (!_mirrorBlockedWarned) { _mirrorBlockedWarned = true; try { toast('酒馆数据目录里已有另一份书摘备份，没有自动覆盖。可在 设置→通用→数据 里恢复或手动备份', 'warning'); } catch (e) {} }
        return;
      }
    }
    const data = kind === 'notes' ? loadNotes() : settings;
    const savedAt = Date.now();
    const payload = { app: 'book-excerpt', kind, v: 1, version: VERSION, savedAt, data };
    if (kind === 'settings') payload.images = mirrorMeta().images;
    await mirrorUpload(MIRROR_FILES[kind], new TextEncoder().encode(JSON.stringify(payload)));
    const m = mirrorMeta(); m.synced[kind] = savedAt; m.lastOk = savedAt; delete m.lastErr; saveMirrorMeta(m);
    _mirrorWarned = false;
  }
  const _mirrorT = {};
  let _mirrorSuspended = false;   // 恢复备份时暂停回写，免得把刚读回来的内容又覆盖一遍
  function scheduleMirror(kind) {
    if (_mirrorSuspended || !mirrorOn()) return;
    if (_mirrorT[kind]) clearTimeout(_mirrorT[kind]);
    _mirrorT[kind] = setTimeout(() => { _mirrorT[kind] = 0; mirrorWrite(kind).catch(mirrorFailed); }, 3000);
  }
  function mirrorImgName(key, type) {
    const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' })[type] || 'png';
    return MIRROR_IMG_PREFIX + String(key).replace(/[^a-zA-Z0-9_\-.]/g, '_') + '.' + ext;
  }
  function mirrorImage(key, rec) {
    if (_mirrorSuspended || !mirrorOn() || !rec || !rec.data) return;
    const name = mirrorImgName(key, rec.type);
    mirrorUpload(name, new Uint8Array(rec.data)).then(() => {
      const m = mirrorMeta(); m.images[key] = name; saveMirrorMeta(m);
      scheduleMirror('settings');   // 图片清单记在设置备份里
    }).catch(mirrorFailed);
  }
  function mirrorImageDelete(key) {
    const m = mirrorMeta();
    const name = m.images[key];
    if (!name) return;
    delete m.images[key]; saveMirrorMeta(m);
    const headers = mirrorHeaders();
    if (!headers || !mirrorOn()) return;
    mainWin.fetch('/api/files/delete', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: `user/files/${name}` }) }).catch(() => {});
  }
  function settingsImageRefs(st) {
    const keys = [];
    const add = (ref) => { const k = (typeof ref === 'string' && ref.startsWith('idb:')) ? ref.slice(4) : ''; if (k) keys.push(k); };
    add(st && st.customAvatar);
    ((st && st.customTemplates) || []).forEach(t => Object.values((t && t.slotImages) || {}).forEach(add));
    ((st && st.layoutTemplates) || []).forEach(t => layImageRefs(t).forEach(add));
    return [...new Set(keys)];
  }
  async function mirrorBackupNow() {
    await mirrorWrite('notes', true);
    // 还没备份过的图片补传
    const m = mirrorMeta();
    for (const key of settingsImageRefs(settings)) {
      if (m.images[key]) continue;
      try { const rec = await imgGet(key); if (rec && rec.data) { const name = mirrorImgName(key, rec.type); await mirrorUpload(name, new Uint8Array(rec.data)); m.images[key] = name; } } catch (e) {}
    }
    saveMirrorMeta(m);
    await mirrorWrite('settings', true);
  }
  // 用数据目录里的备份覆盖浏览器数据（笔记 / 设置 / 图片）
  async function mirrorRestore(remote) {
    _mirrorSuspended = true;
    try {
      if (remote.notes && remote.notes.data) {
        mainWin.localStorage.setItem(LS_NOTES, JSON.stringify(remote.notes.data));
        _notesCache = null;
      }
      if (remote.settings && remote.settings.data) {
        const imgs = remote.settings.images || {};
        for (const key of settingsImageRefs(remote.settings.data)) {
          try {
            if (await imgGet(key)) continue;
            const name = imgs[key];
            if (!name) continue;
            const buf = await mirrorFetch(name, false);
            if (!buf) continue;
            const ext = name.split('.').pop();
            const type = ({ png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' })[ext] || 'image/png';
            await imgTx('readwrite', st => st.put({ type, data: buf }, key));
          } catch (e) { console.warn('[书摘] 恢复图片失败', key, e); }
        }
        mainWin.localStorage.setItem(LS_SETTINGS, JSON.stringify(remote.settings.data));
        settings = loadSettings();
      }
      const m = mirrorMeta();
      if (remote.notes) m.synced.notes = remote.notes.savedAt;
      if (remote.settings) { m.synced.settings = remote.settings.savedAt; m.images = { ...(remote.settings.images || {}), ...m.images }; }
      saveMirrorMeta(m);
    } finally {
      _mirrorSuspended = false;
    }
    try { refreshAfterRestore(); } catch (e) {}
  }
  function refreshAfterRestore() {
    try { injectStyle(); } catch (e) {}
    try { injectCustomTemplateStyles(); } catch (e) {}
    try { loadFontStylesheets(); } catch (e) {}
    try { restoreHighlights(); } catch (e) {}
    if (mainDoc.getElementById('be-panel')?.classList.contains('open')) { try { renderPanel(); } catch (e) {} }
  }
  function describeBackup(remote) {
    const n = remote.notes && remote.notes.data ? Object.values(remote.notes.data).reduce((a, c) => a + ((c && c.items) || []).length, 0) : 0;
    const t = Math.max((remote.notes && remote.notes.savedAt) || 0, (remote.settings && remote.settings.savedAt) || 0);
    return `${n} 条笔记，保存于 ${t ? formatDateTime(t) : '未知时间'}`;
  }
  async function mirrorFetchAll() {
    const [notes, st] = await Promise.all([mirrorFetch(MIRROR_FILES.notes), mirrorFetch(MIRROR_FILES.settings)]);
    const ok = (x) => x && x.app === 'book-excerpt' && x.data ? x : null;
    return { notes: ok(notes), settings: ok(st) };
  }
  // 启动时比对：浏览器空而备份在 → 提示恢复；备份比上次同步的新（别的浏览器改过）→ 提示，绝不自动覆盖；
  // 其余情况把本地补传一份
  async function mirrorStartupCheck() {
    if (!mirrorOn()) return;
    let remote;
    try { remote = await mirrorFetchAll(); } catch (e) { mirrorFailed(e); return; }
    const m = mirrorMeta();
    const localNotesRaw = mainWin.localStorage.getItem(LS_NOTES);
    const localEmpty = !localNotesRaw || localNotesRaw === '{}';
    const hasRemote = !!(remote.notes || remote.settings);
    if (hasRemote && localEmpty && remote.notes && Object.keys(remote.notes.data).length) {
      if ((await beConfirm({ title: '书摘', text: `酒馆数据目录中有备份（${describeBackup(remote)}），当前浏览器无笔记数据。是否恢复？`, okText: '恢复' })).ok) {
        await mirrorRestore(remote);
        toast('已从酒馆数据目录恢复', 'success');
      }
      return;
    }
    const newer = (k) => remote[k] && remote[k].savedAt > ((m.synced && m.synced[k]) || 0) + 2000;
    if (hasRemote && (m.synced.notes || m.synced.settings) && (newer('notes') || newer('settings'))) {
      if ((await beConfirm({ title: '书摘', text: `酒馆数据目录中的备份（${describeBackup(remote)}）比当前浏览器的数据新，可能来自其他浏览器或设备。是否用备份覆盖当前数据？选择「保留本地」则用当前数据更新备份。`, okText: '用备份覆盖', cancelText: '保留本地' })).ok) {
        await mirrorRestore(remote);
        toast('已从酒馆数据目录恢复', 'success');
      } else {
        mirrorBackupNow().catch(mirrorFailed);
      }
      return;
    }
    if (!localEmpty || !hasRemote) mirrorBackupNow().catch(mirrorFailed);
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
    try { scheduleMirror('notes'); } catch (e2) {}
    try { apiEmitSoon('note:changed', {}); } catch (e2) {}
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

  // ---------- 取色器（参考 Procreate：经典 / 色盘 / 参数 / 调色板 + HEX） ----------
  // 不逐个改各处的 <input type="color">：在父文档捕获阶段拦下插件 UI 里色块的点击，
  // 不让系统取色器弹出，改开自己的取色器；选色时写回 input.value 并派发 input/change，
  // 原来挂在这些 input 上的监听器一行不用动。
  const CP_SCOPE = '#be-panel, #be-hl-bar, #be-card-hl-pop, #be-source-mask, #be-mask, .be-import-tpl-mask';
  function cpClamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function cpHexToRgb(hex) {
    let h = String(hex || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map(c => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  function cpRgbToHex({ r, g, b }) {
    return '#' + [r, g, b].map(v => cpClamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  }
  function cpRgbToHsv({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return { h, s: max ? d / max : 0, v: max };
  }
  function cpHsvToRgb({ h, s, v }) {
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
  }
  let _cp = null;   // 当前打开的取色器状态 { input, hsv, orig, el }
  function cpCurrentHex() { return cpRgbToHex(cpHsvToRgb(_cp.hsv)); }
  function cpEmit(type) {
    if (!_cp || !_cp.input) return;
    const hex = cpCurrentHex();
    const t = _cp.targets ? _cp.targets[_cp.ti] : null;
    const wasAuto = !!(t && t.auto && t.auto.get());
    _cp.input.value = hex;
    _cp.input.dispatchEvent(new Event(type, { bubbles: true }));
    if (t) {
      const dot = _cp.el.querySelector(`.be-cp-tseg button[data-ti="${_cp.ti}"] .be-cp-tdot`);
      if (dot) dot.style.background = hex;
      if (wasAuto) { if (t.auto.get()) t.auto.set(false); _cp.el.querySelector('.be-cp-auto')?.classList.remove('active'); }
    }
  }
  function cpPushRecent(hex) {
    const list = (Array.isArray(settings.recentColors) ? settings.recentColors : []).filter(c => c !== hex);
    list.unshift(hex);
    settings.recentColors = list.slice(0, 16);
  }
  function closeColorPicker(commit = true) {
    if (!_cp) return;
    const st = _cp;
    if (commit && st.targets) {
      st.targets.forEach(t => {
        if (t.input.value !== t.orig) { t.input.dispatchEvent(new Event('change', { bubbles: true })); cpPushRecent(t.input.value); }
      });
    } else if (commit && cpCurrentHex() !== st.orig) {
      cpEmit('change');
      cpPushRecent(cpCurrentHex());
    }
    saveSettings(settings);
    try { st.el.remove(); } catch (e) {}
    mainDoc.removeEventListener('pointerdown', st.outside, true);
    mainDoc.removeEventListener('keydown', st.onKey, true);
    _cp = null;
  }
  // opts.targets：[{label, input, auto?:{get(), set(bool)}}]，顶部出现切换（如 背景 / 字色），每个目标各自实时写回；
  // opts.anchor：定位参照（目标是没挂到页面上的隐藏 input 时用）
  function openColorPicker(input, opts = {}) {
    if (_cp) closeColorPicker(true);
    const targets = Array.isArray(opts.targets) && opts.targets.length ? opts.targets.map(t => ({ ...t, orig: cpRgbToHex(cpHexToRgb(t.input.value) || { r: 149, g: 182, b: 214 }) })) : null;
    if (targets) input = targets[0].input;
    const rgb = cpHexToRgb(input.value) || { r: 149, g: 182, b: 214 };
    const el = stampGen(mainDoc.createElement('div'));
    el.id = 'be-cpick';
    _cp = { input, hsv: cpRgbToHsv(rgb), orig: cpRgbToHex(rgb), el, tab: settings.colorPickerTab || 'classic', targets, ti: 0 };
    el.addEventListener('pointerdown', e => e.stopPropagation());
    mainDoc.body.appendChild(el);
    _cp.outside = (e) => { if (_cp && !el.contains(e.target) && e.target !== input) closeColorPicker(true); };
    _cp.onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); cpRevert(); }
      else if (e.key === 'Enter' && !e.target.closest('.be-cp-hex')) closeColorPicker(true);
    };
    // 取色器是在 click 里打开的，这次点击的 pointerdown 早已过去，直接挂就不会被自己关掉
    mainDoc.addEventListener('keydown', _cp.onKey, true);
    mainDoc.addEventListener('pointerdown', _cp.outside, true);
    renderColorPicker();
    // 定位：优先放在色块下方，放不下就上方；窄屏左右贴边留 8px（absolute + 滚动偏移，见 ST 禁用 fixed 的坑）
    const r = (opts.anchor || input).getBoundingClientRect();
    const vw = mainWin.innerWidth, vh = mainWin.innerHeight;
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = cpClamp(r.left + r.width / 2 - w / 2, 8, Math.max(8, vw - w - 8));
    let top = r.bottom + 8;
    if (top + h > vh - 8) top = r.top - h - 8;
    if (top < 8) top = cpClamp((vh - h) / 2, 8, Math.max(8, vh - h - 8));
    el.style.left = (left + (mainWin.scrollX || 0)) + 'px';
    el.style.top = (top + (mainWin.scrollY || 0)) + 'px';
  }
  function cpRevert() {
    if (!_cp) return;
    if (_cp.targets) {
      _cp.targets.forEach(t => { if (t.input.value !== t.orig) { t.input.value = t.orig; t.input.dispatchEvent(new Event('input', { bubbles: true })); } });
    } else {
      _cp.hsv = cpRgbToHsv(cpHexToRgb(_cp.orig));
      cpEmit('input');
    }
    closeColorPicker(false);
  }
  // 拖动取色器：按住顶部的横条（或顶部一行的空白处）移动，跟 CSS 编辑小窗一样
  function cpBindMove(el) {
    const startDrag = (e) => {
      if (e.button != null && e.button !== 0) return;
      const r0 = el.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY;
      e.preventDefault();
      const handle = e.currentTarget;
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      el.classList.add('be-cp-moving');
      const mv = (ev) => {
        const vw = mainWin.innerWidth, vh = mainWin.innerHeight;
        const left = cpClamp(r0.left + ev.clientX - sx, 4 - r0.width + 60, vw - 60);
        const top = cpClamp(r0.top + ev.clientY - sy, 0, vh - 40);
        el.style.left = (left + (mainWin.scrollX || 0)) + 'px';
        el.style.top = (top + (mainWin.scrollY || 0)) + 'px';
      };
      const up = () => {
        el.classList.remove('be-cp-moving');
        handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up);
      };
      handle.addEventListener('pointermove', mv);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    };
    const grip = el.querySelector('.be-cp-grip');
    if (grip) { grip.style.touchAction = 'none'; grip.addEventListener('pointerdown', startDrag); }
    const top = el.querySelector('.be-cp-top');
    if (top) top.addEventListener('pointerdown', (e) => {
      if (e.target !== top) return;   // 只认顶部一行的空白处，色块/输入框/按钮照常
      startDrag(e);
    });
  }
  function cpSwitchTarget(i) {
    if (!_cp || !_cp.targets || !_cp.targets[i]) return;
    _cp.ti = i;
    const t = _cp.targets[i];
    _cp.input = t.input;
    _cp.orig = t.orig;
    _cp.hsv = cpRgbToHsv(cpHexToRgb(t.input.value) || cpHexToRgb(t.orig));
    renderColorPicker();
  }
  // 只刷新数值/拇指位置，不重建 DOM（拖动中重建会丢 pointer capture）
  function cpSync(skipHexInput) {
    if (!_cp) return;
    const el = _cp.el, { h, s, v } = _cp.hsv;
    const hex = cpCurrentHex();
    const rgb = cpHsvToRgb(_cp.hsv);
    const pure = cpRgbToHex(cpHsvToRgb({ h, s: 1, v: 1 }));
    el.style.setProperty('--cp-hue', pure);
    el.style.setProperty('--cp-color', hex);
    el.style.setProperty('--cp-full', cpRgbToHex(cpHsvToRgb({ h, s, v: 1 })));
    const nw = el.querySelector('.be-cp-new'); if (nw) nw.style.background = hex;
    const hexIn = el.querySelector('.be-cp-hex');
    if (hexIn && !skipHexInput) hexIn.value = hex.slice(1).toUpperCase();
    const sv = el.querySelector('.be-cp-sv-thumb'); if (sv) { sv.style.left = (s * 100) + '%'; sv.style.top = ((1 - v) * 100) + '%'; }
    const hu = el.querySelector('.be-cp-hue-thumb'); if (hu) hu.style.left = (h / 360 * 100) + '%';
    const dt = el.querySelector('.be-cp-disc-thumb');
    if (dt) { const a = h * Math.PI / 180; dt.style.left = (50 + Math.sin(a) * s * 50) + '%'; dt.style.top = (50 - Math.cos(a) * s * 50) + '%'; }
    const dshade = el.querySelector('.be-cp-disc-shade'); if (dshade) dshade.style.opacity = String(1 - v);
    const vt = el.querySelector('.be-cp-val-thumb'); if (vt) vt.style.left = (v * 100) + '%';
    const vals = { h: Math.round(h), s: Math.round(s * 100), b: Math.round(v * 100), r: Math.round(rgb.r), g: Math.round(rgb.g), bl: Math.round(rgb.b) };
    // 参数条的轨道直接画出该通道从 0 到满的颜色变化
    const hx = (o) => cpRgbToHex(cpHsvToRgb({ h, s, v, ...o }));
    const rx = (o) => cpRgbToHex({ r: rgb.r, g: rgb.g, b: rgb.b, ...o });
    const tracks = {
      h: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
      s: `linear-gradient(to right, ${hx({ s: 0 })}, ${hx({ s: 1 })})`,
      b: `linear-gradient(to right, #000, ${hx({ v: 1 })})`,
      r: `linear-gradient(to right, ${rx({ r: 0 })}, ${rx({ r: 255 })})`,
      g: `linear-gradient(to right, ${rx({ g: 0 })}, ${rx({ g: 255 })})`,
      bl: `linear-gradient(to right, ${rx({ b: 0 })}, ${rx({ b: 255 })})`
    };
    el.querySelectorAll('.be-cp-param').forEach(row => {
      const k = row.getAttribute('data-k');
      const rng = row.querySelector('input[type=range]'), num = row.querySelector('.be-cp-num');
      if (rng) rng.style.background = tracks[k];
      if (rng && mainDoc.activeElement !== rng) rng.value = vals[k];
      if (num && mainDoc.activeElement !== num) num.value = vals[k];
    });
    el.querySelectorAll('.be-cp-sw').forEach(sw => sw.classList.toggle('active', sw.getAttribute('data-c') === hex));
  }
  function cpSetHsv(hsv, emit = true) {
    _cp.hsv = { h: cpClamp(hsv.h, 0, 359.999), s: cpClamp(hsv.s, 0, 1), v: cpClamp(hsv.v, 0, 1) };
    cpSync();
    if (emit) cpEmit('input');
  }
  function cpSetHex(hex, emit = true) {
    const rgb = cpHexToRgb(hex);
    if (!rgb) return false;
    const hsv = cpRgbToHsv(rgb);
    if (!hsv.s) hsv.h = _cp.hsv.h;   // 灰色没有色相，保留原色相，免得色相条跳回红色
    _cp.hsv = hsv;
    cpSync(true);
    if (emit) cpEmit('input');
    return true;
  }
  // 在一块区域上拖动：fn(x0..1, y0..1)
  function cpDrag(area, fn) {
    area.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { area.setPointerCapture(e.pointerId); } catch (err) {}
      const go = ev => { const r = area.getBoundingClientRect(); fn(cpClamp((ev.clientX - r.left) / r.width, 0, 1), cpClamp((ev.clientY - r.top) / r.height, 0, 1)); };
      go(e);
      const mv = ev => go(ev);
      const up = () => { area.removeEventListener('pointermove', mv); area.removeEventListener('pointerup', up); area.removeEventListener('pointercancel', up); };
      area.addEventListener('pointermove', mv);
      area.addEventListener('pointerup', up);
      area.addEventListener('pointercancel', up);
    });
    area.style.touchAction = 'none';
  }
  function renderColorPicker() {
    const el = _cp.el, tab = _cp.tab;
    const swatch = c => `<button type="button" class="be-cp-sw" data-c="${c}" style="background:${c}" title="${c}"></button>`;
    const recent = (settings.recentColors || []).filter(c => cpHexToRgb(c));
    const mine = (settings.savedSwatches || []).filter(c => cpHexToRgb(c));
    const paletteAll = [];
    Object.values(PALETTE_SCHEMES).forEach(p => p.colors.forEach(c => { if (!paletteAll.includes(c)) paletteAll.push(c); }));
    const cardBgs = COLOR_PRESETS.map(p => p.bg).filter((c, i, a) => a.indexOf(c) === i);
    const param = (k, label, max) => `
      <div class="be-cp-param" data-k="${k}">
        <span class="be-cp-plabel">${label}</span>
        <input type="range" min="0" max="${max}" step="1">
        <input type="number" class="be-cp-num" min="0" max="${max}" step="1">
      </div>`;
    let body = '';
    if (tab === 'classic') {
      body = `
        <div class="be-cp-sv"><span class="be-cp-sv-thumb"></span></div>
        <div class="be-cp-hue"><span class="be-cp-hue-thumb"></span></div>`;
    } else if (tab === 'disc') {
      body = `
        <div class="be-cp-disc"><span class="be-cp-disc-shade"></span><span class="be-cp-disc-thumb"></span></div>
        <div class="be-cp-val"><span class="be-cp-val-thumb"></span></div>`;
    } else if (tab === 'value') {
      body = `
        <div class="be-cp-params">
          ${param('h', 'H', 360)}${param('s', 'S', 100)}${param('b', 'B', 100)}
          <div class="be-cp-psep"></div>
          ${param('r', 'R', 255)}${param('g', 'G', 255)}${param('bl', 'B', 255)}
        </div>`;
    } else {
      body = `
        <div class="be-cp-pal">
          <div class="be-cp-pal-h">最近使用</div>
          <div class="be-cp-sws">${recent.length ? recent.map(swatch).join('') : '<span class="be-cp-empty">暂无最近使用的颜色</span>'}</div>
          <div class="be-cp-pal-h">我的色板 <button type="button" class="be-cp-add" title="把当前颜色加入色板"><i class="fa-solid fa-plus"></i></button>${mine.length ? '<span class="be-cp-pal-tip">长按删除</span>' : ''}</div>
          <div class="be-cp-sws" data-mine="1">${mine.length ? mine.map(swatch).join('') : '<span class="be-cp-empty">点 + 保存当前颜色</span>'}</div>
          <div class="be-cp-pal-h">划线色系</div>
          <div class="be-cp-sws">${paletteAll.map(swatch).join('')}</div>
          <div class="be-cp-pal-h">卡片配色</div>
          <div class="be-cp-sws">${cardBgs.map(swatch).join('')}</div>
        </div>`;
    }
    const canEye = typeof mainWin.EyeDropper === 'function';
    const tg = _cp.targets;
    const curT = tg ? tg[_cp.ti] : null;
    const autoOn = !!(curT && curT.auto && curT.auto.get());
    el.innerHTML = `
      <div class="be-cp-grip" title="按住拖动"></div>
      ${tg ? `<div class="be-cp-targets">
        <div class="be-cp-tseg">${tg.map((t, i) => `<button type="button" data-ti="${i}" class="${i === _cp.ti ? 'active' : ''}"><span class="be-cp-tdot" style="background:${escapeHtml(t.input.value)}"></span>${escapeHtml(t.label)}</button>`).join('')}</div>
        ${curT && curT.auto ? `<button type="button" class="be-cp-auto ${autoOn ? 'active' : ''}" title="按背景明暗自动选深色或浅色文字">自动</button>` : ''}
      </div>` : ''}
      <div class="be-cp-top">
        <span class="be-cp-cmp"><span class="be-cp-old" style="background:${_cp.orig}" title="原颜色（点击恢复）"></span><span class="be-cp-new"></span></span>
        <label class="be-cp-hexwrap">#<input class="be-cp-hex" maxlength="7" spellcheck="false" autocomplete="off"></label>
        ${canEye ? '<button type="button" class="be-cp-ico be-cp-eye" title="从屏幕取色"><i class="fa-solid fa-eye-dropper"></i></button>' : ''}
        <button type="button" class="be-cp-ico be-cp-ok" title="完成"><i class="fa-solid fa-check"></i></button>
      </div>
      <div class="be-cp-body">${body}</div>
      <div class="be-cp-tabs">
        ${[['classic', '经典'], ['disc', '色盘'], ['value', '参数'], ['palette', '调色板']].map(([k, n]) => `<button type="button" data-tab="${k}" class="${tab === k ? 'active' : ''}">${n}</button>`).join('')}
      </div>`;
    // 事件
    el.querySelectorAll('.be-cp-tseg button').forEach(b => b.addEventListener('click', () => cpSwitchTarget(+b.getAttribute('data-ti'))));
    el.querySelector('.be-cp-auto')?.addEventListener('click', () => {
      curT.auto.set(!curT.auto.get());
      renderColorPicker();
    });
    cpBindMove(el);
    el.querySelectorAll('.be-cp-tabs button').forEach(b => b.addEventListener('click', () => {
      _cp.tab = b.getAttribute('data-tab');
      settings.colorPickerTab = _cp.tab;
      renderColorPicker();
    }));
    el.querySelector('.be-cp-ok').addEventListener('click', () => closeColorPicker(true));
    el.querySelector('.be-cp-old').addEventListener('click', () => cpSetHex(_cp.orig));
    const hexIn = el.querySelector('.be-cp-hex');
    hexIn.addEventListener('input', () => {
      const v = hexIn.value.replace(/[^0-9a-f#]/gi, '');
      if (v !== hexIn.value) hexIn.value = v;
      const raw = v.replace(/^#/, '');
      if (raw.length === 6 || raw.length === 3) cpSetHex(raw);
    });
    hexIn.addEventListener('paste', e => {
      const t = (e.clipboardData && e.clipboardData.getData('text')) || '';
      const m = t.match(/#?([0-9a-f]{6}|[0-9a-f]{3})\b/i);
      if (m) { e.preventDefault(); hexIn.value = m[1].toUpperCase(); cpSetHex(m[1]); }
    });
    hexIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); closeColorPicker(true); } });
    hexIn.addEventListener('blur', () => cpSync());
    el.querySelector('.be-cp-eye')?.addEventListener('click', async () => {
      try { const res = await new mainWin.EyeDropper().open(); if (res && res.sRGBHex) cpSetHex(res.sRGBHex); } catch (e) {}
    });
    const sv = el.querySelector('.be-cp-sv');
    if (sv) cpDrag(sv, (x, y) => cpSetHsv({ h: _cp.hsv.h, s: x, v: 1 - y }));
    const hue = el.querySelector('.be-cp-hue');
    if (hue) cpDrag(hue, (x) => cpSetHsv({ h: x * 360, s: _cp.hsv.s, v: _cp.hsv.v }));
    const disc = el.querySelector('.be-cp-disc');
    if (disc) cpDrag(disc, (x, y) => {
      const dx = x - 0.5, dy = y - 0.5;
      let ang = Math.atan2(dx, -dy) * 180 / Math.PI; if (ang < 0) ang += 360;
      cpSetHsv({ h: ang, s: Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2), v: _cp.hsv.v });
    });
    const val = el.querySelector('.be-cp-val');
    if (val) cpDrag(val, (x) => cpSetHsv({ h: _cp.hsv.h, s: _cp.hsv.s, v: x }));
    el.querySelectorAll('.be-cp-param').forEach(row => {
      const k = row.getAttribute('data-k');
      const apply = (n) => {
        n = Number(n); if (!isFinite(n)) return;
        if (k === 'h' || k === 's' || k === 'b') {
          const hsv = { ..._cp.hsv };
          if (k === 'h') hsv.h = n; else if (k === 's') hsv.s = n / 100; else hsv.v = n / 100;
          cpSetHsv(hsv);
        } else {
          const rgb = cpHsvToRgb(_cp.hsv);
          const next = { r: rgb.r, g: rgb.g, b: rgb.b };
          next[k === 'bl' ? 'b' : k] = n;
          cpSetHex(cpRgbToHex(next));
          cpSync();
        }
      };
      row.querySelector('input[type=range]').addEventListener('input', e => apply(e.target.value));
      row.querySelector('.be-cp-num').addEventListener('change', e => apply(e.target.value));
    });
    el.querySelectorAll('.be-cp-sw').forEach(sw => {
      sw.addEventListener('click', () => { if (sw._beLong) { sw._beLong = false; return; } cpSetHex(sw.getAttribute('data-c')); cpSync(); });
      if (sw.parentElement.getAttribute('data-mine')) {
        let t = 0;
        const cancel = () => { if (t) { clearTimeout(t); t = 0; } };
        sw.addEventListener('pointerdown', () => {
          cancel();
          t = setTimeout(() => {
            t = 0; sw._beLong = true;
            settings.savedSwatches = (settings.savedSwatches || []).filter(c => c !== sw.getAttribute('data-c'));
            saveSettings(settings);
            renderColorPicker();
          }, 550);
        });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => sw.addEventListener(ev, cancel));
        sw.addEventListener('contextmenu', e => e.preventDefault());
      }
    });
    el.querySelector('.be-cp-add')?.addEventListener('click', () => {
      const hex = cpCurrentHex();
      const list = (settings.savedSwatches || []).filter(c => c !== hex);
      list.push(hex);
      settings.savedSwatches = list.slice(-40);
      saveSettings(settings);
      renderColorPicker();
    });
    cpSync();
  }
  // 捕获阶段拦截：只接管插件自己 UI 里的色块，酒馆原生的 <input type=color> 不碰
  (function bindColorInputIntercept() {
    if (mainWin.__beColorClickFn) {
      mainDoc.removeEventListener('click', mainWin.__beColorClickFn, true);
    }
    mainWin.__beColorClickFn = (e) => {
      const input = e.target && e.target.closest ? e.target.closest('input[type="color"]') : null;
      if (!input || input.disabled || !input.closest(CP_SCOPE)) return;
      e.preventDefault();
      e.stopPropagation();
      openColorPicker(input);
    };
    mainDoc.addEventListener('click', mainWin.__beColorClickFn, true);
  })();

  // ---------- 工具 ----------
  function toast(msg, type = 'info') {
    try {
      const t = mainWin.toastr;
      if (t && t[type]) t[type](msg, '', { timeOut: 2200, positionClass: 'toast-top-center' });
    } catch (e) {}
  }
  // 横向滚动行（模板/字体/配色 chip 行）：手机靠手指横滑没问题，但 PC 上鼠标滚轮只会纵向滚、
  // 部分浏览器/主题又把滚动条隐藏了，结果右边的 chip 根本够不着（用户反馈）。
  // 这里补两样：滚轮纵向→横向；鼠标按住拖动。拖动超过阈值后吞掉那一下 click，免得松手时误选 chip。
  function enableHScroll(el) {
    if (!el || el._beHScroll) return;
    el._beHScroll = true;
    el.addEventListener('wheel', (e) => {
      if (el.scrollWidth <= el.clientWidth + 1) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;   // 触控板横向手势浏览器自己会处理
      const max = el.scrollWidth - el.clientWidth;
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max - 1)) return; // 到头了让外层继续纵向滚
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }, { passive: false });
    let down = null, dragged = false;
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = { x: e.clientX, left: el.scrollLeft };
      dragged = false;
    });
    el.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (!dragged && Math.abs(dx) > 5) {
        dragged = true;
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
        el.classList.add('be-hs-dragging');
      }
      if (dragged) el.scrollLeft = down.left - dx;
    });
    const end = (e) => {
      if (!down) return;
      down = null;
      el.classList.remove('be-hs-dragging');
      try { el.releasePointerCapture(e.pointerId); } catch (err) {}
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('click', (e) => {
      if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; }
    }, true);
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
  // over：编辑出处弹窗里还没保存的值 {maskUser, maskChar, sourceUser, sourceAuthor}，用来让 chip 立刻跟着勾选变化
  function buildMaskTargets(over) {
    const names = [];
    const push = n => { const v = (n == null ? '' : String(n)).trim(); if (v) names.push(v); };
    const mUser = over ? over.maskUser : settings.maskUser;
    const mChar = over ? over.maskChar : settings.maskChar;
    if (mUser || mChar) {
      const ctx = getContext();
      const src = over || getSourceValues();
      if (mUser) { push(ctx.userName); push(src.sourceUser); }
      if (mChar) { push(ctx.charName); push(src.sourceAuthor); }
    }
    maskExtraWords().forEach(w => names.push(w));
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
  function maskWordOverride(name) {
    const map = (settings.maskWordStyle && typeof settings.maskWordStyle === 'object') ? settings.maskWordStyle : {};
    const ov = map[String(name)];
    return (ov && ['block', 'symbol', 'custom'].includes(ov.style)) ? ov : null;
  }
  function maskGlyph(name) {
    const ov = maskWordOverride(name);
    const style = (ov && ov.style) || settings.maskStyle || 'block';
    const len = Math.max(1, [...String(name)].length);
    const wAttr = `data-mask-word="${escapeHtml(name)}"`;
    if (style === 'symbol' || style === 'custom') {
      const customChar = (ov && ov.char) || settings.maskCustomChar || '';
      const sym = (style === 'custom' ? ([...String(customChar).trim()][0]) : '') || '●';
      return `<span class="be-mask be-mask-${style}" ${wAttr}>${escapeHtml(sym.repeat(len))}</span>`;
    }
    return `<span class="be-mask be-mask-block" ${wAttr} style="width:${visualEmWidth(name)}em"></span>`;
  }
  function maskExtraWords() {
    return String(settings.maskExtra || '').split(/[,，、;；\s]+/).map(w => w.trim()).filter(Boolean);
  }
  // ---- 打码词 chip：每个要打码的词一枚，点开可单独指定样式（设置面板和编辑出处共用） ----
  const MASK_STYLE_NAMES = { block: '涂黑', symbol: '符号', custom: '自定义' };
  function maskChipsHtml(openWord, over) {
    const targets = buildMaskTargets(over);
    if (!targets.length) return `<div class="be-mask-chips-empty">还没有要打码的词</div>`;
    const extra = new Set(maskExtraWords());
    const chips = targets.map(w => {
      const ov = maskWordOverride(w);
      const tag = ov ? MASK_STYLE_NAMES[ov.style] : '默认';
      return `<button type="button" class="be-mask-chip${ov ? ' custom' : ''}${w === openWord ? ' open' : ''}" data-w="${escapeHtml(w)}">${escapeHtml(w)}<em>${tag}</em></button>`;
    }).join('');
    let menu = '';
    if (openWord && targets.includes(openWord)) {
      const ov = maskWordOverride(openWord);
      const cur = ov ? ov.style : '';
      const opt = (v, label) => `<button type="button" class="be-radio-opt ${cur === v ? 'active' : ''}" data-ms="${v}">${label}</button>`;
      menu = `<div class="be-mask-chip-menu" data-w="${escapeHtml(openWord)}">
        <div class="be-radio-group">${opt('', '默认')}${opt('block', '涂黑')}${opt('symbol', '符号')}${opt('custom', '自定义')}</div>
        ${cur === 'custom' ? `<input type="text" class="be-mask-chip-char" maxlength="2" placeholder="符号" value="${escapeHtml((ov && ov.char) || '')}">` : ''}
        ${extra.has(openWord) ? `<button type="button" class="be-mask-chip-del" title="不再打码这个词"><i class="fa-solid fa-trash-can"></i></button>` : ''}
      </div>`;
    }
    return `<div class="be-mask-chips">${chips}</div>${menu}`;
  }
  function setMaskWordStyle(word, style, ch) {
    if (!settings.maskWordStyle || typeof settings.maskWordStyle !== 'object') settings.maskWordStyle = {};
    if (!style) delete settings.maskWordStyle[word];
    else settings.maskWordStyle[word] = { style, char: style === 'custom' ? (ch != null ? ch : ((settings.maskWordStyle[word] || {}).char || '')) : '' };
  }
  function removeMaskExtraWord(word) {
    settings.maskExtra = maskExtraWords().filter(w => w !== word).join('，');
    if (settings.maskWordStyle) delete settings.maskWordStyle[word];
  }
  // box：chip 容器；onChange：改完要做的事（刷新卡片/同步输入框）
  function bindMaskChips(box, onChange, getOver) {
    if (!box || box._beChips) return;
    box._beChips = true;
    let openWord = '';
    const render = () => { box.innerHTML = maskChipsHtml(openWord, getOver ? getOver() : undefined); };
    box._beRender = render;
    box.addEventListener('click', (e) => {
      const chip = e.target.closest('.be-mask-chip');
      if (chip) { const w = chip.getAttribute('data-w'); openWord = openWord === w ? '' : w; render(); return; }
      const menu = e.target.closest('.be-mask-chip-menu');
      if (!menu) return;
      const w = menu.getAttribute('data-w');
      const opt = e.target.closest('[data-ms]');
      if (opt) { setMaskWordStyle(w, opt.getAttribute('data-ms')); saveSettings(settings); render(); onChange && onChange(); return; }
      if (e.target.closest('.be-mask-chip-del')) { removeMaskExtraWord(w); openWord = ''; saveSettings(settings); render(); onChange && onChange('extra'); }
    });
    box.addEventListener('input', (e) => {
      const inp = e.target.closest('.be-mask-chip-char');
      if (!inp) return;
      const w = inp.closest('.be-mask-chip-menu').getAttribute('data-w');
      setMaskWordStyle(w, 'custom', inp.value.trim());
      saveSettings(settings);
      onChange && onChange();
    });
    render();
  }
  // 卡片预览里直接加一个打码词：不重建卡片（重建会冲掉二次标注），就地把正文里的这个词换成打码块
  function maskWordInCard(word) {
    const w = String(word || '').trim();
    if (!w) return;
    const card = mainDoc.getElementById('be-card');
    if (!buildMaskTargets().includes(w)) {
      const list = maskExtraWords();
      list.push(w);
      settings.maskExtra = list.join('，');
    }
    if (!settings.maskOn) settings.maskOn = true;
    saveSettings(settings);
    if (!card) return;
    // 想法/正文都要处理；不碰出处（出处的名字由「打码出处中的名字」开关管）
    card.querySelectorAll('.be-quote, .be-thought-main, .be-quote-orig').forEach(root => replaceWordInDom(root, w));
  }
  function replaceWordInDom(root, word) {
    const doc = root.ownerDocument;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement && n.parentElement.closest('.be-mask') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) if (n.nodeValue.includes(word)) nodes.push(n);
    nodes.forEach(tn => {
      const parts = tn.nodeValue.split(word);
      const frag = doc.createDocumentFragment();
      parts.forEach((part, i) => {
        if (part) frag.appendChild(doc.createTextNode(part));
        if (i < parts.length - 1) {
          const tmp = doc.createElement('span');
          tmp.innerHTML = maskGlyph(word);
          frag.appendChild(tmp.firstChild);
        }
      });
      tn.parentNode.replaceChild(frag, tn);
    });
  }
  // 预览里改了某个词的样式 / 取消打码：就地替换已有的打码块
  function restyleMaskInCard(word, unmask) {
    const card = mainDoc.getElementById('be-card');
    if (!card) return;
    card.querySelectorAll('.be-mask[data-mask-word]').forEach(el => {
      if (el.getAttribute('data-mask-word') !== word) return;
      if (unmask) { el.replaceWith(el.ownerDocument.createTextNode(word)); return; }
      const tmp = el.ownerDocument.createElement('span');
      tmp.innerHTML = maskGlyph(word);
      el.replaceWith(tmp.firstChild);
    });
    try { card.querySelectorAll('.be-quote, .be-thought-main, .be-quote-orig').forEach(r => r.normalize()); } catch (e) {}
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
  const imgPut = (key, rec) => imgTx('readwrite', s => s.put(rec, key)).then(r => { try { mirrorImage(key, rec); } catch (e) {} return r; });
  const imgGet = (key) => imgTx('readonly', s => s.get(key));
  const imgDel = (key) => imgTx('readwrite', s => s.delete(key)).catch(() => {}).then(() => { try { mirrorImageDelete(key); } catch (e) {} });
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

  function stContext() {
    try { return (mainWin.SillyTavern && mainWin.SillyTavern.getContext) ? mainWin.SillyTavern.getContext() : null; } catch (e) { return null; }
  }
  // 笔记位置文字：存档名 · 第 N 楼 · 第 M 个回复版本
  function noteLocationText(note, withChat = true) {
    const parts = [];
    if (withChat && note.chatId) parts.push(note.chatId);
    if (note.msgId !== undefined && note.msgId !== '' && !isNaN(parseInt(note.msgId))) parts.push(`第 ${parseInt(note.msgId) + 1} 楼`);
    if (Number.isInteger(note.swipeId) && note.swipeId > 0) parts.push(`swipe ${note.swipeId + 1}`);
    return parts.join(' · ');
  }
  function canJumpToNote(note) {
    return !!note && note.msgId !== undefined && note.msgId !== '' && !isNaN(parseInt(note.msgId));
  }
  // 通用确认框（居中）：不用 window.confirm——部分手机浏览器/WebView 会静默吞掉它，表现成「点了没反应」。
  // opts.remember 给出文字时多一个「以后不再提醒」勾选；resolve({ ok, remember })
  function beConfirm({ title = '', text = '', okText = '确定', cancelText = '取消', remember = '' } = {}) {
    return new Promise(resolve => {
      mainDoc.getElementById('be-confirm-mask')?.remove();
      const mask = stampGen(mainDoc.createElement('div'));
      mask.id = 'be-confirm-mask';
      mask.className = 'be-import-tpl-mask open';
      mask.innerHTML = `
        <div class="be-import-tpl-box be-confirm-box">
          ${title ? `<div class="be-src-title">${escapeHtml(title)}</div>` : ''}
          <div class="be-confirm-text">${escapeHtml(text)}</div>
          ${remember ? `<label class="be-confirm-remember"><input type="checkbox" id="be-confirm-remember"> ${escapeHtml(remember)}</label>` : ''}
          <div class="be-src-actions">
            <button class="be-btn" data-ok="0">${escapeHtml(cancelText)}</button>
            <button class="be-btn primary" data-ok="1">${escapeHtml(okText)}</button>
          </div>
        </div>`;
      mainDoc.body.appendChild(mask);
      detectAndApplyTheme();
      const done = (ok) => {
        const rem = !!mask.querySelector('#be-confirm-remember')?.checked;
        mask.remove();
        resolve({ ok, remember: ok && rem });
      };
      mask.addEventListener('click', e => {
        if (e.target === mask) return done(false);
        const b = e.target.closest('[data-ok]');
        if (b) done(b.getAttribute('data-ok') === '1');
      });
    });
  }
  function beWait(cond, ms = 4000, step = 100) {
    return new Promise(resolve => {
      const t0 = Date.now();
      const tick = () => {
        let v = false;
        try { v = cond(); } catch (e) {}
        if (v) return resolve(v);
        if (Date.now() - t0 >= ms) return resolve(null);
        setTimeout(tick, step);
      };
      tick();
    });
  }
  // 跳回原楼层：同聊天直接跳；别的聊天/别的角色先确认（可勾「以后不再提醒」）再切过去。
  // 楼层没渲染（酒馆只显示最近若干楼）时用 /chat-jump 让酒馆自己加载再滚过去。
  async function jumpToNote(note, charKey) {
    if (!canJumpToNote(note)) { toast('这条笔记没有记录楼层，无法跳转', 'info'); return; }
    const raw = stContext();
    const ctx = getContext();
    const notes = loadNotes();
    const key = charKey || note.charKey;
    // 聊天名一样就是同一个聊天，不再比角色：群聊里 charKey 记的是当时说话的角色名，比角色会误判成「别的角色」
    const sameChat = !!note.chatId && note.chatId === ctx.chatId;
    // 群聊笔记：按聊天名找所在群聊
    const group = (!sameChat && note.chatId && Array.isArray(raw?.groups)) ? raw.groups.find(g => g && Array.isArray(g.chats) && g.chats.includes(note.chatId)) : null;
    const otherChar = !sameChat && !group && !!key && key !== (ctx.charKey || 'unknown');
    const otherChat = !sameChat && !!note.chatId && note.chatId !== ctx.chatId;
    if (group && raw.groupId !== group.id) { toast(`这条在群聊「${group.name || note.chatId}」里，请先打开这个群聊再跳`, 'warning'); return; }
    if (otherChar || otherChat) {
      const name = group ? (group.name || note.chatId) : ((notes[key] && notes[key].name) || key);
      let chIdx = -1;
      if (otherChar) {
        chIdx = Array.isArray(raw?.characters) ? raw.characters.findIndex(c => c && c.avatar === key) : -1;
        if (chIdx < 0 || typeof raw?.selectCharacterById !== 'function') { toast(`找不到角色「${name}」，可能已被删除或改名`, 'warning'); return; }
      }
      const openFn = group ? raw?.openGroupChat : raw?.openCharacterChat;
      if (note.chatId && typeof openFn !== 'function') { toast(`这条在聊天「${note.chatId}」里，请先打开那个聊天`, 'warning'); return; }
      if (!settings.jumpNoConfirm) {
        const where = otherChar ? `角色「${name}」的聊天「${note.chatId || '（未知）'}」` : `聊天「${note.chatId}」`;
        const r = await beConfirm({ title: '跳到原文', text: `这条在${where}里，要切换过去吗？`, okText: '切换过去', remember: '以后不再提醒' });
        if (!r.ok) return;
        if (r.remember) { settings.jumpNoConfirm = true; saveSettings(settings); }
      }
      closePanel();
      mainDoc.getElementById('be-viewer-mask')?.classList.remove('open');
      try {
        if (otherChar) {
          await raw.selectCharacterById(chIdx);
          if (!await beWait(() => getContext().charKey === key, 6000)) { toast('切换角色失败，酒馆可能正在保存或生成', 'warning'); return; }
        }
        if (note.chatId && getContext().chatId !== note.chatId) {
          if (group) await stContext().openGroupChat(group.id, note.chatId);
          else await stContext().openCharacterChat(note.chatId);
          if (!await beWait(() => getContext().chatId === note.chatId, 6000)) { toast(`没能打开聊天「${note.chatId}」，可能已被删除或改名`, 'warning'); return; }
        }
      } catch (e) { toast('打开聊天失败：' + (e?.message || e), 'error'); return; }
      await new Promise(r => setTimeout(r, 500));
    }
    await jumpToFloor(note, key, true);
  }

  // 比对原文用的归一化：去掉标签、markdown 符号和所有空白，只留文字本身
  function jumpNorm(str) {
    return String(str || '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
      .replace(/[*_~`#>|]/g, '')
      .replace(/\s+/g, '');
  }
  // 在聊天数据里找这条笔记的原文：先查记录的那一楼的所有 swipe，再从近到远查其它楼层，找到即停
  function locateNoteInChat(note) {
    const chat = stContext()?.chat;
    if (!Array.isArray(chat) || !chat.length) return null;
    const segs = Array.isArray(note.segments) && note.segments.length ? note.segments : [note.text];
    // 取最长的一段做关键字，太长的截前 60 字（够唯一，也少受首尾格式差异影响）
    const needle = jumpNorm(segs.reduce((x, y) => (String(y || '').length > String(x || '').length ? y : x), '')).slice(0, 60);
    if (!needle) return null;
    // 先用原文里直接搜两小段做快速筛选，命中了才做完整的归一化比对（长聊天里能省掉绝大部分开销）
    const chunks = needle.length > 12 ? [needle.slice(0, 6), needle.slice(-6)] : [needle];
    const has = str => { str = String(str || ''); return chunks.some(c => str.includes(c)) && jumpNorm(str).includes(needle); };
    const floorHit = i => {
      const m = chat[i];
      if (!m) return null;
      const cur = Number.isInteger(m.swipe_id) ? m.swipe_id : 0;
      if (has(m.mes)) return { floor: i, swipe: cur, cur };
      if (Array.isArray(m.swipes)) {
        for (let k = 0; k < m.swipes.length; k++) {
          if (k !== cur && has(m.swipes[k])) return { floor: i, swipe: k, cur };
        }
      }
      return null;
    };
    const start = Math.min(Math.max(parseInt(note.msgId) || 0, 0), chat.length - 1);
    for (let d = 0; d < chat.length; d++) {
      const r1 = floorHit(start - d) || (d ? floorHit(start + d) : null);
      if (r1) return r1;
      if (start - d < 0 && start + d >= chat.length) break;
    }
    return null;
  }
  // 这一楼里（含状态栏 iframe）找划线 span
  function findNoteSpans(mes, id) {
    const sel = `.be-highlight[data-be-id="${id}"]`;
    let list = Array.from(mes.querySelectorAll(sel));
    if (!list.length) {
      mes.querySelectorAll('iframe').forEach(f => {
        const d = frameSelDoc(f);
        if (d) try { list = list.concat(Array.from(d.querySelectorAll(sel))); } catch (e) {}
      });
    }
    return list.length ? list : null;
  }
  // 划线在收起的 <details> 里：展开它；其它隐藏（display:none 等）就返回最近的可见祖先
  function revealSpan(sp) {
    let n = sp.parentElement, opened = false;
    while (n) {
      if (n.tagName === 'DETAILS' && !n.open) { n.open = true; opened = true; }
      n = n.parentElement;
    }
    if (sp.getClientRects().length) return { el: sp, opened, hidden: false };
    let up = sp.parentElement;
    while (up && !up.getClientRects().length) up = up.parentElement;
    return { el: up || sp, opened, hidden: true };
  }
  async function waitScrollStill() {
    const sc = mainDoc.getElementById('chat');
    if (!sc) return;
    let last = -1, still = 0;
    await beWait(() => {
      const v = sc.scrollTop;
      still = (v === last) ? still + 1 : 0;
      last = v;
      return still >= 2;
    }, 1200, 60);
  }
  async function scrollToMes(mesId) {
    let mes = mainDoc.querySelector(`#chat .mes[mesid="${mesId}"]`);
    if (!mes && typeof stContext()?.executeSlashCommandsWithOptions === 'function') {
      try { await stContext().executeSlashCommandsWithOptions(`/chat-jump ${mesId}`); } catch (e) {}
      mes = await beWait(() => mainDoc.querySelector(`#chat .mes[mesid="${mesId}"]`), 2500);
      if (mes) mes.classList.remove('flash', 'animated');
    }
    return mes;
  }
  async function jumpToFloor(note, key, allowRelocate) {
    const mesId = parseInt(note.msgId);
    const chat = stContext()?.chat;
    closePanel();
    mainDoc.getElementById('be-viewer-mask')?.classList.remove('open');
    const mes = (Array.isArray(chat) && mesId >= chat.length) ? null : await scrollToMes(mesId);
    // 先主动还原一次：消息刚加载出来或内容刚变过时，划线可能还没包上
    if (mes) { try { restoreHighlights(); } catch (e) {} }
    // 划线是消息渲染后异步还原的：等它出现，再把「划线本身」滚到屏幕中间（长消息里只滚楼层会差一大截）
    const spans = mes ? await beWait(() => findNoteSpans(mes, note.id), 1500) : null;
    if (spans) {
      const rv = revealSpan(spans[0]);
      try { rv.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { rv.el.scrollIntoView(); }
      if (rv.hidden) { toast('这条划线在隐藏的内容里，已定位到所在位置', 'info'); return; }
      // 平滑滚动途中闪会看不到：等聊天区滚动停下（最多 1.2 秒）再闪一下
      await waitScrollStill();
      spans.forEach(sp => { sp.classList.remove('be-jump-flash'); void sp.offsetWidth; sp.classList.add('be-jump-flash'); });
      setTimeout(() => spans.forEach(sp => sp.classList.remove('be-jump-flash')), 900);
      if (rv.opened) toast('这条划线在折叠内容里，已展开', 'info');
      return;
    }
    // 页面上没找到划线：到聊天数据里按原文查它实际在哪一楼、哪个回复版本
    const hit = locateNoteInChat(note);
    if (!hit) {
      if (mes) { try { mes.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) {} }
      toast(`当前聊天中找不到这条划线的原文，可能已被编辑或删除（记录的楼层：第 ${mesId + 1} 楼）`, 'warning');
      return;
    }
    if (hit.floor !== mesId) {
      // 楼层号变了（前面有楼层被删除）：更正笔记里记录的楼层，再跳一次
      updateNote(key, note.id, { msgId: String(hit.floor), ...(hit.swipe === hit.cur ? {} : { swipeId: hit.swipe }) });
      note.msgId = String(hit.floor);
      if (hit.swipe === hit.cur && allowRelocate) {
        toast(`楼层号已变化，原文现位于第 ${hit.floor + 1} 楼，已更正记录`, 'info');
        try { restoreHighlights(); } catch (e) {}
        return jumpToFloor(note, key, false);
      }
    }
    const target = await scrollToMes(hit.floor);
    if (target) { try { target.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) {} }
    if (hit.swipe !== hit.cur) {
      toast(`原文位于第 ${hit.floor + 1} 楼的另一个回复版本（第 ${hit.swipe + 1} 个 swipe），当前显示第 ${hit.cur + 1} 个`, 'info');
      return;
    }
    // 原文就在当前版本里，但页面上没标出划线
    const inFrame = target && Array.from(target.querySelectorAll('iframe')).some(f => {
      const d = frameSelDoc(f);
      return d && d.body && jumpNorm(d.body.textContent).includes(jumpNorm(note.text).slice(0, 60));
    });
    toast(inFrame
      ? '原文位于这一楼的状态栏中。状态栏重新渲染后划线不保留，已定位到所在楼层'
      : '原文位于这一楼的当前版本中，但未能标出划线（显示内容可能被正则或格式处理改动过），已定位到所在楼层', 'info');
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
    // 必须写 width/height：没有固有尺寸的 SVG 在 html2canvas 里宽高是 0，导出时波浪线整条消失
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='5' viewBox='0 0 24 5'><path d='M0,2.5 Q6,-0.5 12,2.5 T24,2.5' stroke='${c}' stroke-width='1.2' fill='none' stroke-linecap='round'/></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  function dashDataUri(color) {
    const c = color || '#ffdc6e';
    // 12 宽 viewBox：line 长度 7，间距 5，比浏览器原生 dashed 间距更宽
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='2' viewBox='0 0 12 2'><line x1='0' y1='1' x2='7' y2='1' stroke='${c}' stroke-width='1'/></svg>`;
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
    #be-float-bar, #be-card-hl-bar {
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
    #be-float-bar.show, #be-card-hl-bar.show { display: flex; }
    #be-float-bar [hidden] { display: none !important; }
    /* 默认：工具栏在选区下方时，箭头在工具栏顶部、朝上指向文字 */
    #be-float-bar::after, #be-card-hl-bar::after {
      content: ''; position: absolute;
      top: -5px; left: var(--arrow-left, 50%); transform: translateX(-50%);
      width: 0; height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-bottom: 5px solid var(--be-float-arrow, var(--be-float-bg, #2b2b2b));
    }
    /* 在选区上方时，箭头在工具栏底部、朝下指向文字 */
    #be-float-bar.arrow-bottom::after, #be-card-hl-bar.arrow-bottom::after {
      top: auto; bottom: -5px;
      border-bottom: none;
      border-top: 5px solid var(--be-float-arrow, var(--be-float-bg, #2b2b2b));
    }
    #be-float-bar .be-fbtn, #be-card-hl-bar .be-fbtn {
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
    #be-float-bar .be-fbtn:hover, #be-card-hl-bar .be-fbtn:hover,
    #be-float-bar .be-fbtn:active, #be-card-hl-bar .be-fbtn:active {
      background: rgba(128,128,128,0.18);
    }
    #be-float-bar .be-fbtn svg, #be-card-hl-bar .be-fbtn svg {
      width: 15px; height: 15px;
      stroke: currentColor; fill: none;
      stroke-width: 1.6;
      stroke-linecap: round; stroke-linejoin: round;
    }
    /* 卡片二次高亮的工具条要浮在 #be-mask（书摘卡片弹窗，z-index 2147483630）之上才能点到，
       之前跟 #be-float-bar 共用同一个较低的 z-index，导致弹窗一直挡住它、点了没反应 */
    #be-card-hl-bar { z-index: 2147483640; }
    #be-float-bar .be-fbtn-divider, #be-card-hl-bar .be-fbtn-divider {
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
    /* 样式示意 A/B：统一尺寸的盒子，线/底色都画在盒子内部或伪元素上，不改变盒子大小，保证几个字母等高对齐 */
    .be-hl-sample, .be-chl-ico {
      position: relative; display: inline-block; box-sizing: border-box;
      width: 16px; height: 18px; padding: 0;
      font-size: 14px; font-weight: 600; line-height: 18px; text-align: center;
    }
    .be-hl-sample { color: var(--be-float-fg, #fff); }
    .be-hl-sample.sample-underline::after, .be-chl-ico-u::after {
      content: ''; position: absolute; left: 2px; right: 2px; bottom: 0; height: 2px; background: currentColor;
    }
    .be-hl-sample.sample-bold, .be-chl-ico-b { font-weight: 900; }
    /* 荧光笔示意：只铺字的下半截，颜色跟插件主题色 */
    .be-hl-sample.sample-marker, .be-chl-ico-m {
      background: linear-gradient(to bottom, transparent 60%, var(--be-marker-sample) 60%, var(--be-marker-sample) 88%, transparent 88%);
      --be-marker-sample: color-mix(in srgb, var(--be-accent) 60%, transparent);
    }
    /* 卡片二次高亮的新样式：只改字色，不画线也不铺底 */
    .be-highlight.style-fontcolor { border-bottom: none; background: none; }
    .be-highlight.style-none { border-bottom: none; background: none; }
    .be-chl-top { display: flex; align-items: center; gap: 4px; }
    .be-chl-top .be-chl-sts { display: flex; align-items: center; margin-left: auto; }
    /* 卡片选区工具条上的文字图标（下划线/荧光笔/字色/加粗） */
    .be-chl-ico { display: block; }
    .be-chl-ico-c { color: #e8a0a0; }
    /* 预览里点打码块弹出的样式选择：单行，不要标题栏分隔线 */
    #be-card-hl-pop .be-mask-pop-row { display: flex; align-items: center; gap: 0; padding: 0 2px; }
    #be-card-hl-pop .be-mask-pop-row button {
      background: transparent; border: 0; padding: 6px 9px; cursor: pointer; white-space: nowrap;
      color: var(--be-float-fg, #fff); font-size: 13px; font-family: inherit; letter-spacing: 0.03em;
      -webkit-tap-highlight-color: transparent;
    }
    #be-card-hl-pop .be-mask-pop-row button.active { color: var(--be-accent); font-weight: 600; }
    #be-card-hl-pop .be-mask-pop-row button.danger { color: #ff9b9b; }
    #be-card-hl-pop .be-mask-pop-char {
      width: 44px; box-sizing: border-box; margin: 0 4px; padding: 4px 6px; border-radius: 6px; font-size: 13px; text-align: center;
      background: rgba(255,255,255,0.1); border: 1px solid var(--be-float-divider, rgba(255,255,255,0.2)); color: var(--be-float-fg, #fff);
    }
    .be-chl-ico-mask::after {
      content: ''; position: absolute; left: 2px; right: 2px; top: 4px; bottom: 3px;
      background: currentColor; border-radius: 2px;
    }
    /* 示意图标跟随浮动条字色（浮动条跟随酒馆主题后可能是白底，不能写死白色） */
    .be-hl-sample.sample-wavy::after {
      content: ''; position: absolute; left: 0; right: 0; bottom: -2px; height: 4px;
      background-color: currentColor;
      -webkit-mask: url("${wavyDataUri('#000000')}") repeat-x 0 0 / 16px 4px;
      mask: url("${wavyDataUri('#000000')}") repeat-x 0 0 / 16px 4px;
    }
    /* 卡片高亮弹窗的颜色行居中（内容超宽时仍可横向滚动，用 auto 外边距而不是 justify-content） */
    .be-chl-cols > :first-child { margin-left: auto; }
    .be-chl-cols > :last-child { margin-right: auto; }
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
    .mes_text :where(div, span, p, li, td, th, dd, dt, font, b, i, em, strong, small, u, s, del, ins, mark, sub, sup, label, blockquote, pre, code, h1, h2, h3, h4, h5, h6, section, article, details, summary, q, cite, abbr, a, ruby, rb, rt, time) {
      -webkit-user-select: text !important; user-select: text !important;
    }`}

    /* ===== 划线样式 ===== */
    .be-highlight {
      cursor: pointer;
      padding: 0 1px;
      transition: opacity 0.15s;
    }
    .be-highlight:hover { opacity: 0.8; }
    /* 从笔记本跳回原文时闪两下，方便找到 */
    @keyframes beJumpFlash { 0%, 100% { opacity: 1; } 45% { opacity: 0.2; } }
    .be-highlight.be-jump-flash { animation: beJumpFlash 0.8s ease-in-out 1; }
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
    /* 纯色块 + 不重复铺 + 定高定位（55%~95% 这一段），不用带透明断点的渐变：
       html2canvas 按倍率画渐变/重复铺时会在块的上沿漏出一根细线 */
    .be-highlight.style-marker {
      background-image: linear-gradient(var(--be-line-soft, var(--be-marker-soft)), var(--be-line-soft, var(--be-marker-soft)));
      background-repeat: no-repeat;
      background-size: 100% 40%;
      background-position: 0 91.667%;
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
      background-image: linear-gradient(var(--be-line-soft, var(--be-marker-soft)), var(--be-line-soft, var(--be-marker-soft))) !important;
      background-repeat: no-repeat !important;
      background-size: 100% 40% !important;
      background-position: 0 91.667% !important;
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
    /* 出处字段存档：输入框右侧 ▾，点开在下方列出保存过的值 */
    #be-source-box .be-combo { position: relative; }
    #be-source-box .be-combo input[type=text] { padding-right: 66px; }
    #be-source-box .be-combo-star {
      position: absolute; right: 32px; top: 50%; transform: translateY(-50%);
      width: 30px; height: 30px; border: 0; background: transparent;
      color: var(--be-panel-sub); cursor: pointer; font-size: 12px;
    }
    #be-source-box .be-combo-star.on { color: var(--be-accent); }
    /* 分组折叠 */
    #be-source-box .be-src-group { border-top: 1px solid var(--be-panel-divider); }
    #be-source-box .be-src-group + .be-src-actions { border-top: 1px solid var(--be-panel-divider); padding-top: 14px; }
    #be-source-box .be-src-ghead {
      width: 100%; display: flex; align-items: center; gap: 8px; padding: 11px 2px;
      background: transparent; border: 0; color: inherit; cursor: pointer; font-family: inherit; text-align: left;
    }
    #be-source-box .be-src-gname { font-size: 13px; font-weight: 600; letter-spacing: 0.05em; flex: 0 0 auto; }
    #be-source-box .be-src-gsum { flex: 1; min-width: 0; font-size: 11px; opacity: 0.55; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #be-source-box .be-src-caret { width: 0; height: 0; border-left: 5px solid currentColor; border-top: 4px solid transparent; border-bottom: 4px solid transparent; opacity: 0.6; transition: transform 0.2s; flex: 0 0 auto; }
    #be-source-box .be-src-group.open .be-src-caret { transform: rotate(90deg); }
    #be-source-box .be-src-gbody { max-height: 0; overflow: hidden; box-sizing: border-box; padding: 0 2px; transition: max-height 0.25s ease, padding 0.25s ease; }
    #be-source-box .be-src-group.open .be-src-gbody { max-height: none; padding: 2px 2px 6px; }
    /* 出处组合 */
    #be-source-box .be-src-presets { margin-bottom: 12px; }
    #be-source-box .be-src-preset-h { font-size: 13px; font-weight: 700; margin-bottom: 7px; letter-spacing: 0.05em; }
    #be-source-box .be-src-preset-h span { margin-left: 8px; font-size: 10px; font-weight: 400; opacity: 0.55; letter-spacing: 0; }
    #be-source-box .be-src-preset-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    #be-source-box .be-src-preset { display: inline-flex; align-items: center; border: 1px solid var(--be-panel-input-border); border-radius: 14px; background: var(--be-panel-input-bg); overflow: hidden; }
    #be-source-box .be-src-preset-apply { border: 0; background: transparent; color: inherit; padding: 5px 4px 5px 11px; font-size: 12px; cursor: pointer; font-family: inherit; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #be-source-box .be-src-preset-del { border: 0; background: transparent; color: var(--be-panel-sub); padding: 5px 9px 5px 4px; font-size: 13px; cursor: pointer; opacity: 0.6; }
    #be-source-box .be-src-preset-add { border: 1px dashed var(--be-panel-input-border); background: transparent; color: var(--be-accent); border-radius: 14px; padding: 5px 11px; font-size: 12px; cursor: pointer; font-family: inherit; }
    #be-source-box .be-src-preset-new { display: flex; gap: 6px; margin-top: 8px; }
    #be-source-box .be-src-preset-new input { flex: 1; min-width: 0; box-sizing: border-box; background: var(--be-panel-input-bg); border: 1px solid var(--be-panel-input-border); color: inherit; padding: 6px 10px; border-radius: 6px; font-size: 13px; font-family: inherit; }
    #be-source-box .be-combo-btn {
      position: absolute; right: 2px; top: 50%; transform: translateY(-50%);
      width: 32px; height: 30px; border: 0; background: transparent;
      color: var(--be-panel-sub); cursor: pointer; font-size: 12px;
      display: flex; align-items: center; justify-content: center;
    }
    #be-source-box .be-combo.open .be-combo-btn i { transform: rotate(180deg); }
    #be-source-box .be-combo-list {
      margin-top: 4px; max-height: 180px; overflow-y: auto;
      border: 1px solid var(--be-panel-input-border); border-radius: 6px;
      background: var(--be-panel-input-bg);
    }
    #be-source-box .be-combo-list[hidden] { display: none; }
    #be-source-box .be-combo-item {
      display: flex; align-items: center; gap: 2px;
      padding: 2px 4px 2px 10px; cursor: pointer; font-size: 13px;
      color: var(--be-thought-fg);
    }
    #be-source-box .be-combo-item + .be-combo-item { border-top: 1px solid var(--be-panel-divider); }
    #be-source-box .be-combo-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 6px 0; }
    #be-source-box .be-combo-act {
      flex: 0 0 auto; width: 28px; height: 28px; border: 0; background: transparent;
      color: var(--be-panel-sub); cursor: pointer; font-size: 11px; opacity: 0.6;
    }
    #be-source-box .be-combo-item.pinned .be-combo-act[data-act="pin"] { color: var(--be-accent); opacity: 1; }
    #be-source-box .be-combo-empty { padding: 10px; font-size: 12px; color: var(--be-panel-sub); }
    /* 折叠输入框：勾选开关后滑出。
       只过渡 max-height（纯重绘）——不要 transform/opacity，
       它们会在低端机上临时提升合成层，导致切换时大半屏闪一下「屏幕故障」。 */
    #be-source-box .be-src-collapse {
      max-height: 0; overflow: hidden;
      transition: max-height 0.25s ease;
    }
    #be-source-box .be-src-collapse.open {
      max-height: 320px;
    }
    /* 打码折叠区字段多（4~5 项），单独给足高度，展开时不被裁切 */
    #be-source-box #be-src-mask-wrap.open { max-height: 1200px; }
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
      /* 括号/引号贴字的根因：Chrome 默认会把相邻的两个全角标点（如「。《」）各挤掉半格（text-spacing-trim），
         html2canvas 却按完整字形逐字画，被挤掉的半格空白还在 → 导出里标点压到旁边的字上。
         卡片内关掉这种挤压，预览和导出用同一套标点宽度 */
      text-spacing-trim: space-all;
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
    #be-card .be-mask { cursor: pointer; }
    /* 打码词 chip（设置面板 / 编辑出处） */
    .be-mask-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .be-mask-chip {
      border: 1px solid var(--be-panel-input-border); background: var(--be-panel-input-bg);
      color: var(--be-panel-fg, inherit); border-radius: 999px; padding: 3px 10px;
      font-size: 12px; cursor: pointer; font-family: inherit;
    }
    .be-mask-chip em { font-style: normal; opacity: 0.55; margin-left: 6px; font-size: 11px; }
    .be-mask-chip.custom em { color: var(--be-accent); opacity: 1; }
    .be-mask-chip.open { border-color: var(--be-accent); }
    .be-mask-chip-menu { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
    .be-mask-chip-char {
      width: 52px; box-sizing: border-box; padding: 5px 8px; border-radius: 6px; font-size: 13px;
      background: var(--be-panel-input-bg); border: 1px solid var(--be-panel-input-border); color: inherit;
    }
    .be-mask-chip-del { border: 0; background: transparent; color: #ff9b9b; cursor: pointer; width: 30px; height: 30px; }
    .be-mask-chips-empty { font-size: 12px; opacity: 0.6; margin-top: 6px; }
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
    #be-drawer .be-drawer-row.be-hs-dragging { cursor: grabbing; user-select: none; }
    #be-drawer .be-drawer-row.be-hs-dragging .be-drawer-chip { cursor: grabbing; }
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
    .be-tl-list { display: flex; flex-direction: column; gap: 6px; }
    .be-tl-sep { text-align: center; opacity: 0.45; margin: 2px 0; line-height: 1; }
    .be-tl-row {
      position: relative; overflow: hidden; border-radius: 12px;
      background: var(--be-panel-row-bg);
      border: 1.5px solid transparent;
      -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
    }
    .be-tl-row:hover { background: var(--be-panel-row-bg-hover); }
    .be-tl-row.active { border-color: var(--be-accent); }
    .be-tl-row.dragging { z-index: 2; box-shadow: 0 6px 18px rgba(0,0,0,0.35); }
    .be-tl-track { display: flex; width: 100%; }
    .be-tl-main {
      flex: 1 1 auto; min-width: 0; box-sizing: border-box;
      display: flex; align-items: center;
      padding: 4px 4px 4px 0; cursor: pointer; font-size: 13px;
    }
    .be-tl-handle {
      flex: 0 0 34px; height: 34px;
      display: flex; align-items: center; justify-content: center;
      color: var(--be-panel-sub); opacity: 0.6; font-size: 12px; cursor: grab;
      touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
    }
    .be-tl-name {
      flex: 1 1 auto; min-width: 0;
      display: flex; align-items: center; gap: 6px;
    }
    .be-tl-name-txt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .be-tl-tag {
      flex: 0 0 auto; font-size: 10px; line-height: 1; padding: 3px 5px; border-radius: 5px;
      background: rgba(128,128,128,0.16); color: var(--be-panel-sub);
    }
    /* 右侧按钮：统一 30×30、统一颜色，用 Font Awesome 图标 */
    .be-tl-acts { flex: 0 0 auto; display: flex; align-items: center; }
    .be-tl-btn, .be-tl-slot {
      flex: 0 0 30px; width: 30px; height: 30px;
    }
    .be-tl-btn {
      display: flex; align-items: center; justify-content: center;
      padding: 0; margin: 0; border: none; border-radius: 8px; background: transparent;
      color: var(--be-panel-sub); font-size: 12.5px; line-height: 1; cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .be-tl-btn:hover { background: rgba(128,128,128,0.14); color: var(--be-panel-fg); }
    .be-tl-btn.be-tl-fav { opacity: 0.45; }
    .be-tl-btn.be-tl-fav.on { color: #f5b301; opacity: 1; }
    /* ⋯ 仿酒馆正则列表：点开后 ⋯ 自己被同款按钮原地替换 */
    .be-tl-moreslot { display: flex; }
    .be-tl-extra { display: none; }
    .be-tl-row.expanded .be-tl-extra { display: flex; }
    .be-tl-row.expanded .be-tl-more { display: none; }
    .be-tl-row-hidden .be-tl-main { cursor: default; padding-left: 12px; }
    .be-tl-row-hidden .be-tl-name-txt { opacity: 0.6; }
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
    .be-fb-list .be-tl-row.be-fb-off .be-tl-name { opacity: 0.45; }
    .be-fb-list { margin-top: 6px; }
    /* ===== 取色器 ===== */
    #be-cpick {
      position: absolute; z-index: 2147483646; width: 272px; box-sizing: border-box;
      background: var(--be-panel-bg, #1f1f1f); color: var(--be-panel-fg, #eee);
      border: 1px solid var(--be-panel-divider, rgba(255,255,255,0.12)); border-radius: 14px;
      box-shadow: 0 14px 40px rgba(0,0,0,0.45); padding: 12px; font-family: var(--mainFontFamily, sans-serif);
      user-select: none; -webkit-user-select: none;
    }
    #be-cpick .be-cp-top { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    #be-cpick .be-cp-grip { width: 40px; height: 5px; border-radius: 3px; background: currentColor; opacity: 0.25; margin: -4px auto 8px; cursor: grab; position: relative; }
    #be-cpick .be-cp-grip::before { content: ''; position: absolute; left: -40px; right: -40px; top: -8px; bottom: -8px; }
    #be-cpick.be-cp-moving { opacity: 0.92; }
    #be-cpick.be-cp-moving .be-cp-grip { cursor: grabbing; opacity: 0.5; }
    #be-cpick .be-cp-targets { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
    #be-cpick .be-cp-tseg { flex: 1; display: flex; gap: 4px; background: var(--be-panel-row-bg, rgba(255,255,255,0.05)); border-radius: 9px; padding: 3px; }
    #be-cpick .be-cp-tseg button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; border: 0; background: transparent; color: inherit; opacity: 0.7; padding: 5px 0; border-radius: 7px; font-size: 12px; cursor: pointer; font-family: inherit; }
    #be-cpick .be-cp-tseg button.active { background: var(--be-panel-bg, #2a2a2a); opacity: 1; color: var(--be-accent); font-weight: 600; }
    #be-cpick .be-cp-tdot { width: 12px; height: 12px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(128,128,128,0.45); }
    #be-cpick .be-cp-auto { border: 1px solid var(--be-panel-divider, rgba(255,255,255,0.15)); background: transparent; color: inherit; border-radius: 8px; padding: 5px 9px; font-size: 12px; cursor: pointer; opacity: 0.75; font-family: inherit; }
    #be-cpick .be-cp-auto.active { border-color: var(--be-accent); color: var(--be-accent); opacity: 1; }
    #be-cpick .be-cp-cmp { display: flex; width: 52px; height: 28px; border-radius: 8px; overflow: hidden; flex: 0 0 auto; box-shadow: inset 0 0 0 1px rgba(128,128,128,0.35); }
    #be-cpick .be-cp-old, #be-cpick .be-cp-new { flex: 1; }
    #be-cpick .be-cp-old { cursor: pointer; }
    #be-cpick .be-cp-hexwrap {
      flex: 1; min-width: 0; display: flex; align-items: center; gap: 2px; font-size: 13px; opacity: 0.9;
      background: var(--be-panel-input-bg, rgba(255,255,255,0.06)); border: 1px solid var(--be-panel-input-border, rgba(255,255,255,0.15));
      border-radius: 8px; padding: 0 8px; height: 30px; box-sizing: border-box;
    }
    #be-cpick .be-cp-hex { flex: 1; min-width: 0; border: 0; background: transparent; color: inherit; font-size: 13px; font-family: ui-monospace, Menlo, Consolas, monospace; letter-spacing: 0.06em; outline: none; padding: 0; user-select: text; -webkit-user-select: text; }
    #be-cpick .be-cp-ico { width: 30px; height: 30px; flex: 0 0 auto; border-radius: 8px; border: 0; background: var(--be-panel-row-bg, rgba(255,255,255,0.06)); color: inherit; cursor: pointer; font-size: 13px; }
    #be-cpick .be-cp-ok { background: var(--be-accent); color: #fff; }
    #be-cpick .be-cp-body { margin-bottom: 10px; }
    #be-cpick .be-cp-sv {
      position: relative; height: 150px; border-radius: 8px; cursor: crosshair;
      background: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, var(--cp-hue, red));
    }
    #be-cpick .be-cp-hue, #be-cpick .be-cp-val { position: relative; height: 16px; border-radius: 8px; margin-top: 12px; cursor: pointer; }
    #be-cpick .be-cp-hue { background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00); }
    #be-cpick .be-cp-val { background: linear-gradient(to right, #000, var(--cp-full, var(--cp-color))); }
    #be-cpick .be-cp-disc {
      position: relative; width: 190px; height: 190px; margin: 0 auto; border-radius: 50%; cursor: crosshair;
      background: radial-gradient(circle closest-side, #fff, rgba(255,255,255,0)), conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
    }
    #be-cpick .be-cp-disc-shade { position: absolute; inset: 0; border-radius: 50%; background: #000; pointer-events: none; }
    #be-cpick .be-cp-sv-thumb, #be-cpick .be-cp-disc-thumb, #be-cpick .be-cp-hue-thumb, #be-cpick .be-cp-val-thumb {
      position: absolute; width: 16px; height: 16px; border-radius: 50%; transform: translate(-50%, -50%);
      border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.4); pointer-events: none; box-sizing: border-box;
      background: var(--cp-color);
    }
    #be-cpick .be-cp-hue-thumb, #be-cpick .be-cp-val-thumb { top: 50%; width: 18px; height: 18px; }
    #be-cpick .be-cp-hue-thumb { background: var(--cp-hue); }
    #be-cpick .be-cp-params { display: flex; flex-direction: column; gap: 6px; }
    #be-cpick .be-cp-param { display: flex; align-items: center; gap: 8px; }
    #be-cpick .be-cp-plabel { width: 14px; font-size: 12px; opacity: 0.7; text-align: center; }
    #be-cpick .be-cp-param input[type=range] {
      flex: 1; min-width: 0; height: 12px; margin: 0; padding: 0; border-radius: 6px; border: 0;
      -webkit-appearance: none; appearance: none; outline: none; box-shadow: inset 0 0 0 1px rgba(128,128,128,0.3);
    }
    #be-cpick .be-cp-param input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%;
      background: #fff; border: 0; box-shadow: 0 0 0 1px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.4); cursor: pointer;
    }
    #be-cpick .be-cp-param input[type=range]::-moz-range-thumb {
      width: 16px; height: 16px; border-radius: 50%; background: #fff; border: 0;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.4); cursor: pointer;
    }
    #be-cpick .be-cp-param input[type=range]::-moz-range-track { background: transparent; }
    #be-cpick .be-cp-num {
      width: 48px; box-sizing: border-box; padding: 3px 4px; font-size: 12px; text-align: right; border-radius: 6px;
      background: var(--be-panel-input-bg, rgba(255,255,255,0.06)); border: 1px solid var(--be-panel-input-border, rgba(255,255,255,0.15)); color: inherit;
      user-select: text; -webkit-user-select: text;
    }
    #be-cpick .be-cp-psep { height: 1px; background: var(--be-panel-divider, rgba(255,255,255,0.1)); margin: 4px 0; }
    #be-cpick .be-cp-pal { max-height: 230px; overflow-y: auto; }
    #be-cpick .be-cp-pal-h { display: flex; align-items: center; gap: 6px; font-size: 11px; opacity: 0.7; margin: 8px 0 6px; }
    #be-cpick .be-cp-pal-h:first-child { margin-top: 0; }
    #be-cpick .be-cp-pal-tip { margin-left: auto; font-size: 10px; opacity: 0.7; }
    #be-cpick .be-cp-add { border: 0; background: transparent; color: var(--be-accent); cursor: pointer; font-size: 12px; padding: 0 4px; }
    #be-cpick .be-cp-sws { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; }
    #be-cpick .be-cp-sw { aspect-ratio: 1; border-radius: 6px; border: 0; padding: 0; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(128,128,128,0.35); }
    #be-cpick .be-cp-sw.active { outline: 2px solid var(--be-accent); outline-offset: 1px; }
    #be-cpick .be-cp-empty { grid-column: 1 / -1; font-size: 11px; opacity: 0.5; }
    #be-cpick .be-cp-tabs { display: flex; gap: 4px; background: var(--be-panel-row-bg, rgba(255,255,255,0.05)); border-radius: 9px; padding: 3px; }
    #be-cpick .be-cp-tabs button { flex: 1; border: 0; background: transparent; color: inherit; opacity: 0.7; padding: 6px 0; border-radius: 7px; font-size: 12px; cursor: pointer; font-family: inherit; }
    #be-cpick .be-cp-tabs button.active { background: var(--be-panel-bg, #2a2a2a); opacity: 1; color: var(--be-accent); font-weight: 600; }
    .be-nb-tools { display: flex; justify-content: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
    .be-nb-tools .be-filter-btn i, .be-char-head .be-filter-btn i { font-size: 11px; }
    .be-export-scope { flex-wrap: wrap; }
    .be-export-count { text-align: center; font-size: 12px; opacity: 0.6; margin-top: 14px; }
    .be-filter-confirm[disabled] { opacity: 0.4; pointer-events: none; }
    /* 随机回顾 */
    .be-rv-filter select, .be-hm-bar select {
      background: var(--be-panel-input-bg); color: inherit; border: 1px solid var(--be-panel-input-border);
      border-radius: 6px; padding: 5px 8px; font-size: 12px; font-family: inherit; max-width: 60%;
    }
    .be-rv-filter { text-align: center; margin-bottom: 12px; }
    .be-rv-card {
      background: var(--be-panel-row-bg); border: 1px solid var(--be-panel-divider);
      border-radius: 12px; padding: 18px 18px 14px; margin-bottom: 14px;
    }
    .be-rv-when { font-size: 11px; color: var(--be-panel-sub); margin-bottom: 10px; letter-spacing: 0.04em; }
    .be-rv-quote { font-size: 15px; line-height: 1.9; white-space: pre-wrap; word-break: break-word; }
    .be-rv-thoughts { margin-top: 12px; border-left: 3px solid var(--be-accent); padding-left: 10px; }
    .be-rv-thought { font-size: 13px; line-height: 1.7; margin-bottom: 6px; white-space: pre-wrap; }
    .be-rv-thought span { display: block; font-size: 10px; opacity: 0.55; }
    .be-rv-src { display: flex; align-items: center; gap: 8px; margin-top: 14px; font-size: 11px; color: var(--be-panel-sub); }
    .be-rv-ava { width: 20px; height: 20px; border-radius: 50%; background-size: cover; background-position: center; flex: 0 0 auto; }
    .be-rv-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-bottom: 16px; }
    .be-rv-daily { border-top: 1px solid var(--be-panel-divider); padding-top: 12px; }
    /* 每日回顾：屏幕正中的小弹窗（absolute + 100dvh，见 ST 禁用 fixed 的坑），点空白处关闭 */
    #be-daily-review {
      position: absolute; top: 0; left: 0; width: 100%; height: 100vh; height: 100dvh; z-index: 2147483600;
      display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;
      background: rgba(0,0,0,0.45); opacity: 0; transition: opacity 0.22s;
    }
    #be-daily-review.show { opacity: 1; }
    #be-daily-review .be-dr-card {
      width: min(340px, 100%); box-sizing: border-box;
      background: var(--be-panel-bg); color: var(--be-panel-fg); border: 1px solid var(--be-panel-divider);
      border-radius: 14px; padding: 16px 18px 14px; box-shadow: 0 14px 40px rgba(0,0,0,0.4);
      font-family: var(--mainFontFamily, sans-serif);
      transform: translateY(8px) scale(0.98); transition: transform 0.22s;
    }
    #be-daily-review.show .be-dr-card { transform: none; }
    #be-daily-review .be-dr-head { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--be-accent); margin-bottom: 10px; letter-spacing: 0.06em; }
    #be-daily-review .be-dr-quote { font-size: 15px; line-height: 1.85; white-space: pre-wrap; word-break: break-word; max-height: 40vh; overflow-y: auto; }
    #be-daily-review .be-dr-src { font-size: 11px; opacity: 0.6; margin-top: 10px; }
    #be-daily-review .be-dr-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
    .be-confirm-box { max-width: 340px; }
    .be-confirm-box .be-src-title { font-size: 14px; letter-spacing: 0.1em; margin-bottom: 8px; opacity: 0.9; }
    .be-confirm-box .be-src-actions { display: flex; gap: 8px; justify-content: flex-end; }
    #be-confirm-mask { z-index: 2147483646; }   /* 确认框永远在最上层（自由排版编辑器、图片弹窗之上） */
    .be-confirm-text { font-size: 14px; line-height: 1.7; margin: 4px 0 12px; word-break: break-word; }
    .be-confirm-remember { display: flex; align-items: center; gap: 6px; font-size: 12px; opacity: 0.8; margin-bottom: 12px; cursor: pointer; }
    .be-note-share.be-note-jump { font-size: 11px; padding: 2px 6px; }
    /* ===== 自由排版：版式（卡片里的文档，编辑器和导出共用） ===== */
    .be-card.tpl-layout { padding: 0 !important; min-height: 0; display: block; }
    .be-lay { position: relative; container-type: inline-size; padding: var(--lay-pad, 28px); box-sizing: border-box; min-height: 120px; overflow: hidden; }
    .be-lay-doc { outline: none; }
    .be-lay-doc > * { margin: 0 0 var(--lay-gap, 14px); }
    .be-lay-doc > *:last-child { margin-bottom: 0; }
    .be-lp { word-break: break-word; white-space: normal; }
    .be-lay .be-quote { margin: 0; padding: 0; }
    .be-lay .be-quote p { margin: 0; }
    /* 底色/竖条用伪元素 + currentColor + opacity：跟着文字颜色走，深浅配色都合适；html2canvas 认不了 color-mix */
    .be-lp-box, .be-lp-quote { position: relative; }
    .be-lp-box { padding: 12px 14px; }
    .be-lp-box::before { content: ''; position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: currentColor; opacity: 0.08; border-radius: 4px; pointer-events: none; }
    .be-lp-quote { padding-left: 14px; }
    .be-lp-quote::before { content: ''; position: absolute; left: 0; top: 2px; bottom: 2px; width: 4px; background: currentColor; opacity: 0.35; border-radius: 2px; pointer-events: none; }
    .be-lay-imgw { position: relative; box-sizing: border-box; }
    .be-lay-img { position: relative; width: 100%; background-size: 100% 100%; background-position: center; background-repeat: no-repeat; box-sizing: border-box; background-color: rgba(128,128,128,0.15); }
    .be-lay-shd { position: absolute; display: block; background-size: 100% 100%; background-repeat: no-repeat; pointer-events: none; }
    .be-lay-doc > .be-lay-img-left { float: left; margin-right: 14px; }
    .be-lay-doc > .be-lay-img-right { float: right; margin-left: 14px; }
    .be-lay-doc > .be-lay-img-center { margin-left: auto; margin-right: auto; }
    .be-lay-doc > .be-lay-img-full, .be-lay-doc > .be-lay-img-center, .be-lay-doc > .be-lay-div, .be-lay-doc > .be-lay-space, .be-lay-doc > .be-lay-vt { clear: both; }
    .be-lay-clear { clear: both; }
    .be-lay-vt { display: flex; flex-direction: row-reverse; flex-wrap: wrap; line-height: 1; }
    .be-lay-vcol { display: flex; flex-direction: column; align-items: center; flex: none; }
    .be-lay-vcol > span { display: block; width: 1.1em; text-align: center; line-height: 1.05; }
    .be-lay-vsh { position: relative; left: 0.5em; top: -0.55em; }
    .be-lay-div { text-align: center; opacity: 0.7; letter-spacing: 0.3em; font-size: 14px; line-height: 1.4; }
    .be-lay-div-bar i { display: inline-block; width: 36px; height: 5px; background: currentColor; border-radius: 3px; vertical-align: middle; }
    .be-lay-div-flower { font-size: 20px; letter-spacing: 0; }
    .be-lay-wm { position: static !important; clear: both; margin-top: var(--lay-gap, 14px); text-align: right; font-size: 10px; opacity: 0.45; }
    .be-lay-float { position: absolute; line-height: 1.2; white-space: nowrap; z-index: 2; }
    .be-lay-float-text { font-size: 5cqw; }
    .be-lay-ph { opacity: 0.4; font-size: 12px; font-style: normal; font-weight: 400; }
    .be-lay-img > .be-lay-ph { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
    .be-lay-img:not([style*="aspect-ratio"]) { aspect-ratio: 4 / 3; }

    /* 编辑态（颜色全部用书摘主题色 --be-accent） */
    .be-lay-edit .be-lay-doc { cursor: text; -webkit-user-select: text; user-select: text; }
    .be-lay-edit .be-la, .be-lay-edit .be-lay-float { cursor: pointer; }
    .be-lay-edit .be-la { position: relative; -webkit-user-select: none; user-select: none; }
    .be-lay-edit .be-lp[data-slot] { position: relative; box-shadow: inset 2px 0 0 var(--be-accent-soft); }
    .be-lay-edit .be-lp.be-lp-ph::before { content: attr(data-ph); position: absolute; left: 0; right: 0; opacity: 0.35; pointer-events: none; font-style: normal; }
    .be-lay-edit .be-la[data-vslot] { box-shadow: inset -2px 0 0 var(--be-accent-soft); }
    .be-lay-slottag {
      position: absolute; z-index: 4; height: 15px; padding: 0 6px; border: 0; border-radius: 8px;
      background: var(--be-accent); color: #fff; font: 10px/15px sans-serif; letter-spacing: 0.04em; cursor: pointer; opacity: 0.85;
    }
    .be-lay-slottag:hover { opacity: 1; }
    .be-lay-tok { display: inline-block; padding: 0 5px; margin: 0 1px; border-radius: 4px; background: var(--be-accent-soft); color: var(--be-accent); font-size: 0.85em; line-height: 1.45; font-weight: 400; font-style: normal; text-decoration: none; vertical-align: baseline; cursor: pointer; white-space: nowrap; -webkit-user-select: all; user-select: all; }
    .be-lay-vt-ph { opacity: 0.45; }
    .be-lay-edit .be-lay-sel { outline: 2px solid var(--be-accent) !important; outline-offset: 3px; }
    .be-lay-edit .be-lay-float.be-lay-sel { outline-offset: 4px; touch-action: none; }
    .be-lay-edit .be-lay-float { touch-action: none; user-select: none; -webkit-user-select: none; }
    .be-lay-edit .be-lay-dragging { opacity: 0.35; }
    .be-lay-edit .be-lay-busy::after { content: ''; position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; border: 2px solid var(--be-accent); border-right-color: transparent; animation: be-lay-spin 0.7s linear infinite; z-index: 6; }
    .be-lay-edit .be-lay-busy .be-lay-img { opacity: 0.6; }
    @keyframes be-lay-spin { to { transform: rotate(360deg); } }
    .be-lay-grip, .be-lay-rot {
      position: absolute; display: flex; align-items: center; justify-content: center;
      width: 30px; height: 30px; border-radius: 50%; background: var(--be-accent); color: #fff;
      font: 12px/1 sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.25); touch-action: none; z-index: 5; cursor: grab;
    }
    .be-lay-grip { left: -14px; top: 50%; margin-top: -15px; }
    .be-lay-img-right .be-lay-grip { left: auto; right: -14px; }
    .be-lay-rot { right: -18px; bottom: -18px; width: 26px; height: 26px; font-size: 11px; transform: none; }
    /* 缩放柄：触摸区域 32px，看到的是 14px 的圆点 */
    .be-lay-rh { position: absolute; width: 32px; height: 32px; z-index: 5; touch-action: none; }
    .be-lay-rh::after { content: ''; position: absolute; left: 9px; top: 9px; width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 2px solid var(--be-accent); box-sizing: border-box; box-shadow: 0 1px 4px rgba(0,0,0,0.25); }
    .be-lay-rh-nw { left: -16px; top: -16px; cursor: nwse-resize; } .be-lay-rh-se { right: -16px; bottom: -16px; cursor: nwse-resize; }
    .be-lay-rh-ne { right: -16px; top: -16px; cursor: nesw-resize; } .be-lay-rh-sw { left: -16px; bottom: -16px; cursor: nesw-resize; }
    .be-lay-dropline { position: absolute; left: 10px; right: 10px; height: 3px; border-radius: 2px; background: var(--be-accent); z-index: 6; pointer-events: none; }

    /* 编辑器外壳：铺满屏幕，按钮全收在底部一条 */
    #be-lay-mask {
      position: absolute; top: 0; left: 0; width: 100%; height: 100vh; height: 100dvh;
      z-index: 2147483644; display: none; flex-direction: column;
      background: var(--be-panel-bg, #f3f3f1); color: var(--be-panel-fg, #222);
      font-family: inherit;
    }
    #be-lay-mask.open { display: flex; }
    #be-lay-mask button { font-family: inherit; }
    .be-lay-top { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: calc(10px + env(safe-area-inset-top, 0px)) 12px 8px; }
    .be-lay-tbtn { width: 38px; height: 38px; border-radius: 50%; border: 0; background: var(--be-panel-input-bg, rgba(0,0,0,0.06)); color: inherit; cursor: pointer; font-size: 15px; flex: 0 0 auto; }
    .be-lay-name { flex: 1; min-width: 0; border: 0; background: transparent; color: inherit; font-size: 16px; font-weight: 600; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 6px; }
    .be-lay-stage { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 18px 12px 40px; -webkit-overflow-scrolling: touch; }
    .be-lay-pagewrap { margin: 0 auto; box-shadow: 0 6px 24px rgba(0,0,0,0.16); position: relative; }
    .be-lay-pagewrap .be-card { margin: 0; box-shadow: none; border-radius: 0; }
    .be-lay-tip { text-align: center; font-size: 11px; opacity: 0.5; margin-top: 14px; line-height: 1.7; }
    .be-lay-bar {
      flex: 0 0 auto; display: flex; align-items: stretch; justify-content: space-around;
      padding: 6px 4px calc(8px + env(safe-area-inset-bottom, 0px));
      border-top: 1px solid var(--be-panel-divider, rgba(0,0,0,0.08)); background: var(--be-panel-bg, #fff);
    }
    .be-lay-bar button { flex: 1; border: 0; background: transparent; color: inherit; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 0; min-height: 48px; justify-content: center; }
    .be-lay-bar button b { font-size: 18px; line-height: 1; font-weight: 500; }
    .be-lay-bar button small { font-size: 10px; opacity: 0.6; }
    .be-lay-bar button.on, .be-lay-bar .be-lay-done { color: var(--be-accent); }
    .be-lay-bar .be-lay-done { font-size: 15px; font-weight: 700; }
    .be-lay-bar button[disabled] { opacity: 0.3; cursor: default; }

    /* 上下文菜单 */
    .be-lay-menu {
      position: absolute; z-index: 20; min-width: 150px; max-width: 240px; padding: 4px 0;
      background: var(--be-panel-bg, #fff); color: inherit; border-radius: 12px;
      box-shadow: 0 8px 28px rgba(0,0,0,0.25); border: 1px solid var(--be-panel-border, rgba(0,0,0,0.06));
    }
    .be-lay-menu[hidden] { display: none; }
    .be-lay-menu > button { display: flex; justify-content: space-between; align-items: center; width: 100%; border: 0; background: transparent; color: inherit; padding: 10px 14px; font-size: 14px; cursor: pointer; text-align: left; }
    .be-lay-menu > button + button { border-top: 1px solid var(--be-panel-divider, rgba(0,0,0,0.06)); }
    .be-lay-menu > button span { opacity: 0.4; }
    .be-lay-menu > button.danger { color: #e06c6c; }
    .be-lay-mhead { font-size: 11px; opacity: 0.5; padding: 6px 14px 4px; }
    .be-lay-menu .be-lay-mback { justify-content: flex-start; font-weight: 600; }
    .be-lay-opts { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 10px 10px; }
    .be-lay-opts button { border: 1px solid var(--be-panel-input-border, rgba(0,0,0,0.12)); background: transparent; color: inherit; border-radius: 8px; padding: 7px 10px; font-size: 13px; cursor: pointer; }
    .be-lay-opts button.on { border-color: var(--be-accent); color: var(--be-accent); }
    .be-lay-opts-grid { display: grid; grid-template-columns: repeat(3, 1fr); }
    .be-lay-opts-grid button { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px; font-size: 12px; }
    .be-lay-oic { font-style: normal; font-size: 20px; line-height: 1.1; }
    .be-lay-slider { display: flex; align-items: center; gap: 8px; padding: 10px 12px 12px; min-width: 210px; box-sizing: border-box; }
    .be-lay-slider input[type="range"] { flex: 1; min-width: 0; accent-color: var(--be-accent); }
    .be-lay-slider input[type="number"] { width: 54px; padding: 4px 6px; border-radius: 6px; border: 1px solid var(--be-panel-input-border, rgba(0,0,0,0.15)); background: var(--be-panel-input-bg, #fff); color: inherit; font-size: 13px; font-family: inherit; }
    .be-lay-slider span { font-size: 12px; opacity: 0.6; }
    .be-lay-slider-inline { padding: 0; flex: 1; justify-content: flex-end; max-width: 240px; min-width: 0; }

    /* 底部面板（插入 / 文字格子 / 页面 / 贴纸） */
    .be-lay-sheet { flex: 0 0 auto; max-height: 46dvh; overflow-y: auto; background: var(--be-panel-bg, #f6f7f8); border-top: 1px solid var(--be-panel-divider, rgba(0,0,0,0.08)); padding: 6px 0 4px; }
    .be-lay-sheet[hidden] { display: none; }
    .be-lay-shead { font-size: 12px; opacity: 0.55; padding: 6px 14px 8px; }
    .be-lay-shint { font-size: 11px; opacity: 0.5; padding: 6px 14px 8px; line-height: 1.6; }
    .be-lay-empty { font-size: 13px; opacity: 0.7; padding: 4px 14px 14px; line-height: 1.7; }
    .be-lay-row { display: flex; gap: 6px; padding: 4px 10px; overflow-x: auto; scrollbar-width: none; }
    .be-lay-row::-webkit-scrollbar { display: none; }
    .be-lay-cell {
      flex: 0 0 auto; min-width: 64px; height: 40px; padding: 0 12px; border-radius: 6px;
      border: 1px solid var(--be-panel-input-border, rgba(0,0,0,0.1)); background: var(--be-panel-input-bg, #fff); color: inherit;
      display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; cursor: pointer; white-space: nowrap;
    }
    .be-lay-cell.on { border-color: var(--be-accent); box-shadow: inset 0 0 0 1px var(--be-accent); color: var(--be-accent); }
    .be-lay-sw { display: inline-block; width: 26px; height: 14px; border-radius: 3px; border: 1px solid rgba(128,128,128,0.35); vertical-align: middle; }
    .be-lay-sw-rainbow { width: 16px; height: 16px; border-radius: 50%; border: 0; background: conic-gradient(#e85d5d, #e8c35d, #6fd26f, #5dc4e8, #7a6be8, #e85dc6, #e85d5d); }
    .be-lay-cell-sw { min-width: 44px; padding: 0 8px; }
    .be-lay-dot { display: inline-block; width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(128,128,128,0.35); }
    .be-lay-dot-pick { position: relative; border: 0; background: conic-gradient(#e85d5d, #e8c35d, #6fd26f, #5dc4e8, #7a6be8, #e85dc6, #e85d5d); }
    .be-lay-dot-pick > i { position: absolute; inset: 4px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.7); }
    /* 跟随配色的预览块：和书摘弹窗「颜色」一栏同样的样子 */
    .be-lay-prev-row { padding-top: 2px; padding-bottom: 6px; }
    .be-lay-pchip { flex: 0 0 auto; width: 52px; height: 40px; border-radius: 10px; border: 2px solid transparent; font-size: 16px; font-family: serif; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 1px rgba(128,128,128,0.25); }
    .be-lay-pchip.on { border-color: var(--be-accent); }
    .be-lay-pchip-cur { background: var(--be-panel-input-bg, rgba(0,0,0,0.05)); color: inherit; font-size: 12px; font-family: inherit; }
    .be-lay-fmt { display: flex; align-items: center; justify-content: space-around; padding: 8px 6px 6px; gap: 2px; }
    .be-lay-fmt button { border: 0; background: transparent; color: inherit; min-width: 36px; height: 36px; border-radius: 6px; font-size: 16px; cursor: pointer; }
    .be-lay-fmt button[data-tl] { font-size: 12px; min-width: 64px; }
    .be-lay-fmt button.on { color: var(--be-accent); background: var(--be-accent-soft); }
    .be-lay-fsep { width: 1px; height: 20px; background: currentColor; opacity: 0.15; }
    .be-lay-insgrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 0 12px 4px; }
    .be-lay-ins { border: 0; border-radius: 10px; background: var(--be-panel-input-bg, rgba(0,0,0,0.05)); color: inherit; padding: 10px 2px; font-size: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .be-lay-ins b { font-size: 18px; font-weight: 400; line-height: 1.1; }
    .be-lay-ins.auto { background: var(--be-accent-soft); color: var(--be-accent); }
    .be-lay-stkgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 6px; padding: 0 12px; }
    .be-lay-stkgrid button { height: 44px; border: 0; border-radius: 8px; background: var(--be-panel-input-bg, rgba(0,0,0,0.05)); color: inherit; font-size: 22px; cursor: pointer; }
    .be-lay-prow { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 14px; font-size: 13px; }
    .be-lay-prow > span { flex: none; }
    .be-lay-seg { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
    .be-lay-seg button { border: 1px solid var(--be-panel-input-border, rgba(0,0,0,0.12)); background: transparent; color: inherit; border-radius: 14px; padding: 5px 12px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
    .be-lay-seg button.on { background: var(--be-accent); border-color: var(--be-accent); color: #fff; }
    .be-lay-seg .be-lay-sw { width: 14px; height: 14px; border-radius: 50%; }

    /* 小输入框 / 裁剪 */
    .be-lay-ask { position: absolute; inset: 0; z-index: 30; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .be-lay-askbox { width: min(320px, 100%); background: var(--be-panel-bg, #fff); border-radius: 14px; padding: 16px; box-sizing: border-box; }
    .be-lay-asktitle { font-weight: 600; margin-bottom: 10px; }
    .be-lay-askbox input, .be-lay-askbox textarea { width: 100%; box-sizing: border-box; padding: 9px 10px; border-radius: 8px; border: 1px solid var(--be-panel-input-border, rgba(0,0,0,0.15)); background: var(--be-panel-input-bg, #fff); color: inherit; font-size: 15px; font-family: inherit; }
    .be-lay-askbox textarea { resize: vertical; line-height: 1.6; }
    .be-lay-askacts { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
    #be-lay-crop { position: absolute; inset: 0; z-index: 25; background: #111; display: flex; flex-direction: column; }
    .be-lay-crop-stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .be-lay-crop-img { position: relative; touch-action: none; }
    .be-lay-crop-img img { width: 100%; height: 100%; display: block; pointer-events: none; user-select: none; }
    .be-lay-crop-rect { position: absolute; border: 2px solid #fff; box-shadow: 0 0 0 9999px rgba(0,0,0,0.45); cursor: move; touch-action: none; box-sizing: border-box; }
    .be-lay-crop-rect i { position: absolute; width: 34px; height: 34px; touch-action: none; }
    .be-lay-crop-rect i::after { content: ''; position: absolute; width: 16px; height: 16px; border: 4px solid #fff; box-sizing: border-box; }
    .be-lay-crop-rect i[data-h="nw"] { left: -2px; top: -2px; cursor: nwse-resize; } .be-lay-crop-rect i[data-h="nw"]::after { left: 0; top: 0; border-right: 0; border-bottom: 0; }
    .be-lay-crop-rect i[data-h="ne"] { right: -2px; top: -2px; cursor: nesw-resize; } .be-lay-crop-rect i[data-h="ne"]::after { right: 0; top: 0; border-left: 0; border-bottom: 0; }
    .be-lay-crop-rect i[data-h="sw"] { left: -2px; bottom: -2px; cursor: nesw-resize; } .be-lay-crop-rect i[data-h="sw"]::after { left: 0; bottom: 0; border-right: 0; border-top: 0; }
    .be-lay-crop-rect i[data-h="se"] { right: -2px; bottom: -2px; cursor: nwse-resize; } .be-lay-crop-rect i[data-h="se"]::after { right: 0; bottom: 0; border-left: 0; border-top: 0; }
    .be-lay-crop-ar { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; padding: 10px; }
    .be-lay-crop-ar button { border: 1px solid #555; background: transparent; color: #ddd; border-radius: 14px; padding: 5px 12px; font-size: 12px; cursor: pointer; }
    .be-lay-crop-ar button.on { border-color: #fff; color: #fff; background: rgba(255,255,255,0.15); }
    .be-lay-crop-acts { display: flex; justify-content: flex-end; gap: 8px; padding: 6px 14px calc(14px + env(safe-area-inset-bottom, 0px)); }
    .be-lay-starter { position: absolute; inset: 0; z-index: 28; background: rgba(0,0,0,0.45); display: flex; align-items: flex-end; justify-content: center; }
    .be-lay-starter-box { width: 100%; max-width: 560px; max-height: 82%; overflow-y: auto; background: var(--be-panel-bg, #fff); border-radius: 16px 16px 0 0; padding: 14px 12px calc(16px + env(safe-area-inset-bottom, 0px)); box-sizing: border-box; }
    .be-lay-starter-h { font-size: 14px; font-weight: 600; padding: 2px 4px 12px; }
    .be-lay-starter-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; align-items: start; }
    .be-lay-starter-item { border: 1px solid var(--be-panel-input-border, rgba(0,0,0,0.12)); border-radius: 10px; background: transparent; color: inherit; padding: 8px; cursor: pointer; display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
    .be-lay-starter-pv { display: block; height: 170px; overflow: hidden; border-radius: 6px; position: relative; pointer-events: none; }
    .be-lay-starter-pv > .be-card { position: absolute; left: 0; top: 0; transform-origin: 0 0; margin: 0; box-shadow: none; max-width: none; }
    .be-lay-starter-name { font-size: 13px; text-align: center; }
    /* 模板栏里的「＋ 自由排版」和排版模板上的 ✎ */
    #be-drawer .be-drawer-chip.be-drawer-new { background: transparent; border: 1px dashed var(--be-accent); color: var(--be-accent); }
    #be-drawer .be-drawer-chip .be-lay-chip-edit { margin-left: 6px; opacity: 0.75; font-size: 11px; }

    /* ===== 动效：只动 transform（scale / translate 单独属性，不覆盖元素自己的定位 transform）和 opacity ===== */
    :root { --be-spring: cubic-bezier(0.34, 1.36, 0.5, 1); --be-out: cubic-bezier(0.22, 0.75, 0.25, 1); }
    @keyframes be-pop-in { from { opacity: 0; scale: 0.94; translate: 0 4px; } to { opacity: 1; scale: 1; translate: 0 0; } }
    @keyframes be-box-in { from { opacity: 0; scale: 0.93; } to { opacity: 1; scale: 1; } }
    @keyframes be-sheet-up { from { opacity: 0; translate: 0 18px; } to { opacity: 1; translate: 0 0; } }
    @keyframes be-panel-in { from { opacity: 0; translate: 0 10px; scale: 0.985; } to { opacity: 1; translate: 0 0; scale: 1; } }
    @keyframes be-dim-in { from { opacity: 0; } to { opacity: 1; } }
    /* 浮动条、小菜单、取色器：打开时轻微回弹 */
    #be-float-bar.show, #be-card-hl-bar.show, #be-hl-bar.show, #be-card-hl-pop.show, #be-slot-chooser.show,
    .be-lay-menu:not([hidden]), #be-cpick { animation: be-pop-in 0.26s var(--be-spring); transform-origin: 50% 0; }
    /* 对话框：遮罩淡入，框体回弹 */
    .be-import-tpl-mask.open, #be-thought-mask.open, #be-source-mask.open, .be-lay-ask { animation: be-dim-in 0.18s ease; }
    .be-import-tpl-mask.open > .be-import-tpl-box, #be-thought-mask.open #be-thought-box, #be-source-mask.open #be-source-box, .be-lay-askbox { animation: be-box-in 0.3s var(--be-spring); }
    #be-mask.open #be-modal { animation: be-box-in 0.32s var(--be-spring); }
    #be-panel.open { animation: be-panel-in 0.3s var(--be-spring); }
    /* 底部面板 */
    #be-drawer, #be-typo-sheet { transition: transform 0.34s var(--be-spring); }
    .be-lay-sheet:not([hidden]), .be-lay-starter-box { animation: be-sheet-up 0.3s var(--be-spring); }
    /* 按下反馈 */
    .be-btn, .be-mini-btn, .be-drawer-chip, .be-radio-opt, .be-fbtn, .be-tl-btn, .be-p-tabs button, .be-settings-subtabs button,
    .be-lay-cell, .be-lay-ins, .be-lay-bar button, .be-lay-opts button, .be-lay-pchip, .be-lay-starter-item, .be-lay-tbtn, .be-lay-seg button, .be-lay-stkgrid button {
      transition: scale 0.14s var(--be-out);
    }
    .be-btn:active, .be-mini-btn:active, .be-drawer-chip:active, .be-radio-opt:active, .be-fbtn:active, .be-tl-btn:active, .be-p-tabs button:active, .be-settings-subtabs button:active,
    .be-lay-cell:active, .be-lay-ins:active, .be-lay-bar button:active, .be-lay-opts button:active, .be-lay-pchip:active, .be-lay-starter-item:active, .be-lay-tbtn:active, .be-lay-seg button:active, .be-lay-stkgrid button:active {
      scale: 0.95;
    }
    .be-lay-menu > button:active { background: var(--be-accent-soft); }
    @media (prefers-reduced-motion: reduce) {
      #be-float-bar.show, #be-card-hl-bar.show, #be-hl-bar.show, #be-card-hl-pop.show, #be-slot-chooser.show, .be-lay-menu:not([hidden]), #be-cpick,
      .be-import-tpl-mask.open, .be-import-tpl-mask.open > .be-import-tpl-box, #be-thought-mask.open #be-thought-box, #be-source-mask.open #be-source-box,
      #be-mask.open #be-modal, #be-panel.open, .be-lay-sheet:not([hidden]), .be-lay-starter-box, .be-lay-askbox { animation: none; }
    }
    body #toast-container { z-index: 2147483647 !important; }
    /* 切换笔记本/设置、设置小类：滑动（按切换方向从左或右平移淡入） */
    @keyframes be-slide-in-r { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
    @keyframes be-slide-in-l { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: none; } }
    .be-slide-r { animation: be-slide-in-r 0.38s cubic-bezier(0.22, 0.75, 0.25, 1); }
    .be-slide-l { animation: be-slide-in-l 0.38s cubic-bezier(0.22, 0.75, 0.25, 1); }
    #be-panel .be-p-body { overflow-x: hidden; }
    /* 热力图 */
    .be-hm-scale { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 12px; flex-wrap: wrap; }
    .be-hm-scale > span { opacity: 0.7; }
    .be-hm-max { display: flex; align-items: center; gap: 4px; opacity: 0.85; }
    .be-hm-max input {
      width: 56px; background: var(--be-panel-input-bg); color: inherit; border: 1px solid var(--be-panel-input-border);
      border-radius: 6px; padding: 3px 6px; font-size: 12px; font-family: inherit;
    }
    .be-hm-scale-tip { font-size: 11px; opacity: 0.55; margin: 4px 0 10px; }
    .be-hm-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
    .be-hm-stats { font-size: 12px; color: var(--be-panel-sub); margin-bottom: 10px; }
    .be-hm-scroll { overflow-x: auto; padding: 18px 0 6px; position: relative; scrollbar-width: thin; }
    .be-hm-months { position: relative; height: 0; }
    .be-hm-months span { position: absolute; top: -16px; font-size: 10px; color: var(--be-panel-sub); white-space: nowrap; }
    .be-hm-grid { display: flex; gap: 3px; width: max-content; }
    .be-hm-col { display: flex; flex-direction: column; gap: 3px; }
    .be-hm-cell { width: 11px; height: 11px; border-radius: 2px; display: inline-block; cursor: pointer; box-sizing: border-box; }
    .be-hm-cell.l0 { background: var(--be-panel-row-bg); outline: 1px solid var(--be-panel-divider); outline-offset: -1px; }
    .be-hm-cell.l1 { background: color-mix(in srgb, var(--be-accent) 30%, transparent); }
    .be-hm-cell.l2 { background: color-mix(in srgb, var(--be-accent) 55%, transparent); }
    .be-hm-cell.l3 { background: color-mix(in srgb, var(--be-accent) 78%, transparent); }
    .be-hm-cell.l4 { background: var(--be-accent); }
    .be-hm-cell.be-hm-void { visibility: hidden; }
    .be-hm-cell.sel { outline: 2px solid var(--be-panel-fg); outline-offset: 0; }
    .be-hm-legend { display: flex; align-items: center; justify-content: flex-end; gap: 3px; font-size: 10px; color: var(--be-panel-sub); margin: 6px 0 14px; }
    .be-hm-legend .be-hm-cell { cursor: default; }
    .be-hm-tip { font-size: 12px; color: var(--be-panel-sub); text-align: center; }
    .be-hm-day-h { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
    .be-hm-day-item { padding: 10px 12px; border-radius: 8px; background: var(--be-panel-row-bg); margin-bottom: 6px; cursor: pointer; }
    .be-hm-day-q { font-size: 13px; line-height: 1.6; }
    .be-hm-day-m { font-size: 10px; opacity: 0.55; margin-top: 4px; }
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
      toast('点击卡片上的图片区域可更换图片', 'info');
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
    showBar(rect);
  }
  function scheduleCheck(delay = 80) {
    if (selDebounce) clearTimeout(selDebounce);
    selDebounce = setTimeout(dispatchSelectionCheck, delay);
  }

  // SVG 图标
  const ICONS = {
    underline: '<svg viewBox="0 0 24 24"><path d="M6 4v8a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>',
    thought:   '<svg viewBox="0 0 24 24"><path d="M12 20l-4 0a4 4 0 0 1-4-4l0-7a4 4 0 0 1 4-4l8 0a4 4 0 0 1 4 4l0 7a4 4 0 0 1-4 4l-2 0-2 3z"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="14" x2="13" y2="14"/></svg>',
    excerpt:   '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2l6 0a2 2 0 0 1 2 2l0 16-4-3-4 3 0-16z"/><path d="M14 8l4 0a2 2 0 0 1 2 2l0 11-4-3"/></svg>',
    pick:      '<svg viewBox="0 0 24 24"><path d="M8 5H5v14h3"/><path d="M16 5h3v14h-3"/></svg>'
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
      <span class="be-fbtn-divider be-pick-div"></span>
      <button class="be-fbtn be-pick-btn" data-act="pick" type="button">${ICONS.pick}<span>设为开头</span></button>
    `;
    // 关键修复：触摸/鼠标按下时只阻止选区被清空，不阻止 click 默认行为
    // 让点击在 pointerup 上立刻派发（用 once 防重）
    const fireAction = (act) => {
      if (!lastText) return;
      // 两点选线：第一次记开头，第二次拼出开头到结尾的整段选区，再弹回这条浮动栏
      if (act === 'pick') { handlePickStepMain(); return; }
      // 对当前选区做了普通操作，就放弃之前记下的开头
      pickPendingStart = null;
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
  // 不猜变量名：直接找一个酒馆自己的下拉框(select)，读它的计算样式——这样用户装的美化主题
  // （给 select 加的贴图 background-image、边框、border-image、阴影、毛玻璃）都会原样带过来。
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
    const sels = ['#themes', '#left-nav-panel select', '.drawer-content select', 'select.text_pole', 'select'];
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

  // 悬浮栏按钮：默认顺序；开了「自定义悬浮栏按钮」就按用户排的顺序和显隐
  const FLOAT_BAR_BTNS = [
    { id: 'highlight', name: '划线' },
    { id: 'thought', name: '想法' },
    { id: 'excerpt', name: '书摘' },
    { id: 'pick', name: '设为开头 / 结尾' }
  ];
  function getFloatBarLayout() {
    const known = FLOAT_BAR_BTNS.map(b => b.id);
    const saved = Array.isArray(settings.floatBarLayout) ? settings.floatBarLayout.filter(x => x && known.includes(x.id)) : [];
    const seen = new Set(saved.map(x => x.id));
    return [...saved.map(x => ({ id: x.id, hidden: !!x.hidden })), ...known.filter(id => !seen.has(id)).map(id => ({ id, hidden: false }))];
  }
  function applyFloatBarLayout(bar) {
    const layout = settings.floatBarCustom ? getFloatBarLayout() : FLOAT_BAR_BTNS.map(b => ({ id: b.id, hidden: false }));
    bar.querySelectorAll('.be-fbtn-divider').forEach(d => d.remove());
    let shown = 0;
    layout.forEach(({ id, hidden }) => {
      const btn = bar.querySelector(`.be-fbtn[data-act="${id}"]`);
      if (!btn) return;
      const visible = !hidden && (id !== 'pick' || settings.pickEnabled);
      btn.hidden = !visible;
      if (visible) {
        if (shown++) { const d = mainDoc.createElement('span'); d.className = 'be-fbtn-divider'; bar.appendChild(d); }
        bar.appendChild(btn);
      } else {
        bar.appendChild(btn);
      }
    });
    // 全隐藏了也至少留一个「划线」，免得选中文字后什么都点不了
    if (!shown) { const b = bar.querySelector('.be-fbtn[data-act="highlight"]'); if (b) b.hidden = false; }
  }
  function showBar(rect) {
    const bar = ensureBar();
    applyTavernFloatStyle(bar, 'select');
    applyFloatBarLayout(bar);
    const pickBtn = bar.querySelector('.be-pick-btn');
    if (pickBtn) pickBtn.querySelector('span').textContent = pickPendingStart ? '设为结尾' : '设为开头';
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

  // ---------- 两点选线（设置里可关，默认开）----------
  // 划线浮动栏最后一个按钮：拖选一小段后点"设为开头"记下起点；再拖选一小段，按钮变成"设为结尾"，
  // 点了就把起点到这段末尾拼成一整段选区，重新弹出浮动栏，接着照常划线/想法/书摘。短句直接拖选即可。
  let pickPendingStart = null; // {node, offset, frame}，null 表示还没记开头
  function resetPickPending() { pickPendingStart = null; }
  function frameOrMainSelection(frame) {
    try { return (frame ? frameSelWin(frame) : mainWin).getSelection(); } catch (e) { return null; }
  }
  function handlePickStepMain() {
    if (!lastRange) return;
    if (!pickPendingStart) {
      pickPendingStart = { node: lastRange.startContainer, offset: lastRange.startOffset, frame: lastRangeFrame };
      hideBar();
      try { frameOrMainSelection(lastRangeFrame)?.removeAllRanges(); } catch (e) {}
      toast('已设开头，请选择结尾', 'info');
      return;
    }
    const endRange = lastRange;
    const endFrame = lastRangeFrame;
    if (pickPendingStart.frame !== endFrame) {
      toast('开头和结尾须在同一段内容中', 'error');
      resetPickPending();
      hideBar();
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
      toast('选区无效，请重新选择开头', 'error');
      resetPickPending();
      hideBar();
      return;
    }
    resetPickPending();
    const picked = getRangeText(range);
    if (!picked.text) { toast('未选中文字', 'error'); hideBar(); return; }
    lastText = picked.text;
    lastRichText = picked.rich;
    lastRange = range.cloneRange();
    lastRangeFrame = endFrame;
    // 把拼好的整段真正选中，用户能直接看到范围
    try { const sel = frameOrMainSelection(endFrame); sel.removeAllRanges(); sel.addRange(range.cloneRange()); } catch (e) {}
    const rects = range.getClientRects();
    const rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    showBar(endFrame ? translateFrameRect(rect, endFrame) : rect);
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
      <span class="be-fbtn-divider"></span>
      <button class="be-fbtn" data-act="mask" type="button"><span class="be-chl-ico be-chl-ico-mask"></span><span>打码</span></button>
    `;
    bar.addEventListener('pointerdown', e => { e.preventDefault(); });
    const fireAction = (act) => {
      if (!cardHlRange) return;
      if (act === 'mask') {
        const w = String(cardHlRange.toString() || '').replace(/\s+/g, '').trim();
        hideCardHlBar();
        try { mainWin.getSelection().removeAllRanges(); } catch (e) {}
        if (!w) return;
        if (w.length > 20) { toast('打码词过长，请选择较短的词（如人名）', 'info'); return; }
        maskWordInCard(w);
        toast(`已打码「${w}」。点击打码块可更换样式。`, 'success');
        return;
      }
      let style = act, color = '', bold = false;
      if (act === 'marker') color = settings.markerColor || '#ffdc6e';
      else if (act === 'underline') color = settings.underlineColor || '#95b6d6';
      else if (act === 'fontcolor') color = settings.underlineColor || '#95b6d6';
      else if (act === 'bold') { style = 'none'; bold = true; }
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
    // 第一行：删除 + 样式（线型/字色可点选或再点取消，加粗独立开关）；第二行：颜色
    pop.innerHTML = `
      <div class="be-hl-row1 be-chl-top">
        <button data-act="del" class="danger">删除划线</button>
        <span class="be-chl-sts">
          <button class="be-hl-st ${st==='underline'?'active':''}" data-st="underline" title="下划线"><span class="be-hl-sample sample-underline">A</span></button>
          <button class="be-hl-st ${st==='marker'?'active':''}" data-st="marker" title="荧光笔"><span class="be-hl-sample sample-marker">A</span></button>
          <button class="be-hl-st ${st==='fontcolor'?'active':''}" data-st="fontcolor" title="字色"><span class="be-hl-sample sample-fontcolor" style="color:${escapeHtml(first.dataset.col || '#e8a0a0')};">A</span></button>
          <button class="be-hl-st ${bold?'active':''}" data-act="bold" title="加粗"><span class="be-hl-sample sample-bold">B</span></button>
        </span>
      </div>
      <div class="be-hl-row2 be-hl-row2-scroll be-chl-cols">
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
    const removeAll = () => {
      cardHlGroup(gid).forEach(s => {
        const parent = s.parentNode;
        if (!parent) return;
        while (s.firstChild) parent.insertBefore(s.firstChild, s);
        parent.removeChild(s);
        try { parent.normalize(); } catch (e) {}
      });
      closeCardHlPop();
    };
    // 线型和加粗都取消了就什么效果都没有，直接去掉这处高亮
    const applyOrRemove = (nextSt, nextCol, nextBold) => {
      if (nextSt === 'none' && !nextBold) { removeAll(); return; }
      applyAll(nextSt, nextCol, nextBold);
      renderCardHlPop(pop, gid);
    };
    pop.querySelector('[data-act="del"]').addEventListener('click', removeAll);
    pop.querySelectorAll('.be-hl-st[data-st]').forEach(b => {
      b.addEventListener('click', () => {
        const picked = b.getAttribute('data-st');
        const curSt = first.dataset.st || 'underline';
        const nextSt = picked === curSt ? 'none' : picked;
        let nextCol = first.dataset.col;
        if (!nextCol && nextSt !== 'none') nextCol = nextSt === 'marker' ? (settings.markerColor || '#ffdc6e') : (settings.underlineColor || '#95b6d6');
        applyOrRemove(nextSt, nextCol, first.dataset.bold === '1');
      });
    });
    pop.querySelector('[data-act="bold"]').addEventListener('click', () => {
      applyOrRemove(first.dataset.st || 'none', first.dataset.col, first.dataset.bold !== '1');
    });
    // 选颜色时如果当前没有线型（只加粗），颜色按"字色"处理
    const colorTarget = () => { const s0 = first.dataset.st || 'none'; return s0 === 'none' ? 'fontcolor' : s0; };
    pop.querySelectorAll('.be-hl-col[data-col]').forEach(b => {
      b.addEventListener('click', () => {
        applyAll(colorTarget(), b.getAttribute('data-col'), first.dataset.bold === '1');
        renderCardHlPop(pop, gid);
      });
    });
    const customInput = pop.querySelector('.be-hl-col-input');
    if (customInput) {
      const onChange = () => applyAll(colorTarget(), customInput.value, first.dataset.bold === '1');
      customInput.addEventListener('input', onChange);
      customInput.addEventListener('change', onChange);
      customInput.addEventListener('pointerdown', e => e.stopPropagation());
      customInput.addEventListener('click', e => e.stopPropagation());
    }
  }
  function renderMaskPop(pop, word) {
    const ov = maskWordOverride(word);
    const cur = ov ? ov.style : '';
    const isExtra = maskExtraWords().includes(word);
    const opt = (v, label) => `<button class="${cur === v ? 'active' : ''}" data-ms="${v}">${label}</button>`;
    pop.innerHTML = `
      <div class="be-mask-pop-row">
        ${opt('', '默认')}${opt('block', '涂黑')}${opt('symbol', '符号')}${opt('custom', '自定义')}
        ${cur === 'custom' ? `<input type="text" class="be-mask-pop-char" maxlength="2" placeholder="符号" value="${escapeHtml((ov && ov.char) || '')}">` : ''}
        ${isExtra ? '<span class="be-hl-divider"></span><button data-act="unmask" class="danger">取消打码</button>' : ''}
      </div>`;
    pop.querySelectorAll('[data-ms]').forEach(b => b.addEventListener('click', () => {
      setMaskWordStyle(word, b.getAttribute('data-ms'));
      saveSettings(settings);
      restyleMaskInCard(word);
      renderMaskPop(pop, word);
    }));
    pop.querySelector('[data-act="unmask"]')?.addEventListener('click', () => {
      removeMaskExtraWord(word);
      saveSettings(settings);
      restyleMaskInCard(word, true);
      closeCardHlPop();
    });
    const ci = pop.querySelector('.be-mask-pop-char');
    if (ci) ci.addEventListener('input', () => {
      setMaskWordStyle(word, 'custom', ci.value.trim());
      saveSettings(settings);
      restyleMaskInCard(word);
    });
  }
  function openMaskPop(word, anchor) {
    openCardHlPop(null, anchor, (pop) => renderMaskPop(pop, word));
  }
  function openCardHlPop(gid, anchor, customRender) {
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
    if (customRender) customRender(pop); else renderCardHlPop(pop, gid);
    applyTavernFloatStyle(pop, 'select');
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
      if (!pop.contains(e.target) && !e.target.closest('.be-card-hl') && !e.target.closest('#be-card .be-mask') && !e.target.closest('#be-cpick')) closeCardHlPop();
    };
    setTimeout(() => mainDoc.addEventListener('pointerdown', _cardHlPopCloser, true), 60);
  }

  // 导出前（只动 clone，不碰预览）：把跨行的卡片二次高亮按"行"拆成多个 span。
  // html2canvas 给行内元素画背景/边框时用整个元素的外接矩形，不按行切片——跨两行的荧光笔会画成一大块，
  // 下划线只画在最底一行。按行拆开后每段只占一行，线/底色连续，跟预览一致（逐字拆会在字间留缝、波浪线也画不出来）。
  // 需要已经排好版（clone 已放进导出用的 iframe、宽度已定）才能量出每个字在哪一行。
  function splitCardHlForExport(root) {
    const doc = root.ownerDocument;
    root.querySelectorAll('.be-card-hl').forEach(span => {
      const cls = span.className;
      const css = span.getAttribute('style') || '';
      const walker = doc.createTreeWalker(span, NodeFilter.SHOW_TEXT);
      const texts = [];
      let t;
      while ((t = walker.nextNode())) texts.push(t);
      const segs = [];
      let cur = null;
      texts.forEach(tn => {
        const str = tn.nodeValue || '';
        let i = 0;
        while (i < str.length) {
          const len = str.codePointAt(i) > 0xffff ? 2 : 1;
          const r = doc.createRange();
          r.setStart(tn, i); r.setEnd(tn, i + len);
          const rects = r.getClientRects();
          const rc = rects.length ? rects[rects.length - 1] : null;
          const top = rc ? Math.round(rc.top) : (cur ? cur.top : 0);
          if (cur && cur.node === tn && Math.abs(top - cur.top) <= 2) cur.end = i + len;
          else { cur = { node: tn, start: i, end: i + len, top }; segs.push(cur); }
          i += len;
        }
      });
      if (segs.length <= 1) return; // 本来就在一行内，不用拆
      const wraps = [];
      for (let k = segs.length - 1; k >= 0; k--) {
        const sg = segs[k];
        let target = sg.node;
        if (sg.end < target.nodeValue.length) target.splitText(sg.end);
        if (sg.start > 0) target = target.splitText(sg.start);
        const w = doc.createElement('span');
        w.className = cls;
        w.setAttribute('style', css);
        w.style.paddingLeft = '0';
        w.style.paddingRight = '0';
        target.parentNode.insertBefore(w, target);
        w.appendChild(target);
        wraps.unshift(w);
      }
      // 原来整段左右各 1px 内边距，只保留在首尾，排版宽度不变
      wraps[0].style.paddingLeft = '1px';
      wraps[wraps.length - 1].style.paddingRight = '1px';
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
    showBar(r2);
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
    body, body :where(div, span, p, li, td, th, dd, dt, font, b, i, em, strong, small, u, s, del, ins, mark, sub, sup, label, blockquote, pre, code, h1, h2, h3, h4, h5, h6, section, article, details, summary, q, cite, abbr, a, ruby, rb, rt, time) {
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
    // 记下这条回复当时显示的是第几个 swipe：之后被重 roll 掉也能告诉用户它在哪个版本里
    let swipeId;
    try {
      const m = stContext()?.chat?.[parseInt(msgId)];
      if (m && Number.isInteger(m.swipe_id)) swipeId = m.swipe_id;
    } catch (e) {}
    const thoughtOnly = !!opts.thoughtOnly;
    // 优先沿用上次实际使用的样式/颜色，没用过则回退到设置里的默认
    const useStyle = opts.style || settings.lastStyle || settings.highlightStyle;
    const useColor = opts.color != null ? opts.color : (settings.lastColor || '');
    const note = addNote({
      type: 'highlight',
      text,
      thoughts: [],
      thoughtOnly,
      msgId,
      ...(swipeId !== undefined ? { swipeId } : {}),
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
    try { apiEmit('highlight:created', { note: apiClone({ ...note, charKey: ctx.charKey || 'unknown' }) }); } catch (e) {}
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
    applyTavernFloatStyle(bar, 'select');
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
      if (!bar.contains(e.target) && !e.target.closest('.be-highlight') && !e.target.closest('#be-cpick')) {
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
    const _locText = noteLocationText(note);
    const _locationHtml = _locText
      ? `<div class="be-vw-location"><i class="fa-solid fa-location-dot" style="margin-right:5px;"></i>${escapeHtml(_locText)}</div>`
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
  // ---------- 出处/水印字段存档 ----------
  // 每个字段单独一份收藏：点输入框旁的 ☆ 才记一笔（去重、新的排前），可置顶、可删除；
  // 置顶的永远排最前且不受条数上限影响。
  const SOURCE_HIST_MAX = 20;
  function getSourceHistory(field) {
    const all = (settings.sourceHistory && typeof settings.sourceHistory === 'object') ? settings.sourceHistory : {};
    const list = Array.isArray(all[field]) ? all[field].filter(x => x && typeof x.v === 'string' && x.v) : [];
    return [...list.filter(x => x.pin), ...list.filter(x => !x.pin)];
  }
  function setSourceHistory(field, list) {
    if (!settings.sourceHistory || typeof settings.sourceHistory !== 'object') settings.sourceHistory = {};
    const pins = list.filter(x => x.pin);
    const rest = list.filter(x => !x.pin).slice(0, SOURCE_HIST_MAX);
    settings.sourceHistory[field] = [...pins, ...rest];
  }
  function pushSourceHistory(field, value) {
    const v = String(value == null ? '' : value).trim();
    if (!v) return;
    const list = getSourceHistory(field);
    const old = list.find(x => x.v === v);
    const rest = list.filter(x => x.v !== v);
    const item = { v, pin: !!(old && old.pin) };
    setSourceHistory(field, item.pin ? [item, ...rest] : [...rest.filter(x => x.pin), item, ...rest.filter(x => !x.pin)]);
  }
  function renderSourceComboList(listEl) {
    const field = listEl.getAttribute('data-field');
    const items = getSourceHistory(field);
    listEl.innerHTML = items.length
      ? items.map(x => `
        <div class="be-combo-item${x.pin ? ' pinned' : ''}" data-v="${escapeHtml(x.v)}">
          <span class="be-combo-text">${escapeHtml(x.v)}</span>
          <button type="button" class="be-combo-act" data-act="pin" title="${x.pin ? '取消置顶' : '置顶'}"><i class="fa-solid fa-thumbtack"></i></button>
          <button type="button" class="be-combo-act" data-act="del" title="删除"><i class="fa-solid fa-xmark"></i></button>
        </div>`).join('')
      : `<div class="be-combo-empty">暂无收藏。填写后点 ☆ 收藏。</div>`;
  }
  function bindSourceCombos(mask) {
    mask.addEventListener('click', (e) => {
      const btn = e.target.closest('.be-combo-btn');
      if (btn) {
        const combo = btn.closest('.be-combo');
        const listEl = combo.nextElementSibling;
        const willOpen = listEl.hidden;
        mask.querySelectorAll('.be-combo-list').forEach(l => { l.hidden = true; });
        mask.querySelectorAll('.be-combo').forEach(c => c.classList.remove('open'));
        if (willOpen) { renderSourceComboList(listEl); listEl.hidden = false; combo.classList.add('open'); }
        markTypoDragging(350);
        return;
      }
      const item = e.target.closest('.be-combo-item');
      if (!item) return;
      const listEl = item.closest('.be-combo-list');
      const field = listEl.getAttribute('data-field');
      const v = item.getAttribute('data-v');
      const act = e.target.closest('.be-combo-act');
      if (act) {
        const list = getSourceHistory(field);
        if (act.getAttribute('data-act') === 'del') {
          setSourceHistory(field, list.filter(x => x.v !== v));
        } else {
          const it = list.find(x => x.v === v);
          if (it) it.pin = !it.pin;
          setSourceHistory(field, list);
        }
        saveSettings(settings);
        renderSourceComboList(listEl);
        syncSourceStars(mask);
        return;
      }
      const input = listEl.previousElementSibling.querySelector('input');
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      listEl.hidden = true;
      listEl.previousElementSibling.classList.remove('open');
    });
  }

  const SOURCE_FIELD_INPUTS = { user: '#be-src-user', author: '#be-src-author', title: '#be-src-title', chapter: '#be-src-chapter', watermark: '#be-src-wmtext' };
  // ☆：填好的内容点一下收藏进 ▾（再点取消）。底部「保存」只应用这一次，不会自动收藏
  function syncSourceStars(mask) {
    mask.querySelectorAll('.be-combo').forEach(combo => {
      const field = combo.getAttribute('data-field');
      const v = (combo.querySelector('input').value || '').trim();
      const on = !!v && getSourceHistory(field).some(x => x.v === v);
      const star = combo.querySelector('.be-combo-star');
      if (!star) return;
      star.classList.toggle('on', on);
      star.title = on ? '已收藏（点击取消）' : '收藏到 ▾ 列表';
      star.innerHTML = `<i class="fa-${on ? 'solid' : 'regular'} fa-star"></i>`;
    });
  }
  // 分组折叠：一次只展开一组，标题右边显示这组的摘要
  // 展开/收起时用 JS 量出实际高度做 max-height 过渡（组里还有会再展开的折叠区，写死高度会被裁切或动画不匀），结束后放开
  function animSourceGroup(g, open) {
    if (open === g.classList.contains('open')) return;
    const b = g.querySelector('.be-src-gbody');
    if (!b) { g.classList.toggle('open', open); return; }
    clearTimeout(b._beT);
    if (open) {
      b.style.maxHeight = '0px';
      g.classList.add('open');
      void b.offsetHeight;
      b.style.maxHeight = b.scrollHeight + 'px';
    } else {
      b.style.maxHeight = b.scrollHeight + 'px';
      void b.offsetHeight;
      g.classList.remove('open');
      b.style.maxHeight = '0px';
    }
    b._beT = setTimeout(() => { b.style.maxHeight = ''; }, 280);
  }
  function bindSourceGroups(mask) {
    mask.querySelectorAll('.be-src-ghead').forEach(h => h.addEventListener('click', () => {
      const g = h.closest('.be-src-group');
      const willOpen = !g.classList.contains('open');
      markTypoDragging(350);
      mask.querySelectorAll('.be-src-group').forEach(x => animSourceGroup(x, willOpen && x === g));
    }));
  }
  function updateSourceSummaries(mask) {
    const q = (sel) => mask.querySelector(sel);
    const ctx = getContext();
    const sum = (g, text) => { const el = mask.querySelector(`.be-src-group[data-g="${g}"] .be-src-gsum`); if (el) el.textContent = text; };
    const parts = [(q('#be-src-user').value.trim() || ctx.userName || '用户'), (q('#be-src-author').value.trim() || ctx.charName || '角色')];
    if (q('#be-src-showtitle').checked && q('#be-src-title').value.trim()) parts.push('《' + q('#be-src-title').value.trim() + '》');
    sum('info', parts.join(' · '));
    sum('wm', q('#be-src-showwm').checked ? (q('#be-src-wmtext').value.trim() || 'SillyTavern') : '关');
    if (q('#be-src-mask').checked) {
      const n = mask.querySelectorAll('#be-src-mask-chips .be-mask-chip').length;
      sum('mask', `开 · ${n} 个词`);
    } else sum('mask', '关');
    sum('other', `${q('#be-src-keepdel').checked ? '保留删除线' : '不留删除线'} · ${settings.saveMode === 'popup' ? '弹图长按' : '下载文件'}`);
    syncSourceStars(mask);
  }
  // 出处组合：用户名/作者/书名/章名/水印 存成一组，点一下全部填好（仍要点底部「保存」才生效）
  function sourcePresetFromForm(mask) {
    const q = (sel) => mask.querySelector(sel);
    return {
      user: q('#be-src-user').value.trim(), author: q('#be-src-author').value.trim(),
      title: q('#be-src-title').value.trim(), showTitle: q('#be-src-showtitle').checked,
      chapter: q('#be-src-chapter').value.trim(), showChapter: q('#be-src-showchapter').checked,
      wm: q('#be-src-wmtext').value, showWm: q('#be-src-showwm').checked
    };
  }
  function applySourcePreset(mask, p) {
    const q = (sel) => mask.querySelector(sel);
    const setV = (sel, v) => { const el = q(sel); el.value = v || ''; el.dispatchEvent(new Event('input', { bubbles: true })); };
    const setC = (sel, v) => { const el = q(sel); if (el.checked !== !!v) { el.checked = !!v; el.dispatchEvent(new Event('change', { bubbles: true })); } };
    setV('#be-src-user', p.user); setV('#be-src-author', p.author);
    setV('#be-src-title', p.title); setC('#be-src-showtitle', p.showTitle);
    setV('#be-src-chapter', p.chapter); setC('#be-src-showchapter', p.showChapter);
    setV('#be-src-wmtext', p.wm); setC('#be-src-showwm', p.showWm !== false);
    updateSourceSummaries(mask);
  }
  function renderSourcePresets(mask, naming = false) {
    const box = mask.querySelector('#be-src-presets');
    if (!box) return;
    const list = Array.isArray(settings.sourcePresets) ? settings.sourcePresets : [];
    box.innerHTML = `
      <div class="be-src-preset-h">出处组合<span>一次填入用户名、作者、书名、章名、水印</span></div>
      <div class="be-src-preset-chips">
        ${list.map(p => `<span class="be-src-preset"><button type="button" class="be-src-preset-apply" data-id="${escapeHtml(p.id)}" title="${escapeHtml([p.user, p.author, p.title, p.chapter].filter(Boolean).join(' · ') || '（空）')}">${escapeHtml(p.name || '未命名')}</button><button type="button" class="be-src-preset-del" data-id="${escapeHtml(p.id)}" title="删除这个组合">×</button></span>`).join('')}
        ${naming ? '' : '<button type="button" class="be-src-preset-add"><i class="fa-solid fa-plus"></i> 存为组合</button>'}
      </div>
      ${naming ? `<div class="be-src-preset-new">
        <input type="text" class="be-src-preset-name" placeholder="组合名称" maxlength="20">
        <button type="button" class="be-btn primary be-src-preset-ok">保存</button>
        <button type="button" class="be-btn be-src-preset-cancel">取消</button>
      </div>` : ''}`;
    if (naming) {
      const inp = box.querySelector('.be-src-preset-name');
      const f = sourcePresetFromForm(mask);
      inp.value = f.title || f.author || `组合${list.length + 1}`;
      setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) {} }, 0);
    }
  }
  function bindSourcePresets(mask) {
    const box = mask.querySelector('#be-src-presets');
    const commitNew = () => {
      const name = (box.querySelector('.be-src-preset-name')?.value || '').trim();
      if (!name) { toast('给组合起个名字', 'info'); return; }
      const p = { id: 'sp' + Date.now().toString(36), name, ...sourcePresetFromForm(mask) };
      const list = (Array.isArray(settings.sourcePresets) ? settings.sourcePresets : []).filter(x => x.name !== name);
      list.push(p);
      settings.sourcePresets = list;
      saveSettings(settings);
      renderSourcePresets(mask);
      toast(`已存为组合「${name}」`, 'success');
    };
    box.addEventListener('click', async (e) => {
      if (e.target.closest('.be-src-preset-add')) { renderSourcePresets(mask, true); return; }
      if (e.target.closest('.be-src-preset-cancel')) { renderSourcePresets(mask); return; }
      if (e.target.closest('.be-src-preset-ok')) { commitNew(); return; }
      const del = e.target.closest('.be-src-preset-del');
      if (del) {
        const p = (settings.sourcePresets || []).find(x => x.id === del.getAttribute('data-id'));
        if (!p) return;
        const r = await beConfirm({ text: `删除组合「${p.name}」？`, okText: '删除' });
        if (!r.ok) return;
        settings.sourcePresets = (settings.sourcePresets || []).filter(x => x.id !== p.id);
        saveSettings(settings);
        renderSourcePresets(mask);
        return;
      }
      const ap = e.target.closest('.be-src-preset-apply');
      if (ap) {
        const p = (settings.sourcePresets || []).find(x => x.id === ap.getAttribute('data-id'));
        if (p) { applySourcePreset(mask, p); toast(`已填入「${p.name}」，保存后生效`, 'info'); }
      }
    });
    box.addEventListener('keydown', (e) => {
      if (e.target.closest('.be-src-preset-name') && e.key === 'Enter') { e.preventDefault(); commitNew(); }
    });
    // ☆ 收藏
    mask.querySelector('#be-source-box').addEventListener('click', (e) => {
      const star = e.target.closest('.be-combo-star');
      if (!star) return;
      const combo = star.closest('.be-combo');
      const field = combo.getAttribute('data-field');
      const v = (combo.querySelector('input').value || '').trim();
      if (!v) { toast('内容为空，无法收藏', 'info'); return; }
      const list = getSourceHistory(field);
      if (list.some(x => x.v === v)) setSourceHistory(field, list.filter(x => x.v !== v));
      else pushSourceHistory(field, v);
      saveSettings(settings);
      syncSourceStars(mask);
      const listEl = combo.nextElementSibling;
      if (listEl && !listEl.hidden) renderSourceComboList(listEl);
    });
  }

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
          <div class="be-src-group open" data-g="info">
            <button type="button" class="be-src-ghead"><span class="be-src-caret"></span><span class="be-src-gname">出处信息</span><span class="be-src-gsum"></span></button>
            <div class="be-src-gbody">
              <div class="be-src-presets" id="be-src-presets"></div>
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
                <div class="be-combo" data-field="user"><input type="text" id="be-src-user" placeholder=""><button type="button" class="be-combo-star" title="收藏到 ▾ 列表"><i class="fa-regular fa-star"></i></button><button type="button" class="be-combo-btn" title="收藏的内容"><i class="fa-solid fa-chevron-down"></i></button></div><div class="be-combo-list" data-field="user" hidden></div>
              </div>
              <div class="be-src-field">
                <label>作者（留空使用 ${escapeHtml('{{char}}')}）</label>
                <div class="be-combo" data-field="author"><input type="text" id="be-src-author" placeholder=""><button type="button" class="be-combo-star" title="收藏到 ▾ 列表"><i class="fa-regular fa-star"></i></button><button type="button" class="be-combo-btn" title="收藏的内容"><i class="fa-solid fa-chevron-down"></i></button></div><div class="be-combo-list" data-field="author" hidden></div>
              </div>
              <div class="be-src-row">
                <input type="checkbox" id="be-src-showtitle">
                <label for="be-src-showtitle">显示书名</label>
              </div>
              <div class="be-src-collapse" id="be-src-title-wrap">
                <div class="be-src-field">
                  <label>书名 / 作品名</label>
                  <div class="be-combo" data-field="title"><input type="text" id="be-src-title" placeholder="书名将显示在卡片上"><button type="button" class="be-combo-star" title="收藏到 ▾ 列表"><i class="fa-regular fa-star"></i></button><button type="button" class="be-combo-btn" title="收藏的内容"><i class="fa-solid fa-chevron-down"></i></button></div><div class="be-combo-list" data-field="title" hidden></div>
                </div>
              </div>
              <div class="be-src-row">
                <input type="checkbox" id="be-src-showchapter">
                <label for="be-src-showchapter">显示章名</label>
              </div>
              <div class="be-src-collapse" id="be-src-chapter-wrap">
                <div class="be-src-field">
                  <label>章名（部分模板会显示在书名/作者旁）</label>
                  <div class="be-combo" data-field="chapter"><input type="text" id="be-src-chapter" placeholder="章名将显示在卡片上"><button type="button" class="be-combo-star" title="收藏到 ▾ 列表"><i class="fa-regular fa-star"></i></button><button type="button" class="be-combo-btn" title="收藏的内容"><i class="fa-solid fa-chevron-down"></i></button></div><div class="be-combo-list" data-field="chapter" hidden></div>
                </div>
              </div>
            </div>
          </div>
          <div class="be-src-group" data-g="wm">
            <button type="button" class="be-src-ghead"><span class="be-src-caret"></span><span class="be-src-gname">水印</span><span class="be-src-gsum"></span></button>
            <div class="be-src-gbody">
              <div class="be-src-row">
                <input type="checkbox" id="be-src-showwm">
                <label for="be-src-showwm">显示水印</label>
              </div>
              <div class="be-src-collapse" id="be-src-wm-wrap">
                <div class="be-src-field">
                  <label>水印文字</label>
                  <div class="be-combo" data-field="watermark"><input type="text" id="be-src-wmtext" placeholder="留空默认 SillyTavern"><button type="button" class="be-combo-star" title="收藏到 ▾ 列表"><i class="fa-regular fa-star"></i></button><button type="button" class="be-combo-btn" title="收藏的内容"><i class="fa-solid fa-chevron-down"></i></button></div><div class="be-combo-list" data-field="watermark" hidden></div>
                </div>
              </div>
            </div>
          </div>
          <div class="be-src-group" data-g="mask">
            <button type="button" class="be-src-ghead"><span class="be-src-caret"></span><span class="be-src-gname">打码</span><span class="be-src-gsum"></span></button>
            <div class="be-src-gbody">
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
                  <label>打码的词（点一下单独设样式）</label>
                  <div class="be-mask-chip-box" id="be-src-mask-chips"></div>
                </div>
                <div class="be-src-field">
                  <label>默认打码形式</label>
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
            </div>
          </div>
          <div class="be-src-group" data-g="other">
            <button type="button" class="be-src-ghead"><span class="be-src-caret"></span><span class="be-src-gname">其他</span><span class="be-src-gsum"></span></button>
            <div class="be-src-gbody">
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
      bindSourceCombos(mask);
      bindSourceGroups(mask);
      bindSourcePresets(mask);
      // 打码词 chip：点开单独设样式。打码对象/用户名/作者还没点「保存」也要立刻反映到 chip 上，
      // 所以 chip 按弹窗里当前勾选和填写的值算（而不是已保存的设置）
      const pendingMask = () => ({
        maskUser: mask.querySelector('#be-src-mask-obj-user').checked,
        maskChar: mask.querySelector('#be-src-mask-obj-char').checked,
        sourceUser: mask.querySelector('#be-src-user').value.trim(),
        sourceAuthor: mask.querySelector('#be-src-author').value.trim()
      });
      bindMaskChips(mask.querySelector('#be-src-mask-chips'), (what) => {
        if (what === 'extra') mask.querySelector('#be-src-mask-extra').value = settings.maskExtra || '';
        if (mainDoc.getElementById('be-card')) renderCard(lastText);
        updateSourceSummaries(mask);
      }, pendingMask);
      mask.querySelector('#be-src-mask-extra').addEventListener('input', (e) => {
        settings.maskExtra = e.target.value;
        mask.querySelector('#be-src-mask-chips')._beRender?.();
      });
      const rerenderChips = () => mask.querySelector('#be-src-mask-chips')._beRender?.();
      ['#be-src-mask-obj-user', '#be-src-mask-obj-char'].forEach(sel => mask.querySelector(sel).addEventListener('change', rerenderChips));
      ['#be-src-user', '#be-src-author'].forEach(sel => mask.querySelector(sel).addEventListener('input', rerenderChips));
      // 分组标题上的摘要跟着改动实时更新
      mask.querySelector('#be-source-box').addEventListener('input', () => updateSourceSummaries(mask));
      mask.querySelector('#be-source-box').addEventListener('change', () => updateSourceSummaries(mask));
      mask.querySelector('#be-source-box').addEventListener('click', (e) => { if (e.target.closest('.be-radio-opt')) setTimeout(() => updateSourceSummaries(mask), 0); });
    } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    detectAndApplyTheme();
    mask.querySelectorAll('.be-combo-list').forEach(l => { l.hidden = true; });
    mask.querySelectorAll('.be-combo').forEach(c => c.classList.remove('open'));
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
    mask.querySelector('#be-src-mask-chips')._beRender?.();
    mask.querySelector('#be-src-mask-source').checked = !!settings.maskSource;
    // 打码对象回显（user / char 各自独立，可都选可都不选）
    mask.querySelector('#be-src-mask-obj-user').checked = !!settings.maskUser;
    mask.querySelector('#be-src-mask-obj-char').checked = !!settings.maskChar;
    mask.querySelector('#be-src-keepdel').checked = !!settings.keepDelLine;
    mask.querySelector('#be-src-mask-chips')._beRender?.();
    mask.querySelectorAll('.be-src-group').forEach(g => {
      const b = g.querySelector('.be-src-gbody');
      if (b) { clearTimeout(b._beT); b.style.maxHeight = ''; }
      g.classList.toggle('open', g.getAttribute('data-g') === 'info');
    });
    renderSourcePresets(mask);
    syncSourceStars(mask);
    setTimeout(() => updateSourceSummaries(mask), 0);
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
            const chip = e => `<div class="be-drawer-chip ${settings.template===e.key?'active':''}" data-k="${e.key}">${e.fav?'★ ':''}${escapeHtml(e.name)}${e.lid ? `<span class="be-lay-chip-edit" data-ledit="${e.lid}" title="编辑排版"><i class="fa-solid fa-pen"></i></span>` : ''}</div>`;
            const parts = favs.map(chip);
            if (favs.length && rest.length) parts.push('<span class="be-drawer-sep">·</span>');
            parts.push(...rest.map(chip));
            parts.push('<div class="be-drawer-chip be-drawer-new" data-new-layout="1"><i class="fa-solid fa-plus"></i> 自由排版</div>');
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
          <div class="be-drawer-chip be-color-chip rainbow ${settings.colorPreset==='custom'?'active':''}" data-k="custom" title="自定义">●</div>
          ${COLOR_PRESETS.filter(p => !(settings.hiddenColorPresets || []).includes(p.id)).map(p => `
            <div class="be-drawer-chip be-color-chip ${settings.colorPreset===p.id?'active':''}" data-k="${p.id}"
                 style="background:${p.bg};color:${p.fg};">A</div>
          `).join('')}
          ${(settings.customColors||[]).map(c => `
            <div class="be-drawer-chip be-color-chip ${settings.colorPreset===('saved-'+c.id)?'active':''}" data-k="saved-${c.id}"
                 style="background:${c.bg};color:${c.fg};" title="${escapeHtml(c.name||'自定义配色')}">A</div>
          `).join('')}
        </div>
      </div>
      <button class="be-drawer-confirm" id="be-drawer-confirm">确定</button>
    `;
    const apply = () => {
      saveSettings(settings);
      renderCard(lastText);
    };
    drawer.querySelectorAll('#be-drawer-tpl .be-drawer-chip').forEach(el => {
      el.addEventListener('click', (e) => {
        if (el.hasAttribute('data-new-layout')) { openLayoutEditor(null, { fromModal: true }); return; }
        const ed = e.target.closest('[data-ledit]');
        if (ed) { e.stopPropagation(); openLayoutEditor(ed.getAttribute('data-ledit'), { fromModal: true }); return; }
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
        if (settings.colorPreset === 'custom') openDrawerCustomColor(el);
      });
    });
    drawer.querySelector('#be-drawer-confirm').addEventListener('click', () => drawer._closeFn && drawer._closeFn());
    drawer.querySelectorAll('.be-drawer-row').forEach(enableHScroll);
  }

  // 自定义配色取色器：背景 / 字色 两个目标，拖动时实时刷新卡片（rAF 合并，拖动不卡）
  function openDrawerCustomColor(anchor) {
    const mk = (v) => { const i = mainDoc.createElement('input'); i.type = 'color'; i.value = v; return i; };
    const bgIn = mk(settings.customBg || '#f5f1e8');
    const fgIn = mk(settings.customFg || '#222222');
    let raf = 0;
    const live = () => {
      if (raf) return;
      raf = mainWin.requestAnimationFrame(() => { raf = 0; if (mainDoc.getElementById('be-card')) renderCard(lastText); });
    };
    bgIn.addEventListener('input', () => { settings.customBg = bgIn.value; live(); });
    fgIn.addEventListener('input', () => { settings.customFg = fgIn.value; settings.customFgEnabled = true; live(); });
    [bgIn, fgIn].forEach(i => i.addEventListener('change', () => saveSettings(settings)));
    openColorPicker(bgIn, {
      anchor,
      targets: [
        { label: '背景', input: bgIn },
        { label: '字色', input: fgIn, auto: { get: () => !settings.customFgEnabled, set: (v) => { settings.customFgEnabled = !v; saveSettings(settings); live(); } } }
      ]
    });
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
          <span>倍率越高图片越清晰，生成越慢、文件越大。</span>
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
    layClearOnceImgs();
    _apiSourceOverride = null;
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
      // 手机屏比设定宽度窄时：原来外层 maxWidth:100% 直接把卡片压窄，预览按屏幕宽度换行，
      // 导出却按设定宽度排 → 两边换行不一样（用户反馈）。现在卡片始终按设定宽度排版，
      // 放不下就用 zoom 整体缩小显示，换行和导出完全一致。不支持 zoom 的旧浏览器维持原样。
      if (cardEl && ZOOM_OK) {
        const avail = (wrap.parentElement && wrap.parentElement.clientWidth) || cw;
        const z = avail < cw ? Math.max(0.3, avail / cw) : 1;
        cardEl.style.width = z < 1 ? cw + 'px' : '';
        cardEl.style.zoom = z < 1 ? String(+z.toFixed(4)) : '';
      }
    } else {
      wrap.style.width = '';
      wrap.style.maxWidth = '';
      wrap.style.alignSelf = '';
      if (cardEl) { cardEl.style.width = ''; cardEl.style.zoom = ''; }
    }
  }
  const ZOOM_OK = (() => { try { return !!(mainWin.CSS && mainWin.CSS.supports('zoom', '0.5')); } catch (e) { return false; } })();
  // 转屏/窗口缩放后重新算预览缩放比例
  try {
    let _rzT = 0;
    // 脚本 iframe 重建后旧实例的监听器会变成僵尸，先摘掉上一个实例挂的
    if (mainWin.__beResizeFn) mainWin.removeEventListener('resize', mainWin.__beResizeFn);
    mainWin.__beResizeFn = () => {
      if (_rzT) clearTimeout(_rzT);
      _rzT = setTimeout(() => { _rzT = 0; if (mainDoc.getElementById('be-card')) applyTypoLive(); }, 120);
    };
    mainWin.addEventListener('resize', mainWin.__beResizeFn);
  } catch (e) {}

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
  function layHtmlToPlain(html) {
    if (!html) return '';
    const d = mainDoc.createElement('div');
    d.innerHTML = html;
    d.querySelectorAll('.be-mask').forEach(m => m.replaceWith('■'.repeat(Math.max(1, Math.min(4, (m.getAttribute('data-mask-word') || '■').length)))));
    d.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
    d.querySelectorAll('p, div').forEach(b => b.append('\n'));
    return (d.textContent || '').replace(/\n{2,}/g, '\n').trim();
  }
  // 书摘弹窗里「仅本次」换的排版图片：{ 模板id: { 'g:组号' 或 图片id: { 图片id: {src, ar, baked, shd, shdBox} } } }，关掉弹窗就清空
  const _layOnceImgs = {};
  function buildCardMarkup(text, opts = {}) {
    const tplKey = opts.tplKey || settings.template;
    const isCustomTpl = String(tplKey || '').startsWith('custom-');
    // 自由排版的版式模板：编辑器传进来的草稿优先，否则按 key 找已存的；找不到（被删了）就回落经典
    const layoutTpl = String(tplKey || '').startsWith('layout-') ? (opts.layoutDraft || layGetTemplate(tplKey)) : null;
    const tplId = isCustomTpl
      ? tplKey
      : (layoutTpl ? 'layout' : (TEMPLATES[tplKey] ? tplKey : 'classic'));
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
    const src = (!opts.preview && _apiSourceOverride) ? { ...getSourceValues(), ..._apiSourceOverride } : getSourceValues();
    // 模板预览用固定占位内容（user/char/书名/章名 + 纯色头像），只为看版式
    const userName   = opts.preview ? 'user' : (src.sourceUser   || ctx.userName || '');
    const authorName = opts.preview ? 'char' : (src.sourceAuthor || ctx.charName || '');
    const bookName   = opts.preview ? '书名' : (src.showSourceTitle ? (src.sourceTitle || '') : '');
    const chapter    = opts.preview ? '章名' : (src.showSourceChapter ? (src.sourceChapter || '') : '');
    const dateText = `摘录于 ${formatDate()}`;

    // 头像（按设置选 user / char / custom）
    const avatarUrl = (() => {
      if (opts.preview) return '';
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
    if (tplId === 'layout') {
      const thoughtHtml = thoughtText ? maskText(thoughtText) : '';
      inner = renderLayoutInner(layoutTpl, {
        quoteHtml: quotePart, quotePlain: layHtmlToPlain(quotePart),
        thoughtHtml, thoughtPlain: layHtmlToPlain(thoughtHtml),
        charName: opts.preview ? 'char' : (ctx.charName || ''),
        userName, authorName, bookName, chapter, wmText,
        preview: !!opts.preview, edit: !!opts.layEdit, pageW: opts.layPageW,
        previewColors: opts.layPreview || null,
        imgOverride: (!opts.layEdit && !opts.preview && _layOnceImgs[layoutTpl.id]) || null
      });
    } else if (isCustomTpl) {
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
      <div class="be-card tpl-${tplId}${noQuoteCls}" ${(opts.preview || opts.noId) ? '' : 'id="be-card"'}
           style="background:${c.bg};color:${c.fg};font-family:${fontCssAttr};--be-card-bg:${c.bg};--be-card-fg:${c.fg};">
        ${inner}
      </div>
    `;
    return { html, fontCss: font.css };
  }

  // 防外部全局字体覆盖预览：字体管理器类脚本/主题会注入
  //   *:not(...) { font-family: X !important; font-weight: initial }
  // `*` 直接命中卡片里每个元素，模板设的字体全失效；导出走沙箱不受影响 → 预览和下载不一致。
  // 做法：把卡片复制进 Shadow DOM（外部样式表进不去，等同导出沙箱），读出每个元素本来的字体/字重，
  // 和预览里实际的不一样就用行内 !important 写回（行内 !important 优先于样式表 !important）。
  function shieldCardFonts(card) {
    if (!card || !card.isConnected || !card.attachShadow) return;
    let host = null;
    try {
      host = mainDoc.createElement('div');
      host.style.cssText = 'position:absolute;left:-99999px;top:0;width:10px;height:10px;overflow:hidden;visibility:hidden;pointer-events:none;';
      const sr = host.attachShadow({ mode: 'open' });
      // 导出沙箱里卡片继承 body 的字体 = 预览卡片外层的计算字体，这里同样让宿主带上它
      const pf = mainWin.getComputedStyle(card.parentElement || card).fontFamily || '';
      const st = mainDoc.createElement('style');
      st.textContent = (mainDoc.getElementById('be-style')?.textContent || '') + ' ' + (mainDoc.getElementById('be-custom-style')?.textContent || '');
      const hostSt = mainDoc.createElement('style');
      hostSt.textContent = ':host{all:initial}';
      sr.appendChild(hostSt);
      sr.appendChild(st);
      const clone = card.cloneNode(true);
      clone.style.zoom = '';
      // 去掉上次写回的行内字体，量的是模板本来的
      [clone, ...clone.querySelectorAll('[data-be-fshield]')].forEach(el => {
        if (!el.hasAttribute('data-be-fshield')) return;
        el.style.removeProperty('font-family'); el.style.removeProperty('font-weight'); el.removeAttribute('data-be-fshield');
        const keep = el.getAttribute('data-be-ff'); if (keep) el.style.fontFamily = keep;
      });
      const wrapEl = mainDoc.createElement('div');
      wrapEl.style.fontFamily = pf;
      wrapEl.appendChild(clone);
      sr.appendChild(wrapEl);
      mainDoc.body.appendChild(host);
      const src = [card, ...card.querySelectorAll('*')];
      const dst = [clone, ...clone.querySelectorAll('*')];
      const n = Math.min(src.length, dst.length);
      for (let i = 0; i < n; i++) {
        const a = src[i], b = dst[i];
        if (a.tagName !== b.tagName) break;
        const ca = mainWin.getComputedStyle(a), cb = mainWin.getComputedStyle(b);
        const ff = cb.fontFamily, fw = cb.fontWeight;
        let touched = false;
        if (ff && ca.fontFamily !== ff) {
          if (!a.hasAttribute('data-be-fshield') && a.style.fontFamily) a.setAttribute('data-be-ff', a.style.fontFamily);
          a.style.setProperty('font-family', ff, 'important'); touched = true;
        }
        if (fw && ca.fontWeight !== fw) { a.style.setProperty('font-weight', fw, 'important'); touched = true; }
        if (touched) a.setAttribute('data-be-fshield', '1');
      }
    } catch (e) {
      console.warn('[BookExcerpt] shieldCardFonts failed:', e);
    } finally {
      try { host && host.remove(); } catch (e) {}
    }
  }

  function renderCard(text) {
    const wrap = mainDoc.getElementById('be-card-wrap');
    if (!wrap) return;
    const built = buildCardMarkup(text);
    const font = { css: built.fontCss };
    wrap.innerHTML = built.html;
    // 预览里点打码块：单独换这个词的样式 / 取消打码（wrap 常驻，只绑一次）
    if (!wrap._beMaskClick) {
      wrap._beMaskClick = true;
      wrap.addEventListener('click', (e) => {
        const m = e.target.closest && e.target.closest('#be-card .be-mask[data-mask-word]');
        if (!m) return;
        e.stopPropagation();
        openMaskPop(m.getAttribute('data-mask-word'), m);
      });
    }
    // 字号/行距/字距(CSS 变量) + 整体宽度(外层容器居中)：与拖动滑块共用同一套应用逻辑
    applyTypoLive();
    // 强制把字体应用到 .be-quote（防止某些环境样式被 user-agent 覆盖）
    const quoteEl = wrap.querySelector('.be-quote');
    if (quoteEl) {
      if (!quoteEl.closest('.be-lay')) quoteEl.style.fontFamily = font.css;
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
            shieldCardFonts(wrap.querySelector('.be-card'));
          }, 300);
        });
      }
    }
    // 自由排版的图片：点一下换图（仅本次导出 / 保存到模板）
    if (!wrap._beLayImg) {
      wrap._beLayImg = true;
      wrap.addEventListener('click', (e) => {
        const im = e.target.closest && e.target.closest('#be-card .be-lay [data-lay-aid]');
        if (!im || !im.classList.contains('be-lay-imgw')) return;
        e.stopPropagation();
        layModalReplaceImage(im.getAttribute('data-lay-aid'));
      });
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
    shieldCardFonts(wrap.querySelector('.be-card'));
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
  // 「跟随酒馆」字体导出字挤/字散的根因：主题字体是酒馆主文档里（美化 CSS 的 @font-face / @import）加载的，
  // 沙箱 iframe 原来只复制了书摘自己的样式和 be-font-* 链接，主题字体在沙箱里根本没有 → html2canvas 按回退字体
  // 量出每个字的位置，画到 canvas 上时却用了主文档里已加载的主题字形，两套字宽对不上，字就挤在一起或散开。
  // 这里把卡片实际用到的字体族对应的 @font-face 复制进沙箱（url 按原样式表地址转成绝对路径），
  // 读不到规则的跨域样式表（如 Google Fonts 的 @import）就直接带上它的链接。
  function collectCardFontCss(card) {
    const families = new Set();
    const addFam = (ff) => String(ff || '').split(',').forEach(f => {
      const n = f.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
      if (n) families.add(n);
    });
    try { [card, ...card.querySelectorAll('*')].forEach(el => addFam(mainWin.getComputedStyle(el).fontFamily)); } catch (e) {}
    const faces = [], links = new Set();
    const absUrls = (css, base) => css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, u) => {
      if (/^(data:|blob:|https?:|\/\/)/i.test(u)) return m;
      try { return `url("${new URL(u, base).href}")`; } catch (e) { return m; }
    });
    const walk = (sheet, depth) => {
      if (!sheet || depth > 4) return;
      let rules;
      try { rules = sheet.cssRules; } catch (e) { if (sheet.href) links.add(sheet.href); return; }
      if (!rules) return;
      const base = sheet.href || mainDoc.baseURI;
      for (const r of rules) {
        if (r.type === 5) {          // CSSFontFaceRule
          const fam = String(r.style.getPropertyValue('font-family') || '').trim().replace(/^['"]|['"]$/g, '').toLowerCase();
          if (families.has(fam)) faces.push(absUrls(r.cssText, base));
        } else if (r.type === 3) {   // CSSImportRule
          if (r.styleSheet) walk(r.styleSheet, depth + 1);
          else if (r.href) { try { links.add(new URL(r.href, base).href); } catch (e) {} }
        } else if (r.cssRules) {     // @media / @supports / @layer
          walk({ cssRules: r.cssRules, href: sheet.href }, depth + 1);
        }
      }
    };
    try { Array.from(mainDoc.styleSheets).forEach(sh => walk(sh, 0)); } catch (e) {}
    return { faces: faces.join('\n'), links: [...links], families: [...families] };
  }

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
      const themeFonts = collectCardFontCss(card);
      // 跨域样式表只带字体服务的（其余跨域表里不会有卡片要的字体，带进去只会拖慢加载）
      const themeLinks = themeFonts.links
        .filter(h => /font/i.test(h))
        .map(h => `<link rel="stylesheet" href="${escapeHtml(h)}">`).join('');
      idoc.open();
      idoc.write(`<!DOCTYPE html><html><head>
        <meta charset="utf-8">
        ${fontLinks}
        ${themeLinks}
        <style>${themeFonts.faces}</style>
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
        // 预览缩放（zoom）会影响部分引擎读出的计算值，量之前临时摘掉（同步执行，不会闪）
        var _prevZoom = card.style.zoom;
        if (_prevZoom) card.style.zoom = '';
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
      try { if (_prevZoom) card.style.zoom = _prevZoom; } catch (e) {}
      cardClone.style.zoom = '';
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
      // 跨行高亮按行拆开（要在排好版之后量，且在上面按元素顺序冻结样式之后，拆完元素顺序就对不上了）
      try { void cardClone.offsetHeight; splitCardHlForExport(cardClone); } catch (e) {}
      // 在 clone 上把头像换成清晰 <img>（不影响主文档预览）
      await processAvatarInClone(cardClone, idoc, dpr);
      // 宽度变化会改变高度，重排后按内容真实高度调整 iframe（h2c 按元素尺寸截，留足空间即可）
      // 设备卡顿/长文本下 16ms 不一定够一次真实重排，适当加长
      await new Promise(r => setTimeout(r, 32));
      iframe.style.height = (cardClone.scrollHeight + 4) + 'px';
      // 等字体（iframe 自己的字体加载）：慢网/自定义字体首次加载可能来不及，适当放宽超时给更多机会加载完，
      // 超时仍继续（不阻塞保存），只是尽量减少"极少数环境下用了 fallback 字体导致排版跟预览不一致"的概率
      try {
        // 只等 fonts.ready 不够：字体只有被用到才开始下载，CJK 字体常按 unicode-range 拆成很多分片，
        // 要用卡片里的真实文字显式 load 一遍，对应分片才会下载
        const sample = (cardClone.textContent || '').replace(/\s+/g, '').slice(0, 400) || '书摘';
        const loads = (idoc.fonts && idoc.fonts.load)
          ? themeFonts.families.map(f => idoc.fonts.load(`16px "${f.replace(/"/g, '')}"`, sample).catch(() => {}))
          : [];
        await Promise.race([
          Promise.all(loads).then(() => (idoc.fonts && idoc.fonts.ready) || null),
          new Promise(r => setTimeout(r, 2500))
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
          // 预览缩放（zoom）不能带进导出：按设定宽度原尺寸截
          clone.style.zoom = '';
          if (Number(settings.cardWidth) > 0) { clone.style.width = Number(settings.cardWidth) + 'px'; clone.style.maxWidth = 'none'; }
          mainDoc.body.appendChild(clone);
          try { void clone.offsetHeight; splitCardHlForExport(clone); } catch (e) {}
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
          try { apiEmit('card:saved', { fileName: fname, mode: 'popup' }); } catch (e) {}
        } else {
          const img = await canvasToImage(canvas, 'image/png');
          let ok = false;
          try { ok = triggerDownload(img, fname); } catch (e) { ok = false; }
          if (ok) {
            try { canvas.width = canvas.height = 0; } catch (e) {}
            toast('已保存图片', 'success');
            try { apiEmit('card:saved', { fileName: fname, mode: 'download' }); } catch (e) {}
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
    if (!panel.classList.contains('open')) markTypoDragging(380);
    panel.classList.add('open');
    renderPanel();
  }
  function closePanel() {
    mainDoc.getElementById('be-panel')?.classList.remove('open');
  }
  // 点「书摘笔记」：按设置先显示笔记本主页 / 当前角色 / 设置。
  // 选了「当前角色」但没开聊天、或这个角色还没有划线和想法时，回落到笔记本主页。
  function openPanelHome() {
    const home = settings.panelHome || 'notes';
    if (home === 'settings') return openPanel('settings');
    if (home === 'char') {
      const ctx = getContext();
      const ch = loadNotes()[ctx.charKey];
      if (ctx.chatId && ch && Array.isArray(ch.items) && ch.items.some(it => it.type !== 'excerpt')) {
        openPanel('notes');
        currentCharKey = ctx.charKey;
        panelView = 'char';
        renderPanel();
        return;
      }
    }
    openPanel('notes');
  }

  // 入场动画：fade 淡入 / slide 滑动（dir<0 从左边进，否则从右边进）
  function playPanelSwitchAnim(el, dir) {
    if (!el) return;
    el.classList.remove('be-body-anim', 'be-slide-l', 'be-slide-r');
    void el.offsetWidth;
    if (settings.panelAnim === 'slide') {
      markTypoDragging(460);
      el.classList.add(dir < 0 ? 'be-slide-l' : 'be-slide-r');
    } else {
      el.classList.add('be-body-anim');
    }
  }

  function renderPanel() {
    const panel = mainDoc.getElementById('be-panel');
    if (!panel) return;
    if (panelView === 'char') return renderCharNotes(panel);
    if (panelView === 'review') return renderReviewView(panel);
    if (panelView === 'heatmap') return renderHeatmapView(panel);
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
        playPanelSwitchAnim(mainDoc.getElementById('be-p-body'), newView === 'notes' ? -1 : 1);
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
  // templateFavorites / hiddenTemplates 存 key；templateOrder 只有用户在列表里拖动过（templateOrderManual）才生效，
  // 否则一律 默认模板在前、导入模板按导入顺序在后。
  const fa = (name) => `<i class="fa-solid fa-${name}"></i>`;
  let _tplListOpen = false;
  let _hiddenTplOpen = false;
  function getAllTemplateEntries() {
    const favSet = new Set(settings.templateFavorites || []);
    const hidden = new Set(settings.hiddenTemplates || []);
    const natural = [
      ...Object.entries(TEMPLATES).map(([k, v]) => ({ key: k, name: v.name, isDefault: true })),
      ...(settings.customTemplates || []).map(t => ({ key: `custom-${t.id}`, name: t.name || '未命名', isDefault: false, tid: t.id })),
      ...(settings.layoutTemplates || []).map(t => ({ key: `layout-${t.id}`, name: t.name || '我的排版', isDefault: false, lid: t.id }))
    ];
    let order = natural;
    if (settings.templateOrderManual) {
      const byKey = new Map(natural.map(e => [e.key, e]));
      const saved = (settings.templateOrder || []).filter(k => byKey.has(k));
      const savedSet = new Set(saved);
      // 拖过之后新出现的：默认模板补在最前，新导入的补在最后
      order = [
        ...natural.filter(e => e.isDefault && !savedSet.has(e.key)),
        ...saved.map(k => byKey.get(k)),
        ...natural.filter(e => !e.isDefault && !savedSet.has(e.key))
      ];
    }
    return order.map(e => ({ ...e, fav: favSet.has(e.key), hidden: hidden.has(e.key) }));
  }
  // 列表/选模板共用的顺序：收藏的排最前，其余按上面的顺序；隐藏的单独列出
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
  function useTemplate(key) {
    if (settings.template === key) return;
    settings.template = key;
    saveSettings(settings);
    renderSettings();
    if (mainDoc.getElementById('be-card')) renderCard(lastText);
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
    if (settings.creatorMode) openCssFloatEditor(tid);
    else openImportTemplateDialog(tid);
  }
  // 行布局：[拖动] 名字(默认) ……… [✎] [收藏] [删除] [⋯]
  // ✎ 只在开发者模式下出现；默认模板没有 ✎ / 删除，在同一位置留空位，保证各行按钮上下对齐。
  // ⋯ 点开后原地换成 [预览][隐藏][导出]（默认模板没有导出）；点行本身 = 使用该模板。
  function renderTemplateRow(e) {
    const active = settings.template === e.key;
    const dev = !!settings.creatorMode;
    const slot = '<span class="be-tl-slot"></span>';
    return `
      <div class="be-tl-row ${active ? 'active' : ''}" data-k="${e.key}">
        <div class="be-tl-track">
          <div class="be-tl-main">
            <span class="be-tl-handle" title="拖动排序">${fa('bars')}</span>
            <span class="be-tl-name"><span class="be-tl-name-txt">${escapeHtml(e.name)}</span>${e.isDefault ? '<span class="be-tl-tag">默认</span>' : ''}${e.lid ? '<span class="be-tl-tag">排版</span>' : ''}</span>
            <span class="be-tl-acts">
              ${e.lid ? `<button type="button" class="be-tl-btn" data-ledit="${e.lid}" title="编辑排版">${fa('pencil')}</button>`
                : dev ? (e.isDefault ? slot : `<button type="button" class="be-tl-btn" data-edit="${e.tid}" title="编辑 CSS">${fa('pencil')}</button>`) : ''}
              <button type="button" class="be-tl-btn be-tl-fav ${e.fav ? 'on' : ''}" data-fav="${e.key}" title="${e.fav ? '取消收藏' : '收藏'}">${fa('star')}</button>
              ${e.isDefault ? slot : e.lid ? `<button type="button" class="be-tl-btn" data-ldel="${e.lid}" title="删除">${fa('trash-can')}</button>` : `<button type="button" class="be-tl-btn" data-del="${e.tid}" title="删除">${fa('trash-can')}</button>`}
              <span class="be-tl-moreslot">
                <button type="button" class="be-tl-btn be-tl-more" data-more="${e.key}" title="更多">${fa('ellipsis')}</button>
                <span class="be-tl-extra">
                  <button type="button" class="be-tl-btn" data-preview="${e.key}" title="预览">${fa('magnifying-glass')}</button>
                  <button type="button" class="be-tl-btn" data-hide="${e.key}" title="隐藏">${fa('eye-slash')}</button>
                  ${e.isDefault ? '' : e.lid ? `<button type="button" class="be-tl-btn" data-lexport="${e.lid}" title="导出">${fa('file-export')}</button>` : `<button type="button" class="be-tl-btn" data-export="${e.tid}" title="导出">${fa('file-export')}</button>`}
                </span>
              </span>
            </span>
          </div>
        </div>
      </div>`;
  }
  function renderTemplateSection() {
    const { favs, rest, hidden } = getTemplateListEntries();
    const open = _tplListOpen;
    return `
      <div class="be-sec" id="be-tpl-sec">
        <div class="be-sec-head">
          <h4>模板</h4>
          <span class="be-sec-head-btns">
            <button type="button" class="be-mini-btn" id="be-tpl-new-layout">自由排版</button>
            <button type="button" class="be-mini-btn" id="be-tpl-import">导入</button>
            <button type="button" class="be-mini-btn" id="be-tpl-import-batch">批量导入</button>
          </span>
        </div>
        <div class="be-tl-current ${open ? 'open' : ''}" id="be-tl-toggle">
          <span>当前：<b>${escapeHtml(templateNameOf(settings.template))}</b></span>
          <span class="be-caret"></span>
        </div>
        <div class="be-tl-body" ${open ? '' : 'hidden'}>
          <div class="be-tl-list" data-group="fav">${favs.map(renderTemplateRow).join('')}</div>
          ${favs.length && rest.length ? '<div class="be-tl-sep">·</div>' : ''}
          <div class="be-tl-list" data-group="rest">${rest.map(renderTemplateRow).join('')}</div>
          ${hidden.length ? `
          <div class="be-tpl-group ${_hiddenTplOpen ? 'open' : ''}" id="be-hidden-tpl-group">
            <div class="be-tpl-group-head" id="be-hidden-tpl-group-head">
              <span class="be-caret"></span>
              <span>已隐藏（${hidden.length}）</span>
            </div>
            <div class="be-tpl-group-body">
              ${hidden.map(e => `
                <div class="be-tl-row be-tl-row-hidden">
                  <div class="be-tl-track">
                    <div class="be-tl-main">
                      <span class="be-tl-name"><span class="be-tl-name-txt">${escapeHtml(e.name)}</span>${e.isDefault ? '<span class="be-tl-tag">默认</span>' : ''}</span>
                      <span class="be-tl-acts">
                        <button type="button" class="be-tl-btn" data-restore-tpl="${e.key}" title="取消隐藏">${fa('eye')}</button>
                      </span>
                    </div>
                  </div>
                </div>`).join('')}
            </div>
          </div>` : ''}
        </div>
        <div class="be-row" style="margin-top:10px;"><label style="flex:1;">书摘弹窗里更换自由排版的图片</label></div>
        <div class="be-row">
          <div class="be-radio-group" id="be-lay-imgmode" style="width:100%;">
            ${[['ask', '每次询问'], ['once', '仅本次导出'], ['save', '保存到模板']].map(([v, n]) => `<button type="button" class="be-radio-opt ${(settings.layoutImgReplace || 'ask') === v ? 'active' : ''}" data-v="${v}">${n}</button>`).join('')}
          </div>
        </div>
      </div>`;
  }
  function commitTemplateOrderFromDom(sec) {
    const shownKeys = Array.from(sec.querySelectorAll('.be-tl-list .be-tl-row')).map(r => r.getAttribute('data-k'));
    const hiddenKeys = getAllTemplateEntries().filter(e => e.hidden).map(e => e.key);
    settings.templateOrder = shownKeys.concat(hiddenKeys);
    settings.templateOrderManual = true;
    saveSettings(settings);
  }
  // 拖动排序：pointer 事件挂在 document 上（拖动中挪行会让手柄暂时离开文档，pointer capture 会丢）。
  // 手柄上阻止 touchstart 默认行为和长按菜单，否则手机上按久一点就变成选中文字。
  function bindTemplateDrag(sec) {
    bindRowDrag(sec, '.be-tl-list', () => commitTemplateOrderFromDom(sec));
  }
  // 通用行拖动排序（模板列表 / 悬浮栏按钮列表共用）：listSelector 下每个 .be-tl-row 的 .be-tl-handle 可拖
  function bindRowDrag(sec, listSelector, onCommit) {
    sec.querySelectorAll(listSelector + ' .be-tl-handle').forEach(h => {
      h.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
      h.addEventListener('contextmenu', e => e.preventDefault());
      h.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        const row = h.closest('.be-tl-row');
        const list = row.parentElement;
        const scroller = sec.closest('#be-p-body') || sec.parentElement;
        const pid = e.pointerId;
        let moved = false;
        row.classList.add('dragging');
        const onMove = ev => {
          if (ev.pointerId !== pid) return;
          ev.preventDefault();
          const y = ev.clientY;
          const box = scroller.getBoundingClientRect();
          if (y < box.top + 40) scroller.scrollTop -= 12;
          else if (y > box.bottom - 40) scroller.scrollTop += 12;
          let before = null;
          for (const r of list.children) {
            if (r === row) continue;
            const rc = r.getBoundingClientRect();
            if (y < rc.top + rc.height / 2) { before = r; break; }
          }
          if (before) { if (row.nextSibling !== before) { list.insertBefore(row, before); moved = true; } }
          else if (list.lastElementChild !== row) { list.appendChild(row); moved = true; }
        };
        const onUp = ev => {
          if (ev.pointerId !== pid) return;
          mainDoc.removeEventListener('pointermove', onMove, true);
          mainDoc.removeEventListener('pointerup', onUp, true);
          mainDoc.removeEventListener('pointercancel', onUp, true);
          row.classList.remove('dragging');
          if (moved) onCommit();
        };
        mainDoc.addEventListener('pointermove', onMove, { capture: true, passive: false });
        mainDoc.addEventListener('pointerup', onUp, true);
        mainDoc.addEventListener('pointercancel', onUp, true);
      });
    });
  }
  // 模板预览：固定测试文字 + 占位名字/书名/章名 + 纯色头像，按该模板渲染一张缩小的卡片
  const PREVIEW_SAMPLE_TEXT = '这是一段测试文字，用于预览模板的排版效果，包括字号、行距、字间距与整体版式，无实际含义。';
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
    const isCurrent = settings.template === key;
    mask.innerHTML = `
      <div class="be-tpv-box">
        <div class="be-tpv-head"><span>${escapeHtml(templateNameOf(key))}</span><button type="button" class="be-tpv-close">×</button></div>
        <div class="be-tpv-stage"><div class="be-tpv-scale" style="width:${cw}px;">${built.html}</div></div>
        <div class="be-tpv-foot">
          <button type="button" class="be-btn primary" id="be-tpv-use" ${isCurrent ? 'disabled' : ''}>${isCurrent ? '当前模板' : '使用此模板'}</button>
        </div>
      </div>`;
    const card = mask.querySelector('.be-card');
    if (card) {
      const qs = Number(settings.quoteFontSize), ql = Number(settings.quoteLineHeight), qls = Number(settings.quoteLetterSpacing);
      if (qs > 0) card.style.setProperty('--be-quote-size', qs + 'px');
      if (ql > 0) card.style.setProperty('--be-quote-lh', ql);
      if (qls >= 0) card.style.setProperty('--be-quote-ls', qls + 'em');
      const q = card.querySelector('.be-quote');
      if (q && !q.closest('.be-lay')) q.style.fontFamily = built.fontCss;
    }
    mask.classList.add('open');
    shieldCardFonts(card);
    const stage = mask.querySelector('.be-tpv-stage');
    const scaler = mask.querySelector('.be-tpv-scale');
    const scale = Math.min(1, (stage.clientWidth || 300) / cw);
    scaler.style.transform = `scale(${scale})`;
    stage.style.height = Math.ceil(scaler.offsetHeight * scale) + 'px';
    mask.querySelector('#be-tpv-use').addEventListener('click', () => {
      closeTplPreview();
      useTemplate(key);
    });
  }
  function collapseTplMore(sec, except) {
    sec.querySelectorAll('.be-tl-row.expanded').forEach(r => { if (r !== except) r.classList.remove('expanded'); });
  }
  function bindTemplateSection(body) {
    const sec = body.querySelector('#be-tpl-sec');
    if (!sec) return;
    sec.querySelector('#be-tpl-new-layout')?.addEventListener('click', () => openLayoutEditor(null));
    sec.querySelectorAll('#be-lay-imgmode .be-radio-opt').forEach(btn => btn.addEventListener('click', () => {
      settings.layoutImgReplace = btn.getAttribute('data-v');
      saveSettings(settings);
      sec.querySelectorAll('#be-lay-imgmode .be-radio-opt').forEach(b => b.classList.toggle('active', b === btn));
    }));
    sec.querySelector('#be-tpl-import')?.addEventListener('click', () => openImportTemplateDialog());
    sec.querySelector('#be-tpl-import-batch')?.addEventListener('click', importTemplatesBatch);
    sec.querySelector('#be-tl-toggle')?.addEventListener('click', () => {
      _tplListOpen = !_tplListOpen;
      renderSettings();
    });
    // 点到 ⋯ 展开区以外的地方就收回
    sec.addEventListener('pointerdown', e => {
      if (!e.target.closest('.be-tl-moreslot')) collapseTplMore(sec);
    });
    sec.querySelectorAll('.be-tl-list .be-tl-row').forEach(row => {
      row.querySelector('.be-tl-main').addEventListener('click', e => {
        if (e.target.closest('button, .be-tl-handle')) return;
        useTemplate(row.getAttribute('data-k'));
      });
    });
    const on = (sel, fn) => sec.querySelectorAll(sel).forEach(b => b.addEventListener('click', e => { e.stopPropagation(); fn(b); }));
    on('[data-preview]', b => { collapseTplMore(sec); openTplPreview(b.getAttribute('data-preview')); });
    on('[data-fav]', b => toggleTemplateFavorite(b.getAttribute('data-fav')));
    on('[data-more]', b => {
      const row = b.closest('.be-tl-row');
      collapseTplMore(sec, row);
      row.classList.add('expanded');
    });
    on('[data-hide]', b => hideTemplate(b.getAttribute('data-hide')));
    on('[data-export]', b => { exportCustomTemplate(b.getAttribute('data-export')); collapseTplMore(sec); });
    on('[data-edit]', b => editCustomTemplate(b.getAttribute('data-edit')));
    on('[data-ledit]', b => openLayoutEditor(b.getAttribute('data-ledit')));
    on('[data-lexport]', b => { exportLayoutTemplate(layGetTemplate('layout-' + b.getAttribute('data-lexport'))); collapseTplMore(sec); });
    on('[data-ldel]', async b => {
      const t = layGetTemplate('layout-' + b.getAttribute('data-ldel'));
      if (!t) return;
      const r = await beConfirm({ text: `删除排版「${t.name}」？`, okText: '删除' });
      if (!r.ok) return;
      deleteLayoutTemplate(t.id);
      renderSettings();
    });
    on('[data-del]', b => {
      const tid = b.getAttribute('data-del');
      const name = (settings.customTemplates || []).find(t => t.id === tid)?.name || '';
      if (mainWin.confirm(`删除模板「${name}」？`)) deleteCustomTemplate(tid);
    });
    sec.querySelector('#be-hidden-tpl-group-head')?.addEventListener('click', () => {
      _hiddenTplOpen = !_hiddenTplOpen;
      sec.querySelector('#be-hidden-tpl-group')?.classList.toggle('open', _hiddenTplOpen);
    });
    on('[data-restore-tpl]', b => restoreTemplate(b.getAttribute('data-restore-tpl')));
    bindTemplateDrag(sec);
  }
  // 批量导入模板：一次选多个文件。每个文件可以是
  //   单个模板 {name, css} / 模板数组 [{name, css}, ...] / 插件导出的整包 {templates: [...]} / 纯 .css（文件名当模板名）
  function parseTemplateFile(fileName, text) {
    const baseName = String(fileName || '').replace(/\.(css|json|txt)$/i, '') || '未命名';
    let j = null;
    try { j = JSON.parse(text); } catch (e) {}
    if (j === null) {
      const css = String(text || '').trim();
      return css ? [{ name: baseName, css }] : [];
    }
    const list = Array.isArray(j) ? j
      : (j && Array.isArray(j.templates)) ? j.templates
      : (j && Array.isArray(j.customTemplates)) ? j.customTemplates
      : [j];
    return list
      .filter(p => p && typeof p === 'object' && typeof p.css === 'string' && p.css.trim())
      .map((p, i) => ({ name: p.name || (list.length > 1 ? `${baseName} ${i + 1}` : baseName), css: p.css }));
  }
  function importTemplatesBatch() {
    const input = mainDoc.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.json,.css,.txt,application/json,text/css,text/plain';
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      const added = [];
      let failed = 0, layoutAdded = 0;
      for (const f of files) {
        try {
          const text = await f.text();
          let lj = null;
          try { lj = JSON.parse(text); } catch (e) {}
          if (isLayoutPayload(lj)) { await importLayoutPayload(lj); layoutAdded++; continue; }
          const got = parseTemplateFile(f.name, text);
          if (!got.length) failed++;
          got.forEach(p => added.push(portableToTemplate(p)));
        } catch (e) { failed++; }
      }
      if (added.length || layoutAdded) {
        settings.customTemplates = (settings.customTemplates || []).concat(added);
        saveSettings(settings);
        injectCustomTemplateStyles();
        _tplListOpen = true;
        renderSettings();
      }
      const n = added.length + layoutAdded;
      toast(`导入 ${n} 个模板${layoutAdded ? `（其中排版 ${layoutAdded} 个）` : ''}${failed ? `，${failed} 个文件无法识别` : ''}`, n ? 'success' : 'error');
    });
    input.click();
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
          修改实时应用于使用此模板的卡片预览，保存后生效。
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
          const order = ['card', 'highlight', 'general'];
          const dir = order.indexOf(g) < order.indexOf(settingsGroup) ? -1 : 1;
          settingsGroup = g;
          panelBody.querySelectorAll('.be-settings-subtabs button').forEach(b => b.classList.toggle('active', b === el));
          // 跟"笔记本/设置"顶部主 Tab 切换用同一套手法：内容瞬间换掉（没有旧内容残留/重叠这回事），
          // 只在新内容上补一个入场淡入，跟主 Tab 切换的手感保持一致——那个切换用户没意见，直接照搬。
          panelBody.scrollTop = 0;
          renderSettingsGroupContent(mainDoc.getElementById('be-settings-content'));
          playPanelSwitchAnim(mainDoc.getElementById('be-settings-content'), dir);
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
        ${_colorOrganize ? hint('点 × 隐藏默认配色或删除自定义配色。') : ''}
        ${renderHiddenColorGroup()}
        <div class="be-tpl-group ${(_customColorOpen || isCustomColor) ? 'open' : ''}" id="be-custom-color-group">
          <div class="be-tpl-group-head" id="be-custom-color-head"><span class="be-caret"></span><span>自定义配色</span></div>
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
            ${hint('关闭时按背景明度自动选择深色或浅色文字。')}
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
        ${hint('倍率越高图片越清晰，生成越慢、文件越大。')}
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
          <label style="flex:1;">出处保存方式</label>
        </div>
        <div class="be-row">
          <div class="be-radio-group" id="be-source-scope-group" style="width:100%;">
            <button type="button" class="be-radio-opt ${(settings.sourceScope||'global')==='global'?'active':''}" data-v="global">共用一份</button>
            <button type="button" class="be-radio-opt ${settings.sourceScope==='character'?'active':''}" data-v="character">每个角色</button>
            <button type="button" class="be-radio-opt ${settings.sourceScope==='chat'?'active':''}" data-v="chat">每个聊天</button>
          </div>
        </div>
        ${hint('用户名、作者、书名、章名是否按角色或聊天分开保存。切换后需重新填写。')}

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
            <label style="flex:1;">打码出处中的名字</label>
            ${toggleHtml('be-mask-source', !!settings.maskSource)}
          </div>
          <div class="be-row be-row-stack">
            <label>额外打码词</label>
            ${textInput('be-mask-extra', settings.maskExtra, '逗号分隔，如昵称、地名')}
            <div class="be-mask-chip-box" id="be-mask-chips"></div>
            ${hint('点击词可单独设置打码样式。在书摘预览中选中文字后点「打码」也可添加。')}
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
        ${hint('仅停用选中文字后的浮动栏，已有划线与笔记不受影响。')}
        <div class="be-row">
          <label style="flex:1;">两点选线</label>
          ${toggleHtml('be-pick-enabled', settings.pickEnabled !== false)}
        </div>
        ${hint('浮动栏增加“设为开头/设为结尾”，用于选取长句。')}
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
        ${hint('划线相关浮动栏采用酒馆下拉框样式。不影响设置面板与笔记本。')}
      </div>

      <div class="be-sec">
        <h4>划线合并</h4>
        <div class="be-row">
          <label style="flex:1;">把不连续的几句话拼成一条书摘</label>
          ${toggleHtml('be-merge-enabled', !!settings.mergeEnabled)}
        </div>
        ${hint('可将多条划线合并为一条书摘。')}
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
        ${hint('插件界面的强调色，不影响卡片配色。')}
        <div class="be-row" style="margin-top:8px;">
          <label style="flex:1;">打开书摘笔记时先显示</label>
        </div>
        <div class="be-row">
          <div class="be-radio-group" id="be-panel-home-group" style="width:100%;">
            <button type="button" class="be-radio-opt ${(settings.panelHome || 'notes') === 'notes' ? 'active' : ''}" data-v="notes">笔记本主页</button>
            <button type="button" class="be-radio-opt ${settings.panelHome === 'char' ? 'active' : ''}" data-v="char">当前角色</button>
            <button type="button" class="be-radio-opt ${settings.panelHome === 'settings' ? 'active' : ''}" data-v="settings">设置</button>
          </div>
        </div>
        ${hint('选择「当前角色」时，若未打开聊天或该角色无笔记，显示笔记本主页。')}
        <div class="be-row" style="margin-top:8px;">
          <label style="flex:1;">切换页面的动画</label>
        </div>
        <div class="be-row">
          <div class="be-radio-group" id="be-panel-anim-group" style="width:100%;">
            <button type="button" class="be-radio-opt ${settings.panelAnim !== 'slide' ? 'active' : ''}" data-v="fade">淡入淡出</button>
            <button type="button" class="be-radio-opt ${settings.panelAnim === 'slide' ? 'active' : ''}" data-v="slide">滑动</button>
          </div>
        </div>
        ${hint('切换「笔记本 / 设置」和设置里「书摘卡片 / 划线 / 通用」时的效果。')}
        <div class="be-row" style="margin-top:8px;">
          <label style="flex:1;">跳回原文要切换聊天时先确认</label>
          ${toggleHtml('be-jump-confirm', !settings.jumpNoConfirm)}
        </div>
      </div>

      <div class="be-sec">
        <h4>保存图片</h4>
        <div class="be-row">
          <div class="be-radio-group" id="be-savemode-group">
            <button type="button" class="be-radio-opt ${(settings.saveMode||'download')==='download'?'active':''}" data-v="download">下载文件</button>
            <button type="button" class="be-radio-opt ${settings.saveMode==='popup'?'active':''}" data-v="popup">弹图长按</button>
          </div>
        </div>
        ${hint('下载无响应时可改用弹图长按。')}
      </div>

      <div class="be-sec">
        <h4>数据</h4>
        <div class="be-subh">笔记</div>
        <div class="be-row" style="gap:6px;">
          <button class="be-btn" id="be-export-all">导出全部</button>
          <button class="be-btn" id="be-import-all">导入</button>
          <button class="be-btn danger" id="be-clear-all">清空</button>
        </div>
        <div class="be-row" style="gap:6px;">
          <button class="be-btn" id="be-export-md">导出为 Markdown / txt</button>
        </div>
        ${hint('「导出全部」为 JSON 备份，可重新导入。Markdown / txt 用于阅读，不可导入。')}
        <div class="be-subh">酒馆数据目录</div>
        <div class="be-row">
          <label style="flex:1;">同步备份到酒馆数据目录</label>
          ${toggleHtml('be-dir-sync', settings.dataDirSync !== false)}
        </div>
        ${settings.dataDirSync !== false ? `
        <div class="be-row" style="gap:6px;">
          <button class="be-btn" id="be-dir-backup">立即备份</button>
          <button class="be-btn" id="be-dir-restore">从备份恢复</button>
        </div>
        <div class="be-row be-hint"><span id="be-dir-status">${(() => { const m = mirrorMeta(); return m.lastErr ? '上次同步失败：' + escapeHtml(m.lastErr) : (m.lastOk ? '上次同步：' + formatDateTime(m.lastOk) : '还没有同步过'); })()}</span></div>` : ''}
        ${hint('数据仍保存在浏览器中，同时备份到酒馆 data/用户名/user/files/（笔记、设置、上传的图片），用于清除缓存或更换浏览器后恢复。')}
        <div class="be-subh">模板 · 字体 · 配色</div>
        <div class="be-row" style="gap:6px;">
          <button class="be-btn" id="be-export-bundle">打包导出</button>
          <button class="be-btn" id="be-import-bundle">批量导入</button>
        </div>
        ${hint('包含导入的模板、字体和保存的配色，不含笔记。')}
      </div>

      <div class="be-sec">
        <h4>高级</h4>
        <div class="be-row">
          <label style="flex:1;">开发者模式</label>
          ${toggleHtml('be-creator-mode', !!settings.creatorMode)}
        </div>
        ${hint('模板列表显示编辑按钮，CSS 在悬浮窗中实时预览。')}
        <div class="be-row" style="margin-top:6px;">
          <label style="flex:1;">自定义悬浮栏按钮</label>
          ${toggleHtml('be-fb-custom', !!settings.floatBarCustom)}
        </div>
        ${settings.floatBarCustom ? `
        <div class="be-tl-list be-fb-list" id="be-fb-list">
          ${getFloatBarLayout().map(x => {
            const b = FLOAT_BAR_BTNS.find(y => y.id === x.id);
            return `<div class="be-tl-row ${x.hidden ? 'be-fb-off' : ''}" data-k="${x.id}"><div class="be-tl-track"><div class="be-tl-main">
              <span class="be-tl-handle" title="拖动排序"><i class="fa-solid fa-bars"></i></span>
              <span class="be-tl-name"><span class="be-tl-name-txt">${escapeHtml(b.name)}</span>${x.id === 'pick' && !settings.pickEnabled ? '<span class="be-tl-tag">两点选线已关</span>' : ''}</span>
              <span class="be-tl-acts"><button type="button" class="be-tl-btn" data-fb-toggle="${x.id}" title="${x.hidden ? '显示' : '隐藏'}"><i class="fa-solid ${x.hidden ? 'fa-eye-slash' : 'fa-eye'}"></i></button></span>
            </div></div></div>`;
          }).join('')}
        </div>
        <div class="be-row" style="justify-content:flex-end;"><button type="button" class="be-mini-btn" id="be-fb-reset">恢复默认</button></div>
        ` : ''}
        ${hint('选中文字后显示的悬浮栏。拖动调整顺序，点眼睛图标隐藏。')}
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
    body.querySelectorAll('#be-panel-home-group .be-radio-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        settings.panelHome = btn.getAttribute('data-v');
        saveSettings(settings);
        body.querySelectorAll('#be-panel-home-group .be-radio-opt').forEach(b => b.classList.toggle('active', b === btn));
      });
    });
    body.querySelectorAll('#be-panel-anim-group .be-radio-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        settings.panelAnim = btn.getAttribute('data-v') === 'slide' ? 'slide' : 'fade';
        saveSettings(settings);
        body.querySelectorAll('#be-panel-anim-group .be-radio-opt').forEach(b => b.classList.toggle('active', b === btn));
      });
    });
    body.querySelector('#be-jump-confirm')?.addEventListener('change', e => {
      settings.jumpNoConfirm = !e.target.checked;
      saveSettings(settings);
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
    body.querySelector('#be-fb-custom')?.addEventListener('change', e => {
      settings.floatBarCustom = e.target.checked;
      saveSettings(settings);
      renderSettings();
    });
    const fbList = body.querySelector('#be-fb-list');
    if (fbList) {
      const commitFb = () => {
        const hiddenSet = new Set(getFloatBarLayout().filter(x => x.hidden).map(x => x.id));
        settings.floatBarLayout = Array.from(fbList.querySelectorAll('.be-tl-row')).map(r => ({ id: r.getAttribute('data-k'), hidden: hiddenSet.has(r.getAttribute('data-k')) }));
        saveSettings(settings);
      };
      bindRowDrag(fbList.parentElement, '#be-fb-list', commitFb);
      fbList.querySelectorAll('[data-fb-toggle]').forEach(b => b.addEventListener('click', () => {
        const id = b.getAttribute('data-fb-toggle');
        settings.floatBarLayout = getFloatBarLayout().map(x => x.id === id ? { id, hidden: !x.hidden } : x);
        saveSettings(settings);
        renderSettings();
      }));
      body.querySelector('#be-fb-reset')?.addEventListener('click', () => {
        settings.floatBarLayout = [];
        saveSettings(settings);
        renderSettings();
      });
    }
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
      body.querySelector('#be-mask-chips')?._beRender?.();
      refreshCard();
    });
    bindMaskChips(body.querySelector('#be-mask-chips'), (what) => {
      if (what === 'extra') { const inp = body.querySelector('#be-mask-extra'); if (inp) inp.value = settings.maskExtra || ''; }
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
    body.querySelector('#be-pick-enabled')?.addEventListener('change', e => {
      settings.pickEnabled = e.target.checked;
      saveSettings(settings);
      resetPickPending();
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
    body.querySelector('#be-export-md')?.addEventListener('click', () => openNotesExportSheet(''));
    body.querySelector('#be-dir-sync')?.addEventListener('change', e => {
      settings.dataDirSync = e.target.checked;
      saveSettings(settings);
      if (settings.dataDirSync) mirrorBackupNow().then(() => renderSettings()).catch(e2 => { mirrorFailed(e2); renderSettings(); });
      else renderSettings();
    });
    body.querySelector('#be-dir-backup')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try { await mirrorBackupNow(); toast('已备份到酒馆数据目录', 'success'); } catch (err) { _mirrorWarned = false; mirrorFailed(err); }
      renderSettings();
    });
    body.querySelector('#be-dir-restore')?.addEventListener('click', async () => {
      let remote;
      try { remote = await mirrorFetchAll(); } catch (err) { toast('读取备份失败：' + (err?.message || err), 'error'); return; }
      if (!remote.notes && !remote.settings) { toast('酒馆数据目录里还没有备份', 'info'); return; }
      if (!(await beConfirm({ text: `用备份（${describeBackup(remote)}）覆盖当前浏览器的笔记和设置？`, okText: '覆盖' })).ok) return;
      await mirrorRestore(remote);
      toast('已从酒馆数据目录恢复', 'success');
      renderSettings();
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
      <div style="font-size:12px;opacity:0.6;margin-bottom:10px;text-align:center;letter-spacing:0.1em;">
        ${totalNotes} 条笔记 · 留在了 ${keys.length} 个角色身上
      </div>
      <div class="be-search">
        <input type="text" id="be-search" placeholder="搜索文字或想法..." value="${escapeHtml(searchKey)}">
      </div>
      <div class="be-nb-tools">
        <button class="be-filter-btn" id="be-nb-review"><i class="fa-solid fa-shuffle"></i> 随机回顾</button>
        <button class="be-filter-btn" id="be-nb-heat"><i class="fa-solid fa-calendar-days"></i> 热力图</button>
        <button class="be-filter-btn" id="be-nb-export"><i class="fa-solid fa-file-export"></i> 导出</button>
      </div>
      <div id="be-notes-list"></div>
    `;
    fillNotesList();
    body.querySelector('#be-nb-review').addEventListener('click', () => { panelView = 'review'; reviewState.charKey = ''; reviewState.current = null; renderPanel(); });
    body.querySelector('#be-nb-heat').addEventListener('click', () => { panelView = 'heatmap'; renderPanel(); });
    body.querySelector('#be-nb-export').addEventListener('click', () => openNotesExportSheet(''));
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
          <button class="be-filter-btn" id="be-char-export" title="导出这个角色的笔记"><i class="fa-solid fa-file-export"></i></button>
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
    panel.querySelector('#be-char-export').addEventListener('click', () => openNotesExportSheet(currentCharKey));
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
                  <span class="be-note-time">${formatDateTime(it.ts)}${noteLocationText(it, false) ? ' · ' + escapeHtml(noteLocationText(it, false)) : ''}</span>
                  ${!charMergeMode && canJumpToNote(it) ? `<button class="be-note-share be-note-jump" data-jump="${it.id}" title="跳回原文"><i class="fa-solid fa-location-crosshairs"></i></button>` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      `;
    }).join('');
    list.querySelectorAll('.be-note-jump').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        const it = allItems.find(x => x.id === b.getAttribute('data-jump'));
        if (it) jumpToNote(it, currentCharKey);
      });
    });
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

  // ---------- 笔记导出 Markdown / txt ----------
  // 范围：某个角色 / 当前聊天 / 全部；内容：原句、想法、出处（角色·聊天·楼层）、时间
  function collectNotesForExport(scope, charKey) {
    const notes = loadNotes();
    const ctx = getContext();
    const out = [];
    Object.keys(notes).forEach(k => {
      if (scope === 'char' && k !== charKey) return;
      if (scope === 'chat' && k !== (ctx.charKey || 'unknown')) return;
      const items = notes[k].items.filter(it => it.type !== 'excerpt')
        .filter(it => scope !== 'chat' || (it.chatId || '') === (ctx.chatId || ''))
        .sort((a, b) => (a.ts || 0) - (b.ts || 0));
      if (items.length) out.push({ key: k, name: notes[k].name || k, items });
    });
    return out;
  }
  function buildNotesExport(groups, fmt) {
    const md = fmt === 'md';
    const lines = [];
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    lines.push(md ? '# 书摘笔记' : '书摘笔记');
    lines.push(`导出时间：${formatDateTime(Date.now())} · 共 ${total} 条`, '');
    groups.forEach(g => {
      lines.push(md ? `## ${g.name}` : `==== ${g.name} ====`, '');
      const byChat = {};
      const chatOrder = [];
      g.items.forEach(it => { const c = it.chatId || '未记录聊天'; if (!byChat[c]) { byChat[c] = []; chatOrder.push(c); } byChat[c].push(it); });
      chatOrder.forEach(c => {
        lines.push(md ? `### ${c}` : `—— ${c} ——`, '');
        byChat[c].forEach(it => {
          const text = String(it.text || '').trim();
          if (md) text.split('\n').forEach(l => lines.push('> ' + l));
          else lines.push('「' + text + '」');
          const ths = (it.thoughts || []).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
          if (ths.length) {
            lines.push('');
            lines.push(md ? '**想法**' : '想法：');
            ths.forEach(t => lines.push(`${md ? '- ' : '  · '}${String(t.text || '').replace(/\n/g, md ? '  \n  ' : '\n    ')}（${formatDateTime(t.ts)}）`));
          }
          const src = [g.name, noteLocationText(it)].filter(Boolean).join(' · ');
          const book = [it.bookName ? `《${it.bookName}》` : '', it.chapterName || ''].filter(Boolean).join(' ');
          lines.push('');
          lines.push(`${md ? '出处：' : '出处：'}${src}${book ? ' · ' + book : ''}${md ? '  ' : ''}`);
          lines.push(`时间：${formatDateTime(it.ts)}`);
          lines.push('', md ? '---' : '------------------------------', '');
        });
      });
    });
    return lines.join('\n');
  }
  function openNotesExportSheet(presetCharKey) {
    let mask = mainDoc.getElementById('be-export-mask');
    if (!mask) {
      mask = mainDoc.createElement('div');
      mask.id = 'be-export-mask';
      mask.className = 'be-filter-mask';
      mainDoc.body.appendChild(mask);
      mask.addEventListener('click', e => { if (e.target === mask) mask.classList.remove('open'); });
    } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    const ctx = getContext();
    const notes = loadNotes();
    const charKey = presetCharKey || (notes[ctx.charKey] ? ctx.charKey : '');
    const charName = charKey ? ((notes[charKey] && notes[charKey].name) || charKey) : '';
    let scope = presetCharKey ? 'char' : (charKey ? 'chat' : 'all');
    let fmt = 'md';
    const render = () => {
      const count = collectNotesForExport(scope, charKey).reduce((n, g) => n + g.items.length, 0);
      mask.innerHTML = `
        <div class="be-filter-sheet">
          <div class="be-filter-handle"></div>
          <div class="be-filter-h">导出笔记</div>
          <div class="be-filter-label">范围</div>
          <div class="be-filter-kinds be-export-scope">
            ${charKey ? `<button class="be-filter-kind ${scope === 'char' ? 'active' : ''}" data-scope="char">${presetCharKey ? '' : '当前角色 · '}${escapeHtml(charName)}</button>` : ''}
            ${(notes[ctx.charKey] && (!presetCharKey || presetCharKey === ctx.charKey)) ? `<button class="be-filter-kind ${scope === 'chat' ? 'active' : ''}" data-scope="chat">当前聊天</button>` : ''}
            <button class="be-filter-kind ${scope === 'all' ? 'active' : ''}" data-scope="all">全部</button>
          </div>
          <div class="be-filter-label" style="margin-top:14px;">格式</div>
          <div class="be-filter-kinds">
            <button class="be-filter-kind ${fmt === 'md' ? 'active' : ''}" data-fmt="md">Markdown</button>
            <button class="be-filter-kind ${fmt === 'txt' ? 'active' : ''}" data-fmt="txt">纯文本 txt</button>
          </div>
          <div class="be-export-count">${count} 条笔记</div>
          <div class="be-filter-actions">
            <button class="be-filter-reset" id="be-export-cancel">取 消</button>
            <button class="be-filter-confirm" id="be-export-go" ${count ? '' : 'disabled'}>导 出</button>
          </div>
        </div>`;
      mask.querySelectorAll('[data-scope]').forEach(b => b.addEventListener('click', () => { scope = b.getAttribute('data-scope'); render(); }));
      mask.querySelectorAll('[data-fmt]').forEach(b => b.addEventListener('click', () => { fmt = b.getAttribute('data-fmt'); render(); }));
      mask.querySelector('#be-export-cancel').addEventListener('click', () => mask.classList.remove('open'));
      mask.querySelector('#be-export-go').addEventListener('click', () => {
        const groups = collectNotesForExport(scope, charKey);
        if (!groups.length) { toast('没有可导出的笔记', 'info'); return; }
        const text = buildNotesExport(groups, fmt);
        const label = scope === 'all' ? '全部' : (scope === 'chat' ? (ctx.chatId || '当前聊天') : charName);
        const fname = `书摘笔记_${String(label).replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40)}_${formatDate().replace(/\//g, '')}.${fmt}`;
        const blob = new Blob(['\ufeff' + text], { type: fmt === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' });
        if (triggerDownload(blob, fname)) toast('已导出', 'success');
        mask.classList.remove('open');
      });
    };
    render();
    mask.classList.add('open');
  }

  // ---------- 随机回顾（参考 flomo 每日回顾：随机翻出较早的旧笔记） ----------
  const reviewState = { charKey: '', current: null };
  function pickReviewNote(charKey, excludeId) {
    const notes = loadNotes();
    const now = Date.now(), DAY = 86400000;
    const pool = [];
    Object.keys(notes).forEach(k => {
      if (charKey && k !== charKey) return;
      notes[k].items.forEach(it => {
        if (it.type === 'excerpt' || it.id === excludeId) return;
        // 7 天前的更容易抽到；3 天内回顾过的尽量不重复；从没回顾过的稍微优先
        let w = (now - (it.ts || now)) > 7 * DAY ? 3 : 1;
        if (it.lastReviewed && now - it.lastReviewed < 3 * DAY) w *= 0.15;
        else if (!it.lastReviewed) w *= 1.5;
        pool.push({ k, it, w });
      });
    });
    if (!pool.length) return null;
    let r = Math.random() * pool.reduce((s, x) => s + x.w, 0);
    for (const x of pool) { r -= x.w; if (r <= 0) return { charKey: x.k, note: x.it }; }
    const last = pool[pool.length - 1];
    return { charKey: last.k, note: last.it };
  }
  function markReviewed(charKey, id) {
    updateNote(charKey, id, { lastReviewed: Date.now() });
  }
  function renderReviewView(panel) {
    const notes = loadNotes();
    const charKeys = Object.keys(notes).filter(k => notes[k].items.some(it => it.type !== 'excerpt'));
    if (!reviewState.current || !findNoteById(reviewState.current.note.id)) {
      reviewState.current = pickReviewNote(reviewState.charKey);
      if (reviewState.current) markReviewed(reviewState.current.charKey, reviewState.current.note.id);
    }
    const cur = reviewState.current;
    const note = cur ? (findNoteById(cur.note.id) || cur.note) : null;
    const ch = cur ? notes[cur.charKey] : null;
    const ths = note ? (note.thoughts || []).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0)) : [];
    const days = note ? Math.floor((Date.now() - (note.ts || Date.now())) / 86400000) : 0;
    panel.innerHTML = `
      <div class="be-p-head">
        <button class="be-p-back" id="be-back">‹</button>
        <span class="be-p-title">随机回顾</span>
        <button class="be-btn" id="be-p-close">×</button>
      </div>
      <div class="be-p-body">
        <div class="be-rv-filter">
          <select id="be-rv-char">
            <option value="">全部角色</option>
            ${charKeys.map(k => `<option value="${escapeHtml(k)}" ${reviewState.charKey === k ? 'selected' : ''}>${escapeHtml(notes[k].name || k)}</option>`).join('')}
          </select>
        </div>
        ${note ? `
        <div class="be-rv-card">
          <div class="be-rv-when">${days > 0 ? `${days} 天前` : '今天'} · ${formatDateTime(note.ts)}</div>
          <div class="be-rv-quote">${escapeHtml(note.text || '')}</div>
          ${ths.length ? `<div class="be-rv-thoughts">${ths.map(t => `<div class="be-rv-thought">${escapeHtml(t.text || '')}<span>${formatDateTime(t.ts)}</span></div>`).join('')}</div>` : ''}
          <div class="be-rv-src">
            ${ch && ch.avatar ? `<span class="be-rv-ava" style="background-image:url('${escapeHtml(ch.avatar)}')"></span>` : ''}
            <span>${escapeHtml((ch && ch.name) || '')}${noteLocationText(note) ? ' · ' + escapeHtml(noteLocationText(note)) : ''}</span>
          </div>
        </div>
        <div class="be-rv-actions">
          <button class="be-btn primary" id="be-rv-next"><i class="fa-solid fa-shuffle"></i> 换一条</button>
          ${canJumpToNote(note) ? '<button class="be-btn" id="be-rv-jump">跳回原文</button>' : ''}
          <button class="be-btn" id="be-rv-thought">写想法</button>
          <button class="be-btn" id="be-rv-card">做成书摘</button>
        </div>` : `<div class="be-empty">还没有笔记</div>`}
        <div class="be-row be-rv-daily">
          <label style="flex:1;">每天首次打开酒馆时显示一条</label>
          <label class="be-toggle"><input type="checkbox" id="be-rv-daily" ${settings.dailyReview ? 'checked' : ''}><span class="be-slider"></span></label>
        </div>
      </div>`;
    panel.querySelector('#be-back').addEventListener('click', () => { panelView = 'notes'; renderPanel(); });
    panel.querySelector('#be-p-close').addEventListener('click', closePanel);
    panel.querySelector('#be-rv-char').addEventListener('change', e => { reviewState.charKey = e.target.value; reviewState.current = null; renderPanel(); });
    panel.querySelector('#be-rv-next')?.addEventListener('click', () => {
      const nx = pickReviewNote(reviewState.charKey, note && note.id);
      if (nx) { reviewState.current = nx; markReviewed(nx.charKey, nx.note.id); }
      else toast('只有这一条', 'info');
      renderPanel();
    });
    panel.querySelector('#be-rv-jump')?.addEventListener('click', () => jumpToNote(note, cur.charKey));
    panel.querySelector('#be-rv-thought')?.addEventListener('click', () => openThoughtEditor(note.id, note.text, null));
    panel.querySelector('#be-rv-card')?.addEventListener('click', () => {
      closePanel();
      lastText = note.text;
      openExcerptModal(note.text, ths.length ? { thoughtText: ths[ths.length - 1].text || '' } : {});
    });
    panel.querySelector('#be-rv-daily')?.addEventListener('change', e => { settings.dailyReview = e.target.checked; saveSettings(settings); });
  }
  // 每日推送：一天一次，至少有 3 条笔记才推；右下角一张小卡片，点开进随机回顾
  function maybeDailyReview() {
    if (!settings.dailyReview) return;
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (settings.lastDailyReview === today) return;
    const notes = loadNotes();
    const total = Object.keys(notes).reduce((n, k) => n + notes[k].items.filter(it => it.type !== 'excerpt').length, 0);
    if (total < 3) return;
    const picked = pickReviewNote('');
    if (!picked) return;
    settings.lastDailyReview = today;
    saveSettings(settings);
    mainDoc.getElementById('be-daily-review')?.remove();
    const el = stampGen(mainDoc.createElement('div'));
    el.id = 'be-daily-review';
    const txt = String(picked.note.text || '');
    el.innerHTML = `
      <div class="be-dr-card">
        <div class="be-dr-head"><i class="fa-solid fa-shuffle"></i> 今日回顾</div>
        <div class="be-dr-quote">${escapeHtml(txt.slice(0, 200))}${txt.length > 200 ? '…' : ''}</div>
        <div class="be-dr-src">${escapeHtml((notes[picked.charKey] && notes[picked.charKey].name) || '')} · ${formatDateTime(picked.note.ts)}</div>
        <div class="be-dr-actions">
          <button class="be-btn be-dr-x">关闭</button>
          <button class="be-btn primary be-dr-go">去回顾</button>
        </div>
      </div>`;
    mainDoc.body.appendChild(el);
    detectAndApplyTheme();
    const close = () => { el.classList.remove('show'); setTimeout(() => { try { el.remove(); } catch (e) {} }, 220); };
    el.addEventListener('click', e => { if (e.target === el) close(); });
    el.querySelector('.be-dr-x').addEventListener('click', close);
    el.querySelector('.be-dr-go').addEventListener('click', () => {
      el.remove();
      reviewState.charKey = '';
      reviewState.current = picked;
      markReviewed(picked.charKey, picked.note.id);
      openPanel('review');
    });
    setTimeout(() => { try { el.classList.add('show'); } catch (e) {} }, 30);
  }

  // ---------- 热力图（GitHub 式日历格子：每天写了多少条） ----------
  const heatState = { charKey: '', range: 182, day: '' };
  function dayKey(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function renderHeatmapView(panel) {
    const notes = loadNotes();
    const charKeys = Object.keys(notes).filter(k => notes[k].items.some(it => it.type !== 'excerpt'));
    // 每天的条数：划线/想法都算（一条想法也是一次记录）
    const counts = {};
    const byDay = {};
    charKeys.forEach(k => {
      if (heatState.charKey && k !== heatState.charKey) return;
      notes[k].items.forEach(it => {
        if (it.type === 'excerpt') return;
        const stamps = [it.ts, ...(it.thoughts || []).map(t => t.ts)].filter(Boolean);
        stamps.forEach(ts => { const dk = dayKey(ts); counts[dk] = (counts[dk] || 0) + 1; });
        const dk = dayKey(it.ts || 0);
        (byDay[dk] = byDay[dk] || []).push({ k, it });
        (it.thoughts || []).forEach(t => { const tk = dayKey(t.ts || 0); if (tk !== dk) (byDay[tk] = byDay[tk] || []).push({ k, it }); });
      });
    });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - heatState.range + 1);
    start.setDate(start.getDate() - start.getDay()); // 从周日开始一列
    // 深浅：自适应 = 相对记得最多的那一天分 4 档；固定 = 0 到 heatMax 条平均分 4 档，超过的算最深
    const fixed = settings.heatScale === 'fixed';
    const heatMax = Math.max(4, Math.round(Number(settings.heatMax) || 50));
    const max = fixed ? heatMax : Math.max(1, ...Object.values(counts));
    const level = n => !n ? 0 : (n >= max * 0.75 ? 4 : n >= max * 0.5 ? 3 : n >= max * 0.25 ? 2 : 1);
    const cols = [];
    const months = [];
    let lastMonth = -1;
    for (let d = new Date(start), col = 0; d <= today; col++) {
      const cells = [];
      for (let r = 0; r < 7; r++) {
        if (d > today) { cells.push('<span class="be-hm-cell be-hm-void"></span>'); continue; }
        const dk = dayKey(d.getTime());
        const n = counts[dk] || 0;
        if (r === 0 && d.getMonth() !== lastMonth) { months.push({ col, m: d.getMonth() + 1 }); lastMonth = d.getMonth(); }
        cells.push(`<span class="be-hm-cell l${level(n)}${heatState.day === dk ? ' sel' : ''}" data-d="${dk}" title="${dk} · ${n} 条"></span>`);
        d.setDate(d.getDate() + 1);
      }
      cols.push(`<div class="be-hm-col">${cells.join('')}</div>`);
    }
    // 统计：记录天数、最长连续、最多的一天
    const activeDays = Object.keys(counts).filter(k => new Date(k) >= start).sort();
    let best = 0, run = 0, prev = null;
    activeDays.forEach(k => { const t = new Date(k).getTime(); run = (prev && t - prev === 86400000) ? run + 1 : 1; best = Math.max(best, run); prev = t; });
    const topDay = activeDays.reduce((a, k) => (counts[k] > (counts[a] || 0) ? k : a), '');
    const dayItems = heatState.day ? (byDay[heatState.day] || []) : [];
    panel.innerHTML = `
      <div class="be-p-head">
        <button class="be-p-back" id="be-back">‹</button>
        <span class="be-p-title">热力图</span>
        <button class="be-btn" id="be-p-close">×</button>
      </div>
      <div class="be-p-body">
        <div class="be-hm-bar">
          <select id="be-hm-char">
            <option value="">全部角色</option>
            ${charKeys.map(k => `<option value="${escapeHtml(k)}" ${heatState.charKey === k ? 'selected' : ''}>${escapeHtml(notes[k].name || k)}</option>`).join('')}
          </select>
          <div class="be-radio-group" id="be-hm-range">
            <button type="button" class="be-radio-opt ${heatState.range === 182 ? 'active' : ''}" data-r="182">半年</button>
            <button type="button" class="be-radio-opt ${heatState.range === 365 ? 'active' : ''}" data-r="365">一年</button>
          </div>
        </div>
        <div class="be-hm-stats">记录 ${activeDays.length} 天 · 最长连续 ${best} 天${topDay ? ` · 最多一天 ${counts[topDay]} 条` : ''}</div>
        <div class="be-hm-scroll">
          <div class="be-hm-months">${months.map(m => `<span style="left:${m.col * 14}px">${m.m}月</span>`).join('')}</div>
          <div class="be-hm-grid">${cols.join('')}</div>
        </div>
        <div class="be-hm-legend">${fixed ? '0' : '少'}<span class="be-hm-cell l0"></span><span class="be-hm-cell l1"></span><span class="be-hm-cell l2"></span><span class="be-hm-cell l3"></span><span class="be-hm-cell l4"></span>${fixed ? heatMax + '+' : '多'}</div>
        <div class="be-hm-scale">
          <span>深浅</span>
          <div class="be-radio-group" id="be-hm-scale">
            <button type="button" class="be-radio-opt ${fixed ? '' : 'active'}" data-s="auto">自适应</button>
            <button type="button" class="be-radio-opt ${fixed ? 'active' : ''}" data-s="fixed">固定</button>
          </div>
          ${fixed ? `<label class="be-hm-max">最深 <input type="number" id="be-hm-max" min="4" max="999" step="1" value="${heatMax}"> 条</label>` : ''}
        </div>
        <div class="be-hm-scale-tip">${fixed ? `0–${heatMax} 条均分为 4 档，${heatMax} 条及以上为最深色。` : `按单日最多条数（${max} 条）分为 4 档。`}划线和想法各计一条。</div>
        ${heatState.day ? `
          <div class="be-hm-day-h">${heatState.day} · ${dayItems.length} 条</div>
          <div class="be-hm-day-list">${dayItems.length ? dayItems.map(({ k, it }) => `
            <div class="be-hm-day-item" data-id="${it.id}">
              <div class="be-hm-day-q">${escapeHtml(String(it.text || '').slice(0, 80))}</div>
              <div class="be-hm-day-m">${escapeHtml((notes[k] && notes[k].name) || '')} · ${formatDateTime(it.ts)}</div>
            </div>`).join('') : '<div class="be-empty">这天没有记录</div>'}</div>` : '<div class="be-hm-tip">点格子查看那天的笔记</div>'}
      </div>`;
    panel.querySelector('#be-back').addEventListener('click', () => { panelView = 'notes'; renderPanel(); });
    panel.querySelector('#be-p-close').addEventListener('click', closePanel);
    panel.querySelector('#be-hm-char').addEventListener('change', e => { heatState.charKey = e.target.value; heatState.day = ''; renderPanel(); });
    panel.querySelectorAll('#be-hm-range .be-radio-opt').forEach(b => b.addEventListener('click', () => { heatState.range = +b.getAttribute('data-r'); renderPanel(); }));
    panel.querySelectorAll('#be-hm-scale .be-radio-opt').forEach(b => b.addEventListener('click', () => {
      settings.heatScale = b.getAttribute('data-s') === 'fixed' ? 'fixed' : 'auto';
      saveSettings(settings);
      renderPanel();
    }));
    panel.querySelector('#be-hm-max')?.addEventListener('change', e => {
      const v = Math.round(Number(e.target.value));
      settings.heatMax = isFinite(v) && v >= 4 ? Math.min(999, v) : 50;
      saveSettings(settings);
      renderPanel();
    });
    panel.querySelectorAll('.be-hm-grid .be-hm-cell[data-d]').forEach(c => c.addEventListener('click', () => {
      heatState.day = heatState.day === c.getAttribute('data-d') ? '' : c.getAttribute('data-d');
      renderPanel();
    }));
    panel.querySelectorAll('.be-hm-day-item').forEach(el => el.addEventListener('click', () => openHighlightViewer(el.getAttribute('data-id'))));
    const sc = panel.querySelector('.be-hm-scroll');
    if (sc) { enableHScroll(sc); sc.scrollLeft = sc.scrollWidth; }
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

  // ---------- 自由排版（版式模板：整页富文本 + 浮动贴纸） ----------
  // 页面是一份连续的可编辑文档：段落直接点进去输入，回车分段，选中文字时只改选中部分。
  // 图片 / 竖排文字 / 分隔线 / 留白是嵌在文档里的整体元素（内部不放光标，点击后弹菜单）。
  // 摘录、想法是段落级占位（也可以是竖排文字）；角色名 / 用户名 / 作者 / 书名 / 章名 / 日期是行内占位。导出时都替换成当次内容。
  // 贴纸和浮动文字压在页面上，可拖动、缩放、旋转。
  // 模板存在 settings.layoutTemplates[]（v2：{id, name, v:2, page, doc, floats}），key 为 'layout-<id>'。
  // 渲染走 buildCardMarkup → renderLayoutInner，编辑器和导出共用同一份 DOM 结构。
  // html2canvas 不支持 writing-mode / box-shadow / CSS filter / clip-path：
  //   竖排在这里逐列排成单字；裁剪、滤镜、异形遮罩、相框画进新图片；阴影是一张单独的小图垫在图片下面。
  const LAY_PS = {
    h1:    { name: '标题 1', size: 28, weight: 700, lh: 1.35 },
    h2:    { name: '标题 2', size: 22, weight: 700, lh: 1.45 },
    h3:    { name: '标题 3', size: 18, weight: 700, lh: 1.55 },
    body:  { name: '正文',   size: 16, weight: 400, lh: 1.85 },
    quote: { name: '引用',   size: 16, weight: 400, lh: 1.85 },
    small: { name: '小字',   size: 12, weight: 400, lh: 1.7 },
    box:   { name: '文字框', size: 15, weight: 400, lh: 1.8 }
  };
  const LAY_SIZES = [12, 14, 16, 18, 20, 22, 26, 30, 36, 42, 48, 56];
  const LAY_TOKENS = { char: '角色名', user: '用户名', author: '作者', book: '书名', chapter: '章名', date: '日期' };
  const LAY_SLOTS = { excerpt: '摘录', thought: '想法' };
  const LAY_SAMPLE = { excerpt: '摘录示例文本', thought: '想法示例文本' };
  const LAY_DATEFMT = ['num', 'cn', 'en'];
  const LAY_STICKERS = ['❀', '✿', '❦', '✦', '✧', '★', '☆', '☾', '☀', '♡', '❤', '♪', '✎', '✉', '❝', '❞', '「', '」', '〔', '〕', '※', '◆', '◇', '●', '○', '✕', '〰', '⁂', '☁', '❄'];
  const LAY_DIVIDERS = { bar: '粗条', dots: '圆点', stars: '星号', flower: '花饰', wave: '波浪' };
  // 遮罩：无 / 圆角 / 圆形用 CSS；其余画进图片
  const LAY_MASKS = { none: '无', round: '圆角', circle: '圆形', arch: '拱门', hex: '六边形', star: '星形', heart: '心形', scallop: '花边', torn: '撕纸边' };
  const LAY_CSS_MASKS = ['none', 'round', 'circle'];
  // 相框：画进图片
  const LAY_FRAMES = { none: '无', polaroid: '拍立得', mat: '衬纸', vintage: '旧照片', corners: '相册贴角', tape: '胶带', stamp: '邮票' };
  // 竖排标点换成竖排写法（Unicode 竖排标点 FE10–FE19 / FE30–FE44）
  const LAY_VPUNCT = {
    '：': '︓', '；': '︔', '！': '︕', '？': '︖', '…': '︙', '—': '︱', '–': '︲',
    '「': '﹁', '」': '﹂', '『': '﹃', '』': '﹄', '“': '﹁', '”': '﹂', '‘': '﹃', '’': '﹄',
    '（': '︵', '）': '︶', '(': '︵', ')': '︶', '《': '︽', '》': '︾', '〈': '︿', '〉': '﹀', '【': '︻', '】': '︼', '〔': '︹', '〕': '︺',
    ':': '︓', ';': '︔', '!': '︕', '?': '︖'
  };
  // 逗号、句号、顿号：竖排写法的字形各字体差别大（有的字体没有，会落到左下角），改用原字符整体挪到格子右上角
  const LAY_VSHIFT = { '，': '，', '。': '。', '、': '、', ',': '，', '.': '。' };
  function layNewId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function layNum(v, d, min, max) {
    const n = Number(v);
    return (v === '' || v == null || !isFinite(n)) ? d : Math.max(min, Math.min(max, n));
  }
  function layColorOk(c) { return typeof c === 'string' && /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\))$/.test(c.trim()); }
  function layFontFamily(k) {
    if (!k) return '';
    let fam = '';
    if (String(k).startsWith('custom-')) fam = (settings.customFonts || []).find(x => 'custom-' + x.id === k)?.fontFamily || '';
    else if (FONTS[k] && k !== 'follow_theme') fam = FONTS[k].css;
    return fam ? String(fam).replace(/"/g, "'") : '';
  }
  // 文字颜色那排：书摘自己的颜色（划线色系 + 卡片配色的字色）
  function layTextColors() {
    const out = [];
    const add = c => { if (c && layColorOk(c) && !out.some(x => x.toLowerCase() === c.toLowerCase())) out.push(c); };
    try { getPaletteColors().forEach(add); } catch (e) {}
    COLOR_PRESETS.forEach(p => add(p.fg));
    return out;
  }
  function layGetTemplate(key) {
    const id = String(key || '').replace(/^layout-/, '');
    const t = (settings.layoutTemplates || []).find(x => x.id === id) || null;
    return t ? layEnsureV2(t) : null;
  }
  function layDefaultDraft(name, sample) {
    const smp = String(sample || '').trim().slice(0, 300);
    return {
      id: layNewId('l'), name: name || '我的排版', v: 2,
      page: { pad: 28, gap: 14 },
      doc: [
        { t: 'p', ps: 'body', slot: 'excerpt', s: {}, html: smp ? escapeHtml(smp).replace(/\n+/g, '<br>') : '' },
        { t: 'p', ps: 'small', slot: 'thought', s: {}, html: '' },
        { t: 'p', ps: 'small', s: {}, html: '—— <span data-tok="author"></span> <span data-tok="book"></span>' }
      ],
      floats: []
    };
  }
  // 起手模板：新建时可以从这些开始改
  const LAY_STARTERS = [
    { k: 'basic', name: '基础', make: (smp) => { const d = layDefaultDraft(); d.doc[0].html = smp; return { page: d.page, doc: d.doc }; } },
    { k: 'blank', name: '空白', make: (smp) => ({ page: { pad: 28, gap: 14 }, doc: [
      { t: 'p', ps: 'body', slot: 'excerpt', s: {}, html: smp }] }) },
    { k: 'book', name: '书页', make: (smp) => ({ page: { pad: 36, gap: 16 }, doc: [
      { t: 'p', ps: 'h3', s: { a: 'center' }, html: '<span data-tok="book"></span>' },
      { t: 'p', ps: 'small', s: { a: 'center' }, html: '<span data-tok="chapter"></span>' },
      { t: 'hr', id: layNewId('a'), k: 'dots' },
      { t: 'p', ps: 'body', slot: 'excerpt', s: { a: 'justify' }, html: smp },
      { t: 'p', ps: 'small', slot: 'thought', s: { i: true }, html: '' },
      { t: 'p', ps: 'small', s: { a: 'right' }, html: '—— <span data-tok="author"></span>' }] }) },
    { k: 'polaroid', name: '拍立得', make: (smp) => ({ page: { pad: 30, gap: 16 }, doc: [
      { t: 'img', id: layNewId('a'), src: '', orig: '', lay: 'center', wp: 74, frame: 'polaroid', sh: 1, filter: 'none', mask: 'none' },
      { t: 'p', ps: 'body', slot: 'excerpt', s: { a: 'center' }, html: smp },
      { t: 'p', ps: 'small', s: { a: 'center' }, html: '<span data-tok="date" data-fmt="cn"></span>' }] }) },
    { k: 'letter', name: '信笺', make: (smp) => ({ page: { pad: 36, gap: 14 }, doc: [
      { t: 'p', ps: 'body', s: {}, html: '致 <span data-tok="user"></span>：' },
      { t: 'p', ps: 'body', slot: 'excerpt', s: {}, html: smp },
      { t: 'p', ps: 'small', slot: 'thought', s: {}, html: '' },
      { t: 'p', ps: 'body', s: { a: 'right' }, html: '<span data-tok="char"></span>' },
      { t: 'p', ps: 'small', s: { a: 'right' }, html: '<span data-tok="date" data-fmt="cn"></span>' }] }) },
    { k: 'verse', name: '竖排诗笺', make: (smp) => ({ page: { pad: 32, gap: 16 }, doc: [
      { t: 'vt', id: layNewId('a'), slot: 'excerpt', text: '', s: { z: 20, a: 'right' }, vh: 300 },
      { t: 'p', ps: 'small', s: {}, html: '<span data-tok="author"></span> <span data-tok="book"></span>' }] }) }
  ];
  // 上一版（v1，按块排）的模板转成 v2 文档；直接改写原对象，存回设置时就是新格式
  function layEnsureV2(t) {
    if (!t) return t;
    if (!(t.v === 2 && Array.isArray(t.doc))) {
      const page = { ...(t.page || {}) };
      if (typeof page.pad === 'string') page.pad = { n: 18, m: 28, w: 40 }[page.pad] || 28;
      if (typeof page.gap === 'string') page.gap = { s: 8, m: 14, l: 22 }[page.gap] || 14;
      const sOf = b => { const s = { ...(b.s || {}) }; delete s.p; return s; };
      const tok = k => `<span data-tok="${k}"></span>`;
      const doc = [];
      (t.blocks || []).forEach(b => {
        if (!b || !b.t) return;
        const ps = LAY_PS[(b.s || {}).p] ? b.s.p : 'body';
        if (b.t === 'text') doc.push({ t: 'p', ps, s: sOf(b), html: layCleanInline(b.html || '') });
        else if (b.t === 'excerpt' || b.t === 'thought') doc.push({ t: 'p', ps, slot: b.t, s: sOf(b), html: '' });
        else if (b.t === 'source') {
          const o = b.o || { dash: true, author: true, book: true };
          const parts = ['user', 'author', 'book', 'chapter'].filter(k => o[k]).map(tok);
          doc.push({ t: 'p', ps, s: sOf(b), html: (o.dash ? '—— ' : '') + parts.join(' ') });
        } else if (b.t === 'date') doc.push({ t: 'p', ps, s: sOf(b), html: `<span data-tok="date" data-fmt="${LAY_DATEFMT.includes((b.o || {}).fmt) ? b.o.fmt : 'num'}"></span>` });
        else if (b.t === 'image') doc.push({ t: 'img', id: b.id || layNewId('a'), src: b.src || '', orig: b.orig || b.src || '', crop: b.crop || null, filter: b.filter || 'none', lay: b.lay || 'full', wp: b.wp, ar: b.ar, bw: b.bw || 0, bc: b.bc || '', mask: b.mask || 'none', sh: 0 });
        else if (b.t === 'divider') doc.push({ t: 'hr', id: b.id || layNewId('a'), k: b.k || 'dots' });
        else if (b.t === 'spacer') doc.push({ t: 'sp', id: b.id || layNewId('a'), h: b.h || 24 });
      });
      t.page = page;
      t.doc = doc;
      t.v = 2;
      delete t.blocks;
    }
    // 上一轮 dev 的分割图（一个整体元素）拆成两张独立图片，中间文字变成普通段落
    if ((t.doc || []).some(a => a && a.t === 'split')) {
      const out = [];
      t.doc.forEach(a => {
        if (!a || a.t !== 'split') { out.push(a); return; }
        const c = a.crop || { x: 0, y: 0, w: 1, h: 1 }, at = layNum(a.at, 0.5, 0.1, 0.9), v = a.dir === 'v';
        const grp = layNewId('g');
        const half = (part) => {
          const first = part === 'a';
          const crop = v
            ? { x: first ? c.x : c.x + c.w * at, y: c.y, w: c.w * (first ? at : 1 - at), h: c.h }
            : { x: c.x, y: first ? c.y : c.y + c.h * at, w: c.w, h: c.h * (first ? at : 1 - at) };
          return { t: 'img', id: layNewId('a'), src: a.orig || a.src || '', orig: a.orig || a.src || '', crop, filter: a.filter || 'none', lay: v ? (first ? 'left' : 'right') : 'full', wp: v ? 36 : undefined, sh: a.sh || 0, mask: 'none', frame: 'none', grp, part, needBake: true };
        };
        out.push(half('a'));
        if (v) out.push(half('b'));
        out.push({ t: 'p', ps: LAY_PS[a.ps] ? a.ps : 'body', s: a.s || { a: 'center' }, html: a.mv ? escapeHtml(a.text || '') : (a.html || '') });
        if (!v) out.push(half('b'));
      });
      t.doc = out;
    }
    if (t.page) { delete t.page.bgP; delete t.page.fgP; }
    return t;
  }
  // 段落样式 → 内联 style（字体 / 字号 / 粗斜 / 下划删除线 / 颜色 / 对齐 / 行距）
  function layParaCss(ps, s) {
    s = s || {};
    const pr = LAY_PS[ps] || LAY_PS.body;
    const css = [];
    const fam = layFontFamily(s.f);
    if (fam) css.push(`font-family:${fam}`);
    const z = Number(s.z) > 0 ? Number(s.z) : 0;
    css.push(ps === 'body' && !z ? `font-size:var(--be-quote-size, ${pr.size}px)` : `font-size:${z || pr.size}px`);
    css.push(`font-weight:${s.b === true ? 700 : s.b === false ? 400 : pr.weight}`);
    if (s.i) css.push('font-style:italic');
    const deco = [s.u ? 'underline' : '', s.k ? 'line-through' : ''].filter(Boolean).join(' ');
    if (deco) css.push(`text-decoration:${deco}`);
    if (s.c && layColorOk(s.c)) css.push(`color:${s.c}`);
    if (s.a) css.push(`text-align:${s.a}`);
    css.push(`line-height:${Number(s.lh) > 0 ? Number(s.lh) : pr.lh}`);
    return css.join(';');
  }
  function layParaBold(ps, s) { return s && s.b != null ? !!s.b : (LAY_PS[ps] || LAY_PS.body).weight >= 600; }
  // 行内 span 的 data-c / data-z / data-f → style
  function laySpanStyle(el) {
    const css = [];
    const c = el.getAttribute('data-c'); if (c && layColorOk(c)) css.push('color:' + c);
    const z = Number(el.getAttribute('data-z')); if (z > 0) css.push(`font-size:${z}px`);
    const f = layFontFamily(el.getAttribute('data-f')); if (f) css.push('font-family:' + f);
    if (css.length) el.setAttribute('style', css.join(';')); else el.removeAttribute('style');
  }
  function layInlineAttrs(n) {
    let a = '';
    const c = n.getAttribute('data-c'); if (c && layColorOk(c)) a += ` data-c="${escapeHtml(c)}"`;
    const z = Number(n.getAttribute('data-z')); if (z >= 6 && z <= 120) a += ` data-z="${Math.round(z)}"`;
    const f = n.getAttribute('data-f'); if (f && layFontFamily(f)) a += ` data-f="${escapeHtml(f)}"`;
    return a;
  }
  // 段落里存下来的内容只留：文字、粗斜下划删除线、换行、带 data-c/z/f 的 span、行内占位；其余标签剥掉（粘贴进来的网页样式也会清掉）
  function layCleanInline(html) {
    const box = mainDoc.createElement('div');
    box.innerHTML = String(html || '');
    const keep = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', S: 's', STRIKE: 's', DEL: 's' };
    const walk = (node) => {
      let out = '';
      node.childNodes.forEach(n => {
        if (n.nodeType === 3) { out += escapeHtml(n.nodeValue.replace(/​/g, '')); return; }
        if (n.nodeType !== 1) return;
        const tg = n.tagName;
        if (tg === 'BR') { out += '<br>'; return; }
        if (n.hasAttribute('data-tok')) {
          const t = n.getAttribute('data-tok');
          if (LAY_TOKENS[t]) {
            const fmt = n.getAttribute('data-fmt');
            out += `<span data-tok="${t}"${t === 'date' && LAY_DATEFMT.includes(fmt) ? ` data-fmt="${fmt}"` : ''}></span>`;
          }
          return;
        }
        const inner = walk(n);
        if (/^(DIV|P|LI|H[1-6]|BLOCKQUOTE)$/.test(tg)) {
          if (out && !out.endsWith('<br>')) out += '<br>';
          out += inner;
          return;
        }
        if (keep[tg]) { if (inner) out += `<${keep[tg]}>${inner}</${keep[tg]}>`; return; }
        if (tg === 'SPAN' || tg === 'FONT') { const a = layInlineAttrs(n); out += (a && inner) ? `<span${a}>${inner}</span>` : inner; return; }
        out += inner;
      });
      return out;
    };
    return walk(box).replace(/(<br>)+$/, '');
  }
  function layDateText(fmt) {
    const d = new Date();
    if (fmt === 'cn') return toChineseDate(d);
    if (fmt === 'en') return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${d.getFullYear()}`;
    return formatDate();
  }
  function layTokenLabel(tok, fmt) {
    if (tok === 'date') return '日期·' + (fmt === 'cn' ? '中文' : fmt === 'en' ? '英文' : '数字');
    return LAY_TOKENS[tok] || '';
  }
  function layTokenHtml(tok, fmt, data) {
    const nm = v => (v && String(v).trim()) ? maskNameDisplay(v, '') : '';
    if (tok === 'char') return nm(data.charName);
    if (tok === 'user') return nm(data.userName);
    if (tok === 'author') return nm(data.authorName);
    if (tok === 'book') return data.bookName ? '《' + escapeHtml(data.bookName) + '》' : '';
    if (tok === 'chapter') return data.chapter ? escapeHtml(data.chapter) : '';
    if (tok === 'date') return escapeHtml(layDateText(fmt));
    return '';
  }
  // 段落内容 → 显示用 HTML：编辑时占位显示成标签，导出时换成当次的值。返回 { html, hide }：
  // 段落里有占位、占位全是空的、其余只剩标点空白时 hide=true（比如没填书名时「—— 《》」整段不显示）
  function layInlineRender(html, data, ed) {
    const box = mainDoc.createElement('div');
    box.innerHTML = html || '';
    let toks = 0, filled = 0;
    box.querySelectorAll('span').forEach(sp => {
      const tok = sp.getAttribute('data-tok');
      if (tok) {
        const fmt = sp.getAttribute('data-fmt') || '';
        if (ed) {
          sp.className = 'be-lay-tok';
          sp.setAttribute('contenteditable', 'false');
          sp.textContent = layTokenLabel(tok, fmt);
          // 前后补零宽空格文字节点：段首 / 两个占位相邻时，占位前面也能放光标、打字（保存时 layCleanInline 会去掉）
          if (!sp.previousSibling || sp.previousSibling.nodeType !== 3) sp.before(mainDoc.createTextNode('​'));
          if (!sp.nextSibling || sp.nextSibling.nodeType !== 3) sp.after(mainDoc.createTextNode('​'));
        } else {
          toks++;
          const v = layTokenHtml(tok, fmt, data);
          if (v) filled++;
          sp.innerHTML = v;
          sp.removeAttribute('data-tok'); sp.removeAttribute('data-fmt');
        }
        return;
      }
      laySpanStyle(sp);
    });
    let hide = false;
    if (!ed && toks && !filled) {
      const rest = (box.textContent || '').replace(/[\s\p{P}\p{S}]/gu, '');
      hide = !rest;
    }
    return { html: box.innerHTML, hide };
  }
  // 竖排：按列高算出每列字数，逐列排成单字（从右往左）；标点换竖排写法
  function layVertHtml(text, s, vh) {
    s = s || {};
    const z = Number(s.z) > 0 ? Number(s.z) : 18;
    const lh = Number(s.lh) > 0 ? Number(s.lh) : 1.8;
    const cell = z * 1.12;
    const per = Math.max(1, Math.floor(vh / cell));
    const cols = [];
    String(text || '').split('\n').forEach(line => {
      const chars = Array.from(line);
      if (!chars.length) { cols.push([]); return; }
      for (let i = 0; i < chars.length; i += per) cols.push(chars.slice(i, i + per));
    });
    return cols.map(c => `<span class="be-lay-vcol" style="width:${(z * lh).toFixed(1)}px;height:${Math.round(vh)}px">${c.map(ch =>
      LAY_VSHIFT[ch]
        ? `<span style="height:${cell.toFixed(2)}px"><span class="be-lay-vsh">${LAY_VSHIFT[ch]}</span></span>`
        : `<span style="height:${cell.toFixed(2)}px">${ch === ' ' ? '&nbsp;' : escapeHtml(LAY_VPUNCT[ch] || ch)}</span>`).join('')}</span>`).join('');
  }
  function layVertWrapCss(s) {
    s = s || {};
    const css = [];
    const fam = layFontFamily(s.f); if (fam) css.push(`font-family:${fam}`);
    css.push(`font-size:${Number(s.z) > 0 ? Number(s.z) : 18}px`);
    if (s.b) css.push('font-weight:700');
    if (s.c && layColorOk(s.c)) css.push(`color:${s.c}`);
    css.push(`justify-content:${s.a === 'center' ? 'center' : s.a === 'left' ? 'flex-end' : 'flex-start'}`);
    return css.join(';');
  }
  // 「跟随配色」在编辑器里预览用：内置配色 + 自定义配色
  function layPresetList() {
    const out = COLOR_PRESETS.filter(p => !(settings.hiddenColorPresets || []).includes(p.id)).map(p => ({ k: p.id, name: p.name, bg: p.bg, fg: p.fg }));
    (settings.customColors || []).forEach(c => {
      const r = resolveCustomColor(c.bg, c.fgEnabled, c.fg);
      out.push({ k: 'saved-' + c.id, name: c.name || '自定义配色', bg: r.bg, fg: r.fg });
    });
    return out;
  }
  function layPreset(k) { return k ? (layPresetList().find(p => p.k === k) || null) : null; }

  // ===== 图片处理（编辑器和书摘弹窗换图共用） =====
  function layNeedBake(a) {
    return !!(a.crop || (a.filter && a.filter !== 'none') || (a.mask && !LAY_CSS_MASKS.includes(a.mask)) || (a.frame && a.frame !== 'none'));
  }
  function layCanvas(w, h) { const c = mainDoc.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function layImgSize(ref) {
    return new Promise(resolve => {
      let done = false;
      const fin = v => { if (!done) { done = true; resolve(v); } };
      const go = (u) => { const im = new mainWin.Image(); im.onload = () => fin({ w: im.naturalWidth, h: im.naturalHeight, img: im }); im.onerror = () => fin(null); im.src = u; };
      const url = imgUrlSync(ref);
      if (url) go(url); else imgUrlSync(ref, () => go(imgUrlSync(ref)));
      setTimeout(() => fin(null), 6000);
    });
  }
  // 由 id 得到稳定的伪随机数（撕纸边每次生成一样的锯齿）
  function layRand(seed) {
    let h = 2166136261;
    for (const ch of String(seed || 'x')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
  }
  function layShapePath(ctx, x, y, w, h, mask, k, seed) {
    ctx.beginPath();
    if (mask === 'circle') { ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); return; }
    if (mask === 'round') {
      const r = Math.min(12 * k, w / 2, h / 2);
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
      return;
    }
    if (mask === 'arch') {
      const r = Math.min(w / 2, h);
      ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.arc(x + w / 2, y + r, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath();
      return;
    }
    if (mask === 'hex') {
      [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]].forEach(([px, py], i) => ctx[i ? 'lineTo' : 'moveTo'](x + px * w, y + py * h));
      ctx.closePath(); return;
    }
    if (mask === 'star') {
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 0.46 : 1;
        ctx[i ? 'lineTo' : 'moveTo'](x + w / 2 + Math.cos(ang) * w / 2 * rr, y + h * 0.52 + Math.sin(ang) * h / 2 * rr);
      }
      ctx.closePath(); return;
    }
    if (mask === 'heart') {
      const P = (px, py) => [x + px * w, y + py * h];
      ctx.moveTo(...P(0.5, 0.98));
      ctx.bezierCurveTo(...P(0.1, 0.68), ...P(0, 0.4), ...P(0.12, 0.2));
      ctx.bezierCurveTo(...P(0.26, 0.02), ...P(0.48, 0.06), ...P(0.5, 0.25));
      ctx.bezierCurveTo(...P(0.52, 0.06), ...P(0.74, 0.02), ...P(0.88, 0.2));
      ctx.bezierCurveTo(...P(1, 0.4), ...P(0.9, 0.68), ...P(0.5, 0.98));
      ctx.closePath(); return;
    }
    if (mask === 'scallop') {
      const r = Math.max(3, Math.min(w, h) * 0.045);
      ctx.rect(x + r, y + r, w - 2 * r, h - 2 * r);
      const along = (x1, y1, x2, y2) => {
        const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.round(len / (r * 2)));
        for (let i = 0; i <= n; i++) { const t = i / n; ctx.moveTo(x1 + (x2 - x1) * t + r, y1 + (y2 - y1) * t); ctx.arc(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, r, 0, Math.PI * 2); }
      };
      along(x + r, y + r, x + w - r, y + r); along(x + r, y + h - r, x + w - r, y + h - r);
      along(x + r, y + r, x + r, y + h - r); along(x + w - r, y + r, x + w - r, y + h - r);
      return;
    }
    if (mask === 'torn') {
      const rnd = layRand(seed), d = Math.min(w, h) * 0.035, step = Math.max(4, Math.min(w, h) * 0.03);
      const pts = [];
      for (let t = 0; t < w; t += step) pts.push([x + t, y + rnd() * d]);
      for (let t = 0; t < h; t += step) pts.push([x + w - rnd() * d, y + t]);
      for (let t = w; t > 0; t -= step) pts.push([x + t, y + h - rnd() * d]);
      for (let t = h; t > 0; t -= step) pts.push([x + rnd() * d, y + t]);
      pts.forEach(([px, py], i) => ctx[i ? 'lineTo' : 'moveTo'](px, py));
      ctx.closePath(); return;
    }
    ctx.rect(x, y, w, h);
  }
  // 相框：在内容四周加边 / 贴角 / 胶带，返回新画布
  function layFrameCanvas(src, frame, k, seed) {
    const w = src.width, h = src.height;
    if (frame === 'polaroid') {
      const ps = Math.round(w * 0.06), pb = Math.round(w * 0.2);
      const c = layCanvas(w + ps * 2, h + ps + pb), x = c.getContext('2d');
      x.fillStyle = '#fbfaf6'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(src, ps, ps);
      return c;
    }
    if (frame === 'mat') {
      const m = Math.round(w * 0.09), line = Math.max(1, Math.round(1.5 * k));
      const c = layCanvas(w + m * 2, h + m * 2), x = c.getContext('2d');
      x.fillStyle = '#f3eee2'; x.fillRect(0, 0, c.width, c.height);
      x.strokeStyle = '#3b3833'; x.lineWidth = line * 2; x.strokeRect(0, 0, c.width, c.height);
      x.drawImage(src, m, m);
      x.strokeStyle = '#b8af9c'; x.lineWidth = line; x.strokeRect(m - line * 2, m - line * 2, w + line * 4, h + line * 4);
      return c;
    }
    if (frame === 'vintage') {
      const b = Math.round(w * 0.045);
      const c = layCanvas(w + b * 2, h + b * 2), x = c.getContext('2d');
      layShapePath(x, 0, 0, c.width, c.height, 'round', k * 0.5);
      x.fillStyle = '#efe5cf'; x.fill();
      x.drawImage(src, b, b);
      // 微黄 + 四角压暗
      x.save(); x.beginPath(); x.rect(b, b, w, h); x.clip();
      x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgba(222,196,140,0.32)'; x.fillRect(b, b, w, h);
      x.globalCompositeOperation = 'source-over';
      const g = x.createRadialGradient(b + w / 2, b + h / 2, Math.min(w, h) * 0.3, b + w / 2, b + h / 2, Math.hypot(w, h) * 0.6);
      g.addColorStop(0, 'rgba(60,40,10,0)'); g.addColorStop(1, 'rgba(60,40,10,0.32)');
      x.fillStyle = g; x.fillRect(b, b, w, h);
      x.restore();
      return c;
    }
    if (frame === 'corners') {
      const p = Math.round(Math.min(w, h) * 0.03), s = Math.round(Math.min(w, h) * 0.14);
      const c = layCanvas(w + p * 2, h + p * 2), x = c.getContext('2d');
      x.drawImage(src, p, p);
      x.fillStyle = 'rgba(38,34,30,0.88)';
      const tri = (ax, ay, bx, by, cx, cy) => { x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.lineTo(cx, cy); x.closePath(); x.fill(); };
      tri(0, 0, s, 0, 0, s); tri(c.width, 0, c.width - s, 0, c.width, s);
      tri(0, c.height, s, c.height, 0, c.height - s); tri(c.width, c.height, c.width - s, c.height, c.width, c.height - s);
      return c;
    }
    if (frame === 'tape') {
      const th = Math.round(w * 0.05);
      const c = layCanvas(w, h + th), x = c.getContext('2d');
      x.drawImage(src, 0, th);
      const rnd = layRand(seed);
      x.save();
      x.translate(w / 2 + (rnd() - 0.5) * w * 0.1, th + th * 0.2);
      x.rotate((-3 - rnd() * 3) * Math.PI / 180);
      const tw = w * 0.34, tH = th * 1.9;
      x.fillStyle = 'rgba(238,228,196,0.82)'; x.fillRect(-tw / 2, -tH / 2, tw, tH);
      x.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i = -tw / 2; i < tw / 2; i += tH * 0.5) x.fillRect(i, -tH / 2, tH * 0.18, tH);
      x.restore();
      return c;
    }
    if (frame === 'stamp') {
      const b = Math.round(w * 0.06), r = Math.max(2, w * 0.02);
      const c = layCanvas(w + b * 2, h + b * 2), x = c.getContext('2d');
      x.fillStyle = '#fffdf8'; x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = 'destination-out';
      const holes = (x1, y1, x2, y2) => {
        const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.round(len / (r * 2.7)));
        for (let i = 0; i <= n; i++) { const t = i / n; x.beginPath(); x.arc(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, r, 0, Math.PI * 2); x.fill(); }
      };
      holes(0, 0, c.width, 0); holes(0, c.height, c.width, c.height); holes(0, 0, 0, c.height); holes(c.width, 0, c.width, c.height);
      x.globalCompositeOperation = 'source-over';
      x.drawImage(src, b, b);
      return c;
    }
    return src;
  }
  // 阴影小图：按内容的轮廓（含透明部分）生成，返回 {canvas, box:[left%, top%, width%, height%]}，拉伸垫在图片下面
  function layShadowCanvas(alphaSrc, sh) {
    const strong = Number(sh) >= 2;
    const W = 160, H = Math.max(8, Math.round(160 * alphaSrc.height / alphaSrc.width));
    const P = Math.round(Math.max(W, H) * 0.16);
    const c = layCanvas(W + P * 2, H + P * 2), x = c.getContext('2d');
    x.shadowColor = `rgba(0,0,0,${strong ? 0.42 : 0.26})`;
    x.shadowBlur = P * (strong ? 0.7 : 0.5);
    x.shadowOffsetX = 10000;
    x.shadowOffsetY = P * (strong ? 0.3 : 0.2);
    x.drawImage(alphaSrc, P - 10000, P, W, H);   // 内容画在画布外，只留下影子
    return { canvas: c, box: [-P / W * 100, -P / H * 100, (W + 2 * P) / W * 100, (H + 2 * P) / H * 100].map(v => +v.toFixed(3)) };
  }
  async function layCanvasToRef(canvas, png) {
    const type = png ? 'image/png' : 'image/jpeg';
    const blob = await canvasToBlob(canvas, type, 0.95);
    const ar = +(canvas.width / canvas.height).toFixed(4);
    const data = await blob.arrayBuffer();
    const key = `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    await imgPut(key, { type, data });
    _imgUrlCache.set(key, mainWin.URL.createObjectURL(new mainWin.Blob([data], { type })));
    return { ref: 'idb:' + key, ar };
  }
  // 同一次会话里同样的参数只算一次（来回切滤镜 / 阴影不重算）
  const _layBakeCache = new Map();
  // 按 a 的设置算出显示用的数据：{ src, ar, shd, shdBox }；dispW = 图片在页面上的显示宽度（px），按 2 倍处理
  async function layProcessImage(a, dispW) {
    const orig = a.orig || a.src;
    if (!orig) return null;
    // 处理后的图片宽度 = 显示宽度 × 导出倍率（导出时按这个倍率截图，低了会糊）
    const kx = Math.max(2, Math.min(4, Number(settings.exportScale) || 3));
    const tw = Math.max(240, Math.min(2000, Math.round((dispW || 360) * kx)));
    const key = JSON.stringify([orig, a.crop || 0, a.filter || 'none', a.mask || 'none', a.frame || 'none', LAY_CSS_MASKS.includes(a.mask || 'none') ? 0 : (a.bw || 0), LAY_CSS_MASKS.includes(a.mask || 'none') ? '' : (a.bc || ''), Number(a.sh) || 0, tw, a.id]);
    if (_layBakeCache.has(key)) return _layBakeCache.get(key);
    const sz = await layImgSize(orig);
    if (!sz) return null;
    const out = {};
    let alphaSrc = null;
    if (layNeedBake(a)) {
      const c = a.crop || { x: 0, y: 0, w: 1, h: 1 };
      const sx = Math.round(c.x * sz.w), sy = Math.round(c.y * sz.h);
      const sw = Math.max(1, Math.round(c.w * sz.w)), shh = Math.max(1, Math.round(c.h * sz.h));
      const kScale = Math.min(1, tw / sw);
      let canvas = layCanvas(sw * kScale, shh * kScale);
      let ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sz.img, sx, sy, sw, shh, 0, 0, canvas.width, canvas.height);
      const f = a.filter;
      if (f && f !== 'none') {
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height), px = d.data;
        for (let i = 0; i < px.length; i += 4) {
          let r = px[i], g = px[i + 1], bl = px[i + 2];
          const y = 0.299 * r + 0.587 * g + 0.114 * bl;
          if (f === 'gray') { r = g = bl = y; }
          else if (f === 'vintage') { r = Math.min(255, y * 1.07 + 18); g = Math.min(255, y * 0.95 + 10); bl = Math.min(255, y * 0.78); }
          else if (f === 'contrast') { r = (r - 128) * 1.45 + 128; g = (g - 128) * 1.45 + 128; bl = (bl - 128) * 1.45 + 128; }
          else if (f === 'fade') { r = r * 0.8 + 45; g = g * 0.8 + 45; bl = bl * 0.8 + 48; }
          px[i] = r < 0 ? 0 : r > 255 ? 255 : r; px[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; px[i + 2] = bl < 0 ? 0 : bl > 255 ? 255 : bl;
        }
        ctx.putImageData(d, 0, 0);
      }
      const k = canvas.width / Math.max(60, dispW || 360);   // 页面上 1px 对应图片里多少像素
      let alpha = false;
      const mask = a.mask || 'none';
      if (mask !== 'none' && !(LAY_CSS_MASKS.includes(mask) && (!a.frame || a.frame === 'none'))) {
        const m = layCanvas(canvas.width, canvas.height), mx = m.getContext('2d');
        layShapePath(mx, 0, 0, m.width, m.height, mask, k, a.id);
        mx.save(); mx.clip(); mx.drawImage(canvas, 0, 0);
        const bw = Number(a.bw) || 0;
        if (bw > 0) { mx.lineWidth = bw * k * 2; mx.strokeStyle = layColorOk(a.bc) ? a.bc : '#ffffff'; layShapePath(mx, 0, 0, m.width, m.height, mask, k, a.id); mx.stroke(); }
        mx.restore();
        canvas = m; alpha = true;
      }
      if (a.frame && a.frame !== 'none') {
        canvas = layFrameCanvas(canvas, a.frame, k, a.id);
        if (['tape', 'stamp', 'vintage', 'corners'].includes(a.frame)) alpha = true;
      }
      alphaSrc = canvas;
      const r = await layCanvasToRef(canvas, alpha);
      out.src = r.ref; out.ar = r.ar; out.baked = true;
    } else {
      out.src = orig; out.ar = +(sz.w / sz.h).toFixed(4); out.baked = false;
    }
    if (Number(a.sh) > 0) {
      if (!alphaSrc) {
        // CSS 显示的图片（无遮罩 / 圆角 / 圆形）：按形状画一张轮廓
        alphaSrc = layCanvas(200, Math.max(8, Math.round(200 / out.ar)));
        const ax = alphaSrc.getContext('2d');
        layShapePath(ax, 0, 0, alphaSrc.width, alphaSrc.height, a.mask || 'none', 200 / Math.max(60, dispW || 360), a.id);
        ax.fillStyle = '#000'; ax.fill();
      }
      const s = layShadowCanvas(alphaSrc, a.sh);
      const r = await layCanvasToRef(s.canvas, true);
      out.shd = r.ref; out.shdBox = s.box;
    }
    _layBakeCache.set(key, out);
    return out;
  }

  function layImgCss(a, url) {
    const ar = Number(a.ar) > 0 ? Number(a.ar) : 0.75;
    const css = [`aspect-ratio:${+ar.toFixed(4)}`];
    if (url) css.push(`background-image:url('${url}')`, 'background-color:transparent');
    if (!a.baked) {
      if (a.bw) css.push(`border:${Number(a.bw)}px solid ${layColorOk(a.bc) ? a.bc : '#ffffff'}`);
      if (a.mask === 'circle') css.push('border-radius:50%');
      else if (a.mask === 'round') css.push('border-radius:12px');
    }
    return css.join(';');
  }
  function layAtomHtml(a, data, ed, innerW) {
    const ea = ed ? ` data-aid="${a.id}" contenteditable="false"` : ` data-lay-aid="${a.id}"`;
    if (a.t === 'img') {
      // 书摘弹窗里「仅本次」换的图
      const ov = !ed && data.imgOverride ? data.imgOverride[a.grp ? 'g:' + a.grp : a.id] : null;
      const v = ov ? { ...a, ...(ov[a.id] || {}) } : a;
      const url = v.src ? imgUrlSync(v.src, () => { layRerenderAfterImage(); }) : '';
      if (!url && !ed && !data.preview) return '';
      const lay = a.lay || 'full';
      const wp = lay === 'full' ? 100 : layNum(a.wp, lay === 'center' ? 60 : 42, 10, 100);
      const shdUrl = v.shd ? imgUrlSync(v.shd, () => { layRerenderAfterImage(); }) : '';
      const b = Array.isArray(v.shdBox) ? v.shdBox : null;
      const shd = shdUrl && b ? `<i class="be-lay-shd" style="left:${b[0]}%;top:${b[1]}%;width:${b[2]}%;height:${b[3]}%;background-image:url('${shdUrl}')"></i>` : '';
      return `<div class="be-la be-lay-imgw be-lay-img-${lay}${a.grp ? ' be-lay-img-grp' : ''}"${ea} style="width:${wp}%">${shd}<div class="be-lay-img" style="${layImgCss(v, url)}">${!url ? `<span class="be-lay-ph">${ed ? '点击选择图片' : '图片'}</span>` : ''}</div></div>`;
    }
    if (a.t === 'vt') {
      const vh = layNum(a.vh, 240, 60, 900);
      let txt;
      if (a.slot && !ed) txt = a.slot === 'thought' ? (data.thoughtPlain || '') : (data.quotePlain || '');
      else txt = a.text || (ed ? (a.slot ? LAY_SAMPLE[a.slot] : '竖排文字') : '');
      if (!txt) return '';
      return `<div class="be-la be-lay-vt${!a.text && ed ? ' be-lay-vt-ph' : ''}"${ea}${a.slot && ed ? ` data-vslot="${a.slot}"` : ''} style="${layVertWrapCss(a.s)}">${layVertHtml(txt, a.s, vh)}</div>`;
    }
    if (a.t === 'hr') {
      const k = a.k || 'dots';
      const inner = k === 'bar' ? '<i></i>' : k === 'stars' ? '✦ ✦ ✦' : k === 'flower' ? '❦' : k === 'wave' ? '〰〰〰' : '· · · · ·';
      return `<div class="be-la be-lay-div be-lay-div-${k}"${ea}>${inner}</div>`;
    }
    if (a.t === 'sp') return `<div class="be-la be-lay-space"${ea} style="height:${layNum(a.h, 24, 4, 400)}px"></div>`;
    return '';
  }
  function layParaHtml(b, data, ed) {
    const ps = LAY_PS[b.ps] ? b.ps : 'body';
    const cls = `be-lp be-lp-${ps}`;
    const css = layParaCss(ps, b.s);
    if (ed) {
      const slot = LAY_SLOTS[b.slot] ? b.slot : '';
      const inner = layInlineRender(b.html, data, true).html;
      const empty = !layPlainTextOf(inner) && !/data-tok/.test(inner);
      return `<div class="${cls}${slot && empty ? ' be-lp-ph' : ''}" data-ps="${ps}" data-s="${escapeHtml(JSON.stringify(b.s || {}))}"${slot ? ` data-slot="${slot}" data-ph="${LAY_SAMPLE[slot]}"` : ''} style="${css}">${inner || '<br>'}</div>`;
    }
    if (b.slot === 'excerpt') return `<div class="${cls} be-quote" style="${css}">${data.quoteHtml || ''}</div>`;
    if (b.slot === 'thought') return data.thoughtHtml ? `<div class="${cls}" style="${css}">${data.thoughtHtml}</div>` : '';
    const r = layInlineRender(b.html, data, false);
    if (r.hide) return '';
    return `<div class="${cls}" style="${css}">${r.html || '<br>'}</div>`;
  }
  function layPlainTextOf(html) { const d = mainDoc.createElement('div'); d.innerHTML = html || ''; return (d.textContent || '').replace(/​/g, '').trim(); }
  // data：{ quoteHtml, quotePlain, thoughtHtml, thoughtPlain, charName, userName, authorName, bookName, chapter, wmText, preview, edit, pageW, previewColors, imgOverride }
  function renderLayoutInner(tpl, data) {
    tpl = layEnsureV2(tpl) || layDefaultDraft();
    const page = tpl.page || {};
    const pad = layNum(page.pad, 28, 0, 80);
    const gap = layNum(page.gap, 14, 0, 60);
    const ed = !!data.edit;
    const pv = data.previewColors || null;   // 编辑器里「跟随配色」的预览
    const bg = page.bg || (pv && !page.bgImg ? pv.bg : '');
    const fg = page.fg || (pv ? pv.fg : '');
    const bgImg = page.bgImg ? imgUrlSync(page.bgImg, () => { layRerenderAfterImage(); }) : '';
    const rootStyle = [
      `--lay-pad:${pad}px`, `--lay-gap:${gap}px`,
      bg && layColorOk(bg) ? `background-color:${bg}` : '',
      bgImg ? `background-image:url('${bgImg}');background-size:${page.bgFit === 'tile' ? 'auto' : 'cover'};background-position:center;background-repeat:${page.bgFit === 'tile' ? 'repeat' : 'no-repeat'}` : '',
      fg && layColorOk(fg) ? `color:${fg}` : ''
    ].filter(Boolean).join(';');
    const pageW = Number(data.pageW) > 0 ? Number(data.pageW) : (Number(settings.cardWidth) > 0 ? Number(settings.cardWidth) : 420);
    const innerW = Math.max(120, pageW - pad * 2);
    let doc = (tpl.doc || []).slice();
    // 导出时去掉末尾的空段落（编辑时为了能往下打字常留着一个）
    if (!ed) while (doc.length && doc[doc.length - 1].t === 'p' && !doc[doc.length - 1].slot && !layCleanInline(doc[doc.length - 1].html)) doc.pop();
    const body = doc.map(b => b.t === 'p' ? layParaHtml(b, data, ed) : layAtomHtml(b, data, ed, innerW)).join('');
    const floats = (tpl.floats || []).map(f => {
      const css = `left:${+layNum(f.x, 50, 0, 100).toFixed(2)}%;top:${+layNum(f.y, 50, 0, 100).toFixed(2)}%;font-size:${+layNum(f.w, 12, 1, 80).toFixed(2)}cqw;transform:translate(-50%,-50%) rotate(${Number(f.r) || 0}deg);${f.c && layColorOk(f.c) ? `color:${f.c};` : ''}${layFontFamily(f.f) ? `font-family:${layFontFamily(f.f)};` : ''}`;
      return `<div class="be-lay-float be-lay-float-${f.k === 'text' ? 'text' : 'sym'}"${ed ? ` data-fid="${f.id}"` : ''} style="${css}">${escapeHtml(f.txt || '✦')}</div>`;
    }).join('');
    return `<div class="be-lay${ed ? ' be-lay-edit' : ''}" style="${rootStyle}"><div class="be-lay-doc"${ed ? ' contenteditable="true" spellcheck="false"' : ''}>${body || (ed ? '<div class="be-lp be-lp-body" data-ps="body" data-s="{}"><br></div>' : '')}</div><div class="be-lay-clear"></div>${data.wmText ? `<div class="be-watermark be-lay-wm">${escapeHtml(data.wmText)}</div>` : ''}${floats}</div>`;
  }
  // 图片是异步从 IndexedDB 读出来的：读好后让正在显示的卡片 / 编辑器重画一次
  let _layImgT = 0;
  function layRerenderAfterImage() {
    clearTimeout(_layImgT);
    _layImgT = setTimeout(() => {
      if (mainDoc.getElementById('be-lay-mask')?.classList.contains('open')) layRenderPage(true);
      else if (mainDoc.getElementById('be-card')) renderCard(lastText);
    }, 30);
  }
  // 模板用到的所有图片（删除时判断有没有别处还在用）
  function layImageRefs(tpl) {
    const out = [];
    if (!tpl) return out;
    if (tpl.page && tpl.page.bgImg) out.push(tpl.page.bgImg);
    (tpl.doc || []).forEach(a => ['src', 'orig', 'srcA', 'srcB', 'shd'].forEach(k => { if (a && a[k]) out.push(a[k]); }));
    (tpl.blocks || []).forEach(b => { if (b && b.t === 'image') { if (b.src) out.push(b.src); if (b.orig) out.push(b.orig); } });
    return out;
  }
  function deleteLayoutTemplate(id) {
    const t = (settings.layoutTemplates || []).find(x => x.id === id);
    if (!t) return;
    settings.layoutTemplates = settings.layoutTemplates.filter(x => x.id !== id);
    const keep = new Set(); settings.layoutTemplates.forEach(x => layImageRefs(x).forEach(r => keep.add(r)));
    layImageRefs(t).forEach(r => { if (!keep.has(r)) imgForget(r); });
    const key = 'layout-' + id;
    if (settings.template === key) settings.template = 'classic';
    settings.templateFavorites = (settings.templateFavorites || []).filter(k => k !== key);
    settings.hiddenTemplates = (settings.hiddenTemplates || []).filter(k => k !== key);
    saveSettings(settings);
    if (mainDoc.getElementById('be-card')) renderCard(lastText);
  }
  // ----- 导出 / 导入模板文件：图片一起打包成 dataURL -----
  async function exportLayoutTemplate(tpl) {
    if (!tpl) return;
    tpl = layEnsureV2(tpl);
    const images = {};
    for (const ref of [...new Set(layImageRefs(tpl))]) {
      try {
        const rec = await imgGet(imgRefKey(ref));
        if (!rec || !rec.data) continue;
        const u8 = new Uint8Array(rec.data);
        let bin = '';
        for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        images[ref] = `data:${rec.type || 'image/png'};base64,${mainWin.btoa(bin)}`;
      } catch (e) {}
    }
    const payload = { type: 'book-excerpt-layout', version: 2, name: tpl.name, page: tpl.page, doc: tpl.doc, floats: tpl.floats || [], images };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json;charset=utf-8' });
    const dlName = '书摘排版_' + String(tpl.name || '未命名').replace(/[\\/:*?"<>|]/g, '_') + '.json';
    triggerDownload(blob, dlName);
    toast('已导出 ' + dlName, 'success');
  }
  function isLayoutPayload(j) { return !!j && typeof j === 'object' && j.type === 'book-excerpt-layout' && (Array.isArray(j.doc) || Array.isArray(j.blocks)); }
  async function importLayoutPayload(j) {
    const map = {};
    for (const [ref, url] of Object.entries(j.images || {})) {
      try { map[ref] = await dataUrlToIdb(url, 'slot'); } catch (e) {}
    }
    const fix = (r) => (r && map[r]) ? map[r] : (r && String(r).startsWith('idb:') ? '' : r || '');
    const src = layEnsureV2({ v: Array.isArray(j.doc) ? 2 : 1, page: j.page, doc: j.doc, blocks: j.blocks });
    const tpl = {
      id: layNewId('l'), name: String(j.name || '导入的排版').slice(0, 30), v: 2,
      page: { ...(src.page || {}) },
      doc: (src.doc || []).filter(b => b && typeof b === 'object' && b.t).map(b => {
        const n = { ...b };
        if (n.t === 'p') { n.html = layCleanInline(n.html); if (!LAY_PS[n.ps]) n.ps = 'body'; if (n.slot && !LAY_SLOTS[n.slot]) delete n.slot; }
        else {
          n.id = layNewId('a');
          ['src', 'orig', 'shd'].forEach(k => { if (n[k]) n[k] = fix(n[k]); });
          if (n.t === 'img' && !n.orig) n.orig = n.src;
        }
        return n;
      }),
      floats: (Array.isArray(j.floats) ? j.floats : []).filter(f => f && typeof f === 'object').map(f => ({ ...f, id: layNewId('f') }))
    };
    // 同组的分割图导入后换成新的组号
    const gmap = {};
    tpl.doc.forEach(n => { if (n.grp) n.grp = gmap[n.grp] || (gmap[n.grp] = layNewId('g')); });
    tpl.page.bgImg = fix(tpl.page.bgImg);
    settings.layoutTemplates = (settings.layoutTemplates || []).concat(tpl);
    saveSettings(settings);
    return tpl;
  }

  // ===== 编辑器 =====
  const lay = { draft: null, isNew: false, fromModal: false, sel: null, tok: null, slotEl: null, sheet: '', presetRow: '', preview: '', undo: [], redo: [], dirty: false, range: null, caret: null, typing: false, typingT: 0, sliding: false, composing: false };
  const LAY_ATOM_NAMES = { img: '图片', vt: '竖排文字', hr: '分隔线', sp: '留白' };
  function layRoot() { return mainDoc.querySelector('#be-lay-pagewrap .be-lay-doc'); }
  function layParas() { const r = layRoot(); return r ? Array.from(r.querySelectorAll('.be-lp')) : []; }
  function layParaOf(node) {
    const r = layRoot();
    if (!r || !node) return null;
    const el = node.nodeType === 1 ? node : node.parentElement;
    const p = el && el.closest('.be-lp');
    return p && r.contains(p) ? p : null;
  }
  function layTopOf(node) {
    const r = layRoot();
    let n = node && (node.nodeType === 1 ? node : node.parentNode);
    while (n && n.parentNode && n.parentNode !== r) n = n.parentNode;
    return n && n.parentNode === r ? n : null;
  }
  function layHostOf(p) { return (p && p.closest('[contenteditable="true"]')) || layRoot(); }
  function layIsEmptyPara(p) { return !!p && !(p.textContent || '').replace(/​/g, '') && !p.querySelector('[data-tok], img'); }
  function layPlainText(html) { const d = mainDoc.createElement('div'); d.innerHTML = html || ''; return (d.textContent || '').trim(); }
  function layParaState(p) {
    let s = {};
    try { s = JSON.parse(p.getAttribute('data-s') || '{}') || {}; } catch (e) {}
    const ps = LAY_PS[p.getAttribute('data-ps')] ? p.getAttribute('data-ps') : 'body';
    return { ps, s };
  }
  function layReadPara(el) {
    const { ps, s } = layParaState(el);
    const slot = LAY_SLOTS[el.getAttribute('data-slot')] ? el.getAttribute('data-slot') : '';
    return { t: 'p', ps, s, html: layCleanInline(el.innerHTML), ...(slot ? { slot } : {}) };
  }
  function laySetPara(el, ps, s) {
    el.setAttribute('data-ps', ps);
    el.setAttribute('data-s', JSON.stringify(s || {}));
    LAY_PS_KEYS_CLS.forEach(k => el.classList.toggle('be-lp-' + k, k === ps));
    el.setAttribute('style', layParaCss(ps, s));
  }
  const LAY_PS_KEYS_CLS = Object.keys(LAY_PS);
  function layMakePara(ps, s, html, slot) {
    const d = mainDoc.createElement('div');
    d.className = 'be-lp';
    if (slot) { d.setAttribute('data-slot', slot); d.setAttribute('data-ph', LAY_SAMPLE[slot]); }
    laySetPara(d, ps, s || {});
    d.innerHTML = html || '<br>';
    return d;
  }

  // ----- 光标位置：按「第几个段落 + 段内第几个字」记，重画页面后能放回原处 -----
  // 段内计数：文字每字算 1（零宽空格不算，重画后它们的位置会变），换行 <br> 算 1，行内占位整体算 1。
  // 换行必须计数：否则「上一行末尾」和「下一行开头」、两个换行之间的空行都会算成同一个位置，光标放回去就跑到别的行
  const layZw = s => s.replace(/​/g, '').length;
  function layIsTokEl(n) { return n.nodeType === 1 && (n.classList.contains('be-lay-tok') || n.hasAttribute('data-tok')); }
  function layOffsetIn(p, node, off) {
    let pos = 0;
    const visit = (par) => {
      const kids = par.childNodes;
      for (let i = 0; i < kids.length; i++) {
        if (par === node && i === off) return true;
        const n = kids[i];
        if (n.nodeType === 3) {
          if (n === node) { pos += layZw(n.nodeValue.slice(0, off)); return true; }
          pos += layZw(n.nodeValue);
        } else if (n.nodeType === 1) {
          if (n.nodeName === 'BR') pos += 1;
          else if (layIsTokEl(n)) { pos += 1; if (n === node || n.contains(node)) return true; }
          else if (visit(n)) return true;
        }
      }
      return par === node;
    };
    visit(p);
    return pos;
  }
  function layParaLen(p) { return layOffsetIn(p, null, 0); }
  function layPointAt(p, off) {
    let pos = 0, res = null;
    const visit = (par) => {
      const kids = par.childNodes;
      for (let i = 0; i < kids.length; i++) {
        const n = kids[i];
        if (n.nodeType === 3) {
          const v = n.nodeValue, L = layZw(v);
          if (L > 0 && off <= pos + L) {
            let need = off - pos, idx = 0;
            while (idx < v.length && need > 0) { if (v[idx] !== '​') need--; idx++; }
            res = { node: n, off: idx };
            return true;
          }
          pos += L;
        } else if (n.nodeType === 1) {
          if (n.nodeName === 'BR' || layIsTokEl(n)) {
            if (off === pos) { res = { node: par, off: i }; return true; }
            pos += 1;
          } else if (visit(n)) return true;
        }
      }
      return false;
    };
    if (visit(p)) return res;
    const last = p.lastChild;
    return { node: p, off: last && last.nodeName === 'BR' ? p.childNodes.length - 1 : p.childNodes.length };
  }
  function layGetCaret() {
    const sel = mainWin.getSelection();
    if (!sel || !sel.rangeCount) return null;
    return layCaretOf(sel.getRangeAt(0));
  }
  function layCaretOf(r) {
    if (!r) return null;
    const a = layParaOf(r.startContainer), b = layParaOf(r.endContainer);
    if (!a || !b) return null;
    const ps = layParas();
    return { sb: ps.indexOf(a), so: layOffsetIn(a, r.startContainer, r.startOffset), eb: ps.indexOf(b), eo: layOffsetIn(b, r.endContainer, r.endOffset) };
  }
  function laySetCaret(c, focus) {
    if (!c) return null;
    const ps = layParas();
    const a = ps[c.sb], b = ps[c.eb];
    if (!a || !b) return null;
    const p1 = layPointAt(a, c.so), p2 = layPointAt(b, c.eo);
    const r = mainDoc.createRange();
    try { r.setStart(p1.node, p1.off); r.setEnd(p2.node, p2.off); } catch (e) { return null; }
    lay.range = r.cloneRange();
    lay.caret = c;
    // 只有文字区本来就有焦点（正在输入）时才把光标放回页面：Chrome 里往可编辑区放光标会顺带让它获得焦点，
    // 手机上就会弹出键盘（点图片菜单、改图片设置时不该弹）
    const ae = mainDoc.activeElement;
    const typing = ae && ae.closest && ae.closest('.be-lay-doc');
    if (focus) { try { layHostOf(a).focus({ preventScroll: true }); } catch (e) {} }
    if (focus || typing) { const sel = mainWin.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
    return r;
  }
  // 当前文字选区：优先用页面上实时的；点了底部面板后焦点不在页面里，就用最后一次记下的
  function layCurRange() {
    const sel = mainWin.getSelection();
    if (sel && sel.rangeCount) {
      const r = sel.getRangeAt(0);
      if (layParaOf(r.startContainer) && layParaOf(r.endContainer)) return r;
    }
    const r = lay.range;
    if (r && r.startContainer.isConnected && layParaOf(r.startContainer) && layParaOf(r.endContainer)) return r;
    const c = lay.caret;
    if (c) {
      const ps = layParas();
      const a = ps[c.sb], b = ps[c.eb];
      if (a && b) {
        const p1 = layPointAt(a, c.so), p2 = layPointAt(b, c.eo);
        try { const nr = mainDoc.createRange(); nr.setStart(p1.node, p1.off); nr.setEnd(p2.node, p2.off); lay.range = nr; return nr; } catch (e) {}
      }
    }
    return null;
  }
  function layParasInRange(r) {
    const a = layParaOf(r.startContainer), b = layParaOf(r.endContainer);
    if (!a) return [];
    if (a === b || !b) return [a];
    return layParas().filter(p => { try { return r.intersectsNode(p); } catch (e) { return false; } });
  }

  // ----- 页面 DOM ↔ 文档数据 -----
  function layReadDom() {
    const root = layRoot();
    if (!root || !lay.draft || root._layId !== lay.draft.id) return;
    const old = new Map((lay.draft.doc || []).filter(b => b.t !== 'p').map(b => [b.id, b]));
    const used = new Set();
    const out = [];
    Array.from(root.childNodes).forEach(n => {
      if (n.nodeType === 3) {
        const t = n.nodeValue.replace(/​/g, '');
        if (t.trim()) out.push({ t: 'p', ps: 'body', s: {}, html: escapeHtml(t) });
        return;
      }
      if (n.nodeType !== 1) return;
      if (n.classList.contains('be-la')) {
        let a = old.get(n.getAttribute('data-aid'));
        if (!a) return;
        if (used.has(a)) { a = JSON.parse(JSON.stringify(a)); a.id = layNewId('a'); n.setAttribute('data-aid', a.id); }
        used.add(a);
        out.push(a);
        return;
      }
      const p = layReadPara(n);
      // 占位段落里还是默认示例文字就存成空
      if (p.slot && layPlainText(p.html) === LAY_SAMPLE[p.slot]) p.html = '';
      out.push(p);
    });
    lay.draft.doc = out;
  }
  // 输入后整理页面根节点：直接打在根上的字、浏览器新建的无样式 div 都收进段落；末尾保证有一个段落可以继续打字
  function layNormalizeRoot() {
    const root = layRoot();
    if (!root || lay.composing) return;
    const sel = mainWin.getSelection();
    const an = sel && sel.rangeCount ? sel.anchorNode : null, ao = sel && sel.rangeCount ? sel.anchorOffset : 0;
    let moved = false;
    Array.from(root.childNodes).forEach(n => {
      if (n.nodeType === 3) {
        if (!n.nodeValue.length) { n.remove(); return; }
        const d = layMakePara('body', {}, '');
        d.innerHTML = '';
        n.replaceWith(d); d.appendChild(n); moved = true;
        return;
      }
      if (n.nodeType !== 1) { n.remove(); return; }
      if (n.classList.contains('be-la') || n.classList.contains('be-lp')) return;
      if (/^(DIV|P|H[1-6]|BLOCKQUOTE|LI)$/.test(n.tagName)) {
        const d = layMakePara('body', {}, '');
        d.innerHTML = '';
        while (n.firstChild) d.appendChild(n.firstChild);
        if (!d.firstChild) d.innerHTML = '<br>';
        n.replaceWith(d); moved = true;
      } else {
        const d = layMakePara('body', {}, '');
        d.innerHTML = '';
        n.replaceWith(d); d.appendChild(n); moved = true;
      }
    });
    const last = root.lastElementChild;
    if (!last || last.classList.contains('be-la')) root.appendChild(layMakePara('body', {}, ''));
    if (moved && an && an.isConnected) { try { const r = mainDoc.createRange(); r.setStart(an, Math.min(ao, an.nodeType === 3 ? an.nodeValue.length : an.childNodes.length)); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); } catch (e) {} }
  }

  function layUpdatePh(p) {
    if (p && p.hasAttribute('data-slot')) p.classList.toggle('be-lp-ph', layIsEmptyPara(p));
  }
  // 占位段落的小标签：放在页面外层（不在卡片里，不会被导出），点击弹菜单
  function layPlaceSlotTags() {
    const wrap = mainDoc.getElementById('be-lay-pagewrap');
    const root = layRoot();
    if (!wrap) return;
    wrap.querySelectorAll('.be-lay-slottag').forEach(n => n.remove());
    if (!root) return;
    const wr = wrap.getBoundingClientRect();
    root.querySelectorAll('.be-lp[data-slot], .be-la[data-vslot]').forEach(el => {
      const slot = el.getAttribute('data-slot') || el.getAttribute('data-vslot');
      const r = el.getBoundingClientRect();
      const t = mainDoc.createElement('button');
      t.type = 'button';
      t.className = 'be-lay-slottag';
      t.textContent = LAY_SLOTS[slot] || '';
      t.title = (LAY_SLOTS[slot] || '') + '占位（导出时替换）';
      t.style.left = Math.max(2, r.left - wr.left) + 'px';
      t.style.top = Math.max(0, r.top - wr.top - 16) + 'px';
      t._target = el;
      wrap.appendChild(t);
    });
  }

  // ----- 撤销 / 重做：快照 = 文档数据 + 光标位置 -----
  function laySnap() { layReadDom(); return JSON.stringify({ d: lay.draft, c: layGetCaret() }); }
  function layPushUndo(snap) {
    lay.undo.push(snap || laySnap());
    if (lay.undo.length > 80) lay.undo.shift();
    lay.redo = [];
    lay.dirty = true;
    laySyncUndoBtns();
  }
  function layEndTyping() { lay.typing = false; clearTimeout(lay.typingT); }
  function layUndoRedo(back) {
    const from = back ? lay.undo : lay.redo, to = back ? lay.redo : lay.undo;
    if (!from.length) return;
    layEndTyping();
    to.push(laySnap());
    const sn = JSON.parse(from.pop());
    // 页面上现在的内容不能再读回来（会盖掉要恢复的版本）
    const root = layRoot(); if (root) root._layId = null;
    lay.draft = sn.d;
    lay.sel = null; lay.tok = null;
    lay.dirty = true;
    layCloseMenu();
    layRenderPage(false);
    if (sn.c) laySetCaret(sn.c, false);
    layRenderSheet();
    laySyncUndoBtns();
  }
  function laySyncUndoBtns() {
    const m = mainDoc.getElementById('be-lay-mask');
    if (!m) return;
    m.querySelector('[data-a="undo"]')?.toggleAttribute('disabled', !lay.undo.length);
    m.querySelector('[data-a="redo"]')?.toggleAttribute('disabled', !lay.redo.length);
  }
  function layFindAtom(id) { return (lay.draft.doc || []).find(b => b.t !== 'p' && b.id === id) || null; }
  function layFindFloat(id) { return (lay.draft.floats || []).find(f => f.id === id) || null; }
  function layFindSel() {
    if (!lay.sel) return null;
    return lay.sel.k === 'f' ? layFindFloat(lay.sel.id) : layFindAtom(lay.sel.id);
  }

  function openLayoutEditor(id, opts = {}) {
    const tpl = id ? layGetTemplate('layout-' + id) : null;
    lay.draft = tpl ? JSON.parse(JSON.stringify(tpl)) : layDefaultDraft(opts.name, opts.fromModal ? lastText : '');
    lay.isNew = !tpl;
    lay.fromModal = !!opts.fromModal;
    lay.sel = null; lay.tok = null; lay.slotEl = null; lay.sheet = ''; lay.presetRow = ''; lay.preview = ''; lay.undo = []; lay.redo = []; lay.dirty = !tpl; lay.range = null; lay.caret = null;
    lay.sample = opts.fromModal ? String(lastText || '').trim().slice(0, 300) : '';
    layEndTyping();
    let mask = mainDoc.getElementById('be-lay-mask');
    if (mask && isStaleGen(mask)) { try { mask.remove(); } catch (e) {} mask = null; }
    if (!mask) {
      mask = stampGen(mainDoc.createElement('div'));
      mask.id = 'be-lay-mask';
      mask.innerHTML = `
        <div class="be-lay-top">
          <button type="button" class="be-lay-tbtn" data-a="back" title="保存并返回"><i class="fa-solid fa-chevron-left"></i></button>
          <button type="button" class="be-lay-name" data-a="rename" title="重命名"></button>
          <button type="button" class="be-lay-tbtn" data-a="more" title="更多"><i class="fa-solid fa-ellipsis"></i></button>
        </div>
        <div class="be-lay-stage" id="be-lay-stage"><div class="be-lay-pagewrap" id="be-lay-pagewrap"></div><div class="be-lay-tip">点击文字直接编辑 · 点击图片等元素打开菜单 · 选中元素后拖动 <i class="fa-solid fa-grip-lines"></i> 调整位置</div></div>
        <div class="be-lay-menu" id="be-lay-menu" hidden></div>
        <div class="be-lay-sheet" id="be-lay-sheet" hidden></div>
        <div class="be-lay-bar">
          <button type="button" class="be-lay-done" data-a="done">完成</button>
          <button type="button" data-a="insert"><b>＋</b><small>插入</small></button>
          <button type="button" data-a="text"><b>Aa</b><small>文字</small></button>
          <button type="button" data-a="page"><b><i class="fa-regular fa-file"></i></b><small>页面</small></button>
          <button type="button" data-a="undo" title="撤销"><b><i class="fa-solid fa-rotate-left"></i></b><small>撤销</small></button>
          <button type="button" data-a="redo" title="重做"><b><i class="fa-solid fa-rotate-right"></i></b><small>重做</small></button>
        </div>`;
      mainDoc.body.appendChild(mask);
      layBindMask(mask);
    } else if (mask.parentNode !== mainDoc.body || mask.nextSibling) {
      mainDoc.body.appendChild(mask);
    }
    detectAndApplyTheme();
    mask.classList.add('open');
    layWatchViewport(true);
    layRenderTop();
    layRenderPage(false);
    layRenderSheet();
    laySyncUndoBtns();
    mask.querySelector('#be-lay-stage').scrollTop = 0;
    if (lay.isNew) layOpenStarter();
    (lay.draft.doc || []).filter(a => a.t === 'img' && a.needBake).forEach(a => { delete a.needBake; layApplyImage(a); });
  }
  // 起手模板：每个都用真实渲染缩小显示
  function layOpenStarter() {
    const mask = mainDoc.getElementById('be-lay-mask');
    if (!mask) return;
    mask.querySelector('.be-lay-starter')?.remove();
    const box = mainDoc.createElement('div');
    box.className = 'be-lay-starter';
    const smp = lay.sample ? escapeHtml(lay.sample).replace(/\n+/g, '<br>') : '';
    // 预览按卡片设定宽度排版，再按格子宽度整体缩小；底色、字色用书摘弹窗当前的配色，看起来和真实卡片一致
    const w = Number(settings.cardWidth) > 0 ? Number(settings.cardWidth) : 420;
    const pvText = lay.sample || PREVIEW_SAMPLE_TEXT;
    const cc = resolveColors();
    const data = { edit: false, preview: true, pageW: w, quoteHtml: escapeHtml(pvText).replace(/\n+/g, '<br>'), quotePlain: pvText, thoughtHtml: escapeHtml(LAY_SAMPLE.thought), charName: '角色名', userName: '用户名', authorName: '作者', bookName: '书名', chapter: '章名' };
    box.innerHTML = `<div class="be-lay-starter-box"><div class="be-lay-starter-h">选择起始版式</div><div class="be-lay-starter-grid">${LAY_STARTERS.map(st => {
      const t = st.make(smp);
      return `<button type="button" class="be-lay-starter-item" data-st="${st.k}"><span class="be-lay-starter-pv"><span class="be-card tpl-layout" style="width:${w}px;background:${cc.bg};color:${cc.fg}">${renderLayoutInner({ v: 2, page: t.page, doc: t.doc, floats: [] }, data)}</span></span><span class="be-lay-starter-name">${escapeHtml(st.name)}</span></button>`;
    }).join('')}</div></div>`;
    mask.appendChild(box);
    box.querySelectorAll('.be-lay-starter-pv').forEach(pv => {
      const card = pv.firstElementChild;
      const k = pv.clientWidth / w;
      card.style.transform = `scale(${k})`;
      pv.style.height = Math.round(Math.min(card.offsetHeight, w * 1.5) * k) + 'px';
    });
    box.addEventListener('click', e => {
      if (e.target === box) { box.remove(); return; }   // 点空白处：保留默认版式
      const b = e.target.closest('[data-st]');
      if (!b) return;
      const st = LAY_STARTERS.find(x => x.k === b.getAttribute('data-st'));
      const t = st.make(smp);
      lay.draft.page = t.page;
      lay.draft.doc = t.doc;
      const root = layRoot(); if (root) root._layId = null;
      box.remove();
      layRenderPage(false);
      lay.undo = []; lay.redo = []; laySyncUndoBtns();
    });
  }
  // 手机键盘弹出时可视区域变矮：编辑器跟着可视区域走，底部按钮条不被键盘挡住
  function layWatchViewport(on) {
    const vv = mainWin.visualViewport;
    const mask = mainDoc.getElementById('be-lay-mask');
    if (!vv) return;
    if (mainWin.__beLayVV) { vv.removeEventListener('resize', mainWin.__beLayVV); vv.removeEventListener('scroll', mainWin.__beLayVV); mainWin.__beLayVV = null; }
    if (mask) { mask.style.height = ''; mask.style.top = ''; }
    if (!on) return;
    mainWin.__beLayVV = () => {
      const m = mainDoc.getElementById('be-lay-mask');
      if (!m || !m.classList.contains('open')) return;
      if (Math.abs(vv.height - mainWin.innerHeight) < 2 && !vv.offsetTop) { m.style.height = ''; m.style.top = ''; }
      else { m.style.height = vv.height + 'px'; m.style.top = vv.offsetTop + 'px'; }
      layPlaceMenu();
    };
    vv.addEventListener('resize', mainWin.__beLayVV);
    vv.addEventListener('scroll', mainWin.__beLayVV);
  }
  function layRenderTop() {
    const b = mainDoc.querySelector('#be-lay-mask .be-lay-name');
    if (b) b.textContent = lay.draft.name || '我的排版';
  }
  function layPageWidth() {
    const stage = mainDoc.getElementById('be-lay-stage');
    const avail = Math.max(240, ((stage && stage.clientWidth) || mainWin.innerWidth) - 24);
    const cw = Number(settings.cardWidth);
    return Math.round(isFinite(cw) && cw > 0 ? Math.min(cw, avail) : Math.min(420, avail));
  }
  function layRenderPage(keepCaret) {
    const wrap = mainDoc.getElementById('be-lay-pagewrap');
    if (!wrap || !lay.draft) return;
    const root0 = layRoot();
    let caret = null;
    // 重画前文字区有焦点（正在打字）：重画后把焦点和光标还回去，否则旧节点被替换后焦点丢失，接着打的字没地方去、手机键盘也会收起
    const ae0 = mainDoc.activeElement;
    const hadFocus = !!(root0 && ae0 && ae0.closest && ae0.closest('.be-lay-doc'));
    if (root0 && root0._layId === lay.draft.id) {
      if (keepCaret) caret = layGetCaret();
      layReadDom();
    }
    const w = layPageWidth();
    const pv = layPreset(lay.preview);
    const built = buildCardMarkup(LAY_SAMPLE.excerpt, { tplKey: 'layout-' + lay.draft.id, layoutDraft: lay.draft, layEdit: true, layPageW: w, layPreview: pv ? { bg: pv.bg, fg: pv.fg } : null, noId: true });
    wrap.innerHTML = built.html;
    wrap.style.width = w + 'px';
    const card = wrap.querySelector('.be-card');
    if (card) {
      const qSize = Number(settings.quoteFontSize);
      if (isFinite(qSize) && qSize > 0) card.style.setProperty('--be-quote-size', qSize + 'px');
    }
    const root = layRoot();
    if (root) root._layId = lay.draft.id;
    laySyncSelection();
    shieldCardFonts(card);
    if (caret) laySetCaret(caret, hadFocus);
    layPlaceSlotTags();
  }
  function laySyncSelection() {
    const wrap = mainDoc.getElementById('be-lay-pagewrap');
    if (!wrap) return;
    wrap.querySelectorAll('.be-lay-sel').forEach(n => n.classList.remove('be-lay-sel'));
    wrap.querySelectorAll('.be-lay-grip, .be-lay-rot, .be-lay-rh').forEach(n => n.remove());
    if (!lay.sel || !layFindSel()) { lay.sel = null; return; }
    const el = lay.sel.k === 'f' ? wrap.querySelector(`[data-fid="${lay.sel.id}"]`) : wrap.querySelector(`.be-la[data-aid="${lay.sel.id}"]`);
    if (!el) return;
    el.classList.add('be-lay-sel');
    const h = mainDoc.createElement('span');
    h.setAttribute('contenteditable', 'false');
    if (lay.sel.k === 'f') { h.className = 'be-lay-rot'; h.title = '拖动缩放 / 旋转'; h.innerHTML = '<i class="fa-solid fa-up-right-and-down-left-from-center"></i>'; }
    else { h.className = 'be-lay-grip'; h.title = '按住拖动调整位置'; h.innerHTML = '<i class="fa-solid fa-grip-lines"></i>'; }
    el.appendChild(h);
    if (lay.sel.k === 'a' && el.classList.contains('be-lay-imgw')) {
      ['nw', 'ne', 'sw', 'se'].forEach(c => {
        const r = mainDoc.createElement('span');
        r.className = 'be-lay-rh be-lay-rh-' + c;
        r.setAttribute('data-rh', c);
        r.setAttribute('contenteditable', 'false');
        el.appendChild(r);
      });
    }
  }
  function laySelect(sel, showMenu = true) {
    lay.sel = sel; lay.tok = null;
    laySyncSelection();
    if (showMenu && sel) layOpenMenu(); else layCloseMenu();
    if (lay.sheet === 'text') layRenderSheet();
  }

  // ----- 上下文菜单（点元素 / 贴纸 / 行内占位后弹在旁边） -----
  function layMenuItems(it, isFloat) {
    const tail = [['dup', '复制'], ['del', '删除']];
    if (isFloat) return [['edit', it.k === 'text' ? '修改文字' : '更换符号'], ['style', '颜色 / 字体']].concat(tail);
    if (it.t === 'img') return [['replace', '替换图片'], ['crop', '裁剪'], ['layout', '布局', 1], ['mask', '遮罩', 1], ['frame', '相框', 1], ['border', '边框', 1], ['shadow', '阴影', 1], ['filter', '滤镜', 1], ['reset', '还原图片']].concat(tail);
    if (it.t === 'vt') return [['vslot', '内容', 1], ['vtext', it.slot ? '修改示例文字' : '编辑文字'], ['vh', '列高', 1], ['style', '文字样式']].concat(tail);
    if (it.t === 'hr') return [['divk', '样式', 1]].concat(tail);
    if (it.t === 'sp') return [['spaceh', '高度', 1]].concat(tail);
    return tail;
  }
  function layOpenMenu(sub) {
    const menu = mainDoc.getElementById('be-lay-menu');
    if (!menu) return;
    if (lay.tok) {
      const tk = lay.tok.getAttribute('data-tok');
      if (!sub) {
        menu.innerHTML = `<div class="be-lay-mhead">${escapeHtml(LAY_TOKENS[tk] || '')} · 导出时替换</div>` +
          (tk === 'date' ? '<button type="button" data-m="datefmt">日期格式<span>›</span></button>' : '') +
          '<button type="button" data-m="del" class="danger">删除</button>';
        menu._sub = null;
      } else layFillSubMenu(menu, sub);
      menu.hidden = false;
      layPlaceMenu();
      return;
    }
    if (lay.slotEl) {
      const slot = lay.slotEl.getAttribute('data-slot') || lay.slotEl.getAttribute('data-vslot');
      const isPara = lay.slotEl.classList.contains('be-lp');
      menu.innerHTML = `<div class="be-lay-mhead">${escapeHtml(LAY_SLOTS[slot] || '')}占位 · 导出时替换</div>` +
        (isPara ? '<button type="button" data-m="slotstyle">文字样式</button><button type="button" data-m="slotplain">转为普通段落</button>' : '') +
        '<button type="button" data-m="slotdel" class="danger">删除</button>';
      menu._sub = null;
      menu.hidden = false;
      layPlaceMenu();
      return;
    }
    const it = layFindSel();
    if (!it) return layCloseMenu();
    const isFloat = lay.sel.k === 'f';
    if (!sub) {
      const label = isFloat ? (it.k === 'text' ? '浮动文字' : '贴纸') : (it.t === 'vt' && it.slot ? `竖排${LAY_SLOTS[it.slot]}占位` : (LAY_ATOM_NAMES[it.t] || ''));
      menu.innerHTML = `<div class="be-lay-mhead">${escapeHtml(label)}</div>` + layMenuItems(it, isFloat).map(([k, name, more]) =>
        `<button type="button" data-m="${k}" class="${k === 'del' ? 'danger' : ''}">${name}${more ? '<span>›</span>' : ''}</button>`).join('');
      menu._sub = null;
    } else layFillSubMenu(menu, sub);
    menu.hidden = false;
    layPlaceMenu();
  }
  function layFillSubMenu(menu, sub) {
    const head = `<button type="button" class="be-lay-mback" data-m="back">‹ ${escapeHtml(sub.title)}</button>`;
    if (sub.slider) {
      const s = sub.slider;
      menu.innerHTML = head + `<div class="be-lay-slider"><input type="range" min="${s.min}" max="${s.max}" step="${s.step || 1}" value="${s.val}"><input type="number" min="${s.min}" max="${s.max}" step="${s.step || 1}" value="${s.val}"><span>${escapeHtml(s.unit || '')}</span></div>`;
    } else {
      menu.innerHTML = head + `<div class="be-lay-opts${sub.grid ? ' be-lay-opts-grid' : ''}">${sub.opts.map(o =>
        `<button type="button" data-o="${escapeHtml(String(o.v))}" class="${o.on ? 'on' : ''}">${o.icon ? `<i class="be-lay-oic">${o.icon}</i>` : ''}<span>${o.name}</span></button>`).join('')}</div>`;
    }
    menu._sub = sub;
  }
  function layPlaceMenu() {
    const menu = mainDoc.getElementById('be-lay-menu');
    const mask = mainDoc.getElementById('be-lay-mask');
    if (!menu || menu.hidden || !mask) return;
    const el = lay.tok && lay.tok.isConnected ? lay.tok : (lay.slotEl && lay.slotEl.isConnected ? lay.slotEl : mask.querySelector('.be-lay-sel'));
    if (!el) return;
    const r = el.getBoundingClientRect(), mr = mask.getBoundingClientRect();
    const w = menu.offsetWidth, h = menu.offsetHeight;
    const bar = mask.querySelector('.be-lay-bar').getBoundingClientRect().top - mr.top;
    const sheet = mask.querySelector('#be-lay-sheet');
    const bottomLimit = (sheet && !sheet.hidden) ? sheet.getBoundingClientRect().top - mr.top : bar;
    let left = r.right - mr.left - w;
    left = Math.max(8, Math.min(left, mr.width - w - 8));
    let top = r.bottom - mr.top + 8;
    if (top + h > bottomLimit - 8) top = r.top - mr.top - h - 8;
    if (top < 56) top = Math.max(56, Math.min(bottomLimit - h - 8, r.top - mr.top + 12));
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }
  function layCloseMenu() {
    const menu = mainDoc.getElementById('be-lay-menu');
    if (menu) { menu.hidden = true; menu._sub = null; }
    lay.tok = null;
    lay.slotEl = null;
  }
  // 遮罩 / 相框选项旁的小图示
  const LAY_MASK_ICONS = { none: '▭', round: '▢', circle: '◯', arch: '⌒', hex: '⬡', star: '☆', heart: '♡', scallop: '❀', torn: '≋' };
  const LAY_FRAME_ICONS = { none: '▭', polaroid: '▯', mat: '▣', vintage: '◫', corners: '◸', tape: '▬', stamp: '⧈' };
  function laySubMenu(key, it) {
    const o = (v, name, on, icon) => ({ v, name, on, icon });
    const slider = (title, min, max, val, unit, step) => ({ key, title, slider: { min, max, val, unit, step } });
    if (key === 'layout') return { key, title: '布局', opts: [o('full', '通栏', (it.lay || 'full') === 'full'), o('left', '靠左·文字绕排', it.lay === 'left'), o('right', '靠右·文字绕排', it.lay === 'right'), o('center', '居中', it.lay === 'center')] };
    if (key === 'border') return { key, title: '边框', opts: [o('0', '无', !it.bw), o('4,#ffffff', '细白边', it.bw === 4 && it.bc === '#ffffff'), o('10,#ffffff', '宽白边', it.bw === 10 && it.bc === '#ffffff'), o('3,#1f1f1f', '细黑边', it.bw === 3 && it.bc === '#1f1f1f'), o('pick', '自选颜色…', false)] };
    if (key === 'mask') return { key, title: '遮罩', grid: true, opts: Object.entries(LAY_MASKS).map(([k, n]) => o(k, n, (it.mask || 'none') === k, LAY_MASK_ICONS[k])) };
    if (key === 'frame') return { key, title: '相框', grid: true, opts: Object.entries(LAY_FRAMES).map(([k, n]) => o(k, n, (it.frame || 'none') === k, LAY_FRAME_ICONS[k])) };
    if (key === 'shadow') return { key, title: '阴影', opts: [o('0', '无', !(Number(it.sh) > 0)), o('1', '轻', Number(it.sh) === 1), o('2', '中', Number(it.sh) === 2)] };
    if (key === 'filter') return { key, title: '滤镜', opts: [o('none', '原图', !it.filter || it.filter === 'none'), o('gray', '黑白', it.filter === 'gray'), o('vintage', '复古', it.filter === 'vintage'), o('contrast', '高对比', it.filter === 'contrast'), o('fade', '淡雅', it.filter === 'fade')] };
    if (key === 'vslot') return { key, title: '内容', opts: [o('', '自定文字', !it.slot), o('excerpt', '摘录（导出时替换）', it.slot === 'excerpt'), o('thought', '想法（导出时替换）', it.slot === 'thought')] };
    if (key === 'vh') return slider('列高', 60, 600, Math.round(layNum(it.vh, 240, 60, 900)), 'px');
    if (key === 'divk') return { key, title: '分隔样式', opts: Object.entries(LAY_DIVIDERS).map(([k, n]) => o(k, n, (it.k || 'dots') === k)) };
    if (key === 'spaceh') return slider('留白高度', 4, 200, Math.round(layNum(it.h, 24, 4, 400)), 'px');
    if (key === 'datefmt') { const f = (lay.tok && lay.tok.getAttribute('data-fmt')) || 'num'; return { key, title: '日期格式', opts: [o('num', formatDate(), f === 'num'), o('cn', toChineseDate(new Date()), f === 'cn'), o('en', layDateText('en'), f === 'en')] }; }
    return null;
  }
  async function layMenuAction(m) {
    if (lay.tok) {
      const tk = lay.tok;
      if (m === 'del') { layPushUndo(); tk.remove(); layCloseMenu(); return; }
      if (m === 'datefmt') layOpenMenu(laySubMenu('datefmt', null));
      return;
    }
    if (lay.slotEl) {
      const el = lay.slotEl;
      layCloseMenu();
      if (m === 'slotdel') {
        layPushUndo();
        if (el.classList.contains('be-la')) { const a = layFindAtom(el.getAttribute('data-aid')); if (a) lay.draft.doc = lay.draft.doc.filter(x => x !== a); el.remove(); }
        else el.remove();
        layNormalizeRoot(); layRenderPage(false); layRenderSheet();
        return;
      }
      if (m === 'slotplain') {
        layPushUndo();
        if (layIsEmptyPara(el)) el.innerHTML = '<br>';
        el.removeAttribute('data-slot'); el.removeAttribute('data-ph'); el.classList.remove('be-lp-ph');
        layRenderPage(false);
        return;
      }
      if (m === 'slotstyle') {
        try { layHostOf(el).focus({ preventScroll: true }); } catch (e) {}
        const r = mainDoc.createRange(); r.selectNodeContents(el); r.collapse(true);
        const sel = mainWin.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        lay.range = r.cloneRange();
        lay.sheet = 'text'; layRenderSheet();
      }
      return;
    }
    const it = layFindSel();
    if (!it) return;
    const isFloat = lay.sel.k === 'f';
    if (m === 'del') {
      layPushUndo();
      if (isFloat) lay.draft.floats = lay.draft.floats.filter(f => f !== it);
      else lay.draft.doc = lay.draft.doc.filter(b => b !== it);
      lay.sel = null; layCloseMenu(); layRenderPage(false); layRenderSheet(); return;
    }
    if (m === 'dup') {
      layPushUndo();
      const copy = JSON.parse(JSON.stringify(it)); copy.id = layNewId(isFloat ? 'f' : 'a');
      delete copy.grp; delete copy.part;
      const list = isFloat ? lay.draft.floats : lay.draft.doc;
      if (isFloat) { copy.x = Math.min(95, (Number(copy.x) || 50) + 6); copy.y = Math.min(95, (Number(copy.y) || 50) + 4); }
      list.splice(list.indexOf(it) + 1, 0, copy);
      lay.sel = { k: lay.sel.k, id: copy.id };
      layRenderPage(false); layOpenMenu(); return;
    }
    if (m === 'style') { layCloseMenu(); lay.sheet = 'text'; layRenderSheet(); laySyncSelection(); return; }
    if (m === 'edit') {
      layCloseMenu();
      if (it.k === 'text') {
        layAskText('修改文字', it.txt || '', v => { if (v == null) return; layPushUndo(); it.txt = v.trim() || it.txt; layRenderPage(true); });
        return;
      }
      lay.sheet = 'sticker'; layRenderSheet(); return;
    }
    if (m === 'vtext') {
      layCloseMenu();
      layAskText(it.slot ? '示例文字（仅编辑时显示）' : '竖排文字', it.text || '', v => { if (v == null) return; layPushUndo(); it.text = v.replace(/\r/g, ''); layRenderPage(true); laySelect({ k: 'a', id: it.id }, false); }, { multi: true });
      return;
    }
    if (m === 'replace') {
      layCloseMenu();
      layPickImage(async ref => { layPushUndo(); await layResetImage(it, ref); await layApplyImage(it); });
      return;
    }
    if (m === 'reset') {
      layCloseMenu(); layPushUndo();
      it.crop = null; it.filter = 'none'; it.mask = 'none'; it.frame = 'none'; it.sh = 0; it.bw = 0;
      await layApplyImage(it);
      return;
    }
    if (m === 'crop') { layCloseMenu(); layOpenCrop(it); return; }
    const sub = laySubMenu(m, it);
    if (sub) layOpenMenu(sub);
  }
  async function layMenuOption(v) {
    const menu = mainDoc.getElementById('be-lay-menu');
    const sub = menu && menu._sub;
    if (!sub) return;
    if (sub.key === 'datefmt' && lay.tok) {
      layPushUndo();
      lay.tok.setAttribute('data-fmt', v);
      lay.tok.textContent = layTokenLabel('date', v);
      layOpenMenu(laySubMenu('datefmt', null));
      return;
    }
    const it = layFindSel();
    if (!it) return;
    if (sub.key === 'border' && v === 'pick') {
      layPickColor(it.bc || '#ffffff', menu, c => { it.bc = c; if (!it.bw) it.bw = 6; layApplyImage(it); });
      return;
    }
    layPushUndo();
    let img = false;
    if (sub.key === 'layout') { it.lay = v; if (v !== 'full' && !it.wp) it.wp = v === 'center' ? 60 : 42; }
    else if (sub.key === 'border') { const [w, c] = String(v).split(','); it.bw = Number(w) || 0; if (c) it.bc = c; img = true; }
    else if (sub.key === 'mask') { it.mask = v; img = true; }
    else if (sub.key === 'frame') { it.frame = v; img = true; }
    else if (sub.key === 'shadow') { it.sh = Number(v) || 0; img = true; }
    else if (sub.key === 'filter') { it.filter = v; img = true; }
    else if (sub.key === 'vslot') { if (v) it.slot = v; else delete it.slot; }
    else if (sub.key === 'divk') it.k = v;
    // 菜单先换到新选项，图片在后台处理，处理完自动刷新
    menu.querySelectorAll('[data-o]').forEach(b => b.classList.toggle('on', b.getAttribute('data-o') === String(v)));
    if (img) { layApplyImage(it); return; }
    layRenderPage(true);
    if (sub.key === 'vslot') layOpenMenu();
    else layOpenMenu(laySubMenu(sub.key, it));
  }
  function layMenuSlide(v, final) {
    const menu = mainDoc.getElementById('be-lay-menu');
    const sub = menu && menu._sub;
    const it = layFindSel();
    if (!sub || !sub.slider || !it) return;
    const n = Math.max(sub.slider.min, Math.min(sub.slider.max, Number(v)));
    if (!isFinite(n)) return;
    if (!lay.sliding) { layPushUndo(); lay.sliding = true; }
    menu.querySelectorAll('.be-lay-slider input').forEach(inp => { if (Number(inp.value) !== n) inp.value = n; });
    if (sub.key === 'vh') it.vh = n;
    else if (sub.key === 'spaceh') it.h = n;
    layRenderPage(true);
    layPlaceMenu();
    if (final) lay.sliding = false;
  }

  // ----- 小输入框（不用 window.prompt，手机上会被吞） -----
  function layAskText(title, value, cb, opts = {}) {
    const mask = mainDoc.getElementById('be-lay-mask');
    const box = mainDoc.createElement('div');
    box.className = 'be-lay-ask';
    box.innerHTML = `<div class="be-lay-askbox"><div class="be-lay-asktitle">${escapeHtml(title)}</div>${opts.multi ? '<textarea rows="6"></textarea>' : '<input type="text" maxlength="60">'}<div class="be-lay-askacts"><button type="button" class="be-btn" data-r="0">取消</button><button type="button" class="be-btn primary" data-r="1">确定</button></div></div>`;
    mask.appendChild(box);
    const inp = box.querySelector('input, textarea');
    inp.value = value;
    setTimeout(() => { try { inp.focus(); if (!opts.multi) inp.select(); } catch (e) {} }, 0);
    const done = (ok) => { box.remove(); cb(ok ? inp.value : null); };
    box.addEventListener('click', e => { if (e.target === box) done(false); const b = e.target.closest('[data-r]'); if (b) done(b.getAttribute('data-r') === '1'); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !opts.multi) done(true); else if (e.key === 'Escape') done(false); });
  }

  // ----- 文字：回车分段、粘贴、行内样式 -----
  // 光标在占位段落的哪一头：'before'（开头，且段落有内容）/ 'after'（末尾，或段落是空的）/ ''（中间）
  function laySlotEdge(block, r) {
    if (layIsEmptyPara(block)) return 'after';
    const off = layOffsetIn(block, r.startContainer, r.startOffset);
    if (off === 0) return 'before';
    const rest = mainDoc.createRange();
    try { rest.setStart(r.endContainer, r.endOffset); rest.setEnd(block, block.childNodes.length); } catch (e) { return ''; }
    return rest.toString().replace(/​/g, '') ? '' : 'after';
  }
  function layInsertParagraph() {
    const sel = mainWin.getSelection();
    if (!sel || !sel.rangeCount) return;
    const r = sel.getRangeAt(0);
    const block = layParaOf(r.startContainer);
    if (!block) return;
    // 摘录 / 想法占位是单个段落：在开头回车，上方新建普通段落；在末尾回车，下方新建普通段落（光标进新段落）；在中间回车只换行
    if (block.hasAttribute('data-slot')) {
      const where = laySlotEdge(block, r);
      if (!where) { mainDoc.execCommand('insertLineBreak'); return; }
      const nb = layMakePara('body', {}, '');
      const top = block.parentNode === layRoot() ? block : layTopOf(block);
      if (where === 'before') top.before(nb); else top.after(nb);
      const nr = mainDoc.createRange();
      if (where === 'before') { const pt = layPointAt(block, 0); nr.setStart(pt.node, pt.off); } else nr.setStart(nb, 0);
      nr.collapse(true);
      sel.removeAllRanges(); sel.addRange(nr);
      lay.range = nr.cloneRange();
      lay.dirty = true;
      layPlaceSlotTags();
      try { nb.scrollIntoView({ block: 'nearest' }); } catch (e) {}
      return;
    }
    if (!r.collapsed) r.deleteContents();
    const after = mainDoc.createRange();
    after.setStart(r.startContainer, r.startOffset);
    after.setEnd(block, block.childNodes.length);
    const frag = after.extractContents();
    const { ps, s } = layParaState(block);
    const heading = /^h[123]$/.test(ps);
    const nb = layMakePara(heading ? 'body' : ps, heading ? {} : s, '');
    nb.innerHTML = '';
    nb.appendChild(frag);
    if (layIsEmptyPara(nb)) nb.innerHTML = '<br>';
    if (layIsEmptyPara(block)) block.innerHTML = '<br>';
    const top = block.parentNode === layRoot() ? block : layTopOf(block);
    top.after(nb);
    const nr = mainDoc.createRange();
    const first = nb.firstChild;
    if (first && first.nodeType === 3) nr.setStart(first, 0); else nr.setStart(nb, 0);
    nr.collapse(true);
    sel.removeAllRanges(); sel.addRange(nr);
    lay.range = nr.cloneRange();
    lay.dirty = true;
    try { nb.scrollIntoView({ block: 'nearest' }); } catch (e) {}
  }
  function layPasteText(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    lines.forEach((ln, i) => {
      if (i) layInsertParagraph();
      if (ln) mainDoc.execCommand('insertText', false, ln);
    });
  }
  // 选中的几个字包一层 span（颜色 / 字号 / 字体）；跨段落时每段各包各的
  function layWrapInline(r, paras, attrs) {
    paras.forEach(p => {
      const sub = mainDoc.createRange();
      try {
        if (p.contains(r.startContainer)) sub.setStart(r.startContainer, r.startOffset); else sub.setStart(p, 0);
        if (p.contains(r.endContainer)) sub.setEnd(r.endContainer, r.endOffset); else sub.setEnd(p, p.childNodes.length);
      } catch (e) { return; }
      if (sub.collapsed) return;
      // 选区正好是某个已有样式 span 的全部内容：把整个 span 包进来，样式合并到它身上，不再套一层
      for (let guard = 0; guard < 8; guard++) {
        const sc = sub.startContainer;
        const sp = sc.nodeType === 3 ? sc.parentElement : sc;
        if (!sp || sp === p || sp.tagName !== 'SPAN' || sp.hasAttribute('data-tok') || !sp.contains(sub.endContainer)) break;
        if (sub.toString() !== sp.textContent) break;
        sub.setStartBefore(sp); sub.setEndAfter(sp);
      }
      const frag = sub.extractContents();
      const one = frag.childNodes.length === 1 && frag.firstChild.nodeType === 1 && frag.firstChild.tagName === 'SPAN' && !frag.firstChild.hasAttribute('data-tok') ? frag.firstChild : null;
      frag.querySelectorAll('span:not([data-tok])').forEach(sp => { if (sp === one) return; Object.keys(attrs).forEach(k => sp.removeAttribute('data-' + k)); laySpanStyle(sp); });
      frag.querySelectorAll('span:not([data-tok])').forEach(sp => {
        if (sp !== one && !sp.getAttribute('data-c') && !sp.getAttribute('data-z') && !sp.getAttribute('data-f')) sp.replaceWith(...sp.childNodes);
      });
      const span = one || mainDoc.createElement('span');
      Object.entries(attrs).forEach(([k, val]) => { if (val) span.setAttribute('data-' + k, String(val)); else span.removeAttribute('data-' + k); });
      laySpanStyle(span);
      if (one) {
        if (!span.getAttribute('data-c') && !span.getAttribute('data-z') && !span.getAttribute('data-f')) { const kids = mainDoc.createDocumentFragment(); while (span.firstChild) kids.appendChild(span.firstChild); sub.insertNode(kids); }
        else sub.insertNode(span);
      } else if (span.attributes.length) { span.appendChild(frag); sub.insertNode(span); }
      else sub.insertNode(frag);
      p.normalize();
    });
  }
  // 行内占位：插在光标处；有选中文字就替换掉选中的字；光标在摘录 / 想法占位里或没有光标时，另起一段放进去
  function layInsertToken(tok) {
    let r = layCurRange();
    let p = r && layParaOf(r.startContainer);
    if (!p || p.hasAttribute('data-slot')) {
      const np = layMakePara('body', {}, '');
      np.innerHTML = '';
      const root = layRoot();
      const after = p || (lay.sel && lay.sel.k === 'a' ? root.querySelector(`.be-la[data-aid="${lay.sel.id}"]`) : null);
      // 占位段落的内容导出时整段换成摘录 / 想法，行内占位放不进去：光标在开头就插在它上方，否则插在下方
      const edge = p ? laySlotEdge(p, r) : 'after';
      if (p && !edge) toast(`${LAY_SLOTS[p.getAttribute('data-slot')] || '占位'}段落导出时整段替换，已插在它的下一段`, 'info');
      layPushUndo();
      if (after && edge === 'before') layTopOf(after).before(np);
      else if (after) layTopOf(after).after(np); else root.appendChild(np);
      p = np;
      r = mainDoc.createRange(); r.setStart(np, 0); r.collapse(true);
    } else layPushUndo();
    try { layHostOf(p).focus({ preventScroll: true }); } catch (e) {}
    const sel = mainWin.getSelection();
    sel.removeAllRanges(); sel.addRange(r);
    r.deleteContents();
    if (p.childNodes.length === 1 && p.firstChild.nodeName === 'BR') p.innerHTML = '';
    const sp = mainDoc.createElement('span');
    sp.setAttribute('data-tok', tok);
    if (tok === 'date') sp.setAttribute('data-fmt', 'num');
    sp.className = 'be-lay-tok';
    sp.setAttribute('contenteditable', 'false');
    sp.textContent = layTokenLabel(tok, 'num');
    r.insertNode(sp);
    // 占位前后各留一个文字节点：段首的占位前面才能放光标、打字
    if (!sp.previousSibling || sp.previousSibling.nodeType !== 3) sp.before(mainDoc.createTextNode('​'));
    const z = mainDoc.createTextNode('​');
    sp.after(z);
    const nr = mainDoc.createRange(); nr.setStart(z, 1); nr.collapse(true);
    sel.removeAllRanges(); sel.addRange(nr);
    lay.range = nr.cloneRange();
    lay.dirty = true;
  }

  // ----- 底部面板：插入 / 文字 / 页面 / 贴纸 -----
  function layOpenSheet(name) {
    lay.sheet = (lay.sheet === name) ? '' : name;
    lay.presetRow = '';
    if (lay.sheet === 'text') {
      // 手机上收起键盘把位置让给文字面板；选区已记在 lay.range
      const ae = mainDoc.activeElement;
      const coarse = (() => { try { return mainWin.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();
      if (coarse && ae && ae.closest && ae.closest('.be-lay-doc')) { const r = layCurRange(); try { ae.blur(); } catch (e) {} if (r) lay.range = r.cloneRange(); }
    }
    layRenderSheet();
    layPlaceMenu();
  }
  function layTextTarget() {
    if (lay.sel && lay.sel.k === 'f') { const f = layFindFloat(lay.sel.id); return f ? { float: f } : null; }
    if (lay.sel && lay.sel.k === 'a') { const a = layFindAtom(lay.sel.id); return a && a.t === 'vt' ? { atom: a } : null; }
    const r = layCurRange();
    const p = r && layParaOf(r.startContainer);
    return p ? { range: r, para: p } : null;
  }
  function layRenderSheet() {
    const mask = mainDoc.getElementById('be-lay-mask');
    const sh = mask && mask.querySelector('#be-lay-sheet');
    if (!sh) return;
    mask.querySelectorAll('.be-lay-bar [data-a]').forEach(b => b.classList.toggle('on', b.getAttribute('data-a') === lay.sheet));
    if (!lay.sheet) { sh.hidden = true; sh.innerHTML = ''; return; }
    // 重画前记下各行的横向滚动位置，避免每次点选后行又滚回开头
    const keepScroll = Array.from(sh.querySelectorAll('.be-lay-row')).map(r => r.scrollLeft);
    sh.hidden = false;
    const chip = (attr, v, label, on, style = '') => `<button type="button" class="be-lay-cell ${on ? 'on' : ''}" ${attr}="${escapeHtml(String(v))}" ${style ? `style="${style}"` : ''}>${label}</button>`;
    const fontRow = (attr, cur) => `<div class="be-lay-row">${chip(attr, '', '跟随卡片', !cur)}${Object.entries(FONTS).filter(([k]) => k !== 'follow_theme').map(([k, v]) => chip(attr, k, escapeHtml(v.name), cur === k, `font-family:${String(v.css).replace(/"/g, "'")}`)).join('')}${(settings.customFonts || []).map(x => chip(attr, 'custom-' + x.id, escapeHtml(x.name || '未命名'), cur === 'custom-' + x.id, `font-family:${escapeHtml(String(x.fontFamily || 'inherit').replace(/"/g, "'"))}`)).join('')}</div>`;
    if (lay.sheet === 'insert') {
      const item = (k, ic, name, auto) => `<button type="button" class="be-lay-ins ${auto ? 'auto' : ''}" data-ins="${k}"><b>${ic}</b>${name}</button>`;
      sh.innerHTML = `<div class="be-lay-shead">元素</div>
        <div class="be-lay-insgrid">
          ${item('image', '<i class="fa-regular fa-image"></i>', '图片')}${item('splith', '⊟', '分割图·上下')}${item('splitv', '◫', '分割图·左右')}${item('vt', '⫼', '竖排文字')}
          ${item('divider', '✦', '分隔线')}${item('spacer', '⬚', '留白')}${item('sticker', '❀', '贴纸')}${item('ftext', 't', '浮动文字')}
        </div>
        <div class="be-lay-shead">段落占位</div>
        <div class="be-lay-insgrid">${item('excerpt', '❝', '摘录', 1)}${item('thought', '✎', '想法', 1)}</div>
        <div class="be-lay-shead">行内占位${(() => { const r = layCurRange(); return r && !r.collapsed ? '（替换选中的文字）' : ''; })()}</div>
        <div class="be-lay-insgrid">${Object.entries(LAY_TOKENS).map(([k, n]) => item('tok-' + k, '{ }', n, 1)).join('')}</div>
        <div class="be-lay-shint">标色项为内容占位，导出时替换为当次书摘的对应内容。元素和段落占位插在光标所在段落之后；行内占位插在光标处，有选中文字时替换选中的文字。</div>`;
      return;
    }
    if (lay.sheet === 'sticker') {
      const f = lay.sel && lay.sel.k === 'f' ? layFindFloat(lay.sel.id) : null;
      sh.innerHTML = `<div class="be-lay-shead">贴纸${f && f.k !== 'text' ? '（替换选中的贴纸）' : ''}</div><div class="be-lay-stkgrid">${LAY_STICKERS.map(s => `<button type="button" data-stk="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}</div>`;
      return;
    }
    if (lay.sheet === 'page') {
      const p = lay.draft.page || {};
      const followBg = !p.bg && !p.bgImg;
      const pv = layPreset(lay.preview);
      // 和书摘弹窗底部「颜色」一栏同样的配色块；点了只换编辑时的预览，不存进模板
      const presetRow = () => `<div class="be-lay-row be-lay-prev-row"><button type="button" class="be-lay-pchip be-lay-pchip-cur ${!lay.preview ? 'on' : ''}" data-prev="" title="书摘弹窗当前配色">当前</button>${layPresetList().map(x =>
        `<button type="button" class="be-lay-pchip ${lay.preview === x.k ? 'on' : ''}" data-prev="${escapeHtml(x.k)}" title="${escapeHtml(x.name)}" style="background:${escapeHtml(x.bg)};color:${escapeHtml(x.fg)}">A</button>`).join('')}</div>
        <div class="be-lay-shint">只用于编辑时预览。模板使用时跟随书摘弹窗选择的配色。</div>`;
      const slider = (k, label, min, max, val) => `<div class="be-lay-prow"><span>${label}</span><div class="be-lay-slider be-lay-slider-inline"><input type="range" data-pk="${k}" min="${min}" max="${max}" step="1" value="${val}"><input type="number" data-pk="${k}" min="${min}" max="${max}" step="1" value="${val}"><span>px</span></div></div>`;
      sh.innerHTML = `<div class="be-lay-shead">页面</div>
        <div class="be-lay-prow"><span>背景</span><div class="be-lay-seg">
          <button type="button" data-pbg="follow" class="${followBg ? 'on' : ''}">跟随配色${followBg && pv ? '·预览' + escapeHtml(pv.name) : ''}</button>
          <button type="button" data-pbg="color" class="${p.bg && !p.bgImg ? 'on' : ''}">纯色${p.bg ? `<i class="be-lay-sw" style="background:${escapeHtml(p.bg)}"></i>` : ''}</button>
          <button type="button" data-pbg="image" class="${p.bgImg ? 'on' : ''}">图片</button>
        </div></div>
        ${lay.presetRow === 'bg' ? presetRow() : ''}
        ${p.bgImg ? `<div class="be-lay-prow"><span>背景图</span><div class="be-lay-seg">${[['cover', '铺满'], ['tile', '平铺']].map(([v, n]) => `<button type="button" data-pfit="${v}" class="${(p.bgFit === 'tile' ? 'tile' : 'cover') === v ? 'on' : ''}">${n}</button>`).join('')}</div></div>` : ''}
        <div class="be-lay-prow"><span>文字颜色</span><div class="be-lay-seg"><button type="button" data-pfg="follow" class="${!p.fg ? 'on' : ''}">跟随配色${!p.fg && pv ? '·预览' + escapeHtml(pv.name) : ''}</button><button type="button" data-pfg="pick" class="${p.fg ? 'on' : ''}">自选${p.fg ? `<i class="be-lay-sw" style="background:${escapeHtml(p.fg)}"></i>` : ''}</button></div></div>
        ${lay.presetRow === 'fg' ? presetRow() : ''}
        ${slider('pad', '页边距', 0, 64, layNum(p.pad, 28, 0, 80))}
        ${slider('gap', '段间距', 0, 40, layNum(p.gap, 14, 0, 60))}
        <div class="be-lay-shint">宽度取「书摘卡片 → 宽度」设置，高度随内容。</div>`;
      layBindSheetScroll(sh, keepScroll);
      return;
    }
    // 文字面板
    const tg = layTextTarget();
    if (!tg) { sh.innerHTML = `<div class="be-lay-shead">文字</div><div class="be-lay-empty">将光标放在文字中，或选中文字、竖排文字后再设置样式。</div>`; return; }
    if (tg.float) {
      const f = tg.float;
      const sizes = [6, 9, 12, 16, 22, 30];
      sh.innerHTML = `<div class="be-lay-shead">${f.k === 'text' ? '浮动文字' : '贴纸'}</div>
        ${fontRow('data-ff', f.f)}
        <div class="be-lay-row">${layColorCells(f.c, 'data-fc')}</div>
        <div class="be-lay-row">${sizes.map(z => chip('data-fz', z, z <= 6 ? '很小' : z <= 9 ? '小' : z <= 12 ? '中' : z <= 16 ? '大' : z <= 22 ? '很大' : '特大', Math.round(f.w || 12) === z)).join('')}</div>
        <div class="be-lay-shint">拖动右下角圆点可缩放和旋转。</div>`;
      layBindSheetScroll(sh, keepScroll);
      return;
    }
    let ps, s, vertical = false, allowVt = false, isAtom = !!tg.atom;
    if (tg.atom) {
      const a = tg.atom;
      vertical = true;
      ps = LAY_PS[a.ps] ? a.ps : 'body';
      s = a.s || {};
    } else {
      ({ ps, s } = layParaState(tg.para));
      allowVt = !tg.para.hasAttribute('data-slot');
    }
    const pr = LAY_PS[ps] || LAY_PS.body;
    const curSize = Number(s.z) > 0 ? Number(s.z) : 0;
    const psRow = vertical ? '' : `<div class="be-lay-row">${Object.entries(LAY_PS).map(([k, v]) => chip('data-tp', k, v.name, ps === k)).join('')}${allowVt ? chip('data-tp', 'vt', '竖排', false) : ''}</div>`;
    const bold = vertical ? !!s.b : layParaBold(ps, s);
    sh.innerHTML = `
      ${psRow}
      ${fontRow('data-tf', s.f)}
      <div class="be-lay-row">${layColorCells(s.c, 'data-tc')}</div>
      <div class="be-lay-row">${chip('data-tz', 0, vertical ? '默认 18' : (ps === 'body' ? '默认（跟正文字号）' : `默认 ${pr.size}`), !curSize)}${LAY_SIZES.map(z => chip('data-tz', z, z, curSize === z)).join('')}</div>
      <div class="be-lay-fmt">
        <button type="button" data-tb="b" class="${bold ? 'on' : ''}"><b>B</b></button>
        ${vertical ? '' : `<button type="button" data-tb="i" class="${s.i ? 'on' : ''}"><i>I</i></button>
        <button type="button" data-tb="u" class="${s.u ? 'on' : ''}"><u>U</u></button>
        <button type="button" data-tb="k" class="${s.k ? 'on' : ''}"><s>S</s></button>`}
        <span class="be-lay-fsep"></span>
        ${(vertical ? [['right', 'align-right'], ['center', 'align-center'], ['left', 'align-left']] : [['left', 'align-left'], ['center', 'align-center'], ['right', 'align-right'], ['justify', 'align-justify']]).map(([a, ic]) => `<button type="button" data-ta="${a}" class="${(s.a || (vertical ? 'right' : 'left')) === a ? 'on' : ''}"><i class="fa-solid fa-${ic}"></i></button>`).join('')}
        <button type="button" data-tl="1" title="行距">${vertical ? '列距' : '行距'} ${Number(s.lh) > 0 ? s.lh : (vertical ? 1.8 : pr.lh)}</button>
      </div>
      <div class="be-lay-shint">${isAtom ? '作用于整段竖排文字。列从右往左排；对齐指整段靠右、居中或靠左。' : '有选中文字时只作用于选中部分，没有选中时作用于整段。'}</div>`;
    layBindSheetScroll(sh, keepScroll);
  }
  function layColorCells(cur, attr) {
    const cols = layTextColors();
    const custom = cur && !cols.some(c => c.toLowerCase() === String(cur).toLowerCase());
    return `<button type="button" class="be-lay-cell ${!cur ? 'on' : ''}" ${attr}="">跟随</button>` +
      `<button type="button" class="be-lay-cell be-lay-cell-sw ${custom ? 'on' : ''}" ${attr}="pick" title="取色器" aria-label="取色器"><i class="be-lay-dot be-lay-dot-pick">${custom ? `<i style="background:${escapeHtml(cur)}"></i>` : ''}</i></button>` +
      cols.map(c => `<button type="button" class="be-lay-cell be-lay-cell-sw ${cur && cur.toLowerCase() === c.toLowerCase() ? 'on' : ''}" ${attr}="${c}"><i class="be-lay-dot" style="background:${c}"></i></button>`).join('');
  }
  function layBindSheetScroll(sh, keep) {
    sh.querySelectorAll('.be-lay-row').forEach((r, i) => {
      try { enableHScroll(r); } catch (e) {}
      if (keep && keep[i]) r.scrollLeft = keep[i];
    });
  }
  function layPickColor(cur, anchor, apply) {
    const inp = mainDoc.createElement('input'); inp.type = 'color'; inp.value = layColorOk(cur) && cur.startsWith('#') ? cur : '#1f1f1f';
    layPushUndo();
    inp.addEventListener('input', () => apply(inp.value));
    inp.addEventListener('change', () => { apply(inp.value); layRenderSheet(); });
    openColorPicker(inp, { anchor });
  }
  // 文字面板按钮：浮动文字 / 竖排或分割图（整块）/ 段落（有选区只改选中的字，没选区改整段）
  function layApplyText(attr, v, btn) {
    const tg = layTextTarget();
    if (!tg) return;
    if (tg.float) {
      const f = tg.float;
      if (attr === 'data-fc' && v === 'pick') return layPickColor(f.c || '#1f1f1f', btn, c => { f.c = c; layRenderPage(true); });
      layPushUndo();
      if (attr === 'data-ff') f.f = v;
      else if (attr === 'data-fc') f.c = v;
      else if (attr === 'data-fz') f.w = Number(v);
      layRenderPage(true); layRenderSheet(); return;
    }
    if (tg.atom) {
      const a = tg.atom;
      a.s = a.s || {};
      if (attr === 'data-tc' && v === 'pick') return layPickColor(a.s.c || '#1f1f1f', btn, c => { a.s.c = c; layRenderPage(true); });
      layPushUndo();
      layEditStyle(a, attr, v, true);
      layRenderPage(true); layRenderSheet(); return;
    }
    const r = tg.range;
    if (attr === 'data-tc' && v === 'pick') {
      const keep = r.cloneRange();
      const cur = layParaState(tg.para).s.c || '#1f1f1f';
      const inp = mainDoc.createElement('input'); inp.type = 'color'; inp.value = layColorOk(cur) && cur.startsWith('#') ? cur : '#1f1f1f';
      inp.addEventListener('change', () => { lay.range = keep; layApplyText('data-tc', inp.value, btn); });
      openColorPicker(inp, { anchor: btn });
      return;
    }
    const paras = layParasInRange(r);
    if (!paras.length) return;
    if (attr === 'data-tp' && v === 'vt') return layToVertical(paras);
    const caret = layCaretOf(r);
    layPushUndo();
    if (attr === 'data-tb' && !r.collapsed) {
      const host = layHostOf(paras[0]);
      try { host.focus({ preventScroll: true }); } catch (e) {}
      laySetCaret(caret, false);
      try { mainDoc.execCommand('styleWithCSS', false, false); } catch (e) {}
      mainDoc.execCommand({ b: 'bold', i: 'italic', u: 'underline', k: 'strikeThrough' }[v], false, null);
    } else if (['data-tf', 'data-tc', 'data-tz'].includes(attr) && !r.collapsed) {
      layWrapInline(r, paras, { [{ 'data-tf': 'f', 'data-tc': 'c', 'data-tz': 'z' }[attr]]: Number(v) === 0 && attr === 'data-tz' ? '' : v });
    } else {
      paras.forEach(p => {
        const st = layParaState(p);
        const stt = { ps: st.ps, s: { ...st.s } };
        layEditStyle(stt, attr, v, false);
        laySetPara(p, stt.ps, stt.s);
      });
    }
    laySetCaret(caret, false);
    lay.dirty = true;
    layRenderSheet();
    shieldCardFonts(mainDoc.querySelector('#be-lay-pagewrap .be-card'));
  }
  // 改一份 {ps, s} 的样式（段落、竖排、分割图中间文字共用）
  function layEditStyle(o, attr, v, vertical) {
    o.s = o.s || {};
    const s = o.s;
    if (attr === 'data-tp') { o.ps = v; delete s.z; delete s.lh; delete s.b; }
    else if (attr === 'data-tf') { if (v) s.f = v; else delete s.f; }
    else if (attr === 'data-tc') { if (v) s.c = v; else delete s.c; }
    else if (attr === 'data-tz') { if (Number(v) > 0) s.z = Number(v); else delete s.z; }
    else if (attr === 'data-ta') s.a = v;
    else if (attr === 'data-tb') {
      if (v === 'b') s.b = vertical ? !s.b : !layParaBold(o.ps, s);
      else s[v] = !s[v];
    } else if (attr === 'data-tl') {
      const pr = LAY_PS[o.ps] || LAY_PS.body;
      const steps = vertical ? [1.3, 1.5, 1.8, 2.1, 2.5] : [1.3, 1.5, 1.7, 1.85, 2.1, 2.4];
      const cur = Number(s.lh) > 0 ? Number(s.lh) : (vertical ? 1.8 : pr.lh);
      s.lh = steps.find(x => x > cur + 0.01) || steps[0];
    }
  }
  // 段落转竖排：文字取纯文本（行内占位和行内样式不保留）
  function layToVertical(paras) {
    const list = paras.filter(p => !p.hasAttribute('data-slot') && p.parentNode === layRoot());
    if (!list.length) return;
    layPushUndo();
    let firstId = '';
    list.forEach(p => {
      const { s } = layParaState(p);
      const tmp = p.cloneNode(true);
      tmp.querySelectorAll('.be-lay-tok').forEach(t => t.remove());
      tmp.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
      const a = { t: 'vt', id: layNewId('a'), text: (tmp.textContent || '').replace(/​/g, '').trim(), s: { f: s.f, c: s.c, z: Number(s.z) > 0 ? s.z : 18 }, vh: 240 };
      lay.draft.doc.push(a);
      const ph = mainDoc.createElement('div'); ph.className = 'be-la'; ph.setAttribute('data-aid', a.id);
      p.replaceWith(ph);
      if (!firstId) firstId = a.id;
    });
    layReadDom();
    lay.sel = firstId ? { k: 'a', id: firstId } : null;
    layRenderPage(false);
    layRenderSheet();
  }

  // ----- 插入 -----
  // 插在光标所在段落（或选中元素）之后；光标在空段落里就替换掉这个空段落
  function layInsertNode(el) {
    const root = layRoot();
    if (!root) return;
    let ref = null, replace = false;
    if (lay.sel && lay.sel.k === 'a') ref = root.querySelector(`.be-la[data-aid="${lay.sel.id}"]`);
    if (!ref) {
      const r = layCurRange();
      if (r) {
        const top = layTopOf(r.startContainer);
        if (top) { ref = top; replace = top.classList.contains('be-lp') && !top.hasAttribute('data-slot') && layIsEmptyPara(top); }
      }
    }
    if (ref && replace) ref.replaceWith(el);
    else if (ref) ref.after(el);
    else {
      const last = root.lastElementChild;
      if (last && last.classList.contains('be-lp') && layIsEmptyPara(last) && !last.hasAttribute('data-slot')) last.before(el);
      else root.appendChild(el);
    }
  }
  function layInsertAtom(a) {
    lay.draft.doc.push(a);
    const ph = mainDoc.createElement('div'); ph.className = 'be-la'; ph.setAttribute('data-aid', a.id);
    layInsertNode(ph);
    layNormalizeRoot();   // 插在最后时，后面补一个空段落可以继续打字
    layReadDom();
    lay.sel = { k: 'a', id: a.id };
    lay.sheet = '';
    layRenderPage(false);
    layRenderSheet();
    layOpenMenu();
    layScrollTo(a.id);
  }
  function layInsert(kind) {
    if (kind.startsWith('tok-')) { layInsertToken(kind.slice(4)); return; }
    if (kind === 'sticker') { lay.sel = null; laySyncSelection(); layOpenSheet('sticker'); return; }
    if (kind === 'ftext') { layAddFloat({ k: 'text', txt: '文字', w: 5 }); return; }
    if (kind === 'image') {
      layPickImage(async ref => {
        layPushUndo();
        const a = { t: 'img', id: layNewId('a'), lay: 'full', sh: 0, filter: 'none', mask: 'none', frame: 'none' };
        await layResetImage(a, ref);
        layInsertAtom(a);
      });
      return;
    }
    if (kind === 'splith' || kind === 'splitv') {
      // 分割图：一张图切成两张独立图片，中间是普通段落；两张图记住来自同一张原图（书摘弹窗里换图时一起换）
      layPickImage(async ref => {
        layPushUndo();
        const v = kind === 'splitv', grp = layNewId('g');
        const mk = (part) => ({ t: 'img', id: layNewId('a'), lay: v ? (part === 'a' ? 'left' : 'right') : 'full', wp: v ? 36 : undefined, sh: 0, filter: 'none', mask: 'none', frame: 'none', grp, part,
          crop: v ? { x: part === 'a' ? 0 : 0.5, y: 0, w: 0.5, h: 1 } : { x: 0, y: part === 'a' ? 0 : 0.5, w: 1, h: 0.5 } });
        const A = mk('a'), B = mk('b');
        await layResetImage(A, ref, true); await layResetImage(B, ref, true);
        lay.draft.doc.push(A, B);
        const ph = (x) => { const d = mainDoc.createElement('div'); d.className = 'be-la'; d.setAttribute('data-aid', x.id); return d; };
        const mid = layMakePara('body', { a: 'center' }, '');
        const nA = ph(A), nB = ph(B);
        layInsertNode(nA);
        if (v) { nA.after(nB); nB.after(mid); } else { nA.after(mid); mid.after(nB); }
        layReadDom();
        lay.sel = null; lay.sheet = '';
        layRenderPage(false);
        layRenderSheet();
        layApplyImage(A); layApplyImage(B);
        const m = layRoot()?.querySelector(`.be-la[data-aid="${(v ? B : A).id}"]`)?.nextElementSibling;
        if (m && m.classList.contains('be-lp')) { try { m.focus(); const r = mainDoc.createRange(); r.selectNodeContents(m); r.collapse(true); const sl = mainWin.getSelection(); sl.removeAllRanges(); sl.addRange(r); lay.range = r.cloneRange(); } catch (e) {} }
      });
      return;
    }
    layPushUndo();
    if (kind === 'vt') {
      const a = { t: 'vt', id: layNewId('a'), text: '', s: { z: 18 }, vh: 240 };
      layInsertAtom(a);
      layCloseMenu();
      layAskText('竖排文字', '', v => { if (v == null) return; a.text = v.replace(/\r/g, ''); layRenderPage(true); layOpenMenu(); }, { multi: true });
      return;
    }
    if (kind === 'divider') { layInsertAtom({ t: 'hr', id: layNewId('a'), k: 'dots' }); return; }
    if (kind === 'spacer') { layInsertAtom({ t: 'sp', id: layNewId('a'), h: 24 }); return; }
    let p = null;
    if (kind === 'excerpt') p = layMakePara('body', {}, '', 'excerpt');
    else if (kind === 'thought') p = layMakePara('small', {}, '', 'thought');
    else if (kind === 'source') p = layMakePara('small', {}, '—— ' + layInlineRender('<span data-tok="author"></span> <span data-tok="book"></span>', {}, true).html);
    if (!p) return;
    layUpdatePh(p);
    layInsertNode(p);
    layReadDom();
    lay.sel = null; lay.sheet = '';
    layRenderPage(false);
    layRenderSheet();
  }
  function layScrollTo(id) {
    const el = mainDoc.querySelector(`#be-lay-pagewrap [data-aid="${id}"], #be-lay-pagewrap [data-fid="${id}"]`);
    try { el && el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
  }
  // 新贴纸放在当前看得到的那一截页面的中间
  function layAddFloat(f) {
    const stage = mainDoc.getElementById('be-lay-stage');
    const page = mainDoc.querySelector('#be-lay-pagewrap .be-lay');
    let y = 50;
    if (stage && page) {
      const pr = page.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      const mid = (Math.max(pr.top, sr.top) + Math.min(pr.bottom, sr.bottom)) / 2;
      y = Math.max(4, Math.min(96, (mid - pr.top) / pr.height * 100));
    }
    layPushUndo();
    const nf = { id: layNewId('f'), k: f.k, txt: f.txt, x: 50, y: +y.toFixed(2), w: f.w || 12, r: 0, c: '' };
    lay.draft.floats = lay.draft.floats || [];
    lay.draft.floats.push(nf);
    lay.sel = { k: 'f', id: nf.id };
    lay.sheet = '';
    layRenderPage(true); layRenderSheet(); layOpenMenu();
  }

  // ----- 图片：读取、后台处理（裁剪 / 滤镜 / 遮罩 / 相框 / 阴影） -----
  function layPickImage(cb) {
    const input = mainDoc.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      try { await cb(await saveImageFile(f, 'slot')); }
      catch (e) { toast('图片读取失败：' + (e?.message || e), 'error'); }
    });
    input.click();
  }
  async function layResetImage(a, ref, keepCrop) {
    a.orig = ref; a.src = ref;
    if (!keepCrop) a.crop = null;
    delete a.shd; delete a.shdBox; a.baked = false;
    const sz = await layImgSize(ref);
    a.ar = sz && sz.h ? +(sz.w / sz.h).toFixed(4) : 0.75;
    if (layNeedBake(a) || Number(a.sh) > 0) a.ar = a.crop && sz ? +((a.crop.w * sz.w) / (a.crop.h * sz.h)).toFixed(4) : a.ar;
  }
  const _laySeq = new Map();
  // 后台处理图片；同一张图连续改设置时只应用最后一次的结果；处理中图片上显示加载状态
  async function layApplyImage(a) {
    const seq = (_laySeq.get(a.id) || 0) + 1;
    _laySeq.set(a.id, seq);
    const busy = (on) => { const el = mainDoc.querySelector(`#be-lay-pagewrap .be-la[data-aid="${a.id}"]`); if (el) el.classList.toggle('be-lay-busy', on); };
    busy(true);
    const dispW = layPageWidth() * ((a.lay || 'full') === 'full' ? 1 : layNum(a.wp, 42, 10, 100) / 100);
    let r = null;
    try { r = await layProcessImage(a, dispW); } catch (e) { console.warn('[BookExcerpt] layProcessImage failed:', e); }
    if (_laySeq.get(a.id) !== seq) return;
    busy(false);
    if (!r) { toast('图片处理失败，请重试', 'warning'); return; }
    a.src = r.src; a.ar = r.ar; a.baked = !!r.baked;
    if (r.shd) { a.shd = r.shd; a.shdBox = r.shdBox; } else { delete a.shd; delete a.shdBox; }
    lay.dirty = true;
    if (lay.draft && layFindAtom(a.id) === a) { layRenderPage(true); layPlaceMenu(); }
  }
  // 图片只在没有别的模板 / 草稿 / 撤销记录引用时才删
  function layForgetImageIfUnused(ref) {
    if (!ref || !String(ref).startsWith('idb:')) return;
    const used = new Set();
    (settings.layoutTemplates || []).forEach(t => layImageRefs(t).forEach(r => used.add(r)));
    if (lay.draft) layImageRefs(lay.draft).forEach(r => used.add(r));
    lay.undo.concat(lay.redo).forEach(sn => { try { layImageRefs(JSON.parse(sn).d).forEach(r => used.add(r)); } catch (e) {} });
    for (const v of _layBakeCache.values()) { if (v.src) used.add(v.src); if (v.shd) used.add(v.shd); }
    if (!used.has(ref)) imgForget(ref);
  }

  // ----- 裁剪 -----
  async function layOpenCrop(a) {
    const orig = a.orig || a.src;
    const sz = await layImgSize(orig);
    if (!sz) { toast('图片尚未读取完成，请稍后重试', 'warning'); return; }
    const mask = mainDoc.getElementById('be-lay-mask');
    const box = stampGen(mainDoc.createElement('div'));
    box.id = 'be-lay-crop';
    box.innerHTML = `<div class="be-lay-crop-stage"><div class="be-lay-crop-img"><img alt=""><div class="be-lay-crop-rect"><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div></div>
      <div class="be-lay-crop-ar">${[['free', '自由'], ['1', '1:1'], ['0.75', '3:4'], ['1.3333', '4:3'], ['1.7778', '16:9'], ['0.5625', '9:16']].map(([v, n]) => `<button type="button" data-ar="${v}" class="${v === 'free' ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="be-lay-crop-acts"><button type="button" class="be-btn" data-c="cancel">取消</button><button type="button" class="be-btn" data-c="full">还原</button><button type="button" class="be-btn primary" data-c="ok">确定</button></div>`;
    mask.appendChild(box);
    const img = box.querySelector('img'), wrapEl = box.querySelector('.be-lay-crop-img'), rect = box.querySelector('.be-lay-crop-rect');
    img.src = imgUrlSync(orig);
    const stage = box.querySelector('.be-lay-crop-stage');
    const maxW = stage.clientWidth - 48, maxH = stage.clientHeight - 48;
    const k = Math.min(maxW / sz.w, maxH / sz.h);
    const W = Math.round(sz.w * k), H = Math.round(sz.h * k);
    wrapEl.style.width = W + 'px'; wrapEl.style.height = H + 'px';
    let c = a.crop ? { ...a.crop } : { x: 0, y: 0, w: 1, h: 1 };
    let ar = 0;   // 宽/高（按真实像素），0 = 自由
    const draw = () => { rect.style.left = c.x * W + 'px'; rect.style.top = c.y * H + 'px'; rect.style.width = c.w * W + 'px'; rect.style.height = c.h * H + 'px'; };
    const fitAr = () => {
      if (!ar) return;
      const curW = c.w * sz.w, curH = c.h * sz.h;
      let nw = curW, nh = curW / ar;
      if (nh > curH) { nh = curH; nw = curH * ar; }
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      c.w = nw / sz.w; c.h = nh / sz.h;
      c.x = Math.max(0, Math.min(1 - c.w, cx - c.w / 2)); c.y = Math.max(0, Math.min(1 - c.h, cy - c.h / 2));
    };
    draw();
    box.querySelectorAll('[data-ar]').forEach(btn => btn.addEventListener('click', () => {
      box.querySelectorAll('[data-ar]').forEach(x => x.classList.toggle('on', x === btn));
      ar = btn.getAttribute('data-ar') === 'free' ? 0 : Number(btn.getAttribute('data-ar'));
      if (ar) { c = { x: 0, y: 0, w: 1, h: 1 }; fitAr(); }
      draw();
    }));
    rect.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const h = e.target.getAttribute('data-h');
      const sx = e.clientX, sy = e.clientY, c0 = { ...c };
      try { rect.setPointerCapture(e.pointerId); } catch (er) {}
      const mv = ev => {
        const dx = (ev.clientX - sx) / W, dy = (ev.clientY - sy) / H;
        const min = 0.06;
        if (!h) { c.x = Math.max(0, Math.min(1 - c0.w, c0.x + dx)); c.y = Math.max(0, Math.min(1 - c0.h, c0.y + dy)); }
        else {
          let x1 = c0.x, y1 = c0.y, x2 = c0.x + c0.w, y2 = c0.y + c0.h;
          if (h.includes('w')) x1 = Math.max(0, Math.min(x2 - min, x1 + dx));
          if (h.includes('e')) x2 = Math.min(1, Math.max(x1 + min, x2 + dx));
          if (h.includes('n')) y1 = Math.max(0, Math.min(y2 - min, y1 + dy));
          if (h.includes('s')) y2 = Math.min(1, Math.max(y1 + min, y2 + dy));
          if (ar) {
            let wpx = (x2 - x1) * sz.w, hpx = wpx / ar;
            const maxH2 = (h.includes('n') ? y2 : 1 - y1) * sz.h;
            if (hpx > maxH2) { hpx = maxH2; wpx = hpx * ar; }
            if (h.includes('w')) x1 = x2 - wpx / sz.w; else x2 = x1 + wpx / sz.w;
            if (h.includes('n')) y1 = y2 - hpx / sz.h; else y2 = y1 + hpx / sz.h;
          }
          c = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
        }
        draw();
      };
      const up = () => { rect.removeEventListener('pointermove', mv); rect.removeEventListener('pointerup', up); rect.removeEventListener('pointercancel', up); };
      rect.addEventListener('pointermove', mv); rect.addEventListener('pointerup', up); rect.addEventListener('pointercancel', up);
    });
    box.querySelector('.be-lay-crop-acts').addEventListener('click', async e => {
      const act = e.target.closest('[data-c]')?.getAttribute('data-c');
      if (!act) return;
      if (act === 'full') { c = { x: 0, y: 0, w: 1, h: 1 }; if (ar) fitAr(); draw(); return; }
      if (act === 'ok') {
        layPushUndo();
        const full = c.w > 0.995 && c.h > 0.995;
        a.crop = full ? null : { x: +c.x.toFixed(4), y: +c.y.toFixed(4), w: +c.w.toFixed(4), h: +c.h.toFixed(4) };
        box.remove();
        layApplyImage(a);
        return;
      }
      box.remove();
    });
  }

  // ----- 拖动：元素按住 ≡ 换位置；贴纸直接拖，右下角圆点缩放 + 旋转 -----
  function layResizeDrag(e, el, corner) {
    e.preventDefault(); e.stopPropagation();
    const a = layFindAtom(el.getAttribute('data-aid'));
    const root = layRoot();
    if (!a || !root) return;
    layCloseMenu();
    const W = root.clientWidth || 1;
    const r0 = el.getBoundingClientRect();
    const sx = e.clientX;
    const dirX = corner.includes('w') ? -1 : 1;
    // 居中的图两边一起变，拖动距离按 2 倍算
    const centered = (a.lay || 'full') === 'full' || a.lay === 'center';
    const snap = laySnap();
    let moved = false, wp = r0.width / W * 100;
    const mv = ev => {
      const dx = (ev.clientX - sx) * dirX * (centered ? 2 : 1);
      if (!moved && Math.abs(dx) < 3) return;
      moved = true;
      wp = Math.max(15, Math.min(100, (r0.width + dx) / W * 100));
      el.style.width = wp.toFixed(2) + '%';
      if ((a.lay || 'full') === 'full' && wp < 99) { el.classList.remove('be-lay-img-full'); el.classList.add('be-lay-img-center'); }
    };
    const up = () => {
      mainDoc.removeEventListener('pointermove', mv, true);
      mainDoc.removeEventListener('pointerup', up, true);
      mainDoc.removeEventListener('pointercancel', up, true);
      if (!moved) { layOpenMenu(); return; }
      layPushUndo(snap);
      a.wp = Math.round(wp * 10) / 10;
      if ((a.lay || 'full') === 'full' && a.wp < 99) a.lay = 'center';
      if (a.lay === 'center' && a.wp >= 99.5) a.lay = 'full';
      layRenderPage(true);
      // 显示尺寸变了：按新尺寸重新处理（异形遮罩 / 相框 / 阴影的清晰度）
      if (layNeedBake(a) || Number(a.sh) > 0) layApplyImage(a);
      layOpenMenu();
    };
    mainDoc.addEventListener('pointermove', mv, true);
    mainDoc.addEventListener('pointerup', up, true);
    mainDoc.addEventListener('pointercancel', up, true);
  }
  function layAtomDrag(e, atomEl) {
    e.preventDefault(); e.stopPropagation();
    layCloseMenu();
    const root = layRoot();
    const page = atomEl.closest('.be-lay');
    const stage = mainDoc.getElementById('be-lay-stage');
    const line = mainDoc.createElement('div');
    line.className = 'be-lay-dropline';
    page.appendChild(line);
    atomEl.classList.add('be-lay-dragging');
    let target = -1;
    const others = () => Array.from(root.children).filter(n => n !== atomEl);
    const mv = ev => {
      const y = ev.clientY;
      const sr = stage.getBoundingClientRect();
      if (y < sr.top + 40) stage.scrollTop -= 10; else if (y > sr.bottom - 40) stage.scrollTop += 10;
      const list = others();
      let i = list.findIndex(n => { const r = n.getBoundingClientRect(); return y < r.top + r.height / 2; });
      if (i < 0) i = list.length;
      target = i;
      const pr = page.getBoundingClientRect();
      const ref = list[i] ? list[i].getBoundingClientRect().top - 4 : (list.length ? list[list.length - 1].getBoundingClientRect().bottom + 2 : pr.top + 10);
      line.style.top = (ref - pr.top) + 'px';
    };
    const up = () => {
      mainDoc.removeEventListener('pointermove', mv, true);
      mainDoc.removeEventListener('pointerup', up, true);
      mainDoc.removeEventListener('pointercancel', up, true);
      line.remove(); atomEl.classList.remove('be-lay-dragging');
      if (target < 0) { layOpenMenu(); return; }
      const list = others();
      const before = list[target] || null;
      if (before === atomEl.nextElementSibling || (!before && !atomEl.nextElementSibling)) { layOpenMenu(); return; }
      const snap = laySnap();
      if (before) root.insertBefore(atomEl, before); else root.appendChild(atomEl);
      layNormalizeRoot();
      layPushUndo(snap);
      layRenderPage(false);
      layOpenMenu();
    };
    mainDoc.addEventListener('pointermove', mv, true);
    mainDoc.addEventListener('pointerup', up, true);
    mainDoc.addEventListener('pointercancel', up, true);
  }
  function layFloatDrag(e, el, mode) {
    e.preventDefault(); e.stopPropagation();
    const f = layFindFloat(el.getAttribute('data-fid'));
    if (!f) return;
    const page = el.closest('.be-lay');
    const pr = page.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const f0 = { ...f };
    const cx = pr.left + (Number(f.x) || 50) / 100 * pr.width, cy = pr.top + (Number(f.y) || 50) / 100 * pr.height;
    const d0 = Math.hypot(sx - cx, sy - cy) || 1, a0 = Math.atan2(sy - cy, sx - cx);
    let moved = false;
    layCloseMenu();
    const mv = ev => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return;
      if (!moved) { moved = true; layPushUndo(); }
      if (mode === 'rot') {
        const d = Math.hypot(ev.clientX - cx, ev.clientY - cy), a = Math.atan2(ev.clientY - cy, ev.clientX - cx);
        f.w = +Math.max(2, Math.min(60, (Number(f0.w) || 12) * d / d0)).toFixed(2);
        let r = (Number(f0.r) || 0) + (a - a0) * 180 / Math.PI;
        const snap = Math.round(r / 45) * 45;
        if (Math.abs(r - snap) < 4) r = snap;   // 靠近 0/45/90° 自动吸附
        f.r = Math.round(r);
      } else {
        f.x = +Math.max(0, Math.min(100, (Number(f0.x) || 50) + (ev.clientX - sx) / pr.width * 100)).toFixed(2);
        f.y = +Math.max(0, Math.min(100, (Number(f0.y) || 50) + (ev.clientY - sy) / pr.height * 100)).toFixed(2);
      }
      el.style.left = f.x + '%'; el.style.top = f.y + '%';
      el.style.fontSize = f.w + 'cqw';
      el.style.transform = `translate(-50%,-50%) rotate(${f.r || 0}deg)`;
    };
    const up = () => {
      mainDoc.removeEventListener('pointermove', mv, true);
      mainDoc.removeEventListener('pointerup', up, true);
      mainDoc.removeEventListener('pointercancel', up, true);
      layOpenMenu();
    };
    mainDoc.addEventListener('pointermove', mv, true);
    mainDoc.addEventListener('pointerup', up, true);
    mainDoc.addEventListener('pointercancel', up, true);
  }

  // ----- 绑定（mask 只建一次） -----
  function layBindMask(mask) {
    const stage = mask.querySelector('#be-lay-stage');
    const inDoc = (t) => t && t.closest && t.closest('.be-lay-doc');
    stage.addEventListener('pointerdown', e => {
      const rot = e.target.closest('.be-lay-rot');
      if (rot) return layFloatDrag(e, rot.closest('[data-fid]'), 'rot');
      const rh = e.target.closest('[data-rh]');
      if (rh) return layResizeDrag(e, rh.closest('.be-la'), rh.getAttribute('data-rh'));
      const grip = e.target.closest('.be-lay-grip');
      if (grip) return layAtomDrag(e, grip.closest('.be-la'));
      if (e.target.closest('.be-la, .be-lay-tok, .be-lay-slottag')) {
        e.preventDefault();
        const ae = mainDoc.activeElement;
        if (ae && ae.closest && ae.closest('.be-lay-doc')) { try { ae.blur(); } catch (er) {} }
      }
      const fl = e.target.closest('[data-fid]');
      if (fl) {
        const id = fl.getAttribute('data-fid');
        if (!lay.sel || lay.sel.id !== id) laySelect({ k: 'f', id }, false);
        return layFloatDrag(e, mainDoc.querySelector(`#be-lay-pagewrap [data-fid="${id}"]`), 'move');
      }
    });
    stage.addEventListener('click', e => {
      if (e.target.closest('.be-lay-grip, .be-lay-rot, .be-lay-rh, [data-fid]')) return;
      const tag = e.target.closest('.be-lay-slottag');
      if (tag) {
        lay.sel = null; laySyncSelection();
        layCloseMenu();
        lay.slotEl = tag._target;
        layOpenMenu();
        return;
      }
      const tok = e.target.closest('.be-lay-tok');
      if (tok) {
        lay.sel = null; laySyncSelection();
        lay.tok = tok;
        layOpenMenu();
        lay.tok = tok;   // layOpenMenu 走的是 lay.tok 分支，不会清掉它
        return;
      }
      const atom = e.target.closest('.be-la');
      if (atom) {
        const a = layFindAtom(atom.getAttribute('data-aid'));
        // 还没选图片的图片位：点一下直接选图
        if (a && a.t === 'img' && !a.src) {
          layPickImage(async ref => { layPushUndo(); await layResetImage(a, ref); layApplyImage(a); laySelect({ k: 'a', id: a.id }); });
          return;
        }
        laySelect({ k: 'a', id: atom.getAttribute('data-aid') });
        return;
      }
      if (inDoc(e.target)) {
        if (lay.sel || lay.tok) { lay.sel = null; laySyncSelection(); layCloseMenu(); }
        if (lay.sheet && lay.sheet !== 'text') { lay.sheet = ''; layRenderSheet(); }
        else if (lay.sheet === 'text') layRenderSheet();
        return;
      }
      lay.sel = null; laySyncSelection(); layCloseMenu();
      if (lay.sheet === 'text') layRenderSheet();
    });
    stage.addEventListener('beforeinput', e => {
      if (!inDoc(e.target)) return;
      const t = e.inputType || '';
      if (t === 'historyUndo' || t === 'historyRedo') { e.preventDefault(); layUndoRedo(t === 'historyUndo'); return; }
      if (t === 'insertParagraph') {
        e.preventDefault();
        layPushUndo(); layEndTyping();
        layInsertParagraph();
        return;
      }
      if (!lay.typing) { layPushUndo(); lay.typing = true; }
      clearTimeout(lay.typingT);
      lay.typingT = setTimeout(() => { lay.typing = false; }, 1000);
    });
    stage.addEventListener('input', e => {
      if (!inDoc(e.target)) return;
      lay.dirty = true;
      if (!e.isComposing) layNormalizeRoot();
      const sel = mainWin.getSelection();
      if (sel && sel.rangeCount) layUpdatePh(layParaOf(sel.getRangeAt(0).startContainer));
      clearTimeout(lay.tagT); lay.tagT = setTimeout(layPlaceSlotTags, 120);
    });
    stage.addEventListener('compositionstart', () => { lay.composing = true; });
    stage.addEventListener('compositionend', () => { lay.composing = false; setTimeout(layNormalizeRoot, 0); });
    stage.addEventListener('paste', e => {
      if (!inDoc(e.target)) return;
      e.preventDefault();
      const t = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
      if (!t) return;
      layPushUndo(); layEndTyping();
      layPasteText(t);
      layNormalizeRoot();
    });
    stage.addEventListener('keydown', e => {
      if (!inDoc(e.target)) return;
      const z = (e.ctrlKey || e.metaKey) && !e.altKey;
      if (z && e.key.toLowerCase() === 'z') { e.preventDefault(); layUndoRedo(!e.shiftKey); return; }
      if (z && e.key.toLowerCase() === 'y') { e.preventDefault(); layUndoRedo(false); return; }
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      const sel = mainWin.getSelection();
      if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
      const r = sel.getRangeAt(0);
      const p = layParaOf(r.startContainer);
      if (!p || p.parentNode !== layRoot()) return;
      if (e.key === 'Backspace' && p.hasAttribute('data-slot') && layIsEmptyPara(p)) {
        e.preventDefault();
        layPushUndo();
        const prev = p.previousElementSibling;
        p.remove();
        layNormalizeRoot();
        if (prev && prev.classList.contains('be-lp')) { const nr = mainDoc.createRange(); nr.selectNodeContents(prev); nr.collapse(false); sel.removeAllRanges(); sel.addRange(nr); }
        layPlaceSlotTags();
        return;
      }
      const off = layOffsetIn(p, r.startContainer, r.startOffset);
      const len = layParaLen(p);
      // 摘录 / 想法占位和普通段落之间不合并（合并后普通段落里的字和行内占位会进到占位段落里，导出时被摘录整段替换掉）
      const nbP = e.key === 'Backspace' ? (off === 0 ? p.previousElementSibling : null) : (off >= len ? p.nextElementSibling : null);
      if (nbP && nbP.classList.contains('be-lp') && (p.hasAttribute('data-slot') || nbP.hasAttribute('data-slot'))) {
        e.preventDefault();
        const toEnd = (el, end) => { const nr = mainDoc.createRange(); const pt = end ? layPointAt(el, layParaLen(el)) : layPointAt(el, 0); nr.setStart(pt.node, pt.off); nr.collapse(true); sel.removeAllRanges(); sel.addRange(nr); };
        const back = e.key === 'Backspace';
        if (!p.hasAttribute('data-slot') && layIsEmptyPara(p)) { layPushUndo(); p.remove(); toEnd(nbP, back); }
        else if (!nbP.hasAttribute('data-slot') && layIsEmptyPara(nbP)) { layPushUndo(); nbP.remove(); }
        else toEnd(nbP, back);
        layNormalizeRoot(); layPlaceSlotTags();
        lay.dirty = true;
        return;
      }
      // 段首退格 / 段尾删除碰到图片等元素：先选中它，不直接删掉（再按一次菜单里删）
      const nb = e.key === 'Backspace' ? (off === 0 ? p.previousElementSibling : null) : (off >= len ? p.nextElementSibling : null);
      if (nb && nb.classList.contains('be-la')) {
        e.preventDefault();
        if (layIsEmptyPara(p) && p.parentNode.children.length > 1 && e.key === 'Backspace' && p.nextElementSibling) { layPushUndo(); p.remove(); }
        laySelect({ k: 'a', id: nb.getAttribute('data-aid') });
      }
    });
    // 记下页面里最后一次的文字选区（点底部面板时焦点会离开页面）
    if (mainWin.__beLaySelFn) mainDoc.removeEventListener('selectionchange', mainWin.__beLaySelFn);
    let _selT = 0;
    mainWin.__beLaySelFn = () => {
      const m = mainDoc.getElementById('be-lay-mask');
      if (!m || !m.classList.contains('open') || !lay.draft) return;
      const s = mainWin.getSelection();
      if (!s || !s.rangeCount) return;
      const r = s.getRangeAt(0);
      if (!layParaOf(r.startContainer) || !layParaOf(r.endContainer)) return;
      lay.range = r.cloneRange();
      lay.caret = layGetCaret();
      // 光标进了正文（页面有焦点）：取消对图片等元素的选中
      const ae = mainDoc.activeElement;
      if (lay.sel && lay.sel.k === 'a' && ae && ae.closest && ae.closest('.be-lay-doc')) { lay.sel = null; laySyncSelection(); layCloseMenu(); }
      if (lay.sheet === 'text' && !lay.sel) { clearTimeout(_selT); _selT = setTimeout(layRenderSheet, 120); }
    };
    mainDoc.addEventListener('selectionchange', mainWin.__beLaySelFn);
    stage.addEventListener('scroll', () => layPlaceMenu(), { passive: true });
    try {
      if (mainWin.ResizeObserver) new mainWin.ResizeObserver(() => { if (lay.draft) layPlaceSlotTags(); }).observe(mask.querySelector('#be-lay-pagewrap'));
    } catch (e) {}
    const menu = mask.querySelector('#be-lay-menu');
    menu.addEventListener('pointerdown', e => { if (e.target.closest('button')) e.preventDefault(); });
    menu.addEventListener('click', e => {
      if (menu._more) return;
      const back = e.target.closest('[data-m="back"]');
      if (back) return layOpenMenu();
      const m = e.target.closest('[data-m]');
      if (m) return layMenuAction(m.getAttribute('data-m'));
      const o = e.target.closest('[data-o]');
      if (o) layMenuOption(o.getAttribute('data-o'));
    });
    menu.addEventListener('input', e => { if (e.target.matches('.be-lay-slider input')) layMenuSlide(e.target.value, false); });
    menu.addEventListener('change', e => { if (e.target.matches('.be-lay-slider input')) layMenuSlide(e.target.value, true); });
    const sheet = mask.querySelector('#be-lay-sheet');
    // 面板按钮不抢页面的焦点和选区（手机上点按钮会先让页面失焦，选中的字就丢了）
    sheet.addEventListener('pointerdown', e => { if (e.target.closest('button')) e.preventDefault(); });
    sheet.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      for (const a of ['data-tp', 'data-tf', 'data-tc', 'data-tz', 'data-tb', 'data-ta', 'data-tl', 'data-ff', 'data-fc', 'data-fz']) {
        if (btn.hasAttribute(a)) return layApplyText(a, btn.getAttribute(a), btn);
      }
      if (btn.hasAttribute('data-ins')) return layInsert(btn.getAttribute('data-ins'));
      if (btn.hasAttribute('data-stk')) {
        const v = btn.getAttribute('data-stk');
        const f = lay.sel && lay.sel.k === 'f' ? layFindFloat(lay.sel.id) : null;
        if (f && f.k !== 'text') { layPushUndo(); f.txt = v; lay.sheet = ''; layRenderPage(true); layRenderSheet(); layOpenMenu(); return; }
        return layAddFloat({ k: 'sym', txt: v, w: 12 });
      }
      const p = lay.draft.page = lay.draft.page || {};
      // 「跟随配色」：点了展开配色块（和书摘弹窗那一排一样），只切换预览
      if (btn.hasAttribute('data-pbg')) {
        const v = btn.getAttribute('data-pbg');
        if (v === 'follow') {
          if (p.bg || p.bgImg) {
            layPushUndo(); p.bg = '';
            if (p.bgImg) { const old = p.bgImg; p.bgImg = ''; layForgetImageIfUnused(old); }
            layRenderPage(true);
          }
          lay.presetRow = lay.presetRow === 'bg' ? '' : 'bg';
          layRenderSheet();
        } else if (v === 'color') layPickColor(p.bg || '#f5f1e8', btn, c => { p.bg = c; layRenderPage(true); });
        else layPickImage(ref => { layPushUndo(); const old = p.bgImg; p.bgImg = ref; if (old) layForgetImageIfUnused(old); layRenderPage(true); layRenderSheet(); });
        return;
      }
      if (btn.hasAttribute('data-pfg')) {
        if (btn.getAttribute('data-pfg') === 'follow') {
          if (p.fg) { layPushUndo(); p.fg = ''; layRenderPage(true); }
          lay.presetRow = lay.presetRow === 'fg' ? '' : 'fg';
          layRenderSheet();
        } else layPickColor(p.fg || '#1f1f1f', btn, c => { p.fg = c; layRenderPage(true); });
        return;
      }
      if (btn.hasAttribute('data-prev')) {
        lay.preview = btn.getAttribute('data-prev') || '';
        layRenderPage(true); layRenderSheet();
        return;
      }
      if (btn.hasAttribute('data-pfit')) { layPushUndo(); p.bgFit = btn.getAttribute('data-pfit'); layRenderPage(true); layRenderSheet(); }
    });
    const pageSlide = (e, final) => {
      const k = e.target.getAttribute('data-pk');
      if (!k) return;
      const n = layNum(e.target.value, 0, Number(e.target.min), Number(e.target.max));
      if (!lay.sliding) { layPushUndo(); lay.sliding = true; }
      lay.draft.page[k] = n;
      sheet.querySelectorAll(`[data-pk="${k}"]`).forEach(inp => { if (inp !== e.target) inp.value = n; });
      layRenderPage(true);
      if (final) lay.sliding = false;
    };
    sheet.addEventListener('input', e => pageSlide(e, false));
    sheet.addEventListener('change', e => pageSlide(e, true));
    mask.querySelector('.be-lay-bar').addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.getAttribute('data-a');
      if (!a) return;
      if (a === 'done') {
        // 正在输入 / 开着面板或菜单时先收起，再点一次才保存退出
        const menuOpen = !mask.querySelector('#be-lay-menu').hidden;
        const ae = mainDoc.activeElement;
        const typing = ae && ae.closest && ae.closest('.be-lay-doc');
        if (lay.sheet || menuOpen || typing || lay.sel) {
          if (typing) { try { ae.blur(); } catch (er) {} }
          lay.sheet = ''; layCloseMenu(); lay.sel = null; laySyncSelection(); layRenderSheet();
          return;
        }
        return layClose(true);
      }
      if (a === 'undo') return layUndoRedo(true);
      if (a === 'redo') return layUndoRedo(false);
      layCloseMenu();
      layOpenSheet(a);
    });
    mask.querySelector('.be-lay-bar').addEventListener('pointerdown', e => { if (e.target.closest('[data-a="text"], [data-a="insert"]')) e.preventDefault(); });
    mask.querySelector('.be-lay-top').addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.getAttribute('data-a');
      if (a === 'back') return layClose(true);
      if (a === 'rename') return layAskText('排版名称', lay.draft.name || '', v => { if (v && v.trim()) { lay.draft.name = v.trim().slice(0, 30); lay.dirty = true; layRenderTop(); } });
      if (a === 'more') return layMoreMenu(e.target.closest('[data-a]'));
    });
    mask.addEventListener('keydown', e => {
      if (inDoc(e.target) || e.target.closest('input, textarea')) return;
      const z = (e.ctrlKey || e.metaKey) && !e.altKey;
      if (z && e.key.toLowerCase() === 'z') { e.preventDefault(); layUndoRedo(!e.shiftKey); }
      else if (z && e.key.toLowerCase() === 'y') { e.preventDefault(); layUndoRedo(false); }
    });
  }
  function layMoreMenu(anchor) {
    const menu = mainDoc.getElementById('be-lay-menu');
    const mask = mainDoc.getElementById('be-lay-mask');
    lay.sel = null; lay.tok = null; laySyncSelection();
    menu.innerHTML = `<div class="be-lay-mhead">此排版</div>
      <button type="button" data-x="rename">重命名</button>
      <button type="button" data-x="export">导出模板文件</button>
      <button type="button" data-x="discard">不保存并退出</button>
      ${lay.isNew ? '' : '<button type="button" data-x="delete" class="danger">删除此排版</button>'}`;
    menu.hidden = false;
    menu._more = true;
    const r = anchor.getBoundingClientRect(), mr = mask.getBoundingClientRect();
    menu.style.left = Math.max(8, r.right - mr.left - menu.offsetWidth) + 'px';
    menu.style.top = (r.bottom - mr.top + 6) + 'px';
    const onClick = async e => {
      const x = e.target.closest('[data-x]')?.getAttribute('data-x');
      if (!x) return;
      menu.removeEventListener('click', onClick, true);
      e.stopPropagation();
      menu._more = false;
      layCloseMenu();
      if (x === 'rename') mask.querySelector('[data-a="rename"]').click();
      else if (x === 'export') { layReadDom(); exportLayoutTemplate(lay.draft); }
      else if (x === 'discard') {
        if (lay.dirty) { const r2 = await beConfirm({ text: '本次修改不会保存。确定退出？', okText: '不保存' }); if (!r2.ok) return; }
        layClose(false);
      } else if (x === 'delete') {
        const r2 = await beConfirm({ text: `删除排版「${lay.draft.name}」？正在使用它的地方会改回经典模板。`, okText: '删除' });
        if (!r2.ok) return;
        deleteLayoutTemplate(lay.draft.id);
        lay.dirty = false;
        layClose(false);
      }
    };
    menu.addEventListener('click', onClick, true);
  }
  function layClose(save) {
    layReadDom();
    layEndTyping();
    const mask = mainDoc.getElementById('be-lay-mask');
    if (lay.draft) {
      // 这次编辑里出现过的所有图片（含撤销记录、替换前的旧图），最后没进任何模板的统一删掉
      const seen = new Set(layImageRefs(lay.draft));
      lay.undo.concat(lay.redo).forEach(sn => { try { layImageRefs(JSON.parse(sn).d).forEach(r => seen.add(r)); } catch (e) {} });
      const old = (settings.layoutTemplates || []).find(t => t.id === lay.draft.id);
      layImageRefs(old).forEach(r => seen.add(r));
      if (save) {
        const list = Array.isArray(settings.layoutTemplates) ? settings.layoutTemplates.slice() : [];
        const i = list.findIndex(t => t.id === lay.draft.id);
        const clean = JSON.parse(JSON.stringify(lay.draft));
        clean.v = 2;
        if (i >= 0) list[i] = clean; else list.push(clean);
        settings.layoutTemplates = list;
        if (lay.fromModal || lay.isNew) settings.template = 'layout-' + clean.id;
        saveSettings(settings);
        toast(lay.isNew ? `已保存为模板「${clean.name}」` : '已保存', 'success');
      }
      const keep = new Set(); (settings.layoutTemplates || []).forEach(t => layImageRefs(t).forEach(r => keep.add(r)));
      seen.forEach(r => { if (!keep.has(r)) imgForget(r); });
    }
    lay.draft = null; lay.sel = null; lay.tok = null; lay.slotEl = null; lay.sheet = ''; lay.preview = ''; lay.undo = []; lay.redo = []; lay.range = null; lay.caret = null;
    _layBakeCache.clear();
    mask && mask.querySelector('.be-lay-starter')?.remove();
    if (_cp) closeColorPicker(true);
    layWatchViewport(false);
    if (mask) {
      mask.classList.remove('open');
      mask.querySelector('#be-lay-crop')?.remove();
      mask.querySelectorAll('.be-lay-ask').forEach(n => n.remove());
      const menu = mask.querySelector('#be-lay-menu'); if (menu) { menu.hidden = true; menu._more = false; }
    }
    if (mainDoc.getElementById('be-card')) {
      renderCard(lastText);
      const drawer = mainDoc.getElementById('be-drawer');
      if (drawer && drawer.classList.contains('show')) renderDrawer(drawer);
    }
    if (mainDoc.getElementById('be-panel')?.classList.contains('open') && panelView === 'settings') renderSettings();
  }

  // ----- 书摘弹窗里更换自由排版的图片 -----
  // 三选一确认框（和 beConfirm 同样的外观）：options = [{v, label, primary}]，点空白处 = 取消（v 为 null）
  function beChoose({ title = '', text = '', options = [], remember = '' } = {}) {
    return new Promise(resolve => {
      mainDoc.getElementById('be-confirm-mask')?.remove();
      const mask = stampGen(mainDoc.createElement('div'));
      mask.id = 'be-confirm-mask';
      mask.className = 'be-import-tpl-mask open';
      mask.innerHTML = `
        <div class="be-import-tpl-box be-confirm-box">
          ${title ? `<div class="be-src-title">${escapeHtml(title)}</div>` : ''}
          ${text ? `<div class="be-confirm-text">${escapeHtml(text)}</div>` : ''}
          ${remember ? `<label class="be-confirm-remember"><input type="checkbox" id="be-confirm-remember"> ${escapeHtml(remember)}</label>` : ''}
          <div class="be-src-actions">
            <button class="be-btn" data-v="">取消</button>
            ${options.map(o => `<button class="be-btn ${o.primary ? 'primary' : ''}" data-v="${escapeHtml(o.v)}">${escapeHtml(o.label)}</button>`).join('')}
          </div>
        </div>`;
      mainDoc.body.appendChild(mask);
      detectAndApplyTheme();
      const done = (v) => {
        const rem = !!mask.querySelector('#be-confirm-remember')?.checked;
        mask.remove();
        resolve({ v: v || null, remember: !!v && rem });
      };
      mask.addEventListener('click', e => {
        if (e.target === mask) return done(null);
        const b = e.target.closest('[data-v]');
        if (b) done(b.getAttribute('data-v'));
      });
    });
  }
  function layClearOnceImgs() {
    const refs = [];
    Object.values(_layOnceImgs).forEach(g => Object.values(g).forEach(m => Object.values(m).forEach(v => { if (v.orig) refs.push(v.orig); if (v.src) refs.push(v.src); if (v.shd) refs.push(v.shd); })));
    Object.keys(_layOnceImgs).forEach(k => delete _layOnceImgs[k]);
    if (!refs.length) return;
    const keep = new Set(); (settings.layoutTemplates || []).forEach(t => layImageRefs(t).forEach(r => keep.add(r)));
    [...new Set(refs)].forEach(r => { if (!keep.has(r)) imgForget(r); });
    _layBakeCache.clear();
  }
  async function layModalReplaceImage(aid) {
    const tpl = layGetTemplate(settings.template);
    if (!tpl) return;
    const a = (tpl.doc || []).find(x => x.t === 'img' && x.id === aid);
    if (!a) return;
    const ref = await new Promise(res => {
      const input = mainDoc.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.addEventListener('change', async () => {
        const f = input.files && input.files[0];
        if (!f) return res(null);
        try { res(await saveImageFile(f, 'slot')); } catch (e) { toast('图片读取失败：' + (e?.message || e), 'error'); res(null); }
      });
      input.click();
    });
    if (!ref) return;
    let mode = settings.layoutImgReplace || 'ask';
    if (mode === 'ask') {
      const r = await beChoose({ title: '更换图片', text: a.grp ? '这是一组分割图，两部分会一起更换。' : '', options: [{ v: 'once', label: '仅本次导出' }, { v: 'save', label: '保存到模板', primary: true }], remember: '记住选择（可在 设置 → 书摘卡片 → 模板 中修改）' });
      if (!r.v) { imgForget(ref); return; }
      mode = r.v;
      if (r.remember) { settings.layoutImgReplace = mode; saveSettings(settings); }
    }
    const group = (tpl.doc || []).filter(x => x.t === 'img' && (a.grp ? x.grp === a.grp : x === a));
    const cw = Number(settings.cardWidth) > 0 ? Number(settings.cardWidth) : 420;
    const pad = layNum((tpl.page || {}).pad, 28, 0, 80);
    toast('正在处理图片…', 'info');
    if (mode === 'save') {
      for (const x of group) {
        x.orig = ref; x.src = ref; delete x.shd; delete x.shdBox;
        const r = await layProcessImage(x, (cw - pad * 2) * ((x.lay || 'full') === 'full' ? 1 : layNum(x.wp, 42, 10, 100) / 100));
        if (r) { x.src = r.src; x.ar = r.ar; x.baked = !!r.baked; if (r.shd) { x.shd = r.shd; x.shdBox = r.shdBox; } }
      }
      saveSettings(settings);
      // 之前「仅本次导出」换过的图会盖在模板图片上面，保存到模板后要去掉，预览才显示新图
      const ov = _layOnceImgs[tpl.id];
      if (ov) delete ov[a.grp ? 'g:' + a.grp : a.id];
    } else {
      const key = a.grp ? 'g:' + a.grp : a.id;
      const m = {};
      for (const x of group) {
        const r = await layProcessImage({ ...x, orig: ref, src: ref }, (cw - pad * 2) * ((x.lay || 'full') === 'full' ? 1 : layNum(x.wp, 42, 10, 100) / 100));
        if (r) m[x.id] = { orig: ref, src: r.src, ar: r.ar, baked: !!r.baked, shd: r.shd, shdBox: r.shdBox };
      }
      (_layOnceImgs[tpl.id] = _layOnceImgs[tpl.id] || {})[key] = m;
    }
    if (mainDoc.getElementById('be-card')) renderCard(lastText);
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
        div.addEventListener('click', () => openPanelHome());
        menu.appendChild(div);
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
     'be-lay-mask', 'be-lay-crop', 'be-card-hl-bar', 'be-css-float',
     'be-card-hl-pop', 'be-slot-chooser', 'be-tpl-preview', 'be-daily-review', 'be-export-mask', 'be-cpick'].forEach(id => {
      mainDoc.getElementById(id)?.remove();
    });
  });

  // ---------- 官方对外接口 window.BookExcerpt ----------
  // 给别的扩展/脚本调用书摘的划线、想法、书摘卡片、笔记本，不需要内置书摘代码。
  // 挂在酒馆主窗口上；脚本实例重建（酒馆助手热更新）时整个对象替换成新实例的，
  // 但监听器表放在主窗口上跨实例保留，调用方不用重新 on()。文档见 API.md / API_AI.md。
  const API_VERSION = 1;
  let _apiSourceOverride = null;
  function apiClone(x) { try { return JSON.parse(JSON.stringify(x)); } catch (e) { return x; } }
  function apiError(code, msg) { const e = new Error(msg); e.code = code; return e; }
  function apiListeners() {
    if (!mainWin.__bookExcerptListeners) mainWin.__bookExcerptListeners = {};
    return mainWin.__bookExcerptListeners;
  }
  function apiEmit(event, detail) {
    const list = (apiListeners()[event] || []).slice();
    list.forEach(fn => { try { fn(detail); } catch (e) { console.warn('[书摘] 接口监听器出错', event, e); } });
    try { mainWin.dispatchEvent(new mainWin.CustomEvent('book-excerpt:' + event, { detail })); } catch (e) {}
  }
  // note:changed 一次操作里可能连着存好几次，合并成一次通知
  let _apiEmitT = 0;
  function apiEmitSoon(event, detail) {
    if (_apiEmitT) clearTimeout(_apiEmitT);
    _apiEmitT = setTimeout(() => { _apiEmitT = 0; apiEmit(event, detail); }, 60);
  }
  // 在某一楼的正文里找一段文字，返回能直接拿去划线的 Range（可跨标签/跨段落）
  function apiFindTextRange(mesId, text) {
    const root = mainDoc.querySelector(`#chat .mes[mesid="${mesId}"] .mes_text`);
    if (!root) throw apiError('NO_MESSAGE', `第 ${Number(mesId) + 1} 楼不在页面上（酒馆只渲染最近的消息）`);
    const walker = mainDoc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement && n.parentElement.closest('script, style, .be-mask') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = []; let full = '', n;
    while ((n = walker.nextNode())) { nodes.push({ n, start: full.length }); full += n.nodeValue; }
    const idx = full.indexOf(text);
    if (idx < 0) throw apiError('TEXT_NOT_FOUND', '在这一楼里没找到这段文字');
    const end = idx + text.length;
    const at = (pos, isEnd) => {
      for (let i = 0; i < nodes.length; i++) {
        const { n: node, start } = nodes[i];
        const len = node.nodeValue.length;
        if (pos < start + len || (isEnd && pos === start + len)) return [node, pos - start];
      }
      const last = nodes[nodes.length - 1];
      return [last.n, last.n.nodeValue.length];
    };
    const range = mainDoc.createRange();
    const [sn, so] = at(idx, false), [en, eo] = at(end, true);
    range.setStart(sn, so); range.setEnd(en, eo);
    return range;
  }
  function apiSyncThoughtClass(noteId) {
    const after = findNoteById(noteId);
    const hasAny = !!(after && after.thoughts && after.thoughts.length);
    mainDoc.querySelectorAll(`.be-highlight[data-be-id="${noteId}"]`).forEach(el => el.classList.toggle('has-thought', hasAny));
  }
  // 不弹窗直接出图：在屏幕外拼一张卡片，走跟「保存图片」同一条沙箱导出流程
  async function apiRenderCardImage(o = {}) {
    const text = String(o.text || '').trim();
    if (!text) throw apiError('INVALID_ARGS', 'text 不能为空');
    const prev = { thought: currentThoughtText, rich: currentRichText, tpl: settings.template, src: _apiSourceOverride };
    const holder = mainDoc.createElement('div');
    holder.setAttribute('aria-hidden', 'true');
    const cw = Number(settings.cardWidth) || 440;
    holder.style.cssText = `position:absolute;left:-99999px;top:0;width:${cw}px;pointer-events:none;`;
    try {
      currentThoughtText = String(o.thought || '');
      currentRichText = '';
      if (o.template) settings.template = String(o.template);
      if (o.source) _apiSourceOverride = apiSourceFields(o.source);
      const built = buildCardMarkup(text, { noId: true });
      holder.innerHTML = built.html;
      mainDoc.body.appendChild(holder);
      const card = holder.querySelector('.be-card');
      const qs = Number(settings.quoteFontSize), ql = Number(settings.quoteLineHeight), qls = Number(settings.quoteLetterSpacing);
      if (qs > 0) card.style.setProperty('--be-quote-size', qs + 'px');
      if (ql > 0) card.style.setProperty('--be-quote-lh', ql);
      if (qls >= 0) card.style.setProperty('--be-quote-ls', qls + 'em');
      const q = card.querySelector('.be-quote'); if (q) q.style.fontFamily = built.fontCss;
      const h2c = await loadH2C();
      const scale = Math.max(1, Math.min(5, Number(o.scale) || Number(settings.exportScale) || 3));
      await new Promise(r => setTimeout(r, 30));
      const canvas = await renderInSandbox(card, resolveColors().bg, scale, h2c);
      if (o.format === 'dataURL') return canvas.toDataURL('image/png');
      const blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(apiError('RENDER_FAILED', '生成图片失败')), 'image/png'));
      // 沙箱 iframe 已经移除，在主窗口 realm 里重包一份，调用方拿去 URL.createObjectURL 才稳
      return new mainWin.Blob([await blob.arrayBuffer()], { type: 'image/png' });
    } finally {
      currentThoughtText = prev.thought; currentRichText = prev.rich; settings.template = prev.tpl; _apiSourceOverride = prev.src;
      try { holder.remove(); } catch (e) {}
    }
  }
  function apiSourceFields(src) {
    const out = {};
    if (src.user != null) out.sourceUser = String(src.user);
    if (src.author != null) out.sourceAuthor = String(src.author);
    if (src.title != null) { out.sourceTitle = String(src.title); out.showSourceTitle = !!String(src.title); }
    if (src.chapter != null) { out.sourceChapter = String(src.chapter); out.showSourceChapter = !!String(src.chapter); }
    return out;
  }
  function installPublicApi() {
    const api = {
      version: VERSION,
      apiVersion: API_VERSION,
      isReady: () => true,
      getContext: () => { const c = getContext(); return { charKey: c.charKey, charName: c.charName, userName: c.userName, chatId: c.chatId }; },
      getNotes: (filter = {}) => {
        const notes = loadNotes();
        const out = [];
        Object.keys(notes).forEach(k => {
          if (filter.charKey && k !== filter.charKey) return;
          notes[k].items.forEach(it => {
            if (it.type === 'excerpt') return;
            if (filter.chatId && (it.chatId || '') !== filter.chatId) return;
            out.push({ ...it, charKey: k, charName: notes[k].name || '' });
          });
        });
        return Promise.resolve(apiClone(out.sort((a, b) => (a.ts || 0) - (b.ts || 0))));
      },
      getNote: (noteId) => { const n = findNoteById(noteId); return Promise.resolve(n ? apiClone(n) : null); },
      highlight: async (o = {}) => {
        if (settings.highlightDisabled) throw apiError('DISABLED', '用户关闭了划线功能');
        let range = o.range, text = o.text;
        if (!range) {
          if (o.mesId == null || !text) throw apiError('INVALID_ARGS', '需要 {mesId, text} 或 {range}');
          range = apiFindTextRange(o.mesId, String(text));
        } else {
          text = text || getRangeText(range).text;
        }
        if (!text || !String(text).trim()) throw apiError('INVALID_ARGS', '选中的文字为空');
        const note = createHighlight(String(text), range, { thoughtOnly: !!o.thoughtOnly, style: o.style, color: o.color });
        if (!note) throw apiError('FAILED', '划线失败');
        if (o.thought) { addThought(findNoteById(note.id).charKey, note.id, String(o.thought)); apiSyncThoughtClass(note.id); }
        return apiClone(findNoteById(note.id));
      },
      addThought: async (noteId, text) => {
        const n = findNoteById(noteId);
        if (!n) throw apiError('NOT_FOUND', '没有这条笔记');
        if (!String(text || '').trim()) throw apiError('INVALID_ARGS', '想法不能为空');
        addThought(n.charKey, noteId, String(text));
        apiSyncThoughtClass(noteId);
        return apiClone(findNoteById(noteId));
      },
      openThoughtEditor: async (noteId) => {
        const n = findNoteById(noteId);
        if (!n) throw apiError('NOT_FOUND', '没有这条笔记');
        openThoughtEditor(noteId, n.text, null);
      },
      openCard: async (o = {}) => {
        const text = String(o.text || (o.noteId && (findNoteById(o.noteId) || {}).text) || '').trim();
        if (!text) throw apiError('INVALID_ARGS', '需要 text 或 noteId');
        _apiSourceOverride = o.source ? apiSourceFields(o.source) : null;
        lastText = text;
        openExcerptModal(text, { thoughtText: o.thought ? String(o.thought) : '', editable: !!o.editable });
      },
      renderCardImage: (o) => apiRenderCardImage(o),
      openNotebook: async (o = {}) => {
        openPanel('notes');
        if (o.charKey && loadNotes()[o.charKey]) { currentCharKey = o.charKey; panelView = 'char'; renderPanel(); }
      },
      openReview: async () => { reviewState.charKey = ''; reviewState.current = null; openPanel('review'); },
      jumpToNote: async (noteId) => {
        const n = findNoteById(noteId);
        if (!n) throw apiError('NOT_FOUND', '没有这条笔记');
        return jumpToNote(n, n.charKey);
      },
      on: (event, fn) => {
        if (typeof fn !== 'function') return () => {};
        const L = apiListeners();
        (L[event] = L[event] || []).push(fn);
        return () => api.off(event, fn);
      },
      off: (event, fn) => {
        const L = apiListeners();
        if (L[event]) L[event] = L[event].filter(f => f !== fn);
      }
    };
    try {
      Object.defineProperty(mainWin, 'BookExcerpt', { value: Object.freeze(api), configurable: true, writable: false, enumerable: false });
    } catch (e) { mainWin.BookExcerpt = api; }
    try { mainWin.dispatchEvent(new mainWin.CustomEvent('book-excerpt:ready', { detail: { version: VERSION, apiVersion: API_VERSION } })); } catch (e) {}
  }

  // ---------- 启动 ----------
  injectStyle();
  installPublicApi();
  migrateImagesToIdb();
  // v1.6.0：旧「自由排版」（按坐标摆的画布）换成了新的版式模板，旧草稿和开关一并清掉
  try {
    mainWin.localStorage.removeItem(`${SCRIPT_ID}:canvases`);
    if ('freeformEnabled' in settings || 'freeformTemplates' in settings) {
      delete settings.freeformEnabled; delete settings.freeformTemplates;
      saveSettings(settings);
    }
    if ((settings.layoutTemplates || []).some(t => t && t.v !== 2)) {
      settings.layoutTemplates.forEach(t => layEnsureV2(t));
      saveSettings(settings);
    }
  } catch (e) {}
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
    setTimeout(() => { try { maybeDailyReview(); } catch (e) {} }, 2500);
    setTimeout(() => { mirrorStartupCheck().catch(e => console.warn('[书摘] 数据目录检查失败', e)); }, 2000);
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

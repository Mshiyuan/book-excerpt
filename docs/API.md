# 书摘 对外接口说明（给开发者）

书摘从 v1.6.0 起提供官方接口 `window.BookExcerpt`。你的扩展或脚本可以直接调用书摘的划线、写想法、生成书摘卡片、打开笔记本等功能，不需要把书摘的代码打包进自己的项目。书摘更新后，接口会跟着更新，你这边不用改。

> 书摘的许可条款不允许把它的源代码内置进其他项目。通过这个接口调用，不属于内置。

---

## 1. 检测书摘有没有安装

书摘装成「酒馆扩展」或「酒馆助手脚本」都可以，接口都挂在**酒馆主窗口**上。

- 酒馆扩展里：主窗口就是 `window`。
- 酒馆助手脚本里：脚本跑在 iframe 中，主窗口是 `window.parent`。

```js
const host = window.parent ?? window;          // 两种环境都能用

function getBookExcerpt() {
  const be = host.BookExcerpt;
  return be && be.apiVersion >= 1 ? be : null;
}

// 书摘可能比你晚加载：先查一次，没有就等它的就绪事件
function whenBookExcerptReady(timeout = 10000) {
  return new Promise((resolve) => {
    const be = getBookExcerpt();
    if (be) return resolve(be);
    const onReady = () => resolve(getBookExcerpt());
    host.addEventListener('book-excerpt:ready', onReady, { once: true });
    setTimeout(() => { host.removeEventListener('book-excerpt:ready', onReady); resolve(getBookExcerpt()); }, timeout);
  });
}

const be = await whenBookExcerptReady();
if (!be) {
  // 用户没装书摘：把相关按钮藏起来就行
}
```

两个版本号：

- `be.version` 是书摘本身的版本，例如 `"1.6.0"`。
- `be.apiVersion` 是接口的版本，现在是 `1`。只增加新方法时不会变；如果有不兼容的改动，会升到 `2`。判断能不能用接口，请看 `apiVersion`。

---

## 2. 常用示例

### 给某一楼的一段文字划线

```js
const note = await be.highlight({
  mesId: 12,                       // 楼层号，就是酒馆 .mes 元素上的 mesid（从 0 开始）
  text: '说没关系，是骗她的',        // 这一楼正文里的原文，可以跨标签、跨段落
  style: 'marker',                 // 可选：'underline' 下划线 | 'marker' 荧光笔 | 'wavy' 波浪线
  color: '#f5c97a',                // 可选
  thought: '这里好难过'             // 可选：同时写一条想法
});
console.log(note.id);              // 之后加想法、跳转都用这个 id
```

如果你手里已经有一个 `Range`（比如用户在你的界面里选了字），可以直接传：

```js
await be.highlight({ range: mySelection.getRangeAt(0) });
```

### 写想法

```js
await be.addThought(note.id, '第二遍看又有新的感觉');   // 直接写入
await be.openThoughtEditor(note.id);                    // 或者打开书摘自己的想法输入框，让用户写
```

### 生成书摘卡片

```js
// 打开书摘的卡片弹窗（用户可以换模板、改出处、保存图片）
await be.openCard({
  text: '说没关系，是骗她的，也是骗他自己的。',
  thought: '可选的想法',
  source: { title: '书名', chapter: '第三章', author: '作者', user: '摘录人' }  // 可选，只对这一次有效，不会改用户的设置
});

// 不弹窗，直接拿到图片（用的是用户当前的模板、配色、字体）
const blob = await be.renderCardImage({ text: '……', thought: '……', scale: 3 });
img.src = URL.createObjectURL(blob);
```

### 打开笔记本、随机回顾、跳回原文

```js
await be.openNotebook();                         // 笔记本首页
await be.openNotebook({ charKey: 'xxx.png' });   // 直接打开某个角色的笔记
await be.openReview();                           // 随机回顾
await be.jumpToNote(note.id);                    // 跳回这条划线所在的楼层
```

### 读取笔记

```js
const { charKey, chatId } = be.getContext();
const notes = await be.getNotes({ charKey, chatId });   // 两个条件都可以不填
```

### 监听书摘的变化

```js
const off = be.on('highlight:created', ({ note }) => { /* 用户新划了一条 */ });
be.on('note:changed', () => { /* 笔记有增删改，需要的话重新 getNotes() */ });
be.on('card:saved', ({ fileName }) => { /* 用户保存了一张卡片 */ });
off();   // 取消监听
```

也可以用 DOM 事件监听，事件名在前面加 `book-excerpt:`：

```js
host.addEventListener('book-excerpt:highlight:created', e => console.log(e.detail.note));
```

---

## 3. 全部方法

所有方法都返回 Promise，只有 `getContext`、`on`、`off`、`isReady` 例外。

| 方法 | 作用 |
|---|---|
| `version` / `apiVersion` | 书摘版本 / 接口版本 |
| `isReady()` | 永远返回 `true`（能取到这个对象就说明已经就绪） |
| `getContext()` | 当前角色和聊天：`{ charKey, charName, userName, chatId }` |
| `getNotes({ charKey?, chatId? })` | 笔记列表，按时间从旧到新 |
| `getNote(noteId)` | 读取单条笔记，没有就返回 `null` |
| `highlight({ mesId, text } \| { range }, ...)` | 划线，返回新笔记 |
| `addThought(noteId, text)` | 写一条想法，返回更新后的笔记 |
| `openThoughtEditor(noteId)` | 打开书摘的想法输入框 |
| `openCard({ text \| noteId, thought?, source?, editable? })` | 打开书摘卡片弹窗 |
| `renderCardImage({ text, thought?, source?, template?, scale?, format? })` | 不弹窗直接出图，返回 PNG `Blob`；传 `format: 'dataURL'` 则返回字符串 |
| `openNotebook({ charKey? })` | 打开笔记本 |
| `openReview()` | 打开随机回顾 |
| `jumpToNote(noteId)` | 跳回原楼层 |
| `on(event, fn)` / `off(event, fn)` | 监听事件；`on` 返回一个取消监听的函数 |

### 笔记对象

```js
{
  id: 'n1728...',          // 笔记 id
  type: 'highlight',
  text: '原句',
  thoughts: [{ id, text, ts }],
  thoughtOnly: false,      // true 表示只写了想法，没有划线（原文显示为虚线）
  msgId: '12',             // 楼层号（字符串）
  swipeId: 0,              // 划线时这一楼显示的是第几个回复版本（从 0 开始；v1.6.0 之前的旧笔记没有这个字段）
  chatId: '聊天文件名',
  style: 'underline', color: '',
  ts: 1728000000000,       // 创建时间（毫秒）
  charKey: 'xxx.png', charName: '角色名'
}
```

### 出错时

方法失败时 Promise 会 reject，错误对象带 `code` 字段：

| code | 什么情况 |
|---|---|
| `INVALID_ARGS` | 参数不对 |
| `NO_MESSAGE` | 这一楼当前不在页面上。酒馆只渲染最近的若干楼，可以先 `jumpToNote` 或让用户往上翻 |
| `TEXT_NOT_FOUND` | 这一楼里找不到这段文字 |
| `NOT_FOUND` | 没有这条笔记 |
| `DISABLED` | 用户在书摘设置里关闭了划线功能 |
| `RENDER_FAILED` / `FAILED` | 生成图片或划线失败 |

```js
try { await be.highlight({ mesId: 3, text }); }
catch (e) { if (e.code === 'NO_MESSAGE') toastr.info('请先翻到那一楼'); }
```

---

## 4. 注意事项

- **不要缓存接口对象。** 酒馆助手热更新时，书摘会换成新的对象。每次调用前都用 `host.BookExcerpt` 现取，开销可以忽略。用 `on()` 注册的监听器在书摘重载后仍然有效，不用重新注册。
- 返回的笔记都是**副本**，改了不会写回书摘。要修改请调用对应的方法。
- `highlight` 要求那一楼已经渲染在页面上，文字要和正文显示的一致。如果 AI 回复里带格式标签，用显示出来的文字，不要用源码。
- `renderCardImage` 会占用几百毫秒到几秒，请不要在循环里连续调用。
- 书摘的界面都是用户可见的弹窗。请只在用户主动操作时调用 `openCard` / `openNotebook`，不要在后台自动弹出。

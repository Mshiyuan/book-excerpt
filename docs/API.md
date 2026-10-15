# 书摘 对外接口说明

> 写给想让自己的扩展或脚本和「书摘」配合使用的作者。看不懂代码也没关系，可以把这份文档和 [API_AI.md](API_AI.md) 一起发给 AI，让它帮你写。

## 这是什么

从 v1.6.0 起，书摘在酒馆页面上放了一个叫 `BookExcerpt` 的「遥控器」。

别的扩展或脚本拿到这个遥控器，就能让书摘做事，比如给一句话划线、写想法、生成书摘卡片、打开笔记本。

- 你**不需要**复制书摘的代码，按遥控器上的按钮就行。
- 书摘以后更新了，遥控器的用法不变，你那边不用跟着改。
- 用户没装书摘时，遥控器不存在，你把相关按钮藏起来就行。

## 免责声明

通过这个接口做出来的东西（生成的图片、写进笔记本的内容、你的扩展本身的功能），由调用它的扩展或脚本作者自己负责，书摘作者不承担责任。

---

## 第一步：找到遥控器

遥控器放在酒馆的主页面上，写法取决于你的代码跑在哪里：

- **酒馆扩展**：就在 `window` 上。
- **酒馆助手脚本**：脚本跑在一个小框（iframe）里，要去外面一层 `window.parent` 找。

下面这段两种情况都能用，直接复制：

```js
const host = window.parent ?? window;

// 取遥控器：书摘装了就返回它，没装返回 null
function getBookExcerpt() {
  const be = host.BookExcerpt;
  return be && be.apiVersion >= 1 ? be : null;
}

// 书摘可能比你晚启动：先找一次，找不到就等它喊「我好了」，最多等 10 秒
function waitBookExcerpt(timeout = 10000) {
  return new Promise((resolve) => {
    if (getBookExcerpt()) return resolve(getBookExcerpt());
    const onReady = () => resolve(getBookExcerpt());
    host.addEventListener('book-excerpt:ready', onReady, { once: true });
    setTimeout(() => { host.removeEventListener('book-excerpt:ready', onReady); resolve(getBookExcerpt()); }, timeout);
  });
}

const be = await waitBookExcerpt();
if (!be) {
  // 用户没装书摘：把你的「划线」「做成书摘」之类的按钮藏起来
}
```

遥控器上有两个版本号：

- `be.version`：书摘本身的版本，比如 `"1.6.0"`。
- `be.apiVersion`：遥控器的版本，现在是 `1`。以后只是多加按钮，它不会变；只有旧按钮的用法变了，才会变成 `2`。判断能不能用，看这个就行。

---

## 第二步：按按钮

下面每个例子都可以单独复制使用。

### 给某一楼的一段话划线

```js
const note = await be.highlight({
  mesId: 12,                   // 第几楼。酒馆从 0 开始数，所以屏幕上显示的第 13 楼这里写 12
  text: '说没关系，是骗她的',    // 那一楼里的原话，要和屏幕上显示的一字不差
  style: 'marker',             // 可选，划线样子：'underline' 下划线 / 'marker' 荧光笔 / 'wavy' 波浪线
  color: '#f5c97a',            // 可选，颜色
  thought: '这里好难过'         // 可选，顺便写一条想法
});
// note.id 是这条笔记的编号，后面写想法、跳转都要用它
```

### 写想法

```js
await be.addThought(note.id, '第二遍看又有新的感觉');   // 直接写进去
await be.openThoughtEditor(note.id);                    // 或者打开书摘的输入框，让用户自己写
```

### 生成书摘卡片

```js
// 打开书摘的卡片窗口，用户可以自己换模板、改出处、保存图片
await be.openCard({
  text: '说没关系，是骗她的，也是骗他自己的。',
  thought: '可选的想法',
  source: { title: '书名', chapter: '第三章', author: '作者', user: '摘录人' }  // 可选，只用这一次，不会改用户的设置
});

// 不弹窗口，直接拿到图片（用用户当前选的模板、配色、字体）
const blob = await be.renderCardImage({ text: '……', thought: '……', scale: 3 });
img.src = URL.createObjectURL(blob);
```

### 打开笔记本、随机回顾、跳回原文

```js
await be.openNotebook();                         // 打开笔记本首页
await be.openNotebook({ charKey: 'xxx.png' });   // 直接打开某个角色的笔记
await be.openReview();                           // 打开随机回顾
await be.jumpToNote(note.id);                    // 跳回这条划线所在的楼层
```

### 读笔记

```js
const { charKey, chatId } = be.getContext();             // 现在打开的是哪个角色、哪个聊天
const notes = await be.getNotes({ charKey, chatId });    // 这两个条件都可以不填，不填就是全部
```

### 书摘有变化时通知我

```js
const stop = be.on('highlight:created', ({ note }) => { /* 用户刚划了一条 */ });
be.on('note:changed', () => { /* 笔记有增删改，需要的话重新 getNotes() */ });
be.on('card:saved', ({ fileName }) => { /* 用户保存了一张卡片 */ });
stop();   // 不想再听了就调用它
```

---

## 所有按钮一览

除了 `getContext`、`on`、`off`、`isReady` 会马上返回，其他都要在前面加 `await`。

| 按钮 | 作用 |
|---|---|
| `version` / `apiVersion` | 书摘版本 / 遥控器版本 |
| `isReady()` | 永远是 `true`（拿得到遥控器就说明书摘已经准备好） |
| `getContext()` | 现在打开的角色和聊天：`{ charKey, charName, userName, chatId }` |
| `getNotes({ charKey?, chatId? })` | 读笔记列表，从旧到新 |
| `getNote(noteId)` | 读一条笔记，没有就返回 `null` |
| `highlight({ mesId, text, ... })` | 划线，返回新笔记 |
| `addThought(noteId, text)` | 写一条想法 |
| `openThoughtEditor(noteId)` | 打开书摘的想法输入框 |
| `openCard({ text 或 noteId, thought?, source? })` | 打开书摘卡片窗口 |
| `renderCardImage({ text, thought?, source?, template?, scale? })` | 不弹窗直接出图，返回图片（Blob）；加 `format: 'dataURL'` 返回文字形式的图片 |
| `openNotebook({ charKey? })` | 打开笔记本 |
| `openReview()` | 打开随机回顾 |
| `jumpToNote(noteId)` | 跳回原来那一楼 |
| `on(事件, 函数)` / `off(事件, 函数)` | 开始 / 停止接收通知 |

### 一条笔记长什么样

```js
{
  id: 'n1728...',          // 编号
  text: '原句',
  thoughts: [{ id, text, ts }],   // 这条下面写过的想法
  thoughtOnly: false,      // true 表示只写了想法、没有划线
  msgId: '12',             // 第几楼（从 0 开始数）
  swipeId: 0,              // 划线时这一楼显示的是第几个回复版本（从 0 开始；v1.6.0 以前的旧笔记没有）
  chatId: '聊天文件名',
  style: 'underline', color: '',
  ts: 1728000000000,       // 什么时候记的（毫秒）
  charKey: 'xxx.png', charName: '角色名'
}
```

### 出错了怎么办

出错时会抛出一个错误，错误上的 `code` 告诉你原因：

| code | 意思 |
|---|---|
| `INVALID_ARGS` | 参数填错了 |
| `NO_MESSAGE` | 这一楼现在不在屏幕上。酒馆只显示最近的若干楼，可以先 `jumpToNote` 或让用户往上翻 |
| `TEXT_NOT_FOUND` | 这一楼里找不到这句话 |
| `NOT_FOUND` | 没有这条笔记 |
| `DISABLED` | 用户在书摘设置里关掉了划线 |
| `RENDER_FAILED` / `FAILED` | 出图或划线失败 |

```js
try {
  await be.highlight({ mesId: 3, text: '某句话' });
} catch (e) {
  if (e.code === 'NO_MESSAGE') toastr.info('请先翻到那一楼');
}
```

---

## 注意事项

- **每次用之前都重新拿遥控器**（`host.BookExcerpt`），不要存起来反复用。书摘重新加载后会换一个新的遥控器，旧的就不灵了。用 `on()` 注册的通知不受影响，不用重新注册。
- 拿到的笔记是**复印件**，改了不会影响书摘里的数据。要改请用对应的按钮。
- 划线时，那一楼必须正在屏幕上，文字要和屏幕上显示的一致。如果 AI 回复里有格式标签，用显示出来的字，不要用源码。
- 出图要花零点几秒到几秒，不要在循环里一口气调用很多次。
- 打开窗口的按钮（`openCard`、`openNotebook`、`openReview`、`openThoughtEditor`、`jumpToNote`）请只在用户点了你的按钮之后再用，不要自己突然弹出来。

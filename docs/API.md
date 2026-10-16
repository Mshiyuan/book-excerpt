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

## 第三步（可选）：接入你自己的阅读界面

上面的按钮只认酒馆聊天区里正在显示的楼层。如果你的脚本有**自己的阅读界面**（比如聊天档案馆的阅读器），可以用下面几个按钮把它接给书摘。这几个按钮是后来加的，用之前先判断有没有：`if (be.attachReader) { ... }`，没有就退回原来的做法。

### 承接器 attachReader：在你的阅读界面里直接用书摘

```js
const reader = be.attachReader({
  id: 'my-reader',                    // 起个名字。同名再登记一次会覆盖旧的（你的脚本重载时直接再登记就行）
  root: () => document.querySelector('#my-reader .page'),   // 阅读区域。可以是元素，也可以是返回元素的函数（区域会整块重画时用函数）
  message: '.floor',                  // 一楼对应的元素
  text: '.floor-text',                // 可选：一楼里正文所在的元素，不填就是整楼。只有这里面的字能划线
  mesId: el => el.dataset.floor,      // 可选：这一楼是第几楼（从 0 开始，和酒馆一致）。不填就读 mesid / data-mesid / data-floor
  context: () => ({                   // 这一页读的是谁的哪个存档。返回 null 表示现在没在读
    charKey: 'xxx.png',               // 角色卡文件名，和酒馆一致
    charName: '角色名',
    charAvatar: '/thumbnail?type=avatar&file=xxx.png',   // 可选，卡片头像
    chatId: '存档名（不带 .jsonl）'
  }),
  jump: async (note) => { /* 可选：把你的阅读器滚到 note.msgId 那一楼 */ }
});

reader.refresh();   // 可选：你重画了内容想让划线马上补上（不调也行，书摘自己会盯着）
reader.detach();    // 不用了（关闭阅读器 / 脚本卸载时）
```

登记以后：

- 用户在阅读区域里选字，会弹出书摘自己的浮动栏：划线、想法、书摘卡片、点划线弹工具栏、加入合并都能用，和在聊天里一样。
- 划线记在 `context()` 给的角色和存档下面，楼层号由 `mesId` 给。**charKey 和 chatId 跟酒馆一致的话，在阅读器里划的线，回到真聊天里也看得到，反过来也一样。**
- 只有从阅读器里发起的那一次操作（划线、写想法、打开的那张卡片）用阅读器的角色；卡片关掉以后，其他地方照旧用酒馆当前的角色。`getContext()` 永远返回酒馆当前聊天。
- 阅读器整块重画以后，书摘会自己把划线补回去。
- 笔记本里点「跳回原文」：如果阅读器正开着，而且读的就是这条笔记所在的存档，就调用你的 `jump(note)`，在阅读器里跳；否则照旧去酒馆聊天里跳。
- 书摘热重载以后登记还在，不用重新登记。
- 没有任何脚本登记时，书摘不会多跑任何东西。

### 嵌入笔记本 mountNotebook

```js
await be.mountNotebook(container, {
  view: 'notes',                      // 可选：'notes' 笔记本首页 / 'review' 随机回顾 / 'settings' 设置
  charKey: 'xxx.png',                 // 可选：直接打开某个角色
  onClose: () => { /* 书摘想关掉笔记本时（比如跳回原文前）会调用它，你决定怎么收起你的页面 */ }
});
await be.unmountNotebook();           // 离开页面时调用，笔记本还给书摘
```

- 嵌入时会隐藏书摘自己的 × 按钮。
- 容器不在页面上或被隐藏时，`openNotebook()` 照旧浮着弹出，不会弹进看不见的容器里。
- 想让配色跟你的页面一致，可以在 `#你的容器 > #be-panel.be-embedded` 上覆盖 `--be-panel-bg`、`--be-panel-fg` 等变量。

### 浮动栏加按钮 addSelectionButton

```js
const remove = be.addSelectionButton({
  id: 'my-edit',                      // 同名覆盖
  label: '修改',
  icon: 'fa-solid fa-pencil',         // 可选：Font Awesome 的 class
  where: 'chat',                      // 可选：'chat' 只在聊天里 / 'reader' 只在承接器里 / 'all'（默认）
  onClick: ({ text, range, frame, mesId, readerId }) => { /* 用户选的字、选区、所在楼层 */ }
});
remove();   // 或 be.removeSelectionButton('my-edit')
```

### 卡片指定角色 context

`openCard` 和 `renderCardImage` 可以多传一个 `context`，指定这张卡用哪个角色的名字和头像，只对这一张卡生效：

```js
await be.openCard({ text: '……', context: { charName: '角色名', charAvatar: '/thumbnail?type=avatar&file=xxx.png' } });
```

### 承接器的限制

- 阅读界面要渲染在酒馆主页面里，是普通的页面元素。**放在 iframe 或 Shadow DOM 里的内容接不了**（书摘拿不到里面的选区），比如美化状态栏那种小框里的字。
- 书摘划线时会往正文里插入 `<span>`。如果你的阅读界面用 Vue / React 这类框架管理正文，框架下次更新这段 DOM 时可能把划线刷掉（书摘会自动补回），个别情况下框架可能报错。建议正文部分用普通的 `innerHTML` 渲染。
- 划线还原是按文字找的：阅读器和聊天区的显示不一样时（正则美化、HTML 状态栏、Markdown 渲染差异），一边划的线在另一边可能找不到。笔记本身不受影响。
- 同一楼里同一句话出现好几次时，还原到第一处（聊天里也是这样）。
- 只有阅读器读的正好是酒馆当前打开的那个聊天时，才会记 `swipeId`。
- 如果你的阅读界面自己也有选字工具栏，接入后两个工具栏会同时出现，建议接入书摘时把自己的收起来，或者用 `addSelectionButton` 把你的功能放进书摘的浮动栏。

---

## 所有按钮一览

除了 `getContext`、`on`、`off`、`isReady`、`attachReader`、`detachReader`、`refreshReader`、`addSelectionButton`、`removeSelectionButton` 会马上返回，其他都要在前面加 `await`。

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
| `openCard({ text 或 noteId, thought?, source?, context? })` | 打开书摘卡片窗口 |
| `renderCardImage({ text, thought?, source?, context?, template?, scale? })` | 不弹窗直接出图，返回图片（Blob）；加 `format: 'dataURL'` 返回文字形式的图片 |
| `openNotebook({ charKey? })` | 打开笔记本 |
| `openReview()` | 打开随机回顾 |
| `jumpToNote(noteId)` | 跳回原来那一楼 |
| `on(事件, 函数)` / `off(事件, 函数)` | 开始 / 停止接收通知 |
| `attachReader(设置)` / `detachReader(id)` / `refreshReader(id?)` | 登记 / 取消 / 刷新承接器（见第三步，马上返回） |
| `mountNotebook(容器, 设置?)` / `unmountNotebook()` | 把笔记本嵌进你的页面 / 还回去 |
| `addSelectionButton(设置)` / `removeSelectionButton(id)` | 往浮动栏加 / 删按钮（马上返回） |

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
| `INVALID_ARGS` | 参数填错了。`attachReader`、`addSelectionButton` 参数不对时直接抛出（它们不是 Promise） |
| `NO_MESSAGE` | 这一楼现在不在屏幕上。酒馆只显示最近的若干楼，可以先 `jumpToNote` 或让用户往上翻 |
| `TEXT_NOT_FOUND` | 这一楼里找不到这句话 |
| `NOT_FOUND` | 没有这条笔记 |
| `DISABLED` | 用户在书摘设置里关掉了划线 |
| `RENDER_FAILED` / `FAILED` | 出图或划线失败（`renderCardImage` 的内部错误，比如截图库加载失败，统一是 `RENDER_FAILED`） |

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
- 用了承接器或浮动栏按钮的，你的脚本卸载时请 `detach()` / `remove()`；书摘比你晚启动时，在 `book-excerpt:ready` 里再登记一次。

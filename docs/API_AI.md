# BookExcerpt API — spec for AI coding assistants

Concise and normative. Follow it exactly. Human-oriented docs: API.md.

## Access
- Global object: `HOST.BookExcerpt`, where `HOST = window.parent ?? window`.
  - SillyTavern extension: `window`.
  - Tavern Helper script (runs in an iframe): `window.parent`.
- Ready event: `HOST` dispatches `book-excerpt:ready` with `detail = {version, apiVersion}`.
- Feature check: `HOST.BookExcerpt?.apiVersion >= 1`.
- Never cache the object across calls. Re-read `HOST.BookExcerpt` each time, because it is replaced on hot reload.
- Listeners registered with `on()` survive reloads.
- The object is frozen.
- Do NOT bundle or copy BookExcerpt source code; its license forbids it. Call this API instead.

## Types
```ts
type Note = {
  id: string; type: 'highlight'; text: string;
  thoughts: { id: string; text: string; ts: number }[];
  thoughtOnly: boolean;            // true = thought without underline
  msgId: string;                   // message index as string ('0'-based), may be ''
  swipeId?: number;                // swipe shown when created (absent on pre-1.6.0 notes)
  chatId: string; style: 'underline'|'marker'|'wavy'|string; color: string;
  ts: number;                      // ms epoch
  charKey: string; charName?: string;
};
type Source = { user?: string; author?: string; title?: string; chapter?: string };
type ApiError = Error & { code: 'INVALID_ARGS'|'NO_MESSAGE'|'TEXT_NOT_FOUND'|'NOT_FOUND'|'DISABLED'|'RENDER_FAILED'|'FAILED' };
```

## Members
Methods return Promise except `isReady`, `getContext`, `on`, `off`.

| member | signature | notes |
|---|---|---|
| version | `string` | e.g. "1.6.0" |
| apiVersion | `number` | 1; bumps only on breaking change |
| isReady | `() => true` | |
| getContext | `() => {charKey, charName, userName, chatId}` | current ST character/chat |
| getNotes | `(f?: {charKey?, chatId?}) => Promise<Note[]>` | oldest first; deep copies |
| getNote | `(noteId) => Promise<Note \| null>` | |
| highlight | `(o: {mesId:number\|string, text:string} \| {range:Range, text?}, + {style?, color?, thoughtOnly?, thought?}) => Promise<Note>` | `text` must appear verbatim in the rendered `.mes[mesid=N] .mes_text` (rendered text, not source markup); may span elements |
| addThought | `(noteId, text) => Promise<Note>` | |
| openThoughtEditor | `(noteId) => Promise<void>` | opens UI |
| openCard | `(o: {text?:string, noteId?:string, thought?:string, source?:Source, editable?:boolean}) => Promise<void>` | opens card modal; `source` applies to this card only and is not saved |
| renderCardImage | `(o: {text:string, thought?, source?:Source, template?:string, scale?:1-5, format?:'blob'\|'dataURL'}) => Promise<Blob\|string>` | no UI; PNG; width = user card width × scale; slow (0.3–3 s), do not call in tight loops |
| openNotebook | `(o?: {charKey?}) => Promise<void>` | |
| openReview | `() => Promise<void>` | random review view |
| jumpToNote | `(noteId) => Promise<void>` | scrolls chat to the note's message; may ask the user to switch chat |
| on | `(event, fn) => unsubscribe` | events below |
| off | `(event, fn) => void` | |

## Events
Delivered both through `on(event, fn)` and as DOM `CustomEvent('book-excerpt:'+event)` on `HOST`.

| event | detail |
|---|---|
| `highlight:created` | `{note: Note}` |
| `note:changed` | `{}`; debounced; call `getNotes()` to refresh |
| `card:saved` | `{fileName: string, mode: 'download'\|'popup'}` |

## Errors
All are rejections with `.code`.

| code | condition |
|---|---|
| `INVALID_ARGS` | bad or missing arguments |
| `NO_MESSAGE` | message `mesId` not rendered in the DOM (ST renders only recent messages) |
| `TEXT_NOT_FOUND` | text not present in that message |
| `NOT_FOUND` | unknown noteId |
| `DISABLED` | user turned highlighting off |
| `RENDER_FAILED` / `FAILED` | internal failure |

## Rules
1. Feature-detect, and degrade silently if BookExcerpt is absent.
2. Call UI-opening methods (`openCard`, `openNotebook`, `openReview`, `openThoughtEditor`, `jumpToNote`) only in response to a user action.
3. Treat returned objects as read-only copies. Mutate only through API methods.
4. Gate on `apiVersion`, not `version`.

## Minimal template
```js
const HOST = window.parent ?? window;
const BE = () => (HOST.BookExcerpt?.apiVersion >= 1 ? HOST.BookExcerpt : null);
async function ready(ms = 10000) {
  if (BE()) return BE();
  return new Promise(r => { const t = setTimeout(() => r(BE()), ms); HOST.addEventListener('book-excerpt:ready', () => { clearTimeout(t); r(BE()); }, { once: true }); });
}
// usage
const be = await ready();
if (be) {
  try { const n = await be.highlight({ mesId: 5, text: '原文片段' }); await be.addThought(n.id, '想法'); }
  catch (e) { console.warn(e.code, e.message); }
}
```

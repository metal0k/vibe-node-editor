# Spec — Vibe Node Editor (web-клон LazNodeEditor)

> Источник требований: `spec.md` + `UI_Protoype.jpg` + интервью 2026-05-17.
> Цель: интерактивный prototype web-нод-редактор по мотивам LazNodeEditor Demo, развёрнутый на GitHub Pages.
>
> **Статус: ✅ Реализовано и задеплоено** (2026-05-17).
> Live: <https://metal0k.github.io/vibe-node-editor/>
> Repo: <https://github.com/metal0k/vibe-node-editor>
> Дополнительные итерации после первого деплоя: см. §15.

---

## 1. Обзор

Web-приложение — упрощённый аналог desktop-редактора нод (LazNodeEditor). Граф состоит из узлов с типизированными портами, связанных безье-кривыми. Граф **реактивно вычисляется**: изменение исходного значения каскадно обновляет downstream-ноды. Граф можно валидировать, сохранять/загружать в JSON, шарить через URL и автоматически сохранять в localStorage.

Стек: **Vite + vanilla JS (ESM) + LiteGraph.js + custom CSS**. Никакого фреймворка (React/Vue) — только лёгкая обёртка вокруг LiteGraph для тулбара, Inspector, темы и persistence.

Целевая аудитория: desktop-пользователи, мышь+клавиатура. Touch не поддерживается.

---

## 2. Архитектурные решения (с обоснованием)

| Решение | Выбор | Почему |
|---|---|---|
| Canvas-движок | **LiteGraph.js 0.7.18** | Встроенный execution engine (`onExecute`), типизированные порты, JSON сериализация, базовая валидация. Минимум кода нашими руками. |
| Стек | **Vite 8 + npm + vanilla ESM** | Современный dev UX, hot-reload, удобный билд для gh-pages. |
| Хостинг | **GitHub Pages** репо `metal0k/vibe-node-editor` (предсоздан пользователем); деплой через `gh-pages` пакет в ветку `gh-pages` | PAT в `.env` не имел `workflow` scope → GitHub Action workflow-файл нельзя было запушить. Запасной механизм: `npm run deploy` собирает + пушит `dist/` в `gh-pages` branch. GitHub Pages автоматически подцепил branch source. |
| Тема | **Light + dark toggle**, перс. в `localStorage('vibe:theme')`, fallback на `prefers-color-scheme`, default = dark | Dark — стандарт для node-editor; light переделан под cool-neutral (Linear/Vercel) после первой итерации. |
| Mobile | **Не поддерживается** | LiteGraph плохо умеет touch. На <768px показываем баннер «desktop only». |
| Стилизация | **frontend-design skill** (две итерации) | Первая итерация: «Tactile Blueprint» (амбер brand + насыщенные node-headers). Вторая: приглушённые tag-цвета + cool-neutral light. |
| Контраст | **WCAG AA enforced** через `tests/e2e/contrast.spec.js` | Тест обходит весь DOM + проверяет canvas-цвета через LiteGraph globals. Ratio >= 4.5 для нормального текста, >= 3.0 для UI/large. |

---

## 3. UI / лаяут

```
┌────────────────────────────────────────────────────────────────┐
│ TOPBAR: Save JSON | Load JSON | Fit Selection | Frame All |    │
│         Validate | [theme toggle]            Selected nodes: N │
├──────────┬─────────────────────────────────────────────────────┤
│          │                                                     │
│ INSPECTOR│                  CANVAS (LiteGraph)                 │
│          │            grid bg, pan, zoom, multi-select         │
│ (адапт.  │                                                     │
│  по типу │                                                     │
│  ноды)   │                                                     │
│          │                                                     │
└──────────┴─────────────────────────────────────────────────────┘
```

### 3.1 Топбар
- Save JSON → download `graph-YYYYMMDD-HHmmss.json`
- Load JSON → file picker (`.json`)
- Fit Selection → zoom-to-fit выбранных нод
- Frame All → zoom-to-fit всего графа
- Validate → запуск валидатора (см. §5)
- Theme toggle (☀/🌙)
- Счётчик «Selected nodes: N» (live)

**Undo/Redo не включаются в MVP** (явно убраны из UI). Зарезервировано на v1.

### 3.2 Inspector (левая панель, ширина ~260px)
Адаптивный по типу выделенной ноды. Все поля редактируемые, **live two-way sync** с canvas (изменение X в inspector сразу двигает ноду и наоборот).

| Тип ноды | Поля Inspector |
|---|---|
| Любая | `name`, `x`, `y`, `width`, `height` |
| Value | + `value` (number) |
| Multiply / Default | (только базовые поля) |
| Comment | + `comment` (textarea) |

При выделении нескольких нод — Inspector показывает только общие поля (name пустое, координаты пустые) и позволяет batch-edit width/height.

### 3.3 Canvas
- Pan: drag средней кнопкой мыши / Space+drag ЛКМ
- Zoom: колесо мыши (в точку курсора)
- Select: ЛКМ
- Multi-select: Shift+click, box-select (drag по пустому месту)
- Context menu (ПКМ на пустом месте): подменю «Add node» → Value / Multiply / Default / Comment
- Context menu (ПКМ на ноде): Delete, Duplicate, Rename
- Drag-and-drop connection: тянем от output к input (или наоборот), отпускаем — создаётся link
- Delete клавиша: удаляет выделенные ноды и связи

---

## 4. Типы нод (MVP)

| Тип | Заголовок (цвет) | Inputs | Outputs | Поведение |
|---|---|---|---|---|
| **Value** | зелёный | — | `Value : number` | Хранит число, редактируется через Inspector (или inline-widget на ноде). На output выдаёт текущее значение. |
| **Multiply** | синий | `A : number`, `B : number` | `Result : number` | `Result = A * B`. Если вход не подключён — считается 0 (или показать N/A). |
| **Default Node** | бирюзовый | `In : any` | `Out : any` | Pass-through. Передаёт значение со входа на выход без модификации. |
| **Comment / Math Block** | светло-голубая заливка + рамка | — | — | Без портов. Заголовок + textarea. Не участвует в графе исполнения. Можно ресайзить, оборачивает другие ноды визуально (z-index ниже). |

Типы портов — используем номенклатуру LiteGraph (`"number"`, `"string"`, `"*"` для any). В MVP реально работаем только с `number` и `*`. Валидация различает типы.

---

## 5. Валидация (кнопка Validate)

Открывает overlay-панель с результатами. Подсвечивает проблемы прямо на canvas.

1. **Поиск циклов** (DFS по направленному графу). Все ноды в цикле подсвечиваются красной обводкой; в overlay — список циклов.
2. **Проверка типов портов** (number↔number и any↔* допустимы; number↔string — нет). Несовместимые links подсвечиваются красным.
3. **Висячие входы**: input-порты без подключённой связи — подсвечиваются жёлтым (warning, не error).
4. Если всё ок — toast «Graph is valid» зелёный.

---

## 6. Исполнение графа (реактивность)

- Используем LiteGraph `LGraph` с `start()` в режиме **только-по-событию** (не fixed-rate loop).
- При любом изменении (новая связь, новое значение Value, удаление link) — запуск топологического обхода downstream.
- На каждой ноде вызываем `onExecute()`, который читает входы и пишет на выходы.
- Возле output-портов отображается текущее значение (текстовый бейдж).
- Если найден цикл — реактивный пересчёт останавливается на цикле, в overlay-логе пишется warning.

---

## 7. Persistence

Четыре уровня:

1. **Save JSON** — download файл `vibe-graph-{timestamp}.json` (LiteGraph `graph.serialize()`).
2. **Load JSON** — file picker, парсинг + `graph.configure(data)`.
3. **localStorage autosave** — debounced (300ms) сохранение в ключ `vibe-node-editor:graph`. Восстановление при загрузке страницы.
4. **URL share** — кнопка «Share» (или Ctrl+Shift+C) кодирует граф в base64 → URL hash `#g=<base64>`. При загрузке: если в URL есть hash — загружаем из него (приоритет выше localStorage).

**Стартовый sample-граф**: при первой загрузке (нет localStorage и нет hash) показываем граф со скрина — `Value A=3 → Multiply.A`, `Value B=4 → Multiply.B`, `Multiply.Result → Default.In`, `Default.Out → Multiply(Custom).A`, второй вход у Multiply(Custom) пустой, плюс Comment-блок «Math Block / Multiply A * B here.»

---

## 8. Keyboard shortcuts

| Shortcut | Действие |
|---|---|
| `Delete` | Удалить выделенные ноды/связи (Backspace убран после code review — слишком destructive без Undo) |
| `Ctrl+S` | Save JSON (предотвращает default browser save) |
| `Ctrl+O` | Open file picker для Load JSON |
| `Ctrl+A` | Select all |
| `Ctrl+D` | Duplicate selected |
| `F` | Frame All |
| `Shift+F` | Fit Selection |
| `Space + drag` | Pan |
| `Esc` | Снять выделение |

---

## 9. Структура проекта

```
vibe-node-editor/
├── index.html                     # topbar + inspector + canvas + status badge
├── vite.config.js                 # base: '/vibe-node-editor/'
├── playwright.config.js           # webServer = vite preview, baseURL via env
├── package.json
├── README.md
├── src/
│   ├── main.js                    # точка входа: theme → toolbar → editor → inspector → validator → persistence
│   ├── editor/
│   │   ├── setup.js               # init LiteGraph, context menu override, reactivity hooks (idempotent)
│   │   ├── sample-graph.js        # JS builder (не .json) для стартового графа со скрина
│   │   ├── persistence.js         # save/load JSON + localStorage autosave + base64 URL hash + Fit/Frame
│   │   ├── validator.js           # DFS циклы + типы портов + висячие inputs + overlay подсветка
│   │   ├── shortcuts.js           # Delete/Ctrl+S/O/A/D/F/Shift+F/Esc, skip when typing
│   │   ├── node-theme.js          # пушит CSS-токены в LiteGraph globals (NODE_TEXT_COLOR,
│   │   │                          #   NODE_BOX_OUTLINE_COLOR, WIDGET_*, etc.) — reactive on theme change
│   │   └── nodes/
│   │       ├── index.js           # registerAllNodes + удаление дефолтных LiteGraph типов
│   │       ├── value.js           # Value → number widget + output
│   │       ├── multiply.js        # A × B = Result, draws amber badge
│   │       ├── default.js         # In → Out pass-through, draws value badge
│   │       └── comment.js         # без портов, custom drawBackground/Foreground
│   ├── ui/
│   │   ├── theme.js               # localStorage + prefers-color-scheme + custom event
│   │   ├── toolbar.js             # DOM кнопок, toast helper, selected-count
│   │   └── inspector.js           # адаптивная форма, two-way binding (rAF on canvas drag/resize)
│   └── styles/
│       ├── tokens.css             # CSS-переменные: light/dark + canvas-* (badge, comment)
│       ├── app.css                # топбар, кнопки, canvas-wrap, toast, mobile guard
│       └── inspector.css          # формы, секции, type-badge
└── tests/e2e/
    ├── smoke.spec.js              # загрузка, canvas, sample-граф, нет console errors
    ├── add-node.spec.js           # ПКМ → Add Node → Value создаёт ноду
    ├── connect-ports.spec.js      # drag port→port через node.getConnectionPos
    ├── reactive-and-roundtrip.spec.js  # 3 теста: реактивность, configure round-trip, Save JSON download
    └── contrast.spec.js           # 4 теста: WCAG AA DOM + canvas × dark + light
```

**`.github/workflows/deploy.yml`** — спроектирован, но НЕ в git: токен в `.env` не имеет `workflow` scope. Файл готов в спецификации (см. §10.2) — добавить через web UI или re-issue PAT с `workflow` scope.

---

## 10. Деплой

### 10.1 Фактический механизм — `gh-pages` package (используется сейчас)

Токен в `.env` имеет только `repo` scope, не `workflow`. Поэтому GitHub Action workflow-файл нельзя запушить через git, и используем альтернативу:

```bash
npm run deploy
# → npm run build
# → gh-pages -d dist -b gh-pages -m "deploy: <ISO timestamp>"
```

- `gh-pages` npm-пакет пушит содержимое `dist/` в ветку `gh-pages` (force-overwrite).
- GitHub Pages auto-detect: при первом push в `gh-pages` branch Pages сам активируется с source = `gh-pages /`.
- URL: <https://metal0k.github.io/vibe-node-editor/>
- Vite `base: '/vibe-node-editor/'`.

### 10.2 Идеальный механизм — GitHub Action (готов к включению)

Файл `.github/workflows/deploy.yml` (НЕ в git, см. §9):

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Чтобы активировать: re-issue PAT с `workflow` scope ИЛИ добавить файл через GitHub web UI. Затем в Settings → Pages переключить source с `gh-pages` branch на `GitHub Actions`.

---

## 11. E2E тестирование (Playwright)

Chromium-only. Локально стартует `vite preview` на `:4173`. Production smoke использует `PLAYWRIGHT_BASE_URL`. **Все 10 тестов зелёные** локально и на prod URL.

### Сценарии

| Spec | Тестов | Описание |
|---|---|---|
| `smoke.spec.js` | 1 | Страница загружается, canvas/topbar/inspector видны, sample-граф ≥5 нод и ≥3 связи, нет console errors |
| `add-node.spec.js` | 1 | ПКМ → «Add Node» → «Value» → новая нода в графе |
| `connect-ports.spec.js` | 1 | Drag от Value A output к новому Multiply input (через `node.getConnectionPos`) создаёт link |
| `reactive-and-roundtrip.spec.js` | 3 | (a) Value A=7 → Multiply.\_lastResult обновился; (b) serialize→configure→serialize сохраняет топологию; (c) Save JSON триггерит download с правильным именем |
| `contrast.spec.js` | 4 | DOM + canvas WCAG AA × dark + light. Обходит все видимые text-элементы, считает ratio против alpha-композитного фона; canvas-проверка читает LiteGraph globals + CSS-токены. Включает selected-node outline. |

### Запуск
```bash
# локально (build → preview → tests)
npm run test:e2e

# headed для отладки
npm run test:e2e:headed

# smoke против prod
PLAYWRIGHT_BASE_URL=https://metal0k.github.io/vibe-node-editor/ \
  npx playwright test smoke.spec.js contrast.spec.js
```

### Важная деталь
В spec-файлах используется `page.goto('./')`, НЕ `'/'` — иначе на проде путь `/vibe-node-editor/` теряется и тесты ходят в user-root.

---

## 12. Workflow реализации (выполнено)

1. ✅ **frontend-design skill** — две итерации: «Tactile Blueprint» базовый дизайн, затем приглушение/cool-neutral light (см. §15).
2. ✅ **Реализация** — 11 этапов (см. план в `~/.claude/plans/sequential-mixing-yao.md`), коммит per этап с approval.
3. ✅ **Code review** через `voltagent-qa-sec:code-reviewer` — нашёл 14 пунктов, 12 high/medium priority устранены.
4. ✅ **Playwright e2e** — 6 функциональных тестов локально + 4 contrast-теста, smoke на prod.
5. ✅ **Deploy** на GitHub Pages через `gh-pages` пакет (fallback к Action из-за токена).

Цикл итераций цветов после первого деплоя:
- Палитра редизайнена (frontend-design skill, итерация 2): muted node-headers + cool-neutral light theme.
- Контрастные регрессии найдены тестом (`contrast.spec.js`): inspector section titles, btn--primary в light, canvas badge/comment в light. Пофикшены.
- Selection outline невидим в light (LiteGraph дефолт `#FFF`) — пофикшен через `LiteGraph.NODE_BOX_OUTLINE_COLOR = v('--selection')`.

---

## 13. Acceptance criteria

- [x] Открывается <https://metal0k.github.io/vibe-node-editor/> без console errors.
- [x] Виден стартовый sample-граф (если нет сохранённого).
- [x] Можно добавить ноду через ПКМ-меню и соединить порты.
- [x] Inspector синхронизирован с canvas в обе стороны.
- [x] Реактивный пересчёт: меняем Value → Result обновляется.
- [x] Validate находит созданный вручную цикл и подсвечивает.
- [x] Save → reload страницы → граф восстановлен из localStorage.
- [x] Save JSON → файл скачивается; Load JSON → граф загружается.
- [x] Share URL генерирует ссылку; открытие ссылки восстанавливает граф.
- [x] Theme toggle переключает dark/light и сохраняет выбор.
- [x] Все 10 Playwright e2e тестов зелёные локально (6 функциональных + 4 contrast).
- [x] Smoke e2e против production URL зелёный.
- [x] WCAG AA контраст во всех видимых местах в обеих темах.

---

## 14. Out of scope для MVP

- Undo/Redo (явно убран по решению; вернуть в v1)
- Touch / mobile поддержка
- Аутентификация, multi-user, real-time collab
- Custom node creation в UI (пользователь создаёт только из встроенных типов)
- Экспорт в код / generated artifacts
- Subgraphs / группировка
- История / autosave-история (только последний снимок в localStorage)
- Поиск по нодам
- Минимап
- GitHub Action автодеплой (см. §10.2 — ждёт `workflow`-scope токен)

---

## 15. Дизайн-итерации (после первого деплоя)

### 15.1 Итерация 2 — приглушение и cool-neutral light

Триггер: первая итерация была слишком сатурирована (neon-зелёные/синие headers, warm blueprint paper). Запрос: «Linear/Vercel-стиль, приглушённее».

**Цвета нод** (HSL 17–22% saturation):

| Тип | Dark было → стало | Light было → стало |
|---|---|---|
| Value | `#22c55e` → `#5e8a72` (muted sage) | `#16a34a` → `#4d7762` |
| Multiply | `#3b82f6` → `#5d6f92` (muted indigo) | `#1d4ed8` → `#4e5e80` |
| Default | `#14b8a6` → `#5d8585` (muted teal) | `#0d9488` → `#4d7070` |

**Light тема — переписана с warm paper на cool-neutral**:
- bg: `#f3f1ea` → `#f7f8f9` (Vercel-like cool gray)
- panels: `#faf8f3` → `#ffffff`
- borders: warm `#d9d4c5` → cool `#e6e8ec`
- text: `#1a1d22` → `#15181d` (slight cool cast)
- accent: `#b8860b` → `#8a6300` (AA-readable на белом)
- grid-dot: blueprint-blue → cool gray
- shadows: warm → cool

### 15.2 Контрастные регрессии (найдено через `contrast.spec.js`)

| Место | Тема | Было | Стало |
|---|---|---|---|
| Inspector section titles | dark/light | 2.34 / 2.63 | 5.4 / 4.8 (`--text-faint` → `--text-muted`) |
| Brand `.` separator | light | 4.19 | 8.0+ (accent углублён `#a17400`→`#8a6300`) |
| `.btn--primary` text | light | 3.58 | 5.47 (новый `--accent-text` token: dark/white per theme) |
| Canvas amber result badge | light | 1.45 | 5.43 (новый `--canvas-badge-text` token) |
| Comment title amber | light | 1.42 | 7.10 (новый `--canvas-comment-title` token) |
| Comment body light-gray | light | 1.09 | 16.73 (новый `--canvas-comment-body` token) |
| Selected-node outline | light | invisible (white) | 3.55 teal (LiteGraph `NODE_BOX_OUTLINE_COLOR`) |

### 15.3 Архитектурные изменения для контраста

- Multiply/Default/Comment ноды читают цвета через `getComputedStyle(document.documentElement).getPropertyValue('--canvas-*')` вместо хардкода. Реактивно меняются при переключении темы.
- `node-theme.js` пушит в LiteGraph globals: `NODE_TEXT_COLOR`, `NODE_TITLE_TEXT_COLOR`, `NODE_BOX_OUTLINE_COLOR`, `NODE_DEFAULT_BGCOLOR`, `WIDGET_BGCOLOR`, `WIDGET_OUTLINE_COLOR`, `WIDGET_TEXT_COLOR`, `WIDGET_SECONDARY_TEXT_COLOR` — все из CSS-токенов, обновляются на theme change event.
- Новые токены: `--accent-text`, `--canvas-badge-text`, `--canvas-comment-title`, `--canvas-comment-body` per theme.

### 15.4 Финальные контраст-показатели (WCAG AA)

```
              dark              light
node title    3.9-5.1           5.1-6.5
port label    14.4              17.8
widget text   18.5              18.4
result badge  11.1              5.4
comment       9.9 / 12.9        7.1 / 16.7
selection     7.8               3.6
status badge  5.2               5.9
```
Все ≥ требуемого порога (4.5 normal / 3.0 UI/large).

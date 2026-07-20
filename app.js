'use strict';

// ========== 定数 ==========
const APP_VERSION = '2.5';
const STORAGE_KEY = 'routine-board-data';
const COLOR_VALUES = {
  white: '#FFFFFF',
  yellow: '#FBEFC3',
  green: '#DCF2D0',
  blue: '#D9E8F8',
  pink: '#F9DEE7',
  purple: '#EADFF7',
  gray: '#EAEAE6',
};
const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const DATE_STRIP_DAYS = 14;

// ルーティンアイコンのライブラリ（assets/icons/<key>.png）
const ICON_LIB = {
  office: '会社', calendar: 'カレンダー', stretch: 'ストレッチ', toilet: 'トイレ',
  broom: 'そうじ', bottle: '水分', bath: 'おふろ', bed: 'ベッド',
  clock: '時計', pill: 'くすり', coffee: 'コーヒー', book: '本',
  shoes: 'くつ', tooth: '歯みがき', laundry: 'せんたく', tomato: 'トマト',
};

// どうぶつずかん（assets/zoo/<key>.png）。ルーティンチェック1つ=1pt、10ptで1匹
const ZOO_COST = 10;
const ZOO_ANIMALS = [
  { key: 'dog', label: 'いぬ' },
  { key: 'cat', label: 'ねこ' },
  { key: 'rabbit', label: 'うさぎ' },
  { key: 'bear', label: 'くま' },
  { key: 'panda', label: 'ぱんだ' },
  { key: 'fox', label: 'きつね' },
  { key: 'tanuki', label: 'たぬき' },
  { key: 'squirrel', label: 'りす' },
  { key: 'hedgehog', label: 'はりねずみ' },
  { key: 'penguin', label: 'ぺんぎん' },
  { key: 'bird', label: 'ことり' },
  { key: 'owl', label: 'ふくろう' },
  { key: 'frog', label: 'かえる' },
  { key: 'turtle', label: 'かめ' },
  { key: 'sheep', label: 'ひつじ' },
  { key: 'goat', label: 'やぎ' },
  { key: 'cow', label: 'うし' },
  { key: 'chicken', label: 'にわとり' },
  { key: 'duck', label: 'あひる' },
  { key: 'mouse', label: 'ねずみ' },
];

// ToDoファームの発展段階（assets/farm/<key>.png）。needは累計完了数
const FARM_STAGES = [
  { key: 'balcony', label: 'ベランダ菜園', need: 0 },
  { key: 'garden', label: '貸農園', need: 6 },
  { key: 'field', label: '露地栽培', need: 14 },
  { key: 'rainshelter', label: '雨よけ栽培', need: 24 },
  { key: 'greenhouse', label: 'ビニールハウス', need: 36 },
  { key: 'multihouse', label: '連棟ハウス', need: 50 },
  { key: 'smart', label: 'スマート農業', need: 70 },
  { key: 'stand', label: '直売所オープン', need: 95 },
  { key: 'bighouse', label: '大型温室', need: 125 },
  { key: 'tourism', label: '観光農園', need: 160 },
];

// マスコット（トマトのキャラ・生成画像を背景透過に加工したもの）
const MASCOT_SRC = {
  normal: 'assets/mascot-normal.png',
  wave: 'assets/mascot-wave.png',
  cheer: 'assets/mascot-cheer.png',
  pig: 'assets/mascot-pig.png',
};

function mascotImg(pose) {
  const img = el('img');
  img.src = MASCOT_SRC[pose] || MASCOT_SRC.normal;
  img.alt = '';
  return img;
}

function mascotEl(extraClass, pose) {
  const m = el('span', 'mascot' + (extraClass ? ' ' + extraClass : ''));
  m.appendChild(mascotImg(pose));
  return m;
}

// ========== ユーティリティ ==========
const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function todayStr() {
  return fmtDate(new Date());
}

function parseDate(s) {
  const parts = s.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}

// その日を含む週の月曜日
function mondayOf(dateStr) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return fmtDate(d);
}

// offset週分ずらした週の7日分（月〜日）。0=今週、-1=先週
function weekDatesFor(offset) {
  const start = addDays(mondayOf(todayStr()), offset * 7);
  const out = [];
  for (let i = 0; i < 7; i++) out.push(addDays(start, i));
  return out;
}

function fmtMD(dateStr) {
  const d = parseDate(dateStr);
  return (d.getMonth() + 1) + '/' + d.getDate();
}

function jpDateLabel(d) {
  return (d.getMonth() + 1) + '月' + d.getDate() + '日（' + DAY_LABELS[d.getDay()] + '）';
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ========== データ ==========
function defaultState() {
  return {
    version: 1,
    routines: [],
    checks: {},
    todos: [],
    memos: {},   // 日付 → その日のメモ
    todoLog: {}, // 日付 → その日に完了したToDo数（統計用）
    zoo: { owned: [], pos: {} }, // どうぶつ（獲得済みkeyと飾り位置）
    // ケーキチャレンジ（初期課題入り。「編集」でいつでも変更可能）
    challenge: {
      tasks: [
        { id: 'c1', title: '会社に水筒を持っていき、帰ってからそれを洗う' },
        { id: 'c2', title: '髪の毛を乾かす' },
        { id: 'c3', title: 'ストレッチ' },
      ],
      checks: {},
      used: 0,
    },
    meta: { lastExport: null, farmDone: 0 },
  };
}

function mergeState(data) {
  const merged = Object.assign(defaultState(), data);
  merged.meta = Object.assign(defaultState().meta, data.meta || {});
  merged.challenge = Object.assign(defaultState().challenge, data.challenge || {});
  merged.zoo = Object.assign(defaultState().zoo, data.zoo || {});
  return merged;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) throw new Error('unsupported version');
    return mergeState(data);
  } catch (e) {
    // 壊れたデータを黙って上書きしないよう退避してから初期化する
    localStorage.setItem(STORAGE_KEY + '-broken', raw);
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let selectedDate = todayStr();
let lastToday = todayStr();
let editingId = null; // 編集中のルーティンID（nullなら新規追加）
let dlgColor = 'yellow';
let dlgDays = [];
let dlgIcon = null;

// ========== タブ切替 ==========
const VIEWS = ['board', 'farm', 'challenge', 'stats', 'settings'];

function showView(name) {
  VIEWS.forEach(function (v) {
    $('view-' + v).classList.toggle('hidden', v !== name);
  });
  document.querySelectorAll('.tab-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.view === name);
  });
  if (name === 'board') renderBoard();
  if (name === 'farm') renderFarm();
  if (name === 'challenge') renderChallenge();
  if (name === 'stats') renderStats();
  if (name === 'settings') renderSettings();
}

// ルーティンアイコン（ライブラリ画像。旧データの絵文字はそのまま文字表示）
function routineIconEl(r, cls) {
  if (ICON_LIB[r.icon]) {
    const img = el('img', cls);
    img.src = 'assets/icons/' + r.icon + '.png';
    img.alt = ICON_LIB[r.icon];
    return img;
  }
  return el('span', cls, r.icon || '・');
}

// ========== 盤面 ==========
function routinesForDate(dateStr) {
  const wd = parseDate(dateStr).getDay();
  return state.routines.filter(function (r) { return r.days.includes(wd); });
}

function checksFor(dateStr) {
  return state.checks[dateStr] || [];
}

function toggleCheck(dateStr, id) {
  const list = checksFor(dateStr).slice();
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1); else list.push(id);
  if (list.length) state.checks[dateStr] = list; else delete state.checks[dateStr];
  saveState();
  renderGrid();
}

function renderDateStrip() {
  const strip = $('date-strip');
  strip.textContent = '';
  const today = parseDate(todayStr());
  for (let i = DATE_STRIP_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = fmtDate(d);
    const btn = el('button', 'date-item');
    if (ds === selectedDate) btn.classList.add('selected');
    if (i === 0) btn.classList.add('today');
    btn.appendChild(el('span', 'dow', i === 0 ? 'きょう' : DAY_LABELS[d.getDay()]));
    btn.appendChild(el('span', 'num', String(d.getDate())));
    btn.addEventListener('click', function () {
      selectedDate = ds;
      renderBoard();
    });
    strip.appendChild(btn);
  }
  // 選択日をストリップ中央へ（scrollIntoViewはページ全体まで動かすことがあるため使わない）
  const sel = strip.querySelector('.selected');
  if (sel) strip.scrollLeft = sel.offsetLeft - (strip.clientWidth - sel.offsetWidth) / 2;
}

function renderGrid() {
  const grid = $('board-grid');
  grid.textContent = '';
  const routines = routinesForDate(selectedDate);
  const checked = checksFor(selectedDate);
  const doneCount = routines.filter(function (r) { return checked.includes(r.id); }).length;

  const counter = $('board-counter');
  counter.textContent = '✓ ' + doneCount + ' / ' + routines.length;
  counter.classList.toggle('done', routines.length > 0 && doneCount === routines.length);

  $('board-date-label').textContent = jpDateLabel(parseDate(selectedDate));
  $('board-empty').classList.toggle('hidden', state.routines.length > 0);

  if (state.routines.length > 0 && routines.length === 0) {
    grid.appendChild(el('p', 'empty-note grid-note', 'この曜日のルーティンはありません'));
  }

  routines.forEach(function (r) {
    const cell = el('button', 'cell');
    cell.style.background = COLOR_VALUES[r.color] || COLOR_VALUES.white;
    if (checked.includes(r.id)) cell.classList.add('checked');
    if (r.time) cell.appendChild(el('span', 'time', r.time));
    cell.appendChild(routineIconEl(r, 'icon'));
    cell.appendChild(el('span', 'title', r.title));
    cell.appendChild(el('span', 'check', '✓'));
    cell.addEventListener('click', function () { toggleCheck(selectedDate, r.id); });
    grid.appendChild(cell);
  });

  // 次にやるマス（最初の未チェック）にトマトを乗せる
  const next = routines.findIndex(function (r) { return !checked.includes(r.id); });
  if (next >= 0) {
    grid.children[next].appendChild(mascotEl('mascot-turn', 'wave'));
  }

  // 全マス達成のお祝い
  if (routines.length > 0 && doneCount === routines.length) {
    const box = el('div', 'board-done grid-note');
    const chars = el('div', 'board-done-chars');
    chars.appendChild(mascotEl('mascot-cheer', 'cheer'));
    chars.appendChild(mascotEl('mascot-cheer-pig', 'pig'));
    box.appendChild(chars);
    box.appendChild(el('p', undefined, 'ぜんぶ達成！'));
    grid.appendChild(box);
  }
}

function renderBoard() {
  renderDateStrip();
  renderGrid();
  renderMemoBox();
  renderDeco();
}

// ========== どうぶつ（ポイント・飾りエリア・ずかん） ==========
function zooEarnedPoints() {
  let n = 0;
  Object.keys(state.checks).forEach(function (ds) { n += state.checks[ds].length; });
  return n;
}

function zooAvailablePoints() {
  return zooEarnedPoints() - state.zoo.owned.length * ZOO_COST;
}

function zooRandomPos() {
  return { x: 10 + Math.random() * 80, y: 20 + Math.random() * 60 };
}

function renderDeco() {
  $('zoo-pts').textContent = 'ルーティンポイント ' + zooAvailablePoints() + ' pt';
  const area = $('deco-area');
  area.classList.toggle('hidden', state.zoo.owned.length === 0);
  area.textContent = '';
  let dirty = false;
  state.zoo.owned.forEach(function (key) {
    const animal = ZOO_ANIMALS.find(function (a) { return a.key === key; });
    if (!animal) return;
    if (!state.zoo.pos[key]) {
      state.zoo.pos[key] = zooRandomPos();
      dirty = true;
    }
    const p = state.zoo.pos[key];
    const elm = el('span', 'deco-animal');
    const img = el('img');
    img.src = 'assets/zoo/' + key + '.png';
    img.alt = animal.label;
    img.draggable = false;
    elm.appendChild(img);
    elm.style.left = p.x + '%';
    elm.style.top = p.y + '%';
    enableDecoDrag(elm, key);
    area.appendChild(elm);
  });
  if (dirty) saveState();
}

// 指でドラッグして好きな位置へ（位置は%で保存）
function enableDecoDrag(elm, key) {
  elm.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    elm.setPointerCapture(e.pointerId);
    const rect = $('deco-area').getBoundingClientRect();
    const move = function (ev) {
      const x = Math.max(7, Math.min(93, (ev.clientX - rect.left) / rect.width * 100));
      const y = Math.max(15, Math.min(85, (ev.clientY - rect.top) / rect.height * 100));
      elm.style.left = x + '%';
      elm.style.top = y + '%';
      state.zoo.pos[key] = { x: x, y: y };
    };
    const up = function () {
      elm.removeEventListener('pointermove', move);
      elm.removeEventListener('pointerup', up);
      elm.removeEventListener('pointercancel', up);
      saveState();
    };
    elm.addEventListener('pointermove', move);
    elm.addEventListener('pointerup', up);
    elm.addEventListener('pointercancel', up);
  });
}

function renderZoo() {
  const pts = zooAvailablePoints();
  $('zoo-status').textContent =
    'ポイント ' + pts + ' pt ・ なかま ' + state.zoo.owned.length + ' / ' + ZOO_ANIMALS.length +
    '\nルーティン1つ達成で1pt。' + ZOO_COST + 'ptで好きな動物をタップしてむかえられます。';
  const grid = $('zoo-grid');
  grid.textContent = '';
  ZOO_ANIMALS.forEach(function (a) {
    const owned = state.zoo.owned.includes(a.key);
    const cell = el('button', 'zoo-cell' + (owned ? ' owned' : ''));
    cell.type = 'button';
    cell.title = a.label;
    const img = el('img');
    img.src = 'assets/zoo/' + a.key + '.png';
    img.alt = a.label;
    cell.appendChild(img);
    if (!owned) {
      cell.addEventListener('click', function () {
        if (zooAvailablePoints() < ZOO_COST) {
          alert('ポイントが足りません（' + ZOO_COST + 'pt 必要）');
          return;
        }
        if (!confirm('「' + a.label + '」を ' + ZOO_COST + 'pt でむかえますか？')) return;
        state.zoo.owned.push(a.key);
        state.zoo.pos[a.key] = zooRandomPos();
        saveState();
        renderZoo();
        renderDeco();
      });
    }
    grid.appendChild(cell);
  });
}

$('zoo-open').addEventListener('click', function () {
  renderZoo();
  $('zoo-dialog').showModal();
});
$('zoo-close').addEventListener('click', function () {
  $('zoo-dialog').close();
  renderDeco();
});

// ========== 1日メモ ==========
function renderMemoBox() {
  const m = state.memos[selectedDate];
  $('memo-box').classList.toggle('empty', !m);
  $('memo-text').textContent = m || 'タップしてこの日のメモを書く';
}

$('memo-box').addEventListener('click', function () {
  $('memo-dialog-title').textContent = jpDateLabel(parseDate(selectedDate)) + ' のメモ';
  $('memo-input').value = state.memos[selectedDate] || '';
  $('memo-dialog').showModal();
});
$('memo-cancel').addEventListener('click', function () { $('memo-dialog').close(); });
$('memo-delete').addEventListener('click', function () {
  delete state.memos[selectedDate];
  saveState();
  $('memo-dialog').close();
  renderMemoBox();
});
$('memo-form').addEventListener('submit', function (e) {
  e.preventDefault();
  const text = $('memo-input').value.trim();
  if (text) state.memos[selectedDate] = text; else delete state.memos[selectedDate];
  saveState();
  $('memo-dialog').close();
  renderMemoBox();
});

// ========== ToDoファーム ==========
// ToDoを完了した累計数（meta.farmDone）に応じて畑が発展していく
let lastFarmStage = null;

function renderFarm() {
  const pts = state.meta.farmDone;
  let cur = FARM_STAGES[0];
  let curIdx = 0;
  let next = null;
  for (let i = 0; i < FARM_STAGES.length; i++) {
    if (pts >= FARM_STAGES[i].need) {
      cur = FARM_STAGES[i];
      curIdx = i;
    } else {
      next = FARM_STAGES[i];
      break;
    }
  }

  // ぶたさんは露地栽培（3段階目）から畑の住人になる
  $('farm-pig').classList.toggle('hidden', curIdx < 2);

  const img = $('farm-stage-img');
  img.src = 'assets/farm/' + cur.key + '.png';
  img.alt = cur.label;
  // 段階が上がった瞬間だけ演出
  if (lastFarmStage && lastFarmStage !== cur.key) {
    img.classList.remove('farm-pop');
    void img.offsetWidth;
    img.classList.add('farm-pop');
  }
  lastFarmStage = cur.key;

  $('farm-stage-name').textContent = cur.label;

  let ratio = 1;
  let status;
  if (next) {
    ratio = (pts - cur.need) / (next.need - cur.need);
    status = 'つぎの「' + next.label + '」まで あと ' + (next.need - pts) + ' 個（累計 ' + pts + ' 個完了）';
  } else {
    status = '観光農園まで到達！（累計 ' + pts + ' 個完了）';
  }
  $('farm-bar').style.width = Math.round(ratio * 100) + '%';
  $('farm-status').textContent = status;

  const steps = $('farm-steps');
  steps.textContent = '';
  FARM_STAGES.forEach(function (s) {
    steps.appendChild(el('span', 'farm-step' + (pts >= s.need ? ' reached' : '')));
  });

  const list = $('todo-list');
  list.textContent = '';
  state.todos.forEach(function (t) {
    const li = el('li', 'todo-item' + (t.done ? ' done' : ''));
    const label = el('label');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = t.done;
    cb.addEventListener('change', function () {
      t.done = cb.checked;
      state.meta.farmDone = Math.max(0, state.meta.farmDone + (cb.checked ? 1 : -1));
      const day = todayStr();
      if (cb.checked) {
        state.todoLog[day] = (state.todoLog[day] || 0) + 1;
      } else {
        state.todoLog[day] = Math.max(0, (state.todoLog[day] || 0) - 1);
        if (!state.todoLog[day]) delete state.todoLog[day];
      }
      saveState();
      renderFarm();
    });
    label.appendChild(cb);
    label.appendChild(el('span', 'todo-title', t.title));
    const del = el('button', 'todo-del', '✕');
    del.addEventListener('click', function () {
      state.todos = state.todos.filter(function (x) { return x.id !== t.id; });
      saveState();
      renderFarm();
    });
    li.appendChild(label);
    li.appendChild(del);
    list.appendChild(li);
  });
}

$('todo-form').addEventListener('submit', function (e) {
  e.preventDefault();
  const input = $('todo-input');
  const title = input.value.trim();
  if (!title) return;
  state.todos.push({ id: uid(), title: title, done: false, createdAt: todayStr() });
  input.value = '';
  saveState();
  renderFarm();
});

$('todo-clear').addEventListener('click', function () {
  const done = state.todos.filter(function (t) { return t.done; }).length;
  if (!done) { alert('完了済みのToDoはありません'); return; }
  if (!confirm('完了済みの ' + done + ' 件を削除します。よろしいですか？（畑の発展は減りません）')) return;
  state.todos = state.todos.filter(function (t) { return !t.done; });
  saveState();
  renderFarm();
});

// ========== 統計 ==========
let statsTab = 'routine';
let statsWeekOffset = 0;  // 0=今週、-1=先週…
let statsMonthOffset = 0; // 0=今月

function dayAchieve(ds) {
  const rs = routinesForDate(ds);
  const checked = checksFor(ds);
  return {
    scheduled: rs.length,
    done: rs.filter(function (r) { return checked.includes(r.id); }).length,
  };
}

// 週の達成集計（当日までの分だけ数える）
function weekAchieve(dates) {
  const today = todayStr();
  let scheduled = 0;
  let done = 0;
  dates.forEach(function (ds) {
    if (ds > today) return;
    const s = dayAchieve(ds);
    scheduled += s.scheduled;
    done += s.done;
  });
  return { scheduled: scheduled, done: done, pct: scheduled ? Math.round(done / scheduled * 100) : null };
}

function renderStats() {
  $('stats-tab-routine').classList.toggle('active', statsTab === 'routine');
  $('stats-tab-todo').classList.toggle('active', statsTab === 'todo');
  $('stats-routine').classList.toggle('hidden', statsTab !== 'routine');
  $('stats-todo').classList.toggle('hidden', statsTab !== 'todo');
  if (statsTab === 'routine') {
    renderWeekCard();
    renderRoutineBreakdown();
    renderMonthCard();
  } else {
    renderTodoStats();
  }
}

function renderWeekCard() {
  const dates = weekDatesFor(statsWeekOffset);
  const prevDates = weekDatesFor(statsWeekOffset - 1);
  $('week-label').textContent = fmtMD(dates[0]) + '〜' + fmtMD(dates[6]);
  $('week-next').disabled = statsWeekOffset >= 0;

  const cur = weekAchieve(dates);
  const prev = weekAchieve(prevDates);

  const big = $('week-big');
  big.textContent = '';
  if (cur.scheduled) {
    big.appendChild(document.createTextNode(cur.done + ' '));
    big.appendChild(el('span', 'stats-big-sub', '/ ' + cur.scheduled + ' 回達成'));
  } else {
    big.appendChild(el('span', 'stats-big-sub', 'この週の記録はありません'));
  }

  $('tube-prev-pct').textContent = prev.pct === null ? '—' : prev.pct + '%';
  $('tube-cur-pct').textContent = cur.pct === null ? '—' : cur.pct + '%';
  $('tube-prev').style.height = (prev.pct || 0) + '%';
  $('tube-cur').style.height = (cur.pct || 0) + '%';

  const memoCount = dates.filter(function (ds) { return state.memos[ds]; }).length;
  $('week-memo-count').textContent = 'この週のメモ ' + memoCount + ' 件';
}

function renderRoutineBreakdown() {
  const dates = weekDatesFor(statsWeekOffset);
  const today = todayStr();

  const head = $('sr-days-head');
  head.textContent = '';
  [1, 2, 3, 4, 5, 6, 0].forEach(function (d) { head.appendChild(el('span', undefined, DAY_LABELS[d])); });

  const list = $('stats-routine-list');
  list.textContent = '';
  if (state.routines.length === 0) {
    list.appendChild(el('li', 'stats-note', 'ルーティンがまだありません'));
    return;
  }
  state.routines.forEach(function (r) {
    const li = el('li', 'sr-item');
    li.appendChild(routineIconEl(r, 'sr-icon'));
    li.appendChild(el('span', 'sr-name', r.title));
    const dots = el('span', 'sr-dots');
    dates.forEach(function (ds) {
      const wd = parseDate(ds).getDay();
      let cls;
      if (!r.days.includes(wd)) cls = 'off';
      else if (ds > today) cls = 'future';
      else cls = checksFor(ds).includes(r.id) ? 'done' : 'miss';
      dots.appendChild(el('span', 'rdot ' + cls));
    });
    li.appendChild(dots);
    list.appendChild(li);
  });
}

function renderMonthCard() {
  const t = parseDate(todayStr());
  const base = new Date(t.getFullYear(), t.getMonth() + statsMonthOffset, 1);
  const y = base.getFullYear();
  const mo = base.getMonth();
  $('month-label').textContent = y + '年' + (mo + 1) + '月';
  $('month-next').disabled = statsMonthOffset >= 0;

  const grid = $('month-grid');
  grid.textContent = '';
  [1, 2, 3, 4, 5, 6, 0].forEach(function (d) { grid.appendChild(el('span', 'mhead', DAY_LABELS[d])); });

  const startPad = (base.getDay() + 6) % 7;
  for (let i = 0; i < startPad; i++) grid.appendChild(el('span'));

  const today = todayStr();
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = fmtDate(new Date(y, mo, day));
    let cls = 'plain';
    if (ds <= today) {
      const s = dayAchieve(ds);
      if (s.scheduled === 0) cls = 'plain';
      else if (s.done === s.scheduled) cls = 'full';
      else if (s.done > 0) cls = 'partial';
      else cls = 'none';
    }
    grid.appendChild(el('span', 'mday ' + cls, String(day)));
  }
}

function renderTodoStats() {
  const weeks = [];
  for (let o = -7; o <= 0; o++) {
    const ds = weekDatesFor(o);
    let n = 0;
    ds.forEach(function (d) { n += state.todoLog[d] || 0; });
    weeks.push({ label: fmtMD(ds[0]), n: n });
  }
  $('todo-week-cur').textContent = String(weeks[7].n);
  $('todo-week-prev').textContent = String(weeks[6].n);
  $('todo-total').textContent = String(state.meta.farmDone);

  const bars = $('todo-bars');
  bars.textContent = '';
  let max = 1;
  weeks.forEach(function (w) { if (w.n > max) max = w.n; });
  weeks.forEach(function (w) {
    const item = el('span', 'tbar');
    item.appendChild(el('span', 'tbar-val', w.n > 0 ? String(w.n) : ''));
    const fill = el('span', 'tbar-fill' + (w.n === 0 ? ' zero' : ''));
    fill.style.height = w.n > 0 ? Math.round(6 + (w.n / max) * 84) + 'px' : '3px';
    item.appendChild(fill);
    item.appendChild(el('span', 'tbar-label', w.label));
    bars.appendChild(item);
  });
}

// ========== ケーキチャレンジ ==========
// 1つ達成=1pt・3つ全部達成でボーナス+2（計5pt）・累計50ptごとにケーキ券1枚
const CHALLENGE_GOAL = 50;
const CHALLENGE_BONUS = 2;

function challengeChecksFor(ds) {
  return state.challenge.checks[ds] || [];
}

function challengeDayPoints(n) {
  const capped = Math.min(n, 3);
  return capped + (capped >= 3 ? CHALLENGE_BONUS : 0);
}

function challengeTotalPoints() {
  let total = 0;
  Object.keys(state.challenge.checks).forEach(function (ds) {
    total += challengeDayPoints(state.challenge.checks[ds].length);
  });
  return total;
}

function renderChallenge() {
  const tasks = state.challenge.tasks.filter(function (t) { return t.title; });
  const today = todayStr();
  const checked = challengeChecksFor(today);
  const total = challengeTotalPoints();
  const tickets = Math.floor(total / CHALLENGE_GOAL) - state.challenge.used;
  const progress = total % CHALLENGE_GOAL;

  $('challenge-bar').style.width = Math.round(progress / CHALLENGE_GOAL * 100) + '%';
  $('challenge-status').textContent =
    'ケーキまで あと ' + (CHALLENGE_GOAL - progress) + ' ポイント（累計 ' + total + ' pt）';

  $('challenge-tickets').classList.toggle('hidden', tickets <= 0);
  $('ticket-count').textContent = 'ケーキ券を ' + tickets + ' 枚もっています';

  const list = $('challenge-list');
  list.textContent = '';
  if (tasks.length === 0) {
    list.appendChild(el('li', 'stats-note', '右上の「編集」から3つのチャレンジを設定してください'));
  }
  tasks.forEach(function (t) {
    const li = el('li', 'todo-item' + (checked.includes(t.id) ? ' done' : ''));
    const label = el('label');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = checked.includes(t.id);
    cb.addEventListener('change', function () {
      const cl = challengeChecksFor(today).slice();
      const i = cl.indexOf(t.id);
      if (cb.checked && i < 0) cl.push(t.id);
      if (!cb.checked && i >= 0) cl.splice(i, 1);
      if (cl.length) state.challenge.checks[today] = cl; else delete state.challenge.checks[today];
      saveState();
      renderChallenge();
    });
    label.appendChild(cb);
    label.appendChild(el('span', 'todo-title', t.title));
    li.appendChild(label);
    list.appendChild(li);
  });

  const n = Math.min(checked.length, 3);
  const box = $('challenge-today');
  box.textContent = '';
  if (tasks.length > 0 && n >= tasks.length && n >= 3) {
    const chars = el('div', 'board-done-chars');
    chars.appendChild(mascotEl('mascot-cheer', 'cheer'));
    chars.appendChild(mascotEl('mascot-cheer-pig', 'pig'));
    box.appendChild(chars);
    box.appendChild(el('p', undefined, '今日は全部達成！ +' + challengeDayPoints(n) + ' ポイント'));
  } else if (n > 0) {
    box.appendChild(el('p', undefined, '今日 +' + n + ' ポイント（全部達成で +' + (3 + CHALLENGE_BONUS) + '）'));
  } else if (tasks.length > 0) {
    box.appendChild(el('p', undefined, '1つ達成で +1、全部達成で +' + (3 + CHALLENGE_BONUS) + ' ポイント'));
  }
}

$('ticket-use').addEventListener('click', function () {
  const tickets = Math.floor(challengeTotalPoints() / CHALLENGE_GOAL) - state.challenge.used;
  if (tickets <= 0) return;
  if (!confirm('ケーキ券を1枚使います。ケーキ屋さんでケーキをどうぞ！')) return;
  state.challenge.used++;
  saveState();
  renderChallenge();
});

$('challenge-edit').addEventListener('click', function () {
  const t = state.challenge.tasks;
  $('ch-t1').value = t[0] ? t[0].title : '';
  $('ch-t2').value = t[1] ? t[1].title : '';
  $('ch-t3').value = t[2] ? t[2].title : '';
  $('challenge-dialog').showModal();
});
$('ch-cancel').addEventListener('click', function () { $('challenge-dialog').close(); });
$('challenge-form').addEventListener('submit', function (e) {
  e.preventDefault();
  state.challenge.tasks = [
    { id: 'c1', title: $('ch-t1').value.trim() },
    { id: 'c2', title: $('ch-t2').value.trim() },
    { id: 'c3', title: $('ch-t3').value.trim() },
  ];
  saveState();
  $('challenge-dialog').close();
  renderChallenge();
});

$('stats-tab-routine').addEventListener('click', function () { statsTab = 'routine'; renderStats(); });
$('stats-tab-todo').addEventListener('click', function () { statsTab = 'todo'; renderStats(); });
$('week-prev').addEventListener('click', function () { statsWeekOffset--; renderStats(); });
$('week-next').addEventListener('click', function () { if (statsWeekOffset < 0) statsWeekOffset++; renderStats(); });
$('month-prev').addEventListener('click', function () { statsMonthOffset--; renderStats(); });
$('month-next').addEventListener('click', function () { if (statsMonthOffset < 0) statsMonthOffset++; renderStats(); });

// ========== 設定: ルーティン一覧 ==========
function daysSummary(days) {
  if (days.length === 7) return '毎日';
  const weekdays = [1, 2, 3, 4, 5];
  if (days.length === 5 && weekdays.every(function (d) { return days.includes(d); })) return '平日';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return '土日';
  return [1, 2, 3, 4, 5, 6, 0]
    .filter(function (d) { return days.includes(d); })
    .map(function (d) { return DAY_LABELS[d]; })
    .join('・');
}

function moveRoutine(idx, dir) {
  const j = idx + dir;
  if (j < 0 || j >= state.routines.length) return;
  const a = state.routines;
  const tmp = a[idx];
  a[idx] = a[j];
  a[j] = tmp;
  saveState();
  renderSettings();
}

function renderRoutineList() {
  const list = $('routine-list');
  list.textContent = '';
  state.routines.forEach(function (r, idx) {
    const li = el('li', 'routine-item');
    li.appendChild(routineIconEl(r, 'routine-icon'));
    const info = el('div', 'routine-info');
    info.appendChild(el('div', 'routine-title', r.title));
    info.appendChild(el('div', 'routine-meta', (r.time ? r.time + '　' : '') + daysSummary(r.days)));
    li.appendChild(info);

    const btns = el('div', 'routine-btns');
    const up = el('button', 'icon-btn', '↑');
    up.disabled = idx === 0;
    up.addEventListener('click', function () { moveRoutine(idx, -1); });
    const down = el('button', 'icon-btn', '↓');
    down.disabled = idx === state.routines.length - 1;
    down.addEventListener('click', function () { moveRoutine(idx, 1); });
    const edit = el('button', 'icon-btn', '✎');
    edit.addEventListener('click', function () { openRoutineDialog(r.id); });
    const del = el('button', 'icon-btn', '✕');
    del.addEventListener('click', function () {
      if (!confirm('「' + r.title + '」を削除します。よろしいですか？')) return;
      state.routines = state.routines.filter(function (x) { return x.id !== r.id; });
      saveState();
      renderSettings();
    });
    btns.appendChild(up);
    btns.appendChild(down);
    btns.appendChild(edit);
    btns.appendChild(del);
    li.appendChild(btns);
    list.appendChild(li);
  });
}

function renderSettings() {
  renderRoutineList();
  renderBackupStatus();
  renderStorageStatus();
}

// ========== 設定: ルーティン編集ダイアログ ==========
const dlg = $('routine-dialog');

function openRoutineDialog(id) {
  editingId = id || null;
  const r = id ? state.routines.find(function (x) { return x.id === id; }) : null;
  $('routine-dialog-title').textContent = r ? 'ルーティンを編集' : 'ルーティンを追加';
  $('rf-title').value = r ? r.title : '';
  $('rf-time').value = r && r.time ? r.time : '';
  dlgColor = r ? r.color : 'yellow';
  dlgDays = r ? r.days.slice() : [0, 1, 2, 3, 4, 5, 6];
  // 旧絵文字アイコンの編集時は未選択のまま＝保存しても元の絵文字を維持
  dlgIcon = (r && ICON_LIB[r.icon]) ? r.icon : (r ? null : 'calendar');
  renderDialogIconGrid();
  renderDialogColorPicks();
  renderDialogDayPicks();
  dlg.showModal();
}

function renderDialogIconGrid() {
  const box = $('rf-icon-grid');
  box.textContent = '';
  Object.keys(ICON_LIB).forEach(function (key) {
    const b = el('button', 'icon-cell' + (dlgIcon === key ? ' selected' : ''));
    b.type = 'button';
    b.title = ICON_LIB[key];
    const img = el('img');
    img.src = 'assets/icons/' + key + '.png';
    img.alt = ICON_LIB[key];
    b.appendChild(img);
    b.addEventListener('click', function () {
      dlgIcon = key;
      renderDialogIconGrid();
    });
    box.appendChild(b);
  });
}

function renderDialogColorPicks() {
  const box = $('rf-colors');
  box.textContent = '';
  Object.keys(COLOR_VALUES).forEach(function (name) {
    const b = el('button', 'swatch' + (dlgColor === name ? ' selected' : ''));
    b.type = 'button';
    b.style.background = COLOR_VALUES[name];
    b.addEventListener('click', function () {
      dlgColor = name;
      renderDialogColorPicks();
    });
    box.appendChild(b);
  });
}

function renderDialogDayPicks() {
  const box = $('rf-days');
  box.textContent = '';
  // 表示は月曜始まり
  [1, 2, 3, 4, 5, 6, 0].forEach(function (d) {
    const b = el('button', 'day-btn' + (dlgDays.includes(d) ? ' active' : ''), DAY_LABELS[d]);
    b.type = 'button';
    b.addEventListener('click', function () {
      const i = dlgDays.indexOf(d);
      if (i >= 0) dlgDays.splice(i, 1); else dlgDays.push(d);
      renderDialogDayPicks();
    });
    box.appendChild(b);
  });
}

$('routine-add').addEventListener('click', function () { openRoutineDialog(null); });
$('rf-cancel').addEventListener('click', function () { dlg.close(); });

$('routine-form').addEventListener('submit', function (e) {
  e.preventDefault();
  const title = $('rf-title').value.trim();
  if (!title) return;
  if (dlgDays.length === 0) { alert('曜日を1つ以上選んでください'); return; }
  const existing = editingId ? state.routines.find(function (x) { return x.id === editingId; }) : null;
  const data = {
    title: title,
    icon: dlgIcon || (existing ? existing.icon : 'calendar'),
    color: dlgColor,
    time: $('rf-time').value || null,
    days: dlgDays.slice().sort(function (a, b) { return a - b; }),
  };
  if (existing) {
    Object.assign(existing, data);
  } else {
    state.routines.push(Object.assign({ id: uid() }, data));
  }
  saveState();
  dlg.close();
  renderSettings();
});

// ========== 設定: バックアップ ==========
function renderBackupStatus() {
  const last = state.meta.lastExport;
  let msg;
  if (!last) {
    msg = 'まだ一度もエクスポートしていません。';
  } else {
    const diff = Math.floor((parseDate(todayStr()) - parseDate(last)) / 86400000);
    msg = '最終エクスポート: ' + last + '（' + (diff === 0 ? 'きょう' : diff + '日前') + '）';
    if (diff >= 30) msg += '\nそろそろバックアップをおすすめします。';
  }
  $('backup-status').textContent = msg;
}

$('export-btn').addEventListener('click', function () {
  state.meta.lastExport = todayStr();
  saveState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'routine-board-backup-' + todayStr().replace(/-/g, '') + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
  renderBackupStatus();
});

$('import-btn').addEventListener('click', function () { $('import-file').click(); });

$('import-file').addEventListener('change', function (e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  file.text().then(function (text) {
    let data;
    try {
      data = JSON.parse(text);
      if (!data || data.version !== 1 ||
          !Array.isArray(data.routines) || !Array.isArray(data.todos) ||
          typeof data.checks !== 'object' || data.checks === null) {
        throw new Error('bad format');
      }
    } catch (err) {
      alert('このファイルは読み込めません（バックアップJSONではないようです）');
      return;
    }
    if (!confirm('現在のデータをファイルの内容で置き換えます。よろしいですか？')) return;
    state = mergeState(data);
    saveState();
    renderSettings();
    alert('インポートしました');
  });
});

// ========== 設定: 保存状態 ==========
function renderStorageStatus() {
  const lines = [];
  lines.push('ルーティン ' + state.routines.length + ' 件 ／ 記録日数 ' +
    Object.keys(state.checks).length + ' 日 ／ ToDo ' + state.todos.length + ' 件');
  const finish = function (persistLine) {
    lines.push(persistLine);
    lines.push('※ブラウザのデータ消去では消えます。定期的なエクスポートをおすすめします。');
    lines.push('アプリのバージョン: ' + APP_VERSION);
    $('storage-status').textContent = lines.join('\n');
  };
  if (navigator.storage && navigator.storage.persisted) {
    navigator.storage.persisted().then(function (p) {
      finish(p
        ? '保存領域: 保護あり（容量逼迫による自動削除の対象外）'
        : '保存領域: 保護なし（ホーム画面へのインストール後に自動で保護されます）');
    }).catch(function () { finish('保存領域: 状態を確認できませんでした'); });
  } else {
    finish('保存領域: このブラウザでは保護状態を確認できません');
  }
}

// ========== 起動 ==========
document.querySelectorAll('.tab-btn').forEach(function (b) {
  b.addEventListener('click', function () { showView(b.dataset.view); });
});

// アプリに戻ってきたら保存データを読み直す。
// 古いタブが古いメモリ内容のまま上書き保存してデータを消す事故（v2.4以前で発生）を防ぐため、
// 表示のたびに localStorage を正とする
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState !== 'visible') return;
  state = loadState();
  if (lastToday !== todayStr()) {
    lastToday = todayStr();
    selectedDate = lastToday;
    $('header-sub').textContent = jpDateLabel(new Date());
  }
  const active = document.querySelector('.tab-btn.active');
  showView(active ? active.dataset.view : 'board');
});

// 日次自動バックアップ（直近2世代を端末内に保存）
function takeSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data) return;
    // 何かしら中身があるときだけ残す（空データでバックアップを潰さない）
    const hasContent =
      (data.routines && data.routines.length > 0) ||
      (data.checks && Object.keys(data.checks).length > 0) ||
      (data.challenge && data.challenge.checks && Object.keys(data.challenge.checks).length > 0) ||
      (data.zoo && data.zoo.owned && data.zoo.owned.length > 0) ||
      (data.todos && data.todos.length > 0);
    if (!hasContent) return;
    const today = todayStr();
    const prev = JSON.parse(localStorage.getItem(STORAGE_KEY + '-bak1') || 'null');
    if (prev && prev.date === today) return;
    if (prev) localStorage.setItem(STORAGE_KEY + '-bak2', JSON.stringify(prev));
    localStorage.setItem(STORAGE_KEY + '-bak1', JSON.stringify({ date: today, data: data }));
  } catch (e) {}
}

$('restore-btn').addEventListener('click', function () {
  const cands = [];
  ['-bak1', '-bak2'].forEach(function (k) {
    try {
      const v = JSON.parse(localStorage.getItem(STORAGE_KEY + k) || 'null');
      if (v && v.data && v.date) cands.push(v);
    } catch (e) {}
  });
  if (cands.length === 0) {
    alert('バックアップがまだありません（毎日の起動時に自動で作られます）');
    return;
  }
  cands.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    const msg = c.date + ' 時点のバックアップ（ルーティン ' + (c.data.routines || []).length +
      ' 件・記録 ' + Object.keys(c.data.checks || {}).length + ' 日）に戻しますか？\n現在のデータは置き換わります。';
    if (confirm(msg)) {
      state = mergeState(c.data);
      saveState();
      renderSettings();
      alert('復元しました');
      return;
    }
  }
});

if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(function () {});
}
takeSnapshot();
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  navigator.serviceWorker.register('sw.js').catch(function () {});
}

document.querySelectorAll('.mascot-slot').forEach(function (s) { s.appendChild(mascotImg('normal')); });
$('farm-pig').appendChild(mascotImg('pig'));
$('header-sub').textContent = jpDateLabel(new Date());
showView('board');

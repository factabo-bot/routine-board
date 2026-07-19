'use strict';

// ========== 定数 ==========
const APP_VERSION = '2.0';
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

// ToDoシティの建物（assets/city/<key>.png）。needは累計完了数
const CITY_BUILDINGS = [
  { key: 'house', label: '小さな家', need: 1 },
  { key: 'tree', label: '公園の木', need: 3 },
  { key: 'bakery', label: 'パン屋', need: 5 },
  { key: 'cafe', label: 'カフェ', need: 8 },
  { key: 'flower', label: '花屋', need: 11 },
  { key: 'fountain', label: '噴水広場', need: 15 },
  { key: 'school', label: '学校', need: 19 },
  { key: 'greenhouse', label: 'トマトのハウス', need: 24 },
  { key: 'office', label: 'オフィスビル', need: 29 },
  { key: 'clock', label: '時計台', need: 35 },
  { key: 'ferris', label: '観覧車', need: 41 },
  { key: 'castle', label: 'お城', need: 48 },
];

// マスコット（トマトのキャラ・生成画像を背景透過に加工したもの）
const MASCOT_SRC = {
  normal: 'assets/mascot-normal.png',
  wave: 'assets/mascot-wave.png',
  cheer: 'assets/mascot-cheer.png',
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

function jpDateLabel(d) {
  return (d.getMonth() + 1) + '月' + d.getDate() + '日（' + DAY_LABELS[d.getDay()] + '）';
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ========== データ ==========
function defaultState() {
  return { version: 1, routines: [], checks: {}, todos: [], meta: { lastExport: null, cityDone: 0 } };
}

function mergeState(data) {
  const merged = Object.assign(defaultState(), data);
  merged.meta = Object.assign(defaultState().meta, data.meta || {});
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
const VIEWS = ['board', 'city', 'settings'];

function showView(name) {
  VIEWS.forEach(function (v) {
    $('view-' + v).classList.toggle('hidden', v !== name);
  });
  document.querySelectorAll('.tab-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.view === name);
  });
  if (name === 'board') renderBoard();
  if (name === 'city') renderCity();
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
    box.appendChild(mascotEl('mascot-cheer', 'cheer'));
    box.appendChild(el('p', undefined, 'ぜんぶ達成！'));
    grid.appendChild(box);
  }
}

function renderBoard() {
  renderDateStrip();
  renderGrid();
}

// ========== ToDoシティ ==========
// ToDoを完了した累計数（meta.cityDone）に応じて建物が増えていく
function renderCity() {
  const pts = state.meta.cityDone;
  const grid = $('city-grid');
  grid.textContent = '';
  let builtCount = 0;
  let next = null;
  CITY_BUILDINGS.forEach(function (b) {
    const slot = el('div', 'city-slot');
    if (pts >= b.need) {
      slot.classList.add('built');
      const img = el('img');
      img.src = 'assets/city/' + b.key + '.png';
      img.alt = b.label;
      slot.appendChild(img);
      builtCount++;
    } else {
      slot.classList.add('locked');
      if (!next) {
        next = b;
        slot.textContent = 'あと' + (b.need - pts);
      } else {
        slot.textContent = '・';
      }
    }
    grid.appendChild(slot);
  });

  let status;
  if (builtCount === CITY_BUILDINGS.length) {
    status = '街が完成した！（累計 ' + pts + ' 個完了）';
  } else {
    status = builtCount + ' / ' + CITY_BUILDINGS.length + ' 棟 ・ つぎの「' + next.label + '」まで あと ' + (next.need - pts) + ' 個';
  }
  $('city-status').textContent = status;

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
      state.meta.cityDone = Math.max(0, state.meta.cityDone + (cb.checked ? 1 : -1));
      saveState();
      renderCity();
    });
    label.appendChild(cb);
    label.appendChild(el('span', 'todo-title', t.title));
    const del = el('button', 'todo-del', '✕');
    del.addEventListener('click', function () {
      state.todos = state.todos.filter(function (x) { return x.id !== t.id; });
      saveState();
      renderCity();
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
  renderCity();
});

$('todo-clear').addEventListener('click', function () {
  const done = state.todos.filter(function (t) { return t.done; }).length;
  if (!done) { alert('完了済みのToDoはありません'); return; }
  if (!confirm('完了済みの ' + done + ' 件を削除します。よろしいですか？（街の発展は減りません）')) return;
  state.todos = state.todos.filter(function (t) { return !t.done; });
  saveState();
  renderCity();
});

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

// 日付が変わったまま開きっぱなしのとき、再表示で今日に追従させる
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && lastToday !== todayStr()) {
    lastToday = todayStr();
    selectedDate = lastToday;
    $('header-sub').textContent = jpDateLabel(new Date());
    renderBoard();
  }
});

if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(function () {});
}
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  navigator.serviceWorker.register('sw.js').catch(function () {});
}

document.querySelectorAll('.mascot-slot').forEach(function (s) { s.appendChild(mascotImg('normal')); });
$('header-sub').textContent = jpDateLabel(new Date());
showView('board');

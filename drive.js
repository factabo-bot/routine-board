'use strict';

// ========== クラウドバックアップ（Google Apps Script経由） ==========
// GASのウェブアプリURLに保存/取得するだけの構成。
// Googleログインもアクセストークンも不要（GAS側が自分のDriveに書く）。
const CLOUD_CONFIG_KEY = 'routine-board-cloud';
const CLOUD_DEBOUNCE_MS = 4000;

function loadCloudConfig() {
  try { return JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY)) || {}; } catch (e) { return {}; }
}
function saveCloudConfig(cfg) { localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cfg)); }

let cloudTimer = null;
let cloudBusy = false;

function cloudEnabled() {
  const cfg = loadCloudConfig();
  return !!(cfg.url && cfg.user);
}

async function cloudSave(manual) {
  const cfg = loadCloudConfig();
  if (!cloudEnabled() || cloudBusy) return;
  cloudBusy = true;
  if (manual) renderCloudStatus('保存しています…');
  try {
    // Content-Typeをtext/plainにしてCORSプリフライトを避ける（GASはOPTIONSに応答できない）
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ user: cfg.user, data: state }),
    });
    const result = await res.json();
    if (!result.ok) throw new Error(result.error || 'save failed');
    cfg.lastSync = result.updated || new Date().toISOString();
    cfg.lastError = null;
    saveCloudConfig(cfg);
  } catch (e) {
    cfg.lastError = String(e);
    saveCloudConfig(cfg);
    if (manual) alert('保存できませんでした。通信環境とURLを確認してください。');
  }
  cloudBusy = false;
  renderCloudStatus();
}

function scheduleCloudSave() {
  if (!cloudEnabled()) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(function () { cloudSave(false); }, CLOUD_DEBOUNCE_MS);
}

function cloudSaveNow(manual) {
  clearTimeout(cloudTimer);
  cloudSave(manual);
}

async function cloudRestore() {
  const cfg = loadCloudConfig();
  if (!cloudEnabled()) return;
  renderCloudStatus('取得しています…');
  let result;
  try {
    const res = await fetch(cfg.url + '?user=' + encodeURIComponent(cfg.user));
    result = await res.json();
    if (!result.ok) throw new Error(result.error || 'load failed');
  } catch (e) {
    alert('取得できませんでした。通信環境とURLを確認してください。');
    renderCloudStatus();
    return;
  }
  if (result.empty) {
    alert('まだバックアップがありません');
    renderCloudStatus();
    return;
  }
  const when = result.updated ? new Date(result.updated).toLocaleString('ja-JP') : '不明';
  if (!confirm('クラウドのバックアップ（' + when + '）で今のデータを置き換えます。よろしいですか？')) {
    renderCloudStatus();
    return;
  }
  state = mergeState(result.data);
  saveState();
  renderSettings();
  alert('復元しました');
}

function cloudSaveSetup() {
  const url = $('cloud-url').value.trim();
  const user = $('cloud-user').value.trim().replace(/[^A-Za-z0-9_-]/g, '');
  if (!url || !user) { alert('URLと名前の両方を入力してください'); return; }
  if (url.indexOf('https://script.google.com/') !== 0) {
    alert('URLが違うようです。script.google.com で始まるウェブアプリのURLを貼ってください。');
    return;
  }
  const cfg = loadCloudConfig();
  cfg.url = url;
  cfg.user = user;
  saveCloudConfig(cfg);
  renderCloudStatus();
  cloudSaveNow(true);
}

function cloudDisconnect() {
  if (!confirm('自動バックアップをやめます。クラウド上のファイルはそのまま残ります。')) return;
  saveCloudConfig({});
  $('cloud-url').value = '';
  $('cloud-user').value = '';
  renderCloudStatus();
}

function renderCloudStatus(tempMsg) {
  const cfg = loadCloudConfig();
  const on = cloudEnabled();
  $('cloud-setup').classList.toggle('hidden', on);
  $('cloud-active').classList.toggle('hidden', !on);
  if (!on) return;

  let msg;
  if (tempMsg) {
    msg = tempMsg;
  } else if (cfg.lastError) {
    msg = '保存できていません（通信かURLを確認してください）';
  } else if (cfg.lastSync) {
    msg = '最終バックアップ: ' + new Date(cfg.lastSync).toLocaleString('ja-JP') + '（' + cfg.user + '）';
  } else {
    msg = '設定済み（まだ保存していません）';
  }
  $('cloud-status-text').textContent = msg;
  if (typeof renderBackupBanner === 'function') renderBackupBanner();
}

$('cloud-save-setup').addEventListener('click', cloudSaveSetup);
$('cloud-sync-btn').addEventListener('click', function () { cloudSaveNow(true); });
$('cloud-restore-btn').addEventListener('click', cloudRestore);
$('cloud-disconnect-btn').addEventListener('click', cloudDisconnect);

document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'hidden' && cloudEnabled()) cloudSaveNow(false);
});

(function cloudBoot() {
  const cfg = loadCloudConfig();
  if (cfg.url) $('cloud-url').value = cfg.url;
  if (cfg.user) $('cloud-user').value = cfg.user;
  renderCloudStatus();
})();

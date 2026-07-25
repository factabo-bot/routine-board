'use strict';

// ========== Google Drive 自動バックアップ ==========
// クライアントIDだけを保存し、アクセストークンは端末内のメモリにのみ保持する
// （ページを閉じるたびに消え、次回開いたときに黙って取り直す＝サーバー不要の構成）
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FILE_NAME = 'EriRoutine_backup.json';
const DRIVE_CONFIG_KEY = 'routine-board-drive';
const DRIVE_SYNC_DEBOUNCE_MS = 4000;

function loadDriveConfig() {
  try { return JSON.parse(localStorage.getItem(DRIVE_CONFIG_KEY)) || {}; } catch (e) { return {}; }
}
function saveDriveConfig(cfg) { localStorage.setItem(DRIVE_CONFIG_KEY, JSON.stringify(cfg)); }

let driveTokenClient = null;
let driveAccessToken = null;
let driveSyncTimer = null;
let driveSyncing = false;

function driveGoogleReady() {
  return !!(window.google && google.accounts && google.accounts.oauth2);
}

function driveInitTokenClient(clientId) {
  if (!driveGoogleReady()) return false;
  if (driveTokenClient && driveTokenClient._clientId === clientId) return true;
  driveTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: DRIVE_SCOPE,
    callback: function (resp) {
      if (resp.error) {
        renderDriveStatus('接続できませんでした（' + resp.error + '）。もう一度お試しください。');
        return;
      }
      driveAccessToken = resp.access_token;
      driveAfterAuth();
    },
  });
  driveTokenClient._clientId = clientId;
  return true;
}

function driveSaveClientId() {
  const id = $('drive-client-id').value.trim();
  if (!id) return;
  const cfg = loadDriveConfig();
  cfg.clientId = id;
  saveDriveConfig(cfg);
  renderDriveStatus();
}

function driveConnect() {
  const cfg = loadDriveConfig();
  if (!cfg.clientId) return;
  if (!driveInitTokenClient(cfg.clientId)) {
    alert('読み込み中です。数秒待ってからもう一度お試しください。');
    return;
  }
  driveTokenClient.requestAccessToken({ prompt: 'consent' });
}

function driveSilentReconnect() {
  const cfg = loadDriveConfig();
  if (!cfg.connected || !cfg.clientId) return;
  if (!driveInitTokenClient(cfg.clientId)) return;
  driveTokenClient.requestAccessToken({ prompt: '' });
}

async function driveAfterAuth() {
  const cfg = loadDriveConfig();
  cfg.connected = true;
  saveDriveConfig(cfg);
  if (!cfg.fileId) {
    try {
      cfg.fileId = await driveFindFile();
      saveDriveConfig(cfg);
    } catch (e) {}
  }
  renderDriveStatus();
  driveSyncNow();
}

async function driveApiFetch(url, options) {
  options = options || {};
  options.headers = Object.assign({}, options.headers, { Authorization: 'Bearer ' + driveAccessToken });
  return fetch(url, options);
}

async function driveFindFile() {
  const q = encodeURIComponent("name='" + DRIVE_FILE_NAME + "' and trashed=false");
  const res = await driveApiFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id)');
  if (!res.ok) return null;
  const data = await res.json();
  return (data.files && data.files[0]) ? data.files[0].id : null;
}

async function driveSyncNow() {
  const cfg = loadDriveConfig();
  if (!cfg.connected || driveSyncing) return;
  if (!driveAccessToken) { driveSilentReconnect(); return; }
  driveSyncing = true;
  try {
    const body = JSON.stringify(state, null, 2);
    let res;
    if (cfg.fileId) {
      res = await driveApiFetch('https://www.googleapis.com/upload/drive/v3/files/' + cfg.fileId + '?uploadType=media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: body,
      });
      if (res.status === 404) cfg.fileId = null;
    }
    if (!cfg.fileId) {
      const boundary = '-------EriRoutineBackup';
      const delimiter = '\r\n--' + boundary + '\r\n';
      const closeDelim = '\r\n--' + boundary + '--';
      const multipartBody =
        delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify({ name: DRIVE_FILE_NAME, mimeType: 'application/json' }) +
        delimiter + 'Content-Type: application/json\r\n\r\n' + body +
        closeDelim;
      res = await driveApiFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
        body: multipartBody,
      });
      if (res.ok) { const created = await res.json(); cfg.fileId = created.id; }
    }
    if (res && res.status === 401) {
      driveAccessToken = null;
      saveDriveConfig(cfg);
      driveSyncing = false;
      driveSilentReconnect();
      return;
    }
    if (res && res.ok) cfg.lastSync = new Date().toISOString();
    saveDriveConfig(cfg);
  } catch (e) {
    // オフライン等。次の変更または次回起動時にまた試みる
  }
  driveSyncing = false;
  renderDriveStatus();
}

function scheduleDriveSync() {
  const cfg = loadDriveConfig();
  if (!cfg.connected) return;
  clearTimeout(driveSyncTimer);
  driveSyncTimer = setTimeout(driveSyncNow, DRIVE_SYNC_DEBOUNCE_MS);
}

function driveFlushSyncNow() {
  const cfg = loadDriveConfig();
  if (!cfg.connected) return;
  clearTimeout(driveSyncTimer);
  driveSyncNow();
}

function driveDisconnect() {
  if (!confirm('Google Driveとの連携を解除します。Drive上に保存済みのファイルはそのまま残ります。')) return;
  const token = driveAccessToken;
  const cfg = loadDriveConfig();
  saveDriveConfig({ clientId: cfg.clientId }); // クライアントIDだけは残す（再接続がしやすいように）
  driveAccessToken = null;
  if (token && window.google) google.accounts.oauth2.revoke(token, function () {});
  renderDriveStatus();
}

async function driveRestore() {
  const cfg = loadDriveConfig();
  if (!cfg.connected || !cfg.fileId) { alert('まだ同期されたバックアップがありません'); return; }
  if (!driveAccessToken) { alert('接続し直しています。少ししてからもう一度お試しください'); driveSilentReconnect(); return; }
  let data;
  try {
    const res = await driveApiFetch('https://www.googleapis.com/drive/v3/files/' + cfg.fileId + '?alt=media');
    if (!res.ok) throw new Error('fetch failed');
    data = await res.json();
  } catch (e) {
    alert('取得に失敗しました。通信環境を確認してください。');
    return;
  }
  const when = cfg.lastSync ? new Date(cfg.lastSync).toLocaleString('ja-JP') : '不明';
  if (!confirm('Google Drive上のバックアップ（最終同期: ' + when + '）で今のデータを置き換えます。よろしいですか？')) return;
  state = mergeState(data);
  saveState();
  renderSettings();
  alert('復元しました');
}

function renderDriveStatus(errorMsg) {
  const cfg = loadDriveConfig();
  const setupBox = $('drive-setup');
  const connectBox = $('drive-connect-box');
  const connectedBox = $('drive-connected-box');

  setupBox.classList.toggle('hidden', !!cfg.clientId);
  connectBox.classList.toggle('hidden', !cfg.clientId || !!cfg.connected);
  connectedBox.classList.toggle('hidden', !cfg.connected);

  if (errorMsg) {
    $('drive-status-text').textContent = errorMsg;
  } else if (cfg.connected) {
    $('drive-status-text').textContent = cfg.lastSync
      ? '最終同期: ' + new Date(cfg.lastSync).toLocaleString('ja-JP')
      : '接続済み（まだ同期していません）';
  }
  if (typeof renderBackupBanner === 'function' && document.getElementById('backup-banner')) renderBackupBanner();
}

$('drive-save-id').addEventListener('click', driveSaveClientId);
$('drive-connect-btn').addEventListener('click', driveConnect);
$('drive-sync-btn').addEventListener('click', driveFlushSyncNow);
$('drive-restore-btn').addEventListener('click', driveRestore);
$('drive-disconnect-btn').addEventListener('click', driveDisconnect);
$('drive-change-id').addEventListener('click', function () {
  if (!confirm('クライアントIDの設定をやり直します。よろしいですか？')) return;
  saveDriveConfig({});
  driveAccessToken = null;
  $('drive-client-id').value = '';
  renderDriveStatus();
});

document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'hidden') driveFlushSyncNow();
});

(function driveBoot() {
  const cfg = loadDriveConfig();
  if (cfg.clientId) $('drive-client-id').value = cfg.clientId;
  renderDriveStatus();
  if (!cfg.connected) return;
  (function waitForGoogle(tries) {
    if (driveGoogleReady()) { driveSilentReconnect(); return; }
    if (tries > 0) setTimeout(function () { waitForGoogle(tries - 1); }, 300);
  })(20);
})();

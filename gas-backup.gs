// Eri's Routine バックアップ用 Google Apps Script
//
// 【セットアップ手順】
// 1. https://script.google.com/ で「新しいプロジェクト」
// 2. このファイルの中身を全部コピーして貼り付け（元のmyFunctionは消す）
// 3. 右上「デプロイ」→「新しいデプロイ」→種類の選択（歯車）→「ウェブアプリ」
//    - 次のユーザーとして実行: 自分
//    - アクセスできるユーザー: 全員
// 4. 「デプロイ」→初回は承認を求められるので許可
// 5. 表示された「ウェブアプリのURL」をコピーしてアプリの設定画面に貼る
//
// ※ コードを修正したときは「デプロイ」→「デプロイを管理」→鉛筆マーク→
//    バージョン「新バージョン」→デプロイ（URLは変わりません）

var FOLDER_NAME = 'EriRoutine_backup';

function getFolder_() {
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function getFile_(user) {
  var name = 'backup_' + user + '.json';
  var folder = getFolder_();
  var it = folder.getFilesByName(name);
  return it.hasNext() ? it.next() : null;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// バックアップの取得（?user=eri）
function doGet(e) {
  try {
    var user = (e.parameter.user || 'default').replace(/[^A-Za-z0-9_-]/g, '');
    var file = getFile_(user);
    if (!file) return json_({ ok: true, empty: true });
    return json_({
      ok: true,
      updated: file.getLastUpdated().toISOString(),
      data: JSON.parse(file.getBlob().getDataAsString())
    });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// バックアップの保存（本文にJSONを丸ごとPOST）
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var user = String(body.user || 'default').replace(/[^A-Za-z0-9_-]/g, '');
    var payload = JSON.stringify(body.data);
    var name = 'backup_' + user + '.json';
    var file = getFile_(user);
    if (file) {
      file.setContent(payload);
    } else {
      getFolder_().createFile(name, payload, MimeType.PLAIN_TEXT);
    }
    return json_({ ok: true, updated: new Date().toISOString() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

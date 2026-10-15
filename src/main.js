import { PiperPlus } from "piper-plus";
import * as ort from "onnxruntime-web";
import lamejs from "lamejs";

const $ = (id) => document.getElementById(id);
const textEl = $("text"), makeBtn = $("make"), statusEl = $("status"), bar = $("bar"), listEl = $("list");
let tts = null, db = null, entries = [], audioURLs = new Set(), busy = false;
const DB_NAME = "audio-studio-free-db", STORE = "audio-entries";

function status(message, progress) {
  statusEl.textContent = message;
  if (typeof progress === "number") bar.style.width = `${Math.max(0, Math.min(100, progress * 100))}%`;
}
function esc(s) { return String(s ?? "").replace(/[&<>\"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function getAll() {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
function put(entry) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
function del(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
function mp3Blob(samples, sampleRate) {
  // Piper's output samples are Float32 mono. Encode them locally as MP3.
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  const chunkSize = 1152, chunks = [];
  for (let i = 0; i < samples.length; i += chunkSize) {
    const part = samples.subarray(i, Math.min(i + chunkSize, samples.length));
    const pcm = new Int16Array(part.length);
    for (let j = 0; j < part.length; j++) {
      const v = Math.max(-1, Math.min(1, part[j]));
      pcm[j] = v < 0 ? v * 32768 : v * 32767;
    }
    const encoded = encoder.encodeBuffer(pcm);
    if (encoded.length) chunks.push(new Uint8Array(encoded));
  }
  const end = encoder.flush();
  if (end.length) chunks.push(new Uint8Array(end));
  return new Blob(chunks, { type: "audio/mpeg" });
}
function fmtDate(iso) { return new Date(iso).toLocaleString("ja-JP", {month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}); }
function render() {
  $("items-count").textContent = `${entries.length}件`;
  for (const u of audioURLs) URL.revokeObjectURL(u);
  audioURLs.clear();
  if (!entries.length) { listEl.innerHTML = '<div class="empty">まだ音声がありません。</div>'; return; }
  listEl.innerHTML = entries.slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(e => {
    const url = e.restoredWithoutAudio ? "" : URL.createObjectURL(e.blob); if (url) audioURLs.add(url);
    return `<article class="item"><h4>${esc(e.title)}</h4><p>${esc(e.text.length > 240 ? e.text.slice(0,240)+"…" : e.text)}</p><div class="meta">${esc(fmtDate(e.createdAt))} · ${e.text.length}文字 · ${e.restoredWithoutAudio ? "音声未生成" : "MP3"}</div>${url ? `<audio controls preload="none" src="${url}"></audio>` : `<p class="meta">バックアップから復元したテキストです。MP3を作り直してください。</p>`}<div class="btns">${e.restoredWithoutAudio ? `<button class="btn soft mini" data-recreate="${esc(e.id)}">文章を入力欄に戻す</button>` : `<button class="btn soft mini" data-download="${esc(e.id)}">MP3を保存</button>`}<button class="btn plain mini" data-delete="${esc(e.id)}">削除</button></div></article>`;
  }).join("");
}
async function initialize() {
  try {
    status("音声エンジンを読み込んでいます…", 0.04);
    tts = await PiperPlus.initialize({
      model: "ayousanz/piper-plus-tsukuyomi-chan",
      ort,
      onProgress: ({ stage, progress, message }) => status(`準備中：${message || stage || "モデル読み込み"} (${Math.round((progress || 0) * 100)}%)`, progress || 0)
    });
    makeBtn.disabled = false;
    status("準備完了！文章を入力して音声を生成できます。", 1);
  } catch (err) {
    status("音声エンジンの準備に失敗しました。通信環境を確認し、ページを再読み込みしてください。詳細：" + (err?.message || err));
  }
}
textEl.addEventListener("input", () => $("count").textContent = `${textEl.value.length}文字`);
$("preview").onclick = () => {
  const text = textEl.value.trim();
  if (!text) { status("先に文章を入力してください。"); return; }
  if (!("speechSynthesis" in window)) { status("このブラウザは標準音声の試聴に対応していません。"); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = "ja-JP"; u.rate = Number($("speed").value) || 1;
  u.onstart = () => status("端末の標準音声で試聴中…");
  u.onend = () => status("試聴が終わりました。");
  speechSynthesis.speak(u);
};
$("stop").onclick = () => { if ("speechSynthesis" in window) speechSynthesis.cancel(); status("標準音声の試聴を停止しました。"); };
makeBtn.onclick = async () => {
  const text = textEl.value.trim();
  if (!text || !tts || busy) return;
  busy = true; makeBtn.disabled = true;
  try {
    status("日本語音声を生成中…端末によっては少し時間がかかります。", 0.2);
    const audio = await tts.synthesize(text, { language: "ja", lengthScale: 1 / (Number($("speed").value) || 1) });
    status("MP3に変換中…", 0.75);
    const blob = mp3Blob(audio.samples, audio.sampleRate);
    const now = new Date();
    const entry = { id: crypto.randomUUID(), title: `音声 ${now.toLocaleDateString("ja-JP")} ${now.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})}`, text, createdAt: now.toISOString(), blob };
    await put(entry);
    entries.push(entry); render();
    status("完成！一覧に保存しました。MP3を再生・ダウンロードできます。", 1);
    textEl.value = ""; $("count").textContent = "0文字";
  } catch (err) {
    status("音声生成に失敗しました：" + (err?.message || err));
  } finally { busy = false; makeBtn.disabled = !tts; }
};
listEl.addEventListener("click", async ev => {
  const btn = ev.target.closest("button"); if (!btn) return;
  const e = entries.find(x => x.id === btn.dataset.download || x.id === btn.dataset.delete || x.id === btn.dataset.recreate); if (!e) return;
  if (btn.dataset.recreate) { textEl.value = e.text; $("count").textContent = `${e.text.length}文字`; textEl.focus(); window.scrollTo({top:0,behavior:"smooth"}); status("文章を入力欄に戻しました。生成ボタンで音声を作り直してください。"); }
  else if (btn.dataset.download) {
    const url = URL.createObjectURL(e.blob), a = document.createElement("a");
    a.href = url; a.download = (e.title || "audio").replace(/[\\/:*?"<>|]/g, "_") + ".mp3"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } else if (btn.dataset.delete && confirm(`「${e.title}」を削除しますか？`)) {
    await del(e.id); entries = entries.filter(x => x.id !== e.id); render(); status("削除しました。");
  }
});
$("backup").onclick = () => {
  // Backup JSON stores text/title only; MP3 files must be downloaded individually.
  const payload = { app: "Audio Studio Free", version: 1, entries: entries.map(({id,title,text,createdAt}) => ({id,title,text,createdAt})) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)], {type:"application/json"}));
  const a = document.createElement("a"); a.href = url; a.download = "audio-studio-free-backup.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
};
$("restore").onchange = async ev => {
  const file = ev.target.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.entries)) throw new Error("format");
    const missing = data.entries.filter(e => e && typeof e.text === "string" && !entries.some(old => old.id === e.id));
    if (missing.length) status(`バックアップのテキスト ${missing.length}件を読み込みました。MP3はバックアップに含まれないため、音声を再生成してください。`);
    for (const e of missing) await put({id:e.id || crypto.randomUUID(), title:e.title || "復元した音声", text:e.text, createdAt:e.createdAt || new Date().toISOString(), blob:new Blob([], {type:"audio/mpeg"}), restoredWithoutAudio:true});
    entries = await getAll(); render();
    if (!missing.length) status("追加する新しい項目はありませんでした。");
  } catch { status("有効なバックアップJSONを選択してください。"); }
  ev.target.value = "";
};
(async () => {
  try { db = await openDB(); entries = await getAll(); render(); }
  catch (e) { status("このブラウザではローカル保存を開始できませんでした：" + e.message); }
  initialize();
})();

'use strict';

const API = 'https://script.google.com/macros/s/AKfycbxveOzSpO77b79QQUeQtSYvkA3lKL92E7yrGUJq_fMYYlVyrBXhcKmVMTMyHL3BzcYZcw/exec';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1zJOZR5G_kjLyk3cp-KGnRrl_om3yOnq6bV7S8Y6v-l0/edit';
const DEMO = new URLSearchParams(location.search).has('demo');

/* ---------- 小工具 ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
};

const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  learn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 20V11M12 20V5M19 20v-6"/></svg>',
  leader: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5v.7M12 17h.01"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>'
};

/* ---------- 裝置判斷 ---------- */
const ua = navigator.userAgent;
const device = {
  ios: /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  android: /Android/.test(ua),
  line: /\bLine\//i.test(ua),
  inApp: /\bLine\/|FBAN|FBAV|Instagram/i.test(ua),
  iosSafari: false,
  mac: /Macintosh/.test(ua) && !(navigator.maxTouchPoints > 1),
  safari: /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|Edg\//.test(ua),
  standalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
};
device.iosSafari = device.ios && device.safari && !device.inApp;
device.mobile = device.ios || device.android || (matchMedia('(pointer: coarse)').matches && innerWidth < 900);

let installEvent = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; });

/* ---------- 狀態 ---------- */
const state = { data: null, leader: false, view: 'home', planTab: 'up', loading: false };
const VIEWS = [
  { id: 'home', label: '首頁', icon: 'home' },
  { id: 'plan', label: '安排', icon: 'plan' },
  { id: 'learn', label: '學習進度', icon: 'learn' },
  { id: 'leader', label: '組長', icon: 'leader', leaderOnly: true }
];

/* ---------- 資料 ---------- */
async function api(params) {
  if (DEMO) return demoApi(params);
  const q = new URLSearchParams(Object.assign({ pin: store.get('pin') || '' }, params));
  const res = await fetch(API + '?' + q.toString(), { redirect: 'follow' });
  if (!res.ok) throw new Error('連線失敗（' + res.status + '）');
  return res.json();
}

async function load(quiet) {
  if (state.loading) return;
  state.loading = true;
  $('#refreshBtn').classList.add('spin');
  try {
    const r = await api({ api: 'data' });
    if (!r.ok) throw new Error(r.error);
    state.data = r.data;
    state.leader = r.leader;
    if (!r.leader && store.get('pin')) store.set('pin', null);
    store.set('cache', JSON.stringify({ at: Date.now(), data: r.data, leader: r.leader }));
    store.set('cacheAt', String(Date.now()));
    render();
    if (!quiet) toast('已更新');
  } catch (e) {
    toast(navigator.onLine ? '更新失敗，顯示上次的資料' : '目前離線，顯示上次的資料');
  } finally {
    state.loading = false;
    $('#refreshBtn').classList.remove('spin');
    stamp();
  }
}

function stamp() {
  const at = +store.get('cacheAt');
  if (!at) { $('#updated').textContent = ''; return; }
  const d = new Date(at);
  $('#updated').textContent = '更新於 ' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/* ---------- 版面 ---------- */
function nav() {
  const views = VIEWS.filter(v => !v.leaderOnly || state.leader);
  const html = views.map(v => '<button type="button" class="tab" data-view="' + v.id + '"' + (state.view === v.id ? ' aria-current="page"' : '') + '>' + ICON[v.icon] + '<span>' + v.label + '</span></button>').join('');
  $('#tabbar').innerHTML = html;
  $('#tabbar').style.gridTemplateColumns = 'repeat(' + views.length + ', minmax(0, 1fr))';
  $('#sideNav').innerHTML = html;
  $('#sideFoot').innerHTML = device.mobile ? '' : '按 <kbd>R</kbd> 更新資料<br>按 <kbd>1</kbd>–<kbd>' + views.length + '</kbd> 切換頁面';
}

function go(view) {
  if (view === 'leader' && !state.leader) view = 'home';
  state.view = view;
  store.set('view', view);
  render();
  scrollTo({ top: 0 });
}

function render() {
  nav();
  const v = VIEWS.find(x => x.id === state.view) || VIEWS[0];
  $('#title').textContent = v.id === 'home' ? (state.data ? state.data.team : '育博文書組') : v.label;
  document.title = (v.id === 'home' ? '' : v.label + '｜') + '育博文書組';
  if (!state.data) { $('#view').innerHTML = '<div class="empty">資料載入中…</div>'; return; }
  $('#view').innerHTML = ({ home: viewHome, plan: viewPlan, learn: viewLearn, leader: viewLeader }[state.view] || viewHome)();
}

/* ---------- 共用片段 ---------- */
function md(date) { const p = date.split('/'); return { y: p[0], m: +p[1], d: +p[2] }; }
function when(n) { return n === 0 ? '就是今天' : n === 1 ? '就是明天' : '還有 ' + n + ' 天'; }
function dateRow(x, sub, chips) {
  const t = md(x.date);
  return '<div class="row"><div class="datebox"><span class="m">' + t.m + '月</span><span class="d">' + t.d + '</span></div>' +
    '<div class="row-main"><div class="row-title">' + esc(x.item) + '</div>' +
    (sub ? '<div class="row-sub">' + sub + '</div>' : '') + (chips || '') + '</div></div>';
}

/* ---------- 首頁 ---------- */
function viewHome() {
  const d = state.data;
  const up = d.sessions.filter(s => s.days >= 0);
  const next = up[0];
  const gifts = d.gifts.filter(g => g.days >= 0);
  const done = d.sessions.filter(s => s.days < 0).length;
  let hero = '<div class="card empty">目前沒有接下來的辦道</div>';
  if (next) {
    const t = md(next.date);
    hero = '<div class="hero"><div class="hero-top"><span class="hero-label">下一場辦道</span><span class="pill">' + when(next.days) + '</span></div>' +
      '<div><div class="hero-date">' + t.m + '/' + t.d + '（' + next.wd + '）</div><div class="hero-item">' + esc(next.item) + '｜文書組長 ' + esc(next.leader) + '</div></div>' +
      '<div class="duo"><div><div class="k">掛號學習</div><div class="v">' + esc(next.reg || '未定') + '</div></div><div><div class="k">表文學習</div><div class="v">' + esc(next.memo || '未定') + '</div></div></div></div>';
  }
  const rest = up.slice(1, 4).map(s => dateRow(s, '掛號 ' + esc(s.reg) + '｜表文 ' + esc(s.memo))).join('');
  const giftRows = gifts.slice(0, 3).map(g => dateRow(g, '🎁 禮物製作 ' + esc(g.makers.join('、') || '未定'))).join('');
  return '<div class="grid-2"><div style="display:flex;flex-direction:column;gap:18px">' + hero +
    '<div class="stat-grid"><div class="stat"><div class="k">本年度已辦</div><div class="v">' + done + ' 場</div></div>' +
    '<div class="stat"><div class="k">接下來</div><div class="v">' + up.length + ' 場</div></div></div></div>' +
    '<div style="display:flex;flex-direction:column;gap:18px">' +
    (rest ? '<div><div class="group-title">之後的辦道</div><div class="list">' + rest + '</div></div>' : '') +
    (giftRows ? '<div><div class="group-title">法會禮物</div><div class="list">' + giftRows + '</div></div>' : '') +
    '</div></div>';
}

/* ---------- 安排 ---------- */
function viewPlan() {
  const d = state.data;
  const isUp = state.planTab === 'up';
  const ses = d.sessions.filter(s => isUp ? s.days >= 0 : s.days < 0);
  const gifts = d.gifts.filter(g => isUp ? g.days >= 0 : g.days < 0);
  if (!isUp) { ses.reverse(); gifts.reverse(); }
  const rows = ses.map(s => dateRow(s, '（' + s.wd + '）文書組長 ' + esc(s.leader),
    '<div class="chips" style="margin-top:6px"><span class="chip">掛號 ' + esc(s.reg || '未定') + '</span><span class="chip gold">表文 ' + esc(s.memo || '未定') + '</span></div>')).join('');
  const grows = gifts.map(g => dateRow(g, '（' + g.wd + '）法會禮物',
    '<div class="chips" style="margin-top:6px">' + (g.makers.length ? g.makers.map(m => '<span class="chip gold">🎁 ' + esc(m) + '</span>').join('') : '<span class="chip gold">未定</span>') + '</div>')).join('');
  return '<div class="seg" role="group" aria-label="切換"><button type="button" data-plan="up" aria-pressed="' + isUp + '">接下來</button><button type="button" data-plan="done" aria-pressed="' + !isUp + '">已完成</button></div>' +
    '<div class="grid-2"><div><div class="group-title">辦道</div>' + (rows ? '<div class="list">' + rows + '</div>' : '<div class="card empty">沒有資料</div>') + '</div>' +
    '<div><div class="group-title">法會禮物</div>' + (grows ? '<div class="list">' + grows + '</div>' : '<div class="card empty">' + (isUp ? '還沒有法會日期' : '沒有資料') + '</div>') + '</div></div>';
}

/* ---------- 學習進度 ---------- */
function viewLearn() {
  const d = state.data;
  const goal = d.goal || 3;
  const stat = {}; d.stats.forEach(s => stat[s.name] = s);
  const people = (d.progress.length ? d.progress : d.stats.map(s => ({ name: s.name, reg: { count: 0, checks: [], status: '' }, memo: { count: 0, checks: [], status: '' } })));
  const cards = people.map(p => {
    const ok = n => p[n].checks.filter(c => c === '已熟練').length;
    const pct = n => Math.min(p[n].count / goal, 1) * 100;
    const badge = [p.reg.status, p.memo.status].some(s => s === '優秀!') ?
      '<span class="chip green">' + (p.reg.status === '優秀!' && p.memo.status === '優秀!' ? '雙項優秀!' : (p.reg.status === '優秀!' ? '掛號' : '表文') + '優秀!') + '</span>' : '';
    const g = stat[p.name] ? stat[p.name].gift : 0;
    return '<div class="person"><div class="person-head"><div class="person-name">' + esc(p.name) + '</div>' + badge + '</div>' +
      '<div class="bars"><span>掛號</span><div class="bar"><i style="width:' + pct('reg') + '%"></i></div><span class="num">' + p.reg.count + '/' + goal + '</span>' +
      '<span>表文</span><div class="bar gold"><i style="width:' + pct('memo') + '%"></i></div><span class="num">' + p.memo.count + '/' + goal + '</span></div>' +
      '<div class="row-sub">檢核熟練 ' + (ok('reg') + ok('memo')) + '/' + (p.reg.checks.length + p.memo.checks.length) + (g ? '｜禮物製作 ' + g + ' 次' : '') + '</div></div>';
  }).join('');
  return '<p class="note">實作滿 ' + goal + ' 次、檢核都熟練，<br class="m-br">就是「優秀!」</p><div class="people" style="display:grid;gap:12px">' + cards + '</div>';
}

/* ---------- 組長 ---------- */
function viewLeader() {
  const d = state.data;
  const list = d.pending || [];
  const cards = list.map(p => {
    const who = p.from || p.display || '某位成員';
    const body = p.from ?
      '<div class="row-sub">' + esc(p.date) + ' ' + esc(p.item) + '｜' + esc(p.role) + '</div>' +
      '<div class="quote"><span class="muted" style="font-size:12px">群組將看到</span>\n' + esc(p.preview) + '</div>' +
      '<div class="btn-row"><button type="button" class="btn primary" data-yes="' + p.id + '">發布</button>' +
      '<button type="button" class="btn" data-swap="' + p.id + '">換人</button>' +
      '<button type="button" class="btn ghost" data-no="' + p.id + '">不是</button></div>' :
      '<div class="row-sub">看不出是哪位組員，請選擇：</div>' +
      '<select data-who="' + p.id + '"><option value="">選擇請假人</option>' + (d.members || []).map(m => '<option>' + esc(m) + '</option>').join('') + '</select>' +
      '<div class="btn-row" style="grid-template-columns:repeat(2,minmax(0,1fr))"><button type="button" class="btn primary" data-whoyes="' + p.id + '">下一步</button>' +
      '<button type="button" class="btn ghost" data-no="' + p.id + '">不是請假</button></div>';
    return '<div class="person"><div class="person-head"><div class="person-name">是請假嗎？ #' + p.id + '</div></div>' +
      '<div style="font-size:15px;line-height:1.6">' + esc(who) + '：「' + esc(p.quote) + '」</div>' + body + '</div>';
  }).join('');
  return '<div class="grid-2"><div><div class="group-title">待確認的請假</div>' +
    (cards ? '<div style="display:flex;flex-direction:column;gap:12px">' + cards + '</div>' : '<div class="card empty">目前沒有待確認的請假 🙏</div>') +
    '</div><div><div class="group-title">工具</div><div class="list">' +
    '<a class="row" href="' + SHEET_URL + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><div class="row-main"><div class="row-title">開啟試算表</div><div class="row-sub">新增辦道日期、法會、修改人選</div></div></a>' +
    '<div class="row"><div class="row-main"><div class="row-title">辦道前提醒</div><div class="row-sub">前 7 天、前 1 天，自動發到群組</div></div></div>' +
    '<div class="row"><div class="row-main"><div class="row-title">月報</div><div class="row-sub">每月 1 號私訊給你</div></div></div>' +
    '</div></div></div>';
}

async function leaderAction(params, okMsg) {
  try {
    const r = await api(params);
    if (!r.ok) throw new Error(r.error);
    toast(okMsg || '完成');
    await load(true);
  } catch (e) { toast(e.message || '操作失敗'); }
}

function confirmSheet(title, html, actions) {
  openSheet(title, html + '<div class="btn-row" style="grid-template-columns:repeat(' + actions.length + ',minmax(0,1fr))">' +
    actions.map((a, i) => '<button type="button" class="btn ' + (a.cls || '') + '" data-act="' + i + '">' + a.label + '</button>').join('') + '</div>');
  $('#sheetBody').querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
    const a = actions[+b.dataset.act]; closeSheet(); if (a.run) a.run();
  }));
}

/* ---------- 說明（依裝置） ---------- */
function installHelp() {
  if (device.standalone) return '<div class="card empty">已加入主畫面 👍</div>';
  if (device.inApp) {
    return '<ol class="steps"><li>點右上角 ' + ICON.dots + ' 或「⋯」</li><li>選「用預設瀏覽器開啟」</li><li>開啟後，再按這裡的說明加入主畫面</li></ol>';
  }
  if (device.ios) {
    if (!device.iosSafari) return '<ol class="steps"><li>複製網址，用 Safari 開啟</li><li>點 ' + ICON.share + ' 分享</li><li>選「加入主畫面」</li></ol>';
    return '<ol class="steps"><li>點下方的 ' + ICON.share + ' 分享</li><li>往下找「加入主畫面」' + ICON.plus + '</li><li>點右上角「新增」</li></ol>';
  }
  if (device.android) {
    return (installEvent ? '<button type="button" class="btn primary" id="installBtn">加到主畫面</button>' : '') +
      '<ol class="steps"><li>點右上角 ' + ICON.dots + '</li><li>選「加到主畫面」或「安裝應用程式」</li><li>點「新增」</li></ol>';
  }
  if (device.mac && device.safari) return '<ol class="steps"><li>點選單列「檔案」</li><li>選「加入 Dock」</li></ol>';
  return (installEvent ? '<button type="button" class="btn primary" id="installBtn">安裝到電腦</button>' : '') +
    '<ol class="steps"><li>看網址列最右邊的安裝圖示</li><li>點「安裝」</li><li>之後可從桌面或開始選單開啟</li></ol>';
}

function usageHelp() {
  if (device.mobile) {
    return '<ol class="steps"><li>點下方分頁切換畫面</li><li>點右上角 ' + ICON.refresh + ' 更新資料</li><li>要請假，在 LINE 群組說一聲就好</li></ol>';
  }
  return '<ol class="steps"><li>左側選單切換畫面</li><li>按 <kbd>R</kbd> 更新資料，<kbd>1</kbd>–<kbd>4</kbd> 切換頁面</li><li>要請假，在 LINE 群組說一聲就好</li></ol>';
}

function openHelp() {
  const leaderPart = state.leader ?
    '<button type="button" class="btn" id="leaderOut">登出組長</button>' :
    '<details><summary class="group-title" style="cursor:pointer;list-style:none">組長登入</summary>' +
    '<form id="pinForm" style="display:flex;gap:8px;margin-top:8px"><label class="sr" for="pinInput">組長密碼</label><input id="pinInput" inputmode="numeric" maxlength="6" placeholder="組長密碼">' +
    '<button type="submit" class="btn primary">登入</button></form></details>';
  openSheet('說明',
    '<div><div class="group-title">' + (device.mobile ? '加到手機主畫面' : '安裝到電腦') + '</div>' + installHelp() + '</div>' +
    '<div><div class="group-title">怎麼用</div>' + usageHelp() + '</div>' +
    leaderPart);
  const ib = $('#installBtn');
  if (ib) ib.addEventListener('click', async () => { installEvent.prompt(); await installEvent.userChoice; installEvent = null; closeSheet(); });
  const pf = $('#pinForm');
  if (pf) pf.addEventListener('submit', async e => {
    e.preventDefault();
    store.set('pin', $('#pinInput').value.trim());
    closeSheet();
    await load(true);
    if (state.leader) { toast('已開啟組長功能'); go('leader'); } else { store.set('pin', null); toast('組長密碼不正確'); }
  });
  const lo = $('#leaderOut');
  if (lo) lo.addEventListener('click', () => { store.set('pin', null); state.leader = false; delete state.data.pending; closeSheet(); go('home'); toast('已登出組長'); });
}

/* ---------- 面板與提示 ---------- */
function openSheet(title, html) {
  $('#sheetTitle').textContent = title;
  $('#sheetBody').innerHTML = html;
  $('#sheet').hidden = false;
}
function closeSheet() { $('#sheet').hidden = true; }
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 2200);
}

/* ---------- 登入 ---------- */
function showLogin(err) {
  $('#app').hidden = true; $('#login').hidden = false;
  $('#loginErr').textContent = err || '';
  setTimeout(() => $('#codeInput').focus(), 50);
}
function showApp() { $('#login').hidden = true; $('#app').hidden = false; }

/* ---------- 事件 ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-view],[data-plan],[data-close],[data-yes],[data-no],[data-swap],[data-whoyes]');
  if (!t) return;
  if (t.dataset.view) go(t.dataset.view);
  else if (t.dataset.plan) { state.planTab = t.dataset.plan; render(); }
  else if ('close' in t.dataset) closeSheet();
  else if (t.dataset.yes) {
    const p = state.data.pending.find(x => x.id == t.dataset.yes);
    confirmSheet('發布人員異動', '<div class="quote">' + esc(p.preview) + '</div><p class="note">會更新試算表，並發到 LINE 群組。</p>',
      [{ label: '取消' }, { label: '發布', cls: 'primary', run: () => leaderAction({ api: 'yes', id: p.id }, '已發布') }]);
  } else if (t.dataset.no) {
    confirmSheet('不是請假？', '<p class="note">這則會被忽略，不會發到群組。</p>',
      [{ label: '返回' }, { label: '忽略', cls: 'primary', run: () => leaderAction({ api: 'no', id: t.dataset.no }, '已忽略') }]);
  } else if (t.dataset.swap) {
    const p = state.data.pending.find(x => x.id == t.dataset.swap);
    const opts = (state.data.members || []).filter(m => m !== p.from).map(m => '<option' + (m === p.to ? ' selected' : '') + '>' + esc(m) + '</option>').join('');
    openSheet('改由誰接手？', '<label class="sr" for="swapSel">接手的人</label><select id="swapSel">' + opts + '</select>' +
      '<button type="button" class="btn primary" id="swapGo">更新並發布</button>');
    $('#swapGo').addEventListener('click', () => { const to = $('#swapSel').value; closeSheet(); leaderAction({ api: 'yes', id: p.id, to: to }, '已發布'); });
  } else if (t.dataset.whoyes) {
    const sel = document.querySelector('[data-who="' + t.dataset.whoyes + '"]');
    if (!sel.value) { toast('請先選擇請假人'); return; }
    leaderAction({ api: 'yes', id: t.dataset.whoyes, who: sel.value }, '已找好接手人選，請再確認');
  }
});

document.addEventListener('keydown', e => {
  if (e.target.matches('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape') closeSheet();
  if (device.mobile) return;
  if (e.key === 'r' || e.key === 'R') load();
  const views = VIEWS.filter(v => !v.leaderOnly || state.leader);
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= views.length) go(views[n - 1].id);
});

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const code = $('#codeInput').value.trim();
  if (!/^\d{6}$/.test(code)) { $('#loginErr').textContent = '請輸入 6 位數字'; return; }
  store.set('key', code);
  $('#loginErr').textContent = '確認中…';
  try {
    const r = await api({ api: 'data' });
    if (!r.ok) { store.set('key', null); $('#loginErr').textContent = r.error; return; }
    state.data = r.data; state.leader = r.leader;
    store.set('cache', JSON.stringify({ at: Date.now(), data: r.data, leader: r.leader }));
    store.set('cacheAt', String(Date.now()));
    showApp(); render(); stamp();
  } catch (err) { store.set('key', null); $('#loginErr').textContent = '連線失敗，請稍後再試'; }
});

$('#refreshBtn').innerHTML = ICON.refresh;
$('#helpBtn').innerHTML = ICON.help;
document.querySelector('.sheet-head .icon-btn').innerHTML = ICON.close;
$('#refreshBtn').addEventListener('click', () => load());
$('#helpBtn').addEventListener('click', openHelp);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && Date.now() - (+store.get('cacheAt') || 0) > 5 * 60 * 1000) load(true);
});

/* ---------- 啟動 ---------- */
(function start() {
  if ('serviceWorker' in navigator && !DEMO) navigator.serviceWorker.register('sw.js').catch(() => {});
  state.view = store.get('view') || 'home';
  try {
    const c = JSON.parse(store.get('cache') || 'null');
    if (c && !DEMO) { state.data = c.data; state.leader = c.leader; }
  } catch (e) {}
  showApp(); render(); stamp();
  load(true);
})();

/* ---------- 示範資料（網址加 ?demo 才使用） ---------- */
function demoApi(p) {
  const leader = new URLSearchParams(location.search).has('leader');
  const S = (date, wd, days, item, leaderName, reg, memo) => ({ date, wd, days, item, leader: leaderName, reg, memo, note: '' });
  const data = {
    team: '育博文書組', today: '2026/11/19', leaderName: '陳芃君',
    sessions: [
      S('2026/9/15', '二', -65, '辦道', '秦敏瑄', '張簡宏輔', '許哲銘'), S('2026/10/8', '四', -42, '辦道', '秦敏瑄', '李雁蓉', '顏珮茹'),
      S('2026/10/13', '二', -37, '辦道', '秦敏瑄', '吳姿儀', '許哲銘'), S('2026/10/27', '二', -23, '辦道', '秦敏瑄', '顏珮茹', '張簡宏輔'),
      S('2026/11/24', '二', 5, '辦道', '陳芃君', '許哲銘', '李雁蓉'), S('2026/12/8', '二', 19, '初一獻供＋辦道', '陳芃君', '吳姿儀', '張簡宏輔'),
      S('2026/12/22', '二', 33, '老母冬季大典＋辦道', '陳芃君', '李雁蓉', '顏珮茹'), S('2027/1/31', '日', 73, '辭歲＋平安齋＋辦道', '陳芃君', '許哲銘', '吳姿儀')
    ],
    gifts: [],
    stats: [['張簡宏輔', 1, 2], ['許哲銘', 2, 2], ['李雁蓉', 2, 1], ['顏珮茹', 1, 2], ['吳姿儀', 2, 1]].map(r => ({ name: r[0], reg: r[1], memo: r[2], gift: 0, total: r[1] + r[2], done: 0 })),
    progress: [['張簡宏輔', 1, 1], ['許哲銘', 0, 2], ['李雁蓉', 1, 0], ['顏珮茹', 1, 1], ['吳姿儀', 1, 0]].map(r => ({
      name: r[0], reg: { count: r[1], checks: Array(5).fill('未開始'), status: '尚未' }, memo: { count: r[2], checks: Array(5).fill('未開始'), status: '尚未' } })),
    goal: 3
  };
  if (leader) {
    data.members = ['張簡宏輔', '許哲銘', '李雁蓉', '顏珮茹', '吳姿儀'];
    data.pending = [{ id: 1, from: '許哲銘', display: '', quote: '那天公司有事，沒辦法去', to: '張簡宏輔', date: '2026/11/24(二)', item: '辦道', role: '掛號',
      preview: '🔄 人員異動\n日期：2026/11/24(二) 辦道\n掛號：改由 張簡宏輔 學習，了愿快樂～' }];
  }
  return Promise.resolve(p.api === 'data' ? { ok: true, leader: leader, data: data } : { ok: true, msg: '示範模式' });
}

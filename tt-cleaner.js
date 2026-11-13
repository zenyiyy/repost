// ==UserScript==
// @name         TikTok Repost & Like Cleaner
// @namespace    tt-cleaner
// @version      1.0.0
// @description  Reposts und Likes auf TikTok auswählen (einzeln oder alle) und entfernen.
// @match        https://www.tiktok.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function () {
  'use strict';
  if (window.__ttCleaner) { window.__ttCleaner.toggle(); return; }

  var state = {
    mode: null,            // 'repost' | 'like'
    selecting: false,
    selected: new Set(),
    done: new Set(),
    running: false,
    stop: false
  };

  // ---------- Hilfsfunktionen ----------
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function idFromHref(href) {
    var m = /\/(?:video|photo)\/(\d+)/.exec(href || '');
    return m ? m[1] : null;
  }

  // Alle Video-Kacheln im Raster finden (Profil-Tabs Reposts / Gefällt mir)
  function tiles() {
    var out = [], seen = new Set();
    var links = document.querySelectorAll('a[href*="/video/"], a[href*="/photo/"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.closest('#ttc-panel')) continue;
      var id = idFromHref(a.getAttribute('href'));
      if (!id || seen.has(id)) continue;
      var el = a.closest('[data-e2e$="-item"]') ||
               a.closest('[class*="DivItemContainer"]') ||
               a.parentElement || a;
      seen.add(id);
      out.push({ id: id, el: el });
    }
    return out;
  }

  function guessMode() {
    var p = location.pathname + ' ';
    var tab = document.querySelector('[role="tab"][aria-selected="true"], [data-e2e$="-tab"][aria-selected="true"]');
    var t = ((tab && (tab.textContent + ' ' + (tab.getAttribute('data-e2e') || ''))) || '').toLowerCase();
    if (/repost/.test(t)) return 'repost';
    if (/like|gefällt|liked/.test(t)) return 'like';
    if (/repost/.test(p)) return 'repost';
    if (/liked|like/.test(p)) return 'like';
    return 'repost';
  }

  // ---------- API-Aufrufe (laufen im Seitenkontext, TikTok signiert sie selbst) ----------
  function call(url) {
    return new Promise(function (resolve) {
      var x = new XMLHttpRequest();
      x.open('POST', url, true);
      x.withCredentials = true;
      x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      var csrf = cookie('tt_csrf_token');
      if (csrf) x.setRequestHeader('tt-csrf-token', csrf);
      x.onload = function () {
        var j = null;
        try { j = JSON.parse(x.responseText); } catch (e) {}
        resolve({ http: x.status, json: j, text: x.responseText });
      };
      x.onerror = function () { resolve({ http: 0, json: null, text: 'Netzwerkfehler' }); };
      x.send('');
    });
  }
  function removeRepost(id) {
    return call('https://www.tiktok.com/tiktok/v1/upvote/delete?aid=1988&item_id=' + id);
  }
  function removeLike(id) {
    return call('https://www.tiktok.com/api/commit/item/digg/?aid=1988&aweme_id=' + id + '&type=0');
  }
  function ok(res) {
    if (res.http < 200 || res.http >= 300) return false;
    if (!res.json) return res.http === 200 && res.text === '';
    return res.json.status_code === 0 || res.json.statusCode === 0;
  }

  // ---------- UI ----------
  var css = '' +
    '#ttc-panel{position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;background:#121212;color:#fff;' +
    'font:14px/1.35 -apple-system,system-ui,sans-serif;border-radius:14px;padding:10px;box-shadow:0 6px 24px rgba(0,0,0,.5);max-width:520px;margin:0 auto}' +
    '#ttc-panel *{box-sizing:border-box}' +
    '#ttc-panel .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}' +
    '#ttc-panel button{flex:1 1 auto;min-height:40px;border:0;border-radius:10px;background:#2a2a2a;color:#fff;font:inherit;font-weight:600;padding:6px 10px}' +
    '#ttc-panel button.on{background:#fe2c55}' +
    '#ttc-panel button.go{background:#fe2c55}' +
    '#ttc-panel button:disabled{opacity:.45}' +
    '#ttc-panel .head{display:flex;justify-content:space-between;align-items:center;font-weight:700}' +
    '#ttc-panel .x{flex:0 0 auto;min-height:32px;width:32px;padding:0;background:transparent;font-size:18px}' +
    '#ttc-status{margin-top:6px;font-size:12px;color:#bbb;white-space:pre-wrap;max-height:72px;overflow:auto}' +
    '.ttc-box{position:absolute;top:6px;left:6px;width:30px;height:30px;border-radius:50%;border:2px solid #fff;' +
    'background:rgba(0,0,0,.35);z-index:50;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;pointer-events:none}' +
    '.ttc-sel .ttc-box{background:#fe2c55;border-color:#fe2c55}' +
    '.ttc-sel{outline:3px solid #fe2c55;outline-offset:-3px}' +
    '.ttc-done{opacity:.25;filter:grayscale(1)}' +
    '.ttc-fail{outline:3px solid #ffb400;outline-offset:-3px}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var panel = document.createElement('div');
  panel.id = 'ttc-panel';
  panel.innerHTML =
    '<div class="head"><span>Repost &amp; Like Cleaner</span><button class="x" data-a="close">✕</button></div>' +
    '<div class="row"><button data-a="m-repost">Reposts</button><button data-a="m-like">Likes</button></div>' +
    '<div class="row"><button data-a="select">Auswählen</button><button data-a="all">Alle auswählen</button><button data-a="none">Keine</button></div>' +
    '<div class="row"><button class="go" data-a="run">Entfernen (0)</button><button data-a="stop" disabled>Stopp</button></div>' +
    '<div id="ttc-status">Öffne dein Profil → Tab „Reposts“ oder „Gefällt mir“.</div>';
  document.body.appendChild(panel);

  function $(a) { return panel.querySelector('[data-a="' + a + '"]'); }
  var statusEl = panel.querySelector('#ttc-status');
  function status(msg) { statusEl.textContent = msg; }

  function render() {
    $('m-repost').classList.toggle('on', state.mode === 'repost');
    $('m-like').classList.toggle('on', state.mode === 'like');
    $('select').classList.toggle('on', state.selecting);
    $('select').textContent = state.selecting ? 'Auswählen: AN' : 'Auswählen';
    var n = 0;
    state.selected.forEach(function (id) { if (!state.done.has(id)) n++; });
    $('run').textContent = (state.mode === 'like' ? 'Likes entfernen (' : 'Reposts entfernen (') + n + ')';
    $('run').disabled = state.running || n === 0;
    $('stop').disabled = !state.running;
    ['m-repost', 'm-like', 'all', 'none', 'select'].forEach(function (a) { $(a).disabled = state.running; });
    decorate();
  }

  function decorate() {
    var list = tiles();
    for (var i = 0; i < list.length; i++) {
      var t = list[i], el = t.el;
      el.setAttribute('data-ttc-id', t.id);
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      var box = el.querySelector(':scope > .ttc-box');
      if (state.selecting) {
        if (!box) { box = document.createElement('div'); box.className = 'ttc-box'; el.appendChild(box); }
        box.textContent = state.selected.has(t.id) ? '✓' : '';
      } else if (box) {
        box.remove();
      }
      el.classList.toggle('ttc-sel', state.selected.has(t.id) && !state.done.has(t.id));
      el.classList.toggle('ttc-done', state.done.has(t.id));
    }
    return list.length;
  }

  // Klicks auf Kacheln im Auswahlmodus abfangen (statt Video zu öffnen)
  function onTileClick(e) {
    if (!state.selecting || state.running) return;
    if (e.target.closest && e.target.closest('#ttc-panel')) return;
    var el = e.target.closest && e.target.closest('[data-ttc-id]');
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (e.type !== 'click') return;
    var id = el.getAttribute('data-ttc-id');
    if (state.done.has(id)) return;
    if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
    render();
  }
  document.addEventListener('click', onTileClick, true);
  document.addEventListener('pointerup', onTileClick, true);

  // Neu nachgeladene Kacheln markieren
  var mo = new MutationObserver(function () {
    if (mo._t) return;
    mo._t = setTimeout(function () { mo._t = null; if (state.selecting || state.selected.size) decorate(); }, 300);
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // Bis ganz nach unten scrollen, damit alle Videos geladen sind
  async function loadAll() {
    var last = -1, same = 0;
    while (same < 4 && !state.stop) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(1200);
      var n = tiles().length;
      status('Lade alle Videos … ' + n + ' gefunden');
      if (n === last) same++; else { same = 0; last = n; }
    }
    window.scrollTo(0, 0);
    return tiles();
  }

  async function run() {
    var ids = [];
    state.selected.forEach(function (id) { if (!state.done.has(id)) ids.push(id); });
    if (!ids.length) return;
    var label = state.mode === 'like' ? 'Likes' : 'Reposts';
    if (!confirm(ids.length + ' ' + label + ' wirklich entfernen?')) return;
    state.running = true; state.stop = false; render();
    var okN = 0, failN = 0, backoff = 0;
    for (var i = 0; i < ids.length; i++) {
      if (state.stop) break;
      var id = ids[i];
      var res = state.mode === 'like' ? await removeLike(id) : await removeRepost(id);
      var el = document.querySelector('[data-ttc-id="' + id + '"]');
      if (ok(res)) {
        okN++; backoff = 0;
        state.done.add(id); state.selected.delete(id);
        if (el) el.classList.remove('ttc-fail');
      } else {
        failN++;
        if (el) el.classList.add('ttc-fail');
        console.warn('[tt-cleaner] Fehler bei', id, res);
        if (res.http === 429 || (res.json && /limit|frequent|too many/i.test(JSON.stringify(res.json)))) {
          backoff = Math.min((backoff || 15000) * 2, 300000);
          status('Rate-Limit – warte ' + Math.round(backoff / 1000) + ' s …');
          await sleep(backoff);
          i--; failN--; // nochmal versuchen
          continue;
        }
      }
      status(label + ': ' + okN + ' entfernt, ' + failN + ' Fehler, ' + (ids.length - i - 1) + ' übrig');
      render();
      await sleep(rand(1200, 2600));
    }
    state.running = false;
    status((state.stop ? 'Gestoppt. ' : 'Fertig. ') + okN + ' ' + label + ' entfernt' +
      (failN ? ', ' + failN + ' Fehler (gelb markiert). Seite neu laden zum Prüfen.' : '.'));
    render();
  }

  panel.addEventListener('click', async function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var a = b.getAttribute('data-a');
    if (a === 'close') return api.toggle();
    if (a === 'm-repost' || a === 'm-like') {
      state.mode = a === 'm-like' ? 'like' : 'repost';
      state.selected.clear();
      status('Modus: ' + (state.mode === 'like' ? 'Likes' : 'Reposts') + '. Tippe Videos an oder „Alle auswählen“.');
    }
    if (a === 'select') state.selecting = !state.selecting;
    if (a === 'none') state.selected.clear();
    if (a === 'all') {
      state.selecting = true; state.running = true; state.stop = false; render();
      var list = await loadAll();
      state.running = false;
      list.forEach(function (t) { if (!state.done.has(t.id)) state.selected.add(t.id); });
      status(state.selected.size + ' Videos ausgewählt. Einzelne antippen zum Abwählen.');
    }
    if (a === 'run') { render(); return run(); }
    if (a === 'stop') { state.stop = true; status('Stoppe …'); }
    render();
  });

  var api = window.__ttCleaner = {
    toggle: function () { panel.style.display = panel.style.display === 'none' ? '' : 'none'; }
  };

  state.mode = guessMode();
  render();
})();

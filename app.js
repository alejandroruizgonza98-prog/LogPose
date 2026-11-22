/* Log Pose · la bitácora de la tripulación para torneos de One Piece Card Game. */
(function () {
  'use strict';
  var CFG = window.LP_CONFIG || {};
  var LEADERS = window.LP_LEADERS || [];
  var TABLES = ['players', 'events', 'matches', 'misplays', 'misplay_votes'];
  var COLORS = [
    { id: 'red', name: 'Rojo', hex: '#c0392b' }, { id: 'green', name: 'Verde', hex: '#27894f' },
    { id: 'blue', name: 'Azul', hex: '#2463a8' }, { id: 'purple', name: 'Morado', hex: '#7b3fa6' },
    { id: 'black', name: 'Negro', hex: '#222' }, { id: 'yellow', name: 'Amarillo', hex: '#e0a800' },
  ];
  var STAGES = ['Top 256', 'Top 128', 'Top 64', 'Top 32', 'Top 16', 'Top 8', 'Top 4', 'Final'];
  var EMOJIS = ['🏴‍☠️', '⚓', '🗡️', '👒', '🍖', '🦈', '🐉', '🦁', '🦅', '🐙', '🍊', '🚬', '🎸', '🦌', '🤖', '💀', '🔥', '⚡', '👑', '🐍'];
  var PCOLORS = ['#c0392b', '#27894f', '#2463a8', '#7b3fa6', '#e0a800', '#d35400', '#16a085', '#8e44ad', '#2c3e50'];
  var MING = [
    { n: 1, t: 'Despiste' }, { n: 2, t: 'Minguito' }, { n: 3, t: 'Muy minguito' }, { n: 4, t: 'Minguitazo' }, { n: 5, t: 'Rey Minguito' },
  ];

  /* ---------- storage ---------- */
  function read(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* lleno o bloqueado */ } }
  var S = read('lp.data', null) || {};
  TABLES.forEach(function (t) { if (!S[t] || typeof S[t] !== 'object') S[t] = {}; });
  var L = Object.assign({ crew: '', hash: '', me: '', ev: '', tab: 'home', scope: 'event', kit: {}, timerEnd: 0, pending: [] }, read('lp.local', {}));
  function save() { write('lp.data', S); write('lp.local', L); }

  var ONLINE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_KEY);
  function synced() { return ONLINE && !!L.crew; }

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid(p) { var a = 'abcdefghijkmnpqrstuvwxyz23456789', s = ''; for (var i = 0; i < 12; i++) s += a[Math.floor(Math.random() * a.length)]; return p + '-' + s; }
  function list(t) { return Object.keys(S[t]).map(function (k) { return S[t][k]; }); }
  function byName(a, b) { return a.name.localeCompare(b.name, 'es'); }
  function players() { return list('players').sort(byName); }
  function events() { return list('events').sort(function (a, b) { return b.date.localeCompare(a.date); }); }
  function curEvent() { return S.events[L.ev] || events()[0] || null; }
  function me() { return S.players[L.me] || null; }
  function colorHex(id) { var c = COLORS.filter(function (x) { return x.id === id; })[0]; return c ? c.hex : '#999'; }
  function dots(cols) { return (cols || []).map(function (c) { return '<i class="dot" style="background:' + colorHex(c) + '"></i>'; }).join(''); }
  function berries(n) { return '฿ ' + n.toLocaleString('es-ES'); }
  function fmtDate(d) { try { return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return d; } }
  var EMB = window.LP_EMBLEMS || {};
  var EMB_IDS = Object.keys(EMB);
  // fondo: colores del líder (partido en dos si son dos) o el color del pirata
  function pbg(p) {
    var c = (p && p.leader_colors) || [];
    if (c.length >= 2) return 'linear-gradient(135deg,' + colorHex(c[0]) + ' 50%,' + colorHex(c[1]) + ' 50%)';
    if (c.length === 1) return colorHex(c[0]);
    return p ? p.color : '#999';
  }
  function emblemSvg(id) { var e = EMB[id]; return e ? '<svg viewBox="0 0 64 64" aria-hidden="true">' + e.d + '</svg>' : ''; }
  function face(p) {
    if (!p) return '❔';
    if (p.photo && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(p.photo)) return '<img src="' + p.photo + '" alt="">';
    if (/^em:/.test(p.emoji) && EMB[p.emoji.slice(3)]) return emblemSvg(p.emoji.slice(3));
    return esc(p.emoji);
  }
  function av(p, big) { return '<span class="av' + (big ? ' big' : '') + (p && p.photo ? ' photo' : '') + '" style="--pc:' + esc(pbg(p)) + '">' + face(p) + '</span>'; }
  function toast(msg) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
  function leaderLabel(code, name, cols) { return name ? dots(cols) + ' <b>' + esc(name) + '</b> <small class="muted">' + esc(code) + '</small>' : '<span class="muted">Sin líder</span>'; }
  function each(root, sel, fn) { Array.prototype.forEach.call(root.querySelectorAll(sel), fn); }

  /* ---------- sync with Supabase ---------- */
  function sha256(s) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  }
  function api(path, opts) {
    opts = opts || {};
    var h = { apikey: CFG.SUPABASE_KEY, Authorization: 'Bearer ' + CFG.SUPABASE_KEY, 'x-crew': L.crew, 'Content-Type': 'application/json' };
    Object.assign(h, opts.headers || {});
    return fetch(CFG.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path, { method: opts.method || 'GET', headers: h, body: opts.body }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + ' ' + t.slice(0, 160)); });
      return r.status === 204 ? null : r.text().then(function (t) { return t ? JSON.parse(t) : null; });
    });
  }
  function send(op) {
    if (op.kind === 'put') return api(op.table + '?on_conflict=id', { method: 'POST', body: JSON.stringify(op.row), headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
    return api(op.table + '?id=eq.' + encodeURIComponent(op.id), { method: 'DELETE' });
  }
  var flushing = false;
  function flush() {
    if (!synced() || flushing || !L.pending.length) return Promise.resolve();
    flushing = true;
    var op = L.pending[0];
    return send(op).then(function () { L.pending.shift(); save(); flushing = false; return flush(); })
      .catch(function (e) {
        flushing = false;
        // un 4xx que no es de red no se arreglará reintentando: se descarta para no bloquear la cola
        if (/^(400|401|403|409|422) /.test(e.message)) { L.pending.shift(); save(); toast('Un cambio no se pudo guardar: ' + e.message.slice(0, 60)); return flush(); }
        setSync('⚠️ Sin conexión: ' + L.pending.length + ' cambio(s) pendientes'); console.warn(e);
      });
  }
  function put(table, row) {
    row.crew = L.hash; row.updated_at = new Date().toISOString();
    S[table][row.id] = row; save();
    if (synced()) { L.pending.push({ kind: 'put', table: table, row: row }); save(); flush(); }
  }
  function del(table, id) {
    delete S[table][id];
    // los hijos se borran en cascada en la base de datos; aquí igual
    if (table === 'players' || table === 'events') {
      list('matches').forEach(function (m) { if (m.player_id === id || m.event_id === id) delete S.matches[m.id]; });
      list('misplays').forEach(function (m) { if (m.player_id === id) delete S.misplays[m.id]; });
    }
    if (table === 'misplays' || table === 'players') list('misplay_votes').forEach(function (v) { if (v.misplay_id === id || v.voter_id === id) delete S.misplay_votes[v.id]; });
    save();
    if (synced()) { L.pending.push({ kind: 'del', table: table, id: id }); save(); flush(); }
  }
  function setSync(t) { var el = $('#sync'); if (el) el.textContent = t; L.syncText = t; }
  var pulling = false;
  function pull(quiet) {
    if (!synced() || pulling) return Promise.resolve();
    pulling = true;
    return flush().then(function () {
      return Promise.all(TABLES.map(function (t) { return api(t + '?select=*'); }));
    }).then(function (res) {
      pulling = false;
      if (L.pending.length) return; // no pisar cambios locales sin subir
      TABLES.forEach(function (t, i) { var o = {}; (res[i] || []).forEach(function (r) { o[r.id] = r; }); S[t] = o; });
      ensureDefaultEvent(); save(); setSync('☁️ Sincronizado ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
      if (!document.querySelector('.sheet')) render();
    }).catch(function (e) { pulling = false; setSync('⚠️ No se pudo sincronizar'); if (!quiet) toast('No se pudo sincronizar: ' + e.message); });
  }
  function ensureDefaultEvent() {
    // el id lleva parte del hash: los id son únicos en toda la base de datos, no solo en la tripulación
    if (!list('events').length && CFG.DEFAULT_EVENT) put('events', Object.assign({}, CFG.DEFAULT_EVENT, { id: CFG.DEFAULT_EVENT.id + '-' + (L.hash ? L.hash.slice(0, 10) : 'local') }));
    if (!S.events[L.ev]) L.ev = (events()[0] || {}).id || '';
  }

  /* ---------- stats ---------- */
  function scopeMatches() {
    var ev = curEvent();
    return list('matches').filter(function (m) { return L.scope === 'all' || (ev && m.event_id === ev.id); });
  }
  function record(ms) {
    var r = { W: 0, L: 0, D: 0, n: ms.length };
    ms.forEach(function (m) { r[m.result]++; });
    r.wr = r.n ? Math.round(100 * r.W / r.n) : 0;
    return r;
  }
  function recStr(r) { return r.W + '-' + r.L + (r.D ? '-' + r.D : ''); }
  function byTime(a, b) { return (a.created_at || '').localeCompare(b.created_at || '') || a.round - b.round; }
  function streak(ms) {
    var best = 0, cur = 0;
    ms.slice().sort(byTime).forEach(function (m) { cur = m.result === 'W' ? cur + 1 : 0; best = Math.max(best, cur); });
    return best;
  }
  function bounty(pid, ms) {
    var mine = ms.filter(function (m) { return m.player_id === pid; });
    if (!mine.length) return 0;
    var r = record(mine), top = -1;
    mine.forEach(function (m) { top = Math.max(top, STAGES.indexOf(m.stage)); });
    return 5e6 + r.W * 30e6 + r.D * 10e6 + (top >= 0 ? (top + 1) * 50e6 : 0) + streak(mine) * 5e6;
  }
  function title(b) {
    if (b >= 1e9) return 'Yonko'; if (b >= 6e8) return 'Comandante'; if (b >= 4e8) return 'Supernova';
    if (b >= 2e8) return 'Shichibukai'; if (b >= 1e8) return 'Capitán'; if (b > 0) return 'Grumete'; return 'Polizón';
  }
  function mingAvg(mid) {
    var vs = list('misplay_votes').filter(function (v) { return v.misplay_id === mid; });
    if (!vs.length) return { avg: 0, n: 0 };
    return { avg: vs.reduce(function (s, v) { return s + v.score; }, 0) / vs.length, n: vs.length };
  }
  function scopeMisplays() {
    var ev = curEvent();
    return list('misplays').filter(function (m) { return L.scope === 'all' || (ev && m.event_id === ev.id); });
  }
  function mingRanking() {
    var rows = {};
    scopeMisplays().forEach(function (m) {
      var a = mingAvg(m.id);
      var r = rows[m.player_id] = rows[m.player_id] || { pid: m.player_id, pts: 0, n: 0, worst: null, worstAvg: 0 };
      r.pts += a.avg; r.n++;
      if (a.avg > r.worstAvg) { r.worstAvg = a.avg; r.worst = m; }
    });
    return Object.keys(rows).map(function (k) { return rows[k]; }).filter(function (r) { return S.players[r.pid]; }).sort(function (a, b) { return b.pts - a.pts || b.n - a.n; });
  }
  function perEvent(ms) { var o = {}; ms.forEach(function (m) { (o[m.event_id] = o[m.event_id] || []).push(m); }); return Object.keys(o).map(function (k) { return o[k]; }); }
  var BADGES = [
    { i: '⛵', n: 'Zarpamos', d: 'Registra tu primera ronda', t: function (ms) { return ms.length > 0; } },
    { i: '⚡', n: 'Racha Gomu Gomu', d: 'Gana 3 rondas seguidas', t: function (ms) { return streak(ms) >= 3; } },
    { i: '🌊', n: 'Contra corriente', d: 'Gana yendo segundo', t: function (ms) { return ms.some(function (m) { return m.result === 'W' && m.went_first === false; }); } },
    { i: '🗡️', n: 'Primer golpe', d: 'Gana 3 rondas yendo primero', t: function (ms) { return ms.filter(function (m) { return m.result === 'W' && m.went_first === true; }).length >= 3; } },
    { i: '🏝️', n: 'Isla conquistada', d: 'Gana 5 rondas en un evento', t: function (ms) { return perEvent(ms).some(function (e) { return e.filter(function (m) { return m.result === 'W'; }).length >= 5; }); } },
    { i: '🏆', n: 'Top cut', d: 'Juega el top cut', t: function (ms) { return ms.some(function (m) { return !!m.stage; }); } },
    { i: '🌈', n: 'Arcoíris', d: 'Gana a líderes de los seis colores', t: function (ms) { var s = {}; ms.forEach(function (m) { if (m.result === 'W') (m.opp_colors || []).forEach(function (c) { s[c] = 1; }); }); return Object.keys(s).length >= 6; } },
    { i: '🎈', n: 'Remontada', d: 'Pierde la 1.ª ronda de un evento y gana las 3 siguientes', t: function (ms) { return perEvent(ms).some(function (e) { e = e.filter(function (m) { return !m.stage; }).sort(function (a, b) { return a.round - b.round; }); return e.length >= 4 && e[0].result === 'L' && e[1].result === 'W' && e[2].result === 'W' && e[3].result === 'W'; }); } },
  ];

  /* ---------- UI shell ---------- */
  var TABS = [
    { id: 'home', i: '🧭', n: 'Inicio' }, { id: 'rounds', i: '📜', n: 'Rondas' }, { id: 'bounty', i: '💰', n: 'Carteles' },
    { id: 'ming', i: '🤡', n: 'Minguito' }, { id: 'meta', i: '📊', n: 'Meta' }, { id: 'mu', i: '⚔️', n: 'Cruces' }, { id: 'more', i: '⚓', n: 'Más' },
  ];
  function render() {
    var ev = curEvent();
    $('#top').innerHTML = '<div class="brand"><span class="logo">🧭</span><div><h1>Log Pose</h1><div class="sub">' + (ev ? esc(ev.name) + ' · ' + fmtDate(ev.date) : 'Sin evento') + '</div></div></div>' +
      '<button class="chip" data-a="pickEvent">Cambiar</button>';
    $('#tabs').innerHTML = TABS.map(function (t) { return '<button class="tab' + (L.tab === t.id ? ' on' : '') + '" data-a="tab" data-v="' + t.id + '"><span>' + t.i + '</span>' + t.n + '</button>'; }).join('');
    var v = $('#view');
    if (!players().length && L.tab !== 'more') { v.innerHTML = welcome(); return; }
    v.innerHTML = ({ home: home, rounds: rounds, bounty: bountyPage, ming: mingPage, meta: meta, mu: matchups, more: more })[L.tab]();
    if (L.tab === 'more') { tick(); if (L.syncText) setSync(L.syncText); }
  }
  function scopeSwitch() {
    return '<div class="seg sm"><button class="' + (L.scope === 'event' ? 'on' : '') + '" data-a="scope" data-v="event">Este evento</button><button class="' + (L.scope === 'all' ? 'on' : '') + '" data-a="scope" data-v="all">Siempre</button></div>';
  }
  function welcome() {
    return '<div class="card poster center"><div class="big-ico">🏴‍☠️</div><h2>¡Bienvenido a bordo!</h2>' +
      '<p>Log Pose es la bitácora de tu tripulación para torneos de One Piece Card Game: rondas, recompensas, el meta y la Escala Minguito.</p>' +
      (ONLINE ? '<button class="btn primary block" data-a="crew">Crear o unirse a una tripulación</button><p class="small muted">o, para probar solo en este móvil</p>' : '') +
      '<button class="btn block" data-a="editPlayer">Añadir el primer pirata</button></div>';
  }

  /* ---------- pages ---------- */
  function home() {
    var ms = scopeMatches(), m = me();
    var h = '';
    if (!m) h += '<div class="card warn"><b>¿Quién eres?</b> Elige tu pirata para registrar rondas y votar minguitos.<div class="who">' +
      players().map(function (p) { return '<button class="pill" data-a="setMe" data-v="' + p.id + '">' + av(p) + esc(p.name) + '</button>'; }).join('') + '</div></div>';
    if (m) {
      var r = record(ms.filter(function (x) { return x.player_id === m.id; }));
      h += '<div class="card hero">' + av(m, true) + '<div class="grow"><div class="muted small">' + esc(m.name) + ' · ' + (L.scope === 'all' ? 'historial' : 'este evento') + '</div><div class="score">' + recStr(r) + '</div>' +
        '<div class="small">' + leaderLabel(m.leader_code, m.leader_name, m.leader_colors) + '</div></div></div>';
    }
    h += '<div class="row2"><button class="btn primary block" data-a="logRound">📜 Registrar ronda</button><button class="btn block ming" data-a="logMisplay">🤡 Apuntar minguito</button></div>';
    var crew = players().map(function (p) {
      var r = record(ms.filter(function (x) { return x.player_id === p.id; }));
      return '<button class="line" data-a="playerSheet" data-v="' + p.id + '">' + av(p) + '<span class="grow"><b>' + esc(p.name) + '</b><br><small>' + (p.leader_name ? dots(p.leader_colors) + ' ' + esc(p.leader_name) : '<span class="muted">sin líder</span>') + '</small></span><span class="rec">' + recStr(r) + '</span></button>';
    }).join('');
    h += '<div class="sec"><h2>La tripulación</h2>' + scopeSwitch() + '</div><div class="card">' + crew + '</div>';
    var last = ms.slice().sort(function (a, b) { return byTime(b, a); }).slice(0, 6);
    if (last.length) h += '<div class="sec"><h2>Últimas rondas</h2></div><div class="card">' + last.map(matchLine).join('') + '</div>';
    return h;
  }
  function matchLine(m) {
    var p = S.players[m.player_id];
    var res = { W: ['V', 'win'], L: ['D', 'loss'], D: ['E', 'draw'] }[m.result];
    return '<button class="line" data-a="logRound" data-v="' + m.id + '">' + av(p) + '<span class="grow"><b>' + esc(p ? p.name : '?') + '</b> <small class="muted">' + (m.stage ? esc(m.stage) : 'R' + m.round) + (m.went_first === true ? ' · 1.º' : m.went_first === false ? ' · 2.º' : '') + '</small><br><small>vs ' +
      (m.opp_leader_name ? dots(m.opp_colors) + ' ' + esc(m.opp_leader_name) : '?') + (m.opp_name ? ' <span class="muted">(' + esc(m.opp_name) + ')</span>' : '') + '</small></span><span class="res ' + res[1] + '">' + res[0] + '</span></button>';
  }
  function rounds() {
    var ms = scopeMatches().sort(function (a, b) { return byTime(b, a); });
    var h = '<div class="sec"><h2>Rondas</h2>' + scopeSwitch() + '</div><button class="btn primary block" data-a="logRound">+ Registrar ronda</button>';
    if (!ms.length) return h + '<p class="muted center">Aún no hay rondas. ¡A zarpar!</p>';
    players().forEach(function (p) {
      var pm = ms.filter(function (m) { return m.player_id === p.id; });
      if (!pm.length) return;
      h += '<div class="card"><div class="cardhead">' + av(p) + '<b class="grow">' + esc(p.name) + '</b><span class="rec">' + recStr(record(pm)) + '</span></div>' + pm.map(matchLine).join('') + '</div>';
    });
    return h;
  }
  function bountyPage() {
    var ms = scopeMatches();
    var rows = players().map(function (p) { return { p: p, b: bounty(p.id, ms), r: record(ms.filter(function (m) { return m.player_id === p.id; })) }; })
      .sort(function (a, b) { return b.b - a.b || b.r.wr - a.r.wr; });
    var h = '<div class="sec"><h2>Tablón de recompensas</h2>' + scopeSwitch() + '</div><div class="posters">';
    h += rows.map(function (x, i) {
      var pm = ms.filter(function (m) { return m.player_id === x.p.id; });
      var got = BADGES.filter(function (b) { return b.t(pm); }).map(function (b) { return b.i; }).join(' ');
      return '<button class="wanted' + (i === 0 && x.b ? ' first' : '') + '" data-a="playerSheet" data-v="' + x.p.id + '"><div class="w-title">SE BUSCA</div><div class="w-photo' + (x.p.photo ? ' photo' : '') + '" style="--pc:' + esc(pbg(x.p)) + '">' + face(x.p) + '</div>' +
        '<div class="w-sub">VIVO O MUERTO</div><div class="w-name">' + esc(x.p.name) + '</div><div class="w-bounty">' + berries(x.b) + '</div><div class="w-meta">' + title(x.b) + ' · ' + recStr(x.r) + '</div>' + (got ? '<div class="w-badges">' + got + '</div>' : '') + '</button>';
    }).join('');
    h += '</div><details class="card"><summary><b>¿Cómo se calcula?</b></summary><p class="small">Victoria 30M · Empate 10M · 5M por cada victoria de tu mejor racha · Top cut: 50M por cada fase alcanzada · 5M por zarpar.</p>' +
      '<p class="small"><b>Insignias:</b><br>' + BADGES.map(function (b) { return b.i + ' <b>' + b.n + '</b>: ' + b.d; }).join('<br>') + '</p></details>';
    return h;
  }
  function mingPage() {
    var rank = mingRanking(), mps = scopeMisplays().sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
    var h = '<div class="sec"><h2>Escala Minguito</h2>' + scopeSwitch() + '</div>';
    h += '<button class="btn block ming" data-a="logMisplay">🤡 Apuntar un minguito</button>';
    var top = rank.filter(function (r) { return r.pts > 0; });
    if (top.length) {
      var king = S.players[top[0].pid];
      h += '<div class="card crown center"><div class="small">' + (L.scope === 'all' ? 'Minguito de la historia' : 'Minguito del torneo') + '</div><div class="big-ico">👑</div>' + av(king, true) + '<h2>' + esc(king.name) + '</h2><div>' + top[0].pts.toFixed(1) + ' puntos minguito · ' + top[0].n + ' misplay(s)</div>' +
        (top[0].worst ? '<p class="small"><i>Su obra maestra: «' + esc(top[0].worst.text) + '»</i></p>' : '') + '</div>';
    }
    if (rank.length) h += '<div class="card">' + rank.map(function (r, i) {
      var p = S.players[r.pid];
      return '<div class="line"><span class="pos">' + (i + 1) + '</span>' + av(p) + '<span class="grow"><b>' + esc(p.name) + '</b><br><small class="muted">' + r.n + ' misplay(s)</small></span><span class="rec">' + r.pts.toFixed(1) + ' 🤡</span></div>';
    }).join('') + '</div>';
    if (!mps.length) return h + '<p class="muted center">Nadie ha hecho el minguito todavía… de momento.</p>';
    h += '<div class="sec"><h2>Misplays · vota del 1 al 5</h2></div>';
    h += mps.map(function (m) {
      var p = S.players[m.player_id], a = mingAvg(m.id), my = L.me ? S.misplay_votes[m.id + ':' + L.me] : null, rep = S.players[m.reported_by];
      var ev = S.events[m.event_id];
      return '<div class="card mp"><div class="cardhead">' + av(p) + '<span class="grow"><b>' + esc(p ? p.name : '?') + '</b><br><small class="muted">' + (ev ? esc(ev.name) : '') + (m.round ? ' · R' + m.round : '') + (rep ? ' · lo apuntó ' + esc(rep.name) : '') + '</small></span>' +
        '<span class="mscore">' + (a.n ? a.avg.toFixed(1) + ' 🤡<br><small>' + a.n + ' voto(s)</small>' : '<small class="muted">sin votos</small>') + '</span></div>' +
        '<p class="mtext">«' + esc(m.text) + '»</p><div class="votes">' + MING.map(function (x) {
          return '<button class="vote' + (my && my.score === x.n ? ' on' : '') + '" data-a="vote" data-v="' + m.id + '" data-s="' + x.n + '"><b>' + x.n + '</b><small>' + x.t + '</small></button>';
        }).join('') + '</div><div class="right"><button class="link" data-a="logMisplay" data-v="' + m.id + '">Editar</button></div></div>';
    }).join('');
    return h;
  }
  function meta() {
    var ms = scopeMatches();
    var h = '<div class="sec"><h2>Meta</h2>' + scopeSwitch() + '</div>';
    if (!ms.length) return h + '<p class="muted center">Registra rondas para ver el meta.</p>';
    var r = record(ms);
    var first = record(ms.filter(function (m) { return m.went_first === true; })), second = record(ms.filter(function (m) { return m.went_first === false; }));
    h += '<div class="stats"><div class="stat"><b>' + r.n + '</b><small>rondas</small></div><div class="stat"><b>' + r.wr + '%</b><small>victorias</small></div><div class="stat"><b>' + (first.n ? first.wr + '%' : '—') + '</b><small>yendo 1.º (' + first.n + ')</small></div><div class="stat"><b>' + (second.n ? second.wr + '%' : '—') + '</b><small>yendo 2.º (' + second.n + ')</small></div></div>';
    var opp = {};
    ms.forEach(function (m) { var k = m.opp_leader_code || m.opp_leader_name || '?'; (opp[k] = opp[k] || { name: m.opp_leader_name || 'Desconocido', code: m.opp_leader_code, cols: m.opp_colors, ms: [] }).ms.push(m); });
    var rows = Object.keys(opp).map(function (k) { return opp[k]; }).sort(function (a, b) { return b.ms.length - a.ms.length; });
    var max = rows[0].ms.length;
    h += '<div class="sec"><h2>Líderes rivales</h2></div><div class="card">' + rows.map(function (o) {
      var rr = record(o.ms);
      return '<div class="bar-row"><div class="grow">' + dots(o.cols) + ' <b>' + esc(o.name) + '</b> <small class="muted">' + esc(o.code || '') + '</small><div class="bar"><i style="width:' + Math.round(100 * o.ms.length / max) + '%"></i></div></div><div class="rec">' + o.ms.length + '× · ' + rr.wr + '%</div></div>';
    }).join('') + '<p class="small muted">% = victorias de la tripulación contra ese líder</p></div>';
    h += '<div class="sec"><h2>Por color rival</h2></div><div class="card colors">' + COLORS.map(function (c) {
      var cm = ms.filter(function (m) { return (m.opp_colors || []).indexOf(c.id) >= 0; }), cr = record(cm);
      return '<div class="colstat"><i class="dot lg" style="background:' + c.hex + '"></i><b>' + c.name + '</b><small>' + cm.length + ' rondas · ' + (cm.length ? cr.wr + '%' : '—') + '</small></div>';
    }).join('') + '</div>';
    var mine = {};
    ms.forEach(function (m) { var k = m.my_leader_code || m.my_leader_name; if (!k) return; (mine[k] = mine[k] || { name: m.my_leader_name, cols: m.my_colors, ms: [] }).ms.push(m); });
    var mrows = Object.keys(mine).map(function (k) { return mine[k]; }).sort(function (a, b) { return b.ms.length - a.ms.length; });
    if (mrows.length) h += '<div class="sec"><h2>Líderes de la tripulación</h2></div><div class="card">' + mrows.map(function (o) { var rr = record(o.ms); return '<div class="line">' + dots(o.cols) + '<span class="grow"><b>' + esc(o.name) + '</b></span><span class="rec">' + recStr(rr) + ' · ' + rr.wr + '%</span></div>'; }).join('') + '</div>';
    return h;
  }
  /* emparejamientos: mi líder contra cada líder rival, total y yendo 1.º / 2.º */
  function cell(ms) {
    if (!ms.length) return '<td class="mu-c empty">—</td>';
    var r = record(ms), hue = Math.round(r.wr * 1.2); // 0 % rojo → 100 % verde
    return '<td class="mu-c" style="--h:' + hue + '"><b>' + r.wr + '%</b><small>' + recStr(r) + '</small></td>';
  }
  function lkey(code, name) { return code || name || '?'; }
  function matchups() {
    var ms = scopeMatches();
    var h = '<div class="sec"><h2>Emparejamientos</h2>' + scopeSwitch() + '</div>';
    if (!ms.length) return h + '<p class="muted center">Registra rondas (con líder rival y turno) para ver los cruces.</p>';
    var mine = {};
    ms.forEach(function (m) { var k = lkey(m.my_leader_code, m.my_leader_name); if (!mine[k]) mine[k] = { k: k, name: m.my_leader_name || 'Sin líder', code: m.my_leader_code, cols: m.my_colors, n: 0 }; mine[k].n++; });
    var mlist = Object.keys(mine).map(function (k) { return mine[k]; }).sort(function (a, b) { return b.n - a.n; });
    if (!L.muLeader || (L.muLeader !== '*' && !mine[L.muLeader])) L.muLeader = '*';
    h += '<div class="mu-pick"><button class="pill' + (L.muLeader === '*' ? ' on' : '') + '" data-a="muLeader" data-v="*">Toda la tripulación</button>' +
      mlist.map(function (l) { return '<button class="pill' + (L.muLeader === l.k ? ' on' : '') + '" data-a="muLeader" data-v="' + esc(l.k) + '">' + dots(l.cols) + ' ' + esc(l.name) + ' <small class="muted">' + l.n + '</small></button>'; }).join('') + '</div>';
    var sel = ms.filter(function (m) { return L.muLeader === '*' || lkey(m.my_leader_code, m.my_leader_name) === L.muLeader; });
    var opp = {};
    sel.forEach(function (m) { var k = lkey(m.opp_leader_code, m.opp_leader_name); (opp[k] = opp[k] || { name: m.opp_leader_name || 'Desconocido', code: m.opp_leader_code, cols: m.opp_colors, ms: [] }).ms.push(m); });
    var rows = Object.keys(opp).map(function (k) { return opp[k]; }).sort(function (a, b) { return b.ms.length - a.ms.length; });
    function first(x) { return x.filter(function (m) { return m.went_first === true; }); }
    function second(x) { return x.filter(function (m) { return m.went_first === false; }); }
    h += '<div class="card mu-wrap"><table class="mu"><thead><tr><th>Rival</th><th>Total</th><th>Yendo 1.º</th><th>Yendo 2.º</th></tr></thead><tbody>' +
      '<tr class="mu-all"><td><b>Todos</b><small>' + sel.length + ' rondas</small></td>' + cell(sel) + cell(first(sel)) + cell(second(sel)) + '</tr>' +
      rows.map(function (o) { return '<tr><td>' + dots(o.cols) + ' <b>' + esc(o.name) + '</b><small>' + esc(o.code || '') + ' · ' + o.ms.length + '×</small></td>' + cell(o.ms) + cell(first(o.ms)) + cell(second(o.ms)) + '</tr>'; }).join('') +
      '</tbody></table></div><p class="small muted center">% = victorias' + (L.muLeader === '*' ? ' de la tripulación' : ' con ese líder') + ' contra cada rival. Las rondas sin turno apuntado solo cuentan en Total.</p>';
    return h + globalRef(L.muLeader !== '*' && mine[L.muLeader] ? mine[L.muLeader].code : '');
  }
  // Referencia global (TCG Match Making): % del líder elegido contra cada líder top del formato
  function globalRef(hint) {
    var R = window.LP_REFERENCE;
    if (!R || !R.LEADERS) return '';
    var idx = R.LEADERS.map(function (l) { return l.code; });
    if (idx.indexOf(L.refLeader) < 0) L.refLeader = idx.indexOf(hint) >= 0 ? hint : idx[0];
    var i = idx.indexOf(L.refLeader);
    var cols = function (code) { var l = LEADERS.filter(function (x) { return x.code === code; })[0]; return l ? l.colors : []; };
    var h = '<div class="sec"><h2>Meta global ' + esc(R.FORMAT) + '</h2></div><div class="card">' +
      '<div class="mu-pick">' + R.LEADERS.map(function (l) { return '<button class="pill' + (l.code === L.refLeader ? ' on' : '') + '" data-a="refLeader" data-v="' + l.code + '">' + dots(cols(l.code)) + ' ' + esc(l.name) + '</button>'; }).join('') + '</div>' +
      '<table class="mu"><thead><tr><th>Contra</th><th>% victorias</th></tr></thead><tbody>' +
      R.LEADERS.map(function (l, j) {
        var v = R.MATRIX[i][j];
        if (v == null) return '';
        return '<tr><td>' + dots(cols(l.code)) + ' <b>' + esc(l.name) + '</b><small>' + l.code + '</small></td><td class="mu-c" style="--h:' + Math.round(v * 1.2) + '"><b>' + v.toFixed(1).replace('.0', '') + '%</b></td></tr>';
      }).join('') + '</tbody></table>' +
      '<p class="small muted">Partidas ranked online de ' + esc(R.SOURCE) + ', ' + fmtDate(R.DATE) + ' (' + R.LEADERS[i].games.toLocaleString('es-ES') + ' partidas de ' + esc(R.LEADERS[i].name) + '). No separa 1.º/2.º. <a href="' + esc(R.URL) + '" target="_blank" rel="noopener">Ver fuente</a></p></div>';
    return h;
  }
  function more() {
    var ev = curEvent();
    var h = '<div class="sec"><h2>Herramientas</h2></div><div class="tools">' +
      '<button class="tool" data-a="timer"><span>⏱️</span>Temporizador<small id="tmini"></small></button>' +
      '<button class="tool" data-a="dice"><span>🎲</span>¿Quién empieza?</button>' +
      '<button class="tool" data-a="kit"><span>🎒</span>Checklist</button>' +
      '<button class="tool" data-a="guide"><span>🌴</span>Guía Alicante</button></div>';
    h += '<div class="sec"><h2>Tripulación</h2></div><div class="card">' +
      (ONLINE ? (L.crew ? '<div class="line">☁️<span class="grow">Sincronizando con la tripulación<br><small class="muted" id="sync">…</small></span><button class="chip" data-a="crew">Código</button></div>' : '<div class="line">📴<span class="grow">Solo en este móvil</span><button class="chip" data-a="crew">Unirse</button></div>')
        : '<div class="line">📴<span class="grow">Modo local<br><small class="muted">Rellena config.js con tu Supabase para sincronizar</small></span></div>') +
      players().map(function (p) { return '<button class="line" data-a="editPlayer" data-v="' + p.id + '">' + av(p) + '<span class="grow"><b>' + esc(p.name) + '</b>' + (p.id === L.me ? ' <small class="tag">tú</small>' : '') + '<br><small>' + (p.leader_name ? dots(p.leader_colors) + ' ' + esc(p.leader_name) + ' <span class="muted">' + esc(p.leader_code) + '</span>' : '<span class="muted">sin líder</span>') + '</small></span>✏️</button>'; }).join('') +
      '<button class="btn block" data-a="editPlayer">+ Añadir pirata</button>' +
      (players().length ? '<button class="btn ghost block" data-a="whoAmI">Cambiar quién soy' + (me() ? ' (' + esc(me().name) + ')' : '') + '</button>' : '') + '</div>';
    h += '<div class="sec"><h2>Eventos</h2></div><div class="card">' + events().map(function (e) { return '<button class="line" data-a="editEvent" data-v="' + e.id + '">🏯<span class="grow"><b>' + esc(e.name) + '</b>' + (ev && e.id === ev.id ? ' <small class="tag">activo</small>' : '') + '<br><small class="muted">' + fmtDate(e.date) + (e.city ? ' · ' + esc(e.city) : '') + '</small></span>✏️</button>'; }).join('') +
      '<button class="btn block" data-a="editEvent">+ Nuevo evento</button></div>';
    h += '<p class="small muted center">Log Pose · ' + LEADERS.length + ' líderes (hasta OP18)</p>';
    return h;
  }

  /* ---------- sheets ---------- */
  function sheet(html) {
    var wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = '<div class="sheet" role="dialog">' + html + '</div>';
    function close() { wrap.remove(); if (!document.querySelector('.sheet')) render(); }
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    wrap.close = close;
    $('#sheets').appendChild(wrap);
    each(wrap, '[data-close]', function (b) { b.onclick = close; });
    return wrap;
  }
  function head(t) { return '<div class="sheet-head"><h2>' + t + '</h2><button class="x" data-close aria-label="Cerrar">✕</button></div>'; }
  // Elegir un líder: busca por nombre o código
  function pickLeader(cb) {
    var w = sheet(head('Elegir líder') + '<input class="inp" id="lq" placeholder="Busca: Luffy, OP17, Kaido…" autocomplete="off"><div id="ll" class="leaders"></div>' +
      '<details class="small"><summary>¿No está? Escríbelo a mano</summary><input class="inp" id="lcustom" placeholder="Nombre del líder"><button class="btn block" id="lcok">Usar este</button></details>');
    function paint() {
      var q = $('#lq', w).value.toLowerCase().trim();
      var res = LEADERS.map(function (l, i) { return { l: l, i: i }; }).filter(function (x) { return !q || (x.l.name + ' ' + x.l.code).toLowerCase().indexOf(q) >= 0; }).reverse();
      $('#ll', w).innerHTML = res.slice(0, 80).map(function (x) { return '<button class="line" data-i="' + x.i + '">' + (dots(x.l.colors) || '<i class="dot" style="background:#bbb"></i>') + '<span class="grow"><b>' + esc(x.l.name) + '</b></span><small class="muted">' + x.l.code + '</small></button>'; }).join('') || '<p class="muted">Nada con eso.</p>';
      each($('#ll', w), '[data-i]', function (b) { b.onclick = function () { var l = LEADERS[+b.getAttribute('data-i')]; w.remove(); cb({ code: l.code, name: l.name, colors: l.colors.slice() }); }; });
    }
    $('#lq', w).oninput = paint; paint();
    $('#lcok', w).onclick = function () { var n = $('#lcustom', w).value.trim(); if (!n) return; w.remove(); cb({ code: '', name: n.slice(0, 40), colors: [] }); };
  }
  function leaderField(id) { return '<button type="button" class="leaderbtn" id="' + id + '"></button><div id="' + id + '-c"></div>'; }
  // ld = { code, name, colors }: se modifica en el sitio
  function bindLeader(w, id, ld) {
    var known = function () { return LEADERS.some(function (l) { return l.code && l.code === ld.code && l.colors.length; }); };
    function paint() {
      $('#' + id, w).innerHTML = ld.name ? leaderLabel(ld.code, ld.name, ld.colors) : '<span class="muted">Toca para elegir líder</span>';
      var box = $('#' + id + '-c', w);
      if (!ld.name || known()) { box.innerHTML = ''; return; }
      box.innerHTML = '<small class="muted">Colores de este líder:</small><div class="colpick">' + COLORS.map(function (c) { return '<button type="button" class="cp' + (ld.colors.indexOf(c.id) >= 0 ? ' on' : '') + '" data-c="' + c.id + '" style="--c:' + c.hex + '">' + c.name + '</button>'; }).join('') + '</div>';
      each(box, '.cp', function (b) {
        b.onclick = function () {
          var c = b.getAttribute('data-c'), i = ld.colors.indexOf(c);
          if (i >= 0) ld.colors.splice(i, 1); else if (ld.colors.length < 2) ld.colors.push(c); else { toast('Máximo 2 colores'); return; }
          paint();
        };
      });
    }
    $('#' + id, w).onclick = function () { pickLeader(function (l) { ld.code = l.code; ld.name = l.name; ld.colors.length = 0; Array.prototype.push.apply(ld.colors, l.colors); paint(); }); };
    paint();
    return paint;
  }
  function pills(sel, cur) { return players().map(function (p) { return '<button type="button" class="pill' + (p.id === cur ? ' on' : '') + '" data-v="' + p.id + '">' + av(p) + esc(p.name) + '</button>'; }).join(''); }
  function bindPills(w, sel, fn) { each(w, sel + ' .pill', function (b) { b.onclick = function () { each(w, sel + ' .pill', function (x) { x.classList.toggle('on', x === b); }); fn(b.getAttribute('data-v')); }; }); }

  // recorta la foto al centro, 192x192 en JPEG: cabe en la base de datos (≈10-20 KB)
  function shrink(file, cb) {
    var img = new Image(), r = new FileReader();
    r.onload = function () { img.src = r.result; };
    r.onerror = function () { cb(''); };
    img.onload = function () {
      var s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 192;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 192, 192);
      var q = 0.82, url = c.toDataURL('image/jpeg', q);
      while (url.length > 55000 && q > 0.3) { q -= 0.15; url = c.toDataURL('image/jpeg', q); }
      cb(url.length <= 60000 ? url : '');
    };
    img.onerror = function () { cb(''); };
    r.readAsDataURL(file);
  }

  var A = {};
  A.muLeader = function (v) { L.muLeader = v; save(); render(); };
  A.refLeader = function (v) { L.refLeader = v; save(); render(); };
  A.tab = function (v) { L.tab = v; save(); render(); window.scrollTo(0, 0); };
  A.scope = function (v) { L.scope = v; save(); render(); };
  A.setMe = function (v) { L.me = v; save(); render(); };
  A.whoAmI = function () {
    var w = sheet(head('¿Quién eres?') + '<div class="who" id="wm">' + pills('#wm', L.me) + '</div>');
    bindPills(w, '#wm', function (v) { L.me = v; save(); w.close(); });
  };
  A.pickEvent = function () {
    var w = sheet(head('Evento activo') + '<div class="card">' + events().map(function (e) { return '<button class="line" data-v="' + e.id + '">🏯<span class="grow"><b>' + esc(e.name) + '</b><br><small class="muted">' + fmtDate(e.date) + '</small></span>' + (curEvent() && e.id === curEvent().id ? '✔️' : '') + '</button>'; }).join('') + '</div><button class="btn block" data-new>+ Nuevo evento</button>');
    each(w, '.line[data-v]', function (b) { b.onclick = function () { L.ev = b.getAttribute('data-v'); save(); w.close(); }; });
    $('[data-new]', w).onclick = function () { w.remove(); A.editEvent(); };
  };
  A.editPlayer = function (id) {
    var old = S.players[id];
    var p = old || { id: uid('p'), name: '', emoji: 'em:' + EMB_IDS[players().length % EMB_IDS.length], photo: '', color: PCOLORS[players().length % PCOLORS.length], leader_code: '', leader_name: '', leader_colors: [], deck: '' };
    var ld = { code: p.leader_code, name: p.leader_name, colors: (p.leader_colors || []).slice() }, emo = /^em:/.test(p.emoji) ? p.emoji : 'em:skull', col = p.color, photo = p.photo || '';
    var w = sheet(head(old ? 'Editar pirata' : 'Nuevo pirata') +
      '<label>Nombre</label><input class="inp" id="pn" maxlength="30" value="' + esc(p.name) + '" placeholder="Nombre o apodo">' +
      '<label>Foto</label><div class="photo-row"><span id="pprev"></span><button type="button" class="btn upl" id="pfb">📷 Subir foto</button><input type="file" accept="image/*" id="pf" class="vh"><button type="button" class="btn ghost" id="prm">Quitar</button></div>' +
      '<label>…o un emblema</label><div class="emojis">' + EMB_IDS.map(function (e) { return '<button type="button" class="em' + ('em:' + e === emo ? ' on' : '') + '" data-e="' + e + '" title="' + esc(EMB[e].n) + '">' + emblemSvg(e) + '</button>'; }).join('') + '</div>' +
      '<label>Color</label><div class="pcols">' + PCOLORS.map(function (c) { return '<button type="button" class="pc' + (c === col ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '"></button>'; }).join('') + '</div>' +
      '<label>Líder con el que juega</label>' + leaderField('pl') +
      '<label>Notas del mazo (opcional)</label><input class="inp" id="pd" maxlength="60" value="' + esc(p.deck) + '" placeholder="p. ej. versión aggro">' +
      '<div class="actions">' + (old ? '<button class="btn danger" data-del>Borrar</button>' : '') + '<button class="btn primary grow" data-ok>Guardar</button></div>');
    function prev() { $('#pprev', w).innerHTML = av({ emoji: emo, photo: photo, color: col, leader_colors: ld.colors }, true); $('#prm', w).style.display = photo ? '' : 'none'; }
    each(w, '.em', function (b) { b.onclick = function () { emo = 'em:' + b.getAttribute('data-e'); photo = ''; each(w, '.em', function (x) { x.classList.toggle('on', x === b); }); prev(); }; });
    each(w, '.pc', function (b) { b.onclick = function () { col = b.getAttribute('data-c'); each(w, '.pc', function (x) { x.classList.toggle('on', x === b); }); prev(); }; });
    $('#prm', w).onclick = function () { photo = ''; prev(); };
    $('#pfb', w).onclick = function () { $('#pf', w).value = ''; $('#pf', w).click(); };
    $('#pf', w).onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      shrink(f, function (url) { if (!url) { toast('No se pudo abrir esa foto. Prueba con otra o con una captura de pantalla'); return; } photo = url; prev(); });
    };
    bindLeader(w, 'pl', ld);
    // el líder cambia el fondo del emblema: repinta la vista previa al volver del selector
    new MutationObserver(prev).observe($('#pl', w), { childList: true });
    prev();
    $('[data-ok]', w).onclick = function () {
      var n = $('#pn', w).value.trim();
      if (!n) { toast('Ponle un nombre'); return; }
      if (players().some(function (x) { return x.id !== p.id && x.name.toLowerCase() === n.toLowerCase(); })) { toast('Ya hay un pirata con ese nombre'); return; }
      put('players', { id: p.id, name: n.slice(0, 30), emoji: emo, photo: photo, color: col, leader_code: ld.code, leader_name: ld.name, leader_colors: ld.colors.slice(), deck: $('#pd', w).value.trim().slice(0, 60) });
      if (!old && !L.me) L.me = p.id;
      ensureDefaultEvent(); save(); w.close(); toast(old ? 'Guardado' : '¡' + n + ' se une a la tripulación!');
    };
    var d = $('[data-del]', w);
    if (d) d.onclick = function () { if (window.confirm('¿Borrar a ' + p.name + ' con todas sus rondas y minguitos?')) { del('players', p.id); if (L.me === p.id) L.me = ''; save(); w.close(); } };
  };
  A.editEvent = function (id) {
    var old = S.events[id];
    var e = old || { id: uid('ev'), name: '', date: new Date().toISOString().slice(0, 10), city: '', rounds: 0, mins: 35 };
    var w = sheet(head(old ? 'Editar evento' : 'Nuevo evento') +
      '<label>Nombre</label><input class="inp" id="en" maxlength="60" value="' + esc(e.name) + '" placeholder="Regional de…">' +
      '<div class="row2"><div><label>Fecha</label><input class="inp" type="date" id="ed" value="' + esc(e.date) + '"></div><div><label>Ciudad</label><input class="inp" id="ec" maxlength="40" value="' + esc(e.city) + '"></div></div>' +
      '<div class="row2"><div><label>Rondas suizas</label><input class="inp" type="number" min="0" max="20" id="er" value="' + e.rounds + '"></div><div><label>Minutos/ronda</label><input class="inp" type="number" min="5" max="120" id="em" value="' + e.mins + '"></div></div>' +
      '<div class="actions">' + (old ? '<button class="btn danger" data-del>Borrar</button>' : '') + '<button class="btn primary grow" data-ok>Guardar</button></div>');
    $('[data-ok]', w).onclick = function () {
      var n = $('#en', w).value.trim(), d = $('#ed', w).value;
      if (!n || !/^\d{4}-\d{2}-\d{2}$/.test(d)) { toast('Falta el nombre o la fecha'); return; }
      put('events', { id: e.id, name: n.slice(0, 60), date: d, city: $('#ec', w).value.trim().slice(0, 40), rounds: Math.max(0, Math.min(20, +$('#er', w).value || 0)), mins: Math.max(5, Math.min(120, +$('#em', w).value || 35)) });
      L.ev = e.id; save(); w.close();
    };
    var dl = $('[data-del]', w);
    if (dl) dl.onclick = function () { if (window.confirm('¿Borrar el evento con todas sus rondas?')) { del('events', e.id); L.ev = ''; ensureDefaultEvent(); save(); w.close(); } };
  };
  A.logRound = function (id) {
    if (!players().length) { A.editPlayer(); return; }
    var ev = curEvent();
    if (!ev) { A.editEvent(); return; }
    var m = S.matches[id];
    var pid = m ? m.player_id : (S.players[L.me] ? L.me : players()[0].id);
    function nextRound(p) { return 1 + list('matches').filter(function (x) { return x.player_id === p && x.event_id === ev.id && !x.stage; }).reduce(function (mx, x) { return Math.max(mx, x.round); }, 0); }
    function fromPlayer(p) { p = S.players[p]; return { code: p.leader_code, name: p.leader_name, colors: (p.leader_colors || []).slice() }; }
    var st = { pid: pid, res: m ? m.result : '', first: m ? m.went_first : null };
    var my = m ? { code: m.my_leader_code, name: m.my_leader_name, colors: (m.my_colors || []).slice() } : fromPlayer(pid);
    var opp = { code: m ? m.opp_leader_code : '', name: m ? m.opp_leader_name : '', colors: ((m && m.opp_colors) || []).slice() };
    var w = sheet(head(m ? 'Editar ronda' : 'Registrar ronda') +
      '<label>Pirata</label><div class="who" id="rp">' + pills('#rp', pid) + '</div>' +
      '<div class="row2"><div><label>Ronda</label><input class="inp" type="number" min="0" max="20" id="rr" value="' + (m ? m.round : nextRound(pid)) + '"></div><div><label>Fase</label><select class="inp" id="rs"><option value="">Suizo</option>' + STAGES.map(function (s) { return '<option' + (m && s === m.stage ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div></div>' +
      '<label>Resultado</label><div class="seg big" id="rres"><button type="button" data-v="W" class="win">Victoria</button><button type="button" data-v="L" class="loss">Derrota</button><button type="button" data-v="D" class="draw">Empate</button></div>' +
      '<label>Turno</label><div class="seg" id="rf"><button type="button" data-v="1">Fui 1.º</button><button type="button" data-v="0">Fui 2.º</button><button type="button" data-v="">No sé</button></div>' +
      '<label>Líder rival</label>' + leaderField('ro') +
      '<label>Rival (opcional)</label><input class="inp" id="rn" maxlength="30" value="' + esc(m ? m.opp_name : '') + '" placeholder="Nombre del rival">' +
      '<label>Mi líder</label>' + leaderField('rm') +
      '<label>Notas</label><textarea class="inp" id="rt" maxlength="400" placeholder="Qué pasó, cartas clave…">' + esc(m ? m.notes : '') + '</textarea>' +
      '<div class="actions">' + (m ? '<button class="btn danger" data-del>Borrar</button>' : '') + '<button class="btn primary grow" data-ok>Guardar</button></div>');
    function paintSeg(sel, val) { each(w, sel + ' button', function (b) { b.classList.toggle('on', b.getAttribute('data-v') === val); }); }
    paintSeg('#rres', st.res); paintSeg('#rf', st.first === true ? '1' : st.first === false ? '0' : '');
    each(w, '#rres button', function (b) { b.onclick = function () { st.res = b.getAttribute('data-v'); paintSeg('#rres', st.res); }; });
    each(w, '#rf button', function (b) { b.onclick = function () { var v = b.getAttribute('data-v'); st.first = v === '1' ? true : v === '0' ? false : null; paintSeg('#rf', v); }; });
    bindLeader(w, 'ro', opp);
    var paintMy = bindLeader(w, 'rm', my);
    bindPills(w, '#rp', function (v) {
      st.pid = v;
      if (!m) { var f = fromPlayer(v); my.code = f.code; my.name = f.name; my.colors.length = 0; Array.prototype.push.apply(my.colors, f.colors); paintMy(); $('#rr', w).value = nextRound(v); }
    });
    $('[data-ok]', w).onclick = function () {
      if (!st.res) { toast('Elige el resultado'); return; }
      put('matches', {
        id: m ? m.id : uid('m'), event_id: m ? m.event_id : ev.id, player_id: st.pid, round: Math.max(0, Math.min(20, +$('#rr', w).value || 0)), stage: $('#rs', w).value,
        result: st.res, went_first: st.first, my_leader_code: my.code, my_leader_name: my.name, my_colors: my.colors.slice(),
        opp_leader_code: opp.code, opp_leader_name: opp.name, opp_colors: opp.colors.slice(), opp_name: $('#rn', w).value.trim().slice(0, 30),
        notes: $('#rt', w).value.trim().slice(0, 400), created_at: m ? m.created_at : new Date().toISOString(),
      });
      w.close();
      toast(st.res === 'W' ? '¡Victoria! 🏴‍☠️' : st.res === 'L' ? 'Derrota… a por la siguiente ⚓' : 'Empate');
    };
    var dl = $('[data-del]', w);
    if (dl) dl.onclick = function () { if (window.confirm('¿Borrar esta ronda?')) { del('matches', m.id); w.close(); } };
  };
  A.logMisplay = function (id) {
    if (!players().length) { A.editPlayer(); return; }
    var m = S.misplays[id], ev = curEvent();
    var pid = m ? m.player_id : '';
    var w = sheet(head(m ? 'Editar minguito' : 'Apuntar un minguito') +
      '<p class="small muted" style="margin-top:0">Se apunta el misplay y luego la tripulación vota del 1 al 5 lo minguito que fue. Gana (o pierde) quien más puntos acumule.</p>' +
      '<label>¿Quién hizo el minguito?</label><div class="who" id="mpp">' + pills('#mpp', pid) + '</div>' +
      '<label>¿Qué pasó?</label><textarea class="inp" id="mt" maxlength="400" placeholder="Se olvidó de atacar con el líder, puso el DON!! en el personaje equivocado…">' + esc(m ? m.text : '') + '</textarea>' +
      '<label>Ronda (opcional)</label><input class="inp" type="number" min="0" max="20" id="mr" value="' + (m && m.round ? m.round : '') + '">' +
      '<div class="actions">' + (m ? '<button class="btn danger" data-del>Borrar</button>' : '') + '<button class="btn ming grow" data-ok>Guardar</button></div>');
    bindPills(w, '#mpp', function (v) { pid = v; });
    $('[data-ok]', w).onclick = function () {
      var t = $('#mt', w).value.trim();
      if (!pid || !t) { toast('Falta quién y qué pasó'); return; }
      put('misplays', { id: m ? m.id : uid('mp'), player_id: pid, event_id: m ? m.event_id : (ev ? ev.id : null), round: Math.max(0, Math.min(20, +$('#mr', w).value || 0)), text: t.slice(0, 400), reported_by: m ? m.reported_by : (L.me || ''), created_at: m ? m.created_at : new Date().toISOString() });
      L.tab = 'ming'; save(); w.close(); toast('🤡 Apuntado. ¡A votar!');
    };
    var dl = $('[data-del]', w);
    if (dl) dl.onclick = function () { if (window.confirm('¿Borrar este minguito?')) { del('misplays', m.id); w.close(); } };
  };
  A.vote = function (mid, el) {
    if (!S.players[L.me]) { toast('Primero elige quién eres'); A.whoAmI(); return; }
    var mp = S.misplays[mid];
    if (mp && mp.player_id === L.me) { toast('No puedes votar tus propios minguitos 😏'); return; }
    put('misplay_votes', { id: mid + ':' + L.me, misplay_id: mid, voter_id: L.me, score: +el.getAttribute('data-s') });
    render();
  };
  A.playerSheet = function (id) {
    var p = S.players[id]; if (!p) return;
    var ms = list('matches').filter(function (m) { return m.player_id === id; }), r = record(ms);
    var got = BADGES.map(function (b) { return '<div class="badge' + (b.t(ms) ? ' on' : '') + '"><span>' + b.i + '</span><b>' + b.n + '</b><small>' + b.d + '</small></div>'; }).join('');
    var mpts = list('misplays').filter(function (m) { return m.player_id === id; }).reduce(function (s, m) { return s + mingAvg(m.id).avg; }, 0);
    var w = sheet(head(esc(p.emoji + ' ' + p.name)) +
      '<div class="card center">' + av(p, true) + '<div class="small">' + leaderLabel(p.leader_code, p.leader_name, p.leader_colors) + '</div>' + (p.deck ? '<div class="small muted">' + esc(p.deck) + '</div>' : '') +
      '<div class="stats"><div class="stat"><b>' + recStr(r) + '</b><small>histórico</small></div><div class="stat"><b>' + r.wr + '%</b><small>victorias</small></div><div class="stat"><b>' + streak(ms) + '</b><small>mejor racha</small></div><div class="stat"><b>' + mpts.toFixed(1) + '</b><small>pts minguito</small></div></div></div>' +
      '<div class="sec"><h2>Insignias</h2></div><div class="badges">' + got + '</div><button class="btn block" data-edit>Editar pirata</button>');
    $('[data-edit]', w).onclick = function () { w.remove(); A.editPlayer(id); };
  };
  A.crew = function () {
    var w = sheet(head('Tripulación online') +
      (L.crew ? '<p>Estás en la tripulación con el código:</p><div class="code">' + esc(L.crew) + '</div><button class="btn primary block" data-share>Compartir enlace de invitación</button><button class="btn ghost block" data-leave>Salir en este móvil</button>'
        : '<p class="small">Todos los que tengan el mismo <b>código</b> ven y editan los mismos datos. Es la llave de vuestra tripulación: pásalo solo a los tuyos.</p>' +
          '<button class="btn primary block" data-create>Crear tripulación nueva</button><label>…o únete con un código</label><input class="inp" id="cc" placeholder="pega el código" autocapitalize="none" autocomplete="off"><button class="btn block" data-join>Unirse</button>'));
    function join(code) {
      code = code.trim();
      if (code.length < 12) { toast('El código es demasiado corto (mín. 12 caracteres)'); return; }
      sha256(code).then(function (h) {
        // el evento por defecto local sin rondas no se sube: la tripulación ya tiene (o creará) el suyo
        list('events').forEach(function (e) { if (/-local$/.test(e.id) && !list('matches').some(function (m) { return m.event_id === e.id; }) && !list('misplays').some(function (m) { return m.event_id === e.id; })) delete S.events[e.id]; });
        var hadLocal = list('players').length + list('events').length > 0;
        L.crew = code; L.hash = h;
        if (hadLocal) TABLES.forEach(function (t) { list(t).forEach(function (r) { r.crew = h; L.pending.push({ kind: 'put', table: t, row: r }); }); });
        save(); w.close(); toast('⚓ ¡A bordo!'); pull();
      });
    }
    var c = $('[data-create]', w);
    if (c) c.onclick = function () { var a = new Uint8Array(12); crypto.getRandomValues(a); join('lp-' + Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('')); };
    var j = $('[data-join]', w);
    if (j) j.onclick = function () { join($('#cc', w).value); };
    var s = $('[data-share]', w);
    if (s) s.onclick = function () {
      var text = '¡Únete a nuestra tripulación en Log Pose! 🏴‍☠️ ' + location.origin + location.pathname + '#crew=' + encodeURIComponent(L.crew);
      if (navigator.share) navigator.share({ title: 'Log Pose', text: text }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast('Enlace copiado'); });
    };
    var lv = $('[data-leave]', w);
    if (lv) lv.onclick = function () { if (window.confirm('¿Salir de la tripulación en este móvil? Los datos siguen en la nube.')) { L.crew = ''; L.hash = ''; L.pending = []; L.me = ''; TABLES.forEach(function (t) { S[t] = {}; }); ensureDefaultEvent(); save(); w.close(); } };
  };

  /* ---------- tools ---------- */
  function tick() {
    var left = Math.max(0, L.timerEnd - Date.now());
    var txt = L.timerEnd ? (Math.floor(left / 60000) + ':' + ('0' + Math.floor(left / 1000) % 60).slice(-2)) : '';
    var el = $('#tmini'), big = $('#tbig');
    if (el) el.textContent = txt;
    if (big) { big.textContent = txt || '--:--'; big.classList.toggle('late', !!L.timerEnd && left < 5 * 60000); }
    if (L.timerEnd && left === 0 && !L.timerRang) { L.timerRang = 1; save(); if (navigator.vibrate) navigator.vibrate([300, 150, 300]); toast('⏰ ¡Tiempo!'); }
  }
  setInterval(tick, 1000);
  A.timer = function () {
    var ev = curEvent(), mins = ev ? ev.mins : 35;
    var w = sheet(head('⏱️ Temporizador') + '<div class="timer" id="tbig">--:--</div><div class="row2"><button class="btn primary" data-go>Empezar ' + mins + ' min</button><button class="btn" data-stop>Parar</button></div><p class="small muted center">Sigue contando aunque cierres la app.</p>');
    $('[data-go]', w).onclick = function () { L.timerEnd = Date.now() + mins * 60000; L.timerRang = 0; save(); tick(); };
    $('[data-stop]', w).onclick = function () { L.timerEnd = 0; save(); tick(); };
    tick();
  };
  A.dice = function () {
    var w = sheet(head('🎲 ¿Quién empieza?') + '<div class="dice"><div><small>Tú</small><b id="d1">?</b></div><div><small>Rival</small><b id="d2">?</b></div></div><p class="center" id="dr"></p><button class="btn primary block" data-roll>Tirar dados</button>');
    $('[data-roll]', w).onclick = function () {
      var a, b; do { a = 1 + Math.floor(Math.random() * 6); b = 1 + Math.floor(Math.random() * 6); } while (a === b);
      $('#d1', w).textContent = a; $('#d2', w).textContent = b; $('#dr', w).innerHTML = a > b ? '<b>¡Eliges tú!</b>' : '<b>Elige el rival</b>';
    };
  };
  var KIT = ['Mazo (50 cartas) + líder', '10 DON!!', 'Fundas de repuesto', 'Lista del mazo registrada', 'Cuenta de Bandai TCG+ y QR', 'Entrada / ticket', 'Dados o contadores', 'Tapete', 'Cargador / powerbank', 'Agua y algo de comer', 'DNI', 'Dinero para side events'];
  A.kit = function () {
    var ev = curEvent(), k = ev ? ev.id : 'x';
    L.kit[k] = L.kit[k] || {};
    var w = sheet(head('🎒 Checklist') + '<div class="card" id="kl"></div><button class="btn ghost block" data-reset>Desmarcar todo</button>');
    function paint() {
      $('#kl', w).innerHTML = KIT.map(function (it, i) { return '<label class="check"><input type="checkbox" data-i="' + i + '"' + (L.kit[k][i] ? ' checked' : '') + '> ' + esc(it) + '</label>'; }).join('');
      each(w, '[data-i]', function (c) { c.onchange = function () { L.kit[k][c.getAttribute('data-i')] = c.checked; save(); }; });
    }
    paint(); $('[data-reset]', w).onclick = function () { L.kit[k] = {}; save(); paint(); };
  };
  A.guide = function () {
    var spots = [
      ['📍', 'IFA – Fira Alacant', 'N-340, km 731, Elche. Aquí es el Regional (28–29 nov).'],
      ['🏰', 'Castillo de Santa Bárbara', 'Vistas de toda la bahía; se sube en ascensor desde la playa del Postiguet.'],
      ['🌴', 'Explanada de España', 'El paseo de las baldosas onduladas junto al puerto.'],
      ['⚓', 'Puerto y Marina', 'Terrazas junto a los barcos. Muy pirata.'],
      ['🍚', 'Arroz a banda / con costra', 'Lo típico: a banda en Alicante, con costra en Elche.'],
      ['🌳', 'Palmeral de Elche', 'Patrimonio de la Humanidad, cerca de la IFA. El Huerto del Cura merece la pena.'],
    ];
    sheet(head('🌴 Guía Alicante') + '<div class="card">' + spots.map(function (s) { return '<div class="line"><span class="big-emo">' + s[0] + '</span><span class="grow"><b>' + s[1] + '</b><br><small class="muted">' + s[2] + '</small></span></div>'; }).join('') + '</div>');
  };

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-a]');
    if (!el) return;
    var f = A[el.getAttribute('data-a')];
    if (f) { e.preventDefault(); f(el.getAttribute('data-v') || undefined, el); }
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) pull(true); });
  window.addEventListener('online', function () { flush().then(function () { pull(true); }); });

  /* ---------- start ---------- */
  var hm = /#crew=([^&]+)/.exec(location.hash);
  if (hm && ONLINE && !L.crew) {
    var code = decodeURIComponent(hm[1]);
    history.replaceState(null, '', location.pathname);
    sha256(code).then(function (h) { L.crew = code; L.hash = h; save(); toast('⚓ Te has unido a la tripulación'); pull(); });
  }
  if (!synced()) ensureDefaultEvent();
  render();
  pull(true);
  setInterval(function () { if (!document.hidden) pull(true); }, 20000);
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function () {});
  window.LP = { S: S, L: L, A: A, render: render };
})();

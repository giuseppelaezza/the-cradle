/*
 * main.js — Schermata iniziale (modalità seme + moduli + personaggi + avversario)
 * e wiring engine <-> ui.
 */
(function () {
  'use strict';

  var Characters = window.CradleCharacters;
  var Objects = window.CradleObjects;
  var Suits = window.CradleSuits;
  var SUIT_LABEL = { oro: 'Oro', spade: 'Spade', bastoni: 'Bastoni', coppe: 'Coppe' };

  var overlay = document.getElementById('overlay');
  var sheet = document.getElementById('sheet');

  // Stato della configurazione. I poteri seguono automaticamente il modulo Personaggi.
  var cfg = { opponent: 'cpu', suitMode: 'rotating', characters: true, objects: true, reshuffle: true, reshuffleCount: 2,
              ruleset: 'A', altMatch: true, objectMode: 'random', objectSelection: [], charN: 'runner', charS: 'brawler' };

  // Icona del seme (SVG inline, colorata dal CSS come in partita).
  function suitIconEl(suit) { var w = h('span', 'suit-ic s-' + suit); if (Suits) w.innerHTML = Suits.svg(suit); return w; }
  // Descrizioni sintetiche dei due ruleset (usate nei tooltip e nella nota).
  var RULESET_DESC = {
    A: 'Muovere su una figura non ha effetto. In attacco, colpire una figura la gira a faccia in giù, dà i suoi punti e un trofeo e fa pescare 3 oggetti tra cui ne tieni 1; anche conquistare il centro fa scegliere un oggetto. Ogni giocatore inizia con un oggetto extra.',
    B: 'Abbinare una figura (muovendovi sopra o colpendola in attacco) la elimina, dà i suoi punti e un trofeo e fa pescare 1 oggetto.'
  };

  function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function renderConfig() {
    document.body.classList.add('setup');
    sheet.innerHTML = '';
    var logo = document.createElement('img');
    logo.className = 'setup-logo'; logo.src = 'assets/logo.svg'; logo.alt = 'The Cradle';
    sheet.appendChild(logo);
    sheet.appendChild(h('div', 'setup-divider'));

    // Avversario
    sheet.appendChild(fieldLabel('Avversario'));
    var opp = h('div', 'cfg-row');
    opp.appendChild(radio('opp', 'Hot Seat', cfg.opponent === '2p', function () { cfg.opponent = '2p'; renderConfig(); }, 'Due giocatori sullo stesso dispositivo, a turni (passa il dispositivo).'));
    opp.appendChild(radio('opp', 'VS CPU', cfg.opponent === 'cpu', function () { cfg.opponent = 'cpu'; renderConfig(); }, 'Giochi (come Nord) contro il computer.'));
    opp.appendChild(radio('opp', 'CPU vs CPU', cfg.opponent === 'cpucpu', function () { cfg.opponent = 'cpucpu'; renderConfig(); }, 'Due CPU giocano tra loro: modalità dimostrativa.'));
    sheet.appendChild(opp);

    // Ruleset (sistema di regole di abbinamento)
    sheet.appendChild(fieldLabel('Ruleset'));
    var rs = h('select', 'cfg-select');
    rs.title = 'Insieme di regole di abbinamento usato in partita.';
    [['A', 'Ruleset A'], ['B', 'Ruleset B']].forEach(function (o) {
      var op = h('option', null, o[1]); op.value = o[0]; op.title = RULESET_DESC[o[0]];
      if (cfg.ruleset === o[0]) op.selected = true; rs.appendChild(op);
    });
    rs.onchange = function () { cfg.ruleset = rs.value; cfg.altMatch = (cfg.ruleset === 'A'); renderConfig(); };
    sheet.appendChild(rs);
    sheet.appendChild(h('p', 'cfg-desc', RULESET_DESC[cfg.ruleset]));

    // Oggetti: dropdown (mazzo casuale o selezione manuale)
    sheet.appendChild(fieldLabel('Oggetti'));
    var objRow = h('div', 'cfg-row');
    var os = h('select', 'cfg-select');
    os.title = 'Composizione del mazzo Oggetti.';
    [['random', 'Oggetti Random'], ['select', 'Seleziona Oggetti']].forEach(function (o) {
      var op = h('option', null, o[1]); op.value = o[0]; if (cfg.objectMode === o[0]) op.selected = true;
      op.title = o[0] === 'random' ? '5 tipi casuali (2 copie ciascuno).' : 'Scegli tu quali oggetti (2 copie di ciascuno).';
      os.appendChild(op);
    });
    os.onchange = function () { cfg.objectMode = os.value; renderConfig(); };
    objRow.appendChild(os);
    if (cfg.objectMode === 'select') {
      var toolsBtn = h('button', 'ghost', 'Tools' + (cfg.objectSelection.length ? ' (' + cfg.objectSelection.length + ')' : ''));
      toolsBtn.type = 'button';
      toolsBtn.title = 'Apri la selezione degli oggetti da includere nel mazzo.';
      toolsBtn.onclick = openToolsDialog;
      objRow.appendChild(toolsBtn);
    }
    sheet.appendChild(objRow);

    // Regole addizionali
    sheet.appendChild(fieldLabel('Regole addizionali'));
    var addl = h('div', 'cfg-row');
    addl.appendChild(checkbox('Personaggi', cfg.characters, function (v) { cfg.characters = v; renderConfig(); }, 'Ogni giocatore ha un personaggio con seme di appartenenza, oggetti di partenza e potere.'));
    addl.appendChild(checkbox('Mulligan', cfg.reshuffle, function (v) { cfg.reshuffle = v; renderConfig(); }, 'Consente di scartare 1+ carte scelte e ripescarne altrettante (usi limitati per partita).'));
    if (cfg.reshuffle) {
      var rc = h('select', 'cfg-select');
      rc.title = 'Numero di Mulligan per giocatore in una partita.';
      [1, 2, 3].forEach(function (n) { var op = h('option', null, String(n)); op.value = n; if (cfg.reshuffleCount === n) op.selected = true; rc.appendChild(op); });
      rc.onchange = function () { cfg.reshuffleCount = parseInt(rc.value, 10); };
      addl.appendChild(rc);
    }
    sheet.appendChild(addl);

    // Scelta personaggi (solo se modulo attivo) — via menu a tendina, con descrizione sotto.
    if (cfg.characters) {
      sheet.appendChild(fieldLabel('Personaggi'));
      sheet.appendChild(charSelect('N', 'charN'));
      sheet.appendChild(charSelect('S', 'charS'));
    }

    var startRow = h('div', 'start-row');
    var start = h('button', 'primary big-btn start-main', '▶ Inizia partita');
    start.title = 'Avvia la partita con le impostazioni scelte.';
    start.onclick = startGame;
    var batch = h('button', 'ghost big-btn start-batch', '⏱ Batch test');
    batch.title = 'Esegue 2000 partite CPU vs CPU con queste impostazioni e mostra le statistiche.';
    batch.onclick = runBatchTest;
    startRow.appendChild(start); startRow.appendChild(batch);
    sheet.appendChild(startRow);
    overlay.hidden = false;
    ensureRulesButton();
  }

  // Pulsante "Regolamento" centrato sotto il rettangolo del configuratore.
  var rulesBtn = null;
  function ensureRulesButton() {
    if (!rulesBtn) {
      rulesBtn = h('button', 'ghost config-rules-btn');
      rulesBtn.type = 'button';
      rulesBtn.title = 'Mostra il regolamento del ruleset selezionato.';
      rulesBtn.onclick = function () { if (window.CradleUI && window.CradleUI.openRulesDialog) window.CradleUI.openRulesDialog(cfg.ruleset); };
    }
    rulesBtn.textContent = '📖 Regolamento (' + cfg.ruleset + ')';
    if (rulesBtn.parentNode !== overlay) overlay.appendChild(rulesBtn);
  }

  function fieldLabel(t) { return h('div', 'cfg-label', t); }

  function radio(name, label, checked, onSel, title) {
    var l = h('label', 'cfg-opt'); if (title) l.title = title;
    var r = document.createElement('input'); r.type = 'radio'; r.name = name; r.checked = checked;
    r.onchange = function () { if (r.checked) onSel(); };
    l.appendChild(r); l.appendChild(document.createTextNode(' ' + label)); return l;
  }
  function checkbox(label, checked, onChange, title) {
    var l = h('label', 'cfg-opt'); if (title) l.title = title;
    var c = document.createElement('input'); c.type = 'checkbox'; c.checked = checked;
    c.onchange = function () { onChange(c.checked); };
    l.appendChild(c); l.appendChild(document.createTextNode(' ' + label)); return l;
  }

  function charSelect(playerId, cfgKey) {
    var box = h('div', 'char-block');
    var isCpuSlot = cfg.opponent === 'cpucpu' || (cfg.opponent === 'cpu' && playerId === 'S');
    // Titolo su una riga a sé; dropdown e card sotto.
    box.appendChild(h('div', 'char-who', 'Giocatore ' + playerId + (playerId === 'N' ? ' (Nord)' : ' (Sud)') + (isCpuSlot ? ' — CPU' : '')));
    var sel = h('select', 'cfg-select char-select');
    sel.title = 'Scegli il personaggio.';
    // "Random": personaggio scelto casualmente a inizio partita.
    var rop = h('option', null, 'Random'); rop.value = 'random'; if (cfg[cfgKey] === 'random') rop.selected = true; sel.appendChild(rop);
    Characters.ORDER.forEach(function (type) {
      var ch = Characters.get(type);
      var op = h('option', null, ch.label); op.value = type; if (cfg[cfgKey] === type) op.selected = true;
      sel.appendChild(op);
    });
    sel.onchange = function () { cfg[cfgKey] = sel.value; renderConfig(); };
    box.appendChild(sel);
    box.appendChild(charDescription(cfg[cfgKey]));
    return box;
  }

  // Testo "quando" di un oggetto (come in partita): "attack & move" se in entrambe le fasi.
  function objPhaseTextCfg(type) {
    var def = Objects && Objects.def(type);
    var phases = (def && def.phases) ? def.phases : (def ? [def.phase] : []);
    return phases.length > 1 ? 'attack & move' : (phases[0] || '');
  }
  // Descrizione compatta del personaggio: 3 riquadri uguali (Seme, Oggetti, Abilità) con tooltip.
  function charDescription(type) {
    var d = h('div', 'char-desc');
    if (type === 'random') { d.appendChild(h('div', 'cd-random', 'Personaggio scelto casualmente a inizio partita.')); return d; }
    var ch = Characters.get(type); if (!ch) return d;
    // Seme (dentro un chip, così i 3 riquadri sono uguali)
    var semeBox = h('div', 'cd-box');
    semeBox.appendChild(h('div', 'cd-label', 'Seme'));
    var semeChip = h('div', 'cd-chip cd-seme-chip');
    var ic = suitIconEl(ch.suit); ic.classList.add('cd-suit'); semeChip.appendChild(ic);
    semeChip.appendChild(h('span', 'cd-chip-name', SUIT_LABEL[ch.suit]));
    attachTip(semeChip, 'Seme di appartenenza: ' + SUIT_LABEL[ch.suit] + ' (funziona come un secondo seme di turno personale e fisso).');
    semeBox.appendChild(semeChip); d.appendChild(semeBox);
    // Oggetti (nome + quando, con tooltip descrizione)
    var objBox = h('div', 'cd-box');
    objBox.appendChild(h('div', 'cd-label', 'Oggetti'));
    (ch.startObjects || []).forEach(function (t) {
      var def = Objects && Objects.def(t);
      var chip = h('div', 'cd-chip');
      chip.appendChild(h('span', 'cd-chip-name', def ? def.label : t));
      chip.appendChild(h('span', 'cd-chip-sub', objPhaseTextCfg(t)));
      attachTip(chip, def ? def.desc : t);
      objBox.appendChild(chip);
    });
    d.appendChild(objBox);
    // Abilità (nome + numero di utilizzi, con tooltip descrizione)
    var abBox = h('div', 'cd-box');
    abBox.appendChild(h('div', 'cd-label', 'Abilità'));
    var abChip = h('div', 'cd-chip');
    abChip.appendChild(h('span', 'cd-chip-name', ch.label));
    abChip.appendChild(h('span', 'cd-chip-sub', ch.powerUses != null ? (ch.powerUses + ' usi') : 'passiva'));
    attachTip(abChip, ch.power || '');
    abBox.appendChild(abChip); d.appendChild(abBox);
    return d;
  }

  // ---- Tooltip custom del configuratore (posizionato via JS, come in partita) ----
  var cfgTipEl = null;
  function attachTip(el, text) {
    if (!text) return;
    el.classList.add('cd-has-tip');
    el.addEventListener('mouseenter', function () { showCfgTip(el, text); });
    el.addEventListener('mouseleave', hideCfgTip);
  }
  function showCfgTip(el, text) {
    if (!cfgTipEl || !cfgTipEl.isConnected) { cfgTipEl = h('div', 'cfg-tip'); document.body.appendChild(cfgTipEl); }
    cfgTipEl.textContent = text; cfgTipEl.style.display = 'block'; cfgTipEl.style.visibility = 'hidden'; cfgTipEl.style.left = '0'; cfgTipEl.style.top = '0';
    var r = el.getBoundingClientRect(), tw = cfgTipEl.offsetWidth, th = cfgTipEl.offsetHeight;
    var left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - tw - 8));
    var top = r.top - th - 8; if (top < 8) top = r.bottom + 8;
    top = Math.min(top, window.innerHeight - th - 8); if (top < 8) top = 8;
    cfgTipEl.style.left = left + 'px'; cfgTipEl.style.top = top + 'px'; cfgTipEl.style.visibility = '';
  }
  function hideCfgTip() { if (cfgTipEl) cfgTipEl.style.display = 'none'; }

  // Dialog "Tools": scegli quali oggetti comporranno il mazzo (2 copie di ciascuno scelto).
  function openToolsDialog() {
    var OBJ = window.CradleObjects, UI = window.CradleUI;
    var back = h('div', 'dialog-back');
    var box = h('div', 'dialog rules-dialog');
    var head = h('div', 'rules-head');
    head.appendChild(h('h2', null, 'Tools — oggetti in partita'));
    var x = h('button', 'rules-x', '✕'); x.title = 'Chiudi';
    var close = function () { back.remove(); document.removeEventListener('keydown', onKey); renderConfig(); };
    x.onclick = close; head.appendChild(x); box.appendChild(head);

    var content = h('div', 'opt-content');
    content.appendChild(h('p', 'setup-sub', 'Il mazzo Oggetti sarà composto da 2 copie di ciascun oggetto selezionato. Clicca per selezionare/deselezionare.'));
    var grid = h('div', 'obj-card-grid');
    function renderGrid() {
      grid.innerHTML = '';
      OBJ.ALL_TYPES.forEach(function (type) {
        var selected = cfg.objectSelection.indexOf(type) !== -1;
        var card = UI.objectCardEl(type, { selectable: true, selected: selected });
        card.onclick = function () {
          var i = cfg.objectSelection.indexOf(type);
          if (i !== -1) cfg.objectSelection.splice(i, 1); else cfg.objectSelection.push(type);
          renderGrid();
        };
        grid.appendChild(card);
      });
    }
    renderGrid();
    content.appendChild(grid);
    box.appendChild(content);
    var foot = h('div', 'tools-foot');
    var done = h('button', 'primary', 'Fatto'); done.onclick = close;
    foot.appendChild(done); box.appendChild(foot);

    back.appendChild(box);
    back.onclick = function (e) { if (e.target === back) close(); };
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
  }

  // Costruisce le opzioni per createGame dalla configurazione corrente.
  function buildOpts(extra) {
    var useSelection = cfg.objects && cfg.objectMode === 'select' && cfg.objectSelection.length > 0;
    var opts = {
      suitMode: cfg.suitMode,
      modules: { characters: cfg.characters, objects: cfg.objects, powers: cfg.characters, reshuffle: cfg.reshuffle },
      reshuffleCount: cfg.reshuffleCount,
      altMatch: cfg.altMatch,
      objectSelection: useSelection ? cfg.objectSelection.slice() : null,
      characters: { N: cfg.charN, S: cfg.charS }
    };
    if (extra) for (var k in extra) opts[k] = extra[k];
    return opts;
  }

  function startGame() {
    var opts = buildOpts();
    var game = window.CradleEngine.createGame(opts);
    var st = game.state;
    st.log.push('Setup: seme iniziale/di turno = ' + st.centerInitialSuit + ' · modalità ' + st.suitMode +
      ' · moduli: ' + (st.modules.characters ? 'Personaggi ' : '') + (st.modules.objects ? 'Oggetti' : '') +
      (!st.modules.characters && !st.modules.objects ? 'base' : '') + '. Primo Giocatore = ' + st.firstPlayer + '.');
    if (st.modules.characters) st.log.push('Personaggi: N=' + st.players.N.character + ' (' + st.players.N.belongingSuit + '), S=' + st.players.S.character + ' (' + st.players.S.belongingSuit + ').');

    var controller = window.CradleUI.createController(game, { mode: cfg.opponent, cpuId: 'S' });
    window.__cradle = { game: game, controller: controller };
    document.body.classList.remove('setup');
    if (rulesBtn) rulesBtn.remove();
    overlay.hidden = true;
    controller.render();
  }

  // ============================================================ BATCH TEST (2000 partite CPU vs CPU)
  var Engine = window.CradleEngine, Cpu = window.CradleCpu;
  function makeRng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function batchWhoActs(s, g) {
    if (s.gameOver) return null;
    if (s.subPhase === 'object-discard') return s.pendingObjectDiscard.playerId;
    if (s.subPhase === 'tool-discard') return s.pendingToolDiscard && s.pendingToolDiscard.playerId;
    if (s.subPhase === 'runner-figure') return s.pendingRunner && s.pendingRunner.playerId;
    if (s.subPhase === 'timebomb-suit') return s.pendingTimebomb.playerId;
    if (s.subPhase === 'elemental-target' || s.subPhase === 'elemental-suit') return s.pendingElemental.playerId;
    if (s.subPhase === 'barrage-first' || s.subPhase === 'barrage-second') return s.pendingBarrage.playerId;
    if (s.subPhase === 'randomizer-select' || s.subPhase === 'randomizer-place') return s.pendingRandomizer.playerId;
    if (s.subPhase === 'altmatch-object') return s.pendingAltMatch.playerId;
    if (s.subPhase === 'clash-cards') return g.clashCurrentChooser();
    if (s.subPhase === 'clash-reloc') return s.pendingClash.relocatorId;
    if (s.subPhase === 'forced-reloc') return s.pendingForced.chooserId;
    if (s.subPhase) return null;
    if (s.phase === 'select') return s.selected.N == null ? 'N' : (s.selected.S == null ? 'S' : null);
    if (s.phase === 'move' || s.phase === 'attack') return s.activePlayer;
    return null;
  }
  function batchNewAcc() {
    var randomChars = cfg.charN === 'random' || cfg.charS === 'random';
    return { completed: 0, errors: 0, rounds: 0, combined: 0, winner: 0, loser: 0, margin: 0,
             ties: 0, decided: 0, startFirstWins: 0, figures: 0,
             objUses: {}, perChar: randomChars ? {} : null };
  }
  function batchPlay(seed, acc) {
    var firstPlayer = (seed % 2 === 0) ? 'N' : 'S', g, s;
    try { g = Engine.createGame(buildOpts({ rng: makeRng(seed), firstPlayer: firstPlayer })); s = g.state; }
    catch (e) { acc.errors++; return; }
    // Strumenta l'uso oggetti (conteggio per tipo).
    var origUse = g.useObject.bind(g);
    g.useObject = function (pid, oid) {
      var o = s.players[pid].objects.filter(function (x) { return x.id === oid; })[0];
      if (o) acc.objUses[o.type] = (acc.objUses[o.type] || 0) + 1;
      return origUse.apply(null, arguments);
    };
    var guard = 0;
    try { while (!s.gameOver && guard++ < 8000) { var a = batchWhoActs(s, g); if (!a) break; Cpu.cpuAct(g, a); } }
    catch (e) { acc.errors++; return; }
    if (!s.gameOver) { acc.errors++; return; }
    acc.completed++; acc.rounds += s.round;
    var N = s.players.N.score, S = s.players.S.score;
    acc.combined += N + S; acc.winner += Math.max(N, S); acc.loser += Math.min(N, S); acc.margin += Math.abs(N - S);
    var tie = s.result.tiebreak === 'patta';
    if (tie) acc.ties++; else { acc.decided++; if (s.result.winner === firstPlayer) acc.startFirstWins++; }
    acc.figures += (s.players.N.figuresMatched + s.players.S.figuresMatched) / 2;
    if (acc.perChar) ['N', 'S'].forEach(function (id) {
      var c = s.players[id].character; if (!c) return;
      var e = acc.perChar[c] = acc.perChar[c] || { games: 0, wins: 0 };
      e.games++; if (!tie && s.result.winner === id) e.wins++;
    });
  }
  function runBatchTest() {
    if (!Engine || !Cpu) return;
    var GAMES = (typeof window !== 'undefined' && window.__batchGames) ? (window.__batchGames | 0) : 2000;
    var acc = batchNewAcc(), seed = 0;
    var loader = showBatchLoader();
    function chunk() {
      var end = Math.min(seed + 40, GAMES);
      for (; seed < end; seed++) batchPlay(seed + 1, acc);
      loader.progress(seed, GAMES);
      if (seed < GAMES) setTimeout(chunk, 0);
      else { loader.close(); showBatchResults(acc, GAMES); }
    }
    setTimeout(chunk, 40);
  }
  function showBatchLoader() {
    var back = h('div', 'dialog-back batch-loader');
    var box = h('div', 'batch-loading');
    var ring = h('div', 'ring-loader');
    var txt = h('div', 'batch-progress', 'Esecuzione test… 0%');
    box.appendChild(ring); box.appendChild(txt);
    back.appendChild(box); document.body.appendChild(back);
    return {
      progress: function (done, total) { txt.textContent = 'Esecuzione test… ' + Math.round(100 * done / total) + '% (' + done + '/' + total + ')'; },
      close: function () { back.remove(); }
    };
  }
  // Metriche "generali" in formato [etichetta, valore].
  function batchGeneralRows(acc, GAMES) {
    var c = acc.completed || 1, dec = acc.decided || 1;
    return [
      ['Partite completate', acc.completed + '/' + GAMES],
      ['Errori', String(acc.errors)],
      ['Round medi', (acc.rounds / c).toFixed(2)],
      ['Punti medi totali', (acc.combined / c).toFixed(1)],
      ['Punti medi vincitore', (acc.winner / c).toFixed(1)],
      ['Punti medi perdente', (acc.loser / c).toFixed(1)],
      ['Margine medio', (acc.margin / c).toFixed(1)],
      ['Patte', (100 * acc.ties / c).toFixed(1) + '%'],
      ['Vittorie 1° giocatore (su decise)', (100 * acc.startFirstWins / dec).toFixed(1) + '% (±' + (196 * Math.sqrt(0.25 / dec)).toFixed(1) + ')'],
      ['Figure medie / giocatore', (acc.figures / c).toFixed(2)]
    ];
  }
  function batchCharRows(acc) {
    var rows = [];
    Characters.ORDER.forEach(function (t) {
      var e = acc.perChar[t]; if (!e || !e.games) { rows.push([Characters.get(t).label, '—']); return; }
      rows.push([Characters.get(t).label, (100 * e.wins / e.games).toFixed(1) + '% (' + e.wins + '/' + e.games + ')']);
    });
    return rows;
  }
  function batchObjRows(acc, GAMES) {
    var rows = [];
    Objects.ALL_TYPES.forEach(function (t) {
      var u = acc.objUses[t] || 0;
      var def = Objects.def(t);
      rows.push([def ? def.label : t, u + ' (' + (u / (acc.completed || 1)).toFixed(2) + '/partita)']);
    });
    return rows;
  }
  function batchSettingsRows() {
    return [
      ['Ruleset', cfg.ruleset],
      ['Personaggi (modulo)', cfg.characters ? 'sì' : 'no'],
      ['Personaggio N', cfg.charN === 'random' ? 'Random' : (Characters.get(cfg.charN) || {}).label],
      ['Personaggio S', cfg.charS === 'random' ? 'Random' : (Characters.get(cfg.charS) || {}).label],
      ['Oggetti', cfg.objectMode === 'select' ? ('Selezione (' + cfg.objectSelection.length + ')') : 'Random'],
      ['Mulligan', cfg.reshuffle ? (cfg.reshuffleCount + '/partita') : 'no'],
      ['Modalità', 'CPU vs CPU']
    ];
  }
  function showBatchResults(acc, GAMES) {
    var back = h('div', 'dialog-back');
    var box = h('div', 'dialog rules-dialog');
    var head = h('div', 'rules-head');
    head.appendChild(h('h2', null, 'Risultati Batch Test'));
    var x = h('button', 'rules-x', '✕'); x.title = 'Chiudi';
    var close = function () { back.remove(); };
    x.onclick = close; head.appendChild(x); box.appendChild(head);

    var content = h('div', 'batch-content');
    content.appendChild(collapsibleSection('Impostazioni', batchSettingsRows(), false));
    content.appendChild(collapsibleSection('Generale', batchGeneralRows(acc, GAMES), false));
    if (acc.perChar) content.appendChild(collapsibleSection('Personaggi (win-rate)', batchCharRows(acc), false));
    content.appendChild(collapsibleSection('Oggetti (utilizzo)', batchObjRows(acc, GAMES), true));
    box.appendChild(content);

    var foot = h('div', 'tools-foot');
    var dl = h('button', 'ghost', '⬇ Scarica CSV');
    dl.onclick = function () { downloadCsv(acc, GAMES); };
    var doneBtn = h('button', 'primary', 'Chiudi'); doneBtn.onclick = close;
    foot.appendChild(dl); foot.appendChild(doneBtn); box.appendChild(foot);

    back.appendChild(box);
    back.onclick = function (e) { if (e.target === back) close(); };
    document.body.appendChild(back);
  }
  // Sezione con intestazione cliccabile che comprime/espande il contenuto.
  function collapsibleSection(title, rows, collapsed) {
    var sec = h('div', 'batch-section' + (collapsed ? ' collapsed' : ''));
    var head = h('div', 'batch-sec-head');
    head.appendChild(h('span', 'batch-sec-caret', '▾'));
    head.appendChild(h('span', 'batch-sec-title', title));
    var body = h('div', 'batch-sec-body');
    var tbl = h('table', 'batch-table');
    rows.forEach(function (r) {
      var tr = h('tr');
      tr.appendChild(h('td', 'bt-k', r[0]));
      tr.appendChild(h('td', 'bt-v', r[1]));
      tbl.appendChild(tr);
    });
    body.appendChild(tbl); sec.appendChild(head); sec.appendChild(body);
    head.onclick = function () { sec.classList.toggle('collapsed'); };
    return sec;
  }
  function downloadCsv(acc, GAMES) {
    var lines = [];
    function push(section, rows) { rows.forEach(function (r) { lines.push([section, '"' + r[0] + '"', '"' + r[1] + '"'].join(',')); }); }
    lines.push('sezione,metrica,valore');
    push('Impostazioni', batchSettingsRows());
    push('Generale', batchGeneralRows(acc, GAMES));
    if (acc.perChar) push('Personaggi', batchCharRows(acc));
    push('Oggetti', batchObjRows(acc, GAMES));
    var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'cradle-batch-' + Date.now() + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  renderConfig();
})();

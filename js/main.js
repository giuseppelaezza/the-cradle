/*
 * main.js — Schermata iniziale (modalità seme + moduli + personaggi + avversario)
 * e wiring engine <-> ui.
 */
(function () {
  'use strict';

  var Characters = window.CradleCharacters;
  var SUIT_SYMBOL = { oro: '○', spade: '♠', bastoni: '♣', coppe: '♥' };

  var overlay = document.getElementById('overlay');
  var sheet = document.getElementById('sheet');

  // Stato della configurazione. I poteri seguono automaticamente il modulo Personaggi.
  var cfg = { opponent: 'cpu', suitMode: 'rotating', characters: true, objects: true, reshuffle: false, reshuffleCount: 2, charN: 'runner', charS: 'brawler' };

  function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function renderConfig() {
    document.body.classList.add('setup');
    sheet.innerHTML = '';
    var logo = document.createElement('img');
    logo.className = 'setup-logo'; logo.src = 'assets/logo.svg'; logo.alt = 'The Cradle';
    sheet.appendChild(logo);
    sheet.appendChild(h('p', 'setup-sub', 'Configurazione partita'));

    // Avversario
    sheet.appendChild(fieldLabel('Avversario'));
    var opp = h('div', 'cfg-row');
    opp.appendChild(radio('opp', 'Hot Seat', cfg.opponent === '2p', function () { cfg.opponent = '2p'; renderConfig(); }));
    opp.appendChild(radio('opp', 'VS CPU', cfg.opponent === 'cpu', function () { cfg.opponent = 'cpu'; renderConfig(); }));
    opp.appendChild(radio('opp', 'CPU vs CPU', cfg.opponent === 'cpucpu', function () { cfg.opponent = 'cpucpu'; renderConfig(); }));
    sheet.appendChild(opp);

    // Modalità seme (dropdown)
    sheet.appendChild(fieldLabel('Modalità seme'));
    var sel = h('select', 'cfg-select');
    [['fixed', 'Fisso'], ['rotating', 'Rotazione']].forEach(function (o) {
      var op = h('option', null, o[1]); op.value = o[0]; if (cfg.suitMode === o[0]) op.selected = true; sel.appendChild(op);
    });
    sel.onchange = function () { cfg.suitMode = sel.value; renderConfig(); };
    sheet.appendChild(sel);

    // Moduli (i poteri sono attivati automaticamente col modulo Personaggi)
    sheet.appendChild(fieldLabel('Moduli'));
    var mods = h('div', 'cfg-row');
    mods.appendChild(checkbox('Personaggi', cfg.characters, function (v) { cfg.characters = v; renderConfig(); }));
    mods.appendChild(checkbox('Oggetti', cfg.objects, function (v) { cfg.objects = v; renderConfig(); }));
    sheet.appendChild(mods);

    // Regole addizionali
    sheet.appendChild(fieldLabel('Regole addizionali'));
    var addl = h('div', 'cfg-row');
    addl.appendChild(checkbox('Reshuffle', cfg.reshuffle, function (v) { cfg.reshuffle = v; renderConfig(); }));
    if (cfg.reshuffle) {
      var rc = h('select', 'cfg-select');
      [1, 2, 3].forEach(function (n) { var op = h('option', null, String(n)); op.value = n; if (cfg.reshuffleCount === n) op.selected = true; rc.appendChild(op); });
      rc.onchange = function () { cfg.reshuffleCount = parseInt(rc.value, 10); };
      addl.appendChild(rc);
    }
    sheet.appendChild(addl);

    // Scelta personaggi (solo se modulo attivo) — via menu a tendina.
    if (cfg.characters) {
      sheet.appendChild(fieldLabel('Personaggi'));
      sheet.appendChild(charSelect('N', 'charN'));
      sheet.appendChild(charSelect('S', 'charS'));
      if (cfg.suitMode === 'fixed') sheet.appendChild(h('p', 'note', 'Nota: in modalità seme fissa il tactician non è selezionabile.'));
    }

    var start = h('button', 'primary big-btn', '▶ Inizia partita');
    start.onclick = startGame;
    sheet.appendChild(start);
    overlay.hidden = false;
  }

  function fieldLabel(t) { return h('div', 'cfg-label', t); }

  function radio(name, label, checked, onSel) {
    var l = h('label', 'cfg-opt');
    var r = document.createElement('input'); r.type = 'radio'; r.name = name; r.checked = checked;
    r.onchange = function () { if (r.checked) onSel(); };
    l.appendChild(r); l.appendChild(document.createTextNode(' ' + label)); return l;
  }
  function checkbox(label, checked, onChange) {
    var l = h('label', 'cfg-opt');
    var c = document.createElement('input'); c.type = 'checkbox'; c.checked = checked;
    c.onchange = function () { onChange(c.checked); };
    l.appendChild(c); l.appendChild(document.createTextNode(' ' + label)); return l;
  }

  function charSelect(playerId, cfgKey) {
    // Se la scelta corrente non è più valida (tactician in modalità fissa), ripiega su runner.
    if (!Characters.isSelectable(cfg[cfgKey], cfg.suitMode)) cfg[cfgKey] = 'runner';
    var wrap = h('div', 'cfg-row char-row');
    var isCpuSlot = cfg.opponent === 'cpucpu' || (cfg.opponent === 'cpu' && playerId === 'S');
    wrap.appendChild(h('span', 'char-who', 'Giocatore ' + playerId + (isCpuSlot ? ' (CPU)' : '') + ':'));
    var sel = h('select', 'cfg-select');
    Characters.ORDER.forEach(function (type) {
      var ch = Characters.get(type);
      var enabled = Characters.isSelectable(type, cfg.suitMode);
      var label = ch.label + ' — ' + SUIT_SYMBOL[ch.suit] + ' ' + ch.suit + (cfg.objects ? ' — ' + ch.startObject.replace('_', ' ') : '');
      var op = h('option', null, label + (enabled ? '' : ' (non disponibile)'));
      op.value = type; op.disabled = !enabled; if (cfg[cfgKey] === type) op.selected = true;
      sel.appendChild(op);
    });
    sel.onchange = function () { cfg[cfgKey] = sel.value; renderConfig(); };
    wrap.appendChild(sel);
    return wrap;
  }

  function startGame() {
    var opts = {
      suitMode: cfg.suitMode,
      modules: { characters: cfg.characters, objects: cfg.objects, powers: cfg.characters, reshuffle: cfg.reshuffle },
      reshuffleCount: cfg.reshuffleCount,
      characters: { N: cfg.charN, S: cfg.charS }
    };
    var game = window.CradleEngine.createGame(opts);
    var st = game.state;
    st.log.push('Setup: seme iniziale/di turno = ' + st.centerInitialSuit + ' · modalità ' + st.suitMode +
      ' · moduli: ' + (st.modules.characters ? 'Personaggi ' : '') + (st.modules.objects ? 'Oggetti' : '') +
      (!st.modules.characters && !st.modules.objects ? 'base' : '') + '. Primo Giocatore = ' + st.firstPlayer + '.');
    if (st.modules.characters) st.log.push('Personaggi: N=' + st.players.N.character + ' (' + st.players.N.belongingSuit + '), S=' + st.players.S.character + ' (' + st.players.S.belongingSuit + ').');

    var controller = window.CradleUI.createController(game, { mode: cfg.opponent, cpuId: 'S' });
    window.__cradle = { game: game, controller: controller };
    document.body.classList.remove('setup');
    overlay.hidden = true;
    controller.render();
  }

  renderConfig();
})();

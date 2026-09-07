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

  // Stato della configurazione.
  var cfg = { opponent: 'cpu', suitMode: 'rotating', characters: true, objects: true, powers: true, charN: 'runner', charS: 'brawler' };

  function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function renderConfig() {
    sheet.innerHTML = '';
    sheet.appendChild(h('h2', null, 'The Cradle — Configurazione partita'));

    // Avversario
    sheet.appendChild(fieldLabel('Avversario'));
    var opp = h('div', 'cfg-row');
    opp.appendChild(radio('opp', '👥 Hot Seat', cfg.opponent === '2p', function () { cfg.opponent = '2p'; }));
    opp.appendChild(radio('opp', '🤖 VS CPU', cfg.opponent === 'cpu', function () { cfg.opponent = 'cpu'; }));
    sheet.appendChild(opp);

    // Modalità seme (dropdown)
    sheet.appendChild(fieldLabel('Modalità seme'));
    var sel = h('select', 'cfg-select');
    [['fixed', 'Fisso'], ['rotating', 'Rotazione']].forEach(function (o) {
      var op = h('option', null, o[1]); op.value = o[0]; if (cfg.suitMode === o[0]) op.selected = true; sel.appendChild(op);
    });
    sel.onchange = function () { cfg.suitMode = sel.value; renderConfig(); };
    sheet.appendChild(sel);

    // Moduli
    sheet.appendChild(fieldLabel('Moduli'));
    var mods = h('div', 'cfg-row');
    mods.appendChild(checkbox('Personaggi', cfg.characters, function (v) { cfg.characters = v; renderConfig(); }));
    mods.appendChild(checkbox('Oggetti', cfg.objects, function (v) { cfg.objects = v; renderConfig(); }));
    mods.appendChild(checkbox('Poteri personaggi', cfg.powers, function (v) { cfg.powers = v; renderConfig(); }));
    sheet.appendChild(mods);
    if (cfg.powers && !cfg.characters) sheet.appendChild(h('p', 'note', 'I poteri richiedono il modulo Personaggi per avere effetto.'));

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
    wrap.appendChild(h('span', 'char-who', 'Giocatore ' + playerId + (cfg.opponent === 'cpu' && playerId === 'S' ? ' (CPU)' : '') + ':'));
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
      modules: { characters: cfg.characters, objects: cfg.objects, powers: cfg.powers },
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
    overlay.hidden = true;
    controller.render();
  }

  renderConfig();
})();

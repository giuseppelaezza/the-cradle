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
              ruleset: 'C', gridSize: 4, gridMode: 'draft', turnMode: '1221', maxRounds: 8, clashOnAttack: true, objectMode: 'select',
              // Composizione dei mazzi TOOLS: array indicizzato per slot Pilota (0..3), ogni voce è una count-map { type: copie }.
              objectDecks: [{}, {}, {}, {}],
              numPlayers: 2, chars: ['runner', 'brawler', 'tactician', 'fighter'] };

  // Icona del seme (SVG inline, colorata dal CSS come in partita).
  function suitIconEl(suit) { var w = h('span', 'suit-ic s-' + suit); if (Suits) w.innerHTML = Suits.svg(suit); return w; }
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

    // Griglia + numero di ROUND (il regolamento è unico).
    sheet.appendChild(fieldLabel('Griglia'));
    var rsRow = h('div', 'cfg-row');
    var gs = h('select', 'cfg-select');
    gs.title = 'Dimensione della griglia. 4×4: +2 sulle 4 CELLE BONUS centrali a fine TURNO, niente centro.';
    [[5, 'Griglia 5×5'], [4, 'Griglia 4×4']].forEach(function (o) {
      var op = h('option', null, o[1]); op.value = o[0]; if (cfg.gridSize === o[0]) op.selected = true; gs.appendChild(op);
    });
    gs.onchange = function () { cfg.gridSize = parseInt(gs.value, 10); renderConfig(); };
    rsRow.appendChild(gs);
    // Numero di ROUND di gioco: 7–11, default 9.
    var nr = h('select', 'cfg-select');
    nr.title = 'Numero di ROUND della partita.';
    [7, 8, 9, 10, 11].forEach(function (n) { var op = h('option', null, n + ' ROUND'); op.value = n; if (cfg.maxRounds === n) op.selected = true; nr.appendChild(op); });
    nr.onchange = function () { cfg.maxRounds = parseInt(nr.value, 10); };
    rsRow.appendChild(nr);
    // Numero di giocatori: 2/3/4, SOLO su griglia 5×5.
    if (cfg.gridSize === 5) {
      var np = h('select', 'cfg-select');
      np.title = 'Numero di giocatori (solo su griglia 5×5). Ogni PILOTA parte da un angolo.';
      [[2, '2 giocatori'], [3, '3 giocatori'], [4, '4 giocatori']].forEach(function (o) {
        var op = h('option', null, o[1]); op.value = o[0]; if (cfg.numPlayers === o[0]) op.selected = true; np.appendChild(op);
      });
      np.onchange = function () { cfg.numPlayers = parseInt(np.value, 10); renderConfig(); };
      rsRow.appendChild(np);
    }
    sheet.appendChild(rsRow);

    // TOOLS: DECK casuale o selezione manuale.
    sheet.appendChild(fieldLabel('TOOLS'));
    var objRow = h('div', 'cfg-row');
    var os = h('select', 'cfg-select');
    os.title = 'Composizione del DECK dei TOOLS.';
    [['random', 'TOOLS casuali'], ['select', 'Seleziona TOOLS']].forEach(function (o) {
      var op = h('option', null, o[1]); op.value = o[0]; if (cfg.objectMode === o[0]) op.selected = true;
      op.title = o[0] === 'random' ? 'Ogni Pilota riceve un mazzo di 4 TOOLS casuali (3 copie ciascuno).' : 'Componi tu il mazzo TOOLS di ogni Pilota (12 carte, max 3 copie per tipo).';
      os.appendChild(op);
    });
    os.onchange = function () { cfg.objectMode = os.value; renderConfig(); };
    objRow.appendChild(os);
    if (cfg.objectMode === 'select') {
      var toolsBtn = h('button', 'ghost', 'Mazzi TOOLS');
      toolsBtn.type = 'button';
      toolsBtn.title = 'Apri la composizione dei mazzi TOOLS dei Piloti.';
      toolsBtn.onclick = openToolsDialog;
      objRow.appendChild(toolsBtn);
    }
    sheet.appendChild(objRow);

    // Regole. ARM, REMIX e Clash su Attacco fanno sempre parte del regolamento:
    // qui si sceglie solo il numero di usi di REMIX e la struttura del TURNO.
    sheet.appendChild(fieldLabel('Regole'));
    var addl = h('div', 'cfg-row');
    // Numero di usi di REMIX per PILOTA in una partita.
    var rc = h('select', 'cfg-select');
    rc.title = 'Numero di usi di REMIX per PILOTA in una partita.';
    [1, 2, 3].forEach(function (n) { var op = h('option', null, n + ' REMIX'); op.value = n; if (cfg.reshuffleCount === n) op.selected = true; rc.appendChild(op); });
    rc.onchange = function () { cfg.reshuffleCount = parseInt(rc.value, 10); };
    addl.appendChild(rc);
    // Struttura del TURNO: ordine delle fasi di MOVIMENTO e ATTACCO.
    var ts = h('select', 'cfg-select');
    ts.title = 'Ordine delle fasi di MOVIMENTO e ATTACCO nel TURNO.';
    [['1221', 'Turno 1-2-2-1'], ['1212', 'Turno 1-2-1-2']].forEach(function (o) {
      var op = h('option', null, o[1]); op.value = o[0]; if (cfg.turnMode === o[0]) op.selected = true; ts.appendChild(op);
    });
    ts.onchange = function () { cfg.turnMode = ts.value; renderConfig(); };
    addl.appendChild(ts);
    // Modalità griglia: Draft (i PILOTI la costruiscono) o Random (generata a caso).
    var gm = h('select', 'cfg-select');
    gm.title = 'Come si forma la griglia: Draft (i PILOTI la costruiscono a turno) o Random (generata a caso).';
    [['random', 'Griglia Random'], ['draft', 'Griglia Draft']].forEach(function (o) {
      var op = h('option', null, o[1]); op.value = o[0]; if (cfg.gridMode === o[0]) op.selected = true; gm.appendChild(op);
    });
    gm.onchange = function () { cfg.gridMode = gm.value; renderConfig(); };
    addl.appendChild(gm);
    sheet.appendChild(addl);
    sheet.appendChild(h('p', 'cfg-desc', cfg.gridMode === 'draft'
      ? 'Draft: prima si determina il 1° Pilota, poi a turno (Piazzamento) ognuno pesca 4 carte, ne piazza 2 sulla griglia e scarta le altre. A griglia piena inizia la partita.'
      : (cfg.turnMode === '1212'
        ? 'Struttura del TURNO: DEPLOY → MOVIMENTO G1 → MOVIMENTO G2 → ATTACCO G1 → ATTACCO G2 → Fine ROUND.'
        : 'Struttura del TURNO: DEPLOY → MOVIMENTO G1 → MOVIMENTO G2 → ATTACCO G2 → ATTACCO G1 → Fine ROUND.')));

    // Scelta ARM (sempre parte del regolamento): uno slot per Pilota.
    sheet.appendChild(fieldLabel('ARM'));
    var effNP = cfg.gridSize === 5 ? cfg.numPlayers : 2;
    for (var sidx = 0; sidx < effNP; sidx++) sheet.appendChild(charSelect(sidx));

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
      rulesBtn.title = 'Mostra il Regolamento.';
      rulesBtn.onclick = function () { if (window.CradleUI && window.CradleUI.openRulesDialog) window.CradleUI.openRulesDialog('C'); };
    }
    rulesBtn.textContent = '📖 Regolamento';
    if (rulesBtn.parentNode !== overlay) overlay.appendChild(rulesBtn);
  }

  function fieldLabel(t) { return h('div', 'cfg-label', t); }

  function radio(name, label, checked, onSel, title) {
    var l = h('label', 'cfg-opt'); if (title) l.title = title;
    var r = document.createElement('input'); r.type = 'radio'; r.name = name; r.checked = checked;
    r.onchange = function () { if (r.checked) onSel(); };
    l.appendChild(r); l.appendChild(document.createTextNode(' ' + label)); return l;
  }

  // Selettore ARM per lo slot (0-based) "Pilota N". In VS CPU solo il Pilota 1 è umano.
  function charSelect(slot) {
    var box = h('div', 'char-block');
    var isCpuSlot = cfg.opponent === 'cpucpu' || (cfg.opponent === 'cpu' && slot > 0);
    box.appendChild(h('div', 'char-who', 'Pilota ' + (slot + 1) + (isCpuSlot ? ' — CPU' : (cfg.opponent === '2p' ? '' : ' — Tu'))));
    var sel = h('select', 'cfg-select char-select');
    sel.title = 'Scegli l\'ARM.';
    var cur = cfg.chars[slot] || 'random';
    var rop = h('option', null, 'Random'); rop.value = 'random'; if (cur === 'random') rop.selected = true; sel.appendChild(rop);
    Characters.ORDER.forEach(function (type) {
      var ch = Characters.get(type);
      var op = h('option', null, ch.label); op.value = type; if (cur === type) op.selected = true;
      sel.appendChild(op);
    });
    sel.onchange = function () { cfg.chars[slot] = sel.value; renderConfig(); };
    box.appendChild(sel);
    box.appendChild(charDescription(cur));
    return box;
  }

  // Etichetta della fase di un TOOL (DEPLOY / MOVIMENTO / ATTACCO).
  function objPhaseTextCfg(type) {
    var def = Objects && Objects.def(type);
    return def ? def.phaseLabel : '';
  }
  // Descrizione compatta dell'ARM: 3 riquadri uguali (ARM SUIT, TOOL, SKILL) con tooltip.
  function charDescription(type) {
    var d = h('div', 'char-desc');
    if (type === 'random') { d.appendChild(h('div', 'cd-random', 'ARM scelto casualmente a inizio partita.')); return d; }
    var ch = Characters.get(type); if (!ch) return d;
    // ARM SUIT (dentro un chip, così i 3 riquadri sono uguali)
    var semeBox = h('div', 'cd-box');
    semeBox.appendChild(h('div', 'cd-label', 'ARM SUIT'));
    var semeChip = h('div', 'cd-chip cd-seme-chip');
    var ic = suitIconEl(ch.suit); ic.classList.add('cd-suit'); semeChip.appendChild(ic);
    semeChip.appendChild(h('span', 'cd-chip-name', SUIT_LABEL[ch.suit]));
    attachTip(semeChip, 'ARM SUIT: ' + SUIT_LABEL[ch.suit] + ' (funziona come una GLOBAL SUIT personale e fissa).');
    semeBox.appendChild(semeChip); d.appendChild(semeBox);
    // SKILL (nome + numero di usi, con tooltip descrizione)
    var abBox = h('div', 'cd-box');
    abBox.appendChild(h('div', 'cd-label', 'SKILL'));
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

  // ---- Tooltip "scheda TOOL" (uguale a quello in partita), posizionato via JS ----
  var cardTipEl = null;
  function attachCardTip(el, type) {
    el.addEventListener('mouseenter', function () { showCardTip(el, type); });
    el.addEventListener('mouseleave', hideCardTip);
  }
  function showCardTip(el, type) {
    var UI = window.CradleUI;
    if (!cardTipEl || !cardTipEl.isConnected) { cardTipEl = h('div', 'tooltip card-tip'); document.body.appendChild(cardTipEl); }
    cardTipEl.innerHTML = ''; cardTipEl.appendChild(UI.objectCardEl(type));
    cardTipEl.style.display = 'block'; cardTipEl.style.visibility = 'hidden'; cardTipEl.style.left = '0'; cardTipEl.style.top = '0';
    var r = el.getBoundingClientRect(), tw = cardTipEl.offsetWidth, th = cardTipEl.offsetHeight;
    var left = Math.min(Math.max(8, r.right + 8), Math.max(8, window.innerWidth - tw - 8));
    if (r.right + 8 + tw > window.innerWidth) left = Math.max(8, r.left - tw - 8);
    var top = Math.min(Math.max(8, r.top), window.innerHeight - th - 8);
    cardTipEl.style.left = left + 'px'; cardTipEl.style.top = top + 'px'; cardTipEl.style.visibility = '';
  }
  function hideCardTip() { if (cardTipEl) cardTipEl.style.display = 'none'; }

  // Etichette dei filtri fase → chiave interna del TOOL.
  var PHASE_TAGS = [['select', 'DEPLOY'], ['move', 'MOVIMENTO'], ['attack', 'ATTACCO']];

  // Schermata "Componi mazzi TOOLS": un mazzo personale per Pilota (12 carte, max 3 copie per tipo).
  function openToolsDialog() {
    var OBJ = window.CradleObjects, UI = window.CradleUI;
    var effNP = cfg.gridSize === 5 ? cfg.numPlayers : 2;
    var DECK_SIZE = OBJ.TOOL_DECK_SIZE, MAX = OBJ.TOOL_MAX_COPIES;
    var pool = OBJ.selectablePool(cfg.ruleset);
    var cur = 0;               // slot Pilota corrente
    var phaseFilter = null;    // null = tutte, altrimenti 'select'|'move'|'attack'

    function specOf(slot) { if (!cfg.objectDecks[slot]) cfg.objectDecks[slot] = {}; return cfg.objectDecks[slot]; }
    function total(slot) { return OBJ.specTotal(specOf(slot)); }
    function isFull(slot) { return total(slot) >= DECK_SIZE; }
    function allComplete() { for (var i = 0; i < effNP; i++) if (total(i) !== DECK_SIZE) return false; return true; }

    var back = h('div', 'dialog-back');
    var box = h('div', 'dialog tools-dialog');

    // Intestazione: titolo + tab dei Piloti + chiudi.
    var head = h('div', 'rules-head tools-head');
    head.appendChild(h('h2', null, 'Tools'));
    var tabs = h('div', 'tools-tabs');
    var x = h('button', 'rules-x', '✕'); x.title = 'Chiudi';
    head.appendChild(tabs); head.appendChild(x); box.appendChild(head);

    // Corpo: colonna mazzo (sinistra, fixed) + griglia carte (destra, scrollabile).
    var body = h('div', 'tools-body');
    var deckCol = h('div', 'tools-deck-col');
    var deckHead = h('div', 'tools-deck-head');
    var deckTitle = h('div', 'tools-deck-title');
    var deckCount = h('span', 'tools-deck-count');
    deckHead.appendChild(deckTitle); deckHead.appendChild(deckCount);
    var deckList = h('div', 'tools-deck-list');
    var fillBtn = h('button', 'ghost tools-fill', 'Fill');
    fillBtn.title = 'Riempi gli slot vuoti con il minor numero possibile di TOOLS casuali (max copie).';
    deckCol.appendChild(deckHead); deckCol.appendChild(deckList); deckCol.appendChild(fillBtn);

    var gridCol = h('div', 'tools-grid-col');
    var tagRow = h('div', 'tools-tag-row');
    var grid = h('div', 'obj-card-grid tools-card-grid');
    gridCol.appendChild(tagRow); gridCol.appendChild(grid);
    body.appendChild(deckCol); body.appendChild(gridCol);
    box.appendChild(body);

    function renderTabs() {
      tabs.innerHTML = '';
      for (var i = 0; i < effNP; i++) (function (slot) {
        var t = total(slot);
        var pill = h('button', 'tools-tab' + (slot === cur ? ' active' : '') + (t === DECK_SIZE ? ' complete' : ''));
        pill.appendChild(h('span', 'tt-name', 'G' + (slot + 1)));
        pill.appendChild(h('span', 'tt-count', t + '/' + DECK_SIZE));
        pill.onclick = function () { cur = slot; renderAll(); };
        tabs.appendChild(pill);
      })(i);
    }

    function renderDeck() {
      var spec = specOf(cur);
      deckTitle.textContent = 'Giocatore ' + (cur + 1);
      var t = total(cur);
      deckCount.textContent = t + '/' + DECK_SIZE;
      deckCount.className = 'tools-deck-count' + (t === DECK_SIZE ? ' complete' : '');
      deckList.innerHTML = '';
      var types = Object.keys(spec);
      if (!types.length) { deckList.appendChild(h('div', 'hint', 'Mazzo vuoto: aggiungi TOOLS dalla griglia.')); return; }
      // Ordina per fase poi per nome.
      types.sort(function (a, b) {
        var da = OBJ.def(a), db = OBJ.def(b);
        return (da.phaseLabel + da.label).localeCompare(db.phaseLabel + db.label);
      });
      types.forEach(function (type) {
        var d = OBJ.def(type), n = spec[type];
        var row = h('div', 'tools-deck-item');
        var name = h('span', 'tdi-name');
        name.appendChild(h('span', 'tdi-label', d ? d.label : type));
        // Fase abbreviata (D/M/A) per stare nella pillola senza overflow.
        name.appendChild(h('span', 'tdi-phase', d ? (d.phaseAbbr || d.phaseLabel) : ''));
        attachCardTip(name, type);
        row.appendChild(name);
        var ctrl = h('span', 'tdi-ctrl');
        var minus = h('button', 'tdi-btn', '−');
        minus.title = 'Riduci (a 1, elimina il TOOL).';
        minus.onclick = function () {
          spec[type] -= 1; if (spec[type] <= 0) delete spec[type];
          renderAll();
        };
        var qty = h('span', 'tdi-qty', String(n));
        var plus = h('button', 'tdi-btn', '+');
        plus.disabled = n >= MAX || isFull(cur);
        plus.title = n >= MAX ? 'Massimo 3 copie.' : (isFull(cur) ? 'Mazzo pieno.' : 'Aggiungi una copia.');
        plus.onclick = function () { if (spec[type] < MAX && !isFull(cur)) { spec[type] += 1; renderAll(); } };
        ctrl.appendChild(minus); ctrl.appendChild(qty); ctrl.appendChild(plus);
        row.appendChild(ctrl);
        // "x" cerchiata: elimina del tutto il TOOL dal mazzo (senza ridurne la quantità una alla volta).
        var del = h('button', 'tdi-del', '✕');
        del.title = 'Elimina il TOOL dal mazzo.';
        del.onclick = function () { delete spec[type]; renderAll(); };
        row.appendChild(del);
        deckList.appendChild(row);
      });
    }

    function renderTags() {
      tagRow.innerHTML = '';
      PHASE_TAGS.forEach(function (pt) {
        var tag = h('button', 'tools-tag' + (phaseFilter === pt[0] ? ' active' : ''), pt[1]);
        tag.onclick = function () { phaseFilter = (phaseFilter === pt[0]) ? null : pt[0]; renderAll(); };
        tagRow.appendChild(tag);
      });
    }

    // Tipi ordinati alfabeticamente per etichetta (per la griglia di selezione).
    var poolSorted = pool.slice().sort(function (a, b) {
      var la = (OBJ.def(a) && OBJ.def(a).label) || a, lb = (OBJ.def(b) && OBJ.def(b).label) || b;
      return la.localeCompare(lb);
    });
    function renderGrid() {
      grid.innerHTML = '';
      var spec = specOf(cur), full = isFull(cur);
      poolSorted.forEach(function (type) {
        var d = OBJ.def(type);
        if (phaseFilter) { var ps = d.phases || [d.phase]; if (ps.indexOf(phaseFilter) === -1) return; }
        var n = spec[type] || 0;
        var card = UI.objectCardEl(type, { selectable: true, half: true });
        if (n > 0) { card.classList.add('in-deck'); card.appendChild(h('span', 'ovc-count', '×' + n)); }
        var blocked = (n >= MAX) || full;
        if (blocked) card.classList.add('ovc-blocked');
        card.onclick = function () {
          if (n >= MAX || isFull(cur)) return;
          spec[type] = n + 1; renderAll();
        };
        grid.appendChild(card);
      });
      if (!grid.children.length) grid.appendChild(h('div', 'hint', 'Nessun TOOL per questa fase.'));
    }

    function renderAll() { renderTabs(); renderDeck(); renderTags(); renderGrid(); }

    fillBtn.onclick = function () {
      cfg.objectDecks[cur] = OBJ.fillToolDeckSpec(specOf(cur), Math.random, cfg.ruleset);
      renderAll();
    };

    function finish() { hideCardTip(); back.remove(); document.removeEventListener('keydown', onKey); renderConfig(); }
    function tryClose() {
      if (allComplete()) { finish(); return; }
      openIncompleteDialog(function () {
        // Conferma: Fill per ogni Pilota, poi chiudi.
        for (var i = 0; i < effNP; i++) cfg.objectDecks[i] = OBJ.fillToolDeckSpec(specOf(i), Math.random, cfg.ruleset);
        finish();
      });
    }
    x.onclick = tryClose;

    renderAll();
    back.appendChild(box);
    back.onclick = function (e) { if (e.target === back) tryClose(); };
    function onKey(e) { if (e.key === 'Escape') tryClose(); }
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
  }

  // Modale di conferma quando si chiude con mazzi incompleti.
  function openIncompleteDialog(onConfirm) {
    var back = h('div', 'dialog-back tools-confirm-back');
    var box = h('div', 'dialog tools-confirm');
    box.appendChild(h('h2', null, 'Mazzi TOOLS incompleti'));
    box.appendChild(h('p', 'setup-sub', 'I mazzi dei TOOLS sono incompleti, se si procede verranno aggiunte carte casuali per ottenere un mazzo completo.'));
    var foot = h('div', 'tools-foot');
    var backBtn = h('button', 'ghost', 'Indietro');
    var okBtn = h('button', 'primary', 'Conferma');
    backBtn.onclick = function () { back.remove(); };
    okBtn.onclick = function () { back.remove(); onConfirm(); };
    foot.appendChild(backBtn); foot.appendChild(okBtn); box.appendChild(foot);
    back.appendChild(box);
    back.onclick = function (e) { if (e.target === back) back.remove(); };
    document.body.appendChild(back);
  }

  // Costruisce le opzioni per createGame dalla configurazione corrente.
  function buildOpts(extra) {
    var effNP = cfg.gridSize === 5 ? cfg.numPlayers : 2;
    // In modalità "select" passa la composizione per Pilota; se vuota per un Pilota, l'engine genera un mazzo casuale.
    var useSelection = cfg.objects && cfg.objectMode === 'select';
    var objectDecks = null;
    if (useSelection) {
      objectDecks = [];
      for (var pi = 0; pi < effNP; pi++) {
        var spec = cfg.objectDecks[pi] || {};
        objectDecks[pi] = Object.keys(spec).length ? spec : null;
      }
    }
    var opts = {
      suitMode: cfg.suitMode,
      modules: { characters: cfg.characters, objects: cfg.objects, powers: cfg.characters, reshuffle: cfg.reshuffle },
      reshuffleCount: cfg.reshuffleCount,
      ruleset: cfg.ruleset,
      gridSize: cfg.ruleset === 'C' ? cfg.gridSize : 5,
      gridMode: cfg.gridMode,
      numPlayers: effNP,
      turnMode: cfg.turnMode,
      maxRounds: cfg.ruleset === 'C' ? cfg.maxRounds : 9,
      clashOnAttack: cfg.clashOnAttack,
      objectDecks: objectDecks,
      characters: cfg.chars.slice(0, effNP) // array per indice (Pilota 1..n)
    };
    if (extra) for (var k in extra) opts[k] = extra[k];
    return opts;
  }

  function startGame() {
    var opts = buildOpts();
    var game = window.CradleEngine.createGame(opts);
    var st = game.state;
    st.log.push('Setup: GLOBAL SUIT iniziale = ' + st.centerInitialSuit + ' · modalità ' + st.suitMode +
      ' · moduli: ' + (st.modules.characters ? 'ARM ' : '') + (st.modules.objects ? 'TOOLS' : '') +
      (!st.modules.characters && !st.modules.objects ? 'base' : '') + '. 1° Pilota = ' + st.firstPlayer + '.');
    if (st.modules.characters) st.log.push('ARM: ' + game.allPlayers().map(function (id) { return id + '=' + (Characters.get(st.players[id].character) || {}).label + ' (' + st.players[id].belongingSuit + ')'; }).join(', ') + '.');

    var controller = window.CradleUI.createController(game, { mode: cfg.opponent, humanId: game.allPlayers()[0],
      onRematch: startGame,      // nuova partita con le impostazioni correnti
      onBack: backToConfig });   // torna al configuratore
    window.__cradle = { game: game, controller: controller };
    document.body.classList.remove('setup');
    if (rulesBtn) rulesBtn.remove();
    overlay.hidden = true;
    controller.render();
  }

  // Dalla schermata finale: torna al configuratore (le impostazioni restano quelle correnti).
  function backToConfig() {
    if (window.__cradle && window.__cradle.controller && window.__cradle.controller.dispose) window.__cradle.controller.dispose();
    window.__cradle = null;
    renderConfig();
  }

  // ============================================================ BATCH TEST (2000 partite CPU vs CPU)
  var Engine = window.CradleEngine, Cpu = window.CradleCpu;
  function makeRng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function batchWhoActs(s, g) {
    if (s.gameOver) return null;
    if (s.subPhase === 'object-discard') return s.pendingObjectDiscard.playerId;
    if (s.subPhase === 'end-discard') return s.pendingEndDiscard.playerId;
    if (s.subPhase === 'rebuild-select' || s.subPhase === 'rebuild-place') return s.pendingRebuild.playerId;
    if (s.subPhase === 'draft-select' || s.subPhase === 'draft-place') return s.pendingDraft.playerId;
    if (s.subPhase === 'energy-target') return s.pendingEnergy.playerId;
    if (s.subPhase === 'teleport-select') return s.pendingTeleport.playerId;
    if (s.subPhase === 'endbonus-steal') return s.pendingEndBonus.playerId;
    if (s.subPhase === 'tool-discard') return s.pendingToolDiscard && s.pendingToolDiscard.playerId;
    if (s.subPhase === 'runner-figure') return s.pendingRunner && s.pendingRunner.playerId;
    if (s.subPhase === 'timebomb-suit') return s.pendingTimebomb.playerId;
    if (s.subPhase === 'elemental-target' || s.subPhase === 'elemental-suit') return s.pendingElemental.playerId;
    if (s.subPhase === 'barrage-first' || s.subPhase === 'barrage-second' || s.subPhase === 'barrage-third') return s.pendingBarrage.playerId;
    if (s.subPhase === 'randomizer-place') return s.pendingRandomizer.playerId;
    if (s.subPhase === 'tool-sacrifice') return s.pendingToolSac.playerId;
    if (s.subPhase === 'charge-select') return s.pendingCharge.playerId;
    if (s.subPhase === 'snipe-select') return s.pendingSnipe.playerId;
    if (s.subPhase === 'feedback-select') return s.pendingFeedback.playerId;
    if (s.subPhase === 'swap-target') return s.pendingSwap.playerId;
    if (s.subPhase === 'nuke-select') return s.pendingNuke.playerId;
    if (s.subPhase === 'shuffle-select') return s.pendingShuffle.playerId;
    if (s.subPhase === 'altmatch-object') return s.pendingAltMatch.playerId;
    if (s.subPhase === 'clash-cards') return g.clashCurrentChooser();
    if (s.subPhase === 'clash-reloc') return s.pendingClash.relocatorId;
    if (s.subPhase === 'forced-reloc') return s.pendingForced.chooserId;
    if (s.subPhase) return null;
    if (s.phase === 'select') { var ap = g.allPlayers(); for (var i = 0; i < ap.length; i++) if (s.selected[ap[i]] == null) return ap[i]; return null; }
    if (s.phase === 'move' || s.phase === 'attack') return s.activePlayer;
    return null;
  }
  function batchNewAcc() {
    var randomChars = cfg.chars.some(function (c) { return c === 'random'; });
    return { completed: 0, errors: 0, rounds: 0, combined: 0, winner: 0, loser: 0, margin: 0,
             ties: 0, decided: 0, startFirstWins: 0, figures: 0,
             emptyPass: 0, emptyPassMove: 0, emptyPassShoot: 0,
             objUses: {}, perChar: randomChars ? {} : null };
  }
  function batchPlay(seed, acc) {
    var effNP = cfg.gridSize === 5 ? cfg.numPlayers : 2;
    var g, s;
    // Con 2 giocatori alterniamo chi inizia; con 3-4 lo decide il motore.
    var seedOpts = { rng: makeRng(seed) };
    if (effNP === 2) seedOpts.firstPlayer = (seed % 2 === 0) ? 'N' : 'S';
    try { g = Engine.createGame(buildOpts(seedOpts)); s = g.state; }
    catch (e) { acc.errors++; return; }
    var fp0 = s.firstPlayer; // 1° Pilota iniziale (per la stat "vittorie di chi inizia")
    // Strumenta l'uso oggetti (conteggio per tipo) e segnala se un oggetto è stato usato nell'azione corrente.
    var objUsedThisAction = false;
    var origUse = g.useObject.bind(g);
    g.useObject = function (pid, oid) {
      var o = s.players[pid].objects.filter(function (x) { return x.id === oid; })[0];
      if (o) acc.objUses[o.type] = (acc.objUses[o.type] || 0) + 1;
      objUsedThisAction = true;
      return origUse.apply(null, arguments);
    };
    // "Passo a vuoto": il giocatore passa (movimento o attacco) senza abbinare né aver usato un oggetto.
    var origPassMove = g.passMove.bind(g);
    g.passMove = function () { if (!objUsedThisAction) { acc.emptyPass++; acc.emptyPassMove++; } return origPassMove.apply(null, arguments); };
    var origPassShoot = g.passShoot.bind(g);
    g.passShoot = function () { if (!objUsedThisAction) { acc.emptyPass++; acc.emptyPassShoot++; } return origPassShoot.apply(null, arguments); };
    var guard = 0;
    // Reset del flag "oggetto usato" a ogni azione consumata (actionsLeft cala) o cambio fase/turno.
    var lastPhase = s.phase, lastActions = s.actionsLeft, lastActive = s.activePlayer;
    try {
      while (!s.gameOver && guard++ < 8000) {
        var a = batchWhoActs(s, g); if (!a) break;
        Cpu.cpuAct(g, a);
        if (s.phase !== lastPhase || s.activePlayer !== lastActive || s.actionsLeft < lastActions) objUsedThisAction = false;
        lastPhase = s.phase; lastActive = s.activePlayer; lastActions = s.actionsLeft;
      }
    }
    catch (e) { acc.errors++; return; }
    if (!s.gameOver) { acc.errors++; return; }
    acc.completed++; acc.rounds += s.round;
    var ids = g.allPlayers(), scores = ids.map(function (id) { return s.players[id].score; });
    var mx = Math.max.apply(null, scores), mn = Math.min.apply(null, scores), sum = scores.reduce(function (a, b) { return a + b; }, 0);
    acc.combined += sum; acc.winner += mx; acc.loser += mn; acc.margin += (mx - mn);
    var tie = s.result.tiebreak === 'patta';
    if (tie) acc.ties++; else { acc.decided++; if (s.result.winner === fp0) acc.startFirstWins++; }
    acc.figures += ids.reduce(function (a, id) { return a + s.players[id].figuresMatched; }, 0) / ids.length;
    if (acc.perChar) ids.forEach(function (id) {
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
      ['ROUND medi', (acc.rounds / c).toFixed(2)],
      ['Punti medi totali', (acc.combined / c).toFixed(1)],
      ['Punti medi vincitore', (acc.winner / c).toFixed(1)],
      ['Punti medi perdente', (acc.loser / c).toFixed(1)],
      ['Margine medio', (acc.margin / c).toFixed(1)],
      ['Patte', (100 * acc.ties / c).toFixed(1) + '%'],
      ['Vittorie 1° Pilota (su decise)', (100 * acc.startFirstWins / dec).toFixed(1) + '% (±' + (196 * Math.sqrt(0.25 / dec)).toFixed(1) + ')'],
      ['OBIETTIVI medi / Pilota', (acc.figures / c).toFixed(2)],
      ['Passi a vuoto medi / partita', (acc.emptyPass / c).toFixed(2) + ' (mov ' + (acc.emptyPassMove / c).toFixed(2) + ' · att ' + (acc.emptyPassShoot / c).toFixed(2) + ')']
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
    var effNP = cfg.gridSize === 5 ? cfg.numPlayers : 2;
    var armList = cfg.chars.slice(0, effNP).map(function (c) { return c === 'random' ? 'Random' : (Characters.get(c) || {}).label; }).join(', ');
    return [
      ['Griglia', cfg.gridSize + '×' + cfg.gridSize],
      ['Giocatori', String(effNP)],
      ['ROUND', String(cfg.maxRounds)],
      ['ARM', armList],
      ['TOOLS', cfg.objectMode === 'select' ? 'Selezione (mazzi personali)' : 'Random'],
      ['REMIX', cfg.reshuffleCount + '/partita'],
      ['Turno', cfg.turnMode === '1212' ? '1-2-1-2' : '1-2-2-1'],
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
    if (acc.perChar) content.appendChild(collapsibleSection('ARM (win-rate)', batchCharRows(acc), false));
    content.appendChild(collapsibleSection('TOOLS (utilizzo)', batchObjRows(acc, GAMES), true));
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
    if (acc.perChar) push('ARM', batchCharRows(acc));
    push('TOOLS', batchObjRows(acc, GAMES));
    var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'cradle-batch-' + Date.now() + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  renderConfig();
})();

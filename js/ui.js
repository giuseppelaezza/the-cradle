/*
 * ui.js — Rendering + interazioni (v2).
 * Nessuna regola di gioco: interroga game.state e chiama i metodi dell'engine.
 * Gestisce info nascosta (pass-the-device), finestre oggetto, schemi di movimento,
 * grafica dei semi/figure, celle distrutte, e l'orchestrazione della CPU.
 *
 * window.CradleUI.createController(game, opts) — opts: { mode:'2p'|'cpu', cpuId:'S' }
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.CradleUI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SUIT_SYMBOL = { oro: '○', spade: '♠', bastoni: '♣', coppe: '♥' };
  var SUIT_LABEL = { oro: 'Oro', spade: 'Spade', bastoni: 'Bastoni', coppe: 'Coppe' };
  var OBJ = (typeof window !== 'undefined' && window.CradleObjects) ? window.CradleObjects : null;
  var ENG = (typeof window !== 'undefined' && window.CradleEngine) ? window.CradleEngine : null;
  var CHARS = (typeof window !== 'undefined' && window.CradleCharacters) ? window.CradleCharacters : null;
  var SUITS = (typeof window !== 'undefined' && window.CradleSuits) ? window.CradleSuits : null;
  // Colore associato a ciascun giocatore (tinte che non si confondono con i semi né tra loro).
  var PLAYER_COLOR = { N: 'var(--pN)', S: 'var(--pS)', E: 'var(--pE)', W: 'var(--pW)' };
  var PLAYER_TEXT = { N: '#1a1a1a', S: '#ffffff', E: '#1a1a1a', W: '#1a1a1a' };
  var SEAT_LABEL = { N: 'Nord', E: 'Est', S: 'Sud', W: 'Ovest' };
  // Colori leggibili su sfondo scuro per i token di carta nel log (per iniziale del SUIT).
  var LOG_SUIT_COLOR = { oro: '#f7931e', spade: '#6a6aff', coppe: '#ff5c5c', bastoni: '#33c06a' };
  var SUIT_BY_INITIAL = { O: 'oro', S: 'spade', C: 'coppe', B: 'bastoni' };
  // Preferenze di visualizzazione condivise (persistono tra partite nella stessa sessione).
  var VIEW = { showMatches: true, showLabels: false, cardDouble: false, showConditions: true, showActions: false, centerHighlight: true, showCellBonus: true };
  // Descrizione del bonus di fine ROUND per SUIT (usata nel tooltip delle CELLE della griglia).
  var END_BONUS_BY_SUIT = { oro: '+1 punto', coppe: 'pesca 1 TOOL', bastoni: 'pesca 1 carta', spade: 'togli 1 punto a un avversario' };
  // Colori RGB dei giocatori per l'overlay "Mostra azioni" (scuriti in base all'età dell'azione).
  var PLAYER_RGB = { N: [185, 138, 94], S: [160, 108, 213] };

  function el(id) { return document.getElementById(id); }
  function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function isFigureVal(v) { return v >= 8; }
  function needsDot(v) { return v === 6 || v === 9; }

  // Simbolo del seme come SVG inline (cerchio centrale colorato; bianco se inverted).
  function suitIcon(suit, inverted) {
    var w = h('span', 'suit-ic s-' + suit + (inverted ? ' inv' : ''));
    if (SUITS) w.innerHTML = SUITS.svg(suit); else w.textContent = SUIT_SYMBOL[suit];
    return w;
  }
  // Faccia di una carta unificata: doppio numero + doppio seme agli angoli (o singolo).
  // inverted = fondo colorato (figure/centro) → inchiostro/semi bianchi.
  function cardFace(card, inverted, forceDouble) {
    var f = h('div', 'cface' + ((forceDouble || VIEW.cardDouble) ? '' : ' single'));
    function numEl() { var n = h('span', 'cnum' + (needsDot(card.value) ? ' dot' : '')); n.appendChild(h('span', 'cn', String(card.value))); return n; }
    var tl = h('div', 'corner tl'); tl.appendChild(numEl());
    var tr = h('div', 'corner tr'); tr.appendChild(suitIcon(card.suit, inverted));
    var br = h('div', 'corner br'); br.appendChild(numEl());
    var bl = h('div', 'corner bl'); bl.appendChild(suitIcon(card.suit, inverted));
    f.appendChild(tl); f.appendChild(tr); f.appendChild(br); f.appendChild(bl);
    return f;
  }
  // Indicatore usi rimasti (rettangoli stondati: pieni = disponibili, vuoti = usati), colore del giocatore.
  function usesDots(total, left, playerId, extraCls) {
    var d = h('div', 'uses-dots' + (extraCls ? ' ' + extraCls : ''));
    for (var i = 0; i < total; i++) {
      var dot = h('span', 'uses-dot' + (i < left ? ' on' : ''));
      if (playerId && PLAYER_COLOR[playerId]) dot.style.setProperty('--rc', PLAYER_COLOR[playerId]);
      dot.title = (i < left ? 'disponibile' : 'usato');
      d.appendChild(dot);
    }
    return d;
  }

  // Schema di movimento per jetpack (3×3) / jump (5×5) — usato nei tooltip e nelle card oggetto.
  function moveSchema(type) {
    var wrap = h('div', 'schema ' + type);
    if (type === 'jetpack') {
      for (var i = 0; i < 9; i++) { var c = h('span', 'sq' + (i === 4 ? ' center' : ' on')); wrap.appendChild(c); }
    } else {
      var on = { '3,1': 1, '5,3': 1, '3,5': 1, '1,3': 1, '3,3': 2 };
      for (var y = 1; y <= 5; y++) for (var x = 1; x <= 5; x++) {
        var k = x + ',' + y; var cls = 'sq'; if (on[k] === 1) cls += ' on'; if (on[k] === 2) cls += ' center'; wrap.appendChild(h('span', cls));
      }
    }
    return wrap;
  }

  // Card di un oggetto: rettangolo stondato a dimensione fissa (scrollabile) con nome, costo (se presente),
  // effetto e — per jetpack/jump — lo schema di abbinamento. `opts.selectable`/`opts.selected` per il dialog Tools.
  function objectCardEl(type, opts) {
    opts = opts || {};
    var def = OBJ ? OBJ.def(type) : null;
    var card = h('div', 'obj-vcard' + (opts.selectable ? ' selectable' : '') + (opts.selected ? ' selected' : ''));
    card.appendChild(h('div', 'ovc-name', def ? def.label : type));
    var phase = h('div', 'ovc-phase');
    phase.appendChild(h('span', 'ovc-lbl', 'Fase'));
    phase.appendChild(h('span', 'ovc-val', def ? def.phaseLabel : ''));
    card.appendChild(phase);
    if (def && def.cost) {
      var cost = h('div', 'ovc-cost');
      cost.appendChild(h('span', 'ovc-lbl', 'Costo'));
      cost.appendChild(h('span', 'ovc-val', def.cost));
      card.appendChild(cost);
    }
    card.appendChild(h('div', 'ovc-effect', def ? def.effect : type));
    return card;
  }

  // Etichetta ABBREVIATA della fase di un TOOL per le schede: D / M / A (combinazioni con "/").
  function objPhaseText(type) {
    var def = OBJ ? OBJ.def(type) : null;
    return def ? (def.phaseAbbr || def.phaseLabel) : '';
  }

  // Tasto "conferma" colorato col colore del giocatore (come la barra delle fasi del turno).
  function confirmBtn(label, playerId) {
    var b = h('button', 'primary btn-confirm', label);
    if (playerId && PLAYER_COLOR[playerId]) { b.style.background = PLAYER_COLOR[playerId]; b.style.color = PLAYER_TEXT[playerId]; b.style.borderColor = PLAYER_COLOR[playerId]; }
    return b;
  }

  // Renderer Markdown minimale per il regolamento (titoli, grassetto/codice inline, tabelle,
  // liste, citazioni, righe orizzontali, blocchi di codice).
  function mdEsc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function mdInline(t) {
    return mdEsc(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  function mdRow(line) { return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); }); }
  function mdToHtml(md) {
    var lines = (md || '').replace(/\r\n/g, '\n').split('\n'), out = [], i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (/^```/.test(line)) { var buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; } i++; out.push('<pre class="md-code">' + mdEsc(buf.join('\n')) + '</pre>'); continue; }
      if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1])) {
        var header = mdRow(line); i += 2; var rows = [];
        while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim() !== '') { rows.push(mdRow(lines[i])); i++; }
        var t = '<table class="md-table"><thead><tr>' + header.map(function (c) { return '<th>' + mdInline(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
        rows.forEach(function (r) { t += '<tr>' + r.map(function (c) { return '<td>' + mdInline(c) + '</td>'; }).join('') + '</tr>'; });
        out.push(t + '</tbody></table>'); continue;
      }
      var hm = /^(#{1,6})\s+(.*)$/.exec(line);
      if (hm) { out.push('<h' + hm[1].length + '>' + mdInline(hm[2]) + '</h' + hm[1].length + '>'); i++; continue; }
      if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
      if (/^>\s?/.test(line)) { var qb = []; while (i < lines.length && /^>\s?/.test(lines[i])) { qb.push(lines[i].replace(/^>\s?/, '')); i++; } out.push('<blockquote>' + mdInline(qb.join(' ')) + '</blockquote>'); continue; }
      if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
        var ordered = /^\s*\d+\./.test(line), items = [];
        while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '')); i++; }
        out.push('<' + (ordered ? 'ol' : 'ul') + '>' + items.map(function (it) { return '<li>' + mdInline(it) + '</li>'; }).join('') + '</' + (ordered ? 'ol' : 'ul') + '>'); continue;
      }
      if (line.trim() === '') { i++; continue; }
      var p = [line]; i++;
      while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,6}\s|```|---+\s*$|>|\s*([-*]|\d+\.)\s|\|)/.test(lines[i])) { p.push(lines[i]); i++; }
      out.push('<p>' + mdInline(p.join(' ')) + '</p>');
    }
    return out.join('\n');
  }

  // Dialog scrollabile del regolamento (markdown → HTML). A livello di modulo così è riusabile
  // sia in partita sia dalla schermata di configurazione. `ruleset` = 'A' | 'B'.
  function openRulesDialog(ruleset) {
    var reg = (typeof window !== 'undefined' && window.CradleRegolamento) || {};
    var md = reg.C || reg.B || reg.A || '# Regolamento non disponibile';
    var back = h('div', 'dialog-back');
    var box = h('div', 'dialog rules-dialog');
    var head = h('div', 'rules-head');
    head.appendChild(h('h2', null, 'Regolamento'));
    var x = h('button', 'rules-x', '✕'); x.title = 'Chiudi';
    var close = function () { back.remove(); document.removeEventListener('keydown', onKey); };
    x.onclick = close;
    head.appendChild(x);
    box.appendChild(head);
    var content = h('div', 'rules-content');
    content.innerHTML = mdToHtml(md);
    box.appendChild(content);
    back.appendChild(box);
    back.onclick = function (e) { if (e.target === back) close(); };
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
  }

  function createController(game, opts) {
    opts = opts || {};
    // VS CPU: l'umano controlla UN solo PILOTA (Pilota 1 = primo seggio); gli altri sono CPU.
    var humanId = opts.humanId || (game.allPlayers ? game.allPlayers()[0] : 'N');
    var ui = {
      mode: opts.mode || '2p', humanId: humanId,
      cpuTimer: null, gate: null, chosen: [], selectingPlayer: null, clashChooser: null, armedCardId: null,
      reshuffleMode: null, reshuffleSel: [], // scelta carte da scartare per il reshuffle
      // stato per le animazioni (diff tra render)
      lastPawns: null, lastFaceDown: null, lastRound: null, pendingShot: null, flashingEnd: false, tlSegs: null,
      actionH: null, needFit: true // altezza fissa del pannello azione + flag "ricalcola griglia"
    };
    function isCpu(id) { return ui.mode === 'cpucpu' || (ui.mode === 'cpu' && id !== ui.humanId); }

    var dom = {
      hud: el('hud'), board: el('board'), sideTop: el('sideTop'), sideBottom: el('sideBottom'),
      action: el('action'), log: el('log'), overlay: el('overlay'), sheet: el('sheet'),
      timeline: el('timeline'), piles: el('piles'), objectPiles: el('objectPiles')
    };

    // ============================================================ RENDER
    // La griglia viene ridimensionata SOLO al primo render e ai resize della finestra (mai tra le fasi).
    function render() {
      detectClash();
      detectTacticianPeek();
      renderBody();
      lockActionHeight();
      // La griglia si adatta solo al primo layout utile (e ai resize): non cambia tra le fasi.
      if (ui.needFit) { fitLayout(); if (ui.actionH) ui.needFit = false; }
      renderClashModal();
      renderTacticianModal();
      renderToolChoiceModal(game.state);
      postRenderAnimations(); renderActionsOverlay(); scheduleCpu();
    }
    // Quando un clash si risolve (nuovo token), mostra la finestra di confronto (tranne in CPU vs CPU,
    // dove bloccherebbe la dimostrazione; il log riporta comunque il risultato).
    function detectClash() {
      var r = game._clashResult;
      if (!r || r.token === ui.shownClashToken) return;
      ui.shownClashToken = r.token;
      if (ui.mode !== 'cpucpu') ui.clashModal = r;
    }
    // Tactician: quando guarda la riserva avversaria (nuovo token), mostra un modale con quelle carte.
    function detectTacticianPeek() {
      var r = game._tacticianPeek;
      if (!r || r.token === ui.shownPeekToken) return;
      ui.shownPeekToken = r.token;
      if (ui.mode !== 'cpucpu') ui.peekModal = r;
    }
    // Blocca l'altezza del pannello azione a quella della fase di SCELTA CARTE (umano),
    // così non cambia tra le fasi. Rimisura il riferimento quando la mano è mostrata in scelta carte.
    function lockActionHeight() {
      var s = game.state;
      if (!s.gameOver && !ui.gate && !s.subPhase && s.phase === 'select' && dom.action.querySelector('.act-hand')) {
        dom.action.style.minHeight = '';
        ui.actionH = Math.ceil(dom.action.getBoundingClientRect().height);
      }
      dom.action.style.minHeight = ui.actionH ? (ui.actionH + 'px') : '';
    }
    // Al resize della finestra: ridimensiona la griglia e ri-blocca l'altezza del pannello.
    var _resizeT = null;
    window.addEventListener('resize', function () {
      if (_resizeT) clearTimeout(_resizeT);
      _resizeT = setTimeout(function () { ui.needFit = true; render(); }, 120);
    });

    function renderBody() {
      var s = game.state;
      renderHud(s); renderBoard(s); renderPiles(s); renderObjectPiles(s); renderTimeline(s); renderLog(s);
      if (s.gameOver) { renderFinal(s); return; }
      hideOverlay();
      if (ui.gate) { renderGate(); return; }
      renderActionArea(s);
    }

    // ---- HUD ----
    function renderHud(s) {
      dom.hud.innerHTML = '';
      var top = h('div', 'hud-top');
      top.appendChild(pill('Round', s.phase === 'draft' ? 'Draft' : (s.round + '/' + (s.maxRounds || 9))));
      top.appendChild(pill('Turno', s.gameOver ? '—' : s.activePlayer));
      // Seme di turno: etichetta colorata + icona del seme.
      var sp = h('span', 'pill'); sp.appendChild(document.createTextNode('GLOBAL SUIT: '));
      var suitB = h('b', 'suit-' + s.currentSuit, SUIT_LABEL[s.currentSuit] + ' '); sp.appendChild(suitB);
      sp.appendChild(suitIcon(s.currentSuit));
      top.appendChild(sp);
      if (s.suitMode === 'rotating') top.appendChild(suitSequence(s.currentSuit));
      var spacer = h('div', 'spacer'); top.appendChild(spacer);
      var undo = h('button', 'ghost', '↶ Annulla');
      undo.disabled = !game.canUndo();
      undo.onclick = doUndo;
      top.appendChild(undo);
      var reset = h('button', 'ghost', '↺ Nuova partita');
      reset.onclick = function () { location.reload(); };
      top.appendChild(reset);
      var opts = h('button', 'ghost', '⚙️ Opzioni');
      opts.onclick = openOptionsDialog;
      top.appendChild(opts);
      var rules = h('button', 'ghost', '📖 Regolamento');
      rules.onclick = function () { openRulesDialog('C'); };
      top.appendChild(rules);
      dom.hud.appendChild(top);

      var pl = h('div', 'players' + (game.allPlayers().length > 2 ? ' players-multi' : ''));
      game.allPlayers().forEach(function (id) { pl.appendChild(playerCard(s, id)); });
      dom.hud.appendChild(pl);
    }

    function phaseLabel(s) {
      var base = { select: 'DEPLOY', move: 'MOVIMENTO', attack: 'ATTACCO', end: 'Fine' }[s.phase];
      if (s.subPhase === 'object-window') return 'Uso TOOL (' + s.window.phase + ')';
      if (s.subPhase === 'clash-cards') return 'CLASH — carta';
      if (s.subPhase === 'clash-reloc') return 'CLASH — ricollocazione';
      if (s.subPhase === 'forced-reloc') return 'Spostamento forzato';
      if (s.subPhase === 'object-discard') return 'Scarto TOOL';
      if (s.subPhase === 'end-discard') return 'Scarto fine TURNO';
      if (s.subPhase === 'rebuild-select' || s.subPhase === 'rebuild-place') return 'Ricostruisci';
      if (s.subPhase === 'timebomb-suit') return 'Cronobomba';
      return base;
    }

    function pill(label, val) { var p = h('span', 'pill'); p.appendChild(document.createTextNode(label + ': ')); p.appendChild(h('b', null, val)); return p; }

    function suitSequence(current) {
      var wrap = h('span', 'pill seq');
      ['oro', 'spade', 'coppe', 'bastoni'].forEach(function (su, i) {
        if (i) wrap.appendChild(h('span', 'seq-arrow', '→'));
        // Seme corrente: pallino pieno del colore del seme + simbolo bianco (inv).
        var b = suitIcon(su, su === current); b.classList.add('seq-suit'); if (su === current) b.classList.add('cur');
        wrap.appendChild(b);
      });
      return wrap;
    }

    function playerCard(s, id) {
      var p = s.players[id];
      var card = h('div', 'pcard' + (!s.gameOver && s.activePlayer === id ? ' active' : ''));

      // Banda verticale "first player" a sinistra (evidenziata per il Primo Giocatore).
      var band = h('div', 'pc-first' + (s.firstPlayer === id ? ' on' : ''));
      // Il testo verticale va in uno span interno: così il flex item non ricalcola la sua dimensione
      // ai repaint (es. quando compare un tooltip), evitando il "salto" del segnalino Primo Giocatore.
      if (s.firstPlayer === id) band.appendChild(h('span', 'pc-first-txt', '1° Pilota'));
      card.appendChild(band);

      var body = h('div', 'pc-body');

      // ---- Riga superiore: identità (seme · nome · personaggio) come "pill", poi statistiche ----
      var top = h('div', 'pc-top');
      var ident = h('div', 'pc-ident');
      // Seme di appartenenza (pill colorata col seme).
      var seed = h('span', 'pc-chip pc-seed-chip' + (p.belongingSuit ? ' bg-' + p.belongingSuit : ' empty'));
      if (p.belongingSuit) { seed.appendChild(suitIcon(p.belongingSuit, true)); seed.title = 'ARM SUIT: ' + SUIT_LABEL[p.belongingSuit]; }
      else seed.textContent = '—';
      ident.appendChild(seed);
      // Nome giocatore (pill), con un pallino del colore-giocatore.
      var nameChip = h('span', 'pc-chip pc-name-chip');
      var pdot = h('span', 'pc-player-dot'); pdot.style.background = PLAYER_COLOR[id] || '#888'; nameChip.appendChild(pdot);
      nameChip.appendChild(document.createTextNode('Pilota ' + id + ' (' + (SEAT_LABEL[id] || id) + ')'));
      ident.appendChild(nameChip);
      // Personaggio (pill con tooltip del potere + eventuali usi).
      if (p.character) {
        var chChip = h('span', 'pc-chip pc-char-chip');
        chChip.appendChild(h('span', 'pc-char-name', charLabel(p.character)));
        if (s.modules.powers && p.character === 'tactician') chChip.appendChild(usesDots(p.tacticianTotal, p.tacticianLeft, id, 'pc-uses'));
        if (s.modules.powers && p.character === 'brawler') chChip.appendChild(usesDots(p.brawlerTotal, p.brawlerLeft, id, 'pc-uses'));
        if (s.modules.powers && p.character === 'runner') chChip.appendChild(usesDots(p.runnerTotal, p.runnerLeft, id, 'pc-uses'));
        if (s.modules.powers) { chChip.appendChild(h('span', 'tooltip', characterPowerDesc(p.character))); bindTip(chChip); }
        ident.appendChild(chChip);
      }
      if (isCpu(id)) ident.appendChild(h('span', 'pc-chip pc-cpu-chip', 'CPU'));
      top.appendChild(ident);

      var stats = h('div', 'pc-stats');
      var st1 = h('div', 'pc-stat'); st1.appendChild(h('span', 'pc-num', String(p.score)));
      // Ruleset C: anteprima (accanto al numero) dei punti che la posizione della pedina darà a fine turno.
      var pend = pendingPositionBonus(s, id);
      if (pend > 0) { var pb = h('span', 'pc-pending', ' (+' + pend + ')'); pb.title = 'Punti a fine TURNO per la posizione dell\'ARM'; st1.appendChild(pb); }
      st1.appendChild(h('span', 'pc-unit', ' punti'));
      var st2 = h('div', 'pc-stat'); st2.appendChild(h('span', 'pc-num', String(p.trophies.length))); st2.appendChild(h('span', 'pc-unit', ' trofei'));
      st2.title = 'OBIETTIVI ' + p.figuresMatched + (p.matchedCenter ? ' · ★ Centro' : '');
      stats.appendChild(st1); stats.appendChild(st2);
      if (s.modules.reshuffle) {
        var rr = h('div', 'pc-reshuffle');
        rr.appendChild(h('span', 'pc-reshuffle-lbl', 'REMIX'));
        rr.appendChild(usesDots(p.reshuffleTotal, p.reshuffleLeft, id, 'pc-uses'));
        stats.appendChild(rr);
      }
      top.appendChild(stats);
      body.appendChild(top);

      // ---- Riga inferiore: hand | tools ----
      var bottom = h('div', 'pc-bottom');
      // hand (carte scelte pubbliche: sempre tutte e 3, quelle usate sbarrate).
      // Con 3-4 giocatori le schede sono strette: mostra token compatti (es. 7B, 5O) colorati per SUIT.
      var compact = game.allPlayers().length > 2;
      var handCell = h('div', 'pc-cell pc-hand' + (compact ? ' pc-hand-compact' : ''));
      if (p.revealedCards && p.revealedCards.length) p.revealedCards.forEach(function (c) {
        if (!c) return;
        var used = !p.hand.some(function (x) { return x.id === c.id; });
        var mc = compact ? cardToken(c, used) : miniCard(c, used);
        // Hover sulle carte in anteprima: evidenzia gli abbinamenti del PROPRIETARIO della carta.
        if (!used) {
          (function (cc) { mc.onmouseenter = function () { highlightMatches(id, cc); }; mc.onmouseleave = clearMatchHints; })(c);
          attachConditionTip(mc, id, c);
        }
        handCell.appendChild(mc);
      });
      else handCell.appendChild(h('span', 'muted', '—'));
      bottom.appendChild(handCell);
      // tools (oggetti posseduti, con tooltip)
      var toolsCell = h('div', 'pc-cell pc-tools');
      if (s.modules.objects && p.objects.length) objectChips(s, id, toolsCell);
      else toolsCell.appendChild(h('span', 'muted', '—'));
      bottom.appendChild(toolsCell);
      body.appendChild(bottom);

      card.appendChild(body);
      return card;
    }

    function characterPowerDesc(type) { var c = CHARS ? CHARS.get(type) : null; return (c && c.power) ? c.power : type; }
    function charLabel(type) { var c = CHARS ? CHARS.get(type) : null; return (c && c.label) ? c.label : type; }

    function chosenStrip(p) {
      var wrap = h('div', 'chosen');
      wrap.appendChild(h('span', 'lbl', 'Scelte:'));
      p.revealedCards.forEach(function (c) {
        if (!c) return;
        var used = !p.hand.some(function (x) { return x.id === c.id; });
        wrap.appendChild(miniCard(c, used));
      });
      return wrap;
    }

    function miniCard(c, used) {
      var inv = isFigureVal(c.value);
      var m = h('span', 'mini' + (inv ? ' inv suit-bg-' + c.suit : ' suit-' + c.suit) + (used ? ' used' : ''));
      m.appendChild(cardFace(c, inv));
      return m;
    }
    // Token compatto (es. "7B") colorato per SUIT, come nel log del clash. Usato con 3-4 giocatori.
    function cardToken(c, used) {
      var t = h('span', 'card-token suit-' + c.suit + (used ? ' used' : ''));
      t.textContent = c.value + c.suit[0].toUpperCase();
      return t;
    }
    // Carta di anteprima a grandezza mano (per il dialog Opzioni).
    function bigPreviewCard(c) {
      var inv = isFigureVal(c.value);
      var card = h('div', 'card' + (inv ? ' inv suit-bg-' + c.suit : ''));
      card.appendChild(cardFace(c, inv));
      return card;
    }
    // Carta grande e leggibile per rivelare una carta coperta (tooltip): sempre doppio numero+seme.
    function revealCard(c) {
      var inv = isFigureVal(c.value);
      var card = h('div', 'card reveal-card' + (inv ? ' inv suit-bg-' + c.suit : ''));
      card.appendChild(cardFace(c, inv, true));
      return card;
    }

    // Chip degli oggetti posseduti (con tooltip), inseriti in `container`.
    function objectChips(s, id, container) {
      var usable = game.usableObjects(id).map(function (o) { return o.id; });
      s.players[id].objects.forEach(function (o) {
        var def = OBJ ? OBJ.def(o.type) : null;
        var box = h('span', 'obj' + (o.fromCharacter ? ' init' : '') + (usable.indexOf(o.id) !== -1 ? ' usable' : ''));
        box.appendChild(h('span', 'obj-name', def ? def.label : o.type));
        var tip = h('span', 'tooltip', def ? def.desc : o.type);
        box.appendChild(tip);
        container.appendChild(box); bindTip(box);
      });
    }

    // Celle "bersaglio" evidenziabili per i flussi oggetto e per il brawler.
    function pickCells(s) {
      if (s.subPhase === 'draft-place') return game.draftTargets();
      if (s.subPhase === 'teleport-select') return game.teleportTargets();
      if (s.subPhase === 'rebuild-place') return game.rebuildTargets();
      if (s.subPhase === 'elemental-target') return game.elementalTargetOptions();
      if (s.subPhase === 'barrage-first') return game.barrageFirstOptions();
      if (s.subPhase === 'barrage-second') return game.barrageSecondOptions();
      if (s.subPhase === 'barrage-third') return game.barrageThirdOptions();
      if (s.subPhase === 'randomizer-select') return game.randomizerSelectOptions();
      if (!s.subPhase && ui.brawlerMode && (s.phase === 'move' || s.phase === 'attack')) return game.brawlerTargets(s.activePlayer);
      return [];
    }

    // ---- Board ----
    function renderBoard(s) {
      dom.sideTop.textContent = VIEW.showLabels ? 'Nord' : '';
      dom.sideBottom.textContent = VIEW.showLabels ? 'Sud' : '';
      dom.board.innerHTML = '';
      var N = s.gridSize || 5;
      // Ruleset C: outline che evidenzia il centro (5×5) o le celle bonus (4×4). Opzione attivabile.
      var centerHL = s.ruleset === 'C' && VIEW.centerHighlight;
      dom.board.className = 'grid size-' + N + (s.ruleset === 'C' ? ' ruleset-c' : '') + (centerHL ? ' center-hl-on' : '');
      dom.board.style.gridTemplateColumns = 'repeat(' + N + ', var(--cell))';
      dom.board.style.gridTemplateRows = 'repeat(' + N + ', var(--cell))';
      var selectable = currentSelectableCells(s);
      var relocKeys = {}, pick = {}, chosenKeys = {}, dropKeys = {};
      if (s.subPhase === 'clash-reloc' || s.subPhase === 'forced-reloc') game.relocationOptions().forEach(function (o) { relocKeys[o.key] = true; });
      pickCells(s).forEach(function (o) { pick[o.key] = true; });
      if (s.subPhase === 'randomizer-select') s.pendingRandomizer.chosen.forEach(function (o) { chosenKeys[o.key] = true; });
      if ((s.subPhase === 'barrage-second' || s.subPhase === 'barrage-third') && s.pendingBarrage) {
        [s.pendingBarrage.first, s.pendingBarrage.second].forEach(function (c) { if (c) chosenKeys[c.x + ',' + c.y] = true; });
      }
      var rz = s.subPhase === 'randomizer-place' ? s.pendingRandomizer : null;
      if (rz) rz.chosen.forEach(function (o) { if (!rz.placed[o.key]) dropKeys[o.key] = true; });
      // Tooltip sulle CELLE: condizioni di MATCH (turno umano di mov/attacco) e/o bonus di fine ROUND.
      var condTipOn = !s.gameOver && !ui.gate && !s.subPhase && (s.phase === 'move' || s.phase === 'attack') && !isCpu(s.activePlayer);
      var cellTipOn = (condTipOn && VIEW.showConditions) || (VIEW.showCellBonus && !s.gameOver && !ui.gate);

      for (var y = 1; y <= N; y++) for (var x = 1; x <= N; x++) {
        var cell = game.getCell(x, y), key = x + ',' + y;
        var placedCard = null;
        if (rz && rz.placed[key]) { for (var pi = 0; pi < rz.drawn.length; pi++) if (rz.drawn[pi].id === rz.placed[key]) placedCard = rz.drawn[pi]; }
        var shownCard = placedCard || cell.card;
        var isPending = !cell.destroyed && !shownCard;                       // cella svuotata (randomizer)
        var isFig = shownCard && isFigureVal(shownCard.value);
        // In ruleset C la carta centrale resta a fondo bianco (non invertita): il centro
        // è messo in risalto dagli outline, non dal fondo colorato. Le figure restano invertite.
        var centerInvert = isCenter(x, y) && s.ruleset !== 'C';
        var invert = !!shownCard && !(cell.faceDown && !placedCard) && (centerInvert || isFig);
        var cls = 'cell';
        if (cell.destroyed) cls += ' destroyed';
        else if (isPending) cls += ' pending';
        else {
          cls += ' suit-' + shownCard.suit;
          if (!placedCard && cell.faceDown) cls += ' facedown';
          if (invert) cls += ' inverted suit-bg-' + shownCard.suit;
        }
        if (isCenter(x, y)) cls += ' center';
        if (isBonusCell(x, y)) cls += ' bonus-cell';
        if (y === 1) cls += ' target-n';
        if (y === N) cls += ' target-s';
        if (selectable[key] || pick[key]) cls += ' selectable';
        if (relocKeys[key]) cls += ' reloc';
        if (chosenKeys[key]) cls += ' chosen-cell';
        if (dropKeys[key]) cls += ' drop-target';

        var c = h('div', cls);
        c.setAttribute('data-xy', key);
        if (cell.destroyed) { c.appendChild(h('div', 'destroyed-mark', '✖')); }
        else if (!isPending) {
          var faceDownNow = !placedCard && cell.faceDown;
          if (!faceDownNow) c.appendChild(cardFace(shownCard, invert));
        }
        if (VIEW.showLabels) c.appendChild(h('div', 'coord', '[' + x + ',' + y + ']'));
        // Ruleset C: quadratino nero (angolo in basso a destra) sulle celle bonus non ancora riscosse.
        if (s.ruleset === 'C' && !cell.destroyed && cell.card && isPositionBonusCell(x, y) && !cell.bonusTaken) {
          var bm = h('div', 'bonus-mark'); bm.title = 'CELLA BONUS: scelta TOOL non ancora riscossa'; c.appendChild(bm);
        }
        if (cell.pawn) {
          c.appendChild(h('div', 'cell-ring ' + cell.pawn)); // outline colorato della cella con pedina
          c.appendChild(h('div', 'pawn ' + cell.pawn, cell.pawn));
        }
        if (dropKeys[key]) {
          c.addEventListener('dragover', function (e) { e.preventDefault(); });
          (function (xx, yy) { c.addEventListener('drop', function (e) { e.preventDefault(); var id = e.dataTransfer.getData('text/plain'); if (id) { try { game.randomizerPlace(id, xx, yy); ui.selectedDrawn = null; render(); } catch (err) { } } }); })(x, y);
        }
        if (cellTipOn && !cell.destroyed && cell.card) attachCellConditionTip(c, s.activePlayer, cell, condTipOn);
        (function (xx, yy) { c.onclick = function () { onCellClick(xx, yy); }; })(x, y);
        dom.board.appendChild(c);
      }
      // Overlay (dietro le celle): forme piene che sporgono come outline.
      // 5×5: croce magenta (centro + ortogonali) + quadrato giallo (centro).
      // 4×4: quadrato giallo attorno alle 4 celle bonus centrali.
      if (centerHL) {
        var hl = h('div', 'center-hl');
        if (N === 4) {
          hl.appendChild(h('span', 'chl chl-bonus'));
        } else {
          hl.appendChild(h('span', 'chl chl-cross-h'));
          hl.appendChild(h('span', 'chl chl-cross-v'));
          hl.appendChild(h('span', 'chl chl-square'));
        }
        dom.board.appendChild(hl);
      }
    }

    function currentSelectableCells(s) {
      var map = {};
      if (s.gameOver || ui.gate || s.subPhase) return map;
      if ((s.phase === 'move' || s.phase === 'attack') && ui.armedCardId && !isCpu(s.activePlayer)) {
        var list = s.phase === 'move' ? game.legalMoves(s.activePlayer) : game.legalShots(s.activePlayer);
        list.forEach(function (m) { if (m.cardIds.indexOf(ui.armedCardId) !== -1) map[m.key] = true; });
      }
      return map;
    }

    // ---- Log (più recente in alto, ogni riga cliccabile per tornare indietro) ----
    // Numero di round di una riga di log ("R3 · …" → 3; setup → 0).
    function logRound(line) { var m = /^R(\d+)/.exec(line); return m ? parseInt(m[1], 10) : 0; }
    // Sostituisce i nomi-tecnici degli oggetti (con underscore) con le rispettive label leggibili.
    var _objLabelMap = null;
    function prettyLog(line) {
      if (!OBJ) return line;
      if (!_objLabelMap) { _objLabelMap = []; OBJ.ALL_TYPES.slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (t) { var d = OBJ.def(t); _objLabelMap.push([new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), d ? d.label : t]); }); }
      _objLabelMap.forEach(function (m) { line = line.replace(m[0], m[1]); });
      return line;
    }
    // Aggiunge il testo del log a `node` colorando i token: giocatori (colore-giocatore) e
    // carte "valore+iniziale-SUIT" es. 7B/10O (colore del seme). "Vince il clash X": X per SUIT.
    function appendColorizedLog(node, text) {
      var players = game.allPlayers ? game.allPlayers() : ['N', 'S'];
      var re = /clash ([OSCB])\b|\b(\d{1,2}[OSCB])\b|\b([NESW])(?![-\w])/g;
      var last = 0, m;
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) node.appendChild(document.createTextNode(text.slice(last, m.index)));
        if (m[1]) {                                   // "clash X" → iniziale del seme vincente
          node.appendChild(document.createTextNode('clash '));
          var cw = h('span', 'log-card'); cw.style.color = LOG_SUIT_COLOR[SUIT_BY_INITIAL[m[1]]]; cw.textContent = m[1]; node.appendChild(cw);
        } else if (m[2]) {                            // carta: valore + iniziale del seme
          var suit = SUIT_BY_INITIAL[m[2].charAt(m[2].length - 1)];
          var cc = h('span', 'log-card'); cc.style.color = LOG_SUIT_COLOR[suit]; cc.textContent = m[2]; node.appendChild(cc);
        } else if (m[3]) {                            // giocatore (solo se partecipa)
          if (players.indexOf(m[3]) !== -1) { var pl = h('span', 'log-player'); pl.style.color = PLAYER_COLOR[m[3]]; pl.textContent = m[3]; node.appendChild(pl); }
          else node.appendChild(document.createTextNode(m[3]));
        }
        last = re.lastIndex;
      }
      if (last < text.length) node.appendChild(document.createTextNode(text.slice(last)));
    }
    // Tooltip: a quale azione si torna cliccando la riga (R<n> - <fase> (<giocatore>)).
    function logRestoreTip(ti) {
      var hist = game.history, snap = null;
      for (var k = 0; k < hist.length; k++) if (hist[k].log.length <= ti) snap = hist[k];
      if (!snap) return 'Torna all\'inizio (Setup)';
      var ph, who = '';
      if (snap.phase === 'select') ph = 'DEPLOY';
      else if (snap.phase === 'move') { ph = snap.activePlayer === snap.firstPlayer ? 'MOVIMENTO G1' : 'MOVIMENTO G2'; who = ' (' + snap.activePlayer + ')'; }
      else if (snap.phase === 'attack') { ph = snap.activePlayer === snap.firstPlayer ? 'ATTACCO G1' : 'ATTACCO G2'; who = ' (' + snap.activePlayer + ')'; }
      else ph = snap.phase;
      return 'Torna a: R' + snap.round + ' - ' + ph + who;
    }
    function renderLog(s) {
      dom.log.innerHTML = '';
      var start = Math.max(0, s.log.length - 250);
      var slice = s.log.slice(start); // dal più vecchio al più recente
      for (var d = slice.length - 1; d >= 0; d--) {
        var ti = start + d;
        var e = h('div', 'entry log-step' + (d === slice.length - 1 ? ' latest' : ''));
        appendColorizedLog(e, prettyLog(slice[d]));
        e.title = logRestoreTip(ti);
        (function (t) { e.onclick = function () { doRestoreLog(t); }; })(ti);
        dom.log.appendChild(e);
        // Separatore pieno tra i round (la riga precedente — più vecchia — è di un round diverso).
        if (d > 0 && logRound(slice[d - 1]) !== logRound(slice[d])) dom.log.appendChild(h('div', 'log-round-sep'));
      }
      dom.log.scrollTop = 0;
    }

    // ---- Deck + pila scarti accanto alla griglia ----
    function renderPiles(s) {
      dom.piles.innerHTML = '';
      // Mazzo: dorso della carta + conteggio.
      var deckWrap = h('div', 'pile-wrap');
      var deck = h('div', 'pile deck' + (s.deck.length ? '' : ' empty'));
      var db = h('div', 'pile-badge'); db.appendChild(h('b', null, String(s.deck.length))); deck.appendChild(db);
      deckWrap.appendChild(deck); deckWrap.appendChild(h('div', 'pile-cap', 'DECK'));
      dom.piles.appendChild(deckWrap);
      // Scarti: carta in cima + conteggio, cliccabile.
      var discWrap = h('div', 'pile-wrap');
      var top = s.discard.length ? s.discard[s.discard.length - 1] : null;
      var disc = h('div', 'pile discard' + (top ? (isFigureVal(top.value) ? ' inv suit-bg-' + top.suit : ' suit-' + top.suit) : ' empty'));
      if (top) disc.appendChild(cardFace(top, isFigureVal(top.value)));
      var xb = h('div', 'pile-badge'); xb.appendChild(h('b', null, String(s.discard.length))); disc.appendChild(xb);
      disc.onclick = function () { openDiscardDialog(s); };
      discWrap.appendChild(disc); discWrap.appendChild(h('div', 'pile-cap', 'HEAP'));
      dom.piles.appendChild(discWrap);
    }

    // ---- Mazzo + scarti Oggetti (colonna a sinistra della griglia) ----
    function renderObjectPiles(s) {
      dom.objectPiles.innerHTML = '';
      if (!s.modules.objects) return;
      // Mazzo Oggetti: dorso + conteggio.
      var deckWrap = h('div', 'pile-wrap');
      var deck = h('div', 'pile deck obj-pile' + (s.objectDeck.length ? '' : ' empty'));
      var db = h('div', 'pile-badge'); db.appendChild(h('b', null, String(s.objectDeck.length))); deck.appendChild(db);
      deckWrap.appendChild(deck); deckWrap.appendChild(h('div', 'pile-cap', 'TOOLS'));
      dom.objectPiles.appendChild(deckWrap);
      // Scarti Oggetti: quadrato + conteggio, ispezionabile.
      var discWrap = h('div', 'pile-wrap');
      var disc = h('div', 'pile obj-pile obj-discard' + (s.objectDiscard.length ? '' : ' empty'));
      var xb = h('div', 'pile-badge'); xb.appendChild(h('b', null, String(s.objectDiscard.length))); disc.appendChild(xb);
      disc.onclick = function () { openObjectDiscardDialog(s); };
      var cap = h('div', 'pile-cap'); cap.appendChild(document.createTextNode('TOOLS')); cap.appendChild(document.createElement('br')); cap.appendChild(document.createTextNode('HEAP'));
      discWrap.appendChild(disc); discWrap.appendChild(cap);
      dom.objectPiles.appendChild(discWrap);
    }

    function openObjectDiscardDialog(s) {
      var back = h('div', 'dialog-back');
      var box = h('div', 'dialog');
      box.appendChild(h('h2', null, 'TOOLS HEAP (' + s.objectDiscard.length + ')'));
      var grid = h('div', 'obj-card-grid');
      if (!s.objectDiscard.length) grid.appendChild(h('div', 'hint', 'Nessun TOOL scartato.'));
      s.objectDiscard.forEach(function (o) { grid.appendChild(objectCardEl(o.type)); });
      box.appendChild(grid);
      var close = h('button', 'primary', 'Chiudi');
      close.onclick = function () { back.remove(); };
      box.appendChild(close);
      back.appendChild(box);
      back.onclick = function (e) { if (e.target === back) back.remove(); };
      document.body.appendChild(back);
    }

    function openDiscardDialog(s) {
      var back = h('div', 'dialog-back');
      var box = h('div', 'dialog');
      box.appendChild(h('h2', null, 'HEAP (' + s.discard.length + ')'));
      var grid = h('div', 'discard-grid');
      if (!s.discard.length) grid.appendChild(h('div', 'hint', 'Nessuna carta.'));
      s.discard.forEach(function (c) { grid.appendChild(miniCard(c, false)); });
      box.appendChild(grid);
      var close = h('button', 'primary', 'Chiudi');
      close.onclick = function () { back.remove(); };
      box.appendChild(close);
      back.appendChild(box);
      back.onclick = function (e) { if (e.target === back) back.remove(); };
      document.body.appendChild(back);
    }

    // Dialog scrollabile col contenuto del regolamento (markdown → HTML).
    // Dialog "Opzioni": raccoglie i checkbox di visualizzazione (layout carte, abbinamenti, etichette).
    function openOptionsDialog() {
      var back = h('div', 'dialog-back');
      var box = h('div', 'dialog rules-dialog');
      var head = h('div', 'rules-head');
      head.appendChild(h('h2', null, 'Opzioni'));
      var x = h('button', 'rules-x', '✕'); x.title = 'Chiudi';
      var close = function () { back.remove(); document.removeEventListener('keydown', onKey); };
      x.onclick = close; head.appendChild(x); box.appendChild(head);

      var content = h('div', 'opt-content');
      function optCheck(title, desc, checked, onChange) {
        var l = h('label', 'opt-check');
        var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = checked;
        cb.onchange = function () { onChange(cb.checked); render(); };
        var txt = h('span', 'oc-txt'); txt.appendChild(h('span', 'oc-title', title)); if (desc) txt.appendChild(h('span', 'oc-desc', desc));
        l.appendChild(cb); l.appendChild(txt); return l;
      }

      var gCards = h('div', 'opt-group'); gCards.appendChild(h('h3', null, 'Carte'));
      // Anteprima live delle due modalità (una carta normale + una figura).
      var prev = h('div', 'opt-preview');
      function refreshPrev() { prev.innerHTML = ''; prev.appendChild(bigPreviewCard({ id: 'p1', value: 6, suit: 'oro' })); prev.appendChild(bigPreviewCard({ id: 'p2', value: 10, suit: 'spade' })); }
      gCards.appendChild(optCheck('Doppio VALORE e SUIT',
        'VALORE e SUIT ripetuti agli angoli, leggibili da entrambi i lati. Deseleziona per mostrare un solo VALORE e SUIT (copie sottosopra nascoste).',
        VIEW.cardDouble, function (v) { VIEW.cardDouble = v; refreshPrev(); }));
      refreshPrev();
      gCards.appendChild(prev);
      content.appendChild(gCards);

      var gBoard = h('div', 'opt-group'); gBoard.appendChild(h('h3', null, 'Campo di gioco'));
      gBoard.appendChild(optCheck('Mostra MATCH',
        'Evidenzia sul campo le CELLE che puoi MATCHARE quando passi il mouse su una carta della STACK.',
        VIEW.showMatches, function (v) { VIEW.showMatches = v; if (!v) clearMatchHints(); }));
      gBoard.appendChild(optCheck('Mostra condizioni di MATCH',
        'Al passaggio del mouse su una carta, mostra un tooltip con le condizioni di MATCH (VALORE, SUIT jolly, SKILL).',
        VIEW.showConditions, function (v) { VIEW.showConditions = v; }));
      gBoard.appendChild(optCheck('Mostra bonus di fine ROUND',
        'Nel tooltip delle CELLE della griglia mostra il bonus di fine ROUND della SUIT: oro +1 punto, coppe pesca 1 TOOL, bastoni pesca 1 carta, spade togli 1 punto a un avversario.',
        VIEW.showCellBonus, function (v) { VIEW.showCellBonus = v; }));
      gBoard.appendChild(optCheck('Mostra azioni',
        'Overlay sul campo con le linee dei MOVIMENTI e i pallini degli ATTACCHI (colori per PILOTA, più scuri le azioni più vecchie).',
        VIEW.showActions, function (v) { VIEW.showActions = v; }));
      gBoard.appendChild(optCheck('Mostra etichette',
        'Mostra le etichette Nord/Sud e le coordinate delle CELLE.',
        VIEW.showLabels, function (v) { VIEW.showLabels = v; }));
      // Solo per il Ruleset C: outline che evidenzia il centro / le celle bonus.
      if (game.state && game.state.ruleset === 'C') {
        var hlDesc = game.state.gridSize === 4
          ? 'Disegna un outline giallo attorno alle 4 celle bonus centrali.'
          : 'Disegna un outline attorno alla cella centrale (giallo) e alle sue quattro celle ortogonali (magenta).';
        gBoard.appendChild(optCheck('Evidenzia il centro', hlDesc,
          VIEW.centerHighlight, function (v) { VIEW.centerHighlight = v; }));
      }
      content.appendChild(gBoard);

      box.appendChild(content);
      back.appendChild(box);
      back.onclick = function (e) { if (e.target === back) close(); };
      function onKey(e) { if (e.key === 'Escape') close(); }
      document.addEventListener('keydown', onKey);
      document.body.appendChild(back);
    }

    // ---- Timeline del turno (persistente per animare le transizioni) ----
    // Timeline generica (2-4 giocatori). MOVIMENTO: primo→ultimo; ATTACCO: ultimo→primo ('1221') o
    // stesso ordine ('1212'). Le etichette mostrano il NOME del giocatore (N/S/E/W); abbreviate a
    // 3-4 giocatori ("M N", "A W"). Ritorna { segs:[{key,label,color}], active:key }.
    function timelineModel(s) {
      var order = (s.playerOrder && s.playerOrder.length) ? s.playerOrder.slice() : ['N', 'S'];
      function seg(key, full, abbr, color) { return { key: key, full: full, abbr: abbr, color: color }; }
      if (s.phase === 'draft') {
        var dsegs = order.map(function (id) { return seg('d-' + id, 'Piazzamento ' + id, 'Piazz. ' + id, PLAYER_COLOR[id]); });
        var dactive = s.pendingDraft ? 'd-' + s.pendingDraft.playerId : dsegs[0].key;
        return { segs: dsegs, active: dactive };
      }
      var atkOrder = s.turnMode === '1212' ? order.slice() : order.slice().reverse();
      var segs = [seg('select', 'DEPLOY', 'DEPLOY', '#ffffff')];
      order.forEach(function (id) { segs.push(seg('m-' + id, 'MOVIMENTO ' + id, 'M ' + id, PLAYER_COLOR[id])); });
      atkOrder.forEach(function (id) { segs.push(seg('a-' + id, 'ATTACCO ' + id, 'A ' + id, PLAYER_COLOR[id])); });
      segs.push(seg('end', 'FINE TURNO', 'FINE', '#ffffff'));
      var active = 'end';
      if (!s.gameOver && s.phase !== 'end') {
        if (s.phase === 'select') active = 'select';
        else if (s.phase === 'move') active = 'm-' + s.activePlayer;
        else if (s.phase === 'attack') active = 'a-' + s.activePlayer;
      }
      return { segs: segs, active: active };
    }
    function renderTimeline(s) {
      if (!ui.tlSegRow) { // struttura: riga fasi + pillola descrizione
        dom.timeline.innerHTML = '';
        ui.tlSegRow = h('div', 'tl-segrow'); ui.tlHint = h('div', 'phase-hint'); ui.tlHint.hidden = true;
        dom.timeline.appendChild(ui.tlSegRow); dom.timeline.appendChild(ui.tlHint); ui.tlSig = null;
      }
      var model = timelineModel(s);
      var sig = model.segs.map(function (x) { return x.key; }).join('|');
      if (ui.tlSig !== sig) {
        ui.tlSegRow.innerHTML = ''; ui.tlSegs = {}; ui.tlSig = sig;
        model.segs.forEach(function (seg, i) {
          if (i) ui.tlSegRow.appendChild(h('span', 'tl-arrow', '›'));
          var el = h('span', 'tl-seg'); ui.tlSegs[seg.key] = el; ui.tlSegRow.appendChild(el);
        });
      }
      // Etichette: nomi estesi; se la barra andrebbe su 2 righe, passa alle abbreviazioni (una riga).
      function applyLabels(abbr) { model.segs.forEach(function (seg) { if (ui.tlSegs[seg.key]) ui.tlSegs[seg.key].textContent = abbr ? seg.abbr : seg.full; }); }
      var forceAbbr = (s.playerOrder && s.playerOrder.length > 2);
      applyLabels(forceAbbr);
      if (!forceAbbr) {
        // Con le etichette estese la barra sta su una riga? Misura la larghezza a riga singola (nowrap)
        // e confrontala con lo spazio disponibile; se non ci sta, passa alle abbreviazioni.
        var avail = (ui.tlSegRow.parentNode && ui.tlSegRow.parentNode.clientWidth) || ui.tlSegRow.clientWidth;
        var prev = ui.tlSegRow.style.flexWrap;
        ui.tlSegRow.style.flexWrap = 'nowrap';
        var oneLine = ui.tlSegRow.scrollWidth;
        ui.tlSegRow.style.flexWrap = prev;
        if (oneLine > avail + 1) applyLabels(true);
      }
      function setActive(activeKey) {
        model.segs.forEach(function (seg) {
          var el = ui.tlSegs[seg.key]; if (!el) return;
          if (seg.key === activeKey) { el.classList.add('cur'); el.style.background = seg.color; }
          else { el.classList.remove('cur'); el.style.background = ''; }
        });
      }
      // Flash della fase "fine turno" quando cambia il round.
      if (ui.lastRound != null && s.round !== ui.lastRound && !s.gameOver && s.phase !== 'draft' && !ui.flashingEnd && ui.tlSegs['end']) {
        ui.flashingEnd = true;
        setActive('end');
        setTimeout(function () { ui.flashingEnd = false; renderTimeline(game.state); }, 800);
      } else if (!ui.flashingEnd) {
        setActive(model.active);
      }
      renderPhaseHint(s);
      ui.lastRound = s.round;
    }
    // Pillola sotto la barra delle fasi: descrive cosa fare nel turno corrente.
    function renderPhaseHint(s) {
      var node = ui.tlHint; if (!node) return;
      node.innerHTML = '';
      var info = phaseHintInfo(s);
      if (!info || !info.text) { node.hidden = true; return; }
      node.hidden = false;
      if (info.playerId) { var dot = h('span', 'ph-dot'); dot.style.background = PLAYER_COLOR[info.playerId] || '#888'; node.appendChild(dot); }
      node.appendChild(document.createTextNode(info.text));
    }
    function phaseHintInfo(s) {
      if (s.gameOver || ui.gate) return null;
      if (s.phase === 'draft') { var dw = s.pendingDraft && s.pendingDraft.playerId; return dw ? { playerId: dw, text: isCpu(dw) ? 'Piazzamento — il computer sta costruendo la griglia…' : ('Piazzamento — Pilota ' + dw + ': pesca 4 carte e posizionane 2 sulla griglia') } : null; }
      if (s.subPhase) return null; // gli interrupt mostrano l'istruzione nel pannello azione
      if (s.phase === 'select') {
        var next = null, ap = game.allPlayers();
        for (var i = 0; i < ap.length; i++) if (s.selected[ap[i]] == null) { next = ap[i]; break; }
        if (!next) return null;
        if (isCpu(next)) return { playerId: next, text: 'DEPLOY — il computer sta scegliendo le carte…' };
        return { playerId: next, text: 'DEPLOY — Pilota ' + next + ': scegli ' + game.selectCount(next) + ' carte per il ROUND' };
      }
      if (s.phase === 'move' || s.phase === 'attack') {
        var who = s.activePlayer, phName = s.phase === 'move' ? 'MOVIMENTO' : 'ATTACCO', word = s.phase === 'move' ? 'MUOVERE' : 'ATTACCARE';
        if (isCpu(who)) return { playerId: who, text: phName + ' — il computer sta giocando…' };
        var can = (s.phase === 'move' ? game.legalMoves(who) : game.legalShots(who)).length > 0;
        var extra = s.actionsLeft > 1 ? ' · azioni rimaste: ' + s.actionsLeft : '';
        var t = ui.armedCardId ? ('Clicca una CELLA evidenziata per ' + word)
              : (can ? ('Scegli una carta, poi la CELLA dove ' + word) : 'Nessuna azione: puoi passare');
        return { playerId: who, text: phName + ' — ' + t + extra };
      }
      return null;
    }

    // ============================================================ ACTION AREA
    function renderActionArea(s) {
      // Interrupt gestiti sulla griglia (istruzione + click) o con pannelli dedicati.
      if (s.subPhase === 'object-discard') return renderDiscard(s);
      if (s.subPhase === 'end-discard') return renderEndDiscard(s);
      if (s.subPhase === 'tool-discard') return renderToolDiscard(s);
      if (s.subPhase === 'runner-figure') return renderRunnerFigure(s);
      if (s.subPhase === 'timebomb-suit') return renderTimebomb(s);
      if (s.subPhase === 'clash-cards') return renderClashCards(s);
      if (s.subPhase === 'clash-reloc') return renderReloc(s, s.pendingClash.relocatorId, s.pendingClash.relocateePawn, s.pendingClash.relocateOptional, true);
      if (s.subPhase === 'forced-reloc') return renderReloc(s, s.pendingForced.chooserId, s.pendingForced.pawnId, s.pendingForced.optional, false);
      // Oggetti avanzati (attacco)
      if (s.subPhase === 'teleport-select') return renderPickInfo('🌀 Teletrasporto', 'Clicca una CELLA ONLINE VUOTA con lo stesso VALORE della CELLA su cui ti trovi.');
      if (s.subPhase === 'draft-select') return renderDraftSelect(s);
      if (s.subPhase === 'draft-place') return renderPickInfo('🃏 Draft', 'Clicca una CELLA VUOTA dove posizionare la carta scelta.');
      if (s.subPhase === 'energy-target') return renderEnergyTarget(s);
      if (s.subPhase === 'endbonus-steal') return renderEndBonusSteal(s);
      if (s.subPhase === 'rebuild-select') return renderRebuildSelect(s);
      if (s.subPhase === 'rebuild-place') return renderPickInfo('🔧 Ricostruisci', 'Clicca la CELLA DISTRUTTA o OFFLINE da SOVRASCRIVERE con la carta scelta.');
      if (s.subPhase === 'elemental-target') return renderPickInfo('💥 Bomba Elementale', 'Clicca la CELLA bersaglio: cambia la sua SUIT e quella delle CELLE ORTOGONALI.');
      if (s.subPhase === 'elemental-suit') return renderSuitChoice('💥 Bomba Elementale — scegli la SUIT', function (su) { game.elementalSuit(su); render(); });
      if (s.subPhase === 'barrage-first') return renderPickInfo('🧨 Barrage!', 'Clicca la CELLA VUOTA da DISTRUGGERE.');
      if (s.subPhase === 'randomizer-select') return renderRandomizerSelect(s);
      if (s.subPhase === 'randomizer-place') return renderRandomizerPlace(s);
      if (s.subPhase === 'altmatch-object') return renderAltObject(s);
      if (s.phase === 'select') return renderSelect(s);
      if (s.phase === 'move' || s.phase === 'attack') return renderAction(s);
    }

    function setAction(title, bodyNode, actionsNode) {
      dom.action.innerHTML = '';
      var head = h('div', 'act-head');
      if (typeof title === 'string') head.textContent = title;
      else { head.classList.add('act-head-rich'); head.appendChild(title); }
      dom.action.appendChild(head);
      if (bodyNode) dom.action.appendChild(bodyNode);
      if (actionsNode) dom.action.appendChild(actionsNode);
    }
    function thinking(txt) { setAction(txt, h('div', 'hint', 'Attendi il computer…'), null); }

    // Etichetta capienza TOOLS: (posseduti / massimo). Il TOOL di partenza dell'ARM non conta nel limite,
    // quindi la capienza è limite + eventuali TOOL iniziali ancora posseduti (es. 4 + 1 = 5).
    function toolsCapLabel(playerId) {
      var objs = game.state.players[playerId].objects;
      var limit = game._objLimit ? game._objLimit() : 4;
      var charHeld = objs.filter(function (o) { return o.fromCharacter; }).length;
      return '(' + objs.length + '/' + (limit + charHeld) + ')';
    }
    // ---- Pannello oggetti sotto la mano: 5 slot fissi su una riga; gli slot vuoti sono tratteggiati. ----
    var TOOL_SLOTS = 5;
    function objectsPanel(s, playerId) {
      if (!s.modules.objects) return null;
      var wrap = h('div', 'obj-panel tools-panel');
      var objs = s.players[playerId].objects;
      wrap.appendChild(h('div', 'obj-panel-title', 'TOOLS ' + toolsCapLabel(playerId)));
      var row = h('div', 'obj-panel-row obj-slots');
      var usableIds = game.usableObjects(playerId).map(function (o) { return o.id; });
      var slots = [];
      for (var i = 0; i < Math.max(TOOL_SLOTS, objs.length); i++) slots.push(objs[i] || null);
      slots.forEach(function (o) {
        if (!o) { row.appendChild(h('div', 'obj-slot empty')); return; }
        var def = OBJ ? OBJ.def(o.type) : null;
        var usable = usableIds.indexOf(o.id) !== -1;
        var box = h('div', 'obj-card obj-slot' + (o.fromCharacter ? ' init' : '') + (usable ? ' usable' : ' disabled'));
        box.appendChild(h('span', 'obj-name', def ? def.label : o.type));
        box.appendChild(h('span', 'obj-phase', objPhaseText(o.type)));
        box.appendChild(h('span', 'tooltip', def ? def.desc : o.type));
        if (usable) box.onclick = function () { game.useObject(playerId, o.id); ui.armedCardId = null; render(); };
        row.appendChild(box); bindTip(box);
      });
      wrap.appendChild(row);
      return wrap;
    }

    // ---- Pannello "Attiva Potere" (tra mano e oggetti): poteri attivi (Brawler/Tactician) + usi ----
    function powersPanel(s, playerId, mode) {
      if (mode === 'select' || !s.modules.powers) return null;
      var p = s.players[playerId];
      if (p.character !== 'tactician' && p.character !== 'brawler') return null;
      var wrap = h('div', 'obj-panel power-panel');
      wrap.appendChild(h('div', 'obj-panel-title', 'Attiva SKILL'));
      var row = h('div', 'obj-panel-row');
      if (p.character === 'tactician') {
        var canP = game.canActivatePower && game.canActivatePower(playerId);
        var box = h('div', 'obj-card power-card' + (canP ? ' usable' : ' disabled'));
        box.appendChild(h('span', 'obj-name', 'Tactician'));
        box.appendChild(usesDots(p.tacticianTotal, p.tacticianLeft, playerId));
        box.appendChild(h('span', 'tooltip', characterPowerDesc('tactician')));
        if (canP) box.onclick = function () { game.activatePower(playerId); ui.armedCardId = null; render(); };
        row.appendChild(box); bindTip(box);
      }
      if (p.character === 'brawler') {
        var canB = game.canBrawler && game.canBrawler(playerId);
        var box2 = h('div', 'obj-card power-card' + (ui.brawlerMode ? ' active' : '') + (canB ? ' usable' : ' disabled'));
        box2.appendChild(h('span', 'obj-name', 'Brawler'));
        box2.appendChild(usesDots(p.brawlerTotal, p.brawlerLeft, playerId));
        box2.appendChild(h('span', 'tooltip', characterPowerDesc('brawler')));
        if (canB) box2.onclick = function () { ui.brawlerMode = !ui.brawlerMode; ui.armedCardId = null; render(); };
        row.appendChild(box2); bindTip(box2);
      }
      wrap.appendChild(row);
      if (ui.brawlerMode) wrap.appendChild(h('div', 'hint', 'Clicca una CELLA evidenziata: userai 3 carte per MATCHARE qualsiasi CELLA.'));
      return wrap;
    }

    // ---- Scarto oggetto (oltre il limite) ----
    // ---- Costo jetpack/jump: il giocatore sceglie quale carta scelta scartare ----
    function renderToolDiscard(s) {
      var who = s.pendingToolDiscard.playerId, mod = s.pendingToolDiscard.modifier;
      if (isCpu(who)) { thinking('🤖 Il computer sceglie la carta da SCARTARE…'); return; }
      var body = h('div', 'hand');
      game.toolDiscardOptions().forEach(function (c) {
        var isFig = isFigureVal(c.value);
        var card = h('div', 'card selectable ' + (isFig ? 'inv suit-bg-' + c.suit : 'suit-' + c.suit));
        card.appendChild(cardFace(c, isFig));
        card.onclick = function () { game.toolDiscardChoose(c.id); render(); };
        body.appendChild(card);
      });
      setAction('COSTO ' + (mod === 'jetpack' ? 'Jetpack' : 'Salto') + ' — scegli la carta da SCARTARE', body, null);
    }

    // ---- Passiva runner: colpire la figura su cui si è mossi (scartando 1 carta scelta) ----
    function renderRunnerFigure(s) {
      var who = s.pendingRunner.playerId;
      if (isCpu(who)) { thinking('🤖 Il computer decide se colpire l\'OBIETTIVO…'); return; }
      var cell = game.getCell(s.pendingRunner.x, s.pendingRunner.y);
      var body = h('div', 'hand');
      game.runnerFigureOptions().forEach(function (c) {
        var isFig = isFigureVal(c.value);
        var card = h('div', 'card selectable ' + (isFig ? 'inv suit-bg-' + c.suit : 'suit-' + c.suit));
        card.appendChild(cardFace(c, isFig));
        card.onclick = function () { game.runnerFigureHit(c.id); render(); };
        body.appendChild(card);
      });
      var actions = h('div', 'act-actions');
      var skip = h('button', 'ghost', 'Non colpire');
      skip.onclick = function () { game.runnerFigureSkip(); render(); };
      actions.appendChild(skip);
      setAction('E-RUN-01 — COLPISCI l\'OBIETTIVO ' + (cell.card ? cell.card.value : '') + '? (SCARTA [1] dalla STACK ATTIVA)', body, actions);
    }

    function renderDiscard(s) {
      var who = s.pendingObjectDiscard.playerId;
      if (isCpu(who)) { thinking('🤖 Il computer scarta un TOOL…'); return; }
      var limit = game._objLimit ? game._objLimit() : 2;
      var body = h('div', 'obj-window');
      body.appendChild(h('div', 'hint', 'Hai superato il limite di ' + limit + ' oggetti: scartane uno (l\'iniziale non conta).'));
      s.players[who].objects.filter(function (o) { return !o.fromCharacter; }).forEach(function (o) {
        var def = OBJ ? OBJ.def(o.type) : null;
        var b = h('button', 'obj-use', def ? def.label : o.type); b.title = def ? def.desc : o.type;
        b.onclick = function () { game.discardObject(who, o.id); render(); };
        body.appendChild(b);
      });
      setAction('🗑️ Scarto TOOL — Pilota ' + who, body, null);
    }

    // ---- Scarto in eccesso a fine turno (più di 6 carte) ----
    function renderEndDiscard(s) {
      var pd = s.pendingEndDiscard, who = pd.playerId;
      if (isCpu(who)) { thinking('🤖 Il computer scarta le carte in eccesso…'); return; }
      if (ui.mode === '2p' && ui.endDiscardGate !== who) {
        openGate('Fine TURNO: passa il dispositivo al Pilota ' + who + ' per scartare le carte in eccesso.', 'Sono ' + who, function () { ui.endDiscardGate = who; render(); });
        return;
      }
      var body = h('div', 'hand');
      game.endDiscardOptions().forEach(function (c) {
        var chosen = pd.sel.indexOf(c.id) !== -1;
        var card = h('div', 'card ' + (isFigureVal(c.value) ? 'inv suit-bg-' + c.suit : 'suit-' + c.suit) + (chosen ? ' chosen-discard' : ''));
        card.appendChild(cardFace(c, isFigureVal(c.value)));
        card.onclick = function () { try { game.endDiscardToggle(c.id); } catch (e) { } render(); };
        body.appendChild(card);
      });
      var actions = h('div', 'act-actions');
      var btn = h('button', 'primary', 'Seleziona (' + pd.sel.length + '/' + pd.need + ') carte da scartare');
      btn.disabled = pd.sel.length !== pd.need;
      btn.onclick = function () { ui.endDiscardGate = null; game.endDiscardConfirm(); render(); };
      actions.appendChild(btn);
      setAction('🗑️ Fine TURNO — hai più di 6 carte: scartane ' + pd.need + ' (Pilota ' + who + ')', body, actions);
    }

    // ---- Ricostruisci: scelta di 1 carta tra le pescate ----
    function renderEnergyTarget(s) {
      var who = s.pendingEnergy.playerId;
      if (isCpu(who)) { thinking('🤖 Il computer sceglie da chi rubare…'); return; }
      var body = h('div', 'choices');
      game.energyTargetOptions().forEach(function (oid) {
        var b = h('button', 'primary', 'Pilota ' + oid + ' (' + (SEAT_LABEL[oid] || oid) + ')');
        b.style.borderColor = PLAYER_COLOR[oid];
        b.onclick = function () { game.energyDrainTarget(oid); render(); };
        body.appendChild(b);
      });
      setAction('⚡ Sifone Energetico — scegli da chi rubare una carta', body, null);
    }
    function renderEndBonusSteal(s) {
      var who = s.pendingEndBonus.playerId;
      if (isCpu(who)) { thinking('🤖 Il computer sceglie a chi togliere il punto…'); return; }
      var body = h('div', 'choices');
      game.endBonusStealOptions().forEach(function (oid) {
        var b = h('button', 'primary', 'Pilota ' + oid + ' (' + (SEAT_LABEL[oid] || oid) + ') — ' + s.players[oid].score + ' pt');
        b.style.borderColor = PLAYER_COLOR[oid];
        b.onclick = function () { game.endBonusSteal(oid); render(); };
        body.appendChild(b);
      });
      setAction('♠ Bonus fine ROUND — togli 1 punto a un avversario', body, null);
    }
    function renderDraftSelect(s) {
      var pd = s.pendingDraft, who = pd.playerId;
      if (isCpu(who)) { thinking('🤖 Il computer costruisce la griglia…'); return; }
      var body = h('div', 'hand');
      game.draftDrawn().forEach(function (c) {
        var card = h('div', 'card selectable ' + (isFigureVal(c.value) ? 'inv suit-bg-' + c.suit : 'suit-' + c.suit));
        card.appendChild(cardFace(c, isFigureVal(c.value)));
        card.onclick = function () { game.draftSelectCard(c.id); render(); };
        body.appendChild(card);
      });
      setAction('🃏 Draft — Pilota ' + who + ': scegli una carta da piazzare (' + (pd.placed + 1) + '/' + pd.need + ')', body, null);
    }
    function renderRebuildSelect(s) {
      var who = s.pendingRebuild.playerId;
      if (isCpu(who)) { thinking('🤖 Il computer sceglie la carta…'); return; }
      var body = h('div', 'hand');
      game.rebuildDrawn().forEach(function (c) {
        var card = h('div', 'card selectable ' + (isFigureVal(c.value) ? 'inv suit-bg-' + c.suit : 'suit-' + c.suit));
        card.appendChild(cardFace(c, isFigureVal(c.value)));
        card.onclick = function () { game.rebuildSelectCard(c.id); render(); };
        body.appendChild(card);
      });
      setAction('🔧 Ricostruisci — scegli 1 carta da posizionare', body, null);
    }

    // ---- Scelta seme (generica: timebomb / elemental bomb) ----
    function renderSuitChoice(title, onPick) {
      var body = h('div', 'choices');
      ['oro', 'spade', 'coppe', 'bastoni'].forEach(function (su) {
        var b = h('button', 'primary', SUIT_LABEL[su] + ' ');
        b.appendChild(suitIcon(su));
        b.onclick = function () { onPick(su); };
        body.appendChild(b);
      });
      setAction(title, body, null);
    }
    function renderTimebomb(s) {
      var who = s.pendingTimebomb.playerId;
      if (isCpu(who)) { thinking('🤖 Il computer sposta la GLOBAL SUIT…'); return; }
      renderSuitChoice('⏱️ Cronobomba — scegli la nuova GLOBAL SUIT', function (su) { game.timebombChoose(su); render(); });
    }
    function renderPickInfo(title, hintText) { setAction(title, h('div', 'hint', hintText), null); }

    // ---- Abbinamento alternativo (Ruleset A): scelta di 1 oggetto su 3 ----
    // La scelta del TOOL avviene in un modale (renderToolChoiceModal); qui il pannello mostra solo un avviso.
    function renderAltObject(s) {
      var who = s.pendingAltMatch.playerId;
      if (isCpu(who)) { thinking('🤖 Il computer sceglie un TOOL…'); return; }
      renderPickInfo('🎁 Scegli un TOOL', 'Scegli il TOOL da tenere nella finestra.');
    }
    // ---- Modale scelta TOOL (come il clash): 3 scelte cliccabili ----
    function buildToolChoiceModal(s) {
      var pa = s.pendingAltMatch;
      var back = h('div', 'dialog-back toolchoice-modal-back');
      var box = h('div', 'dialog toolchoice-modal');
      var head = h('div', 'rules-head'); head.appendChild(h('h2', null, 'Scegli un TOOL')); box.appendChild(head);
      box.appendChild(h('div', 'peek-sub', 'Pilota ' + pa.playerId + ': tieni [1] TOOL; gli altri vanno nella TOOLS HEAP.'));
      var row = h('div', 'toolchoice-row');
      pa.drawn.forEach(function (o) {
        var def = OBJ ? OBJ.def(o.type) : null;
        var card = h('div', 'obj-card usable toolchoice-card');
        card.appendChild(h('span', 'obj-name', def ? def.label : o.type));
        card.appendChild(h('span', 'obj-phase', objPhaseText(o.type)));
        card.appendChild(h('div', 'oc-desc', def ? def.desc : o.type));
        card.onclick = function () { game.altMatchPickObject(o.id); render(); };
        row.appendChild(card);
      });
      box.appendChild(row);
      back.appendChild(box);
      return back;
    }
    function renderToolChoiceModal(s) {
      var existing = document.querySelector('.toolchoice-modal-back');
      var show = s.subPhase === 'altmatch-object' && s.pendingAltMatch && !isCpu(s.pendingAltMatch.playerId) && !ui.gate;
      if (!show) { if (existing) existing.remove(); return; }
      if (existing) return;
      document.body.appendChild(buildToolChoiceModal(s));
    }

    // ---- Randomizer ----
    function renderRandomizerSelect(s) {
      var pr = s.pendingRandomizer;
      var body = h('div', 'hint', 'Clicca fino a 3 celle da rimescolare. Selezionate: ' + pr.chosen.length + '/3.');
      var actions = h('div', 'act-actions');
      var conf = confirmBtn('Conferma (' + pr.chosen.length + ')', s.activePlayer);
      conf.disabled = pr.chosen.length === 0;
      conf.onclick = function () { game.randomizerConfirm(); render(); };
      actions.appendChild(conf);
      setAction('🎲 Randomizer — scelta celle', body, actions);
    }
    function renderRandomizerPlace(s) {
      var pr = s.pendingRandomizer;
      var body = h('div', 'rz-place');
      body.appendChild(h('div', 'hint', 'Trascina (o clicca) una carta pescata e posizionala in una cella svuotata. Clicca una carta già posizionata sulla griglia per rimetterla qui.'));
      var tray = h('div', 'rz-tray');
      var placedIds = {}; for (var k in pr.placed) placedIds[pr.placed[k]] = true;
      pr.drawn.forEach(function (c) {
        if (placedIds[c.id]) return;
        var card = miniCard(c, false); card.classList.add('rz-card'); if (ui.selectedDrawn === c.id) card.classList.add('sel');
        card.setAttribute('draggable', 'true');
        card.addEventListener('dragstart', function (ev) { ev.dataTransfer.setData('text/plain', c.id); });
        card.onclick = function () { ui.selectedDrawn = (ui.selectedDrawn === c.id) ? null : c.id; render(); };
        tray.appendChild(card);
      });
      if (!tray.children.length) tray.appendChild(h('span', 'hint', 'Tutte le carte sono posizionate.'));
      body.appendChild(tray);
      var actions = h('div', 'act-actions');
      var conf = confirmBtn('Conferma', s.activePlayer);
      conf.disabled = Object.keys(pr.placed).length !== pr.chosen.length;
      conf.onclick = function () { ui.selectedDrawn = null; game.randomizerDone(); render(); };
      actions.appendChild(conf);
      setAction('🎲 Randomizer — ricolloca le carte pescate', body, actions);
    }

    // ---- Selezione 3 carte (segreta) ----
    function renderSelect(s) {
      var next = null, ap = game.allPlayers();
      for (var ni = 0; ni < ap.length; ni++) if (s.selected[ap[ni]] == null) { next = ap[ni]; break; }
      if (next == null) return;
      if (isCpu(next)) { thinking('🤖 Il computer sceglie le carte…'); return; }
      var who = ui.selectingPlayer;
      if (who !== next) {
        if (ui.mode === 'cpu') { ui.selectingPlayer = next; ui.chosen = []; who = next; }
        else { openGate('Passa il dispositivo al Pilota ' + next, 'Sono ' + next + ', mostra le mie carte', function () { ui.selectingPlayer = next; ui.chosen = []; render(); }); return; }
      }
      renderHand(s, who, 'select');
    }

    // ---- Movimento / Attacco ----
    function renderAction(s) {
      var who = s.activePlayer;
      if (isCpu(who)) { thinking('🤖 Il computer ' + (s.phase === 'move' ? 'muove' : 'attacca') + '…'); return; }
      renderHand(s, who, 'action');
    }

    // ---- Clash: scelta carta ----
    function renderClashCards(s) {
      var chooser = game.clashCurrentChooser();
      if (isCpu(chooser)) { thinking('🤖 Il computer sceglie la carta del CLASH…'); return; }
      if (ui.mode === 'cpu' || ui.clashChooser === chooser) renderClashHand(s, chooser);
      else openGate('CLASH! Passa il dispositivo al Pilota ' + chooser + (chooser === s.pendingClash.attackerId ? ' (attaccante)' : ' (difensore)'), 'Sono ' + chooser + ', scelgo', function () { ui.clashChooser = chooser; render(); });
    }

    // ---- Ricollocazione (clash o forzata): click su griglia ----
    function renderReloc(s, chooserId, moveePawn, optional, isClash) {
      if (isCpu(chooserId)) { thinking('🤖 Il computer ricolloca un ARM…'); return; }
      var body = h('div', 'hint', 'Pilota ' + chooserId + ': clicca una CELLA evidenziata per spostare l\'ARM ' + moveePawn + ' (nessun bonus).');
      var actions = null;
      if (optional) {
        actions = h('div', 'act-actions');
        var skip = h('button', 'ghost', 'Non spostare');
        skip.onclick = function () { if (isClash) game.clashSkipRelocate(); else game.forcedRelocateSkip(); render(); };
        actions.appendChild(skip);
      }
      setAction(isClash ? 'Clash — ricollocazione' : 'Spostamento forzato', body, actions);
    }

    // ---- Rendering mano ----
    function renderHand(s, playerId, mode) {
      var p = s.players[playerId];
      var container = h('div', 'hand-and-objects');
      var body = h('div', 'hand');
      var cards = p.hand;
      cards.forEach(function (c) {
        var revealed = p.revealedIds.indexOf(c.id) !== -1;
        var avail = game.availableRevealed(playerId).some(function (x) { return x.id === c.id; });
        var isFig = isFigureVal(c.value);
        // La faccia (seme + valore) è SEMPRE visibile: le carte non usabili sono solo ingrigite.
        var cls = 'card ' + (isFig ? 'inv suit-bg-' + c.suit : 'suit-' + c.suit);
        if (mode === 'select') {
          cls += ' selectable';
          if (ui.chosen.indexOf(c.id) !== -1) cls += ' chosen';
        } else {
          if (avail) cls += ' selectable ' + (revealed ? 'revealed' : 'extra');
          else cls += ' disabled-card'; // carte non scelte: faccia visibile, ingrigite e non cliccabili
          if (ui.armedCardId === c.id) cls += ' armed';
        }
        var card = h('div', cls);
        card.appendChild(cardFace(c, isFig));
        var interactive = (mode === 'select') || avail;
        if (interactive) {
          // Hover: evidenzia sul campo le celle abbinabili + tooltip con le condizioni di abbinamento.
          (function (cc) { card.onmouseenter = function () { highlightMatches(playerId, cc); }; card.onmouseleave = clearMatchHints; })(c);
          if (mode === 'action' && avail) attachConditionTip(card, playerId, c);
        }
        card.onclick = function () {
          if (mode === 'select') toggleChosen(playerId, c.id);
          else if (avail) { ui.armedCardId = (ui.armedCardId === c.id) ? null : c.id; render(); }
        };
        body.appendChild(card);
      });
      var layout = h('div', 'act-layout');
      // Riga: [ mano | TOOLS ] (si avvolgono internamente quando è stretto) | conferma/azioni (fisso).
      var row = h('div', 'act-row');
      var main = h('div', 'act-main');
      var handCol = h('div', 'act-hand'); handCol.appendChild(body); main.appendChild(handCol);
      var pwPanel = powersPanel(s, playerId, mode);
      if (pwPanel) main.appendChild(pwPanel);
      var panel = objectsPanel(s, playerId);
      if (panel) main.appendChild(panel);
      row.appendChild(main);
      row.appendChild(handActions(s, playerId, mode));
      layout.appendChild(row);
      setAction(actionTitle(s, p, playerId), layout, null);
    }

    // Intestazione della mano: "Mano — Giocatore X" + seme di appartenenza + personaggio.
    // La descrizione del potere è nel tooltip che esce all'hover del nome del personaggio.
    function actionTitle(s, p, playerId) {
      var wrap = h('span', 'ah-row');
      wrap.appendChild(h('span', 'ah-title', 'STACK — Pilota ' + playerId));
      if (p.belongingSuit) {
        var sd = h('span', 'ah-seed bg-' + p.belongingSuit);
        sd.appendChild(suitIcon(p.belongingSuit, true));
        sd.title = 'ARM SUIT: ' + SUIT_LABEL[p.belongingSuit];
        wrap.appendChild(sd);
      }
      if (p.character) {
        var ch = h('span', 'ah-char');
        ch.appendChild(h('span', 'ah-char-name', charLabel(p.character)));
        if (s.modules.powers && p.character === 'tactician') ch.appendChild(usesDots(p.tacticianTotal, p.tacticianLeft, playerId, 'ai-uses'));
        if (s.modules.powers && p.character === 'brawler') ch.appendChild(usesDots(p.brawlerTotal, p.brawlerLeft, playerId, 'ai-uses'));
        if (s.modules.powers && p.character === 'runner') ch.appendChild(usesDots(p.runnerTotal, p.runnerLeft, playerId, 'ai-uses'));
        if (s.modules.powers) { ch.appendChild(h('span', 'tooltip', characterPowerDesc(p.character))); bindTip(ch); }
        wrap.appendChild(ch);
      }
      return wrap;
    }

    // Selezione unificata. Con Mulligan attivo si può selezionare un numero qualsiasi di carte
    // (esattamente 3 → conferma; ≥1 → mulligan). Senza Mulligan il massimo selezionabile è 3.
    function toggleChosen(playerId, cardId) {
      var i = ui.chosen.indexOf(cardId);
      if (i !== -1) ui.chosen.splice(i, 1);
      else {
        if (!game.state.modules.reshuffle && ui.chosen.length >= game.selectCount(playerId)) return;
        ui.chosen.push(cardId);
      }
      render();
    }

    function handActions(s, playerId, mode) {
      var wrap = h('div', 'act-actions');
      if (mode === 'select') {
        var need = game.selectCount(playerId), k = ui.chosen.length;
        var canResh = s.modules.reshuffle && game.canReshuffle && game.canReshuffle(playerId);
        wrap.appendChild(h('span', 'sel-count', '(' + k + '/' + need + ')')); // solo il conteggio; la descrizione è nella pillola sotto le fasi
        var conf = confirmBtn('Conferma', playerId);
        conf.disabled = k !== need;
        conf.onclick = function () { game.selectCards(playerId, ui.chosen.slice()); ui.selectingPlayer = null; ui.chosen = []; render(); };
        wrap.appendChild(conf);
        // Modulo Mulligan: rimescola le carte SELEZIONATE (≥1); indicatori usi (come nella preview).
        if (s.modules.reshuffle) {
          var pr = s.players[playerId], total = pr.reshuffleTotal || 0, left = pr.reshuffleLeft || 0;
          var ctl = h('div', 'reshuffle-ctl');
          var rs = h('button', 'ghost rs-btn', 'REMIX');
          rs.disabled = !canResh || k < 1;
          rs.title = 'SCARTA le carte selezionate (≥1) e PESCA altrettante carte dal DECK.';
          rs.onclick = function () { game.reshuffleHand(playerId, ui.chosen.slice()); ui.chosen = []; render(); };
          ctl.appendChild(rs);
          ctl.appendChild(usesDots(total, left, playerId));
          wrap.appendChild(ctl);
        }
      } else {
        var list = s.phase === 'move' ? game.legalMoves(playerId) : game.legalShots(playerId);
        var can = list.length > 0;
        var pass = h('button', can ? 'ghost' : 'primary', 'Passa');
        pass.onclick = function () { ui.armedCardId = null; if (s.phase === 'move') game.passMove(playerId); else game.passShoot(playerId); render(); };
        wrap.appendChild(pass);
        // La descrizione dell'azione è nella pillola sotto la barra delle fasi.
      }
      return wrap;
    }

    function renderClashHand(s, chooser) {
      var choices = game.clashChoices(chooser);
      var body = h('div', 'hand');
      choices.forEach(function (c) {
        var card = h('div', 'card selectable ' + (isFigureVal(c.value) ? 'inv suit-bg-' + c.suit : 'suit-' + c.suit) + (ui.armedCardId === c.id ? ' armed' : ''));
        card.appendChild(cardFace(c, isFigureVal(c.value)));
        card.onclick = function () { game.clashChoose(chooser, c.id); ui.clashChooser = null; render(); };
        body.appendChild(card);
      });
      setAction('CLASH — Pilota ' + chooser + ' sceglie la carta dalla STACK DI RISERVA (segreta)', body, null);
    }

    // ---- Griglia click ----
    function onCellClick(x, y) {
      var s = game.state;
      if (s.gameOver || ui.gate) return;
      if (s.subPhase === 'clash-reloc') { if (!isCpu(s.pendingClash.relocatorId) && game.relocationOptions().some(function (o) { return o.x === x && o.y === y; })) { game.clashRelocate(x, y); render(); } return; }
      if (s.subPhase === 'forced-reloc') { if (!isCpu(s.pendingForced.chooserId) && game.relocationOptions().some(function (o) { return o.x === x && o.y === y; })) { game.forcedRelocate(x, y); render(); } return; }
      // Oggetti avanzati: selezione bersagli sulla griglia.
      if (s.subPhase === 'teleport-select') { if (game.teleportTargets().some(function (o) { return o.x === x && o.y === y; })) { game.teleportTo(x, y); render(); } return; }
      if (s.subPhase === 'draft-place') { if (!isCpu(s.pendingDraft.playerId) && game.draftTargets().some(function (o) { return o.x === x && o.y === y; })) { game.draftPlace(x, y); render(); } return; }
      if (s.subPhase === 'rebuild-place') { if (game.rebuildTargets().some(function (o) { return o.x === x && o.y === y; })) { game.rebuildPlace(x, y); render(); } return; }
      if (s.subPhase === 'elemental-target') { if (game.elementalTargetOptions().some(function (o) { return o.x === x && o.y === y; })) { game.elementalTarget(x, y); render(); } return; }
      if (s.subPhase === 'barrage-first') { if (game.barrageFirstOptions().some(function (o) { return o.x === x && o.y === y; })) { game.barrageFirst(x, y); render(); } return; }
      if (s.subPhase === 'barrage-third') { if (game.barrageThirdOptions().some(function (o) { return o.x === x && o.y === y; })) { game.barrageThird(x, y); render(); } return; }
      if (s.subPhase === 'randomizer-select') { if (game.randomizerSelectOptions().some(function (o) { return o.x === x && o.y === y; })) { game.randomizerToggle(x, y); render(); } return; }
      if (s.subPhase === 'randomizer-place') {
        var prk = x + ',' + y, pr = s.pendingRandomizer;
        if (pr.placed[prk]) { game.randomizerUnplace(x, y); render(); return; }        // rimetti nel tray
        if (ui.selectedDrawn && pr.chosen.some(function (o) { return o.key === prk; })) { try { game.randomizerPlace(ui.selectedDrawn, x, y); ui.selectedDrawn = null; render(); } catch (e) { } }
        return;
      }
      if (s.subPhase) return;
      // Brawler wildcard: clicca un bersaglio evidenziato.
      if (ui.brawlerMode && (s.phase === 'move' || s.phase === 'attack') && !isCpu(s.activePlayer)) {
        if (game.brawlerTargets(s.activePlayer).some(function (o) { return o.x === x && o.y === y; })) { game.brawlerAction(s.activePlayer, x, y); ui.brawlerMode = false; render(); }
        return;
      }
      if ((s.phase === 'move' || s.phase === 'attack') && ui.armedCardId && !isCpu(s.activePlayer)) {
        var key = x + ',' + y;
        var list = s.phase === 'move' ? game.legalMoves(s.activePlayer) : game.legalShots(s.activePlayer);
        var m = list.filter(function (e) { return e.key === key && e.cardIds.indexOf(ui.armedCardId) !== -1; })[0];
        if (!m) return;
        var card = ui.armedCardId; ui.armedCardId = null;
        if (s.phase === 'move') game.move(s.activePlayer, x, y, card);
        else { var sc = game.pawnCell(s.activePlayer); if (sc) ui.pendingShot = { from: { x: sc.x, y: sc.y }, to: { x: x, y: y } }; game.shoot(s.activePlayer, x, y, card); }
        render();
      }
    }

    // ============================================================ ANIMAZIONI + HOVER
    function cellEl(x, y) { return dom.board.querySelector('[data-xy="' + x + ',' + y + '"]'); }
    function cellCenter(x, y) { var e = cellEl(x, y); if (!e) return null; var r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

    // Evidenzia le celle abbinabili dalla carta, tenendo conto di TUTTE le condizioni correnti:
    // poteri (runner: pari in movimento), seme di turno/appartenenza, e — in fase di movimento —
    // le celle raggiungibili con l'eventuale modificatore attivo (jetpack/jump).
    function highlightMatches(playerId, card) {
      if (!VIEW.showMatches) return;
      var s = game.state;
      clearMatchHints();
      var cells = [];
      if (s.phase === 'move' && s.activePlayer === playerId && ENG) {
        var pc = game.pawnCell(playerId);
        if (pc) game.moveDestinationsFor(playerId).forEach(function (d) { cells.push(d); });
      } else {
        for (var x = 1; x <= s.gridSize; x++) for (var y = 1; y <= s.gridSize; y++) cells.push([x, y]);
      }
      cells.forEach(function (d) {
        if (game._matches(playerId, card, game.getCell(d[0], d[1]))) { var e = cellEl(d[0], d[1]); if (e) e.classList.add('match-hint'); }
      });
    }
    function clearMatchHints() { var ns = dom.board.querySelectorAll('.match-hint'); for (var i = 0; i < ns.length; i++) ns[i].classList.remove('match-hint'); }

    // Condizioni per cui una carta può abbinare una cella (valore, semi jolly, poteri).
    function conditionParts(playerId, card) {
      var s = game.state, p = s.players[playerId], parts = [];
      parts.push({ text: 'VALORE ' + card.value });
      if (card.suit === s.currentSuit) parts.push({ suit: s.currentSuit, label: 'GLOBAL SUIT' });
      if (p.belongingSuit && card.suit === p.belongingSuit) parts.push({ suit: p.belongingSuit, label: 'ARM SUIT' });
      if (s.modules.powers && card.value % 2 === 0) {
        if (p.character === 'fighter') parts.push({ text: 'PARI↔PARI (Soldier Boy, ATTACCO)' });
      }
      return parts;
    }
    // Riga di condizioni (semi colorati + simbolo, testo separato da virgole).
    function condLine(parts) {
      var line = h('span', 'cond-line');
      parts.forEach(function (part, i) {
        if (i) line.appendChild(document.createTextNode(', '));
        if (part.suit) {
          var span = h('span', 'cond-suit suit-' + part.suit);
          var ic = suitIcon(part.suit); ic.classList.add('cond-ic'); span.appendChild(ic);
          span.appendChild(document.createTextNode(' ' + SUIT_LABEL[part.suit] + ' (' + part.label + ')'));
          line.appendChild(span);
        } else line.appendChild(document.createTextNode(part.text));
      });
      return line;
    }
    // Aggancia a una carta della mano un tooltip con le sue condizioni di abbinamento.
    function attachConditionTip(node, playerId, card) {
      if (!VIEW.showConditions) return;
      var tip = h('span', 'tooltip cond-tip');
      tip.appendChild(h('span', 'cond-title', 'MATCH se:'));
      tip.appendChild(condLine(conditionParts(playerId, card)));
      node.appendChild(tip); bindTip(node);
    }

    // Motivi per cui le carte disponibili del giocatore abbinano una CELLA (deduplicati).
    function cellConditionParts(playerId, cell) {
      var s = game.state, p = s.players[playerId];
      if (!cell || cell.destroyed || !cell.card) return [];
      var avail = game.availableRevealed(playerId), order = [], seen = {};
      function add(key, part) { if (!seen[key]) { seen[key] = true; order.push(part); } }
      avail.forEach(function (c) {
        if (!game._matches(playerId, c, cell)) return;
        var isJolly = c.suit === s.currentSuit || (p.belongingSuit && c.suit === p.belongingSuit);
        if (cell.faceDown) {
          if (isJolly) add('fd', { text: 'CELLA OFFLINE (SUIT jolly)' });
        } else {
          if (c.value === cell.card.value) add('v', { text: 'VALORE ' + cell.card.value });
          if (isJolly && c.suit === cell.card.suit) add('s' + c.suit, { suit: c.suit, label: 'jolly' });
          if (s.modules.powers && c.value % 2 === 0 && cell.card.value % 2 === 0) {
            if (p.character === 'fighter' && s.phase === 'attack') add('pw', { text: 'PARI↔PARI (Soldier Boy)' });
          }
        }
      });
      return order;
    }
    // Aggancia a una cella della griglia un tooltip: motivi del match e/o bonus di fine ROUND.
    function attachCellConditionTip(node, playerId, cell, condOk) {
      var wantCond = condOk && VIEW.showConditions, wantBonus = VIEW.showCellBonus && cell.card && !cell.faceDown;
      if (!wantCond && !wantBonus) return;
      var tip = h('span', 'tooltip cond-tip');
      if (wantCond) {
        var parts = cellConditionParts(playerId, cell);
        if (!parts.length) tip.appendChild(h('span', 'cond-nomatch', 'Nessun MATCH'));
        else { tip.appendChild(h('span', 'cond-title', 'MATCH perché:')); tip.appendChild(condLine(parts)); }
      }
      if (wantBonus) {
        var bt = h('span', 'cond-bonus');
        bt.appendChild(h('span', 'cond-title', 'Bonus fine ROUND: '));
        var suit = cell.card.suit, bs = h('span', 'suit-' + suit, END_BONUS_BY_SUIT[suit] || '—');
        bt.appendChild(bs);
        tip.appendChild(bt);
      }
      node.appendChild(tip); bindTip(node);
    }

    // Tooltip a posizione fissa: mostrati agganciati al rect del genitore e clampati al viewport (mai tagliati).
    function bindTip(parent) {
      var tip = parent.querySelector('.tooltip'); if (!tip) return;
      parent.addEventListener('mouseenter', function () { showTip(parent, tip); });
      parent.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    }
    function showTip(parent, tip) {
      tip.style.display = 'block'; tip.style.visibility = 'hidden'; tip.style.left = '0'; tip.style.top = '0';
      var r = parent.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      var left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - tw - 8));
      var top = r.top - th - 8; if (top < 8) top = r.bottom + 8;
      // Clamp verticale: il tooltip resta dentro il viewport (evita scrollbar di pagina e reflow).
      top = Math.min(top, window.innerHeight - th - 8); if (top < 8) top = 8;
      tip.style.left = left + 'px'; tip.style.top = top + 'px'; tip.style.visibility = '';
    }

    // Dopo ogni render: anima gli spostamenti pedina (diff), i flip delle carte (diff) e l'eventuale sparo.
    function postRenderAnimations() {
      var s = game.state;
      game.allPlayers().forEach(function (id) {
        var pc = game.pawnCell(id), cur = pc ? { x: pc.x, y: pc.y } : null;
        var prev = ui.lastPawns && ui.lastPawns[id];
        if (prev && cur && (prev.x !== cur.x || prev.y !== cur.y)) flyPawn(prev, cur, id);
        if (!ui.lastPawns) ui.lastPawns = {}; ui.lastPawns[id] = cur;
      });
      var nowFD = {}, gN = game.state.gridSize;
      for (var x = 1; x <= gN; x++) for (var y = 1; y <= gN; y++) if (game.getCell(x, y).faceDown) nowFD[x + ',' + y] = 1;
      if (ui.lastFaceDown) Object.keys(nowFD).forEach(function (k) { if (!ui.lastFaceDown[k]) flipCell(k); });
      ui.lastFaceDown = nowFD;
      if (ui.pendingShot) { flyShot(ui.pendingShot.from, ui.pendingShot.to); ui.pendingShot = null; }
    }

    // Scala la griglia perché l'intero gioco occupi l'altezza della finestra (senza scroll).
    // I pannelli attorno (HUD, timeline, azione) hanno altezze indipendenti dalla cella: misuro
    // lo spazio residuo e ne ricavo la dimensione di --cell (con vincolo anche sulla larghezza).
    function fitLayout() {
      var root = document.documentElement;
      if (window.innerWidth < 940) { root.style.removeProperty('--cell'); return; } // layout mobile: gestito dal CSS
      // La griglia è N×N (5 di default, 4 nella variante del Ruleset C): scala la cella
      // in base al numero di righe/colonne così che il campo riempia l'altezza in ogni caso.
      var N = (game.state && game.state.gridSize) || 5;
      var appPad = 8, gap = 8, rowGap = 12, gridPad = 8, gridGap = 6;
      var boardWrap = document.querySelector('.board-wrap');
      if (!boardWrap) return;
      var boardH = dom.board.getBoundingClientRect().height;
      var sideExtra = boardWrap.getBoundingClientRect().height - boardH; // etichette Nord/Sud + gap del board-wrap
      var availH = window.innerHeight - appPad * 2
        - dom.hud.getBoundingClientRect().height
        - dom.timeline.getBoundingClientRect().height
        - dom.action.getBoundingClientRect().height
        - gap * 3 - sideExtra - 2; // 2px di margine di sicurezza (arrotondamenti)
      var cellByH = Math.floor((availH - gridPad * 2 - gridGap * (N - 1)) / N);
      // Vincolo di larghezza: la griglia deve stare nella colonna insieme alle pile ai lati.
      var colW = boardWrap.getBoundingClientRect().width;
      var pilesW = dom.piles ? dom.piles.getBoundingClientRect().width : 0;
      var objW = dom.objectPiles ? dom.objectPiles.getBoundingClientRect().width : 0;
      var cellByW = Math.floor((colW - pilesW - objW - rowGap * 2 - gridPad * 2 - gridGap * (N - 1)) / N);
      // Con meno righe la cella può crescere di più senza uscire dalla finestra.
      var maxCell = N === 4 ? 220 : 150;
      var cell = Math.max(52, Math.min(maxCell, Math.min(cellByH, cellByW)));
      root.style.setProperty('--cell', cell + 'px');
    }

    // Overlay "Mostra azioni": linee per i movimenti, pallini per gli spari; colori per giocatore,
    // segmenti via via più scuri quanto più l'azione è "vecchia".
    function renderActionsOverlay() {
      var NS = 'http://www.w3.org/2000/svg';
      var old = dom.board.querySelector('.actions-overlay'); if (old) old.remove();
      if (!VIEW.showActions) return;
      var trail = game.state.trail || [];
      if (!trail.length) return;
      var W = dom.board.clientWidth, H = dom.board.clientHeight; if (!W || !H) return;
      function center(x, y) { var e = cellEl(x, y); if (!e) return null; return { x: e.offsetLeft + e.offsetWidth / 2, y: e.offsetTop + e.offsetHeight / 2 }; }
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'actions-overlay');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var n = trail.length;
      trail.forEach(function (a, i) {
        var f = 0.5 + 0.5 * (n <= 1 ? 1 : i / (n - 1)); // vecchio→scuro (0.5), recente→pieno (1)
        var rgb = PLAYER_RGB[a.p] || [230, 230, 230];
        var col = 'rgb(' + Math.round(rgb[0] * f) + ',' + Math.round(rgb[1] * f) + ',' + Math.round(rgb[2] * f) + ')';
        if (a.t === 'move' && a.from && a.to) {
          var p1 = center(a.from.x, a.from.y), p2 = center(a.to.x, a.to.y); if (!p1 || !p2) return;
          var ln = document.createElementNS(NS, 'line');
          ln.setAttribute('x1', p1.x); ln.setAttribute('y1', p1.y); ln.setAttribute('x2', p2.x); ln.setAttribute('y2', p2.y);
          ln.setAttribute('stroke', col); ln.setAttribute('stroke-width', '3'); ln.setAttribute('stroke-linecap', 'round');
          svg.appendChild(ln);
          var d2 = document.createElementNS(NS, 'circle');
          d2.setAttribute('cx', p2.x); d2.setAttribute('cy', p2.y); d2.setAttribute('r', '4'); d2.setAttribute('fill', col);
          svg.appendChild(d2);
        } else if (a.t === 'shot' && a.to) {
          var c = center(a.to.x, a.to.y); if (!c) return;
          var ring = document.createElementNS(NS, 'circle');
          ring.setAttribute('cx', c.x); ring.setAttribute('cy', c.y); ring.setAttribute('r', '8');
          ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', col); ring.setAttribute('stroke-width', '3');
          svg.appendChild(ring);
          var dot = document.createElementNS(NS, 'circle');
          dot.setAttribute('cx', c.x); dot.setAttribute('cy', c.y); dot.setAttribute('r', '3.5'); dot.setAttribute('fill', col);
          svg.appendChild(dot);
        }
      });
      dom.board.appendChild(svg);
    }

    function flyPawn(from, to, id) {
      var a = cellCenter(from.x, from.y), b = cellCenter(to.x, to.y); if (!a || !b) return;
      var destCell = cellEl(to.x, to.y), realPawn = destCell && destCell.querySelector('.pawn');
      if (realPawn) realPawn.style.visibility = 'hidden';
      var clone = h('div', 'anim-pawn ' + id, id);
      clone.style.left = (a.x - 15) + 'px'; clone.style.top = (a.y - 15) + 'px';
      document.body.appendChild(clone);
      requestAnimationFrame(function () { clone.style.transform = 'translate(' + (b.x - a.x) + 'px,' + (b.y - a.y) + 'px)'; });
      setTimeout(function () { clone.remove(); if (realPawn) realPawn.style.visibility = ''; }, 380);
    }
    function flyShot(from, to) {
      var a = cellCenter(from.x, from.y), b = cellCenter(to.x, to.y); if (!a || !b) return;
      var dot = h('div', 'anim-shot');
      dot.style.left = (a.x - 6) + 'px'; dot.style.top = (a.y - 6) + 'px';
      document.body.appendChild(dot);
      requestAnimationFrame(function () { dot.style.transform = 'translate(' + (b.x - a.x) + 'px,' + (b.y - a.y) + 'px)'; });
      setTimeout(function () { dot.style.opacity = '0'; }, 200);
      setTimeout(function () { dot.remove(); }, 430);
    }
    function flipCell(k) {
      var p = k.split(','), e = cellEl(p[0], p[1]); if (!e) return;
      e.classList.add('flipping'); setTimeout(function () { e.classList.remove('flipping'); }, 440);
    }

    // ---- Finestra di confronto del clash ----
    // Carta statica (stile identico alle carte della mano) per le schede del clash.
    function clashCardEl(c) {
      if (!c) return h('div', 'clash-card-empty', 'nessuna carta');
      var el = h('div', 'card ' + (isFigureVal(c.value) ? 'inv suit-bg-' + c.suit : 'suit-' + c.suit));
      el.appendChild(cardFace(c, isFigureVal(c.value)));
      return el;
    }
    function clashPanel(r, role) {
      var id = role === 'att' ? r.attackerId : r.defenderId;
      var card = role === 'att' ? r.attCard : r.defCard;
      var lost = (r.outcome !== 'tie') &&
        ((role === 'att' && r.outcome === 'defender') || (role === 'def' && r.outcome === 'attacker'));
      var p = h('div', 'clash-panel' + (lost ? ' loser' : ''));
      var head = h('div', 'clash-panel-head');
      var dot = h('span', 'clash-pdot'); dot.style.background = PLAYER_COLOR[id];
      head.appendChild(dot);
      head.appendChild(h('span', 'clash-panel-name', 'Pilota ' + id));
      head.appendChild(h('span', 'clash-panel-role', role === 'att' ? 'attaccante' : 'difensore'));
      p.appendChild(head);
      var wrap = h('div', 'clash-card-wrap'); wrap.appendChild(clashCardEl(card)); p.appendChild(wrap);
      return p;
    }
    function clashResultText(r) {
      if (r.outcome === 'tie') return 'Pareggio: nessuno si sposta';
      var winId = r.outcome === 'attacker' ? r.attackerId : r.defenderId;
      var role = r.outcome === 'attacker' ? 'attaccante' : 'difensore';
      return 'Vince il clash: Pilota ' + winId + ' (' + role + ')';
    }
    function closeClashModal() { ui.clashModal = null; renderClashModal(); render(); }
    function buildClashModal(r) {
      var back = h('div', 'dialog-back clash-modal-back');
      var box = h('div', 'dialog clash-modal');
      var head = h('div', 'rules-head'); head.appendChild(h('h2', null, 'Risultato')); box.appendChild(head);
      box.appendChild(h('div', 'clash-result' + (r.outcome === 'tie' ? ' tie' : ''), clashResultText(r)));
      var row = h('div', 'clash-row');
      row.appendChild(clashPanel(r, 'att'));
      row.appendChild(h('div', 'clash-vs', '×'));
      row.appendChild(clashPanel(r, 'def'));
      box.appendChild(row);
      var cont = h('button', 'primary clash-continue', 'Continua');
      cont.onclick = closeClashModal;
      box.appendChild(cont);
      back.appendChild(box);
      return back;
    }
    function renderClashModal() {
      var existing = document.querySelector('.clash-modal-back');
      if (!ui.clashModal) { if (existing) { existing.remove(); document.removeEventListener('keydown', onClashKey); } return; }
      if (existing) return;
      document.body.appendChild(buildClashModal(ui.clashModal));
      document.addEventListener('keydown', onClashKey);
    }
    function onClashKey(e) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closeClashModal(); } }

    // ---- Tactician: modale con le carte di riserva dell'avversario ----
    function closePeekModal() { ui.peekModal = null; renderTacticianModal(); render(); }
    function buildPeekModal(r) {
      var back = h('div', 'dialog-back peek-modal-back');
      var box = h('div', 'dialog peek-modal');
      var head = h('div', 'rules-head'); head.appendChild(h('h2', null, 'STACK DI RISERVA avversarie')); box.appendChild(head);
      // Multiplayer: mostra la riserva di TUTTI gli altri giocatori; fallback al formato 2 giocatori.
      var hands = r.hands || [{ playerId: r.opponentId, cards: r.cards || [] }];
      hands.forEach(function (hnd) {
        box.appendChild(h('div', 'peek-sub', 'Pilota ' + hnd.playerId + ' (' + (SEAT_LABEL[hnd.playerId] || hnd.playerId) + ') — ' + hnd.cards.length + ' carte'));
        var row = h('div', 'peek-row');
        if (!hnd.cards.length) row.appendChild(h('div', 'hint', 'Nessuna carta nella STACK DI RISERVA.'));
        hnd.cards.forEach(function (c) { row.appendChild(clashCardEl(c)); });
        box.appendChild(row);
      });
      var cont = h('button', 'primary clash-continue', 'Chiudi');
      cont.onclick = closePeekModal;
      box.appendChild(cont);
      back.appendChild(box);
      return back;
    }
    function renderTacticianModal() {
      var existing = document.querySelector('.peek-modal-back');
      if (!ui.peekModal) { if (existing) { existing.remove(); document.removeEventListener('keydown', onPeekKey); } return; }
      if (existing) return;
      document.body.appendChild(buildPeekModal(ui.peekModal));
      document.addEventListener('keydown', onPeekKey);
    }
    function onPeekKey(e) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closePeekModal(); } }

    // ---- Overlay: gate + finale ----
    function openGate(text, button, onShow) { ui.gate = { text: text, button: button, onShow: onShow }; renderGate(); }
    function renderGate() {
      var g = ui.gate; dom.sheet.innerHTML = '';
      dom.sheet.appendChild(h('h2', null, '🔒 Informazione nascosta'));
      dom.sheet.appendChild(h('p', null, g.text));
      dom.sheet.appendChild(h('div', 'big', '📱→'));
      var btn = h('button', 'primary', g.button);
      btn.onclick = function () { var cb = ui.gate.onShow; ui.gate = null; cb(); };
      dom.sheet.appendChild(btn); showOverlay();
    }
    function objTypeLabel(type) { var d = OBJ ? OBJ.def(type) : null; return (d && d.label) ? d.label : type; }
    function objDetailText(st) {
      var keys = Object.keys(st.objByType || {});
      if (!keys.length) return '—';
      keys.sort(function (a, b) { return st.objByType[b] - st.objByType[a]; });
      return keys.map(function (t) { return objTypeLabel(t) + ' ×' + st.objByType[t]; }).join(', ');
    }
    function renderFinal(s) {
      var r = s.result; dom.sheet.innerHTML = '';
      dom.sheet.appendChild(h('h2', 'final-title', 'Fine partita'));
      dom.sheet.appendChild(h('div', 'setup-divider'));
      dom.sheet.appendChild(h('h2', 'win', r.winner ? 'Vince il Pilota ' + r.winner : 'Patta'));
      if (r.tiebreak && r.tiebreak !== 'patta') dom.sheet.appendChild(h('p', 'final-tiebreak', 'Spareggio: ' + (r.tiebreak === 'centro' ? 'ha conquistato il centro.' : 'più OBIETTIVI.')));
      dom.sheet.appendChild(h('p', 'final-summary', r.summary));

      // Una scheda per PILOTA (ordinate per classifica finale), stile allineato ai Batch Test.
      var cards = h('div', 'final-cards' + (game.allPlayers().length > 2 ? ' final-cards-multi' : ''));
      (r.ranking && r.ranking.length ? r.ranking : game.allPlayers()).forEach(function (id) {
        var p = s.players[id], st = p.stats;
        var card = h('div', 'final-card' + (r.winner === id ? ' win' : ''));
        var head = h('div', 'final-card-head');
        var badge = h('span', 'fc-badge');
        var fdot = h('span', 'pc-player-dot'); fdot.style.background = PLAYER_COLOR[id] || '#888'; badge.appendChild(fdot);
        badge.appendChild(document.createTextNode('Pilota ' + id));
        head.appendChild(badge);
        head.appendChild(h('span', 'fc-arm', charLabel(p.character)));
        head.appendChild(h('span', 'fc-suit', SUIT_LABEL[p.belongingSuit] || '—'));
        card.appendChild(head);

        var tbl = h('table', 'batch-table final-table');
        function frow(k, v, cls) {
          var tr = h('tr', cls || null);
          tr.appendChild(h('td', 'bt-k', k));
          tr.appendChild(h('td', 'bt-v', v));
          tbl.appendChild(tr);
        }
        frow('Punti totali', String(p.score), 'fc-strong');
        frow('↳ da colpo su avversario', String(st.ptsPawn), 'fc-sub');
        frow('↳ da colpo su OBIETTIVI', String(st.ptsFigure), 'fc-sub');
        frow('↳ da CELLE BONUS', String(st.ptsBonus), 'fc-sub');
        frow('TROFEI', String(p.trophies.length));
        frow('MOVIMENTI', String(st.moves));
        frow('ATTACCHI', String(st.attacks));
        frow('TOOLS usati', String(st.objUses));
        frow('↳ dettaglio', objDetailText(st), 'fc-sub fc-detail');
        frow('TURNI a 0 azioni', String(st.zeroActionTurns));
        card.appendChild(tbl);
        cards.appendChild(card);
      });
      dom.sheet.appendChild(cards);

      var actions = h('div', 'final-actions');
      var rematch = h('button', 'primary', '↻ Rematch');
      rematch.title = 'Nuova partita con le stesse impostazioni.';
      rematch.onclick = function () { if (opts.onRematch) opts.onRematch(); else location.reload(); };
      var back = h('button', 'ghost', '← Back');
      back.title = 'Torna alla configurazione della partita.';
      back.onclick = function () { if (opts.onBack) opts.onBack(); else location.reload(); };
      actions.appendChild(rematch); actions.appendChild(back);
      dom.sheet.appendChild(actions); showOverlay();
    }
    function showOverlay() { dom.overlay.hidden = false; }
    function hideOverlay() { dom.overlay.hidden = true; }
    function isCenter(x, y) { return game.state.gridSize === 5 && x === 3 && y === 3; }
    function isBonusCell(x, y) { return game.state.gridSize === 4 && x >= 2 && x <= 3 && y >= 2 && y <= 3; }
    // Celle bonus del Ruleset C (punti-posizione): 5×5 centro+adiacenti, 4×4 le 4 centrali.
    function isPositionBonusCell(x, y) {
      return ENG ? ENG.isPositionBonusCell(x, y, game.state.gridSize)
                 : (game.state.gridSize === 4 ? isBonusCell(x, y) : (isCenter(x, y) || Math.abs(x - 3) + Math.abs(y - 3) === 1));
    }
    // Ruleset C: punti che la posizione attuale della pedina darà a fine turno (0 = nessuno).
    // 5×5: centro +3, adiacente ortogonale al centro +1. 4×4: cella bonus +2.
    function pendingPositionBonus(s, id) {
      if (s.ruleset !== 'C') return 0;
      var pc = game.pawnCell(id); if (!pc) return 0;
      if (s.gridSize === 4) return isBonusCell(pc.x, pc.y) ? 2 : 0;
      if (isCenter(pc.x, pc.y)) return 3;
      if (Math.abs(pc.x - 3) + Math.abs(pc.y - 3) === 1) return 1;
      return 0;
    }

    // ============================================================ UNDO / ripristino
    function resetUiTransient() {
      ui.armedCardId = null; ui.chosen = []; ui.selectingPlayer = null; ui.clashChooser = null;
      ui.reshuffleMode = null; ui.reshuffleSel = [];
      ui.gate = null; ui.pendingShot = null; ui.brawlerMode = false; ui.selectedDrawn = null;
      ui.clashModal = null; // chiudi l'eventuale finestra di confronto del clash
      ui.peekModal = null;  // chiudi l'eventuale modale "riserva avversaria" del tactician
    }
    function afterRestore() {
      if (ui.cpuTimer) { clearTimeout(ui.cpuTimer); ui.cpuTimer = null; }
      resetUiTransient();
      ui.lastPawns = null; ui.lastFaceDown = null; // ri-baseline animazioni: nessuna animazione al ripristino
      render();
    }
    function doUndo() {
      if (!game.canUndo()) return;
      game.undo();
      // Contro la CPU, salta indietro sugli stati in cui tocca alla CPU fino alla decisione umana.
      if (ui.mode === 'cpu') { var guard = 0; while (game.canUndo() && cpuActor(game.state) && guard++ < 200) game.undo(); }
      afterRestore();
    }
    function doRestoreLog(i) {
      if (!game.restoreToLogIndex(i)) return;
      if (ui.mode === 'cpu') { var guard = 0; while (game.canUndo() && cpuActor(game.state) && guard++ < 200) game.undo(); }
      afterRestore();
    }

    // ============================================================ CPU
    function scheduleCpu() {
      if (ui.cpuTimer) { clearTimeout(ui.cpuTimer); ui.cpuTimer = null; }
      if (ui.mode !== 'cpu' && ui.mode !== 'cpucpu') return;
      var s = game.state;
      if (s.gameOver || ui.gate || ui.clashModal || ui.peekModal) return;
      if (!cpuActor(s)) return;
      ui.cpuTimer = setTimeout(function () { ui.cpuTimer = null; cpuStep(); }, ui.cpuDelay || 600);
    }
    // Chi deve agire adesso secondo lo stato (indipendentemente da chi è CPU).
    function engineActor(s) {
      if (s.gameOver) return null;
      if (s.subPhase === 'object-discard') return s.pendingObjectDiscard.playerId;
      if (s.subPhase === 'end-discard') return s.pendingEndDiscard ? s.pendingEndDiscard.playerId : null;
      if (s.subPhase === 'rebuild-select' || s.subPhase === 'rebuild-place') return s.pendingRebuild ? s.pendingRebuild.playerId : null;
      if (s.subPhase === 'draft-select' || s.subPhase === 'draft-place') return s.pendingDraft ? s.pendingDraft.playerId : null;
      if (s.subPhase === 'energy-target') return s.pendingEnergy ? s.pendingEnergy.playerId : null;
      if (s.subPhase === 'endbonus-steal') return s.pendingEndBonus ? s.pendingEndBonus.playerId : null;
      if (s.subPhase === 'tool-discard') return s.pendingToolDiscard && s.pendingToolDiscard.playerId;
      if (s.subPhase === 'runner-figure') return s.pendingRunner && s.pendingRunner.playerId;
      if (s.subPhase === 'timebomb-suit') return s.pendingTimebomb.playerId;
      if (s.subPhase === 'teleport-select') return s.pendingTeleport ? s.pendingTeleport.playerId : null;
      if (s.subPhase === 'elemental-target' || s.subPhase === 'elemental-suit') return s.pendingElemental ? s.pendingElemental.playerId : null;
      if (s.subPhase === 'barrage-first' || s.subPhase === 'barrage-second' || s.subPhase === 'barrage-third') return s.pendingBarrage ? s.pendingBarrage.playerId : null;
      if (s.subPhase === 'randomizer-select' || s.subPhase === 'randomizer-place') return s.pendingRandomizer ? s.pendingRandomizer.playerId : null;
      if (s.subPhase === 'altmatch-object') return s.pendingAltMatch ? s.pendingAltMatch.playerId : null;
      if (s.subPhase === 'clash-cards') return game.clashCurrentChooser();
      if (s.subPhase === 'clash-reloc') return s.pendingClash.relocatorId;
      if (s.subPhase === 'forced-reloc') return s.pendingForced.chooserId;
      if (s.subPhase) return null;
      if (s.phase === 'select') { var ap = game.allPlayers(); for (var i = 0; i < ap.length; i++) if (s.selected[ap[i]] == null) return ap[i]; return null; }
      if (s.phase === 'move' || s.phase === 'attack') return s.activePlayer;
      return null;
    }
    // Il giocatore CPU che deve agire ora (o null): in 'cpucpu' entrambi sono CPU.
    function cpuActor(s) { var a = engineActor(s); return (a && isCpu(a)) ? a : null; }
    function cpuStep() {
      var Cpu = window.CradleCpu, c = cpuActor(game.state);
      if (!c) { render(); return; }
      try {
        var r = Cpu.cpuAct(game, c); // esegue una singola azione (oggetti/poteri inclusi)
        if (r && r.type === 'shoot' && r.from) ui.pendingShot = { from: r.from, to: r.to };
      } catch (e) { if (window.console) console.error('CPU error:', e); }
      render();
    }

    // Rilascia il controller (usato tornando al configuratore): ferma eventuali timer CPU pendenti.
    function dispose() { if (ui.cpuTimer) { clearTimeout(ui.cpuTimer); ui.cpuTimer = null; } }
    return { render: render, dispose: dispose };
  }

  return { createController: createController, objectCardEl: objectCardEl, moveSchema: moveSchema, openRulesDialog: openRulesDialog };
});

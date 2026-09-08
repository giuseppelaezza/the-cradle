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
  // Colore associato a ciascun giocatore (arancione/viola per non confondersi con i semi).
  var PLAYER_COLOR = { N: 'var(--pN)', S: 'var(--pS)' };
  var PLAYER_TEXT = { N: '#1a1a1a', S: '#ffffff' };
  // Preferenze di visualizzazione condivise (persistono tra partite nella stessa sessione).
  var VIEW = { showMatches: true, showLabels: false, cardDouble: false };

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

  function createController(game, opts) {
    opts = opts || {};
    var ui = {
      mode: opts.mode || '2p', cpuId: opts.cpuId || 'S', humanId: (opts.cpuId === 'N' ? 'S' : 'N'),
      cpuTimer: null, gate: null, chosen: [], selectingPlayer: null, clashChooser: null, armedCardId: null,
      // stato per le animazioni (diff tra render)
      lastPawns: null, lastFaceDown: null, lastRound: null, pendingShot: null, flashingEnd: false, tlSegs: null
    };
    function isCpu(id) { return ui.mode === 'cpu' && id === ui.cpuId; }

    var dom = {
      hud: el('hud'), board: el('board'), sideTop: el('sideTop'), sideBottom: el('sideBottom'),
      action: el('action'), log: el('log'), overlay: el('overlay'), sheet: el('sheet'),
      timeline: el('timeline'), piles: el('piles')
    };

    // ============================================================ RENDER
    function render() { renderBody(); postRenderAnimations(); scheduleCpu(); }

    function renderBody() {
      var s = game.state;
      renderHud(s); renderBoard(s); renderPiles(s); renderTimeline(s); renderLog(s);
      if (s.gameOver) { renderFinal(s); return; }
      hideOverlay();
      if (ui.gate) { renderGate(); return; }
      renderActionArea(s);
    }

    // ---- HUD ----
    function renderHud(s) {
      dom.hud.innerHTML = '';
      var top = h('div', 'hud-top');
      top.appendChild(pill('Round', s.round + '/9'));
      top.appendChild(pill('Turno', s.gameOver ? '—' : s.activePlayer));
      // Seme di turno: etichetta colorata + icona del seme.
      var sp = h('span', 'pill'); sp.appendChild(document.createTextNode('Seme di turno: '));
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
      rules.onclick = openRulesDialog;
      top.appendChild(rules);
      dom.hud.appendChild(top);

      var pl = h('div', 'players');
      ['N', 'S'].forEach(function (id) { pl.appendChild(playerCard(s, id)); });
      dom.hud.appendChild(pl);
    }

    function phaseLabel(s) {
      var base = { select: 'Selezione carte', move: 'Movimento', attack: 'Attacco', end: 'Fine' }[s.phase];
      if (s.subPhase === 'object-window') return 'Uso oggetto (' + s.window.phase + ')';
      if (s.subPhase === 'clash-cards') return 'Clash — carta';
      if (s.subPhase === 'clash-reloc') return 'Clash — ricollocazione';
      if (s.subPhase === 'forced-reloc') return 'Spostamento forzato';
      if (s.subPhase === 'object-discard') return 'Scarto oggetto';
      if (s.subPhase === 'timebomb-suit') return 'Timebomb';
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
      if (s.firstPlayer === id) band.textContent = '1° giocatore';
      card.appendChild(band);

      var body = h('div', 'pc-body');

      // ---- Riga superiore: seed | nome + punti/trofei | badge CPU ----
      var top = h('div', 'pc-top');
      var seed = h('div', 'pc-seed' + (p.belongingSuit ? '' : ' empty'));
      if (p.belongingSuit) { var sb = h('span', 'seed-badge bg-' + p.belongingSuit); sb.appendChild(suitIcon(p.belongingSuit, true)); seed.appendChild(sb); seed.title = 'Seme di appartenenza: ' + SUIT_LABEL[p.belongingSuit]; }
      else seed.textContent = '—';
      top.appendChild(seed);

      var main = h('div', 'pc-main');
      main.appendChild(h('div', 'pc-name', 'Giocatore ' + id + (id === 'N' ? ' (Nord)' : ' (Sud)')));
      var stats = h('div', 'pc-stats');
      var st1 = h('div', 'pc-stat'); st1.appendChild(h('span', 'pc-num', String(p.score))); st1.appendChild(h('span', 'pc-unit', ' punti'));
      var st2 = h('div', 'pc-stat'); st2.appendChild(h('span', 'pc-num', String(p.trophies.length))); st2.appendChild(h('span', 'pc-unit', ' trofei'));
      st2.title = 'Figure ' + p.figuresMatched + (p.matchedCenter ? ' · ★ Centro' : '');
      stats.appendChild(st1); stats.appendChild(st2);
      main.appendChild(stats);
      top.appendChild(main);
      if (isCpu(id)) top.appendChild(h('div', 'pc-cpu', 'CPU'));
      body.appendChild(top);

      // ---- Riga inferiore: character | hand | tools ----
      var bottom = h('div', 'pc-bottom');
      // character (con tooltip del potere)
      var chCell = h('div', 'pc-cell pc-char');
      if (p.character) {
        chCell.appendChild(h('span', 'pc-char-name', p.character));
        chCell.appendChild(h('span', 'tooltip', characterPowerDesc(p.character)));
        bindTip(chCell);
      } else chCell.appendChild(h('span', 'muted', '—'));
      bottom.appendChild(chCell);
      // hand (carte scelte pubbliche: sempre tutte e 3, quelle usate sbarrate)
      var handCell = h('div', 'pc-cell pc-hand');
      if (p.revealedCards && p.revealedCards.length) p.revealedCards.forEach(function (c) { if (c) handCell.appendChild(miniCard(c, !p.hand.some(function (x) { return x.id === c.id; }))); });
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
        if (o.type === 'jetpack' || o.type === 'jump') tip.appendChild(moveSchema(o.type));
        box.appendChild(tip);
        container.appendChild(box); bindTip(box);
      });
    }

    // Schema di movimento per jetpack (3×3) / jump (5×5).
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

    // Celle "bersaglio" evidenziabili per i flussi oggetto e per il brawler.
    function pickCells(s) {
      if (s.subPhase === 'elemental-target') return game.elementalTargetOptions();
      if (s.subPhase === 'barrage-first') return game.barrageFirstOptions();
      if (s.subPhase === 'barrage-second') return game.barrageSecondOptions();
      if (s.subPhase === 'randomizer-select') return game.randomizerSelectOptions();
      if (!s.subPhase && ui.brawlerMode && (s.phase === 'move' || s.phase === 'attack')) return game.brawlerTargets(s.activePlayer);
      return [];
    }

    // ---- Board ----
    function renderBoard(s) {
      dom.sideTop.textContent = VIEW.showLabels ? 'Nord' : '';
      dom.sideBottom.textContent = VIEW.showLabels ? 'Sud' : '';
      dom.board.innerHTML = '';
      var selectable = currentSelectableCells(s);
      var relocKeys = {}, pick = {}, chosenKeys = {}, dropKeys = {};
      if (s.subPhase === 'clash-reloc' || s.subPhase === 'forced-reloc') game.relocationOptions().forEach(function (o) { relocKeys[o.key] = true; });
      pickCells(s).forEach(function (o) { pick[o.key] = true; });
      if (s.subPhase === 'randomizer-select') s.pendingRandomizer.chosen.forEach(function (o) { chosenKeys[o.key] = true; });
      var rz = s.subPhase === 'randomizer-place' ? s.pendingRandomizer : null;
      if (rz) rz.chosen.forEach(function (o) { if (!rz.placed[o.key]) dropKeys[o.key] = true; });

      for (var y = 1; y <= 5; y++) for (var x = 1; x <= 5; x++) {
        var cell = game.getCell(x, y), key = x + ',' + y;
        var placedCard = null;
        if (rz && rz.placed[key]) { for (var pi = 0; pi < rz.drawn.length; pi++) if (rz.drawn[pi].id === rz.placed[key]) placedCard = rz.drawn[pi]; }
        var shownCard = placedCard || cell.card;
        var isPending = !cell.destroyed && !shownCard;                       // cella svuotata (randomizer)
        var isFig = shownCard && isFigureVal(shownCard.value);
        var invert = !!shownCard && !(cell.faceDown && !placedCard) && (isCenter(x, y) || isFig);
        var cls = 'cell';
        if (cell.destroyed) cls += ' destroyed';
        else if (isPending) cls += ' pending';
        else {
          cls += ' suit-' + shownCard.suit;
          if (!placedCard && cell.faceDown) cls += ' facedown';
          if (invert) cls += ' inverted suit-bg-' + shownCard.suit;
        }
        if (isCenter(x, y)) cls += ' center';
        if (y === 1) cls += ' target-n';
        if (y === 5) cls += ' target-s';
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
        if (cell.pawn) {
          c.appendChild(h('div', 'cell-ring ' + cell.pawn)); // outline colorato della cella con pedina
          c.appendChild(h('div', 'pawn ' + cell.pawn, cell.pawn));
        }
        if (dropKeys[key]) {
          c.addEventListener('dragover', function (e) { e.preventDefault(); });
          (function (xx, yy) { c.addEventListener('drop', function (e) { e.preventDefault(); var id = e.dataTransfer.getData('text/plain'); if (id) { try { game.randomizerPlace(id, xx, yy); ui.selectedDrawn = null; render(); } catch (err) { } } }); })(x, y);
        }
        (function (xx, yy) { c.onclick = function () { onCellClick(xx, yy); }; })(x, y);
        dom.board.appendChild(c);
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
    function renderLog(s) {
      dom.log.innerHTML = '';
      var start = Math.max(0, s.log.length - 250);
      var slice = s.log.slice(start); // dal più vecchio al più recente
      for (var d = slice.length - 1; d >= 0; d--) {
        var e = h('div', 'entry log-step' + (d === slice.length - 1 ? ' latest' : ''), slice[d]);
        e.title = 'Torna a prima di questo evento';
        (function (ti) { e.onclick = function () { doRestoreLog(ti); }; })(start + d);
        dom.log.appendChild(e);
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
      deckWrap.appendChild(deck); deckWrap.appendChild(h('div', 'pile-cap', 'Mazzo'));
      dom.piles.appendChild(deckWrap);
      // Scarti: carta in cima + conteggio, cliccabile.
      var discWrap = h('div', 'pile-wrap');
      var top = s.discard.length ? s.discard[s.discard.length - 1] : null;
      var disc = h('div', 'pile discard' + (top ? (isFigureVal(top.value) ? ' inv suit-bg-' + top.suit : '') : ' empty'));
      if (top) disc.appendChild(cardFace(top, isFigureVal(top.value)));
      var xb = h('div', 'pile-badge'); xb.appendChild(h('b', null, String(s.discard.length))); disc.appendChild(xb);
      disc.onclick = function () { openDiscardDialog(s); };
      discWrap.appendChild(disc); discWrap.appendChild(h('div', 'pile-cap', 'Scarti'));
      dom.piles.appendChild(discWrap);
    }

    function openDiscardDialog(s) {
      var back = h('div', 'dialog-back');
      var box = h('div', 'dialog');
      box.appendChild(h('h2', null, 'Pila degli scarti (' + s.discard.length + ')'));
      var grid = h('div', 'discard-grid');
      if (!s.discard.length) grid.appendChild(h('div', 'hint', 'Nessuna carta scartata.'));
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
    function openRulesDialog() {
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
      content.innerHTML = mdToHtml((typeof window !== 'undefined' && window.CradleRegolamento) || '# Regolamento non disponibile');
      box.appendChild(content);
      back.appendChild(box);
      back.onclick = function (e) { if (e.target === back) close(); };
      function onKey(e) { if (e.key === 'Escape') close(); }
      document.addEventListener('keydown', onKey);
      document.body.appendChild(back);
    }

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
      gCards.appendChild(optCheck('Doppio numero e seme',
        'Numero e seme ripetuti agli angoli, leggibili da entrambi i lati. Deseleziona per mostrare un solo numero e seme (copie sottosopra nascoste).',
        VIEW.cardDouble, function (v) { VIEW.cardDouble = v; refreshPrev(); }));
      refreshPrev();
      gCards.appendChild(prev);
      content.appendChild(gCards);

      var gBoard = h('div', 'opt-group'); gBoard.appendChild(h('h3', null, 'Campo di gioco'));
      gBoard.appendChild(optCheck('Mostra abbinamenti',
        'Evidenzia sul campo le celle abbinabili quando passi il mouse su una carta della mano.',
        VIEW.showMatches, function (v) { VIEW.showMatches = v; if (!v) clearMatchHints(); }));
      gBoard.appendChild(optCheck('Mostra etichette',
        'Mostra le etichette Nord/Sud e le coordinate delle caselle.',
        VIEW.showLabels, function (v) { VIEW.showLabels = v; }));
      content.appendChild(gBoard);

      box.appendChild(content);
      back.appendChild(box);
      back.onclick = function (e) { if (e.target === back) close(); };
      function onKey(e) { if (e.key === 'Escape') close(); }
      document.addEventListener('keydown', onKey);
      document.body.appendChild(back);
    }

    // ---- Timeline del turno (persistente per animare le transizioni) ----
    var TL_ORDER = ['select', 'move1', 'move2', 'attack1', 'attack2', 'end'];
    var TL_LABEL = { select: 'Scelta carte', move1: 'Movimento G1', move2: 'Movimento G2', attack1: 'Attacco G1', attack2: 'Attacco G2', end: 'Fine turno' };
    function tlColorFor(key, s) {
      if (key === 'move1' || key === 'attack1') return PLAYER_COLOR[s.firstPlayer];
      if (key === 'move2' || key === 'attack2') return PLAYER_COLOR[s.firstPlayer === 'N' ? 'S' : 'N'];
      return '#ffffff'; // select / end
    }
    function getTimelinePhase(s) {
      if (s.gameOver || s.phase === 'end') return 'end';
      if (s.phase === 'select') return 'select';
      if (s.phase === 'move') return s.activePlayer === s.firstPlayer ? 'move1' : 'move2';
      if (s.phase === 'attack') return s.activePlayer === s.firstPlayer ? 'attack1' : 'attack2';
      return 'select';
    }
    function renderTimeline(s) {
      if (!ui.tlSegs) {
        dom.timeline.innerHTML = '';
        ui.tlSegs = {};
        TL_ORDER.forEach(function (key, i) {
          if (i) dom.timeline.appendChild(h('span', 'tl-arrow', '›'));
          var seg = h('span', 'tl-seg', TL_LABEL[key]);
          ui.tlSegs[key] = seg; dom.timeline.appendChild(seg);
        });
      }
      var key = getTimelinePhase(s);
      // Flash della fase "fine turno" quando cambia il round (transizione altrimenti istantanea).
      if (ui.lastRound != null && s.round !== ui.lastRound && !s.gameOver && !ui.flashingEnd) {
        ui.flashingEnd = true;
        setTimelineActive('end', s);
        setTimeout(function () { ui.flashingEnd = false; setTimelineActive(getTimelinePhase(game.state), game.state); }, 800);
      } else if (!ui.flashingEnd) {
        setTimelineActive(key, s);
      }
      ui.lastRound = s.round;
    }
    function setTimelineActive(key, s) {
      TL_ORDER.forEach(function (k) {
        var seg = ui.tlSegs[k];
        if (k === key) { seg.classList.add('cur'); seg.style.background = tlColorFor(k, s); }
        else { seg.classList.remove('cur'); seg.style.background = ''; }
      });
    }

    // ============================================================ ACTION AREA
    function renderActionArea(s) {
      // Interrupt gestiti sulla griglia (istruzione + click) o con pannelli dedicati.
      if (s.subPhase === 'object-discard') return renderDiscard(s);
      if (s.subPhase === 'timebomb-suit') return renderTimebomb(s);
      if (s.subPhase === 'clash-cards') return renderClashCards(s);
      if (s.subPhase === 'clash-reloc') return renderReloc(s, s.pendingClash.relocatorId, s.pendingClash.relocateePawn, s.pendingClash.relocateOptional, true);
      if (s.subPhase === 'forced-reloc') return renderReloc(s, s.pendingForced.chooserId, s.pendingForced.pawnId, s.pendingForced.optional, false);
      // Oggetti avanzati (attacco)
      if (s.subPhase === 'elemental-target') return renderPickInfo('💥 Elemental Bomb', 'Clicca la cella bersaglio: cambieranno il suo seme e quello delle celle ortogonali.');
      if (s.subPhase === 'elemental-suit') return renderSuitChoice('💥 Elemental Bomb — scegli il seme', function (su) { game.elementalSuit(su); render(); });
      if (s.subPhase === 'barrage-first') return renderPickInfo('🧨 Barrage', 'Clicca la prima cella da distruggere.');
      if (s.subPhase === 'barrage-second') return renderPickInfo('🧨 Barrage', 'Clicca una cella adiacente (no centro, no pedina) da distruggere insieme alla prima.');
      if (s.subPhase === 'randomizer-select') return renderRandomizerSelect(s);
      if (s.subPhase === 'randomizer-place') return renderRandomizerPlace(s);
      if (s.phase === 'select') return renderSelect(s);
      if (s.phase === 'move' || s.phase === 'attack') return renderAction(s);
    }

    function setAction(title, bodyNode, actionsNode) {
      dom.action.innerHTML = '';
      dom.action.appendChild(h('div', 'act-head', title));
      if (bodyNode) dom.action.appendChild(bodyNode);
      if (actionsNode) dom.action.appendChild(actionsNode);
    }
    function thinking(txt) { setAction(txt, h('div', 'hint', 'Attendi il computer…'), null); }

    // ---- Pannello oggetti sotto la mano: cliccabili quando utilizzabili ----
    function objectsPanel(s, playerId) {
      if (!s.modules.objects) return null;
      var wrap = h('div', 'obj-panel');
      wrap.appendChild(h('div', 'obj-panel-title', 'Oggetti'));
      var row = h('div', 'obj-panel-row');
      var usableIds = game.usableObjects(playerId).map(function (o) { return o.id; });
      var objs = s.players[playerId].objects;
      if (!objs.length) { row.appendChild(h('div', 'hint', 'Nessun oggetto posseduto.')); wrap.appendChild(row); return wrap; }
      // Modalità "scarta un oggetto per il potere tactician": ogni oggetto diventa cliccabile.
      var pickForPower = ui.tacticianPick && playerId === s.activePlayer;
      if (pickForPower) wrap.querySelector('.obj-panel-title').textContent = 'Oggetti — clicca quello da scartare per il potere';
      objs.forEach(function (o) {
        var def = OBJ ? OBJ.def(o.type) : null;
        var usable = usableIds.indexOf(o.id) !== -1;
        var box = h('div', 'obj-card' + (o.fromCharacter ? ' init' : '') + ((usable || pickForPower) ? ' usable' : ' disabled'));
        box.appendChild(h('span', 'obj-name', def ? def.label : o.type));
        box.appendChild(h('span', 'obj-phase', o.phase));
        var tip = h('span', 'tooltip', def ? def.desc : o.type);
        if (o.type === 'jetpack' || o.type === 'jump') tip.appendChild(moveSchema(o.type));
        box.appendChild(tip);
        if (pickForPower) box.onclick = function () { game.activatePower(playerId, o.id); ui.tacticianPick = false; render(); };
        else if (usable) box.onclick = function () { game.useObject(playerId, o.id); ui.armedCardId = null; render(); };
        row.appendChild(box); bindTip(box);
      });
      wrap.appendChild(row);
      return wrap;
    }

    // ---- Scarto oggetto (oltre il limite) ----
    function renderDiscard(s) {
      var who = s.pendingObjectDiscard.playerId;
      if (isCpu(who)) { thinking('🤖 Il computer scarta un oggetto…'); return; }
      var body = h('div', 'obj-window');
      body.appendChild(h('div', 'hint', 'Hai superato il limite di 2 oggetti: scartane uno (l\'iniziale non conta).'));
      s.players[who].objects.filter(function (o) { return !o.fromCharacter; }).forEach(function (o) {
        var def = OBJ ? OBJ.def(o.type) : null;
        var b = h('button', 'obj-use', def ? def.label : o.type); b.title = def ? def.desc : o.type;
        b.onclick = function () { game.discardObject(who, o.id); render(); };
        body.appendChild(b);
      });
      setAction('🗑️ Scarto oggetto — Giocatore ' + who, body, null);
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
      if (isCpu(who)) { thinking('🤖 Il computer sposta il seme di turno…'); return; }
      renderSuitChoice('⏱️ Timebomb — scegli il nuovo seme di turno', function (su) { game.timebombChoose(su); render(); });
    }
    function renderPickInfo(title, hintText) { setAction(title, h('div', 'hint', hintText), null); }

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
      var next = s.selected.N == null ? 'N' : (s.selected.S == null ? 'S' : null);
      if (next == null) return;
      if (isCpu(next)) { thinking('🤖 Il computer sceglie le carte…'); return; }
      var who = ui.selectingPlayer;
      if (who !== next) {
        if (ui.mode === 'cpu') { ui.selectingPlayer = next; ui.chosen = []; who = next; }
        else { openGate('Passa il dispositivo al Giocatore ' + next, 'Sono ' + next + ', mostra le mie carte', function () { ui.selectingPlayer = next; ui.chosen = []; render(); }); return; }
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
      if (isCpu(chooser)) { thinking('🤖 Il computer sceglie la carta del clash…'); return; }
      if (ui.mode === 'cpu' || ui.clashChooser === chooser) renderClashHand(s, chooser);
      else openGate('Clash! Passa il dispositivo al Giocatore ' + chooser + (chooser === s.pendingClash.attackerId ? ' (attaccante)' : ' (difensore)'), 'Sono ' + chooser + ', scelgo', function () { ui.clashChooser = chooser; render(); });
    }

    // ---- Ricollocazione (clash o forzata): click su griglia ----
    function renderReloc(s, chooserId, moveePawn, optional, isClash) {
      if (isCpu(chooserId)) { thinking('🤖 Il computer ricolloca una pedina…'); return; }
      var body = h('div', 'hint', 'Giocatore ' + chooserId + ': clicca una casella evidenziata per spostare la pedina ' + moveePawn + ' (nessun bonus).');
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
        var showFace = mode === 'select' ? true : avail;
        // Il colore/fondo carta si applica SOLO quando la faccia è visibile: le carte coperte
        // (non scelte) hanno tutte lo stesso dorso, anche le figure.
        var cls = 'card';
        if (showFace) cls += ' ' + (isFig ? 'inv suit-bg-' + c.suit : 'suit-' + c.suit);
        if (mode === 'select') { cls += ' selectable'; if (ui.chosen.indexOf(c.id) !== -1) cls += ' chosen'; }
        else {
          if (avail) { cls += ' selectable ' + (revealed ? 'revealed' : 'extra'); }
          else { cls += ' hidden-card'; }
          if (ui.armedCardId === c.id) cls += ' armed';
        }
        var card = h('div', cls);
        if (showFace) {
          card.appendChild(cardFace(c, isFig));
          // Hover: evidenzia sul campo tutte le celle abbinabili da questa carta.
          (function (cc) { card.onmouseenter = function () { highlightMatches(playerId, cc); }; card.onmouseleave = clearMatchHints; })(c);
        } else {
          // Carta coperta (non scelta): hover per rivelarla (tooltip con valore e seme leggibili).
          var tip = h('span', 'tooltip card-tip'); tip.appendChild(revealCard(c));
          card.appendChild(tip); bindTip(card);
        }
        card.onclick = function () {
          if (mode === 'select') toggleChosen(playerId, c.id);
          else if (avail) { ui.armedCardId = (ui.armedCardId === c.id) ? null : c.id; render(); }
        };
        body.appendChild(card);
      });
      // Strip informativo: seed · character · power del giocatore attivo.
      var layout = h('div', 'act-layout');
      var info = actInfo(s, p);
      if (info) layout.appendChild(info);
      // Riga: hand | tools | confirm/azioni
      var row = h('div', 'act-row');
      var handCol = h('div', 'act-hand'); handCol.appendChild(body); row.appendChild(handCol);
      var panel = objectsPanel(s, playerId);
      if (panel) row.appendChild(panel);
      row.appendChild(handActions(s, playerId, mode));
      layout.appendChild(row);
      setAction((mode === 'select' ? 'Scelta carte — Giocatore ' : 'Mano — Giocatore ') + playerId, layout, null);
    }

    // Strip seed · character · power (potere mostrato per intero, leggibile).
    function actInfo(s, p) {
      if (!p.character && !p.belongingSuit) return null;
      var wrap = h('div', 'act-info');
      if (p.belongingSuit) { var sd = h('span', 'ai-seed bg-' + p.belongingSuit); sd.appendChild(suitIcon(p.belongingSuit, true)); sd.title = 'Seme di appartenenza: ' + SUIT_LABEL[p.belongingSuit]; wrap.appendChild(sd); }
      if (p.character) wrap.appendChild(h('span', 'ai-char', p.character));
      if (s.modules.powers && p.character) wrap.appendChild(h('span', 'ai-power', characterPowerDesc(p.character)));
      return wrap;
    }

    function toggleChosen(playerId, cardId) {
      var i = ui.chosen.indexOf(cardId);
      if (i !== -1) ui.chosen.splice(i, 1);
      else if (ui.chosen.length < game.selectCount(playerId)) ui.chosen.push(cardId);
      render();
    }

    function handActions(s, playerId, mode) {
      var wrap = h('div', 'act-actions');
      if (mode === 'select') {
        var need = game.selectCount(playerId);
        wrap.appendChild(h('span', 'hint', 'Scegli ' + need + ' carte (' + ui.chosen.length + '/' + need + ')'));
        var conf = confirmBtn('Conferma', playerId);
        conf.disabled = ui.chosen.length !== need;
        conf.onclick = function () { game.selectCards(playerId, ui.chosen.slice()); ui.selectingPlayer = null; ui.chosen = []; render(); };
        wrap.appendChild(conf);
        // Modulo Reshuffle: bottone + cerchi (usi rimasti = pieni, usati = solo contorno; colore del giocatore).
        if (s.modules.reshuffle) {
          var pr = s.players[playerId], total = pr.reshuffleTotal || 0, left = pr.reshuffleLeft || 0;
          var ctl = h('div', 'reshuffle-ctl');
          var rs = h('button', 'ghost rs-btn', 'Reshuffle');
          rs.disabled = !(game.canReshuffle && game.canReshuffle(playerId));
          rs.title = 'Rimescola la tua mano nel mazzo e pesca 6 carte.';
          rs.onclick = function () { game.reshuffleHand(playerId); ui.chosen = []; render(); };
          ctl.appendChild(rs);
          var dots = h('div', 'rs-dots');
          for (var di = 0; di < total; di++) {
            var d = h('span', 'rs-dot' + (di < left ? ' on' : ''));
            d.style.setProperty('--rc', PLAYER_COLOR[playerId]);
            d.title = (di < left ? 'Reshuffle disponibile' : 'Reshuffle usato');
            dots.appendChild(d);
          }
          ctl.appendChild(dots);
          wrap.appendChild(ctl);
        }
      } else {
        var word = s.phase === 'move' ? 'muovere' : 'attaccare';
        var list = s.phase === 'move' ? game.legalMoves(playerId) : game.legalShots(playerId);
        var can = list.length > 0;
        wrap.appendChild(h('span', 'hint', ui.armedCardId ? 'Carta scelta: clicca una casella evidenziata per ' + word + '.' : (can ? 'Scegli una carta rivelata, poi la casella dove ' + word + '.' : 'Nessuna azione: puoi solo passare.') + (s.actionsLeft > 1 ? ' (azioni rimaste: ' + s.actionsLeft + ')' : '')));
        var pass = h('button', can ? 'ghost' : 'primary', 'Passa (' + word + ')');
        pass.onclick = function () { ui.armedCardId = null; if (s.phase === 'move') game.passMove(playerId); else game.passShoot(playerId); render(); };
        wrap.appendChild(pass);
        // Poteri personaggio attivi (tactician / brawler).
        if (game.canActivatePower && game.canActivatePower(playerId)) {
          var pw = h('button', ui.tacticianPick ? 'primary' : 'ghost', ui.tacticianPick ? 'Annulla potere' : '🧠 Potere: apri tutte le carte (scarta 1 oggetto)');
          pw.onclick = function () { ui.tacticianPick = !ui.tacticianPick; render(); };
          wrap.appendChild(pw);
        }
        if (game.canBrawler && game.canBrawler(playerId)) {
          var bw = h('button', ui.brawlerMode ? 'primary' : 'ghost', ui.brawlerMode ? 'Annulla (match qualsiasi)' : '💪 Match qualsiasi (scarta 3 carte)');
          bw.onclick = function () { ui.brawlerMode = !ui.brawlerMode; ui.armedCardId = null; render(); };
          wrap.appendChild(bw);
        }
        if (ui.brawlerMode) wrap.appendChild(h('span', 'hint', 'Clicca una cella evidenziata: userai 3 carte per abbinare qualsiasi cella.'));
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
      setAction('Clash — Giocatore ' + chooser + ' sceglie la carta (segreta)', body, null);
    }

    // ---- Griglia click ----
    function onCellClick(x, y) {
      var s = game.state;
      if (s.gameOver || ui.gate) return;
      if (s.subPhase === 'clash-reloc') { if (!isCpu(s.pendingClash.relocatorId) && game.relocationOptions().some(function (o) { return o.x === x && o.y === y; })) { game.clashRelocate(x, y); render(); } return; }
      if (s.subPhase === 'forced-reloc') { if (!isCpu(s.pendingForced.chooserId) && game.relocationOptions().some(function (o) { return o.x === x && o.y === y; })) { game.forcedRelocate(x, y); render(); } return; }
      // Oggetti avanzati: selezione bersagli sulla griglia.
      if (s.subPhase === 'elemental-target') { if (game.elementalTargetOptions().some(function (o) { return o.x === x && o.y === y; })) { game.elementalTarget(x, y); render(); } return; }
      if (s.subPhase === 'barrage-first') { if (game.barrageFirstOptions().some(function (o) { return o.x === x && o.y === y; })) { game.barrageFirst(x, y); render(); } return; }
      if (s.subPhase === 'barrage-second') { if (game.barrageSecondOptions().some(function (o) { return o.x === x && o.y === y; })) { game.barrageSecond(x, y); render(); } return; }
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
        if (pc) ENG.moveDestinations(pc.x, pc.y, s.moveModifier).forEach(function (d) { cells.push(d); });
      } else {
        for (var x = 1; x <= 5; x++) for (var y = 1; y <= 5; y++) cells.push([x, y]);
      }
      cells.forEach(function (d) {
        if (game._matches(playerId, card, game.getCell(d[0], d[1]))) { var e = cellEl(d[0], d[1]); if (e) e.classList.add('match-hint'); }
      });
    }
    function clearMatchHints() { var ns = dom.board.querySelectorAll('.match-hint'); for (var i = 0; i < ns.length; i++) ns[i].classList.remove('match-hint'); }

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
      tip.style.left = left + 'px'; tip.style.top = top + 'px'; tip.style.visibility = '';
    }

    // Dopo ogni render: anima gli spostamenti pedina (diff), i flip delle carte (diff) e l'eventuale sparo.
    function postRenderAnimations() {
      var s = game.state;
      ['N', 'S'].forEach(function (id) {
        var pc = game.pawnCell(id), cur = pc ? { x: pc.x, y: pc.y } : null;
        var prev = ui.lastPawns && ui.lastPawns[id];
        if (prev && cur && (prev.x !== cur.x || prev.y !== cur.y)) flyPawn(prev, cur, id);
        if (!ui.lastPawns) ui.lastPawns = {}; ui.lastPawns[id] = cur;
      });
      var nowFD = {};
      for (var x = 1; x <= 5; x++) for (var y = 1; y <= 5; y++) if (game.getCell(x, y).faceDown) nowFD[x + ',' + y] = 1;
      if (ui.lastFaceDown) Object.keys(nowFD).forEach(function (k) { if (!ui.lastFaceDown[k]) flipCell(k); });
      ui.lastFaceDown = nowFD;
      if (ui.pendingShot) { flyShot(ui.pendingShot.from, ui.pendingShot.to); ui.pendingShot = null; }
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
    function renderFinal(s) {
      var r = s.result; dom.sheet.innerHTML = '';
      dom.sheet.appendChild(h('h2', null, '🏁 Fine partita'));
      var scores = h('div', 'final-scores');
      ['N', 'S'].forEach(function (id) { var fs = h('div', 'fs' + (r.winner === id ? ' win' : '')); fs.appendChild(h('div', 'n', 'Giocatore ' + id)); fs.appendChild(h('div', 'p', String(s.players[id].score))); fs.appendChild(h('div', 'n', s.players[id].figuresMatched + ' figure' + (s.players[id].matchedCenter ? ' · ★centro' : ''))); scores.appendChild(fs); });
      dom.sheet.appendChild(scores);
      dom.sheet.appendChild(h('div', 'big', r.winner ? '🏆' : '🤝'));
      dom.sheet.appendChild(h('h2', 'win', r.winner ? '🏆 Vince il Giocatore ' + r.winner : '🤝 Patta'));
      if (r.tiebreak && r.tiebreak !== 'patta') dom.sheet.appendChild(h('p', null, 'Spareggio: ' + (r.tiebreak === 'centro' ? 'ha abbinato il centro.' : 'più figure.')));
      dom.sheet.appendChild(h('p', null, r.summary));
      var again = h('button', 'primary', 'Nuova partita'); again.onclick = function () { location.reload(); };
      dom.sheet.appendChild(again); showOverlay();
    }
    function showOverlay() { dom.overlay.hidden = false; }
    function hideOverlay() { dom.overlay.hidden = true; }
    function isCenter(x, y) { return x === 3 && y === 3; }

    // ============================================================ UNDO / ripristino
    function resetUiTransient() {
      ui.armedCardId = null; ui.chosen = []; ui.selectingPlayer = null; ui.clashChooser = null;
      ui.gate = null; ui.pendingShot = null; ui.brawlerMode = false; ui.tacticianPick = false; ui.selectedDrawn = null;
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
      if (ui.mode === 'cpu') { var guard = 0; while (game.canUndo() && cpuShouldAct(game.state) && guard++ < 200) game.undo(); }
      afterRestore();
    }
    function doRestoreLog(i) {
      if (!game.restoreToLogIndex(i)) return;
      if (ui.mode === 'cpu') { var guard = 0; while (game.canUndo() && cpuShouldAct(game.state) && guard++ < 200) game.undo(); }
      afterRestore();
    }

    // ============================================================ CPU
    function scheduleCpu() {
      if (ui.cpuTimer) { clearTimeout(ui.cpuTimer); ui.cpuTimer = null; }
      if (ui.mode !== 'cpu') return;
      var s = game.state;
      if (s.gameOver || ui.gate) return;
      if (!cpuShouldAct(s)) return;
      ui.cpuTimer = setTimeout(function () { ui.cpuTimer = null; cpuStep(); }, 600);
    }
    function cpuShouldAct(s) {
      var c = ui.cpuId;
      if (s.subPhase === 'object-discard') return s.pendingObjectDiscard.playerId === c;
      if (s.subPhase === 'timebomb-suit') return s.pendingTimebomb.playerId === c;
      if (s.subPhase === 'elemental-target' || s.subPhase === 'elemental-suit') return s.pendingElemental && s.pendingElemental.playerId === c;
      if (s.subPhase === 'barrage-first' || s.subPhase === 'barrage-second') return s.pendingBarrage && s.pendingBarrage.playerId === c;
      if (s.subPhase === 'randomizer-select' || s.subPhase === 'randomizer-place') return s.pendingRandomizer && s.pendingRandomizer.playerId === c;
      if (s.subPhase === 'clash-cards') return game.clashCurrentChooser() === c;
      if (s.subPhase === 'clash-reloc') return s.pendingClash.relocatorId === c;
      if (s.subPhase === 'forced-reloc') return s.pendingForced.chooserId === c;
      if (s.subPhase) return false;
      if (s.phase === 'select') return s.selected[c] == null && s.selected[ui.humanId] != null;
      if (s.phase === 'move' || s.phase === 'attack') return s.activePlayer === c;
      return false;
    }
    function cpuStep() {
      var c = ui.cpuId, Cpu = window.CradleCpu;
      try {
        var r = Cpu.cpuAct(game, c); // esegue una singola azione (oggetti/poteri inclusi)
        if (r && r.type === 'shoot' && r.from) ui.pendingShot = { from: r.from, to: r.to };
      } catch (e) { if (window.console) console.error('CPU error:', e); }
      render();
    }

    return { render: render };
  }

  return { createController: createController };
});

/*
 * cpu.js — Avversario CPU semplice (v2).
 * Euristica: massimizza i punti immediati, evita i clash sfavorevoli, avanza verso
 * la propria riga-bersaglio. Con il modulo Oggetti attivo la CPU gioca comunque la base
 * ma PASSA le finestre oggetto (non usa oggetti in modo strategico); gestisce però tutte
 * le scelte forzate (scarto oltre il limite, ricollocazione da hook/homing).
 *
 * Funzioni decisionali pure: leggono game.state e ritornano una decisione. No DOM.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./deck.js'), require('./engine.js'));
  } else {
    root.CradleCpu = factory(root.CradleDeck, root.CradleEngine);
  }
})(typeof self !== 'undefined' ? self : this, function (Deck, Engine) {
  'use strict';

  function targetRow(id) { return id === 'N' ? 5 : 1; }
  function distToTarget(id, y) { return Math.abs(y - targetRow(id)); }
  function other(id) { return id === 'N' ? 'S' : 'N'; }
  function bel(game, id) { return game.state.players[id].belongingSuit; }
  function suit(game) { return game.state.currentSuit; }

  function arrivalValue(game, id, x, y) {
    var cell = game.getCell(x, y);
    if (!cell.card || cell.destroyed || cell.faceDown) return { pts: 0, endsGame: false };
    var pts = 0, ends = false;
    if (x === 3 && y === 3) pts += 5;
    else {
      if (Deck.isFigure(cell.card)) pts += Deck.figurePoints(cell.card);
      if (y === targetRow(id)) { pts += 5; ends = true; }
    }
    return { pts: pts, endsGame: ends };
  }
  function shotValue(game, id, x, y) {
    var cell = game.getCell(x, y);
    var opp = cell.pawn && cell.pawn !== id;
    if (cell.destroyed || !cell.card) return 0;
    if (cell.faceDown) return opp ? 5 : 0;
    var pts = 0; if (opp) pts += 5; if (Deck.isFigure(cell.card)) pts += Deck.figurePoints(cell.card); return pts;
  }
  function maxValueCard(cards) { var b = null; cards.forEach(function (c) { if (!b || c.value > b.value || (c.value === b.value && Deck.SUIT_RANK[c.suit] > Deck.SUIT_RANK[b.suit])) b = c; }); return b; }
  function minValueCard(cards) { var b = null; cards.forEach(function (c) { if (!b || c.value < b.value || (c.value === b.value && Deck.SUIT_RANK[c.suit] < Deck.SUIT_RANK[b.suit])) b = c; }); return b; }
  function cpuBeats(cpuCard, oppCard, cpuIsAttacker) { var r = cpuIsAttacker ? Engine.resolveClash(cpuCard, oppCard) : Engine.resolveClash(oppCard, cpuCard); return cpuIsAttacker ? r === 'attacker' : r === 'defender'; }

  // 1) Selezione 3 carte
  function chooseSelection(game, id) {
    var s = game.state, p = s.players[id], pawn = game.pawnCell(id), need = game.selectCount(id);
    var scored = p.hand.map(function (c) {
      var best = 0;
      if (pawn) [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = pawn.x + d[0], ny = pawn.y + d[1];
        if (nx < 1 || nx > 5 || ny < 1 || ny > 5) return;
        if (Engine.canMatch(c, game.getCell(nx, ny), suit(game), bel(game, id))) best = Math.max(best, arrivalValue(game, id, nx, ny).pts);
      });
      for (var x = 1; x <= 5; x++) for (var y = 1; y <= 5; y++)
        if (Engine.canMatch(c, game.getCell(x, y), suit(game), bel(game, id))) best = Math.max(best, shotValue(game, id, x, y));
      var jolly = (c.suit === suit(game) || c.suit === bel(game, id)) ? 3 : 0;
      return { c: c, score: best * 10 + c.value + jolly };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, need).map(function (o) { return o.c.id; });
  }

  // 2) Movimento
  function chooseMove(game, id) {
    var s = game.state, moves = game.legalMoves(id);
    if (!moves.length) return { action: 'pass' };
    var pawn = game.pawnCell(id), me = s.players[id], opp = s.players[other(id)];
    var oppBest = maxValueCard(game.availableRevealed(other(id)));
    var best = null;
    moves.forEach(function (m) {
      var value, moveCardId;
      var matchCards = game.availableRevealed(id).filter(function (c) { return m.cardIds.indexOf(c.id) !== -1; });
      if (m.occupied) {
        var moveCard = minValueCard(matchCards); moveCardId = moveCard.id;
        var clashPool = game.availableRevealed(id).filter(function (c) { return c.id !== moveCard.id; });
        var myBest = maxValueCard(clashPool);
        var favorable = myBest && (!oppBest || cpuBeats(myBest, oppBest, true));
        value = favorable ? arrivalValue(game, id, m.x, m.y).pts + 2 : -100;
      } else {
        moveCardId = minValueCard(matchCards).id;
        var av = arrivalValue(game, id, m.x, m.y); value = av.pts;
        if (av.endsGame && (me.score + av.pts) <= opp.score) value -= 50;
        value += (distToTarget(id, pawn.y) - distToTarget(id, m.y)) * 0.2;
      }
      if (!best || value > best.value) best = { m: m, value: value, cardId: moveCardId };
    });
    if (!best || best.value <= 0) return { action: 'pass' };
    return { action: 'move', x: best.m.x, y: best.m.y, cardId: best.cardId };
  }

  // 3) Carta del clash
  function chooseClashCard(game, id) {
    var pc = game.state.pendingClash, choices = game.clashChoices(id);
    var cpuIsAttacker = pc.attackerId === id, oppId = cpuIsAttacker ? pc.defenderId : pc.attackerId;
    var oppBest = maxValueCard(game.availableRevealed(oppId));
    var winners = choices.filter(function (c) { return oppBest ? cpuBeats(c, oppBest, cpuIsAttacker) : true; });
    return (winners.length ? minValueCard(winners) : minValueCard(choices)).id;
  }

  // 4) Ricollocazione da clash
  function chooseRelocation(game) {
    var s = game.state, pc = s.pendingClash, opts = game.relocationOptions(), movee = pc.relocateePawn;
    if (movee === pc.relocatorId) { // la CPU sposta se stessa
      var meS = s.players[movee].score, opS = s.players[other(movee)].score, bestSelf = null;
      opts.forEach(function (o) { var ends = o.y === targetRow(movee); var sc = -distToTarget(movee, o.y) + (ends && meS <= opS ? -100 : 0); if (!bestSelf || sc > bestSelf.sc) bestSelf = { o: o, sc: sc }; });
      return { x: bestSelf.o.x, y: bestSelf.o.y };
    }
    // sposta l'avversario (facoltativo): allontanalo dalla sua meta
    var oppId = movee, cur = distToTarget(oppId, pc.relocateFrom.y), best = null;
    opts.forEach(function (o) { var ends = o.y === targetRow(oppId); var cell = game.getCell(o.x, o.y); var fig = (!cell.faceDown && cell.card && Deck.isFigure(cell.card)) ? 3 : 0; var sc = distToTarget(oppId, o.y) + fig - (ends ? 100 : 0); if (!best || sc > best.sc) best = { o: o, sc: sc, d: distToTarget(oppId, o.y), fig: fig }; });
    if (best && (best.d > cur || best.fig > 0) && best.sc > -50) return { x: best.o.x, y: best.o.y };
    return { skip: true };
  }

  // 5) Attacco (sparo)
  function chooseShot(game, id) {
    var shots = game.legalShots(id), best = null;
    shots.forEach(function (m) {
      var v = shotValue(game, id, m.x, m.y);
      if (!best || v > best.v) { var cards = game.availableRevealed(id).filter(function (c) { return m.cardIds.indexOf(c.id) !== -1; }); best = { m: m, v: v, cardId: minValueCard(cards).id }; }
    });
    if (!best || best.v <= 0) return { action: 'pass' };
    return { action: 'shoot', x: best.m.x, y: best.m.y, cardId: best.cardId };
  }

  // 6) Spostamento forzato (hook/homing) quando la CPU è chi sceglie
  function chooseForcedReloc(game) {
    var s = game.state, pf = s.pendingForced, opts = game.relocationOptions(), movee = pf.pawnId;
    if (!opts.length) return pf.optional ? { skip: true } : { skip: true };
    if (movee === s.players.N.id && false) {} // (segnaposto)
    // Se la CPU muove se stessa: avvicinala alla meta; se muove l'avversario: allontanalo.
    var cpuId = game._cpuId || null; // opzionale
    // Regola generale: se la pedina è di chi sceglie? pf.chooserId è la CPU qui.
    var isOwnPawn = (movee === pf.chooserId); // homing su propria pedina o hook che sposta te
    var best = null;
    opts.forEach(function (o) {
      var d = distToTarget(movee, o.y);
      var sc = isOwnPawn ? -d : d; // se è la mia pedina avvicino, se è avversaria allontano
      if (o.y === targetRow(movee) && isOwnPawn) sc -= 100; // non auto-terminare
      if (!best || sc > best.sc) best = { o: o, sc: sc };
    });
    // hook è facoltativo: se non migliora nulla per l'avversario, rinuncia.
    if (pf.kind === 'hook' && pf.optional) return { x: best.o.x, y: best.o.y };
    return { x: best.o.x, y: best.o.y };
  }

  // 7) Scarto forzato: scarta l'oggetto non-iniziale meno utile (semplice: il primo non-iniziale).
  function chooseDiscard(game, id) {
    var objs = game.state.players[id].objects.filter(function (o) { return !o.fromCharacter; });
    return objs.length ? objs[objs.length - 1].id : null; // scarta il più recente
  }

  // ============================================================ POTERI + OGGETTI (CPU)
  function ownObj(game, id, type) { return game.usableObjects(id).filter(function (o) { return o.type === type; })[0] || null; }
  // Miglior valore d'arrivo (non-clash) raggiungibile con `cards` e un dato modificatore.
  function bestArrival(game, id, cards, modifier) {
    var pc = game.pawnCell(id), best = { value: 0, x: null, y: null };
    if (!pc) return best;
    Engine.moveDestinations(pc.x, pc.y, modifier || null).forEach(function (d) {
      var cell = game.getCell(d[0], d[1]);
      if (cell.pawn && cell.pawn !== id) return; // niente clash nella valutazione oggetti
      if (!cards.some(function (c) { return game._matches(id, c, cell); })) return;
      var v = arrivalValue(game, id, d[0], d[1]).pts;
      if (v > best.value) best = { value: v, x: d[0], y: d[1] };
    });
    return best;
  }
  // Miglior valore di tiro con `cards`.
  function bestShotWith(game, id, cards) {
    var best = { value: 0, x: null, y: null, onPawn: false };
    for (var x = 1; x <= 5; x++) for (var y = 1; y <= 5; y++) {
      var cell = game.getCell(x, y);
      if (!cards.some(function (c) { return game._matches(id, c, cell); })) continue;
      var v = shotValue(game, id, x, y);
      if (v > best.value) best = { value: v, x: x, y: y, onPawn: !!(cell.pawn && cell.pawn !== id) };
    }
    return best;
  }

  // Oggetto da usare in fase di selezione (timebomb / combat / rush).
  function chooseSelectObject(game, id) {
    var s = game.state, p = s.players[id], usable = game.usableObjects(id);
    if (!usable.length) return null;
    var tb = usable.filter(function (o) { return o.type === 'timebomb'; })[0];
    if (tb) {
      var counts = {}; p.hand.forEach(function (c) { counts[c.suit] = (counts[c.suit] || 0) + 1; });
      var bestSuit = null, bestN = 0; for (var su in counts) if (counts[su] > bestN) { bestN = counts[su]; bestSuit = su; }
      if (bestN >= 3 && bestSuit !== s.currentSuit) return { id: tb.id, type: 'timebomb', params: { suit: bestSuit } };
    }
    var cj = usable.filter(function (o) { return o.type === 'combat_juice'; })[0];
    if (cj) { var figs = 0; for (var x = 1; x <= 5; x++) for (var y = 1; y <= 5; y++) { var c = game.getCell(x, y); if (!c.destroyed && c.card && !c.faceDown && Deck.isFigure(c.card)) figs++; } if (figs >= 2) return { id: cj.id, type: 'combat_juice' }; }
    var rj = usable.filter(function (o) { return o.type === 'rush_juice'; })[0];
    if (rj) { var pc = game.pawnCell(id), sc = 0; if (pc) Engine.orthogonalNeighbors(pc.x, pc.y).forEach(function (d) { var cell = game.getCell(d[0], d[1]); if (cell.pawn && cell.pawn !== id) return; if (p.hand.some(function (cc) { return game._matches(id, cc, cell); }) && arrivalValue(game, id, d[0], d[1]).pts > 0) sc++; }); if (sc >= 2) return { id: rj.id, type: 'rush_juice' }; }
    return null;
  }

  // Oggetto da usare in movimento (jetpack / jump) se sblocca un arrivo migliore.
  function chooseMoveObject(game, id) {
    var s = game.state; if (s.moveModifier) return null;
    var revealed = game.availableRevealed(id), ortho = bestArrival(game, id, revealed, null).value;
    var jet = ownObj(game, id, 'jetpack'); if (jet && bestArrival(game, id, revealed, 'jetpack').value > ortho) return { id: jet.id, type: 'jetpack' };
    var jmp = ownObj(game, id, 'jump'); if (jmp && bestArrival(game, id, revealed, 'jump').value > ortho) return { id: jmp.id, type: 'jump' };
    return null;
  }

  // Oggetto da usare in attacco (homing/hook; e board-manip quando altrimenti passeremmo).
  function chooseAttackObject(game, id) {
    var s = game.state; if (s.attackModifier) return null;
    if (!game.usableObjects(id).length) return null;
    var revealed = game.availableRevealed(id), bs = bestShotWith(game, id, revealed);
    var homing = ownObj(game, id, 'homing_missile'); if (homing && bs.value >= 3) return { id: homing.id, type: 'homing_missile' };
    var hook = ownObj(game, id, 'hook'); if (hook && bs.onPawn) return { id: hook.id, type: 'hook' };
    if (bs.value === 0) { // passeremmo comunque: usa un oggetto "gratis" (con guardie anti-vicolo cieco)
      var barrage = ownObj(game, id, 'barrage'); if (barrage && barragePairExists(game)) return { id: barrage.id, type: 'barrage' };
      var rand = ownObj(game, id, 'randomizer'); if (rand && randomizableCount(game) >= 1) return { id: rand.id, type: 'randomizer' };
      var elem = ownObj(game, id, 'elemental_bomb'); if (elem && elementalCount(game) >= 1) return { id: elem.id, type: 'elemental_bomb' };
    }
    return null;
  }
  // C'è almeno una coppia (cella, cella-adiacente-valida) per il barrage?
  function validSecond(game, x, y) {
    return Engine.orthogonalNeighbors(x, y).some(function (d) { var c = game.getCell(d[0], d[1]); return !(d[0] === 3 && d[1] === 3) && !c.pawn && !c.destroyed; });
  }
  function barragePairExists(game) {
    for (var x = 1; x <= 5; x++) for (var y = 1; y <= 5; y++) if (!game.getCell(x, y).destroyed && validSecond(game, x, y)) return true;
    return false;
  }
  function randomizableCount(game) { var n = 0; for (var x = 1; x <= 5; x++) for (var y = 1; y <= 5; y++) { var c = game.getCell(x, y); if (!(x === 3 && y === 3) && !c.destroyed && c.card) n++; } return n; }
  function elementalCount(game) { var n = 0; for (var x = 1; x <= 5; x++) for (var y = 1; y <= 5; y++) { var c = game.getCell(x, y); if (!c.destroyed && c.card) n++; } return n; }

  // Potere personaggio (brawler / tactician) se conviene, nella fase indicata.
  function choosePower(game, id, phase) {
    var s = game.state, p = s.players[id];
    if (!s.modules.powers) return null;
    if (p.character === 'brawler' && game.canBrawler(id)) {
      var revealed = game.availableRevealed(id), bestT = null, bestV = 0;
      game.brawlerTargets(id).forEach(function (t) { var v = phase === 'move' ? arrivalValue(game, id, t.x, t.y).pts : shotValue(game, id, t.x, t.y); if (v > bestV) { bestV = v; bestT = t; } });
      var normal = phase === 'move' ? bestArrival(game, id, revealed, s.moveModifier).value : bestShotWith(game, id, revealed).value;
      if (bestT && bestV > normal && bestV > 0) return { kind: 'brawler', x: bestT.x, y: bestT.y };
    }
    if (p.character === 'tactician' && game.canActivatePower(id)) {
      var rev = game.availableRevealed(id), full = p.hand;
      var nowV = phase === 'move' ? bestArrival(game, id, rev, s.moveModifier).value : bestShotWith(game, id, rev).value;
      var fullV = phase === 'move' ? bestArrival(game, id, full, s.moveModifier).value : bestShotWith(game, id, full).value;
      if (fullV > nowV && fullV >= 2) return { kind: 'tactician' };
    }
    return null;
  }

  // ---- Resolver dei sotto-flussi oggetto (quando la CPU li usa) ----
  function cpuTimebombSuit(game, id) {
    var p = game.state.players[id], counts = {}; p.hand.forEach(function (c) { counts[c.suit] = (counts[c.suit] || 0) + 1; });
    var b = game.state.currentSuit, bn = -1; ['oro', 'spade', 'coppe', 'bastoni'].forEach(function (su) { if ((counts[su] || 0) > bn) { bn = counts[su] || 0; b = su; } }); return b;
  }
  function cpuElementalTarget(game, id) {
    var opts = game.elementalTargetOptions(), best = opts[0], bn = -1;
    opts.forEach(function (o) { var n = 0; Engine.orthogonalNeighbors(o.x, o.y).forEach(function (d) { var c = game.getCell(d[0], d[1]); if (!c.destroyed && c.card) n++; }); if (n > bn) { bn = n; best = o; } });
    return best;
  }
  function cpuElementalSuit(game, id) { return game.state.players[id].belongingSuit || game.state.currentSuit; }
  function cpuBarrageFirst(game, id) {
    // Solo prime celle con almeno una seconda cella valida.
    var opts = game.barrageFirstOptions().filter(function (o) { return validSecond(game, o.x, o.y); });
    var opp = game.pawnCell(other(id));
    if (opp && !opp.destroyed) { var oo = opts.filter(function (o) { return o.x === opp.x && o.y === opp.y; })[0]; if (oo) return oo; }
    var fig = opts.filter(function (o) { var c = game.getCell(o.x, o.y); return c.card && !c.faceDown && Deck.isFigure(c.card); })[0];
    return fig || opts[0];
  }
  function cpuBarrageSecond(game, id) { return game.barrageSecondOptions()[0] || null; }
  function cpuRandomizerCells(game, id) {
    var opts = game.randomizerSelectOptions();
    var dead = opts.filter(function (o) { var c = game.getCell(o.x, o.y); return !c.pawn && c.card && !Deck.isFigure(c.card); });
    return (dead.length ? dead : opts).slice(0, 3);
  }

  // Esegue UNA azione della CPU per il giocatore `id` in base allo stato corrente
  // (sotto-flussi oggetto, selezione, movimento, attacco, poteri). Ritorna un descrittore
  // {type:'shoot', from, to} quando spara/attacca-brawler (per l'animazione della UI).
  function cpuAct(game, id) {
    var s = game.state;
    // --- sotto-flussi / interrupt ---
    if (s.subPhase === 'timebomb-suit') { if (s.pendingTimebomb.playerId === id) game.timebombChoose(cpuTimebombSuit(game, id)); return {}; }
    if (s.subPhase === 'elemental-target') { if (s.pendingElemental.playerId === id) { var t = cpuElementalTarget(game, id); game.elementalTarget(t.x, t.y); } return {}; }
    if (s.subPhase === 'elemental-suit') { if (s.pendingElemental.playerId === id) game.elementalSuit(cpuElementalSuit(game, id)); return {}; }
    if (s.subPhase === 'barrage-first') { if (s.pendingBarrage.playerId === id) { var f = cpuBarrageFirst(game, id); game.barrageFirst(f.x, f.y); } return {}; }
    if (s.subPhase === 'barrage-second') { if (s.pendingBarrage.playerId === id) { var sec = cpuBarrageSecond(game, id); if (sec) game.barrageSecond(sec.x, sec.y); } return {}; }
    if (s.subPhase === 'randomizer-select') { if (s.pendingRandomizer.playerId === id) { cpuRandomizerCells(game, id).forEach(function (c) { game.randomizerToggle(c.x, c.y); }); game.randomizerConfirm(); } return {}; }
    if (s.subPhase === 'randomizer-place') { if (s.pendingRandomizer.playerId === id) { var pr = s.pendingRandomizer; pr.chosen.forEach(function (ch, i) { if (pr.drawn[i]) game.randomizerPlace(pr.drawn[i].id, ch.x, ch.y); }); game.randomizerDone(); } return {}; }
    if (s.subPhase === 'object-discard') { if (s.pendingObjectDiscard.playerId === id) game.discardObject(id, chooseDiscard(game, id)); return {}; }
    if (s.subPhase === 'clash-cards') { if (game.clashCurrentChooser() === id) game.clashChoose(id, chooseClashCard(game, id)); return {}; }
    if (s.subPhase === 'clash-reloc') { if (s.pendingClash.relocatorId === id) { var r = chooseRelocation(game); if (r.skip) game.clashSkipRelocate(); else game.clashRelocate(r.x, r.y); } return {}; }
    if (s.subPhase === 'forced-reloc') { if (s.pendingForced.chooserId === id) { var fr = chooseForcedReloc(game); var o2 = game.relocationOptions(); if (fr.skip && s.pendingForced.optional) game.forcedRelocateSkip(); else if (o2.length) game.forcedRelocate(fr.x || o2[0].x, fr.y || o2[0].y); else game.forcedRelocateSkip(); } return {}; }
    if (s.subPhase) return {};

    // --- selezione ---
    if (s.phase === 'select' && s.selected[id] == null) {
      var so = chooseSelectObject(game, id);
      if (so) { game.useObject(id, so.id, so.params || {}); return {}; }
      game.selectCards(id, chooseSelection(game, id)); return {};
    }
    // --- movimento ---
    if (s.phase === 'move' && s.activePlayer === id) {
      var pw = choosePower(game, id, 'move');
      if (pw && pw.kind === 'tactician') { game.activatePower(id); return {}; }
      if (pw && pw.kind === 'brawler') { game.brawlerAction(id, pw.x, pw.y); return {}; }
      var mo = chooseMoveObject(game, id); if (mo) { game.useObject(id, mo.id); return {}; }
      var mv = chooseMove(game, id);
      if (mv.action === 'pass') game.passMove(id); else game.move(id, mv.x, mv.y, mv.cardId);
      return {};
    }
    // --- attacco ---
    if (s.phase === 'attack' && s.activePlayer === id) {
      var pw2 = choosePower(game, id, 'attack');
      if (pw2 && pw2.kind === 'tactician') { game.activatePower(id); return {}; }
      if (pw2 && pw2.kind === 'brawler') { var cc = game.pawnCell(id), rb = { type: 'shoot', from: cc ? { x: cc.x, y: cc.y } : null, to: { x: pw2.x, y: pw2.y } }; game.brawlerAction(id, pw2.x, pw2.y); return rb; }
      var ao = chooseAttackObject(game, id); if (ao) { game.useObject(id, ao.id); return {}; }
      var sh = chooseShot(game, id);
      if (sh.action === 'pass') { game.passShoot(id); return {}; }
      var sc = game.pawnCell(id), rs = { type: 'shoot', from: sc ? { x: sc.x, y: sc.y } : null, to: { x: sh.x, y: sh.y } };
      game.shoot(id, sh.x, sh.y, sh.cardId); return rs;
    }
    return {};
  }

  return {
    chooseSelection: chooseSelection, chooseMove: chooseMove, chooseClashCard: chooseClashCard,
    chooseRelocation: chooseRelocation, chooseShot: chooseShot,
    chooseForcedReloc: chooseForcedReloc, chooseDiscard: chooseDiscard,
    arrivalValue: arrivalValue, shotValue: shotValue,
    // poteri + oggetti
    chooseSelectObject: chooseSelectObject, chooseMoveObject: chooseMoveObject, chooseAttackObject: chooseAttackObject,
    choosePower: choosePower, cpuAct: cpuAct,
    cpuTimebombSuit: cpuTimebombSuit, cpuElementalTarget: cpuElementalTarget, cpuElementalSuit: cpuElementalSuit,
    cpuBarrageFirst: cpuBarrageFirst, cpuBarrageSecond: cpuBarrageSecond, cpuRandomizerCells: cpuRandomizerCells
  };
});

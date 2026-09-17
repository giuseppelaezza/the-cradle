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
    module.exports = factory(require('../core/deck.js'), require('../engine/engine.js'));
  } else {
    root.CradleCpu = factory(root.CradleDeck, root.CradleEngine);
  }
})(typeof self !== 'undefined' ? self : this, function (Deck, Engine) {
  'use strict';

  // Dimensione della griglia corrente (5×5 o 4×4). Impostata a ogni cpuAct: la CPU
  // esegue una singola azione in modo sincrono, quindi un valore a livello di modulo è sicuro.
  var _SZ = 5;
  var BONUS_OBJECT_VALUE = 2; // valore euristico della scelta oggetto data da una cella bonus non riscossa (Ruleset C)
  function isCenterC(x, y) { return _SZ === 5 && x === 3 && y === 3; }
  function targetRow(id) { return id === 'N' ? _SZ : 1; }
  function distToTarget(id, y) { return Math.abs(y - targetRow(id)); }
  function other(id) { return id === 'N' ? 'S' : 'N'; }
  function bel(game, id) { return game.state.players[id].belongingSuit; }
  function suit(game) { return game.state.currentSuit; }
  // Punti-posizione di una cella nel Ruleset C (+1/+2/+3 a fine turno), via engine.
  function posBonus(x, y) { return Engine.positionBonusPoints ? Engine.positionBonusPoints(x, y, _SZ) : 0; }
  function isBonusC(x, y) { return Engine.isPositionBonusCell ? Engine.isPositionBonusCell(x, y, _SZ) : false; }
  // Distanza (Manhattan) dalla cella bonus più vicina: usata per orientare la CPU verso la zona bonus.
  function nearestBonusDist(x, y) {
    var best = 99;
    for (var bx = 1; bx <= _SZ; bx++) for (var by = 1; by <= _SZ; by++) {
      if (isBonusC(bx, by)) { var d = Math.abs(bx - x) + Math.abs(by - y); if (d < best) best = d; }
    }
    return best;
  }

  function arrivalValue(game, id, x, y) {
    var cell = game.getCell(x, y), s = game.state;
    if (cell.destroyed) return { pts: 0, endsGame: false };
    // Ruleset C: niente punti immediati da centro/riga; conta il punteggio di posizione (a fine turno)
    // della cella d'arrivo, più il valore della scelta oggetto se è una cella bonus non ancora riscossa.
    if (s.ruleset === 'C') {
      var posPts = posBonus(x, y), v = posPts;
      if (posPts > 0 && s.modules.objects && !cell.bonusTaken) v += BONUS_OBJECT_VALUE;
      return { pts: v, endsGame: false };
    }
    if (!cell.card || cell.faceDown) return { pts: 0, endsGame: false };
    var alt = s.altMatch, pts = 0, ends = false;
    if (isCenterC(x, y)) pts += 5;
    else {
      if (Deck.isFigure(cell.card) && !alt) pts += Deck.figurePoints(cell.card); // altMatch: muovere su figura non dà punti
      if (y === targetRow(id)) { pts += 5; ends = true; }
    }
    return { pts: pts, endsGame: ends };
  }
  var CLASH_WIN = 3; // punti a chi vince un clash da attaccante
  // La CPU può vincere un clash 1v1 contro oppId? (usa le carte di RISERVA, con info perfetta).
  function clashWinnable(game, id, oppId) {
    var mine = maxValueCard(game.availableReserve(id));
    if (!mine) return false;               // senza riserva non contesto: perdo
    var ob = maxValueCard(game.availableReserve(oppId));
    return !ob || cpuBeats(mine, ob, true); // l'avversario senza riserva perde
  }
  function shotValue(game, id, x, y) {
    var cell = game.getCell(x, y), s = game.state;
    if (cell.destroyed || !cell.card) return 0;
    var opp = cell.pawn && cell.pawn !== id;
    var figPts = (!cell.faceDown && Deck.isFigure(cell.card)) ? Deck.figurePoints(cell.card) : 0;
    if (opp) {
      // Con "Clash su Attacco" colpire una pedina apre un clash: conviene solo se possiamo vincerlo
      // (allora +3 e il colpo va a segno, con i punti figura se è un OBIETTIVO). Se non è vincibile,
      // sprecheremmo l'attacco: valore negativo così la CPU non lo sceglie.
      if (s.clashOnAttack) return clashWinnable(game, id, cell.pawn) ? (CLASH_WIN + figPts) : -1;
      return 5 + figPts; // regola senza clash su attacco: +5 pedina
    }
    return figPts;
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
        if (nx < 1 || nx > _SZ || ny < 1 || ny > _SZ) return;
        if (Engine.canMatch(c, game.getCell(nx, ny), suit(game), bel(game, id))) best = Math.max(best, arrivalValue(game, id, nx, ny).pts);
      });
      for (var x = 1; x <= _SZ; x++) for (var y = 1; y <= _SZ; y++)
        if (Engine.canMatch(c, game.getCell(x, y), suit(game), bel(game, id))) best = Math.max(best, shotValue(game, id, x, y));
      var jolly = (c.suit === suit(game) || c.suit === bel(game, id)) ? 3 : 0;
      return { c: c, score: best * 10 + c.value + jolly };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, need).map(function (o) { return o.c.id; });
  }

  // 2) Movimento (con modificatore opzionale già armato).
  // `stayValue` = punti-posizione che otterrei restando fermo: nel Ruleset C conviene MUOVERE solo se
  // arrivo a qualcosa di meglio (evita di abbandonare una CELLA BONUS).
  function chooseMove(game, id) {
    var s = game.state, moves = game.legalMoves(id);
    var pawn = game.pawnCell(id), me = s.players[id];
    var stayValue = (s.ruleset === 'C' && pawn) ? posBonus(pawn.x, pawn.y) : 0;
    if (!moves.length) return { action: 'pass' };
    var maxOpp = 0; game._others(id).forEach(function (o) { if (s.players[o].score > maxOpp) maxOpp = s.players[o].score; });
    var best = null;
    moves.forEach(function (m) {
      var value, moveCardId;
      var matchCards = game.availableRevealed(id).filter(function (c) { return m.cardIds.indexOf(c.id) !== -1; });
      if (m.occupied) {
        var moveCard = minValueCard(matchCards); moveCardId = moveCard.id;
        var defId = game.getCell(m.x, m.y).pawn; // l'occupante è il difensore del clash
        if (!clashWinnable(game, id, defId)) { value = -100; }
        else {
          // Vincere il clash: +3 immediati, prendo la CELLA (posizione/oggetto) e nego il posto al difensore.
          var av0 = arrivalValue(game, id, m.x, m.y).pts;
          var denial = posBonus(m.x, m.y); // se è una CELLA BONUS, la tolgo all'avversario
          value = CLASH_WIN + av0 + denial * 0.5;
        }
      } else {
        moveCardId = minValueCard(matchCards).id;
        var av = arrivalValue(game, id, m.x, m.y); value = av.pts;
        if (av.endsGame && (me.score + av.pts) <= maxOpp) value -= 50;
        // Bias di avvicinamento: nel Ruleset C verso la zona bonus, altrimenti verso la riga-bersaglio.
        if (s.ruleset === 'C') value += (nearestBonusDist(pawn.x, pawn.y) - nearestBonusDist(m.x, m.y)) * 0.4;
        else value += (distToTarget(id, pawn.y) - distToTarget(id, m.y)) * 0.2;
      }
      if (!best || value > best.value) best = { m: m, value: value, cardId: moveCardId };
    });
    // Muovo solo se batte davvero lo stare fermo (e vale qualcosa).
    if (!best || best.value <= 0 || best.value <= stayValue) return { action: 'pass' };
    return { action: 'move', x: best.m.x, y: best.m.y, cardId: best.cardId };
  }

  // 3) Carta del clash
  function chooseClashCard(game, id) {
    var pc = game.state.pendingClash, choices = game.clashChoices(id);
    var cpuIsAttacker = pc.attackerId === id, oppId = cpuIsAttacker ? pc.defenderId : pc.attackerId;
    var oppBest = maxValueCard(game.availableReserve(oppId));
    var winners = choices.filter(function (c) { return oppBest ? cpuBeats(c, oppBest, cpuIsAttacker) : true; });
    return (winners.length ? minValueCard(winners) : minValueCard(choices)).id;
  }

  // 4) Ricollocazione da clash
  function chooseRelocation(game) {
    var s = game.state, pc = s.pendingClash, opts = game.relocationOptions(), movee = pc.relocateePawn;
    if (!opts.length) return { skip: true };
    if (movee === pc.relocatorId) { // la CPU sposta se stessa
      var meS = s.players[movee].score, opS = 0; game._others(movee).forEach(function (o) { if (s.players[o].score > opS) opS = s.players[o].score; });
      var bestSelf = null;
      opts.forEach(function (o) {
        var sc;
        if (s.ruleset === 'C') sc = posBonus(o.x, o.y) - nearestBonusDist(o.x, o.y) * 0.3; // vai su/verso una CELLA BONUS
        else { var ends = o.y === targetRow(movee); sc = -distToTarget(movee, o.y) + (ends && meS <= opS ? -100 : 0); }
        if (!bestSelf || sc > bestSelf.sc) bestSelf = { o: o, sc: sc };
      });
      return { x: bestSelf.o.x, y: bestSelf.o.y };
    }
    // Sposta l'avversario. Nel Ruleset C: allontanalo dalle celle bonus; altrimenti: dalla sua meta.
    function pushScore(o) {
      if (s.ruleset === 'C') return nearestBonusDist(o.x, o.y) - posBonus(o.x, o.y) * 2;
      var cell = game.getCell(o.x, o.y); var fig = (!cell.faceDown && cell.card && Deck.isFigure(cell.card)) ? 3 : 0;
      return distToTarget(movee, o.y) + fig - (o.y === targetRow(movee) ? 100 : 0);
    }
    var best = null;
    opts.forEach(function (o) { var sc = pushScore(o); if (!best || sc > best.sc) best = { o: o, sc: sc }; });
    // Ricollocazione obbligatoria (es. l'attaccante che vince il clash): scegli comunque la migliore.
    if (!pc.relocateOptional) return { x: best.o.x, y: best.o.y };
    // Facoltativa: ricolloca solo se migliora davvero.
    var cur = s.ruleset === 'C' ? nearestBonusDist(pc.relocateFrom.x, pc.relocateFrom.y) : distToTarget(movee, pc.relocateFrom.y);
    if (best.sc > cur) return { x: best.o.x, y: best.o.y };
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
    if (!opts.length) return { skip: true };
    // Se la CPU muove se stessa: avvicinala alla meta; se muove l'avversario: allontanalo.
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

  // Scarto in eccesso di fine turno: scarta le carte di valore più basso (non-jolly per prime).
  function chooseEndDiscard(game, id) {
    var pd = game.state.pendingEndDiscard, need = pd.need;
    var hand = game.state.players[id].hand.slice();
    hand.sort(function (a, b) {
      var ja = (a.suit === suit(game) || a.suit === bel(game, id)) ? 1 : 0;
      var jb = (b.suit === suit(game) || b.suit === bel(game, id)) ? 1 : 0;
      if (ja !== jb) return ja - jb;          // scarta prima le non-jolly
      return a.value - b.value;               // poi le più basse
    });
    return hand.slice(0, need).map(function (c) { return c.id; });
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
    Engine.moveDestinations(pc.x, pc.y, modifier || null, _SZ).forEach(function (d) {
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
    for (var x = 1; x <= _SZ; x++) for (var y = 1; y <= _SZ; y++) {
      var cell = game.getCell(x, y);
      if (!cards.some(function (c) { return game._matches(id, c, cell); })) continue;
      var v = shotValue(game, id, x, y);
      if (v > best.value) best = { value: v, x: x, y: y, onPawn: !!(cell.pawn && cell.pawn !== id) };
    }
    return best;
  }

  // Reshuffle (modulo): rimescola se con l'intera mano non è raggiungibile alcun punto.
  function cpuShouldReshuffle(game, id) {
    var p = game.state.players[id];
    var a = bestArrival(game, id, p.hand, null).value;
    var sh = bestShotWith(game, id, p.hand).value;
    return Math.max(a, sh) === 0;
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
    if (cj) { var figs = 0; for (var x = 1; x <= _SZ; x++) for (var y = 1; y <= _SZ; y++) { var c = game.getCell(x, y); if (!c.destroyed && c.card && !c.faceDown && Deck.isFigure(c.card)) figs++; } if (figs >= 2) return { id: cj.id, type: 'combat_juice' }; }
    var rj = usable.filter(function (o) { return o.type === 'rush_juice'; })[0];
    if (rj) { var pc = game.pawnCell(id), sc = 0; if (pc) Engine.orthogonalNeighbors(pc.x, pc.y, _SZ).forEach(function (d) { var cell = game.getCell(d[0], d[1]); if (cell.pawn && cell.pawn !== id) return; if (p.hand.some(function (cc) { return game._matches(id, cc, cell); }) && arrivalValue(game, id, d[0], d[1]).pts > 0) sc++; }); if (sc >= 2) return { id: rj.id, type: 'rush_juice' }; }
    return null;
  }

  // Miglior arrivo raggiungibile con l'Arpione (grapple): CELLE ORTOGONALI a un ARM avversario.
  function bestGrappleArrival(game, id, cards) {
    var best = { value: 0, x: null, y: null }, seen = {};
    game._others(id).forEach(function (oid) {
      var op = game.pawnCell(oid); if (!op) return;
      Engine.orthogonalNeighbors(op.x, op.y, _SZ).forEach(function (d) {
        var k = d[0] + ',' + d[1]; if (seen[k]) return; seen[k] = true;
        var cell = game.getCell(d[0], d[1]);
        if (cell.pawn) return; // niente clash nella valutazione
        if (!cards.some(function (c) { return game._matches(id, c, cell); })) return;
        var v = arrivalValue(game, id, d[0], d[1]).pts;
        if (v > best.value) best = { value: v, x: d[0], y: d[1] };
      });
    });
    return best;
  }

  // Oggetto-modificatore di MOVIMENTO (jetpack / jump / grapple) se sblocca un arrivo migliore.
  function chooseMoveObject(game, id) {
    var s = game.state; if (s.moveModifier) return null;
    var revealed = game.availableRevealed(id), ortho = bestArrival(game, id, revealed, null).value;
    var jet = ownObj(game, id, 'jetpack'); if (jet && bestArrival(game, id, revealed, 'jetpack').value > ortho) return { id: jet.id, type: 'jetpack' };
    var jmp = ownObj(game, id, 'jump'); if (jmp && bestArrival(game, id, revealed, 'jump').value > ortho) return { id: jmp.id, type: 'jump' };
    var grp = ownObj(game, id, 'grapple'); if (grp && game._grappleHasTarget && game._grappleHasTarget(id) && bestGrappleArrival(game, id, revealed).value > ortho) return { id: grp.id, type: 'grapple' };
    return null;
  }

  // Teletrasporto (sostituisce il MOVIMENTO): salta su una CELLA VUOTA di ugual valore. Usa se porta
  // a una posizione migliore di quella attuale e di ogni movimento normale.
  function chooseTeleport(game, id) {
    var s = game.state;
    var tp = ownObj(game, id, 'teleport'); if (!tp) return null;
    var opts = game.teleportTargets ? game.teleportTargets() : [];
    if (!opts.length) return null;
    var pc = game.pawnCell(id), stay = (s.ruleset === 'C' && pc) ? posBonus(pc.x, pc.y) : 0;
    var normal = bestArrival(game, id, game.availableRevealed(id), s.moveModifier).value;
    var bestTp = 0; opts.forEach(function (o) { var v = arrivalValue(game, id, o.x, o.y).pts; if (v > bestTp) bestTp = v; });
    if (bestTp > stay && bestTp > normal && bestTp > 0) return { id: tp.id, type: 'teleport' };
    return null;
  }

  // Oggetto d'ATTACCO diretto (homing/hook) quando c'è un buon colpo.
  function chooseAttackObject(game, id) {
    var s = game.state; if (s.attackModifier) return null;
    if (!game.usableObjects(id).length) return null;
    var revealed = game.availableRevealed(id), bs = bestShotWith(game, id, revealed);
    // Granata (homing): buona per DISTRUGGERE una CELLA con OBIETTIVO o per colpire e spostare una pedina.
    var homing = ownObj(game, id, 'homing_missile'); if (homing && bs.value >= 2) return { id: homing.id, type: 'homing_missile' };
    // Spinta (hook): buona se il colpo è su una pedina avversaria (la sposta).
    var hook = ownObj(game, id, 'hook'); if (hook && bs.onPawn && bs.value > 0) return { id: hook.id, type: 'hook' };
    return null;
  }

  // Oggetto di "ripiego"/board-manipulation quando altrimenti PASSEREMMO (nessun punto disponibile).
  // Copre tutti gli oggetti restanti in modo che vengano comunque usati. phase = 'move' | 'attack'.
  function chooseFiller(game, id, phase) {
    if (!game.usableObjects(id).length) return null;
    // 1) Ricarica: pesca 2 carte nella STACK ATTIVA (può sbloccare un'azione a punti).
    var boost = ownObj(game, id, 'energy_boost'); if (boost && (game.state.deck.length > 0 || game.state.discard.length > 0)) return { id: boost.id, type: 'energy_boost' };
    // 2) Sifone: ruba una carta all'avversario con più carte scelte (lo indebolisce e rimpingua la STACK).
    var drain = ownObj(game, id, 'energy_drain'); if (drain && game._others(id).some(function (o) { return game.state.players[o].revealedIds.length > 0; })) return { id: drain.id, type: 'energy_drain' };
    // 3) Ricostruisci: se c'è una CELLA DISTRUTTA/OFFLINE, rimettila ONLINE (nuove chance di punteggio).
    var reb = ownObj(game, id, 'rebuild'); if (reb && game._rebuildHasTarget && game._rebuildHasTarget(id) && (game.state.deck.length > 0 || game.state.discard.length > 0)) return { id: reb.id, type: 'rebuild' };
    // 4) Randomizzatore: sostituisce l'azione rimescolando alcune CELLE non-bonus (rinnova il campo).
    var rand = ownObj(game, id, 'randomizer'); if (rand && randomizableCount(game) >= 1) return { id: rand.id, type: 'randomizer' };
    // 5) Bomba Elementale: cambia le SUIT attorno a una CELLA (può aprire abbinamenti futuri).
    var elem = ownObj(game, id, 'elemental_bomb'); if (elem && elementalCount(game) >= 1) return { id: elem.id, type: 'elemental_bomb' };
    // 6) Barrage: DISTRUGGE una CELLA VUOTA (ultimo ripiego).
    var barrage = ownObj(game, id, 'barrage'); if (barrage && barrageUsable(game)) return { id: barrage.id, type: 'barrage' };
    // 7) Encore!: ricarica la SKILL del proprio ARM se esaurita (brawler/tactician/runner).
    var enc = ownObj(game, id, 'encore'); if (enc && encoreUseful(game, id)) return { id: enc.id, type: 'encore' };
    // 8) Nuovi TOOLS di manovra ----
    // Carica Disperata (MOVIMENTO) / Snipe (ATTACCO): colpisci un ARM in riga/colonna se il CLASH è vincibile.
    if (phase === 'move') { var chg = ownObj(game, id, 'carica_disperata'); if (chg && lineWinnable(game, id)) return { id: chg.id, type: 'carica_disperata' }; }
    if (phase === 'attack') { var snp = ownObj(game, id, 'snipe'); if (snp && lineWinnable(game, id)) return { id: snp.id, type: 'snipe' }; }
    // Ripristina/Santuario/Feedback/Nuke: manipolazione del campo (ultimo ripiego).
    var san = ownObj(game, id, 'santuario'); if (san) return { id: san.id, type: 'santuario' };
    var fbk = ownObj(game, id, 'feedback_loop'); if (fbk) return { id: fbk.id, type: 'feedback_loop' };
    var nuk = ownObj(game, id, 'nuke'); if (nuk && phase === 'attack' && chooseNuke(game, id)) return { id: nuk.id, type: 'nuke' };
    var swp = ownObj(game, id, 'swap'); if (swp && phase === 'move') return { id: swp.id, type: 'swap' };
    // Toolbox: pesca 2 TOOL (buon valore quando ne hai pochi). Overcharge/Shuffle: manipolazione minore.
    var tbx = ownObj(game, id, 'toolbox'); if (tbx && game.state.players[id].objects.length <= 3) return { id: tbx.id, type: 'toolbox' };
    var ovc = ownObj(game, id, 'overcharge'); if (ovc && lineWinnable(game, id)) return { id: ovc.id, type: 'overcharge' };
    var shf = ownObj(game, id, 'shuffle'); if (shf) return { id: shf.id, type: 'shuffle' };
    // Overtake: converte una colonna a una SUIT e RIGENERA le sue CELLE OFFLINE/DISTRUTTE.
    var ovt = ['overtake_oro', 'overtake_spade', 'overtake_coppe', 'overtake_bastoni'].map(function (t) { return ownObj(game, id, t); }).filter(Boolean)[0];
    if (ovt) return { id: ovt.id, type: ovt.type };
    // Drenaggio: costo RIGENERA (serve l'ARM su CELLA OFFLINE) → rende OFFLINE le CELLE ortogonali.
    var drn = ownObj(game, id, 'drenaggio'); if (drn) return { id: drn.id, type: 'drenaggio' };
    // 9) Remix!: +1 uso a REMIX se sei a corto (torna utile nei DEPLOY successivi).
    var rem = ownObj(game, id, 'remix'); if (rem && game.state.players[id].reshuffleLeft === 0) return { id: rem.id, type: 'remix' };
    return null;
  }
  // Esiste un ARM avversario in riga/colonna con cui vincere un CLASH? (per Carica Disperata / Snipe)
  function lineWinnable(game, id) {
    var t = game._lineTargets ? game._lineTargets(id) : [];
    return t.some(function (o) { return clashWinnable(game, id, o.oppId); });
  }
  function encoreUseful(game, id) {
    var p = game.state.players[id];
    if (p.character === 'brawler') return p.brawlerLeft === 0;
    if (p.character === 'runner') return p.runnerLeft === 0;
    if (p.character === 'tactician') return p.tacticianLeft === 0;
    return false;
  }
  // Barrage colpisce una singola cella senza pedina: esiste almeno un bersaglio valido?
  function barrageUsable(game) {
    for (var x = 1; x <= _SZ; x++) for (var y = 1; y <= _SZ; y++) { var c = game.getCell(x, y); if (!c.destroyed && !c.pawn) return true; }
    return false;
  }
  function randomizableCount(game) { var n = 0; for (var x = 1; x <= _SZ; x++) for (var y = 1; y <= _SZ; y++) { var c = game.getCell(x, y); if (!isCenterC(x, y) && !c.destroyed && c.card) n++; } return n; }
  function elementalCount(game) { var n = 0; for (var x = 1; x <= _SZ; x++) for (var y = 1; y <= _SZ; y++) { var c = game.getCell(x, y); if (!c.destroyed && c.card) n++; } return n; }

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
    // Fighter (Soldier Boy) — SKILL attiva: RIGENERA la propria CELLA. La CPU la usa quando l'ARM si
    // trova su una CELLA OFFLINE (chiaro vantaggio: torna ONLINE), evitando di sprecarne gli usi.
    if (p.character === 'fighter' && game.canFighter && game.canFighter(id)) {
      var fpc = game.pawnCell(id);
      if (fpc && fpc.card && fpc.faceDown && !fpc.destroyed) return { kind: 'fighter' };
    }
    // Tactician: il potere (guardare la riserva avversaria) è informativo e la CPU non lo sa sfruttare → non lo usa.
    return null;
  }

  // ---- Resolver dei sotto-flussi oggetto (quando la CPU li usa) ----
  function cpuTimebombSuit(game, id) {
    var p = game.state.players[id], counts = {}; p.hand.forEach(function (c) { counts[c.suit] = (counts[c.suit] || 0) + 1; });
    var b = game.state.currentSuit, bn = -1; ['oro', 'spade', 'coppe', 'bastoni'].forEach(function (su) { if ((counts[su] || 0) > bn) { bn = counts[su] || 0; b = su; } }); return b;
  }
  function cpuElementalTarget(game, id) {
    var opts = game.elementalTargetOptions(), best = opts[0], bn = -1;
    opts.forEach(function (o) { var n = 0; Engine.orthogonalNeighbors(o.x, o.y, _SZ).forEach(function (d) { var c = game.getCell(d[0], d[1]); if (!c.destroyed && c.card) n++; }); if (n > bn) { bn = n; best = o; } });
    return best;
  }
  function cpuElementalSuit(game, id) { return game.state.players[id].belongingSuit || game.state.currentSuit; }
  function cpuBarrageFirst(game, id) {
    // Barrage colpisce una singola cella (no pedina): preferisci una figura scoperta, altrimenti la prima valida.
    var opts = game.barrageFirstOptions();
    var fig = opts.filter(function (o) { var c = game.getCell(o.x, o.y); return c.card && !c.faceDown && Deck.isFigure(c.card); })[0];
    return fig || opts[0];
  }
  // Randomizzatore (nuovo): per ogni carta pescata SOVRASCRIVI la CELLA meno preziosa disponibile.
  function cellWorth(game, o) {
    var c = game.getCell(o.x, o.y);
    if (c.destroyed || !c.card) return -2;               // celle vuote/distrutte: sovrascrivile volentieri
    if (c.faceDown) return -1;                           // OFFLINE
    var w = 0;
    if (Deck.isFigure(c.card)) w += 6;                   // non sprecare gli OBIETTIVI
    if (isBonusC(o.x, o.y)) w += 3;
    if (c.pawn) w += 4;
    return w;
  }
  function cpuRandomizerPlace(game, id) {
    var pr = game.state.pendingRandomizer;
    var opts = game.randomizerPlaceOptions().slice().sort(function (a, b) { return cellWorth(game, a) - cellWorth(game, b); });
    pr.drawn.forEach(function (card, i) { var cell = opts[i]; if (cell) game.randomizerPlace(card.id, cell.x, cell.y); });
    game.randomizerDone();
  }
  // Overtake: scegli la colonna che colpisce più ARM avversari; a parità, quella con più CELLE
  // OFFLINE/DISTRUTTE da RIGENERARE. Evita, a parità, la colonna del proprio ARM.
  function cpuOvertakeCol(game, id, opts) {
    var s = game.state, pc = game.pawnCell(id), best = opts[0].col, bestScore = -Infinity;
    opts.forEach(function (o) {
      var col = o.col, opp = 0, mine = 0, regen = 0;
      for (var y = 1; y <= _SZ; y++) {
        var c = game.getCell(col, y);
        if (c.pawn) { if (c.pawn === id) mine++; else opp++; }
        if (c.destroyed || (c.card && c.faceDown)) regen++;
      }
      var score = opp * 10 + regen - mine * 8;
      if (score > bestScore) { bestScore = score; best = col; }
    });
    return best;
  }
  // Costo "SCARTA [n] TOOL": scarta il TOOL meno utile (semplice: l'ultimo).
  function worstTool(opts) { return opts[opts.length - 1]; }
  // Carica Disperata / Snipe: scegli un ARM avversario in riga/colonna, preferendo un CLASH vincibile.
  function chooseLineTarget(game, id, opts) {
    if (!opts || !opts.length) return null;
    var win = opts.filter(function (o) { return clashWinnable(game, id, o.oppId); });
    return (win.length ? win : opts)[0];
  }
  // Nuke: MATCHA la CELLA che massimizza il danno (OBIETTIVI e ARM avversari nell'area).
  function chooseNuke(game, id) {
    var opts = game.nukeOptions(), best = null;
    opts.forEach(function (o) {
      var area = [{ x: o.x, y: o.y }].concat(Engine.orthogonalNeighbors(o.x, o.y, _SZ).map(function (d) { return { x: d[0], y: d[1] }; }));
      var v = 0;
      area.forEach(function (xy) {
        var c = game.getCell(xy.x, xy.y);
        if (c.destroyed) return;
        if (c.card && !c.faceDown && Deck.isFigure(c.card)) v += Deck.figurePoints(c.card);
        if (c.pawn && c.pawn !== id) v += 2;
      });
      if (!best || v > best.v) { var cards = game.availableRevealed(id).filter(function (c) { return game._matches(id, c, game.getCell(o.x, o.y)); }); if (cards.length) best = { x: o.x, y: o.y, v: v, cardId: minValueCard(cards).id }; }
    });
    return best;
  }
  // Wallie & Glass: se conviene, posiziona il segnalino GLASS su una CELLA ORTOGONALE (preferendo oro/coppe o CELLA BONUS).
  function chooseGlass(game, id) {
    if (!game.canGlass || !game.canGlass(id)) return null;
    var opts = game.glassTargets(id); if (!opts.length) return null;
    var revealed = game.availableRevealed(id), best = null;
    opts.forEach(function (o) {
      var cell = game.getCell(o.x, o.y);
      var cards = revealed.filter(function (c) { return game._matches(id, c, cell); });
      if (!cards.length) return;
      var suitScore = ({ oro: 2, coppe: 2, bastoni: 1, spade: 1 })[cell.card.suit] || 0;
      var v = suitScore + posBonus(o.x, o.y);
      if (!best || v > best.v) best = { x: o.x, y: o.y, v: v, cardId: minValueCard(cards).id };
    });
    return best;
  }
  // Teletrasporto: scegli la CELLA di destinazione col miglior valore d'arrivo.
  function cpuTeleportTarget(game, id, opts) {
    var best = opts[0], bn = -1;
    opts.forEach(function (o) { var v = arrivalValue(game, id, o.x, o.y).pts; if (v > bn) { bn = v; best = o; } });
    return best;
  }
  // Abbinamento alternativo (Ruleset A): scegli 1 oggetto tra i 3 pescati.
  function cpuAltPickObject(game, id) {
    var pa = game.state.pendingAltMatch;
    if (pa && pa.drawn && pa.drawn.length) game.altMatchPickObject(pa.drawn[0].id);
  }

  // Esegue UNA azione della CPU per il giocatore `id` in base allo stato corrente
  // (sotto-flussi oggetto, selezione, movimento, attacco, poteri). Ritorna un descrittore
  // {type:'shoot', from, to} quando spara/attacca-brawler (per l'animazione della UI).
  // Draft: piazza la carta scelta sulla CELLA vuota più vicina al proprio ARM
  // (così gli OBIETTIVI pescati finiscono a portata di mano).
  function cpuDraftCell(game, id, targets) {
    var pc = game.pawnCell(id);
    if (!pc) return targets[0];
    var best = null, bestD = Infinity;
    targets.forEach(function (t) { var d = Math.abs(t.x - pc.x) + Math.abs(t.y - pc.y); if (d < bestD) { bestD = d; best = t; } });
    return best || targets[0];
  }

  function cpuAct(game, id) {
    var s = game.state;
    _SZ = s.gridSize || 5;
    // --- sotto-flussi / interrupt ---
    if (s.subPhase === 'timebomb-suit') { if (s.pendingTimebomb.playerId === id) game.timebombChoose(cpuTimebombSuit(game, id)); return {}; }
    if (s.subPhase === 'elemental-target') { if (s.pendingElemental.playerId === id) { var t = cpuElementalTarget(game, id); game.elementalTarget(t.x, t.y); } return {}; }
    if (s.subPhase === 'elemental-suit') { if (s.pendingElemental.playerId === id) game.elementalSuit(cpuElementalSuit(game, id)); return {}; }
    if (s.subPhase === 'barrage-first') { if (s.pendingBarrage.playerId === id) { var f = cpuBarrageFirst(game, id); if (f) game.barrageFirst(f.x, f.y); } return {}; }
    if (s.subPhase === 'tool-discard') { if (s.pendingToolDiscard.playerId === id) { var lo = minValueCard(game.toolDiscardOptions()); if (lo) game.toolDiscardChoose(lo.id); } return {}; }
    if (s.subPhase === 'runner-figure') { if (s.pendingRunner.playerId === id) { var rlo = minValueCard(game.runnerFigureOptions()); if (rlo) game.runnerFigureHit(rlo.id); else game.runnerFigureSkip(); } return {}; }
    if (s.subPhase === 'randomizer-place') { if (s.pendingRandomizer.playerId === id) { cpuRandomizerPlace(game, id); } return {}; }
    if (s.subPhase === 'tool-sacrifice') { if (s.pendingToolSac.playerId === id) { var tso = game.toolSacrificeOptions(); if (tso.length) game.toolSacrificeChoose(worstTool(tso).id); } return {}; }
    if (s.subPhase === 'charge-select') { if (s.pendingCharge.playerId === id) { var ct = chooseLineTarget(game, id, game.chargeTargets()); if (ct) game.chargeChoose(ct.x, ct.y); } return {}; }
    if (s.subPhase === 'snipe-select') { if (s.pendingSnipe.playerId === id) { var snt = chooseLineTarget(game, id, game.snipeTargets()); if (snt) game.snipeChoose(snt.x, snt.y); } return {}; }
    if (s.subPhase === 'feedback-select') { if (s.pendingFeedback.playerId === id) { var fo = game.feedbackOptions(); if (fo.length) game.feedbackChoose(minValueCard(fo).id); } return {}; }
    if (s.subPhase === 'swap-target') { if (s.pendingSwap.playerId === id) { var swt = game.swapTargets(); if (swt.length) game.swapChoose(swt[0]); } return {}; }
    if (s.subPhase === 'nuke-select') { if (s.pendingNuke.playerId === id) { var nk = chooseNuke(game, id); if (nk) game.nukeChoose(nk.x, nk.y, nk.cardId); } return {}; }
    if (s.subPhase === 'shuffle-select') { if (s.pendingShuffle.playerId === id) { var sho = game.shuffleOptions(); if (sho.length) game.shuffleChoose(sho[0].x, sho[0].y); } return {}; }
    if (s.subPhase === 'overtake-select') { if (s.pendingOvertake.playerId === id) { var ovo = game.overtakeOptions(); if (ovo.length) game.overtakeChoose(cpuOvertakeCol(game, id, ovo)); } return {}; }
    if (s.subPhase === 'fighter-select') { if (s.pendingFighter.playerId === id) { var fgd = game.fighterDrawn(); if (fgd.length) game.fighterSelectCard(maxValueCard(fgd).id); } return {}; }
    if (s.subPhase === 'object-discard') { if (s.pendingObjectDiscard.playerId === id) game.discardObject(id, chooseDiscard(game, id)); return {}; }
    if (s.subPhase === 'end-discard') { if (s.pendingEndDiscard.playerId === id) { chooseEndDiscard(game, id).forEach(function (cid) { game.endDiscardToggle(cid); }); game.endDiscardConfirm(); } return {}; }
    if (s.subPhase === 'rebuild-select') { if (s.pendingRebuild.playerId === id) { var rd = game.rebuildDrawn(); if (rd.length) game.rebuildSelectCard(maxValueCard(rd).id); } return {}; }
    if (s.subPhase === 'rebuild-place') { if (s.pendingRebuild.playerId === id) { var rt = game.rebuildTargets(); if (rt.length) game.rebuildPlace(rt[0].x, rt[0].y); } return {}; }
    if (s.subPhase === 'energy-target') { if (s.pendingEnergy.playerId === id) { var et = game.energyTargetOptions(); if (et.length) { var tgt = et[0]; et.forEach(function (o) { if (s.players[o].score > s.players[tgt].score) tgt = o; }); game.energyDrainTarget(tgt); } } return {}; }
    if (s.subPhase === 'endbonus-steal') { if (s.pendingEndBonus.playerId === id) { var eb = game.endBonusStealOptions(); if (eb.length) { var vt = eb[0]; eb.forEach(function (o) { if (s.players[o].score > s.players[vt].score) vt = o; }); game.endBonusSteal(vt); } } return {}; }
    if (s.subPhase === 'draft-select') { if (s.pendingDraft.playerId === id) { var dd = game.draftDrawn(); if (dd.length) game.draftSelectCard(maxValueCard(dd).id); } return {}; }
    if (s.subPhase === 'draft-place') { if (s.pendingDraft.playerId === id) { var dt = game.draftTargets(); if (dt.length) { var dp = cpuDraftCell(game, id, dt); game.draftPlace(dp.x, dp.y); } } return {}; }
    if (s.subPhase === 'teleport-select') { if (s.pendingTeleport.playerId === id) { var tt = game.teleportTargets(); if (tt.length) { var tb = cpuTeleportTarget(game, id, tt); game.teleportTo(tb.x, tb.y); } } return {}; }
    if (s.subPhase === 'altmatch-object') { if (s.pendingAltMatch.playerId === id) cpuAltPickObject(game, id); return {}; }
    if (s.subPhase === 'clash-cards') { if (game.clashCurrentChooser() === id) game.clashChoose(id, chooseClashCard(game, id)); return {}; }
    if (s.subPhase === 'clash-reloc') { if (s.pendingClash.relocatorId === id) { var r = chooseRelocation(game); if (r.skip) game.clashSkipRelocate(); else game.clashRelocate(r.x, r.y); } return {}; }
    if (s.subPhase === 'forced-reloc') { if (s.pendingForced.chooserId === id) { var fr = chooseForcedReloc(game); var o2 = game.relocationOptions(); if (fr.skip && s.pendingForced.optional) game.forcedRelocateSkip(); else if (o2.length) game.forcedRelocate(fr.x || o2[0].x, fr.y || o2[0].y); else game.forcedRelocateSkip(); } return {}; }
    if (s.subPhase) return {};

    // --- selezione ---
    if (s.phase === 'select' && s.selected[id] == null) {
      if (game.canReshuffle && game.canReshuffle(id) && cpuShouldReshuffle(game, id)) {
        // Nessuna carta della mano è utile: scarta l'intera mano e ripesca.
        game.reshuffleHand(id, game.state.players[id].hand.map(function (c) { return c.id; }));
        return {};
      }
      var so = chooseSelectObject(game, id);
      if (so) { game.useObject(id, so.id, so.params || {}); return {}; }
      game.selectCards(id, chooseSelection(game, id)); return {};
    }
    // --- movimento ---
    if (s.phase === 'move' && s.activePlayer === id) {
      var pw = choosePower(game, id, 'move');
      if (pw && pw.kind === 'tactician') { game.activatePower(id); return {}; }
      if (pw && pw.kind === 'brawler') { game.brawlerAction(id, pw.x, pw.y); return {}; }
      if (pw && pw.kind === 'fighter') { game.fighterActivate(id); return {}; }
      var mo = chooseMoveObject(game, id); if (mo) { game.useObject(id, mo.id); return {}; }
      var tp = chooseTeleport(game, id); if (tp) { game.useObject(id, tp.id); return {}; }
      var mv = chooseMove(game, id);
      if (mv.action !== 'pass') { game.move(id, mv.x, mv.y, mv.cardId); return {}; }
      // Passeremmo: prova un oggetto di ripiego (ricarica/sifone/ricostruisci/randomizer/…).
      var mf = chooseFiller(game, id, 'move'); if (mf) { game.useObject(id, mf.id); return {}; }
      var glm = chooseGlass(game, id); if (glm) { game.glassPlace(id, glm.x, glm.y, glm.cardId); return {}; }
      game.passMove(id);
      return {};
    }
    // --- attacco ---
    if (s.phase === 'attack' && s.activePlayer === id) {
      var pw2 = choosePower(game, id, 'attack');
      if (pw2 && pw2.kind === 'tactician') { game.activatePower(id); return {}; }
      if (pw2 && pw2.kind === 'brawler') { var cc = game.pawnCell(id), rb = { type: 'shoot', from: cc ? { x: cc.x, y: cc.y } : null, to: { x: pw2.x, y: pw2.y } }; game.brawlerAction(id, pw2.x, pw2.y); return rb; }
      if (pw2 && pw2.kind === 'fighter') { game.fighterActivate(id); return {}; }
      var ao = chooseAttackObject(game, id); if (ao) { game.useObject(id, ao.id); return {}; }
      var sh = chooseShot(game, id);
      if (sh.action !== 'pass') {
        var sc = game.pawnCell(id), rs = { type: 'shoot', from: sc ? { x: sc.x, y: sc.y } : null, to: { x: sh.x, y: sh.y } };
        game.shoot(id, sh.x, sh.y, sh.cardId); return rs;
      }
      // Passeremmo: prova un oggetto di ripiego / manipolazione del campo.
      var af = chooseFiller(game, id, 'attack'); if (af) { game.useObject(id, af.id); return {}; }
      var gla = chooseGlass(game, id); if (gla) { game.glassPlace(id, gla.x, gla.y, gla.cardId); return {}; }
      game.passShoot(id);
      return {};
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
    cpuBarrageFirst: cpuBarrageFirst
  };
});

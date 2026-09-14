/*
 * engine.test.js — Test dell'engine v2 (nessun framework).  node tests/engine.test.js
 * Copre: regressione base (match/clash/movimento/sparo/economia/spareggio) e le novità v2
 * (rotazione, personaggi/belongingSuit, oggetti: pesca/limite/effetti, celle distrutte).
 */
'use strict';
var Deck = require('../js/deck.js');
var Engine = require('../js/engine.js');

var passed = 0, failed = 0;
function ok(c, m) { if (c) passed++; else { failed++; console.error('  ✗ FAIL: ' + m); } }
function eq(a, b, m) { ok(a === b, m + ' (atteso ' + b + ', ottenuto ' + a + ')'); }
function makeRng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Helper: porta la partita in fase move rivelando le prime 3 carte di ciascuno.
function toMovePhase(g) {
  var s = g.state;
  g.selectCards('N', s.players.N.hand.slice(0, 3).map(function (c) { return c.id; }));
  g.selectCards('S', s.players.S.hand.slice(0, 3).map(function (c) { return c.id; }));
}

// -------------------------------------------------------------------- canMatch
console.log('# canMatch (seme di turno, seme di appartenenza, celle distrutte)');
(function () {
  var up = { faceDown: false, destroyed: false, card: { value: 7, suit: 'coppe' } };
  ok(Engine.canMatch({ value: 7, suit: 'bastoni' }, up, 'oro', null), 'match per valore');
  ok(!Engine.canMatch({ value: 6, suit: 'bastoni' }, up, 'oro', null), 'no match');
  var upSeme = { faceDown: false, destroyed: false, card: { value: 3, suit: 'oro' } };
  ok(Engine.canMatch({ value: 9, suit: 'oro' }, upSeme, 'oro', null), 'jolly seme di turno');
  var coperta = { faceDown: true, destroyed: false, card: { value: 10, suit: 'coppe' } };
  ok(Engine.canMatch({ value: 2, suit: 'oro' }, coperta, 'oro', null), 'coperta solo seme di turno');
  ok(!Engine.canMatch({ value: 10, suit: 'coppe' }, coperta, 'oro', null), 'coperta non per valore');
  // belongingSuit
  var upCoppe = { faceDown: false, destroyed: false, card: { value: 7, suit: 'coppe' } };
  ok(Engine.canMatch({ value: 2, suit: 'coppe' }, upCoppe, 'oro', 'coppe'), 'jolly appartenenza (coppe)');
  ok(Engine.canMatch({ value: 4, suit: 'coppe' }, coperta, 'oro', 'coppe'), 'appartenenza sblocca coperta');
  // destroyed
  ok(!Engine.canMatch({ value: 7, suit: 'coppe' }, { destroyed: true, card: null }, 'oro', 'coppe'), 'cella distrutta mai abbinabile');
})();

// -------------------------------------------------------------------- resolveClash
console.log('# resolveClash');
(function () {
  eq(Engine.resolveClash({ value: 7, suit: 'bastoni' }, { value: 5, suit: 'oro' }), 'attacker', 'valore');
  eq(Engine.resolveClash({ value: 6, suit: 'oro' }, { value: 6, suit: 'spade' }), 'attacker', 'seme oro>spade');
  eq(Engine.resolveClash({ value: 6, suit: 'bastoni' }, { value: 6, suit: 'bastoni' }), 'tie', 'parità piena');
})();

// -------------------------------------------------------------------- Setup base
console.log('# Setup base');
(function () {
  var g = Engine.createGame({ rng: makeRng(1), firstPlayer: 'N' });
  var s = g.state;
  eq(g.getCell(3, 3).card.value, 1, 'centro = asso');
  eq(g.getCell(3, 3).card.suit, s.centerInitialSuit, 'centro = asso del seme iniziale');
  eq(s.currentSuit, s.centerInitialSuit, 'seme di turno = seme iniziale');
  eq(s.suitMode, 'fixed', 'default fissa');
  eq(s.players.N.hand.length, 6, 'N 6 carte');
  eq(s.deck.length, 42, 'mazzo 42');
  eq(s.players.N.belongingSuit, null, 'senza personaggi niente seme di appartenenza');
  eq(s.objectDeck.length, 0, 'senza oggetti niente mazzo oggetti');
  eq(g.pawnCell('N').x + ',' + g.pawnCell('N').y, '1,1', 'pedina N [1,1]');
})();

// -------------------------------------------------------------------- Economia / max 9 round (base)
console.log('# Economia carte / max 9 round (regressione)');
(function () {
  var g = Engine.createGame({ rng: makeRng(7), firstPlayer: 'N' });
  var s = g.state, snap = [], guard = 0;
  while (!s.gameOver && guard++ < 80) {
    if (s.phase === 'select' && !s.subPhase) snap.push({ round: s.round, N: s.players.N.hand.length, S: s.players.S.hand.length });
    if (s.phase === 'select') {
      g.selectCards('N', s.players.N.hand.slice(0, g.selectCount('N')).map(function (c) { return c.id; }));
      g.selectCards('S', s.players.S.hand.slice(0, g.selectCount('S')).map(function (c) { return c.id; }));
    } else if (s.phase === 'move') g.passMove(s.activePlayer);
    else if (s.phase === 'attack') g.passShoot(s.activePlayer);
    else break;
  }
  ok(s.gameOver, 'partita conclusa');
  eq(s.round, 9, 'arriva al round 9');
  // Con la regola di rimescolo (mazzo esaurito → si rimescolano gli scarti) la mano resta sempre a 6.
  snap.forEach(function (h) { eq(h.N, 6, 'round ' + h.round + ' N=6'); });
  ok(s.deck.length > 0 || s.discard.length > 0, 'mazzo/scarti mai entrambi esauriti (rimescolo attivo)');
})();

// -------------------------------------------------------------------- Movimento figura/centro/bersaglio
console.log('# Movimento: figura, centro, riga-bersaglio (regressione)');
(function () {
  var g = Engine.createGame({ rng: makeRng(3), firstPlayer: 'N' });
  var s = g.state;
  g.getCell(2, 1).card = { id: 'x10', value: 10, suit: 'spade' }; g.getCell(2, 1).faceDown = false;
  s.players.N.hand = [{ id: 'h10', value: 10, suit: 'bastoni' }, { id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }];
  s.players.N.revealedIds = ['h10', 'a', 'b'];
  s.phase = 'move'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.moveModifier = null;
  g.move('N', 2, 1, 'h10');
  eq(s.players.N.score, 2, 'OBIETTIVO 10 → +2 (punti fissi)');
  ok(g.getCell(2, 1).faceDown, 'figura coperta');
  eq(g.getCell(2, 1).pawn, 'N', 'pedina sopra');
  eq(s.players.N.figuresMatched, 1, 'una figura');
})();

// -------------------------------------------------------------------- Riga-bersaglio → fine partita
console.log('# Riga-bersaglio: fine partita a fine round (cella normale, coperta, forzato)');
(function () {
  function reach(cover) {
    var g = Engine.createGame({ rng: makeRng(1), firstPlayer: 'N' });
    var s = g.state;
    s.grid[1][1].pawn = null; s.grid[1][4].pawn = 'N';         // N adiacente alla riga y=5 (bersaglio di N)
    s.grid[1][5].card = { id: 't', value: 9, suit: s.currentSuit }; s.grid[1][5].faceDown = cover; s.grid[1][5].destroyed = false;
    s.players.N.hand = [{ id: 'nj', value: (cover ? 2 : 9), suit: s.currentSuit }, { id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }];
    s.players.S.hand = [{ id: 's', value: 4, suit: 'bastoni' }, { id: 'c', value: 5, suit: 'bastoni' }, { id: 'd', value: 6, suit: 'bastoni' }];
    s.players.N.revealedIds = ['nj', 'a', 'b']; s.players.S.revealedIds = ['s', 'c', 'd'];
    s.phase = 'move'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.moveModifier = null;
    g.move('N', 1, 5, 'nj');
    return { et: s.endTriggered, over: (function () { if (s.phase === 'move') g.passMove(s.activePlayer); if (s.phase === 'attack') { g.passShoot(s.activePlayer); if (s.phase === 'attack') g.passShoot(s.activePlayer); } return s.gameOver; })() };
  }
  var normal = reach(false); ok(normal.et, 'cella normale: endTriggered'); ok(normal.over, 'cella normale: partita finita a fine round');
  var covered = reach(true); ok(covered.et, 'cella COPERTA: endTriggered (era il bug)'); ok(covered.over, 'cella coperta: partita finita a fine round');
  // Spostamento forzato sulla riga-bersaglio (via hook) termina comunque la partita.
  var g2 = Engine.createGame({ rng: makeRng(1), firstPlayer: 'N', modules: { objects: true } });
  var s2 = g2.state;
  s2.grid[5][5].pawn = null; s2.grid[3][4].pawn = 'S'; // S che verrà spinto verso y=5 (bersaglio di N) — non è la SUA riga, ma verifichiamo il flag generale
  // Verifica diretta del forced move sulla riga-bersaglio di N:
  s2.grid[1][1].pawn = null; s2.grid[1][4].pawn = 'N';
  g2._forcedMove('N', 1, 5);
  ok(s2.endTriggered, 'spostamento forzato sulla riga-bersaglio: endTriggered');
})();

// -------------------------------------------------------------------- Clash con carte di riserva
console.log('# Clash: si sceglie tra le carte di RISERVA (non scelte); vittoria attaccante + ricollocazione');
(function () {
  var g = Engine.createGame({ rng: makeRng(11), firstPlayer: 'N' });
  var s = g.state;
  g.pawnCell('S').pawn = null; g.getCell(2, 1).pawn = 'S'; g.getCell(2, 1).card = { id: 'c21', value: 4, suit: 'coppe' }; g.getCell(2, 1).faceDown = false;
  // Mano = 3 carte scelte (rivelate) + 3 carte di riserva (non scelte).
  s.players.N.hand = [{ id: 'n4', value: 4, suit: 'oro' }, { id: 'nA', value: 5, suit: 'oro' }, { id: 'nB', value: 6, suit: 'oro' },
                      { id: 'r9', value: 9, suit: 'oro' }, { id: 'r2', value: 2, suit: 'oro' }, { id: 'r3', value: 3, suit: 'oro' }];
  s.players.S.hand = [{ id: 'sX', value: 7, suit: 'bastoni' }, { id: 'sY', value: 8, suit: 'bastoni' }, { id: 'sZ', value: 9, suit: 'bastoni' },
                      { id: 's3', value: 3, suit: 'bastoni' }, { id: 's1', value: 1, suit: 'bastoni' }, { id: 's2', value: 2, suit: 'bastoni' }];
  s.players.N.revealedIds = ['n4', 'nA', 'nB']; s.players.S.revealedIds = ['sX', 'sY', 'sZ'];
  s.phase = 'move'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.moveModifier = null;
  eq(g.move('N', 2, 1, 'n4').type, 'clash', 'clash avviato');
  eq(g.clashChoices('N').length, 3, 'attaccante sceglie tra le 3 carte di riserva');
  eq(g.clashChoices('S').length, 3, 'difensore sceglie tra le 3 carte di riserva');
  ok(!g.clashChoices('N').some(function (c) { return c.id === 'nA'; }), 'le carte scelte NON sono tra le opzioni del clash');
  ok(g.clashChoices('N').some(function (c) { return c.id === 'r9'; }), 'le carte di riserva SONO tra le opzioni del clash');
  g.clashChoose('N', 'r9'); g.clashChoose('S', 's3'); // 9 > 3 → attaccante vince
  eq(s.subPhase, 'clash-reloc', 'difensore ricolloca');
  eq(g.getCell(2, 1).pawn, 'N', 'attaccante entra');
  ok(s.discard.some(function (c) { return c.id === 'r9'; }) && s.discard.some(function (c) { return c.id === 's3'; }), 'le carte di riserva usate nel clash sono scartate');
  var opts = g.relocationOptions(); ok(opts.length > 0, 'opzioni ricollocazione'); g.clashRelocate(opts[0].x, opts[0].y);
  eq(s.subPhase, null, 'clash concluso');
})();

// -------------------------------------------------------------------- Double kill
console.log('# Double kill');
(function () {
  var g = Engine.createGame({ rng: makeRng(9), firstPlayer: 'N' });
  var s = g.state;
  g.pawnCell('S').pawn = null; var cell = g.getCell(3, 1);
  cell.card = { id: 'fig', value: 10, suit: 'spade' }; cell.faceDown = false; cell.pawn = 'S';
  s.players.N.hand = [{ id: 'n10', value: 10, suit: 'oro' }, { id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }];
  s.players.N.revealedIds = ['n10', 'a', 'b'];
  s.phase = 'attack'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.attackModifier = null;
  g.shoot('N', 3, 1, 'n10');
  eq(s.players.N.score, 7, 'double kill +5+2');
  ok(g.getCell(3, 1).faceDown, 'figura coperta');
})();

// -------------------------------------------------------------------- Spareggio
console.log('# Spareggio');
(function () {
  var s = { players: { N: { score: 10, matchedCenter: true, figuresMatched: 1 }, S: { score: 10, matchedCenter: false, figuresMatched: 3 } } };
  eq(Engine.computeResult(s).winner, 'N', 'centro batte figure');
  s.players.N.matchedCenter = false; eq(Engine.computeResult(s).winner, 'S', 'più figure');
  s.players.N.figuresMatched = 3; eq(Engine.computeResult(s).tiebreak, 'patta', 'patta');
})();

// -------------------------------------------------------------------- Rotazione
console.log('# Modalità rotazione: il seme di turno avanza a fine round');
(function () {
  var g = Engine.createGame({ rng: makeRng(4), firstPlayer: 'N', suitMode: 'rotating' });
  var s = g.state;
  var initial = s.currentSuit;
  eq(g.getCell(3, 3).card.suit, s.centerInitialSuit, 'centro asso del seme iniziale');
  // Gioca un round passando tutto.
  toMovePhase(g);
  // Iniziativa divisa: movimento N→S, attacco S→N.
  g.passMove('N'); g.passMove('S'); g.passShoot('S'); g.passShoot('N');
  eq(s.currentSuit, Deck.nextSuit(initial), 'seme di turno avanzato di 1');
  eq(s.centerInitialSuit, initial, 'seme iniziale invariato');
})();

// -------------------------------------------------------------------- Iniziativa divisa
console.log('# Iniziativa divisa: movimento G1→G2, attacco G2→G1');
(function () {
  var g = Engine.createGame({ rng: makeRng(4), firstPlayer: 'N' });
  var s = g.state;
  toMovePhase(g);
  eq(s.phase, 'move', 'inizia il movimento');
  eq(s.activePlayer, 'N', 'movimento: inizia il Primo Giocatore (N)');
  g.passMove('N');
  eq(s.activePlayer, 'S', 'movimento: poi il secondo (S)');
  g.passMove('S');
  eq(s.phase, 'attack', 'poi la fase di attacco');
  eq(s.activePlayer, 'S', 'attacco: inizia il SECONDO giocatore (S)');
  g.passShoot('S');
  eq(s.activePlayer, 'N', 'attacco: poi il Primo Giocatore (N)');
  g.passShoot('N');
  eq(s.round, 2, 'a fine attacco si passa al round successivo');
})();

// -------------------------------------------------------------------- Personaggi
console.log('# Personaggi: belongingSuit + oggetto iniziale');
(function () {
  var g = Engine.createGame({ rng: makeRng(6), firstPlayer: 'N', suitMode: 'rotating',
    modules: { characters: true, objects: true }, characters: { N: 'runner', S: 'fighter' } });
  var s = g.state;
  eq(s.players.N.belongingSuit, 'spade', 'runner → spade');
  eq(s.players.S.belongingSuit, 'bastoni', 'fighter → bastoni');
  eq(s.players.N.objects.length, 1, 'runner ha 1 oggetto iniziale (jetpack)');
  eq(s.players.N.objects[0].type, 'jetpack', 'runner → jetpack');
  ok(s.players.N.objects[0].fromCharacter, 'oggetto iniziale marcato fromCharacter');
  // Solo Personaggi (senza Oggetti): niente oggetto iniziale.
  var g2 = Engine.createGame({ rng: makeRng(6), firstPlayer: 'N', modules: { characters: true, objects: false }, characters: { N: 'runner', S: 'fighter' } });
  eq(g2.state.players.N.objects.length, 0, 'solo Personaggi: niente oggetto iniziale');
  eq(g2.state.players.N.belongingSuit, 'spade', 'solo Personaggi: seme di appartenenza presente');
})();

// -------------------------------------------------------------------- Oggetti: mazzo + pesca a figura
console.log('# Oggetti: mazzo 2 copie di 5 tipi; pesca a ogni figura eliminata (move e attack)');
(function () {
  var g = Engine.createGame({ rng: makeRng(8), firstPlayer: 'N', modules: { characters: false, objects: true } });
  var s = g.state;
  eq(s.objectDeck.length, 10, 'mazzo oggetti = 10 (2 copie di 5 tipi)');
  var types = s.objectDeck.map(function (o) { return o.type; });
  eq(new Set(types).size, 5, '5 tipi distinti');
  // Ogni tipo compare esattamente 2 volte.
  var counts = {}; types.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
  ok(Object.keys(counts).every(function (t) { return counts[t] === 2; }), 'ogni tipo ha 2 copie');
  // Selezione oggetti: mazzo = 2 copie di ciascun tipo scelto.
  var gs = Engine.createGame({ rng: makeRng(8), firstPlayer: 'N', modules: { characters: false, objects: true }, objectSelection: ['jetpack', 'hook'] });
  eq(gs.state.objectDeck.length, 4, 'selezione oggetti: 2 tipi → 4 carte');
  ok(gs.state.objectDeck.every(function (o) { return o.type === 'jetpack' || o.type === 'hook'; }), 'solo i tipi scelti');
  // Pesca su figura in movimento.
  g.getCell(2, 1).card = { id: 'x9', value: 9, suit: 'spade' }; g.getCell(2, 1).faceDown = false;
  s.players.N.hand = [{ id: 'h9', value: 9, suit: 'oro' }, { id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }];
  s.players.N.revealedIds = ['h9', 'a', 'b'];
  s.phase = 'move'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.moveModifier = null;
  g.move('N', 2, 1, 'h9');
  eq(s.players.N.objects.length, 1, 'pesca 1 oggetto abbattendo figura in movimento');
  eq(s.objectDeck.length, 9, 'mazzo oggetti ridotto');
})();

// -------------------------------------------------------------------- Oggetti: limite 2 + scarto forzato
console.log('# Oggetti: limite 2 (oltre iniziale) con scarto forzato');
(function () {
  var g = Engine.createGame({ rng: makeRng(8), firstPlayer: 'N', modules: { characters: false, objects: true } });
  var s = g.state;
  // Dai a N già 2 oggetti non-iniziali.
  s.players.N.objects = [{ id: 'o1', type: 'jetpack', phase: 'move', fromCharacter: false },
                         { id: 'o2', type: 'hook', phase: 'attack', fromCharacter: false }];
  // Colpisci una figura in attacco → pesca il 3° → scarto forzato.
  g.getCell(4, 1).card = { id: 'f8', value: 8, suit: 'spade' }; g.getCell(4, 1).faceDown = false;
  s.players.N.hand = [{ id: 'h8', value: 8, suit: 'oro' }, { id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }];
  s.players.N.revealedIds = ['h8', 'a', 'b'];
  s.phase = 'attack'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.attackModifier = null;
  g.shoot('N', 4, 1, 'h8');
  eq(s.subPhase, 'object-discard', 'oltre il limite → scarto forzato');
  eq(s.players.N.objects.length, 3, 'ha temporaneamente 3 oggetti');
  g.discardObject('N', 'o1');
  eq(s.players.N.objects.length, 2, 'torna a 2 dopo lo scarto');
})();

// -------------------------------------------------------------------- jetpack / jump (destinazioni)
console.log('# jetpack (diagonali) e jump (2 celle) — destinazioni');
(function () {
  var diag = Engine.moveDestinations(3, 3, 'jetpack');
  eq(diag.length, 8, 'jetpack: 8 destinazioni da [3,3]');
  var jump = Engine.moveDestinations(3, 3, 'jump').map(function (d) { return d[0] + ',' + d[1]; }).sort().join('|');
  eq(jump, '1,3|3,1|3,5|5,3', 'jump: solo [3,1],[5,3],[3,5],[1,3]');
  var jump22 = Engine.moveDestinations(2, 2, 'jump').map(function (d) { return d[0] + ',' + d[1]; }).sort().join('|');
  eq(jump22, '2,4|4,2', 'jump da [2,2]: solo [2,4] e [4,2] (entro i limiti)');
})();

// -------------------------------------------------------------------- hook
console.log('# hook: sposta la pedina avversaria colpita');
(function () {
  var g = Engine.createGame({ rng: makeRng(12), firstPlayer: 'N', modules: { characters: false, objects: true } });
  var s = g.state;
  g.pawnCell('S').pawn = null; g.getCell(3, 1).pawn = 'S'; g.getCell(3, 1).card = { id: 'c31', value: 4, suit: 'coppe' }; g.getCell(3, 1).faceDown = false;
  s.players.N.hand = [{ id: 'h4', value: 4, suit: 'oro' }, { id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }];
  s.players.N.revealedIds = ['h4', 'a', 'b'];
  s.phase = 'attack'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.attackModifier = 'hook';
  g.shoot('N', 3, 1, 'h4');
  eq(s.players.N.score, 5, 'colpo su pedina avversaria +5');
  eq(s.subPhase, 'forced-reloc', 'hook apre lo spostamento');
  var opts = g.relocationOptions(); ok(opts.length > 0, 'destinazioni hook'); g.forcedRelocate(opts[0].x, opts[0].y);
  eq(g.pawnCell('S').x + ',' + g.pawnCell('S').y, opts[0].x + ',' + opts[0].y, 'pedina S spostata da hook');
})();

// -------------------------------------------------------------------- homing missile
console.log('# homing missile: punti + cella distrutta + ricollocazione');
(function () {
  var g = Engine.createGame({ rng: makeRng(13), firstPlayer: 'N', modules: { characters: false, objects: true } });
  var s = g.state;
  g.pawnCell('S').pawn = null; var cell = g.getCell(3, 1);
  cell.card = { id: 'f10', value: 10, suit: 'spade' }; cell.faceDown = false; cell.pawn = 'S';
  s.players.N.hand = [{ id: 'h10', value: 10, suit: 'oro' }, { id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }];
  s.players.N.revealedIds = ['h10', 'a', 'b'];
  s.phase = 'attack'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.attackModifier = 'homing';
  g.shoot('N', 3, 1, 'h10');
  eq(s.players.N.score, 7, 'homing: punti double kill comunque assegnati (+5+2)');
  ok(g.getCell(3, 1).destroyed, 'cella distrutta');
  eq(g.getCell(3, 1).card, null, 'carta rimossa');
  eq(s.subPhase, 'forced-reloc', 'pedina da ricollocare');
  var opts = g.relocationOptions(); g.forcedRelocate(opts[0].x, opts[0].y);
  eq(g.pawnCell('S') != null, true, 'pedina S ricollocata');
  ok(!g.getCell(3, 1).pawn, 'cella distrutta senza pedina');
})();

// -------------------------------------------------------------------- rush / combat juice
console.log('# rush/combat juice: pendingActions + due azioni consecutive');
(function () {
  var g = Engine.createGame({ rng: makeRng(14), firstPlayer: 'N', modules: { characters: false, objects: true } });
  var s = g.state;
  // Dai a N una rush juice e aprine la finestra select (già aperta al setup per firstPlayer=N).
  s.players.N.objects = [{ id: 'rj', type: 'rush_juice', phase: 'select', fromCharacter: false }];
  eq(s.subPhase, null, 'nessuna finestra: selezione diretta');
  ok(g.usableObjects('N').some(function (o) { return o.id === 'rj'; }), 'rush usabile in select prima di confermare');
  g.useObject('N', 'rj');
  eq(s.players.N.pendingActions.moves, 2, 'rush: 2 movimenti');
  eq(s.players.N.pendingActions.attacks, 0, 'rush: 0 attacchi');
  eq(g.usableObjects('N').length, 0, 'dopo un oggetto select, nessun altro usabile nel round');
  g.selectCards('N', s.players.N.hand.slice(0, 3).map(function (c) { return c.id; }));
  g.selectCards('S', s.players.S.hand.slice(0, 3).map(function (c) { return c.id; }));
  eq(s.phase, 'move', 'in fase move');
  eq(s.activePlayer, 'N', 'inizia N');
  eq(s.actionsLeft, 2, 'N ha 2 azioni di movimento');
})();

// -------------------------------------------------------------------- uso inline oggetto move
console.log('# Uso inline di un oggetto move (jetpack) durante il turno');
(function () {
  var g = Engine.createGame({ rng: makeRng(16), firstPlayer: 'N', modules: { characters: false, objects: true } });
  var s = g.state;
  s.players.N.objects = [{ id: 'jp', type: 'jetpack', phase: 'move', fromCharacter: false }];
  toMovePhase(g);
  eq(s.phase, 'move', 'fase move'); eq(s.activePlayer, 'N', 'turno di N');
  ok(g.usableObjects('N').some(function (o) { return o.type === 'jetpack'; }), 'jetpack usabile nel proprio turno di movimento');
  ok(!g.usableObjects('S').length, 'S non può usare oggetti nel turno di N');
  g.useObject('N', 'jp');
  eq(s.subPhase, 'tool-discard', 'jetpack: il giocatore sceglie quale carta scartare');
  g.toolDiscardChoose(g.toolDiscardOptions()[0].id);
  eq(s.moveModifier, 'jetpack', 'jetpack armato dopo lo scarto');
  eq(g.usableObjects('N').length, 0, 'un solo modificatore per azione');
})();

// -------------------------------------------------------------------- timebomb
console.log('# timebomb: sposta il seme di turno (solo rotazione)');
(function () {
  var g = Engine.createGame({ rng: makeRng(15), firstPlayer: 'N', suitMode: 'rotating', modules: { characters: false, objects: true } });
  var s = g.state;
  s.players.N.objects = [{ id: 'tb', type: 'timebomb', phase: 'select', fromCharacter: false }];
  g.useObject('N', 'tb', { suit: 'coppe' });
  eq(s.currentSuit, 'coppe', 'timebomb imposta il seme di turno');
  // In modalità fissa timebomb non è utilizzabile.
  var g2 = Engine.createGame({ rng: makeRng(15), firstPlayer: 'N', suitMode: 'fixed', modules: { characters: false, objects: true } });
  g2.state.players.N.objects = [{ id: 'tb', type: 'timebomb', phase: 'select', fromCharacter: false }];
  eq(g2.usableObjects('N').length, 0, 'timebomb non usabile in modalità fissa');
})();

// -------------------------------------------------------------------- Undo / cronologia
console.log('# Undo: annulla l\'ultima azione e ripristino via log');
(function () {
  var g = Engine.createGame({ rng: makeRng(1), firstPlayer: 'N' });
  var s = g.state;
  g.selectCards('N', s.players.N.hand.slice(0, 3).map(function (c) { return c.id; }));
  g.selectCards('S', s.players.S.hand.slice(0, 3).map(function (c) { return c.id; }));
  eq(s.phase, 'move', 'in fase move'); eq(s.activePlayer, 'N', 'tocca a N');
  var histLen = g.history.length;
  g.passMove('N');
  eq(g.state.activePlayer, 'S', 'dopo passMove tocca a S');
  ok(g.canUndo(), 'undo disponibile');
  g.undo();
  eq(g.state.activePlayer, 'N', 'undo → torna a N');
  eq(g.history.length, histLen, 'storia: rimossa la mossa annullata');
  // restore via log index: torna a prima della rivelazione (log iniziale)
  var g2 = Engine.createGame({ rng: makeRng(1), firstPlayer: 'N' });
  var s2 = g2.state;
  g2.selectCards('N', s2.players.N.hand.slice(0, 3).map(function (c) { return c.id; }));
  g2.selectCards('S', s2.players.S.hand.slice(0, 3).map(function (c) { return c.id; }));
  var ok2 = g2.restoreToLogIndex(0);
  ok(ok2, 'restoreToLogIndex ritorna true');
  eq(g2.state.phase, 'select', 'ripristino → fase select');
})();

// -------------------------------------------------------------------- Poteri personaggio
console.log('# Poteri: runner (nessun pari↔pari), tactician (apre carte), brawler (wildcard), fighter (pari↔pari, attack)');
(function () {
  // runner: NON ha più il potere di abbinare pari↔pari (rimosso).
  var g = Engine.createGame({ rng: makeRng(3), firstPlayer: 'N', modules: { characters: true, powers: true }, characters: { N: 'runner', S: 'brawler' } });
  var s = g.state;
  s.currentSuit = 'coppe'; s.players.N.belongingSuit = 'spade';
  var evenCell = { faceDown: false, destroyed: false, card: { value: 6, suit: 'bastoni' } };
  s.phase = 'move';
  ok(!g._matches('N', { value: 4, suit: 'oro' }, evenCell), 'runner: carta pari NON abbina più cella pari (potere rimosso)');

  // tactician: potere attivo = guarda la riserva avversaria (3 volte a partita); non cambia le proprie carte disponibili
  var gt = Engine.createGame({ rng: makeRng(5), firstPlayer: 'N', modules: { characters: true, objects: true, powers: true }, characters: { N: 'tactician', S: 'runner' } });
  var st = gt.state;
  gt.selectCards('N', st.players.N.hand.slice(0, 3).map(function (c) { return c.id; }));
  gt.selectCards('S', st.players.S.hand.slice(0, 3).map(function (c) { return c.id; }));
  eq(gt.availableRevealed('N').length, 3, 'tactician: usa sempre solo le 3 carte scelte');
  eq(st.players.N.tacticianLeft, 3, 'tactician: 3 attivazioni disponibili a inizio partita');
  ok(gt.canActivatePower('N'), 'tactician può attivare');
  gt.activatePower('N');
  eq(gt.availableRevealed('N').length, 3, 'tactician: il potere non apre le carte non scelte');
  eq(st.players.N.tacticianLeft, 2, 'tactician: attivazioni decrementate a 2');
  ok(gt._tacticianPeek && gt._tacticianPeek.opponentId === 'S', 'tactician: peek imposta la riserva avversaria per la UI');
  eq(gt._tacticianPeek.cards.length, gt.availableReserve('S').length, 'tactician: peek mostra tutte le carte di riserva di S');
  gt.activatePower('N'); gt.activatePower('N');
  eq(st.players.N.tacticianLeft, 0, 'tactician: attivazioni a 0 dopo 3 usi');
  ok(!gt.canActivatePower('N'), 'tactician: esaurite le 3 attivazioni non è più attivabile');

  // jetpack: scarta una carta SCELTA (non di riserva) come costo, e serve >=2 carte scelte
  var gj = Engine.createGame({ rng: makeRng(8), firstPlayer: 'N', modules: { objects: true } });
  var sj = gj.state; sj.phase = 'move'; sj.activePlayer = 'N'; sj.actionsLeft = 1; sj.moveModifier = null;
  sj.players.N.hand = [{ id: 'r1', value: 2, suit: 'oro' }, { id: 'r2', value: 9, suit: 'oro' }, { id: 'x', value: 5, suit: 'spade' }];
  sj.players.N.revealedIds = ['r1', 'r2']; sj.players.N.revealedCards = [sj.players.N.hand[0], sj.players.N.hand[1]];
  sj.players.N.objects = [{ id: 'jp', type: 'jetpack', phase: 'move', fromCharacter: false }];
  ok(gj.usableObjects('N').some(function (o) { return o.id === 'jp'; }), 'jetpack usabile con 2 carte scelte');
  gj.useObject('N', 'jp');
  eq(sj.subPhase, 'tool-discard', 'jetpack: il giocatore sceglie quale carta scartare');
  gj.toolDiscardChoose('r1'); // il giocatore sceglie r1 (valore 2)
  eq(sj.moveModifier, 'jetpack', 'jetpack: modificatore armato dopo lo scarto');
  eq(gj.availableRevealed('N').length, 1, 'jetpack: una carta scelta scartata come costo (resta 1)');
  ok(sj.players.N.revealedIds.indexOf('r1') === -1, 'jetpack: scartata la carta scelta dal giocatore (r1)');
  ok(sj.players.N.hand.some(function (c) { return c.id === 'x'; }), 'jetpack: la carta di riserva NON viene scartata');

  // fighter: in ATTACCO una carta PARI abbina una cella scoperta di valore PARI (in movimento no)
  var gf = Engine.createGame({ rng: makeRng(11), firstPlayer: 'N', modules: { characters: true, powers: true }, characters: { N: 'fighter', S: 'runner' } });
  var sf = gf.state;
  sf.currentSuit = 'coppe'; sf.players.N.belongingSuit = 'bastoni';
  var evenCellF = { faceDown: false, destroyed: false, card: { value: 8, suit: 'spade' } };
  sf.phase = 'attack';
  ok(gf._matches('N', { value: 2, suit: 'oro' }, evenCellF), 'fighter (attack): carta pari abbina cella pari');
  ok(!gf._matches('N', { value: 3, suit: 'oro' }, evenCellF), 'fighter (attack): carta dispari NON abbina cella pari');
  sf.phase = 'move';
  ok(!gf._matches('N', { value: 2, suit: 'oro' }, evenCellF), 'fighter (move): il potere pari NON è attivo in movimento');

  // brawler: 3 carte → wildcard su figura, 3 carte scartate, nessun trophy
  var gb = Engine.createGame({ rng: makeRng(9), firstPlayer: 'N', modules: { characters: true, powers: true }, characters: { N: 'brawler', S: 'runner' } });
  var sb = gb.state;
  sb.grid[2][1].card = { id: 'f9', value: 9, suit: 'spade' }; sb.grid[2][1].faceDown = false; sb.grid[2][1].pawn = null;
  sb.players.N.hand = [{ id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }, { id: 'c', value: 4, suit: 'oro' }];
  sb.players.N.revealedIds = ['a', 'b', 'c']; sb.players.N.revealedCards = sb.players.N.hand.slice();
  // Brawler solo in ATTACCO; N deve essere il leader d'attacco (firstPlayer avversario) per non chiudere il round.
  sb.firstPlayer = 'S'; sb.phase = 'attack'; sb.subPhase = null; sb.activePlayer = 'N'; sb.actionsLeft = 1; sb.attackModifier = null;
  ok(gb.canBrawler('N'), 'brawler disponibile in attacco con 3 carte');
  ok((function () { sb.phase = 'move'; var c = gb.canBrawler('N'); sb.phase = 'attack'; return c; })(), 'brawler disponibile anche in movimento');
  eq(sb.players.N.brawlerTotal, 3, 'brawler: 3 usi totali (da characters.js)');
  eq(sb.players.N.brawlerLeft, 3, 'brawler: 3 usi iniziali');
  gb.brawlerAction('N', 2, 1);
  eq(sb.players.N.score, 2, 'brawler: figura 9 → +2'); eq(sb.players.N.trophies.length, 0, 'brawler: nessun trophy'); eq(sb.players.N.hand.length, 0, 'brawler: 3 carte scartate');
  eq(sb.players.N.brawlerLeft, 2, 'brawler: usi decrementati (3→2)');
})();

// -------------------------------------------------------------------- Oggetti avanzati
console.log('# Oggetti avanzati: elemental bomb, barrage, randomizer');
(function () {
  // Iniziativa divisa: in attacco inizia l'ALTRO giocatore, quindi per far attaccare `id` per primo
  // il Primo Giocatore deve essere l'avversario di `id`.
  function atk(g, id) { var s = g.state; s.firstPlayer = (id === 'N' ? 'S' : 'N'); s.phase = 'attack'; s.subPhase = null; s.activePlayer = id; s.actionsLeft = 1; s.attackModifier = null; s.players[id].hand = []; s.players[id].revealedIds = []; s.players[id].revealedCards = []; }
  // elemental bomb
  var g = Engine.createGame({ rng: makeRng(2), firstPlayer: 'N', modules: { objects: true } });
  var s = g.state; s.players.N.objects = [{ id: 'eb', type: 'elemental_bomb', phase: 'attack', fromCharacter: false }]; atk(g, 'N');
  g.useObject('N', 'eb'); g.elementalTarget(3, 3); g.elementalSuit('oro');
  eq(g.getCell(3, 3).card.suit, 'oro', 'elemental: centro → oro'); eq(g.getCell(3, 2).card.suit, 'oro', 'elemental: ortogonale → oro');
  eq(s.phase === 'attack' && s.activePlayer === 'N' && s.actionsLeft === 1, true, 'elemental NON consuma l\'attacco (costo rimosso)');
  // barrage: colpisce una SINGOLA cella; non può colpire celle con pedina
  var g2 = Engine.createGame({ rng: makeRng(2), firstPlayer: 'N', modules: { objects: true } });
  var s2 = g2.state; s2.players.N.objects = [{ id: 'br', type: 'barrage', phase: 'attack', fromCharacter: false }]; atk(g2, 'N');
  g2.useObject('N', 'br');
  ok(!g2.barrageFirstOptions().some(function (o) { return o.x === 1 && o.y === 1; }), 'barrage: la cella con pedina non è bersagliabile');
  g2.barrageFirst(2, 2);
  ok(s2.subPhase !== 'barrage-first', 'barrage: dopo la cella si risolve subito');
  ok(g2.getCell(2, 2).destroyed, 'barrage: la cella scelta è distrutta');
  ok(!g2.getCell(2, 3).destroyed, 'barrage: nessuna seconda cella distrutta');
  // randomizer
  var g3 = Engine.createGame({ rng: makeRng(2), firstPlayer: 'N', modules: { objects: true } });
  var s3 = g3.state; s3.players.N.objects = [{ id: 'rz', type: 'randomizer', phase: 'attack', fromCharacter: false }]; atk(g3, 'N');
  var deck0 = s3.deck.length;
  g3.useObject('N', 'rz'); g3.randomizerToggle(1, 2); g3.randomizerToggle(2, 2); g3.randomizerConfirm();
  eq(s3.subPhase, 'randomizer-place', 'randomizer: fase piazzamento'); eq(s3.pendingRandomizer.drawn.length, 2, 'randomizer: pescate 2');
  var dr = s3.pendingRandomizer.drawn;
  g3.randomizerPlace(dr[0].id, 1, 2); g3.randomizerPlace(dr[1].id, 2, 2); g3.randomizerDone();
  ok(g3.getCell(1, 2).card && g3.getCell(2, 2).card, 'randomizer: celle riempite'); eq(s3.deck.length, deck0, 'randomizer: mazzo di lunghezza invariata');
})();

// -------------------------------------------------------------------- Reshuffle mazzo / tools energetici / modulo reshuffle
console.log('# Rimescolo mazzo, Energy Boost/Drain, modulo Reshuffle');
(function () {
  // _drawCard rimescola gli scarti quando il mazzo è vuoto.
  var g = Engine.createGame({ rng: makeRng(5), firstPlayer: 'N' });
  var s = g.state;
  s.deck = []; s.discard = [{ id: 'a', value: 4, suit: 'oro' }, { id: 'b', value: 7, suit: 'spade' }];
  var c = g._drawCard();
  ok(c && (c.id === 'a' || c.id === 'b'), 'drawCard: pesca da un mazzo rimescolato dagli scarti');
  eq(s.deck.length + (c ? 1 : 0), 2, 'drawCard: scarti trasferiti nel mazzo');
  eq(s.discard.length, 0, 'drawCard: scarti svuotati dopo il rimescolo');

  // Energy Boost: pesca 2 carte usabili (rivelate). A fine round si scartano con le altre carte scelte;
  // le carte NON scelte restano in mano.
  var gb = Engine.createGame({ rng: makeRng(9), firstPlayer: 'N', modules: { objects: true } });
  var sb = gb.state; sb.phase = 'move'; sb.activePlayer = 'N'; sb.actionsLeft = 1; sb.moveModifier = null;
  sb.players.N.hand = [{ id: 'r1', value: 2, suit: 'oro' }, { id: 'r2', value: 3, suit: 'oro' }, { id: 'r3', value: 4, suit: 'oro' },
                       { id: 'u1', value: 5, suit: 'spade' }, { id: 'u2', value: 6, suit: 'spade' }, { id: 'u3', value: 7, suit: 'spade' }];
  sb.players.N.revealedIds = ['r1', 'r2', 'r3']; sb.players.N.revealedCards = sb.players.N.hand.slice(0, 3);
  sb.players.N.objects = [{ id: 'eb', type: 'energy_boost', phase: 'move', fromCharacter: false }];
  ok(gb.usableObjects('N').some(function (o) { return o.id === 'eb'; }), 'energy boost usabile in movimento');
  gb.useObject('N', 'eb');
  eq(sb.players.N.hand.length, 8, 'energy boost: +2 carte in mano (6→8)');
  ok(sb.players.N.revealedIds.length === 5, 'energy boost: le 2 carte pescate sono rivelate (scelte)');
  eq(sb.actionsLeft, 1, 'energy boost: non consuma l\'azione');
  // Simula la fine del round: si scartano tutte le carte scelte/rivelate, restano solo le 3 non scelte.
  var nonChosen = sb.players.N.hand.filter(function (c) { return sb.players.N.revealedIds.indexOf(c.id) === -1; }).map(function (c) { return c.id; });
  gb._endRound();
  var kept = sb.players.N.hand.filter(function (c) { return nonChosen.indexOf(c.id) !== -1; });
  eq(kept.length, 3, 'energy boost: a fine round restano le 3 carte NON scelte');

  // Energy Drain: ruba una carta dall\'avversario (rimossa da mano, revealedIds e preview).
  var gd = Engine.createGame({ rng: makeRng(11), firstPlayer: 'N', modules: { objects: true } });
  var sd = gd.state; sd.phase = 'attack'; sd.activePlayer = 'N'; sd.actionsLeft = 1; sd.attackModifier = null;
  sd.players.N.objects = [{ id: 'ed', type: 'energy_drain', phase: 'attack', fromCharacter: false }];
  // Avversario con tutte carte rivelate: il furto colpisce per forza una carta scelta (in preview).
  sd.players.S.hand = [{ id: 'd1', value: 3, suit: 'oro' }, { id: 'd2', value: 7, suit: 'spade' }, { id: 'd3', value: 9, suit: 'coppe' }];
  sd.players.S.revealedIds = ['d1', 'd2', 'd3']; sd.players.S.revealedCards = sd.players.S.hand.slice();
  var oppBefore = sd.players.S.hand.length, meBefore = sd.players.N.hand.length;
  gd.useObject('N', 'ed');
  eq(sd.players.S.hand.length, oppBefore - 1, 'energy drain: -1 carta all\'avversario');
  eq(sd.players.N.hand.length, meBefore + 1, 'energy drain: +1 carta a me');
  eq(sd.players.S.revealedCards.length, 2, 'energy drain: la carta rubata sparisce dalla preview avversaria');
  var stolen = sd.players.N.hand[sd.players.N.hand.length - 1];
  ok(!sd.players.S.hand.some(function (c) { return c.id === stolen.id; }), 'energy drain: la carta non è più nella mano avversaria');
  ok(!sd.players.S.revealedCards.some(function (c) { return c.id === stolen.id; }), 'energy drain: la carta non è più nella preview avversaria');

  // Modulo Reshuffle: scarta 1..n carte scelte e pesca un egual numero (2 usi per partita).
  var gr = Engine.createGame({ rng: makeRng(13), firstPlayer: 'N', modules: { reshuffle: true } });
  var sr = gr.state;
  ok(gr.canReshuffle('N'), 'reshuffle disponibile in selezione');
  var deckR = sr.deck.length, discR = sr.discard.length;
  // Scarta 2 carte scelte → mano resta a 6, mazzo −2, scarti +2.
  var toss = [sr.players.N.hand[0].id, sr.players.N.hand[2].id];
  gr.reshuffleHand('N', toss);
  eq(sr.players.N.hand.length, 6, 'reshuffle: mano resta a 6 (2 scartate, 2 pescate)');
  ok(!sr.players.N.hand.some(function (c) { return toss.indexOf(c.id) !== -1; }), 'reshuffle: carte scelte non più in mano');
  eq(sr.players.N.reshuffleLeft, 1, 'reshuffle: usi decrementati');
  eq(sr.deck.length, deckR - 2, 'reshuffle: mazzo −2 (2 pescate)');
  eq(sr.discard.length, discR + 2, 'reshuffle: scarti +2 (2 scartate)');
  // Selezione non valida (0 carte) → errore.
  var threw = false; try { gr.reshuffleHand('N', []); } catch (e) { threw = true; }
  ok(threw, 'reshuffle: selezione vuota rifiutata');
  // Scarta 1 sola carta → mano resta 6, usi finiti.
  gr.reshuffleHand('N', [sr.players.N.hand[1].id]);
  eq(sr.players.N.hand.length, 6, 'reshuffle: 1 carta scartata e ripescata, mano resta 6');
  eq(sr.players.N.reshuffleLeft, 0, 'reshuffle: usi esauriti');
  ok(!gr.canReshuffle('N'), 'reshuffle: non più disponibile a usi esauriti');
})();

// -------------------------------------------------------------------- Ruleset A (abbinamento alternativo)
console.log('# Ruleset A: oggetto extra iniziale; movimento su figura senza effetti; attacco su figura → punti+trofeo+oggetto; centro → oggetto');
(function () {
  // Oggetto extra iniziale (Ruleset A): ogni giocatore 1; limite oggetti = 4.
  var gi = Engine.createGame({ rng: makeRng(3), firstPlayer: 'N', modules: { characters: false, objects: true }, altMatch: true });
  eq(gi.state.players.N.objects.length, 1, 'Ruleset A: N pesca 1 oggetto extra a inizio partita');
  eq(gi.state.players.S.objects.length, 1, 'Ruleset A: S pesca 1 oggetto extra a inizio partita');
  eq(gi._objLimit(), 4, 'Ruleset A: limite oggetti = 4');
  var giB = Engine.createGame({ rng: makeRng(3), firstPlayer: 'N', modules: { characters: false, objects: true }, altMatch: false });
  eq(giB.state.players.N.objects.length, 0, 'Ruleset B: nessun oggetto extra iniziale');
  eq(giB._objLimit(), 2, 'Ruleset B: limite oggetti = 2');

  // Movimento su figura: nessun punto, figura NON girata, nessun oggetto.
  var g = Engine.createGame({ rng: makeRng(3), firstPlayer: 'N', modules: { characters: false, objects: true }, altMatch: true });
  var s = g.state;
  g.getCell(2, 1).card = { id: 'f10', value: 10, suit: 'spade' }; g.getCell(2, 1).faceDown = false;
  s.players.N.hand = [{ id: 'h10', value: 10, suit: 'oro' }, { id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }];
  s.players.N.revealedIds = ['h10', 'a', 'b'];
  s.phase = 'move'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.moveModifier = null;
  var objBefore = s.players.N.objects.length;
  g.move('N', 2, 1, 'h10');
  eq(s.players.N.score, 0, 'Ruleset A: muovere su figura non dà punti');
  ok(!g.getCell(2, 1).faceDown, 'Ruleset A: figura non girata dal movimento');
  eq(s.players.N.objects.length, objBefore, 'Ruleset A: nessun oggetto dal movimento su figura');

  // Attacco su figura (9 → 2 punti): +2, +1 figura, +1 trofeo, apre la scelta di 1 oggetto su 3.
  var g2 = Engine.createGame({ rng: makeRng(5), firstPlayer: 'N', modules: { characters: false, objects: true }, altMatch: true });
  var s2 = g2.state;
  g2.getCell(4, 1).card = { id: 'f9', value: 9, suit: 'spade' }; g2.getCell(4, 1).faceDown = false;
  s2.players.N.hand = [{ id: 'h9', value: 9, suit: 'oro' }, { id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }];
  s2.players.N.revealedIds = ['h9', 'a', 'b'];
  s2.phase = 'attack'; s2.subPhase = null; s2.activePlayer = 'N'; s2.actionsLeft = 1; s2.attackModifier = null;
  var objB2 = s2.players.N.objects.length, deckB2 = s2.objectDeck.length;
  g2.shoot('N', 4, 1, 'h9');
  eq(s2.players.N.score, 2, 'Ruleset A: figura 9 in attacco → +2 punti');
  eq(s2.players.N.figuresMatched, 1, 'Ruleset A: figura conteggiata');
  eq(s2.players.N.trophies.length, 1, 'Ruleset A: +1 trofeo');
  ok(g2.getCell(4, 1).faceDown, 'Ruleset A: attacco gira la carta a faccia in giù');
  eq(s2.subPhase, 'altmatch-object', 'Ruleset A: figura in attacco apre la scelta di 1 oggetto su 3');
  eq(s2.pendingAltMatch.drawn.length, 3, 'Ruleset A: pescate 3 carte Oggetto');
  var keep = s2.pendingAltMatch.drawn[0].id;
  g2.altMatchPickObject(keep);
  eq(s2.players.N.objects.length, objB2 + 1, 'Ruleset A: tiene 1 oggetto');
  eq(s2.objectDiscard.length, 2, 'Ruleset A: 2 carte Oggetto non scelte negli scarti Oggetti');
  eq(s2.objectDeck.length, deckB2 - 3, 'Ruleset A: mazzo Oggetti −3');
  eq(s2.subPhase, null, 'Ruleset A: scelta risolta');

  // Attacco su NON figura → flip, nessuna scelta, nessun punto.
  var g3 = Engine.createGame({ rng: makeRng(7), firstPlayer: 'N', modules: { characters: false, objects: false }, altMatch: true });
  var s3 = g3.state;
  g3.getCell(4, 1).card = { id: 'c4', value: 4, suit: 'spade' }; g3.getCell(4, 1).faceDown = false; g3.getCell(4, 1).pawn = null;
  s3.players.N.hand = [{ id: 'h4', value: 4, suit: 'oro' }, { id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }];
  s3.players.N.revealedIds = ['h4', 'a', 'b'];
  s3.phase = 'attack'; s3.subPhase = null; s3.activePlayer = 'N'; s3.actionsLeft = 1; s3.attackModifier = null;
  g3.shoot('N', 4, 1, 'h4');
  ok(g3.getCell(4, 1).faceDown, 'Ruleset A: attacco a non-figura gira comunque a faccia in giù');
  eq(s3.players.N.score, 0, 'Ruleset A: non-figura nessun punto');
  ok(s3.subPhase !== 'altmatch-object', 'Ruleset A: non-figura non apre la scelta oggetto');

  // Movimento sul CENTRO → +5 e scelta di 1 oggetto su 3.
  var g5 = Engine.createGame({ rng: makeRng(11), firstPlayer: 'N', modules: { characters: false, objects: true }, altMatch: true });
  var s5 = g5.state;
  g5.pawnCell('N').pawn = null; g5.getCell(3, 2).pawn = 'N';
  var cc = g5.getCell(3, 3).card;
  s5.players.N.hand = [{ id: 'hc', value: cc.value, suit: 'oro' }, { id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }];
  s5.players.N.revealedIds = ['hc', 'a', 'b'];
  s5.phase = 'move'; s5.subPhase = null; s5.activePlayer = 'N'; s5.actionsLeft = 1; s5.moveModifier = null;
  g5.move('N', 3, 3, 'hc');
  eq(s5.players.N.matchedCenter, true, 'Ruleset A: centro conquistato');
  eq(s5.players.N.score, 5, 'Ruleset A: centro +5');
  eq(s5.subPhase, 'altmatch-object', 'Ruleset A: centro apre la scelta di 1 oggetto su 3');
})();

// -------------------------------------------------------------------- Scarti Oggetti + rimescolo
console.log('# Scarti Oggetti: uso/scarto alimentano la pila; mazzo Oggetti esaurito → rimescolo');
(function () {
  var g = Engine.createGame({ rng: makeRng(2), firstPlayer: 'N', modules: { characters: false, objects: true } });
  var s = g.state;
  // Svuota il mazzo Oggetti, lascia una carta negli scarti Oggetti, e forza una pesca su figura.
  s.objectDiscard = s.objectDeck.slice(); s.objectDeck = [];
  g.getCell(2, 1).card = { id: 'z8', value: 8, suit: 'spade' }; g.getCell(2, 1).faceDown = false;
  s.players.N.hand = [{ id: 'h8', value: 8, suit: 'oro' }, { id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }];
  s.players.N.revealedIds = ['h8', 'a', 'b'];
  s.phase = 'move'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.moveModifier = null;
  g.move('N', 2, 1, 'h8');
  eq(s.players.N.objects.length, 1, 'pesca dall\'insieme rimescolato degli scarti Oggetti');
  ok(s.objectDeck.length >= 8, 'scarti Oggetti rimescolati nel mazzo (meno la carta pescata)');
})();

// -------------------------------------------------------------------- Runner passiva (Ruleset A)
console.log('# Runner: muovendo su una figura (Ruleset A) può colpirla scartando 1 carta scelta; usi limitati');
(function () {
  var g = Engine.createGame({ rng: makeRng(3), firstPlayer: 'N', altMatch: true, modules: { characters: true, objects: true, powers: true }, characters: { N: 'runner', S: 'fighter' } });
  var s = g.state;
  eq(s.players.N.runnerLeft, 2, 'runner: 2 usi iniziali');
  g.getCell(2, 1).card = { id: 'f10', value: 10, suit: 'spade' }; g.getCell(2, 1).faceDown = false; g.getCell(2, 1).pawn = null;
  g.pawnCell('N').pawn = null; g.getCell(2, 2).pawn = 'N';
  s.players.N.hand = [{ id: 'm10', value: 10, suit: 'oro' }, { id: 'x2', value: 2, suit: 'oro' }, { id: 'x3', value: 3, suit: 'oro' }];
  s.players.N.revealedIds = ['m10', 'x2', 'x3'];
  s.phase = 'move'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.moveModifier = null;
  g.move('N', 2, 1, 'm10'); // arriva sulla figura
  eq(s.subPhase, 'runner-figure', 'runner: arrivo su figura apre la scelta');
  ok(g.runnerFigureOptions().length >= 1, 'runner: carte scelte disponibili da scartare');
  var scoreBefore = s.players.N.score;
  g.runnerFigureHit('x2'); // colpisci scartando x2
  eq(s.players.N.score - scoreBefore, 2, 'runner: OBIETTIVO 10 → +2 (punti fissi)');
  eq(s.players.N.figuresMatched, 1, 'runner: figura conteggiata');
  eq(s.players.N.runnerLeft, 1, 'runner: 1 uso consumato');
  ok(g.getCell(2, 1).faceDown, 'runner: figura girata');
  eq(s.subPhase, 'altmatch-object', 'runner: dopo il colpo si sceglie l\'oggetto');
  eq(s.pendingAltMatch.drawn.length, 3, 'runner: 3 oggetti (non tactician)');

  // Skip: non consuma l'uso.
  var g2 = Engine.createGame({ rng: makeRng(5), firstPlayer: 'N', altMatch: true, modules: { characters: true, objects: true, powers: true }, characters: { N: 'runner', S: 'fighter' } });
  var s2 = g2.state;
  g2.getCell(2, 1).card = { id: 'f9', value: 9, suit: 'spade' }; g2.getCell(2, 1).faceDown = false; g2.getCell(2, 1).pawn = null;
  g2.pawnCell('N').pawn = null; g2.getCell(2, 2).pawn = 'N';
  s2.players.N.hand = [{ id: 'm9', value: 9, suit: 'oro' }, { id: 'y2', value: 2, suit: 'oro' }, { id: 'y3', value: 3, suit: 'oro' }];
  s2.players.N.revealedIds = ['m9', 'y2', 'y3'];
  s2.phase = 'move'; s2.subPhase = null; s2.activePlayer = 'N'; s2.actionsLeft = 1; s2.moveModifier = null;
  g2.move('N', 2, 1, 'm9');
  eq(s2.subPhase, 'runner-figure', 'runner: apre la scelta');
  g2.runnerFigureSkip();
  eq(s2.players.N.runnerLeft, 2, 'runner: skip non consuma l\'uso');
  ok(!g2.getCell(2, 1).faceDown, 'runner: figura non girata dopo skip');
})();

// -------------------------------------------------------------------- Tactician: passiva figura + 4 oggetti
console.log('# Tactician: +1 solo colpendo una figura; sceglie tra 4 oggetti');
(function () {
  var g = Engine.createGame({ rng: makeRng(7), firstPlayer: 'N', altMatch: true, modules: { characters: true, objects: true, powers: true }, characters: { N: 'tactician', S: 'fighter' } });
  var s = g.state;
  // Attacco su una NON-figura (4): niente +1.
  g.getCell(4, 1).card = { id: 'c4', value: 4, suit: 'spade' }; g.getCell(4, 1).faceDown = false; g.getCell(4, 1).pawn = null;
  s.players.N.hand = [{ id: 'h4', value: 4, suit: 'oro' }, { id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }];
  s.players.N.revealedIds = ['h4', 'a', 'b'];
  s.firstPlayer = 'S'; s.phase = 'attack'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.attackModifier = null;
  var sc0 = s.players.N.score;
  g.shoot('N', 4, 1, 'h4');
  eq(s.players.N.score - sc0, 0, 'tactician: non-figura → nessun +1');
  // Attacco su figura (9): +2 figura +1 passiva, poi scelta tra 4 oggetti.
  var g2 = Engine.createGame({ rng: makeRng(7), firstPlayer: 'N', altMatch: true, modules: { characters: true, objects: true, powers: true }, characters: { N: 'tactician', S: 'fighter' } });
  var s2 = g2.state;
  g2.getCell(4, 1).card = { id: 'f9', value: 9, suit: 'spade' }; g2.getCell(4, 1).faceDown = false; g2.getCell(4, 1).pawn = null;
  s2.players.N.hand = [{ id: 'h9', value: 9, suit: 'oro' }, { id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }];
  s2.players.N.revealedIds = ['h9', 'a', 'b'];
  s2.firstPlayer = 'S'; s2.phase = 'attack'; s2.subPhase = null; s2.activePlayer = 'N'; s2.actionsLeft = 1; s2.attackModifier = null;
  var sc2 = s2.players.N.score;
  g2.shoot('N', 4, 1, 'h9');
  eq(s2.players.N.score - sc2, 2, 'tactician: figura 9 → +2 (nessun bonus +1)');
  eq(s2.subPhase, 'altmatch-object', 'tactician: scelta oggetto');
  eq(s2.pendingAltMatch.drawn.length, 4, 'tactician: sceglie tra 4 oggetti');
})();

// -------------------------------------------------------------------- Ruleset C
console.log('# Ruleset C: centro/riga senza punti (scelta oggetto), controllo centro a fine turno, pesca fino a 6');
(function () {
  // Centro: nessun punto, matchedCenter, scelta oggetto.
  var g = Engine.createGame({ rng: makeRng(3), firstPlayer: 'N', ruleset: 'C', modules: { objects: true } });
  var s = g.state;
  g.pawnCell('N').pawn = null; g.getCell(3, 2).pawn = 'N';
  var cc = g.getCell(3, 3).card;
  s.players.N.hand = [{ id: 'hc', value: cc.value, suit: 'oro' }, { id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }];
  s.players.N.revealedIds = ['hc', 'a', 'b'];
  s.phase = 'move'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.moveModifier = null;
  var sc0 = s.players.N.score;
  g.move('N', 3, 3, 'hc');
  eq(s.players.N.score - sc0, 0, 'Ruleset C: centro nessun punto');
  eq(s.players.N.matchedCenter, true, 'Ruleset C: centro conquistato (tiebreak)');
  eq(s.subPhase, 'altmatch-object', 'Ruleset C: centro apre la scelta oggetto');

  // Riga avversaria: nessun punto, nessuna fine partita, NESSUNA scelta oggetto (rimossa).
  var g2 = Engine.createGame({ rng: makeRng(5), firstPlayer: 'N', ruleset: 'C', modules: { objects: true } });
  var s2 = g2.state;
  s2.grid[1][1].pawn = null; s2.grid[1][4].pawn = 'N';
  s2.grid[1][5].card = { id: 't', value: 5, suit: s2.currentSuit }; s2.grid[1][5].faceDown = false; s2.grid[1][5].destroyed = false;
  s2.players.N.hand = [{ id: 'nj', value: 5, suit: s2.currentSuit }, { id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }];
  s2.players.N.revealedIds = ['nj', 'a', 'b'];
  s2.phase = 'move'; s2.subPhase = null; s2.activePlayer = 'N'; s2.actionsLeft = 1; s2.moveModifier = null;
  var sc2 = s2.players.N.score;
  g2.move('N', 1, 5, 'nj');
  eq(s2.players.N.score - sc2, 0, 'Ruleset C: riga avversaria nessun punto');
  eq(s2.endTriggered, false, 'Ruleset C: riga avversaria non termina la partita');
  ok(s2.subPhase !== 'altmatch-object', 'Ruleset C: riga avversaria NON dà più la scelta oggetto');

  // Cella bonus (non centrale): il PRIMO che entra ottiene la scelta oggetto (una tantum per cella).
  var g4 = Engine.createGame({ rng: makeRng(6), firstPlayer: 'N', ruleset: 'C', modules: { objects: true } });
  var s4 = g4.state;
  g4.pawnCell('N').pawn = null; g4.getCell(2, 2).pawn = 'N';            // N accanto a una cella bonus adiacente
  var bc = g4.getCell(2, 3); bc.card = { id: 'bcc', value: 7, suit: s4.currentSuit }; bc.faceDown = false; bc.destroyed = false; bc.pawn = null;
  s4.players.N.hand = [{ id: 'm7', value: 7, suit: s4.currentSuit }, { id: 'x', value: 2, suit: 'oro' }, { id: 'z', value: 3, suit: 'oro' }];
  s4.players.N.revealedIds = ['m7', 'x', 'z'];
  s4.phase = 'move'; s4.subPhase = null; s4.activePlayer = 'N'; s4.actionsLeft = 1; s4.moveModifier = null;
  ok(!g4.getCell(2, 3).bonusTaken, 'cella bonus: inizialmente non riscossa');
  g4.move('N', 2, 3, 'm7');
  eq(s4.subPhase, 'altmatch-object', 'cella bonus adiacente: apre la scelta oggetto');
  eq(g4.getCell(2, 3).bonusTaken, true, 'cella bonus: marcata come riscossa');
  g4.altMatchPickObject(s4.pendingAltMatch.drawn[0].id);
  // Secondo ingresso sulla stessa cella bonus: niente oggetto.
  g4.getCell(2, 3).pawn = null; g4.getCell(2, 2).pawn = 'N';
  s4.players.N.hand.push({ id: 'm7b', value: 7, suit: s4.currentSuit }); s4.players.N.revealedIds.push('m7b');
  s4.phase = 'move'; s4.subPhase = null; s4.activePlayer = 'N'; s4.actionsLeft = 1;
  g4.move('N', 2, 3, 'm7b');
  ok(s4.subPhase !== 'altmatch-object', 'cella bonus: seconda entrata niente oggetto');

  // Controllo del centro a fine turno: +3 sul centro, +1 adiacente ortogonale.
  var g3 = Engine.createGame({ rng: makeRng(2), firstPlayer: 'N', ruleset: 'C' });
  var s3 = g3.state;
  g3.pawnCell('N').pawn = null; g3.getCell(3, 3).pawn = 'N';       // N sul centro
  g3.pawnCell('S').pawn = null; g3.getCell(3, 4).pawn = 'S';       // S adiacente
  var scN = s3.players.N.score, scS = s3.players.S.score;
  g3._endRound();
  eq(s3.players.N.score - scN, 3, 'Ruleset C: pedina sul centro a fine turno +3');
  eq(s3.players.S.score - scS, 1, 'Ruleset C: pedina adiacente al centro a fine turno +1');
})();

// -------------------------------------------------------------------- Bonus vittoria clash (+3 solo attaccante) + spostamento
console.log('# Clash movimento: +3 solo all\'attaccante; l\'attaccante ricolloca il difensore; difensore/pareggio nessuno si muove');
(function () {
  // Attaccante vince → +3 all'attaccante; è l'attaccante a ricollocare il difensore (obbligatorio).
  var g = Engine.createGame({ rng: makeRng(11), firstPlayer: 'N' });
  var s = g.state;
  g.pawnCell('S').pawn = null; g.getCell(2, 1).pawn = 'S'; g.getCell(2, 1).card = { id: 'c21', value: 4, suit: 'coppe' }; g.getCell(2, 1).faceDown = false;
  s.players.N.hand = [{ id: 'n4', value: 4, suit: 'oro' }, { id: 'nA', value: 5, suit: 'oro' }, { id: 'nB', value: 6, suit: 'oro' }, { id: 'r9', value: 9, suit: 'oro' }, { id: 'r2', value: 2, suit: 'oro' }];
  s.players.S.hand = [{ id: 'sX', value: 7, suit: 'bastoni' }, { id: 'sY', value: 8, suit: 'bastoni' }, { id: 'sZ', value: 9, suit: 'bastoni' }, { id: 's3', value: 3, suit: 'bastoni' }];
  s.players.N.revealedIds = ['n4', 'nA', 'nB']; s.players.S.revealedIds = ['sX', 'sY', 'sZ'];
  s.phase = 'move'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.moveModifier = null;
  var scN0 = s.players.N.score;
  g.move('N', 2, 1, 'n4');
  g.clashChoose('N', 'r9'); g.clashChoose('S', 's3'); // 9 > 3 → attaccante vince
  eq(s.players.N.score - scN0, 3, 'clash: attaccante vincente +3');
  eq(s.subPhase, 'clash-reloc', 'attaccante vince: ricollocazione del difensore');
  eq(s.pendingClash.relocatorId, 'N', 'è l\'attaccante a ricollocare il difensore');
  eq(s.pendingClash.relocateOptional, false, 'ricollocazione obbligatoria');
  eq(g.getCell(2, 1).pawn, 'N', 'attaccante entra sulla cella');
  var opts = g.relocationOptions(); ok(opts.length > 0, 'opzioni di ricollocazione (adiacenti alla cella del difensore)');
  g.clashRelocate(opts[0].x, opts[0].y);
  eq(s.subPhase, null, 'clash concluso');

  // Difensore vince → nessun bonus, nessuno si muove.
  var g2 = Engine.createGame({ rng: makeRng(11), firstPlayer: 'N' });
  var s2 = g2.state;
  g2.pawnCell('S').pawn = null; g2.getCell(2, 1).pawn = 'S'; g2.getCell(2, 1).card = { id: 'd21', value: 4, suit: 'coppe' }; g2.getCell(2, 1).faceDown = false;
  s2.players.N.hand = [{ id: 'n4', value: 4, suit: 'oro' }, { id: 'nA', value: 5, suit: 'oro' }, { id: 'nB', value: 6, suit: 'oro' }, { id: 'r2', value: 2, suit: 'oro' }];
  s2.players.S.hand = [{ id: 'sX', value: 7, suit: 'bastoni' }, { id: 'sY', value: 8, suit: 'bastoni' }, { id: 'sZ', value: 6, suit: 'bastoni' }, { id: 's9', value: 9, suit: 'bastoni' }];
  s2.players.N.revealedIds = ['n4', 'nA', 'nB']; s2.players.S.revealedIds = ['sX', 'sY', 'sZ'];
  s2.phase = 'move'; s2.subPhase = null; s2.activePlayer = 'N'; s2.actionsLeft = 1; s2.moveModifier = null;
  var scS0 = s2.players.S.score, scN2 = s2.players.N.score;
  var nFrom = g2.pawnCell('N');
  g2.move('N', 2, 1, 'n4');
  g2.clashChoose('N', 'r2'); g2.clashChoose('S', 's9'); // 2 < 9 → difensore vince
  eq(s2.players.S.score - scS0, 0, 'clash: difensore vincente NON prende bonus');
  eq(s2.players.N.score - scN2, 0, 'clash: attaccante perdente nessun punto');
  ok(s2.subPhase !== 'clash-reloc', 'difensore vince: nessuna ricollocazione');
  eq(g2.getCell(2, 1).pawn, 'S', 'difensore resta sulla sua cella');
  eq(g2.pawnCell('N').x + ',' + g2.pawnCell('N').y, nFrom.x + ',' + nFrom.y, 'attaccante resta dov\'era');
})();

// -------------------------------------------------------------------- Clash su Attacco (opzione)
console.log('# Clash su Attacco: attacco su pedina → clash, +3 solo se vince l\'attaccante, nessuno spostamento');
(function () {
  function setup(rngSeed) {
    var g = Engine.createGame({ rng: makeRng(rngSeed), firstPlayer: 'N', clashOnAttack: true });
    var s = g.state;
    g.pawnCell('S').pawn = null; var tc = g.getCell(3, 1); tc.pawn = 'S'; tc.card = { id: 'tc', value: 4, suit: 'oro' }; tc.faceDown = false; tc.destroyed = false;
    g.pawnCell('N').pawn = null; g.getCell(1, 3).pawn = 'N';
    s.players.N.hand = [{ id: 'sh', value: 4, suit: 'oro' }, { id: 'ra', value: 5, suit: 'oro' }, { id: 'rb', value: 6, suit: 'oro' }, { id: 'rn', value: 9, suit: 'oro' }];
    s.players.N.revealedIds = ['sh', 'ra', 'rb'];
    s.players.S.hand = [{ id: 'sa', value: 2, suit: 'bastoni' }, { id: 'sb', value: 3, suit: 'bastoni' }, { id: 'sc', value: 4, suit: 'bastoni' }, { id: 'rs', value: 3, suit: 'bastoni' }];
    s.players.S.revealedIds = ['sa', 'sb', 'sc'];
    s.phase = 'attack'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.attackModifier = null;
    return g;
  }
  // Attaccante vince (9 > 3) → +3, nessuno spostamento.
  var g = setup(21), s = g.state, sc0 = s.players.N.score, nPos = g.pawnCell('N');
  var r = g.shoot('N', 3, 1, 'sh');
  eq(r.type, 'clash', 'attacco su pedina → clash');
  g.clashChoose('N', 'rn'); g.clashChoose('S', 'rs');
  eq(s.players.N.score - sc0, 3, 'attack-clash: attaccante vince +3');
  eq(g.getCell(3, 1).pawn, 'S', 'attack-clash: il difensore non si sposta');
  eq(g.pawnCell('N').x + ',' + g.pawnCell('N').y, nPos.x + ',' + nPos.y, 'attack-clash: l\'attaccante non si sposta');
  ok(g._clashResult && g._clashResult.outcome === 'attacker', 'attack-clash: risultato per il modale impostato');

  // Difensore vince (3 < 9) → nessun punto.
  var g2 = setup(22), s2 = g2.state, sc2 = s2.players.N.score, sc2s = s2.players.S.score;
  s2.players.N.hand.push({ id: 'rn2', value: 2, suit: 'oro' }); // riserva bassa
  s2.players.N.hand = s2.players.N.hand.filter(function (c) { return c.id !== 'rn'; });
  g2.shoot('N', 3, 1, 'sh');
  g2.clashChoose('N', 'rn2'); g2.clashChoose('S', 'rs'); // 2 < 3 → difensore vince
  eq(s2.players.N.score - sc2, 0, 'attack-clash: attaccante perde, 0 punti');
  eq(s2.players.S.score - sc2s, 0, 'attack-clash: difensore vince ma 0 punti');
})();

// -------------------------------------------------------------------- Nuovi TOOLS: Remix!, Encore!, Ricostruisci
console.log('# Nuovi TOOLS: Remix! (+1 REMIX), Encore! (+1 SKILL), Ricostruisci (pesca 3, scegli 1, SOVRASCRIVI)');
(function () {
  var g = Engine.createGame({ rng: makeRng(3), firstPlayer: 'N', modules: { objects: true, reshuffle: true }, reshuffleCount: 2 });
  var s = g.state;
  s.players.N.objects = [{ id: 'rx', type: 'remix', phase: 'select', fromCharacter: false }];
  s.phase = 'select'; s.subPhase = null;
  var rl0 = s.players.N.reshuffleLeft;
  g.useObject('N', 'rx');
  eq(s.players.N.reshuffleLeft - rl0, 1, 'Remix!: +1 uso REMIX');

  var g2 = Engine.createGame({ rng: makeRng(3), firstPlayer: 'N', modules: { characters: true, objects: true, powers: true }, characters: { N: 'tactician', S: 'runner' } });
  var s2 = g2.state;
  s2.players.N.objects = [{ id: 'en', type: 'encore', phase: 'select', fromCharacter: false }];
  s2.phase = 'select'; s2.subPhase = null;
  var tl0 = s2.players.N.tacticianLeft;
  g2.useObject('N', 'en');
  eq(s2.players.N.tacticianLeft - tl0, 1, 'Encore!: +1 uso SKILL');

  var g3 = Engine.createGame({ rng: makeRng(3), firstPlayer: 'N', modules: { objects: true } });
  var s3 = g3.state;
  var dc = g3.getCell(2, 2); dc.destroyed = true; dc.card = null;
  s3.players.N.objects = [{ id: 'rb', type: 'rebuild', phase: 'move', fromCharacter: false }];
  s3.phase = 'move'; s3.subPhase = null; s3.activePlayer = 'N'; s3.actionsLeft = 1; s3.moveModifier = null; s3.firstPlayer = 'N';
  g3.useObject('N', 'rb');
  eq(s3.subPhase, 'rebuild-select', 'Ricostruisci: apre la scelta della carta');
  ok(g3.rebuildDrawn().length >= 1 && g3.rebuildDrawn().length <= 3, 'Ricostruisci: PESCA fino a 3');
  g3.rebuildSelectCard(g3.rebuildDrawn()[0].id);
  eq(s3.subPhase, 'rebuild-place', 'Ricostruisci: apre la scelta della CELLA');
  ok(g3.rebuildTargets().some(function (o) { return o.x === 2 && o.y === 2; }), 'Ricostruisci: la CELLA DISTRUTTA è bersaglio');
  g3.rebuildPlace(2, 2);
  ok(!g3.getCell(2, 2).destroyed && g3.getCell(2, 2).card, 'Ricostruisci: la CELLA torna ONLINE con la carta scelta');
  eq(s3.subPhase, null, 'Ricostruisci: concluso');
  eq(s3.actionsLeft, 1, 'Ricostruisci: non consuma l\'azione');
})();

// -------------------------------------------------------------------- Fine turno: scarto in eccesso oltre 6 carte
console.log('# Fine turno: chi ha più di 6 carte scarta fino a 6; a inizio turno tutti hanno 6');
(function () {
  var g = Engine.createGame({ rng: makeRng(5), firstPlayer: 'N' });
  var s = g.state;
  s.round = 3;
  s.players.N.hand = [1, 2, 3, 4, 5, 6, 7, 8].map(function (v, i) { return { id: 'n' + i, value: v, suit: 'oro' }; });
  s.players.S.hand = [1, 2, 3, 4].map(function (v, i) { return { id: 's' + i, value: v, suit: 'oro' }; });
  s.players.N.revealedIds = []; s.players.S.revealedIds = [];
  g._endRound();
  eq(s.subPhase, 'end-discard', 'N con 8 carte apre lo scarto in eccesso');
  eq(s.pendingEndDiscard.playerId, 'N', 'tocca a N');
  eq(s.pendingEndDiscard.need, 2, 'N deve scartare 2 carte');
  eq(g.endDiscardOptions().length, 8, 'sceglie tra le sue 8 carte');
  g.endDiscardToggle('n0'); g.endDiscardToggle('n1');
  g.endDiscardConfirm();
  eq(s.players.N.hand.length, 6, 'N: 6 carte a inizio nuovo round');
  eq(s.players.S.hand.length, 6, 'S: pescato fino a 6');
  eq(s.round, 4, 'round avanzato');
})();

// -------------------------------------------------------------------- Clash su Attacco: figura + homing
console.log('# Clash su Attacco: su figura (vinta) gira la carta, dà punti figura e scelta oggetto; con homing distrugge');
(function () {
  // Ruleset C, attacco su FIGURA (valore 9) con pedina avversaria: attaccante vince → carta girata,
  // +punti figura, scelta oggetto; e il +3 del clash.
  var g = Engine.createGame({ rng: makeRng(31), firstPlayer: 'N', ruleset: 'C', clashOnAttack: true, modules: { objects: true } });
  var s = g.state;
  g.pawnCell('S').pawn = null; var tc = g.getCell(3, 1); tc.pawn = 'S'; tc.card = { id: 'f9', value: 9, suit: 'oro' }; tc.faceDown = false; tc.destroyed = false;
  g.pawnCell('N').pawn = null; g.getCell(1, 3).pawn = 'N';
  s.players.N.hand = [{ id: 'sh', value: 9, suit: 'oro' }, { id: 'ra', value: 5, suit: 'oro' }, { id: 'rb', value: 6, suit: 'oro' }, { id: 'rn', value: 9, suit: 'oro' }];
  s.players.N.revealedIds = ['sh', 'ra', 'rb'];
  s.players.S.hand = [{ id: 'sa', value: 2, suit: 'bastoni' }, { id: 'sb', value: 3, suit: 'bastoni' }, { id: 'sc', value: 4, suit: 'bastoni' }, { id: 'rs', value: 3, suit: 'bastoni' }];
  s.players.S.revealedIds = ['sa', 'sb', 'sc'];
  s.phase = 'attack'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.attackModifier = null;
  var sc0 = s.players.N.score, fig0 = s.players.N.figuresMatched;
  g.shoot('N', 3, 1, 'sh');
  g.clashChoose('N', 'rn'); g.clashChoose('S', 'rs'); // 9 > 3 → attaccante vince
  eq(s.players.N.score - sc0, 3 + Deck.figurePoints({ value: 9 }), 'attack-clash figura: +3 clash + punti figura');
  eq(s.players.N.figuresMatched - fig0, 1, 'attack-clash figura: figura conteggiata');
  ok(g.getCell(3, 1).faceDown, 'attack-clash figura: carta girata a faccia in giù');
  eq(s.subPhase, 'altmatch-object', 'attack-clash figura: scelta oggetto offerta');

  // Homing su pedina: attaccante vince → la cella viene distrutta.
  var g2 = Engine.createGame({ rng: makeRng(32), firstPlayer: 'N', ruleset: 'C', clashOnAttack: true, modules: { objects: true } });
  var s2 = g2.state;
  g2.pawnCell('S').pawn = null; var tc2 = g2.getCell(3, 1); tc2.pawn = 'S'; tc2.card = { id: 'h4', value: 4, suit: 'oro' }; tc2.faceDown = false; tc2.destroyed = false;
  g2.pawnCell('N').pawn = null; g2.getCell(1, 3).pawn = 'N';
  s2.players.N.hand = [{ id: 'sh', value: 4, suit: 'oro' }, { id: 'ra', value: 5, suit: 'oro' }, { id: 'rb', value: 6, suit: 'oro' }, { id: 'rn', value: 9, suit: 'oro' }];
  s2.players.N.revealedIds = ['sh', 'ra', 'rb'];
  s2.players.S.hand = [{ id: 'sa', value: 2, suit: 'bastoni' }, { id: 'sb', value: 3, suit: 'bastoni' }, { id: 'sc', value: 4, suit: 'bastoni' }, { id: 'rs', value: 3, suit: 'bastoni' }];
  s2.players.S.revealedIds = ['sa', 'sb', 'sc'];
  s2.players.N.objects = [{ id: 'hm', type: 'homing_missile', phase: 'attack', fromCharacter: false }];
  s2.phase = 'attack'; s2.subPhase = null; s2.activePlayer = 'N'; s2.actionsLeft = 1; s2.attackModifier = null;
  g2.useObject('N', 'hm'); // arma homing
  var r2 = g2.shoot('N', 3, 1, 'sh');
  eq(r2.type, 'clash', 'homing su pedina + clashOnAttack: apre comunque il clash');
  g2.clashChoose('N', 'rn'); g2.clashChoose('S', 'rs'); // attaccante vince
  ok(g2.getCell(3, 1).destroyed, 'attack-clash + homing: cella distrutta dopo la vittoria');
})();

// -------------------------------------------------------------------- Ruleset C 4×4 (celle bonus)
console.log('# Ruleset C 4×4: griglia 4×4, niente centro, +2 sulle celle bonus a fine turno');
(function () {
  var g = Engine.createGame({ rng: makeRng(4), firstPlayer: 'N', ruleset: 'C', gridSize: 4 });
  var s = g.state;
  eq(s.gridSize, 4, '4×4: gridSize = 4');
  ok(!s.grid[5], '4×4: nessuna colonna 5');
  eq(g.pawnCell('N').x + ',' + g.pawnCell('N').y, '1,1', '4×4: N parte da [1,1]');
  eq(g.pawnCell('S').x + ',' + g.pawnCell('S').y, '4,4', '4×4: S parte da [4,4]');
  ok(!Engine.isCenter(3, 3, 4), '4×4: [3,3] non è centro');
  ok(Engine.isBonusCell(2, 2, 4) && Engine.isBonusCell(3, 3, 4) && Engine.isBonusCell(2, 3, 4) && Engine.isBonusCell(3, 2, 4), '4×4: le 4 celle centrali sono bonus');
  ok(!Engine.isBonusCell(1, 1, 4) && !Engine.isBonusCell(2, 1, 4), '4×4: le celle esterne non sono bonus');

  // Fine turno: N su cella bonus +2, S fuori dalle bonus nessun bonus.
  g.pawnCell('N').pawn = null; g.getCell(2, 2).pawn = 'N';
  g.pawnCell('S').pawn = null; g.getCell(1, 1).pawn = 'S';
  var scN = s.players.N.score, scS = s.players.S.score;
  g._endRound();
  eq(s.players.N.score - scN, 2, '4×4: pedina su cella bonus a fine turno +2');
  eq(s.players.S.score - scS, 0, '4×4: pedina fuori dalle celle bonus nessun punto');
})();

// -------------------------------------------------------------------- Numero di round (Ruleset C)
console.log('# Ruleset C: numero di round configurabile (7–11), default 9');
(function () {
  var g = Engine.createGame({ rng: makeRng(3), firstPlayer: 'N', ruleset: 'C', maxRounds: 7 });
  eq(g.state.maxRounds, 7, 'C: maxRounds impostato a 7');
  // porta lo stato all'ultimo round e chiudi
  g.state.round = 7; g.state.players.N.revealedIds = []; g.state.players.S.revealedIds = [];
  g._endRound();
  ok(g.state.gameOver, 'C 7 round: la partita finisce al round 7');

  var g2 = Engine.createGame({ rng: makeRng(3), firstPlayer: 'N', ruleset: 'C', maxRounds: 11 });
  eq(g2.state.maxRounds, 11, 'C: maxRounds impostato a 11');
  g2.state.round = 9; g2.state.players.N.revealedIds = []; g2.state.players.S.revealedIds = [];
  g2._endRound();
  ok(!g2.state.gameOver, 'C 11 round: al round 9 la partita continua');

  var g3 = Engine.createGame({ rng: makeRng(3), firstPlayer: 'N', maxRounds: 11 }); // ruleset B ignora maxRounds
  eq(g3.state.maxRounds, 9, 'A/B: maxRounds resta 9 (non configurabile)');

  var g4 = Engine.createGame({ rng: makeRng(3), firstPlayer: 'N', ruleset: 'C' });
  eq(g4.state.maxRounds, 9, 'C: default 9 round');
  var g5 = Engine.createGame({ rng: makeRng(3), firstPlayer: 'N', ruleset: 'C', maxRounds: 20 });
  eq(g5.state.maxRounds, 11, 'C: maxRounds oltre il limite viene ridotto a 11');
})();

// -------------------------------------------------------------------- Teleport (Ruleset C)
console.log('# Teleport (Ruleset C): stesso valore, niente pedina avversaria');
(function () {
  var g = Engine.createGame({ rng: makeRng(7), firstPlayer: 'N', ruleset: 'C', modules: { objects: true } });
  var s = g.state;
  g.pawnCell('N').pawn = null; var here = g.getCell(2, 2); here.pawn = 'N'; here.card = { id: 'h6', value: 6, suit: 'oro' }; here.faceDown = false; here.destroyed = false;
  var t1 = g.getCell(4, 4); t1.card = { id: 't6', value: 6, suit: 'spade' }; t1.faceDown = false; t1.destroyed = false; t1.pawn = null;
  g.pawnCell('S').pawn = null; var t2 = g.getCell(5, 5); t2.card = { id: 's6', value: 6, suit: 'coppe' }; t2.faceDown = false; t2.destroyed = false; t2.pawn = 'S';
  s.players.N.objects = [{ id: 'tp', type: 'teleport', phase: 'move', fromCharacter: false }];
  s.phase = 'move'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.moveModifier = null;
  ok(g.usableObjects('N').some(function (o) { return o.id === 'tp'; }), 'teleport: usabile con un bersaglio valido');
  g.useObject('N', 'tp');
  eq(s.subPhase, 'teleport-select', 'teleport: apre la selezione');
  var tg = g.teleportTargets().map(function (o) { return o.x + ',' + o.y; });
  ok(tg.indexOf('4,4') !== -1, 'teleport: [4,4] (valore 6, libera) è bersaglio');
  ok(tg.indexOf('5,5') === -1, 'teleport: [5,5] (pedina avversaria) NON è bersaglio');
  g.teleportTo(4, 4);
  eq(g.getCell(4, 4).pawn, 'N', 'teleport: pedina spostata');
  eq(g.getCell(2, 2).pawn, null, 'teleport: cella di partenza liberata');
})();

// -------------------------------------------------------------------- Grappling Hook (Ruleset C)
console.log('# Grappling Hook (Ruleset C): aggiunge le celle adiacenti all\'avversario');
(function () {
  var g = Engine.createGame({ rng: makeRng(8), firstPlayer: 'N', ruleset: 'C', modules: { objects: true } });
  var s = g.state;
  g.pawnCell('N').pawn = null; g.getCell(4, 4).pawn = 'N';
  g.pawnCell('S').pawn = null; g.getCell(2, 2).pawn = 'S';
  var adj = g.getCell(1, 2); adj.card = { id: 'a5', value: 5, suit: s.currentSuit }; adj.faceDown = false; adj.pawn = null; adj.destroyed = false; // ortogonale a S, non bonus
  s.players.N.hand = [{ id: 'm5', value: 5, suit: s.currentSuit }, { id: 'x1', value: 2, suit: 'oro' }, { id: 'x2', value: 3, suit: 'oro' }];
  s.players.N.revealedIds = ['m5', 'x1', 'x2'];
  s.players.N.objects = [{ id: 'gp', type: 'grapple', phase: 'move', fromCharacter: false }];
  s.phase = 'move'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.moveModifier = null;
  ok(!g.legalMoves('N').some(function (m) { return m.x === 1 && m.y === 2; }), 'senza grapple [1,2] non raggiungibile');
  ok(g.usableObjects('N').some(function (o) { return o.id === 'gp'; }), 'grapple: usabile');
  g.useObject('N', 'gp');
  eq(s.subPhase, 'tool-discard', 'grapple: chiede la carta da scartare');
  g.toolDiscardChoose('x1');
  eq(s.moveModifier, 'grapple', 'grapple: modificatore armato');
  ok(g.legalMoves('N').some(function (m) { return m.x === 1 && m.y === 2; }), 'con grapple [1,2] (adiacente a S) è raggiungibile');
  g.move('N', 1, 2, 'm5');
  eq(g.getCell(1, 2).pawn, 'N', 'grapple: mossa eseguita');
})();

// -------------------------------------------------------------------- Distruzione bloccata (pedina senza uscite)
console.log('# Distruzione: cella con pedina non distrutta se non ha celle libere adiacenti');
(function () {
  var g = Engine.createGame({ rng: makeRng(9), firstPlayer: 'N', modules: { objects: true } });
  var s = g.state;
  g.pawnCell('N').pawn = null; g.pawnCell('S').pawn = null; // libera le posizioni iniziali
  var sc = g.getCell(1, 1); sc.pawn = 'S'; sc.card = { id: 'sc', value: 7, suit: 'oro' }; sc.faceDown = false; sc.destroyed = false;
  g.getCell(2, 1).destroyed = true; g.getCell(2, 1).card = null;
  g.getCell(1, 2).destroyed = true; g.getCell(1, 2).card = null;
  g.getCell(3, 1).pawn = 'N';
  s.players.N.hand = [{ id: 'n7', value: 7, suit: 'oro' }]; s.players.N.revealedIds = ['n7'];
  s.players.N.objects = [{ id: 'hm', type: 'homing_missile', phase: 'attack', fromCharacter: false }];
  s.phase = 'attack'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.attackModifier = null;
  g.useObject('N', 'hm');
  g.shoot('N', 1, 1, 'n7');
  ok(!g.getCell(1, 1).destroyed, 'cella con pedina senza uscite: NON distrutta');
  eq(g.getCell(1, 1).pawn, 'S', 'la pedina resta sulla cella');
})();

// -------------------------------------------------------------------- Pesca fino a 6 + energy drain
console.log('# Pesca fino a 6 a inizio turno; energy drain solo tra le carte scelte avversarie');
(function () {
  var g = Engine.createGame({ rng: makeRng(8), firstPlayer: 'N' });
  var s = g.state;
  s.players.N.revealedIds = s.players.N.hand.slice(0, 3).map(function (c) { return c.id; });
  s.players.S.revealedIds = s.players.S.hand.slice(0, 3).map(function (c) { return c.id; });
  g._endRound();
  eq(s.players.N.hand.length, 6, 'pesca fino a 6 a inizio turno (N)');
  eq(s.players.S.hand.length, 6, 'pesca fino a 6 a inizio turno (S)');

  var g2 = Engine.createGame({ rng: makeRng(11), firstPlayer: 'N', modules: { objects: true } });
  var s2 = g2.state; s2.phase = 'attack'; s2.activePlayer = 'N'; s2.actionsLeft = 1; s2.attackModifier = null;
  s2.players.N.objects = [{ id: 'ed', type: 'energy_drain', phase: 'attack', fromCharacter: false }];
  s2.players.S.revealedIds = []; s2.players.S.revealedCards = [];
  ok(!g2.usableObjects('N').some(function (o) { return o.id === 'ed'; }), 'energy drain NON usabile se l\'avversario non ha carte scelte');
  var oppCard = s2.players.S.hand[0];
  s2.players.S.revealedIds = [oppCard.id]; s2.players.S.revealedCards = [oppCard];
  ok(g2.usableObjects('N').some(function (o) { return o.id === 'ed'; }), 'energy drain usabile con una carta scelta avversaria');
  g2.useObject('N', 'ed');
  ok(s2.players.N.hand.some(function (c) { return c.id === oppCard.id; }), 'energy drain: ruba la carta scelta avversaria');
  ok(!s2.players.S.hand.some(function (c) { return c.id === oppCard.id; }), 'energy drain: la carta lascia la mano avversaria');
})();

// -------------------------------------------------------------------- Struttura del turno (1221 vs 1212)
console.log('# Struttura del turno: ordine di attacco 1-2-2-1 vs 1-2-1-2');
(function () {
  // 1221: attacco G2 → G1.
  var g1 = Engine.createGame({ rng: makeRng(7), firstPlayer: 'N', turnMode: '1221' });
  toMovePhase(g1); var s1 = g1.state;
  g1.passMove(s1.activePlayer); g1.passMove(s1.activePlayer);
  eq(s1.phase, 'attack', '1221: fase di attacco raggiunta');
  eq(s1.activePlayer, 'S', '1221: attacca per primo G2 (S)');
  g1.passShoot(s1.activePlayer);
  eq(s1.activePlayer, 'N', '1221: poi attacca G1 (N)');

  // 1212: attacco G1 → G2.
  var g2 = Engine.createGame({ rng: makeRng(7), firstPlayer: 'N', turnMode: '1212' });
  toMovePhase(g2); var s2 = g2.state;
  g2.passMove(s2.activePlayer); g2.passMove(s2.activePlayer);
  eq(s2.phase, 'attack', '1212: fase di attacco raggiunta');
  eq(s2.activePlayer, 'N', '1212: attacca per primo G1 (N)');
  g2.passShoot(s2.activePlayer);
  eq(s2.activePlayer, 'S', '1212: poi attacca G2 (S)');
})();

// -------------------------------------------------------------------- Statistiche di partita
console.log('# Statistiche di partita (breakdown punti, contatori azioni/oggetti)');
(function () {
  var Cpu = require('../js/cpu.js');
  function whoActs(s, g) {
    if (s.gameOver) return null;
    if (s.subPhase === 'object-discard') return s.pendingObjectDiscard.playerId;
    if (s.subPhase === 'end-discard') return s.pendingEndDiscard.playerId;
    if (s.subPhase === 'rebuild-select' || s.subPhase === 'rebuild-place') return s.pendingRebuild.playerId;
    if (s.subPhase === 'tool-discard') return s.pendingToolDiscard && s.pendingToolDiscard.playerId;
    if (s.subPhase === 'runner-figure') return s.pendingRunner && s.pendingRunner.playerId;
    if (s.subPhase === 'timebomb-suit') return s.pendingTimebomb.playerId;
    if (s.subPhase === 'elemental-target' || s.subPhase === 'elemental-suit') return s.pendingElemental.playerId;
    if (s.subPhase === 'barrage-first' || s.subPhase === 'barrage-second' || s.subPhase === 'barrage-third') return s.pendingBarrage.playerId;
    if (s.subPhase === 'randomizer-select' || s.subPhase === 'randomizer-place') return s.pendingRandomizer.playerId;
    if (s.subPhase === 'altmatch-choice' || s.subPhase === 'altmatch-object') return s.pendingAltMatch.playerId;
    if (s.subPhase === 'clash-cards') return g.clashCurrentChooser();
    if (s.subPhase === 'clash-reloc') return s.pendingClash.relocatorId;
    if (s.subPhase === 'forced-reloc') return s.pendingForced.chooserId;
    if (s.subPhase) return null;
    if (s.phase === 'select') return s.selected.N == null ? 'N' : (s.selected.S == null ? 'S' : null);
    if (s.phase === 'move' || s.phase === 'attack') return s.activePlayer;
    return null;
  }
  // Stato iniziale: tutte le statistiche a zero.
  var g0 = Engine.createGame({ rng: makeRng(1), modules: { characters: true, objects: true, powers: true } });
  var st0 = g0.state.players.N.stats;
  ok(st0 && st0.ptsPawn === 0 && st0.ptsFigure === 0 && st0.ptsBonus === 0 && st0.moves === 0 &&
     st0.attacks === 0 && st0.objUses === 0 && st0.zeroActionTurns === 0, 'stats inizializzate a zero');
  // Partite complete: invarianti sulle statistiche.
  [1, 7, 42, 99].forEach(function (seed) {
    var g = Engine.createGame({ rng: makeRng(seed), suitMode: 'rotating', ruleset: 'C', gridSize: 5, maxRounds: 9,
      turnMode: '1221', clashOnAttack: true, reshuffleCount: 2,
      modules: { characters: true, objects: true, powers: true, reshuffle: true }, characters: { N: 'runner', S: 'brawler' } });
    var s = g.state, guard = 0;
    while (!s.gameOver && guard++ < 6000) { var a = whoActs(s, g); if (!a) break; Cpu.cpuAct(g, a); }
    ok(s.gameOver, 'seed ' + seed + ': partita conclusa');
    ['N', 'S'].forEach(function (id) {
      var p = s.players[id], stx = p.stats;
      eq(stx.ptsPawn + stx.ptsFigure + stx.ptsBonus, p.score, 'seed ' + seed + ' ' + id + ': breakdown punti = totale');
      var objSum = 0; Object.keys(stx.objByType).forEach(function (k) { objSum += stx.objByType[k]; });
      eq(objSum, stx.objUses, 'seed ' + seed + ' ' + id + ': dettaglio oggetti = totale usi');
      ok(stx.zeroActionTurns <= s.round, 'seed ' + seed + ' ' + id + ': turni-a-zero entro i round');
      ok(stx.moves >= 0 && stx.attacks >= 0 && p.trophies.length >= 0, 'seed ' + seed + ' ' + id + ': contatori non negativi');
    });
  });
})();

// -------------------------------------------------------------------- The Sniper (brawler) + Clash su Attacco
console.log('# The Sniper: in ATTACCO su una CELLA OCCUPATA la SKILL apre un clash');
(function () {
  var g = Engine.createGame({ rng: makeRng(3), clashOnAttack: true,
    modules: { characters: true, objects: true, powers: true }, characters: { N: 'brawler', S: 'fighter' } });
  toMovePhase(g);
  var s = g.state;
  // Porta N (brawler) in ATTACCO con 3 carte attive disponibili e la pedina avversaria come bersaglio.
  s.phase = 'attack'; s.activePlayer = 'N'; s.actionsLeft = 1;
  ok(g.canBrawler('N'), 'brawler attivabile in attacco con 3 carte attive');
  var sc = g.pawnCell('S');
  ok(g.brawlerTargets('N').some(function (t) { return t.x === sc.x && t.y === sc.y; }), 'la pedina avversaria è un bersaglio valido');
  g.brawlerAction('N', sc.x, sc.y);
  eq(s.subPhase, 'clash-cards', 'la SKILL su pedina avversaria apre un clash');
  ok(s.pendingClash && s.pendingClash.isAttack === true && s.pendingClash.attackerId === 'N', 'clash da ATTACCO impostato correttamente');
})();

// -------------------------------------------------------------------- Variante Draft
console.log('# Draft: griglia costruita a turno, griglia piena, 5×5 ultimo turno = 1 carta');
(function () {
  function driveDraft(gridSize) {
    var g = Engine.createGame({ rng: makeRng(4), ruleset: 'C', gridSize: gridSize, gridMode: 'draft', maxRounds: 8, firstPlayer: 'N',
      modules: { characters: true, objects: true, powers: true } });
    var s = g.state, guard = 0, placedBy = { N: 0, S: 0 };
    ok(s.phase === 'draft' && s.subPhase === 'draft-select', gridSize + ': parte in fase draft');
    ok(s.players.N.hand.length === 0 && s.players.S.hand.length === 0, gridSize + ': mani vuote durante il draft');
    while (s.phase === 'draft' && guard++ < 500) {
      if (s.subPhase === 'draft-select') { var dd = g.draftDrawn(); ok(dd.length <= 4, gridSize + ': max 4 carte pescate'); g.draftSelectCard(dd[0].id); }
      else if (s.subPhase === 'draft-place') { var who = s.pendingDraft.playerId; var t = g.draftTargets(); g.draftPlace(t[0].x, t[0].y); placedBy[who]++; }
      else break;
    }
    var filled = 0; for (var x = 1; x <= gridSize; x++) for (var y = 1; y <= gridSize; y++) if (g.getCell(x, y).card) filled++;
    eq(filled, gridSize * gridSize, gridSize + ': griglia completamente piena');
    eq(placedBy.N + placedBy.S, gridSize * gridSize, gridSize + ': carte piazzate = celle');
    eq(s.phase, 'select', gridSize + ': dopo il draft si passa a DEPLOY');
    eq(s.players.N.hand.length, 6, gridSize + ': mano N da 6 dopo il draft');
    eq(s.players.S.hand.length, 6, gridSize + ': mano S da 6 dopo il draft');
    ok(s.deck.length > 0, gridSize + ': mazzo rimescolato non vuoto');
    return placedBy;
  }
  driveDraft(4);
  var p5 = driveDraft(5);
  // 5×5 = 25 celle (dispari): il 1° Pilota piazza una carta in più (ultimo turno = 1 carta).
  eq(p5.N + p5.S, 25, '5×5: 25 carte totali');
  eq(Math.abs(p5.N - p5.S), 1, '5×5: differenza di 1 carta (ultimo turno singolo)');
})();

// -------------------------------------------------------------------- Multiplayer (3-4 giocatori)
console.log('# Multiplayer: seggi agli angoli, ordine orario, struttura del TURNO M G1..Gk / A Gk..G1');
(function () {
  // 4 giocatori: angoli fissi e ordine orario da firstPlayer.
  var g = Engine.createGame({ rng: makeRng(1), numPlayers: 4, ruleset: 'C', gridSize: 5, firstPlayer: 'N',
    modules: { characters: true, objects: true, powers: true }, characters: ['runner', 'brawler', 'tactician', 'fighter'] });
  var s = g.state;
  eq(s.numPlayers, 4, '4 giocatori');
  eq(g.allPlayers().join(''), 'NESW', '4 seggi in ordine orario NESW');
  eq(g.getCell(1, 1).pawn, 'N', 'N su [1,1] (NW)');
  eq(g.getCell(5, 1).pawn, 'E', 'E su [5,1] (NE)');
  eq(g.getCell(5, 5).pawn, 'S', 'S su [5,5] (SE)');
  eq(g.getCell(1, 5).pawn, 'W', 'W su [1,5] (SW)');
  eq(s.playerOrder.join(''), 'NESW', 'ordine di gioco orario da N');
  // Struttura del turno 1-2-3-4 in MOVIMENTO, 4-3-2-1 in ATTACCO.
  ['N', 'E', 'S', 'W'].forEach(function (id) { g.selectCards(id, s.players[id].hand.slice(0, 3).map(function (c) { return c.id; })); });
  eq(s.phase, 'move', 'dopo il DEPLOY: MOVIMENTO'); eq(s.activePlayer, 'N', 'muove per primo N (G1)');
  var moveSeq = [];
  for (var i = 0; i < 4; i++) { moveSeq.push(s.activePlayer); g.passMove(s.activePlayer); }
  eq(moveSeq.join(''), 'NESW', 'ordine MOVIMENTO: G1→G4 (N,E,S,W)');
  eq(s.phase, 'attack', 'poi ATTACCO'); eq(s.activePlayer, 'W', 'attacca per primo W (G4, iniziativa divisa)');
  var atkSeq = [];
  for (var j = 0; j < 4; j++) { atkSeq.push(s.activePlayer); g.passShoot(s.activePlayer); }
  eq(atkSeq.join(''), 'WSEN', 'ordine ATTACCO: G4→G1 (W,S,E,N)');
  // Fine ROUND: il 1° Pilota passa in senso orario (N → E).
  eq(s.firstPlayer, 'E', 'fine ROUND: 1° Pilota passa orario a E');

  // 3 giocatori: esattamente 3 seggi occupati fra i 4 angoli.
  var g3 = Engine.createGame({ rng: makeRng(5), numPlayers: 3, ruleset: 'C', gridSize: 5,
    modules: { characters: true }, characters: ['runner', 'brawler', 'tactician'] });
  eq(g3.allPlayers().length, 3, '3 giocatori: 3 seggi');
  var corners = 0; [[1, 1], [5, 1], [5, 5], [1, 5]].forEach(function (c) { if (g3.getCell(c[0], c[1]).pawn) corners++; });
  eq(corners, 3, '3 pedine sui 4 angoli');
  // 3-4 giocatori solo su 5×5: richiesta di 4 su 4×4 → ricade a 2.
  var g4x4 = Engine.createGame({ rng: makeRng(1), numPlayers: 4, ruleset: 'C', gridSize: 4 });
  eq(g4x4.state.numPlayers, 2, '4×4: multiplayer disattivato → 2 giocatori');
})();

// -------------------------------------------------------------------- Regressione: clash da MOVIMENTO senza ricollocazione
console.log('# Clash MOVIMENTO vinto senza cella per il difensore: nessun softlock, pedine integre');
(function () {
  var Cpu = require('../js/cpu.js');
  function whoActs(s, g) {
    if (s.gameOver) return null;
    if (s.subPhase === 'object-discard') return s.pendingObjectDiscard.playerId;
    if (s.subPhase === 'end-discard') return s.pendingEndDiscard.playerId;
    if (s.subPhase === 'rebuild-select' || s.subPhase === 'rebuild-place') return s.pendingRebuild.playerId;
    if (s.subPhase === 'draft-select' || s.subPhase === 'draft-place') return s.pendingDraft.playerId;
    if (s.subPhase === 'energy-target') return s.pendingEnergy.playerId;
    if (s.subPhase === 'teleport-select') return s.pendingTeleport.playerId;
    if (s.subPhase === 'tool-discard') return s.pendingToolDiscard && s.pendingToolDiscard.playerId;
    if (s.subPhase === 'runner-figure') return s.pendingRunner && s.pendingRunner.playerId;
    if (s.subPhase === 'timebomb-suit') return s.pendingTimebomb.playerId;
    if (s.subPhase === 'elemental-target' || s.subPhase === 'elemental-suit') return s.pendingElemental.playerId;
    if (s.subPhase === 'barrage-first' || s.subPhase === 'barrage-second' || s.subPhase === 'barrage-third') return s.pendingBarrage.playerId;
    if (s.subPhase === 'randomizer-select' || s.subPhase === 'randomizer-place') return s.pendingRandomizer.playerId;
    if (s.subPhase === 'altmatch-object') return s.pendingAltMatch.playerId;
    if (s.subPhase === 'clash-cards') return g.clashCurrentChooser();
    if (s.subPhase === 'clash-reloc') return s.pendingClash.relocatorId;
    if (s.subPhase === 'forced-reloc') return s.pendingForced.chooserId;
    if (s.subPhase) return null;
    if (s.phase === 'select') { var o = g.allPlayers(); for (var i = 0; i < o.length; i++) if (s.selected[o[i]] == null) return o[i]; return null; }
    if (s.phase === 'move' || s.phase === 'attack') return s.activePlayer;
    return null;
  }
  // Semi che in precedenza andavano in softlock (griglia affollata a 4 giocatori).
  [2565, 3432, 4645, 5295, 5509, 5623, 5664, 5800].forEach(function (seed) {
    var g = Engine.createGame({ rng: makeRng(seed), numPlayers: 4, suitMode: 'rotating', ruleset: 'C', gridSize: 5, maxRounds: 8,
      turnMode: '1221', gridMode: 'random', clashOnAttack: true, reshuffleCount: 2,
      modules: { characters: true, objects: true, powers: true, reshuffle: true }, characters: ['runner', 'brawler', 'tactician', 'fighter'] });
    var s = g.state, guard = 0, stuck = false;
    while (!s.gameOver && guard++ < 40000) { var a = whoActs(s, g); if (!a) { stuck = true; break; } Cpu.cpuAct(g, a); }
    ok(!stuck && s.gameOver, 'seed ' + seed + ': partita conclusa senza softlock');
    // A fine partita ogni giocatore deve avere ancora la sua pedina sul campo.
    var allHave = g.allPlayers().every(function (id) { return !!g.pawnCell(id); });
    ok(allHave, 'seed ' + seed + ': nessuna pedina persa');
  });
})();

// --------------------------------------------------------------------
console.log('\n=== Risultato: ' + passed + ' passati, ' + failed + ' falliti ===');
process.exit(failed ? 1 : 0);

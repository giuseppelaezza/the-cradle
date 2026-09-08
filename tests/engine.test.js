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
  eq(s.players.N.score, 3, 'figura 10 → +3');
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

// -------------------------------------------------------------------- Clash attaccante 2 / difensore 3
console.log('# Clash: attaccante 2, difensore 3; vittoria attaccante + ricollocazione');
(function () {
  var g = Engine.createGame({ rng: makeRng(11), firstPlayer: 'N' });
  var s = g.state;
  g.pawnCell('S').pawn = null; g.getCell(2, 1).pawn = 'S'; g.getCell(2, 1).card = { id: 'c21', value: 4, suit: 'coppe' }; g.getCell(2, 1).faceDown = false;
  s.players.N.hand = [{ id: 'n4', value: 4, suit: 'oro' }, { id: 'n9', value: 9, suit: 'oro' }, { id: 'n2', value: 2, suit: 'oro' }];
  s.players.S.hand = [{ id: 's3', value: 3, suit: 'bastoni' }, { id: 's1', value: 1, suit: 'bastoni' }, { id: 's2', value: 2, suit: 'bastoni' }];
  s.players.N.revealedIds = ['n4', 'n9', 'n2']; s.players.S.revealedIds = ['s3', 's1', 's2'];
  s.phase = 'move'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.moveModifier = null;
  eq(g.move('N', 2, 1, 'n4').type, 'clash', 'clash avviato');
  eq(g.clashChoices('N').length, 2, 'attaccante 2 carte');
  eq(g.clashChoices('S').length, 3, 'difensore 3 carte');
  g.clashChoose('N', 'n9'); g.clashChoose('S', 's3');
  eq(s.subPhase, 'clash-reloc', 'difensore ricolloca');
  eq(g.getCell(2, 1).pawn, 'N', 'attaccante entra');
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
  eq(s.players.N.score, 8, 'double kill +5+3');
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
  g.passMove('N'); g.passMove('S'); g.passShoot('N'); g.passShoot('S');
  eq(s.currentSuit, Deck.nextSuit(initial), 'seme di turno avanzato di 1');
  eq(s.centerInitialSuit, initial, 'seme iniziale invariato');
})();

// -------------------------------------------------------------------- Personaggi
console.log('# Personaggi: belongingSuit + oggetto iniziale');
(function () {
  var g = Engine.createGame({ rng: makeRng(6), firstPlayer: 'N', suitMode: 'rotating',
    modules: { characters: true, objects: true }, characters: { N: 'runner', S: 'fighter' } });
  var s = g.state;
  eq(s.players.N.belongingSuit, 'spade', 'runner → spade');
  eq(s.players.S.belongingSuit, 'bastoni', 'fighter → bastoni');
  eq(s.players.N.objects.length, 1, 'N ha oggetto iniziale');
  eq(s.players.N.objects[0].type, 'jetpack', 'runner → jetpack');
  ok(s.players.N.objects[0].fromCharacter, 'oggetto iniziale marcato fromCharacter');
  // Solo Personaggi (senza Oggetti): niente oggetto iniziale.
  var g2 = Engine.createGame({ rng: makeRng(6), firstPlayer: 'N', modules: { characters: true, objects: false }, characters: { N: 'runner', S: 'fighter' } });
  eq(g2.state.players.N.objects.length, 0, 'solo Personaggi: niente oggetto iniziale');
  eq(g2.state.players.N.belongingSuit, 'spade', 'solo Personaggi: seme di appartenenza presente');
})();

// -------------------------------------------------------------------- Oggetti: mazzo + pesca a figura
console.log('# Oggetti: mazzo 4 distinti; pesca a ogni figura eliminata (move e attack)');
(function () {
  var g = Engine.createGame({ rng: makeRng(8), firstPlayer: 'N', modules: { characters: false, objects: true } });
  var s = g.state;
  eq(s.objectDeck.length, 4, 'mazzo oggetti = 4');
  var types = s.objectDeck.map(function (o) { return o.type; });
  eq(new Set(types).size, 4, '4 oggetti distinti');
  // Pesca su figura in movimento.
  g.getCell(2, 1).card = { id: 'x9', value: 9, suit: 'spade' }; g.getCell(2, 1).faceDown = false;
  s.players.N.hand = [{ id: 'h9', value: 9, suit: 'oro' }, { id: 'a', value: 2, suit: 'oro' }, { id: 'b', value: 3, suit: 'oro' }];
  s.players.N.revealedIds = ['h9', 'a', 'b'];
  s.phase = 'move'; s.subPhase = null; s.activePlayer = 'N'; s.actionsLeft = 1; s.moveModifier = null;
  g.move('N', 2, 1, 'h9');
  eq(s.players.N.objects.length, 1, 'pesca 1 oggetto abbattendo figura in movimento');
  eq(s.objectDeck.length, 3, 'mazzo oggetti ridotto');
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
  eq(s.players.N.score, 8, 'homing: punti double kill comunque assegnati (+5+3)');
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
  eq(s.moveModifier, 'jetpack', 'jetpack armato');
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
console.log('# Poteri: runner (pari↔pari, move), tactician (apre carte), brawler (wildcard), fighter (pari↔pari, attack)');
(function () {
  // runner: in MOVIMENTO una carta PARI abbina una cella scoperta di valore PARI
  var g = Engine.createGame({ rng: makeRng(3), firstPlayer: 'N', modules: { characters: true, powers: true }, characters: { N: 'runner', S: 'brawler' } });
  var s = g.state;
  s.currentSuit = 'coppe'; s.players.N.belongingSuit = 'spade';
  var evenCell = { faceDown: false, destroyed: false, card: { value: 6, suit: 'bastoni' } };
  s.phase = 'move';
  ok(g._matches('N', { value: 4, suit: 'oro' }, evenCell), 'runner (move): carta pari abbina cella pari');
  ok(!g._matches('N', { value: 3, suit: 'oro' }, evenCell), 'runner (move): carta dispari NON abbina cella pari');
  var oddCell = { faceDown: false, destroyed: false, card: { value: 7, suit: 'bastoni' } };
  ok(!g._matches('N', { value: 4, suit: 'oro' }, oddCell), 'runner: carta pari NON abbina cella dispari');
  s.phase = 'attack';
  ok(!g._matches('N', { value: 4, suit: 'oro' }, evenCell), 'runner (attack): il potere pari NON è attivo in attacco');

  // tactician: attiva potere (senza oggetto, max 2 volte per partita) → availableRevealed = tutta la mano
  var gt = Engine.createGame({ rng: makeRng(5), firstPlayer: 'N', modules: { characters: true, objects: true, powers: true }, characters: { N: 'tactician', S: 'runner' } });
  var st = gt.state;
  gt.selectCards('N', st.players.N.hand.slice(0, 3).map(function (c) { return c.id; }));
  gt.selectCards('S', st.players.S.hand.slice(0, 3).map(function (c) { return c.id; }));
  eq(gt.availableRevealed('N').length, 3, 'tactician: prima del potere 3 carte');
  eq(st.players.N.tacticianLeft, 2, 'tactician: 2 attivazioni disponibili a inizio partita');
  ok(gt.canActivatePower('N'), 'tactician può attivare (senza scartare oggetti)');
  gt.activatePower('N');
  eq(gt.availableRevealed('N').length, 6, 'tactician: dopo il potere usa tutte le 6 carte');
  eq(st.players.N.tacticianLeft, 1, 'tactician: attivazioni decrementate a 1');
  // esaurisci: seconda attivazione (nuovo round) e poi non più disponibile
  st.players.N.tacticianOpen = false; st.players.N.tacticianLeft = 1;
  gt.activatePower('N'); eq(st.players.N.tacticianLeft, 0, 'tactician: attivazioni a 0');
  st.players.N.tacticianOpen = false;
  ok(!gt.canActivatePower('N'), 'tactician: esaurite le 2 attivazioni non è più attivabile');

  // jetpack: scarta una carta SCELTA (non di riserva) come costo, e serve >=2 carte scelte
  var gj = Engine.createGame({ rng: makeRng(8), firstPlayer: 'N', modules: { objects: true } });
  var sj = gj.state; sj.phase = 'move'; sj.activePlayer = 'N'; sj.actionsLeft = 1; sj.moveModifier = null;
  sj.players.N.hand = [{ id: 'r1', value: 2, suit: 'oro' }, { id: 'r2', value: 9, suit: 'oro' }, { id: 'x', value: 5, suit: 'spade' }];
  sj.players.N.revealedIds = ['r1', 'r2']; sj.players.N.revealedCards = [sj.players.N.hand[0], sj.players.N.hand[1]];
  sj.players.N.objects = [{ id: 'jp', type: 'jetpack', phase: 'move', fromCharacter: false }];
  ok(gj.usableObjects('N').some(function (o) { return o.id === 'jp'; }), 'jetpack usabile con 2 carte scelte');
  gj.useObject('N', 'jp');
  eq(sj.moveModifier, 'jetpack', 'jetpack: modificatore armato');
  eq(gj.availableRevealed('N').length, 1, 'jetpack: una carta scelta scartata come costo (resta 1)');
  ok(sj.players.N.revealedIds.indexOf('r1') === -1, 'jetpack: scartata la carta scelta più bassa (2)');
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
  sb.phase = 'move'; sb.subPhase = null; sb.activePlayer = 'N'; sb.actionsLeft = 1; sb.moveModifier = null;
  ok(gb.canBrawler('N'), 'brawler disponibile con 3 carte');
  gb.brawlerAction('N', 2, 1);
  eq(sb.players.N.score, 2, 'brawler: figura 9 → +2'); eq(sb.players.N.trophies.length, 0, 'brawler: nessun trophy'); eq(sb.players.N.hand.length, 0, 'brawler: 3 carte scartate');
})();

// -------------------------------------------------------------------- Oggetti avanzati
console.log('# Oggetti avanzati: elemental bomb, barrage, randomizer');
(function () {
  function atk(g, id) { var s = g.state; s.firstPlayer = id; s.phase = 'attack'; s.subPhase = null; s.activePlayer = id; s.actionsLeft = 1; s.attackModifier = null; s.players[id].hand = []; s.players[id].revealedIds = []; s.players[id].revealedCards = []; }
  // elemental bomb
  var g = Engine.createGame({ rng: makeRng(2), firstPlayer: 'N', modules: { objects: true } });
  var s = g.state; s.players.N.objects = [{ id: 'eb', type: 'elemental_bomb', phase: 'attack', fromCharacter: false }]; atk(g, 'N');
  g.useObject('N', 'eb'); g.elementalTarget(3, 3); g.elementalSuit('oro');
  eq(g.getCell(3, 3).card.suit, 'oro', 'elemental: centro → oro'); eq(g.getCell(3, 2).card.suit, 'oro', 'elemental: ortogonale → oro');
  eq(s.phase === 'attack' && s.activePlayer === 'S', true, 'elemental consuma l\'attacco');
  // barrage
  var g2 = Engine.createGame({ rng: makeRng(2), firstPlayer: 'N', modules: { objects: true } });
  var s2 = g2.state; s2.players.N.objects = [{ id: 'br', type: 'barrage', phase: 'attack', fromCharacter: false }]; atk(g2, 'N');
  g2.useObject('N', 'br'); g2.barrageFirst(2, 2);
  ok(g2.barrageSecondOptions().length > 0, 'barrage: seconde celle disponibili'); g2.barrageSecond(2, 3);
  eq(s2.subPhase, 'barrage-third', 'barrage: dopo la seconda si passa alla terza cella');
  ok(g2.barrageThirdOptions().length > 0, 'barrage: terze celle disponibili'); g2.barrageThird(2, 4);
  ok(g2.getCell(2, 2).destroyed && g2.getCell(2, 3).destroyed && g2.getCell(2, 4).destroyed, 'barrage: tutte e tre distrutte');
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

  // Energy Boost: pesca 2 carte usabili + 2 scarti extra a fine turno.
  var gb = Engine.createGame({ rng: makeRng(9), firstPlayer: 'N', modules: { objects: true } });
  var sb = gb.state; sb.phase = 'move'; sb.activePlayer = 'N'; sb.actionsLeft = 1; sb.moveModifier = null;
  sb.players.N.objects = [{ id: 'eb', type: 'energy_boost', phase: 'move', fromCharacter: false }];
  var handBefore = sb.players.N.hand.length;
  ok(gb.usableObjects('N').some(function (o) { return o.id === 'eb'; }), 'energy boost usabile in movimento');
  gb.useObject('N', 'eb');
  eq(sb.players.N.hand.length, handBefore + 2, 'energy boost: +2 carte in mano');
  eq(sb.players.N.energyExtraDiscard, 2, 'energy boost: 2 scarti extra segnati');
  ok(sb.players.N.revealedIds.length >= 2, 'energy boost: carte pescate rese disponibili');
  eq(sb.actionsLeft, 1, 'energy boost: non consuma l\'azione');

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

  // Modulo Reshuffle: rimescola la mano nel mazzo e pesca 6 (2 usi per partita).
  var gr = Engine.createGame({ rng: makeRng(13), firstPlayer: 'N', modules: { reshuffle: true } });
  var sr = gr.state;
  ok(gr.canReshuffle('N'), 'reshuffle disponibile in selezione');
  var deckR = sr.deck.length;
  gr.reshuffleHand('N');
  eq(sr.players.N.hand.length, 6, 'reshuffle: mano riportata a 6');
  eq(sr.players.N.reshuffleLeft, 1, 'reshuffle: usi decrementati');
  eq(sr.deck.length, deckR, 'reshuffle: mazzo di lunghezza netta invariata (6 dentro, 6 fuori)');
})();

// --------------------------------------------------------------------
console.log('\n=== Risultato: ' + passed + ' passati, ' + failed + ' falliti ===');
process.exit(failed ? 1 : 0);

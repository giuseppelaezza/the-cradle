/*
 * cpu.test.js — La CPU conclude partite senza eccezioni, con e senza moduli.
 * node tests/cpu.test.js
 */
'use strict';
var Engine = require('../js/engine.js');
var Cpu = require('../js/cpu.js');

var passed = 0, failed = 0;
function ok(c, m) { if (c) passed++; else { failed++; console.error('  ✗ FAIL: ' + m); } }
function makeRng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Driver: entrambi i giocatori pilotati dalla CPU; le finestre oggetto vengono passate.
// Determina quale giocatore deve agire adesso (per pilotare entrambi con Cpu.cpuAct).
function whoActs(s, g) {
  if (s.subPhase === 'object-discard') return s.pendingObjectDiscard.playerId;
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
function playCpuGame(opts) {
  var g = Engine.createGame(opts);
  var s = g.state, guard = 0;
  while (!s.gameOver && guard++ < 6000) {
    var actor = whoActs(s, g);
    if (!actor) break;
    Cpu.cpuAct(g, actor);
  }
  return g;
}

function suite(label, buildOpts) {
  console.log('# ' + label);
  var completed = 0;
  for (var seed = 1; seed <= 40; seed++) {
    var g = null, err = null;
    try { g = playCpuGame(buildOpts(seed)); } catch (e) { err = e; }
    ok(!err, label + ' seed ' + seed + (err ? ' → ' + err.message : ''));
    if (g) { ok(g.state.gameOver, 'seed ' + seed + ' conclusa'); ok(g.state.round <= 9, 'seed ' + seed + ' entro 9 round'); if (g.state.gameOver) completed++; }
  }
  console.log('  ' + completed + '/40 concluse.');
}

var CHARS = ['runner', 'brawler', 'tactician', 'fighter'];
suite('Base (nessun modulo)', function (seed) { return { rng: makeRng(seed) }; });
suite('Rotazione', function (seed) { return { rng: makeRng(seed), suitMode: 'rotating' }; });
suite('Oggetti', function (seed) { return { rng: makeRng(seed), modules: { objects: true } }; });
suite('Personaggi + Oggetti (rotazione)', function (seed) {
  return { rng: makeRng(seed), suitMode: 'rotating', modules: { characters: true, objects: true },
           characters: { N: CHARS[seed % 4], S: CHARS[(seed + 1) % 4] } };
});
suite('Poteri + Personaggi + Oggetti (rotazione)', function (seed) {
  return { rng: makeRng(seed), suitMode: 'rotating', modules: { characters: true, objects: true, powers: true },
           characters: { N: CHARS[seed % 4], S: CHARS[(seed + 1) % 4] } };
});
suite('Abbinamento alternativo + Oggetti', function (seed) {
  return { rng: makeRng(seed), modules: { objects: true }, altMatch: true };
});
suite('Abbinamento alternativo + Personaggi + Oggetti (rotazione)', function (seed) {
  return { rng: makeRng(seed), suitMode: 'rotating', altMatch: true, modules: { characters: true, objects: true, powers: true },
           characters: { N: CHARS[seed % 4], S: CHARS[(seed + 1) % 4] } };
});

console.log('\n=== Risultato CPU: ' + passed + ' passati, ' + failed + ' falliti ===');
process.exit(failed ? 1 : 0);

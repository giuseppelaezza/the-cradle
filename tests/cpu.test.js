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
  if (s.subPhase === 'altmatch-choice' || s.subPhase === 'altmatch-object') return s.pendingAltMatch.playerId;
  if (s.subPhase === 'clash-cards') return g.clashCurrentChooser();
  if (s.subPhase === 'clash-reloc') return s.pendingClash.relocatorId;
  if (s.subPhase === 'forced-reloc') return s.pendingForced.chooserId;
  if (s.subPhase) return null;
  if (s.phase === 'select') { var o = g.allPlayers(); for (var i = 0; i < o.length; i++) if (s.selected[o[i]] == null) return o[i]; return null; }
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
    if (g) { ok(g.state.gameOver, 'seed ' + seed + ' conclusa'); ok(g.state.round <= (g.state.maxRounds || 9), 'seed ' + seed + ' entro i round previsti'); if (g.state.gameOver) completed++; }
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
suite('Ruleset C + Personaggi + Oggetti (rotazione)', function (seed) {
  return { rng: makeRng(seed), suitMode: 'rotating', ruleset: 'C', modules: { characters: true, objects: true, powers: true },
           characters: { N: CHARS[seed % 4], S: CHARS[(seed + 1) % 4] } };
});
suite('Ruleset C 4×4 (celle bonus) + Personaggi + Oggetti', function (seed) {
  return { rng: makeRng(seed), suitMode: 'rotating', ruleset: 'C', gridSize: 4, modules: { characters: true, objects: true, powers: true },
           characters: { N: CHARS[seed % 4], S: CHARS[(seed + 1) % 4] } };
});
suite('Ruleset C 4×4 (base)', function (seed) { return { rng: makeRng(seed), ruleset: 'C', gridSize: 4 }; });
suite('Struttura turno 1-2-1-2 + Personaggi + Oggetti', function (seed) {
  return { rng: makeRng(seed), suitMode: 'rotating', turnMode: '1212', modules: { characters: true, objects: true, powers: true },
           characters: { N: CHARS[seed % 4], S: CHARS[(seed + 1) % 4] } };
});
// Ruleset C con i nuovi oggetti (teleport/grapple) forzati nel mazzo: la CPU non li usa ma non deve rompersi.
suite('Ruleset C + Teleport/Grapple/Barrage (selezione forzata)', function (seed) {
  return { rng: makeRng(seed), ruleset: 'C', modules: { objects: true },
           objectSelection: ['teleport', 'grapple', 'barrage', 'homing_missile', 'jetpack'] };
});
suite('Ruleset C 4×4 + Teleport/Grapple', function (seed) {
  return { rng: makeRng(seed), ruleset: 'C', gridSize: 4, modules: { objects: true },
           objectSelection: ['teleport', 'grapple', 'barrage', 'jetpack', 'randomizer'] };
});
suite('Ruleset C 11 round', function (seed) { return { rng: makeRng(seed), ruleset: 'C', maxRounds: 11, modules: { objects: true } }; });
suite('Ruleset C 7 round', function (seed) { return { rng: makeRng(seed), ruleset: 'C', maxRounds: 7, modules: { objects: true } }; });
suite('Clash su Attacco (Ruleset C)', function (seed) { return { rng: makeRng(seed), ruleset: 'C', clashOnAttack: true, modules: { objects: true } }; });
suite('Clash su Attacco (Ruleset B) + Personaggi', function (seed) {
  return { rng: makeRng(seed), clashOnAttack: true, modules: { characters: true, objects: true, powers: true },
           characters: { N: CHARS[seed % 4], S: CHARS[(seed + 1) % 4] } };
});
suite('Nuovi TOOLS (rebuild/remix/encore/elemental/randomizer) + Personaggi', function (seed) {
  return { rng: makeRng(seed), modules: { characters: true, objects: true, powers: true },
           objectSelection: ['rebuild', 'remix', 'encore', 'elemental_bomb', 'randomizer'],
           characters: { N: CHARS[seed % 4], S: CHARS[(seed + 1) % 4] } };
});

// Variante Draft: la CPU costruisce la griglia a turno e poi gioca la partita fino in fondo.
suite('Draft 4×4 + Personaggi + Oggetti', function (seed) {
  return { rng: makeRng(seed), suitMode: 'rotating', ruleset: 'C', gridSize: 4, gridMode: 'draft', maxRounds: 8, clashOnAttack: true,
           modules: { characters: true, objects: true, powers: true, reshuffle: true }, reshuffleCount: 2,
           characters: { N: CHARS[seed % 4], S: CHARS[(seed + 1) % 4] } };
});
suite('Draft 5×5 + Personaggi + Oggetti', function (seed) {
  return { rng: makeRng(seed), suitMode: 'rotating', ruleset: 'C', gridSize: 5, gridMode: 'draft', maxRounds: 9, clashOnAttack: true,
           modules: { characters: true, objects: true, powers: true, reshuffle: true }, reshuffleCount: 2,
           characters: { N: CHARS[seed % 4], S: CHARS[(seed + 1) % 4] } };
});

// Multiplayer: 3 e 4 giocatori (random e draft) portati a termine dalla CPU senza eccezioni.
var C4 = ['runner', 'brawler', 'tactician', 'fighter'];
suite('Multiplayer 3 giocatori (5×5)', function (seed) {
  return { rng: makeRng(seed), numPlayers: 3, suitMode: 'rotating', ruleset: 'C', gridSize: 5, maxRounds: 9, clashOnAttack: true,
           modules: { characters: true, objects: true, powers: true, reshuffle: true }, reshuffleCount: 2, characters: C4.slice(0, 3) };
});
suite('Multiplayer 4 giocatori (5×5)', function (seed) {
  return { rng: makeRng(seed), numPlayers: 4, suitMode: 'rotating', ruleset: 'C', gridSize: 5, maxRounds: 9, clashOnAttack: true,
           modules: { characters: true, objects: true, powers: true, reshuffle: true }, reshuffleCount: 2, characters: C4.slice(0, 4) };
});
suite('Multiplayer 4 giocatori + Draft + Sifone/Randomizer', function (seed) {
  return { rng: makeRng(seed), numPlayers: 4, gridMode: 'draft', suitMode: 'rotating', ruleset: 'C', gridSize: 5, maxRounds: 9, clashOnAttack: true, turnMode: '1212',
           modules: { characters: true, objects: true, powers: true, reshuffle: true }, reshuffleCount: 2,
           objectSelection: ['energy_drain', 'randomizer', 'hook', 'homing_missile', 'grapple'], characters: C4.slice(0, 4) };
});

console.log('\n=== Risultato CPU: ' + passed + ' passati, ' + failed + ' falliti ===');
process.exit(failed ? 1 : 0);

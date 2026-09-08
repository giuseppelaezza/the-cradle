/*
 * cpuvscpu.js — Simulazione CPU vs CPU e statistiche di bilanciamento.
 *
 *   node sim/cpuvscpu.js [scala]
 *
 * `scala` (default 1) moltiplica il numero di partite (2 = doppie partite, più preciso ma più lento).
 *
 * Misura tre cose:
 *   A) Vantaggio del PRIMO GIOCATORE (partite "specchio": stessa configurazione ai due lati,
 *      cambia solo chi inizia → l'unica variabile è l'ordine di gioco).
 *   B) Forza dei PERSONAGGI (round-robin di tutte le coppie, bilanciato sull'ordine di gioco).
 *   C) Uso e impatto di TOOL e POTERI attivi (correlazione uso ↔ vittoria).
 *
 * NB: la CPU è euristica: usa oggetti/poteri solo quando la sua euristica lo ritiene conveniente;
 * i tool che non valuta (es. energy boost/drain) risulteranno poco o mai usati — è un dato utile.
 */
'use strict';
var Engine = require('../js/engine.js');
var Cpu = require('../js/cpu.js');

var SCALE = parseFloat(process.argv[2]) || 1;
var CHARS = ['runner', 'brawler', 'tactician', 'fighter'];

function makeRng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function other(id) { return id === 'N' ? 'S' : 'N'; }
function pct(w, n) { return n ? (100 * w / n).toFixed(1) + '%' : '—'; }
function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
function padL(s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; }

// Chi deve agire ora secondo lo stato (indipendente da chi è CPU).
function engineActor(s, g) {
  if (s.gameOver) return null;
  if (s.subPhase === 'object-discard') return s.pendingObjectDiscard.playerId;
  if (s.subPhase === 'timebomb-suit') return s.pendingTimebomb.playerId;
  if (s.subPhase === 'elemental-target' || s.subPhase === 'elemental-suit') return s.pendingElemental && s.pendingElemental.playerId;
  if (s.subPhase === 'barrage-first' || s.subPhase === 'barrage-second' || s.subPhase === 'barrage-third') return s.pendingBarrage && s.pendingBarrage.playerId;
  if (s.subPhase === 'randomizer-select' || s.subPhase === 'randomizer-place') return s.pendingRandomizer && s.pendingRandomizer.playerId;
  if (s.subPhase === 'clash-cards') return g.clashCurrentChooser();
  if (s.subPhase === 'clash-reloc') return s.pendingClash.relocatorId;
  if (s.subPhase === 'forced-reloc') return s.pendingForced.chooserId;
  if (s.subPhase) return null;
  if (s.phase === 'select') return s.selected.N == null ? 'N' : (s.selected.S == null ? 'S' : null);
  if (s.phase === 'move' || s.phase === 'attack') return s.activePlayer;
  return null;
}

// Avvolge un metodo dell'istanza per registrare l'uso (chiamando `before` con gli argomenti).
function instrument(g, name, before) {
  var orig = g[name].bind(g);
  g[name] = function () { try { before(arguments); } catch (e) {} return orig.apply(null, arguments); };
}

// Gioca una partita CPU vs CPU e ritorna un record con esito e uso di tool/poteri per giocatore.
function playGame(opts) {
  var g = Engine.createGame(opts), s = g.state;
  var rec = {
    firstPlayer: s.firstPlayer,
    chars: { N: s.players.N.character, S: s.players.S.character },
    tools: { N: {}, S: {} }, powers: { N: {}, S: {} }, reshuffle: { N: 0, S: 0 },
    winner: null, tie: false, over: false, rounds: 0
  };
  instrument(g, 'useObject', function (a) {
    var pid = a[0], oid = a[1], o = s.players[pid].objects.filter(function (x) { return x.id === oid; })[0];
    if (o) rec.tools[pid][o.type] = (rec.tools[pid][o.type] || 0) + 1;
  });
  instrument(g, 'activatePower', function (a) { var p = a[0]; rec.powers[p].tactician = (rec.powers[p].tactician || 0) + 1; });
  instrument(g, 'brawlerAction', function (a) { var p = a[0]; rec.powers[p].brawler = (rec.powers[p].brawler || 0) + 1; });
  instrument(g, 'reshuffleHand', function (a) { rec.reshuffle[a[0]]++; });

  var guard = 0;
  while (!s.gameOver && guard++ < 8000) { var act = engineActor(s, g); if (!act) break; Cpu.cpuAct(g, act); }
  rec.over = s.gameOver; rec.rounds = s.round;
  rec.winner = s.result ? s.result.winner : null;
  rec.tie = !!(s.result && !s.result.winner);
  return rec;
}

// ============================================================ A) VANTAGGIO PRIMO GIOCATORE
function firstPlayerAdvantage() {
  console.log('\n=== A) VANTAGGIO DEL PRIMO GIOCATORE (partite specchio) ===');
  console.log('Stessa configurazione ai due lati: l\'unica differenza è chi inizia.\n');
  console.log('(specchio "<char>" = poteri+oggetti+rotazione, stesso personaggio ai due lati)\n');
  var configs = [
    { label: 'Base (nessun modulo)', build: function (seed) { return { rng: makeRng(seed), firstPlayer: seed % 2 ? 'N' : 'S' }; } }
  ];
  CHARS.forEach(function (c) {
    configs.push({
      label: 'Specchio ' + c,
      build: function (seed) {
        return { rng: makeRng(seed), suitMode: 'rotating', firstPlayer: seed % 2 ? 'N' : 'S',
                 modules: { characters: true, objects: true, powers: true }, characters: { N: c, S: c } };
      }
    });
  });

  var totFirst = 0, totSecond = 0, totTie = 0;
  configs.forEach(function (cfg) {
    var games = Math.round((cfg.label.indexOf('Base') === 0 ? 500 : 300) * SCALE);
    var fw = 0, sw = 0, tie = 0;
    for (var seed = 1; seed <= games; seed++) {
      var r = playGame(cfg.build(seed));
      if (r.tie || !r.winner) tie++;
      else if (r.winner === r.firstPlayer) fw++;
      else sw++;
    }
    totFirst += fw; totSecond += sw; totTie += tie;
    var dec = fw + sw;
    console.log('  ' + pad(cfg.label, 24) + ' 1°: ' + padL(pct(fw, dec), 6) + '  2°: ' + padL(pct(sw, dec), 6) +
      '  (patte ' + padL(pct(tie, games), 6) + ', n=' + games + ')');
  });
  var dec = totFirst + totSecond;
  console.log('  ' + pad('— TOTALE', 24) + ' 1°: ' + padL(pct(totFirst, dec), 6) + '  2°: ' + padL(pct(totSecond, dec), 6) +
    '  (patte ' + padL(pct(totTie, totFirst + totSecond + totTie), 6) + ')');
  console.log('  → 50% = nessun vantaggio; >50% per il 1° = vantaggio a chi inizia.');
}

// ============================================================ B) FORZA DEI PERSONAGGI + C) TOOL/POTERI
function characterRoundRobin() {
  console.log('\n=== B) FORZA DEI PERSONAGGI (round-robin, ordine bilanciato) ===');
  console.log('Ogni coppia distinta giocata con entrambi gli ordini di gioco.\n');
  var seedsPerPair = Math.round(150 * SCALE);

  var cg = {}, cw = {}, cgF = {}, cwF = {}, cgS = {}, cwS = {};
  CHARS.forEach(function (c) { cg[c] = cw[c] = cgF[c] = cwF[c] = cgS[c] = cwS[c] = 0; });

  // C) accumulatori tool/poteri
  var toolUses = {}, toolUserGames = {}, toolUserWins = {};
  var powUses = {}, powUserGames = {}, powUserWins = {};
  var reshUserGames = 0, reshUserWins = 0, reshUses = 0;
  var totalGames = 0, decisiveGames = 0, playerWins = 0;

  function accUse(store, pid, rec) {
    var used = rec[store === 'tools' ? 'tools' : 'powers'][pid];
    var usesMap = store === 'tools' ? toolUses : powUses;
    var ugMap = store === 'tools' ? toolUserGames : powUserGames;
    var uwMap = store === 'tools' ? toolUserWins : powUserWins;
    for (var t in used) {
      usesMap[t] = (usesMap[t] || 0) + used[t];
      ugMap[t] = (ugMap[t] || 0) + 1;
      if (rec.winner === pid) uwMap[t] = (uwMap[t] || 0) + 1;
    }
  }

  var seed = 1;
  for (var i = 0; i < CHARS.length; i++) for (var j = 0; j < CHARS.length; j++) {
    if (i === j) continue;
    var cN = CHARS[i], cS = CHARS[j];
    for (var k = 0; k < seedsPerPair; k++) {
      ['N', 'S'].forEach(function (fp) {
        var r = playGame({ rng: makeRng(seed), suitMode: 'rotating', firstPlayer: fp,
          modules: { characters: true, objects: true, powers: true }, characters: { N: cN, S: cS } });
        seed++;
        var firstChar = r.chars[fp], secondChar = r.chars[other(fp)];
        cgF[firstChar]++; cgS[secondChar]++;
        totalGames++;
        if (r.winner) {
          decisiveGames++; playerWins++;
          cw[r.chars[r.winner]]++;
          if (r.winner === fp) cwF[firstChar]++; else cwS[secondChar]++;
        }
        // C) uso tool/poteri per entrambi i giocatori
        ['N', 'S'].forEach(function (pid) { accUse('tools', pid, r); accUse('powers', pid, r); });
        ['N', 'S'].forEach(function (pid) {
          if (r.reshuffle[pid] > 0) { reshUserGames++; reshUses += r.reshuffle[pid]; if (r.winner === pid) reshUserWins++; }
        });
      });
    }
  }
  CHARS.forEach(function (c) { cg[c] = cgF[c] + cgS[c]; });

  console.log('  ' + pad('Personaggio', 12) + pad('Vittorie', 10) + pad('quando 1°', 12) + pad('quando 2°', 12) + 'partite');
  CHARS.forEach(function (c) {
    console.log('  ' + pad(c, 12) + pad(pct(cw[c], cg[c]), 10) + pad(pct(cwF[c], cgF[c]), 12) + pad(pct(cwS[c], cgS[c]), 12) + cg[c]);
  });
  console.log('  → win% su tutte le partite del personaggio (patte escluse dalle vittorie).');

  // C) report tool/poteri
  var baseline = totalGames ? playerWins / (2 * totalGames) : 0; // win-rate medio per lato
  console.log('\n=== C) USO E IMPATTO DI TOOL E POTERI (dalle partite di B) ===');
  console.log('Baseline: probabilità di vittoria media per lato = ' + pct(playerWins, 2 * totalGames) +
    '  (patte ' + pct(totalGames - decisiveGames, totalGames) + ')\n');

  console.log('  TOOL' + pad('', 14) + pad('usi', 8) + pad('lati che l\'hanno usato', 24) + 'win% di chi l\'ha usato');
  var toolTypes = Object.keys(toolUses).sort();
  if (!toolTypes.length) console.log('    (nessun tool usato dalla CPU)');
  toolTypes.forEach(function (t) {
    console.log('    ' + pad(t, 16) + padL(toolUses[t], 6) + '  ' + padL(toolUserGames[t], 6) + ' lati' + pad('', 12) + padL(pct(toolUserWins[t] || 0, toolUserGames[t]), 7));
  });

  console.log('\n  POTERE ATTIVO' + pad('', 5) + pad('usi', 8) + pad('lati che l\'hanno usato', 24) + 'win% di chi l\'ha usato');
  var powTypes = Object.keys(powUses).sort();
  if (!powTypes.length) console.log('    (nessun potere attivo usato)');
  powTypes.forEach(function (t) {
    console.log('    ' + pad(t, 16) + padL(powUses[t], 6) + '  ' + padL(powUserGames[t], 6) + ' lati' + pad('', 12) + padL(pct(powUserWins[t] || 0, powUserGames[t]), 7));
  });
  console.log('\n  RESHUFFLE (modulo non attivo in questa suite): usi ' + reshUses);
  console.log('  → confronta "win% di chi l\'ha usato" con la baseline sopra: >baseline = vantaggio.');
  console.log('  ATTENZIONE: è CORRELAZIONE, non causa. La CPU usa alcuni tool (hook/homing/barrage) soprattutto');
  console.log('  quando è in svantaggio, quindi il loro win% basso riflette la situazione, non l\'inutilità del tool.');
  console.log('  NB: poteri PASSIVI (runner/fighter) non compaiono qui — il loro effetto è nella tabella B.');
  console.log('  NB: energy_boost / energy_drain vengono usati come ripiego quando non c\'è un\'azione a punti.');
}

// ============================================================ MAIN
console.log('The Cradle — Simulazione CPU vs CPU  (scala ' + SCALE + ')');
var t0 = Date.now();
firstPlayerAdvantage();
characterRoundRobin();
console.log('\nCompletata in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's.');

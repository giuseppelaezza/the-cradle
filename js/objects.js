/*
 * objects.js — Definizioni dei TOOLS e costruzione del DECK dei TOOLS.
 * Modulo puro: nessun DOM. Compatibile browser (window.CradleObjects) e Node.
 *
 * Glossario keyword: DEPLOY (scelta carte), MOVIMENTO, ATTACCO, STACK ATTIVA / DI RISERVA,
 * DECK, HEAP, CELLA ONLINE/OFFLINE/DISTRUTTA/VUOTA/OCCUPATA/BONUS, CELLE ORTOGONALI/DIAGONALI,
 * MATCH, SUIT, VALORE, ARM, GLOBAL SUIT, REMIX, SKILL, SOVRASCRIVI, DISTRUGGI, RUBA, PESCA.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./deck.js'));
  } else {
    root.CradleObjects = factory(root.CradleDeck);
  }
})(typeof self !== 'undefined' ? self : this, function (Deck) {
  'use strict';

  // Etichetta della fase (per la scheda del TOOL).
  var PHASE_TXT = { select: 'DEPLOY', move: 'MOVIMENTO', attack: 'ATTACCO' };
  var PHASE_ABBR = { select: 'D', move: 'M', attack: 'A' }; // abbreviazioni per le schede TOOL

  // I TOOLS: phase (fase primaria), phases (tutte le fasi in cui è usabile), cost, effect.
  var OBJECT_DEFS = {
    jetpack: {
      type: 'jetpack', phase: 'move', label: 'Jetpack',
      cost: 'SCARTA [1] carta dalla STACK ATTIVA',
      effect: 'Durante questa azione di MOVIMENTO puoi MATCHARE anche le CELLE DIAGONALI alla tua posizione.'
    },
    jump: {
      type: 'jump', phase: 'move', label: 'Salto',
      cost: 'SCARTA [1] carta dalla STACK ATTIVA',
      effect: 'Durante questa azione di MOVIMENTO puoi MATCHARE solo a DISTANZA [2] su CELLE ORTOGONALI.'
    },
    hook: {
      type: 'hook', phase: 'attack', label: 'Spinta',
      cost: null,
      effect: 'Durante questa azione di ATTACCO, se COLPISCI una CELLA OCCUPATA da un ARM avversario, sposti quell\'ARM su una CELLA ORTOGONALE a DISTANZA [1].'
    },
    homing_missile: {
      type: 'homing_missile', phase: 'attack', label: 'Granata',
      cost: null,
      effect: 'DISTRUGGI la CELLA bersaglio dell\'ATTACCO. Se la CELLA è OCCUPATA, sposti l\'ARM avversario su una CELLA ORTOGONALE a DISTANZA [1].'
    },
    rush_juice: {
      type: 'rush_juice', phase: 'select', label: 'Doppio Movimento',
      cost: 'SOSTITUISCI l\'ATTACCO',
      effect: 'Questo TURNO esegui [2] MOVIMENTI.'
    },
    combat_juice: {
      type: 'combat_juice', phase: 'select', label: 'Doppio Attacco',
      cost: 'SOSTITUISCI il MOVIMENTO',
      effect: 'Questo TURNO esegui [2] ATTACCHI.'
    },
    timebomb: {
      type: 'timebomb', phase: 'select', label: 'Cronobomba',
      cost: null,
      effect: 'Sposta la GLOBAL SUIT su una SUIT a tua scelta; la rotazione prosegue da lì.'
    },
    elemental_bomb: {
      type: 'elemental_bomb', phase: 'attack', label: 'Bomba Elementale',
      cost: null,
      effect: 'Scegli [1] CELLA: la sua SUIT e quella delle sue CELLE ORTOGONALI diventa una SUIT a tua scelta.'
    },
    barrage: {
      type: 'barrage', phase: 'attack', label: 'Barrage!',
      cost: null,
      effect: 'Scegli [1] CELLA VUOTA → DISTRUGGILA. Non consuma l\'ATTACCO.'
    },
    randomizer: {
      type: 'randomizer', phase: 'attack', phases: ['attack', 'move'], label: 'Randomizzatore',
      cost: 'SOSTITUISCI l\'AZIONE',
      effect: 'Scegli fino a [3] CELLE ONLINE → SOVRASCRIVILE: le carte tornano nel DECK, si mescola e si PESCA per rimpiazzarle.'
    },
    energy_boost: {
      type: 'energy_boost', phase: 'move', phases: ['move', 'attack'], label: 'Ricarica',
      cost: null,
      effect: 'PESCA [2] e aggiungi alla STACK ATTIVA.'
    },
    energy_drain: {
      type: 'energy_drain', phase: 'move', phases: ['move', 'attack'], label: 'Sifone Energetico',
      cost: null,
      effect: 'RUBA [1] e aggiungi alla STACK ATTIVA.'
    },
    rebuild: {
      type: 'rebuild', phase: 'move', phases: ['move', 'attack'], label: 'Ricostruisci',
      cost: null,
      effect: 'PESCA [3] e scegli [1]: SOVRASCRIVI [1] CELLA DISTRUTTA o OFFLINE con la carta scelta.'
    },
    remix: {
      type: 'remix', phase: 'select', phases: ['select', 'move', 'attack'], label: 'Remix!',
      cost: null,
      effect: 'Ripristina [1] uso di REMIX già consumato (non oltre il totale).'
    },
    encore: {
      type: 'encore', phase: 'select', phases: ['select', 'move', 'attack'], label: 'Encore!',
      cost: null,
      effect: 'Ripristina [1] uso della SKILL del tuo ARM già consumato (non oltre il totale).'
    },
    // TOOLS disponibili solo nel Ruleset C (cOnly): esclusi dalla selezione manuale e dal DECK casuale negli altri ruleset.
    teleport: {
      type: 'teleport', phase: 'move', label: 'Teletrasporto', cOnly: true,
      cost: 'SOSTITUISCI il MOVIMENTO',
      effect: 'Sposta il tuo ARM su una qualunque CELLA ONLINE VUOTA con lo stesso VALORE della CELLA su cui ti trovi.'
    },
    grapple: {
      type: 'grapple', phase: 'move', label: 'Arpione', cOnly: true,
      cost: 'SCARTA [1] carta dalla STACK ATTIVA',
      effect: 'Durante questa azione di MOVIMENTO puoi MATCHARE anche le CELLE ORTOGONALI all\'ARM avversario.'
    }
  };
  // Deriva l'etichetta di fase e il testo del tooltip (fase + costo + effetto).
  Object.keys(OBJECT_DEFS).forEach(function (k) {
    var d = OBJECT_DEFS[k];
    var ps = d.phases || [d.phase];
    d.phaseLabel = ps.map(function (p) { return PHASE_TXT[p]; }).join(' / ');
    d.phaseAbbr = ps.map(function (p) { return PHASE_ABBR[p]; }).join('/');
    d.desc = 'FASE: ' + d.phaseLabel + '. ' + (d.cost ? 'COSTO: ' + d.cost + '. ' : '') + d.effect;
  });

  var ALL_TYPES = ['jetpack', 'jump', 'hook', 'homing_missile', 'rush_juice', 'combat_juice', 'timebomb', 'elemental_bomb', 'barrage', 'randomizer', 'energy_boost', 'energy_drain', 'rebuild', 'remix', 'encore', 'teleport', 'grapple'];

  function def(type) { return OBJECT_DEFS[type] || null; }

  // Crea una carta TOOL con id univoco. fromCharacter esclude dal limite.
  var _seq = 0;
  function makeObjectCard(type, fromCharacter) {
    var d = OBJECT_DEFS[type];
    return { id: 'obj-' + type + '-' + (_seq++), type: type, phase: d.phase, fromCharacter: !!fromCharacter };
  }

  // DECK dei TOOLS: 2 copie di ciascun tipo scelto, mescolate.
  // - selectedTypes assente/vuoto → 5 tipi casuali distinti (default).
  // - selectedTypes = elenco di tipi → esattamente quei tipi (2 copie ciascuno).
  function buildObjectDeck(rng, selectedTypes, ruleset) {
    var allowC = ruleset === 'C';
    var ok = function (t) { return !!OBJECT_DEFS[t] && (allowC || !OBJECT_DEFS[t].cOnly); };
    var types;
    if (selectedTypes && selectedTypes.length) {
      types = selectedTypes.filter(ok);
    } else {
      // DECK casuale: i TOOLS "solo Ruleset C" entrano nel pool solo se il ruleset è C.
      var pool = ALL_TYPES.filter(ok);
      Deck.shuffle(pool, rng);
      types = pool.slice(0, 5);
    }
    var deck = [];
    types.forEach(function (t) { deck.push(makeObjectCard(t, false)); deck.push(makeObjectCard(t, false)); });
    return Deck.shuffle(deck, rng);
  }

  return {
    OBJECT_DEFS: OBJECT_DEFS,
    ALL_TYPES: ALL_TYPES,
    def: def,
    makeObjectCard: makeObjectCard,
    buildObjectDeck: buildObjectDeck
  };
});

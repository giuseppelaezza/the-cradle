/*
 * objects.js — Definizioni degli oggetti e costruzione del mazzo Oggetti (§11 regolamento).
 * Modulo puro: nessun DOM. Compatibile browser (window.CradleObjects) e Node.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./deck.js'));
  } else {
    root.CradleObjects = factory(root.CradleDeck);
  }
})(typeof self !== 'undefined' ? self : this, function (Deck) {
  'use strict';

  // I 12 oggetti: fase (o fasi) di utilizzo, costo (se presente), effetto.
  // `desc` è il testo del tooltip, derivato da costo+effetto (mantiene la compatibilità).
  var OBJECT_DEFS = {
    jetpack: {
      type: 'jetpack', phase: 'move', label: 'Jetpack',
      cost: 'Scarta 1 carta scelta',
      effect: 'Per questo spostamento puoi abbinare anche in diagonale (oltre che ortogonalmente).'
    },
    jump: {
      type: 'jump', phase: 'move', label: 'Jump',
      cost: 'Scarta 1 carta scelta',
      effect: 'Per questo spostamento puoi abbinare SOLO le caselle a 2 celle ortogonali di distanza (salto).'
    },
    hook: {
      type: 'hook', phase: 'attack', label: 'Hook',
      cost: null,
      effect: 'Se colpisci la pedina avversaria, puoi spostarla di 1 casella in qualsiasi direzione (ortogonale o diagonale, esclusa la centrale).'
    },
    homing_missile: {
      type: 'homing_missile', phase: 'attack', label: 'Homing Missile',
      cost: null,
      effect: 'Ottieni i normali punti e la carta colpita è rimossa dal gioco (cella distrutta). Se la cella aveva una pedina, è il tiratore a decidere dove ricollocarla.'
    },
    rush_juice: {
      type: 'rush_juice', phase: 'select', label: 'Rush Juice',
      cost: 'Rinunci all\'attacco',
      effect: 'Questo round esegui DUE movimenti.'
    },
    combat_juice: {
      type: 'combat_juice', phase: 'select', label: 'Combat Juice',
      cost: 'Rinunci al movimento',
      effect: 'Questo round esegui DUE attacchi.'
    },
    timebomb: {
      type: 'timebomb', phase: 'select', label: 'Timebomb',
      cost: null,
      effect: 'Sposti il seme di turno su un seme a scelta; il ciclo prosegue da lì (solo modalità rotazione).'
    },
    elemental_bomb: {
      type: 'elemental_bomb', phase: 'attack', label: 'Elemental Bomb',
      cost: 'Rinunci all\'attacco',
      effect: 'Scegli una cella; il seme della cella e di tutte le celle ortogonali diventa un seme a tua scelta.'
    },
    barrage: {
      type: 'barrage', phase: 'attack', label: 'Barrage',
      cost: 'Rinunci all\'attacco',
      effect: 'Scegli una singola cella senza pedina: viene distrutta (come homing missile).'
    },
    randomizer: {
      type: 'randomizer', phase: 'attack', label: 'Randomizer',
      cost: 'Rinunci all\'attacco',
      effect: 'Scegli fino a 3 celle (serve almeno una carta nel mazzo o negli scarti): le loro carte tornano nel mazzo, si mescola, si pescano altrettante carte da ricollocare in quelle celle.'
    },
    energy_boost: {
      type: 'energy_boost', phase: 'move', phases: ['move', 'attack'], label: 'Energy Boost',
      cost: 'Scarta 2 carte extra a fine turno',
      effect: 'Movimento o attacco: pesca 2 carte dal mazzo e puoi usarle in questa mano.'
    },
    energy_drain: {
      type: 'energy_drain', phase: 'move', phases: ['move', 'attack'], label: 'Energy Drain',
      cost: null,
      effect: 'Movimento o attacco: ruba una carta dalla mano dell\'avversario (la puoi usare in questa mano).'
    },
    // Oggetti disponibili solo nel Ruleset C (cOnly): esclusi dalla selezione manuale e dal
    // mazzo casuale negli altri ruleset.
    teleport: {
      type: 'teleport', phase: 'move', label: 'Teleport', cOnly: true,
      cost: 'Rinunci al movimento',
      effect: 'Sposta la tua pedina su una qualsiasi carta scoperta del campo con lo stesso valore della carta su cui ti trovi, purché non vi sia la pedina avversaria.'
    },
    grapple: {
      type: 'grapple', phase: 'move', label: 'Grappling Hook', cOnly: true,
      cost: 'Scarta 1 carta scelta',
      effect: 'Per questo spostamento aggiungi alle tue destinazioni anche le caselle ortogonalmente adiacenti alla pedina avversaria (le abbini con le normali regole).'
    }
  };
  // Deriva il testo del tooltip da costo + effetto.
  Object.keys(OBJECT_DEFS).forEach(function (k) {
    var d = OBJECT_DEFS[k];
    d.desc = (d.cost ? 'Costo: ' + d.cost + '. ' : '') + d.effect;
  });

  var ALL_TYPES = ['jetpack', 'jump', 'hook', 'homing_missile', 'rush_juice', 'combat_juice', 'timebomb', 'elemental_bomb', 'barrage', 'randomizer', 'energy_boost', 'energy_drain', 'teleport', 'grapple'];

  function def(type) { return OBJECT_DEFS[type] || null; }

  // Crea una carta Oggetto con id univoco. fromCharacter esclude dal limite di 2.
  var _seq = 0;
  function makeObjectCard(type, fromCharacter) {
    var d = OBJECT_DEFS[type];
    return { id: 'obj-' + type + '-' + (_seq++), type: type, phase: d.phase, fromCharacter: !!fromCharacter };
  }

  // Mazzo Oggetti: 2 COPIE di ciascun tipo scelto, a faccia in giù, mescolate.
  // - selectedTypes assente/vuoto → 5 tipi casuali distinti (default).
  // - selectedTypes = elenco di tipi → esattamente quei tipi (2 copie ciascuno).
  function buildObjectDeck(rng, selectedTypes, ruleset) {
    var allowC = ruleset === 'C';
    var ok = function (t) { return !!OBJECT_DEFS[t] && (allowC || !OBJECT_DEFS[t].cOnly); };
    var types;
    if (selectedTypes && selectedTypes.length) {
      types = selectedTypes.filter(ok);
    } else {
      // Mazzo casuale: gli oggetti "solo Ruleset C" entrano nel pool solo se il ruleset è C.
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

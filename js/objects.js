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

  // I 7 oggetti: fase in cui sono utilizzabili + descrizione (tooltip).
  var OBJECT_DEFS = {
    jetpack: {
      type: 'jetpack', phase: 'move', label: 'Jetpack',
      desc: 'Movimento: per questo spostamento puoi abbinare anche in diagonale (oltre che ortogonalmente).'
    },
    jump: {
      type: 'jump', phase: 'move', label: 'Jump',
      desc: 'Movimento: per questo spostamento puoi abbinare SOLO le caselle a 2 celle ortogonali di distanza (salto).'
    },
    hook: {
      type: 'hook', phase: 'attack', label: 'Hook',
      desc: 'Attacco: se colpisci la pedina avversaria, puoi spostarla di 1 casella ortogonale (esclusa la centrale).'
    },
    homing_missile: {
      type: 'homing_missile', phase: 'attack', label: 'Homing Missile',
      desc: 'Attacco: ottieni i normali punti E la carta colpita è rimossa dal gioco (cella Distrutta). La pedina eventuale viene ricollocata.'
    },
    rush_juice: {
      type: 'rush_juice', phase: 'select', label: 'Rush Juice',
      desc: 'Scelta carte: questo round esegui DUE movimenti e rinunci all\'attacco.'
    },
    combat_juice: {
      type: 'combat_juice', phase: 'select', label: 'Combat Juice',
      desc: 'Scelta carte: questo round esegui DUE attacchi e rinunci al movimento.'
    },
    timebomb: {
      type: 'timebomb', phase: 'select', label: 'Timebomb',
      desc: 'Scelta carte: sposti il seme di turno su un seme a scelta; il ciclo prosegue da lì (solo modalità rotazione).'
    },
    elemental_bomb: {
      type: 'elemental_bomb', phase: 'attack', label: 'Elemental Bomb',
      desc: 'Attacco (rinunci all\'attacco): scegli una cella; il seme della cella e di tutte le celle ortogonali diventa un seme a tua scelta.'
    },
    barrage: {
      type: 'barrage', phase: 'attack', label: 'Barrage',
      desc: 'Attacco (rinunci all\'attacco): scegli una cella, poi una adiacente ortogonale (non centrale, non con pedina); distruggi entrambe (come homing missile).'
    },
    randomizer: {
      type: 'randomizer', phase: 'attack', label: 'Randomizer',
      desc: 'Attacco (rinunci all\'attacco, solo se il mazzo ha carte): scegli fino a 3 celle; le loro carte tornano nel mazzo, si mescola, si pescano altrettante carte da ricollocare in quelle celle.'
    }
  };

  var ALL_TYPES = ['jetpack', 'jump', 'hook', 'homing_missile', 'rush_juice', 'combat_juice', 'timebomb', 'elemental_bomb', 'barrage', 'randomizer'];

  function def(type) { return OBJECT_DEFS[type] || null; }

  // Crea una carta Oggetto con id univoco. fromCharacter esclude dal limite di 2.
  var _seq = 0;
  function makeObjectCard(type, fromCharacter) {
    var d = OBJECT_DEFS[type];
    return { id: 'obj-' + type + '-' + (_seq++), type: type, phase: d.phase, fromCharacter: !!fromCharacter };
  }

  // Mazzo Oggetti: 4 oggetti DISTINTI scelti a caso tra i 7 (1 copia ciascuno), a faccia in giù.
  function buildObjectDeck(rng, count) {
    count = count || 4;
    var pool = ALL_TYPES.slice();
    Deck.shuffle(pool, rng);
    return pool.slice(0, count).map(function (t) { return makeObjectCard(t, false); });
  }

  return {
    OBJECT_DEFS: OBJECT_DEFS,
    ALL_TYPES: ALL_TYPES,
    def: def,
    makeObjectCard: makeObjectCard,
    buildObjectDeck: buildObjectDeck
  };
});

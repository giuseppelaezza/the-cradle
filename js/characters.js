/*
 * characters.js — Definizioni dei personaggi (Modulo Personaggi, §10 regolamento).
 * Ogni personaggio dà un seme di appartenenza e un oggetto iniziale.
 * Modulo puro: nessun DOM. Compatibile browser (window.CradleCharacters) e Node.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.CradleCharacters = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // type → { suit (seme di appartenenza), startObject (tipo oggetto iniziale) }
  var CHARACTERS = {
    runner:    { type: 'runner',    suit: 'spade',   startObject: 'jetpack',     label: 'Runner' },
    brawler:   { type: 'brawler',   suit: 'coppe',   startObject: 'combat_juice', label: 'Brawler' },
    tactician: { type: 'tactician', suit: 'oro',     startObject: 'timebomb',    label: 'Tactician' },
    fighter:   { type: 'fighter',   suit: 'bastoni', startObject: 'hook',        label: 'Fighter' }
  };

  var ORDER = ['runner', 'brawler', 'tactician', 'fighter'];

  function get(type) { return CHARACTERS[type] || null; }

  // Un personaggio è selezionabile? Il tactician non lo è in modalità seme fissa (§9).
  function isSelectable(type, suitMode) {
    if (type === 'tactician' && suitMode === 'fixed') return false;
    return !!CHARACTERS[type];
  }

  return { CHARACTERS: CHARACTERS, ORDER: ORDER, get: get, isSelectable: isSelectable };
});

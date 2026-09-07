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

  // type → { suit (seme di appartenenza), startObject (tipo oggetto iniziale), power (descrizione potere) }
  var CHARACTERS = {
    runner:    { type: 'runner',    suit: 'spade',   startObject: 'jetpack',     label: 'Runner',
                 power: 'Potere: solo in fase di MOVIMENTO abbina sempre le carte pari — una casella scoperta di valore pari è abbinabile con qualsiasi carta della mano.' },
    brawler:   { type: 'brawler',   suit: 'coppe',   startObject: 'combat_juice', label: 'Brawler',
                 power: 'Potere: se ha 3 carte disponibili può scartarle tutte e tre per abbinare QUALSIASI cella (rinuncia a un\'azione).' },
    tactician: { type: 'tactician', suit: 'oro',     startObject: 'timebomb',    label: 'Tactician',
                 power: 'Potere: scartando un oggetto usa anche le carte NON scelte in fase di selezione (tutte le carte in mano diventano utilizzabili per il turno).' },
    fighter:   { type: 'fighter',   suit: 'bastoni', startObject: 'hook',        label: 'Fighter',
                 power: 'Potere: se con la prima azione di movimento abbina una figura o la pedina avversaria, ottiene una mossa extra al posto dell\'attacco.' }
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

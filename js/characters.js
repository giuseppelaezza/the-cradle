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

  // type → { suit (seme di appartenenza), startObject (tipo oggetto iniziale), power (descrizione potere), powerUses }
  //
  // powerUses = numero di attivazioni del potere per partita (per i poteri ATTIVI).
  //   - Regola questo valore per testare bilanciamenti diversi.
  //   - null = potere PASSIVO / sempre attivo (nessun limite di attivazioni): runner e fighter.
  var CHARACTERS = {
    runner:    { type: 'runner',    suit: 'spade',   startObjects: ['jetpack'], label: 'Runner',
                 powerUses: 2,
                 power: 'Passiva: 2 volte a partita, muovendo su una figura può scartare 1 carta scelta extra per colpirla (ne ottiene i punti e la scelta di un oggetto).' },
    brawler:   { type: 'brawler',   suit: 'coppe',   startObjects: ['barrage'], label: 'Brawler',
                 powerUses: 3,
                 power: 'Fino a 3 volte per partita, in movimento o in attacco, se ha 3 carte disponibili le scarta tutte per abbinare QUALSIASI cella (rinuncia all\'azione).' },
    tactician: { type: 'tactician', suit: 'oro',     startObjects: ['timebomb'], label: 'Tactician',
                 powerUses: 2,
                 power: 'Fino a 2 volte per partita usa anche le carte NON scelte in fase di selezione. Passiva: quando sceglie un oggetto sceglie tra 4 invece che tra 3.' },
    fighter:   { type: 'fighter',   suit: 'bastoni', startObjects: ['hook'], label: 'Fighter',
                 powerUses: null,
                 power: 'In attacco abbina le carte PARI tra loro (una carta pari abbina una cella scoperta di valore pari).' }
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

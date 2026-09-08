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
    runner:    { type: 'runner',    suit: 'spade',   startObject: 'jetpack',     label: 'Runner',
                 powerUses: null,
                 power: 'Potere: solo in fase di MOVIMENTO abbina le carte PARI tra di loro — una carta pari in mano abbina una casella scoperta di valore pari (es. 2 con 4, 4 con 8, 2 con 6).' },
    brawler:   { type: 'brawler',   suit: 'coppe',   startObject: 'combat_juice', label: 'Brawler',
                 powerUses: 3,
                 power: 'Potere: fino a 3 volte per partita, se ha 3 carte disponibili può scartarle tutte e tre per abbinare QUALSIASI cella (rinuncia a un\'azione).' },
    tactician: { type: 'tactician', suit: 'oro',     startObject: 'timebomb',    label: 'Tactician',
                 powerUses: 2,
                 power: 'Potere: fino a 2 volte per partita usa anche le carte NON scelte in fase di selezione (tutte le carte in mano diventano utilizzabili per il turno).' },
    fighter:   { type: 'fighter',   suit: 'bastoni', startObject: 'hook',        label: 'Fighter',
                 powerUses: null,
                 power: 'Potere: solo in fase di ATTACCO abbina le carte PARI tra di loro — una carta pari in mano abbina una casella scoperta di valore pari (es. 2 con 4, 4 con 8, 2 con 6).' }
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

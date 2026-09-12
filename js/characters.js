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
    runner:    { type: 'runner',    suit: 'spade',   startObjects: ['jetpack'], label: 'E-RUN-01',
                 powerUses: 2,
                 power: 'SKILL (2 usi): quando MATCHI un OBIETTIVO in MOVIMENTO puoi SCARTARE [1] carta dalla STACK ATTIVA per COLPIRLO (ne ottieni il VALORE e la scelta di [1] TOOL).' },
    brawler:   { type: 'brawler',   suit: 'coppe',   startObjects: ['barrage'], label: 'The Sniper',
                 powerUses: 3,
                 power: 'SKILL (3 usi): in MOVIMENTO o ATTACCO, se hai 3 carte nella STACK ATTIVA le SCARTI tutte per MATCHARE una CELLA qualsiasi (SOSTITUISCI l\'azione).' },
    tactician: { type: 'tactician', suit: 'oro',     startObjects: ['timebomb'], label: 'Deep Mind',
                 powerUses: 3,
                 power: 'SKILL (3 usi): guarda la STACK DI RISERVA dell\'ARM avversario. Passiva: quando scegli [1] TOOL scegli tra 4 invece che tra 3.' },
    fighter:   { type: 'fighter',   suit: 'bastoni', startObjects: ['hook'], label: 'Soldier Boy',
                 powerUses: null,
                 power: 'SKILL passiva: in ATTACCO MATCHI le carte di VALORE PARI tra loro (una carta pari MATCHA una CELLA ONLINE di VALORE pari).' }
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

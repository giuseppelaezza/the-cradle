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
                 power: 'ATTIVA (2 usi): quando MATCHI un OBIETTIVO in MOVIMENTO puoi SCARTARE [1] carta dalla STACK ATTIVA per COLPIRLO (ne ottieni il VALORE e la scelta di [1] TOOL). PASSIVA: se ti muovi nella tua fase di MOVIMENTO guadagni [1] punto; se non ti muovi perdi [1] punto.' },
    brawler:   { type: 'brawler',   suit: 'coppe',   startObjects: ['barrage'], label: 'The Sniper',
                 powerUses: 3,
                 power: 'ATTIVA (3 usi): in MOVIMENTO o ATTACCO, se hai 3 carte nella STACK ATTIVA le SCARTI tutte per MATCHARE una CELLA qualsiasi (SOSTITUISCI l\'azione). In ATTACCO su una CELLA OCCUPATA dall\'ARM avversario si apre un CLASH. PASSIVA: nei CLASH le carte COPPE che giochi valgono [+2].' },
    tactician: { type: 'tactician', suit: 'oro',     startObjects: ['timebomb'], label: 'Deep Mind',
                 powerUses: 3,
                 power: 'ATTIVA (3 usi): guarda la STACK DI RISERVA dell\'ARM avversario. PASSIVA: quando scegli [1] TOOL scegli tra 4 invece che tra 3.' },
    fighter:   { type: 'fighter',   suit: 'bastoni', startObjects: ['hook'], label: 'Soldier Boy',
                 powerUses: 3,
                 power: 'ATTIVA (3 usi): PESCA [3] carte, scegline [1] e con essa SOVRASCRIVI la CELLA su cui ti trovi; scarta le altre due. PASSIVA: in ATTACCO MATCHI le carte di VALORE PARI tra loro (una carta pari MATCHA una CELLA ONLINE di VALORE pari).' },
    wallie:    { type: 'wallie',    suit: 'oro',     startObjects: [], label: 'Wallie & Glass',
                 powerUses: null,
                 power: 'ATTIVA (al posto di un\'azione di MOVIMENTO/ATTACCO): se non hai un segnalino GLASS sul campo, MATCHA una CELLA ORTOGONALE e vi posizioni il segnalino GLASS (l\'ARM resta fermo). PASSIVA: se non hai GLASS sul campo, +2 al VALORE nei CLASH sulle sole carte ORO. Il GLASS resta finché un avversario non MATCHA la sua CELLA (nessun punto). A fine turno ottieni il bonus di SUIT sia della CELLA dell\'ARM sia della CELLA del GLASS.' }
  };

  var ORDER = ['runner', 'brawler', 'tactician', 'fighter', 'wallie'];

  function get(type) { return CHARACTERS[type] || null; }

  // Un personaggio è selezionabile? Il tactician non lo è in modalità seme fissa (§9).
  function isSelectable(type, suitMode) {
    if (type === 'tactician' && suitMode === 'fixed') return false;
    return !!CHARACTERS[type];
  }

  return { CHARACTERS: CHARACTERS, ORDER: ORDER, get: get, isSelectable: isSelectable };
});

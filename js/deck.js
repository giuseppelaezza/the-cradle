/*
 * deck.js — Carte, mazzo, shuffle.
 * Modulo puro (nessun DOM). Compatibile sia con <script> nel browser
 * (espone window.CradleDeck) sia con require() in Node (per i test).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.CradleDeck = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // I quattro semi napoletani. SUIT_RANK serve SOLO per lo spareggio del clash.
  var SUITS = ['oro', 'spade', 'coppe', 'bastoni'];
  var SUIT_RANK = { oro: 4, spade: 3, coppe: 2, bastoni: 1 };
  // Sequenza di rotazione del seme di turno (loop oro→spade→coppe→bastoni→oro).
  var SUIT_CYCLE = ['oro', 'spade', 'coppe', 'bastoni'];

  // Seme successivo nel loop di rotazione.
  function nextSuit(suit) {
    var i = SUIT_CYCLE.indexOf(suit);
    return SUIT_CYCLE[(i + 1) % SUIT_CYCLE.length];
  }

  /**
   * Costruisce le 80 carte: 2 copie di ogni (valore 1..10, seme).
   * @returns {Array<{id:string,value:number,suit:string}>}
   */
  function buildDeck() {
    var cards = [];
    for (var copy = 0; copy < 2; copy++) {
      for (var s = 0; s < SUITS.length; s++) {
        var suit = SUITS[s];
        for (var v = 1; v <= 10; v++) {
          cards.push({ id: v + '-' + suit + '-' + copy, value: v, suit: suit });
        }
      }
    }
    return cards; // 2 * 4 * 10 = 80
  }

  /**
   * Fisher–Yates in place. Accetta un rng iniettabile (per test deterministici).
   * @param {Array} arr
   * @param {() => number} [rng] funzione che ritorna [0,1)
   */
  function shuffle(arr, rng) {
    var random = rng || Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  // Le figure sono 8, 9, 10.
  function isFigure(card) {
    return card.value >= 8;
  }

  // Punti per figura: 10 -> 3, 9 -> 2, 8 -> 1.
  function figurePoints(card) {
    switch (card.value) {
      case 10: return 3;
      case 9: return 2;
      case 8: return 1;
      default: return 0;
    }
  }

  return {
    SUITS: SUITS,
    SUIT_RANK: SUIT_RANK,
    SUIT_CYCLE: SUIT_CYCLE,
    nextSuit: nextSuit,
    buildDeck: buildDeck,
    shuffle: shuffle,
    isFigure: isFigure,
    figurePoints: figurePoints
  };
});

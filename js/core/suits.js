/*
 * suits.js — Simboli dei semi come SVG inline (dai file assets/cradle-*.svg).
 * Simbolo monocromatico (classe .si): sulle carte a fondo chiaro assume il colore del
 * seme, su quelle a fondo colorato (figure/centro) diventa bianco (classe .inv sul
 * contenitore .suit-ic). Modulo compatibile browser (window.CradleSuits) e Node.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.CradleSuits = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // viewBox 0 0 60 60. Tutte le forme usano la classe .si (colore gestito via CSS).
  var INNER = {
    spade:
      '<circle class="si" cx="31.1" cy="29" r="10"/>' +
      '<polygon class="si" points="25.1 42 12.1 55 5 47.9 18 34.9 25.1 42"/>' +
      '<path class="si" d="M55,15v25h-10V15h-25V5h25c5.5,0,10,4.5,10,10Z"/>',
    coppe:
      '<circle class="si" cx="30" cy="30.5" r="10"/>' +
      '<path class="si" d="M18.9,21.6c-2,2.5-3.2,5.6-3.2,9s0,1,0,1.6c-6.5-4.5-10.8-12.1-10.8-20.6v-6.5h10v6.5c0,3.9,1.5,7.4,3.9,10.1Z"/>' +
      '<path class="si" d="M55,5v6.5c0,8.5-4.3,16.1-10.8,20.6,0-.5,0-1,0-1.6,0-2.7-.8-5.2-2.1-7.4-.3-.5-.7-1.1-1.1-1.6,2.4-2.7,3.9-6.2,3.9-10.1v-6.5h10Z"/>' +
      '<path class="si" d="M35,43.9v11.2h-10v-11.2c1.5.6,3.2.9,5,.9s3.5-.3,5-.9Z"/>',
    oro:
      '<circle class="si" cx="30" cy="30" r="10"/>' +
      '<path class="si" d="M46.9,35h8.1v-10h-8.1c-1.8,0-2.7-2.2-1.4-3.4l4-4-7.1-7.1-4,4c-1.3,1.3-3.4.4-3.4-1.4V5h-10v8.1c0,1.8-2.2,2.7-3.4,1.4l-4-4-7.1,7.1,4,4c1.3,1.3.4,3.4-1.4,3.4H5v10h8.1c1.8,0,2.7,2.2,1.4,3.4l-4,4,7.1,7.1,4-4c1.3-1.3,3.4-.4,3.4,1.4v8.1h10v-8.1c0-1.8,2.2-2.7,3.4-1.4l4,4,7.1-7.1-4-4c-1.3-1.3-.4-3.4,1.4-3.4ZM17.8,37.4c-1.3-2.2-2.1-4.7-2.1-7.4,0-7.9,6.4-14.3,14.3-14.3s5.2.8,7.4,2.1c2,1.2,3.6,2.8,4.8,4.8,1.3,2.2,2.1,4.7,2.1,7.4,0,7.9-6.4,14.3-14.3,14.3s-5.2-.8-7.4-2.1c-2-1.2-3.6-2.8-4.8-4.8Z"/>',
    bastoni:
      '<circle class="si" cx="30" cy="30.5" r="10"/>' +
      '<path class="si" d="M51.2,30c6.1-6.8,4.9-18-3.8-23.1s-4.8-1.9-7.3-1.9h0c-3.7,0-7.2,1.4-10,3.8-2.8-2.5-6.3-3.8-10-3.8h-.6c-3.4.3-6.8,1.5-9.3,3.8s-5.1,6.9-5.1,11.2c0,3.7,1.4,7.3,3.9,10-6.1,6.8-4.9,18,3.8,23.1s4.8,1.9,7.3,1.9h0c3.7,0,7.2-1.4,10-3.8,2.8,2.5,6.4,3.8,10,3.8s9.9-2.4,12.9-7.3,1.3-2.4,1.6-3.8c1.3-5.1,0-10.2-3.3-13.9ZM42.5,42.5c-1.8,1.8-4.7,1.8-6.5,0l-6,6-6-6c-.9.9-2,1.4-3.3,1.4h0c-.7,0-1.3-.1-1.9-.4-3.1-1.5-3.5-5.3-1.4-7.5l-6-6,6-6c-.9-.9-1.4-2-1.4-3.3,0-1.2.5-2.4,1.4-3.3.9-.9,2-1.4,3.3-1.4h0c1.2,0,2.4.5,3.3,1.4l6-6,6,6c.9-.9,2-1.4,3.3-1.4h0c.7,0,1.3.1,1.9.4,3.1,1.5,3.5,5.3,1.4,7.5l6,6-6,6c.9.9,1.4,2,1.4,3.3,0,1.2-.5,2.4-1.4,3.3Z"/>'
  };

  // Ritorna il markup <svg> completo per un seme (forme con classe .si).
  function svg(suit) {
    return '<svg class="suit-svg" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + (INNER[suit] || '') + '</svg>';
  }

  return { INNER: INNER, svg: svg };
});

/*
 * objects.js — Definizioni dei TOOLS e costruzione del DECK dei TOOLS.
 * Modulo puro: nessun DOM. Compatibile browser (window.CradleObjects) e Node.
 *
 * Glossario keyword: DEPLOY (scelta carte), MOVIMENTO, ATTACCO, STACK ATTIVA / DI RISERVA,
 * DECK, HEAP, CELLA ONLINE/OFFLINE/DISTRUTTA/VUOTA/OCCUPATA/BONUS, CELLE ORTOGONALI/DIAGONALI,
 * MATCH, SUIT, VALORE, ARM, GLOBAL SUIT, REMIX, SKILL, SOVRASCRIVI, DISTRUGGI, RUBA, PESCA.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('../core/deck.js'));
  } else {
    root.CradleObjects = factory(root.CradleDeck);
  }
})(typeof self !== 'undefined' ? self : this, function (Deck) {
  'use strict';

  // Etichetta della fase (per la scheda del TOOL).
  var PHASE_TXT = { select: 'DEPLOY', move: 'MOVIMENTO', attack: 'ATTACCO' };
  var PHASE_ABBR = { select: 'D', move: 'M', attack: 'A' }; // abbreviazioni per le schede TOOL

  // I TOOLS: phase (fase primaria), phases (tutte le fasi in cui è usabile), cost (testo), effect,
  // costSpec (costo machine-readable per gating/pagamento):
  //   stack:N   SCARTA N carte dalla STACK ATTIVA (rivelate)
  //   reserve:N SCARTA N carte dalla STACK DI RISERVA (non rivelate)
  //   points:N  PERDI N punti
  //   consume:  CONSUMA (solo se l'ARM è su CELLA ONLINE; quella CELLA diventa OFFLINE)
  //   tools:N   SCARTA N TOOL (altri TOOL che possiedi, a tua scelta)
  //   forfeit:  'move'|'attack' (rinunci al resto di quella fase dopo l'uso)
  var OBJECT_DEFS = {
    jetpack: {
      type: 'jetpack', phase: 'move', label: 'Jetpack',
      cost: 'SCARTA [1] carta dalla STACK ATTIVA', costSpec: { stack: 1 },
      effect: 'Per questo MOVIMENTO puoi MATCHARE anche le CELLE DIAGONALI.'
    },
    jump: {
      type: 'jump', phase: 'move', label: 'Salto',
      cost: 'SCARTA [1] carta dalla STACK ATTIVA', costSpec: { stack: 1 },
      effect: 'Per questo MOVIMENTO puoi MATCHARE solo a DISTANZA [2] su CELLE ORTOGONALI.'
    },
    hook: {
      type: 'hook', phase: 'attack', label: 'Spinta',
      cost: 'SCARTA [1] TOOL', costSpec: { tools: 1 },
      effect: 'Se COLPISCI un ARM avversario, lo sposti su una CELLA ORTOGONALE a DISTANZA [1].'
    },
    homing_missile: {
      type: 'homing_missile', phase: 'attack', label: 'Granata',
      cost: 'CONSUMA', costSpec: { consume: true },
      effect: 'DISTRUGGE la CELLA colpita. Se era OCCUPATA, sposti quell\'ARM su una CELLA ORTOGONALE a DISTANZA [1].'
    },
    rush_juice: {
      type: 'rush_juice', phase: 'select', label: 'Doppio Movimento',
      cost: 'Non puoi effettuare l\'azione di ATTACCO questo turno', costSpec: {},
      effect: 'Questo TURNO puoi eseguire [2] MOVIMENTI.'
    },
    combat_juice: {
      type: 'combat_juice', phase: 'select', label: 'Doppio Attacco',
      cost: 'Non puoi effettuare l\'azione di MOVIMENTO questo turno', costSpec: {},
      effect: 'Questo TURNO puoi eseguire [2] ATTACCHI.'
    },
    timebomb: {
      type: 'timebomb', phase: 'select', label: 'Cronobomba',
      cost: 'PERDI [1] punto', costSpec: { points: 1 },
      effect: 'Sposta subito la GLOBAL SUIT su una SUIT a tua scelta; la rotazione prosegue da lì.'
    },
    elemental_bomb: {
      type: 'elemental_bomb', phase: 'attack', label: 'Bomba Elementale',
      cost: 'CONSUMA', costSpec: { consume: true },
      effect: 'Scegli [1] CELLA: la sua SUIT e quella delle CELLE ORTOGONALI diventano una SUIT a tua scelta.'
    },
    barrage: {
      type: 'barrage', phase: 'attack', label: 'Barrage!',
      cost: 'CONSUMA', costSpec: { consume: true },
      effect: 'Scegli [1] CELLA VUOTA e DISTRUGGILA.'
    },
    randomizer: {
      type: 'randomizer', phase: 'attack', phases: ['attack', 'move'], label: 'Randomizzatore',
      cost: 'CONSUMA', costSpec: { consume: true },
      effect: 'PESCA fino a [3] carte, poi per ognuna SOVRASCRIVI una CELLA.'
    },
    energy_boost: {
      type: 'energy_boost', phase: 'move', phases: ['move', 'attack'], label: 'Ricarica',
      cost: null, costSpec: {},
      effect: 'PESCA [2] carte e aggiungile alla STACK ATTIVA.'
    },
    energy_drain: {
      type: 'energy_drain', phase: 'move', phases: ['move', 'attack'], label: 'Sifone Energetico',
      cost: null, costSpec: {},
      effect: 'RUBA [1] carta all\'avversario e aggiungila alla STACK ATTIVA.'
    },
    rebuild: {
      type: 'rebuild', phase: 'move', phases: ['move', 'attack'], label: 'Ripristina',
      cost: null, costSpec: {},
      effect: 'PESCA [3] carte, scegline [1] e con essa SOVRASCRIVI una CELLA DISTRUTTA o OFFLINE.'
    },
    remix: {
      type: 'remix', phase: 'select', phases: ['select', 'move', 'attack'], label: 'Remix!',
      cost: 'PERDI [1] punto', costSpec: { points: 1 },
      effect: 'Ripristina [1] uso di REMIX già consumato (non oltre il totale).'
    },
    encore: {
      type: 'encore', phase: 'select', phases: ['select', 'move', 'attack'], label: 'Encore!',
      cost: 'PERDI [1] punto', costSpec: { points: 1 },
      effect: 'Ripristina [1] uso della SKILL del tuo ARM già consumato (non oltre il totale).'
    },
    teleport: {
      type: 'teleport', phase: 'move', label: 'Teletrasporto',
      cost: 'Non puoi effettuare la fase di MOVIMENTO questo turno', costSpec: { forfeit: 'move' },
      effect: 'Muovi su una qualsiasi CELLA VUOTA scoperta con lo stesso VALORE della CELLA da cui parti.'
    },
    grapple: {
      type: 'grapple', phase: 'move', label: 'Arpione',
      cost: 'SCARTA [1] carta dalla STACK ATTIVA', costSpec: { stack: 1 },
      effect: 'Per questo MOVIMENTO puoi MATCHARE anche le CELLE ORTOGONALI all\'ARM avversario.'
    },
    // ---- Nuovi TOOLS ----
    carica_disperata: {
      type: 'carica_disperata', phase: 'move', label: 'Carica Disperata',
      cost: 'SCARTA [2] TOOL', costSpec: { tools: 2 },
      effect: 'Muovi su una CELLA OCCUPATA da un ARM avversario nella tua stessa riga o colonna (senza MATCH): si svolge un CLASH come in un normale MOVIMENTO.'
    },
    snipe: {
      type: 'snipe', phase: 'attack', label: 'Snipe',
      cost: 'Non puoi effettuare la fase di ATTACCO questo turno; CONSUMA', costSpec: { consume: true, forfeit: 'attack' },
      effect: 'Colpisci una CELLA OCCUPATA da un ARM avversario nella tua stessa riga o colonna (senza MATCH): si svolge un CLASH come in un normale ATTACCO.'
    },
    santuario: {
      type: 'santuario', phase: 'move', phases: ['move', 'attack'], label: 'Santuario',
      cost: 'SCARTA [1] TOOL', costSpec: { tools: 1 },
      effect: 'PESCA [5] carte, SOVRASCRIVI la CELLA che OCCUPI e tutte le CELLE ORTOGONALI.'
    },
    feedback_loop: {
      type: 'feedback_loop', phase: 'move', phases: ['move', 'attack'], label: 'Feedback Loop',
      cost: 'SCARTA [1] carta dalla STACK DI RISERVA', costSpec: { reserve: 1 },
      effect: 'SOVRASCRIVI la CELLA occupata dal tuo ARM con una carta della STACK ATTIVA, poi PESCA [1] carta nella STACK ATTIVA.'
    },
    swap: {
      type: 'swap', phase: 'move', label: 'Swap!',
      cost: 'RIGENERA; Non puoi effettuare l\'azione di ATTACCO questo turno', costSpec: { regen: true, forfeit: 'attack' },
      effect: 'Scambia la posizione del tuo ARM con quella di un ARM avversario.'
    },
    nuke: {
      type: 'nuke', phase: 'attack', label: 'Nuke',
      cost: 'Non puoi effettuare la fase di ATTACCO questo turno; SCARTA [3] TOOL', costSpec: { tools: 3, forfeit: 'attack' },
      effect: 'MATCHA [1] CELLA: quella CELLA e tutte le CELLE ORTOGONALI diventano OFFLINE. Se avevano OBIETTIVI ne ottieni i punti (nessun TOOL). Gli ARM in quelle CELLE perdono [2] punti.'
    },
    overcharge: {
      type: 'overcharge', phase: 'select', phases: ['select', 'move', 'attack'], label: 'Overcharge',
      cost: 'SCARTA [1] TOOL', costSpec: { tools: 1 },
      effect: 'Ottieni [+2] al VALORE nei CLASH fino all\'inizio del tuo prossimo turno.'
    },
    toolbox: {
      type: 'toolbox', phase: 'select', phases: ['select', 'move', 'attack'], label: 'Toolbox',
      cost: 'CONSUMA', costSpec: { consume: true },
      effect: 'PESCA [2] TOOL dal tuo mazzo.'
    },
    shuffle: {
      type: 'shuffle', phase: 'move', phases: ['move', 'attack'], label: 'Shuffle',
      cost: null, costSpec: {},
      effect: 'Seleziona [2] CELLE ONLINE VUOTE e scambia le carte presenti nelle due CELLE.'
    },
    // ---- Overtake: scegli una colonna, RIGENERA le CELLE OFFLINE/DISTRUTTE della colonna e
    //      converti tutte le CELLE della colonna a una SUIT fissa (una variante per SUIT). ----
    overtake_oro: {
      type: 'overtake_oro', phase: 'move', phases: ['move', 'attack'], label: 'Oro Overtake', overtakeSuit: 'oro',
      cost: 'SCARTA [2] TOOL', costSpec: { tools: 2 },
      effect: 'Scegli [1] colonna: per ogni CELLA OFFLINE o DISTRUTTA PESCA una carta e con essa SOVRASCRIVI la CELLA, poi tutte le CELLE della colonna diventano SUIT ORO. Ogni ARM in quella colonna perde [1] punto.'
    },
    overtake_spade: {
      type: 'overtake_spade', phase: 'move', phases: ['move', 'attack'], label: 'Spade Overtake', overtakeSuit: 'spade',
      cost: 'SCARTA [2] TOOL', costSpec: { tools: 2 },
      effect: 'Scegli [1] colonna: per ogni CELLA OFFLINE o DISTRUTTA PESCA una carta e con essa SOVRASCRIVI la CELLA, poi tutte le CELLE della colonna diventano SUIT SPADE. Ogni ARM in quella colonna perde [1] punto.'
    },
    overtake_coppe: {
      type: 'overtake_coppe', phase: 'move', phases: ['move', 'attack'], label: 'Coppe Overtake', overtakeSuit: 'coppe',
      cost: 'SCARTA [2] TOOL', costSpec: { tools: 2 },
      effect: 'Scegli [1] colonna: per ogni CELLA OFFLINE o DISTRUTTA PESCA una carta e con essa SOVRASCRIVI la CELLA, poi tutte le CELLE della colonna diventano SUIT COPPE. Ogni ARM in quella colonna perde [1] punto.'
    },
    overtake_bastoni: {
      type: 'overtake_bastoni', phase: 'move', phases: ['move', 'attack'], label: 'Bastoni Overtake', overtakeSuit: 'bastoni',
      cost: 'SCARTA [2] TOOL', costSpec: { tools: 2 },
      effect: 'Scegli [1] colonna: per ogni CELLA OFFLINE o DISTRUTTA PESCA una carta e con essa SOVRASCRIVI la CELLA, poi tutte le CELLE della colonna diventano SUIT BASTONI. Ogni ARM in quella colonna perde [1] punto.'
    },
    drenaggio: {
      type: 'drenaggio', phase: 'move', phases: ['move', 'attack'], label: 'Drenaggio',
      cost: 'RIGENERA; SCARTA [1] TOOL', costSpec: { regen: true, tools: 1 },
      effect: 'Rendi OFFLINE tutte le CELLE ORTOGONALI alla posizione del tuo ARM.'
    }
  };
  // Deriva l'etichetta di fase e il testo del tooltip (fase + costo + effetto).
  Object.keys(OBJECT_DEFS).forEach(function (k) {
    var d = OBJECT_DEFS[k];
    var ps = d.phases || [d.phase];
    d.phaseLabel = ps.map(function (p) { return PHASE_TXT[p]; }).join(' / ');
    d.phaseAbbr = ps.map(function (p) { return PHASE_ABBR[p]; }).join('/');
    d.desc = 'FASE: ' + d.phaseLabel + '. ' + (d.cost ? 'COSTO: ' + d.cost + '. ' : '') + d.effect;
    if (!d.costSpec) d.costSpec = {};
  });

  var ALL_TYPES = ['jetpack', 'jump', 'hook', 'homing_missile', 'rush_juice', 'combat_juice', 'timebomb', 'elemental_bomb', 'barrage', 'randomizer', 'energy_boost', 'energy_drain', 'rebuild', 'remix', 'encore', 'teleport', 'grapple', 'carica_disperata', 'snipe', 'santuario', 'feedback_loop', 'swap', 'nuke', 'overcharge', 'toolbox', 'shuffle', 'overtake_oro', 'overtake_spade', 'overtake_coppe', 'overtake_bastoni', 'drenaggio'];

  // Composizione del mazzo TOOLS personale: 12 carte, ogni tipo al massimo 3 copie.
  var TOOL_DECK_SIZE = 12;
  var TOOL_MAX_COPIES = 3;
  var TOOL_RANDOM_TYPES = 4; // DECK casuale: 4 tipi distinti × 3 copie = 12.

  function def(type) { return OBJECT_DEFS[type] || null; }

  // Crea una carta TOOL con id univoco. fromCharacter esclude dal limite.
  var _seq = 0;
  function makeObjectCard(type, fromCharacter) {
    var d = OBJECT_DEFS[type];
    return { id: 'obj-' + type + '-' + (_seq++), type: type, phase: d.phase, fromCharacter: !!fromCharacter };
  }

  // Tipi selezionabili per un ruleset: i TOOLS "solo Ruleset C" (cOnly) entrano solo se ruleset === 'C'.
  function selectablePool(ruleset) {
    var allowC = ruleset === 'C';
    return ALL_TYPES.filter(function (t) { return !!OBJECT_DEFS[t] && (allowC || !OBJECT_DEFS[t].cOnly); });
  }

  // Somma delle copie in una count-map { type: copie }.
  function specTotal(spec) {
    var t = 0; for (var k in spec) if (spec.hasOwnProperty(k)) t += spec[k] | 0; return t;
  }

  // Normalizza una composizione (array di tipi o count-map) in una count-map pulita:
  // solo tipi validi per il ruleset, copie in [1..3], totale ≤ 12.
  function normalizeSpec(spec, ruleset) {
    var okSet = {}; selectablePool(ruleset).forEach(function (t) { okSet[t] = true; });
    var out = {};
    if (Array.isArray(spec)) {
      spec.forEach(function (t) { if (okSet[t]) out[t] = Math.min(TOOL_MAX_COPIES, (out[t] || 0) + 1); });
    } else if (spec && typeof spec === 'object') {
      Object.keys(spec).forEach(function (t) {
        if (!okSet[t]) return;
        var n = Math.max(0, Math.min(TOOL_MAX_COPIES, spec[t] | 0));
        if (n > 0) out[t] = n;
      });
    }
    // Non superare 12 carte totali: scarta le eccedenze.
    var over = specTotal(out) - TOOL_DECK_SIZE;
    var keys = Object.keys(out);
    for (var i = keys.length - 1; i >= 0 && over > 0; i--) {
      var cut = Math.min(out[keys[i]], over);
      out[keys[i]] -= cut; over -= cut;
      if (out[keys[i]] <= 0) delete out[keys[i]];
    }
    return out;
  }

  // Count-map casuale: TOOL_RANDOM_TYPES tipi distinti, 3 copie ciascuno (= 12 carte).
  function randomToolDeckSpec(rng, ruleset) {
    var pool = selectablePool(ruleset).slice();
    Deck.shuffle(pool, rng || Math.random);
    var spec = {};
    pool.slice(0, TOOL_RANDOM_TYPES).forEach(function (t) { spec[t] = TOOL_MAX_COPIES; });
    return spec;
  }

  // "Fill": completa una composizione fino a 12 carte con il maggior numero di copie possibile
  // del minor numero possibile di carte (prima porta a 3 i tipi già presenti, poi aggiunge tipi casuali).
  function fillToolDeckSpec(spec, rng, ruleset) {
    var out = normalizeSpec(spec, ruleset);
    var pool = selectablePool(ruleset);
    var r = rng || Math.random;
    var guard = 0;
    while (specTotal(out) < TOOL_DECK_SIZE && guard++ < 200) {
      // 1) completa un tipo già presente ma sotto le 3 copie.
      var pick = null;
      Object.keys(out).forEach(function (t) { if (pick == null && out[t] < TOOL_MAX_COPIES) pick = t; });
      if (!pick) {
        // 2) aggiungi un nuovo tipo casuale non ancora presente.
        var avail = pool.filter(function (t) { return !out[t]; });
        if (!avail.length) break;
        pick = avail[Math.floor(r() * avail.length)];
      }
      out[pick] = (out[pick] || 0) + 1;
    }
    return out;
  }

  // Espande una count-map in un array di carte TOOL (non mescolato).
  function specToCards(spec) {
    var cards = [];
    Object.keys(spec).forEach(function (t) {
      var n = spec[t] | 0;
      for (var i = 0; i < n; i++) cards.push(makeObjectCard(t, false));
    });
    return cards;
  }

  // DECK dei TOOLS personale di un giocatore, mescolato.
  // - spec assente/vuoto → DECK casuale (4 tipi × 3 copie).
  // - spec = composizione (array di tipi o count-map) → esattamente quella composizione.
  function buildObjectDeckForPlayer(rng, spec, ruleset) {
    var hasSpec = spec && (Array.isArray(spec) ? spec.length : Object.keys(spec).length);
    var norm = hasSpec ? normalizeSpec(spec, ruleset) : randomToolDeckSpec(rng, ruleset);
    return Deck.shuffle(specToCards(norm), rng);
  }

  return {
    OBJECT_DEFS: OBJECT_DEFS,
    ALL_TYPES: ALL_TYPES,
    TOOL_DECK_SIZE: TOOL_DECK_SIZE,
    TOOL_MAX_COPIES: TOOL_MAX_COPIES,
    def: def,
    makeObjectCard: makeObjectCard,
    selectablePool: selectablePool,
    specTotal: specTotal,
    normalizeSpec: normalizeSpec,
    randomToolDeckSpec: randomToolDeckSpec,
    fillToolDeckSpec: fillToolDeckSpec,
    buildObjectDeckForPlayer: buildObjectDeckForPlayer
  };
});

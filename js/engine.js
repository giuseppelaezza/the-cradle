/*
 * engine.js — Stato + regole di The Cradle (v2).
 * Logica di gioco PURA: nessun DOM, deterministica (rng iniettabile), testabile.
 *
 * v2 aggiunge: modalità seme (fissa/rotazione), moduli Personaggi e Oggetti,
 * nuova struttura del turno con finestre "uso oggetto", celle distrutte.
 *
 * La UI legge `game.state` e chiama i metodi. Compatibile browser/Node.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./deck.js'), require('./objects.js'), require('./characters.js'));
  } else {
    root.CradleEngine = factory(root.CradleDeck, root.CradleObjects, root.CradleCharacters);
  }
})(typeof self !== 'undefined' ? self : this, function (Deck, Objects, Characters) {
  'use strict';

  var DEFAULT_SIZE = 5;
  var CLASH_WIN_BONUS = 3; // punti extra a chi vince un clash da ATTACCANTE (il difensore non prende bonus)

  // ------------------------------------------------------------------ Geometria
  // La griglia è quadrata size×size: 5 di default, 4 nella variante del Ruleset C.
  function cellKey(x, y) { return x + ',' + y; }
  // Centro: esiste solo nella 5×5 (cella [3,3]). Nella 4×4 non c'è cella centrale.
  function isCenter(x, y, size) { return (size || DEFAULT_SIZE) === 5 && x === 3 && y === 3; }
  // Celle bonus della 4×4: le 4 celle centrali [2,2],[2,3],[3,2],[3,3].
  function isBonusCell(x, y, size) { return (size || DEFAULT_SIZE) === 4 && x >= 2 && x <= 3 && y >= 2 && y <= 3; }
  // Ruleset C — celle che assegnano punti-posizione a fine turno (= "celle bonus" per la scelta oggetto):
  // 5×5: centro + le 4 celle ortogonali adiacenti al centro; 4×4: le 4 celle centrali.
  function isPositionBonusCell(x, y, size) {
    size = size || DEFAULT_SIZE;
    if (size === 4) return isBonusCell(x, y, 4);
    return isCenter(x, y, 5) || (Math.abs(x - 3) + Math.abs(y - 3) === 1);
  }
  // Punti-posizione della cella (Ruleset C). 5×5: centro +3, adiacente +1. 4×4: bonus +2.
  function positionBonusPoints(x, y, size) {
    size = size || DEFAULT_SIZE;
    if (size === 4) return isBonusCell(x, y, 4) ? 2 : 0;
    if (isCenter(x, y, 5)) return 3;
    return (Math.abs(x - 3) + Math.abs(y - 3) === 1) ? 1 : 0;
  }
  function targetRow(playerId, size) { return playerId === 'N' ? (size || DEFAULT_SIZE) : 1; }
  function isTargetCell(playerId, cell, size) { return cell.y === targetRow(playerId, size); }
  function otherPlayer(id) { return id === 'N' ? 'S' : 'N'; }
  // Multiplayer: i 4 angoli in ordine ORARIO (NW, NE, SE, SW) e le loro coordinate.
  var SEAT_CW = ['N', 'E', 'S', 'W'];
  function seatCorner(id, size) {
    switch (id) {
      case 'N': return [1, 1];        // NW
      case 'E': return [size, 1];     // NE
      case 'S': return [size, size];  // SE
      case 'W': return [1, size];     // SW
    }
    return [1, 1];
  }
  function inBounds(x, y, size) { size = size || DEFAULT_SIZE; return x >= 1 && x <= size && y >= 1 && y <= size; }

  function orthogonalNeighbors(x, y, size) {
    var out = [], d = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < d.length; i++) if (inBounds(x + d[i][0], y + d[i][1], size)) out.push([x + d[i][0], y + d[i][1]]);
    return out;
  }
  function diagonalNeighbors(x, y, size) {
    var out = [], d = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (var i = 0; i < d.length; i++) if (inBounds(x + d[i][0], y + d[i][1], size)) out.push([x + d[i][0], y + d[i][1]]);
    return out;
  }
  // Celle di destinazione del movimento in base all'eventuale modificatore oggetto.
  function moveDestinations(x, y, modifier, size) {
    if (modifier === 'jetpack') return orthogonalNeighbors(x, y, size).concat(diagonalNeighbors(x, y, size));
    if (modifier === 'jump') {
      var out = [], d = [[2, 0], [-2, 0], [0, 2], [0, -2]];
      for (var i = 0; i < d.length; i++) if (inBounds(x + d[i][0], y + d[i][1], size)) out.push([x + d[i][0], y + d[i][1]]);
      return out;
    }
    return orthogonalNeighbors(x, y, size);
  }

  // ------------------------------------------------------------------ Matching (§4)
  /**
   * @param handCard carta in mano
   * @param cell casella della griglia
   * @param currentSuit seme di turno
   * @param belongingSuit seme di appartenenza del giocatore (o null)
   */
  function canMatch(handCard, cell, currentSuit, belongingSuit) {
    if (!cell || cell.destroyed || !cell.card) return false;   // cella distrutta/vuota: mai
    var isJolly = handCard.suit === currentSuit || (!!belongingSuit && handCard.suit === belongingSuit);
    if (cell.faceDown) return isJolly;                          // coperta: solo semi jolly
    if (handCard.value === cell.card.value) return true;        // per valore
    if (isJolly && handCard.suit === cell.card.suit) return true; // jolly: stesso seme, qualsiasi valore
    return false;
  }

  // ------------------------------------------------------------------ Clash (§4)
  // Spareggio tra SUIT a parità di VALORE: schema CICLICO oro > spade > coppe > bastoni > oro.
  // Ogni SUIT batte quella immediatamente successiva nel ciclo (e la più bassa batte la più alta:
  // bastoni > oro), così ogni SUIT è ugualmente impattante. Le due SUIT "opposte" nel ciclo
  // (oro/coppe e spade/bastoni) non si battono a vicenda: è pareggio.
  function suitClash(a, b) {
    if (a === b) return 'tie';
    var pa = Deck.SUIT_CYCLE.indexOf(a), pb = Deck.SUIT_CYCLE.indexOf(b);
    var d = ((pb - pa) % 4 + 4) % 4; // passi in senso orario da a a b
    if (d === 1) return 'a';   // a è subito prima di b nel ciclo → a vince
    if (d === 3) return 'b';   // b è subito prima di a → b vince
    return 'tie';              // opposte (d === 2): pareggio
  }
  function resolveClash(attCard, defCard) {
    if (attCard.value !== defCard.value) return attCard.value > defCard.value ? 'attacker' : 'defender';
    var w = suitClash(attCard.suit, defCard.suit);
    return w === 'a' ? 'attacker' : (w === 'b' ? 'defender' : 'tie');
  }

  // ------------------------------------------------------------------ Setup
  function makePlayer(id) {
    return {
      id: id, score: 0, hand: [], revealedIds: [], revealedCards: [],
      trophies: [], figuresMatched: 0, matchedCenter: false,
      character: null, belongingSuit: null,
      objects: [],                          // include eventuale oggetto iniziale (fromCharacter)
      pendingActions: { moves: 1, attacks: 1 },
      energyExtraDiscard: 0,       // scarti extra a fine turno dovuti a Energy Boost
      reshuffleLeft: 2,            // Modulo Reshuffle: usi rimasti
      reshuffleTotal: 2,           // Modulo Reshuffle: usi totali (da configurazione)
      // Modulo "poteri personaggi" (§12): stato dei poteri.
      // I totali vengono impostati in createGame dal personaggio assegnato (Characters.powerUses).
      tacticianOpen: false,        // tactician: usa anche le carte non scelte (per-round)
      tacticianTotal: 2,           // tactician: attivazioni totali per partita
      tacticianLeft: 2,            // tactician: attivazioni rimaste
      brawlerTotal: 3,             // brawler: attivazioni totali per partita
      brawlerLeft: 3,              // brawler: attivazioni rimaste
      runnerTotal: 2,             // runner: usi della passiva "colpisci figura in movimento"
      runnerLeft: 2,
      targetObjectUsed: false,    // Ruleset C: scelta oggetto (una tantum) al raggiungimento della riga avversaria
      actedThisRound: false,      // true se il PILOTA ha fatto almeno un'azione nel ROUND corrente
      // Statistiche di partita per la schermata finale.
      stats: {
        ptsPawn: 0,        // punti da COLPO su ARM avversario (clash vinto / colpo diretto)
        ptsFigure: 0,      // punti da COLPO su OBIETTIVI (figure 8/9/10)
        ptsBonus: 0,       // punti ricevuti da CELLE BONUS a fine TURNO
        objUses: 0,        // numero di TOOLS usati
        objByType: {},     // dettaglio TOOLS usati per tipo { type: count }
        zeroActionTurns: 0,// ROUND passati senza alcuna azione
        moves: 0,          // MOVIMENTI effettuati
        attacks: 0         // ATTACCHI effettuati
      }
    };
  }

  /**
   * @param {object} [opts]
   * @param {()=>number} [opts.rng]
   * @param {'N'|'S'} [opts.firstPlayer]
   * @param {'fixed'|'rotating'} [opts.suitMode]
   * @param {{characters:bool, objects:bool}} [opts.modules]
   * @param {{N:string, S:string}} [opts.characters]  // tipi di personaggio scelti
   */
  function createGame(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var suitMode = opts.suitMode === 'rotating' ? 'rotating' : 'fixed';
    var modules = { characters: !!(opts.modules && opts.modules.characters),
                    objects: !!(opts.modules && opts.modules.objects),
                    powers: !!(opts.modules && opts.modules.powers),
                    reshuffle: !!(opts.modules && opts.modules.reshuffle) };
    // Ruleset: 'A' (alternativo), 'B' (standard), 'C' (basato su A, controllo del centro).
    var ruleset = opts.ruleset || (opts.altMatch ? 'A' : 'B');
    var altMatch = ruleset !== 'B'; // A e C usano l'abbinamento alternativo
    // Dimensione griglia: 4×4 solo per il Ruleset C (variante "celle bonus"), 5×5 altrimenti.
    var gridSize = (ruleset === 'C' && (opts.gridSize | 0) === 4) ? 4 : 5;
    // Modalità griglia: 'random' (generata a caso, default) o 'draft' (i PILOTI la costruiscono a turno).
    var gridMode = opts.gridMode === 'draft' ? 'draft' : 'random';

    // Numero di giocatori: 2 (default). 3-4 SOLO su griglia 5×5.
    var numPlayers = Math.max(2, Math.min(4, (opts.numPlayers | 0) || 2));
    if (numPlayers > 2 && gridSize !== 5) numPlayers = 2;
    // Angoli di partenza (seggi), in ordine orario:
    //  - 2 giocatori: diagonale N/S (come sempre);
    //  - 4 giocatori: tutti e 4 gli angoli;
    //  - 3 giocatori: 3 dei 4 angoli scelti a caso (mantenendo l'ordine orario).
    var seats;
    if (numPlayers === 2) seats = ['N', 'S'];
    else if (numPlayers === 4) seats = SEAT_CW.slice();
    else { seats = SEAT_CW.slice(); seats.splice(Math.floor(rng() * 4), 1); }
    // Personaggi: accetta sia una mappa per-seggio ({N:..,S:..}) sia un array per indice (Pilota 1..n).
    var charList;
    if (Array.isArray(opts.characters)) charList = opts.characters.slice();
    else if (opts.characters) charList = seats.map(function (id) { return opts.characters[id]; });
    else charList = [];

    // 1-4. Mazzo, seme iniziale, asso centrale, griglia.
    var deck = Deck.shuffle(Deck.buildDeck(), rng);
    var starter = deck.shift();
    var centerInitialSuit = starter.suit;
    var grid = [];
    for (var gx = 0; gx <= gridSize; gx++) grid[gx] = [];
    if (gridMode === 'draft') {
      // Draft: la griglia parte VUOTA; i PILOTI la riempiono a turno (§ variante Draft).
      for (var dxx = 1; dxx <= gridSize; dxx++) for (var dyy = 1; dyy <= gridSize; dyy++) {
        grid[dxx][dyy] = { x: dxx, y: dyy, card: null, faceDown: false, destroyed: false, pawn: null };
      }
    } else if (gridSize === 5) {
      // Griglia 5×5: la cella centrale ospita l'asso del seme iniziale.
      var aceIndex = -1;
      for (var i = 0; i < deck.length; i++) if (deck[i].value === 1 && deck[i].suit === centerInitialSuit) { aceIndex = i; break; }
      var aceCard = deck.splice(aceIndex, 1)[0];
      Deck.shuffle(deck, rng);
      for (var x = 1; x <= 5; x++) for (var y = 1; y <= 5; y++) {
        var card = isCenter(x, y, 5) ? aceCard : deck.shift();
        grid[x][y] = { x: x, y: y, card: card, faceDown: false, destroyed: false, pawn: null };
      }
    } else {
      // Griglia 4×4: nessuna cella centrale; tutte e 16 le celle sono carte normali.
      Deck.shuffle(deck, rng);
      for (var x4 = 1; x4 <= 4; x4++) for (var y4 = 1; y4 <= 4; y4++) {
        grid[x4][y4] = { x: x4, y: y4, card: deck.shift(), faceDown: false, destroyed: false, pawn: null };
      }
    }
    // Pedine agli angoli (un seggio per giocatore).
    seats.forEach(function (id) { var c = seatCorner(id, gridSize); grid[c[0]][c[1]].pawn = id; });

    var players = {};
    seats.forEach(function (id) { players[id] = makePlayer(id); });

    // Modulo Reshuffle: numero di usi per partita (1-3, default 2).
    var reshuffleCount = opts.reshuffleCount ? Math.max(1, Math.min(3, opts.reshuffleCount | 0)) : 2;
    seats.forEach(function (id) { players[id].reshuffleLeft = reshuffleCount; players[id].reshuffleTotal = reshuffleCount; });

    // 6-7. Personaggi e oggetto iniziale.
    if (modules.characters) {
      seats.forEach(function (id, si) {
        var type = charList[si];
        // "random": personaggio scelto a caso per questo giocatore.
        if (type === 'random') type = Characters.ORDER[Math.floor(rng() * Characters.ORDER.length)];
        var ch = Characters.get(type) || Characters.get('runner');
        players[id].character = ch.type;
        players[id].belongingSuit = ch.suit;
        // Numero di attivazioni del potere per partita (configurabile in characters.js).
        if (ch.type === 'tactician' && ch.powerUses != null) { players[id].tacticianTotal = players[id].tacticianLeft = ch.powerUses | 0; }
        if (ch.type === 'brawler' && ch.powerUses != null) { players[id].brawlerTotal = players[id].brawlerLeft = ch.powerUses | 0; }
        if (ch.type === 'runner' && ch.powerUses != null) { players[id].runnerTotal = players[id].runnerLeft = ch.powerUses | 0; }
        // Oggetto/i iniziale/i (esclusi dal limite).
        if (modules.objects) (ch.startObjects || []).forEach(function (t) { players[id].objects.push(Objects.makeObjectCard(t, true)); });
      });
    }

    // Mazzo Oggetti (2 copie di 5 tipi, o dei tipi scelti in configurazione) solo se il modulo è attivo.
    var objectDeck = modules.objects ? Objects.buildObjectDeck(rng, opts.objectSelection, ruleset) : [];
    // Ruleset A (abbinamento alternativo): ogni giocatore pesca 1 oggetto extra a inizio partita.
    if (modules.objects && altMatch) {
      seats.forEach(function (id) { if (objectDeck.length) players[id].objects.push(objectDeck.shift()); });
    }

    // 8. Pesca 6 carte a testa. Nel Draft le mani si pescano DOPO (a griglia completa, §_finishDraft).
    if (gridMode !== 'draft') {
      for (var d = 0; d < 6; d++) seats.forEach(function (id) { players[id].hand.push(deck.shift()); });
    }

    var firstPlayer = opts.firstPlayer && players[opts.firstPlayer] ? opts.firstPlayer : seats[Math.floor(rng() * seats.length)];
    // Struttura del turno: '1221' (default) = mov G1→G2, att G2→G1 (iniziativa divisa);
    // '1212' = mov G1→G2, att G1→G2 (stesso ordine in movimento e attacco).
    var turnMode = opts.turnMode === '1212' ? '1212' : '1221';
    // Numero di round: 9 di default; solo nel Ruleset C è configurabile (7–11).
    var maxRounds = 9;
    if (ruleset === 'C' && opts.maxRounds) maxRounds = Math.max(7, Math.min(11, opts.maxRounds | 0));
    // Regola opzionale "Clash su Attacco": attaccare una pedina avversaria apre un clash.
    var clashOnAttack = !!opts.clashOnAttack;

    // Ordine di gioco: in senso orario a partire dal 1° Pilota (G1..Gk).
    var seatsCW = SEAT_CW.filter(function (id) { return players[id]; });
    var fi = seatsCW.indexOf(firstPlayer); if (fi < 0) fi = 0;
    var playerOrder = seatsCW.slice(fi).concat(seatsCW.slice(0, fi));
    var selectedInit = {}, selUsedInit = {};
    seats.forEach(function (id) { selectedInit[id] = null; selUsedInit[id] = false; });

    var state = {
      deck: deck, objectDeck: objectDeck, discard: [], objectDiscard: [],
      grid: grid, gridSize: gridSize, gridMode: gridMode, centerInitialSuit: centerInitialSuit,
      numPlayers: numPlayers, playerOrder: playerOrder,
      suitMode: suitMode, currentSuit: centerInitialSuit, turnMode: turnMode, maxRounds: maxRounds, clashOnAttack: clashOnAttack,
      modules: modules, altMatch: altMatch, ruleset: ruleset,
      trail: [],               // storico geometrico di movimenti/spari (per l'overlay "Mostra azioni")
      players: players, firstPlayer: firstPlayer,
      round: 1,
      phase: 'select',        // 'select'|'move'|'attack'|'end'
      subPhase: null,         // null|'clash-cards'|'clash-reloc'|'object-discard'|'forced-reloc'|'timebomb-suit'
      activePlayer: firstPlayer,
      selected: selectedInit,
      selectObjectUsed: selUsedInit, // max 1 oggetto select per giocatore/round
      actionsLeft: 0,
      moveModifier: null,     // 'jetpack'|'jump'|'grapple' (armato per l'azione di movimento corrente)
      attackModifier: null,   // 'hook'|'homing' (armato per l'attacco corrente)
      pendingClash: null,
      pendingForced: null,    // {kind,pawnId,chooserId,from,optional} durante 'forced-reloc'
      pendingObjectDiscard: null,
      pendingToolDiscard: null, // {playerId,modifier} durante 'tool-discard' (costo di jetpack/jump)
      pendingRunner: null,    // {playerId,x,y} durante 'runner-figure' (passiva runner)
      pendingAltMatch: null,  // {playerId,x,y,drawn?} durante 'altmatch-object'
      pendingTimebomb: null,
      pendingTeleport: null,  // {playerId} durante 'teleport-select' (oggetto Teleport, Ruleset C)
      pendingEndDiscard: null, // {playerId,need,sel} durante 'end-discard' (scarto in eccesso a fine turno)
      pendingRebuild: null,    // {playerId,drawn,chosen} durante 'rebuild-select'/'rebuild-place' (TOOL Ricostruisci)
      pendingDraft: null,      // {playerId,drawn,chosen,placed,need} durante 'draft-select'/'draft-place' (variante Draft)
      pendingEnergy: null,     // {playerId} durante 'energy-target' (Sifone Energetico: scelta del bersaglio in multiplayer)
      pendingEndBonus: null,   // {playerId, options} durante 'endbonus-steal' (bonus spade di fine ROUND: scelta avversario)
      pendingElemental: null, pendingBarrage: null, pendingRandomizer: null,
      gameOver: false, endTriggered: false, result: null, log: []
    };

    var game = new Game(state);
    game._rng = rng; // per il rimescolo del randomizer (non è parte dello stato clonabile)
    if (gridMode === 'draft') game._beginDraftTurn(); else game._beginSelectPhase();
    return game;
  }

  // ------------------------------------------------------------------ Game
  function Game(state) {
    this.state = state;
    this._chain = [];    // catena di passi post-azione (interrupt: scarto/ricollocazione)
    this.history = [];   // snapshot dello stato PRIMA di ogni azione (per undo / click sul log)
    this._inAction = false;
  }

  Game.prototype._log = function (m) { this.state.log.push('R' + this.state.round + ' · ' + m); };
  // Aggiunge punti al PILOTA e li imputa a una categoria di statistica (ptsPawn/ptsFigure/ptsBonus).
  Game.prototype._addScore = function (id, amount, cat) {
    if (!amount) return;
    var p = this.state.players[id];
    p.score += amount;
    if (cat && p.stats && p.stats[cat] != null) p.stats[cat] += amount;
  };
  // Segna che il PILOTA ha compiuto almeno un'azione (MOVIMENTO / ATTACCO / uso TOOL) nel ROUND.
  Game.prototype._markActed = function (id) { var p = this.state.players[id]; if (p) p.actedThisRound = true; };
  // ---- Ordine di gioco (multiplayer) ----
  // Ordine ORARIO a partire dal 1° Pilota, calcolato SEMPRE da firstPlayer (nessuna cache che
  // possa diventare stale se firstPlayer viene cambiato direttamente).
  Game.prototype._seatOrder = function () {
    var s = this.state;
    var seats = SEAT_CW.filter(function (id) { return s.players[id]; });
    var i = seats.indexOf(s.firstPlayer); if (i < 0) i = 0;
    return seats.slice(i).concat(seats.slice(0, i));
  };
  Game.prototype._computeOrder = function () { this.state.playerOrder = this._seatOrder(); };
  Game.prototype._moveOrder = function () { return this._seatOrder(); };
  Game.prototype._attackOrder = function () { var o = this._seatOrder(); return this.state.turnMode === '1212' ? o : o.reverse(); };
  Game.prototype._nextInOrder = function (order, id) { var i = order.indexOf(id); return (i >= 0 && i < order.length - 1) ? order[i + 1] : null; };
  Game.prototype._others = function (id) { return this._seatOrder().filter(function (p) { return p !== id; }); };
  // Prossimo seggio in senso orario (per passare il segnalino 1° Pilota a fine ROUND).
  Game.prototype._nextSeatCW = function (id) {
    var s = this.state, seats = SEAT_CW.filter(function (p) { return s.players[p]; });
    var i = seats.indexOf(id); return seats[(i + 1) % seats.length];
  };
  // Lista dei giocatori nell'ordine dei seggi orario (per iterazioni "per tutti i giocatori").
  Game.prototype.allPlayers = function () { var s = this.state; return SEAT_CW.filter(function (p) { return s.players[p]; }); };
  // Le carte che escono dal gioco finiscono nella pila degli scarti.
  Game.prototype._discard = function (card) { if (card) this.state.discard.push(card); };
  // Le carte Oggetto che escono dal gioco (usate, scartate oltre il limite, non scelte) vanno nella pila scarti Oggetti.
  Game.prototype._discardObjectCard = function (obj) { if (obj) this.state.objectDiscard.push(obj); };
  Game.prototype.getCell = function (x, y) { return this.state.grid[x][y]; };
  // Limite di oggetti non-iniziali posseduti contemporaneamente: 4 in Ruleset A, 2 in Ruleset B.
  Game.prototype._objLimit = function () { return this.state.altMatch ? 4 : 2; };

  // Registra un'azione geometrica (movimento pedina o sparo) per l'overlay "Mostra azioni".
  Game.prototype._recordTrail = function (t, p, from, to) {
    if (!from && !to) return;
    this.state.trail.push({ t: t, p: p, from: from ? { x: from.x, y: from.y } : null, to: to ? { x: to.x, y: to.y } : null });
  };

  // Se il mazzo Oggetti è esaurito, rimescola la pila degli scarti Oggetti per riformarlo.
  Game.prototype._reshuffleObjectDiscard = function () {
    var s = this.state;
    if (s.objectDeck.length === 0 && s.objectDiscard.length) {
      s.objectDeck = Deck.shuffle(s.objectDiscard.slice(), this._rng || Math.random);
      s.objectDiscard = [];
      this._log('Mazzo Oggetti esaurito: ' + s.objectDeck.length + ' scarti Oggetti rimescolati.');
    }
  };
  // Pesca una carta Oggetto dal mazzo, rimescolando gli scarti Oggetti se il mazzo è vuoto. null se non ce ne sono.
  Game.prototype._drawObjectCard = function () {
    var s = this.state;
    if (s.objectDeck.length === 0) this._reshuffleObjectDiscard();
    return s.objectDeck.length ? s.objectDeck.shift() : null;
  };

  // Se il mazzo è esaurito, rimescola gli scarti per formare un nuovo mazzo (§ regola reshuffle).
  Game.prototype._reshuffleDiscardIntoDeck = function () {
    var s = this.state;
    if (s.deck.length === 0 && s.discard.length) {
      s.deck = Deck.shuffle(s.discard.slice(), this._rng || Math.random);
      s.discard = [];
      this._log('Mazzo esaurito: ' + s.deck.length + ' scarti rimescolati in un nuovo mazzo.');
    }
  };
  // Pesca una carta dal mazzo, rimescolando gli scarti se il mazzo è vuoto. Ritorna null se non ci sono carte.
  Game.prototype._drawCard = function () {
    var s = this.state;
    if (s.deck.length === 0) this._reshuffleDiscardIntoDeck();
    return s.deck.length ? s.deck.shift() : null;
  };

  Game.prototype.pawnCell = function (id) {
    var g = this.state.grid, n = this.state.gridSize;
    for (var x = 1; x <= n; x++) for (var y = 1; y <= n; y++) if (g[x][y].pawn === id) return g[x][y];
    return null;
  };
  Game.prototype.availableRevealed = function (id) {
    var p = this.state.players[id];
    return p.hand.filter(function (c) { return p.revealedIds.indexOf(c.id) !== -1; });
  };
  // La "riserva": le carte in mano NON scelte nella fase di scelta carte. È il pool usato nei clash.
  Game.prototype.availableReserve = function (id) {
    var p = this.state.players[id];
    return p.hand.filter(function (c) { return p.revealedIds.indexOf(c.id) === -1; });
  };
  Game.prototype.belongingSuit = function (id) { return this.state.players[id].belongingSuit; };

  // Match tenendo conto dei poteri personaggio.
  // Runner (in MOVIMENTO) e Fighter (in ATTACCO): abbinano le carte PARI tra di loro
  // (una carta pari in mano abbina una casella scoperta di valore pari).
  Game.prototype._matches = function (playerId, card, cell) {
    var s = this.state, p = s.players[playerId];
    if (canMatch(card, cell, s.currentSuit, p.belongingSuit)) return true;
    if (s.modules.powers && cell && !cell.destroyed && cell.card && !cell.faceDown &&
        (card.value % 2 === 0) && (cell.card.value % 2 === 0)) {
      if (p.character === 'fighter' && s.phase === 'attack') return true;
    }
    return false;
  };

  function findCard(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function removeCard(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list.splice(i, 1)[0]; return null; }
  function nonCharObjects(p) { return p.objects.filter(function (o) { return !o.fromCharacter; }); }

  // ================================================================== DRAFT (variante griglia)
  // CELLE ancora vuote (senza carta, non distrutte) da riempire durante il draft.
  Game.prototype._draftEmptyCells = function () {
    var s = this.state, out = [];
    for (var x = 1; x <= s.gridSize; x++) for (var y = 1; y <= s.gridSize; y++) {
      var c = s.grid[x][y]; if (!c.destroyed && !c.card) out.push(c);
    }
    return out;
  };
  // Inizia il turno di draft del PILOTA attivo: pesca 4 carte, deve piazzarne 2 (1 se resta 1 sola CELLA).
  Game.prototype._beginDraftTurn = function () {
    var s = this.state;
    var empty = this._draftEmptyCells();
    if (empty.length === 0) { this._finishDraft(); return; }
    var drawn = [];
    for (var i = 0; i < 4; i++) { var c = this._drawCard(); if (c) drawn.push(c); }
    s.phase = 'draft';
    s.subPhase = 'draft-select';
    s.pendingDraft = { playerId: s.activePlayer, drawn: drawn, chosen: null, placed: 0, need: Math.min(2, empty.length) };
  };
  // Le 4 carte pescate nel turno di draft corrente.
  Game.prototype.draftDrawn = function () {
    var s = this.state, pd = s.pendingDraft;
    return (pd && (s.subPhase === 'draft-select' || s.subPhase === 'draft-place')) ? pd.drawn.slice() : [];
  };
  // Sceglie quale carta piazzare (poi si clicca la CELLA vuota di destinazione).
  Game.prototype.draftSelectCard = function (cardId) {
    var s = this.state, pd = s.pendingDraft;
    if (s.subPhase !== 'draft-select' || !pd) throw new Error('Nessun draft in corso.');
    var card = pd.drawn.filter(function (c) { return c.id === cardId; })[0];
    if (!card) throw new Error('Carta non valida.');
    pd.chosen = card;
    s.subPhase = 'draft-place';
  };
  // CELLE bersaglio del draft: tutte quelle ancora vuote.
  Game.prototype.draftTargets = function () {
    var s = this.state, out = [];
    if (s.subPhase !== 'draft-place' || !s.pendingDraft) return out;
    for (var x = 1; x <= s.gridSize; x++) for (var y = 1; y <= s.gridSize; y++) {
      var c = s.grid[x][y]; if (!c.destroyed && !c.card) out.push({ x: x, y: y, key: cellKey(x, y) });
    }
    return out;
  };
  // Posiziona la carta scelta sulla CELLA vuota indicata.
  Game.prototype.draftPlace = function (x, y) {
    var s = this.state, pd = s.pendingDraft;
    if (s.subPhase !== 'draft-place' || !pd) throw new Error('Nessun draft in corso.');
    if (!this.draftTargets().some(function (o) { return o.x === x && o.y === y; })) throw new Error('CELLA non valida (serve una CELLA vuota).');
    var c = s.grid[x][y];
    c.card = pd.chosen; c.faceDown = false; c.destroyed = false;
    pd.drawn = pd.drawn.filter(function (d) { return d.id !== pd.chosen.id; });
    pd.placed += 1;
    this._log(pd.playerId + ' piazza ' + pd.chosen.value + pd.chosen.suit[0].toUpperCase() + ' su [' + x + ',' + y + '].');
    pd.chosen = null;
    if (pd.placed < pd.need) { s.subPhase = 'draft-select'; return; }
    // Turno concluso: le carte pescate non piazzate vanno negli scarti, poi tocca al PILOTA successivo (orario).
    pd.drawn.forEach(function (d) { s.discard.push(d); });
    s.pendingDraft = null; s.subPhase = null;
    var order = this._seatOrder(), oi = order.indexOf(s.activePlayer);
    s.activePlayer = order[(oi + 1) % order.length];
    this._beginDraftTurn();
  };
  // Fine del draft: si rimescolano gli scarti nel mazzo, si pescano le mani e comincia il ROUND 1.
  Game.prototype._finishDraft = function () {
    var s = this.state;
    s.deck = Deck.shuffle(s.deck.concat(s.discard), this._rng || Math.random);
    s.discard = [];
    this._log('Draft completato: griglia pronta, mazzo rimescolato (' + s.deck.length + ' carte).');
    var self = this;
    for (var d = 0; d < 6; d++) this.allPlayers().forEach(function (id) { var c = self._drawCard(); if (c) s.players[id].hand.push(c); });
    s.pendingDraft = null; s.subPhase = null;
    s.activePlayer = s.firstPlayer;
    this._beginSelectPhase();
  };

  // ================================================================== SELECT
  Game.prototype._beginSelectPhase = function () {
    var s = this.state;
    s.phase = 'select'; s.subPhase = null;
    this._computeOrder(); // aggiorna l'ordine di gioco (per la UI) in base al 1° Pilota corrente
    s.selected = {}; s.selectObjectUsed = {};
    this.allPlayers().forEach(function (id) { s.selected[id] = null; s.selectObjectUsed[id] = false; });
    s.activePlayer = s.firstPlayer;
    // Nessuna "finestra oggetto": gli oggetti si usano dal pannello sotto la mano,
    // durante la propria selezione segreta e prima di confermare le 3 carte.
  };

  Game.prototype.selectCount = function (id) { return Math.min(3, this.state.players[id].hand.length); };

  Game.prototype.selectCards = function (id, ids) {
    var s = this.state;
    if (s.phase !== 'select' || s.subPhase) throw new Error('Non è il momento di scegliere le carte.');
    var need = this.selectCount(id);
    if (!ids || ids.length !== need) throw new Error('Devi scegliere ' + need + ' carte.');
    var p = s.players[id];
    for (var i = 0; i < ids.length; i++) if (!findCard(p.hand, ids[i])) throw new Error('Carta non in mano: ' + ids[i]);
    s.selected[id] = ids.slice();
    if (this.allPlayers().every(function (pid) { return s.selected[pid]; })) this._reveal();
  };

  Game.prototype._reveal = function () {
    var s = this.state;
    this.allPlayers().forEach(function (id) {
      var p = s.players[id];
      p.revealedIds = s.selected[id].slice();
      // Snapshot delle 3 carte scelte (per la preview pubblica, anche dopo l'uso).
      p.revealedCards = p.revealedIds.map(function (cid) { return findCard(p.hand, cid); });
      s.selected[id] = null;
    });
    this._log('Carte rivelate. Fase movimento; inizia ' + s.firstPlayer + '.');
    this._beginMovePhase();
  };

  // ================================================================== MOVE
  Game.prototype._beginMovePhase = function () {
    this.state.phase = 'move';
    this._beginMoveSegment(this.state.firstPlayer);
  };
  Game.prototype._beginMoveSegment = function (id) {
    var s = this.state;
    s.activePlayer = id;
    s.moveModifier = null;
    s.actionsLeft = s.players[id].pendingActions.moves;
    this._promptMove();
  };
  Game.prototype._promptMove = function () {
    var s = this.state;
    if (s.actionsLeft <= 0) { this._endMoveSegment(); return; }
    s.subPhase = null; // pronto a muovere; gli oggetti move si usano dal pannello
  };
  Game.prototype._endMoveSegment = function () {
    var s = this.state;
    var next = this._nextInOrder(this._moveOrder(), s.activePlayer);
    if (next) this._beginMoveSegment(next);
    else this._beginAttackPhase();
  };
  Game.prototype._afterMoveAction = function (id) {
    var s = this.state;
    s.actionsLeft -= 1;
    s.moveModifier = null;
    this._promptMove();
  };

  // Destinazioni di movimento per `id`, considerando il modificatore attivo.
  // 'grapple' (Grappling Hook, Ruleset C) aggiunge alle destinazioni normali le caselle
  // ortogonalmente adiacenti alla pedina avversaria.
  Game.prototype._moveDestList = function (id) {
    var s = this.state, pc = this.pawnCell(id);
    if (!pc) return [];
    if (s.moveModifier === 'grapple') {
      var out = orthogonalNeighbors(pc.x, pc.y, s.gridSize).slice(), seen = {};
      out.forEach(function (d) { seen[d[0] + ',' + d[1]] = true; });
      var self = this;
      // Arpione: aggiunge le CELLE ORTOGONALI a QUALSIASI ARM avversario.
      this._others(id).forEach(function (oid) {
        var opp = self.pawnCell(oid);
        if (!opp) return;
        orthogonalNeighbors(opp.x, opp.y, s.gridSize).forEach(function (d) {
          var k = d[0] + ',' + d[1];
          if (!seen[k] && !(d[0] === pc.x && d[1] === pc.y)) { seen[k] = true; out.push(d); }
        });
      });
      return out;
    }
    return moveDestinations(pc.x, pc.y, s.moveModifier, s.gridSize);
  };
  // Esposto per UI/CPU (evidenziazione abbinamenti con il modificatore corrente).
  Game.prototype.moveDestinationsFor = function (id) { return this._moveDestList(id); };

  Game.prototype.legalMoves = function (id) {
    var s = this.state;
    var pc = this.pawnCell(id);
    if (!pc) return [];
    var revealed = this.availableRevealed(id);
    var self = this;
    var out = [];
    var dests = this._moveDestList(id);
    for (var i = 0; i < dests.length; i++) {
      var cell = s.grid[dests[i][0]][dests[i][1]];
      var okIds = [];
      for (var j = 0; j < revealed.length; j++) if (self._matches(id, revealed[j], cell)) okIds.push(revealed[j].id);
      if (okIds.length) out.push({ x: cell.x, y: cell.y, key: cellKey(cell.x, cell.y), cardIds: okIds, occupied: !!cell.pawn && cell.pawn !== id });
    }
    return out;
  };

  Game.prototype.move = function (id, x, y, cardId) {
    var s = this.state;
    this._assertAction('move', id);
    var pc = this.pawnCell(id);
    var dest = s.grid[x][y];
    var legal = this._moveDestList(id).some(function (d) { return d[0] === x && d[1] === y; });
    if (!legal) throw new Error('Casella non raggiungibile con questo movimento.');
    var card = findCard(this.availableRevealed(id), cardId);
    if (!card || !this._matches(id, card, dest)) throw new Error('Carta non valida per questa casella.');
    removeCard(s.players[id].hand, cardId);
    this._markActed(id); s.players[id].stats.moves += 1;

    if (dest.pawn && dest.pawn !== id) {
      var defId = dest.pawn;
      s.subPhase = 'clash-cards';
      s.pendingClash = { attackerId: id, defenderId: defId, x: x, y: y, moveCard: card,
                         attackerCardId: null, defenderCardId: null, whoChooses: id };
      this._log(id + ' attacca ' + defId + ' su [' + x + ',' + y + '] → clash.');
      this._clashAdvanceAuto(); // chi non ha carte disponibili non contesta (perde di default)
      return { type: 'clash' };
    }

    var info = this._applyArrival(id, dest, card);
    this._chain = [this._step_afterMove(id)];
    if (info.figureEliminated) this._postFigureDraw(id);
    if (info.centerObject || info.targetObject || info.bonusObject) this._chain.unshift(this._step_altObject(id));
    if (info.runnerFigure) this._chain.unshift(this._step_runnerFigure(id, info.runnerFigure.x, info.runnerFigure.y));
    this._advanceChain();
    return { type: 'moved' };
  };

  Game.prototype.passMove = function (id) {
    this._assertAction('move', id);
    this._log(id + ' non muove (passa).');
    this._afterMoveAction(id);
  };

  // Raggiungimento della riga avversaria (movimento volontario).
  // A/B: +5 e fine partita a fine round. C: nessun effetto (la riga avversaria non conta).
  Game.prototype._applyTargetRow = function (id) {
    var s = this.state, p = s.players[id];
    if (s.ruleset === 'C') {
      this._log(id + ' raggiunge la riga avversaria (nessun effetto).');
      return false;
    }
    p.score += 5; s.endTriggered = true;
    this._log(id + ' raggiunge la RIGA-BERSAGLIO: +5. Fine partita a fine round.');
    return false;
  };
  // Ruleset C: la prima pedina che entra in una cella bonus ottiene una scelta oggetto (una tantum
  // per cella). Segna la cella come "riscossa". Ritorna true se ha aperto la scelta oggetto.
  Game.prototype._maybeBonusObject = function (cell) {
    var s = this.state;
    if (s.ruleset !== 'C' || !s.modules.objects) return false;
    if (!isPositionBonusCell(cell.x, cell.y, s.gridSize) || cell.bonusTaken) return false;
    cell.bonusTaken = true;
    this._log('Cella bonus [' + cell.x + ',' + cell.y + ']: scelta oggetto.');
    return true;
  };

  // Effetti d'arrivo (movimento VOLONTARIO). Ritorna {figureEliminated}.
  Game.prototype._applyArrival = function (id, cell, moveCard) {
    var s = this.state, p = s.players[id];
    var from = this.pawnCell(id); if (from) from.pawn = null;
    this._recordTrail('move', id, from, cell);
    var figureEliminated = false, runnerFigure = false, targetObject = false, centerObject = false, bonusObject = false;

    // moveCard può essere null (potere brawler: le 3 carte sono già state scartate → nessun trophy).
    if (cell.faceDown) {
      cell.pawn = id;
      bonusObject = this._maybeBonusObject(cell); // Ruleset C: cella bonus (anche se coperta)
      if (isTargetCell(id, cell, s.gridSize)) targetObject = this._applyTargetRow(id);
      else if (!bonusObject) this._log(id + ' entra su [' + cell.x + ',' + cell.y + '] (carta coperta, nessun punto).');
      if (moveCard) this._discard(moveCard);
      return { figureEliminated: false, targetObject: targetObject, bonusObject: bonusObject };
    }
    var gotTrophy = false;
    if (isCenter(cell.x, cell.y, s.gridSize)) {
      var centerPts = (s.ruleset === 'C') ? 0 : 5;
      if (centerPts) this._addScore(id, centerPts, 'ptsBonus');
      p.matchedCenter = true; if (moveCard) p.trophies.push(moveCard); cell.faceDown = true; gotTrophy = true;
      // Ruleset A: conquistare il centro dà la scelta di 1 oggetto (in C la gestisce la logica "cella bonus").
      if (s.altMatch && s.ruleset !== 'C' && s.modules.objects) centerObject = true;
      this._log(id + ' conquista il CENTRO' + (centerPts ? ': +' + centerPts + ' (una tantum)' : ' (nessun punto)') + (centerObject ? ', scelta oggetto.' : '.'));
    } else {
      if (Deck.isFigure(cell.card)) {
        if (s.altMatch) {
          // Abbinamento alternativo: muovere su una figura NON la elimina. Passiva runner: può colpirla
          // scartando 1 carta scelta extra (offerta come sotto-fase se ha usi e una carta disponibile).
          if (s.modules.powers && p.character === 'runner' && p.runnerLeft > 0 && this.availableRevealed(id).length >= 1) {
            runnerFigure = { x: cell.x, y: cell.y };
            this._log(id + ' muove sulla figura ' + cell.card.value + ' su [' + cell.x + ',' + cell.y + '] (runner: può colpirla).');
          } else {
            this._log(id + ' muove sulla figura ' + cell.card.value + ' su [' + cell.x + ',' + cell.y + '] (nessun effetto).');
          }
        } else {
          var pts = Deck.figurePoints(cell.card);
          this._addScore(id, pts, 'ptsFigure'); p.figuresMatched += 1; if (moveCard) p.trophies.push(moveCard); cell.faceDown = true; gotTrophy = true; figureEliminated = true;
          this._log(id + ' abbina la figura ' + cell.card.value + ' su [' + cell.x + ',' + cell.y + ']: +' + pts + '.');
        }
      }
      if (isTargetCell(id, cell, s.gridSize)) targetObject = this._applyTargetRow(id);
    }
    cell.pawn = id;
    // Ruleset C: scelta oggetto entrando in una cella bonus non ancora riscossa (centro incluso).
    bonusObject = this._maybeBonusObject(cell);
    if (!gotTrophy && !isCenter(cell.x, cell.y, s.gridSize) && !isTargetCell(id, cell, s.gridSize) && !bonusObject) this._log(id + ' muove su [' + cell.x + ',' + cell.y + '].');
    if (!gotTrophy && moveCard) this._discard(moveCard); // carte non-trophy → scarti
    return { figureEliminated: figureEliminated, centerObject: centerObject, targetObject: targetObject, bonusObject: bonusObject, runnerFigure: runnerFigure };
  };

  // ================================================================== CLASH
  // Nel clash si sceglie tra le carte della RISERVA (le carte NON scelte nella fase di scelta carte).
  Game.prototype.clashChoices = function (id) { return this.state.pendingClash ? this.availableReserve(id) : []; };
  Game.prototype.clashCurrentChooser = function () { return this.state.pendingClash ? this.state.pendingClash.whoChooses : null; };

  Game.prototype.clashChoose = function (id, cardId) {
    var s = this.state, pc = s.pendingClash;
    if (!pc || s.subPhase !== 'clash-cards') throw new Error('Nessun clash in corso.');
    if (pc.whoChooses !== id) throw new Error('Non è il turno di ' + id + ' nel clash.');
    if (!findCard(this.availableReserve(id), cardId)) throw new Error('Carta non disponibile.');
    if (id === pc.attackerId) { pc.attackerCardId = cardId; pc.whoChooses = pc.defenderId; }
    else { pc.defenderCardId = cardId; pc.whoChooses = null; }
    this._clashAdvanceAuto();
  };

  // Assegna automaticamente "nessuna carta" a chi, nel clash, non ha carte di riserva disponibili:
  // non contesta e perde di default. Risolve quando entrambe le scelte ci sono.
  Game.prototype._clashAdvanceAuto = function () {
    var s = this.state, pc = s.pendingClash;
    if (!pc || s.subPhase !== 'clash-cards') return;
    while (pc.whoChooses) {
      var chooser = pc.whoChooses;
      if (this.availableReserve(chooser).length > 0) break; // serve una scelta reale: lascia il prompt
      if (chooser === pc.attackerId) { pc.attackerCardId = 'none'; pc.whoChooses = pc.defenderId; }
      else { pc.defenderCardId = 'none'; pc.whoChooses = null; }
      this._log(chooser + ' non ha carte disponibili per il clash: non contesta.');
    }
    if (pc.attackerCardId && pc.defenderCardId) this._resolveClash();
  };

  Game.prototype._resolveClash = function () {
    var s = this.state, pc = s.pendingClash;
    var attCard = pc.attackerCardId === 'none' ? null : removeCard(s.players[pc.attackerId].hand, pc.attackerCardId);
    var defCard = pc.defenderCardId === 'none' ? null : removeCard(s.players[pc.defenderId].hand, pc.defenderCardId);
    if (attCard) this._discard(attCard);
    if (defCard) this._discard(defCard); // le carte del clash vanno agli scarti
    // Chi non ha giocato una carta perde il clash; se entrambi senza carta è parità piena.
    var outcome;
    if (!attCard && !defCard) outcome = 'tie';
    else if (!attCard) outcome = 'defender';
    else if (!defCard) outcome = 'attacker';
    else outcome = resolveClash(attCard, defCard);
    // Log del clash: "N: 7O x S: 8B - Vince il clash B" (semi: O=Ori, B=Bastoni, C=Coppe, S=Spade).
    function lbl(c) { return c ? (c.value + c.suit[0].toUpperCase()) : '—'; }
    var nCard = pc.attackerId === 'N' ? attCard : defCard;
    var sCard = pc.attackerId === 'N' ? defCard : attCard;
    var winnerCard = outcome === 'attacker' ? attCard : (outcome === 'defender' ? defCard : null);
    var resTxt = (outcome === 'tie') ? 'Pareggio' : ('Vince il clash ' + winnerCard.suit[0].toUpperCase());
    this._log('N: ' + lbl(nCard) + ' x S: ' + lbl(sCard) + ' - ' + resTxt);
    // Risultato del clash per la UI (finestra di confronto). Fuori dallo stato: non entra negli snapshot.
    this._clashResult = {
      token: (this._clashToken = (this._clashToken || 0) + 1),
      attackerId: pc.attackerId, defenderId: pc.defenderId,
      attCard: attCard ? { value: attCard.value, suit: attCard.suit } : null,
      defCard: defCard ? { value: defCard.value, suit: defCard.suit } : null,
      outcome: outcome
    };
    var self = this, dest = s.grid[pc.x][pc.y], attackerId = pc.attackerId;

    // Bonus vittoria clash: +CLASH_WIN_BONUS SOLO se vince l'ATTACCANTE (difensore e pareggio: niente).
    if (outcome === 'attacker') {
      this._addScore(pc.attackerId, CLASH_WIN_BONUS, 'ptsPawn');
      this._log(pc.attackerId + ' vince il clash: +' + CLASH_WIN_BONUS + '.');
    }

    // ---- Clash da ATTACCO (regola opzionale "Clash su Attacco"). ----
    if (pc.isAttack) {
      var attMod = pc.attackMod;
      s.pendingClash = null; s.subPhase = null;
      if (outcome === 'attacker') {
        // L'attaccante vince: il colpo si risolve normalmente (figura girata, punti figura, scelta
        // oggetto, effetti di homing/hook), senza i +5 pedina (già sostituiti dal +3 del clash). Nessuno spostamento di clash.
        this._resolveShotEffects(attackerId, dest, pc.moveCard, attMod, true);
      } else {
        // Difensore vince o pareggio: colpo parato, nessun effetto; la carta di attacco va agli scarti.
        this._discard(pc.moveCard);
        this._afterAttackAction(attackerId);
      }
      return;
    }

    // ---- Clash da MOVIMENTO ----
    // Esci dalla sotto-fase 'clash-cards' PRIMA di avviare la catena post-clash: altrimenti, se la
    // ricollocazione del difensore non ha destinazioni valide, _advanceChain vedrebbe ancora
    // subPhase='clash-cards' e si fermerebbe senza chiudere il clash (softlock). pendingClash resta
    // per il passo di ricollocazione.
    s.subPhase = null;
    // Pareggio o vittoria del difensore: nessuno si sposta (l'attaccante non arriva).
    if (outcome === 'tie' || outcome === 'defender') {
      this._discard(pc.moveCard);
      this._chain = [this._step_finishClashMove(attackerId)];
      this._advanceChain();
      return;
    }
    // Vittoria dell'attaccante: il difensore va spostato su una CELLA ORTOGONALE alla cella conquistata.
    // Se NON esiste alcuna destinazione valida, l'attaccante vince comunque (+3) ma NON avanza (nessuno
    // si sposta): così non si sovrascrive/perde la pedina del difensore (coerente con la DISTRUZIONE bloccata).
    if (this._relocationOptions(pc.x, pc.y).length === 0) {
      this._discard(pc.moveCard);
      this._log(attackerId + ' vince il clash ma non c\'è dove spostare il difensore: nessuno avanza.');
      this._chain = [this._step_finishClashMove(attackerId)];
      this._advanceChain();
      return;
    }
    // Arriva sulla cella; è l'ATTACCANTE a scegliere dove spostare il difensore.
    var info = this._applyArrival(pc.attackerId, dest, pc.moveCard);
    this._chain = [
      this._step_openReloc(pc.attackerId, pc.defenderId, { x: pc.x, y: pc.y }, false),
      this._step_finishClashMove(attackerId)
    ];
    if (info.figureEliminated) this._postFigureDraw(pc.attackerId);
    if (info.centerObject || info.targetObject || info.bonusObject) this._chain.unshift(this._step_altObject(pc.attackerId));
    if (info.runnerFigure) this._chain.unshift(this._step_runnerFigure(pc.attackerId, info.runnerFigure.x, info.runnerFigure.y));
    this._advanceChain();
  };

  // Passo: apre una ricollocazione da clash (obbligatoria o facoltativa).
  Game.prototype._step_openReloc = function (relocatorId, relocateePawn, from, optional) {
    var self = this;
    return function () {
      var opts = self._relocationOptions(from.x, from.y);
      if (opts.length === 0) { if (!optional) self._log('Nessuna ricollocazione possibile: la pedina resta ferma.'); return; }
      self.state.subPhase = 'clash-reloc';
      self.state.pendingClash.relocatorId = relocatorId;
      self.state.pendingClash.relocateePawn = relocateePawn;
      self.state.pendingClash.relocateFrom = from;
      self.state.pendingClash.relocateOptional = optional;
    };
  };
  Game.prototype._step_finishClashMove = function (attackerId) {
    var self = this;
    return function () { self.state.pendingClash = null; self.state.subPhase = null; self._afterMoveAction(attackerId); };
  };

  // Destinazioni di uno spostamento forzato: escluse centro/occupate/distrutte.
  // diag=true aggiunge le diagonali (usato dall'hook, che sposta in tutte le direzioni).
  Game.prototype._relocOptions = function (x, y, diag) {
    var s = this.state, out = [], nb = orthogonalNeighbors(x, y, s.gridSize);
    if (diag) nb = nb.concat(diagonalNeighbors(x, y, s.gridSize));
    for (var i = 0; i < nb.length; i++) {
      var cx = nb[i][0], cy = nb[i][1], cell = s.grid[cx][cy];
      if (isCenter(cx, cy, s.gridSize) || cell.pawn || cell.destroyed) continue;
      out.push({ x: cx, y: cy, key: cellKey(cx, cy) });
    }
    return out;
  };
  Game.prototype._relocationOptions = function (x, y) { return this._relocOptions(x, y, false); };
  // Lo spostamento con hook è a 8 direzioni; clash/homing restano ortogonali.
  Game.prototype.relocationOptions = function () {
    var s = this.state;
    if (s.subPhase === 'clash-reloc' && s.pendingClash) return this._relocOptions(s.pendingClash.relocateFrom.x, s.pendingClash.relocateFrom.y, false);
    if (s.subPhase === 'forced-reloc' && s.pendingForced) return this._relocOptions(s.pendingForced.from.x, s.pendingForced.from.y, s.pendingForced.kind === 'hook');
    return [];
  };

  Game.prototype.clashRelocate = function (x, y) {
    var s = this.state, pc = s.pendingClash;
    if (!pc || s.subPhase !== 'clash-reloc') throw new Error('Nessuna ricollocazione da clash in corso.');
    if (!this._relocationOptions(pc.relocateFrom.x, pc.relocateFrom.y).some(function (o) { return o.x === x && o.y === y; })) throw new Error('Destinazione non valida.');
    this._forcedMove(pc.relocateePawn, x, y);
    s.subPhase = null;
    this._advanceChain();
  };
  Game.prototype.clashSkipRelocate = function () {
    var s = this.state, pc = s.pendingClash;
    if (!pc || s.subPhase !== 'clash-reloc') throw new Error('Nessuna ricollocazione da clash in corso.');
    if (!pc.relocateOptional) throw new Error('La ricollocazione è obbligatoria.');
    this._log(pc.relocatorId + ' non ricolloca ' + pc.relocateePawn + '.');
    s.subPhase = null;
    this._advanceChain();
  };

  Game.prototype._forcedMove = function (pawnId, x, y) {
    var s = this.state, from = this.pawnCell(pawnId); if (from) from.pawn = null;
    var cell = s.grid[x][y]; cell.pawn = pawnId; // figura NON girata, nessun punto
    this._recordTrail('move', pawnId, from, cell);
    this._log(pawnId + ' spinto su [' + x + ',' + y + '] (spostamento forzato, nessun punto).');
    // In Ruleset C la riga avversaria non termina la partita (nemmeno se raggiunta forzatamente).
    if (s.ruleset !== 'C' && isTargetCell(pawnId, cell, s.gridSize)) { s.endTriggered = true; this._log(pawnId + ' finisce sulla RIGA-BERSAGLIO (forzato): fine partita a fine round.'); }
  };

  // ================================================================== ATTACK
  // Chi attacca per primo: nella struttura '1221' (iniziativa divisa) è l'ALTRO giocatore,
  // nella '1212' è il Primo Giocatore (stesso ordine del movimento).
  Game.prototype._attackLeader = function () {
    return this._attackOrder()[0];
  };
  Game.prototype._beginAttackPhase = function () {
    this.state.phase = 'attack';
    var attackLeader = this._attackLeader();
    this._log('Fase di attacco; inizia ' + attackLeader + '.');
    this._beginAttackSegment(attackLeader);
  };
  Game.prototype._beginAttackSegment = function (id) {
    var s = this.state;
    s.activePlayer = id; s.attackModifier = null;
    s.actionsLeft = s.players[id].pendingActions.attacks;
    this._promptAttack();
  };
  Game.prototype._promptAttack = function () {
    var s = this.state;
    if (s.actionsLeft <= 0) { this._endAttackSegment(); return; }
    s.subPhase = null; // pronto ad attaccare; gli oggetti attack si usano dal pannello
  };
  Game.prototype._endAttackSegment = function () {
    var s = this.state;
    // Ordine di attacco: G(k)→G1 in '1221', G1→G(k) in '1212'. Poi fine ROUND.
    var next = this._nextInOrder(this._attackOrder(), s.activePlayer);
    if (next) this._beginAttackSegment(next);
    else this._endRound();
  };
  Game.prototype._afterAttackAction = function (id) {
    var s = this.state;
    s.actionsLeft -= 1; s.attackModifier = null;
    this._promptAttack();
  };
  // Chiude un'azione consumata da un TOOL utilizzabile sia in MOVIMENTO sia in ATTACCO (es. randomizer).
  Game.prototype._afterActionObject = function (id) {
    if (this.state.phase === 'move') this._afterMoveAction(id);
    else this._afterAttackAction(id);
  };

  Game.prototype.legalShots = function (id) {
    var s = this.state, n = s.gridSize, revealed = this.availableRevealed(id), self = this, out = [];
    for (var x = 1; x <= n; x++) for (var y = 1; y <= n; y++) {
      var cell = s.grid[x][y], okIds = [];
      for (var j = 0; j < revealed.length; j++) if (self._matches(id, revealed[j], cell)) okIds.push(revealed[j].id);
      if (okIds.length) out.push({ x: x, y: y, key: cellKey(x, y), cardIds: okIds });
    }
    return out;
  };

  Game.prototype.shoot = function (id, x, y, cardId) {
    var s = this.state;
    this._assertAction('attack', id);
    var cell = s.grid[x][y];
    var card = findCard(this.availableRevealed(id), cardId);
    if (!card || !this._matches(id, card, cell)) throw new Error('Carta non valida per l\'attacco.');
    removeCard(s.players[id].hand, cardId);
    this._markActed(id); s.players[id].stats.attacks += 1;
    this._recordTrail('shot', id, this.pawnCell(id), cell);
    var mod = s.attackModifier;

    // Regola "Clash su Attacco": colpire una cella con la pedina avversaria apre un clash — anche con
    // homing/hook armati. Se vince l'attaccante il colpo si risolve normalmente (+3 al posto dei +5
    // pedina, più gli effetti su figura/oggetto/modificatore); se perde o pareggia il colpo è parato.
    if (s.clashOnAttack && cell.pawn && cell.pawn !== id) {
      var defA = cell.pawn;
      s.subPhase = 'clash-cards';
      s.pendingClash = { attackerId: id, defenderId: defA, x: x, y: y, moveCard: card, isAttack: true, attackMod: mod,
                         attackerCardId: null, defenderCardId: null, whoChooses: id };
      this._log(id + ' attacca la pedina di ' + defA + ' su [' + x + ',' + y + '] → clash.');
      this._clashAdvanceAuto();
      return { type: 'clash' };
    }

    this._resolveShotEffects(id, cell, card, mod, false);
  };

  // Risolve gli effetti di un colpo (figura, oggetto pescato/scelto, modificatore homing/hook) e
  // costruisce la catena post-attacco. skipPawnBonus salta i +5 per la pedina (usato dal clash da attacco).
  Game.prototype._resolveShotEffects = function (id, cell, card, mod, skipPawnBonus) {
    var info = this._applyShot(id, cell, card, mod === 'homing', skipPawnBonus);
    var chain = [];
    if (mod === 'homing') chain.push(this._step_homing(id, cell));
    else if (mod === 'hook' && info.hitOpponentPawn) chain.push(this._step_hook(id, cell));
    if (info.altFigureObject) chain.push(this._step_altObject(id));
    else if (info.figureEliminated && this._drawObject(id) === 'over') chain.push(this._step_openDiscard(id));
    chain.push(this._step_afterAttack(id));
    this._chain = chain;
    this._advanceChain();
  };

  Game.prototype.passShoot = function (id) {
    this._assertAction('attack', id);
    this._log(id + ' non attacca (passa).');
    this._afterAttackAction(id);
  };

  // Applica lo sparo base. Ritorna {figureEliminated, hitOpponentPawn}.
  // skipPawnBonus: non aggiunge i +5 per la pedina avversaria (usato quando il colpo passa da un
  // clash da attacco, che assegna già il proprio bonus di +3 al vincitore).
  Game.prototype._applyShot = function (id, cell, shootCard, isHoming, skipPawnBonus) {
    var p = this.state.players[id];
    var oppOnCell = cell.pawn && cell.pawn !== id;
    var pawnPts = (oppOnCell && !skipPawnBonus) ? 5 : 0;
    if (cell.faceDown || cell.destroyed || !cell.card) {
      if (pawnPts) { this._addScore(id, pawnPts, 'ptsPawn'); this._log(id + ' colpisce la pedina avversaria (carta coperta): +5.'); }
      if (shootCard) this._discard(shootCard);
      return { figureEliminated: false, hitOpponentPawn: oppOnCell && !cell.destroyed };
    }
    // Abbinamento alternativo (Ruleset A): attaccare gira SEMPRE la carta a faccia in giù.
    // Su una figura (senza homing): punti della figura + 1 trofeo, poi scelta di 1 oggetto su 3.
    if (this.state.altMatch && !isHoming) {
      var isFigA = Deck.isFigure(cell.card);
      var trophyA = false;
      this._addScore(id, pawnPts, 'ptsPawn');
      if (isFigA) {
        this._addScore(id, Deck.figurePoints(cell.card), 'ptsFigure');
        p.figuresMatched += 1;
        if (shootCard) { p.trophies.push(shootCard); trophyA = true; }
      }
      cell.faceDown = true;
      if (isFigA) this._log(id + ' colpisce la figura ' + cell.card.value + ' su [' + cell.x + ',' + cell.y + ']: +' + Deck.figurePoints(cell.card) + (pawnPts ? ' +5 pedina' : '') + ', 1 trofeo, scelta oggetto.');
      else if (pawnPts) this._log(id + ' colpisce la pedina avversaria su [' + cell.x + ',' + cell.y + ']: +5 (carta girata a faccia in giù).');
      else this._log(id + ' spara su [' + cell.x + ',' + cell.y + ']: carta girata a faccia in giù.');
      if (!trophyA && shootCard) this._discard(shootCard);
      return { figureEliminated: false, hitOpponentPawn: oppOnCell, altFigureObject: isFigA };
    }
    var trophy = false, figureEliminated = false;
    this._addScore(id, pawnPts, 'ptsPawn');
    if (Deck.isFigure(cell.card)) {
      var pts = Deck.figurePoints(cell.card);
      this._addScore(id, pts, 'ptsFigure'); p.figuresMatched += 1; if (shootCard) p.trophies.push(shootCard); cell.faceDown = true; trophy = shootCard ? true : false; figureEliminated = true;
    }
    if (pawnPts && trophy) this._log(id + ' DOUBLE KILL su [' + cell.x + ',' + cell.y + ']: +5 pedina e +' + Deck.figurePoints(cell.card) + ' figura.');
    else if (pawnPts) this._log(id + ' colpisce la pedina avversaria su [' + cell.x + ',' + cell.y + ']: +5.');
    else if (trophy) this._log(id + ' colpisce la figura ' + cell.card.value + ' su [' + cell.x + ',' + cell.y + ']: +' + Deck.figurePoints(cell.card) + '.');
    else this._log(id + ' spara su [' + cell.x + ',' + cell.y + ']: nessun effetto.');
    if (!trophy) this._discard(shootCard); // carta di sparo non-trophy → scarti
    return { figureEliminated: figureEliminated, hitOpponentPawn: oppOnCell };
  };

  // Passo homing: distrugge la cella e ricolloca l'eventuale pedina (il proprietario sceglie).
  Game.prototype._step_homing = function (id, cell) {
    var self = this;
    return function () {
      var hadPawn = cell.pawn;
      // Regola: una cella con una pedina non può essere distrutta se non ci sono celle libere
      // ortogonali dove ricollocare la pedina (altrimenti resterebbe senza casella).
      if (hadPawn && self._relocationOptions(cell.x, cell.y).length === 0) {
        self._log(id + ' HOMING MISSILE: la cella [' + cell.x + ',' + cell.y + '] non è distrutta (pedina senza celle libere adiacenti).');
        return;
      }
      cell.card = null; cell.faceDown = false; cell.destroyed = true;
      self._log(id + ' HOMING MISSILE: distrugge la cella [' + cell.x + ',' + cell.y + '].');
      if (hadPawn) {
        // Homing: è il TIRATORE a decidere dove spostare la pedina avversaria colpita.
        var opts = self._relocationOptions(cell.x, cell.y);
        if (opts.length) {
          self.state.subPhase = 'forced-reloc';
          self.state.pendingForced = { kind: 'homing', pawnId: hadPawn, chooserId: id, from: { x: cell.x, y: cell.y }, optional: false };
        }
      }
    };
  };
  // Passo hook: il tiratore può spostare la pedina avversaria colpita.
  Game.prototype._step_hook = function (id, cell) {
    var self = this;
    return function () {
      if (!(cell.pawn && cell.pawn !== id)) return;
      var opts = self._relocOptions(cell.x, cell.y, true); // hook: 8 direzioni
      if (!opts.length) return;
      self.state.subPhase = 'forced-reloc';
      self.state.pendingForced = { kind: 'hook', pawnId: cell.pawn, chooserId: id, from: { x: cell.x, y: cell.y }, optional: true };
    };
  };

  Game.prototype.forcedRelocate = function (x, y) {
    var s = this.state, pf = s.pendingForced;
    if (!pf || s.subPhase !== 'forced-reloc') throw new Error('Nessuno spostamento forzato in corso.');
    if (!this._relocOptions(pf.from.x, pf.from.y, pf.kind === 'hook').some(function (o) { return o.x === x && o.y === y; })) throw new Error('Destinazione non valida.');
    this._forcedMove(pf.pawnId, x, y);
    s.pendingForced = null; s.subPhase = null;
    this._advanceChain();
  };
  Game.prototype.forcedRelocateSkip = function () {
    var s = this.state, pf = s.pendingForced;
    if (!pf || s.subPhase !== 'forced-reloc') throw new Error('Nessuno spostamento forzato in corso.');
    if (!pf.optional) throw new Error('Lo spostamento è obbligatorio.');
    this._log((pf.chooserId) + ' rinuncia allo spostamento con hook.');
    s.pendingForced = null; s.subPhase = null;
    this._advanceChain();
  };

  // ================================================================== OGGETTI
  /**
   * Oggetti che il giocatore può usare ADESSO (senza finestre): dal pannello sotto la mano,
   * durante la fase legata all'oggetto e prima di eseguire/confermare l'azione.
   * - select: prima di confermare le 3 carte (max 1 oggetto select per round); timebomb solo in rotazione.
   * - move:   è il tuo turno di movimento, con azioni disponibili e nessun modificatore già armato.
   * - attack: idem per l'attacco.
   */
  // Fasi in cui un oggetto è utilizzabile (alcuni oggetti "energetici" valgono sia in movimento sia in attacco).
  function objPhases(o) { var d = Objects.def(o.type); return (d && d.phases) ? d.phases : [o.phase]; }
  function objInPhase(o, phase) { return objPhases(o).indexOf(phase) !== -1; }

  // Può pagare il costo extra di jetpack/jump? Serve almeno 2 carte SCELTE disponibili
  // (una da scartare come costo + almeno una per il movimento).
  Game.prototype._canPayToolCost = function (playerId) {
    return this.availableRevealed(playerId).length >= 2;
  };
  // Costo di jetpack/jump: il giocatore SCEGLIE quale carta scelta scartare (sotto-fase 'tool-discard').
  Game.prototype._openToolDiscard = function (playerId, modifier) {
    this.state.subPhase = 'tool-discard';
    this.state.pendingToolDiscard = { playerId: playerId, modifier: modifier };
  };
  Game.prototype.toolDiscardOptions = function () {
    var s = this.state, pt = s.pendingToolDiscard;
    return (s.subPhase === 'tool-discard' && pt) ? this.availableRevealed(pt.playerId) : [];
  };
  Game.prototype.toolDiscardChoose = function (cardId) {
    var s = this.state, pt = s.pendingToolDiscard;
    if (s.subPhase !== 'tool-discard' || !pt) throw new Error('Nessuno scarto (costo oggetto) in corso.');
    var p = s.players[pt.playerId];
    var card = findCard(this.availableRevealed(pt.playerId), cardId);
    if (!card) throw new Error('Carta non disponibile.');
    removeCard(p.hand, card.id);
    var ri = p.revealedIds.indexOf(card.id); if (ri !== -1) p.revealedIds.splice(ri, 1);
    this._discard(card);
    this._log(pt.playerId + ' scarta ' + card.value + card.suit[0].toUpperCase() + ' come costo dell\'oggetto.');
    s.moveModifier = pt.modifier; // arma jetpack/jump/grapple per il movimento
    s.pendingToolDiscard = null; s.subPhase = null;
  };

  // ---- Teleport (Ruleset C) ----
  // Destinazioni valide: carte scoperte del campo con lo stesso valore della carta su cui si trova
  // la pedina, senza la pedina avversaria (e diverse dalla cella attuale).
  Game.prototype._teleportTargetsFor = function (playerId) {
    var s = this.state, pc = this.pawnCell(playerId), out = [];
    if (!pc || !pc.card) return out;
    var val = pc.card.value;
    for (var x = 1; x <= s.gridSize; x++) for (var y = 1; y <= s.gridSize; y++) {
      var c = s.grid[x][y];
      if (c.destroyed || !c.card || c.faceDown) continue;
      if (x === pc.x && y === pc.y) continue;
      if (c.pawn && c.pawn !== playerId) continue;
      if (c.card.value === val) out.push({ x: x, y: y, key: cellKey(x, y) });
    }
    return out;
  };
  Game.prototype.teleportTargets = function () {
    var s = this.state, pt = s.pendingTeleport;
    return (s.subPhase === 'teleport-select' && pt) ? this._teleportTargetsFor(pt.playerId) : [];
  };
  Game.prototype.teleportTo = function (x, y) {
    var s = this.state, pt = s.pendingTeleport;
    if (s.subPhase !== 'teleport-select' || !pt) throw new Error('Nessun teleport in corso.');
    if (!this.teleportTargets().some(function (o) { return o.x === x && o.y === y; })) throw new Error('Destinazione teleport non valida.');
    var id = pt.playerId, from = this.pawnCell(id), dest = s.grid[x][y];
    if (from) from.pawn = null;
    dest.pawn = id;
    this._recordTrail('move', id, from, dest);
    this._log(id + ' usa Teleport: si sposta su [' + x + ',' + y + '].');
    s.pendingTeleport = null; s.subPhase = null;
    this._afterMoveAction(id); // il teleport consuma l'azione di movimento
  };

  // ---- Grappling Hook (Ruleset C) ----
  // C'è almeno una casella ortogonalmente adiacente a UN ARM avversario dove poter arrivare?
  Game.prototype._grappleHasTarget = function (playerId) {
    var s = this.state, pc = this.pawnCell(playerId), self = this;
    if (!pc) return false;
    return this._others(playerId).some(function (oid) {
      var opp = self.pawnCell(oid);
      if (!opp) return false;
      return orthogonalNeighbors(opp.x, opp.y, s.gridSize).some(function (d) {
        if (d[0] === pc.x && d[1] === pc.y) return false;
        var cell = s.grid[d[0]][d[1]];
        return !cell.destroyed && cell.card && cell.pawn !== playerId;
      });
    });
  };

  Game.prototype.usableObjects = function (playerId) {
    var s = this.state, self = this;
    if (s.gameOver || !s.modules.objects || s.subPhase) return [];
    var objs = s.players[playerId].objects;
    if (s.phase === 'select') {
      if (s.selected[playerId] != null || s.selectObjectUsed[playerId]) return [];
      return objs.filter(function (o) {
        if (!objInPhase(o, 'select')) return false;
        if (o.type === 'timebomb' && s.suitMode !== 'rotating') return false;
        if (o.type === 'encore' && !self._encoreUsable(playerId)) return false;
        return true;
      });
    }
    if (s.phase === 'move' || s.phase === 'attack') {
      var mod = s.phase === 'move' ? s.moveModifier : s.attackModifier;
      if (s.activePlayer !== playerId || s.actionsLeft <= 0) return [];
      return objs.filter(function (o) {
        if (!objInPhase(o, s.phase)) return false;
        // Un modificatore già armato (jetpack/jump/hook/homing) blocca altri oggetti-modificatore, non gli "immediati".
        if (mod && o.type !== 'energy_boost' && o.type !== 'energy_drain' && o.type !== 'remix' && o.type !== 'encore') return false;
        if ((o.type === 'jetpack' || o.type === 'jump') && !self._canPayToolCost(playerId)) return false; // serve una carta scelta extra da scartare
        if (o.type === 'grapple' && (!self._canPayToolCost(playerId) || !self._grappleHasTarget(playerId))) return false; // costo carta + bersaglio adiacente all'avversario
        if (o.type === 'teleport' && self._teleportTargetsFor(playerId).length === 0) return false; // serve almeno una carta di ugual valore
        if (o.type === 'randomizer' && s.deck.length === 0 && s.discard.length === 0) return false; // serve almeno una carta
        if (o.type === 'energy_boost' && s.deck.length === 0 && s.discard.length === 0) return false; // niente da pescare
        if (o.type === 'energy_drain' && !self._others(playerId).some(function (oid) { return s.players[oid].revealedIds.length > 0; })) return false; // niente da rubare: nessun avversario ha carte scelte
        if (o.type === 'rebuild' && ((s.deck.length === 0 && s.discard.length === 0) || !self._rebuildHasTarget())) return false; // serve una carta e una CELLA DISTRUTTA/OFFLINE
        if (o.type === 'encore' && !self._encoreUsable(playerId)) return false;
        return true;
      });
    }
    return [];
  };
  // Encore! è utile solo se il tuo ARM ha una SKILL con usi (tactician/brawler/runner).
  Game.prototype._encoreUsable = function (playerId) {
    var p = this.state.players[playerId];
    return !!this.state.modules.powers && (p.character === 'tactician' || p.character === 'brawler' || p.character === 'runner');
  };
  // Ricostruisci ha bisogno di almeno una CELLA DISTRUTTA o OFFLINE dove piazzare la carta.
  Game.prototype._rebuildHasTarget = function () {
    var s = this.state;
    for (var x = 1; x <= s.gridSize; x++) for (var y = 1; y <= s.gridSize; y++) {
      var c = s.grid[x][y];
      if (c.destroyed || (c.card && c.faceDown)) return true;
    }
    return false;
  };

  Game.prototype.useObject = function (playerId, objectId, params) {
    var s = this.state; params = params || {};
    if (!s.modules.objects) throw new Error('Modulo Oggetti non attivo.');
    var obj = this.usableObjects(playerId).filter(function (o) { return o.id === objectId; })[0];
    if (!obj) throw new Error('Oggetto non utilizzabile ora.');

    removeCard(s.players[playerId].objects, objectId); // usato una volta
    this._discardObjectCard(obj);                       // la carta Oggetto usata va nella pila scarti Oggetti
    var _st = s.players[playerId].stats; _st.objUses += 1; _st.objByType[obj.type] = (_st.objByType[obj.type] || 0) + 1;
    this._markActed(playerId);
    this._log(playerId + ' usa ' + obj.type + '.');

    switch (obj.type) {
      case 'jetpack': this._openToolDiscard(playerId, 'jetpack'); break; // costo: il giocatore sceglie la carta da scartare
      case 'jump': this._openToolDiscard(playerId, 'jump'); break;
      case 'grapple': this._openToolDiscard(playerId, 'grapple'); break; // costo carta, poi arma il modificatore 'grapple'
      case 'teleport': s.subPhase = 'teleport-select'; s.pendingTeleport = { playerId: playerId }; break;
      case 'hook': s.attackModifier = 'hook'; break;                     // armato per l'attacco
      case 'homing_missile': s.attackModifier = 'homing'; break;
      case 'rush_juice': s.players[playerId].pendingActions = { moves: 2, attacks: 0 }; s.selectObjectUsed[playerId] = true; break;
      case 'combat_juice': s.players[playerId].pendingActions = { moves: 0, attacks: 2 }; s.selectObjectUsed[playerId] = true; break;
      case 'timebomb':
        s.selectObjectUsed[playerId] = true;
        if (params.suit && Deck.SUITS.indexOf(params.suit) !== -1) { s.currentSuit = params.suit; this._log('Timebomb: seme di turno → ' + params.suit + '.'); }
        else { s.subPhase = 'timebomb-suit'; s.pendingTimebomb = { playerId: playerId }; } // la UI chiede il seme
        break;
      // TOOLS "energetici" e immediati: effetto istantaneo, non consumano l'azione né armano modificatori.
      case 'energy_boost': {
        var p = s.players[playerId], drew = [];
        // PESCA [2] e aggiungi alla STACK ATTIVA (le carte rivelate).
        for (var eb = 0; eb < 2; eb++) { var c = this._drawCard(); if (c) { p.hand.push(c); p.revealedIds.push(c.id); drew.push(c); } }
        this._log(playerId + ' usa Ricarica: PESCA ' + drew.length + ' → STACK ATTIVA.');
        break;
      }
      case 'remix': {
        var pr2 = s.players[playerId];
        pr2.reshuffleLeft += 1; pr2.reshuffleTotal += 1;
        this._log(playerId + ' usa Remix!: +1 uso a REMIX (usi: ' + pr2.reshuffleLeft + ').');
        break;
      }
      case 'encore': {
        var pe = s.players[playerId], ch = pe.character;
        if (ch === 'tactician') { pe.tacticianLeft += 1; pe.tacticianTotal += 1; }
        else if (ch === 'brawler') { pe.brawlerLeft += 1; pe.brawlerTotal += 1; }
        else if (ch === 'runner') { pe.runnerLeft += 1; pe.runnerTotal += 1; }
        this._log(playerId + ' usa Encore!: +1 uso alla SKILL del proprio ARM.');
        break;
      }
      case 'rebuild': {
        var pb = s.players[playerId], drawn = [];
        for (var rb = 0; rb < 3; rb++) { var rc = this._drawCard(); if (rc) drawn.push(rc); }
        if (!drawn.length) { this._log(playerId + ' usa Ricostruisci ma il DECK è vuoto.'); break; }
        s.subPhase = 'rebuild-select'; s.pendingRebuild = { playerId: playerId, drawn: drawn, chosen: null };
        this._log(playerId + ' usa Ricostruisci: PESCA ' + drawn.length + ', scegline 1.');
        break;
      }
      case 'energy_drain': {
        // Sifone Energetico: ruba SOLO tra le carte SCELTE (rivelate) dell'avversario.
        // In multiplayer, se più avversari hanno carte scelte, il PILOTA sceglie il bersaglio.
        var self2 = this;
        var eligible = this._others(playerId).filter(function (oid) { return s.players[oid].revealedIds.length > 0; });
        if (eligible.length > 1) {
          s.subPhase = 'energy-target'; s.pendingEnergy = { playerId: playerId };
          this._log(playerId + ' usa Sifone Energetico: scegli da chi rubare.');
        } else if (eligible.length === 1) {
          this._energyDrainFrom(playerId, eligible[0]);
        } else {
          this._log(playerId + ' usa Sifone Energetico: nessun avversario ha carte scelte.');
        }
        break;
      }
      // Oggetti d'attacco interattivi: avviano un sotto-flusso e "consumano" l'azione d'attacco.
      case 'elemental_bomb': s.subPhase = 'elemental-target'; s.pendingElemental = { playerId: playerId }; break;
      case 'barrage': s.subPhase = 'barrage-first'; s.pendingBarrage = { playerId: playerId, first: null, second: null }; break;
      case 'randomizer': s.subPhase = 'randomizer-select'; s.pendingRandomizer = { playerId: playerId, chosen: [], drawn: null, placed: {} }; break;
    }
  };

  // ---- Sifone Energetico (energy_drain): ruba 1 carta scelta dal bersaglio ----
  Game.prototype._energyDrainFrom = function (playerId, targetId) {
    var s = this.state, me = s.players[playerId], opp = s.players[targetId];
    var pool = opp.hand.filter(function (cc) { return opp.revealedIds.indexOf(cc.id) !== -1; });
    if (!pool.length) { this._log(playerId + ' usa Sifone Energetico: ' + targetId + ' non ha carte scelte.'); return; }
    var pick = pool[Math.floor((this._rng || Math.random)() * pool.length)];
    removeCard(opp.hand, pick.id);
    var ri = opp.revealedIds.indexOf(pick.id); if (ri !== -1) opp.revealedIds.splice(ri, 1);
    opp.revealedCards = opp.revealedCards.filter(function (c) { return c && c.id !== pick.id; });
    me.hand.push(pick); me.revealedIds.push(pick.id);
    this._log(playerId + ' usa Sifone Energetico: ruba una carta scelta da ' + targetId + '.');
  };
  // Bersagli possibili del Sifone (avversari con almeno una carta scelta).
  Game.prototype.energyTargetOptions = function () {
    var s = this.state;
    if (s.subPhase !== 'energy-target' || !s.pendingEnergy) return [];
    var pid = s.pendingEnergy.playerId;
    return this._others(pid).filter(function (oid) { return s.players[oid].revealedIds.length > 0; });
  };
  Game.prototype.energyDrainTarget = function (targetId) {
    var s = this.state, pe = s.pendingEnergy;
    if (s.subPhase !== 'energy-target' || !pe) throw new Error('Nessun Sifone Energetico in corso.');
    if (this.energyTargetOptions().indexOf(targetId) === -1) throw new Error('Bersaglio non valido.');
    var pid = pe.playerId;
    this._energyDrainFrom(pid, targetId);
    s.pendingEnergy = null; s.subPhase = null;
    this._promptCurrentPhase(); // Sifone: effetto immediato, non consuma l'azione
  };

  Game.prototype.timebombChoose = function (suit) {
    var s = this.state;
    if (s.subPhase !== 'timebomb-suit') throw new Error('Nessuna scelta timebomb in corso.');
    if (Deck.SUITS.indexOf(suit) === -1) throw new Error('Seme non valido.');
    s.currentSuit = suit; this._log('Timebomb: seme di turno → ' + suit + '.');
    s.pendingTimebomb = null; s.subPhase = null; // torna alla selezione carte
  };

  // Pesca un oggetto dopo l'eliminazione di una figura. Ritorna 'off'|'empty'|'ok'|'over'.
  Game.prototype._drawObject = function (playerId) {
    var s = this.state;
    if (!s.modules.objects) return 'off';
    if (s.objectDeck.length === 0) this._reshuffleObjectDiscard();
    if (s.objectDeck.length === 0) { this._log('Mazzo Oggetti vuoto: nessuna pesca.'); return 'empty'; }
    var obj = s.objectDeck.shift();
    s.players[playerId].objects.push(obj);
    this._log(playerId + ' elimina una figura e pesca un oggetto: ' + obj.type + '.');
    return nonCharObjects(s.players[playerId]).length > this._objLimit() ? 'over' : 'ok';
  };
  // Variante usata nel movimento: pesca e, se oltre limite, inserisce lo scarto in cima alla catena.
  Game.prototype._postFigureDraw = function (playerId) {
    if (this._drawObject(playerId) === 'over') this._chain.unshift(this._step_openDiscard(playerId));
  };
  Game.prototype._step_openDiscard = function (playerId) {
    var self = this;
    return function () { self.state.subPhase = 'object-discard'; self.state.pendingObjectDiscard = { playerId: playerId }; };
  };
  Game.prototype.discardObject = function (playerId, objectId) {
    var s = this.state;
    if (s.subPhase !== 'object-discard' || s.pendingObjectDiscard.playerId !== playerId) throw new Error('Nessuno scarto oggetto per ' + playerId + '.');
    var obj = findCard(s.players[playerId].objects, objectId);
    if (!obj || obj.fromCharacter) throw new Error('Devi scartare un oggetto non-iniziale.');
    removeCard(s.players[playerId].objects, objectId);
    this._discardObjectCard(obj);
    this._log(playerId + ' scarta l\'oggetto ' + obj.type + ' (limite oggetti).');
    s.pendingObjectDiscard = null; s.subPhase = null;
    this._advanceChain();
  };

  // ================================================================== ABBINAMENTO ALTERNATIVO (Ruleset A)
  // Quante carte Oggetto si pescano per la scelta: il tactician sceglie tra 4, gli altri tra 3.
  Game.prototype._altObjectCount = function (playerId) {
    return (this.state.modules.powers && this.state.players[playerId].character === 'tactician') ? 4 : 3;
  };
  // Pesca fino a N carte Oggetto e apre la scelta di 1 su N (dopo figura colpita / centro conquistato).
  Game.prototype._openAltObject = function (playerId) {
    var s = this.state, drawn = [], n = this._altObjectCount(playerId);
    for (var i = 0; i < n; i++) { var o = this._drawObjectCard(); if (o) drawn.push(o); }
    if (!drawn.length) { this._log(playerId + ': nessuna carta Oggetto disponibile da scegliere.'); return false; }
    s.pendingAltMatch = { playerId: playerId, drawn: drawn };
    s.subPhase = 'altmatch-object';
    this._log(playerId + ' pesca ' + drawn.length + ' carte Oggetto: scegline una.');
    return true;
  };
  Game.prototype._step_altObject = function (playerId) {
    var self = this;
    return function () { self._openAltObject(playerId); };
  };

  // ---- Passiva runner: colpire una figura muovendovi sopra (Ruleset A) ----
  Game.prototype._step_runnerFigure = function (playerId, x, y) {
    var self = this;
    return function () {
      if (self.availableRevealed(playerId).length < 1 || self.state.players[playerId].runnerLeft <= 0) return;
      self.state.subPhase = 'runner-figure';
      self.state.pendingRunner = { playerId: playerId, x: x, y: y };
    };
  };
  Game.prototype.runnerFigureOptions = function () {
    var s = this.state, pr = s.pendingRunner;
    return (s.subPhase === 'runner-figure' && pr) ? this.availableRevealed(pr.playerId) : [];
  };
  Game.prototype.runnerFigureHit = function (cardId) {
    var s = this.state, pr = s.pendingRunner;
    if (s.subPhase !== 'runner-figure' || !pr) throw new Error('Nessuna scelta runner in corso.');
    var p = s.players[pr.playerId], cell = s.grid[pr.x][pr.y];
    var card = findCard(this.availableRevealed(pr.playerId), cardId);
    if (!card) throw new Error('Carta non disponibile.');
    removeCard(p.hand, cardId);
    var ri = p.revealedIds.indexOf(cardId); if (ri !== -1) p.revealedIds.splice(ri, 1);
    this._discard(card);
    var pts = Deck.figurePoints(cell.card);
    this._addScore(pr.playerId, pts, 'ptsFigure'); p.figuresMatched += 1; cell.faceDown = true; p.runnerLeft -= 1;
    this._log(pr.playerId + ' (runner) colpisce la figura ' + cell.card.value + ' in movimento: +' + pts + ' (usi rimasti ' + p.runnerLeft + ').');
    var pid = pr.playerId;
    s.pendingRunner = null; s.subPhase = null;
    if (this._openAltObject(pid)) return; // scelta oggetto: la catena riprende dopo la scelta
    this._advanceChain();
  };
  Game.prototype.runnerFigureSkip = function () {
    var s = this.state, pr = s.pendingRunner;
    if (s.subPhase !== 'runner-figure' || !pr) throw new Error('Nessuna scelta runner in corso.');
    this._log(pr.playerId + ' (runner) non colpisce la figura.');
    s.pendingRunner = null; s.subPhase = null;
    this._advanceChain();
  };
  Game.prototype.altMatchPickObject = function (objectId) {
    var s = this.state, pa = s.pendingAltMatch, self = this;
    if (s.subPhase !== 'altmatch-object' || !pa || !pa.drawn) throw new Error('Nessuna scelta oggetto (abbinamento alternativo) in corso.');
    var chosen = null, rest = [];
    pa.drawn.forEach(function (o) { if (o.id === objectId && !chosen) chosen = o; else rest.push(o); });
    if (!chosen) throw new Error('Oggetto non valido.');
    rest.forEach(function (o) { self._discardObjectCard(o); }); // le carte non scelte finiscono negli scarti Oggetti
    var pid = pa.playerId;
    s.players[pid].objects.push(chosen);
    this._log(pid + ' tiene l\'oggetto ' + chosen.type + ' e scarta le altre ' + rest.length + '.');
    var over = nonCharObjects(s.players[pid]).length > this._objLimit();
    s.pendingAltMatch = null; s.subPhase = null;
    if (over) this._chain.unshift(this._step_openDiscard(pid));
    this._advanceChain();
  };

  // ================================================================== MODULO RESHUFFLE
  // Due volte per partita un giocatore può rimescolare la propria mano nel mazzo e pescare 6 carte.
  // Disponibile durante la propria fase di selezione, prima di scegliere le carte.
  Game.prototype.canReshuffle = function (playerId) {
    var s = this.state;
    if (!s.modules.reshuffle || s.gameOver || s.subPhase) return false;
    if (s.phase !== 'select' || s.selected[playerId] != null) return false;
    var p = s.players[playerId];
    return p.reshuffleLeft > 0 && p.hand.length > 0;
  };
  // Reshuffle: si scelgono da 1 a n carte (n = carte in mano), le scelte vengono scartate e
  // si pesca un egual numero di carte dal mazzo. Se il mazzo si esaurisce, gli scarti vengono
  // rimescolati per pescare le carte mancanti (_drawCard gestisce il rimescolamento).
  Game.prototype.reshuffleHand = function (playerId, cardIds) {
    if (!this.canReshuffle(playerId)) throw new Error('Reshuffle non disponibile ora.');
    var s = this.state, p = s.players[playerId], self = this;
    // Normalizza/valida la selezione: 1..n carte distinte appartenenti alla mano.
    var ids = Array.isArray(cardIds) ? cardIds.slice() : (cardIds != null ? [cardIds] : []);
    var seen = {}, chosen = [];
    ids.forEach(function (id) {
      if (seen[id]) return;
      var card = p.hand.filter(function (c) { return c.id === id; })[0];
      if (card) { seen[id] = true; chosen.push(card); }
    });
    if (chosen.length < 1 || chosen.length > p.hand.length) throw new Error('Selezione reshuffle non valida (scegli da 1 a ' + p.hand.length + ' carte).');
    var n = chosen.length;
    // Scarta le carte scelte (rimuovendole anche dall\'eventuale stato rivelato).
    chosen.forEach(function (c) {
      removeCard(p.hand, c.id);
      p.revealedIds = p.revealedIds.filter(function (rid) { return rid !== c.id; });
      p.revealedCards = p.revealedCards.filter(function (rc) { return rc && rc.id !== c.id; });
      self._discard(c);
    });
    // Pesca un egual numero di carte dal mazzo.
    var drawn = 0;
    for (var i = 0; i < n; i++) { var nc = this._drawCard(); if (nc) { p.hand.push(nc); drawn++; } }
    p.reshuffleLeft -= 1;
    this._log(playerId + ' reshuffle: scarta ' + n + ' carte e ne pesca ' + drawn + ' (reshuffle rimasti: ' + p.reshuffleLeft + ').');
  };

  // ================================================================== POTERI PERSONAGGIO (§12)
  // Tactician: 3 volte a partita può guardare le carte di RISERVA dell'avversario (le mostra un modale).
  Game.prototype.canActivatePower = function (playerId) {
    var s = this.state, p = s.players[playerId];
    if (!s.modules.powers || s.subPhase || p.character !== 'tactician') return false;
    if (!(p.tacticianLeft > 0)) return false; // esaurite le attivazioni della partita
    return (s.phase === 'move' || s.phase === 'attack') && s.activePlayer === playerId && s.actionsLeft > 0;
  };
  Game.prototype.activatePower = function (playerId) {
    if (!this.canActivatePower(playerId)) throw new Error('Potere non attivabile ora.');
    var s = this.state, p = s.players[playerId], self = this;
    p.tacticianLeft -= 1;
    // Deep Mind: guarda la STACK DI RISERVA di TUTTI gli altri giocatori.
    var hands = this._others(playerId).map(function (oid) {
      var reserve = self.availableReserve(oid);
      return { playerId: oid, cards: reserve.map(function (c) { return { value: c.value, suit: c.suit }; }) };
    });
    // Risultato per la UI (modale): fuori dallo stato, non entra negli snapshot.
    this._tacticianPeek = {
      token: (this._tacticianToken = (this._tacticianToken || 0) + 1),
      viewerId: playerId, hands: hands,
      // Compat 2 giocatori: primo avversario.
      opponentId: hands.length ? hands[0].playerId : null,
      cards: hands.length ? hands[0].cards : []
    };
    this._log(playerId + ' (tactician) guarda la STACK DI RISERVA degli avversari (attivazioni rimaste: ' + p.tacticianLeft + ').');
  };

  // Brawler: scarta 3 carte disponibili per abbinare QUALSIASI cella (rinuncia a un'azione).
  Game.prototype.canBrawler = function (playerId) {
    var s = this.state, p = s.players[playerId];
    if (!s.modules.powers || s.subPhase || p.character !== 'brawler') return false;
    if (!(p.brawlerLeft > 0)) return false; // esaurite le attivazioni della partita
    if (s.activePlayer !== playerId || s.actionsLeft <= 0) return false;
    if (s.phase !== 'move' && s.phase !== 'attack') return false; // brawler: in movimento o in attacco
    return this.availableRevealed(playerId).length >= 3;
  };
  Game.prototype.brawlerTargets = function (playerId) {
    var s = this.state, out = [];
    if (!this.canBrawler(playerId)) return out;
    if (s.phase === 'move') {
      this._moveDestList(playerId).forEach(function (d) {
        var cell = s.grid[d[0]][d[1]];
        if (cell.destroyed || (cell.pawn && cell.pawn !== playerId)) return; // no distrutte, no clash (0 carte)
        out.push({ x: d[0], y: d[1], key: cellKey(d[0], d[1]) });
      });
    } else {
      for (var x = 1; x <= s.gridSize; x++) for (var y = 1; y <= s.gridSize; y++) if (!s.grid[x][y].destroyed) out.push({ x: x, y: y, key: cellKey(x, y) });
    }
    return out;
  };
  Game.prototype.brawlerAction = function (playerId, x, y) {
    var s = this.state, self = this;
    if (!this.canBrawler(playerId)) throw new Error('Potere brawler non disponibile.');
    if (!this.brawlerTargets(playerId).some(function (t) { return t.x === x && t.y === y; })) throw new Error('Bersaglio non valido.');
    var avail = this.availableRevealed(playerId).slice();
    avail.forEach(function (c) { removeCard(s.players[playerId].hand, c.id); self._discard(c); });
    s.players[playerId].brawlerLeft -= 1;
    this._markActed(playerId);
    s.players[playerId].stats[s.phase === 'move' ? 'moves' : 'attacks'] += 1;
    this._log(playerId + ' (brawler) scarta 3 carte per abbinare qualsiasi cella (attivazioni rimaste: ' + s.players[playerId].brawlerLeft + ').');
    var cell = s.grid[x][y];
    if (s.phase === 'move') {
      var info = this._applyArrival(playerId, cell, null); // moveCard null → nessun trophy
      this._chain = [this._step_afterMove(playerId)];
      if (info.figureEliminated) this._postFigureDraw(playerId);
      if (info.centerObject || info.targetObject || info.bonusObject) this._chain.unshift(this._step_altObject(playerId));
      this._advanceChain();
    } else {
      this._recordTrail('shot', playerId, this.pawnCell(playerId), cell);
      // Clash su Attacco: se il bersaglio è occupato dall'ARM avversario, la SKILL apre un clash
      // (come un attacco normale). L'attaccante ha già scartato le 3 carte attive: il clash usa la RISERVA.
      if (s.clashOnAttack && cell.pawn && cell.pawn !== playerId) {
        var defB = cell.pawn;
        s.subPhase = 'clash-cards';
        s.pendingClash = { attackerId: playerId, defenderId: defB, x: x, y: y, moveCard: null, isAttack: true, attackMod: null,
                           attackerCardId: null, defenderCardId: null, whoChooses: playerId };
        this._log(playerId + ' (brawler) attacca la pedina di ' + defB + ' su [' + x + ',' + y + '] → clash.');
        this._clashAdvanceAuto();
        return;
      }
      var info2 = this._applyShot(playerId, cell, null, false);
      this._chain = [];
      if (info2.altFigureObject) this._chain.push(this._step_altObject(playerId));
      else if (info2.figureEliminated && this._drawObject(playerId) === 'over') this._chain.push(this._step_openDiscard(playerId));
      this._chain.push(this._step_afterAttack(playerId));
      this._advanceChain();
    }
  };

  // ================================================================== OGGETTI AVANZATI (attacco)
  // Passo generico: apre uno spostamento forzato per una pedina rimasta su una cella distrutta.
  Game.prototype._step_relocatePawn = function (pawnId, from) {
    var self = this;
    return function () {
      var opts = self._relocationOptions(from.x, from.y);
      if (opts.length) { self.state.subPhase = 'forced-reloc'; self.state.pendingForced = { kind: 'destroy', pawnId: pawnId, chooserId: pawnId, from: from, optional: false }; }
      else self._log('Nessuna destinazione: la pedina resta ferma.');
    };
  };

  // ---- Elemental bomb ----
  Game.prototype.elementalTargetOptions = function () {
    var s = this.state, out = [];
    if (s.subPhase !== 'elemental-target') return out;
    for (var x = 1; x <= s.gridSize; x++) for (var y = 1; y <= s.gridSize; y++) { var c = s.grid[x][y]; if (!c.destroyed && c.card) out.push({ x: x, y: y, key: cellKey(x, y) }); }
    return out;
  };
  Game.prototype.elementalTarget = function (x, y) {
    var s = this.state;
    if (s.subPhase !== 'elemental-target') throw new Error('Nessuna elemental bomb in corso.');
    var c = s.grid[x][y]; if (c.destroyed || !c.card) throw new Error('Cella non valida.');
    s.pendingElemental.x = x; s.pendingElemental.y = y; s.subPhase = 'elemental-suit';
  };
  Game.prototype.elementalSuit = function (suit) {
    var s = this.state;
    if (s.subPhase !== 'elemental-suit') throw new Error('Nessuna scelta seme elemental in corso.');
    if (Deck.SUITS.indexOf(suit) === -1) throw new Error('Seme non valido.');
    var pe = s.pendingElemental, cells = [[pe.x, pe.y]].concat(orthogonalNeighbors(pe.x, pe.y, s.gridSize)), changed = 0;
    cells.forEach(function (d) { var c = s.grid[d[0]][d[1]]; if (!c.destroyed && c.card) { c.card.suit = suit; changed++; } });
    this._log(pe.playerId + ' usa Bomba Elementale su [' + pe.x + ',' + pe.y + ']: ' + changed + ' CELLE → SUIT ' + suit + '.');
    var pid = pe.playerId; s.pendingElemental = null; s.subPhase = null;
    this._promptAttack(); // senza costo: non consuma l'ATTACCO
  };

  // ---- Barrage ---- (una singola cella; non può colpire celle con una pedina)
  Game.prototype.barrageFirstOptions = function () {
    var s = this.state, out = [];
    if (s.subPhase !== 'barrage-first') return out;
    for (var x = 1; x <= s.gridSize; x++) for (var y = 1; y <= s.gridSize; y++) {
      var c = s.grid[x][y];
      if (!c.destroyed && !c.pawn) out.push({ x: x, y: y, key: cellKey(x, y) });
    }
    return out;
  };
  Game.prototype.barrageFirst = function (x, y) {
    var s = this.state;
    if (s.subPhase !== 'barrage-first') throw new Error('Nessun barrage in corso.');
    var c = s.grid[x][y];
    if (c.destroyed || c.pawn) throw new Error('Cella non valida (distrutta o con pedina).');
    s.pendingBarrage.first = { x: x, y: y };
    this._barrageResolve(); // barrage colpisce una singola cella
  };
  // Celle valide adiacenti (ortogonali) a una qualsiasi delle celle già scelte (esclusi centro/pedina/distrutte/già scelte).
  Game.prototype._barrageNextOptions = function (anchors) {
    var s = this.state, out = [], seen = {};
    anchors.forEach(function (a) { if (a) seen[cellKey(a.x, a.y)] = true; });
    anchors.forEach(function (a) {
      if (!a) return;
      orthogonalNeighbors(a.x, a.y, s.gridSize).forEach(function (d) {
        var k = cellKey(d[0], d[1]), c = s.grid[d[0]][d[1]];
        if (seen[k]) return;
        if (isCenter(d[0], d[1], s.gridSize) || c.pawn || c.destroyed) return;
        seen[k] = true; out.push({ x: d[0], y: d[1], key: k });
      });
    });
    return out;
  };
  Game.prototype.barrageSecondOptions = function () {
    var s = this.state;
    if (s.subPhase !== 'barrage-second' || !s.pendingBarrage.first) return [];
    return this._barrageNextOptions([s.pendingBarrage.first]);
  };
  Game.prototype.barrageSecond = function (x, y) {
    var s = this.state;
    if (s.subPhase !== 'barrage-second') throw new Error('Nessun barrage in corso.');
    if (!this.barrageSecondOptions().some(function (o) { return o.x === x && o.y === y; })) throw new Error('Seconda cella non valida.');
    s.pendingBarrage.second = { x: x, y: y };
    this._barrageResolve(); // Barrage: solo 2 celle (prima + 1 adiacente).
  };
  Game.prototype.barrageThirdOptions = function () {
    var s = this.state;
    if (s.subPhase !== 'barrage-third' || !s.pendingBarrage.first || !s.pendingBarrage.second) return [];
    return this._barrageNextOptions([s.pendingBarrage.first, s.pendingBarrage.second]);
  };
  Game.prototype.barrageThird = function (x, y) {
    var s = this.state;
    if (s.subPhase !== 'barrage-third') throw new Error('Nessun barrage in corso.');
    if (!this.barrageThirdOptions().some(function (o) { return o.x === x && o.y === y; })) throw new Error('Terza cella non valida.');
    s.pendingBarrage.third = { x: x, y: y };
    this._barrageResolve();
  };
  Game.prototype._barrageResolve = function () {
    var s = this.state, pb = s.pendingBarrage, pid = pb.playerId;
    var a = pb.first, c = s.grid[a.x][a.y];
    this._log(pid + ' usa Barrage: distrugge [' + a.x + ',' + a.y + '].');
    c.card = null; c.faceDown = false; c.destroyed = true;
    s.pendingBarrage = null; s.subPhase = null;
    this._chain = [this._step_afterAttack(pid)];
    this._advanceChain();
  };

  // ---- Randomizer ----
  Game.prototype.randomizerSelectOptions = function () {
    var s = this.state, out = [];
    if (s.subPhase !== 'randomizer-select') return out;
    for (var x = 1; x <= s.gridSize; x++) for (var y = 1; y <= s.gridSize; y++) { var c = s.grid[x][y]; if (!isCenter(x, y, s.gridSize) && !c.destroyed && c.card) out.push({ x: x, y: y, key: cellKey(x, y) }); }
    return out;
  };
  Game.prototype.randomizerToggle = function (x, y) {
    var s = this.state, pr = s.pendingRandomizer;
    if (s.subPhase !== 'randomizer-select') throw new Error('Nessun randomizer in corso.');
    var c = s.grid[x][y]; if (isCenter(x, y, s.gridSize) || c.destroyed || !c.card) throw new Error('Cella non valida.');
    var key = cellKey(x, y), i = -1;
    for (var k = 0; k < pr.chosen.length; k++) if (pr.chosen[k].key === key) i = k;
    if (i >= 0) pr.chosen.splice(i, 1);
    else { if (pr.chosen.length >= 3) throw new Error('Massimo 3 celle.'); pr.chosen.push({ x: x, y: y, key: key }); }
  };
  Game.prototype.randomizerConfirm = function () {
    var s = this.state, pr = s.pendingRandomizer;
    if (s.subPhase !== 'randomizer-select') throw new Error('Nessun randomizer in corso.');
    if (!pr.chosen.length) throw new Error('Scegli almeno una cella.');
    var n = pr.chosen.length;
    if (s.deck.length === 0) this._reshuffleDiscardIntoDeck(); // mazzo esaurito → usa gli scarti per un mescolamento reale
    pr.chosen.forEach(function (ch) { var c = s.grid[ch.x][ch.y]; s.deck.push(c.card); c.card = null; }); // carte nel mazzo, celle svuotate
    Deck.shuffle(s.deck, this._rng || Math.random);
    pr.drawn = [];
    for (var i = 0; i < n && s.deck.length; i++) pr.drawn.push(s.deck.shift());
    pr.placed = {};
    this._log(pr.playerId + ' usa Randomizer: ' + n + ' carte rimescolate nel mazzo, pescate ' + pr.drawn.length + '.');
    s.subPhase = 'randomizer-place';
  };
  Game.prototype.randomizerPlace = function (cardId, x, y) {
    var s = this.state, pr = s.pendingRandomizer;
    if (s.subPhase !== 'randomizer-place') throw new Error('Nessun randomizer in corso.');
    var key = cellKey(x, y);
    if (!pr.chosen.some(function (ch) { return ch.key === key; })) throw new Error('Cella non valida.');
    if (pr.placed[key]) throw new Error('Cella già occupata.');
    if (!pr.drawn.some(function (c) { return c.id === cardId; })) throw new Error('Carta non valida.');
    for (var kk in pr.placed) if (pr.placed[kk] === cardId) throw new Error('Carta già piazzata.');
    pr.placed[key] = cardId;
  };
  Game.prototype.randomizerUnplace = function (x, y) {
    var s = this.state, pr = s.pendingRandomizer;
    if (s.subPhase !== 'randomizer-place') throw new Error('Nessun randomizer in corso.');
    delete pr.placed[cellKey(x, y)];
  };
  Game.prototype.randomizerDone = function () {
    var s = this.state, pr = s.pendingRandomizer;
    if (s.subPhase !== 'randomizer-place') throw new Error('Nessun randomizer in corso.');
    if (Object.keys(pr.placed).length !== pr.chosen.length) throw new Error('Posiziona tutte le carte.');
    pr.chosen.forEach(function (ch) {
      var cardId = pr.placed[ch.key], card = null;
      for (var i = 0; i < pr.drawn.length; i++) if (pr.drawn[i].id === cardId) card = pr.drawn[i];
      var c = s.grid[ch.x][ch.y]; c.card = card; c.faceDown = false; c.destroyed = false;
    });
    var pid = pr.playerId;
    this._log(pid + ' completa il Randomizzatore.');
    s.pendingRandomizer = null; s.subPhase = null;
    this._afterActionObject(pid); // usabile in MOVIMENTO o ATTACCO
  };

  // ---- Ricostruisci (rebuild): PESCA 3, scegli 1, SOVRASCRIVI una CELLA DISTRUTTA o OFFLINE ----
  Game.prototype.rebuildDrawn = function () {
    var s = this.state, pr = s.pendingRebuild;
    return (pr && (s.subPhase === 'rebuild-select' || s.subPhase === 'rebuild-place')) ? pr.drawn.slice() : [];
  };
  Game.prototype.rebuildSelectCard = function (cardId) {
    var s = this.state, pr = s.pendingRebuild;
    if (s.subPhase !== 'rebuild-select' || !pr) throw new Error('Nessun Ricostruisci in corso.');
    var card = pr.drawn.filter(function (c) { return c.id === cardId; })[0];
    if (!card) throw new Error('Carta non valida.');
    pr.chosen = card;
    s.subPhase = 'rebuild-place';
  };
  // CELLE bersaglio: DISTRUTTE o OFFLINE (carta a faccia in giù).
  Game.prototype.rebuildTargets = function () {
    var s = this.state, pr = s.pendingRebuild, out = [];
    if (s.subPhase !== 'rebuild-place' || !pr) return out;
    for (var x = 1; x <= s.gridSize; x++) for (var y = 1; y <= s.gridSize; y++) {
      var c = s.grid[x][y];
      if (c.destroyed || (c.card && c.faceDown)) out.push({ x: x, y: y, key: cellKey(x, y) });
    }
    return out;
  };
  Game.prototype.rebuildPlace = function (x, y) {
    var s = this.state, pr = s.pendingRebuild;
    if (s.subPhase !== 'rebuild-place' || !pr) throw new Error('Nessun Ricostruisci in corso.');
    if (!this.rebuildTargets().some(function (o) { return o.x === x && o.y === y; })) throw new Error('CELLA non valida (serve DISTRUTTA o OFFLINE).');
    var c = s.grid[x][y];
    if (c.card && c.faceDown) this._discard(c.card); // la carta OFFLINE sovrascritta va nella HEAP
    c.card = pr.chosen; c.faceDown = false; c.destroyed = false; // nuova CELLA ONLINE
    // Le altre carte pescate non scelte vanno nella HEAP.
    pr.drawn.forEach(function (d) { if (d.id !== pr.chosen.id) s.discard.push(d); });
    var pid = pr.playerId;
    this._log(pid + ' Ricostruisce [' + x + ',' + y + '] con ' + pr.chosen.value + pr.chosen.suit[0].toUpperCase() + '.');
    s.pendingRebuild = null; s.subPhase = null;
    this._promptCurrentPhase(); // senza costo: non consuma l'azione
  };
  // Ritorna alla fase corrente (MOVIMENTO/ATTACCO) senza consumare l'azione.
  Game.prototype._promptCurrentPhase = function () {
    if (this.state.phase === 'move') this._promptMove(); else this._promptAttack();
  };

  // ================================================================== Catena post-azione
  Game.prototype._step_afterMove = function (id) { var self = this; return function () { self._afterMoveAction(id); }; };
  Game.prototype._step_afterAttack = function (id) { var self = this; return function () { self._afterAttackAction(id); }; };

  // Esegue i passi della catena finché uno non apre un interrupt (subPhase != null).
  Game.prototype._advanceChain = function () {
    while (this._chain.length) {
      var step = this._chain.shift();
      step();
      if (this.state.subPhase) return; // interrupt: il resolver richiamerà _advanceChain
    }
  };

  // ================================================================== FINE ROUND / PARTITA
  Game.prototype._endRound = function () {
    var s = this.state, self = this;
    var everyone = this.allPlayers();
    // Statistiche: conta i ROUND passati senza alcuna azione (nè MOVIMENTO nè ATTACCO nè uso TOOL).
    everyone.forEach(function (id) { if (!s.players[id].actedThisRound) s.players[id].stats.zeroActionTurns += 1; });
    // Ruleset C: punteggio di posizione a fine turno.
    // 5×5 → controllo del centro: sul centro +3, adiacente ortogonale al centro +1.
    // 4×4 → celle bonus: +2 se ti trovi su una delle 4 celle centrali ([2,2],[2,3],[3,2],[3,3]).
    if (s.ruleset === 'C') {
      everyone.forEach(function (id) {
        var pc = self.pawnCell(id); if (!pc) return;
        var pts = positionBonusPoints(pc.x, pc.y, s.gridSize);
        if (pts > 0) { self._addScore(id, pts, 'ptsBonus'); self._log(id + ' a fine turno è su una cella bonus [' + pc.x + ',' + pc.y + ']: +' + pts + '.'); }
      });
    }
    // Le carte non usate restano in mano (non si scartano più le rivelate non giocate). Le carte
    // non sono più "scelte" per il prossimo round.
    everyone.forEach(function (id) {
      var p = s.players[id];
      p.revealedIds = []; p.revealedCards = [];
      p.pendingActions = { moves: 1, attacks: 1 };
    });
    if (s.endTriggered || s.round >= s.maxRounds) {
      // Ultimo ROUND: nessuna pesca, ma i bonus di SUIT che valgono punti (oro, spade) contano lo stesso.
      this._chain = [];
      if (s.ruleset === 'C') everyone.forEach(function (id) { self._chain.push(self._step_endCellBonus(id, true)); });
      this._chain.push(this._step_finishGame());
      this._advanceChain();
      return;
    }

    // Chi ha più di 6 carte sceglie quali scartare fino a 6 (sotto-fase 'end-discard'); poi si pesca
    // fino a 6; poi, se l'ARM è su una CELLA ONLINE, si applica il bonus di fine ROUND in base alla
    // SUIT della carta (oro/coppe/bastoni/spade); infine si avvia il ROUND successivo.
    this._chain = everyone.map(function (id) { return self._step_endDiscard(id); });
    this._chain.push(this._step_finishRoundDraw());
    // Bonus di SUIT di fine ROUND: solo nel regolamento corrente (Ruleset C).
    if (s.ruleset === 'C') everyone.forEach(function (id) { self._chain.push(self._step_endCellBonus(id)); });
    this._chain.push(this._step_startNextRound());
    this._advanceChain();
  };
  // Passo: conclude la partita (usato dopo i bonus di SUIT dell'ultimo ROUND).
  Game.prototype._step_finishGame = function () { var self = this; return function () { self._finishGame(); }; };

  // Passo: apre lo scarto in eccesso di fine turno per `id` (se ha più di 6 carte).
  Game.prototype._step_endDiscard = function (id) {
    var self = this;
    return function () {
      var p = self.state.players[id], need = p.hand.length - 6;
      if (need <= 0) return; // niente da scartare
      self.state.subPhase = 'end-discard';
      self.state.pendingEndDiscard = { playerId: id, need: need, sel: [] };
    };
  };
  // Passo: passa il 1° Pilota, pesca fino a 6 per tutti. (Round/seme/nuova scelta: _step_startNextRound.)
  Game.prototype._step_finishRoundDraw = function () {
    var self = this;
    return function () {
      var s = self.state;
      s.firstPlayer = self._nextSeatCW(s.firstPlayer); // il segnalino 1° Pilota passa in senso orario
      self._computeOrder();
      self.allPlayers().forEach(function (id) {
        while (s.players[id].hand.length < 6) { var c = self._drawCard(); if (!c) break; s.players[id].hand.push(c); }
        s.players[id].actedThisRound = false; // nuovo ROUND: azzera il flag azioni
      });
    };
  };
  // Punti/TOOL/carta/rubapunti in base alla SUIT della CELLA ONLINE su cui si trova l'ARM a fine ROUND.
  // Avviene DOPO la pesca (così il bonus "bastoni" fa iniziare il ROUND con 7 carte).
  // pointsOnly: dopo l'ULTIMO ROUND (nessuna pesca) si applicano solo i bonus che valgono punti
  // (oro e spade); coppe/bastoni (pesca TOOL/carta) sarebbero inutili a partita finita.
  Game.prototype._step_endCellBonus = function (id, pointsOnly) {
    var self = this;
    return function () {
      var s = self.state, pc = self.pawnCell(id);
      if (!pc || pc.destroyed || !pc.card || pc.faceDown) return; // solo su CELLA ONLINE
      var p = s.players[id], at = '[' + pc.x + ',' + pc.y + ']';
      var suit = pc.card.suit;
      if (pointsOnly && (suit === 'coppe' || suit === 'bastoni')) return;
      switch (suit) {
        case 'oro':
          self._addScore(id, 1, 'ptsBonus');
          self._log(id + ' bonus fine ROUND su ' + at + ' (oro): +1 punto.');
          break;
        case 'bastoni': {
          var c = self._drawCard();
          if (c) { p.hand.push(c); self._log(id + ' bonus fine ROUND su ' + at + ' (bastoni): PESCA 1 carta (' + p.hand.length + ' in mano).'); }
          else self._log(id + ' bonus fine ROUND su ' + at + ' (bastoni): DECK vuoto, nessuna pesca.');
          break;
        }
        case 'coppe': {
          if (!s.modules.objects) break;
          if (s.objectDeck.length === 0) self._reshuffleObjectDiscard();
          if (s.objectDeck.length === 0) { self._log(id + ' bonus fine ROUND su ' + at + ' (coppe): TOOLS HEAP vuota, nessun TOOL.'); break; }
          var obj = s.objectDeck.shift();
          p.objects.push(obj);
          self._log(id + ' bonus fine ROUND su ' + at + ' (coppe): pesca il TOOL ' + obj.type + '.');
          if (nonCharObjects(p).length > self._objLimit()) self._step_openDiscard(id)(); // oltre il limite: scarto obbligato
          break;
        }
        case 'spade': {
          var targets = self._others(id).filter(function (o) { return s.players[o].score > 0; });
          if (targets.length === 0) { self._log(id + ' bonus fine ROUND su ' + at + ' (spade): nessun avversario con punti.'); break; }
          if (targets.length === 1) { self._stealPoint(id, targets[0]); break; }
          s.subPhase = 'endbonus-steal'; s.pendingEndBonus = { playerId: id, options: targets }; // multiplayer: scegli il bersaglio
          break;
        }
      }
    };
  };
  // Toglie 1 punto (mai sotto 0) a `targetId`, mantenendo la coerenza col breakdown statistiche.
  Game.prototype._stealPoint = function (id, targetId) {
    var t = this.state.players[targetId];
    if (t.score <= 0) return;
    t.score -= 1;
    var st = t.stats; // scala una categoria positiva per mantenere sum(categorie) === score
    if (st.ptsBonus > 0) st.ptsBonus -= 1; else if (st.ptsFigure > 0) st.ptsFigure -= 1; else if (st.ptsPawn > 0) st.ptsPawn -= 1;
    this._log(id + ' bonus fine ROUND (spade): toglie 1 punto a ' + targetId + ' (ora ' + t.score + ').');
  };
  // Bonus spade in multiplayer: scelta dell'avversario a cui togliere il punto.
  Game.prototype.endBonusStealOptions = function () {
    var s = this.state;
    return (s.subPhase === 'endbonus-steal' && s.pendingEndBonus) ? s.pendingEndBonus.options.slice() : [];
  };
  Game.prototype.endBonusSteal = function (targetId) {
    var s = this.state, pe = s.pendingEndBonus;
    if (s.subPhase !== 'endbonus-steal' || !pe) throw new Error('Nessun bonus spade in corso.');
    if (pe.options.indexOf(targetId) === -1) throw new Error('Bersaglio non valido.');
    this._stealPoint(pe.playerId, targetId);
    s.pendingEndBonus = null; s.subPhase = null;
    this._advanceChain();
  };
  // Passo: avanza round/seme e apre la scelta carte del nuovo round.
  Game.prototype._step_startNextRound = function () {
    var self = this;
    return function () {
      var s = self.state;
      s.round += 1;
      if (s.suitMode === 'rotating') { s.currentSuit = Deck.nextSuit(s.currentSuit); self._log('Il seme di turno avanza a ' + s.currentSuit + '.'); }
      self._log('— Fine round. Primo Giocatore: ' + s.firstPlayer + '. Mazzo: ' + s.deck.length + ' carte.');
      self._beginSelectPhase();
    };
  };
  // ---- Scarto in eccesso di fine turno ----
  Game.prototype.endDiscardOptions = function () {
    var s = this.state, pd = s.pendingEndDiscard;
    return (s.subPhase === 'end-discard' && pd) ? s.players[pd.playerId].hand.slice() : [];
  };
  Game.prototype.endDiscardToggle = function (cardId) {
    var s = this.state, pd = s.pendingEndDiscard;
    if (s.subPhase !== 'end-discard' || !pd) throw new Error('Nessuno scarto di fine turno in corso.');
    if (!s.players[pd.playerId].hand.some(function (c) { return c.id === cardId; })) throw new Error('Carta non in mano.');
    var i = pd.sel.indexOf(cardId);
    if (i >= 0) pd.sel.splice(i, 1);
    else { if (pd.sel.length >= pd.need) throw new Error('Massimo ' + pd.need + ' carte.'); pd.sel.push(cardId); }
  };
  Game.prototype.endDiscardConfirm = function () {
    var s = this.state, pd = s.pendingEndDiscard, self = this;
    if (s.subPhase !== 'end-discard' || !pd) throw new Error('Nessuno scarto di fine turno in corso.');
    if (pd.sel.length !== pd.need) throw new Error('Devi scartare esattamente ' + pd.need + ' carte.');
    var p = s.players[pd.playerId];
    pd.sel.forEach(function (id) { var c = removeCard(p.hand, id); if (c) self._discard(c); });
    this._log(pd.playerId + ' scarta ' + pd.need + ' carte in eccesso a fine turno.');
    s.pendingEndDiscard = null; s.subPhase = null;
    this._advanceChain();
  };

  Game.prototype._finishGame = function () {
    var s = this.state;
    s.gameOver = true; s.phase = 'end'; s.subPhase = null;
    s.result = computeResult(s);
    this._log('=== FINE PARTITA === ' + s.result.summary);
  };

  function computeResult(s) {
    var ids = SEAT_CW.filter(function (id) { return s.players[id]; });
    var scores = {}; ids.forEach(function (id) { scores[id] = s.players[id].score; });
    // Confronto: punti, poi controllo del centro, poi numero di OBIETTIVI (figuresMatched).
    function cmp(a, b) {
      var pa = s.players[a], pb = s.players[b];
      if (pb.score !== pa.score) return pb.score - pa.score;
      if (!!pb.matchedCenter !== !!pa.matchedCenter) return (pb.matchedCenter ? 1 : 0) - (pa.matchedCenter ? 1 : 0);
      if (pb.figuresMatched !== pa.figuresMatched) return pb.figuresMatched - pa.figuresMatched;
      return 0;
    }
    var order = ids.slice().sort(cmp);
    var res = { winner: null, tiebreak: null, scores: scores, ranking: order, summary: '' };
    var top = order[0], second = order[1];
    var scoreStr = order.map(function (id) { return id + ' ' + scores[id]; }).join(' · ');
    if (cmp(top, second) === 0) { // vertice pienamente in parità → patta
      res.tiebreak = 'patta';
      res.summary = ids.length > 2 ? ('Partita PATTA in vetta (' + scoreStr + ').') : ('Partita PATTA (' + scoreStr + ').');
      return res;
    }
    res.winner = top;
    if (s.players[top].score === s.players[second].score) {
      res.tiebreak = (!!s.players[top].matchedCenter !== !!s.players[second].matchedCenter) ? 'centro' : 'figure';
      res.summary = 'Parità in vetta. Vince ' + top + (res.tiebreak === 'centro' ? ' (ha abbinato il centro).' : ' (più OBIETTIVI).');
    } else {
      res.summary = 'Vince ' + top + ' per punti (' + scoreStr + ').';
    }
    return res;
  }

  // ================================================================== Utility
  Game.prototype._assertAction = function (phase, id) {
    var s = this.state;
    if (s.gameOver) throw new Error('Partita finita.');
    if (s.subPhase) throw new Error('Risolvi prima ' + s.subPhase + '.');
    if (s.phase !== phase) throw new Error('Non è la fase ' + phase + '.');
    if (s.activePlayer !== id) throw new Error('Non è il turno di ' + id + '.');
  };
  Game.prototype.trophyCount = function (id) { return this.state.players[id].trophies.length; };

  // ================================================================== UNDO / cronologia
  function cloneState(s) { return JSON.parse(JSON.stringify(s)); }
  Game.prototype._snap = function () { this.history.push(cloneState(this.state)); };
  Game.prototype.canUndo = function () { return this.history.length > 0; };
  // Annulla l'ultima azione (ripristina lo stato precedente).
  Game.prototype.undo = function () {
    if (!this.history.length) return false;
    this.state = this.history.pop(); this._chain = []; return true;
  };
  // Ripristina lo stato com'era PRIMA che venisse prodotta la riga di log di indice i.
  Game.prototype.restoreToLogIndex = function (i) {
    var idx = -1;
    for (var k = 0; k < this.history.length; k++) if (this.history[k].log.length <= i) idx = k;
    if (idx < 0) return false;
    this.state = this.history[idx];
    this.history = this.history.slice(0, idx);
    this._chain = [];
    return true;
  };
  // Avvolge i metodi-azione pubblici: snapshot dello stato prima di ogni azione (una sola volta,
  // niente doppioni per chiamate annidate; su errore lo snapshot viene rimosso).
  // Solo le azioni "di primo livello": i sotto-passi interattivi (target/suit/place…) NON sono avvolti,
  // così un singolo undo annulla l'intero uso dell'oggetto.
  ['selectCards', 'move', 'passMove', 'shoot', 'passShoot', 'clashChoose', 'clashRelocate',
   'clashSkipRelocate', 'forcedRelocate', 'forcedRelocateSkip', 'discardObject', 'useObject',
   'timebombChoose', 'activatePower', 'brawlerAction', 'reshuffleHand'
  ].forEach(function (name) {
    var orig = Game.prototype[name];
    if (!orig) return; // metodi aggiunti più avanti: verranno avvolti quando esistono
    Game.prototype[name] = function () {
      if (this._inAction) return orig.apply(this, arguments);
      this._inAction = true; this._snap();
      try { return orig.apply(this, arguments); }
      catch (e) { this.history.pop(); throw e; }
      finally { this._inAction = false; }
    };
  });

  return {
    createGame: createGame, Game: Game,
    canMatch: canMatch, resolveClash: resolveClash, computeResult: computeResult,
    orthogonalNeighbors: orthogonalNeighbors, diagonalNeighbors: diagonalNeighbors,
    moveDestinations: moveDestinations, isCenter: isCenter, isBonusCell: isBonusCell,
    isPositionBonusCell: isPositionBonusCell, positionBonusPoints: positionBonusPoints, cellKey: cellKey
  };
});

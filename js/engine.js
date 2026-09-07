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

  var CENTER_X = 3, CENTER_Y = 3;
  var OBJECT_LIMIT = 2; // oggetti non-iniziali posseduti contemporaneamente

  // ------------------------------------------------------------------ Geometria
  function cellKey(x, y) { return x + ',' + y; }
  function isCenter(x, y) { return x === CENTER_X && y === CENTER_Y; }
  function targetRow(playerId) { return playerId === 'N' ? 5 : 1; }
  function isTargetCell(playerId, cell) { return cell.y === targetRow(playerId); }
  function otherPlayer(id) { return id === 'N' ? 'S' : 'N'; }
  function inBounds(x, y) { return x >= 1 && x <= 5 && y >= 1 && y <= 5; }

  function orthogonalNeighbors(x, y) {
    var out = [], d = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < d.length; i++) if (inBounds(x + d[i][0], y + d[i][1])) out.push([x + d[i][0], y + d[i][1]]);
    return out;
  }
  function diagonalNeighbors(x, y) {
    var out = [], d = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (var i = 0; i < d.length; i++) if (inBounds(x + d[i][0], y + d[i][1])) out.push([x + d[i][0], y + d[i][1]]);
    return out;
  }
  // Celle di destinazione del movimento in base all'eventuale modificatore oggetto.
  function moveDestinations(x, y, modifier) {
    if (modifier === 'jetpack') return orthogonalNeighbors(x, y).concat(diagonalNeighbors(x, y));
    if (modifier === 'jump') {
      var out = [], d = [[2, 0], [-2, 0], [0, 2], [0, -2]];
      for (var i = 0; i < d.length; i++) if (inBounds(x + d[i][0], y + d[i][1])) out.push([x + d[i][0], y + d[i][1]]);
      return out;
    }
    return orthogonalNeighbors(x, y);
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
  function resolveClash(attCard, defCard) {
    if (attCard.value !== defCard.value) return attCard.value > defCard.value ? 'attacker' : 'defender';
    var ra = Deck.SUIT_RANK[attCard.suit], rd = Deck.SUIT_RANK[defCard.suit];
    if (ra !== rd) return ra > rd ? 'attacker' : 'defender';
    return 'tie';
  }

  // ------------------------------------------------------------------ Setup
  function makePlayer(id) {
    return {
      id: id, score: 0, hand: [], revealedIds: [], revealedCards: [],
      trophies: [], figuresMatched: 0, matchedCenter: false,
      character: null, belongingSuit: null,
      objects: [],                          // include eventuale oggetto iniziale (fromCharacter)
      pendingActions: { moves: 1, attacks: 1 },
      // Modulo "poteri personaggi" (§12): stato per-round dei poteri.
      tacticianOpen: false,        // tactician: usa anche le carte non scelte
      fighterFirstMoveDone: false, // fighter: la prima azione di movimento è già avvenuta
      fighterBonusUsed: false,     // fighter: bonus (mossa extra) già concesso questo round
      fighterQualified: false      // fighter: la prima mossa ha abbinato figura/pedina avversaria
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
                    powers: !!(opts.modules && opts.modules.powers) };

    // 1-4. Mazzo, seme iniziale, asso centrale, griglia.
    var deck = Deck.shuffle(Deck.buildDeck(), rng);
    var starter = deck.shift();
    var centerInitialSuit = starter.suit;
    var aceIndex = -1;
    for (var i = 0; i < deck.length; i++) if (deck[i].value === 1 && deck[i].suit === centerInitialSuit) { aceIndex = i; break; }
    var aceCard = deck.splice(aceIndex, 1)[0];
    Deck.shuffle(deck, rng);
    var grid = [];
    for (var gx = 0; gx <= 5; gx++) grid[gx] = [];
    for (var x = 1; x <= 5; x++) for (var y = 1; y <= 5; y++) {
      var card = isCenter(x, y) ? aceCard : deck.shift();
      grid[x][y] = { x: x, y: y, card: card, faceDown: false, destroyed: false, pawn: null };
    }
    grid[1][1].pawn = 'N';
    grid[5][5].pawn = 'S';

    var players = { N: makePlayer('N'), S: makePlayer('S') };

    // 6-7. Personaggi e oggetto iniziale.
    if (modules.characters) {
      ['N', 'S'].forEach(function (id) {
        var type = opts.characters && opts.characters[id];
        var ch = Characters.get(type) || Characters.get('runner');
        players[id].character = ch.type;
        players[id].belongingSuit = ch.suit;
        if (modules.objects) players[id].objects.push(Objects.makeObjectCard(ch.startObject, true));
      });
    }

    // Mazzo Oggetti (4 distinti a faccia in giù) solo se il modulo è attivo.
    var objectDeck = modules.objects ? Objects.buildObjectDeck(rng, 4) : [];

    // 8. Pesca 6 carte a testa.
    for (var d = 0; d < 6; d++) { players.N.hand.push(deck.shift()); players.S.hand.push(deck.shift()); }

    var firstPlayer = opts.firstPlayer || (rng() < 0.5 ? 'N' : 'S');

    var state = {
      deck: deck, objectDeck: objectDeck, discard: [],
      grid: grid, centerInitialSuit: centerInitialSuit,
      suitMode: suitMode, currentSuit: centerInitialSuit,
      modules: modules,
      players: players, firstPlayer: firstPlayer,
      round: 1,
      phase: 'select',        // 'select'|'move'|'attack'|'end'
      subPhase: null,         // null|'clash-cards'|'clash-reloc'|'object-discard'|'forced-reloc'|'timebomb-suit'
      activePlayer: firstPlayer,
      selected: { N: null, S: null },
      selectObjectUsed: { N: false, S: false }, // max 1 oggetto select per giocatore/round
      actionsLeft: 0,
      moveModifier: null,     // 'jetpack'|'jump' (armato per l'azione di movimento corrente)
      attackModifier: null,   // 'hook'|'homing' (armato per l'attacco corrente)
      pendingClash: null,
      pendingForced: null,    // {kind,pawnId,chooserId,from,optional} durante 'forced-reloc'
      pendingObjectDiscard: null,
      pendingTimebomb: null,
      pendingElemental: null, pendingBarrage: null, pendingRandomizer: null,
      gameOver: false, endTriggered: false, result: null, log: []
    };

    var game = new Game(state);
    game._rng = rng; // per il rimescolo del randomizer (non è parte dello stato clonabile)
    game._beginSelectPhase();
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
  // Le carte che escono dal gioco finiscono nella pila degli scarti (per la UI; non si rimescola mai).
  Game.prototype._discard = function (card) { if (card) this.state.discard.push(card); };
  Game.prototype.getCell = function (x, y) { return this.state.grid[x][y]; };

  Game.prototype.pawnCell = function (id) {
    var g = this.state.grid;
    for (var x = 1; x <= 5; x++) for (var y = 1; y <= 5; y++) if (g[x][y].pawn === id) return g[x][y];
    return null;
  };
  Game.prototype.availableRevealed = function (id) {
    var p = this.state.players[id];
    // Potere tactician: quando è attivo si possono usare TUTTE le carte in mano (anche le non scelte).
    if (this.state.modules.powers && p.character === 'tactician' && p.tacticianOpen) return p.hand.slice();
    return p.hand.filter(function (c) { return p.revealedIds.indexOf(c.id) !== -1; });
  };
  Game.prototype.belongingSuit = function (id) { return this.state.players[id].belongingSuit; };

  // Match tenendo conto dei poteri personaggio (runner: abbina sempre le carte pari scoperte).
  Game.prototype._matches = function (playerId, card, cell) {
    var s = this.state, p = s.players[playerId];
    if (canMatch(card, cell, s.currentSuit, p.belongingSuit)) return true;
    if (s.modules.powers && p.character === 'runner' && cell && !cell.destroyed && cell.card && !cell.faceDown && (cell.card.value % 2 === 0)) return true;
    return false;
  };

  function findCard(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function removeCard(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list.splice(i, 1)[0]; return null; }
  function nonCharObjects(p) { return p.objects.filter(function (o) { return !o.fromCharacter; }); }

  // ================================================================== SELECT
  Game.prototype._beginSelectPhase = function () {
    var s = this.state;
    s.phase = 'select'; s.subPhase = null;
    s.selected = { N: null, S: null };
    s.selectObjectUsed = { N: false, S: false };
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
    if (s.selected.N && s.selected.S) this._reveal();
  };

  Game.prototype._reveal = function () {
    var s = this.state;
    ['N', 'S'].forEach(function (id) {
      var p = s.players[id];
      p.revealedIds = s.selected[id].slice();
      // Snapshot delle 3 carte scelte (per la preview pubblica, anche dopo l'uso).
      p.revealedCards = p.revealedIds.map(function (cid) { return findCard(p.hand, cid); });
    });
    s.selected = { N: null, S: null };
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
    if (s.activePlayer === s.firstPlayer) this._beginMoveSegment(otherPlayer(s.firstPlayer));
    else this._beginAttackPhase();
  };
  Game.prototype._afterMoveAction = function (id) {
    var s = this.state, p = s.players[id];
    s.actionsLeft -= 1;
    s.moveModifier = null;
    // Potere fighter: se la prima mossa ha abbinato figura/pedina avversaria, ottiene una mossa
    // extra ORA e rinuncia all'attacco del turno.
    if (s.modules.powers && p.character === 'fighter' && p.fighterQualified && !p.fighterBonusUsed) {
      p.fighterBonusUsed = true;
      p.fighterQualified = false;
      s.actionsLeft += 1;
      p.pendingActions.attacks = 0;
      this._log(id + ' (fighter): mossa bonus, rinuncia all\'attacco.');
    }
    this._promptMove();
  };

  Game.prototype.legalMoves = function (id) {
    var s = this.state;
    var pc = this.pawnCell(id);
    if (!pc) return [];
    var revealed = this.availableRevealed(id);
    var self = this;
    var out = [];
    var dests = moveDestinations(pc.x, pc.y, s.moveModifier);
    for (var i = 0; i < dests.length; i++) {
      var cell = s.grid[dests[i][0]][dests[i][1]];
      var okIds = [];
      for (var j = 0; j < revealed.length; j++) if (self._matches(id, revealed[j], cell)) okIds.push(revealed[j].id);
      if (okIds.length) out.push({ x: cell.x, y: cell.y, key: cellKey(cell.x, cell.y), cardIds: okIds, occupied: cell.pawn === otherPlayer(id) });
    }
    return out;
  };

  Game.prototype.move = function (id, x, y, cardId) {
    var s = this.state;
    this._assertAction('move', id);
    var pc = this.pawnCell(id);
    var dest = s.grid[x][y];
    var legal = moveDestinations(pc.x, pc.y, s.moveModifier).some(function (d) { return d[0] === x && d[1] === y; });
    if (!legal) throw new Error('Casella non raggiungibile con questo movimento.');
    var card = findCard(this.availableRevealed(id), cardId);
    if (!card || !this._matches(id, card, dest)) throw new Error('Carta non valida per questa casella.');
    removeCard(s.players[id].hand, cardId);

    // Potere fighter: qualifica sulla PRIMA azione di movimento del turno.
    var isFighterFirst = s.modules.powers && s.players[id].character === 'fighter' && !s.players[id].fighterFirstMoveDone;

    if (dest.pawn === otherPlayer(id)) {
      if (isFighterFirst) { s.players[id].fighterFirstMoveDone = true; s.players[id].fighterQualified = true; } // ha abbinato la pedina avversaria
      s.subPhase = 'clash-cards';
      s.pendingClash = { attackerId: id, defenderId: otherPlayer(id), x: x, y: y, moveCard: card,
                         attackerCardId: null, defenderCardId: null, whoChooses: id };
      this._log(id + ' attacca ' + otherPlayer(id) + ' su [' + x + ',' + y + '] → clash.');
      return { type: 'clash' };
    }

    var info = this._applyArrival(id, dest, card);
    if (isFighterFirst) { s.players[id].fighterFirstMoveDone = true; if (info.figureEliminated) s.players[id].fighterQualified = true; }
    this._chain = [this._step_afterMove(id)];
    if (info.figureEliminated) this._postFigureDraw(id);
    this._advanceChain();
    return { type: 'moved' };
  };

  Game.prototype.passMove = function (id) {
    this._assertAction('move', id);
    if (this.state.modules.powers && this.state.players[id].character === 'fighter') this.state.players[id].fighterFirstMoveDone = true;
    this._log(id + ' non muove (passa).');
    this._afterMoveAction(id);
  };

  // Effetti d'arrivo (movimento VOLONTARIO). Ritorna {figureEliminated}.
  Game.prototype._applyArrival = function (id, cell, moveCard) {
    var s = this.state, p = s.players[id];
    var from = this.pawnCell(id); if (from) from.pawn = null;
    var figureEliminated = false;

    // moveCard può essere null (potere brawler: le 3 carte sono già state scartate → nessun trophy).
    if (cell.faceDown) {
      cell.pawn = id;
      // Anche su una carta coperta, raggiungere la riga-bersaglio con un movimento
      // volontario dà +5 e fa terminare la partita (§5.2/§7).
      if (isTargetCell(id, cell)) {
        p.score += 5; s.endTriggered = true;
        this._log(id + ' entra su carta coperta [' + cell.x + ',' + cell.y + '] sulla RIGA-BERSAGLIO: +5. Fine partita a fine round.');
      } else {
        this._log(id + ' entra su [' + cell.x + ',' + cell.y + '] (carta coperta, nessun punto).');
      }
      if (moveCard) this._discard(moveCard);
      return { figureEliminated: false };
    }
    var gotTrophy = false;
    if (isCenter(cell.x, cell.y)) {
      p.score += 5; p.matchedCenter = true; if (moveCard) p.trophies.push(moveCard); cell.faceDown = true; gotTrophy = true;
      this._log(id + ' conquista il CENTRO: +5 (una tantum).');
    } else {
      if (Deck.isFigure(cell.card)) {
        var pts = Deck.figurePoints(cell.card);
        p.score += pts; p.figuresMatched += 1; if (moveCard) p.trophies.push(moveCard); cell.faceDown = true; gotTrophy = true; figureEliminated = true;
        this._log(id + ' abbina la figura ' + cell.card.value + ' su [' + cell.x + ',' + cell.y + ']: +' + pts + '.');
      }
      if (isTargetCell(id, cell)) { p.score += 5; s.endTriggered = true; this._log(id + ' raggiunge la RIGA-BERSAGLIO: +5. Fine partita a fine round.'); }
    }
    cell.pawn = id;
    if (!gotTrophy && !isCenter(cell.x, cell.y) && !isTargetCell(id, cell)) this._log(id + ' muove su [' + cell.x + ',' + cell.y + '].');
    if (!gotTrophy && moveCard) this._discard(moveCard); // carte non-trophy → scarti
    return { figureEliminated: figureEliminated };
  };

  // ================================================================== CLASH
  Game.prototype.clashChoices = function (id) { return this.state.pendingClash ? this.availableRevealed(id) : []; };
  Game.prototype.clashCurrentChooser = function () { return this.state.pendingClash ? this.state.pendingClash.whoChooses : null; };

  Game.prototype.clashChoose = function (id, cardId) {
    var s = this.state, pc = s.pendingClash;
    if (!pc || s.subPhase !== 'clash-cards') throw new Error('Nessun clash in corso.');
    if (pc.whoChooses !== id) throw new Error('Non è il turno di ' + id + ' nel clash.');
    if (!findCard(this.availableRevealed(id), cardId)) throw new Error('Carta non disponibile.');
    if (id === pc.attackerId) { pc.attackerCardId = cardId; pc.whoChooses = pc.defenderId; }
    else { pc.defenderCardId = cardId; pc.whoChooses = null; }
    if (pc.attackerCardId && pc.defenderCardId) this._resolveClash();
  };

  Game.prototype._resolveClash = function () {
    var s = this.state, pc = s.pendingClash;
    var attCard = removeCard(s.players[pc.attackerId].hand, pc.attackerCardId);
    var defCard = removeCard(s.players[pc.defenderId].hand, pc.defenderCardId);
    this._discard(attCard); this._discard(defCard); // le carte del clash vanno agli scarti
    var outcome = resolveClash(attCard, defCard);
    this._log('Clash: ' + pc.attackerId + ' ' + attCard.value + attCard.suit[0].toUpperCase() +
      ' vs ' + pc.defenderId + ' ' + defCard.value + defCard.suit[0].toUpperCase() + ' → ' + outcome + '.');
    var self = this, dest = s.grid[pc.x][pc.y], attackerId = pc.attackerId;

    if (outcome === 'tie') { this._discard(pc.moveCard); this._chain = [this._step_finishClashMove(attackerId)]; this._advanceChain(); return; }

    if (outcome === 'attacker') {
      var info = this._applyArrival(pc.attackerId, dest, pc.moveCard);
      this._chain = [
        this._step_openReloc(pc.defenderId, pc.defenderId, { x: pc.x, y: pc.y }, false),
        this._step_finishClashMove(attackerId)
      ];
      if (info.figureEliminated) this._postFigureDraw(pc.attackerId);
      this._advanceChain();
    } else {
      this._discard(pc.moveCard); // l'attaccante non arriva: la carta di movimento va agli scarti
      var attCell = this.pawnCell(pc.attackerId);
      this._chain = [
        this._step_openReloc(pc.defenderId, pc.attackerId, { x: attCell.x, y: attCell.y }, true),
        this._step_finishClashMove(attackerId)
      ];
      this._advanceChain();
    }
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

  // Destinazioni di uno spostamento forzato: ortogonali, escluse centro/occupate/distrutte.
  Game.prototype._relocationOptions = function (x, y) {
    var s = this.state, out = [], nb = orthogonalNeighbors(x, y);
    for (var i = 0; i < nb.length; i++) {
      var cx = nb[i][0], cy = nb[i][1], cell = s.grid[cx][cy];
      if (isCenter(cx, cy) || cell.pawn || cell.destroyed) continue;
      out.push({ x: cx, y: cy, key: cellKey(cx, cy) });
    }
    return out;
  };
  Game.prototype.relocationOptions = function () {
    var s = this.state;
    if (s.subPhase === 'clash-reloc' && s.pendingClash) return this._relocationOptions(s.pendingClash.relocateFrom.x, s.pendingClash.relocateFrom.y);
    if (s.subPhase === 'forced-reloc' && s.pendingForced) return this._relocationOptions(s.pendingForced.from.x, s.pendingForced.from.y);
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
    this._log(pawnId + ' spinto su [' + x + ',' + y + '] (spostamento forzato, nessun punto).');
    if (isTargetCell(pawnId, cell)) { s.endTriggered = true; this._log(pawnId + ' finisce sulla RIGA-BERSAGLIO (forzato): fine partita a fine round.'); }
  };

  // ================================================================== ATTACK
  Game.prototype._beginAttackPhase = function () {
    this.state.phase = 'attack';
    this._log('Fase di attacco; inizia ' + this.state.firstPlayer + '.');
    this._beginAttackSegment(this.state.firstPlayer);
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
    if (s.activePlayer === s.firstPlayer) this._beginAttackSegment(otherPlayer(s.firstPlayer));
    else this._endRound();
  };
  Game.prototype._afterAttackAction = function (id) {
    var s = this.state;
    s.actionsLeft -= 1; s.attackModifier = null;
    this._promptAttack();
  };

  Game.prototype.legalShots = function (id) {
    var s = this.state, revealed = this.availableRevealed(id), self = this, out = [];
    for (var x = 1; x <= 5; x++) for (var y = 1; y <= 5; y++) {
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
    var mod = s.attackModifier;
    var info = this._applyShot(id, cell, card, mod === 'homing');

    var chain = [];
    if (mod === 'homing') chain.push(this._step_homing(id, cell));
    else if (mod === 'hook' && info.hitOpponentPawn) chain.push(this._step_hook(id, cell));
    if (info.figureEliminated && this._drawObject(id) === 'over') chain.push(this._step_openDiscard(id));
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
  Game.prototype._applyShot = function (id, cell, shootCard, isHoming) {
    var p = this.state.players[id];
    var oppOnCell = cell.pawn && cell.pawn !== id;
    if (cell.faceDown || cell.destroyed || !cell.card) {
      if (oppOnCell && !cell.destroyed) { p.score += 5; this._log(id + ' colpisce la pedina avversaria (carta coperta): +5.'); }
      if (shootCard) this._discard(shootCard);
      return { figureEliminated: false, hitOpponentPawn: oppOnCell && !cell.destroyed };
    }
    var gained = 0, trophy = false, figureEliminated = false;
    if (oppOnCell) gained += 5;
    if (Deck.isFigure(cell.card)) {
      var pts = Deck.figurePoints(cell.card);
      gained += pts; p.figuresMatched += 1; if (shootCard) p.trophies.push(shootCard); cell.faceDown = true; trophy = shootCard ? true : false; figureEliminated = true;
    }
    p.score += gained;
    if (oppOnCell && trophy) this._log(id + ' DOUBLE KILL su [' + cell.x + ',' + cell.y + ']: +5 pedina e +' + Deck.figurePoints(cell.card) + ' figura.');
    else if (oppOnCell) this._log(id + ' colpisce la pedina avversaria su [' + cell.x + ',' + cell.y + ']: +5.');
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
      cell.card = null; cell.faceDown = false; cell.destroyed = true;
      self._log(id + ' HOMING MISSILE: distrugge la cella [' + cell.x + ',' + cell.y + '].');
      if (hadPawn) {
        var opts = self._relocationOptions(cell.x, cell.y);
        if (opts.length) {
          self.state.subPhase = 'forced-reloc';
          self.state.pendingForced = { kind: 'homing', pawnId: hadPawn, chooserId: hadPawn, from: { x: cell.x, y: cell.y }, optional: false };
        } else { self._log('Nessuna destinazione: la pedina resta ferma.'); }
      }
    };
  };
  // Passo hook: il tiratore può spostare la pedina avversaria colpita.
  Game.prototype._step_hook = function (id, cell) {
    var self = this;
    return function () {
      if (!(cell.pawn && cell.pawn !== id)) return;
      var opts = self._relocationOptions(cell.x, cell.y);
      if (!opts.length) return;
      self.state.subPhase = 'forced-reloc';
      self.state.pendingForced = { kind: 'hook', pawnId: cell.pawn, chooserId: id, from: { x: cell.x, y: cell.y }, optional: true };
    };
  };

  Game.prototype.forcedRelocate = function (x, y) {
    var s = this.state, pf = s.pendingForced;
    if (!pf || s.subPhase !== 'forced-reloc') throw new Error('Nessuno spostamento forzato in corso.');
    if (!this._relocationOptions(pf.from.x, pf.from.y).some(function (o) { return o.x === x && o.y === y; })) throw new Error('Destinazione non valida.');
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
  Game.prototype.usableObjects = function (playerId) {
    var s = this.state;
    if (s.gameOver || !s.modules.objects || s.subPhase) return [];
    var objs = s.players[playerId].objects;
    if (s.phase === 'select') {
      if (s.selected[playerId] != null || s.selectObjectUsed[playerId]) return [];
      return objs.filter(function (o) { return o.phase === 'select' && !(o.type === 'timebomb' && s.suitMode !== 'rotating'); });
    }
    if (s.phase === 'move') {
      if (s.activePlayer !== playerId || s.actionsLeft <= 0 || s.moveModifier) return [];
      return objs.filter(function (o) { return o.phase === 'move'; });
    }
    if (s.phase === 'attack') {
      if (s.activePlayer !== playerId || s.actionsLeft <= 0 || s.attackModifier) return [];
      return objs.filter(function (o) {
        if (o.phase !== 'attack') return false;
        if (o.type === 'randomizer' && s.deck.length === 0) return false; // solo se il mazzo ha carte
        return true;
      });
    }
    return [];
  };

  Game.prototype.useObject = function (playerId, objectId, params) {
    var s = this.state; params = params || {};
    if (!s.modules.objects) throw new Error('Modulo Oggetti non attivo.');
    var obj = this.usableObjects(playerId).filter(function (o) { return o.id === objectId; })[0];
    if (!obj) throw new Error('Oggetto non utilizzabile ora.');

    removeCard(s.players[playerId].objects, objectId); // usato una volta
    this._log(playerId + ' usa ' + obj.type + '.');

    switch (obj.type) {
      case 'jetpack': s.moveModifier = 'jetpack'; break;                 // armato per il movimento
      case 'jump': s.moveModifier = 'jump'; break;
      case 'hook': s.attackModifier = 'hook'; break;                     // armato per l'attacco
      case 'homing_missile': s.attackModifier = 'homing'; break;
      case 'rush_juice': s.players[playerId].pendingActions = { moves: 2, attacks: 0 }; s.selectObjectUsed[playerId] = true; break;
      case 'combat_juice': s.players[playerId].pendingActions = { moves: 0, attacks: 2 }; s.selectObjectUsed[playerId] = true; break;
      case 'timebomb':
        s.selectObjectUsed[playerId] = true;
        if (params.suit && Deck.SUITS.indexOf(params.suit) !== -1) { s.currentSuit = params.suit; this._log('Timebomb: seme di turno → ' + params.suit + '.'); }
        else { s.subPhase = 'timebomb-suit'; s.pendingTimebomb = { playerId: playerId }; } // la UI chiede il seme
        break;
      // Oggetti d'attacco interattivi: avviano un sotto-flusso e "consumano" l'azione d'attacco.
      case 'elemental_bomb': s.subPhase = 'elemental-target'; s.pendingElemental = { playerId: playerId }; break;
      case 'barrage': s.subPhase = 'barrage-first'; s.pendingBarrage = { playerId: playerId, first: null }; break;
      case 'randomizer': s.subPhase = 'randomizer-select'; s.pendingRandomizer = { playerId: playerId, chosen: [], drawn: null, placed: {} }; break;
    }
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
    if (s.objectDeck.length === 0) { this._log('Mazzo Oggetti vuoto: nessuna pesca.'); return 'empty'; }
    var obj = s.objectDeck.shift();
    s.players[playerId].objects.push(obj);
    this._log(playerId + ' elimina una figura e pesca un oggetto: ' + obj.type + '.');
    return nonCharObjects(s.players[playerId]).length > OBJECT_LIMIT ? 'over' : 'ok';
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
    this._log(playerId + ' scarta l\'oggetto ' + obj.type + ' (limite oggetti).');
    s.pendingObjectDiscard = null; s.subPhase = null;
    this._advanceChain();
  };

  // ================================================================== POTERI PERSONAGGIO (§12)
  // Tactician: scartando un oggetto apre tutte le carte in mano (usa anche le non scelte).
  Game.prototype.canActivatePower = function (playerId) {
    var s = this.state, p = s.players[playerId];
    if (!s.modules.powers || s.subPhase || p.character !== 'tactician' || p.tacticianOpen) return false;
    if (!s.modules.objects || !p.objects.length) return false; // serve un oggetto da scartare
    return (s.phase === 'move' || s.phase === 'attack') && s.activePlayer === playerId && s.actionsLeft > 0;
  };
  Game.prototype.activatePower = function (playerId, objectId) {
    if (!this.canActivatePower(playerId)) throw new Error('Potere non attivabile ora.');
    var p = this.state.players[playerId];
    var obj = objectId ? findCard(p.objects, objectId) : p.objects[0];
    if (!obj) throw new Error('Nessun oggetto da scartare.');
    removeCard(p.objects, obj.id);
    p.tacticianOpen = true;
    this._log(playerId + ' (tactician) scarta ' + obj.type + ': ora usa anche le carte non scelte.');
  };

  // Brawler: scarta 3 carte disponibili per abbinare QUALSIASI cella (rinuncia a un'azione).
  Game.prototype.canBrawler = function (playerId) {
    var s = this.state, p = s.players[playerId];
    if (!s.modules.powers || s.subPhase || p.character !== 'brawler') return false;
    if (s.activePlayer !== playerId || s.actionsLeft <= 0) return false;
    if (s.phase !== 'move' && s.phase !== 'attack') return false;
    return this.availableRevealed(playerId).length >= 3;
  };
  Game.prototype.brawlerTargets = function (playerId) {
    var s = this.state, out = [];
    if (!this.canBrawler(playerId)) return out;
    if (s.phase === 'move') {
      var pc = this.pawnCell(playerId);
      moveDestinations(pc.x, pc.y, s.moveModifier).forEach(function (d) {
        var cell = s.grid[d[0]][d[1]];
        if (cell.destroyed || cell.pawn === otherPlayer(playerId)) return; // no distrutte, no clash (0 carte)
        out.push({ x: d[0], y: d[1], key: cellKey(d[0], d[1]) });
      });
    } else {
      for (var x = 1; x <= 5; x++) for (var y = 1; y <= 5; y++) if (!s.grid[x][y].destroyed) out.push({ x: x, y: y, key: cellKey(x, y) });
    }
    return out;
  };
  Game.prototype.brawlerAction = function (playerId, x, y) {
    var s = this.state, self = this;
    if (!this.canBrawler(playerId)) throw new Error('Potere brawler non disponibile.');
    if (!this.brawlerTargets(playerId).some(function (t) { return t.x === x && t.y === y; })) throw new Error('Bersaglio non valido.');
    var avail = this.availableRevealed(playerId).slice();
    avail.forEach(function (c) { removeCard(s.players[playerId].hand, c.id); self._discard(c); });
    this._log(playerId + ' (brawler) scarta 3 carte per abbinare qualsiasi cella.');
    var cell = s.grid[x][y];
    if (s.phase === 'move') {
      var info = this._applyArrival(playerId, cell, null); // moveCard null → nessun trophy
      this._chain = [this._step_afterMove(playerId)];
      if (info.figureEliminated) this._postFigureDraw(playerId);
      this._advanceChain();
    } else {
      var info2 = this._applyShot(playerId, cell, null, false);
      this._chain = [];
      if (info2.figureEliminated && this._drawObject(playerId) === 'over') this._chain.push(this._step_openDiscard(playerId));
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
    for (var x = 1; x <= 5; x++) for (var y = 1; y <= 5; y++) { var c = s.grid[x][y]; if (!c.destroyed && c.card) out.push({ x: x, y: y, key: cellKey(x, y) }); }
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
    var pe = s.pendingElemental, cells = [[pe.x, pe.y]].concat(orthogonalNeighbors(pe.x, pe.y)), changed = 0;
    cells.forEach(function (d) { var c = s.grid[d[0]][d[1]]; if (!c.destroyed && c.card) { c.card.suit = suit; changed++; } });
    this._log(pe.playerId + ' usa Elemental Bomb su [' + pe.x + ',' + pe.y + ']: ' + changed + ' celle → seme ' + suit + '.');
    var pid = pe.playerId; s.pendingElemental = null; s.subPhase = null;
    this._afterAttackAction(pid);
  };

  // ---- Barrage ----
  Game.prototype.barrageFirstOptions = function () {
    var s = this.state, out = [];
    if (s.subPhase !== 'barrage-first') return out;
    for (var x = 1; x <= 5; x++) for (var y = 1; y <= 5; y++) { if (!s.grid[x][y].destroyed) out.push({ x: x, y: y, key: cellKey(x, y) }); }
    return out;
  };
  Game.prototype.barrageFirst = function (x, y) {
    var s = this.state;
    if (s.subPhase !== 'barrage-first') throw new Error('Nessun barrage in corso.');
    if (s.grid[x][y].destroyed) throw new Error('Cella non valida.');
    s.pendingBarrage.first = { x: x, y: y }; s.subPhase = 'barrage-second';
  };
  Game.prototype.barrageSecondOptions = function () {
    var s = this.state, out = [];
    if (s.subPhase !== 'barrage-second' || !s.pendingBarrage.first) return out;
    var f = s.pendingBarrage.first;
    orthogonalNeighbors(f.x, f.y).forEach(function (d) {
      var c = s.grid[d[0]][d[1]];
      if (isCenter(d[0], d[1]) || c.pawn || c.destroyed) return; // no centro, no pedina, no distrutte
      out.push({ x: d[0], y: d[1], key: cellKey(d[0], d[1]) });
    });
    return out;
  };
  Game.prototype.barrageSecond = function (x, y) {
    var s = this.state;
    if (s.subPhase !== 'barrage-second') throw new Error('Nessun barrage in corso.');
    if (!this.barrageSecondOptions().some(function (o) { return o.x === x && o.y === y; })) throw new Error('Seconda cella non valida.');
    var f = s.pendingBarrage.first, pid = s.pendingBarrage.playerId;
    var c1 = s.grid[f.x][f.y], c2 = s.grid[x][y], pawn1 = c1.pawn;
    this._log(pid + ' usa Barrage: distrugge [' + f.x + ',' + f.y + '] e [' + x + ',' + y + '].');
    c1.card = null; c1.faceDown = false; c1.destroyed = true;
    c2.card = null; c2.faceDown = false; c2.destroyed = true;
    s.pendingBarrage = null; s.subPhase = null;
    this._chain = [];
    if (pawn1) this._chain.push(this._step_relocatePawn(pawn1, { x: f.x, y: f.y }));
    this._chain.push(this._step_afterAttack(pid));
    this._advanceChain();
  };

  // ---- Randomizer ----
  Game.prototype.randomizerSelectOptions = function () {
    var s = this.state, out = [];
    if (s.subPhase !== 'randomizer-select') return out;
    for (var x = 1; x <= 5; x++) for (var y = 1; y <= 5; y++) { var c = s.grid[x][y]; if (!isCenter(x, y) && !c.destroyed && c.card) out.push({ x: x, y: y, key: cellKey(x, y) }); }
    return out;
  };
  Game.prototype.randomizerToggle = function (x, y) {
    var s = this.state, pr = s.pendingRandomizer;
    if (s.subPhase !== 'randomizer-select') throw new Error('Nessun randomizer in corso.');
    var c = s.grid[x][y]; if (isCenter(x, y) || c.destroyed || !c.card) throw new Error('Cella non valida.');
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
    this._log(pid + ' completa il Randomizer.');
    s.pendingRandomizer = null; s.subPhase = null;
    this._afterAttackAction(pid);
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
    ['N', 'S'].forEach(function (id) {
      var p = s.players[id];
      // Le carte rivelate non usate vanno agli scarti; restano le 3 non rivelate.
      p.hand = p.hand.filter(function (c) {
        if (p.revealedIds.indexOf(c.id) !== -1) { self._discard(c); return false; }
        return true;
      });
      p.revealedIds = []; p.revealedCards = [];
      p.pendingActions = { moves: 1, attacks: 1 };
      // Reset dei poteri personaggio a fine round.
      p.tacticianOpen = false; p.fighterFirstMoveDone = false; p.fighterBonusUsed = false; p.fighterQualified = false;
    });
    if (s.endTriggered || s.round === 9) { this._finishGame(); return; }

    s.firstPlayer = otherPlayer(s.firstPlayer);
    ['N', 'S'].forEach(function (id) {
      var draw = Math.min(3, s.deck.length);
      for (var i = 0; i < draw; i++) s.players[id].hand.push(s.deck.shift());
    });
    s.round += 1;
    if (s.suitMode === 'rotating') { s.currentSuit = Deck.nextSuit(s.currentSuit); this._log('Il seme di turno avanza a ' + s.currentSuit + '.'); }
    this._log('— Fine round. Primo Giocatore: ' + s.firstPlayer + '. Mazzo: ' + s.deck.length + ' carte.');
    this._beginSelectPhase();
  };

  Game.prototype._finishGame = function () {
    var s = this.state;
    s.gameOver = true; s.phase = 'end'; s.subPhase = null;
    s.result = computeResult(s);
    this._log('=== FINE PARTITA === ' + s.result.summary);
  };

  function computeResult(s) {
    var N = s.players.N, S = s.players.S;
    var res = { winner: null, tiebreak: null, scores: { N: N.score, S: S.score }, summary: '' };
    if (N.score !== S.score) { res.winner = N.score > S.score ? 'N' : 'S'; res.summary = 'Vince ' + res.winner + ' per punti (' + N.score + '–' + S.score + ').'; return res; }
    if (N.matchedCenter !== S.matchedCenter) { res.winner = N.matchedCenter ? 'N' : 'S'; res.tiebreak = 'centro'; res.summary = 'Parità ' + N.score + '–' + S.score + '. Vince ' + res.winner + ' (ha abbinato il centro).'; return res; }
    if (N.figuresMatched !== S.figuresMatched) { res.winner = N.figuresMatched > S.figuresMatched ? 'N' : 'S'; res.tiebreak = 'figure'; res.summary = 'Parità ' + N.score + '–' + S.score + '. Vince ' + res.winner + ' (più figure: ' + N.figuresMatched + '–' + S.figuresMatched + ').'; return res; }
    res.tiebreak = 'patta'; res.summary = 'Partita PATTA (' + N.score + '–' + S.score + ').'; return res;
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
   'timebombChoose', 'activatePower', 'brawlerAction'
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
    moveDestinations: moveDestinations, isCenter: isCenter, cellKey: cellKey
  };
});

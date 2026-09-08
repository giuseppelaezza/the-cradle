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
      energyExtraDiscard: 0,       // scarti extra a fine turno dovuti a Energy Boost
      reshuffleLeft: 2,            // Modulo Reshuffle: usi rimasti
      reshuffleTotal: 2,           // Modulo Reshuffle: usi totali (da configurazione)
      // Modulo "poteri personaggi" (§12): stato dei poteri.
      // I totali vengono impostati in createGame dal personaggio assegnato (Characters.powerUses).
      tacticianOpen: false,        // tactician: usa anche le carte non scelte (per-round)
      tacticianTotal: 2,           // tactician: attivazioni totali per partita
      tacticianLeft: 2,            // tactician: attivazioni rimaste
      brawlerTotal: 3,             // brawler: attivazioni totali per partita
      brawlerLeft: 3               // brawler: attivazioni rimaste
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

    // Modulo Reshuffle: numero di usi per partita (1-3, default 2).
    var reshuffleCount = opts.reshuffleCount ? Math.max(1, Math.min(3, opts.reshuffleCount | 0)) : 2;
    ['N', 'S'].forEach(function (id) { players[id].reshuffleLeft = reshuffleCount; players[id].reshuffleTotal = reshuffleCount; });

    // 6-7. Personaggi e oggetto iniziale.
    if (modules.characters) {
      ['N', 'S'].forEach(function (id) {
        var type = opts.characters && opts.characters[id];
        var ch = Characters.get(type) || Characters.get('runner');
        players[id].character = ch.type;
        players[id].belongingSuit = ch.suit;
        // Numero di attivazioni del potere per partita (configurabile in characters.js).
        if (ch.type === 'tactician' && ch.powerUses != null) { players[id].tacticianTotal = players[id].tacticianLeft = ch.powerUses | 0; }
        if (ch.type === 'brawler' && ch.powerUses != null) { players[id].brawlerTotal = players[id].brawlerLeft = ch.powerUses | 0; }
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
  // Le carte che escono dal gioco finiscono nella pila degli scarti.
  Game.prototype._discard = function (card) { if (card) this.state.discard.push(card); };
  Game.prototype.getCell = function (x, y) { return this.state.grid[x][y]; };

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

  // Match tenendo conto dei poteri personaggio.
  // Runner (in MOVIMENTO) e Fighter (in ATTACCO): abbinano le carte PARI tra di loro
  // (una carta pari in mano abbina una casella scoperta di valore pari).
  Game.prototype._matches = function (playerId, card, cell) {
    var s = this.state, p = s.players[playerId];
    if (canMatch(card, cell, s.currentSuit, p.belongingSuit)) return true;
    if (s.modules.powers && cell && !cell.destroyed && cell.card && !cell.faceDown &&
        (card.value % 2 === 0) && (cell.card.value % 2 === 0)) {
      if (p.character === 'runner' && s.phase === 'move') return true;
      if (p.character === 'fighter' && s.phase === 'attack') return true;
    }
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
    var s = this.state;
    s.actionsLeft -= 1;
    s.moveModifier = null;
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

    if (dest.pawn === otherPlayer(id)) {
      s.subPhase = 'clash-cards';
      s.pendingClash = { attackerId: id, defenderId: otherPlayer(id), x: x, y: y, moveCard: card,
                         attackerCardId: null, defenderCardId: null, whoChooses: id };
      this._log(id + ' attacca ' + otherPlayer(id) + ' su [' + x + ',' + y + '] → clash.');
      this._clashAdvanceAuto(); // chi non ha carte disponibili non contesta (perde di default)
      return { type: 'clash' };
    }

    var info = this._applyArrival(id, dest, card);
    this._chain = [this._step_afterMove(id)];
    if (info.figureEliminated) this._postFigureDraw(id);
    this._advanceChain();
    return { type: 'moved' };
  };

  Game.prototype.passMove = function (id) {
    this._assertAction('move', id);
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
    this._clashAdvanceAuto();
  };

  // Assegna automaticamente "nessuna carta" a chi, nel clash, non ha carte rivelate disponibili
  // (le ha già spese in figure/centro): non contesta e perde di default. Risolve quando entrambe le scelte ci sono.
  Game.prototype._clashAdvanceAuto = function () {
    var s = this.state, pc = s.pendingClash;
    if (!pc || s.subPhase !== 'clash-cards') return;
    while (pc.whoChooses) {
      var chooser = pc.whoChooses;
      if (this.availableRevealed(chooser).length > 0) break; // serve una scelta reale: lascia il prompt
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
    function lbl(c) { return c ? (c.value + c.suit[0].toUpperCase()) : '—'; }
    this._log('Clash: ' + pc.attackerId + ' ' + lbl(attCard) + ' vs ' + pc.defenderId + ' ' + lbl(defCard) + ' → ' + outcome + '.');
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

  // Destinazioni di uno spostamento forzato: escluse centro/occupate/distrutte.
  // diag=true aggiunge le diagonali (usato dall'hook, che sposta in tutte le direzioni).
  Game.prototype._relocOptions = function (x, y, diag) {
    var s = this.state, out = [], nb = orthogonalNeighbors(x, y);
    if (diag) nb = nb.concat(diagonalNeighbors(x, y));
    for (var i = 0; i < nb.length; i++) {
      var cx = nb[i][0], cy = nb[i][1], cell = s.grid[cx][cy];
      if (isCenter(cx, cy) || cell.pawn || cell.destroyed) continue;
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
        // Homing: è il TIRATORE a decidere dove spostare la pedina avversaria colpita.
        var opts = self._relocationOptions(cell.x, cell.y);
        if (opts.length) {
          self.state.subPhase = 'forced-reloc';
          self.state.pendingForced = { kind: 'homing', pawnId: hadPawn, chooserId: id, from: { x: cell.x, y: cell.y }, optional: false };
        } else { self._log('Nessuna destinazione: la pedina resta ferma.'); }
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
  // Costo di jetpack/jump: scarta una delle carte SCELTE (rivelate) — la più bassa.
  Game.prototype._extraDiscardForTool = function (playerId) {
    var p = this.state.players[playerId];
    var avail = this.availableRevealed(playerId);
    if (avail.length < 2) return;
    var card = avail.slice().sort(function (a, b) { return a.value - b.value; })[0];
    removeCard(p.hand, card.id);
    var ri = p.revealedIds.indexOf(card.id); if (ri !== -1) p.revealedIds.splice(ri, 1);
    this._discard(card);
    this._log(playerId + ' scarta una carta scelta (' + card.value + card.suit[0].toUpperCase() + ') come costo dell\'oggetto.');
  };

  Game.prototype.usableObjects = function (playerId) {
    var s = this.state, self = this;
    if (s.gameOver || !s.modules.objects || s.subPhase) return [];
    var objs = s.players[playerId].objects;
    if (s.phase === 'select') {
      if (s.selected[playerId] != null || s.selectObjectUsed[playerId]) return [];
      return objs.filter(function (o) { return objInPhase(o, 'select') && !(o.type === 'timebomb' && s.suitMode !== 'rotating'); });
    }
    if (s.phase === 'move' || s.phase === 'attack') {
      var mod = s.phase === 'move' ? s.moveModifier : s.attackModifier;
      if (s.activePlayer !== playerId || s.actionsLeft <= 0) return [];
      return objs.filter(function (o) {
        if (!objInPhase(o, s.phase)) return false;
        // Un modificatore già armato (jetpack/jump/hook/homing) blocca altri oggetti-modificatore, non gli "immediati".
        if (mod && o.type !== 'energy_boost' && o.type !== 'energy_drain') return false;
        if ((o.type === 'jetpack' || o.type === 'jump') && !self._canPayToolCost(playerId)) return false; // serve una carta scelta extra da scartare
        if (o.type === 'randomizer' && s.deck.length === 0 && s.discard.length === 0) return false; // serve almeno una carta
        if (o.type === 'energy_boost' && s.deck.length === 0 && s.discard.length === 0) return false; // niente da pescare
        if (o.type === 'energy_drain' && s.players[otherPlayer(playerId)].hand.length === 0) return false; // niente da rubare
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
      case 'jetpack': this._extraDiscardForTool(playerId); s.moveModifier = 'jetpack'; break; // costo: scarta una carta extra
      case 'jump': this._extraDiscardForTool(playerId); s.moveModifier = 'jump'; break;
      case 'hook': s.attackModifier = 'hook'; break;                     // armato per l'attacco
      case 'homing_missile': s.attackModifier = 'homing'; break;
      case 'rush_juice': s.players[playerId].pendingActions = { moves: 2, attacks: 0 }; s.selectObjectUsed[playerId] = true; break;
      case 'combat_juice': s.players[playerId].pendingActions = { moves: 0, attacks: 2 }; s.selectObjectUsed[playerId] = true; break;
      case 'timebomb':
        s.selectObjectUsed[playerId] = true;
        if (params.suit && Deck.SUITS.indexOf(params.suit) !== -1) { s.currentSuit = params.suit; this._log('Timebomb: seme di turno → ' + params.suit + '.'); }
        else { s.subPhase = 'timebomb-suit'; s.pendingTimebomb = { playerId: playerId }; } // la UI chiede il seme
        break;
      // Oggetti "energetici" (movimento o attacco): effetto immediato, non consumano l'azione né armano modificatori.
      case 'energy_boost': {
        var p = s.players[playerId], drew = [];
        for (var eb = 0; eb < 2; eb++) { var c = this._drawCard(); if (c) { p.hand.push(c); p.revealedIds.push(c.id); drew.push(c); } }
        p.energyExtraDiscard = (p.energyExtraDiscard || 0) + 2;
        this._log(playerId + ' usa Energy Boost: pesca ' + drew.length + ' carte (usabili ora; 2 scarti extra a fine turno).');
        break;
      }
      case 'energy_drain': {
        var me = s.players[playerId], opp = s.players[otherPlayer(playerId)];
        if (opp.hand.length) {
          // Preferisci rubare una carta NON rivelata dell'avversario, altrimenti una qualsiasi.
          var pool = opp.hand.filter(function (cc) { return opp.revealedIds.indexOf(cc.id) === -1; });
          if (!pool.length) pool = opp.hand;
          var pick = pool[Math.floor((this._rng || Math.random)() * pool.length)];
          removeCard(opp.hand, pick.id);
          var ri = opp.revealedIds.indexOf(pick.id); if (ri !== -1) opp.revealedIds.splice(ri, 1);
          // Rimuovi la carta rubata anche dallo snapshot pubblico (preview della scheda): sparisce dalla mano avversaria.
          opp.revealedCards = opp.revealedCards.filter(function (c) { return c && c.id !== pick.id; });
          me.hand.push(pick); me.revealedIds.push(pick.id);
          this._log(playerId + ' usa Energy Drain: ruba una carta dalla mano di ' + otherPlayer(playerId) + ' (usabile ora).');
        } else this._log(playerId + ' usa Energy Drain: l\'avversario non ha carte.');
        break;
      }
      // Oggetti d'attacco interattivi: avviano un sotto-flusso e "consumano" l'azione d'attacco.
      case 'elemental_bomb': s.subPhase = 'elemental-target'; s.pendingElemental = { playerId: playerId }; break;
      case 'barrage': s.subPhase = 'barrage-first'; s.pendingBarrage = { playerId: playerId, first: null, second: null }; break;
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
  // Tactician: apre tutte le carte in mano (usa anche le non scelte). Attivabile al massimo 2 volte per partita.
  Game.prototype.canActivatePower = function (playerId) {
    var s = this.state, p = s.players[playerId];
    if (!s.modules.powers || s.subPhase || p.character !== 'tactician' || p.tacticianOpen) return false;
    if (!(p.tacticianLeft > 0)) return false; // esaurite le attivazioni della partita
    return (s.phase === 'move' || s.phase === 'attack') && s.activePlayer === playerId && s.actionsLeft > 0;
  };
  Game.prototype.activatePower = function (playerId) {
    if (!this.canActivatePower(playerId)) throw new Error('Potere non attivabile ora.');
    var p = this.state.players[playerId];
    p.tacticianOpen = true;
    p.tacticianLeft -= 1;
    this._log(playerId + ' (tactician) apre tutte le carte in mano (attivazioni rimaste: ' + p.tacticianLeft + ').');
  };

  // Brawler: scarta 3 carte disponibili per abbinare QUALSIASI cella (rinuncia a un'azione).
  Game.prototype.canBrawler = function (playerId) {
    var s = this.state, p = s.players[playerId];
    if (!s.modules.powers || s.subPhase || p.character !== 'brawler') return false;
    if (!(p.brawlerLeft > 0)) return false; // esaurite le attivazioni della partita
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
    s.players[playerId].brawlerLeft -= 1;
    this._log(playerId + ' (brawler) scarta 3 carte per abbinare qualsiasi cella (attivazioni rimaste: ' + s.players[playerId].brawlerLeft + ').');
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
    s.pendingBarrage.first = { x: x, y: y };
    // Se la prima cella non ha vicini validi, si risolve con la sola prima (fallback anti-blocco).
    if (this._barrageNextOptions([s.pendingBarrage.first]).length === 0) this._barrageResolve();
    else s.subPhase = 'barrage-second';
  };
  // Celle valide adiacenti (ortogonali) a una qualsiasi delle celle già scelte (esclusi centro/pedina/distrutte/già scelte).
  Game.prototype._barrageNextOptions = function (anchors) {
    var s = this.state, out = [], seen = {};
    anchors.forEach(function (a) { if (a) seen[cellKey(a.x, a.y)] = true; });
    anchors.forEach(function (a) {
      if (!a) return;
      orthogonalNeighbors(a.x, a.y).forEach(function (d) {
        var k = cellKey(d[0], d[1]), c = s.grid[d[0]][d[1]];
        if (seen[k]) return;
        if (isCenter(d[0], d[1]) || c.pawn || c.destroyed) return;
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
    // Se non esiste una terza cella valida, si risolve con le due (fallback anti-blocco).
    if (this._barrageNextOptions([s.pendingBarrage.first, s.pendingBarrage.second]).length === 0) this._barrageResolve();
    else s.subPhase = 'barrage-third';
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
    var cells = [pb.first, pb.second, pb.third].filter(Boolean);
    var pawn1 = s.grid[pb.first.x][pb.first.y].pawn; // solo la 1ª può avere una pedina
    this._log(pid + ' usa Barrage: distrugge ' + cells.map(function (a) { return '[' + a.x + ',' + a.y + ']'; }).join(', ') + '.');
    cells.forEach(function (a) { var c = s.grid[a.x][a.y]; c.card = null; c.faceDown = false; c.destroyed = true; });
    s.pendingBarrage = null; s.subPhase = null;
    this._chain = [];
    if (pawn1) this._chain.push(this._step_relocatePawn(pawn1, { x: pb.first.x, y: pb.first.y }));
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
      // Scarti extra dovuti a Energy Boost (2 per uso).
      var extra = p.energyExtraDiscard || 0;
      var discarded = 0;
      for (var e = 0; e < extra && p.hand.length; e++) { self._discard(p.hand.pop()); discarded++; }
      if (discarded) self._log(id + ' scarta ' + discarded + ' carte extra (Energy Boost).');
      p.energyExtraDiscard = 0;
      p.pendingActions = { moves: 1, attacks: 1 };
      // Reset dei poteri personaggio a fine round.
      p.tacticianOpen = false;
    });
    if (s.endTriggered || s.round === 9) { this._finishGame(); return; }

    s.firstPlayer = otherPlayer(s.firstPlayer);
    ['N', 'S'].forEach(function (id) {
      for (var i = 0; i < 3; i++) { var c = self._drawCard(); if (c) s.players[id].hand.push(c); }
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
    moveDestinations: moveDestinations, isCenter: isCenter, cellKey: cellKey
  };
});

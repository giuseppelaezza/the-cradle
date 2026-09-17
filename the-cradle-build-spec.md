# The Cradle — Specifiche tecniche (build-spec)

> **Fonte di verità delle regole di gioco:** `the-cradle-regolamento.md` (mirror di
> `js/content/regolamento.js`). Questo file traduce le regole in **requisiti implementativi**:
> architettura, modello dati, flusso, invarianti. In caso di dubbio sulle regole prevale il regolamento;
> in caso di dubbio su "dove sta il codice" vedi `CLAUDE.md`.
>
> Stato: **v0.6** — multiplayer 2–4, tre ruleset (A/B/C), griglia 5×5 e 4×4, modalità Draft, moduli
> Personaggi/Oggetti/Poteri/Reshuffle, TOOL con costi machine-readable, SKILL attive+passive per ARM.

---

## 1. Obiettivo e vincoli

Gioco giocabile **hot-seat** e **vs CPU** (e CPU-vs-CPU per test/demo) in **JavaScript vanilla**:
solo HTML+CSS+JS, **nessun framework**, **nessun build step**, avviabile aprendo `index.html` (o via
server statico). Vincolo architetturale: **engine puro e deterministico** (RNG iniettabile, nessun DOM,
interamente testabile) separato dalla **UI**. Priorità: correttezza delle regole e chiarezza dell'UI.

Moduli caricati come **UMD** (`window.CradleXxx` + `module.exports`). Vedi `CLAUDE.md` per la mappa
delle cartelle e l'ordine di caricamento.

---

## 2. Configurazione di partita (`createGame(opts)`)

`opts` (tutti opzionali):

| Campo | Valori | Note |
|---|---|---|
| `rng` | `() => [0,1)` | iniettabile; **default `Math.random`**. I test passano un RNG con seed. |
| `numPlayers` | `2`\|`3`\|`4` | 3–4 **solo** su griglia 5×5. Seggi agli angoli, in senso orario. |
| `ruleset` | `'A'`\|`'B'`\|`'C'` | `B` standard; `A` abbinamento alternativo; `C` (basato su A) con controllo del centro / celle bonus. `altMatch:true` ≡ `A`. |
| `gridSize` | `5`\|`4` | `4` **solo** con ruleset `C`. |
| `gridMode` | `'random'`\|`'draft'` | `draft` = i PILOTI costruiscono la griglia a turno. |
| `suitMode` | `'fixed'`\|`'rotating'` | GLOBAL SUIT fissa o che ruota a ogni ROUND. |
| `turnMode` | `'1221'`\|`'1212'` | ordine di attacco nel multiplayer. |
| `maxRounds` | intero | default 8 (configurabile ~7–11). |
| `clashOnAttack` | bool | attaccare un ARM apre sempre un CLASH. |
| `modules` | `{characters, objects, powers, reshuffle}` | flag indipendenti. |
| `characters` | `{N,S,…}` o `['runner',…]` | tipo di ARM per seggio o per indice. |
| `objectSelection` | `string[]` | forza la composizione del mazzo TOOL (usato dai test). |

Combinazioni moduli: nessuno = base; solo Personaggi = solo ARM SUIT; solo Oggetti = mazzo TOOL senza
ARM SUIT né TOOL iniziale; entrambi = ARM SUIT + TOOL iniziale + mazzo TOOL; `powers` richiede
`characters`.

---

## 3. Modello dei dati (essenziale)

```
Suit       = 'oro' | 'spade' | 'coppe' | 'bastoni'
SUIT_RANK  = { oro:4, spade:3, coppe:2, bastoni:1 }         // spareggio CLASH (ciclico)
Card       = { id, value:1..10, suit:Suit }                 // 8/9/10 = OBIETTIVI (figure)

Cell = { x, y, card:Card|null, faceDown:bool, destroyed:bool, pawn:null|<id> }
       // ONLINE = card && !faceDown && !destroyed ; OFFLINE = card && faceDown ; DISTRUTTA = destroyed

ObjectCard = { id, type, phase, fromCharacter:bool }        // TOOL; fromCharacter esclude dal limite
OBJECT_DEFS[type] = { type, label, phase, phases?, cost, costSpec, effect, overtakeSuit? }
  costSpec keys: stack|reserve|points|consume|regen|tools|forfeit   // costo machine-readable

Character = { type, suit, startObjects[], label, powerUses, power }  // js/model/characters.js

Player = { id, score, hand:Card[], revealedIds[], revealedCards[], trophies[],
           character, belongingSuit, objects[], objectDeck[], objectDiscard[],
           glass, clashBonusTurn, pendingActions:{moves,attacks},
           tacticianLeft/Total, brawlerLeft/Total, runnerLeft/Total, fighterLeft/Total,
           reshuffleLeft/Total, stats:{…} }

GameState = { deck[], grid[x][y], gridSize, ruleset, altMatch, gridMode, numPlayers,
              suitMode, currentSuit, centerInitialSuit, turnMode, maxRounds, clashOnAttack,
              modules, players, firstPlayer, activePlayer, round, phase, actionsLeft,
              moveModifier, attackModifier, subPhase, pending<Xxx>…,
              gameOver, endTriggered, result, log[] }
```

`phase ∈ {select, move, attack, end}`. I sotto-flussi interattivi vivono in `subPhase` con un oggetto
`pending<Xxx>` associato (vedi §5).

---

## 4. Responsabilità dei moduli

- **`core/deck.js`** — carte, `buildDeck`, `shuffle(rng)`, `nextSuit`, `figurePoints`, `isFigure`.
- **`core/suits.js`** — ciclo/spareggio SUIT e icone per la UI.
- **`model/objects.js`** — `OBJECT_DEFS`, `ALL_TYPES`, costruzione/normalizzazione del mazzo TOOL
  personale (12 carte, max 3 copie/tipo), pool selezionabile per ruleset.
- **`model/characters.js`** — `CHARACTERS` (ARM SUIT, TOOL iniziale, `powerUses`, testo `power`).
- **`content/regolamento.js`** — testo del regolamento in-app (markdown). **Fonte di verità delle
  regole**; `the-cradle-regolamento.md` ne è il mirror.
- **`engine/engine.js`** — stato + regole. API pubblica principale: `createGame`, `Game`,
  `canMatch`, `resolveClash`, `computeResult`, helper di griglia. Sul prototipo `Game`: setup,
  `selectCards`, `move`/`shoot`/`passMove`/`passShoot`, `useObject`, attivazioni SKILL
  (`activatePower`/`brawlerAction`/`fighterActivate`/`glassPlace`), e i risolutori dei sotto-flussi
  (`clashChoose`, `rebuild*`, `overtakeChoose`, `fighterSelectCard`, `toolSacrificeChoose`, …).
  **NO DOM, deterministico.**
- **`ai/cpu.js`** — `cpuAct(game, id)`: decide/agisce per un giocatore e risolve ogni `subPhase`.
  Euristiche pure, **NO DOM**.
- **`ui/ui.js`** — `CradleUI.createController(game, opts)`: rendering di HUD/griglia/schede,
  interazioni, modali (CLASH, scelta TOOL, peek), tooltip, il regolamento in-app.
- **`ui/main.js`** — schermata di configurazione e wiring (crea `game` + controller).

---

## 5. Flusso del ROUND e sotto-flussi

Ordine: `select` (DEPLOY) → `move` → `attack` → fine ROUND. Nell'ordine di turno agisce prima il 1°
Pilota, poi gli altri (in attacco l'ordine può invertirsi secondo `turnMode`).

- **select/DEPLOY:** ogni giocatore sceglie 3 carte (STACK ATTIVA); le altre sono STACK DI RISERVA
  (usate nei CLASH). I TOOL di fase `select` (rush/combat juice, timebomb) si usano qui.
- **move / attack:** il giocatore attivo esegue `actionsLeft` azioni; i TOOL della fase e le SKILL si
  usano dal pannello **prima** dell'azione. Entrare/colpire un ARM avversario apre un **CLASH**.
- **fine ROUND:** scarti in eccesso (>6), pesca fino a 6, bonus di SUIT/posizione (ruleset C),
  avanzamento GLOBAL SUIT (se `rotating`), poi ROUND successivo.

**Fine partita:** dopo `maxRounds`, oppure quando `endTriggered` (es. riga-bersaglio nei ruleset A/B),
oppure — **fine anticipata** — quando **a fine ROUND non resta alcuna CELLA ONLINE**. Il vincitore è
determinato da `computeResult` (punti → controllo centro → n° OBIETTIVI).

**Sotto-flussi (`subPhase`)** — ognuno con un `pending<Xxx>` e un risolutore sull'engine. Elenco attuale:
`clash-cards`, `clash-reloc`, `forced-reloc`, `object-discard`, `end-discard`, `tool-discard`,
`tool-sacrifice`, `runner-figure`, `altmatch-object`, `timebomb-suit`, `teleport-select`,
`rebuild-select`/`rebuild-place`, `draft-select`/`draft-place`, `energy-target`, `endbonus-steal`,
`elemental-target`/`elemental-suit`, `barrage-first`/`-second`/`-third`, `randomizer-place`,
`charge-select`, `snipe-select`, `feedback-select`, `swap-target`, `nuke-select`, `shuffle-select`,
`overtake-select`, `fighter-select`.

> **INVARIANTE (vedi CLAUDE.md):** ogni nuovo `subPhase` va gestito in `cpu.js`, in `ui.js`
> (pannello + `onCellClick`/`pickCells`) e nelle **tre** `whoActs` dei test, oltre a dichiarare
> `pending<Xxx>` in `createGame`. Altrimenti CPU/test vanno in stallo.

---

## 6. TOOL (oggetti) e costi

Definizioni in `model/objects.js`. Ogni TOOL ha `phase(s)`, `effect` e `costSpec` machine-readable:

- `stack:N` / `reserve:N` — SCARTA N carte dalla STACK ATTIVA / DI RISERVA.
- `points:N` — PERDI N punti.
- `consume` — solo su CELLA ONLINE; quella CELLA diventa OFFLINE.
- `regen` — **RIGENERA**: solo su CELLA OFFLINE; PESCA 1 e SOVRASCRIVI la CELLA dell'ARM (torna ONLINE).
  Se non è possibile RIGENERARE il TOOL non è utilizzabile.
- `tools:N` — SCARTA N **altri** TOOL (scelta interattiva: `tool-sacrifice`).
- `forfeit:'move'|'attack'` — rinunci al resto di quella fase.

Gating in `_toolCostAffordable`, pagamento in `useObject` (poi `_runToolEffect`). Acquisizione TOOL:
scelta di [1] tra 3 (o 4 per Deep Mind) colpendo un OBIETTIVO / conquistando il centro / entrando in una
CELLA BONUS. Limite di TOOL in mano: 5 (l'iniziale, `fromCharacter`, è escluso).

**Pipeline dati TOOL:** `data/tools.numbers` (fonte, Apple Numbers) → `data/tools.csv` →
`OBJECT_DEFS` (`objects.js`) → tabella nel regolamento (`regolamento.js`). Vedi `CLAUDE.md`.

---

## 7. PILOTI / ARM e SKILL

Ogni ARM ha una **ARM SUIT**, una **SKILL ATTIVA** (usi limitati, `powerUses` in `characters.js`) e una
**SKILL PASSIVA** (sempre attiva). Stato usi in `Player` (`…Left/…Total`); **Encore!** ripristina un uso.

| ARM | SUIT | ATTIVA | PASSIVA |
|---|---|---|---|
| E-RUN-01 (runner) | spade | (2) colpo su OBIETTIVO in movimento scartando 1 carta | +1 se si muove / −1 se non si muove nella fase MOVIMENTO |
| The Sniper (brawler) | coppe | (3) scarta 3 carte per MATCHARE una CELLA qualsiasi | carte COPPE nei CLASH valgono +2 |
| Deep Mind (tactician) | oro | (3) sbircia la STACK DI RISERVA avversaria | scelta TOOL fra 4 invece che 3 |
| Soldier Boy (fighter) | bastoni | (3) PESCA 3, scegli 1, SOVRASCRIVI la propria CELLA, scarta le altre | in ATTACCO le carte di VALORE PARI fanno MATCH tra loro |
| Wallie & Glass (wallie) | oro | posiziona il segnalino GLASS (al posto di un'azione) | +2 nei CLASH sulle sole carte ORO se non ha GLASS in campo |

Bilanciamento: `powerUses` in `characters.js`. Verifica con `sim/cpuvscpu.js`.

---

## 8. UI/UX (requisiti chiave)

- **Semi → colore/simbolo:** oro=giallo ○, spade=blu ♠, bastoni=verde ♣, coppe=rosso ♥.
- **CELLE:** centro e OBIETTIVI a schema invertito con corona ♛; OFFLINE a faccia in giù; DISTRUTTA con
  reso dedicato; celle bonus evidenziabili (ruleset C).
- **HUD:** round, fase, turno, 1° Pilota, punteggi; solo la GLOBAL SUIT è colorata; indicatore sequenza
  semi in rotazione.
- **Scheda giocatore:** mano, STACK ATTIVA pubblica, pannello TOOL (tooltip in hover; evidenziato solo
  se utilizzabile), pannello SKILL con usi rimasti.
- **Modali:** risultato **CLASH** mostrato **prima** dell'eventuale scelta TOOL che ne deriva; peek
  Deep Mind; scelta 1-su-N per TOOL/carte.
- **Interazioni:** selezione carte (segreta, "pass the device" in hot-seat), click griglia per
  muovere/sparare/selezionare bersagli dei sotto-flussi, ↶ Annulla + log cliccabile (cronologia stati).

---

## 9. Criteri di accettazione (checklist)

1. **Config:** ogni combinazione di `opts` produce una partita valida; vincoli rispettati (4×4 solo C,
   3–4 giocatori solo 5×5, tactician non selezionabile in modalità seme fissa).
2. **Regole:** MATCH, CLASH ciclico, movimento/attacco, TOOL (tutti i `costSpec`), SKILL attive+passive,
   scoring e spareggi come da regolamento.
3. **Fine partita:** per `maxRounds`, per `endTriggered`, e **fine anticipata** senza CELLE ONLINE.
4. **Determinismo:** stesso seed ⇒ stessa partita (i test si basano su questo).
5. **Test verdi:** `node tests/engine.test.js` e `node tests/cpu.test.js` senza fallimenti.
6. **UI:** nessun errore in console; CLASH prima della scelta TOOL; sotto-flussi risolvibili a mano.

---

## 10. Manutenzione della documentazione

Vedi la sezione finale di `CLAUDE.md`: dopo modifiche significative, aggiornare nello stesso commit
`CLAUDE.md`, questo file, `README.md` e — rigenerandolo da `regolamento.js` — `the-cradle-regolamento.md`.

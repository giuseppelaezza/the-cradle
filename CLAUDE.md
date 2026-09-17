# CLAUDE.md — Guida rapida al progetto per Claude Code

The Cradle è un gioco da tavolo digitale (griglia di carte napoletane) implementato in
**JavaScript vanilla**: solo HTML + CSS + JS, **nessun framework**, **nessun build step**,
**nessuna dipendenza runtime**. Si apre aprendo `index.html` (o servendolo staticamente).

Lingua del progetto: **italiano** (codice, commenti, UI, regolamento). Mantieni l'italiano.

---

## Come far girare / testare

```bash
# App: aprire index.html, oppure servire staticamente
python3 -m http.server 8000        # poi http://localhost:8000/index.html

# Test (Node, nessun framework: assert fatti a mano, exit code 1 se falliscono)
node tests/engine.test.js          # regole engine (~538 asserzioni)
node tests/cpu.test.js             # ~2760 partite CPU-vs-CPU concluse senza eccezioni

# Simulazione bilanciamento CPU-vs-CPU (dev tool)
node sim/cpuvscpu.js [scala]
```

**Esegui SEMPRE entrambi i test dopo aver toccato `js/`.** L'engine è deterministico (RNG
iniettabile) e i test lo coprono a fondo; `ui.js`/`main.js` NON hanno test automatici → verificali a
mano nel browser (vedi sotto).

Verifica UI nel browser: apri l'app, controlla la console (nessun errore), avvia una partita VS CPU.

---

## Struttura del codice

I file sono organizzati per **ambito**. Ogni modulo è un **UMD**: espone `window.CradleXxx` nel
browser e `module.exports` in Node (per i test). Load order = dipendenze (vedi `index.html`).

```
index.html            # markup + <script> in ordine di dipendenza
css/styles.css        # tutto lo stile (un solo file)
data/
  tools.numbers       # FONTE DI VERITÀ dei TOOL (Apple Numbers, curata dall'utente)
  tools.csv           # export del .numbers (rigenerato, vedi sotto)
js/
  core/
    deck.js           # carte, mazzo, shuffle, VALORE/SUIT, punti figura  → CradleDeck
    suits.js          # ciclo/spareggio SUIT, icone                        → CradleSuits
  model/
    objects.js        # definizioni TOOL (OBJECT_DEFS) + costruzione mazzo → CradleObjects
    characters.js     # definizioni PILOTI/ARM (CHARACTERS) + poteri       → CradleCharacters
  content/
    regolamento.js    # testo del regolamento in-app (markdown)            → CradleRegolamento
  engine/
    engine.js         # stato + regole (setup, MATCH, movimento, CLASH, attacco, TOOL, poteri,
                      #   scoring, fine partita). Puro, NO DOM, RNG iniettabile → CradleEngine
  ai/
    cpu.js            # avversario CPU: euristiche pure, NO DOM            → CradleCpu
  ui/
    ui.js             # rendering + interazioni + modali + tooltip         → CradleUI
    main.js           # schermata di configurazione + wiring               → (avvio)
tests/
  engine.test.js      # test engine (contiene 2 driver whoActs, vedi gotcha)
  cpu.test.js         # test CPU (driver whoActs)
sim/cpuvscpu.js       # simulatore di bilanciamento (dev)
```

**Separazione netta:** `engine.js` e `cpu.js` non toccano il DOM. `ui.js`/`main.js` leggono
`game.state` e chiamano i metodi dell'engine. Non introdurre dipendenze dal DOM in engine/cpu.

---

## Concetti di dominio (glossario minimo)

PILOTA = giocatore · ARM = pedina/personaggio · ARM SUIT = jolly personale fisso ·
GLOBAL SUIT = jolly condiviso che ruota a ogni ROUND · CELLA ONLINE = scoperta / OFFLINE = coperta /
DISTRUTTA = rimossa · MATCH = giocare una carta che corrisponde a una CELLA · OBIETTIVI = carte 8/9/10 ·
STACK ATTIVA = 3 carte scelte in DEPLOY / STACK DI RISERVA = le altre (usate nei CLASH) ·
CLASH = confronto di carte quando due ARM si scontrano · TOOL = carta oggetto · SKILL = potere dell'ARM
(ATTIVA con usi limitati / PASSIVA sempre attiva). Regolamento completo: `the-cradle-regolamento.md`.

Fasi di un ROUND: `select` (DEPLOY) → `move` → `attack` → fine ROUND. Sotto-flussi interattivi vivono
in `state.subPhase` (es. `clash-cards`, `tool-sacrifice`, `overtake-select`, `fighter-select`, …).

---

## Convenzioni e gotcha (leggere prima di modificare)

- **Aggiungere un nuovo `subPhase` all'engine** richiede di aggiornarlo in **più punti** o CPU/test si
  bloccano ("partita non conclusa"):
  1. `js/ai/cpu.js` → switch in `cpuAct` (risolutore per la CPU);
  2. `js/ui/ui.js` → dispatch del pannello (`renderPanel`), `onCellClick` e `pickCells` se serve la griglia;
  3. `tests/cpu.test.js` → la sua `whoActs(s, g)`;
  4. `tests/engine.test.js` → ha **due** copie di `whoActs` (una condivisa + una nella IIFE "softlock");
  5. dichiara il campo `pendingXxx` nello stato in `createGame`.
- **Pipeline TOOL:** l'utente cura `data/tools.numbers` (Apple Numbers). Da lì:
  `tools.numbers` → `data/tools.csv` → `js/model/objects.js` (`OBJECT_DEFS`) → tabella in
  `js/content/regolamento.js`. Tienili allineati. Per rigenerare il CSV dal .numbers serve il pacchetto
  pip `numbers-parser` (delimitatore `;`, colonne `TOOL;Fase;Effetto;COSTO;EDITED or NEW`).
- **Costi dei TOOL** = `costSpec` in `objects.js` (`stack/reserve/points/consume/regen/tools/forfeit`);
  gating in `engine._toolCostAffordable`, pagamento in `engine.useObject`.
- **Poteri ARM:** numero di usi delle SKILL attive in `characters.js` (`powerUses`); i totali/rimasti
  (`tacticianLeft`, `brawlerLeft`, `runnerLeft`, `fighterLeft`) sono in `createGame`. Encore! li ripristina.
- **UMD + no build:** ogni file è un IIFE UMD; se sposti file aggiorna i `require('../…')` interni,
  gli `<script src>` in `index.html` (in ordine di dipendenza) e i path nei test/sim.
- **Determinismo:** l'engine non chiama `Math.random` direttamente dove conta — usa l'RNG iniettato.
  Mantieni questa proprietà (i test si basano sui seed).

---

## Tenere aggiornata la documentazione (IMPORTANTE)

Questi file DEVONO restare uno specchio reale della codebase. Dopo una modifica significativa,
aggiorna nello stesso commit:

- **`CLAUDE.md`** (questo file): struttura cartelle, comandi, gotcha, conteggi test.
- **`the-cradle-build-spec.md`**: modello dati, responsabilità dei moduli, invarianti, flusso.
- **`the-cradle-regolamento.md`**: è un **mirror generato** da `js/content/regolamento.js` (fonte di
  verità delle regole). Non modificarlo a mano: cambia `regolamento.js`, poi rigenera:
  ```bash
  node -e "var R=require('./js/content/regolamento.js');require('fs').writeFileSync('the-cradle-regolamento.md','<!-- NON modificare a mano: mirror di js/content/regolamento.js. -->\n\n'+R.C+'\n')"
  ```
- **`README.md`**: sintesi per chi apre il repo (avvio, moduli, struttura).

Regola pratica: se cambi una **regola** → `regolamento.js` (+ rigenera `.md`) e, se serve, engine+test.
Se cambi l'**architettura/struttura file** → `CLAUDE.md`, `build-spec.md`, `README.md`.
Se aggiungi **contenuti** (TOOL/PILOTI) → `objects.js`/`characters.js` + `regolamento.js` + test.

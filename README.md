# The Cradle — prototipo digitale (v0.6)

Prototipo giocabile di **The Cradle**: un gioco da tavolo su griglia di **carte napoletane** in cui ogni
**PILOTA** manovra un **ARM** e conquista punti facendo **MATCH** tra le carte della propria mano e le
CELLE della griglia.

Implementato in **JavaScript vanilla** — solo HTML + CSS + JS, **nessun framework**, **nessun build
step**, **nessuna dipendenza**. Supporta **2–4 giocatori**, modalità **hot-seat** e **vs CPU**, tre
ruleset (A/B/C), griglia 5×5 e 4×4, modalità **Draft**, e i moduli **Personaggi**, **Oggetti (TOOL)**,
**Poteri** e **Reshuffle**.

> - Regole di gioco: [`the-cradle-regolamento.md`](the-cradle-regolamento.md)
>   (mirror del regolamento in-app `js/content/regolamento.js`).
> - Specifiche tecniche: [`the-cradle-build-spec.md`](the-cradle-build-spec.md).
> - Guida per orientarsi nel codice: [`CLAUDE.md`](CLAUDE.md).

---

## Avvio

Script classici (nessun ES module): apri direttamente **`index.html`**.

```bash
open index.html                 # macOS
# oppure, se il browser blocca qualcosa via file://:
python3 -m http.server 8000     # poi http://localhost:8000/index.html
```

## Test

```bash
node tests/engine.test.js       # regole engine (~538 asserzioni, deterministico via seed)
node tests/cpu.test.js          # ~2760 partite CPU-vs-CPU concluse senza eccezioni
node sim/cpuvscpu.js            # simulatore di bilanciamento CPU-vs-CPU (dev)
```

---

## Schermata di configurazione

All'avvio scegli: **avversario** (hot-seat / vs CPU / CPU-vs-CPU), **griglia** (5×5 o 4×4) e numero di
ROUND, composizione dei **mazzi TOOL**, **regole** (ruleset, modalità turno, griglia Draft), e — se il
modulo Personaggi è attivo — l'**ARM** di ciascun PILOTA. In modalità seme fissa il *tactician* non è
selezionabile.

Extra: **↶ Annulla** e **log cliccabile** (riporta la partita a prima di un evento; contro la CPU si
ferma alla tua decisione precedente).

---

## Struttura del progetto

```
index.html            # markup + <script> in ordine di dipendenza (nessun build step)
css/styles.css
data/
  tools.numbers       # fonte di verità dei TOOL (Apple Numbers)
  tools.csv           # export del .numbers
js/
  core/    deck.js, suits.js            # carte, semi (puro)
  model/   objects.js, characters.js    # definizioni TOOL e PILOTI/ARM (puro)
  content/ regolamento.js               # testo del regolamento in-app
  engine/  engine.js                    # stato + regole (puro, NO DOM, RNG iniettabile)
  ai/      cpu.js                        # avversario CPU (puro, NO DOM)
  ui/      ui.js, main.js               # rendering, interazioni, configurazione
tests/     engine.test.js, cpu.test.js
sim/       cpuvscpu.js                   # simulatore di bilanciamento
```

**Separazione netta:** `engine.js`/`cpu.js` non toccano il DOM e sono deterministici (RNG iniettabile),
quindi testabili; `ui.js`/`main.js` leggono `game.state` e chiamano i metodi dell'engine. Ogni modulo è
un **UMD** (`window.CradleXxx` nel browser, `module.exports` in Node).

---

## In sintesi (regole)

- **MATCH:** giochi una carta che ha lo stesso **VALORE** di una CELLA, oppure la stessa **SUIT** ed è
  un jolly (**GLOBAL SUIT** condivisa, che ruota a ogni ROUND, o la tua **ARM SUIT** fissa). Le CELLE
  **OFFLINE** si abbinano solo con un jolly. Gli **OBIETTIVI** (8/9/10) valgono punti.
- **ROUND:** DEPLOY (scegli 3 carte = STACK ATTIVA; le altre = STACK DI RISERVA) → MOVIMENTO → ATTACCO
  → fine ROUND. Scontrarsi con un ARM avversario apre un **CLASH** (si confrontano carte dalla RISERVA).
- **TOOL:** carte oggetto con una fase e un COSTO (CONSUMA, RIGENERA, SCARTA carte/TOOL, PERDI punti…).
- **ARM/SKILL:** ogni ARM ha una SKILL **attiva** (usi limitati) e una **passiva**.
- **Fine partita:** dopo l'ultimo ROUND, oppure — anticipata — se a fine ROUND non resta alcuna CELLA
  ONLINE. Vince chi ha più punti (spareggio: controllo del centro, poi n° di OBIETTIVI).

Regolamento completo e aggiornato: [`the-cradle-regolamento.md`](the-cradle-regolamento.md).

---

## Contribuire / mantenere

Dopo ogni modifica a `js/`: esegui **entrambi** i test ed effettua una verifica manuale nel browser
(`ui.js` non ha test automatici). Mantieni aggiornati `CLAUDE.md`, `the-cradle-build-spec.md`,
`README.md` e — rigenerandolo da `regolamento.js` — `the-cradle-regolamento.md`. Dettagli e gotcha
(nuovi `subPhase`, pipeline dati TOOL, pattern UMD) in [`CLAUDE.md`](CLAUDE.md).

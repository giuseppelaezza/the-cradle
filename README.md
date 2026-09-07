# The Cradle — Prototipo hot-seat (v2)

Prototipo giocabile **hot-seat** (2 giocatori, stesso dispositivo, *pass and play*) di **The Cradle**,
in **JavaScript vanilla** — solo HTML + CSS + JS, nessun framework, nessun build step, nessuna dipendenza.

La **v2** aggiunge: **modalità seme** (fissa/rotazione), moduli **Personaggi** e **Oggetti**,
uso degli oggetti **inline** da un pannello sotto la mano, **celle distrutte** e le relative modifiche grafiche.

> Fonte di verità delle regole: [`the-cradle-regolamento.md`](the-cradle-regolamento.md).
> Specifiche tecniche v2: [`the-cradle-build-spec.md`](the-cradle-build-spec.md).

---

## Avvio

Script classici (nessun ES module): apri direttamente **`index.html`**.

```bash
open index.html        # macOS
```

Se il browser blocca qualcosa via `file://`, usa un server statico:

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000/index.html
```

## Schermata di configurazione

All'avvio scegli:
- **Avversario:** Due giocatori (hot-seat) oppure Sfida la CPU (tu = Nord).
- **Modalità seme** (dropdown): `Fisso` o `Rotazione` (default).
- **Moduli** (checkbox indipendenti): `Personaggi`, `Oggetti`, `Poteri personaggi`.
- Se **Personaggi** è attivo: scegli il personaggio di N e di S (**lo stesso è ammesso**). In modalità
  seme **fissa** il **tactician è disabilitato**.
- **Poteri personaggi** (richiede Personaggi): ogni personaggio ottiene un potere — runner abbina
  sempre le carte pari; tactician scarta un oggetto per usare anche le carte non scelte; fighter, se la
  prima mossa abbina figura o pedina avversaria, ottiene una mossa extra al posto dell'attacco; brawler
  può scartare 3 carte per abbinare qualsiasi cella (§12 del regolamento).

## Annulla e cronologia
- Pulsante **↶ Annulla** (in alto) per tornare indietro di un'azione.
- Ogni riga del **log** è cliccabile: riporta la partita a **prima** di quell'evento.
- Vengono conservati tutti gli stati dall'inizio del match; contro la CPU l'annulla si ferma alla tua
  decisione precedente.

## Oggetti (v0.2)
Oltre a jetpack/jump/hook/homing/rush/combat/timebomb: **elemental bomb** (cambia il seme di una cella e
delle ortogonali), **barrage** (distrugge due celle adiacenti), **randomizer** (rimescola fino a 3 celle
nel mazzo, ripesca e ricolloca con **drag-and-drop** — o clic per posizionare).

Combinazioni: nessun modulo = base; solo Personaggi = seme di appartenenza; solo Oggetti = mazzo
Oggetti (niente seme di appartenenza né oggetto iniziale); entrambi = seme di appartenenza + oggetto
iniziale + mazzo Oggetti.

## Test

```bash
node tests/engine.test.js    # regole engine v2 (base + rotazione + personaggi + oggetti)
node tests/cpu.test.js       # 200 partite CPU-vs-CPU concluse su 5 configurazioni (inclusi poteri)
```

---

## Struttura

```
index.html
css/styles.css
js/deck.js         // carte, mazzo, shuffle, sequenza semi (puro)
js/objects.js      // definizioni oggetti + mazzo Oggetti (puro)
js/characters.js   // definizioni personaggi (puro)
js/engine.js       // stato + regole: setup, matching, movimento, clash, attacco, OGGETTI, rotazione, scoring (puro, no DOM)
js/cpu.js          // avversario CPU: funzioni decisionali pure (puro, no DOM)
js/ui.js           // rendering + interazioni + finestre oggetto + tooltip + schemi movimento + CPU
js/main.js         // schermata di configurazione + wiring
tests/engine.test.js
tests/cpu.test.js
README.md
```

**Separazione netta:** `engine.js` non tocca il DOM ed è deterministico (rng iniettabile), quindi
interamente testabile. `ui.js` legge `game.state` e chiama i metodi dell'engine.

---

## Regole implementate (sintesi v2)

- **Seme di turno (jolly):** una carta del seme di turno abbina qualsiasi casella dello stesso seme a
  qualsiasi valore; le carte **coperte** sono abbinabili solo da un seme jolly (senza punti).
- **Modalità rotazione:** a fine round il seme di turno avanza nel loop **oro → spade → coppe →
  bastoni → oro**. La casella centrale resta l'asso del **seme iniziale**; jolly e coperte seguono il
  **seme di turno corrente**. Un indicatore in alto mostra la sequenza con la posizione corrente.
- **Personaggi (seme di appartenenza):** ogni personaggio dà un seme personale e fisso che vale
  **come un secondo seme di turno solo per quel giocatore** — abbina le carte di quel seme a qualsiasi
  valore **e sblocca le coperte**. Personaggi: runner→spade+jetpack, brawler→coppe+combat juice,
  tactician→oro+timebomb (non in modalità fissa), fighter→bastoni+hook.
- **Oggetti:** mazzo di **4 oggetti distinti** a faccia in giù. Si **pesca 1 oggetto** ogni volta che
  una **figura viene eliminata** (coperta con un match in movimento o in attacco, o distrutta). Limite
  di **2** oggetti non-iniziali: acquisendone un terzo si scarta (l'oggetto iniziale del personaggio
  non conta). I 7 oggetti:
  - **jetpack** (move): abbini anche in diagonale.
  - **jump** (move): abbini solo le caselle a 2 celle ortogonali (salto).
  - **hook** (attack): colpita la pedina avversaria, puoi spostarla di 1 ortogonale.
  - **homing missile** (attack): ottieni i **punti** (figura/pedina) **e** distruggi la cella
    (`destroyed`); l'eventuale pedina viene ricollocata dal suo proprietario.
  - **rush juice** (select): 2 movimenti, 0 attacchi.
  - **combat juice** (select): 0 movimenti, 2 attacchi.
  - **timebomb** (select): sposti il seme di turno su un seme a scelta (solo rotazione).
- **Celle distrutte:** non abbinabili né percorribili, escluse da ogni spostamento forzato.
- **Uso degli oggetti (inline)** (§11.4): non c'è una finestra bloccante. Nel proprio turno, il
  giocatore di turno (ordine P1 poi P2, fasi select/move/attack) usa gli oggetti **cliccandoli dal
  pannello sotto la mano**, **prima di eseguire/confermare l'azione**: in `select` prima di confermare
  le 3 carte, in `move`/`attack` prima di eseguire l'azione. Un oggetto è **evidenziato e cliccabile
  solo quando è utilizzabile**. Max 1 oggetto select per round e max 1 modificatore per azione.

## UI/UX

- **Semi:** oro = giallo ○, spade = blu ♠, bastoni = verde ♣, coppe = rosso ♥.
- **Righe di partenza** (y=1, y=5): bordo tratteggiato. **Centro** e **figure** (8/9/10, in mano e su
  griglia): schema colore **invertito** (fondo del seme, testo bianco) con **corona ♛** accanto al numero.
- **HUD:** testi in bianco; **solo** il seme di turno è colorato. Indicatore di **sequenza semi** in
  rotazione. Le **3 carte scelte** sono pubbliche nella scheda del giocatore e si aggiornano quando usate.
- **Oggetti:** **pannello cliccabile sotto la mano** con gli oggetti posseduti; **tooltip** in hover;
  un oggetto è **evidenziato e cliccabile solo quando utilizzabile** (nella fase legata e prima di
  confermare/eseguire l'azione); l'oggetto iniziale ha un bordino. Gli oggetti "move" mostrano lo
  **schema di movimento** (jetpack 3×3, jump 5×5). Le schede in alto restano un riepilogo pubblico.
- **Info nascosta:** interstiziale "pass the device" per la scelta segreta delle 3 carte e per la carta
  del clash. **Log eventi** e **schermata finale** con vincitore e criterio di spareggio.

---

## Decisioni sui casi limite

Sono applicate le decisioni consolidate della spec §10 (selezione segreta poi pubblica; seme di
appartenenza come seme di turno personale che sblocca anche le coperte; stesso personaggio ammesso;
tactician non in modalità fissa; pesca oggetto a ogni figura eliminata in movimento o attacco; homing
missile dà i punti oltre alla distruzione; hook con destinazione scelta dal tiratore; max 1 oggetto
modificatore per finestra; jump con cella intermedia ignorata; rush/combat con azioni consecutive).

Ambiguità non coperte dalla spec, risolte così (default):
1. **Uso oggetti inline:** invece di finestre bloccanti, gli oggetti si usano dal pannello sotto la
   mano nel proprio turno, prima di confermare/eseguire l'azione (ordine P1 poi P2 rispettato dal
   flusso dei turni).
2. **"Max 1 modificatore per finestra":** interpretato come **max 1 oggetto select per round** e
   **max 1 modificatore per azione** (move/attack); rush/combat/timebomb restano mutuamente esclusivi.
3. **CPU con poteri e oggetti:** la CPU **usa** poteri e oggetti con euristiche semplici — tactician
   (apre le carte se sblocca un'azione migliore), brawler (scarta 3 per prendere una figura irraggiungibile),
   fighter/runner passivi; jetpack/jump se sbloccano un arrivo migliore, homing sui bersagli alti, hook
   sulla pedina avversaria, timebomb/rush/combat in selezione, e barrage/randomizer/elemental quando
   passerebbe comunque l'attacco (uso "gratuito"). Gestisce anche tutte le scelte forzate.

Inoltre, quando **l'attaccante vince un clash** e si sposta sulla casella contesa, il suo è un
movimento **volontario** e riceve i normali effetti d'arrivo; gli spostamenti forzati non danno mai bonus.

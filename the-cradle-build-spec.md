# The Cradle — Specifiche del prototipo (istruzioni per Claude Code)

> **Fonte di verità delle regole:** `the-cradle-regolamento.md`. Qui traduco le regole in requisiti implementativi (modello dati, flusso, UI, casi limite, criteri di accettazione). In caso di dubbio prevale il regolamento.

Versione 2: modalità seme (fissa/rotazione), moduli **Personaggi** e **Oggetti**, nuova struttura del turno e modifiche grafiche.

---

## 1. Obiettivo e vincoli
Prototipo giocabile **hot-seat** (2 giocatori, stesso dispositivo) in **JavaScript vanilla** — solo HTML+CSS+JS, **nessun framework**, **nessun build step**, avviabile aprendo `index.html` (se usi ES modules, documenta un server locale). Separa **engine** (logica pura, testabile) da **ui**. Priorità: correttezza delle regole + chiarezza dell'interfaccia.

### Struttura file suggerita
```
index.html
css/styles.css
js/deck.js        // carte, mazzo, shuffle
js/objects.js     // definizioni oggetti + mazzo oggetti
js/characters.js  // definizioni personaggi
js/engine.js      // stato + regole: setup, matching, movimento, clash, sparo, oggetti, scoring, fine
js/ui.js          // rendering + interazioni + tooltip + schemi movimento
js/main.js        // schermata iniziale (mode + moduli) e wiring
tests/engine.test.js
README.md
```

---

## 2. Configurazione di partita (schermata iniziale)
- **Dropdown modalità seme:** `fisso` (default) | `rotazione`.
- **Checkbox moduli:** `Personaggi`, `Oggetti` (indipendenti).
- Se `Personaggi` attivo: ogni giocatore sceglie un personaggio. **Lo stesso personaggio può essere scelto da entrambi.** In modalità seme `fisso` il **tactician non è selezionabile** (disabilitalo nella UI).
- Combinazioni: nessun modulo = base; solo Personaggi = solo seme di appartenenza; solo Oggetti = mazzo Oggetti attivo, niente seme di appartenenza né oggetto iniziale; entrambi = seme di appartenenza + oggetto iniziale + mazzo Oggetti.

---

## 3. Modello dei dati
```
Suit       = 'oro' | 'spade' | 'coppe' | 'bastoni'
SUIT_RANK  = { oro:4, spade:3, coppe:2, bastoni:1 }          // clash
SUIT_CYCLE = ['oro','spade','coppe','bastoni']               // rotazione (loop)

Card  = { id, value:1..10, suit:Suit }

Cell  = { x,y, card:Card|null, faceDown:bool, destroyed:bool, pawn:null|'N'|'S' }
        // destroyed=true => card=null, non abbinabile né percorribile

ObjectCard = { id, type:'jetpack'|'jump'|'hook'|'homing_missile'|'rush_juice'|'combat_juice'|'timebomb',
               phase:'select'|'move'|'attack', fromCharacter:bool }   // fromCharacter esclude dal limite

Character  = { type:'runner'|'brawler'|'tactician'|'fighter', suit:Suit, startObject:ObjectType }

Player = {
  id:'N'|'S', score, hand:Card[], revealedIds:Set,
  trophies:Card[],
  character:Character|null, belongingSuit:Suit|null,
  objects:ObjectCard[],           // include l'oggetto iniziale (marcato fromCharacter)
  pendingActions:{ moves:1, attacks:1 }   // modificato da rush/combat juice
}

GameState = {
  deck:Card[], objectDeck:ObjectCard[],
  grid:Cell[][], centerInitialSuit:Suit,
  suitMode:'fixed'|'rotating', currentSuit:Suit,   // seme di turno
  modules:{ characters:bool, objects:bool },
  players:{N,S}, firstPlayer:'N'|'S',
  round:1..9, phase:'select'|'move'|'attack'|'end',
  gameOver:bool, endTriggered:bool, log:string[]
}
```
**Costanti personaggi:** runner→spade+jetpack, brawler→coppe+combat_juice, tactician→oro+timebomb, fighter→bastoni+hook.

---

## 4. Matching
```
canMatch(handCard, cell, player, state):
  if cell.destroyed: return false
  if cell.faceDown:
    return handCard.suit === state.currentSuit
        || (player.belongingSuit && handCard.suit === player.belongingSuit)   // il personaggio sblocca le coperte
  if handCard.value === cell.card.value: return true                          // per valore
  if cell.card.suit === state.currentSuit && handCard.suit === state.currentSuit: return true   // jolly seme di turno
  if player.belongingSuit && cell.card.suit === player.belongingSuit && handCard.suit === player.belongingSuit:
       return true                                                            // jolly personale del personaggio
  return false
```
> Il **seme di appartenenza** si comporta esattamente come il seme di turno, ma personale e fisso: vale sia per le carte scoperte sia per le **coperte**.

Clash invariato (`resolveClash`: valore → SUIT_RANK → 'tie').

---

## 5. Flusso del round (con moduli)
Fasi: `select → move → attack → fine`. Con il modulo Oggetti, prima di ogni azione c'è una **finestra "uso oggetto"** per il giocatore di turno (struttura in §11.4 del regolamento). In ogni fase agisce prima il Primo Giocatore, poi l'altro.

- **select:** finestra oggetti-`select` (P1 poi P2) → ogni giocatore sceglie 3 carte (segretamente) → **rivela** (diventano pubbliche e restano mostrate nella scheda). rush/combat juice impostano `pendingActions` (rush: 2/0; combat: 0/2). timebomb qui sposta `currentSuit`.
- **move:** per ciascun giocatore, finestra oggetti-`move` (jetpack/jump) → esegue `pendingActions.moves` movimenti (default 1; 0 = salta).
- **attack:** per ciascun giocatore, finestra oggetti-`attack` (hook/homing_missile) → esegue `pendingActions.attacks` attacchi (default 1; 0 = salta).
- **fine round:** scarta rivelate non usate (resta con 3), passa Primo Giocatore, pesca `min(3,deck)`, poi **se `rotating`** avanza `currentSuit` nel loop. Reset `pendingActions` a {1,1}.
- Fine partita: `endTriggered` (completa il round) oppure dopo il round 9.

**Effetti movimento/sparo/clash/spostamento forzato/scoring:** come nel regolamento §5–§8.

---

## 6. Oggetti — logica (effetti)
- **jetpack** (move): per quel movimento, le caselle abbinabili includono anche le **4 diagonali**.
- **jump** (move): per quel movimento, le uniche caselle abbinabili sono quelle a **2 celle ortogonali** ([x±2,y] e [x,y±2] entro i limiti); la pedina salta lì. Cella intermedia **ignorata** (anche se muro/coperta/distrutta/occupata). L'arrivo attiva normalmente centro/figura/riga-bersaglio/clash.
- **hook** (attack): se lo sparo colpisce la pedina avversaria (+5), il **tiratore** può spostarla di 1 casella ortogonale, esclusa la centrale (e escluse celle occupate/distrutte); nessun bonus.
- **homing missile** (attack): risolvi il normale sparo con i suoi **punti** (figura o +5 pedina), **poi** rimuovi la carta abbinata (`destroyed=true`, `card=null`). Se la cella aveva una pedina, il **proprietario** la ricolloca in una casella ortogonale adiacente (esclusa centrale, occupate, distrutte; nessun bonus). Celle distrutte escluse da ogni abbinamento e da ogni spostamento forzato; se una ricollocazione non ha destinazioni valide, la pedina resta ferma.
- **rush juice** (select): `moves=2, attacks=0` per il round (le due mosse consecutive, stesso giocatore).
- **combat juice** (select): `moves=0, attacks=2` per il round (i due attacchi consecutivi, stesso giocatore).
- **timebomb** (select): imposta `currentSuit` a un seme scelto; il loop prosegue da lì. Solo in `rotating` (in `fixed` non esiste, e il tactician non è selezionabile).

**Acquisizione:** ogni volta che una **figura viene eliminata** (coperta con un match in **movimento** o in **sparo**, oppure distrutta), pesca 1 dal `objectDeck` (se non vuoto). Se superi il limite di 2 oggetti non-iniziali, scegli 1 oggetto da scartare (anche quello appena pescato). L'oggetto iniziale del personaggio non conta.

**Uso:** un oggetto è usabile solo nella sua `phase`, nella relativa finestra, prima dell'azione; poi è scartato. **Max 1 oggetto "modificatore" per finestra/azione** (jetpack *oppure* jump). Le juice si dichiarano in `select` e agiscono sul conteggio azioni.

---

## 7. Requisiti UI/UX

### 7.1 Carte e semi (grafica)
- Seme → colore → simbolo: **oro = giallo = cerchio (○)**, **spade = blu = picche (♠)**, **bastoni = verde = fiori (♣)**, **coppe = rosso = cuori (♥)**.
- **Righe di partenza (y=1 e y=5):** bordo **tratteggiato**.
- **Casella centrale:** schema colore **invertito** (fondo del colore del suo seme, testo bianco).
- **Carte figura (8/9/10), in mano e su griglia:** stesso schema invertito (fondo del colore del seme, testo bianco) e, accanto al numero, un simbolo di **corona (♛)**.

### 7.2 Barra superiore (HUD)
- Testi in evidenza **in bianco**; **solo** il testo del **seme di turno** è colorato col colore del seme corrente.
- Mostra: round `x/9`, fase, turno, Primo Giocatore, punteggi, conteggio trophies.
- **Indicatore sequenza semi** (in modalità rotazione): `oro → spade → coppe → bastoni` con la posizione corrente evidenziata.

### 7.3 Scheda giocatore
- La mano (6 carte) con le 3 rivelate evidenziate.
- **Area "carte scelte":** le 3 carte rivelate mostrate in piccolo (pubbliche), aggiornate quando vengono usate.
- **Pannello Oggetti** sotto la mano: carte oggetto possedute; **hover → tooltip** con la spiegazione; oggetto **evidenziato solo quando utilizzabile**. L'oggetto iniziale è distinguibile (es. bordino) e non conta nel limite.

### 7.4 Schemi di movimento per gli oggetti "move"
- **jetpack:** griglia **3×3**; quadratino centrale con **outline bianco e fondo vuoto**; gli **8** circostanti con **outline e fondo bianco**.
- **jump:** griglia **5×5**; evidenziati **solo** i quadratini a 2 celle ortogonali dal centro: **[3,1],[5,3],[3,5],[1,3]**.

### 7.5 Interazioni
Selezione 3 carte; click cella adiacente per muovere; click cella per sparare; UI per: carta del clash, ricollocazione, scelta oggetto da scartare (oltre il limite), destinazione hook/homing missile. Interstiziale **"pass the device"** per la scelta segreta delle 3 carte e per la carta del clash. **Log** eventi. **Schermata finale** con vincitore e criterio di spareggio.

---

## 8. Celle distrutte (stato)
- `destroyed=true`: nessun abbinamento (move/shoot), non percorribile, esclusa da ogni spostamento forzato. Reso visivo dedicato.
- Se tutte le destinazioni di uno spostamento forzato sono distrutte/escluse → la pedina resta ferma.

---

## 9. Criteri di accettazione (checklist)
1. **Config:** dropdown seme e checkbox moduli funzionano; combinazioni corrette; **tactician disabilitato in modalità fissa**; stesso personaggio ammesso per entrambi.
2. **Rotazione:** il seme di turno avanza nel loop a fine round; centro resta l'asso del seme iniziale; jolly e carte coperte seguono il seme di turno corrente; indicatore sequenza corretto.
3. **Personaggi:** il seme di appartenenza abbina le carte di quel seme a qualsiasi valore **e sblocca le carte coperte** (come il seme di turno); oggetto iniziale solo se anche Oggetti è attivo, escluso dal limite.
4. **Oggetti — acquisizione/limite:** pesca a ogni figura eliminata **sia in movimento sia in sparo** (e alla distruzione); mazzo di 4 distinti a faccia in giù; niente pesca se vuoto; limite 2 (oltre l'iniziale) con scarto forzato.
5. **Oggetti — effetti:** jetpack (diagonali), jump (solo 2 celle ortogonali), hook (sposta pedina colpita), homing missile (**punti** + cella distrutta + pedina ricollocata), rush/combat juice (conteggio azioni, consecutive), timebomb (sposta seme di turno).
6. **Struttura turno:** finestre "uso oggetto" nell'ordine corretto (P1/P2) prima di ogni azione; rush/combat cambiano il numero di azioni; le finestre si saltano se Oggetti è off. Max 1 modificatore per finestra.
7. **UI grafica:** semi con colori/simboli corretti; righe di partenza tratteggiate; centro e figure a schema invertito con corona; HUD testi bianchi e solo seme di turno colorato; area carte scelte pubblica e aggiornata; pannello oggetti con tooltip e highlight; schemi 3×3 (jetpack) e 5×5 (jump).
8. **Regressione base:** match/clash/movimento/sparo/economia carte/spareggio come da regolamento continuano a funzionare.

---

## 10. Decisioni consolidate (già riflesse nelle regole)
1. Selezione carte: segreta poi rivelata (pass-the-device); dopo la rivelazione restano pubbliche.
2. Seme di appartenenza: come il seme di turno, personale e fisso; **sblocca anche le carte coperte**.
3. Personaggi: entrambi scelgono; **stesso personaggio ammesso**.
4. Tactician: **non selezionabile in modalità seme fissa**.
5. Pesca oggetto: a ogni figura eliminata **in movimento o in sparo** (o distrutta).
6. Homing missile: si ottengono **i punti** (figura/pedina) **oltre** alla distruzione.
7. Hook: destinazione scelta dal tiratore, esclusi centro/occupate/distrutte, nessun bonus.
8. Stacking: max 1 oggetto modificatore per finestra/azione.
9. Jump: cella intermedia ignorata; l'arrivo attiva normalmente gli effetti.
10. Rush/combat juice: le due azioni sono consecutive per lo stesso giocatore.

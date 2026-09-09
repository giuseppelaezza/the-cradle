# The Cradle — Modalità PVE (Boss)

> **Estensione** del regolamento base `the-cradle-regolamento.md` (fonte di verità per tutte le meccaniche condivise: abbinamento, movimento, clash, sparo, seme di turno, oggetti, poteri, reshuffle). Questo documento definisce **solo** ciò che è specifico del PVE. Dove il PVE non dice diversamente, valgono le regole base.

---

## 1. Panoramica

In PVE **1 o 2 giocatori alleati** affrontano un **boss** controllato dal gioco. I giocatori vincono **riducendo i punti del boss a 0** entro il **timer** del boss. I giocatori partono con **10 punti** (che qui rappresentano la **vita**) e vengono sconfitti se scendono a 0 (§7).

---

## 2. Configurazione di partita (tab PVP / PVE)

La schermata iniziale ha un **sistema a tab**: **PVP** e **PVE**.
- **Tab PVP:** tutte le impostazioni attuali del gioco base (modalità seme, moduli, ecc.).
- **Tab PVE:** i moduli **Personaggi** e **Oggetti** sono **sempre attivi** e non disattivabili; la modalità seme è **Rotazione** e non modificabile. Opzioni disponibili:
  - **Numero giocatori:** 1 o 2 (dropdown).
  - **Altro giocatore:** `Hot seat` · `con CPU` · `CPU & CPU` (chi controlla gli eroi).
  - **Regole addizionali:** `Reshuffle` (attiva il modulo Reshuffle, §13 base).
  - **Personaggi:** 1 o 2 dropdown (secondo il numero di giocatori) per scegliere i personaggi. Il **tactician** è selezionabile (il seme è a rotazione).
  - **Boss:** dropdown per scegliere il boss (per ora solo **cyclops**).

---

## 3. Differenze rispetto al PVP (regole condivise modificate)

- **Punti giocatore = vita.** Ogni giocatore parte a **10**. Le figure abbinate (in movimento o attacco) danno punti **come di consueto**: in PVE i punti si **aggiungono alla vita** (nessun tetto massimo — vedi §11). Le azioni del boss **sottraggono** vita.
- **Carte scoperte.** Si gioca **a carte scoperte** (niente selezione segreta né "pass the device"), ma si segue il **normale ordine**: scelta carte → movimento → attacco.
- **Seme sempre a rotazione** (§9 base).
- **Colpire il boss non dà punti** al giocatore (riduce solo la vita del boss, §4).
- **Colpire un alleato** (abbinarne la cella in attacco) **non** dà i +5 del "colpire una pedina"; si ottengono però eventuali punti relativi alle carte su cui si trova la pedina dell'alleato (es. una figura).
- **Nessun clash tra alleati:** non ci si può muovere sulla cella occupata da un alleato (cella bloccata al movimento). *(Default, §11.)*
- **Casella centrale** e **riga-bersaglio**: **nessun effetto particolare** (né +5 né fine partita), salvo quanto indicato dai valori/effetti del boss.
- **Primo Giocatore:** in 2 giocatori si alterna a ogni round come di consueto; in 1 giocatore c'è un solo eroe. Il boss agisce comunque **a fine round** (§5).

---

## 4. Il Boss

### 4.1 Attributi
Ogni boss ha: **Nome**, **Punti** (la sua vita), **Timer** (numero massimo di round entro cui sconfiggerlo), **Difesa**, **Abilità**, **dimensioni della griglia** (possono differire dal 5×5 del PVP: es. 6×4, 7×7, 5×7…), **posizioni di partenza dei giocatori** (se è un intervallo di celle, ciascun giocatore sceglie da quale partire, in celle distinte), **posizione iniziale del boss** e **numero di fasi**.

### 4.2 Danneggiare il boss
- Si danneggia il boss **con un'azione di attacco (sparo)** che **abbina la carta della cella su cui si trova il boss** (per valore / seme di turno / seme di appartenenza, come da regole base). *(Non ci si muove sulla cella del boss: nessun clash col boss — §11.)*
- Ogni colpo riduce i punti del boss di **(5 − Difesa)**, minimo 0. Colpire il boss **non** dà punti al giocatore.
- Se la carta sotto il boss è una **figura**, valgono **anche** i normali effetti figura (punti + oggetto + copertura). *(Default, §11.)*

### 4.3 Mazzo azioni del boss
- Il boss ha un **mazzo azioni** e una propria **pila degli scarti**. Si **gira 1 carta a round** (salvo diversa indicazione della carta). Quando il mazzo azioni è esaurito, si **rimescola la pila degli scarti** per riformarlo.
- Ogni **carta azione** riporta:
  - **condizioni di colpo** (valori, semi, o **pattern** rispetto alla griglia / posizione del boss) → definiscono le **celle colpite**;
  - un **valore di danno** = punti sottratti a ogni giocatore che, **al momento dell'azione del boss**, si trova su una cella colpita;
  - eventuali **indicazioni di movimento** della pedina del boss;
  - eventuali **effetti speciali** (cambiare semi/valori di carte sulla griglia, spostare pedine giocatore, interagire con la mano dei giocatori, disabilitare poteri, ecc.).
- Alcuni boss hanno **2 mazzi** (fase 1 / fase 2): in fase 2 il boss diventa più forte.

### 4.4 Azione del boss (a fine round)
Nell'ordine indicato dalla carta (di norma **attacco poi movimento**):
1. **Attacco:** ogni giocatore che si trova su una cella colpita perde vita pari al **danno** della carta (calcolo sullo **stato reale** della griglia in quel momento).
2. **Movimento:** se la carta lo prevede, la pedina del boss si sposta come indicato.
   - Se il boss **finisce su una cella occupata da un giocatore**, quel giocatore viene **spostato** (sceglie lui una casella **ortogonale** adiacente, escluse celle occupate e distrutte) e subisce **1 danno**.
   - Se il boss **non può completare** lo spostamento (fuori griglia o celle distrutte), **non si muove** affatto. *(Default tutto-o-niente, §11.)*
3. **Effetti speciali** eventuali della carta.

---

## 5. Struttura del round PVE

```
- inizio round
- SETUP BOSS: gira 1 carta azione del boss e mostra gli overlay delle minacce (§6)
- i giocatori agiscono (carte scoperte, ordine normale):
    - scelta carte / (oggetti-scelta, reshuffle, poteri)
    - movimento (giocatore 1, poi giocatore 2)
    - attacco   (giocatore 1, poi giocatore 2)
- AZIONE BOSS: attacco + movimento + effetti della carta (§4.4)
- i giocatori pescano 3 carte ciascuno
- il seme di turno avanza (rotazione)
- si alterna il Primo Giocatore (in 2 giocatori)
- controllo vittoria / sconfitta / timer (§7)
- fine round
```

*(Le finestre "uso oggetto" P1/P2 prima di ogni azione, i poteri e il reshuffle restano come nel regolamento base, §11–§13.)*

---

## 6. Overlay delle minacce (UI)

Dopo il **setup boss**, si evidenziano le celle minacciate dalla carta azione, con overlay leggeri (**attivi di default, disattivabili nelle opzioni**), aggiornati **in tempo reale** man mano che la griglia/posizione cambia:
- **Rosso:** celle minacciate dall'**attacco**.
- **Blu:** celle minacciate dal **movimento** del boss (cella d'arrivo; il percorso può essere mostrato in forma tenue).
- **Viola:** celle minacciate da **entrambi** (attacco + movimento).

---

## 7. Vittoria, sconfitta, timer

- **Vittoria:** i punti del boss arrivano a **0**.
- **Sconfitta:**
  - **1 giocatore:** l'eroe arriva a **0** punti.
  - **2 giocatori:** **entrambi** gli eroi sono a **0** contemporaneamente. *(Un eroe a 0 non è eliminato: continua a giocare e può risalire con le figure — default, §11.)*
  - **Timer:** superato il numero massimo di round del boss senza averlo sconfitto.
  - **Carte esaurite:** se il mazzo si esaurisce al punto che un giocatore **non può disporre delle 3 carte** per la fase di scelta, i giocatori sono sconfitti. Se il modulo **Reshuffle** è attivo e restano usi, si può rimescolare per evitarlo.

---

## 8. Scheda Boss (UI)

Sotto le schede dei due giocatori, con layout simile, una **scheda Boss** con: **Nome**, **Punti**, **Timer** (round rimanenti), **Difesa**, **Abilità**.

---

## 9. Boss: CYCLOPS

| Attributo | Valore |
|---|---|
| Nome | cyclops |
| Timer | 9 round |
| Punti | 20 |
| Difesa | 2 (ogni colpo del giocatore infligge 5 − 2 = **3**) |
| Abilità | — |
| Griglia | **5 × 7** (x: 1–5, y: 1–7) |
| Partenza giocatori | intervallo **[1,1] → [1,5]** (colonna sinistra; ogni giocatore sceglie una cella distinta) |
| Posizione boss | **[3,7]** |
| Fasi | 1 |

**Direzioni:** Nord = y−1, Sud = y+1, Est = x+1, Ovest = x−1.

### 9.1 Carte azione

| Carta | Danno | Effetto |
|---|---|---|
| **Cross-laser** | 2 | Colpisce tutte le celle **ortogonali in linea** rispetto al boss (intera riga + intera colonna del boss, esclusa la sua cella). Es. boss in [3,3] su griglia 5×7 → [3,1][3,2][3,4][3,5][3,6][3,7] e [1,3][2,3][4,3][5,3]. |
| **Pound** | 3 | Colpisce tutte le **8 celle adiacenti** (ortogonali + diagonali) al boss, **poi muove 1 verso Nord**. |
| **Charge** | — | **Muove 3 verso Sud** (nessun attacco). |
| **Lateral thrust E** | 2 | Colpisce tutte le celle **a Est** del boss (stessa riga, x maggiore), **poi muove 2 verso Est**. |
| **Lateral thrust O** | 2 | Colpisce tutte le celle **a Ovest** del boss (stessa riga, x minore), **poi muove 2 verso Ovest**. |
| **Eruption** | 4 | Colpisce tutte le celle con **carte a faccia in giù** (coperte). |
| **Multi-Laser** | 3 | Colpisce tutte le celle con **carte a faccia in giù** **e** tutte quelle con il **seme di turno**. |

### 9.2 Composizione del mazzo (12 carte)
Cross-laser ×3 · Pound ×2 · Charge ×1 · Lateral thrust E ×2 · Lateral thrust O ×2 · Eruption ×1 · Multi-Laser ×1.

---

## 10. Appendice implementativa (per Claude Code)

### 10.1 Modello dati
```
BossCard = {
  id, name, damage:number,               // damage 0 = nessun attacco
  attack: AttackPattern | null,           // celle colpite
  move: { dir:'N'|'S'|'E'|'O', steps:int } | null,
  order: ['attack','move'],               // ordine di risoluzione (default attack->move)
  special: fn(state) | null               // effetti extra (cambio semi/valori, sposta pedine, mano, disabilita poteri)
}

AttackPattern (dichiarativo, unione di pattern):
  'cross'            // intera riga + intera colonna del boss (esclusa la sua cella)
  'around8'          // 8 celle adiacenti (orto + diag)
  'ray:N'|'ray:S'|'ray:E'|'ray:O'   // tutte le celle in quella direzione lungo la linea del boss
  'faceDown'         // tutte le celle coperte
  'suit:current'     // tutte le celle del seme di turno
  // combinazioni via array: es. ['faceDown','suit:current'] (Multi-Laser)

Boss = {
  name, maxHp, hp, defense, timer, abilities:[],
  gridW, gridH, playerStartRange:[cells], bossStart:cell,
  phases:[ { deck:BossCard[], discard:BossCard[] } ], currentPhase:0,
  pawn:cell
}

PVEConfig = {
  players:1|2, control:'hotseat'|'withCPU'|'cpuCpu',
  extra:{ reshuffle:bool }, characters:[type,...], boss:'cyclops'
}
GameState (PVE): players[].hp (start 10), modules forzati {characters:true,objects:true},
                 suitMode 'rotating', boss, threatOverlays{red[],blue[],purple[]}, showOverlays:bool
```

### 10.2 Calcolo minacce / overlay
- `attackCells(card, boss, grid, currentSuit)` risolve `attack` in una lista di celle → overlay **rosso**.
- `moveCells(card, boss, grid)` → cella d'arrivo (+ percorso) → overlay **blu**; intersezione con rosso → **viola**.
- Ricalcolare a ogni cambiamento di stato durante la fase giocatori (overlay live).

### 10.3 Note
- Danno al boss = `max(0, 5 - boss.defense)`.
- Movimento boss: tutto-o-niente; celle distrutte bloccano; se finisce su un giocatore → spostamento (scelto dal giocatore, orto, escluse occupate/distrutte) + 1 danno.
- Cyclops: mappare le 7 carte ai pattern — Cross-laser→'cross'; Pound→'around8' + move{N,1}; Charge→move{S,3}; Lateral E→'ray:E' + move{E,2}; Lateral O→'ray:O' + move{O,2}; Eruption→'faceDown'; Multi-Laser→['faceDown','suit:current'].

---

## 11. Punti da chiarire (default già applicati)
1. **Vita giocatore:** le figure curano; **nessun tetto** massimo (da confermare, es. cap a 10?).
2. **Boss:** si colpisce solo in **attacco** abbinando la sua cella; non ci si muove sul boss (niente clash col boss).
3. **Boss su figura:** danno al boss **+** effetti figura (punti/oggetto/copertura).
4. **Alleati:** nessun clash; cella dell'alleato bloccata al movimento.
5. **Oggetti "anti-avversario" in PVE** (`hook`, `energy drain`): non c'è avversario umano — **DA DECIDERE** se bersagliano il boss, l'alleato, o sono inattivi in PVE.
6. **Danno boss:** calcolato a fine turno sullo stato reale; overlay live.
7. **Movimento boss:** tutto-o-niente; celle distrutte lo bloccano.
8. **Overlay movimento:** evidenzia la cella d'arrivo (percorso in forma tenue).
9. **Eroe a 0 (2 giocatori):** non eliminato, continua e può risalire; sconfitta solo se **entrambi** a 0 insieme.
10. **CPU:** euristica semplice (evita celle minacciate, attacca il boss quando può).

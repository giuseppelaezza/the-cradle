# The Cradle — Regolamento

## 1. Panoramica

**The Cradle** è un gioco da tavolo per **2 giocatori** che si gioca con due mazzi di carte napoletane (40 carte ciascuno, valori 1–10).

I giocatori si alternano nel **muovere la propria pedina** e nello **sparare** su una griglia 5×5 di carte, usando le carte della propria mano per **abbinare** (fare "match" con) le carte presenti sulla griglia.

**Obiettivo:** totalizzare il maggior numero di punti nel momento in cui la partita termina.

Il gioco base può essere ampliato con la **modalità seme a rotazione** (§9) e con due **moduli** opzionali: **Personaggi** (§10) e **Oggetti** (§11), attivabili a inizio partita.

---

## 2. Componenti

- **Due mazzi** di carte napoletane (40 carte ciascuno, valori 1–10) — mescolati insieme formano il **mazzo** (80 carte totali).
- **2 pedine** (una per giocatore).
- **1 segnalino Primo Giocatore**.
- *(Modulo Oggetti)* **carte Oggetto** e il relativo **mazzo Oggetti**.
- *(Modulo Personaggi)* **carte Personaggio**.

---

## 3. Glossario dei termini

| Termine | Significato |
|---|---|
| **Mazzo** | La pila da cui si pesca (i due mazzi mescolati insieme). |
| **Griglia** | La disposizione 5×5 di carte scoperte. |
| **Casella** | Una delle 25 posizioni della griglia. Ogni casella contiene una carta. |
| **Pedina** | Il segnalino che rappresenta un giocatore sulla griglia. |
| **Segnalino Primo Giocatore** | Il gettone che indica chi agisce per primo nel round corrente. |
| **Abbinare (match)** | Scartare dalla mano una carta che corrisponde alla carta di una casella (per valore, per seme di turno o per seme di appartenenza — vedi §6, §10). |
| **Valore** | Il numero della carta, da 1 a 10. |
| **Figura** | Le carte di valore 8, 9 e 10. |
| **Carta coperta** | Una figura (o la casella centrale) girata a faccia in giù: abbinabile **solo** dal seme di turno (o dal seme di appartenenza di un personaggio, §10) e **senza** punti. |
| **Cella distrutta** | *(Modulo Oggetti)* Una casella la cui carta è stata rimossa dal gioco (homing missile): non è più abbinabile né percorribile. |
| **Casella centrale** | La casella al centro della griglia, posizione [3,3]. Contiene sempre l'asso del seme iniziale. |
| **Riga di partenza / Riga-bersaglio** | La riga di 5 caselle sul lato di ciascun giocatore; la riga di partenza di un giocatore è la riga-bersaglio dell'avversario. |
| **Seme di turno** | Il seme che funge da jolly (vedi §6). In modalità fissa non cambia mai; in modalità rotazione avanza ogni round (§9). |
| **Seme di appartenenza** | *(Modulo Personaggi)* Il seme personale di un personaggio: quel giocatore lo tratta come un secondo seme di turno tutto suo (§10). |
| **Carte davanti al giocatore** | Le carte usate per abbinare una figura o la casella centrale non vanno negli scarti: si mettono scoperte davanti a chi le ha giocate. Servono per lo spareggio (§7). |

---

## 4. Preparazione

**Prima di iniziare** si scelgono (schermata iniziale):
- la **modalità seme**: *fissa* (default) o *a rotazione* (§9);
- i **moduli** attivi: *Personaggi* e/o *Oggetti* (nessuno = gioco base).

Poi:
1. Mescola insieme i due mazzi da 40 carte per formare il **mazzo** (80 carte).
2. Pesca la **prima carta** del mazzo: il suo **seme** è il **seme iniziale** (= seme di turno del primo round). Metti la carta da parte, fuori dal gioco.
3. Cerca nel mazzo un **asso (1) del seme iniziale**: sarà la **carta centrale**.
4. **Rimescola il mazzo**. Disponi una **griglia 5×5** di carte scoperte, con l'asso nella **casella centrale [3,3]** e le altre 24 caselle riempite dal mazzo.
5. Le pedine: **N** su **[1,1]**, **S** su **[5,5]**. Coordinate **[x,y]**: [1,1] alto-sx, [5,5] basso-dx. Nord ha riga-bersaglio y=5; Sud ha riga-bersaglio y=1.
6. *(Modulo Personaggi)* Ogni giocatore sceglie un **personaggio** (§10): ottiene il **seme di appartenenza** e, se è attivo anche il modulo Oggetti, l'**oggetto iniziale**.
7. *(Modulo Oggetti)* Forma il **mazzo Oggetti**: 4 carte Oggetto distinte, scelte a caso tra tutti gli oggetti (1 copia ciascuna), a faccia in giù.
8. Ogni giocatore pesca **6 carte** dal mazzo.
9. Poni il mazzo accanto alla griglia. Determina a sorte il **Primo Giocatore**. `round=1`.

```
                 LATO NORD  (il giocatore Nord parte da [1,1])
          [1,1][2,1][3,1][4,1][5,1]   <- riga di partenza Nord / bersaglio di Sud
          [1,2][2,2][3,2][4,2][5,2]
          [1,3][2,3][3,3][4,3][5,3]   [3,3] = casella centrale (asso del seme iniziale)
          [1,4][2,4][3,4][4,4][5,4]
          [1,5][2,5][3,5][4,5][5,5]   <- riga di partenza Sud / bersaglio di Nord
                 LATO SUD  (il giocatore Sud parte da [5,5])
```

---

## 5. Struttura del round (gioco base)

Ordine: **Scelta delle carte → Fase di movimento → Fase di sparo → Fine del round**.
Ogni giocatore, in un round, può **muovere una sola volta** e **sparare una sola volta** (salvo effetti di oggetti, §11).
*(Con il modulo Oggetti attivo, la struttura del round si estende come descritto in §11.4.)*

### 5.1 Scelta delle carte
- Ciascun giocatore sceglie **3 carte** dalla mano (segretamente), poi entrambi le **rivelano** contemporaneamente.
- Le 3 carte rivelate restano **pubbliche e visibili** per tutto il round (mostrate in piccolo nella scheda del giocatore) e si aggiornano man mano che vengono usate.
- Movimento, clash e sparo del round si effettuano usando queste 3 carte.

### 5.2 Fase di movimento
I giocatori muovono **a turno**, iniziando dal Primo Giocatore.
- Si scarta una carta rivelata che abbina una casella **ortogonalmente adiacente** e vi si sposta la pedina. (Se nessuna carta rivelata abbina una casella adiacente → non si muove.)
- **Effetti (movimento volontario):**
  - **Casella centrale scoperta:** +5 (una tantum), la carta si copre, carta usata **davanti al giocatore**, pedina sopra.
  - **Figura scoperta (8/9/10):** +punti (10→3, 9→2, 8→1), la figura si copre, carta usata **davanti al giocatore**, pedina sopra.
  - **Riga-bersaglio:** +5 e la partita termina (§7). Se la casella è anche una figura, valgono entrambi gli effetti.
  - **Carta coperta:** nessun punto, carta usata agli scarti, pedina sopra.
  - **Carta 1-7 scoperta:** solo spostamento.
- I bonus di casella centrale e riga-bersaglio (5 punti) si ottengono **solo con movimento volontario**, mai per spostamento forzato.

**Clash** (destinazione occupata dall'altra pedina): l'attaccante (che ha già speso 1 carta per muovere) sceglie la carta del clash tra le **2** rivelate rimaste; il difensore tra le proprie rivelate disponibili (**3** se non ha ancora mosso, **2** se ha già mosso). Si rivelano; vince il **valore più alto**, poi il **seme** (oro > spade > coppe > bastoni), altrimenti **parità piena**. Le carte del clash vanno agli scarti.
- **Vince l'attaccante:** si sposta sulla casella; il difensore ricolloca la propria pedina (§5.5).
- **Vince il difensore:** resta; può (facoltativo) ricollocare l'attaccante (§5.5).
- **Parità piena:** nessuno si muove.

### 5.5 Spostamento forzato
Destinazioni valide = caselle **ortogonalmente adiacenti** alla pedina da spostare, **escluse** la casella centrale, le caselle occupate e le **celle distrutte**. Nessun bonus. Se una pedina finisce su una **figura scoperta**, la figura **resta scoperta**. Se lo spostamento forzato porta sulla **riga-bersaglio**, la partita termina (ma niente +5). Se non esiste destinazione valida, la pedina resta ferma.

### 5.3 Fase di sparo
I giocatori sparano **a turno**, iniziando dal Primo Giocatore.
- Si scarta una carta rivelata che abbina **una qualsiasi** casella della griglia.
- **Effetti:** pedina avversaria → +5 (sulla **propria** pedina: nessun +5); figura scoperta → +punti, si copre, carta usata **davanti al giocatore**; **double kill** (pedina avversaria **e** figura scoperta sulla stessa casella) → **entrambi** i bonus; carta coperta o 1-7 senza pedina → nessun effetto.

### 5.4 Fine del round
Ogni giocatore scarta le carte rivelate non usate (resta con le 3 non rivelate); si passa il segnalino Primo Giocatore; ciascuno pesca `min(3, carte nel mazzo)`. *(Modalità rotazione: il seme di turno avanza — §9.)*

---

## 6. Seme di turno (jolly)

Le carte del **seme di turno** funzionano da jolly, in movimento e in sparo:
- Una carta in mano del seme di turno abbina **qualsiasi** carta della griglia dello stesso seme, a prescindere dal valore.
- Restano valide le normali regole di abbinamento per valore.
- Le **carte coperte** sono abbinabili **solo** da carte del seme di turno — o del seme di appartenenza di un personaggio (§10) — senza punti; servono solo a potervi transitare/spostare sopra.

---

## 7. Fine della partita e punteggio

Termina quando **una pedina raggiunge la riga-bersaglio** (movimento volontario o spostamento forzato): si completa il **round in corso**, poi si conta. Altrimenti dopo il **round 9** (il mazzo non si rimescola: dal round 9 si gioca con le carte rimaste). Vince chi ha **più punti**.

**Spareggio** (in ordine): 1) chi ha **abbinato la casella centrale**; 2) chi ha **abbinato più figure**; 3) **patta**.

---

## 8. Riepilogo dei punti

| Azione | Punti |
|---|---|
| Movimento volontario sulla casella centrale (una tantum) | 5 |
| Movimento volontario sulla riga-bersaglio | 5 (termina la partita) |
| Abbinare / colpire un 10 · 9 · 8 | 3 · 2 · 1 |
| Sparare sulla pedina avversaria | 5 |

---

## 9. Modalità seme

Scelta a inizio partita (dropdown):
- **Fissa (default):** il seme di turno è il seme iniziale e **non cambia mai**. In questa modalità il personaggio **tactician non è selezionabile** (il suo oggetto, timebomb, non avrebbe effetto).
- **A rotazione:** il seme iniziale è deciso allo stesso modo (§4.2), ma **alla fine di ogni round** il seme di turno avanza nella sequenza **oro → spade → coppe → bastoni → oro** (loop). La casella centrale resta l'asso del **seme iniziale** (colore fisso); il jolly e l'abbinamento delle carte coperte seguono il **seme di turno corrente**.

---

## 10. Modulo Personaggi

- Ogni giocatore sceglie un personaggio a inizio partita (si può scegliere **lo stesso** personaggio). Ogni personaggio dà un **seme di appartenenza**: quel giocatore lo tratta **come un secondo seme di turno personale e fisso** — abbina le carte di quel seme a qualsiasi valore **e** sblocca le **carte coperte** con carte di quel seme, esattamente come il seme di turno. È indipendente dal seme di turno della partita.
- Se è attivo **anche** il modulo Oggetti, il personaggio fornisce un **oggetto iniziale** (§11), usabile una sola volta e **escluso** dal limite di 2 oggetti.
- Se è attivo **solo** Personaggi (senza Oggetti): conta solo il seme di appartenenza (nessun oggetto).
- Se è attivo **solo** Oggetti (senza Personaggi): nessun oggetto iniziale e nessun seme di appartenenza.

| Personaggio | Seme di appartenenza | Oggetto iniziale | Note |
|---|---|---|---|
| **runner** | spade | jetpack | |
| **brawler** | coppe | combat juice | |
| **tactician** | oro | timebomb | non selezionabile in modalità seme fissa |
| **fighter** | bastoni | hook | |

---

## 11. Modulo Oggetti

### 11.1 Regole generali
- Un oggetto è una carta con un'abilità unica; **una volta usato è scartato**.
- Un oggetto è utilizzabile **solo nella fase indicata** e **prima** di eseguire l'azione relativa (vedi struttura del turno §11.4).
- Gli oggetti si mostrano in una scheda **sotto la mano** del giocatore; al passaggio del mouse un **tooltip** ne spiega l'effetto. Un oggetto è **evidenziato solo quando è utilizzabile**.

### 11.2 Come si ottengono
- **Oggetto iniziale:** fornito dal personaggio (se entrambi i moduli sono attivi); usabile **una sola volta**, **escluso** dal limite.
- **Dal mazzo Oggetti:** ogni volta che una **figura viene eliminata** (coperta con un match, sia in **movimento** sia in **sparo**, o distrutta), si pesca 1 oggetto dal mazzo Oggetti. Se il mazzo è vuoto, non si ottiene nulla.
- **Mazzo Oggetti:** 4 carte distinte scelte a caso tra tutti gli oggetti (1 copia ciascuna), a faccia in giù.

### 11.3 Limite
- Non si possono possedere **più di 2 oggetti** contemporaneamente (l'oggetto iniziale del personaggio non conta). Acquisendone un terzo, se ne deve **scartare uno** (anche quello appena pescato).

### 11.4 Struttura del turno (con modulo Oggetti)
```
- inizio turno
- uso oggetto Primo Giocatore : scelta carte
- uso oggetto Secondo Giocatore : scelta carte
- scelta carte
- rivela carte
- uso oggetto Primo Giocatore : movimento
- movimento Primo Giocatore
- uso oggetto Secondo Giocatore : movimento
- movimento Secondo Giocatore
- uso oggetto Primo Giocatore : attacco
- attacco Primo Giocatore
- uso oggetto Secondo Giocatore : attacco
- attacco Secondo Giocatore
- i giocatori pescano 3 carte ciascuno
- il seme di turno avanza alla posizione successiva (solo modalità rotazione)
- fine turno
```

### 11.5 Elenco oggetti

| Oggetto | Fase | Effetto |
|---|---|---|
| **jetpack** | movimento | **Costo: scarti 1 delle tue carte scelte** (rivelate) per usarlo — serve quindi avere almeno **2 carte scelte** disponibili. Per questo movimento puoi abbinare **anche in diagonale** (oltre che ortogonalmente). |
| **jump** | movimento | **Costo: scarti 1 delle tue carte scelte** (rivelate) per usarlo — serve quindi avere almeno **2 carte scelte** disponibili. Per questo movimento puoi abbinare **solo** le caselle a **2 celle** ortogonali di distanza (salto; le celle a 1 non sono disponibili). Es. da [2,2] solo [2,4] e [4,2]. |
| **hook** | attacco | Se colpisci la **pedina avversaria**, puoi spostarla di **1 casella in qualsiasi direzione** (ortogonale **o diagonale**, esclusa la centrale). |
| **homing missile** | attacco | Ottieni i normali **punti** dell'attacco (figura o +5 pedina) **e** la carta abbinata è **rimossa dal gioco**: la cella diventa **Distrutta** (non più abbinabile né percorribile). Se la cella era occupata da una pedina, quella pedina viene **spostata** e a decidere dove è il **giocatore che ha giocato la carta** (il tiratore) — casella ortogonale adiacente, esclusa la centrale; nessun bonus. Se ha attorno solo celle Distrutte, resta ferma. |
| **rush juice** | scelta carte | Questo round esegui **due azioni di movimento** e **rinunci** allo sparo. |
| **combat juice** | scelta carte | Questo round esegui **due azioni di attacco** e **rinunci** al movimento. |
| **timebomb** | scelta carte | Sposti il segnalino del **seme di turno** su un seme a scelta; il ciclo prosegue da lì (solo modalità rotazione). |
| **elemental bomb** | attacco | **Rinunci all'azione di attacco.** Scegli una cella: il **seme** della cella bersaglio e di **tutte le celle ortogonali** diventa un **seme a tua scelta** (le celle distrutte/vuote non cambiano). |
| **barrage** | attacco | **Rinunci all'azione di attacco.** Scegli una cella qualsiasi, poi **altre due** celle **ortogonalmente adiacenti** a una qualsiasi di quelle già scelte (esclusa la **casella centrale** e le celle con una **pedina**): **distruggi tutte e tre** le celle (come *homing missile*; una pedina eventualmente presente sulla prima cella viene ricollocata). |
| **randomizer** | attacco | **Rinunci all'azione di attacco.** Usabile **se mazzo o scarti hanno carte** (se il mazzo è vuoto si rimescolano gli scarti). Scegli fino a **3 celle** della griglia (non la centrale): le loro carte tornano nel **mazzo**, si **mescola**, poi si pescano **altrettante** carte e si **ricollocano** (a scelta del giocatore) nelle celle svuotate. |
| **energy boost** | movimento o attacco | **Peschi 2 carte** dal mazzo e **puoi usarle in questa mano**. Se usi questo tool, a **fine turno scarti 2 carte extra**. (Se il mazzo è vuoto si rimescolano gli scarti.) |
| **energy drain** | movimento o attacco | **Rubi una carta** dalla mano dell'**avversario** (la puoi usare in questa mano). |

---

## 12. Modulo Poteri personaggio

Modulo opzionale (attivabile a inizio partita, richiede il modulo **Personaggi**). Ogni personaggio,
oltre al seme di appartenenza e all'oggetto iniziale, ottiene un **potere** che modifica le sue
condizioni di gioco. I poteri si azzerano a fine round.

| Personaggio | Potere |
|---|---|
| **runner** | **Passivo.** Solo in **fase di movimento** può abbinare le **carte pari tra di loro**: una **carta pari** in mano abbina una **casella scoperta di valore pari** (es. 2 con 4, 4 con 8, 2 con 6). |
| **tactician** | **Attivo.** Attivabile **al massimo 2 volte per partita** (senza altri costi): per il resto del turno usa **anche le carte non scelte** (tutte le carte in mano vengono scoperte e diventano utilizzabili). Se usa per un'azione una carta **non** scelta in fase di selezione, quella carta va **scartata** normalmente. Le carte **non scelte e non usate** **non** vanno negli scarti a fine turno; le carte **scelte** e non usate vanno invece scartate come di consueto. |
| **fighter** | **Passivo.** Solo in **fase di attacco** può abbinare le **carte pari tra di loro**: una **carta pari** in mano abbina una **casella scoperta di valore pari** (es. 2 con 4, 4 con 8, 2 con 6). |
| **brawler** | **Attivo.** Se ha **3 carte disponibili** può **scartarle tutte e tre** per **abbinare qualsiasi cella** (di fatto rinuncia a un'azione, perché consuma tutte le carte). |

*(Nota implementativa: se il modulo Oggetti non è attivo, il tactician non ha oggetti da scartare e
non può attivare il proprio potere.)*

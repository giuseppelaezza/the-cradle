<!-- NON modificare a mano: questo file è un mirror di js/content/regolamento.js (il regolamento in-app, fonte di verità). Per aggiornarlo: modifica regolamento.js e rigenera con lo snippet in CLAUDE.md. -->

# The Cradle — Regolamento

## 1. In breve

In Cradle ogni giocatore assume il ruolo di un **PILOTA** che manovra un **ARM** — un robot da lavoro riconfigurato per il combattimento — che lotta all'interno dell'Arena contro altri **ARMS** per conquistare la gloria. 

Cradle si gioca utilizzando due mazzi di carte da gioco napoletane e tutte le azioni si eseguno **MATCHANDO** carte dalla propria mano con griglia di gioco.



## 2. Il MATCH

Tutto nel gioco ruota attorno al **MATCH**: giocare una carta della mano che corrisponde alla carta di una **CELLA** scoperta. Una tua carta fa MATCH con una CELLA se:

- ha lo **stesso VALORE** della carta nella CELLA; **oppure**
- ha la **stessa SUIT** della carta nella CELLA **ed è un jolly**, cioè è della **GLOBAL SUIT** o del tuo **ARM SUIT**.

Ci sono **due jolly**: la **GLOBAL SUIT**, condivisa dai PILOTI, che **cambia a ogni ROUND**; e l'**ARM SUIT**, personale e **fissa** per tutta la partita.

Le carte di **VALORE 8, 9 e 10** sono gli **OBIETTIVI**: sono quelle che, colpite, valgono punti.

Una **CELLA OFFLINE** (carta a faccia in giù) fa MATCH **solo con un jolly**.

## 3. Preparazione

1. Mescola i due mazzi insieme: questo è il **DECK** (80 carte).
2. Scopri la prima carta: la sua **SUIT** è la **GLOBAL SUIT** del 1° ROUND. Tienila da parte.
3. *(Solo variante griglia 5×5)* Pesca dal DECK un **asso (1)** di quella SUIT: sarà la **CELLA centrale**.
4. Rimescola e disponi la **griglia** di CELLE scoperte (nel 5×5 l'asso va al **centro, [3,3]**).
5. Piazza gli ARM agli angoli: **Nord** su **[1,1]**, **Sud** su **[5,5]** (nel 4×4, su **[4,4]**).
6. Ogni PILOTA sceglie un **ARM** (§7): ottiene **ARM SUIT** e **SKILL**.
7. Ogni PILOTA prepara il proprio **mazzo dei TOOLS** (§3.1): **12 carte**; accanto lascia spazio per i propri **scarti TOOLS**.
8. Ogni PILOTA pesca **[3] TOOL** dal proprio mazzo e **6 carte** in mano.
9. Sorteggia il **1° Pilota**. Si comincia dal ROUND 1.

```
                 LATO NORD  (Nord parte da [1,1])
          [1,1][2,1][3,1][4,1][5,1]
          [1,2][2,2][3,2][4,2][5,2]
          [1,3][2,3][3,3][4,3][5,3]   [3,3] = CELLA centrale (5×5)
          [1,4][2,4][3,4][4,4][5,4]
          [1,5][2,5][3,5][4,5][5,5]
                 LATO SUD  (Sud parte da [5,5])
```

### 3.1 Composizione del mazzo dei TOOLS

Ogni PILOTA ha un **mazzo dei TOOLS** tutto suo, con la sua **pila degli scarti** separata: non c'è un DECK dei TOOLS condiviso.

1. Il mazzo è composto da **12 carte**; ogni TOOL può comparire **al massimo 3 volte**.
2. Ogni PILOTA compone **liberamente** il proprio mazzo. In alternativa, il mazzo è **casuale**: **3 copie** di **4 TOOLS** presi a caso.
3. **A inizio partita** ognuno pesca **[3] TOOL** dal proprio mazzo (§8).
4. Quando il tuo mazzo dei TOOLS finisce, **rimescola i tuoi scarti TOOLS**: diventano il nuovo mazzo.

*Nota:* nel configuratore puoi lasciare i mazzi **casuali** oppure comporli TOOL per TOOL (con il tasto **Fill** completi gli slot vuoti con carte casuali).

### 3.2 Variante: Draft della griglia

In alternativa alla griglia generata a caso, i due PILOTI possono **costruirla insieme** prima di giocare. Con il **Draft** attivo, la preparazione cambia così:

1. Si determina il **1° Pilota** (i mazzi dei TOOLS si preparano come sopra, §3.1), poi la **griglia parte vuota**.
2. A turno — la barra delle fasi mostra **Piazzamento G1 / G2** e l'indicatore di ROUND segna **Draft** — ogni PILOTA **pesca 4 carte** dal DECK, ne **posiziona 2** su CELLE vuote a piacere e **scarta** le altre 2.
3. Nel **5×5** l'ultimo turno completa la griglia con **una sola** carta: chi lo esegue ne piazza 1 e scarta le altre 3.
4. Quando la griglia è **piena**, si **rimescolano gli scarti** del draft nel DECK, ciascuno pesca la mano da **6 carte** e comincia il ROUND 1.

*Nota:* nel Draft la CELLA centrale del 5×5 ospita la carta che vi viene piazzata (non l'asso del seme iniziale). Le CELLE BONUS restano quelle di posizione (§4.2).

### 3.3 Variante: 3-4 giocatori

Si può giocare in **2, 3 o 4**, ma **solo su griglia 5×5**. Ogni PILOTA parte da un **angolo**:

- **4 giocatori:** tutti e quattro gli angoli.
- **3 giocatori:** tre angoli **scelti a caso** fra i quattro.
- **2 giocatori:** angoli in diagonale (come sempre).

Deciso il **1° Pilota**, l'ordine di gioco procede in **senso ORARIO** fra gli angoli occupati.

**Struttura del TURNO:** DEPLOY → **M G1 → M G2 → M G3 → M G4** → **A G4 → A G3 → A G2 → A G1** → FINE TURNO (in MOVIMENTO si parte da G1; in ATTACCO l'ordine si inverte). A fine ROUND il segnalino di 1° Pilota passa all'angolo **successivo in senso orario**.

Il resto delle regole non cambia. In particolare:

- **CLASH:** resta sempre **1 contro 1**, fra chi agisce e l'occupante della CELLA bersaglio; gli altri non partecipano.
- **Sifone Energetico:** se più avversari hanno carte scelte, **scegli tu** da quale rubare.
- **Deep Mind:** la sua SKILL mostra la **STACK DI RISERVA di tutti** gli altri giocatori.
- **Fine partita:** nessuna eliminazione — tutti giocano fino all'ultimo ROUND e si stila la **classifica per punti** (spareggi come al §9).

## 4. Il ROUND

Ogni ROUND scorre in tre fasi: **DEPLOY → MOVIMENTO → ATTACCO**, poi si chiude il ROUND. In ogni ROUND ciascun PILOTA **MUOVE una volta** e **ATTACCA una volta** (salvo effetti dei TOOLS).

**Chi agisce per primo:** nel **MOVIMENTO** parte il 1° Pilota, poi l'avversario; nell'**ATTACCO** l'ordine si **inverte**. Così ognuno gioca per secondo in esattamente una fase.

### 4.1 DEPLOY

Ogni PILOTA sceglie **in segreto 3 carte** dalla propria mano, poi tutti le rivelano insieme. Queste 3 carte sono la **STACK ATTIVA**: sono le uniche che potrai giocare per MUOVERE e ATTACCARE in questo ROUND. Le carte non scelte restano coperte come **STACK DI RISERVA** e serviranno solo nei **CLASH**.

**REMIX (prima di scegliere le 3 carte).** Se non ti piace la mano, puoi spenderne uno: **scarti da 1 a tutte** le carte e ne peschi **altrettante** dal DECK. Ogni PILOTA ha un numero fisso di REMIX per partita (**1, 2 o 3**; di norma **2**), deciso in preparazione.

### 4.2 MOVIMENTO

Nell'ordine di TURNO, ogni PILOTA muove una volta. Gioca dalla STACK ATTIVA una carta che fa **MATCH con una CELLA ORTOGONALE** al tuo ARM e spostati su quella CELLA. Se nessuna carta fa MATCH su una CELLA adiacente, **salti il MOVIMENTO**.

Quello che trovi arrivando (vale solo per un MOVIMENTO scelto, non per gli spostamenti forzati):

- **CELLA centrale:** si **DISATTIVA**; la carta usata resta davanti a te come **trofeo**; scegli **[1] TOOL tra 3**. (I punti per il controllo del centro arrivano a fine ROUND, §4.5.)
- **CELLA BONUS non ancora riscossa:** scegli **[1] TOOL tra 3** (una sola volta per CELLA).
Le **CELLE BONUS** sono quelle che a fine ROUND danno punti-posizione: nel **5×5** il centro e le **4 CELLE ORTOGONALI** al centro; nel **4×4** le **4 CELLE centrali**.

**CLASH — quando entri su una CELLA occupata da un ARM avversario si combatte** . Entrambi scegliete **[1] carta dalla STACK DI RISERVA** e la rivelate. Vince il **VALORE più alto**; a parità di VALORE lo spareggio tra SUIT è **CICLICO** — **oro › spade › coppe › bastoni › oro** — dove ogni SUIT batte quella successiva e la più bassa batte la più alta (quindi **bastoni batte oro**), così ogni SUIT è ugualmente forte. Le due SUIT **opposte** nel ciclo (oro/coppe e spade/bastoni), o due carte identiche, danno **pareggio**. Chi non ha carte di RISERVA perde senza combattere. Le carte del CLASH vanno nella HEAP.

- **Vinci l'attaccante:** avanza sulla CELLA, prende **+3**, e **decide** su quale CELLA ORTOGONALE spostare l'ARM avversario.
- **Vince il difensore, o pareggio:** **nessuno si muove**.

### 4.3 ATTACCO

Nell'ordine di TURNO (§4). Gioca dalla STACK ATTIVA una carta che fa **MATCH con una CELLA qualsiasi** della griglia.

**Un ATTACCO DISATTIVA sempre la CELLA colpita**. In base a cosa colpisci:

- **OBIETTIVO:** **+2 punti**, **+1 trofeo** e scegli **[1] TOOL tra 3**. L'OBIETTIVO si DISATTIVA.
- **ARM avversario:** si apre un **CLASH da ATTACCO** (vedi sotto). Colpire il *proprio* ARM non fa sortisce effetto.
- **CELLA OFFLINE, o carta di VALORE 1–7:** viene DISATTIVATA.

**CLASH da ATTACCO.** Colpire una CELLA su cui c'è un ARM avversario apre sempre un CLASH — anche quando l'attacco arriva da un TOOL come **Granata** o **Spinta**. Si confrontano le carte come nel CLASH da MOVIMENTO (§4.2, dalla STACK DI RISERVA).

- **Vinci tu (attaccante):** prendi **+3** e il colpo va a segno normalmente (se era un OBIETTIVO: si DISATTIVA, ti dà i suoi punti e la scelta di [1] TOOL).
- **Vince il difensore, o pareggio:** il colpo è **parato**: nessun punto, nessun effetto.

A differenza del CLASH da MOVIMENTO, il CLASH da ATTACCO **non sposta mai** gli ARM.

### 4.4 Spostamenti forzati

Alcuni esiti (un CLASH perso, certi TOOLS) obbligano a spostare un ARM. Le destinazioni valide sono le **CELLE ORTOGONALI**, **escluse** la CELLA centrale, le CELLE occupate e le CELLE DISTRUTTE. Lo spostamento forzato non fa scattare alcun bonus d'arrivo. Se non c'è nessuna destinazione valida, l'ARM **resta dov'è**.

**DISTRUZIONE con ARM presente:** un effetto che DISTRUGGE una CELLA occupata può farlo **solo** se l'ARM ha almeno una CELLA ORTOGONALE libera dove essere spostato; altrimenti la CELLA **non viene DISTRUTTA**.

### 4.5 Fine del ROUND

**Punti di posizione** : nel **5×5**, **+3** se il tuo ARM è sul **centro**, **+1** se è su una CELLA ORTOGONALE al centro. Nel **4×4**, **+2** per ciascuna delle 4 CELLE centrali su cui ti trovi.

Poi si riordina la mano: **tieni tutte le carte non usate**; se ne hai **più di 6**, scartane a scelta fino a 6. Passa il segnalino di **1° Pilota** all'avversario. Infine ciascuno **pesca fino a 6 carte**, la **GLOBAL SUIT avanza** (§6) e inizia il ROUND successivo.

**Bonus di SUIT (dopo la pesca).** Se dopo la pesca il tuo ARM si trova su una **CELLA ONLINE**, ottieni un bonus in base alla **SUIT** della carta di quella CELLA:

- **oro:** guadagni **1 punto**.
- **coppe:** peschi **1 TOOL**.
- **bastoni:** peschi **1 carta** dal DECK.
- **spade:** togli **1 punto** a un avversario, senza scendere sotto 0.

Dopo l'**ultimo ROUND** non c'è pesca, ma i bonus che valgono punti — **oro** e **spade** — si applicano comunque prima del conteggio finale (coppe e bastoni no).

## 5. Trofei

Le carte con cui MATCHI un **OBIETTIVO** o la **CELLA centrale** non finiscono nella HEAP: restano **davanti a te** come **trofei**. Contano nello spareggio finale (§9).

## 6. La GLOBAL SUIT

La GLOBAL SUIT del 1° ROUND è la SUIT della prima carta scoperta in preparazione (§3). **Alla fine di ogni ROUND** avanza di un passo nel ciclo **oro → spade → coppe → bastoni → oro…**. La CELLA centrale, invece, resta per sempre l'asso della SUIT iniziale.

## 7. Gli ARM

Ogni PILOTA guida un **ARM**, che gli dà tre cose: una **ARM SUIT** (il jolly personale, §2), una **SKILL ATTIVA** (si attiva un numero limitato di volte a partita) e una **SKILL PASSIVA** (sempre attiva, senza usi).

| ARM | ARM SUIT | SKILL ATTIVA | SKILL PASSIVA |
|---|---|---|---|
| **E-RUN-01** | spade | *(2 usi)* Quando MATCHI un OBIETTIVO in MOVIMENTO, puoi SCARTARE [1] carta dalla STACK ATTIVA per COLPIRLO subito (prendi i punti e la scelta di [1] TOOL). Se la CELLA è occupata si fa CLASH: la SKILL vale solo se lo vinci. | Se ti **muovi** durante la tua fase di MOVIMENTO guadagni **[+1]** punto; se **non ti muovi**, perdi **[1]** punto. |
| **The Sniper** | coppe | *(3 usi)* In MOVIMENTO o ATTACCO, se hai 3 carte nella STACK ATTIVA le SCARTI tutte per MATCHARE una CELLA qualsiasi (SOSTITUISCE l'azione). In ATTACCO su un ARM avversario si apre comunque un CLASH. | Nei CLASH le carte **COPPE** che giochi valgono **[+2]** al VALORE. |
| **Deep Mind** | oro | *(3 usi)* Sbircia la STACK DI RISERVA dell'avversario. | Quando scegli [1] TOOL, scegli **tra 4** invece che tra 3. |
| **Soldier Boy** | bastoni | *(3 usi)* PESCA [3] carte, scegline [1] e con essa **SOVRASCRIVI** la CELLA su cui ti trovi; scarta le altre due. | In ATTACCO le carte di VALORE **PARI** fanno MATCH tra loro (una carta pari colpisce una CELLA di VALORE pari). |
| **Wallie & Glass** | oro | Al posto di un'azione di MOVIMENTO/ATTACCO, se non hai un segnalino **GLASS** sul campo: MATCHA una CELLA ORTOGONALE e vi posizioni il GLASS (l'ARM resta fermo). Il GLASS resta finché un avversario non MATCHA la sua CELLA (nessun punto). A fine ROUND ottieni il bonus di SUIT sia della CELLA dell'ARM sia della CELLA del GLASS. | Se non hai un GLASS sul campo, **[+2]** al VALORE nei CLASH sulle sole carte **ORO**. |

## 8. I TOOLS

### 8.1 Come si ottengono

- **A inizio partita** ne peschi **[3]** dal tuo mazzo (§3.1).
- **Colpendo un OBIETTIVO in ATTACCO**, **entrando in una CELLA BONUS** o **conquistando il centro**: scegli **[1] TOOL tra 3** (gli altri 2 vanno nei tuoi scarti TOOLS).

Quando il tuo mazzo dei TOOLS finisce, rimescola i tuoi **scarti TOOLS** e riparti.

### 8.2 Limite, costi e uso

- Puoi tenerne al massimo **5**. Se superi il limite, ne SCARTI uno.
- Ogni TOOL si usa **una sola volta**, **nella fase indicata**, e **prima** di svolgere l'azione a cui si riferisce.
- **Se non puoi pagare il COSTO di un TOOL, non puoi usarlo.**
- **CONSUMA:** attivabile solo se l'ARM è su una **CELLA ONLINE**; quella CELLA diventa **OFFLINE**.
- **RIGENERA:** attivabile solo se l'ARM è su una **CELLA OFFLINE**; PESCA [1] carta e con essa **SOVRASCRIVI** la CELLA occupata dal tuo ARM (che torna ONLINE). Se RIGENERA è nel COSTO e non è possibile RIGENERARE, il TOOL non può essere usato.
- **SCARTA [n] TOOL:** scegli tu quali **altri** TOOL scartare; se non ne hai a sufficienza non puoi giocare la carta.
- **SOVRASCRIVI una CELLA:** scarti la carta presente (se c'è) e la sostituisci con un'altra carta (di solito pescata). Salvo diversa indicazione, si può SOVRASCRIVERE **qualsiasi** CELLA.

### 8.3 Elenco dei TOOLS

| TOOL | Fase | COSTO | Effetto |
|---|---|---|---|
| **Jetpack** | MOVIMENTO | SCARTA [1] carta dalla STACK ATTIVA | Per questo MOVIMENTO puoi MATCHARE anche le CELLE DIAGONALI. |
| **Salto** | MOVIMENTO | SCARTA [1] carta dalla STACK ATTIVA | Per questo MOVIMENTO puoi MATCHARE solo a DISTANZA [2] su CELLE ORTOGONALI. |
| **Arpione** | MOVIMENTO | SCARTA [1] carta dalla STACK ATTIVA | Per questo MOVIMENTO puoi MATCHARE anche le CELLE ORTOGONALI all'ARM avversario. |
| **Teletrasporto** | MOVIMENTO | Non puoi effettuare la fase di MOVIMENTO questo turno | Muovi su una qualsiasi CELLA VUOTA scoperta con lo **stesso VALORE** della CELLA da cui parti. |
| **Spinta** | ATTACCO | SCARTA [1] TOOL | Se COLPISCI un ARM avversario, lo sposti su una CELLA ORTOGONALE a DISTANZA [1]. |
| **Granata** | ATTACCO | CONSUMA | DISTRUGGE la CELLA colpita. Se era occupata, sposti quell'ARM su una CELLA ORTOGONALE a DISTANZA [1]. |
| **Barrage!** | ATTACCO | CONSUMA | Scegli [1] CELLA VUOTA e DISTRUGGILA. |
| **Bomba Elementale** | ATTACCO | CONSUMA | Scegli [1] CELLA: la sua SUIT e quella delle CELLE ORTOGONALI diventano una SUIT a tua scelta. |
| **Doppio Movimento** | DEPLOY | Non puoi effettuare l'azione di ATTACCO questo turno | Questo TURNO puoi eseguire **[2] MOVIMENTI**. |
| **Doppio Attacco** | DEPLOY | Non puoi effettuare l'azione di MOVIMENTO questo turno | Questo TURNO puoi eseguire **[2] ATTACCHI**. |
| **Cronobomba** | DEPLOY | PERDI [1] punto | Sposta subito la GLOBAL SUIT su una SUIT a tua scelta; la rotazione prosegue da lì. |
| **Randomizzatore** | MOV / ATT | CONSUMA | PESCA fino a [3] carte, poi per ognuna SOVRASCRIVI una CELLA. |
| **Ricarica** | MOV / ATT | — | PESCA [2] carte e aggiungile alla STACK ATTIVA. |
| **Sifone Energetico** | MOV / ATT | — | RUBA [1] carta all'avversario e aggiungila alla STACK ATTIVA. |
| **Ripristina** | MOV / ATT | — | PESCA [3] carte, scegline [1] e con essa SOVRASCRIVI una CELLA DISTRUTTA o OFFLINE. |
| **Remix!** | qualsiasi | PERDI [1] punto | Ripristina [1] uso di REMIX già consumato (non oltre il totale). |
| **Encore!** | qualsiasi | PERDI [1] punto | Ripristina [1] uso della SKILL del tuo ARM già consumato (non oltre il totale). |
| **Carica Disperata** | MOVIMENTO | SCARTA [2] TOOL | Muovi su una CELLA OCCUPATA da un ARM avversario nella tua stessa riga o colonna (senza MATCH): si svolge un CLASH come in un normale MOVIMENTO. |
| **Snipe** | ATTACCO | Non puoi effettuare la fase di ATTACCO questo turno; CONSUMA | Colpisci una CELLA OCCUPATA da un ARM avversario nella tua stessa riga o colonna (senza MATCH): si svolge un CLASH come in un normale ATTACCO. |
| **Santuario** | MOV / ATT | SCARTA [1] TOOL | PESCA [5] carte, SOVRASCRIVI la CELLA che OCCUPI e tutte le CELLE ORTOGONALI. |
| **Feedback Loop** | MOV / ATT | SCARTA [1] carta dalla STACK DI RISERVA | SOVRASCRIVI la CELLA occupata dal tuo ARM con una carta della STACK ATTIVA, poi PESCA [1] carta nella STACK ATTIVA. |
| **Swap!** | MOVIMENTO | RIGENERA; Non puoi effettuare l'azione di ATTACCO questo turno | Scambia la posizione del tuo ARM con quella di un ARM avversario. |
| **Nuke** | ATTACCO | Non puoi effettuare la fase di ATTACCO questo turno; SCARTA [3] TOOL | MATCHA [1] CELLA: quella CELLA e tutte le CELLE ORTOGONALI diventano OFFLINE. Se avevano OBIETTIVI ne ottieni i punti (nessun TOOL). Gli ARM in quelle CELLE perdono [2] punti. |
| **Overcharge** | qualsiasi | SCARTA [1] TOOL | Ottieni **[+2]** al VALORE nei CLASH fino all'inizio del tuo prossimo turno. |
| **Toolbox** | qualsiasi | CONSUMA | PESCA [2] TOOL dal tuo mazzo. |
| **Shuffle** | MOV / ATT | — | Seleziona [2] CELLE ONLINE VUOTE e scambia le carte presenti nelle due CELLE. |
| **Oro Overtake** | MOV / ATT | SCARTA [2] TOOL | Scegli [1] colonna: per ogni CELLA OFFLINE o DISTRUTTA PESCA una carta e con essa SOVRASCRIVI la CELLA, poi tutte le CELLE della colonna diventano SUIT **ORO**. Ogni ARM in quella colonna perde [1] punto. |
| **Spade Overtake** | MOV / ATT | SCARTA [2] TOOL | Come Oro Overtake, ma la colonna diventa SUIT **SPADE**. |
| **Coppe Overtake** | MOV / ATT | SCARTA [2] TOOL | Come Oro Overtake, ma la colonna diventa SUIT **COPPE**. |
| **Bastoni Overtake** | MOV / ATT | SCARTA [2] TOOL | Come Oro Overtake, ma la colonna diventa SUIT **BASTONI**. |
| **Drenaggio** | MOV / ATT | RIGENERA; SCARTA [1] TOOL | Rendi OFFLINE tutte le CELLE ORTOGONALI alla posizione del tuo ARM. |

## 9. Fine della partita

La partita dura un **numero fisso di ROUND** (di norma **8**, configurabile da **7 a 11**). Chiuso l'ultimo ROUND, vince chi ha **più punti**.

**Fine anticipata:** se **alla fine di un ROUND non resta alcuna CELLA ONLINE** sulla griglia, la partita finisce subito e si contano i punti.

In caso di parità, decide — in quest'ordine:

1. chi ha **conquistato la CELLA centrale**;
2. chi ha **più OBIETTIVI** tra i trofei;
3. se ancora pari, è un **pareggio**.

## 10. Riepilogo dei punti

| Come segni | Punti |
|---|---|
| Colpisci un OBIETTIVO (8, 9 o 10) | +2 |
| Vinci un CLASH da attaccante (in MOVIMENTO o in ATTACCO) | +3 |
| Fine ROUND: ARM sul centro (5×5) | +3 |
| Fine ROUND: ARM su una CELLA ORTOGONALE al centro (5×5) | +1 |
| Fine ROUND: ARM su una CELLA BONUS (4×4) | +2 |

## 11. Glossario

| Termine | Significato |
|---|---|
| **PILOTA** | uno dei 2 giocatori |
| **ARM** | il personaggio/pedina che guidi |
| **SKILL** | il potere del tuo ARM |
| **ARM SUIT** | la SUIT personale e fissa del tuo ARM (jolly) |
| **GLOBAL SUIT** | il jolly condiviso dai due PILOTI; cambia a ogni ROUND |
| **SUIT / VALORE** | il seme / il numero di una carta |
| **MATCH** | giocare una carta che corrisponde a una CELLA |
| **OBIETTIVI** | le carte di VALORE 8, 9 e 10 (valgono punti) |
| **CELLA** | una carta della griglia; **ONLINE** = scoperta, **OFFLINE** = coperta, **DISTRUTTA** = rimossa |
| **CELLA VUOTA / OCCUPATA** | senza / con un ARM sopra |
| **CELLA BONUS** | CELLA che a fine ROUND dà punti-posizione |
| **CELLE ORTOGONALI / DIAGONALI** | adiacenti in linea / in diagonale |
| **DEPLOY** | la fase in cui scegli le carte del ROUND |
| **STACK ATTIVA** | le 3 carte scelte in DEPLOY (per MOVIMENTO e ATTACCO) |
| **STACK DI RISERVA** | le carte non scelte in DEPLOY (per i CLASH) |
| **DECK / HEAP** | il mazzo di pesca / la pila degli scarti |
| **mazzo TOOLS / scarti TOOLS** | il mazzo personale dei TOOLS di un PILOTA / la sua pila degli scarti |
| **CLASH** | il confronto di carte quando due ARM si scontrano |
| **COLPIRE** | mandare a segno un attacco (o vincere un CLASH) |
| **SOVRASCRIVI** | sostituisci la carta di una CELLA (scarti quella presente e ne metti un'altra) |
| **CONSUMA** | costo: solo su CELLA ONLINE; quella CELLA diventa OFFLINE |
| **RIGENERA** | costo: solo su CELLA OFFLINE; PESCA [1] carta e con essa SOVRASCRIVI la CELLA del tuo ARM (torna ONLINE). Se non puoi RIGENERARE, non puoi usare il TOOL |
| **REMIX** | in DEPLOY, scartare e ripescare carte |
| **ROUND / TURNO** | il giro completo / il turno di un singolo PILOTA |
| **DISTANZA [N]** | a N CELLE di distanza |

/* Regolamento di The Cradle (regolamento unico). Espone window.CradleRegolamento.A/.B/.C
   (tutte e tre puntano allo stesso testo). Scritto per essere letto al tavolo dai PILOTI. */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.CradleRegolamento = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function build() {
    var s = [];

    s.push("# The Cradle — Regolamento");

    s.push(
"## 1. In breve\n\n" +
"The Cradle è un duello per **2 PILOTI**. Al centro del tavolo c'è una **griglia** di carte scoperte (5×5 o 4×4): ogni carta scoperta è una **CELLA**.\n\n" +
"Ogni PILOTA guida un **ARM** — la propria pedina — e a ogni ROUND lo fa **MUOVERE** e **ATTACCARE** giocando carte dalla mano. Giocare una carta che *corrisponde* a una CELLA si chiama **MATCH**: è così che ci si sposta, si colpisce e si segnano punti.\n\n" +
"Vince chi ha **più punti** al termine dei ROUND previsti.\n\n" +
"*I termini in maiuscolo sono spiegati nel Glossario, in fondo al regolamento.*");

    s.push(
"## 2. Il MATCH\n\n" +
"Tutto nel gioco ruota attorno al **MATCH**: giocare una carta della mano che corrisponde alla carta di una **CELLA** scoperta. Una tua carta fa MATCH con una CELLA se:\n\n" +
"- ha lo **stesso VALORE** della carta nella CELLA; **oppure**\n" +
"- ha la **stessa SUIT** della carta nella CELLA **ed è un jolly**, cioè è della **GLOBAL SUIT** o del tuo **ARM SUIT** (in questo caso il VALORE non conta).\n\n" +
"Ci sono **due jolly**: la **GLOBAL SUIT**, condivisa dai due PILOTI, che **cambia a ogni ROUND**; e l'**ARM SUIT**, personale e **fissa** per tutta la partita.\n\n" +
"Le carte di **VALORE 8, 9 e 10** sono gli **OBIETTIVI**: sono quelle che, colpite, valgono punti.\n\n" +
"Una **CELLA OFFLINE** (carta a faccia in giù) fa MATCH **solo con un jolly** e **non dà punti**: serve unicamente per potervi transitare sopra.");

    s.push(
"## 3. Preparazione\n\n" +
"1. Mescola i due mazzi insieme: è il **DECK** (80 carte).\n" +
"2. Scopri la prima carta: la sua **SUIT** è la **GLOBAL SUIT** del 1° ROUND. Tienila da parte.\n" +
"3. *(Solo 5×5)* Pesca dal DECK un **asso (1)** di quella SUIT: sarà la **CELLA centrale**.\n" +
"4. Rimescola e disponi la **griglia** di CELLE scoperte (nel 5×5 l'asso va al **centro, [3,3]**).\n" +
"5. Piazza gli ARM agli angoli: **Nord** su **[1,1]**, **Sud** su **[5,5]** (nel 4×4, su **[4,4]**).\n" +
"6. Ogni PILOTA sceglie un **ARM** (§7): ottiene **ARM SUIT**, **TOOL di partenza** e **SKILL**.\n" +
"7. Prepara il **DECK dei TOOLS**: **5 tipi** (a caso o concordati), **2 copie ciascuno**; accanto lascia spazio per la **TOOLS HEAP** (gli scarti).\n" +
"8. Ogni PILOTA riceve **[1] TOOL** e pesca **6 carte** in mano.\n" +
"9. Sorteggia il **1° Pilota**. Si comincia dal ROUND 1.\n" +
"\n```\n" +
"                 LATO NORD  (Nord parte da [1,1])\n" +
"          [1,1][2,1][3,1][4,1][5,1]\n" +
"          [1,2][2,2][3,2][4,2][5,2]\n" +
"          [1,3][2,3][3,3][4,3][5,3]   [3,3] = CELLA centrale (5×5)\n" +
"          [1,4][2,4][3,4][4,4][5,4]\n" +
"          [1,5][2,5][3,5][4,5][5,5]\n" +
"                 LATO SUD  (Sud parte da [5,5])\n" +
"```");

    s.push(
"### 3.1 Variante: Draft della griglia\n\n" +
"In alternativa alla griglia generata a caso, i due PILOTI possono **costruirla insieme** prima di giocare. Con il **Draft** attivo, la preparazione cambia così:\n\n" +
"1. Si determina il **1° Pilota** e ciascuno riceve il **TOOL** iniziale (come sopra), poi la **griglia parte vuota**.\n" +
"2. A turno — la barra delle fasi mostra **Piazzamento G1 / G2** e l'indicatore di ROUND segna **Draft** — ogni PILOTA **pesca 4 carte** dal DECK, ne **posiziona 2** su CELLE vuote a piacere e **scarta** le altre 2.\n" +
"3. Nel **5×5** l'ultimo turno completa la griglia con **una sola** carta: chi lo esegue ne piazza 1 e scarta le altre 3.\n" +
"4. Quando la griglia è **piena**, si **rimescolano gli scarti** del draft nel DECK, ciascuno pesca la mano da **6 carte** e comincia il ROUND 1.\n\n" +
"*Nota:* nel Draft la CELLA centrale del 5×5 ospita la carta che vi viene piazzata (non l'asso del seme iniziale). Le CELLE BONUS restano quelle di posizione (§4.2).");

    s.push(
"## 4. Il ROUND\n\n" +
"Ogni ROUND scorre in tre fasi: **DEPLOY → MOVIMENTO → ATTACCO**, poi si chiude il ROUND. In ogni ROUND ciascun PILOTA **MUOVE una volta** e **ATTACCA una volta** (salvo effetti dei TOOLS).\n\n" +
"**Chi agisce per primo (Turno 1-2-2-1, default):** nel **MOVIMENTO** parte il 1° Pilota, poi l'avversario; nell'**ATTACCO** l'ordine si **inverte**. Così ognuno gioca per secondo in esattamente una fase. *(Con l'opzione Turno 1-2-1-2, invece, l'ATTACCO segue lo stesso ordine del MOVIMENTO.)*");

    s.push(
"### 4.1 DEPLOY\n\n" +
"Ogni PILOTA sceglie **in segreto 3 carte** dalla propria mano, poi entrambi le rivelano insieme. Queste 3 carte sono la **STACK ATTIVA**: sono le uniche che potrai giocare per MUOVERE e ATTACCARE in questo ROUND. Le carte non scelte restano coperte come **STACK DI RISERVA** e serviranno solo nei **CLASH**.\n\n" +
"**REMIX (prima di scegliere le 3 carte).** Se non ti piace la mano, puoi spenderne uno: **scarti da 1 a tutte** le carte e ne peschi **altrettante** dal DECK. Ogni PILOTA ha un numero fisso di REMIX per partita (**1, 2 o 3**; di norma **2**), deciso in preparazione.");

    s.push(
"### 4.2 MOVIMENTO\n\n" +
"Nell'ordine di TURNO, ogni PILOTA muove una volta. Gioca dalla STACK ATTIVA una carta che fa **MATCH con una CELLA ORTOGONALE** al tuo ARM e spostati su quella CELLA. Se nessuna carta fa MATCH su una CELLA adiacente, **salti il MOVIMENTO**.\n\n" +
"Quello che trovi arrivando (vale solo per un MOVIMENTO scelto, non per gli spostamenti forzati):\n\n" +
"- **CELLA centrale:** si **DISATTIVA**; la carta usata resta davanti a te come **trofeo**; scegli **[1] TOOL tra 3**. (I punti per il controllo del centro arrivano a fine ROUND, §4.5.)\n" +
"- **OBIETTIVO (8/9/10):** **nessun effetto**. Muovendoci sopra non lo colpisci: resta scoperto e tu ci sali.\n" +
"- **CELLA BONUS non ancora riscossa:** scegli **[1] TOOL tra 3** (una sola volta per CELLA; finché il bonus è disponibile la CELLA mostra un **quadratino nero**).\n" +
"- **CELLA OFFLINE:** nessun punto; la carta usata va nella HEAP.\n\n" +
"Le **CELLE BONUS** sono quelle che a fine ROUND danno punti-posizione: nel **5×5** il centro e le **4 CELLE ORTOGONALI** al centro; nel **4×4** le **4 CELLE centrali**.\n\n" +
"**CLASH — quando entri su una CELLA occupata dall'ARM avversario.** Non lo scavalchi: si combatte. Entrambi scegliete **[1] carta dalla STACK DI RISERVA** e la rivelate. Vince il **VALORE più alto**; a parità di VALORE vince la **SUIT più forte** (oro > spade > coppe > bastoni); se le carte sono identiche è **pareggio**. Chi non ha carte di RISERVA perde senza combattere. Le carte del CLASH vanno nella HEAP.\n\n" +
"- **Vinci tu (attaccante):** avanzi sulla CELLA, prendi **+3**, e **decidi tu** su quale CELLA ORTOGONALE spostare l'ARM avversario.\n" +
"- **Vince il difensore, o pareggio:** **nessuno si muove** e nessuno segna.");

    s.push(
"### 4.3 ATTACCO\n\n" +
"Nell'ordine di TURNO (con l'iniziativa divisa attacca per primo l'avversario del 1° Pilota, §4). Gioca dalla STACK ATTIVA una carta che fa **MATCH con una CELLA qualsiasi** della griglia.\n\n" +
"**Un ATTACCO DISATTIVA sempre la CELLA colpita**, anche se non è un OBIETTIVO. In base a cosa colpisci:\n\n" +
"- **OBIETTIVO:** **+2 punti**, **+1 trofeo** e scegli **[1] TOOL tra 3**. L'OBIETTIVO si DISATTIVA.\n" +
"- **ARM avversario:** si apre un **CLASH da ATTACCO** (vedi sotto). Colpire il *proprio* ARM non fa nulla.\n" +
"- **CELLA OFFLINE, o carta di VALORE 1–7:** si DISATTIVA soltanto, nessun punto.\n\n" +
"**CLASH da ATTACCO.** Colpire una CELLA su cui c'è l'ARM avversario apre sempre un CLASH — anche quando l'attacco arriva da un TOOL come **Granata** o **Spinta**. Si confrontano le carte come nel CLASH da MOVIMENTO (§4.2, dalla STACK DI RISERVA).\n\n" +
"- **Vinci tu (attaccante):** prendi **+3** e il colpo va a segno normalmente (se era un OBIETTIVO: si DISATTIVA, ti dà i suoi punti e la scelta di [1] TOOL; gli effetti di Granata/Spinta si applicano).\n" +
"- **Vince il difensore, o pareggio:** il colpo è **parato**: nessun punto, nessun effetto.\n\n" +
"A differenza del CLASH da MOVIMENTO, il CLASH da ATTACCO **non sposta mai** gli ARM.");

    s.push(
"### 4.4 Spostamenti forzati\n\n" +
"Alcuni esiti (un CLASH perso, certi TOOLS) obbligano a spostare un ARM. Le destinazioni valide sono le **CELLE ORTOGONALI**, **escluse** la CELLA centrale, le CELLE occupate e le CELLE DISTRUTTE. Lo spostamento forzato non fa scattare alcun bonus d'arrivo. Se non c'è nessuna destinazione valida, l'ARM **resta dov'è**.\n\n" +
"**DISTRUZIONE con ARM presente:** un effetto che DISTRUGGE una CELLA occupata può farlo **solo** se l'ARM ha almeno una CELLA ORTOGONALE libera dove essere spostato; altrimenti la CELLA **non viene DISTRUTTA**.");

    s.push(
"### 4.5 Fine del ROUND\n\n" +
"**Punti di posizione** (per il controllo del terreno): nel **5×5**, **+3** se il tuo ARM è sul **centro**, **+1** se è su una CELLA ORTOGONALE al centro. Nel **4×4**, **+2** per ciascuna delle 4 CELLE centrali su cui ti trovi.\n\n" +
"Poi si riordina la mano: **tieni tutte le carte non usate**; se ne hai **più di 6**, scartane a scelta fino a 6. Passa il segnalino di **1° Pilota** all'avversario. Infine ciascuno **pesca fino a 6 carte**, la **GLOBAL SUIT avanza** (§6) e inizia il ROUND successivo.");

    s.push(
"## 5. Trofei\n\n" +
"Le carte con cui MATCHI un **OBIETTIVO** o la **CELLA centrale** non finiscono nella HEAP: restano **davanti a te** come **trofei**. Contano nello spareggio finale (§9).");

    s.push(
"## 6. La GLOBAL SUIT\n\n" +
"La GLOBAL SUIT del 1° ROUND è la SUIT della prima carta scoperta in preparazione (§3). **Alla fine di ogni ROUND** avanza di un passo nel ciclo **oro → spade → coppe → bastoni → oro…**. La CELLA centrale, invece, resta per sempre l'asso della SUIT iniziale.");

    s.push(
"## 7. Gli ARM\n\n" +
"Ogni PILOTA guida un **ARM**, che gli dà tre cose: una **ARM SUIT** (il jolly personale, §2), un **TOOL di partenza** e una **SKILL**.\n\n" +
"| ARM | ARM SUIT | TOOL di partenza | SKILL |\n" +
"|---|---|---|---|\n" +
"| **E-RUN-01** | spade | Jetpack | *(2 usi)* Quando MATCHI un OBIETTIVO in MOVIMENTO, puoi SCARTARE [1] carta dalla STACK ATTIVA per COLPIRLO subito (prendi i suoi punti e la scelta di [1] TOOL). Se la CELLA è occupata si fa CLASH: la SKILL vale solo se lo vinci. |\n" +
"| **The Sniper** | coppe | Barrage! | *(3 usi)* In MOVIMENTO o ATTACCO, se hai 3 carte nella STACK ATTIVA le SCARTI tutte per MATCHARE una CELLA qualsiasi (SOSTITUISCE l'azione). In ATTACCO su un ARM avversario si apre comunque un CLASH. |\n" +
"| **Deep Mind** | oro | Manipolatore Temporale | *(3 usi)* Sbircia la STACK DI RISERVA dell'avversario. Inoltre, passiva: quando scegli [1] TOOL, scegli **tra 4** invece che tra 3. |\n" +
"| **Soldier Boy** | bastoni | Spinta | *Passiva:* in ATTACCO le carte di VALORE **PARI** fanno MATCH tra loro (una carta pari colpisce una CELLA di VALORE pari). |\n\n" +
"Il TOOL di partenza si usa **una sola volta** e **non occupa** posto nel limite dei TOOLS (§8).");

    s.push(
"## 8. I TOOLS\n\n" +
"### 8.1 Come si ottengono\n\n" +
"- **Colpendo un OBIETTIVO in ATTACCO**, **entrando in una CELLA BONUS** o **conquistando il centro**: scegli **[1] TOOL tra 3** (gli altri 2 vanno nella TOOLS HEAP).\n" +
"- **A inizio partita** ne ricevi **[1]**, oltre a quello dell'ARM.\n\n" +
"Se il DECK dei TOOLS finisce, rimescola la **TOOLS HEAP** e riparti.\n\n" +
"### 8.2 Limite e uso\n\n" +
"- Puoi tenerne al massimo **4** (quello di partenza dell'ARM non conta). Se superi il limite, ne SCARTI uno.\n" +
"- Ogni TOOL si usa **una sola volta**, **nella fase indicata**, e **prima** di svolgere l'azione a cui si riferisce.\n\n" +
"### 8.3 Elenco dei TOOLS\n\n" +
"| TOOL | Fase | Effetto |\n" +
"|---|---|---|\n" +
"| **Jetpack** | MOVIMENTO | COSTO: SCARTA [1] carta dalla STACK ATTIVA. Per questo MOVIMENTO puoi MATCHARE anche le CELLE DIAGONALI. |\n" +
"| **Salto** | MOVIMENTO | COSTO: SCARTA [1] carta dalla STACK ATTIVA. Per questo MOVIMENTO puoi MATCHARE solo a DISTANZA [2] su CELLE ORTOGONALI. |\n" +
"| **Arpione** | MOVIMENTO | COSTO: SCARTA [1] carta dalla STACK ATTIVA. Per questo MOVIMENTO puoi MATCHARE anche le CELLE ORTOGONALI all'ARM avversario. |\n" +
"| **Teletrasporto** | MOVIMENTO | SOSTITUISCE il MOVIMENTO. Salta su una qualsiasi CELLA VUOTA scoperta con lo **stesso VALORE** della CELLA da cui parti. |\n" +
"| **Spinta** | ATTACCO | Se COLPISCI un ARM avversario, lo sposti su una CELLA ORTOGONALE a DISTANZA [1]. |\n" +
"| **Granata** | ATTACCO | DISTRUGGE la CELLA colpita. Se era occupata, sposti quell'ARM su una CELLA ORTOGONALE a DISTANZA [1]. |\n" +
"| **Barrage!** | ATTACCO | SOSTITUISCE l'ATTACCO. Scegli [1] CELLA VUOTA e DISTRUGGILA. |\n" +
"| **Bomba Elementale** | ATTACCO | Scegli [1] CELLA: la sua SUIT e quella delle CELLE ORTOGONALI diventano una SUIT a tua scelta. |\n" +
"| **Doppio Movimento** | DEPLOY | SOSTITUISCE l'ATTACCO: questo TURNO esegui **[2] MOVIMENTI**. |\n" +
"| **Doppio Attacco** | DEPLOY | SOSTITUISCE il MOVIMENTO: questo TURNO esegui **[2] ATTACCHI**. |\n" +
"| **Manipolatore Temporale** | DEPLOY | Sposta subito la GLOBAL SUIT su una SUIT a tua scelta; la rotazione prosegue da lì. |\n" +
"| **Randomizzatore** | MOV / ATT | SOSTITUISCE l'azione. Scegli fino a [3] CELLE scoperte e SOVRASCRIVILE (le carte tornano nel DECK, si mescola e si pesca per rimpiazzarle). |\n" +
"| **Ricarica** | MOV / ATT | PESCA [2] carte e aggiungile alla STACK ATTIVA. |\n" +
"| **Sifone Energetico** | MOV / ATT | RUBA [1] carta all'avversario e aggiungila alla STACK ATTIVA. |\n" +
"| **Ricostruisci** | MOV / ATT | PESCA [3] carte, scegline [1] e con essa SOVRASCRIVI una CELLA DISTRUTTA o OFFLINE. |\n" +
"| **Remix!** | qualsiasi | Aggiunge [1] uso di REMIX. |\n" +
"| **Encore!** | qualsiasi | Aggiunge [1] uso alla SKILL del tuo ARM. |");

    s.push(
"## 9. Fine della partita\n\n" +
"La partita dura un **numero fisso di ROUND** (di norma **9**, configurabile da **7 a 11**). Chiuso l'ultimo ROUND, vince chi ha **più punti**.\n\n" +
"In caso di parità, decide — in quest'ordine:\n\n" +
"1. chi ha **conquistato la CELLA centrale**;\n" +
"2. chi ha **più OBIETTIVI** tra i trofei;\n" +
"3. se ancora pari, è **patta**.");

    s.push(
"## 10. Riepilogo dei punti\n\n" +
"| Come segni | Punti |\n" +
"|---|---|\n" +
"| Colpisci un OBIETTIVO (8, 9 o 10) | +2 |\n" +
"| Vinci un CLASH da attaccante (in MOVIMENTO o in ATTACCO) | +3 |\n" +
"| Fine ROUND: ARM sul centro (5×5) | +3 |\n" +
"| Fine ROUND: ARM su una CELLA ORTOGONALE al centro (5×5) | +1 |\n" +
"| Fine ROUND: ARM su una CELLA BONUS (4×4) | +2 |");

    s.push(
"## 11. Glossario\n\n" +
"| Termine | Significato |\n" +
"|---|---|\n" +
"| **PILOTA** | uno dei 2 giocatori |\n" +
"| **ARM** | il personaggio/pedina che guidi |\n" +
"| **SKILL** | il potere del tuo ARM |\n" +
"| **ARM SUIT** | la SUIT personale e fissa del tuo ARM (jolly) |\n" +
"| **GLOBAL SUIT** | il jolly condiviso dai due PILOTI; cambia a ogni ROUND |\n" +
"| **SUIT / VALORE** | il seme / il numero di una carta |\n" +
"| **MATCH** | giocare una carta che corrisponde a una CELLA |\n" +
"| **OBIETTIVI** | le carte di VALORE 8, 9 e 10 (valgono punti) |\n" +
"| **CELLA** | una carta della griglia; **ONLINE** = scoperta, **OFFLINE** = coperta, **DISTRUTTA** = rimossa |\n" +
"| **CELLA VUOTA / OCCUPATA** | senza / con un ARM sopra |\n" +
"| **CELLA BONUS** | CELLA che a fine ROUND dà punti-posizione |\n" +
"| **CELLE ORTOGONALI / DIAGONALI** | adiacenti in linea / in diagonale |\n" +
"| **DEPLOY** | la fase in cui scegli le carte del ROUND |\n" +
"| **STACK ATTIVA** | le 3 carte scelte in DEPLOY (per MOVIMENTO e ATTACCO) |\n" +
"| **STACK DI RISERVA** | le carte non scelte in DEPLOY (per i CLASH) |\n" +
"| **DECK / HEAP** | il mazzo di pesca / la pila degli scarti |\n" +
"| **TOOLS / TOOLS HEAP** | gli oggetti / la loro pila degli scarti |\n" +
"| **CLASH** | il confronto di carte quando due ARM si scontrano |\n" +
"| **COLPIRE** | mandare a segno un attacco (o vincere un CLASH) |\n" +
"| **REMIX** | in DEPLOY, scartare e ripescare carte |\n" +
"| **ROUND / TURNO** | il giro completo / il turno di un singolo PILOTA |\n" +
"| **DISTANZA [N]** | a N CELLE di distanza |");

    return s.join("\n\n");
  }

  var TEXT = build();
  return { A: TEXT, B: TEXT, C: TEXT };
});

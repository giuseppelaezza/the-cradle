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
"The Cradle è un gioco per **2 PILOTI**. Sul tavolo si dispone una **griglia** (5×5 o 4×4) di carte scoperte: ogni carta scoperta è una **CELLA ONLINE**. " +
"A **TURNO** muovi il tuo **ARM** (la tua pedina) e lo fai **ATTACCARE**, giocando le carte della tua **STACK** (la mano) per fare **MATCH** con le CELLE della griglia e segnare punti.\n\n" +
"Ogni PILOTA controlla un **ARM** (con una **ARM SUIT**, un **TOOL di partenza** e una **SKILL**) e durante la partita raccoglie altri **TOOLS**.\n\n" +
"**Obiettivo:** avere più punti dell'avversario al termine dei **ROUND** di gioco.");

    s.push(
"## 2. Glossario\n\n" +
"| Termine | Significato |\n" +
"|---|---|\n" +
"| **PILOTA** | uno dei 2 giocatori |\n" +
"| **ARM** | il personaggio/pedina che controlli |\n" +
"| **SKILL** | il potere dell'ARM |\n" +
"| **ARM SUIT** | la SUIT personale e fissa del tuo ARM (jolly) |\n" +
"| **GLOBAL SUIT** | la SUIT di TURNO, jolly per entrambi; cambia a ogni ROUND |\n" +
"| **DEPLOY** | la fase di scelta delle carte |\n" +
"| **STACK** | la tua mano di carte |\n" +
"| **STACK ATTIVA** | le carte scelte in DEPLOY (per MOVIMENTO/ATTACCO) |\n" +
"| **STACK DI RISERVA** | le carte non scelte in DEPLOY (per i CLASH) |\n" +
"| **DECK** | il mazzo di pesca |\n" +
"| **HEAP** | la pila degli scarti |\n" +
"| **TOOLS** | gli oggetti; **TOOLS HEAP** = i loro scarti |\n" +
"| **CELLA ONLINE / OFFLINE / DISTRUTTA** | carta scoperta / coperta / assente |\n" +
"| **CELLA VUOTA / OCCUPATA** | senza / con un ARM sopra |\n" +
"| **CELLA BONUS** | CELLA che dà punti-posizione a fine TURNO |\n" +
"| **CELLE ORTOGONALI / DIAGONALI** | CELLE adiacenti in linea / in diagonale |\n" +
"| **MATCH** | giocare una carta che corrisponde a una CELLA |\n" +
"| **SUIT / VALORE** | il seme / il numero di una carta |\n" +
"| **OBIETTIVI** | le carte di VALORE 8, 9, 10 |\n" +
"| **ROUND / TURNO** | il giro completo / il turno di un PILOTA |\n" +
"| **REMIX** | scarta e ripesca carte in DEPLOY (opzionale) |\n" +
"| **COLPIRE** | vincere un CLASH oppure ATTACCARE una CELLA VUOTA |\n" +
"| **DISTANZA [N]** | a N CELLE di distanza |");

    s.push(
"## 3. Come si fa MATCH\n\n" +
"**MATCHARE** significa giocare dalla STACK una carta che corrisponde alla carta di una **CELLA ONLINE**. Una tua carta fa MATCH se:\n\n" +
"- ha lo **stesso VALORE** della carta nella CELLA; **oppure**\n" +
"- è della **GLOBAL SUIT** o del tuo **ARM SUIT** (funziona da **jolly**) **e** ha la **stessa SUIT** della carta nella CELLA, a qualsiasi VALORE.\n\n" +
"Una **CELLA OFFLINE** (una carta a faccia in giù) fa MATCH **solo** con un jolly (GLOBAL SUIT o ARM SUIT) e **non dà punti**: serve solo per potervi passare sopra.\n\n" +
"La **GLOBAL SUIT** fa da jolly per entrambi i PILOTI e **cambia a ogni ROUND** (§7). L'**ARM SUIT** è fisso e **non cambia mai**.\n\n" +
"Gli **OBIETTIVI** sono le carte di VALORE **8, 9 e 10**.");

    s.push(
"## 4. Preparazione\n\n" +
"1. Mescola insieme i due mazzi: ottieni il **DECK** (80 carte).\n" +
"2. **PESCA** la prima carta: la sua **SUIT** è la **GLOBAL SUIT** del 1° ROUND. Mettila da parte.\n" +
"3. (5×5) Cerca nel DECK un **asso (1)** di quella SUIT: sarà la **CELLA centrale**.\n" +
"4. Rimescola. Disponi la **griglia** di CELLE ONLINE (nel 5×5 l'asso al **centro [3,3]**).\n" +
"5. Piazza gli ARM: **Nord** su **[1,1]**, **Sud** su **[5,5]** (nel 4×4: **[4,4]**).\n" +
"6. Ogni PILOTA sceglie un **ARM** (§8): riceve **ARM SUIT**, **TOOL di partenza** e **SKILL**.\n" +
"7. Prepara il **DECK dei TOOLS**: **5 tipi** (a caso o concordati), **2 copie ciascuno**, con accanto la **TOOLS HEAP**.\n" +
"8. Ogni PILOTA riceve **[1] TOOL extra** e **PESCA 6 carte** nella STACK.\n" +
"9. Sorteggia il **1° Pilota**. Si parte dal ROUND 1.\n" +
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
"## 5. Il ROUND\n\n" +
"Ogni ROUND si svolge in quest'ordine: **DEPLOY → MOVIMENTO → ATTACCO → Fine ROUND**.\n" +
"In un ROUND ogni PILOTA **MUOVE una volta** e **ATTACCA una volta** (salvo effetti dei TOOLS).\n\n" +
"**Iniziativa divisa (Turno 1-2-2-1, default):** nel **MOVIMENTO** agisce per primo il 1° Pilota, poi l'avversario; nell'**ATTACCO** l'ordine si **inverte**. Così ciascuno agisce per **secondo** in esattamente una fase. *(Opzione Turno 1-2-1-2: l'ATTACCO segue lo stesso ordine del MOVIMENTO.)*");

    s.push(
"### 5.1 DEPLOY\n\n" +
"Ognuno sceglie **in segreto 3 carte** dalla STACK e le rivela: sono la **STACK ATTIVA** (usata per MOVIMENTO e ATTACCO per tutto il ROUND). Le altre carte restano coperte nella **STACK DI RISERVA** (usata nei CLASH).");

    s.push(
"### 5.2 MOVIMENTO\n\n" +
"I PILOTI muovono **a TURNO**, dal 1° Pilota.\n\n" +
"Gioca una carta della STACK ATTIVA che fa **MATCH con una CELLA ORTOGONALE** al tuo ARM e spostati lì. Se nessuna carta fa MATCH su una CELLA adiacente, **non MUOVI**.\n\n" +
"**Effetti d'arrivo** (solo per MOVIMENTO scelto, non per spostamenti forzati):\n\n" +
"- **CELLA centrale ONLINE:** nessun punto immediato; il centro si **DISATTIVA**; la carta usata resta davanti a te (trofeo); scegli **[1] TOOL tra 3**.\n" +
"- **OBIETTIVO ONLINE (8/9/10):** **nessun effetto** (muovendovi sopra non lo COLPISCI); resta ONLINE e ci sali sopra.\n" +
"- **CELLA BONUS non ancora riscossa:** scegli **[1] TOOL tra 3** (una sola volta per CELLA).\n" +
"- **Riga avversaria:** **nessun effetto**.\n" +
"- **CELLA OFFLINE:** nessun punto; la carta usata va nella HEAP.\n\n" +
"I punti di **posizione** si contano a fine TURNO (§5.5). Le **CELLE BONUS** — quelle che danno punti a fine TURNO: nel 5×5 il **centro** e le **4 CELLE ORTOGONALI** al centro; nel 4×4 le **4 CELLE centrali** — danno alla **prima** pedina che vi entra la scelta di **[1] TOOL tra 3** (una sola volta per CELLA). Finché il bonus di una CELLA non è riscosso, la CELLA mostra un **quadratino nero**.\n\n" +
"**CLASH (la CELLA d'arrivo è OCCUPATA dall'ARM avversario).** Entrambi scelgono **[1] carta dalla STACK DI RISERVA** e la confrontano: vince il **VALORE più alto**; a parità di VALORE vince la **SUIT più forte** (oro > spade > coppe > bastoni); se anche la SUIT è pari è **pareggio**. Chi non ha carte di RISERVA non contesta e perde. Le carte del CLASH vanno nella HEAP.\n\n" +
"- **Vince l'attaccante:** avanza sulla CELLA e ottiene **+3**; è l'attaccante a decidere dove spostare il difensore, su una **CELLA ORTOGONALE** alla CELLA conquistata.\n" +
"- **Vince il difensore o pareggio:** **nessuno si sposta** e nessun punto.");

    s.push(
"### 5.3 ATTACCO\n\n" +
"I PILOTI ATTACCANO **a TURNO** (con iniziativa divisa parte l'avversario del 1° Pilota, §5). Gioca una carta della STACK ATTIVA che fa **MATCH con una CELLA qualsiasi**.\n\n" +
"**ATTACCARE una CELLA la DISATTIVA sempre** (anche se non è un OBIETTIVO). Effetti:\n\n" +
"- **ARM avversario sulla CELLA:** **+5** (ATTACCARE il proprio ARM non dà nulla). *(Con l'opzione **Clash su Attacco** si apre invece un CLASH, §13.)*\n" +
"- **OBIETTIVO ONLINE:** **+punti** (10 → 3, 9 → 2, 8 → 1) e **+1 trofeo**; scegli **[1] TOOL tra 3**. L'OBIETTIVO si DISATTIVA.\n" +
"- **CELLA OFFLINE / carta 1–7:** si DISATTIVA, nessun punto.");

    s.push(
"### 5.4 Spostamento forzato\n\n" +
"Alcune situazioni (CLASH perso, TOOLS) costringono a spostare un ARM. Le destinazioni valide sono le **CELLE ORTOGONALI**, **escluse** la CELLA centrale, le CELLE OCCUPATE e le CELLE DISTRUTTE. Nessun bonus. Se non esiste destinazione valida, l'ARM **resta fermo**.\n\n" +
"**DISTRUZIONE bloccata:** un effetto che **DISTRUGGE** una CELLA OCCUPATA può farlo **solo** se l'ARM ha almeno una **CELLA ORTOGONALE libera** dove essere spostato. Altrimenti la CELLA **non viene DISTRUTTA**.");

    s.push(
"### 5.5 Fine ROUND\n\n" +
"**Punti di posizione:** ogni PILOTA guadagna **+3** se il suo ARM è sul **centro**, **+1** se è su una **CELLA ORTOGONALE** al centro (5×5). Nel **4×4** le CELLE BONUS sono le **4 centrali** e danno **+2** ciascuna.\n\n" +
"Ogni PILOTA **tiene tutte le carte non usate**. Se ne ha **più di 6** nella STACK, ne **SCARTA a scelta** fino a 6. Si passa il segnalino **1° Pilota** all'avversario. Poi ciascuno **PESCA fino ad avere 6 carte** (all'inizio del TURNO tutti hanno esattamente 6 carte). La **GLOBAL SUIT avanza** (§7).");

    s.push(
"## 6. Trofei\n\n" +
"Le carte usate per MATCHARE un **OBIETTIVO** o la **CELLA centrale** non vanno nella HEAP: restano **davanti a te** come **trofei**. Contano per lo spareggio (§10).");

    s.push(
"## 7. Rotazione della GLOBAL SUIT\n\n" +
"La GLOBAL SUIT del 1° ROUND è la SUIT della prima carta (§4). **Alla fine di ogni ROUND** la GLOBAL SUIT avanza nella sequenza **oro → spade → coppe → bastoni → oro** (in loop). " +
"La CELLA centrale resta sempre l'asso della SUIT iniziale.");

    s.push(
"## 8. ARM\n\n" +
"Ogni PILOTA controlla un **ARM**, che gli dà tre cose: una **ARM SUIT** (jolly personale e fisso, §3), un **TOOL di partenza** e una **SKILL**.\n\n" +
"| ARM | ARM SUIT | TOOL di partenza | SKILL |\n" +
"|---|---|---|---|\n" +
"| **E-RUN-01** | spade | Jetpack | SKILL (2 usi): quando MATCHI un OBIETTIVO in MOVIMENTO puoi SCARTARE [1] carta dalla STACK ATTIVA per COLPIRLO (ne ottieni il VALORE e la scelta di [1] TOOL). Se la CELLA è OCCUPATA si fa CLASH: la SKILL vale solo se vinci. |\n" +
"| **The Sniper** | coppe | Barrage! | SKILL (3 usi): in MOVIMENTO o ATTACCO, se hai 3 carte nella STACK ATTIVA le SCARTI tutte per MATCHARE una CELLA qualsiasi (SOSTITUISCI l'azione). |\n" +
"| **Deep Mind** | oro | Manipolatore Temporale | SKILL (3 usi): guarda la STACK DI RISERVA dell'ARM avversario. Passiva: quando scegli [1] TOOL scegli tra 4 invece che tra 3. |\n" +
"| **Soldier Boy** | bastoni | Spinta | SKILL passiva: in ATTACCO MATCHI le carte di VALORE PARI tra loro (una carta pari MATCHA una CELLA ONLINE di VALORE pari). |\n\n" +
"Il TOOL di partenza dell'ARM si usa **una sola volta** e **non conta** nel limite TOOLS (§9).");

    s.push(
"## 9. TOOLS\n\n" +
"### 9.1 Come si ottengono\n\n" +
"- **COLPENDO un OBIETTIVO in ATTACCO** o **entrando in una CELLA BONUS**: scegli **[1] TOOL tra 3** (gli altri 2 nella TOOLS HEAP).\n" +
"- **A inizio partita** ogni PILOTA riceve **[1] TOOL**, oltre a quello dell'ARM.\n\n" +
"Quando il **DECK dei TOOLS si esaurisce**, rimescola la **TOOLS HEAP**.\n\n" +
"### 9.2 Limite e uso\n\n" +
"- Puoi possedere al massimo **4 TOOLS** (il TOOL di partenza dell'ARM **non** conta). Se superi il limite, ne **SCARTI uno**.\n" +
"- Un TOOL si usa **una sola volta**, **nella fase indicata** e **prima** di eseguire l'azione a cui si riferisce.\n\n" +
"### 9.3 Elenco dei TOOLS\n\n" +
"| TOOL | Fase | Effetto |\n" +
"|---|---|---|\n" +
"| **Jetpack** | MOVIMENTO | COSTO: SCARTA [1] carta dalla STACK ATTIVA. Durante questa azione di MOVIMENTO puoi MATCHARE anche le CELLE DIAGONALI alla tua posizione. |\n" +
"| **Salto** | MOVIMENTO | COSTO: SCARTA [1] carta dalla STACK ATTIVA. Durante questa azione di MOVIMENTO puoi MATCHARE solo a DISTANZA [2] su CELLE ORTOGONALI. |\n" +
"| **Spinta** | ATTACCO | Se COLPISCI una CELLA OCCUPATA da un ARM avversario, sposti quell'ARM su una CELLA ORTOGONALE a DISTANZA [1]. |\n" +
"| **Granata** | ATTACCO | DISTRUGGI la CELLA bersaglio dell'ATTACCO. Se è OCCUPATA, sposti l'ARM avversario su una CELLA ORTOGONALE a DISTANZA [1]. |\n" +
"| **Doppio Movimento** | DEPLOY | SOSTITUISCI l'ATTACCO. Questo TURNO esegui [2] MOVIMENTI. |\n" +
"| **Doppio Attacco** | DEPLOY | SOSTITUISCI il MOVIMENTO. Questo TURNO esegui [2] ATTACCHI. |\n" +
"| **Manipolatore Temporale** | DEPLOY | Sposta la GLOBAL SUIT su una SUIT a tua scelta; la rotazione prosegue da lì. |\n" +
"| **Bomba Elementale** | ATTACCO | Scegli [1] CELLA: la sua SUIT e quella delle sue CELLE ORTOGONALI diventa una SUIT a tua scelta. |\n" +
"| **Barrage!** | ATTACCO | SOSTITUISCI l'ATTACCO. Scegli [1] CELLA VUOTA → DISTRUGGILA. |\n" +
"| **Randomizzatore** | ATTACCO / MOVIMENTO | SOSTITUISCI l'AZIONE. Scegli fino a [3] CELLE ONLINE → SOVRASCRIVILE (le carte tornano nel DECK, si mescola e si PESCA per rimpiazzarle). |\n" +
"| **Ricarica** | ATTACCO / MOVIMENTO | PESCA [2] e aggiungi alla STACK ATTIVA. |\n" +
"| **Sifone Energetico** | ATTACCO / MOVIMENTO | RUBA [1] e aggiungi alla STACK ATTIVA. |\n" +
"| **Ricostruisci** | ATTACCO / MOVIMENTO | PESCA [3] e scegli [1]: SOVRASCRIVI [1] CELLA DISTRUTTA o OFFLINE con la carta scelta. |\n" +
"| **Remix!** | DEPLOY / ATTACCO / MOVIMENTO | Aggiungi [1] uso a REMIX. |\n" +
"| **Encore!** | DEPLOY / ATTACCO / MOVIMENTO | Aggiungi [1] uso alla SKILL del tuo ARM. |\n" +
"| **Teletrasporto** | MOVIMENTO | SOSTITUISCI il MOVIMENTO. Sposta il tuo ARM su una qualunque CELLA ONLINE VUOTA con lo stesso VALORE della CELLA su cui ti trovi. |\n" +
"| **Arpione** | MOVIMENTO | COSTO: SCARTA [1] carta dalla STACK ATTIVA. Durante questa azione di MOVIMENTO puoi MATCHARE anche le CELLE ORTOGONALI all'ARM avversario. |");

    s.push(
"## 10. Fine della partita\n\n" +
"La partita dura un **numero fisso di ROUND** (di norma **9**, configurabile da **7 a 11**). Al termine dell'ultimo ROUND si contano i punti.\n\n" +
"Vince chi ha **più punti**. In caso di parità, spareggio in quest'ordine:\n\n" +
"1. chi ha **conquistato la CELLA centrale**;\n" +
"2. chi ha **più OBIETTIVI** a trofeo;\n" +
"3. se ancora pari, la partita è **patta**.");

    s.push(
"## 11. Riepilogo dei punti\n\n" +
"| Azione | Punti |\n" +
"|---|---|\n" +
"| Fine TURNO: ARM su CELLA ORTOGONALE al centro | 1 |\n" +
"| Fine TURNO: ARM sul centro | 3 |\n" +
"| Fine TURNO: ARM su CELLA BONUS (4×4) | 2 |\n" +
"| COLPIRE un OBIETTIVO 10 · 9 · 8 | 3 · 2 · 1 |\n" +
"| ATTACCARE l'ARM avversario | 5 |\n" +
"| Vincere un CLASH da attaccante | 3 |");

    s.push(
"## 12. Opzione: REMIX\n\n" +
"Se attivata, ogni PILOTA ha un numero fisso di usi di **REMIX** (1, 2 o 3; di norma 2). " +
"Durante il proprio **DEPLOY**, prima di fissare le 3 carte, puoi usare un REMIX: **SCARTI da 1 a tutte** le carte della STACK e ne **PESCHI altrettante** dal DECK. Ogni uso consuma un REMIX.");

    s.push(
"## 13. Opzione: Clash su Attacco\n\n" +
"Se attivata, **ATTACCARE una CELLA OCCUPATA dall'ARM avversario** apre un **CLASH** invece di dare i normali +5 — anche con **Granata** o **Spinta**. " +
"Entrambi scelgono [1] carta dalla **STACK DI RISERVA** e la confrontano con le regole del CLASH da MOVIMENTO. " +
"Se vince **l'attaccante** ottiene **+3** e il colpo si risolve normalmente (un OBIETTIVO si DISATTIVA, dà i suoi punti e la scelta di [1] TOOL; gli effetti di Granata/Spinta si applicano). " +
"Se vince il **difensore** o è **pareggio**, il colpo è **parato**: nessun punto e nessun effetto. In nessun caso il CLASH da ATTACCO sposta gli ARM.");

    return s.join("\n\n");
  }

  var TEXT = build();
  return { A: TEXT, B: TEXT, C: TEXT };
});

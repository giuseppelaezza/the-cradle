/* Regolamento di The Cradle. Espone tre versioni: window.CradleRegolamento.A/.B/.C
   (Ruleset A, B e C). Scritto per essere letto al tavolo da chi gioca. */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.CradleRegolamento = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function build(rs) {
    var A = rs === "A", C = rs === "C", ALT = A || C; // A e C condividono le regole "alternative" su figure/oggetti
    var s = [];

    s.push("# The Cradle — Regolamento (" + rs + ")");

    s.push(
"## 1. In breve\n\n" +
"The Cradle è un gioco per **2 giocatori** con due mazzi di carte napoletane (40 carte ciascuno, valori 1–10). " +
"Sul tavolo si dispone una **griglia 5×5** di carte scoperte. A turno muovi la tua **pedina** e **spari**, giocando le carte della tua **mano** per **abbinare** le carte sulla griglia e segnare punti.\n\n" +
"Ogni giocatore interpreta un **personaggio** (con un seme personale, un oggetto di partenza e un potere) e durante la partita raccoglie **oggetti**.\n\n" +
"**Obiettivo:** avere più punti dell'avversario nel momento in cui la partita finisce.");

    s.push(
"## 2. Cosa serve\n\n" +
"- **Due mazzi** napoletani (40 carte l'uno): mescolati insieme formano il **mazzo** (80 carte).\n" +
"- **2 pedine** (una a testa).\n" +
"- **1 segnalino Primo Giocatore**.\n" +
"- Le **carte Personaggio**.\n" +
"- Le **carte Oggetto**, che formano il **mazzo Oggetti**, e uno spazio per gli **scarti Oggetti**.");

    s.push(
"## 3. Come si abbina una carta (match)\n\n" +
"**Abbinare** significa giocare dalla mano una carta che corrisponde alla carta di una casella. Una tua carta abbina una **casella scoperta** se:\n\n" +
"- ha lo **stesso valore** della carta nella casella; **oppure**\n" +
"- è del **seme di turno** o del tuo **seme personale** (funziona da **jolly**) **e** ha lo **stesso seme** della carta nella casella, a qualsiasi valore.\n\n" +
"Una casella **coperta** (una figura girata a faccia in giù, o il centro dopo che è stato conquistato) si abbina **solo** con una carta jolly (seme di turno o tuo seme personale) e **non dà punti**: serve unicamente per potervi passare sopra.\n\n" +
"Il **seme di turno** è un seme che fa da jolly per entrambi i giocatori: **cambia a ogni round** (§7). Il **seme personale** è il seme del tuo personaggio: è come un secondo seme di turno tutto tuo, e **non cambia mai**.\n\n" +
"Le **figure** sono le carte di valore **8, 9 e 10**.");

    // ---- Preparazione ----
    var prep =
"## 4. Preparazione\n\n" +
"1. Mescola insieme i due mazzi: ottieni il **mazzo** (80 carte).\n" +
"2. Pesca la **prima carta**: il suo **seme** è il **seme iniziale** (il seme di turno del 1° round). Mettila da parte, fuori dalla partita.\n" +
"3. Cerca nel mazzo un **asso (1) del seme iniziale**: sarà la **carta centrale**.\n" +
"4. Rimescola il mazzo. Disponi una **griglia 5×5** di carte scoperte, con l'**asso al centro [3,3]** e le altre 24 caselle pescate dal mazzo.\n" +
"5. Piazza le pedine: **Nord** su **[1,1]**, **Sud** su **[5,5]**. La riga di 5 caselle sul lato di ciascun giocatore è la sua **riga di partenza**; la riga di partenza dell'avversario è la tua **riga-bersaglio** (Nord punta a y=5, Sud a y=1).\n" +
"6. Ogni giocatore sceglie un **personaggio** (§8): riceve il suo **seme personale**, il suo **oggetto di partenza** e il suo **potere** (potete anche scegliere lo stesso personaggio).\n" +
"7. Prepara il **mazzo Oggetti**: prendi **5 tipi** di oggetto (a caso, oppure concordati) e mettine **2 copie ciascuno** a faccia in giù. Tienilo vicino alla griglia, con accanto lo spazio per gli **scarti Oggetti**.\n";
    if (ALT) prep +=
"8. **Oggetto extra:** ogni giocatore pesca **1 oggetto** dal mazzo Oggetti, in aggiunta all'oggetto del personaggio.\n" +
"9. Ogni giocatore pesca **6 carte** dal mazzo.\n" +
"10. Sorteggia il **Primo Giocatore**. Si parte dal round 1.\n";
    else prep +=
"8. Ogni giocatore pesca **6 carte** dal mazzo.\n" +
"9. Sorteggia il **Primo Giocatore**. Si parte dal round 1.\n";
    prep +=
"\n```\n" +
"                 LATO NORD  (Nord parte da [1,1])\n" +
"          [1,1][2,1][3,1][4,1][5,1]   <- partenza Nord / bersaglio di Sud\n" +
"          [1,2][2,2][3,2][4,2][5,2]\n" +
"          [1,3][2,3][3,3][4,3][5,3]   [3,3] = casella centrale (asso del seme iniziale)\n" +
"          [1,4][2,4][3,4][4,4][5,4]\n" +
"          [1,5][2,5][3,5][4,5][5,5]   <- partenza Sud / bersaglio di Nord\n" +
"                 LATO SUD  (Sud parte da [5,5])\n" +
"```";
    s.push(prep);

    // ---- Struttura del round ----
    s.push(
"## 5. Il round\n\n" +
"Ogni round si svolge in quest'ordine: **Scelta delle carte → Movimento → Attacco → Fine del round**.\n" +
"In un round ciascun giocatore **muove una volta** e **spara una volta** (salvo effetti di oggetti).\n\n" +
"**Iniziativa divisa:** nella fase di **movimento** agisce per primo il **Primo Giocatore**, poi l'avversario; nella fase di **attacco** l'ordine si **inverte** (agisce per primo l'avversario del Primo Giocatore, poi il Primo Giocatore). In questo modo ciascun giocatore agisce per **secondo** — cioè con più informazioni — in esattamente una delle due fasi.");

    s.push(
"### 5.1 Scelta delle carte\n\n" +
"Ognuno sceglie **in segreto 3 carte** dalla propria mano, poi entrambi le **rivelano** insieme e le tengono in vista. " +
"Per tutto il round, per muovere, per il clash e per sparare si usano **solo queste 3 carte**.");

    // Movimento (con parte specifica del ruleset)
    var mov =
"### 5.2 Movimento\n\n" +
"I giocatori muovono **a turno**, a partire dal Primo Giocatore.\n\n" +
"Gioca una carta rivelata che **abbina una casella ortogonalmente adiacente** e sposta lì la pedina. Se nessuna delle carte rivelate abbina una casella adiacente, **non muovi**.\n\n" +
"**Effetti d'arrivo** (solo per movimento scelto da te, non per gli spostamenti forzati):\n\n";
    // Centro / figura / riga variano per ruleset.
    mov += (C
      ? "- **Casella centrale scoperta:** **nessun punto**; il centro si **copre**; la carta usata resta **davanti a te** (trofeo); **scegli 1 oggetto tra 3** (gli altri 2 negli scarti).\n"
      : "- **Casella centrale scoperta:** **+5** (una sola volta in tutta la partita); il centro si **copre**; la carta usata resta **davanti a te** (trofeo)" + (A ? "; **scegli 1 oggetto tra 3** (gli altri 2 negli scarti)" : "") + ".\n");
    mov += (ALT
      ? "- **Figura scoperta (8/9/10):** **nessun effetto**: non la elimini, non dà punti né oggetti; resta scoperta e ci sali sopra (il Runner può colpirla con la sua passiva).\n"
      : "- **Figura scoperta (8/9/10):** **+punti** (10 → 3, 9 → 2, 8 → 1); si **copre**; la carta usata resta **davanti a te** (trofeo); **inoltre peschi 1 oggetto**.\n");
    mov += (C
      ? "- **Riga avversaria:** **non** termina la partita e **non** dà punti; **una volta a partita** dà la **scelta di 1 oggetto**.\n"
      : "- **Riga-bersaglio:** **+5** e la partita **termina** (§10).\n");
    mov +=
"- **Carta coperta:** nessun punto; la carta usata va agli **scarti**; la pedina ci sale sopra.\n" +
"- **Carta 1–7 scoperta:** solo spostamento.\n";
    mov += (C
      ? "\nIn **Ruleset C** il **controllo del centro** si conta a **fine turno** (§5.5); centro e riga avversaria danno i loro effetti solo con **movimento scelto**, mai per spostamento forzato.\n\n"
      : "\nI **+5** del centro e della riga-bersaglio si ottengono **solo muovendo di tua scelta**, mai per spostamento forzato.\n\n") +
"**Clash (la casella d'arrivo è occupata dall'altra pedina).** L'attaccante ha già speso 1 carta per muovere: sceglie la carta del clash tra le **2** carte rivelate che gli restano; il difensore la sceglie tra le proprie rivelate disponibili (**3** se non ha ancora mosso, **2** se ha già mosso). Si confrontano: vince il **valore più alto**; a parità di valore vince il **seme più forte** (oro > spade > coppe > bastoni); se anche il seme è pari è **parità piena**. Le carte del clash vanno agli scarti.\n\n" +
"- **Vince l'attaccante:** avanza sulla casella; il **difensore** viene ricollocato (§5.4).\n" +
"- **Vince il difensore:** resta dov'è; può, se vuole, ricollocare l'**attaccante** (§5.4).\n" +
"- **Parità piena:** nessuno si sposta.";
    s.push(mov);

    // Attacco
    var att =
"### 5.3 Attacco (sparo)\n\n" +
"I giocatori sparano **a turno**, ma qui parte per primo **l'avversario del Primo Giocatore** (iniziativa divisa, §5), poi tocca al Primo Giocatore. Gioca una carta rivelata che **abbina una casella qualsiasi** della griglia.\n\n";
    if (ALT) att +=
"**Attaccare una casella la gira sempre a faccia in giù** (anche se non è una figura). Effetti:\n\n" +
"- **Pedina avversaria** sulla casella: **+5** (sparare sulla propria pedina non dà nulla).\n" +
"- **Figura scoperta:** **+punti** (10 → 3, 9 → 2, 8 → 1) e **+1 trofeo** (la carta usata); **inoltre peschi 3 oggetti e ne tieni 1** (gli altri 2 vanno negli scarti Oggetti). La figura si copre.\n" +
"- **Carta 1–7 scoperta:** si **copre**, nessun punto.\n" +
"- **Casella già coperta / senza figura né pedina:** nessun effetto in più.\n";
    else att +=
"Effetti:\n\n" +
"- **Pedina avversaria** sulla casella: **+5** (sparare sulla propria pedina non dà nulla).\n" +
"- **Figura scoperta:** **+punti** (10 → 3, 9 → 2, 8 → 1); si **copre**; la carta usata è un **trofeo**; **inoltre peschi 1 oggetto**.\n" +
"- **Doppia messa a segno:** se sulla stessa casella ci sono **pedina avversaria e figura scoperta**, ottieni **entrambi** i bonus.\n" +
"- **Casella coperta o 1–7 senza pedina:** nessun effetto.\n";
    s.push(att);

    s.push(
"### 5.4 Spostamento forzato\n\n" +
"Alcune situazioni (clash perso, oggetti) costringono a spostare una pedina. Le destinazioni valide sono le caselle **ortogonalmente adiacenti** alla pedina, **escluse** la casella centrale, le caselle occupate e le caselle **distrutte**. Nessun bonus. " +
"Se la pedina finisce su una figura scoperta, la figura **resta scoperta**. " + (C ? "In Ruleset C la riga avversaria non ha effetto sul forzato. " : "Se finisce sulla **riga-bersaglio**, la partita **termina** (ma senza +5). ") + "Se non esiste alcuna destinazione valida, la pedina **resta ferma**.");

    s.push(
"### 5.5 Fine del round\n\n" +
(C ? "**Controllo del centro:** a fine turno ogni giocatore guadagna **+1** se la sua pedina è su una casella **adiacente ortogonale** al centro, **+3** se è **sul centro**.\n\n" : "") +
"Ogni giocatore **scarta le carte rivelate non usate** (tiene le carte non rivelate). Si passa il segnalino **Primo Giocatore** all'avversario. Ciascuno **pesca fino ad avere 6 carte** in mano. Il **seme di turno avanza** (§7).");

    s.push(
"## 6. Trofei\n\n" +
"Le carte usate per abbinare una **figura** o la **casella centrale** non vanno negli scarti: restano **scoperte davanti a te** come **trofei**. Contano per lo spareggio (§9).");

    s.push(
"## 7. Rotazione del seme di turno\n\n" +
"Il seme iniziale (§4) è il seme di turno del primo round. **Alla fine di ogni round** il seme di turno avanza nella sequenza **oro → spade → coppe → bastoni → oro** (in loop). " +
"La casella centrale resta sempre l'asso del **seme iniziale**; il jolly e l'abbinamento delle carte coperte seguono invece il **seme di turno corrente**.");

    s.push(
"## 8. Personaggi\n\n" +
"Ogni giocatore ha un personaggio, che gli dà tre cose: un **seme personale** (jolly personale e fisso, come descritto in §3), un **oggetto di partenza** e un **potere**.\n\n" +
"| Personaggio | Seme personale | Oggetti di partenza | Potere |\n" +
"|---|---|---|---|\n" +
"| **Runner** | spade | jetpack | **Passiva:** 2 volte a partita, muovendo su una figura può **scartare 1 carta scelta extra per colpirla** (ottiene i punti figura e la scelta di 1 oggetto). Se sulla casella c'è la pedina avversaria si fa **clash**: gli effetti valgono solo vincendo il clash (altrimenti l'uso non si consuma). |\n" +
"| **Brawler** | coppe | barrage | **In movimento o in attacco**, fino a **3 volte per partita**: se hai **3 carte disponibili**, scartale tutte e tre per **abbinare una casella qualsiasi** (rinunci così a quell'azione). |\n" +
"| **Tactician** | oro | timebomb | Fino a **2 volte per partita**: per il resto del turno puoi usare **anche le carte non scelte**. **Passiva:** quando sceglie un oggetto sceglie **tra 4** invece che tra 3. |\n" +
"| **Fighter** | bastoni | hook | In **attacco** abbina le **carte pari fra loro** (una carta di valore pari abbina una casella scoperta di valore pari). |\n\n" +
"Gli oggetti di partenza del personaggio si usano **una sola volta** e **non contano** nel limite oggetti (§9).");

    // Oggetti
    var ogg =
"## 9. Oggetti\n\n" +
"### 9.1 Come si ottengono\n\n";
    if (ALT) ogg +=
"- **Colpendo una figura in attacco** o **conquistando la casella centrale**: peschi **3 oggetti** dal mazzo Oggetti e ne **tieni 1**; gli altri 2 finiscono negli **scarti Oggetti**.\n" +
"- **A inizio partita** ogni giocatore riceve **1 oggetto** (§4), oltre a quello del personaggio.\n";
    else ogg +=
"- **Eliminando una figura** (abbinandola in movimento o colpendola in attacco): peschi **1 oggetto** dal mazzo Oggetti.\n";
    ogg +=
"\nQuando il **mazzo Oggetti si esaurisce**, rimescola gli **scarti Oggetti** per riformarlo.\n\n" +
"### 9.2 Limite e uso\n\n" +
"- Puoi possedere al massimo **" + (ALT ? "4" : "2") + " oggetti** contemporaneamente (l'oggetto di partenza del personaggio **non** conta). Se superi il limite, devi **scartarne uno** (anche quello appena preso).\n" +
"- Un oggetto si usa **una sola volta**, **nella fase indicata** e **prima** di eseguire l'azione a cui si riferisce.\n\n" +
"### 9.3 Elenco degli oggetti\n\n" +
"| Oggetto | Quando | Effetto |\n" +
"|---|---|---|\n" +
"| **jetpack** | movimento | Costo: **scarta 1 carta rivelata a tua scelta** (devi averne almeno 2). Per questo movimento puoi abbinare **anche in diagonale**. |\n" +
"| **jump** | movimento | Costo: **scarta 1 carta rivelata a tua scelta** (almeno 2). Questo movimento raggiunge **solo** le caselle a **2 passi ortogonali** di distanza (salto). |\n" +
"| **hook** | attacco | Se colpisci la **pedina avversaria**, spostala di **1 casella in qualsiasi direzione** (esclusa la centrale). |\n" +
"| **homing missile** | attacco | Ottieni i normali punti dell'attacco **e rimuovi dal gioco** la carta colpita: la casella diventa **distrutta** (non più abbinabile né calpestabile). Una pedina eventualmente presente viene **spostata dal tiratore** su una casella adiacente. |\n" +
"| **rush juice** | scelta carte | Questo round esegui **due movimenti** e **rinunci** all'attacco. |\n" +
"| **combat juice** | scelta carte | Questo round esegui **due attacchi** e **rinunci** al movimento. |\n" +
"| **timebomb** | scelta carte | Sposta il **seme di turno** su un seme a tua scelta; la rotazione prosegue da lì. |\n" +
"| **elemental bomb** | attacco | Rinunci all'attacco. Scegli una casella: il **seme** suo e di **tutte le caselle ortogonali** diventa un **seme a tua scelta**. |\n" +
"| **barrage** | attacco | Rinunci all'attacco. Scegli una casella e **una adiacente ortogonale** (non la centrale, non caselle con pedina): **distruggi entrambe** le caselle. |\n" +
"| **randomizer** | attacco | Rinunci all'attacco. Scegli fino a **3 caselle** (non la centrale): le loro carte tornano nel mazzo, si mescola e si pescano **altrettante** carte da **ricollocare** in quelle caselle. |\n" +
"| **energy boost** | movimento o attacco | Peschi **2 carte** e puoi usarle in questa mano; a fine turno queste carte si **scartano** con le altre carte scelte non usate (le carte non scelte restano). |\n" +
"| **energy drain** | movimento o attacco | **Rubi 1 carta** tra le **carte scelte** dell'avversario (puoi usarla in questa mano; se non ne ha, non è utilizzabile). |";
    s.push(ogg);

    s.push(
"## 10. Fine della partita\n\n" +
(C
 ? "La partita dura sempre **9 round**: raggiungere la riga avversaria **non** la termina. Al termine del round 9 si contano i punti.\n\n"
 : "La partita finisce quando **una pedina raggiunge la riga-bersaglio** (per movimento scelto o forzato): si completa il **round in corso**, poi si contano i punti. In ogni caso la partita non supera il **round 9** (dal round 9 non si rimescola: si gioca con le carte rimaste).\n\n") +
"Vince chi ha **più punti**. In caso di parità, si applica lo **spareggio** in quest'ordine:\n\n" +
"1. chi ha **conquistato la casella centrale**;\n" +
"2. chi ha **più figure** a trofeo;\n" +
"3. se ancora pari, la partita è **patta**.");

    s.push(
"## 11. Riepilogo dei punti\n\n" +
"| Azione | Punti |\n" +
"|---|---|\n" +
(C
 ? "| Fine turno: pedina adiacente ortogonale al centro | 1 |\n| Fine turno: pedina sul centro | 3 |\n"
 : "| Muovere sulla casella centrale (una sola volta) | 5 |\n| Muovere sulla riga-bersaglio | 5 (termina la partita) |\n") +
"| " + (ALT ? "Colpire in attacco" : "Abbinare o colpire") + " un 10 · 9 · 8 | 3 · 2 · 1 |\n" +
"| Colpire la pedina avversaria | 5 |");

    s.push(
"## 12. Regola opzionale: Mulligan\n\n" +
"Se concordata a inizio partita, ogni giocatore ha un numero fisso di **Mulligan** (1, 2 o 3; di norma 2). " +
"Durante la **propria scelta delle carte**, prima di fissare le 3 carte, puoi usare un Mulligan: **scarti da 1 a tutte** le carte della tua mano e ne **peschi altrettante** dal mazzo (se il mazzo finisce, si rimescolano gli scarti). Ogni uso consuma un Mulligan.");

    return s.join("\n\n");
  }

  return { A: build("A"), B: build("B"), C: build("C") };
});

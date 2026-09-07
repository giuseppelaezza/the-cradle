# Prompt per Claude Code — Integrazione moduli e modalità (v2)

Incolla in Claude Code, nella cartella del progetto che contiene il prototipo già realizzato e i file aggiornati `the-cradle-regolamento.md` e `the-cradle-build-spec.md`.

---

Stai lavorando al prototipo JavaScript vanilla di *The Cradle* già presente in questa cartella. Devi **integrare** un set di nuove funzionalità. Rileggi prima i file aggiornati `the-cradle-regolamento.md` (fonte di verità delle regole) e `the-cradle-build-spec.md` (specifiche tecniche v2): modello dati, flusso, effetti degli oggetti, requisiti UI e **criteri di accettazione**. In caso di conflitto prevale il regolamento.

Vincoli invariati: JavaScript vanilla, nessun framework, nessun build step, avviabile aprendo `index.html`, engine puro separato dalla UI. Non rompere le regole base già funzionanti (match, clash, movimento, sparo, economia carte, spareggio): trattale come regressione.

**Da implementare:**

1. **Schermata iniziale di configurazione:** dropdown modalità seme (`fisso` default | `rotazione`) e checkbox moduli (`Personaggi`, `Oggetti`, indipendenti). Se Personaggi è attivo, ogni giocatore sceglie un personaggio (**lo stesso personaggio è ammesso per entrambi**); in modalità seme `fisso` il **tactician non è selezionabile** (disabilitalo). Applica le combinazioni di moduli della spec §2.

2. **Modalità seme a rotazione:** introduci `currentSuit` (seme di turno). In `fisso` non cambia; in `rotazione` avanza a fine round nel loop oro→spade→coppe→bastoni→oro. Il centro resta l'asso del seme iniziale; jolly e carte coperte seguono `currentSuit`. Aggiungi in alto un **indicatore di sequenza** dei semi con la posizione corrente.

3. **Modulo Personaggi:** ogni personaggio dà un `belongingSuit` che si comporta **come un seme di turno personale e fisso** — abbina le carte scoperte di quel seme a qualsiasi valore **e sblocca anche le carte coperte** — e, se anche Oggetti è attivo, un `startObject` escluso dal limite. Tabella personaggi nel regolamento §10.

4. **Modulo Oggetti:** implementa `objectDeck` (4 oggetti distinti casuali tra i 7, a faccia in giù); la **pesca a ogni figura eliminata**, sia in **movimento** sia in **sparo** (e alla distruzione); il limite di 2 oggetti (oltre l'iniziale) con scarto forzato; i 7 effetti come da spec §6, incluso `homing missile` che **assegna comunque i punti** (figura/pedina) oltre a distruggere la cella. Introduci lo stato `destroyed` delle celle con le conseguenze su abbinamento e spostamenti forzati.

5. **Nuova struttura del turno** (regolamento §11.4): finestre "uso oggetto" per il giocatore di turno prima di ogni azione (ordine P1 poi P2), nelle fasi select/move/attack. rush/combat juice modificano `pendingActions` (le due azioni consecutive, stesso giocatore); timebomb agisce in select. Max 1 oggetto modificatore per finestra. Se Oggetti è off, salta le finestre.

6. **UI — carte scelte pubbliche:** dopo la rivelazione, mostra le 3 carte scelte in piccolo nella scheda del giocatore (pubbliche), aggiornandole quando vengono usate.

7. **UI — oggetti:** pannello sotto la mano con le carte oggetto; tooltip in hover; evidenzia un oggetto **solo quando è utilizzabile**. Per gli oggetti "move" mostra lo schema di quadratini (jetpack 3×3, jump 5×5) come da spec §7.4.

8. **Modifiche grafiche:** semi → colore/simbolo (oro=giallo=○, spade=blu=♠, bastoni=verde=♣, coppe=rosso=♥); righe di partenza (y=1, y=5) con bordo tratteggiato; casella centrale e carte figura (in mano e su griglia) a schema colore invertito (fondo colorato del seme, testo bianco) con corona ♛ accanto al numero; nella barra superiore i testi in evidenza in bianco e solo il seme di turno colorato.

Le decisioni sui casi limite sono già consolidate nella spec §10: applicale così come sono. Se trovi altre ambiguità non coperte, elencamele con un default proposto prima di procedere.

**Metodo:** procedi in modo incrementale (config → seme di turno/rotazione → personaggi → oggetti → struttura turno → UI/grafica). Al termine esegui la checklist dei criteri di accettazione (spec §9), segnala cosa passa e cosa no, e correggi. Codice funzionante e commentato.

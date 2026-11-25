export type TutorialContextId =
  | 'desktop'
  | 'caricostudio_home'
  | 'commesse'
  | 'painting_tags'
  | 'pallet_weights'
  | 'tree'
  | 'checklist'
  | 'view3d'
  | 'truck'
  | 'signatures'
  | 'qr_labels'
  | 'stock_movements'
  | 'commessa_photos'
  | 'file_manager'
  | 'employer_hub'
  | 'team_share'
  | 'warehouse_catalog'
  | 'weather'
  | 'clock'
  | 'calendar'
  | 'server_monitor'
  | 'server_control'
  | 'software_updates'
  | 'ddt_documents'
  | 'crm_directory'
  | 'purchase_orders'
  | 'timini_print';

export interface TutorialStep {
  title: string;
  body: string;
  tip?: string;
}

export interface AppTutorialDefinition {
  id: TutorialContextId;
  appTitle: string;
  subtitle: string;
  steps: TutorialStep[];
}

export const APP_TUTORIALS: Record<TutorialContextId, AppTutorialDefinition> = {
  desktop: {
    id: 'desktop',
    appTitle: 'Scrivania Principale',
    subtitle: 'Tutte le tue app in un unico desktop multitasking',
    steps: [
      {
        title: '4 App principali sempre pronte',
        body: 'Sulla scrivania trovi CaricoStudio (spedizioni, bancali, etichette QR), Carico / Scarico (magazzino e prove 101%), Foto (galleria per commessa da telefono) e File (cartelle, PDF ed Excel).',
      },
      {
        title: 'Affianca 2 App sullo stesso schermo',
        body: 'Premi "Affianca 2 App" nella barra in alto per lavorare con CaricoStudio a sinistra e Carico / Scarico a destra contemporaneamente.',
        tip: 'Puoi cambiare commessa attiva in qualsiasi momento dal menu a tendina in alto a sinistra.',
      },
      {
        title: 'Account privato e Guida sempre disponibile',
        body: 'I tuoi dati sono isolati nel tuo account personale. Se chiudi un tutorial, puoi riaprirlo in qualsiasi momento dal tasto "Guida" nella barra in alto.',
      },
    ],
  },
  caricostudio_home: {
    id: 'caricostudio_home',
    appTitle: 'CaricoStudio — Suite Spedizioni',
    subtitle: 'Tutti i moduli operativi per preparare e documentare la spedizione',
    steps: [
      {
        title: 'Seleziona il modulo che ti serve',
        body: 'Da questa schermata apri Commesse, Verniciatura & RAL, Pesi Bancali, Albero Bancali/Scatole, Check-list Merci, Vista CAD 3D, Carico Camion, Firme e Etichette QR A4.',
      },
      {
        title: 'Stampe rapide e backup PC',
        body: 'In basso trovi Centro Stampe, Genera Kit multi-scatola, Traduttore PDF per l\'estero e Salva su PC per esportare un backup JSON della commessa.',
      },
    ],
  },
  commesse: {
    id: 'commesse',
    appTitle: 'Gestione Commesse',
    subtitle: 'Crea, rinomina, duplica e archivia le commesse di spedizione',
    steps: [
      {
        title: 'Elenco commesse e ricerca rapida',
        body: 'A sinistra vedi tutte le tue commesse: cliccane una per renderla attiva in tutti i moduli. Usa "+ Nuova Commessa" per crearne una vuota o "Duplica Commessa" per copiare un ordine simile.',
      },
      {
        title: 'Backup su PC e importazione',
        body: 'Con "Salva su PC (.json)" scarichi una copia della commessa, mentre "Apri File da PC" ti permette di ricaricarla in qualsiasi momento.',
      },
    ],
  },
  painting_tags: {
    id: 'painting_tags',
    appTitle: 'Verniciatura, RAL & Zincatura',
    subtitle: 'Cartelli A4 ad alta visibilità per terzisti e lavorazioni',
    steps: [
      {
        title: 'Crea cartelli lavorazione in pochi secondi',
        body: 'Scrivi il codice RAL o il trattamento (es. Zincato a caldo, Elettrozincato), scegli il colore indicativo, il terzista e la quantità di bancali o pezzi.',
      },
      {
        title: 'Scegli il formato e stampa',
        body: 'Puoi stampare in A4 verticale, A4 orizzontale, doppio A5 o 4 cartelli A6 per foglio, includendo o nascondendo lista articoli e riquadri firme.',
      },
    ],
  },
  pallet_weights: {
    id: 'pallet_weights',
    appTitle: 'Pesi Bancali & Schede A4',
    subtitle: 'Registra il peso reale a bilancia e stampa le schede collo',
    steps: [
      {
        title: 'Inserisci il peso reale pesato',
        body: 'Per ogni bancale puoi digitare il peso lordo letto sulla bilancia: il totale spedizione, le distinte PDF e le etichette QR useranno automaticamente il peso reale.',
      },
      {
        title: 'Stampa scheda A4 per singolo bancale',
        body: 'Ogni bancale ha il tasto dedicato per stampare il foglio A4 da applicare sul film estensibile prima del carico camion.',
      },
    ],
  },
  tree: {
    id: 'tree',
    appTitle: 'Albero Bancali, Scatoloni & Pezzi',
    subtitle: 'Organizza cosa va in ogni scatola e su ogni bancale',
    steps: [
      {
        title: 'Costruisci la gerarchia reale del carico',
        body: 'Crea i bancali, aggiungi le scatole (anche scatole dentro scatoloni madre) e inserisci gli articoli dentro ogni scatola oppure "Fuori Scatola" sul bancale.',
      },
      {
        title: 'Sigilla scatole e fascia i bancali',
        body: 'Quando segni una scatola come sigillata o un bancale come fasciato, CaricoStudio registra automaticamente data e ora di preparazione (Carico) per le etichette QR.',
      },
    ],
  },
  checklist: {
    id: 'checklist',
    appTitle: 'Check-list Merci, Foto & Kit',
    subtitle: 'Controlla tutti i pezzi da spedire e spunta al volo',
    steps: [
      {
        title: 'Inserimento rapido o in blocco',
        body: 'Aggiungi singoli articoli oppure incolla un elenco completo riga per riga (Nome; Quantità; Peso) per popolare la distinta in un click.',
      },
      {
        title: 'Spunta collegata a Carico / Scarico',
        body: 'Quando spunti un articolo come caricato, se l\'automazione è attiva viene registrato automaticamente lo scarico in magazzino e l\'orario di preparazione.',
      },
    ],
  },
  view3d: {
    id: 'view3d',
    appTitle: 'CAD 3D Stivaggio Bancali',
    subtitle: 'Visualizza la disposizione delle scatole sui bancali in 3D',
    steps: [
      {
        title: 'Ruota e ispeziona il bancale',
        body: 'Trascina con il mouse o il dito per ruotare il bancale in 3D e usa la rotella per fare zoom. Seleziona un singolo bancale o la vista completa.',
      },
      {
        title: 'Modalità Raggi X e livelli',
        body: 'Attiva la vista trasparente per verificare scatole impilate, colli fragili e distribuzione dei pesi prima della fasciatura.',
      },
    ],
  },
  truck: {
    id: 'truck',
    appTitle: 'Piano di Carico Automezzo',
    subtitle: 'Posiziona i bancali sul camion e bilancia i pesi',
    steps: [
      {
        title: 'Assegna ogni bancale a uno slot del camion',
        body: 'Scegli la posizione sul pianale per ogni bancale e controlla in tempo reale la portata residua e il bilanciamento destra/sinistra.',
      },
      {
        title: 'Aggiorna dati vettore e data partenza',
        body: 'Modifica vettore, cliente, destinazione e portata massima del mezzo: tutti i documenti PDF e le etichette si aggiorneranno all\'istante.',
      },
    ],
  },
  signatures: {
    id: 'signatures',
    appTitle: 'Firme Elettroniche & Convalida',
    subtitle: 'Raccogli le firme di Operatore, Logistica e Autista',
    steps: [
      {
        title: 'Firma direttamente da PC, tablet o telefono',
        body: 'Scegli il ruolo (Preparatore, Responsabile Spedizioni, Autista/Corriere), inserisci nome e firma nel riquadro.',
      },
      {
        title: 'Inclusioni automatiche nei PDF',
        body: 'Le firme salvate vengono stampate automaticamente nelle bolle e nelle distinte ufficiali dal Centro Stampe.',
      },
    ],
  },
  qr_labels: {
    id: 'qr_labels',
    appTitle: 'Etichette A4 QR & Codice a Barre',
    subtitle: 'Genera il foglio A4 con tutte le etichette scansionabili da qualsiasi telefono',
    steps: [
      {
        title: 'Un unico PDF A4 per bancali, scatole e oggetti',
        body: 'Premi "Scarica Foglio A4 Etichette" per ottenere tutte le etichette pronte da stampare con QR Code e Codice a Barre Code-39.',
      },
      {
        title: 'Scansione diretta dal telefono SENZA app',
        body: 'Inquadrando il QR con la normale fotocamera di qualsiasi smartphone si apre subito una pagina mobile autonoma (senza login e senza app) che mostra dove si trova il pezzo, quantità, peso, data/ora Carico e data/ora Scarico.',
      },
      {
        title: 'Timbra Carico e Scarico con un click',
        body: 'Dalla tabella puoi aggiornare o timbrare in massa data e ora di Carico (preparazione) e Scarico (spedito): chi scansiona il QR vedrà subito lo stato aggiornato.',
      },
    ],
  },
  stock_movements: {
    id: 'stock_movements',
    appTitle: 'Carico & Scarico Materiale',
    subtitle: 'Commesse uscite/entrate, giacenze, movimenti e prove imballo 101%',
    steps: [
      {
        title: 'Sezione Commesse Uscite / Entrate',
        body: 'Clicca su una commessa per vedere tutto il materiale mandato via, quello rientrato e la lista prevista. Puoi esportare CSV o PDF della singola commessa.',
      },
      {
        title: 'Elimina commessa solo da Carico / Scarico',
        body: 'Usando il tasto "Elimina" su una commessa dentro Carico / Scarico rimuovi la commessa e i suoi movimenti solo da questa app: la commessa dentro CaricoStudio rimane completamente intatta con bancali, scatole e foto.',
      },
      {
        title: 'Prove Imballo 101% Anti-Contestazione',
        body: 'Nella scheda "Prove 101%" certifichi ogni scatola con foto a strati, peso a bilancia, sigillo antimanomissione e firma ritiro corriere.',
      },
    ],
  },
  commessa_photos: {
    id: 'commessa_photos',
    appTitle: 'App Foto Commesse',
    subtitle: 'Scatta foto in diretta dal telefono divise automaticamente per commessa',
    steps: [
      {
        title: 'Scegli la commessa e attiva la fotocamera',
        body: 'Seleziona la commessa su cui stai lavorando e premi "Attiva Fotocamera": vedrai l\'anteprima live a schermo intero e ogni scatto si salverà subito nella cartella della commessa.',
      },
      {
        title: 'Visualizza, scarica o elimina le immagini',
        body: 'Apri qualsiasi foto in grande per scaricarla, aggiungere una didascalia oppure eliminarla con il tasto cestino.',
      },
    ],
  },
  file_manager: {
    id: 'file_manager',
    appTitle: 'App File — Cartelle e Documenti',
    subtitle: 'Organizza cartelle, carica PDF/Excel/Word e importa foto dall\'App Foto',
    steps: [
      {
        title: 'Crea e modifica le tue cartelle',
        body: 'Premi "Nuova Cartella" per creare cartelle e sottocartelle colorate (anche collegate a una commessa). Puoi rinominarle, cambiare colore o eliminarle in ogni momento.',
      },
      {
        title: 'Carica dal PC o importa dall\'App Foto',
        body: 'Carica file PDF, Excel, Word o immagini dal computer (anche trascinandoli dentro) oppure usa "Importa da App Foto" per copiare nella cartella le foto scattate dal telefono.',
      },
    ],
  },
  employer_hub: {
    id: 'employer_hub',
    appTitle: 'Portale Direzione — Controllo Aziendale',
    subtitle: 'Interfaccia riservata al Datore di Lavoro per supervisionare tutto il team',
    steps: [
      {
        title: 'Tutti i profili in un unico pannello',
        body: 'Dalla colonna a sinistra puoi selezionare "Tutta l\'Azienda" oppure cliccare un singolo operatore per filtrare all\'istante commesse, movimenti, foto e documenti.',
      },
      {
        title: 'Commesse, Carichi e Scarichi completi',
        body: 'Apri la scheda Commesse per ispezionare bancali, scatole e articoli di ogni profilo, oppure Carichi & Scarichi per controllare tutto il registro movimenti aziendale.',
      },
      {
        title: 'Gestione ruoli e scambio diretto',
        body: 'Puoi promuovere o revocare il ruolo Direzione ad altri account e aprire "Scambio File & Foto Team" per inviare o ricevere documenti direttamente dai collaboratori.',
      },
    ],
  },
  team_share: {
    id: 'team_share',
    appTitle: 'Scambio Team — File & Foto tra Utenti',
    subtitle: 'Invia e ricevi foto, PDF, Excel e documenti tra tutti gli utenti registrati',
    steps: [
      {
        title: 'Scegli il collega destinatario',
        body: 'Nella colonna sinistra vedi tutti gli utenti registrati e la Direzione con lo stato online. Clicca un utente per filtrare lo storico e impostarlo subito come destinatario.',
      },
      {
        title: 'Invia da PC, dall\'App Foto o dall\'App File',
        body: 'Puoi allegare un file dal dispositivo oppure pescare direttamente una foto già scattata nell\'App Foto o un documento salvato nell\'App File, aggiungendo codice commessa e nota.',
      },
      {
        title: 'Scarica o salva direttamente nel tuo archivio',
        body: 'Per ogni file o foto ricevuta puoi scaricarla subito oppure copiarla in un click nella tua App File o App Foto personale.',
      },
    ],
  },
  warehouse_catalog: {
    id: 'warehouse_catalog',
    appTitle: 'Magazzino — Catalogo, Scorte & Lettore Barcode',
    subtitle: 'Gestione articoli ad alta densità, categorie, scorte minime, allegati e lettore USB',
    steps: [
      {
        title: 'Catalogo Tabella / Schede con Inspector laterale',
        body: 'Cerca e ordina gli articoli per nome, giacenza o utilizzo, filtra per categoria dalla barra laterale e clicca qualsiasi riga per aprire il pannello laterale con movimenti personalizzati, allegati e storico.',
      },
      {
        title: 'Lettore Barcode USB / SKU con autocompletamento',
        body: 'Nella sezione Lettore Barcode scegli Entrata (+) o Uscita (−) e scansiona con la pistola USB/Bluetooth oppure digita il codice. Se il codice è nuovo si apre subito la scheda di registrazione.',
      },
      {
        title: 'Preferiti, avvisi Sotto Scorta ed Export CSV',
        body: 'Contrassegna con la stella ★ gli articoli più usati, controlla gli articoli Sotto Scorta ed esporta in qualsiasi momento catalogo o movimenti in formato CSV per Excel.',
      },
    ],
  },
  weather: {
    id: 'weather',
    appTitle: 'Meteo Live',
    subtitle: 'Previsioni in tempo reale, orarie e 7 giorni per le tue città e spedizioni',
    steps: [
      {
        title: 'Cerca qualsiasi città o usa il GPS',
        body: 'Digita il nome di qualsiasi località o premi "Posizione GPS" per ottenere temperatura, vento, umidità, probabilità di pioggia e indice UV in tempo reale.',
      },
      {
        title: 'Salva le città preferite',
        body: 'Aggiungi le sedi o destinazioni di consegna nella barra delle città salvate per passare da una località all\'altra in un click.',
      },
    ],
  },
  clock: {
    id: 'clock',
    appTitle: 'Orologio, Sveglie, Cronometro & Timer',
    subtitle: 'Orologio analogico e digitale, fusi orari mondiali, sveglie e timer',
    steps: [
      {
        title: 'Orologio locale e fusi orari nel mondo',
        body: 'Controlla l\'ora esatta in formato digitale e analogico insieme ai fusi orari di altre città internazionali (utili per spedizioni estere).',
      },
      {
        title: 'Sveglie, Cronometro e Timer',
        body: 'Imposta sveglie con avviso acustico e notifica nel Centro Notifiche, misura tempi con giri nel Cronometro o avvia un Timer rapido.',
      },
    ],
  },
  calendar: {
    id: 'calendar',
    appTitle: 'Calendario, Appunti & Calendari Condivisi',
    subtitle: 'Organizza appuntamenti, scrivi appunti giornalieri e condividi calendari col team',
    steps: [
      {
        title: 'Appuntamenti e appunti su ogni giorno',
        body: 'Clicca un giorno qualsiasi del mese per aggiungere un appuntamento con orario, un appunto libero, un promemoria o una scadenza collegata a una commessa.',
      },
      {
        title: 'Crea Calendari Condivisi con i colleghi',
        body: 'Premi "+ Nuovo Calendario" nella barra sinistra, seleziona gli utenti registrati con cui condividerlo e tutti i membri potranno vedere e aggiungere eventi ricevendo una notifica immediata.',
      },
    ],
  },
  server_monitor: {
    id: 'server_monitor',
    appTitle: 'Monitor Risorse — Telemetria Hardware Server',
    subtitle: 'CPU, RAM, dischi, rete e servizi attivi letti in tempo reale dal server',
    steps: [
      {
        title: 'Telemetria reale del nodo server',
        body: 'Visualizza in diretta il carico CPU per singolo core, la memoria RAM occupata, lo spazio libero sul disco principale, l\'uptime e gli indirizzi di rete LAN.',
      },
      {
        title: 'Stato dei servizi METATRON OS',
        body: 'Verifica lo stato operativo del core HTTP/API, del motore WebSocket, dello storage persistente e delle sessioni autenticate.',
      },
    ],
  },
  server_control: {
    id: 'server_control',
    appTitle: 'Sistema & ISO — Pannello METATRON Server OS',
    subtitle: 'Installa METATRON come sistema operativo su server/USB, gestisci backup, sessioni e log',
    steps: [
      {
        title: 'Installa su Server Linux o genera la ISO avviabile',
        body: 'Nella scheda "Installa OS & Genera ISO" puoi visualizzare, copiare o scaricare gli script reali per trasformare Debian/Ubuntu in METATRON OS (anche in modalità Kiosk a tutto schermo) o generare la ISO USB.',
      },
      {
        title: 'Backup server, Sessioni e Log',
        body: 'Crea snapshot completi sanitizzati del server, controlla i volumi su disco, revoca sessioni di altri dispositivi e consulta il registro eventi live.',
      },
    ],
  },
  software_updates: {
    id: 'software_updates',
    appTitle: 'Aggiornamenti — Software METATRON senza perdita dati',
    subtitle: 'Controlla nuove versioni su GitHub, scarica l\'aggiornamento e riavvia in sicurezza',
    steps: [
      {
        title: 'Notifica automatica di nuovi aggiornamenti',
        body: 'Quando pubblichi una nuova versione su GitHub, METATRON rileva l\'aggiornamento automaticamente e ti avvisa nel Centro Notifiche.',
      },
      {
        title: 'Backup automatico e riavvio sicuro',
        body: 'Prima di installare e riavviare il sistema, l\'app salva uno snapshot di sicurezza. Utenti, magazzino, foto, file e calendari restano sempre intatti.',
      },
    ],
  },
  ddt_documents: {
    id: 'ddt_documents',
    appTitle: 'DDT & Bolle di Trasporto',
    subtitle: 'Genera Documenti di Trasporto A4 in PDF direttamente dalle commesse con firme digitali',
    steps: [
      {
        title: 'Genera in un clic dalla commessa',
        body: 'Scegli una commessa dalla colonna sinistra o dal pulsante in alto: destinatario, destinazione, colli, bancali, pesi e righe merce vengono compilati in automatico.',
      },
      {
        title: 'Firma digitale e PDF pronto per la stampa',
        body: 'Raccogli la firma del conducente e del destinatario direttamente sullo schermo e scarica il PDF A4 pronto da stampare o inviare.',
      },
    ],
  },
  crm_directory: {
    id: 'crm_directory',
    appTitle: 'Anagrafica Clienti & Fornitori',
    subtitle: 'Rubrica centralizzata collegata a Commesse, DDT, Magazzino e Ordini Fornitori',
    steps: [
      {
        title: 'Importazione automatica',
        body: 'Usa "Importa da Commesse e Magazzino" per popolare subito la rubrica con i clienti e fornitori già presenti nel gestionale.',
      },
      {
        title: 'Storico e azioni rapide',
        body: 'Seleziona una scheda per consultare commesse, DDT, articoli di magazzino e avviare una nuova commessa, un DDT o un ordine fornitore già precompilati.',
      },
    ],
  },
  purchase_orders: {
    id: 'purchase_orders',
    appTitle: 'Ordini Fornitori & Riordino Scorte',
    subtitle: 'Trasforma gli articoli sotto scorta in ordini PDF e carica le giacenze alla consegna',
    steps: [
      {
        title: 'Riordino automatico dal Magazzino',
        body: 'Nella scheda "Da riordinare" trovi tutti gli articoli sotto scorta minima: selezionali per creare automaticamente gli ordini raggruppati per fornitore.',
      },
      {
        title: 'Ricevi merce e carica in un clic',
        body: 'Quando arriva la consegna, clicca su "Ricevi Merce & Carica Magazzino": le giacenze si aggiornano subito e i movimenti di carico vengono registrati automaticamente.',
      },
    ],
  },
  timini_print: {
    id: 'timini_print',
    appTitle: 'TiMini Print — Stampante Etichette Termiche 57mm',
    subtitle: 'Stampa etichette con QR, Barcode e loghi direttamente via Bluetooth BLE o USB',
    steps: [
      {
        title: 'Connessione diretta Bluetooth TiMini / Tiny Print',
        body: 'Accendi la mini stampante termica 57mm e clicca "Connetti TiMini BLE": puoi regolare intensità, copie e avanzamento carta direttamente dal gestionale.',
      },
      {
        title: 'Etichette rapide da Magazzino e Commesse',
        body: 'Importa articoli del Magazzino, bancali o scatole della Commessa in un clic, oppure esporta il PNG 384px / PDF 57mm.',
      },
    ],
  },
};

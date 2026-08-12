# GameOn — Projektna Dokumentacija

> **GameOn** je platforma za organizacijo in upravljanje rekreativnih športnih tekem (futsal, košarka) v Sloveniji. Sestavljena je iz mobilne aplikacije za igralce ter spletne aplikacije za lastnike športnih objektov.

---

## Kazalo

1. [Opis projekta](#opis-projekta)
2. [Arhitektura sistema](#arhitektura-sistema)
3. [Tehnološki sklad](#tehnološki-sklad)
4. [Podatkovni modeli — ER diagram](#podatkovni-modeli--er-diagram)
5. [Razredni diagram](#razredni-diagram)
6. [Diagram primerov uporabe](#diagram-primerov-uporabe)
7. [Diagram toka podatkov (DFD)](#diagram-toka-podatkov-dfd)
8. [Sekvenčni diagrami](#sekvenčni-diagrami)
9. [Navigacijska struktura](#navigacijska-struktura)
10. [Ključne funkcionalnosti](#ključne-funkcionalnosti)
11. [Navodila za zagon](#navodila-za-zagon)
12. [Vodenje projekta](#vodenje-projekta)
13. [Zagotavljanje kakovosti](#zagotavljanje-kakovosti)
14. [Varnostna pravila](#varnostna-pravila)

---

## Opis projekta

GameOn je hibridna platforma, ki rešuje dve ključni težavi rekreativnih športnikov:

1. **Iskanje in organizacija tekem** — Igralci s pomočjo mobilne aplikacije na karti odkrijejo bližnje tekme, se jim pridružijo, organizirajo ekipe in komunicirajo med seboj.
2. **Upravljanje športnih objektov** — Lastniki dvoran in igrišč s spletnim vmesnikom upravljajo razporede, sprejemajo rezervacije in sledijo prihodkom.

### Ciljni uporabniki

| Tip | Platforma | Vloga |
|-----|-----------|-------|
| Igralec | Mobilna aplikacija (Android) | Išče, ustvarja in se pridružuje tekmam |
| Lastnik objekta | Spletna aplikacija | Upravlja prostore, razporede in rezervacije |
| Administrator | Firebase konzola | Nadzoruje sistem |

---

## Arhitektura sistema

```mermaid
graph TB
    subgraph "Mobilna aplikacija (Expo / React Native)"
        MA[Igralec]
        MS[Zasloni]
        MCTX[Context / State]
        MSVC[Servisna plast]
    end

    subgraph "Spletna aplikacija (React + Vite)"
        WA[Lastnik objekta]
        WP[Strani / Komponente]
        WCTX[AuthContext]
        WSVC[Servisna plast]
    end

    subgraph "Firebase Backend"
        AUTH[Firebase Auth]
        FS[Cloud Firestore]
        ST[Firebase Storage]
        CF[Cloud Functions\nNode.js 20]
        FH[Firebase Hosting]
    end

    subgraph "Zunanji servisi"
        STRIPE[Stripe API\nPlačila]
        MAPS[Google Maps API\nLokacija]
        GIPHY[Giphy API\nGIF-i v chatu]
        WEATHER[OpenWeather API\nVreme]
    end

    MA --> MS --> MCTX --> MSVC
    WA --> WP --> WCTX --> WSVC

    MSVC -->|branje/pisanje| FS
    MSVC -->|avtentikacija| AUTH
    MSVC -->|slike| ST
    WSVC -->|branje/pisanje| FS
    WSVC -->|avtentikacija| AUTH

    CF -->|webhook| STRIPE
    MSVC -->|HTTP| CF
    WSVC -->|HTTP| CF

    MSVC --> MAPS
    MSVC --> GIPHY
    MSVC --> WEATHER

    FH -->|gosti| WP
```

### Opis arhitekturnih plasti

| Plast | Opis |
|-------|------|
| **Prezentacijska plast** | React Native zasloni (mobilno) in React strani (spletno) |
| **Kontekstna plast** | React Context za globalno stanje (auth, premium, owner profil) |
| **Servisna plast** | Funkcije za komunikacijo s Firestore, Storage in Cloud Functions |
| **Podatkovna plast** | Cloud Firestore (NoSQL), Firebase Storage (datoteke) |
| **Funkcijska plast** | Cloud Functions za Stripe plačila (serverless) |

---

## Tehnološki sklad

### Mobilna aplikacija

| Tehnologija | Verzija | Namen |
|-------------|---------|-------|
| React Native | 0.74.5 | UI framework |
| Expo | ~51.0.28 | Build ogrodje |
| React Navigation | 6.x | Navigacija (Drawer + Stack) |
| Firebase SDK | 10.13.1 | Backend integracija |
| Stripe React Native | 0.37.2 | Plačila |
| react-native-maps | — | Prikaz karte |
| expo-location | — | GPS lokacija |
| expo-notifications | — | Push obvestila |
| expo-image-picker | — | Nalaganje slik |

### Spletna aplikacija

| Tehnologija | Verzija | Namen |
|-------------|---------|-------|
| React | 18.3.1 | UI framework |
| TypeScript | 5.6.2 | Tipizacija |
| Vite | 5.4.8 | Build orodje |
| React Router DOM | 6.26.2 | Routing |
| Tailwind CSS | 3.4.13 | Stilizacija |
| Leaflet | — | Interaktivne karte |
| Firebase SDK | 11.1.0 | Backend integracija |

### Backend

| Tehnologija | Namen |
|-------------|-------|
| Firebase Authentication | Prijava/registracija (email + geslo) |
| Cloud Firestore | Glavna NoSQL baza podatkov |
| Firebase Storage | Shranjevanje slik in datotek |
| Cloud Functions (Node.js 20) | Serverless logika, Stripe integracija |
| Firebase Hosting | Gostovanje spletne aplikacije |
| Stripe | Plačilni prehod za rezervacije |

---

## Podatkovni modeli — ER diagram

```mermaid
erDiagram
    USERS {
        string uid PK
        string email
        string displayName
        string role
        number reputation
        number eloRating
        string position
        boolean isPremium
        string expoPushToken
        timestamp createdAt
    }

    MATCHES {
        string id PK
        string sport
        string creatorId FK
        string location
        number lat
        number lng
        timestamp dateTime
        number totalSpots
        number filledSpots
        string status
        boolean isPublic
        string inviteCode
        boolean isPremium
        number costPerPerson
        boolean matchStarted
        string venueId FK
    }

    MATCH_PLAYERS {
        string matchId FK
        string userId FK
        string team
        string position
        timestamp joinedAt
    }

    MATCH_SCORING {
        string matchId FK
        string id PK
        string type
        string playerId FK
        number minute
        string confirmedBy
    }

    VENUES {
        string id PK
        string ownerId FK
        string name
        string sport
        string address
        number lat
        number lng
        number totalSpots
        number pricePerHour
        boolean isActive
    }

    SCHEDULE_SLOTS {
        string id PK
        string venueId FK
        number weekday
        number startTime
        number endTime
        number price
        boolean isActive
    }

    RESERVATIONS {
        string id PK
        string venueId FK
        string matchId FK
        string bookedBy FK
        string date
        number startTime
        number endTime
        number price
        string status
    }

    MESSAGES {
        string id PK
        string matchId FK
        string senderId FK
        string text
        string imageUrl
        string gifUrl
        timestamp createdAt
    }

    GROUPS {
        string id PK
        string creatorId FK
        string name
        string sport
        string recurrenceRule
        array members
    }

    USERS ||--o{ MATCHES : "ustvari"
    USERS ||--o{ MATCH_PLAYERS : "sodeluje"
    MATCHES ||--o{ MATCH_PLAYERS : "vsebuje"
    MATCHES ||--o{ MATCH_SCORING : "beleži"
    MATCHES ||--o{ MESSAGES : "ima chat"
    USERS ||--o{ MESSAGES : "pošilja"
    VENUES ||--o{ SCHEDULE_SLOTS : "ima"
    VENUES ||--o{ RESERVATIONS : "sprejema"
    MATCHES ||--o{ RESERVATIONS : "povzroči"
    USERS ||--o{ RESERVATIONS : "rezervira"
    USERS ||--o{ VENUES : "upravlja"
    USERS ||--o{ GROUPS : "ustvari"
```

### Opis kolekcij v Firestore

| Kolekcija | Opis | Podkolekcije |
|-----------|------|--------------|
| `users` | Profili igralcev in lastnikov | `matchHistory`, `sentInvites` |
| `matches` | Tekme (aktivne, zaprte) | `players`, `scoring`, `messages` |
| `venues` | Športni objekti | `schedule` |
| `reservations` | Rezervacije objektov | — |
| `groups` | Ponavljajoče se ekipe | `events` |

---

## Razredni diagram

```mermaid
classDiagram
    class User {
        +string uid
        +string email
        +string displayName
        +string role
        +number reputation
        +number eloRating
        +boolean isPremium
        +string position
        +string expoPushToken
    }

    class Match {
        +string id
        +string sport
        +string creatorId
        +GeoPoint location
        +Date dateTime
        +number totalSpots
        +number filledSpots
        +MatchStatus status
        +boolean isPublic
        +boolean isPremium
        +number costPerPerson
    }

    class Venue {
        +string id
        +string ownerId
        +string name
        +string sport
        +GeoPoint location
        +number totalSpots
        +number pricePerHour
        +boolean isActive
    }

    class ScheduleSlot {
        +string id
        +string venueId
        +number weekday
        +number startTime
        +number endTime
        +number price
        +boolean isActive
    }

    class Reservation {
        +string id
        +string venueId
        +string matchId
        +string bookedBy
        +string date
        +number startTime
        +ReservationStatus status
    }

    class Message {
        +string id
        +string matchId
        +string senderId
        +string text
        +string imageUrl
        +Date createdAt
    }

    class MatchService {
        +createMatch(data) Match
        +joinMatch(matchId, userId) void
        +leaveMatch(matchId, userId) void
        +closeMatch(matchId) void
        +getMatchesNearby(lat, lng, radius) Match[]
        +updateElo(matchId, results) void
        +updateReputation(event, userId) void
    }

    class TeamBalancer {
        +balanceTeams(players) TeamResult
        +calculateStrength(player) number
        +snakeDraft(players) Teams
    }

    class ReputationService {
        +updateReputation(userId, event) void
        +getReputation(userId) number
    }

    class VenueService {
        +createVenue(data) Venue
        +updateVenue(id, data) void
        +deleteVenue(id) void
        +getVenuesByOwner(ownerId) Venue[]
    }

    class ScheduleService {
        +createSlot(venueId, data) ScheduleSlot
        +updateSlot(venueId, slotId, data) void
        +deleteSlot(venueId, slotId) void
        +getSlotsForVenue(venueId) ScheduleSlot[]
    }

    class ReservationService {
        +createReservation(data) Reservation
        +getReservationsByVenue(venueId) Reservation[]
        +getRevenueStats(venueId) RevenueData
    }

    class ChatService {
        +sendMessage(matchId, message) void
        +subscribeToMessages(matchId, callback) Unsubscribe
        +uploadImage(matchId, file) string
    }

    MatchService --> Match
    MatchService --> TeamBalancer
    MatchService --> ReputationService
    VenueService --> Venue
    ScheduleService --> ScheduleSlot
    ReservationService --> Reservation
    ChatService --> Message
    Match "1" --> "*" Message
    Match "1" --> "*" Reservation
    Venue "1" --> "*" ScheduleSlot
    Venue "1" --> "*" Reservation
    User "1" --> "*" Match
    User "1" --> "*" Venue
```

---

## Diagram primerov uporabe

![Diagram primerov uporabe — GameOn](docs/diagrami/projekt.jpg)

> Diagram je izdelan v **Visual Paradigm** (standardna UML notacija).
> Izvorni projekt za urejanje: [`docs/diagrami/projekt.vpp`](docs/diagrami/projekt.vpp) —
> po spremembi diagram znova izvozi kot sliko (*File → Export → Active Diagram as Image*).

**Branje diagrama**

| Element | Pomen |
|---|---|
| Palični lik | Akter (uporabnik ali zunanji sistem) |
| Oval | Primer uporabe |
| Modri pravokotnik | Meja sistema |
| Polna črta brez puščice | Asociacija med akterjem in primerom uporabe |
| Puščica s praznim trikotnikom | Generalizacija akterja (kaže od specializiranega k splošnemu) |
| `<<Include>>` | Osnovni primer uporabe vedno vključuje drugega |
| `<<Extend>>` | Razširitev, ki se izvede le pod določenim pogojem |
| *extension points* | Točka v osnovnem primeru uporabe, kjer se razširitev vključi |

**Vloge**

- **Gostitelj / Ustvarjalec tekme** in **Kapetan ekipe** sta specializaciji **Igralca** — podedujeta vse njegove primere uporabe in dodata svoje.
- **Kapetan** ni ročna vloga: ob začetku tekme ga sistem samodejno dodeli igralcu z najvišjim ELO v vsaki ekipi (Cloud Function `assignCaptains`).
- **Stripe** je zunanji akter — sodeluje samo pri plačilu najema igrišča.

**Postopek zaključka tekme**

- *Oddaj končni rezultat* **vključuje** (`<<Include>>`) *Zaključi tekmo in razdeli ELO / reputacijo*: ko se rezultata obeh kapetanov ujemata, se tekma samodejno zapre in ELO ter reputacija se razdelita vsem prisotnim igralcem.
- *Vnos rezultata ob neujemanju kapetanov* **razširja** (`<<Extend>>`) oddajo rezultata: sproži se samo, če se kapetana ne strinjata, in je takrat na voljo vsem prijavljenim igralcem — velja rezultat večine.

---

## Diagram toka podatkov (DFD)

### Nivo 0 — Kontekstni diagram

```mermaid
graph LR
    PLAYER([Igralec])
    OWNER([Lastnik objekta])
    STRIPE_EXT([Stripe])
    MAPS_EXT([Google Maps])

    SYSTEM[GameOn\nSistem]

    PLAYER -->|registracija, iskanje tekem,\npridružitev, chat, rezervacija| SYSTEM
    SYSTEM -->|tekme, obvestila,\npotrditve| PLAYER

    OWNER -->|upravljanje objektov,\nrazporedi, cene| SYSTEM
    SYSTEM -->|rezervacije, prihodki,\nstatistike| OWNER

    SYSTEM -->|zahteva za plačilo| STRIPE_EXT
    STRIPE_EXT -->|potrditev plačila| SYSTEM

    MAPS_EXT -->|koordinate, geokodiranje| SYSTEM
```

### Nivo 1 — Glavni procesi

```mermaid
graph TB
    subgraph "Vhodni podatki"
        PLAYER([Igralec])
        OWNER([Lastnik])
    end

    subgraph "Procesi"
        P1[1. Upravljanje\nidentitete]
        P2[2. Upravljanje\ntekem]
        P3[3. Iskanje\nin filtriranje]
        P4[4. Komunikacija\nin chat]
        P5[5. Rezervacije\nin plačila]
        P6[6. Računanje\nELO in reputacije]
        P7[7. Upravljanje\nobjekatov]
    end

    subgraph "Podatkovne shrambe"
        DS1[(users)]
        DS2[(matches)]
        DS3[(venues)]
        DS4[(reservations)]
        DS5[(messages)]
    end

    PLAYER --> P1
    OWNER --> P1
    P1 <--> DS1

    PLAYER --> P2
    P2 <--> DS2
    P2 --> P6
    P6 --> DS1

    PLAYER --> P3
    P3 --> DS2
    P3 --> DS3

    PLAYER --> P4
    P4 <--> DS5

    PLAYER --> P5
    P5 <--> DS4
    P5 --> DS2

    OWNER --> P7
    P7 <--> DS3
    P7 --> DS4
```

### Tok podatkov — Ustvarjanje tekme

```mermaid
flowchart TD
    A[Igralec vnese podatke tekme] --> B{Javna ali zasebna?}
    B -->|Javna| C[Zapis v Firestore\nbrez invite kode]
    B -->|Zasebna| D[Generiranje invite kode\nZapis v Firestore]
    C --> E{Rezervacija dvorane?}
    D --> E
    E -->|Da| F[Iskanje razpoložljivih\nslotov za venue]
    F --> G[Stripe Checkout Session\nprek Cloud Functions]
    G --> H{Plačilo uspešno?}
    H -->|Da| I[Rezervacija shranjena\nv Firestore]
    H -->|Ne| J[Napaka - brez rezervacije]
    E -->|Ne| K[Tekma aktivna\nbrez dvorane]
    I --> K
    K --> L[Push obvestila\nobližnjim igralcem]
    L --> M[Tekma vidna\nna karti]
```

### Tok podatkov — Plačilo rezervacije

```mermaid
sequenceDiagram
    participant U as Igralec (mobilno)
    participant CF as Cloud Functions
    participant S as Stripe API
    participant FS as Firestore

    U->>CF: createCheckoutSession(venueId, slotId, matchId)
    CF->>S: stripe.checkout.sessions.create(...)
    S-->>CF: { url, sessionId }
    CF-->>U: checkout URL
    U->>S: Odpre Stripe checkout v brskalniku
    S->>U: Vnos podatkov kartice
    U->>S: Potrdi plačilo
    S-->>U: Preusmeri na success.html
    U->>CF: createReservation(sessionId, ...)
    CF->>S: Preveri status seje
    S-->>CF: { status: "complete" }
    CF->>FS: Zapiše rezervacijo (status: confirmed)
    CF-->>U: Potrditev
```

---

## Sekvenčni diagrami

### Pridružitev tekmi

```mermaid
sequenceDiagram
    participant U as Igralec
    participant App as Mobilna aplikacija
    participant FS as Firestore
    participant Push as Expo Notifications

    U->>App: Klikne "Pridruži se" na tekmi
    App->>FS: Bere match dokument
    FS-->>App: Match podatki (filledSpots, totalSpots)

    alt Mesto je prosto
        App->>FS: Transakcija: dodaj userId v players,\nfilledSpots++
        FS-->>App: OK
        App->>Push: Pošlje obvestilo ustvarjalcu tekme
        App-->>U: "Uspešno si se pridružil"
    else Tekma je polna
        App->>FS: Dodaj v waitlist
        FS-->>App: OK
        App-->>U: "Dodan si na čakalno vrsto"
    end
```

### ELO in reputacija po tekmi

```mermaid
sequenceDiagram
    participant Creator as Ustvarjalec tekme
    participant App as Mobilna aplikacija
    participant FS as Firestore
    participant MatchSvc as MatchService
    participant RepSvc as ReputationService

    Creator->>App: Označi tekmo kot končano + vnese rezultate
    App->>FS: Shrani scoring evente
    App->>MatchSvc: closeMatch(matchId, results)
    MatchSvc->>FS: Bere seznam igralcev + ELO ocene
    MatchSvc->>MatchSvc: Izračuna pričakovane rezultate\n(ELO formula, K=32)
    MatchSvc->>FS: Posodobi ELO za vsakega igralca
    MatchSvc->>RepSvc: updateReputation(playerId, "attended")
    RepSvc->>FS: reputation += 2 (max 100)
    MatchSvc->>FS: Shrani v matchHistory
    App-->>Creator: "Tekma zaprta, ELO posodobljen"
```

### Uravnoteženje ekip

```mermaid
sequenceDiagram
    participant U as Ustvarjalec
    participant App as Aplikacija
    participant TB as TeamBalancer
    participant FS as Firestore

    U->>App: Zahteva uravnoteženje ekip
    App->>FS: Bere profile vseh prijavljenih igralcev
    FS-->>App: [ {uid, eloRating, position, ...} ]
    App->>TB: balanceTeams(players)
    TB->>TB: Razvrsti po ELO (padajoče)
    TB->>TB: Snake draft:\nEkipa A: 1., 4., 5., 8. ...\nEkipa B: 2., 3., 6., 7. ...
    TB-->>App: { teamA: [...], teamB: [...] }
    App->>FS: Shrani team dodelitve
    App-->>U: Prikaz uravnoteženih ekip
```

---

## Navigacijska struktura

### Mobilna aplikacija

```mermaid
graph TD
    ENTRY[Zagon aplikacije] --> AUTH{Prijavljen?}
    AUTH -->|Ne| LOGIN[Prijava / Registracija]
    LOGIN --> MAIN
    AUTH -->|Da| MAIN

    MAIN[Drawer Navigator] --> MAP[Karta tekem]
    MAIN --> PROFILE[Profil]
    MAIN --> GROUPS[Moje ekipe / skupne]
    MAIN --> PREMIUM[Premium]

    MAP --> CREATE[Ustvari tekmo]
    MAP --> DETAIL[Podrobnosti tekme]

    DETAIL --> CHAT[Chat tekme]
    DETAIL --> TEAMS[Uravnoteženje ekip]
    DETAIL --> SCORING[Rezultati]
    DETAIL --> BOOK[Rezervacija dvorane]
    DETAIL --> SPLIT[Razdelitev stroškov]

    BOOK --> PAYMENT[Stripe plačilo]
    PAYMENT -->|success| RESERVATION_OK[Potrditev rezervacije]
    PAYMENT -->|cancel| DETAIL

    CREATE --> MAP_PICKER[Izbira lokacije na karti]
    CREATE --> VENUE_SELECT[Izbira dvorane]
```

### Spletna aplikacija (lastnik objekta)

```mermaid
graph TD
    ENTRY_W[Odpre spletno stran] --> AUTH_W{Prijavljen in lastnik?}
    AUTH_W -->|Ne| LOGIN_W[Prijava / Registracija]
    AUTH_W -->|Da, ni lastnik| DENIED[Access Denied]
    AUTH_W -->|Da, lastnik| DASH[Dashboard]

    LOGIN_W --> DASH

    DASH --> VENUES[Moji objekti]
    DASH --> RESERVATIONS[Rezervacije]
    DASH --> REVENUE[Prihodki]

    VENUES --> VENUE_NEW[Nov objekt]
    VENUES --> VENUE_EDIT[Uredi objekt]
    VENUE_EDIT --> SCHEDULE[Uredi razpored]
    SCHEDULE --> SLOT_NEW[Nov časovni slot]
    SCHEDULE --> SLOT_EDIT[Uredi slot]
```

---

## Ključne funkcionalnosti

### 1. Sistem ELO ocenjevanja

Vsak igralec ima ELO oceno (začetna vrednost: **700**). Po vsaki tekmi se ocena posodobi po standardni ELO formuli:

```
E_A = 1 / (1 + 10^((ELO_B - ELO_A) / 400))
Nova_ELO = Stara_ELO + K * (dejanski_rezultat - pričakovani_rezultat)
K-faktor = 32
Bonus za gol = +5 ELO
```

### 2. Sistem reputacije

| Dogodek | Sprememba |
|---------|-----------|
| Udeležba na tekmi | +2 |
| Odjava pravočasno | 0 |
| Pozna odjava (< 2 uri pred tekmo) | -2 |
| Neupravičena odsotnost | -5 |

Reputacija je omejena med 0 in 100, začetna vrednost je **50**.

### 3. Uravnoteženje ekip (Snake Draft)

Algoritem razporedi igralce v dve enakovredni ekipi:
1. Razvrsti vse prijavljene po moči (ELO + pozicija)
2. Uporabi snake draft: A, B, B, A, A, B, B, A ...
3. Upošteva pozicije (vratar, branilec, vezni, napadalec / bek, center, krilo)

### 4. Premium tier

Premium člani imajo dostop do:
- Ekskluzivnih premium tekem
- Naprednih statistik (ELO trend, win rate)
- Premium badge na profilu
- Prednostnega dostopa do rezervacij

### 5. Živahni chat z medijsko vsebino

Vsaka tekma ima lasten chat kanal v realnem času (Firestore `onSnapshot`):
- Besedilna sporočila
- Slike (nalaganje v Firebase Storage)
- GIF-i (Giphy API integracija)

### 6. Integracija s Stripe

Plačila za rezervacije dvorane tečejo prek **Stripe Checkout**:
1. Cloud Function ustvari Stripe Checkout Session
2. Aplikacija odpre Stripe URL v brskalniku
3. Po uspešnem plačilu se aplikacija vrne na potrdilno stran
4. Rezervacija se potrdi v Firestore

---

## Navodila za zagon

### Predpogoji

- Node.js 20+
- Expo CLI: `npm install -g expo-cli`
- Firebase CLI: `npm install -g firebase-tools`
- Android Studio / Expo Go app (za mobilno)

### 1. Kloniranje repozitorija

```bash
git clone https://github.com/ninolisjak/gameon_projekt.git
cd gameon_projekt
```

### 2. Zagon mobilne aplikacije

```bash
cd mobile
npm install
npx expo start
```

Odprite Expo Go na telefonu in skenirajte QR kodo **ali** zaženite Android emulator.

### 3. Zagon spletne aplikacije

```bash
cd web
npm install
npm run dev
```

Dostopno na: `http://localhost:5173`

### 4. Zagon Cloud Functions (lokalno)

```bash
cd functions
npm install
firebase emulators:start
```

### Firebase konfiguracija

Ustvarite `mobile/src/config/firebase.ts` in `web/src/config/firebase.ts` z Firebase konfiguracijskimi podatki iz Firebase konzole:

```typescript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "gameon-9d876.firebaseapp.com",
  projectId: "gameon-9d876",
  storageBucket: "gameon-9d876.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

---

## Vodenje projekta

### Struktura vej (Git Flow)

```mermaid
gitGraph
   commit id: "initial"
   branch develop
   checkout develop
   commit id: "base setup"
   branch feature/maps
   checkout feature/maps
   commit id: "GAM-01 karta"
   checkout develop
   merge feature/maps
   branch feature/elo
   checkout feature/elo
   commit id: "GAM-10 ELO sistem"
   checkout develop
   merge feature/elo
   branch feature/chat
   checkout feature/chat
   commit id: "GAM-22 live chat"
   checkout develop
   merge feature/chat
   checkout main
   merge develop id: "v1.0 release"
```

### Konvencija poimenovanja vej in commitov

- **Veje**: `feature/GAM-XX-kratek-opis`, `fix/GAM-XX-opis`, `hotfix/opis`
- **Commiti**: `GAM-XX Kratki opis spremembe` (npr. `GAM-22 Live chat z slikami in gifi`)
- **Pull requesti**: Vsaka feature veja se mergea prek PR z vsaj enim reviewerjem

### Razvojni tok

```mermaid
flowchart LR
    BACKLOG[Product Backlog] --> SPRINT[Sprint Planiranje]
    SPRINT --> DEV[Razvoj\nna feature veji]
    DEV --> PR[Pull Request]
    PR --> REVIEW[Code Review]
    REVIEW -->|Popravki| DEV
    REVIEW -->|Odobren| MERGE[Merge v main]
    MERGE --> TEST[Testiranje]
    TEST --> DEPLOY[Deploy\nFirebase Hosting]
```

---

## Zagotavljanje kakovosti

### Varnostna pravila Firestore

```mermaid
flowchart TD
    REQ[Zahteva za dostop do Firestore] --> AUTH_CHECK{Prijavljen?}
    AUTH_CHECK -->|Ne| DENY[Zavrni]
    AUTH_CHECK -->|Da| COLL{Kolekcija?}

    COLL -->|users| USER_CHECK{Lastnik dokumenta?}
    USER_CHECK -->|Da| ALLOW
    USER_CHECK -->|Ne| DENY

    COLL -->|matches| MATCH_CHECK{Operacija?}
    MATCH_CHECK -->|Branje| ALLOW
    MATCH_CHECK -->|Pisanje| AUTH_MATCH{Veljavni pogoji?}
    AUTH_MATCH -->|Da| ALLOW[Dovoli]
    AUTH_MATCH -->|Ne| DENY

    COLL -->|venues| VENUE_CHECK{Operacija?}
    VENUE_CHECK -->|Branje| ALLOW
    VENUE_CHECK -->|Pisanje| OWNER_CHECK{Je lastnik?}
    OWNER_CHECK -->|Da| ALLOW
    OWNER_CHECK -->|Ne| DENY
```

### Preverjanje tipov

- Spletna aplikacija je v celoti v **TypeScriptu** (stroga tipizacija z `strict: true`)
- Definirani vmesniki za vse podatkovne modele v [web/src/types/models.ts](web/src/types/models.ts)
- Mobilna aplikacija deloma tipizirana (JavaScript + JSDoc)

### Testiranje

| Vrsta | Pristop |
|-------|---------|
| Ročno testiranje | Testiranje na fizičnih napravah (Android) |
| Firestore pravila | Firebase Emulator Suite |
| Plačilni tok | Stripe test način (test kartice) |
| Notifikacije | Expo test orodje za push |

### Obravnava napak

- **Plačila**: Stripe Checkout Session verifikacija pred ustvarjanjem rezervacije
- **Omrežje**: Firebase SDK vgrajeno offline upravljanje (Firestore cache)
- **Varnost**: Firebase Security Rules kot zadnja obrambna linija pred nepooblaščenim dostopom

---

## Varnostna pravila

### Vloge v sistemu

| Vloga | Dostop |
|-------|--------|
| `player` | Mobilna aplikacija, tekme, chat, rezervacije |
| `owner` | Spletna aplikacija, upravljanje objektov |
| `admin` | Polni dostop prek Firebase konzole |

### Firestore Rules (povzetek)

| Kolekcija | Branje | Pisanje |
|-----------|--------|---------|
| `users` | Samo lastnik | Samo lastnik |
| `matches` | Vsi avtentificirani | Ustvarjalec + omejeno |
| `venues` | Vsi | Samo lastnik objekta |
| `schedule` | Vsi | Samo lastnik objekta |
| `reservations` | Rezervator ali lastnik | Udeleženci |

---

## Projektna ekipa

**Firebase projekt ID**: `gameon-9d876`  
**Android package**: `com.RISacc.gameontest`  
**Repozitorij**: [github.com/ninolisjak/gameon_projekt](https://github.com/ninolisjak/gameon_projekt)

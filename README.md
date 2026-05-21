# GameOn

Mobilna aplikacija za organizacijo pickup tekem futsala in košarke.

## Tehnologije

- React Native (Expo SDK 51)
- Firebase (Auth, Firestore)
- React Navigation (Stack + Drawer)
- Leaflet + OpenStreetMap (mapa)

---

## Setup za novega razvijalca

### 1. Predpogoji

Namesti naslednje orodja:

- [Node.js](https://nodejs.org/) (v18 ali novejši)
- [Git](https://git-scm.com/)
- [Expo Go](https://expo.dev/go) na telefonu **ali** Android Studio z emulatorjem
- Android Studio: potrebuješ Android SDK + emulator (Pixel 6, API 34, **z Google Play**)

### 2. Kloniranje repozitorija

```bash
git clone <repo-url>
cd GameOn/mobile
```

### 3. Namestitev odvisnosti

```bash
npm install
```

### 4. Firebase konfiguracija

`.env` datoteka **ni v repozitoriju** (iz varnostnih razlogov). Dobi vrednosti od člana ekipe ali iz Firebase Console → Project Settings → Your apps.

Ustvari `mobile/.env` z naslednjimi vrednostmi:

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

### 5. google-services.json

`google-services.json` prav tako **ni v repozitoriju**. Dobi ga od člana ekipe ali prenesi iz Firebase Console → Project Settings → Android app → google-services.json. Shrani ga v `mobile/google-services.json`.

### 6. Zagon aplikacije

**Na emulatorju (Android Studio):**
```bash
# Najprej zaženi emulator v Android Studio, nato:
npx expo start --android --clear
```

**Na fizičnem telefonu (Expo Go):**
```bash
npx expo start
# Skeniraj QR kodo z Expo Go aplikacijo
```

### 7. ADB (če emulator ni zaznan)

Če dobiš napako `adb not recognized`:
- Poišči mapo: `C:\Users\<ime>\AppData\Local\Android\Sdk\platform-tools`
- Dodaj jo v Windows PATH (System Environment Variables)
- Restart terminal

---

## Struktura projekta

```
GameOn/
  mobile/
    App.tsx               # Root: navigacija, auth, header, drawer
    index.ts              # Vstopna točka
    app.json              # Expo konfiguracija
    src/
      config/
        firebase.ts       # Firebase inicializacija
      screens/
        LoginScreen.tsx   # Google prijava
        MapScreen.tsx     # Zemljevid s tekmami (Leaflet/OSM)
        CreateMatchScreen.tsx  # Ustvarjanje nove tekme
      services/
        matchService.ts   # Firestore operacije za tekme
      styles/
        AppStyles.ts            # Stili za App.tsx (header, drawer)
        MapScreenStyles.ts      # Stili za MapScreen
        CreateMatchScreenStyles.ts
        LoginScreenStyles.ts
  firestore.rules         # Firebase varnostna pravila
  README.md
```

---

## Razvojni način (DEV_SKIP_LOGIN)

V `App.tsx` je zastavica:
```ts
const DEV_SKIP_LOGIN = true;
```
Ko je `true`, aplikacija preskoči Google login in se anonimno prijavi v Firebase. To je namenjeno razvoju — za produkcijo nastavi na `false`.

---

## Firebase pravila

Firestore pravila so v `firestore.rules`. Za deploy na Firebase:
```bash
firebase deploy --only firestore:rules
```

---

## Ekipa

| Ime | Email |
|-----|-------|
| Nino Lisjak | Nino.lisjak@student.um.si |
| Marc Počivavšek | Marc.pocivavsek@student.um.si |
| Andrej Majhen | Andrej.majhen@student.um.si |

# Documentació — AEA2: App Mòbil Nativa amb IA Local (TensorFlow.js)

**Projecte:** `aea2-ondevice-ai` (Ionic/Vue + Capacitor)  
**Objectiu:** IA **on-device** (sense núvol) amb càmera + TensorFlow.js

---

## 1) Funcionalitats de l’aplicació

### Què fa l’app?
L’aplicació obre la **càmera del dispositiu** i executa una **classificació d’imatges en temps real** amb TensorFlow.js, mostrant les **3 classes** més probables amb el seu **percentatge de confiança**.  
La inferència es fa **localment al dispositiu** (WebView) i el **model està inclòs** dins l’app per funcionar sense connexió.

### Característiques principals
- **Càmera en viu** (facingMode: posterior preferent).
- **Carrega de model local** (`tf.loadGraphModel`) i execució en temps real.
- **Resultats Top‑3** amb barres de progrés i percentatges.
- **HUD d’estat**: model carregat, càmera ON/OFF, FPS aproximats.
- **Offline-first**: model i pesos dins `public/models/...` (no cal Internet).

### Casos d’ús
- Identificar ràpidament el “tipus” d’objecte que veu la càmera (ús educatiu/demostració).
- Provar rendiment d’IA local (FPS) en diferents mòbils.
- Base per evolucions (Teachable Machine, object detection, etc.).

---

## 2) Captures de l’aplicació

**Important:** aquest document està preparat perquè hi enganxis captures reals.  
Guarda-les a `docs/screenshots/` i substitueix els fitxers/imatges següents.

### Capture 1 — Pantalla principal amb càmera
![Pantalla principal amb càmera](screenshots/01-camera.jpg)

### Capture 2 — Prediccions i percentatges
![Prediccions](screenshots/02-predictions.jpg)

### Capture 3 — Funcionament sense Wi‑Fi
![Offline](screenshots/03-offline.jpg)

---

## 3) Procés d’especificació (Spec‑Driven Development)

S’ha seguit una aproximació **Spec‑Driven Development** (estil Speckit/OpenSpec): primer es defineix l’objectiu i requisits (Foundations), després el comportament i fluxos (Specify), i finalment la planificació/decisions tècniques (Planning) abans d’implementar.

### a) Foundations (context, objectius, abast)
- **Context:** pràctica DAM d’“On‑Device AI” amb Ionic/Vue + Capacitor + TensorFlow.js.
- **Objectiu:** inferència d’IA en temps real **sense dependència del núvol**.
- **Abast:** una sola pantalla principal amb càmera + classificació + UI nativa.
- **No abast (en aquesta versió):** entrenament propi, detecció d’objectes, tracking multipersona.

### b) Specify (funcional i comportament esperat)
- En prémer **Carrega el model**, l’app carrega el GraphModel local.
- En prémer **Engega càmera**, demana permisos i mostra el preview.
- En prémer **Start**, comença el loop d’inferència (throttle) i mostra Top‑3.
- En prémer **Stop** o aturar càmera, para el loop i allibera recursos.
- Si hi ha errors (permisos, càrrega, inferència), es mostra un missatge d’estat.

### c) Planning (tasques, estructura i decisions tècniques)
- **Estructura:** Ionic/Vue (UI) + Capacitor (Android) + TFJS (inferència).
- **Model:** MobileNetV2 en format TFJS GraphModel.
- **Offline-first:** model copiat a `public/models/` perquè el primer arrencada no requereixi xarxa.
- **Rendiment:** throttle (~150ms) per estabilitzar FPS en dispositius modestos.
- **Planificació de tasques:** veure `tasks.md`.

---

## 4) Annex — Fitxers rellevants

### `SPEC.md`
Veure fitxer del projecte: `SPEC.md`.

### `PROMPTS.md`
Veure fitxer del projecte: `PROMPTS.md`.

### `tasks.md`
Veure fitxer del projecte: `tasks.md`.


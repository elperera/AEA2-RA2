# SPEC — App Mòbil Nativa amb IA Local (Ionic/Vue + Capacitor + TFJS)

## Objectiu
Aplicació híbrida amb aparença nativa (Ionic) que executa **classificació d’imatges en temps real** amb IA **local** (TensorFlow.js) usant la càmera del mòbil.

## Model TensorFlow.js
- **Model:** MobileNetV2 (ImageNet, 224×224) en format **TFJS GraphModel**.
- **Carrega des de:** fitxers locals empaquetats dins l’app: `public/models/mobilenet_v2_1.0_224/`.
- **Mida (real al projecte):** ~**13.44 MB** (5 fitxers: `model.json` + 4 shards).  
  Carpeta: `public/models/mobilenet_v2_1.0_224/`.

## Flux de càmera (captura → inferència)
- **Captura:** `navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }}})` i render a un element `<video>`.
- **Preprocessat:** `fromPixels(video)` → resize bilinear a `224×224` → `float32` → normalització `[0..1]`.
- **Inferència:** `tf.loadGraphModel('/models/mobilenet_v2_1.0_224/model.json')` i `model.predict(batched)`.
- **Temps real (FPS):** loop amb `requestAnimationFrame` i *throttle* (~150ms) per mantenir rendiment en dispositius modestos.

## Feedback a l’usuari (UI/UX)
- **Vista principal:** preview de càmera tipus “hero” + HUD amb estat (Model/Càmera/FPS).
- **Controls:** botons grans “Carrega el model”, “Engega/Atura càmera”, “Start/Stop”.
- **Resultats:** Top‑3 prediccions amb percentatge i `IonProgressBar`.
- **Estat/Errors:** missatge curt de status (permisos, errors de càrrega, etc.).

## Requisits Offline
- El model es troba dins el bundle (`public/models/...`), així que la inferència funciona **sense Internet des del primer arrencada**.

## Android (Capacitor)
- Plataforma: carpeta `android/` generada amb Capacitor.
- Permisos:
  - `android.permission.CAMERA` a `android/app/src/main/AndroidManifest.xml`.

## Build d’APK (guia)
En aquesta màquina no s’ha pogut compilar l’APK perquè **no hi ha Java/JDK** (error: `JAVA_HOME is not set`).

Per generar l’APK al teu PC:
1) Instal·la **JDK 17** (o el que requereixi la teva versió d’Android Studio) i configura `JAVA_HOME`.
2) Instal·la **Android Studio + Android SDK**.
3) Des del projecte:
   - `npm install`
   - `npm run build`
   - `npx cap sync android`
   - `cd android`
   - `./gradlew assembleDebug`
4) APK debug habitual:
   - `android/app/build/outputs/apk/debug/app-debug.apk`


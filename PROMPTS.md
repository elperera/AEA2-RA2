# PROMPTS — Informe de Prompts (IA Generativa)

## 1) Elecció del cas d’ús i model
**Prompt:**
> Proposa 3 idees d’app “On‑Device AI” amb Ionic/Vue + Capacitor + TensorFlow.js (sense núvol). Recomana un model preentrenat i explica pros/contres i requisits de rendiment.

**Decisió:**
- Classificació d’imatges en temps real amb **MobileNetV2** (lleuger i ràpid).

## 2) Especificació tècnica (SPEC)
**Prompt:**
> Escriu un `SPEC.md` en català per una app Ionic/Vue + Capacitor que faci classificació en temps real amb TFJS. Inclou: model i mida, flux de càmera, UI/feedback, rendiment (FPS) i passos per generar APK.

## 3) Integració TFJS + càmera (Vue)
**Prompt:**
> Dona’m el codi de `HomePage.vue` (Ionic/Vue) per: obrir la càmera amb `getUserMedia`, mostrar el vídeo, carregar un model TFJS, executar inferència periòdica (throttle), i mostrar Top‑3 prediccions amb percentatge i una barra.

## 4) Offline first (model empaquetat)
**Prompt:**
> Vull que el model no depengui d’Internet ni en el primer arrencada. Com puc descarregar `model.json` i els shards i col·locar-los a `public/models/...` i després carregar-los amb `tf.loadGraphModel('/models/.../model.json')`?

## 5) Build Android i permisos
**Prompt:**
> Quins passos i fitxers he de tocar per generar `android/` amb Capacitor i assegurar permisos de càmera a Android (Manifest)?

## Captures de pantalla
Pendent d’afegir (fes fotos/captures un cop instal·lis l’APK al mòbil):
- Pantalla amb càmera en marxa.
- Pantalla amb prediccions i percentatges.
- Pantalla amb el mòbil sense Wi‑Fi (inferència funcionant).


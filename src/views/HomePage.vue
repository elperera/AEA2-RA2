<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>On‑Device AI</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="page">
        <ion-card class="hero">
          <div class="video-wrap">
            <video ref="videoEl" class="video" autoplay playsinline muted />
            <div class="hud">
              <div class="hud-row">
                <span class="pill" :class="{ ok: modelReady }">
                  Model: {{ modelReady ? 'OK' : modelLoading ? 'Carregant…' : 'No carregat' }}
                </span>
                <span class="pill" :class="{ ok: cameraReady }">
                  Càmera: {{ cameraReady ? 'ON' : 'OFF' }}
                </span>
                <span class="pill" :class="{ ok: isRunning }">FPS: {{ fps.toFixed(1) }}</span>
              </div>
              <div v-if="status" class="hud-status">{{ status }}</div>
            </div>
          </div>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>Classificació en temps real (MobileNet)</ion-card-title>
            <ion-card-subtitle>Inferència local al dispositiu (sense Wi‑Fi)</ion-card-subtitle>
          </ion-card-header>

          <ion-card-content>
            <div class="controls">
              <ion-button :disabled="modelLoading || modelReady" expand="block" @click="ensureModel">
                {{ modelReady ? 'Model carregat' : 'Carrega el model' }}
              </ion-button>
              <ion-button :disabled="!modelReady || cameraBusy" expand="block" fill="outline" @click="toggleCamera">
                {{ cameraReady ? 'Atura càmera' : 'Engega càmera' }}
              </ion-button>
              <ion-button :disabled="!modelReady || !cameraReady" expand="block" color="success" @click="toggleRun">
                {{ isRunning ? 'Stop' : 'Start' }}
              </ion-button>
            </div>

            <ion-list inset>
              <ion-item v-for="p in predictions" :key="p.className">
                <ion-label>
                  <div class="pred-row">
                    <div class="pred-name">{{ p.className }}</div>
                    <div class="pred-score">{{ Math.round(p.probability * 100) }}%</div>
                  </div>
                  <ion-progress-bar :value="p.probability" />
                </ion-label>
              </ion-item>
              <ion-item v-if="predictions.length === 0">
                <ion-label class="muted">Prem Start per veure resultats.</ion-label>
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonProgressBar,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { onBeforeUnmount, ref } from 'vue';
import * as tf from '@tensorflow/tfjs';
import { IMAGENET_CLASSES } from '@tensorflow-models/mobilenet/dist/imagenet_classes';

type Prediction = { className: string; probability: number };

const videoEl = ref<HTMLVideoElement | null>(null);

const model = ref<tf.GraphModel | null>(null);
const modelLoading = ref(false);
const modelReady = ref(false);

const cameraReady = ref(false);
const cameraBusy = ref(false);
let stream: MediaStream | null = null;

const isRunning = ref(false);
const predictions = ref<Prediction[]>([]);

const status = ref<string>('');
const fps = ref<number>(0);
let rafId: number | null = null;
let lastFrameMs = 0;
let fpsEma = 0;

async function ensureModel() {
  if (modelReady.value || modelLoading.value) return;
  modelLoading.value = true;
  status.value = 'Carregant model… (1a vegada pot trigar uns segons)';
  try {
    model.value = await tf.loadGraphModel('/models/mobilenet_v2_1.0_224/model.json');
    modelReady.value = true;
    status.value = 'Model carregat.';
  } catch (e: any) {
    status.value = `Error carregant el model: ${e?.message ?? String(e)}`;
    modelReady.value = false;
    model.value = null;
  } finally {
    modelLoading.value = false;
  }
}

async function startCamera() {
  if (cameraReady.value || cameraBusy.value) return;
  cameraBusy.value = true;
  status.value = 'Demanant permisos de càmera…';
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    stream = s;
    const v = videoEl.value;
    if (!v) return;
    v.srcObject = s;
    await v.play();
    cameraReady.value = true;
    status.value = 'Càmera en marxa.';
  } catch (e: any) {
    status.value = `No s'ha pogut obrir la càmera: ${e?.message ?? String(e)}`;
    cameraReady.value = false;
  } finally {
    cameraBusy.value = false;
  }
}

function stopCamera() {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
  stream = null;
  const v = videoEl.value;
  if (v) v.srcObject = null;
  cameraReady.value = false;
}

async function toggleCamera() {
  if (cameraReady.value) {
    stopRun();
    stopCamera();
  } else {
    await startCamera();
  }
}

function startRun() {
  if (isRunning.value || !model.value || !videoEl.value) return;
  isRunning.value = true;
  status.value = 'Inferència en temps real…';
  predictions.value = [];
  lastFrameMs = performance.now();
  fpsEma = 0;
  loop();
}

function stopRun() {
  isRunning.value = false;
  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = null;
  fps.value = 0;
}

function toggleRun() {
  if (isRunning.value) stopRun();
  else startRun();
}

async function loop() {
  if (!isRunning.value) return;
  rafId = requestAnimationFrame(loop);

  const m = model.value;
  const v = videoEl.value;
  if (!m || !v) return;
  if (v.readyState < 2) return;

  const now = performance.now();
  if (now - lastFrameMs < 150) return; // ~6-7 FPS target per mòbils modestos
  lastFrameMs = now;

  try {
    const { values, indices } = tf.tidy(() => {
      const pixels = tf.browser.fromPixels(v);
      const resized = tf.image.resizeBilinear(pixels, [224, 224], true);
      const normalized = tf.div(tf.cast(resized, 'float32'), 255);
      const batched = tf.expandDims(normalized, 0);
      const pred = m.predict(batched) as tf.Tensor;
      const logits =
        pred.rank === 2 && pred.shape[1] === 1001 ? pred.slice([0, 1], [1, 1000]) : pred;
      const probs = tf.softmax(logits as tf.Tensor2D);
      const top = tf.topk(probs, 3, true);
      return { values: top.values, indices: top.indices };
    });

    const vals = await values.data();
    const idxs = await indices.data();
    values.dispose();
    indices.dispose();

    predictions.value = Array.from(idxs).map((idx, i) => ({
      className: (IMAGENET_CLASSES as any)[idx] ?? `class_${idx}`,
      probability: vals[i] ?? 0,
    }));

    const dt = performance.now() - now;
    const instFps = dt > 0 ? 1000 / dt : 0;
    fpsEma = fpsEma === 0 ? instFps : fpsEma * 0.85 + instFps * 0.15;
    fps.value = fpsEma;
  } catch (e: any) {
    status.value = `Error inferència: ${e?.message ?? String(e)}`;
  }
}

onBeforeUnmount(() => {
  stopRun();
  stopCamera();
});
</script>

<style scoped>
.page {
  padding: 12px 12px 24px;
  display: grid;
  gap: 12px;
}

.hero {
  overflow: hidden;
}

.video-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  background: linear-gradient(180deg, #0b1220 0%, #0a0f1a 100%);
}

.video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  filter: saturate(1.05) contrast(1.05);
}

.hud {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 10px;
  display: grid;
  gap: 8px;
  pointer-events: none;
}

.hud-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.pill {
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.pill.ok {
  border-color: rgba(37, 255, 166, 0.35);
}

.hud-status {
  font-size: 13px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.45);
  color: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.controls {
  display: grid;
  gap: 10px;
  margin-bottom: 10px;
}

.pred-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.pred-name {
  font-weight: 600;
}

.pred-score {
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}

.muted {
  opacity: 0.7;
}
</style>

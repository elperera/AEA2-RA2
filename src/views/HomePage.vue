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
            <canvas ref="canvasEl" class="overlay" />
            <div class="hud">
              <div class="hud-row">
                <span class="pill" :class="{ ok: modelReady }">
                  Model: {{ modelReady ? 'OK' : modelLoading ? 'Carregant…' : 'No carregat' }}
                </span>
                <span class="pill" :class="{ ok: cameraReady }">
                  Càmera: {{ cameraReady ? 'ON' : 'OFF' }}
                </span>
                <span class="pill" :class="{ ok: isRunning }">FPS: {{ fps.toFixed(1) }}</span>
                <span class="pill" :class="{ ok: isRunning }">Persones: {{ personCount }}</span>
              </div>
              <div v-if="status" class="hud-status">{{ status }}</div>
            </div>
          </div>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>Detecció de persones en temps real (COCO‑SSD)</ion-card-title>
            <ion-card-subtitle>Detecta “person” a la càmera i dibuixa caixes</ion-card-subtitle>
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
              <ion-item v-for="(p, idx) in persons" :key="idx">
                <ion-label>
                  <div class="pred-row">
                    <div class="pred-name">Persona</div>
                    <div class="pred-score">{{ Math.round(p.score * 100) }}%</div>
                  </div>
                  <ion-progress-bar :value="p.score" />
                </ion-label>
              </ion-item>
              <ion-item v-if="persons.length === 0">
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
import { onBeforeUnmount, onMounted, ref } from 'vue';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

type PersonDetection = { bbox: [number, number, number, number]; score: number };

const videoEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);

const model = ref<cocoSsd.ObjectDetection | null>(null);
const modelLoading = ref(false);
const modelReady = ref(false);

const cameraReady = ref(false);
const cameraBusy = ref(false);
const facingMode = ref<'user' | 'environment'>('user');
let stream: MediaStream | null = null;

const isRunning = ref(false);
const persons = ref<PersonDetection[]>([]);
const personCount = ref<number>(0);

const status = ref<string>('');
const fps = ref<number>(0);
let rafId: number | null = null;
let lastFrameMs = 0;
let fpsEma = 0;

const autoStart = ref(true);
const roiRadiusRatio = ref(0.36); // % of min(videoWidth, videoHeight)

async function ensureModel() {
  if (modelReady.value || modelLoading.value) return;
  modelLoading.value = true;
  status.value = 'Carregant model… (1a vegada pot trigar uns segons)';
  try {
    await tf.ready();
    // In some Vite/Ionic builds the WebGL backend can be tree-shaken away unless
    // explicitly imported (see '@tensorflow/tfjs-backend-webgl' import above).
    if (tf.getBackend() !== 'webgl' && tf.findBackend('webgl')) {
      try {
        await tf.setBackend('webgl');
      } catch {
        // ignore: fallback to current backend
      }
    }
    await tf.ready();
    model.value = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
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
      video: {
        facingMode: { ideal: facingMode.value },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
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
  status.value = 'Detecció en temps real…';
  persons.value = [];
  personCount.value = 0;
  lastFrameMs = performance.now();
  fpsEma = 0;
  loop();
}

function stopRun() {
  isRunning.value = false;
  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = null;
  fps.value = 0;
  personCount.value = 0;
  persons.value = [];

  const c = canvasEl.value;
  if (c) {
    const ctx = c.getContext('2d');
    ctx?.clearRect(0, 0, c.width, c.height);
  }
}

function toggleRun() {
  if (isRunning.value) stopRun();
  else startRun();
}

function getRoiCircle(vw: number, vh: number) {
  const r = Math.max(40, Math.round(Math.min(vw, vh) * roiRadiusRatio.value));
  return { cx: vw / 2, cy: vh / 2, r };
}

function isInsideRoi(people: PersonDetection[], vw: number, vh: number) {
  const { cx, cy, r } = getRoiCircle(vw, vh);
  const r2 = r * r;
  return people.filter((p) => {
    const [x, y, w, h] = p.bbox;
    const px = x + w / 2;
    const py = y + h / 2;
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= r2;
  });
}

async function bootstrap() {
  if (!autoStart.value) return;
  await ensureModel();
  if (!modelReady.value) return;
  await startCamera();
  if (!cameraReady.value) return;
  startRun();
}

async function loop() {
  if (!isRunning.value) return;
  rafId = requestAnimationFrame(loop);

  const m = model.value;
  const v = videoEl.value;
  if (!m || !v) return;
  if (v.readyState < 2) return;
  const vw = v.videoWidth || 0;
  const vh = v.videoHeight || 0;
  if (vw === 0 || vh === 0) return;

  const now = performance.now();
  if (now - lastFrameMs < 120) return; // ~8 FPS per mòbils modestos
  lastFrameMs = now;

  try {
    const detections = await m.detect(v, 10, 0.5);
    const peopleAll = detections
      .filter((d) => d.class === 'person' && (d.score ?? 0) >= 0.35)
      .map((d) => ({ bbox: d.bbox as [number, number, number, number], score: d.score ?? 0 }))
      .sort((a, b) => b.score - a.score);

    const people = isInsideRoi(peopleAll, vw, vh);

    persons.value = people;
    personCount.value = people.length;
    drawOverlay(people);

    const dt = performance.now() - now;
    const instFps = dt > 0 ? 1000 / dt : 0;
    fpsEma = fpsEma === 0 ? instFps : fpsEma * 0.85 + instFps * 0.15;
    fps.value = fpsEma;
  } catch (e: any) {
    status.value = `Error detecció: ${e?.message ?? String(e)}`;
  }
}

function drawOverlay(people: PersonDetection[]) {
  const v = videoEl.value;
  const c = canvasEl.value;
  if (!v || !c) return;
  const vw = v.videoWidth || 0;
  const vh = v.videoHeight || 0;
  if (vw === 0 || vh === 0) return;

  if (c.width !== vw) c.width = vw;
  if (c.height !== vh) c.height = vh;

  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, c.width, c.height);

  // ROI circle: darken outside area and draw circle guide
  const { cx, cy, r } = getRoiCircle(vw, vh);
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.rect(0, 0, vw, vh);
  ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = Math.max(2, Math.round(Math.min(vw, vh) * 0.004));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.lineWidth = Math.max(2, Math.round(Math.min(vw, vh) * 0.004));
  ctx.font = `${Math.max(14, Math.round(Math.min(vw, vh) * 0.035))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.textBaseline = 'top';

  for (const p of people) {
    const [x, y, w, h] = p.bbox;
    ctx.strokeStyle = 'rgba(37, 255, 166, 0.95)';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';

    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.stroke();

    const label = `Persona ${Math.round(p.score * 100)}%`;
    const padX = 8;
    const padY = 6;
    const textW = ctx.measureText(label).width;
    const boxW = textW + padX * 2;
    const fontPx = Number.parseInt(ctx.font, 10) || 14;
    const boxH = fontPx + padY * 2;
    const lx = Math.max(0, Math.min(x, vw - boxW));
    const ly = Math.max(0, y - boxH - 4);

    ctx.fillRect(lx, ly, boxW, boxH);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillText(label, lx + padX, ly + padY);
  }
}

onBeforeUnmount(() => {
  stopRun();
  stopCamera();
});

onMounted(() => {
  void bootstrap();
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
  height: min(45vh, 360px);
  background: linear-gradient(180deg, #0b1220 0%, #0a0f1a 100%);
}

.video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  filter: saturate(1.05) contrast(1.05);
}

.overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
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

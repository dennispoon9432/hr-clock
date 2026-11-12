/* ===== API ===== */
async function api(action, data = {}) {
  // text/plain 避免 CORS preflight，Apps Script 先收到
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...data }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error);
  return j.data;
}

const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function toast(msg, type = '') {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'show ' + type;
  clearTimeout(t._h); t._h = setTimeout(() => t.className = '', 3000);
}

/* ===== 人臉 ===== */
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/';
const Face = {
  ready: false,
  async load() {
    if (this.ready) return;
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    this.ready = true;
  },
  async startCamera(video) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
    });
    video.srcObject = stream;
    await video.play();
    return stream;
  },
  stopCamera(video) {
    (video.srcObject?.getTracks() || []).forEach(t => t.stop());
    video.srcObject = null;
  },
  // 回傳最大嗰塊面嘅 128 維特徵；冇面就 null
  async describe(video) {
    const r = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    return r || null;
  },
  // staff: [{staff_id, name, face: [[128], ...]}]
  match(descriptor, staff) {
    let best = null, bestD = Infinity;
    for (const s of staff) {
      for (const f of s.face) {
        const d = faceapi.euclideanDistance(descriptor, f);
        if (d < bestD) { bestD = d; best = s; }
      }
    }
    return { staff: bestD <= CONFIG.MATCH_THRESHOLD ? best : null, distance: bestD, nearest: best };
  },
  snapshot(video, w = 240) {
    const c = document.createElement('canvas');
    c.width = w; c.height = Math.round(w * video.videoHeight / video.videoWidth);
    c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.6).split(',')[1];
  },
};

// ============================================================
// Utilidades de canvas
// ============================================================
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w: rect.width, h: rect.height };
}

function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ============================================================
// Hero: traza de respuesta a escalón, se dibuja sola al cargar
// ============================================================
function initHero() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const { ctx, w, h } = setupCanvas(canvas);

  const blue = getCSSVar('--blue');
  const padding = 28;
  const tau = 0.85;
  const duration = 1600; // ms de animación de dibujo
  let start = null;

  function y(t) {
    // respuesta de primer orden a un escalón unitario: y(t) = 1 - e^(-t/tau)
    return 1 - Math.exp(-t / tau);
  }

  function draw(progress) {
    ctx.clearRect(0, 0, w, h);

    const plotW = w - padding * 2;
    const plotH = h - padding * 2 - 30;
    const baseY = h - padding - 30;

    // línea de referencia (setpoint)
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(w - padding, padding);
    ctx.stroke();
    ctx.setLineDash([]);

    // eje base
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(padding, baseY);
    ctx.lineTo(w - padding, baseY);
    ctx.stroke();

    // traza
    const maxT = 5; // segundos simulados visibles
    const pointsToDraw = Math.floor(200 * progress);

    ctx.strokeStyle = blue;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= pointsToDraw; i++) {
      const t = (i / 200) * maxT;
      const val = y(t);
      const px = padding + (t / maxT) * plotW;
      const py = baseY - val * plotH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // punto final brillante mientras dibuja
    if (progress < 1 && pointsToDraw > 0) {
      const t = (pointsToDraw / 200) * maxT;
      const val = y(t);
      const px = padding + (t / maxT) * plotW;
      const py = baseY - val * plotH;
      ctx.fillStyle = blue;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(ts) {
    if (!start) start = ts;
    const elapsed = ts - start;
    const progress = Math.min(elapsed / duration, 1);
    draw(progress);
    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// ============================================================
// §02 — Toggle lazo abierto / lazo cerrado
// ============================================================
const loopDiagrams = {
  abierto: `
    <line x1="0" y1="80" x2="70" y2="80" class="signal-line"/>
    <text x="4" y="68" class="diagram-label">referencia</text>
    <rect x="70" y="50" width="150" height="60" class="block-rect"/>
    <text x="145" y="85" class="block-label" text-anchor="middle">controlador</text>
    <line x1="220" y1="80" x2="290" y2="80" class="signal-line" marker-end="url(#arrow2)"/>
    <rect x="290" y="50" width="150" height="60" class="block-rect block-rect-accent"/>
    <text x="365" y="85" class="block-label" text-anchor="middle">proceso</text>
    <line x1="440" y1="80" x2="580" y2="80" class="signal-line" marker-end="url(#arrow2)"/>
    <text x="586" y="68" class="diagram-label">salida</text>
    <defs><marker id="arrow2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1L9 5L1 9" fill="none" class="arrow-path"/></marker></defs>
  `,
  cerrado: `
    <line x1="0" y1="80" x2="50" y2="80" class="signal-line"/>
    <text x="4" y="68" class="diagram-label">referencia</text>
    <circle cx="65" cy="80" r="14" class="block-rect"/>
    <text x="65" y="85" class="block-label" text-anchor="middle" font-size="14">+/−</text>
    <line x1="79" y1="80" x2="130" y2="80" class="signal-line" marker-end="url(#arrow3)"/>
    <rect x="130" y="50" width="140" height="60" class="block-rect"/>
    <text x="200" y="85" class="block-label" text-anchor="middle">controlador</text>
    <line x1="270" y1="80" x2="330" y2="80" class="signal-line" marker-end="url(#arrow3)"/>
    <rect x="330" y="50" width="140" height="60" class="block-rect block-rect-accent"/>
    <text x="400" y="85" class="block-label" text-anchor="middle">proceso</text>
    <line x1="470" y1="80" x2="580" y2="80" class="signal-line" marker-end="url(#arrow3)"/>
    <text x="530" y="68" class="diagram-label">salida</text>
    <path d="M 560 80 L 560 130 L 65 130 L 65 94" class="signal-line" fill="none" stroke-dasharray="3 3"/>
    <text x="220" y="146" class="diagram-label">retroalimentación</text>
    <defs><marker id="arrow3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1L9 5L1 9" fill="none" class="arrow-path"/></marker></defs>
  `
};

const loopCaptions = {
  abierto: 'Sin retroalimentación, una perturbación desvía la salida y el sistema nunca se entera — el error permanece indefinidamente.',
  cerrado: 'Con retroalimentación, el sistema mide su propia salida, la compara contra la referencia, y corrige la perturbación hasta volver al punto deseado.'
};

let currentLoop = 'abierto';
let loopAnimId = null;

function drawLoopGraph(mode, progress) {
  const canvas = document.getElementById('loop-canvas');
  if (!canvas) return;
  const { ctx, w, h } = setupCanvas(canvas);
  const blue = getCSSVar('--blue');
  const steel = getCSSVar('--steel');
  const padding = 20;

  ctx.clearRect(0, 0, w, h);

  const plotW = w - padding * 2;
  const plotH = h - padding * 2;
  const baseY = padding + plotH / 2;

  // línea de referencia
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(padding, baseY);
  ctx.lineTo(w - padding, baseY);
  ctx.stroke();
  ctx.setLineDash([]);

  const totalPoints = 200;
  const pointsToDraw = Math.floor(totalPoints * progress);

  ctx.strokeStyle = mode === 'cerrado' ? blue : steel;
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let i = 0; i <= pointsToDraw; i++) {
    const tNorm = i / totalPoints; // 0 a 1
    let val;

    if (tNorm < 0.25) {
      val = 0; // en reposo
    } else if (mode === 'abierto') {
      // perturbación entra y el sistema se queda desviado para siempre
      const local = Math.min((tNorm - 0.25) / 0.15, 1);
      val = -0.6 * local;
    } else {
      // perturbación entra, luego el sistema corrige de vuelta a 0
      const local = tNorm - 0.25;
      if (local < 0.1) {
        val = -0.6 * (local / 0.1);
      } else {
        const t = local - 0.1;
        val = -0.6 * Math.exp(-t / 0.12) * Math.cos(t * 10);
      }
    }

    const px = padding + tNorm * plotW;
    const py = baseY - val * (plotH / 2.4);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function animateLoopGraph(mode) {
  if (loopAnimId) cancelAnimationFrame(loopAnimId);
  const duration = 1400;
  let start = null;

  function frame(ts) {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    drawLoopGraph(mode, progress);
    if (progress < 1) loopAnimId = requestAnimationFrame(frame);
  }
  loopAnimId = requestAnimationFrame(frame);
}

function setLoop(mode) {
  currentLoop = mode;
  document.getElementById('loop-diagram').innerHTML = loopDiagrams[mode];
  document.getElementById('loop-caption').textContent = loopCaptions[mode];
  document.querySelectorAll('.loop-btn').forEach(btn => {
    const active = btn.dataset.loop === mode;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  animateLoopGraph(mode);
}

function initLoopToggle() {
  const buttons = document.querySelectorAll('.loop-btn');
  if (!buttons.length) return;
  buttons.forEach(btn => {
    btn.addEventListener('click', () => setLoop(btn.dataset.loop));
  });
  setLoop('abierto');
}

// ============================================================
// §03 — Slider de constante de tiempo τ
// ============================================================
function drawTauGraph(tau) {
  const canvas = document.getElementById('tau-canvas');
  if (!canvas) return;
  const { ctx, w, h } = setupCanvas(canvas);
  const blue = getCSSVar('--blue');
  const padding = 20;

  ctx.clearRect(0, 0, w, h);

  const plotW = w - padding * 2;
  const plotH = h - padding * 2;
  const baseY = h - padding;

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(w - padding, padding);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(padding, baseY);
  ctx.lineTo(w - padding, baseY);
  ctx.stroke();

  const maxT = 5;
  ctx.strokeStyle = blue;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 200; i++) {
    const t = (i / 200) * maxT;
    const val = 1 - Math.exp(-t / tau);
    const px = padding + (t / maxT) * plotW;
    const py = baseY - val * plotH;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function initTauSlider() {
  const slider = document.getElementById('tau-slider');
  const valueLabel = document.getElementById('tau-value');
  if (!slider) return;

  function update() {
    const tau = slider.value / 10;
    valueLabel.textContent = `τ = ${tau.toFixed(1)} s`;
    drawTauGraph(tau);
  }

  slider.addEventListener('input', update);
  update();
}

// ============================================================
// Init
// ============================================================
window.addEventListener('load', () => {
  initHero();
  initLoopToggle();
  initTauSlider();
});

window.addEventListener('resize', () => {
  drawLoopGraph(currentLoop, 1);
  const slider = document.getElementById('tau-slider');
  if (slider) drawTauGraph(slider.value / 10);
});

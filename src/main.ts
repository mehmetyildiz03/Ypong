import './styles.css';

const WORLD_W = 720;
let WORLD_H = 1080;
const WIN_SCORE = 7;
const FIXED_STEP = 1 / 120;

type GameState = 'menu' | 'playing' | 'paused' | 'gameover';
type Mode = 'cpu' | 'local';
type Difficulty = 'easy' | 'normal' | 'hard';

interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  targetX: number;
  vx: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  active: boolean;
  serveTimer: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`YPONG arayüz öğesi bulunamadı: ${selector}`);
  return element;
}

const canvas = requireElement<HTMLCanvasElement>('#game');
const topScoreEl = requireElement<HTMLElement>('#topScore');
const bottomScoreEl = requireElement<HTMLElement>('#bottomScore');
const topLabelEl = requireElement<HTMLElement>('#topLabel');
const bottomLabelEl = requireElement<HTMLElement>('#bottomLabel');
const menu = requireElement<HTMLElement>('#menu');
const pauseOverlay = requireElement<HTMLElement>('#pauseOverlay');
const resultOverlay = requireElement<HTMLElement>('#resultOverlay');
const resultTitle = requireElement<HTMLElement>('#resultTitle');
const resultScore = requireElement<HTMLElement>('#resultScore');
const startButton = requireElement<HTMLButtonElement>('#startButton');
const pauseButton = requireElement<HTMLButtonElement>('#pauseButton');
const soundButton = requireElement<HTMLButtonElement>('#soundButton');
const resumeButton = requireElement<HTMLButtonElement>('#resumeButton');
const quitButton = requireElement<HTMLButtonElement>('#quitButton');
const rematchButton = requireElement<HTMLButtonElement>('#rematchButton');
const resultMenuButton = requireElement<HTMLButtonElement>('#resultMenuButton');
const difficultyGroup = requireElement<HTMLElement>('#difficultyGroup');
const controlHint = requireElement<HTMLElement>('#controlHint');

const context = canvas.getContext('2d');
if (!context) throw new Error('Canvas 2D desteği gerekli.');
const ctx: CanvasRenderingContext2D = context;

let state: GameState = 'menu';
let mode: Mode = 'cpu';
let difficulty: Difficulty = 'normal';
let muted = false;
let topScore = 0;
let bottomScore = 0;
let lastTime = performance.now();
let accumulator = 0;
let shake = 0;
let aiClock = 0;
let aiAim = WORLD_W / 2;
let aiShotError = 0;
let aiWasIncoming = false;
let audioContext: AudioContext | null = null;
let bottomPointer: number | null = null;
let topPointer: number | null = null;

const keys = new Set<string>();
const particles: Particle[] = [];
const trail: TrailPoint[] = [];

const paddleTop: Paddle = {
  x: WORLD_W / 2 - 82,
  y: 56,
  width: 164,
  height: 20,
  targetX: WORLD_W / 2,
  vx: 0,
};

const paddleBottom: Paddle = {
  x: WORLD_W / 2 - 82,
  y: WORLD_H - 76,
  width: 164,
  height: 20,
  targetX: WORLD_W / 2,
  vx: 0,
};

const ball: Ball = {
  x: WORLD_W / 2,
  y: WORLD_H / 2,
  vx: 0,
  vy: 0,
  radius: 11,
  speed: 570,
  active: false,
  serveTimer: .72,
};

const difficultyTuning = {
  easy: { maxSpeed: 360, reaction: .115, error: 78 },
  normal: { maxSpeed: 500, reaction: .075, error: 38 },
  hard: { maxSpeed: 625, reaction: .045, error: 15 },
} satisfies Record<Difficulty, { maxSpeed: number; reaction: number; error: number }>;

function layoutPaddles(): void {
  const topInset = clamp(WORLD_H * .115, 108, 148);
  const bottomInset = clamp(WORLD_H * .085, 84, 116);
  paddleTop.y = topInset;
  paddleBottom.y = WORLD_H - bottomInset - paddleBottom.height;
}

function resizeCanvas(): void {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const previousHeight = WORLD_H;
  const nextHeight = WORLD_W * (rect.height / rect.width);
  const scaleY = nextHeight / previousHeight;
  WORLD_H = nextHeight;

  if (state === 'playing' || state === 'paused') {
    ball.y *= scaleY;
  } else {
    ball.y = WORLD_H / 2;
  }

  layoutPaddles();

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(WORLD_W * dpr);
  canvas.height = Math.round(WORLD_H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function setOverlay(element: HTMLElement, visible: boolean): void {
  element.classList.toggle('overlay-visible', visible);
  element.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function syncHud(): void {
  topScoreEl.textContent = String(topScore);
  bottomScoreEl.textContent = String(bottomScore);
  topLabelEl.textContent = mode === 'cpu' ? 'CPU' : 'ÜST';
  bottomLabelEl.textContent = mode === 'cpu' ? 'SEN' : 'ALT';
}

function centerPaddles(): void {
  paddleTop.x = WORLD_W / 2 - paddleTop.width / 2;
  paddleBottom.x = WORLD_W / 2 - paddleBottom.width / 2;
  paddleTop.targetX = WORLD_W / 2;
  paddleBottom.targetX = WORLD_W / 2;
  paddleTop.vx = 0;
  paddleBottom.vx = 0;
  layoutPaddles();
}

function resetBall(direction?: 'top' | 'bottom'): void {
  ball.x = WORLD_W / 2;
  ball.y = WORLD_H / 2;
  ball.vx = 0;
  ball.vy = 0;
  ball.speed = 570;
  ball.active = false;
  ball.serveTimer = .68;
  trail.length = 0;

  const towardTop = direction ? direction === 'top' : Math.random() < .5;
  const angle = (Math.random() * .44 - .22) * Math.PI;
  ball.vx = Math.sin(angle) * ball.speed;
  ball.vy = Math.cos(angle) * ball.speed * (towardTop ? -1 : 1);
}

function startMatch(): void {
  unlockAudio();
  topScore = 0;
  bottomScore = 0;
  syncHud();
  centerPaddles();
  resetBall();
  particles.length = 0;
  state = 'playing';
  setOverlay(menu, false);
  setOverlay(pauseOverlay, false);
  setOverlay(resultOverlay, false);
}

function showMenu(): void {
  state = 'menu';
  topScore = 0;
  bottomScore = 0;
  syncHud();
  centerPaddles();
  resetBall();
  setOverlay(menu, true);
  setOverlay(pauseOverlay, false);
  setOverlay(resultOverlay, false);
}

function togglePause(force?: boolean): void {
  if (state !== 'playing' && state !== 'paused') return;
  const shouldPause = force ?? state === 'playing';
  state = shouldPause ? 'paused' : 'playing';
  setOverlay(pauseOverlay, shouldPause);
}

function finishMatch(): void {
  state = 'gameover';
  const bottomWon = bottomScore > topScore;
  resultTitle.textContent = bottomWon
    ? mode === 'cpu' ? 'Kazandın' : 'Alt oyuncu kazandı'
    : mode === 'cpu' ? 'CPU kazandı' : 'Üst oyuncu kazandı';
  resultScore.textContent = `${bottomScore} — ${topScore}`;
  setOverlay(resultOverlay, true);
  tone(bottomWon ? 740 : 180, .18, 'triangle', .055);
}

function scorePoint(side: 'top' | 'bottom'): void {
  if (side === 'top') topScore += 1;
  else bottomScore += 1;
  syncHud();
  shake = 10;
  burst(WORLD_W / 2, side === 'top' ? WORLD_H * .7 : WORLD_H * .3, 24, 1.25);
  tone(side === 'bottom' ? 520 : 150, .12, 'sine', .06);

  if (topScore >= WIN_SCORE || bottomScore >= WIN_SCORE) {
    finishMatch();
    return;
  }

  resetBall(side === 'top' ? 'bottom' : 'top');
}

function movePaddle(
  paddle: Paddle,
  targetCenter: number,
  maxSpeed: number,
  dt: number,
  response = 12,
): void {
  const minCenter = 22 + paddle.width / 2;
  const maxCenter = WORLD_W - 22 - paddle.width / 2;
  const safeTarget = clamp(targetCenter, minCenter, maxCenter);
  const currentCenter = paddle.x + paddle.width / 2;
  const delta = safeTarget - currentCenter;
  const desired = clamp(delta * response, -maxSpeed, maxSpeed);
  const previousX = paddle.x;
  paddle.x += desired * dt;
  paddle.x = clamp(paddle.x, 22, WORLD_W - 22 - paddle.width);
  paddle.vx = (paddle.x - previousX) / Math.max(dt, .0001);
}

function updateHumanControls(dt: number): void {
  const keyboardSpeed = 690;
  let bottomAxis = 0;
  if (keys.has('a') || keys.has('A')) bottomAxis -= 1;
  if (keys.has('d') || keys.has('D')) bottomAxis += 1;
  if (bottomAxis !== 0) {
    paddleBottom.targetX = clamp(
      paddleBottom.targetX + bottomAxis * keyboardSpeed * dt,
      22 + paddleBottom.width / 2,
      WORLD_W - 22 - paddleBottom.width / 2,
    );
  }

  if (mode === 'local') {
    let topAxis = 0;
    if (keys.has('ArrowLeft')) topAxis -= 1;
    if (keys.has('ArrowRight')) topAxis += 1;
    if (topAxis !== 0) {
      paddleTop.targetX = clamp(
        paddleTop.targetX + topAxis * keyboardSpeed * dt,
        22 + paddleTop.width / 2,
        WORLD_W - 22 - paddleTop.width / 2,
      );
    }
  }

  movePaddle(paddleBottom, paddleBottom.targetX, 1800, dt, 22);
  if (mode === 'local') movePaddle(paddleTop, paddleTop.targetX, 1800, dt, 22);
}

function predictBallXAt(targetY: number): number {
  if (Math.abs(ball.vy) < .001) return WORLD_W / 2;
  const time = (targetY - ball.y) / ball.vy;
  if (time <= 0) return WORLD_W / 2;

  let projected = ball.x + ball.vx * time;
  const left = 22 + ball.radius;
  const right = WORLD_W - 22 - ball.radius;
  const span = right - left;
  if (span <= 0) return WORLD_W / 2;

  const period = span * 2;
  let wrapped = (projected - left) % period;
  if (wrapped < 0) wrapped += period;
  if (wrapped > span) wrapped = period - wrapped;
  projected = left + wrapped;
  return projected;
}

function updateAI(dt: number): void {
  const tuning = difficultyTuning[difficulty];
  const incoming = ball.active && ball.vy < 0;

  if (incoming && !aiWasIncoming) {
    aiShotError = (Math.random() * 2 - 1) * tuning.error;
  }
  aiWasIncoming = incoming;
  aiClock -= dt;

  if (aiClock <= 0) {
    aiClock = tuning.reaction;
    const predicted = incoming ? predictBallXAt(paddleTop.y + paddleTop.height) : WORLD_W / 2;
    aiAim = clamp(
      predicted + (incoming ? aiShotError : 0),
      22 + paddleTop.width / 2,
      WORLD_W - 22 - paddleTop.width / 2,
    );
  }

  movePaddle(paddleTop, aiAim, tuning.maxSpeed, dt);
}

function paddleCollision(paddle: Paddle, fromTop: boolean): boolean {
  const left = paddle.x - ball.radius;
  const right = paddle.x + paddle.width + ball.radius;
  const centerY = paddle.y + paddle.height / 2;
  const verticalDistance = Math.abs(ball.y - centerY);

  if (ball.x < left || ball.x > right || verticalDistance > paddle.height / 2 + ball.radius) return false;

  if (fromTop && ball.vy <= 0) return false;
  if (!fromTop && ball.vy >= 0) return false;

  const paddleCenter = paddle.x + paddle.width / 2;
  const offset = clamp((ball.x - paddleCenter) / (paddle.width / 2), -1, 1);
  const maxAngle = 62 * Math.PI / 180;
  const angle = offset * maxAngle;

  ball.speed = Math.min(ball.speed * 1.035 + 7, 1030);
  const maxHorizontal = Math.sin(maxAngle) * ball.speed;
  const influencedVx = Math.sin(angle) * ball.speed + paddle.vx * .15;
  ball.vx = clamp(influencedVx, -maxHorizontal, maxHorizontal);
  const verticalSpeed = Math.sqrt(Math.max(0, ball.speed * ball.speed - ball.vx * ball.vx));
  ball.vy = verticalSpeed * (fromTop ? -1 : 1);
  ball.y = fromTop
    ? paddle.y - ball.radius - .5
    : paddle.y + paddle.height + ball.radius + .5;

  shake = Math.min(8, 3 + ball.speed / 230);
  burst(ball.x, ball.y, 12, .8);
  tone(220 + Math.abs(offset) * 220 + ball.speed * .18, .045, 'square', .025);
  return true;
}

function updateBall(dt: number): void {
  if (!ball.active) {
    ball.serveTimer -= dt;
    if (ball.serveTimer <= 0) {
      ball.active = true;
      tone(430, .04, 'sine', .025);
    }
    return;
  }

  const speed = Math.hypot(ball.vx, ball.vy);
  const steps = Math.max(1, Math.ceil((speed * dt) / 10));
  const subDt = dt / steps;

  for (let i = 0; i < steps; i += 1) {
    ball.x += ball.vx * subDt;
    ball.y += ball.vy * subDt;

    if (ball.x - ball.radius <= 22 && ball.vx < 0) {
      ball.x = 22 + ball.radius;
      ball.vx = Math.abs(ball.vx);
      tone(150, .025, 'sine', .012);
    } else if (ball.x + ball.radius >= WORLD_W - 22 && ball.vx > 0) {
      ball.x = WORLD_W - 22 - ball.radius;
      ball.vx = -Math.abs(ball.vx);
      tone(150, .025, 'sine', .012);
    }

    if (ball.vy > 0) paddleCollision(paddleBottom, true);
    else paddleCollision(paddleTop, false);

    if (ball.y < -42) {
      scorePoint('bottom');
      return;
    }

    if (ball.y > WORLD_H + 42) {
      scorePoint('top');
      return;
    }
  }

  if (trail.length === 0 || Math.hypot(ball.x - trail[0].x, ball.y - trail[0].y) > 8) {
    trail.unshift({ x: ball.x, y: ball.y, life: 1 });
    if (trail.length > 18) trail.pop();
  }
}

function updateEffects(dt: number): void {
  for (const point of trail) point.life -= dt * 3.6;
  while (trail.length && trail[trail.length - 1].life <= 0) trail.pop();

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(.12, dt);
    p.vy *= Math.pow(.12, dt);
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  shake = Math.max(0, shake - dt * 24);
}

function update(dt: number): void {
  if (state !== 'playing') return;
  updateHumanControls(dt);
  if (mode === 'cpu') updateAI(dt);
  updateBall(dt);
  updateEffects(dt);
}

function roundedRect(x: number, y: number, w: number, h: number, radius: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function drawArena(): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  gradient.addColorStop(0, '#07151f');
  gradient.addColorStop(.5, '#061019');
  gradient.addColorStop(1, '#07131b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  const glow = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, 80, WORLD_W / 2, WORLD_H / 2, 560);
  glow.addColorStop(0, 'rgba(50, 195, 225, .10)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.strokeStyle = 'rgba(196, 235, 246, .09)';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 18]);
  ctx.beginPath();
  ctx.moveTo(40, WORLD_H / 2);
  ctx.lineTo(WORLD_W - 40, WORLD_H / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(151, 220, 238, .08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(WORLD_W / 2, WORLD_H / 2, 92, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(125, 219, 240, .12)';
  ctx.lineWidth = 2;
  roundedRect(22, 22, WORLD_W - 44, WORLD_H - 44, 24);
  ctx.stroke();
}

function drawPaddle(paddle: Paddle, isBottom: boolean): void {
  const alpha = state === 'menu' ? .72 : 1;
  const color = isBottom ? '105, 236, 255' : mode === 'cpu' ? '190, 255, 112' : '255, 171, 100';

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = 28;
  ctx.shadowColor = `rgba(${color}, .48)`;
  ctx.fillStyle = `rgba(${color}, .94)`;
  roundedRect(paddle.x, paddle.y, paddle.width, paddle.height, 10);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.58)';
  roundedRect(paddle.x + 14, paddle.y + 4, paddle.width - 28, 3, 2);
  ctx.fill();
  ctx.restore();
}

function drawBall(): void {
  for (let i = trail.length - 1; i >= 0; i -= 1) {
    const point = trail[i];
    ctx.globalAlpha = Math.max(0, point.life) * .25;
    ctx.fillStyle = '#83f1ff';
    ctx.beginPath();
    ctx.arc(point.x, point.y, ball.radius * (.35 + point.life * .5), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.save();
  ctx.shadowBlur = 30;
  ctx.shadowColor = 'rgba(120, 239, 255, .75)';
  ctx.fillStyle = '#f5fdff';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (!ball.active && state === 'playing') {
    const t = clamp(ball.serveTimer / .68, 0, 1);
    ctx.strokeStyle = `rgba(120, 239, 255, ${.2 + (1 - t) * .5})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 28 + t * 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - t));
    ctx.stroke();
  }
}

function drawParticles(): void {
  for (const p of particles) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#9ef4ff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function draw(): void {
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);
  ctx.save();

  if (shake > .1 && state === 'playing') {
    ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  }

  drawArena();
  drawParticles();
  drawPaddle(paddleTop, false);
  drawPaddle(paddleBottom, true);
  drawBall();

  ctx.restore();
}

function frame(now: number): void {
  const frameDt = Math.min((now - lastTime) / 1000, .05);
  lastTime = now;
  accumulator += frameDt;

  while (accumulator >= FIXED_STEP) {
    update(FIXED_STEP);
    accumulator -= FIXED_STEP;
  }

  draw();
  requestAnimationFrame(frame);
}

function pointerToWorldX(event: PointerEvent): number {
  const rect = canvas.getBoundingClientRect();
  return ((event.clientX - rect.left) / rect.width) * WORLD_W;
}

function setPointerTarget(event: PointerEvent): void {
  const x = clamp(pointerToWorldX(event), 0, WORLD_W);
  const rect = canvas.getBoundingClientRect();
  const normalizedY = (event.clientY - rect.top) / rect.height;

  if (mode === 'cpu') {
    bottomPointer = event.pointerId;
    paddleBottom.targetX = clamp(
      x,
      22 + paddleBottom.width / 2,
      WORLD_W - 22 - paddleBottom.width / 2,
    );
    return;
  }

  if (normalizedY < .5) {
    if (topPointer === null || topPointer === event.pointerId) {
      topPointer = event.pointerId;
      paddleTop.targetX = clamp(
        x,
        22 + paddleTop.width / 2,
        WORLD_W - 22 - paddleTop.width / 2,
      );
    }
  } else if (bottomPointer === null || bottomPointer === event.pointerId) {
    bottomPointer = event.pointerId;
    paddleBottom.targetX = clamp(
      x,
      22 + paddleBottom.width / 2,
      WORLD_W - 22 - paddleBottom.width / 2,
    );
  }
}

function burst(x: number, y: number, amount: number, energy: number): void {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (80 + Math.random() * 260) * energy;
    const life = .18 + Math.random() * .3;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      size: 2 + Math.random() * 4,
    });
  }

  if (particles.length > 100) particles.splice(0, particles.length - 100);
}

function unlockAudio(): void {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === 'suspended') void audioContext.resume();
}

function tone(frequency: number, duration: number, type: OscillatorType, volume: number): void {
  if (muted || !audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

canvas.addEventListener('pointerdown', (event) => {
  if (state !== 'playing') return;
  canvas.setPointerCapture(event.pointerId);
  setPointerTarget(event);
});

canvas.addEventListener('pointermove', (event) => {
  if (state !== 'playing') return;
  if (mode === 'cpu') {
    if (bottomPointer === event.pointerId) {
      paddleBottom.targetX = clamp(
        pointerToWorldX(event),
        22 + paddleBottom.width / 2,
        WORLD_W - 22 - paddleBottom.width / 2,
      );
    }
    return;
  }
  if (topPointer === event.pointerId) {
    paddleTop.targetX = clamp(
      pointerToWorldX(event),
      22 + paddleTop.width / 2,
      WORLD_W - 22 - paddleTop.width / 2,
    );
  }
  if (bottomPointer === event.pointerId) {
    paddleBottom.targetX = clamp(
      pointerToWorldX(event),
      22 + paddleBottom.width / 2,
      WORLD_W - 22 - paddleBottom.width / 2,
    );
  }
});

function releasePointer(event: PointerEvent): void {
  if (topPointer === event.pointerId) topPointer = null;
  if (bottomPointer === event.pointerId) bottomPointer = null;
}

canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);

window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
  keys.add(event.key);
  if (event.key === 'Escape' && (state === 'playing' || state === 'paused')) togglePause();
  if (event.key === ' ' && state === 'playing') togglePause(true);
}, { passive: false });

window.addEventListener('keyup', (event) => keys.delete(event.key));
window.addEventListener('blur', () => {
  keys.clear();
  if (state === 'playing') togglePause(true);
});
window.addEventListener('resize', resizeCanvas);

document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    mode = button.dataset.mode === 'local' ? 'local' : 'cpu';
    document.querySelectorAll('[data-mode]').forEach((item) => item.classList.toggle('active', item === button));
    difficultyGroup.style.display = mode === 'cpu' ? 'grid' : 'none';
    syncHud();
    controlHint.textContent = mode === 'cpu'
      ? 'Dokun/sürükle veya A–D ile alt raketi hareket ettir.'
      : 'Alt: dokun/sürükle veya A–D · Üst: dokun/sürükle veya ← →';
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach((button) => {
  button.addEventListener('click', () => {
    const value = button.dataset.difficulty;
    if (value === 'easy' || value === 'normal' || value === 'hard') difficulty = value;
    document.querySelectorAll('[data-difficulty]').forEach((item) => item.classList.toggle('active', item === button));
  });
});

startButton.addEventListener('click', startMatch);
pauseButton.addEventListener('click', () => togglePause(true));
resumeButton.addEventListener('click', () => togglePause(false));
quitButton.addEventListener('click', showMenu);
rematchButton.addEventListener('click', startMatch);
resultMenuButton.addEventListener('click', showMenu);

soundButton.addEventListener('click', () => {
  unlockAudio();
  muted = !muted;
  soundButton.textContent = muted ? '×' : '♪';
  soundButton.setAttribute('aria-label', muted ? 'Sesi aç' : 'Sesi kapat');
  if (!muted) tone(440, .04, 'sine', .025);
});

resizeCanvas();
centerPaddles();
resetBall('top');
syncHud();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}

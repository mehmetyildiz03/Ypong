export type PlayerSide = 'top' | 'bottom';
export type PowerUpType = 'wide' | 'shrink' | 'slow';

export interface CirclePoint {
  x: number;
  y: number;
}

export interface Bumper extends CirclePoint {
  radius: number;
}

export interface PowerUpNode extends CirclePoint {
  type: PowerUpType;
  radius: number;
  life: number;
  maxLife: number;
  phase: number;
}

export interface SpawnContext {
  worldWidth: number;
  worldHeight: number;
  ball: CirclePoint;
  bumper: Bumper | null;
}

const POWER_TYPES: readonly PowerUpType[] = ['wide', 'shrink', 'slow'];

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function distance(a: CirclePoint, b: CirclePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function nextPowerSpawnDelay(): number {
  return randomRange(5.5, 8.5);
}

export function createBumper(worldWidth: number, worldHeight: number): Bumper {
  const radius = 31;
  const center = { x: worldWidth / 2, y: worldHeight / 2 };
  const verticalSpread = Math.min(190, worldHeight * .13);

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = {
      x: randomRange(150, worldWidth - 150),
      y: center.y + randomRange(-verticalSpread, verticalSpread),
    };

    if (distance(candidate, center) < 125) continue;
    return { ...candidate, radius };
  }

  return {
    x: worldWidth / 2 + 150,
    y: center.y,
    radius,
  };
}

export function createPowerUpNode(context: SpawnContext): PowerUpNode | null {
  const radius = 24;
  const minX = 92;
  const maxX = context.worldWidth - 92;
  const minY = context.worldHeight * .29;
  const maxY = context.worldHeight * .71;

  for (let attempt = 0; attempt < 36; attempt += 1) {
    const candidate = {
      x: randomRange(minX, maxX),
      y: randomRange(minY, maxY),
    };

    if (distance(candidate, context.ball) < 105) continue;
    if (context.bumper && distance(candidate, context.bumper) < context.bumper.radius + radius + 68) continue;

    const type = POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)] ?? 'wide';
    const maxLife = 5.4;
    return {
      ...candidate,
      type,
      radius,
      life: maxLife,
      maxLife,
      phase: Math.random() * Math.PI * 2,
    };
  }

  return null;
}

export function circlesOverlap(
  a: CirclePoint,
  aRadius: number,
  b: CirclePoint,
  bRadius: number,
): boolean {
  const radius = aRadius + bRadius;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy <= radius * radius;
}

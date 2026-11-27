const width = 320;
const height = 218;
const trayScale = 0.88;
const trayTopOffset = 12;
const radius = 44;
const trayRim = [[54, 63], [266, 63], [312, 168], [8, 168]];
const feltOutline = [[60, 78], [260, 78], [290, 154], [30, 154]];
const idleFaces = [20, 11];
const noTurns = [0, 0, 0];
const golden = (1 + Math.sqrt(5)) / 2;
const cameraTilt = Math.PI * 0.22;
const cameraUp = [0, Math.cos(cameraTilt), -Math.sin(cameraTilt)];
const eye = [0, Math.sin(cameraTilt), Math.cos(cameraTilt)];

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = vector => {
  const size = Math.hypot(...vector);
  return vector.map(value => value / size);
};
const litFrom = unit([-0.48, 0.85, 0.28]);
const scale = (vector, amount) => vector.map(value => value * amount);
const subtract = (a, b) => a.map((value, axis) => value - b[axis]);
const lerp = (start, end, t) => start + (end - start) * t;

const points = [
  [-1, golden, 0], [1, golden, 0], [-1, -golden, 0], [1, -golden, 0],
  [0, -1, golden], [0, 1, golden], [0, -1, -golden], [0, 1, -golden],
  [golden, 0, -1], [golden, 0, 1], [-golden, 0, -1], [-golden, 0, 1],
].map(point => scale(unit(point), radius));

const faces = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
].map(indices => {
  const center = points[indices[0]].map((_, axis) =>
    indices.reduce((sum, i) => sum + points[i][axis], 0) / 3);
  const normal = unit(center);
  const up = unit(subtract(points[indices[0]], center));
  return {indices, center, normal, up, right: cross(up, normal), number: 0};
});

// Matching opposite faces lets the rolled value sit squarely on top.
const numbered = new Map();
let lowNumber = 1;
for (const face of faces) {
  if (face.number) continue;
  const opposite = faces.find(other => dot(face.normal, other.normal) < -0.9999);
  face.number = lowNumber++;
  opposite.number = 21 - face.number;
  numbered.set(face.number, face);
  numbered.set(opposite.number, opposite);
}

const throws = [
  {
    x: 109, ground: 118, yaw: -11, delay: 0,
    colors: {light: [160, 91, 63], dark: [60, 37, 40], edge: [236, 175, 116], number: '#fff1cd'},
    // Each interval ends in contact with the tray. The later hops carry less energy.
    landings: [406, 710, 931, 1091], heights: [56, 35, 17, 6],
    turns: [[520, 690, -310], [266, 372, -167], [105, 142, -61], [23, 33, -13], [0, 0, 0]],
    xOffsets: [0, -17, -7, 2, 0], zOffsets: [0, -7, 3, 1, 0],
  },
  {
    x: 212, ground: 114, yaw: 17, delay: 68,
    colors: {light: [90, 132, 117], dark: [41, 57, 59], edge: [223, 197, 125], number: '#fff3d2'},
    landings: [431, 755, 994], heights: [56, 37, 16],
    turns: [[-573, 607, 324], [-267, 305, 168], [-97, 107, 56], [0, 0, 0]],
    xOffsets: [0, 15, 5, 0], zOffsets: [0, -7, 1, 0],
  },
];

export const loanDiceTiming = {
  impacts: throws.flatMap(({delay, landings}, die) =>
    landings.map((at, index) => ({at: at + delay, die, strength: [1, 0.67, 0.46, 0.32][index]})))
    .sort((a, b) => a.at - b.at),
  settled: Math.max(...throws.map(({delay, landings}) => delay + landings.at(-1))) + 90,
};

function motion(die, elapsed) {
  const t = Math.max(0, elapsed - die.delay);
  const index = die.landings.findIndex(at => at > t);
  if (index === -1) return {lift: 0, x: 0, z: 0, turns: noTurns, release: 1};
  const start = die.landings[index - 1] || 0;
  const phase = (t - start) / (die.landings[index] - start);
  const travel = 1 - (1 - phase) ** 1.35;
  return {
    release: Math.min(t / 135, 1),
    lift: 4 * die.heights[index] * phase * (1 - phase),
    x: lerp(die.xOffsets[index], die.xOffsets[index + 1], travel),
    z: lerp(die.zOffsets[index], die.zOffsets[index + 1], travel),
    turns: die.turns[index].map((angle, axis) => lerp(angle, die.turns[index + 1][axis], travel)),
  };
}

function rotation(result, yaw, turns) {
  const {right, normal, up} = numbered.get(result);
  const angles = turns.map(angle => angle * Math.PI / 180);
  angles[1] += yaw * Math.PI / 180;
  const [sa, sb, sc] = angles.map(Math.sin);
  const [ca, cb, cc] = angles.map(Math.cos);
  return point => {
    const px = dot(point, right);
    const py = dot(point, normal);
    const pz = -dot(point, up);
    const y = py * ca - pz * sa;
    const zx = py * sa + pz * ca;
    const x = px * cb + zx * sb;
    return [x * cc - y * sc, x * sc + y * cc, -px * sb + zx * cb];
  };
}

// The dice leave their previous faces smoothly before following the animated roll.
function quaternion(rotate) {
  const [ax, ay, az] = rotate([1, 0, 0]);
  const [bx, by, bz] = rotate([0, 1, 0]);
  const [cx, cy, cz] = rotate([0, 0, 1]);
  const trace = ax + by + cz;
  if (trace > 0) {
    const size = Math.sqrt(1 + trace) * 2;
    return [(bz - cy) / size, (cx - az) / size, (ay - bx) / size, size / 4];
  }
  if (ax > by && ax > cz) {
    const size = Math.sqrt(1 + ax - by - cz) * 2;
    return [size / 4, (bx + ay) / size, (cx + az) / size, (bz - cy) / size];
  }
  if (by > cz) {
    const size = Math.sqrt(1 + by - ax - cz) * 2;
    return [(bx + ay) / size, size / 4, (cy + bz) / size, (cx - az) / size];
  }
  const size = Math.sqrt(1 + cz - ax - by) * 2;
  return [(cx + az) / size, (cy + bz) / size, size / 4, (ay - bx) / size];
}

function easeIntoRoll(from, to, release) {
  const start = quaternion(from), end = quaternion(to);
  const direction = start.reduce((sum, value, i) => sum + value * end[i], 0) < 0 ? -1 : 1;
  const [x, y, z, w] = unit(start.map((value, i) => lerp(value, direction * end[i], release)));
  return point => {
    const vector = [x, y, z];
    const first = cross(vector, point);
    const second = cross(vector, first);
    return point.map((value, i) => value + 2 * (w * first[i] + second[i]));
  };
}

function tracePolygon(ctx, vertices) {
  ctx.beginPath();
  ctx.moveTo(...vertices[0]);
  for (const point of vertices.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
}

function polygon(ctx, vertices, fill, stroke) {
  tracePolygon(ctx, vertices);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

// The betting grid shares the vanishing point of the tray rails.
function tableX(offset, y) {
  const [[backX, backY], , , [frontX, frontY]] = trayRim;
  const localY = (y - trayTopOffset) / trayScale;
  const left = lerp(backX, frontX, (localY - backY) / (frontY - backY));
  return width / 2 + offset * (width / 2 - left) * trayScale;
}

function drawChipStack(ctx, x, y, count, [top, side, trim]) {
  const height = count * 4;
  const rim = y - height;
  ctx.fillStyle = '#492b35';
  ctx.fillRect(x - 6, y, 16, 4);
  ctx.fillStyle = side;
  ctx.fillRect(x - 8, rim, 16, height);
  ctx.fillRect(x - 6, y, 12, 2);
  ctx.fillStyle = trim;
  for (let row = rim + 2; row < y; row += 4) {
    ctx.fillRect(x - 6, row, 2, 2);
    ctx.fillRect(x + 4, row, 2, 2);
  }
  ctx.fillStyle = top;
  ctx.fillRect(x - 8, rim - 2, 16, 4);
  ctx.fillRect(x - 6, rim - 4, 12, 8);
  ctx.fillStyle = trim;
  ctx.fillRect(x - 4, rim - 2, 8, 2);
}

function paintTable() {
  const image = document.createElement('canvas');
  image.width = width / 2;
  image.height = height / 2;
  const ctx = image.getContext('2d', {alpha: false});
  ctx.scale(0.5, 0.5);
  const felt = ctx.createLinearGradient(0, 0, 0, height);
  felt.addColorStop(0, '#824553');
  felt.addColorStop(1, '#703843');
  ctx.fillStyle = felt;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#edc1a31a';
  for (let y = 6; y < height; y += 8) {
    for (let x = 4 + y % 16; x < width; x += 12) ctx.fillRect(x, y, 2, 2);
  }

  const back = 18, front = 50, column = 0.32;
  ctx.beginPath();
  for (const y of [back, 34, front]) {
    ctx.moveTo(tableX(-3 * column, y), y);
    ctx.lineTo(tableX(3 * column, y), y);
  }
  for (let index = -3; index <= 3; index++) {
    const offset = index * column;
    ctx.moveTo(tableX(offset, back), back);
    ctx.lineTo(tableX(offset, front), front);
  }
  ctx.strokeStyle = '#b28862';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#b28862';
  for (let index = -2.5; index < 3; index++) {
    ctx.fillRect(Math.round(tableX(index * column, 26)) - 3, 24, 6, 4);
  }

  const rail = [[0, 153], [18, 182], [52, 205], [92, 218],
    [228, 218], [268, 205], [302, 182], [320, 153]];
  polygon(ctx, [...rail, [width, height], [0, height]], '#4d343b');
  ctx.beginPath();
  ctx.moveTo(...rail[0]);
  for (const point of rail.slice(1)) ctx.lineTo(...point);
  ctx.strokeStyle = '#5d4248';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.strokeStyle = '#b08767';
  ctx.lineWidth = 2;
  ctx.stroke();

  drawChipStack(ctx, 38, 39, 3, ['#7795a5', '#455f76', '#c4b8a4']);
  drawChipStack(ctx, 55, 52, 2, ['#c8b79b', '#8c7465', '#e8d5b2']);
  drawChipStack(ctx, 268, 41, 4, ['#bea267', '#8d6b44', '#e4c487']);
  drawChipStack(ctx, 286, 54, 3, ['#ae6f73', '#824851', '#dfb5a4']);

  ctx.translate(width * (1 - trayScale) / 2, trayTopOffset);
  ctx.scale(trayScale, trayScale);
  drawTray(ctx);
  return image;
}

function drawTray(ctx) {
  polygon(ctx, [[60, 65], [272, 65], [319, 179], [13, 179]], '#4126308c');
  polygon(ctx, trayRim, '#684b3a');
  polygon(ctx, [[54, 63], [58, 74], [26, 154], [8, 168]], '#826048');
  polygon(ctx, [[54, 63], [266, 63], [262, 74], [58, 74]], '#ad845c');
  polygon(ctx, [[58, 74], [262, 74], [294, 154], [26, 154]], '#344338');
  polygon(ctx, feltOutline, '#4b604a');
  polygon(ctx, [[60, 78], [260, 78], [264, 88], [56, 88]], '#415443');
  ctx.save();
  tracePolygon(ctx, feltOutline);
  ctx.clip();
  ctx.fillStyle = '#b7be8b37';
  for (let y = 88; y < 154; y += 6) {
    for (let x = 30 + (y % 12); x < 290; x += 8) {
      ctx.fillRect(x, y, 2.4, 2.4);
    }
  }
  ctx.restore();
  polygon(ctx, [[26, 154], [294, 154], [304, 164], [16, 164]], '#a67b55');
  polygon(ctx, [[16, 164], [304, 164], [312, 168], [8, 168]], '#c9986c');
  polygon(ctx, [[8, 168], [312, 168], [312, 175], [8, 175]], '#52392e');
  ctx.fillStyle = '#bd9064';
  for (const [x, y, length] of [[69, 66, 27], [195, 68, 39], [35, 157, 22], [78, 160, 40],
    [146, 157, 31], [189, 161, 18], [222, 157, 48], [271, 160, 13]]) {
    ctx.fillRect(x, y, length, 2);
  }
}

function shadow(ctx, x, ground, lift) {
  const spread = 1 + lift * 0.009;
  const alpha = Math.max(0.12, 0.48 - lift * 0.008);
  ctx.save();
  tracePolygon(ctx, feltOutline);
  ctx.clip();
  ctx.fillStyle = 'rgba(27, 34, 27, ' + alpha + ')';
  ctx.beginPath();
  ctx.ellipse(x + 4, ground + 1, 31 * spread, 9 * spread, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(27, 31, 23, ' + alpha * 0.58 + ')';
  ctx.beginPath();
  ctx.ellipse(x + 2, ground + 0.5, 24 * spread, 5.5 * spread, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const rgb = (a, b, t) => 'rgb(' + a.map((channel, axis) => Math.round(lerp(channel, b[axis], t))).join(' ') + ')';

function drawDie(ctx, die, result, elapsed, previous) {
  const {lift, x, z, turns, release} = motion(die, elapsed);
  const target = rotation(result, die.yaw, turns);
  const rotate = release < 1 ? easeIntoRoll(rotation(previous, die.yaw, noTurns), target, release) : target;
  const corners = points.map(rotate);
  const ground = die.ground + z;
  const centerY = ground - (lift - Math.min(...corners.map(point => point[1]))) * cameraUp[1];
  const centerX = die.x + x;
  const project = point => [centerX + point[0], centerY - dot(point, cameraUp)];
  shadow(ctx, centerX, ground, lift);

  for (const face of faces) {
    const normal = rotate(face.normal);
    if (dot(normal, eye) <= 0.002) continue;
    const surface = face.indices.map(i => project(corners[i]));
    const center = project(rotate(face.center));
    const facet = surface.map(point => point.map((value, axis) => lerp(center[axis], value, 0.91)));
    const illumination = Math.min(1, 0.27 + 0.73 * Math.max(0, dot(normal, litFrom)));
    const {dark, light, edge, number} = die.colors;
    ctx.lineWidth = 0.7;
    polygon(ctx, surface, rgb(dark, edge, illumination * 0.72), rgb(dark, light, 0.19));
    polygon(ctx, facet, rgb(dark, light, illumination), rgb(dark, light, illumination * 0.65));

    // Project both text axes onto the triangular face so the digits stay attached while spinning.
    const across = rotate(face.right), up = rotate(face.up);
    ctx.save();
    ctx.transform(across[0], -dot(across, cameraUp), -up[0], dot(up, cameraUp), ...center);
    ctx.font = '800 17px "Pretendard Variable", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = rgb(dark, light, 0.14);
    ctx.strokeText(String(face.number), 0, 3);
    ctx.fillStyle = number;
    ctx.fillText(String(face.number), 0, 3);
    if (face.number === 6 || face.number === 9) ctx.fillRect(-4, 12, 8, 1.1);
    ctx.restore();
  }
}

const encodedRoll = dice => Array.isArray(dice) && dice.length === 2 && dice.every(value => numbered.has(value))
  ? dice.join(',') : '';
const encodedTime = tossedAt => Number.isFinite(tossedAt) ? String(tossedAt) : '';

export function diceDisplay(dice,tossedAt){
  return {roll:encodedRoll(dice),time:encodedTime(tossedAt),width,height};
}

if (typeof customElements !== 'undefined') {
  let table;
  customElements.define('loan-dice-tray', class extends HTMLElement {
    static observedAttributes = ['data-roll', 'data-tossed-at'];

    connectedCallback() {
      this.context = this.querySelector('canvas')?.getContext('2d', {alpha: false});
      if (!this.context) return;
      table ??= paintTable();
      this.observer = new ResizeObserver(() => this.requestDraw());
      this.observer.observe(this);
      this.requestDraw();
    }

    disconnectedCallback() {
      this.observer?.disconnect();
      cancelAnimationFrame(this.frame);
      this.frame = undefined;
    }

    attributeChangedCallback() {
      this.requestDraw();
    }

    requestDraw() {
      if (!this.isConnected || !this.context || this.frame) return;
      this.frame = requestAnimationFrame(now => {
        this.frame = undefined;
        this.draw(now);
      });
    }

    draw(now) {
      const rect = this.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const {context: ctx} = this;
      const density = Math.min(2, window.devicePixelRatio || 1);
      const backWidth = Math.round(rect.width * density), backHeight = Math.round(rect.height * density);
      if (ctx.canvas.width !== backWidth) ctx.canvas.width = backWidth;
      if (ctx.canvas.height !== backHeight) ctx.canvas.height = backHeight;
      ctx.setTransform(backWidth / width, 0, 0, backHeight / height, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(table, 0, 0, width, height);
      ctx.translate(width * (1 - trayScale) / 2, trayTopOffset);
      ctx.scale(trayScale, trayScale);

      const saved = this.dataset.roll.split(',').map(Number);
      const display = saved.length === 2 ? saved : idleFaces;
      const tossing = this.dataset.tossedAt !== '';
      const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const elapsed = tossing && !reduceMotion ? now - Number(this.dataset.tossedAt) : loanDiceTiming.settled;
      const previous = this.restingFaces || idleFaces;
      [1, 0].forEach(die => drawDie(ctx, throws[die], display[die], elapsed, previous[die]));
      if (!tossing) this.restingFaces = display;
      if (elapsed < loanDiceTiming.settled) this.requestDraw();
    }
  });
}

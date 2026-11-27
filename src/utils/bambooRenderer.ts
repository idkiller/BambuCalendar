import {
  CalendarTile,
  MonthIsland,
  ParticipantRecord,
  PlayerState,
  VoteRecord,
} from '../types/calendar';
import { formatDate, parseDate, WEEKDAYS } from './dateUtils';

export const TILE_W = 88;
export const TILE_H = 44;
export const TILE_DEPTH = 14;

export function gridToScreen(gx: number, gy: number): { x: number; y: number } {
  return {
    x: (gx - gy) * (TILE_W / 2),
    y: (gx + gy) * (TILE_H / 2),
  };
}

export function getGrowthStageLabel(count: number): string {
  if (count <= 0) return '빈 흙';
  if (count === 1) return '작은 죽순 (1/3)';
  if (count === 2) return '자라는 죽순 (2/3)';
  if (count === 3) return '통통한 죽순 (3/3)';
  return `대나무 Lv.${count - 3}`;
}

export function buildCalendarWorld(
  startStr: string,
  endStr: string
): {
  monthIslands: MonthIsland[];
  allTiles: CalendarTile[];
  activeTiles: CalendarTile[];
} {
  const monthIslands: MonthIsland[] = [];
  const allTiles: CalendarTile[] = [];
  const activeTiles: CalendarTile[] = [];

  const startDt = parseDate(startStr);
  const endDt = parseDate(endStr);

  let curYear = startDt.getFullYear();
  let curMonth = startDt.getMonth();
  const endYear = endDt.getFullYear();
  const endMonth = endDt.getMonth();

  let currentOffset = 0;

  while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
    const firstDay = new Date(curYear, curMonth, 1);
    const lastDay = new Date(curYear, curMonth + 1, 0);
    const startWeekday = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const totalRows = Math.ceil((startWeekday + totalDays) / 7);

    const island: MonthIsland = {
      year: curYear,
      month: curMonth + 1,
      label: `${curYear}년 ${curMonth + 1}월`,
      offset: currentOffset,
      rows: totalRows,
      tiles: [],
    };

    for (let day = 1; day <= totalDays; day++) {
      const dt = new Date(curYear, curMonth, day);
      const dateStr = formatDate(dt);
      const cellIndex = startWeekday + (day - 1);
      const col = cellIndex % 7;
      const row = Math.floor(cellIndex / 7);

      const gx = currentOffset + col;
      const gy = currentOffset + row;
      const isActive = dt >= startDt && dt <= endDt;

      const tile: CalendarTile = {
        dateStr,
        day,
        weekday: dt.getDay(),
        col,
        row,
        gx,
        gy,
        isActive,
        monthIndex: monthIslands.length,
        activeIdx: -1,
        bounce: 0,
      };

      island.tiles.push(tile);
      allTiles.push(tile);

      if (isActive) {
        tile.activeIdx = activeTiles.length;
        activeTiles.push(tile);
      }
    }

    monthIslands.push(island);

    // Distinct spatial separation between monthly islands
    currentOffset += Math.ceil((totalRows + 9) / 2);

    curMonth++;
    if (curMonth > 11) {
      curMonth = 0;
      curYear++;
    }
  }

  // Painter's algorithm sort order
  allTiles.sort((a, b) => a.gx + a.gy - (b.gx + b.gy));

  return { monthIslands, allTiles, activeTiles };
}

function drawBambooLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: number,
  sway: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir * 0.45 + sway * 1.8);

  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.ellipse(dir * 9, -2, 10, 3, dir * -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.ellipse(dir * 7, 2, 8, 2.5, dir * 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawPlant(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
  time: number,
  seed = 0,
  scale = 1
) {
  if (count <= 0) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
  ctx.beginPath();
  ctx.ellipse(
    0,
    2,
    10 + Math.min(count, 8),
    4.5 + Math.min(count, 8) * 0.35,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  const sway = Math.sin(time * 2.2 + seed) * 0.04;

  if (count <= 3) {
    const heights = [0, 19, 30, 41];
    const widths = [0, 11, 16, 21];
    const h = heights[count];
    const w = widths[count];

    ctx.rotate(sway * 0.55);

    ctx.fillStyle = count === 3 ? '#84cc16' : '#a3e635';
    ctx.beginPath();
    ctx.moveTo(0, -h - 4);
    ctx.quadraticCurveTo(w * 0.45, -h * 0.3, w * 0.5, 0);
    ctx.lineTo(-w * 0.5, 0);
    ctx.quadraticCurveTo(-w * 0.45, -h * 0.3, 0, -h - 4);
    ctx.fill();

    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.moveTo(-w * 0.52, 0);
    ctx.quadraticCurveTo(-w * 0.25, -h * 0.58, w * 0.16, -h * 0.66);
    ctx.lineTo(w * 0.52, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(w * 0.52, 0);
    ctx.quadraticCurveTo(w * 0.2, -h * 0.45, -w * 0.22, -h * 0.46);
    ctx.lineTo(-w * 0.52, 0);
    ctx.closePath();
    ctx.fill();

    if (count >= 2) {
      ctx.fillStyle = '#4d7c0f';
      ctx.beginPath();
      ctx.ellipse(3.5, -h + 2, 4.2, 2, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (count === 3) {
      ctx.fillStyle = '#65a30d';
      ctx.beginPath();
      ctx.ellipse(-4.5, -h + 5, 5, 2.3, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const level = count - 3;
    const segments = Math.min(2 + level, 12);
    const segHeight = 14;
    const thickness = Math.min(7.5 + level * 0.75, 13.5);

    let curX = 0;
    let curY = 0;

    for (let i = 0; i < segments; i++) {
      const bend = sway * (i + 1) * 1.4;
      const nextX = curX + bend * 4;
      const nextY = curY - segHeight;
      const wBottom = thickness * (1 - i * 0.038);
      const wTop = thickness * (1 - (i + 1) * 0.038);

      ctx.fillStyle = i % 2 === 0 ? '#22c55e' : '#16a34a';
      ctx.beginPath();
      ctx.moveTo(curX - wBottom / 2, curY);
      ctx.lineTo(nextX - wTop / 2, nextY);
      ctx.lineTo(nextX + wTop / 2, nextY);
      ctx.lineTo(curX + wBottom / 2, curY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
      ctx.beginPath();
      ctx.moveTo(curX - wBottom * 0.35, curY);
      ctx.lineTo(nextX - wTop * 0.35, nextY);
      ctx.lineTo(nextX - wTop * 0.1, nextY);
      ctx.lineTo(curX - wBottom * 0.1, curY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(nextX - wTop / 2 - 1.5, nextY);
      ctx.lineTo(nextX + wTop / 2 + 1.5, nextY);
      ctx.stroke();

      if (i >= 1) {
        const dir = i % 2 === 0 ? 1 : -1;
        drawBambooLeaf(ctx, nextX + dir * (wTop / 2), nextY + 2, dir, sway);
        if (level >= 3 && i >= segments - 2) {
          drawBambooLeaf(ctx, nextX - dir * (wTop / 2), nextY + 2, -dir, sway);
        }
      }

      curX = nextX;
      curY = nextY;
    }

    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(curX, curY - 6, 2.5, 7.5, sway * 3, 0, Math.PI * 2);
    ctx.fill();

    if (count >= 7) {
      const sparkleY = curY * 0.65 + Math.sin(time * 3.8 + seed) * 5;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(curX + 10, sparkleY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

export function drawIsoTile(
  ctx: CanvasRenderingContext2D,
  tile: CalendarTile,
  votes: VoteRecord[],
  currentUserId: string | null,
  isCurrentPlayerTile: boolean,
  isHovered: boolean,
  time: number
) {
  const { x, y } = gridToScreen(tile.gx, tile.gy);
  const bounceOffset = tile.bounce > 0 ? Math.sin(tile.bounce * Math.PI) * 5 : 0;
  const drawY = y + bounceOffset;

  const hw = TILE_W / 2;
  const hh = TILE_H / 2;

  const count = votes.length;
  const iWatered = currentUserId ? votes.some((v) => v.userId === currentUserId) : false;

  let topColor: string;
  let leftColor: string;
  let rightColor: string;

  if (!tile.isActive) {
    topColor = '#e2e8e0';
    leftColor = '#cbd5c8';
    rightColor = '#b4c1b1';
  } else if (isCurrentPlayerTile) {
    topColor = '#bef264';
    leftColor = '#84cc16';
    rightColor = '#65a30d';
  } else if (iWatered) {
    topColor = '#bae6fd';
    leftColor = '#7dd3fc';
    rightColor = '#38bdf8';
  } else if (isHovered) {
    topColor = '#ecfccb';
    leftColor = '#a3e635';
    rightColor = '#84cc16';
  } else {
    topColor = '#dcfce7';
    leftColor = '#86efac';
    rightColor = '#4ade80';
  }

  ctx.fillStyle = leftColor;
  ctx.beginPath();
  ctx.moveTo(x - hw, drawY);
  ctx.lineTo(x, drawY + hh);
  ctx.lineTo(x, drawY + hh + TILE_DEPTH);
  ctx.lineTo(x - hw, drawY + TILE_DEPTH);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = rightColor;
  ctx.beginPath();
  ctx.moveTo(x + hw, drawY);
  ctx.lineTo(x, drawY + hh);
  ctx.lineTo(x, drawY + hh + TILE_DEPTH);
  ctx.lineTo(x + hw, drawY + TILE_DEPTH);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.moveTo(x, drawY - hh);
  ctx.lineTo(x + hw, drawY);
  ctx.lineTo(x, drawY + hh);
  ctx.lineTo(x - hw, drawY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = isCurrentPlayerTile
    ? '#15803d'
    : isHovered
      ? '#4d7c0f'
      : 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = isCurrentPlayerTile ? 2.4 : 1;
  ctx.stroke();

  if (tile.isActive) {
    ctx.fillStyle = count > 0 ? '#8d6e63' : '#cbb7ab';
    ctx.beginPath();
    ctx.ellipse(x, drawY, 17, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.font = tile.isActive
    ? '700 12px "JetBrains Mono", monospace'
    : '500 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (!tile.isActive) {
    ctx.fillStyle = '#8b9888';
  } else if (tile.weekday === 0) {
    ctx.fillStyle = '#be123c';
  } else if (tile.weekday === 6) {
    ctx.fillStyle = '#0369a1';
  } else {
    ctx.fillStyle = '#18231c';
  }
  ctx.fillText(String(tile.day), x - 17, drawY + 6);

  if (tile.isActive && iWatered) {
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(x + 21, drawY - 1);
    ctx.quadraticCurveTo(x + 25, drawY + 4, x + 21, drawY + 7);
    ctx.quadraticCurveTo(x + 17, drawY + 4, x + 21, drawY - 1);
    ctx.fill();
  }
  ctx.restore();

  if (tile.isActive && count > 0) {
    drawPlant(ctx, x, drawY - 1, count, time, tile.day * 1.7, 1);
  }
}

export function drawMonthHeaders(ctx: CanvasRenderingContext2D, monthIslands: MonthIsland[]) {
  monthIslands.forEach((island) => {
    const topPos = gridToScreen(island.offset, island.offset);
    const labelX = topPos.x;
    const labelY = topPos.y - 54;

    ctx.save();
    const text = island.label;
    ctx.font = '700 14px "Outfit", sans-serif';
    const w = ctx.measureText(text).width + 32;
    const h = 30;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(labelX - w / 2, labelY - h / 2, w, h, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#14532d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, labelX, labelY + 1);

    ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
    for (let c = 0; c < 7; c++) {
      const p = gridToScreen(island.offset + c, island.offset - 0.88);
      ctx.fillStyle = c === 0 ? '#be123c' : c === 6 ? '#0369a1' : '#4b5b50';
      ctx.fillText(WEEKDAYS[c], p.x, p.y);
    }
    ctx.restore();
  });
}

// ==========================================
// Kawaii Chibi Panda Head (Happy vs Crying)
// ==========================================
const INK = '#0f172a';

function drawPawFoot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot = 0
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  // Outer solid black oval foot
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Filled white main paw pad (matches reference illustration)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, ry * 0.2, rx * 0.48, ry * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Three tiny white toe dots above the main pad
  const beanR = Math.max(0.85, rx * 0.13);
  ctx.beginPath();
  ctx.arc(-rx * 0.42, -ry * 0.34, beanR, 0, Math.PI * 2);
  ctx.arc(0, -ry * 0.48, beanR, 0, Math.PI * 2);
  ctx.arc(rx * 0.42, -ry * 0.34, beanR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawShoulderLeaves(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);

  ctx.strokeStyle = '#14532d';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(7, -8);
  ctx.stroke();

  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.ellipse(6.5, -9, 3.6, 1.3, -0.75, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(8.5, -4.5, 3.5, 1.25, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(3.5, -5.5, 3.2, 1.2, -1.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPandaHead(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  happy: boolean,
  facing: number,
  time: number,
  seed: number,
  tilt = -0.04
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);

  // Solid round black ears (matches reference illustration)
  const earX = r * 0.76;
  const earY = -r * 0.68;
  const earR = r * 0.34;

  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(-earX, earY, earR, 0, Math.PI * 2);
  ctx.arc(earX, earY, earR, 0, Math.PI * 2);
  ctx.fill();

  // Clean round white head with bold ink outline
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.8, r * 0.13);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.12, r * 0.94, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const lookX = facing * r * 0.08;

  // Tilted solid dark oval eye patches
  ctx.fillStyle = INK;
  ctx.save();
  ctx.translate(-r * 0.42 + lookX, r * 0.02);
  ctx.rotate(-0.34);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.27, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(r * 0.42 + lookX, r * 0.02);
  ctx.rotate(0.34);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.27, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Single crisp small white catchlight dot per eye (no large round ring!)
  const dotR = Math.max(1.1, r * 0.085);
  const dotLX = -r * 0.36 + lookX;
  const dotRX = r * 0.36 + lookX;
  const dotY = -r * 0.05;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(dotLX, dotY, dotR, 0, Math.PI * 2);
  ctx.arc(dotRX, dotY, dotR, 0, Math.PI * 2);
  ctx.fill();

  // Cute rounded inverted-triangle nose
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(-r * 0.12 + lookX, r * 0.16);
  ctx.quadraticCurveTo(lookX, r * 0.13, r * 0.12 + lookX, r * 0.16);
  ctx.quadraticCurveTo(r * 0.11 + lookX, r * 0.26, lookX, r * 0.3);
  ctx.quadraticCurveTo(-r * 0.11 + lookX, r * 0.26, -r * 0.12 + lookX, r * 0.16);
  ctx.fill();

  if (happy) {
    // Short stem + sweet :3 / w smile (matches reference illustration)
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.3, r * 0.095);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lookX, r * 0.28);
    ctx.lineTo(lookX, r * 0.38);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-r * 0.085 + lookX, r * 0.38, r * 0.085, 0.1, Math.PI - 0.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.085 + lookX, r * 0.38, r * 0.085, 0.05, Math.PI - 0.1);
    ctx.stroke();
  } else {
    // Sad / crying expression (울상): sad slanted brows, teary eye pools, clear animated teardrops, pout
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.4, r * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.64 + lookX, -r * 0.34);
    ctx.lineTo(-r * 0.26 + lookX, -r * 0.44);
    ctx.moveTo(r * 0.64 + lookX, -r * 0.34);
    ctx.lineTo(r * 0.26 + lookX, -r * 0.44);
    ctx.stroke();

    // Welling blue tears along the lower edge of both eye patches
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(-r * 0.42 + lookX, r * 0.26, r * 0.2, r * 0.09, -0.2, 0, Math.PI * 2);
    ctx.ellipse(r * 0.42 + lookX, r * 0.26, r * 0.2, r * 0.09, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Animated falling teardrops down each cheek
    const tearPhase = (time * 1.9 + seed) % 1;
    const tearY = r * 0.34 + tearPhase * (r * 0.34);
    const tearR = Math.max(1.7, r * 0.145);

    for (const side of [-1, 1]) {
      const tx = side * r * 0.46 + lookX;
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = Math.max(0.8, r * 0.055);
      ctx.beginPath();
      ctx.moveTo(tx, tearY - tearR * 1.3);
      ctx.quadraticCurveTo(tx + tearR * 1.15, tearY + tearR * 0.1, tx, tearY + tearR * 0.9);
      ctx.quadraticCurveTo(tx - tearR * 1.15, tearY + tearR * 0.1, tx, tearY - tearR * 1.3);
      ctx.fill();
      ctx.stroke();

      // Tiny white shine on droplet
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(tx - tearR * 0.25, tearY + tearR * 0.1, Math.max(0.6, tearR * 0.28), 0, Math.PI * 2);
      ctx.fill();
    }

    // Sad frown mouth
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.4, r * 0.1);
    ctx.beginPath();
    ctx.arc(lookX, r * 0.54, r * 0.16, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }

  ctx.restore();
}

// ==========================================
// Active Controllable Chibi Panda Player
// ==========================================
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  time: number,
  hasVoted = true
) {
  const pos = gridToScreen(player.gx, player.gy);
  const jumpArc = Math.sin(player.jumpProgress * Math.PI) * player.jumpHeight;
  const px = pos.x;
  const py = pos.y - jumpArc;

  const shadowScale = Math.max(0.4, 1 - jumpArc / 95);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + 4, 15 * shadowScale, 7 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(px, py);

  const idleBob = player.jumpProgress >= 1 ? Math.sin(time * 4.2) * 1.3 : 0;
  ctx.translate(0, idleBob);

  if (player.jumpProgress < 1) {
    const stretch = 1 + Math.sin(player.jumpProgress * Math.PI) * 0.12;
    ctx.scale(1 / Math.sqrt(stretch), stretch);
  }

  // Cute bamboo leaf sprigs peeking behind shoulders (matches reference)
  drawShoulderLeaves(ctx, -9, -13, -1);
  drawShoulderLeaves(ctx, 9, -13, 1);

  // Chubby white belly with crisp ink outline
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -10.5, 11.2, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Black shoulder band & curved inward hugging arms (matches reference)
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(0, -16.5, 9.8, 3.8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(-6.8, -12, 4.4, 6.2, -0.78, 0, Math.PI * 2);
  ctx.ellipse(6.8, -12, 4.4, 6.2, 0.78, 0, Math.PI * 2);
  ctx.fill();

  // Oval tilted feet with filled white pad & 3 toe dots
  drawPawFoot(ctx, -9.8, -2.5, 4.6, 5.6, -0.35);
  drawPawFoot(ctx, 9.8, -2.5, 4.6, 5.6, 0.35);

  // Tiny blue watering can beside paw
  ctx.fillStyle = '#0284c7';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(player.facing * 12.5 - 3.5, -13, 7, 6, 1.5);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#0369a1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(player.facing * 15.5, -11);
  ctx.lineTo(player.facing * 19, -14.5);
  ctx.stroke();

  // Oversized cute panda head
  const tilt = player.jumpProgress < 1 ? player.facing * 0.08 : -0.03;
  drawPandaHead(ctx, 0, -28.5, 13.5, hasVoted, player.facing, time, 0, tilt);

  ctx.restore();
}

// ==========================================
// Lounging Participant Pandas Beside Calendar
// (Balanced mix of lying, sitting, and belly-down poses, all distinct from watering panda)
// ==========================================
export interface PandaRemoveButtonHit {
  userId: string;
  nickname: string;
  wx: number;
  wy: number;
  radius: number;
}

function drawSingleLoungingPanda(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  poseIndex: number,
  happy: boolean,
  userId: string,
  nickname: string,
  isMe: boolean,
  isDone: boolean,
  time: number,
  seed: number,
  showRemoveButton = false,
  removeHitsOut?: PandaRemoveButtonHit[],
  isRemoveHovered = false
) {
  ctx.save();
  ctx.translate(x, y);

  // Soft mossy resting spot underneath each lounging panda
  ctx.fillStyle = isMe ? 'rgba(134, 239, 172, 0.55)' : 'rgba(187, 247, 208, 0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 26, 11.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const sway = Math.sin(time * 2.2 + seed) * 1.1;
  const pose = Math.abs(poseIndex) % 6;

  if (pose === 0) {
    // Pose 0 (엎드려 있기): Flat belly-down sploot facing right
    drawPawFoot(ctx, -16, 0.5, 4.1, 4.8, -0.5);
    drawPawFoot(ctx, -14, -4, 3.8, 4.5, -0.35);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(-2, -3, 14, 7.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(5.5, -4, 4.2, 5.2, 0.5, 0, Math.PI * 2);
    ctx.ellipse(12.5, 2, 4.6, 2.7, 0.08, 0, Math.PI * 2);
    ctx.fill();

    drawPandaHead(ctx, 10.5, -13.5 + sway * 0.35, 11, happy, 0.35, time, seed, 0.07);
  } else if (pose === 1) {
    // Pose 1 (앉아있기): Sitting upright hugging a tall green bamboo stalk
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.ellipse(-3, -7.5, 10.2, 8.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Tall bamboo stalk beside the sitting panda
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(9, 2.5);
    ctx.lineTo(13, -29);
    ctx.stroke();

    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(8, -11);
    ctx.lineTo(13.5, -11);
    ctx.moveTo(9.5, -21);
    ctx.lineTo(14.5, -21);
    ctx.stroke();

    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(17.5, -25, 5.2, 2, -0.45, 0, Math.PI * 2);
    ctx.ellipse(18, -18, 4.4, 1.7, 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Feet tucked forward on ground
    drawPawFoot(ctx, -10.5, -1, 4.2, 4.9, -0.25);
    drawPawFoot(ctx, 4.5, -1, 4.2, 4.9, 0.25);

    // Both black arms hugging the bamboo stalk
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(2, -12.5, 6.2, 3.2, -0.15, 0, Math.PI * 2);
    ctx.ellipse(5, -7.5, 5.2, 2.8, 0.1, 0, Math.PI * 2);
    ctx.fill();

    drawPandaHead(ctx, -2.5, -24 + sway * 0.35, 11.4, happy, 0.3, time, seed, 0.08);
  } else if (pose === 2) {
    // Pose 2 (누워있기): Back-lying belly-up sprawl
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, -3.5, 14, 7.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Legs kicked casually in the air
    drawPawFoot(ctx, 10.5, -9.5 + sway * 0.35, 4, 4.7, -0.25);
    drawPawFoot(ctx, 14, -2.5 + sway * 0.35, 4, 4.7, 0.25);

    // Flopped arm resting on belly
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(-2.5, -9.5, 3.6, 4.6, 0.35, 0, Math.PI * 2);
    ctx.fill();

    drawPandaHead(ctx, -10.5, -13.5, 11, happy, -0.15, time, seed, -0.16);
  } else if (pose === 3) {
    // Pose 3 (엎드려 있기): Tummy sprawl facing left with bamboo leaf & propped chin
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-18, 3);
    ctx.lineTo(-4, -3);
    ctx.stroke();
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(-16, -0.5, 4.2, 1.8, -0.45, 0, Math.PI * 2);
    ctx.fill();

    drawPawFoot(ctx, 15.5, -4 + sway * 0.4, 3.8, 4.5, 0.45);
    drawPawFoot(ctx, 14, 1, 4, 4.6, 0.25);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(2, -3, 13.5, 7.5, 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(-5.5, -4.5, 4.2, 5, -0.5, 0, Math.PI * 2);
    ctx.ellipse(-12, 2, 4.2, 2.5, -0.15, 0, Math.PI * 2);
    ctx.fill();

    drawPandaHead(ctx, -9.5, -14 + sway * 0.35, 11, happy, -0.3, time, seed, -0.06);
  } else if (pose === 4) {
    // Pose 4 (앉아있기): Sitting casually leaning slightly back with legs stretched forward & waving paw
    // Supporting arm leaning behind
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(-10.5, -4.5, 3.2, 5.4, 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Sitting white torso
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.ellipse(-2.5, -7, 10.4, 8.6, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Dark shoulder band + cheerfully waving right paw
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(-3, -12.5, 8.5, 3.2, -0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(6.5, -11);
    ctx.rotate(-0.65 + Math.sin(time * 4.8 + seed) * 0.35);
    ctx.beginPath();
    ctx.ellipse(0, -4.5, 3.3, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Both legs stretched lazily forward to the right
    drawPawFoot(ctx, 9.5, -3, 4.1, 4.8, 0.55);
    drawPawFoot(ctx, 7.5, 2.5, 4.1, 4.8, 0.35);

    drawPandaHead(ctx, -3.5, -24 + sway * 0.25, 11.4, happy, 0.2, time, seed, -0.09);
  } else {
    // Pose 5 (누워있기): Side-lying lounge propped on elbow
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(2, -3, 13.5, 7.5, -0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    drawPawFoot(ctx, 14.5, -2.5, 4.1, 4.8, 0.4);
    drawPawFoot(ctx, 12.5, 2.5, 3.9, 4.6, 0.25);

    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(-5.5, -4.5, 4.3, 5.2, -0.45, 0, Math.PI * 2);
    ctx.ellipse(-10, 1.5, 4.4, 2.6, -0.15, 0, Math.PI * 2);
    ctx.fill();

    drawPandaHead(ctx, -10.5, -14 + sway * 0.35, 11, happy, 0.2, time, seed, -0.12);
  }

  // Nickname banner above lounging panda
  const labelText = isDone ? `${nickname} · 완료` : nickname;
  ctx.save();
  ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
  const textW = ctx.measureText(labelText).width;
  const pillW = showRemoveButton ? textW + 34 : textW + 14;
  const pillH = 22;
  const labelY = pose === 1 || pose === 4 ? -48 : -38;

  ctx.fillStyle = isMe ? 'rgba(220, 252, 231, 0.94)' : 'rgba(255, 255, 255, 0.92)';
  ctx.strokeStyle = isMe ? '#15803d' : 'rgba(20, 83, 45, 0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-pillW / 2, labelY - pillH / 2, pillW, pillH, 7);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isMe ? '#14532d' : '#1e293b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelText, showRemoveButton ? -9 : 0, labelY + 0.5);

  if (showRemoveButton) {
    const btnX = pillW / 2 - 11.5;
    const btnY = labelY;
    ctx.fillStyle = isRemoveHovered ? '#fecdd3' : '#ffe4e6';
    ctx.strokeStyle = isRemoveHovered ? '#e11d48' : '#fda4af';
    ctx.lineWidth = isRemoveHovered ? 1.4 : 1;
    ctx.beginPath();
    ctx.arc(btnX, btnY, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#be123c';
    ctx.lineWidth = 1.7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(btnX - 2.6, btnY - 2.6);
    ctx.lineTo(btnX + 2.6, btnY + 2.6);
    ctx.moveTo(btnX + 2.6, btnY - 2.6);
    ctx.lineTo(btnX - 2.6, btnY + 2.6);
    ctx.stroke();

    if (removeHitsOut) {
      removeHitsOut.push({
        userId,
        nickname,
        wx: x + btnX,
        wy: y + btnY,
        radius: 18,
      });
    }
  }
  ctx.restore();

  ctx.restore();
}

export function drawLoungingPandas(
  ctx: CanvasRenderingContext2D,
  participants: ParticipantRecord[],
  voteCountByUser: Record<string, number>,
  monthIslands: MonthIsland[],
  time: number,
  currentUserId: string | null,
  includeCurrentUser = false,
  isRoomCreator = false,
  removeHitsOut?: PandaRemoveButtonHit[],
  hoveredRemoveUserId: string | null = null
) {
  if (removeHitsOut) {
    removeHitsOut.length = 0;
  }
  if (monthIslands.length === 0) return;

  const visibleParticipants = includeCurrentUser
    ? participants
    : participants.filter((p) => p.userId !== currentUserId);

  if (visibleParticipants.length === 0) return;

  const firstIsland = monthIslands[0];
  const baseOffset = firstIsland.offset;

  // Arrange lounging pandas neatly on the left meadow beside the first calendar island
  visibleParticipants.forEach((p, idx) => {
    const colLane = Math.floor(idx / 4);
    const rowSlot = idx % 4;
    const gx = baseOffset - 1.9 - colLane * 1.85;
    const gy = baseOffset + 0.6 + rowSlot * 1.55 + (colLane % 2) * 0.65;
    const pos = gridToScreen(gx, gy);

    const voteCount = voteCountByUser[p.userId] || 0;
    const happy = voteCount > 0;
    const isMe = p.userId === currentUserId;

    drawSingleLoungingPanda(
      ctx,
      pos.x,
      pos.y,
      p.poseIndex,
      happy,
      p.userId,
      p.nickname,
      isMe,
      p.isDone,
      time,
      idx * 1.9,
      isRoomCreator && !isMe,
      removeHitsOut,
      hoveredRemoveUserId === p.userId
    );
  });
}

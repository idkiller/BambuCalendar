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

    ctx.save();
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillStyle = count >= 4 ? '#14532d' : '#0369a1';
    ctx.textAlign = 'center';
    ctx.fillText(String(count), x + 22, drawY - 10);
    ctx.restore();
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
  r: number,
  rot = 0
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  // Outer black round foot
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();

  // Inner white ring pad outline + main pad
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.beginPath();
  ctx.ellipse(0, r * 0.16, r * 0.44, r * 0.34, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Three tiny white toe beans
  ctx.fillStyle = '#ffffff';
  const beanR = Math.max(0.9, r * 0.13);
  ctx.beginPath();
  ctx.arc(-r * 0.4, -r * 0.34, beanR, 0, Math.PI * 2);
  ctx.arc(0, -r * 0.48, beanR, 0, Math.PI * 2);
  ctx.arc(r * 0.4, -r * 0.34, beanR, 0, Math.PI * 2);
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
  tilt = -0.06
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);

  // Round black ears with white inner crescents
  const earX = r * 0.78;
  const earY = -r * 0.72;
  const earR = r * 0.38;

  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(-earX, earY, earR, 0, Math.PI * 2);
  ctx.arc(earX, earY, earR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-earX * 0.94, earY + earR * 0.08, earR * 0.48, 0, Math.PI * 2);
  ctx.arc(earX * 0.94, earY + earR * 0.08, earR * 0.48, 0, Math.PI * 2);
  ctx.fill();

  // Oversized chubby white head with bold crisp ink outline
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.8, r * 0.14);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.14, r * 0.96, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const lookX = facing * r * 0.1;

  // Big tilted oval black eye patches
  ctx.fillStyle = INK;
  ctx.save();
  ctx.translate(-r * 0.42 + lookX, r * 0.02);
  ctx.rotate(-0.32);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.28, r * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(r * 0.42 + lookX, r * 0.02);
  ctx.rotate(0.32);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.28, r * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const eyeLX = -r * 0.39 + lookX;
  const eyeRX = r * 0.39 + lookX;
  const eyeY = -r * 0.01;
  const eyeR = r * 0.17;

  // Glossy ringed eyes (matches reference illustration)
  ctx.fillStyle = INK;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.2, r * 0.09);

  ctx.beginPath();
  ctx.arc(eyeLX, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(eyeRX, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Bright catchlight dots
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(eyeLX - eyeR * 0.34, eyeY - eyeR * 0.34, eyeR * 0.34, 0, Math.PI * 2);
  ctx.arc(eyeRX - eyeR * 0.34, eyeY - eyeR * 0.34, eyeR * 0.34, 0, Math.PI * 2);
  ctx.fill();

  if (happy) {
    // Tiny secondary sparkle + soft rosy cheeks + cute :3 mouth
    ctx.beginPath();
    ctx.arc(eyeLX + eyeR * 0.34, eyeY + eyeR * 0.34, eyeR * 0.16, 0, Math.PI * 2);
    ctx.arc(eyeRX + eyeR * 0.34, eyeY + eyeR * 0.34, eyeR * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.65 + lookX, r * 0.32, r * 0.17, r * 0.09, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.65 + lookX, r * 0.32, r * 0.17, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cute :3 mouth
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.4, r * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-r * 0.09 + lookX, r * 0.34, r * 0.09, 0.15, Math.PI - 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.09 + lookX, r * 0.34, r * 0.09, 0.1, Math.PI - 0.15);
    ctx.stroke();
  } else {
    // Sad/crying expression (울상): worried brows, glistening teardrops, inverted pout
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.1, r * 0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(eyeLX - eyeR * 1.1, eyeY - eyeR * 1.25);
    ctx.lineTo(eyeLX + eyeR * 0.9, eyeY - eyeR * 0.9);
    ctx.moveTo(eyeRX + eyeR * 1.1, eyeY - eyeR * 1.25);
    ctx.lineTo(eyeRX - eyeR * 0.9, eyeY - eyeR * 0.9);
    ctx.stroke();

    const tearBob = Math.abs(Math.sin(time * 3.8 + seed)) * (r * 0.18);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(eyeLX - r * 0.04, eyeY + eyeR * 1.35 + tearBob, r * 0.09, r * 0.14, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeRX + r * 0.04, eyeY + eyeR * 1.35 + tearBob, r * 0.09, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.4, r * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(lookX, r * 0.5, r * 0.15, Math.PI * 1.18, Math.PI * 1.82);
    ctx.stroke();
  }

  // Cute oval nose
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(lookX, r * 0.21, r * 0.14, r * 0.095, 0, 0, Math.PI * 2);
  ctx.fill();

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

  const idleBob = player.jumpProgress >= 1 ? Math.sin(time * 4.2) * 1.4 : 0;
  ctx.translate(0, idleBob);

  if (player.jumpProgress < 1) {
    const stretch = 1 + Math.sin(player.jumpProgress * Math.PI) * 0.12;
    ctx.scale(1 / Math.sqrt(stretch), stretch);
  }

  // Compact white chubby body with bold ink outline
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -10, 10.5, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Inward-tucked curved black arms
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(-6.5, -10, 4.2, 6.8, -0.45, 0, Math.PI * 2);
  ctx.ellipse(6.5, -10, 4.2, 6.8, 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Cute round hind feet with toe-bean paw pads
  drawPawFoot(ctx, -9.5, -2.5, 5.2, -0.15);
  drawPawFoot(ctx, 9.5, -2.5, 5.2, 0.15);

  // Tiny blue watering can beside paw
  ctx.fillStyle = '#0284c7';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(player.facing * 12 - 3.5, -13, 7, 6, 1.5);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#0369a1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(player.facing * 15, -11);
  ctx.lineTo(player.facing * 18.5, -14.5);
  ctx.stroke();

  // Oversized cute tilted panda head
  const tilt = player.jumpProgress < 1 ? player.facing * 0.08 : -0.07;
  drawPandaHead(ctx, 0, -28, 13.5, hasVoted, player.facing, time, 0, tilt);

  ctx.restore();
}

// ==========================================
// Lounging Participant Pandas Beside Calendar
// ==========================================
function drawSingleLoungingPanda(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  poseIndex: number,
  happy: boolean,
  nickname: string,
  isMe: boolean,
  isDone: boolean,
  time: number,
  seed: number
) {
  ctx.save();
  ctx.translate(x, y);

  // Soft mossy resting spot underneath each panda
  ctx.fillStyle = isMe ? 'rgba(134, 239, 172, 0.55)' : 'rgba(187, 247, 208, 0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 25, 11.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const sway = Math.sin(time * 2.2 + seed) * 1.2;
  const pose = Math.abs(poseIndex) % 6;

  if (pose === 0) {
    // Pose 0: Belly sprawl (배 깔고 엎드리기)
    drawPawFoot(ctx, -15, 0.5, 4.4, -0.35);
    drawPawFoot(ctx, -13, -3.5, 4.2, -0.2);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(-2, -3, 13.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(5, -4, 4, 5.5, 0.45, 0, Math.PI * 2);
    ctx.ellipse(12, 2, 4.5, 2.8, 0.1, 0, Math.PI * 2);
    ctx.fill();

    drawPandaHead(ctx, 10, -14 + sway * 0.4, 11.2, happy, 0.4, time, seed, 0.08);
  } else if (pose === 1) {
    // Pose 1: Classic Kawaii Sit (레퍼런스 일러스트 포즈 그대로!)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.ellipse(0, -6.5, 10.5, 8.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Tucked inward black front arms
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(-5.5, -6.5, 3.8, 6.2, -0.42, 0, Math.PI * 2);
    ctx.ellipse(5.5, -6.5, 3.8, 6.2, 0.42, 0, Math.PI * 2);
    ctx.fill();

    // Cute toe-bean feet forward
    drawPawFoot(ctx, -9.5, -1, 4.8, -0.15);
    drawPawFoot(ctx, 9.5, -1, 4.8, 0.15);

    drawPandaHead(ctx, 0, -23 + sway * 0.4, 11.8, happy, 0, time, seed, -0.07);
  } else if (pose === 2) {
    // Pose 2: Side lounge propping head (옆으로 누워 턱 괴기)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(2, -3, 13, 7.8, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    drawPawFoot(ctx, 14, -2, 4.4, 0.25);
    drawPawFoot(ctx, 12, 3, 4.2, 0.15);

    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(-6, -5, 4.2, 5.2, -0.4, 0, Math.PI * 2);
    ctx.fill();

    drawPandaHead(ctx, -10, -15 + sway * 0.4, 11.2, happy, 0.25, time, seed, -0.1);
  } else if (pose === 3) {
    // Pose 3: Hugging a mini bamboo stalk (대나무 안고 쉬기)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(-2, -6.5, 10, 8.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(9, 2);
    ctx.lineTo(13, -25);
    ctx.stroke();
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(16.5, -22, 5.5, 2.2, -0.4, 0, Math.PI * 2);
    ctx.fill();

    drawPawFoot(ctx, -9.5, -1, 4.4, -0.15);
    drawPawFoot(ctx, 5.5, -1, 4.4, 0.15);

    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(6, -8, 5.5, 3, -0.2, 0, Math.PI * 2);
    ctx.fill();

    drawPandaHead(ctx, -2, -22 + sway * 0.4, 11.2, happy, 0.25, time, seed, 0.06);
  } else if (pose === 4) {
    // Pose 4: Back sprawl with toe-bean paws up (발라당 누워 쉬기)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, -3, 13.5, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    drawPawFoot(ctx, 10, -8 + sway * 0.3, 4.2, -0.25);
    drawPawFoot(ctx, 13, -2 + sway * 0.3, 4.2, 0.2);

    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(-2, -10, 3.5, 4.5, 0.2, 0, Math.PI * 2);
    ctx.fill();

    drawPandaHead(ctx, -10, -14, 11.2, happy, -0.15, time, seed, -0.12);
  } else {
    // Pose 5: Sitting & waving paw cheerfully (앉아서 손 흔들기)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, -6.5, 10, 8.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(-5.5, -6.5, 3.6, 5.8, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Waving right paw
    ctx.save();
    ctx.translate(9, -10);
    ctx.rotate(-0.65 + Math.sin(time * 5 + seed) * 0.35);
    ctx.beginPath();
    ctx.ellipse(0, -4.5, 3.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawPawFoot(ctx, -9, -1, 4.6, -0.15);
    drawPawFoot(ctx, 9, -1, 4.6, 0.15);

    drawPandaHead(ctx, 0, -23, 11.5, happy, 0.15, time, seed, 0.06);
  }

  // Nickname banner above lounging panda
  const labelText = isDone ? `${nickname} · 완료` : nickname;
  ctx.save();
  ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
  const textW = ctx.measureText(labelText).width;
  const pillW = textW + 14;
  const pillH = 20;
  const labelY = pose === 0 || pose === 2 || pose === 4 ? -38 : -46;

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
  ctx.fillText(labelText, 0, labelY + 0.5);
  ctx.restore();

  ctx.restore();
}

export function drawLoungingPandas(
  ctx: CanvasRenderingContext2D,
  participants: ParticipantRecord[],
  voteCountByUser: Record<string, number>,
  monthIslands: MonthIsland[],
  time: number,
  currentUserId: string | null
) {
  if (participants.length === 0 || monthIslands.length === 0) return;

  const firstIsland = monthIslands[0];
  const baseOffset = firstIsland.offset;

  // Arrange lounging pandas neatly on the left meadow beside the first calendar island
  participants.forEach((p, idx) => {
    const colLane = Math.floor(idx / 4);
    const rowSlot = idx % 4;
    const gx = baseOffset - 1.9 - colLane * 1.85;
    const gy = baseOffset + 0.6 + rowSlot * 1.55 + (colLane % 2) * 0.65;
    const pos = gridToScreen(gx, gy);

    const voteCount = voteCountByUser[p.userId] || 0;
    const happy = voteCount > 0;

    drawSingleLoungingPanda(
      ctx,
      pos.x,
      pos.y,
      p.poseIndex,
      happy,
      p.nickname,
      p.userId === currentUserId,
      p.isDone,
      time,
      idx * 1.9
    );
  });
}

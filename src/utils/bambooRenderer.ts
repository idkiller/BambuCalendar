import {
  CalendarTile,
  MonthIsland,
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

  // Soft ground shadow under shoot/bamboo
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
    // Stage 1-3: Bamboo Shoot (죽순) growing progressively plumper & taller
    const heights = [0, 19, 30, 41];
    const widths = [0, 11, 16, 21];
    const h = heights[count];
    const w = widths[count];

    ctx.rotate(sway * 0.55);

    // Inner tender shoot
    ctx.fillStyle = count === 3 ? '#84cc16' : '#a3e635';
    ctx.beginPath();
    ctx.moveTo(0, -h - 4);
    ctx.quadraticCurveTo(w * 0.45, -h * 0.3, w * 0.5, 0);
    ctx.lineTo(-w * 0.5, 0);
    ctx.quadraticCurveTo(-w * 0.45, -h * 0.3, 0, -h - 4);
    ctx.fill();

    // Overlapping brown husk sheaths
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

    // Small sprout tips from stage 2+
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
    // Stage 4+: Full Bamboo (대나무) growing taller with every vote
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

      // Specular culm highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
      ctx.beginPath();
      ctx.moveTo(curX - wBottom * 0.35, curY);
      ctx.lineTo(nextX - wTop * 0.35, nextY);
      ctx.lineTo(nextX - wTop * 0.1, nextY);
      ctx.lineTo(curX - wBottom * 0.1, curY);
      ctx.closePath();
      ctx.fill();

      // Node ring
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

    // Top crown shoot
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(curX, curY - 6, 2.5, 7.5, sway * 3, 0, Math.PI * 2);
    ctx.fill();

    // Subtle golden firefly accent for high-count bamboo (7+)
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

  // Left side bevel
  ctx.fillStyle = leftColor;
  ctx.beginPath();
  ctx.moveTo(x - hw, drawY);
  ctx.lineTo(x, drawY + hh);
  ctx.lineTo(x, drawY + hh + TILE_DEPTH);
  ctx.lineTo(x - hw, drawY + TILE_DEPTH);
  ctx.closePath();
  ctx.fill();

  // Right side bevel
  ctx.fillStyle = rightColor;
  ctx.beginPath();
  ctx.moveTo(x + hw, drawY);
  ctx.lineTo(x, drawY + hh);
  ctx.lineTo(x, drawY + hh + TILE_DEPTH);
  ctx.lineTo(x + hw, drawY + TILE_DEPTH);
  ctx.closePath();
  ctx.fill();

  // Top face
  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.moveTo(x, drawY - hh);
  ctx.lineTo(x + hw, drawY);
  ctx.lineTo(x, drawY + hh);
  ctx.lineTo(x - hw, drawY);
  ctx.closePath();
  ctx.fill();

  // Crisp edge outline
  ctx.strokeStyle = isCurrentPlayerTile
    ? '#15803d'
    : isHovered
      ? '#4d7c0f'
      : 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = isCurrentPlayerTile ? 2.4 : 1;
  ctx.stroke();

  // Central soil patch for active days
  if (tile.isActive) {
    ctx.fillStyle = count > 0 ? '#8d6e63' : '#cbb7ab';
    ctx.beginPath();
    ctx.ellipse(x, drawY, 17, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Day number label
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

  // Small blue droplet marker when current user watered this tile
  if (tile.isActive && iWatered) {
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(x + 21, drawY - 1);
    ctx.quadraticCurveTo(x + 25, drawY + 4, x + 21, drawY + 7);
    ctx.quadraticCurveTo(x + 17, drawY + 4, x + 21, drawY - 1);
    ctx.fill();
  }
  ctx.restore();

  // Plant + numeric water count
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

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  time: number
) {
  const pos = gridToScreen(player.gx, player.gy);
  const jumpArc = Math.sin(player.jumpProgress * Math.PI) * player.jumpHeight;
  const px = pos.x;
  const py = pos.y - jumpArc;

  const shadowScale = Math.max(0.4, 1 - jumpArc / 95);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + 4, 13 * shadowScale, 6.5 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(px, py);

  const idleBob = player.jumpProgress >= 1 ? Math.sin(time * 5) * 1.5 : 0;
  ctx.translate(0, idleBob);

  // Squash/stretch subtly during jump
  if (player.jumpProgress < 1) {
    const stretch = 1 + Math.sin(player.jumpProgress * Math.PI) * 0.1;
    ctx.scale(1 / Math.sqrt(stretch), stretch);
  }

  // Gardener vest
  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.roundRect(-9, -20, 18, 17, 7);
  ctx.fill();

  // Head
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(0, -27, 10, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#1e293b';
  const eyeOffset = player.facing * 2.5;
  ctx.beginPath();
  ctx.arc(-3 + eyeOffset, -27, 1.5, 0, Math.PI * 2);
  ctx.arc(3 + eyeOffset, -27, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Straw hat
  ctx.fillStyle = '#d97706';
  ctx.beginPath();
  ctx.ellipse(0, -34, 14, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(0, -35, 8, Math.PI, 0);
  ctx.fill();

  // Little blue watering can
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(player.facing * 9 - 3, -15, 7, 6);

  ctx.restore();
}

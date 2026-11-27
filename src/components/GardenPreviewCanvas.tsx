import { useEffect, useRef } from 'react';
import {
  drawIsoTile,
  drawPlayer,
  gridToScreen,
} from '../utils/bambooRenderer';
import { CalendarTile, PlayerState, VoteRecord } from '../types/calendar';

const PREVIEW_TILES: CalendarTile[] = [
  { dateStr: '2026-12-01', day: 1, weekday: 2, col: 0, row: 0, gx: 0, gy: 0, isActive: true, monthIndex: 0, activeIdx: 0, bounce: 0 },
  { dateStr: '2026-12-02', day: 2, weekday: 3, col: 1, row: 0, gx: 1, gy: 0, isActive: true, monthIndex: 0, activeIdx: 1, bounce: 0 },
  { dateStr: '2026-12-03', day: 3, weekday: 4, col: 2, row: 0, gx: 2, gy: 0, isActive: true, monthIndex: 0, activeIdx: 2, bounce: 0 },
  { dateStr: '2026-12-04', day: 4, weekday: 5, col: 0, row: 1, gx: 0, gy: 1, isActive: true, monthIndex: 0, activeIdx: 3, bounce: 0 },
  { dateStr: '2026-12-05', day: 5, weekday: 6, col: 1, row: 1, gx: 1, gy: 1, isActive: true, monthIndex: 0, activeIdx: 4, bounce: 0 },
  { dateStr: '2026-12-06', day: 6, weekday: 0, col: 2, row: 1, gx: 2, gy: 1, isActive: true, monthIndex: 0, activeIdx: 5, bounce: 0 },
];

const PREVIEW_COUNTS: Record<string, number> = {
  '2026-12-01': 1,
  '2026-12-02': 3,
  '2026-12-03': 7,
  '2026-12-04': 0,
  '2026-12-05': 5,
  '2026-12-06': 2,
};

function makeFakeVotes(dateStr: string, count: number): VoteRecord[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `${dateStr}__p${idx}`,
    roomId: 'preview',
    dateStr,
    userId: idx === 0 && count >= 5 ? 'me' : `u${idx}`,
    nickname: `참여자${idx + 1}`,
  }));
}

export function GardenPreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const startTime = performance.now();

    const sortedTiles = [...PREVIEW_TILES].sort(
      (a, b) => a.gx + a.gy - (b.gx + b.gy)
    );

    const hopOrder = [3, 4, 1, 2, 5, 4];
    let stepIndex = 0;
    let lastHopSwitch = startTime;

    const player: PlayerState = {
      tileIndex: 3,
      gx: 0,
      gy: 1,
      startGx: 0,
      startGy: 1,
      targetGx: 0,
      targetGy: 1,
      jumpProgress: 1,
      jumpHeight: 34,
      facing: 1,
      hopQueue: [],
    };

    const render = (now: number) => {
      const time = now / 1000;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      if (
        canvas.width !== Math.round(rect.width * dpr) ||
        canvas.height !== Math.round(rect.height * dpr)
      ) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Periodic calm hop animation
      if (now - lastHopSwitch > 1600 && player.jumpProgress >= 1) {
        lastHopSwitch = now;
        stepIndex = (stepIndex + 1) % hopOrder.length;
        const targetTile = PREVIEW_TILES[hopOrder[stepIndex]];
        player.startGx = player.gx;
        player.startGy = player.gy;
        player.targetGx = targetTile.gx;
        player.targetGy = targetTile.gy;
        player.tileIndex = targetTile.activeIdx;
        player.jumpProgress = 0;
        const dx = targetTile.gx - targetTile.gy - (player.startGx - player.startGy);
        if (Math.abs(dx) > 0.05) player.facing = dx > 0 ? 1 : -1;
      }

      if (player.jumpProgress < 1) {
        player.jumpProgress = Math.min(1, player.jumpProgress + 0.06);
        player.gx = player.startGx + (player.targetGx - player.startGx) * player.jumpProgress;
        player.gy = player.startGy + (player.targetGy - player.startGy) * player.jumpProgress;
      }

      const centerIso = gridToScreen(1, 0.5);
      ctx.save();
      ctx.translate(rect.width / 2 - centerIso.x, rect.height * 0.64 - centerIso.y);

      const currentTile = PREVIEW_TILES[player.tileIndex];
      const playerDepth = player.gx + player.gy;
      let playerDrawn = false;

      for (const tile of sortedTiles) {
        const tileDepth = tile.gx + tile.gy;
        if (!playerDrawn && playerDepth < tileDepth - 0.1) {
          drawPlayer(ctx, player, time);
          playerDrawn = true;
        }
        const votes = makeFakeVotes(tile.dateStr, PREVIEW_COUNTS[tile.dateStr] || 0);
        drawIsoTile(ctx, tile, votes, 'me', tile === currentTile, false, time);
      }

      if (!playerDrawn) {
        drawPlayer(ctx, player, time);
      }

      ctx.restore();
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-64 lg:h-72 block"
      aria-label="쿼터뷰 대나무 달력 성장 미리보기"
    />
  );
}

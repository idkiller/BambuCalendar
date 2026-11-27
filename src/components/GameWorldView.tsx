import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  BarChart3,
  Copy,
  Crosshair,
  Droplets,
  Minus,
  Plus,
  UserRound,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  CalendarTile,
  CameraState,
  DateRankingItem,
  MAX_NICKNAME_LENGTH,
  MonthIsland,
  Particle,
  PlayerState,
  RoomData,
  VoteRecord,
} from '../types/calendar';
import {
  buildCalendarWorld,
  drawIsoTile,
  drawMonthHeaders,
  drawPlayer,
  getGrowthStageLabel,
  gridToScreen,
  TILE_H,
  TILE_W,
} from '../utils/bambooRenderer';
import { buildRoomUrl, formatDisplayDate } from '../utils/dateUtils';
import { soundFx } from '../utils/soundFx';
import { TopSevenSummary } from './TopSevenSummary';

interface GameWorldViewProps {
  roomId: string;
  user: User | null;
  authReady: boolean;
  onBackHome: () => void;
  onShowToast: (msg: string) => void;
}

export function GameWorldView({
  roomId,
  user,
  authReady,
  onBackHome,
  onShowToast,
}: GameWorldViewProps) {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [roomNotFound, setRoomNotFound] = useState(false);

  const [votesList, setVotesList] = useState<VoteRecord[]>([]);
  const [nickname, setNickname] = useState<string>(
    () => localStorage.getItem('bamboo_nickname')?.trim() || ''
  );
  const [nicknameConfirmed, setNicknameConfirmed] = useState<boolean>(
    () => Boolean(localStorage.getItem('bamboo_nickname')?.trim())
  );
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [currentTileIndex, setCurrentTileIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [wateringBusy, setWateringBusy] = useState(false);

  // Canvas & Animation Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<{
    monthIslands: MonthIsland[];
    allTiles: CalendarTile[];
    activeTiles: CalendarTile[];
  }>({ monthIslands: [], allTiles: [], activeTiles: [] });

  const votesByDateRef = useRef<Record<string, VoteRecord[]>>({});
  const currentUserIdRef = useRef<string | null>(null);
  const hoveredTileIdxRef = useRef<number>(-1);
  const particlesRef = useRef<Particle[]>([]);

  const playerRef = useRef<PlayerState>({
    tileIndex: 0,
    gx: 0,
    gy: 0,
    startGx: 0,
    startGy: 0,
    targetGx: 0,
    targetGy: 0,
    jumpProgress: 1,
    jumpHeight: 0,
    facing: 1,
    hopQueue: [],
  });

  const cameraRef = useRef<CameraState>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    zoom: 1,
    targetZoom: 1,
    isDragging: false,
    dragMoved: false,
    lastMouseX: 0,
    lastMouseY: 0,
    manualPan: false,
  });

  useEffect(() => {
    currentUserIdRef.current = user?.uid || null;
  }, [user]);

  // Prefill nickname if none stored yet
  useEffect(() => {
    if (user && !nickname) {
      setNicknameDraft('');
    }
  }, [user, nickname]);

  // Subscribe to Room document and Votes subcollection once authenticated
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setRoomLoading(false);
      return;
    }

    setRoomLoading(true);
    setRoomNotFound(false);

    const roomPath = `rooms/${roomId}`;
    const unsubRoom = onSnapshot(
      doc(db, 'rooms', roomId),
      (snap) => {
        if (!snap.exists()) {
          setRoom(null);
          setRoomNotFound(true);
          setRoomLoading(false);
          return;
        }
        const d = snap.data();
        setRoom({
          id: snap.id,
          title: String(d.title || ''),
          startDate: String(d.startDate || ''),
          endDate: String(d.endDate || ''),
          creatorId: String(d.creatorId || ''),
          creatorName: String(d.creatorName || ''),
          createdAt: d.createdAt,
        });
        setRoomNotFound(false);
        setRoomLoading(false);
      },
      (err) => {
        setRoomLoading(false);
        handleFirestoreError(err, OperationType.GET, roomPath);
      }
    );

    const votesPath = `rooms/${roomId}/votes`;
    const votesQuery = query(
      collection(db, 'rooms', roomId, 'votes'),
      where('roomId', '==', roomId)
    );
    const unsubVotes = onSnapshot(
      votesQuery,
      (snap) => {
        const list: VoteRecord[] = snap.docs.map((d) => {
          const v = d.data();
          return {
            id: d.id,
            roomId: String(v.roomId || roomId),
            dateStr: String(v.dateStr || ''),
            userId: String(v.userId || ''),
            nickname: String(v.nickname || '익명'),
            createdAt: v.createdAt,
            updatedAt: v.updatedAt,
          };
        });
        setVotesList(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, votesPath);
      }
    );

    return () => {
      unsubRoom();
      unsubVotes();
    };
  }, [authReady, user, roomId]);

  // Build grouped vote map
  const votesByDate = useMemo(() => {
    const map: Record<string, VoteRecord[]> = {};
    for (const v of votesList) {
      if (!map[v.dateStr]) map[v.dateStr] = [];
      map[v.dateStr].push(v);
    }
    return map;
  }, [votesList]);

  useEffect(() => {
    votesByDateRef.current = votesByDate;
  }, [votesByDate]);

  // Build calendar world when room dates load
  useEffect(() => {
    if (!room) return;
    const world = buildCalendarWorld(room.startDate, room.endDate);
    worldRef.current = world;

    if (world.activeTiles.length > 0) {
      const first = world.activeTiles[0];
      playerRef.current = {
        tileIndex: 0,
        gx: first.gx,
        gy: first.gy,
        startGx: first.gx,
        startGy: first.gy,
        targetGx: first.gx,
        targetGy: first.gy,
        jumpProgress: 1,
        jumpHeight: 0,
        facing: 1,
        hopQueue: [],
      };
      setCurrentTileIndex(0);

      const pos = gridToScreen(first.gx, first.gy);
      cameraRef.current.x = pos.x;
      cameraRef.current.y = pos.y - 35;
      cameraRef.current.targetX = pos.x;
      cameraRef.current.targetY = pos.y - 35;
      cameraRef.current.manualPan = false;
    }

    if (!nicknameConfirmed) {
      setNicknameDraft(
        (localStorage.getItem('bamboo_nickname') || user?.displayName || '').slice(
          0,
          MAX_NICKNAME_LENGTH
        )
      );
      setShowNicknameModal(true);
    }
  }, [room?.id, room?.startDate, room?.endDate]);

  const spawnWaterParticles = useCallback(
    (gx: number, gy: number, isCancel = false) => {
      const pos = gridToScreen(gx, gy);
      for (let i = 0; i < 14; i++) {
        const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.3;
        const speed = 1.4 + Math.random() * 2.4;
        particlesRef.current.push({
          x: pos.x,
          y: pos.y - 16,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2.6,
          life: 1,
          color: isCancel ? '#fb7185' : i % 2 === 0 ? '#0284c7' : '#38bdf8',
          size: 3 + Math.random() * 2.4,
        });
      }
    },
    []
  );

  const startJumpTo = useCallback((targetActiveIndex: number) => {
    const activeTiles = worldRef.current.activeTiles;
    if (targetActiveIndex < 0 || targetActiveIndex >= activeTiles.length) return;
    const target = activeTiles[targetActiveIndex];
    const p = playerRef.current;
    const dist = Math.hypot(target.gx - p.gx, target.gy - p.gy);

    p.startGx = p.gx;
    p.startGy = p.gy;
    p.targetGx = target.gx;
    p.targetGy = target.gy;
    p.tileIndex = targetActiveIndex;
    p.jumpProgress = 0;
    p.jumpHeight = Math.min(96, 28 + dist * 9);

    const dx = target.gx - target.gy - (p.startGx - p.startGy);
    if (Math.abs(dx) > 0.1) p.facing = dx > 0 ? 1 : -1;

    cameraRef.current.manualPan = false;
    setCurrentTileIndex(targetActiveIndex);
    soundFx.playHop();
  }, []);

  const moveByGridDelta = useCallback(
    (dCol: number, dRow: number) => {
      const { activeTiles, monthIslands } = worldRef.current;
      if (activeTiles.length === 0) return;
      const p = playerRef.current;
      if (p.jumpProgress < 1) return;

      const cur = activeTiles[p.tileIndex];
      if (!cur) return;

      const nextCol = cur.col + dCol;
      const nextRow = cur.row + dRow;

      let found = activeTiles.find(
        (t) =>
          t.monthIndex === cur.monthIndex && t.col === nextCol && t.row === nextRow
      );

      if (!found && dCol !== 0) {
        const nextIdx = p.tileIndex + dCol;
        if (nextIdx >= 0 && nextIdx < activeTiles.length) {
          found = activeTiles[nextIdx];
        }
      }

      if (!found && dRow !== 0) {
        if (dRow > 0 && cur.monthIndex + 1 < monthIslands.length) {
          const nextMonthTiles = activeTiles.filter(
            (t) => t.monthIndex === cur.monthIndex + 1
          );
          found =
            nextMonthTiles.find((t) => t.col === cur.col) || nextMonthTiles[0];
        } else if (dRow < 0 && cur.monthIndex - 1 >= 0) {
          const prevMonthTiles = activeTiles.filter(
            (t) => t.monthIndex === cur.monthIndex - 1
          );
          found =
            [...prevMonthTiles].reverse().find((t) => t.col === cur.col) ||
            prevMonthTiles[prevMonthTiles.length - 1];
        } else {
          const step = dRow > 0 ? 7 : -7;
          const fallbackIdx = Math.max(
            0,
            Math.min(activeTiles.length - 1, p.tileIndex + step)
          );
          if (fallbackIdx !== p.tileIndex) found = activeTiles[fallbackIdx];
        }
      }

      if (found) {
        p.hopQueue = [];
        startJumpTo(found.activeIdx);
      }
    },
    [startJumpTo]
  );

  const toggleWaterCurrentTile = useCallback(async () => {
    if (!room || !user || wateringBusy) return;
    const activeTiles = worldRef.current.activeTiles;
    const tile = activeTiles[playerRef.current.tileIndex];
    if (!tile) return;

    if (!nicknameConfirmed || !nickname.trim()) {
      setShowNicknameModal(true);
      return;
    }

    const cleanNick = nickname.trim().slice(0, MAX_NICKNAME_LENGTH);
    const voteId = `${tile.dateStr}__${user.uid}`;
    const votePath = `rooms/${room.id}/votes/${voteId}`;
    const existingVotes = votesByDateRef.current[tile.dateStr] || [];
    const alreadyWatered = existingVotes.some((v) => v.userId === user.uid);

    setWateringBusy(true);
    try {
      if (alreadyWatered) {
        try {
          await deleteDoc(doc(db, 'rooms', room.id, 'votes', voteId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, votePath);
        }
        spawnWaterParticles(tile.gx, tile.gy, true);
        tile.bounce = 1;
        soundFx.playCancel();
        onShowToast(`${tile.day}일 물주기를 취소했습니다.`);
      } else {
        try {
          await setDoc(doc(db, 'rooms', room.id, 'votes', voteId), {
            roomId: room.id,
            dateStr: tile.dateStr,
            userId: user.uid,
            nickname: cleanNick,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, votePath);
        }
        const nextCount = existingVotes.length + 1;
        spawnWaterParticles(tile.gx, tile.gy, false);
        tile.bounce = 1;
        if (nextCount === 4) {
          soundFx.playBambooEvolve();
          onShowToast('죽순이 대나무로 자라났습니다!');
        } else {
          soundFx.playWater();
          onShowToast(`${tile.day}일에 물을 주었습니다. (${nextCount}회)`);
        }
      }
    } finally {
      setWateringBusy(false);
    }
  }, [
    room,
    user,
    wateringBusy,
    nicknameConfirmed,
    nickname,
    spawnWaterParticles,
    onShowToast,
  ]);

  // Keyboard Controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!room || !user || showNicknameModal || showSummary) return;
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          moveByGridDelta(1, 0);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          moveByGridDelta(-1, 0);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          moveByGridDelta(0, 1);
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          moveByGridDelta(0, -1);
          break;
        case ' ':
        case 'Enter':
          e.preventDefault();
          toggleWaterCurrentTile();
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [room, user, showNicknameModal, showSummary, moveByGridDelta, toggleWaterCurrentTile]);

  // Main Canvas Animation Loop
  useEffect(() => {
    if (!room || !user) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const render = (timestamp: number) => {
      const time = timestamp / 1000;
      const dpr = window.devicePixelRatio || 1;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (
        canvas.width !== Math.round(vw * dpr) ||
        canvas.height !== Math.round(vh * dpr)
      ) {
        canvas.width = Math.round(vw * dpr);
        canvas.height = Math.round(vh * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, vw, vh);

      const p = playerRef.current;
      const { activeTiles, allTiles, monthIslands } = worldRef.current;

      if (p.jumpProgress < 1) {
        p.jumpProgress = Math.min(1, p.jumpProgress + 0.088);
        p.gx = p.startGx + (p.targetGx - p.startGx) * p.jumpProgress;
        p.gy = p.startGy + (p.targetGy - p.startGy) * p.jumpProgress;

        if (p.jumpProgress >= 1) {
          const landedTile = activeTiles[p.tileIndex];
          if (landedTile) landedTile.bounce = 1;
          if (p.hopQueue.length > 0) {
            const nextIdx = p.hopQueue.shift();
            if (typeof nextIdx === 'number') startJumpTo(nextIdx);
          }
        }
      }

      for (const t of allTiles) {
        if (t.bounce > 0) t.bounce = Math.max(0, t.bounce - 0.08);
      }

      const cam = cameraRef.current;
      if (!cam.manualPan) {
        const pPos = gridToScreen(p.gx, p.gy);
        cam.targetX = pPos.x;
        cam.targetY = pPos.y - 25;
      }
      cam.x += (cam.targetX - cam.x) * 0.14;
      cam.y += (cam.targetY - cam.y) * 0.14;
      cam.zoom += (cam.targetZoom - cam.zoom) * 0.15;

      ctx.save();
      ctx.translate(vw / 2, vh / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x, -cam.y);

      drawMonthHeaders(ctx, monthIslands);

      const currentTile = activeTiles[p.tileIndex];
      const playerDepth = p.gx + p.gy;
      let playerDrawn = false;

      for (const tile of allTiles) {
        const tileDepth = tile.gx + tile.gy;
        if (!playerDrawn && playerDepth < tileDepth - 0.1) {
          drawPlayer(ctx, p, time);
          playerDrawn = true;
        }
        const votes = votesByDateRef.current[tile.dateStr] || [];
        const isHovered = tile.isActive && tile.activeIdx === hoveredTileIdxRef.current;
        drawIsoTile(
          ctx,
          tile,
          votes,
          currentUserIdRef.current,
          tile === currentTile,
          isHovered,
          time
        );
      }

      if (!playerDrawn && activeTiles.length > 0) {
        drawPlayer(ctx, p, time);
      }

      // Water / Cancel Particles
      const parts = particlesRef.current;
      for (let i = parts.length - 1; i >= 0; i--) {
        const pt = parts[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.14;
        pt.life -= 0.032;
        if (pt.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = pt.life;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [room, user, startJumpTo]);

  // Pointer helpers for hit-testing & panning
  const screenToWorld = (clientX: number, clientY: number) => {
    const cam = cameraRef.current;
    return {
      wx: (clientX - window.innerWidth / 2) / cam.zoom + cam.x,
      wy: (clientY - window.innerHeight / 2) / cam.zoom + cam.y,
    };
  };

  const findTileAtScreenPos = (clientX: number, clientY: number): CalendarTile | null => {
    const { wx, wy } = screenToWorld(clientX, clientY);
    let bestTile: CalendarTile | null = null;
    let bestDist = Infinity;

    for (const tile of worldRef.current.activeTiles) {
      const pos = gridToScreen(tile.gx, tile.gy);
      const dx = Math.abs(wx - pos.x) / (TILE_W / 2);
      const dy = Math.abs(wy - pos.y) / (TILE_H / 2);
      if (dx + dy <= 1.15) {
        const d = dx + dy;
        if (d < bestDist) {
          bestDist = d;
          bestTile = tile;
        }
      }
    }
    return bestTile;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cam = cameraRef.current;
    cam.isDragging = true;
    cam.dragMoved = false;
    cam.lastMouseX = e.clientX;
    cam.lastMouseY = e.clientY;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cam = cameraRef.current;
    if (cam.isDragging) {
      const dx = e.clientX - cam.lastMouseX;
      const dy = e.clientY - cam.lastMouseY;
      if (Math.hypot(dx, dy) > 4) {
        cam.dragMoved = true;
        cam.manualPan = true;
      }
      if (cam.dragMoved) {
        cam.targetX -= dx / cam.zoom;
        cam.targetY -= dy / cam.zoom;
        cam.x = cam.targetX;
        cam.y = cam.targetY;
      }
      cam.lastMouseX = e.clientX;
      cam.lastMouseY = e.clientY;
    } else {
      const hovered = findTileAtScreenPos(e.clientX, e.clientY);
      hoveredTileIdxRef.current = hovered ? hovered.activeIdx : -1;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cam = cameraRef.current;
    if (!cam.isDragging) return;
    cam.isDragging = false;

    if (!cam.dragMoved) {
      const clicked = findTileAtScreenPos(e.clientX, e.clientY);
      if (clicked) {
        const p = playerRef.current;
        if (clicked.activeIdx === p.tileIndex && p.jumpProgress >= 1) {
          cam.manualPan = false;
          return;
        }
        const cur = worldRef.current.activeTiles[p.tileIndex];
        const diff = cur ? Math.abs(clicked.activeIdx - cur.activeIdx) : 99;
        if (cur && clicked.monthIndex === cur.monthIndex && diff <= 3) {
          const step = clicked.activeIdx > cur.activeIdx ? 1 : -1;
          const queue: number[] = [];
          for (
            let i = cur.activeIdx + step;
            step > 0 ? i <= clicked.activeIdx : i >= clicked.activeIdx;
            i += step
          ) {
            queue.push(i);
          }
          const first = queue.shift();
          p.hopQueue = queue;
          if (typeof first === 'number') startJumpTo(first);
        } else {
          p.hopQueue = [];
          startJumpTo(clicked.activeIdx);
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const cam = cameraRef.current;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    cam.targetZoom = Math.min(1.8, Math.max(0.55, cam.targetZoom * factor));
  };

  const handleZoomStep = (delta: number) => {
    const cam = cameraRef.current;
    cam.targetZoom = Math.min(1.8, Math.max(0.55, cam.targetZoom + delta));
  };

  const handleCenterOnPlayer = () => {
    cameraRef.current.manualPan = false;
    cameraRef.current.targetZoom = 1;
  };

  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nicknameDraft.trim().slice(0, MAX_NICKNAME_LENGTH);
    if (!clean) return;

    localStorage.setItem('bamboo_nickname', clean);
    setNickname(clean);
    setNicknameConfirmed(true);
    setShowNicknameModal(false);

    // Sync updated nickname to user's existing votes in this room
    if (user && room) {
      const myVotes = votesList.filter(
        (v) => v.userId === user.uid && v.nickname !== clean
      );
      if (myVotes.length > 0) {
        const batch = writeBatch(db);
        for (const v of myVotes) {
          batch.update(doc(db, 'rooms', room.id, 'votes', v.id), {
            nickname: clean,
            updatedAt: serverTimestamp(),
          });
        }
        try {
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `rooms/${room.id}/votes`);
        }
      }
    }

    onShowToast(`'${clean}' 정원사로 입장했습니다.`);
  };

  const handleCopyShareUrl = async () => {
    const url = buildRoomUrl(roomId);
    try {
      await navigator.clipboard.writeText(url);
      onShowToast('게임 공유 URL이 복사되었습니다.');
    } catch {
      onShowToast(url);
    }
  };

  const handleToggleMute = () => {
    soundFx.muted = !muted;
    setMuted(!muted);
  };

  // Top 7 Rankings calculation
  const topSevenRankings: DateRankingItem[] = useMemo(() => {
    if (!room) return [];
    const activeTiles = worldRef.current.activeTiles;
    return activeTiles
      .map((tile) => {
        const votes = votesByDate[tile.dateStr] || [];
        return { tile, votes, count: votes.length };
      })
      .filter((item) => item.count > 0)
      .sort(
        (a, b) =>
          b.count - a.count || a.tile.dateStr.localeCompare(b.tile.dateStr)
      )
      .slice(0, 7);
  }, [room, votesByDate]);

  // Loading or waiting for anonymous session
  if (roomLoading || !authReady || !user) {
    return (
      <div className="min-h-screen bg-[#f4f7f2] flex items-center justify-center p-6">
        <div className="text-sm font-medium text-[#4b5b50]">
          달력 월드를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  if (roomNotFound || !room) {
    return (
      <div className="min-h-screen bg-[#f4f7f2] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-emerald-950/10 p-8 shadow-sm text-center">
          <h2 className="text-xl font-bold text-[#18231c]">
            달력 방을 찾을 수 없습니다
          </h2>
          <p className="mt-2 text-sm text-[#4b5b50]">
            링크가 잘못되었거나 방 생성자가 삭제한 방입니다.
          </p>
          <button
            type="button"
            onClick={onBackHome}
            className="mt-6 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#15803d] text-white text-sm font-semibold hover:bg-[#166534] transition-colors cursor-pointer"
          >
            새 방 만들러 가기
          </button>
        </div>
      </div>
    );
  }

  const currentTile = worldRef.current.activeTiles[currentTileIndex] || null;
  const currentVotes = currentTile ? votesByDate[currentTile.dateStr] || [] : [];
  const waterCount = currentVotes.length;
  const iWatered = Boolean(
    user && currentVotes.some((v) => v.userId === user.uid)
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-b from-[#e4f3ea] to-[#f4f7f2] select-none">
      {/* Interactive Isometric Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="block w-full h-full cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Top HUD */}
      <header className="fixed top-3 left-3 right-3 z-10 pointer-events-none flex items-start justify-between gap-3 flex-wrap">
        <div className="pointer-events-auto bg-white/92 backdrop-blur-md rounded-2xl border border-emerald-950/10 px-4 py-2.5 shadow-sm max-w-[300px] sm:max-w-md">
          <h1 className="text-sm sm:text-base font-bold text-[#18231c] truncate">
            {room.title}
          </h1>
          <div className="text-[11px] sm:text-xs text-[#64748b] font-mono tabular-nums">
            {room.startDate} ~ {room.endDate}
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setNicknameDraft(nickname || user?.displayName || '');
              setShowNicknameModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/92 backdrop-blur-md border border-emerald-950/10 text-xs font-semibold text-[#18231c] hover:bg-emerald-50 transition-colors shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserRound className="w-3.5 h-3.5 text-[#15803d]" />
            <span>{nickname || '닉네임 설정'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyShareUrl}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/92 backdrop-blur-md border border-emerald-950/10 text-xs font-semibold text-[#18231c] hover:bg-emerald-50 transition-colors shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>URL 복사</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSummary(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#15803d] text-white text-xs font-semibold hover:bg-[#166534] transition-colors shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>TOP 7 종합 보기</span>
          </button>

          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white/92 backdrop-blur-md border border-emerald-950/10 text-xs font-semibold text-[#4b5b50] hover:text-[#18231c] transition-colors shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>새 방</span>
          </button>
        </div>
      </header>

      {/* Camera & Audio Controls (Right side middle-bottom) */}
      <div className="fixed right-3 bottom-36 sm:bottom-40 z-10 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => handleZoomStep(0.18)}
          className="w-9 h-9 rounded-xl bg-white/92 border border-emerald-950/10 shadow-sm flex items-center justify-center text-[#334155] hover:bg-emerald-50 transition-colors cursor-pointer"
          aria-label="확대"
          title="확대"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => handleZoomStep(-0.18)}
          className="w-9 h-9 rounded-xl bg-white/92 border border-emerald-950/10 shadow-sm flex items-center justify-center text-[#334155] hover:bg-emerald-50 transition-colors cursor-pointer"
          aria-label="축소"
          title="축소"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleCenterOnPlayer}
          className="w-9 h-9 rounded-xl bg-white/92 border border-emerald-950/10 shadow-sm flex items-center justify-center text-[#334155] hover:bg-emerald-50 transition-colors cursor-pointer"
          aria-label="캐릭터 위치로 이동"
          title="캐릭터 위치로"
        >
          <Crosshair className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleToggleMute}
          className="w-9 h-9 rounded-xl bg-white/92 border border-emerald-950/10 shadow-sm flex items-center justify-center text-[#334155] hover:bg-emerald-50 transition-colors cursor-pointer"
          aria-label={muted ? '효과음 켜기' : '효과음 끄기'}
          title={muted ? '효과음 켜기' : '효과음 끄기'}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Bottom Current Tile Action Dock */}
      {currentTile && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-10 w-[calc(100%-24px)] max-w-xl pointer-events-none">
          <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl border border-emerald-950/10 px-4 py-3 sm:px-5 sm:py-3.5 shadow-md">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base sm:text-lg font-bold text-[#18231c] tabular-nums whitespace-nowrap">
                    {formatDisplayDate(currentTile.dateStr)}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="text-xs font-semibold text-[#15803d] whitespace-nowrap">
                    {getGrowthStageLabel(waterCount)}
                  </span>
                </div>

                <div className="mt-0.5 text-xs text-[#4b5b50] truncate">
                  {waterCount === 0 ? (
                    '아직 물을 준 사람이 없습니다'
                  ) : (
                    <span>
                      <strong className="font-semibold text-[#0369a1] tabular-nums">
                        {waterCount}명
                      </strong>{' '}
                      물 줌 ·{' '}
                      {currentVotes
                        .map((v) =>
                          v.userId === user?.uid ? `${v.nickname}(나)` : v.nickname
                        )
                        .join(', ')}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={wateringBusy}
                onClick={toggleWaterCurrentTile}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                  iWatered
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    : 'bg-[#0284c7] text-white hover:bg-[#0369a1]'
                }`}
              >
                <Droplets className="w-4 h-4" />
                <span>{iWatered ? '물 취소' : '물 주기'}</span>
              </button>
            </div>
          </div>

          <div className="hidden sm:block text-center text-[11px] text-[#4b5b50] mt-1.5">
            방향키 / WASD 또는 날짜 클릭으로 점프 · 스페이스바로 물 주기/취소 · 드래그로 화면 이동
          </div>
        </div>
      )}

      {/* Nickname Entry Modal */}
      {showNicknameModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-5"
          role="dialog"
          aria-modal="true"
          aria-label="닉네임 입력"
        >
          <div className="max-w-sm w-full bg-white rounded-2xl border border-emerald-950/10 p-6 shadow-xl">
            <h2 className="text-lg font-bold text-[#18231c]">
              참여자 닉네임 설정
            </h2>
            <p className="mt-1.5 text-sm text-[#4b5b50] leading-relaxed">
              달력에 물을 줄 때 다른 참여자들에게 표시될 닉네임을 입력해 주세요.
            </p>
            <form onSubmit={handleSaveNickname} className="mt-4 space-y-4">
              <input
                type="text"
                value={nicknameDraft}
                onChange={(e) => setNicknameDraft(e.target.value)}
                placeholder="예: 민수, 영희, 대나무왕"
                maxLength={MAX_NICKNAME_LENGTH}
                required
                autoFocus
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-[#18231c] focus:outline-none focus:border-[#15803d] focus:ring-2 focus:ring-[#15803d]/15"
              />
              <div className="flex items-center justify-end gap-2">
                {nicknameConfirmed && (
                  <button
                    type="button"
                    onClick={() => setShowNicknameModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-[#4b5b50] hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    취소
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#15803d] text-white text-sm font-semibold hover:bg-[#166534] transition-colors cursor-pointer"
                >
                  달력 월드로 입장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOP 7 Summary Overlay */}
      {showSummary && (
        <TopSevenSummary
          roomTitle={room.title}
          rankings={topSevenRankings}
          currentUserId={user?.uid || null}
          onSelectDate={(activeIdx) => {
            setShowSummary(false);
            playerRef.current.hopQueue = [];
            startJumpTo(activeIdx);
          }}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}

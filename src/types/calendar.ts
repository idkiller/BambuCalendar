export const MAX_TITLE_LENGTH = 50;
export const MAX_NICKNAME_LENGTH = 24;
export const MAX_ROOM_DAYS = 180;
export const ROOM_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
export const DATE_STR_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface RoomData {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  creatorId: string;
  creatorName: string;
  createdAt?: unknown;
}

export interface VoteRecord {
  id: string;
  roomId: string;
  dateStr: string;
  userId: string;
  nickname: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CalendarTile {
  dateStr: string;
  day: number;
  weekday: number;
  col: number;
  row: number;
  gx: number;
  gy: number;
  isActive: boolean;
  monthIndex: number;
  activeIdx: number;
  bounce: number;
}

export interface MonthIsland {
  year: number;
  month: number;
  label: string;
  offset: number;
  rows: number;
  tiles: CalendarTile[];
}

export interface PlayerState {
  tileIndex: number;
  gx: number;
  gy: number;
  startGx: number;
  startGy: number;
  targetGx: number;
  targetGy: number;
  jumpProgress: number;
  jumpHeight: number;
  facing: number;
  hopQueue: number[];
}

export interface CameraState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  zoom: number;
  targetZoom: number;
  isDragging: boolean;
  dragMoved: boolean;
  lastMouseX: number;
  lastMouseY: number;
  manualPan: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface DateRankingItem {
  tile: CalendarTile;
  votes: VoteRecord[];
  count: number;
}

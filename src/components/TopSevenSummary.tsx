import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { DateRankingItem } from '../types/calendar';
import { drawPlant } from '../utils/bambooRenderer';
import { formatShortDate } from '../utils/dateUtils';

interface MiniPlantStageProps {
  count: number;
  seed: number;
}

function MiniPlantStage({ count, seed }: MiniPlantStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const render = (now: number) => {
      const time = now / 1000;
      const dpr = window.devicePixelRatio || 1;
      const w = 116;
      const h = 216;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      drawPlant(ctx, w / 2, h - 14, count, time, seed, 1.08);
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [count, seed]);

  return <canvas ref={canvasRef} className="w-[116px] h-[216px] block mx-auto" />;
}

interface TopSevenSummaryProps {
  roomTitle: string;
  rankings: DateRankingItem[];
  currentUserId: string | null;
  onSelectDate: (activeIdx: number) => void;
  onClose: () => void;
}

export function TopSevenSummary({
  roomTitle,
  rankings,
  currentUserId,
  onSelectDate,
  onClose,
}: TopSevenSummaryProps) {
  return (
    <div
      className="fixed inset-0 z-40 bg-gradient-to-b from-[#e4f3ea] to-[#f4f7f2] overflow-y-auto p-5 md:p-8 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="가장 큰 대나무 TOP 7 종합 보기"
    >
      <div className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#18231c]">
            가장 큰 대나무 TOP 7
          </h2>
          <p className="mt-1 text-sm text-[#4b5b50]">
            {roomTitle} · 물을 많이 받은 상위 최대 7개 날짜
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-emerald-950/15 text-sm font-semibold text-[#18231c] hover:bg-emerald-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>달력으로 돌아가기</span>
        </button>
      </div>

      <div className="max-w-6xl w-full mx-auto flex-1 bg-white/90 rounded-2xl border border-emerald-950/10 p-6 md:p-8 shadow-sm flex flex-col justify-between">
        {rankings.length === 0 ? (
          <div className="m-auto text-center py-16 px-4">
            <div className="text-lg font-bold text-[#18231c]">
              아직 물을 받은 날짜가 없습니다
            </div>
            <p className="mt-2 text-sm text-[#64748b] max-w-md mx-auto">
              달력으로 돌아가 원하는 날짜에 물을 주면, 가장 많이 자라난 최대 7개의 죽순과 대나무가 이곳에 크기순으로 나란히 섭니다.
            </p>
          </div>
        ) : (
          <div className="flex items-end justify-start xl:justify-center gap-4 overflow-x-auto pt-4 pb-3 border-b-4 border-[#8d6e63]">
            {rankings.map((item, idx) => {
              const rank = idx + 1;
              const voterNames = item.votes
                .map((v) =>
                  v.userId === currentUserId ? `${v.nickname}(나)` : v.nickname
                )
                .join(', ');

              return (
                <button
                  key={item.tile.dateStr}
                  type="button"
                  onClick={() => onSelectDate(item.tile.activeIdx)}
                  className="flex-none w-[132px] bg-[#f8faf7] hover:bg-emerald-50/70 border border-emerald-950/10 hover:border-emerald-700/40 rounded-t-2xl rounded-b-lg p-3 text-center transition-transform hover:-translate-y-1 cursor-pointer flex flex-col items-center"
                >
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      rank === 1
                        ? 'text-amber-700'
                        : rank === 2
                          ? 'text-slate-600'
                          : rank === 3
                            ? 'text-orange-700'
                            : 'text-[#4b5b50]'
                    }`}
                  >
                    {rank}위
                  </span>

                  <MiniPlantStage count={item.count} seed={idx * 1.3} />

                  <div className="mt-2 text-sm font-bold text-[#18231c] tabular-nums whitespace-nowrap">
                    {formatShortDate(item.tile.dateStr)}
                  </div>
                  <div className="mt-0.5 text-xs font-bold text-[#0369a1] tabular-nums">
                    물 {item.count}회
                  </div>
                  <div className="mt-1.5 text-[11px] text-[#64748b] leading-snug line-clamp-3 break-keep">
                    {voterNames}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-center text-xs text-[#64748b]">
          날짜 카드를 클릭하면 달력 월드에서 해당 날짜 타일로 바로 점프합니다.
        </div>
      </div>
    </div>
  );
}

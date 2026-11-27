import React, { useEffect, useState } from 'react';
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
} from 'firebase/firestore';
import { Calendar, Copy, ExternalLink, Plus, Trash2 } from 'lucide-react';
import {
  db,
  ensureAnonymousAuth,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  MAX_NICKNAME_LENGTH,
  MAX_ROOM_DAYS,
  MAX_TITLE_LENGTH,
  RoomData,
} from '../types/calendar';
import {
  buildRoomUrl,
  daysBetween,
  formatDate,
  generateRoomId,
} from '../utils/dateUtils';
import { GardenPreviewCanvas } from './GardenPreviewCanvas';

interface CreateRoomViewProps {
  user: User | null;
  authReady: boolean;
  onEnterRoom: (roomId: string) => void;
  onShowToast: (msg: string) => void;
}

export function CreateRoomView({
  user,
  authReady,
  onEnterRoom,
  onShowToast,
}: CreateRoomViewProps) {
  const today = new Date();
  const threeWeeksLater = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 21
  );

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(formatDate(today));
  const [endDate, setEndDate] = useState(formatDate(threeWeeksLater));
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);
  const [myRooms, setMyRooms] = useState<RoomData[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  useEffect(() => {
    if (!authReady || !user) {
      setMyRooms([]);
      return;
    }

    setLoadingRooms(true);
    const roomsQuery = query(
      collection(db, 'rooms'),
      where('creatorId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      roomsQuery,
      (snapshot) => {
        const list: RoomData[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title || ''),
            startDate: String(data.startDate || ''),
            endDate: String(data.endDate || ''),
            creatorId: String(data.creatorId || ''),
            creatorName: String(data.creatorName || ''),
            createdAt: data.createdAt,
          };
        });
        list.sort((a, b) => b.startDate.localeCompare(a.startDate));
        setMyRooms(list);
        setLoadingRooms(false);
      },
      (err) => {
        setLoadingRooms(false);
        handleFirestoreError(err, OperationType.LIST, 'rooms');
      }
    );

    return () => unsubscribe();
  }, [authReady, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanTitle = title.trim().slice(0, MAX_TITLE_LENGTH);
    if (!cleanTitle) {
      setFormError('모임 또는 이벤트 제목을 입력해 주세요.');
      return;
    }
    if (!startDate || !endDate) {
      setFormError('시작 날짜와 종료 날짜를 모두 선택해 주세요.');
      return;
    }
    if (startDate > endDate) {
      setFormError('종료 날짜는 시작 날짜와 같거나 늦어야 합니다.');
      return;
    }
    const diff = daysBetween(startDate, endDate);
    if (diff > MAX_ROOM_DAYS) {
      setFormError(`최대 ${MAX_ROOM_DAYS}일(약 6개월) 이내의 기간으로 설정해 주세요.`);
      return;
    }

    setCreating(true);
    try {
      const activeUser = user || (await ensureAnonymousAuth());
      const roomId = generateRoomId();
      const storedNick = localStorage.getItem('bamboo_nickname')?.trim();
      const creatorName = (storedNick || '정원사')
        .trim()
        .slice(0, MAX_NICKNAME_LENGTH);

      const path = `rooms/${roomId}`;
      try {
        await setDoc(doc(db, 'rooms', roomId), {
          title: cleanTitle,
          startDate,
          endDate,
          creatorId: activeUser.uid,
          creatorName,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }

      const shareUrl = buildRoomUrl(roomId);
      try {
        await navigator.clipboard.writeText(shareUrl);
        onShowToast('방이 생성되었고 공유 URL이 클립보드에 복사되었습니다.');
      } catch {
        onShowToast('방이 생성되었습니다. 상단 URL 복사 버튼으로 공유하세요.');
      }

      onEnterRoom(roomId);
    } catch (err) {
      if (err instanceof Error && !err.message.startsWith('{')) {
        setFormError('방 생성 중 오류가 발생했습니다. 다시 시도해 주세요.');
      } else {
        throw err;
      }
    } finally {
      setCreating(false);
    }
  };

  const handleCopyRoomUrl = async (roomId: string) => {
    const shareUrl = buildRoomUrl(roomId);
    try {
      await navigator.clipboard.writeText(shareUrl);
      onShowToast('공유 URL이 복사되었습니다.');
    } catch {
      onShowToast(shareUrl);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    const path = `rooms/${roomId}`;
    try {
      await deleteDoc(doc(db, 'rooms', roomId));
      onShowToast('달력 방을 삭제했습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const focusTitleInput = () => {
    const el = document.getElementById('room-title');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7f2] text-[#18231c] flex flex-col">
      {/* 3-Zone Top Bar */}
      <header className="border-b border-emerald-950/10 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <a
            href="./"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-lg font-bold tracking-tight text-[#14532d] whitespace-nowrap shrink-0 font-display"
          >
            Bamboo Calendar
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#4b5b50]">
            <button
              type="button"
              onClick={() => scrollToSection('create-form-panel')}
              className="hover:text-[#18231c] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              방 만들기
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('growth-preview-panel')}
              className="hover:text-[#18231c] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              성장 규칙
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('my-rooms-section')}
              className="hover:text-[#18231c] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              내 방 목록
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={focusTitleInput}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#15803d] text-xs font-semibold text-white hover:bg-[#166534] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>새 방 만들기</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 md:py-14 space-y-12">
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Form */}
          <div
            id="create-form-panel"
            className="lg:col-span-6 bg-white rounded-2xl border border-emerald-950/10 p-7 md:p-9 shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="text-xs font-semibold text-[#15803d] tracking-wide mb-2">
                로그인 없이 바로 시작하는 일정 조율 게임
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#18231c] tracking-tight leading-tight">
                우리 언제 만날까?
              </h1>
              <p className="mt-3 text-sm md:text-base text-[#4b5b50] leading-relaxed">
                기간을 정해 달력 방 URL을 공유하세요. 별도 회원가입 없이 닉네임만으로 접속해 원하는 날짜에 물을 주고 대나무를 함께 키울 수 있습니다.
              </p>

              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                <div>
                  <label
                    htmlFor="room-title"
                    className="block text-xs font-semibold text-[#334155] mb-1.5"
                  >
                    모임 / 이벤트 제목
                  </label>
                  <input
                    id="room-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="예: 연말 송년회 날짜 정하기"
                    maxLength={MAX_TITLE_LENGTH}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm text-[#18231c] placeholder:text-slate-400 focus:outline-none focus:border-[#15803d] focus:ring-2 focus:ring-[#15803d]/15"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="start-date"
                      className="block text-xs font-semibold text-[#334155] mb-1.5"
                    >
                      시작 날짜
                    </label>
                    <input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-mono tabular-nums text-[#18231c] focus:outline-none focus:border-[#15803d] focus:ring-2 focus:ring-[#15803d]/15"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="end-date"
                      className="block text-xs font-semibold text-[#334155] mb-1.5"
                    >
                      종료 날짜
                    </label>
                    <input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-mono tabular-nums text-[#18231c] focus:outline-none focus:border-[#15803d] focus:ring-2 focus:ring-[#15803d]/15"
                    />
                  </div>
                </div>

                {formError && (
                  <p className="text-xs font-medium text-rose-600" role="alert">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={creating || !authReady}
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-[#15803d] text-white text-sm font-semibold hover:bg-[#166534] disabled:opacity-60 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {creating
                      ? '달력 방 생성 중...'
                      : !authReady
                        ? '연결 준비 중...'
                        : '게임 방 만들고 URL 받기'}
                  </span>
                </button>
              </form>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#64748b]">
              <span>최대 180일 기간 지원</span>
              <span aria-hidden="true">·</span>
              <span>월별 독립 섬 배치</span>
              <span aria-hidden="true">·</span>
              <span>실시간 공동 물주기 및 취소</span>
            </div>
          </div>

          {/* Right Column: Live Isometric Preview */}
          <div
            id="growth-preview-panel"
            className="lg:col-span-6 bg-white rounded-2xl border border-emerald-950/10 p-7 md:p-9 shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-[#18231c]">
                  쿼터뷰 달력 & 대나무 성장 단계
                </h2>
                <span className="text-xs text-[#64748b] whitespace-nowrap">
                  실시간 미리보기
                </span>
              </div>
              <p className="mt-1.5 text-sm text-[#4b5b50]">
                한 브라우저당 날짜별 1회 물을 줄 수 있고, 언제든 물주기를 취소할 수 있습니다.
              </p>
            </div>

            <div className="my-4 rounded-xl bg-gradient-to-b from-[#e8f4ec] to-[#f4f9ef] border border-emerald-950/5 overflow-hidden">
              <GardenPreviewCanvas />
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs">
              <div>
                <div className="font-semibold text-[#18231c]">0회 · 빈 흙</div>
                <div className="mt-0.5 text-[#64748b]">아직 물이 없는 날짜</div>
              </div>
              <div>
                <div className="font-semibold text-[#0369a1]">1~3회 · 죽순</div>
                <div className="mt-0.5 text-[#64748b]">물을 줄수록 통통하게 성장</div>
              </div>
              <div>
                <div className="font-semibold text-[#15803d]">4회+ · 대나무</div>
                <div className="mt-0.5 text-[#64748b]">마디가 추가되며 하늘로 성장</div>
              </div>
            </div>
          </div>
        </section>

        {/* My Created Rooms */}
        <section id="my-rooms-section" className="pt-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#18231c]">이 브라우저에서 만든 방</h2>
            <span className="text-xs text-[#64748b]">
              로그인 없이 현재 브라우저 기준으로 자동 저장됩니다
            </span>
          </div>

          {!authReady || loadingRooms ? (
            <div className="bg-white rounded-2xl border border-emerald-950/10 p-6 text-sm text-[#64748b]">
              방 목록을 불러오는 중입니다...
            </div>
          ) : myRooms.length === 0 ? (
            <div className="bg-white rounded-2xl border border-emerald-950/10 p-6 text-sm text-[#64748b]">
              아직 만든 달력 방이 없습니다. 위에서 첫 번째 일정 조율 방을 만들어 보세요.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myRooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-white rounded-2xl border border-emerald-950/10 p-5 flex flex-col justify-between gap-4 hover:border-emerald-700/30 transition-colors"
                >
                  <div>
                    <h3 className="font-bold text-base text-[#18231c] truncate">
                      {room.title}
                    </h3>
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-[#64748b] font-mono tabular-nums">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {room.startDate} ~ {room.endDate}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onEnterRoom(room.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#15803d] text-white text-xs font-semibold hover:bg-[#166534] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>입장하기</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyRoomUrl(room.id)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 text-[#334155] text-xs font-semibold hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        title="URL 복사"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>복사</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRoom(room.id)}
                        className="inline-flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="방 삭제"
                        aria-label={`${room.title} 방 삭제`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

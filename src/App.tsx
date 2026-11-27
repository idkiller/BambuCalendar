import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, ensureAnonymousAuth } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CreateRoomView } from './components/CreateRoomView';
import { GameWorldView } from './components/GameWorldView';

function getRoomIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('room');
  return id && id.trim() ? id.trim() : null;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() =>
    getRoomIdFromUrl()
  );
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastVisible, setToastVisible] = useState(false);

  const initAnonymousSession = useCallback(async () => {
    setAuthError(null);
    try {
      const anonUser = await ensureAnonymousAuth();
      setUser(anonUser);
      setAuthReady(true);
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (
        code === 'auth/operation-not-allowed' ||
        code === 'auth/admin-restricted-operation'
      ) {
        setAuthError(
          'Firebase 콘솔(gen-lang-client-0647769024)의 Authentication → Sign-in method에서 "익명(Anonymous)" 로그인을 활성화해 주세요.'
        );
      } else {
        setAuthError(
          '익명 세션 연결 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
        );
      }
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (nextUser) {
        setUser(nextUser);
        setAuthError(null);
        setAuthReady(true);
      } else {
        void initAnonymousSession();
      }
    });
    return () => unsubscribe();
  }, [initAnonymousSession]);

  useEffect(() => {
    const handlePopState = () => {
      setActiveRoomId(getRoomIdFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    window.clearTimeout((showToast as { _timer?: number })._timer);
    (showToast as { _timer?: number })._timer = window.setTimeout(() => {
      setToastVisible(false);
    }, 2400);
  }, []);

  const navigateToRoom = useCallback((roomId: string) => {
    const url = new URL(window.location.href);
    url.search = `?room=${encodeURIComponent(roomId)}`;
    url.hash = '';
    window.history.pushState({}, '', url.toString());
    setActiveRoomId(roomId);
  }, []);

  const navigateHome = useCallback(() => {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    window.history.pushState({}, '', url.toString());
    setActiveRoomId(null);
  }, []);

  if (authReady && authError && !user) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-[#f4f7f2] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-emerald-950/10 p-8 shadow-sm">
            <div className="text-xs font-semibold text-[#15803d] mb-2">
              Bamboo Calendar
            </div>
            <h1 className="text-xl font-bold text-[#18231c]">
              익명 접속 설정이 필요합니다
            </h1>
            <p className="mt-2.5 text-sm text-[#4b5b50] leading-relaxed">
              {authError}
            </p>
            <button
              type="button"
              onClick={() => void initAnonymousSession()}
              className="mt-6 w-full py-2.5 px-4 rounded-xl bg-[#15803d] text-white text-sm font-semibold hover:bg-[#166534] transition-colors cursor-pointer"
            >
              설정 완료 후 다시 연결
            </button>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      {activeRoomId ? (
        <GameWorldView
          roomId={activeRoomId}
          user={user}
          authReady={authReady}
          onBackHome={navigateHome}
          onShowToast={showToast}
        />
      ) : (
        <CreateRoomView
          user={user}
          authReady={authReady}
          onEnterRoom={navigateToRoom}
          onShowToast={showToast}
        />
      )}

      <div
        role="status"
        aria-live="polite"
        className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#18231c]/90 text-white text-xs sm:text-sm font-medium shadow-lg pointer-events-none transition-all duration-200 ${
          toastVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2'
        }`}
      >
        {toastMessage}
      </div>
    </ErrorBoundary>
  );
}

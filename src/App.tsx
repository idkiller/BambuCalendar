import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
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
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() =>
    getRoomIdFromUrl()
  );
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

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

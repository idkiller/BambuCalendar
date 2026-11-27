import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || '예기치 않은 오류가 발생했습니다.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      let displayDetail = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed && parsed.error) {
          displayDetail = `${parsed.error} (${parsed.operationType || 'read/write'})`;
        }
      } catch {
        // Non-JSON error message
      }

      return (
        <div className="min-h-screen bg-[#f4f7f2] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-emerald-950/10 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-[#18231c]">잠시 문제가 발생했습니다</h2>
            <p className="mt-2 text-sm text-[#4b5b50] leading-relaxed">
              데이터를 불러오거나 저장하는 중 오류가 발생했습니다. 로그인 상태를 확인한 뒤 다시 시도해 주세요.
            </p>
            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600 break-words">
              {displayDetail}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 w-full py-2.5 px-4 rounded-xl bg-[#15803d] text-white text-sm font-semibold hover:bg-[#166534] transition-colors cursor-pointer"
            >
              새로고침하기
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

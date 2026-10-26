import React, { StrictMode, Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled app error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" className="min-h-screen bg-[#FAF9F8] text-[#242424] flex items-center justify-center p-4 font-sans">
          <div className="bg-white border border-[#EDEBE9] rounded-[4px] p-6 max-w-md w-full shadow-md text-center space-y-4">
            <div className="w-10 h-10 bg-[#EFF6FC] text-[#0078D4] rounded-[4px] flex items-center justify-center mx-auto text-lg font-bold">
              Rx
            </div>
            <div>
              <h1 className="text-base font-bold text-[#242424]">حدث خطأ في تحميل الصفحة</h1>
              <p className="text-xs text-[#605E5C] mt-1">
                تم حفظ بياناتك محلياً بشكل آمن. يمكنك النقر على الزر لإعادة التشغيل فوراً.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#0078D4] hover:bg-[#106EBE] text-white rounded-[4px] text-xs font-semibold cursor-pointer transition-colors"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

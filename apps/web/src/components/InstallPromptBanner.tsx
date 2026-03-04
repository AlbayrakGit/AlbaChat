/**
 * PWA "Ana Ekrana Ekle" banner bileşeni.
 * useInstallPrompt hook'u ile çalışır.
 */
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export function InstallPromptBanner() {
  const { isInstallable, install, dismiss } = useInstallPrompt();

  if (!isInstallable) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white dark:bg-gray-800 shadow-lg rounded-2xl px-4 py-3 max-w-sm w-[calc(100%-2rem)] border border-gray-200 dark:border-gray-700">
      {/* İkon */}
      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>

      {/* Metin */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
          AlbaChat'i Yükle
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Ana ekrana ekleyerek hızlı erişin
        </p>
      </div>

      {/* Butonlar */}
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={dismiss}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1 py-1"
          aria-label="Kapat"
        >
          ✕
        </button>
        <button
          onClick={install}
          className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 transition-colors"
        >
          Yükle
        </button>
      </div>
    </div>
  );
}

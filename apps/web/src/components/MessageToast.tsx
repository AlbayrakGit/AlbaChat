import { useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { MessageSquare, X } from 'lucide-react';

export default function MessageToast() {
    const { toast, clearToast } = useUIStore();

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => {
                clearToast();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [toast, clearToast]);

    if (!toast) return null;

    return (
        <div className="fixed top-20 right-4 z-[9999] animate-slide-up">
            <div className="bg-white dark:bg-gray-800 border border-blue-100 dark:border-gray-700 shadow-2xl rounded-2xl p-4 flex items-start gap-4 min-w-[320px] max-w-md pointer-events-auto">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0">
                    <MessageSquare className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-tighter mb-1">
                        YENİ MESAJ
                    </p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                        {toast.sender}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-snug">
                        {toast.message}
                    </p>
                </div>

                <button
                    onClick={clearToast}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

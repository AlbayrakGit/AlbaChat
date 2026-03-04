import type { FileUploadItem } from '@/hooks/useFileUpload';
import { FileIcon, ImageIcon, FileText, FileSpreadsheet, FileAudio, FileVideo, FileArchive, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  const className = "w-5 h-5 text-primary opacity-80 stroke-[1.5px]";
  if (mimeType.startsWith('image/')) return <ImageIcon className={className} />;
  if (mimeType === 'application/pdf') return <FileText className={className} />;
  if (mimeType.startsWith('video/')) return <FileVideo className={className} />;
  if (mimeType.startsWith('audio/')) return <FileAudio className={className} />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet className={className} />;
  if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className={className} />;
  if (mimeType === 'application/zip' || mimeType.includes('rar')) return <FileArchive className={className} />;
  return <FileIcon className={className} />;
}

interface Props {
  uploads: FileUploadItem[];
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function FileUploadProgress({ uploads, onCancel, onRemove }: Props) {
  if (uploads.length === 0) return null;

  return (
    <div className="px-6 pt-3 pb-1 space-y-2 max-h-48 overflow-y-auto mb-2 no-scrollbar max-w-5xl mx-auto w-full">
      {uploads.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 bg-white/40 dark:bg-black/20 backdrop-blur-md border border-black/5 dark:border-white/5 shadow-sm rounded-2xl px-4 py-2.5 transition-all duration-300 animate-slide-up group/upload"
        >
          <div className="p-2 bg-primary/10 rounded-xl">
            <FileTypeIcon mimeType={item.file.type} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="text-[13px] font-semibold text-foreground tracking-tight truncate">{item.file.name}</span>
              <span className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground flex-shrink-0">{formatSize(item.file.size)}</span>
            </div>

            {item.status === 'uploading' && (
              <div className="w-full bg-black/5 dark:bg-white/5 rounded-full h-1 overflow-hidden relative">
                <div
                  className="bg-primary h-1 rounded-full transition-all duration-200"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            )}

            {item.status === 'done' && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase text-emerald-500">
                <CheckCircle2 className="w-[14px] h-[14px]" strokeWidth={2.5} />
                Gönderildi
              </div>
            )}

            {item.status === 'error' && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase text-destructive">
                <AlertCircle className="w-[14px] h-[14px]" strokeWidth={2.5} />
                Hata: {item.error}
              </div>
            )}

            {item.status === 'pending' && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
                <Loader2 className="w-[14px] h-[14px] animate-spin" />
                Bekliyor...
              </div>
            )}
          </div>

          <button
            onClick={() =>
              item.status === 'done' || item.status === 'error'
                ? onRemove(item.id)
                : onCancel(item.id)
            }
            className="p-1.5 text-muted-foreground/50 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 flex-shrink-0 rounded-xl transition-all duration-300 active:scale-95 opacity-0 group-hover/upload:opacity-100"
            title="İptal / Kaldır"
          >
            <X className="w-[18px] h-[18px] stroke-[2.5px]" />
          </button>
        </div>
      ))}
    </div>
  );
}

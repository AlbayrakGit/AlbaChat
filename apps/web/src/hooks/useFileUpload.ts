import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { apiClient } from '@/api/client';
import type { FileInfo } from '@/store/chatStore';

export interface FileUploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  uploadedFile?: FileInfo;
  error?: string;
  abort?: () => void;
}

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/ogg', 'audio/wav',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MAX_SIZE_MB = 50;

export function useFileUpload(groupId: number) {
  const [uploads, setUploads] = useState<FileUploadItem[]>([]);
  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;

  const startUpload = useCallback((item: FileUploadItem) => {
    // İstemci tarafı boyut ve tür kontrolü
    if (item.file.size > MAX_SIZE_MB * 1024 * 1024) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === item.id
            ? { ...u, status: 'error', error: `Dosya ${MAX_SIZE_MB}MB'dan büyük olamaz.` }
            : u,
        ),
      );
      return;
    }

    const controller = new AbortController();

    setUploads((prev) =>
      prev.map((u) =>
        u.id === item.id
          ? { ...u, status: 'uploading', abort: () => controller.abort() }
          : u,
      ),
    );

    const formData = new FormData();
    formData.append('file', item.file);

    apiClient
      .post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Group-Id': String(groupIdRef.current),
        },
        signal: controller.signal,
        onUploadProgress: (evt) => {
          const progress = evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0;
          setUploads((prev) =>
            prev.map((u) => (u.id === item.id ? { ...u, progress } : u)),
          );
        },
      })
      .then((res) => {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id
              ? { ...u, status: 'done', progress: 100, uploadedFile: res.data.data }
              : u,
          ),
        );
      })
      .catch((err) => {
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id
              ? {
                  ...u,
                  status: 'error',
                  error: err.response?.data?.error?.message || 'Yükleme başarısız.',
                }
              : u,
          ),
        );
      });
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      const valid = files.filter((f) => {
        if (!ACCEPTED_TYPES.includes(f.type) && f.type !== '') {
          console.warn('[useFileUpload] Desteklenmeyen tür:', f.type);
        }
        return true; // Sunucu magic bytes kontrolü yapacak
      });

      const items: FileUploadItem[] = valid.map((file) => ({
        id: uuidv4(),
        file,
        status: 'pending',
        progress: 0,
      }));

      setUploads((prev) => [...prev, ...items]);
      items.forEach((item) => startUpload(item));
    },
    [startUpload],
  );

  const cancelUpload = useCallback((id: string) => {
    setUploads((prev) => {
      const item = prev.find((u) => u.id === id);
      item?.abort?.();
      return prev.filter((u) => u.id !== id);
    });
  }, []);

  const removeUpload = useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setUploads((prev) => {
      prev.forEach((u) => u.abort?.());
      return [];
    });
  }, []);

  return { uploads, addFiles, cancelUpload, removeUpload, clearAll };
}

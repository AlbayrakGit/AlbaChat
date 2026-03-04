// ─── Kullanıcı ───────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'user';

export interface User {
  id: number;
  username: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  is_online: boolean;
  last_seen: string | null;
  timezone: string;
  last_seen_message_id: number | null;
  created_at: string;
}

export interface UserPublic {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string | null;
}

// ─── Grup ─────────────────────────────────────────────────────────────────────

export type GroupType = 'direct' | 'department' | 'private';
export type GroupMemberRole = 'owner' | 'admin' | 'member';

export interface Group {
  id: number;
  name: string;
  description: string | null;
  type: GroupType;
  department_code: string | null;
  created_by: number;
  is_archived: boolean;
  created_at: string;
}

export interface GroupMember {
  id: number;
  group_id: number;
  user_id: number;
  role: GroupMemberRole;
  joined_at: string;
  added_by: number | null;
}

export interface GroupWithMeta extends Group {
  unread_count?: number;
  last_message?: MessagePreview | null;
  members?: UserPublic[];
}

// ─── Mesaj ────────────────────────────────────────────────────────────────────

export type MessageType = 'text' | 'image' | 'file' | 'system';

export interface Message {
  id: number;
  group_id: number;
  sender_id: number;
  content: string | null;
  type: MessageType;
  file_id: number | null;
  reply_to_id: number | null;
  idempotency_key: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageWithSender extends Message {
  sender: UserPublic;
  file?: FileMeta | null;
  reply_to?: Message | null;
  read_by?: number[];
}

export interface MessagePreview {
  id: number;
  content: string | null;
  type: MessageType;
  sender_display_name: string;
  created_at: string;
}

// ─── Dosya ────────────────────────────────────────────────────────────────────

export interface FileMeta {
  id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  storage_bucket: string;
  uploaded_by: number;
  group_id: number;
  created_at: string;
  is_deleted: boolean;
}

// ─── Duyuru ───────────────────────────────────────────────────────────────────

export type AnnouncementScope = 'global' | 'group';
export type AnnouncementPriority = 'normal' | 'urgent';

export interface Announcement {
  id: number;
  title: string;
  content: string;
  scope: AnnouncementScope;
  priority: AnnouncementPriority;
  created_by: number;
  expires_at: string | null;
  created_at: string;
}

export interface AnnouncementWithMeta extends Announcement {
  is_read?: boolean;
  read_count?: number;
  total_users?: number;
}

// ─── Dosya Temizleme Politikası ───────────────────────────────────────────────

export type CleanupAction = 'delete' | 'archive';

export interface FileCleanupPolicy {
  id: number;
  name: string;
  max_age_days: number | null;
  max_size_mb: number | null;
  scope: 'global' | 'group';
  group_id: number | null;
  mime_type_filter: string | null;
  action: CleanupAction;
  cron_expression: string;
  is_active: boolean;
  last_run_at: string | null;
  created_by: number;
  created_at: string;
}

// ─── Sistem Ayarları ──────────────────────────────────────────────────────────

export interface SystemSetting {
  key: string;
  value: string;
  updated_by: number | null;
  updated_at: string;
}

export type SystemSettingsMap = {
  port: string;
  timezone: string;
  max_file_size_mb: string;
  allowed_file_types: string;
  registration_open: string;
  app_name: string;
  logo_url: string;
  announcement_sound: string;
  ws_timeout_seconds: string;
};

// ─── API Yanıt Formatı ────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    has_more?: boolean;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthPayload {
  sub: number;
  username: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: UserPublic & { role: UserRole };
}

// ─── WebSocket Eventleri ──────────────────────────────────────────────────────

export interface CatchupPayload {
  lastMessageIds: Record<string, number>;
}

export interface MessageSendPayload {
  groupId: number;
  content: string;
  type: MessageType;
  fileId?: number;
  replyToId?: number;
  idempotencyKey: string;
}

export interface TypingPayload {
  groupId: number;
}

export interface ReadAckPayload {
  messageIds: number[];
  groupId: number;
}

// ─── Bildirim ─────────────────────────────────────────────────────────────────

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  reference_id: number | null;
  reference_type: string | null;
  is_read: boolean;
  created_at: string;
}

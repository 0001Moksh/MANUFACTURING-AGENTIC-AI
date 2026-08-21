import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { api } from '../../services/api';
import { useStore } from '../../store';

interface NotificationItem { id: number; category: string; title: string; message: string; is_read: boolean; created_at: string; }

export const Topbar: React.FC = () => {
  const token = useStore((state) => state.token);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const loadNotifications = async () => {
    if (!token) return;
    try { setNotifications((await api.get<NotificationItem[]>('/notifications')).data); } catch { /* backend remains the source of truth */ }
  };
  useEffect(() => { void loadNotifications(); const timer = window.setInterval(() => void loadNotifications(), 30_000); return () => window.clearInterval(timer); }, [token]);
  const markRead = async (notification: NotificationItem) => {
    if (!notification.is_read) {
      await api.post(`/notifications/${notification.id}/read`);
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
    }
  };
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  return (
    <header className="h-[42px] shrink-0 border-b border-border-color bg-canvas/95 backdrop-blur-sm flex items-center justify-end px-4 sm:px-6 sticky top-0 z-30">
      <div className="relative">
        <button onClick={() => { setOpen((value) => !value); if (!open) void loadNotifications(); }} className="relative w-8 h-8 rounded-lg border border-transparent hover:border-border-color hover:bg-panel text-muted hover:text-ink transition-colors cursor-pointer bg-transparent flex items-center justify-center" aria-label="Notifications">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red text-white text-[9px] leading-4 font-extrabold">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </button>
        {open && <div className="absolute right-0 top-10 z-40 w-[360px] max-w-[calc(100vw-32px)] rounded-[14px] border border-border-color bg-panel shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-color"><div><div className="font-head font-bold text-[14px] text-ink">Notifications</div><div className="text-[10.5px] text-muted">Centralized platform activity</div></div><button onClick={() => setOpen(false)} className="p-1 text-muted hover:text-ink bg-transparent border-none cursor-pointer"><X className="w-4 h-4" /></button></div>
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? <div className="p-6 text-center text-[12px] text-muted">No notifications yet.</div> : notifications.map((notification) => <button key={notification.id} onClick={() => void markRead(notification)} className={`w-full text-left px-4 py-3 border-b border-border-color last:border-b-0 cursor-pointer transition-colors ${notification.is_read ? 'bg-panel hover:bg-canvas' : 'bg-teal-tint/35 hover:bg-teal-tint/55'}`}><div className="flex gap-2.5"><span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${notification.is_read ? 'bg-[#C7CEDB]' : notification.category === 'human_intervention' ? 'bg-amber' : 'bg-teal'}`} /><div className="min-w-0 flex-1"><div className={`text-[12px] text-ink ${notification.is_read ? 'font-medium' : 'font-bold'}`}>{notification.title}</div><div className="mt-0.5 text-[11px] leading-relaxed text-muted">{notification.message}</div><div className="mt-1 text-[10px] text-faint">{new Date(notification.created_at).toLocaleString()}</div></div>{!notification.is_read && <CheckCheck className="w-3.5 h-3.5 text-teal shrink-0" />}</div></button>)}
          </div>
        </div>}
      </div>
    </header>
  );
};

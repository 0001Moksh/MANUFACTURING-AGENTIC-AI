import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useStore } from '../../store';

interface NotificationItem {
  id: number;
  category: string;
  title: string;
  message: string;
  source_type?: string;
  source_id?: string;
  is_read: boolean;
  created_at: string;
}

interface Approval {
  approval_key: string;
  status: string;
  report_url?: string;
}

export const Topbar: React.FC = () => {
  const token = useStore((state) => state.token);
  const navigate = useNavigate();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);

  const loadNotifications = async () => {
    if (!token) return;
    try {
      const [notificationResponse, approvalResponse] = await Promise.all([
        api.get<NotificationItem[]>('/notifications'),
        api.get<Approval[]>('/report-approvals'),
      ]);
      setNotifications(notificationResponse.data);
      setApprovals(approvalResponse.data);
    } catch {
      /* API is the source of truth; leave the last known state visible. */
    }
  };

  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(), 30_000);
    return () => window.clearInterval(timer);
  }, [token]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const markRead = async (notification: NotificationItem) => {
    if (notification.is_read) return;
    await api.post(`/notifications/${notification.id}/read`);
    setNotifications((items) =>
      items.map((item) =>
        item.id === notification.id ? { ...item, is_read: true } : item
      )
    );
  };

  const openNotification = async (notification: NotificationItem) => {
    await markRead(notification);
    setOpen(false);
    navigate('/admin?pane=notifications');
  };

  const decide = async (approvalKey: string, decision: 'approve' | 'reject') => {
    await api.post(`/report-approvals/${approvalKey}/${decision}`, { note: '' });
    setApprovals((items) =>
      items.map((item) =>
        item.approval_key === approvalKey
          ? { ...item, status: decision === 'approve' ? 'SENT' : 'REJECTED' }
          : item
      )
    );
    await loadNotifications();
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const pendingFor = (notification: NotificationItem) =>
    approvals.find(
      (approval) =>
        approval.approval_key === notification.source_id &&
        approval.status === 'PENDING_APPROVAL'
    );

  return (
    // Fixed top-right — does not take space in layout / scrollbar
    <div
      ref={popoverRef}
      className="fixed top-1 right-6 z-50"
    >
      <button
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void loadNotifications();
        }}
        className="relative w-9 h-9 transition-colors cursor-pointer flex items-center justify-center"
        aria-label="Notifications"
      >
        <Bell className="w-6 text-muted h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-red text-white text-[9px] leading-[17px] font-extrabold text-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
      <div className="absolute right-6 top-8 z-50 w-[380px] max-w-[calc(100vw-32px)] rounded-[14px] border border-border-color bg-panel shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-color">
            <div>
              <div className="font-head font-bold text-[14px] text-ink">
                Notifications
              </div>
              <div className="text-[10.5px] text-muted">
                Centralized platform activity
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 text-muted hover:text-ink bg-transparent border-none cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-muted">
                No notifications yet.
              </div>
            ) : (
              notifications.map((notification) => {
                const approval = pendingFor(notification);
                return (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 border-b border-border-color last:border-b-0 ${
                      notification.is_read ? 'bg-panel' : 'bg-teal-tint/35'
                    }`}
                  >
                    <button
                      onClick={() => void openNotification(notification)}
                      className="w-full text-left cursor-pointer bg-transparent border-none p-0"
                    >
                      <div className="flex gap-2.5">
                        <span
                          className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                            notification.is_read
                              ? 'bg-[#C7CEDB]'
                              : notification.category === 'human_intervention'
                              ? 'bg-amber'
                              : 'bg-teal'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-[12px] text-ink ${
                              notification.is_read ? 'font-medium' : 'font-bold'
                            }`}
                          >
                            {notification.title}
                          </div>
                          <div className="mt-0.5 text-[11px] leading-relaxed text-muted">
                            {notification.message}
                          </div>
                          <div className="mt-1 text-[10px] text-faint">
                            {new Date(notification.created_at).toLocaleString()}
                          </div>
                        </div>
                        {!notification.is_read && (
                          <CheckCheck className="w-3.5 h-3.5 text-teal shrink-0" />
                        )}
                      </div>
                    </button>

                    {approval && (
                      <div className="mt-2.5 ml-[18px] flex items-center gap-2">
                        <button
                          onClick={() => void decide(approval.approval_key, 'reject')}
                          className="rounded-[7px] border border-amber/50 bg-panel px-2.5 py-1 text-[10.5px] font-bold text-[#805300] cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => void decide(approval.approval_key, 'approve')}
                          className="rounded-[7px] border-none bg-amber px-2.5 py-1 text-[10.5px] font-bold text-white cursor-pointer"
                        >
                          Approve &amp; Send
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
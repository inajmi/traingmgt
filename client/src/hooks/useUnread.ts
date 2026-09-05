import { useCallback, useEffect, useState } from "react";

import { api } from "../api/client";

export function useUnread(): { unread: number; refresh: () => Promise<void> } {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ unreadTotal: number }>("/notifications");
      setUnread(data.unreadTotal);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  return { unread, refresh };
}
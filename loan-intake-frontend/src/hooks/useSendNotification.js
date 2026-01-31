import { useCallback, useState } from "react";
import { notificationAPI } from "../services/api";

export function useSendNotification() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const sendNotification = useCallback(async payload => {
    setLoading(true);
    setError(null);
    try {
      const result = await notificationAPI.sendNotification(payload);
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { sendNotification, loading, error, data };
}

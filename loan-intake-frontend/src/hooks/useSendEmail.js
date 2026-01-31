import { useCallback, useState } from "react";
import { emailAPI } from "../services/api";

export function useSendEmail() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const sendEmail = useCallback(async payload => {
    setLoading(true);
    setError(null);
    try {
      const result = await emailAPI.sendEmail(payload);
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { sendEmail, loading, error, data };
}

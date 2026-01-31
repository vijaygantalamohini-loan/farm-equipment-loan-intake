import React, { useEffect, useState } from "react";
import { notificationAPI } from "../services/api";

function NotificationLogAdmin() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [adminToken, setAdminToken] = useState(
    typeof window !== "undefined" ? window.localStorage.getItem("admin_token") || "" : ""
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await notificationAPI.getNotificationLogs({ page, pageSize });
        if (!cancelled) {
          setLogs(result.items || []);
          setTotalPages(result.totalPages || 1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to load notification logs");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, pageSize]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Notification Logs</h2>
          <p className="text-sm text-gray-500">SMS, Push, and In-App notifications.</p>
        </div>
      </div>

      <div className="rounded border bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-gray-700">Admin Token</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="password"
            value={adminToken}
            onChange={e => setAdminToken(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Enter X-Admin-Token"
          />
          <button
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.localStorage.setItem("admin_token", adminToken || "");
              }
              setPage(1);
            }}
          >
            Save
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Channel</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Recipient</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Message</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Provider</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                  No notification logs found.
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id}>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      log.status === "sent" || log.status === "delivered"
                        ? "bg-green-100 text-green-700"
                        : log.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${
                      log.channel === "sms"
                        ? "bg-blue-100 text-blue-700"
                        : log.channel === "push"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {log.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{log.recipientId}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {log.title && <div className="font-medium">{log.title}</div>}
                    <div className="truncate max-w-xs">{log.message}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{log.provider || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button
          className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          Previous
        </button>
        <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
        <button
          className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default NotificationLogAdmin;

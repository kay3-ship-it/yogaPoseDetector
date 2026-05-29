import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./AppPages.css";

const API_BASE = "http://127.0.0.1:3001";

const greetingByHour = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
};

const DashboardPage = () => {
  const { token, currentUser, logout } = useAuth();
  const [rows, setRows] = useState([]);
  const [historySessions, setHistorySessions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/practices/user/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled && res.ok) setRows(data.rows || []);
      } catch {
        if (!cancelled) setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/practices/user/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled && res.ok) {
          setHistorySessions(data.sessions || []);
        }
      } catch {
        if (!cancelled) setHistorySessions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const totals = useMemo(() => {
    const totalPoses = rows.reduce((acc, r) => acc + Number(r.total_count || 0), 0);
    const totalSeconds = rows.reduce((acc, r) => acc + Number(r.total_seconds || 0), 0);
    return {
      totalPoses,
      totalMinutes: Math.round(totalSeconds / 60),
      totalSessions: historySessions.length,
      top3: [...rows].sort((a, b) => b.total_count - a.total_count).slice(0, 3),
    };
  }, [rows, historySessions.length]);

  return (
    <div className="app-shell container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">
          {greetingByHour()}, {currentUser?.full_name || "Yogi"}
        </h1>
        <button className="btn btn-outline-secondary btn-sm" onClick={logout}>
          Logout
        </button>
      </div>
      <div className="app-summary-grid mb-3">
        <div className="app-card p-3"><strong>Total Sessions</strong><div>{totals.totalSessions}</div></div>
        <div className="app-card p-3"><strong>Total Poses Practiced</strong><div>{totals.totalPoses}</div></div>
        <div className="app-card p-3"><strong>Total Practice Time</strong><div>{totals.totalMinutes} min</div></div>
      </div>
      <div className="d-flex gap-2 mb-3">
        <Link to="/app/hardware" className="btn app-btn-primary text-white">Start Practice Session</Link>
        <Link to="/app/history" className="btn btn-outline-dark">View History</Link>
      </div>
      <div className="app-card p-3">
        <h2 className="h6">Most Practiced Poses</h2>
        <div className="app-summary-grid">
          {totals.top3.map((pose) => (
            <div className="border rounded p-2 bg-white" key={pose.pose_name}>
              <div className="fw-semibold">{pose.pose_name}</div>
              <div className="small fst-italic text-muted">{pose.pose_sanskrit}</div>
              <div className="small">{pose.total_count} times</div>
            </div>
          ))}
          {totals.top3.length === 0 ? <div className="text-muted small">No practice data yet.</div> : null}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

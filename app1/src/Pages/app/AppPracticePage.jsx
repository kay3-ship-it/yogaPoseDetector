import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { POSES } from "../../data/poses";
import { useAuth } from "../../context/AuthContext";
import { useSession } from "../../context/SessionContext";
import { usePracticePoseDetection } from "../../hooks/usePracticePoseDetection";
import AppImuStatusStrip from "../../Components/app/AppImuStatusStrip";
import CONFIG from "../../config";
import "../../Pages/SequencerPage.css";
import "./AppPages.css";

const API_BASE = "http://127.0.0.1:3001";
const categories = ["All", "Standing", "Sitting", "Prone", "Supine"];

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const AppPracticePage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { sessionId, posePracticeCounts, incrementPoseCount, clearSession } = useSession();
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [selectedPoseId, setSelectedPoseId] = useState("");
  const [statsRows, setStatsRows] = useState([]);
  const [view, setView] = useState("grid");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showTimeUp, setShowTimeUp] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [summary, setSummary] = useState(null);
  const [imuDevices, setImuDevices] = useState({});
  const [detectedPose, setDetectedPose] = useState("—");
  const [confidence, setConfidence] = useState(0);
  const [corrections, setCorrections] = useState([]);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const startedAtRef = useRef(null);

  const selectedPose = useMemo(() => POSES.find((p) => p.id === selectedPoseId) || null, [selectedPoseId]);
  const visiblePoses = useMemo(
    () => (categoryFilter === "All" ? POSES : POSES.filter((p) => p.category === categoryFilter)),
    [categoryFilter]
  );
  const groupedVisiblePoses = useMemo(
    () =>
      visiblePoses.reduce((acc, pose) => {
        if (!acc[pose.category]) acc[pose.category] = [];
        acc[pose.category].push(pose);
        return acc;
      }, {}),
    [visiblePoses]
  );

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/practices/user/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) setStatsRows(data.rows || []);
      } catch {
        setStatsRows([]);
      }
    })();
  }, [token, view]);

  useEffect(() => {
    const dataUrl = CONFIG.FLASK_DATA_URL?.replace(/\/$/, "");
    if (!dataUrl) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${dataUrl}/debug/imu`, { cache: "no-store" });
        if (!res.ok) throw new Error("down");
        const data = await res.json();
        if (!cancelled) setImuDevices(data || {});
      } catch {
        if (!cancelled) setImuDevices({});
      }
    };
    void poll();
    const id = window.setInterval(poll, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const { mediapipeError } = usePracticePoseDetection({
    videoRef,
    canvasRef,
    enabled: view === "practice" && Boolean(selectedPose) && Boolean(streamRef.current),
    practicePoseName: selectedPose?.name || "",
    setDetectedPose,
    setConfidence,
    setCorrections,
  });

  useEffect(() => {
    if (view !== "practice" || !selectedPose) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) return;
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        streamRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [view, selectedPose]);

  useEffect(() => {
    if (view !== "practice" || !selectedPose) return undefined;
    startedAtRef.current = new Date();
    setElapsedSec(0);
    const maxSec = selectedPose.duration || 180;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (next >= maxSec) {
          window.clearInterval(id);
          void stopPractice("timer");
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [view, selectedPoseId]);

  const stopPractice = async (stoppedBy) => {
    if (!selectedPose || !sessionId || stopping) return;
    setStopping(true);
    const endedAt = new Date();
    const startedAt = startedAtRef.current || new Date();
    try {
      const saveRes = await fetch(`${API_BASE}/api/practices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          pose_name: selectedPose.name,
          pose_sanskrit: selectedPose.sanskrit,
          pose_category: selectedPose.category,
          started_at: startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
          duration_seconds: Math.max(1, elapsedSec),
          stopped_by: stoppedBy,
        }),
      });
      if (!saveRes.ok) {
        throw new Error("Failed to save practice");
      }
      incrementPoseCount(selectedPose.name);
      if (stoppedBy === "timer") {
        setShowTimeUp(true);
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        setShowTimeUp(false);
      }
    } finally {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStopping(false);
      setView("grid");
    }
  };

  const endSession = async () => {
    if (!sessionId) return;
    await fetch(`${API_BASE}/api/sessions/${sessionId}/end`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const sessionRes = await fetch(`${API_BASE}/api/practices/session/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sessionData = await sessionRes.json();
    const byPose = sessionData.by_pose || [];
    const entries = byPose.map((row) => [row.pose_name, row.total_count]);
    const totalSeconds = (sessionData.practices || []).reduce(
      (acc, practice) => acc + Number(practice.duration_seconds || 0),
      0
    );
    setSummary({
      entries,
      totalSeconds,
    });
  };

  const lifetimeCount = (name) => Number(statsRows.find((r) => r.pose_name === name)?.total_count || 0);

  if (!sessionId) {
    return (
      <div className="app-shell container py-4">
        <div className="alert alert-warning">No active session. Start from hardware checks.</div>
        <button className="btn btn-outline-dark" onClick={() => navigate("/app/hardware")}>Go to Hardware</button>
      </div>
    );
  }

  const connectedCount = Object.values(imuDevices).filter((d) => d?.online === true).length;

  return (
    <div className="sequencer-fullscreen">
      <AppImuStatusStrip />
      {view === "grid" ? (
        <div className="container-fluid py-4 sequencer-select-view">
          <div className="sequencer-select-intro">
            <h1 className="sequencer-heading">Select a Pose to Practice</h1>
            <p className="sequencer-subheading">Choose any pose. You can repeat poses as many times as you want.</p>
          </div>
          <div className="sequencer-filter-row px-3">
            {categories.map((cat) => (
              <button key={cat} className={`sequencer-filter-btn${categoryFilter === cat ? " active" : ""}`} onClick={() => setCategoryFilter(cat)}>{cat}</button>
            ))}
          </div>
          <div className="sequencer-category-sections px-3">
            {Object.entries(groupedVisiblePoses).map(([category, poses]) => (
              <section key={category} className="sequencer-category-section">
                <h3 className="sequencer-category-title">{category} Poses</h3>
                <div className="sequencer-pose-grid">
                  {poses.map((pose) => {
                    const count = (posePracticeCounts[pose.name] || 0) + lifetimeCount(pose.name);
                    const selected = selectedPoseId === pose.id;
                    return (
                      <button
                        key={pose.id}
                        className="sequencer-pose-card"
                        style={{ borderColor: selected ? "#0ea5e9" : undefined, borderWidth: selected ? 2 : 1 }}
                        onClick={() => {
                          setSelectedPoseId(pose.id);
                          setView("practice");
                        }}
                      >
                        <span className="sequencer-pose-card-name">{pose.name}</span>
                        <span className="sequencer-pose-card-sanskrit">{pose.sanskrit}</span>
                        <span className="sequencer-pose-meta">{pose.id} · 180s</span>
                        <span className={`sequencer-badge ${count > 0 ? "sequencer-badge-recorded" : "sequencer-badge-pending"}`}>
                          {count > 0 ? `Practiced ${count} times` : "Not practiced"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <div className="sequencer-select-footer mt-4">
            <button className="btn btn-outline-dark" onClick={endSession}>End Session</button>
          </div>
        </div>
      ) : (
        <div className="app-session-overlay">
          <button className="btn btn-sm btn-light position-absolute m-3" onClick={() => setView("grid")}>
            ← Back
          </button>
          <div className="position-absolute start-0 top-0 m-3">
            <h2 className="h4 mb-0">{selectedPose?.name}</h2>
            <div className="fst-italic">{selectedPose?.sanskrit}</div>
          </div>
          <div className="position-absolute end-0 top-0 m-3 px-3 py-2 rounded bg-dark">
            {connectedCount} modules connected
          </div>
          <div className="app-timer-dual">
            <div>Elapsed: {fmt(elapsedSec)}</div>
            <div style={{ color: (selectedPose?.duration || 180) - elapsedSec <= 30 ? "#ef4444" : "#fff" }}>
              Countdown: {fmt(Math.max(0, (selectedPose?.duration || 180) - elapsedSec))}
            </div>
          </div>
          {mediapipeError ? <div className="alert alert-warning position-absolute m-3" style={{ top: 80 }}>MediaPipe: {mediapipeError}</div> : null}
          <video ref={videoRef} className="position-absolute w-100 h-100" style={{ objectFit: "cover" }} autoPlay playsInline muted />
          <canvas ref={canvasRef} className="position-absolute w-100 h-100" />
          <div className="position-absolute bottom-0 start-50 translate-middle-x mb-4 text-center">
            <button className="btn btn-danger btn-lg" onClick={() => void stopPractice("manual")} disabled={stopping}>
              {stopping ? "Stopping..." : "Stop Practice"}
            </button>
            <div className="small mt-2">Detected: {detectedPose} ({Math.round(confidence)}%)</div>
            {corrections.length > 0 ? <div className="small">{corrections[0]}</div> : null}
          </div>
          {showTimeUp ? <div className="app-timeup">Time&apos;s up!</div> : null}
        </div>
      )}

      {summary ? (
        <div className="sequencer-dialog-overlay">
          <div className="sequencer-dialog">
            <h3 className="h5">Great practice!</h3>
            <p className="small mb-1">Total session time: {Math.round(summary.totalSeconds / 60)} min</p>
            {summary.entries.map(([name, count]) => (
              <div key={name} className="small">{name}: {count} times</div>
            ))}
            <button
              className="btn btn-primary mt-3"
              onClick={() => {
                setSummary(null);
                clearSession();
                navigate("/app/dashboard");
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AppPracticePage;

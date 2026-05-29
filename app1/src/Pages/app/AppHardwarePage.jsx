import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import CONFIG from "../../config";
import { useAuth } from "../../context/AuthContext";
import { useSession } from "../../context/SessionContext";
import AppImuStatusStrip from "../../Components/app/AppImuStatusStrip";
import "../../Pages/HardwarePage.css";
import "./AppPages.css";

const API_BASE = "http://127.0.0.1:3001";

const greetingByHour = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
};

const AppHardwarePage = () => {
  const navigate = useNavigate();
  const { token, currentUser } = useAuth();
  const { setSessionId } = useSession();
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [imuDevices, setImuDevices] = useState({});
  const [flaskReachable, setFlaskReachable] = useState(false);
  const [calibrationDone, setCalibrationDone] = useState(false);
  const [starting, setStarting] = useState(false);
  const videoRef = useRef(null);
  const dataUrl = CONFIG.FLASK_DATA_URL?.replace(/\/$/, "");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) return;
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setCameraReady(true);
      } catch (e) {
        if (!cancelled) {
          setCameraError(e?.message || "Camera unavailable. You can still continue.");
        }
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!dataUrl) return undefined;
    let cancelled = false;
    const statusUrl = `${dataUrl}/debug/imu`;
    const poll = async () => {
      try {
        const res = await fetch(statusUrl, { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) throw new Error("down");
        const data = await res.json();
        setFlaskReachable(true);
        setImuDevices(data || {});
      } catch {
        if (!cancelled) {
          setFlaskReachable(false);
          setImuDevices({});
        }
      }
    };
    void poll();
    const id = window.setInterval(poll, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [dataUrl]);

  const handleStart = async () => {
    if (starting || !calibrationDone) return;
    setStarting(true);
    try {
      const res = await fetch(`${API_BASE}/api/sessions/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start");
      setSessionId(data.id);
      navigate("/app/practice");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="app-shell app-hardware">
      <AppImuStatusStrip />
      <div className="container-fluid py-4">
        <div className="row g-4">
          <div className="col-12 col-lg-7">
            {cameraError ? (
              <div className="alert alert-warning">{cameraError}</div>
            ) : (
              <div className="video-container">
                <video ref={videoRef} className="w-100" muted autoPlay playsInline />
              </div>
            )}
          </div>
          <div className="col-12 col-lg-5">
            <div className="card status-card shadow-sm">
              <div className="card-body">
                <h2 className="h5 card-title mb-2">
                  {greetingByHour()}, {currentUser?.full_name || "Yogi"}
                </h2>
                <p className="small text-muted mb-0">
                  Complete startup checks, then begin your practice session.
                </p>
              </div>
            </div>
            <div className="card status-card shadow-sm">
              <div className="card-body">
                <h2 className="h5 card-title mb-3">Sensor Status</h2>
                <div className="status-row"><span>Camera</span><span className={`badge ${cameraReady ? "bg-success" : "bg-warning"}`}>{cameraReady ? "Connected" : "Optional"}</span></div>
                <div className="status-row"><span>IMU Bridge</span><span className={`badge ${flaskReachable ? "bg-success" : "bg-secondary"}`}>{flaskReachable ? "Reachable" : "Offline"}</span></div>
                <div className="sensor-grid">
                  {CONFIG.SENSOR_SLOTS.map((slot) => {
                    const live = imuDevices[slot.id]?.online === true;
                    return (
                      <div key={slot.id} className={`sensor-card sensor-card--${live ? "live" : "timeout"}`}>
                        <div className="sensor-card__header">
                          <span className="sensor-id">{slot.label}</span>
                          <span className={`sensor-badge ${live ? "badge-live" : "badge-timeout"}`}>
                            {live ? "Connected" : "Disconnected"}
                          </span>
                        </div>
                        <div className="sensor-body-part">📍 {slot.bodyPart}</div>
                        {!live ? <div className="sensor-timeout-msg">No live signal right now.</div> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="card status-card shadow-sm">
              <div className="card-body">
                <h2 className="h5 card-title">Pre-Practice Calibration</h2>
                <p className="text-muted small mb-3">Stand in Mountain Pose facing camera and confirm.</p>
                <button className="btn btn-success w-100" disabled={calibrationDone} onClick={() => setCalibrationDone(true)}>
                  {calibrationDone ? "Calibration Complete ✓" : "Confirm Calibration ✓"}
                </button>
              </div>
            </div>
            <button className="btn btn-primary w-100 start-btn" disabled={!calibrationDone || starting} onClick={handleStart}>
              {starting ? "Starting..." : "Start Practice →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppHardwarePage;

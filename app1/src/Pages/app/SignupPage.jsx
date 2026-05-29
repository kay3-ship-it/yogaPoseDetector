import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./AppPages.css";

const API_BASE = "http://127.0.0.1:3001";

const SignupPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    age: "",
    gender: "",
    height_cm: "",
    weight_kg: "",
    experience_level: "Beginner",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const progress = useMemo(() => (step / 3) * 100, [step]);
  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          age: form.age ? Number(form.age) : null,
          height_cm: form.height_cm ? Number(form.height_cm) : null,
          weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      login(data.token, data.user);
      navigate("/app/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell container py-5">
      <div className="app-card p-4 mx-auto app-form-wrap">
        <h1 className="h4 mb-2">Create your account</h1>
        <div className="progress app-progress mb-3">
          <div className="progress-bar app-btn-primary" style={{ width: `${progress}%` }} />
        </div>
        {step === 1 ? (
          <>
            <h2 className="h6">Step 1: Account</h2>
            <input className="form-control my-2" placeholder="Full Name" value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} />
            <input className="form-control my-2" type="email" placeholder="Email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
            <input className="form-control my-2" type="password" placeholder="Password" value={form.password} onChange={(e) => setField("password", e.target.value)} />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <h2 className="h6">Step 2: About You</h2>
            <input className="form-control my-2" type="number" placeholder="Age" value={form.age} onChange={(e) => setField("age", e.target.value)} />
            <select className="form-select my-2" value={form.gender} onChange={(e) => setField("gender", e.target.value)}>
              <option value="">Gender</option>
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
            </select>
            <input className="form-control my-2" type="number" placeholder="Height (cm)" value={form.height_cm} onChange={(e) => setField("height_cm", e.target.value)} />
            <input className="form-control my-2" type="number" placeholder="Weight (kg)" value={form.weight_kg} onChange={(e) => setField("weight_kg", e.target.value)} />
          </>
        ) : null}
        {step === 3 ? (
          <>
            <h2 className="h6">Step 3: Experience</h2>
            <select className="form-select my-2" value={form.experience_level} onChange={(e) => setField("experience_level", e.target.value)}>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </>
        ) : null}
        {error ? <div className="alert alert-danger py-2 mt-2">{error}</div> : null}
        <div className="d-flex justify-content-between mt-3">
          <button className="btn btn-outline-secondary" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
          {step < 3 ? (
            <button className="btn app-btn-primary text-white" onClick={() => setStep((s) => s + 1)}>
              Next
            </button>
          ) : (
            <button className="btn app-btn-primary text-white" disabled={loading} onClick={submit}>
              {loading ? "Creating..." : "Create Account"}
            </button>
          )}
        </div>
        <p className="small mt-3 mb-0">
          Already registered? <Link to="/app/login">Login</Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;

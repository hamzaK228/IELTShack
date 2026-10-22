"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getProfile, updateProfile } from "@/lib/storage";
import { syncProfile } from "@/lib/remote";

const STEPS = ["Welcome", "Target band", "Your baseline", "Ready"] as const;
const PRESETS = [6, 6.5, 7, 7.5, 8];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [target, setTarget] = useState(7.5);
  const [current, setCurrent] = useState("");
  const [date, setDate] = useState("");
  const [hours, setHours] = useState(8);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const profile = getProfile();
    if (!profile) {
      router.replace("/auth");
      return;
    }
    setName(profile.name);
    setTarget(profile.targetBand ?? 7.5);
    setCurrent(profile.currentBand != null ? String(profile.currentBand) : "");
    setDate(profile.testDate ?? "");
    setHours(profile.hoursPerWeek ?? 8);
    setReady(true);
  }, [router]);

  function finish(withDiagnostic: boolean) {
    const next = updateProfile({
      targetBand: target,
      currentBand: current === "" ? null : Number(current),
      testDate: date || null,
      hoursPerWeek: hours,
    });
    if (next) void syncProfile(next);
    router.push(withDiagnostic ? "/dashboard/diagnostic" : "/dashboard");
  }

  if (!ready) return <main className="onb-shell" />;

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <main className="onb-shell">
      <div className="onb-top">
        <Link className="onb-brand" href="/">&gt; IELTShack</Link>
        <span className="onb-counter">STEP {step + 1} / {STEPS.length}</span>
      </div>
      <div className="onb-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="onb-stage" key={step}>
        {step === 0 && (
          <>
            <p className="onb-eyebrow">Setup</p>
            <h1 className="onb-title">
              Hey {name.split(" ")[0]} <span className="onb-cursor">▌</span>
            </h1>
            <p className="onb-lead">
              Three quick questions — target band, where you are now, and when you sit the
              test. Then a short diagnostic finds your weak spots and your plan starts building.
            </p>
            <ul className="onb-list">
              <li><span>01</span> Target band and test date</li>
              <li><span>02</span> Four-skill diagnostic</li>
              <li><span>03</span> A weekly plan that rebalances</li>
            </ul>
          </>
        )}

        {step === 1 && (
          <>
            <p className="onb-eyebrow">Target band</p>
            <h1 className="onb-title">What are you aiming for?</h1>
            <p className="onb-lead">Everything in your plan is built backwards from this number.</p>
            <div className="onb-target">
              <span className="onb-score">{target.toFixed(1)}</span>
              <input
                className="onb-range"
                type="range"
                min={4}
                max={9}
                step={0.5}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                style={{ ["--fill" as string]: `${((target - 4) / 5) * 100}%` }}
                aria-label="Target band"
              />
              <div className="onb-presets">
                {PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    className={`chip${target === preset ? " active" : ""}`}
                    onClick={() => setTarget(preset)}
                  >
                    {preset.toFixed(1)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="onb-eyebrow">Your baseline</p>
            <h1 className="onb-title">Where are you right now?</h1>
            <p className="onb-lead">
              Optional — skip if you haven&apos;t taken a test yet. The diagnostic fills this in.
            </p>
            <div className="onb-row">
              <label className="onb-field">
                <span>Latest band</span>
                <input
                  type="number"
                  min={0}
                  max={9}
                  step={0.5}
                  placeholder="e.g. 6.5"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
              </label>
              <label className="onb-field">
                <span>Test date</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            </div>
            <label className="onb-field" style={{ marginTop: ".8rem" }}>
              <span>Study hours per week</span>
              <input
                type="number"
                min={1}
                max={40}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
              />
            </label>
            <p className="onb-note">
              Your plan uses the target, the date, and your weekly hours. Change them any time
              in Settings.
            </p>
          </>
        )}

        {step === 3 && (
          <>
            <p className="onb-eyebrow">Ready</p>
            <h1 className="onb-title">Your setup is ready.</h1>
            <p className="onb-lead">Here is what we&apos;ll build your plan from.</p>
            <dl className="onb-summary">
              <div><dt>Target</dt><dd className="onb-summary-signal">{target.toFixed(1)}</dd></div>
              <div><dt>Current</dt><dd>{current === "" ? "—" : Number(current).toFixed(1)}</dd></div>
              <div><dt>Test date</dt><dd>{date || "Not set"}</dd></div>
              <div><dt>Hours / week</dt><dd>{hours}</dd></div>
            </dl>
            <p className="onb-note">
              First up: a short diagnostic across Listening, Reading, Writing, and Speaking.
              You can pause and come back to it.
            </p>
          </>
        )}
      </div>

      <div className="onb-actions">
        {step > 0 ? (
          <button className="onb-ghost" onClick={() => setStep((s) => s - 1)}>← Back</button>
        ) : (
          <Link className="onb-ghost" href="/">← Site</Link>
        )}

        {step < STEPS.length - 1 ? (
          <button className="onb-cta" onClick={() => setStep((s) => s + 1)}>
            Continue →
          </button>
        ) : (
          <div className="onb-final">
            <button className="onb-ghost" onClick={() => finish(false)}>Skip for now</button>
            <button className="onb-cta" onClick={() => finish(true)}>
              Start diagnostic →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

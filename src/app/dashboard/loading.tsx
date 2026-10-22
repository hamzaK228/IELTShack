export default function DashboardLoading() {
  return (
    <div className="dash-page">
      <div className="dash-card">
        <span className="attempt-meta">Loading your dashboard…</span>
        <div className="session-progress-bar" style={{ marginTop: "1rem" }} aria-hidden="true">
          <span style={{ width: "35%" }} />
        </div>
      </div>
    </div>
  );
}

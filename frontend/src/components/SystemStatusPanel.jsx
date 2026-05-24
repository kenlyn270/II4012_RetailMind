import { useEffect, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Database, RefreshCw, Server, WifiOff } from "lucide-react";
import { getSystemStatus } from "../api";

function statusStyle(status) {
  switch (status) {
    case "healthy":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "degraded":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "offline":
    case "unhealthy":
      return "bg-red-50 text-red-600 border-red-100";
    default:
      return "bg-slate-50 text-slate-600 border-slate-100";
  }
}

function StatusIcon({ status, className = "w-4 h-4" }) {
  if (status === "healthy") return <CheckCircle2 className={className} />;
  if (status === "offline" || status === "unhealthy") return <WifiOff className={className} />;
  return <AlertCircle className={className} />;
}

export default function SystemStatusPanel() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getSystemStatus();
      setStatus(data);
    } catch (err) {
      setError(err.message || "Gagal mengambil system status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadStatus, 0);
    const interval = setInterval(loadStatus, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const overall = status?.status || (error ? "unhealthy" : "unknown");
  const services = status?.services || {};
  const counts = status?.counts || {};
  const latest = status?.latestDataset;

  return (
    <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1C1D36] text-white flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-[#1C1D36]">System Status</h3>
            <p className="text-xs text-slate-500">API, PostgreSQL, inference service, dan dataset telemetry</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-bold capitalize ${statusStyle(overall)}`}>
            <StatusIcon status={overall} />
            {overall}
          </div>
          <button
            onClick={loadStatus}
            disabled={loading}
            className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-white transition disabled:opacity-60"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl px-4 py-3 text-sm flex gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <ServiceCard icon={Server} label="Backend API" detail="Express.js" service={services.api || { status: loading ? "checking" : "unknown" }} />
        <ServiceCard icon={Database} label="PostgreSQL" detail={services.database?.database || "retailmind"} service={services.database || { status: loading ? "checking" : "unknown" }} />
        <ServiceCard icon={Activity} label="Inference" detail={services.inference?.model_version || "FastAPI ML"} service={services.inference || { status: loading ? "checking" : "unknown" }} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Count label="Contacts" value={counts.contacts} />
        <Count label="Segments" value={counts.segments} />
        <Count label="Datasets" value={counts.datasets} />
        <Count label="Campaigns" value={counts.campaigns} />
        <Count label="Jobs" value={counts.campaign_jobs} />
      </div>

      {latest && !latest.error && (
        <div className="mt-4 bg-slate-50/80 rounded-2xl border border-slate-100 p-4">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Latest Dataset</p>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 text-sm">
            <div>
              <p className="font-bold text-[#1C1D36]">{latest.name || latest.id}</p>
              <p className="text-xs text-slate-500">
                {latest.customer_count || 0} customers · {latest.row_count || 0} rows · model {latest.model_version || "not profiled"}
              </p>
            </div>
            <p className="text-xs text-slate-400">{latest.uploaded_at ? new Date(latest.uploaded_at).toLocaleString() : "-"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceCard({ icon: Icon, label, detail, service }) {
  const status = service?.status || "unknown";
  return (
    <div className="bg-white/70 rounded-2xl border border-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-sm text-[#1C1D36]">{label}</p>
            <p className="text-xs text-slate-500 truncate max-w-[180px]">{detail}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold capitalize ${statusStyle(status)}`}>
          <StatusIcon status={status} className="w-3 h-3" />
          {status}
        </div>
      </div>
      {service?.latencyMs !== undefined && <p className="text-[10px] text-slate-400 mt-3">Latency: {service.latencyMs}ms</p>}
      {service?.error && <p className="text-[10px] text-red-500 mt-3 truncate">{service.error}</p>}
    </div>
  );
}

function Count({ label, value }) {
  return (
    <div className="bg-white/60 rounded-2xl border border-white p-4">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-[#1C1D36]">{value ?? "-"}</p>
    </div>
  );
}

import { useRef, useState } from "react";
import { Upload, CheckCircle2, AlertCircle, Loader2, Database, Brain } from "lucide-react";
import { scoreDatasetDirect } from "../api";

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function pct(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return "-";
  return `${Number(value).toFixed(1)}%`;
}

export default function DatasetUpload({ onScored }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);

  const handleFile = (selected) => {
    setFile(selected || null);
    setStatus("idle");
    setMessage("");
    setResult(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) {
      setStatus("error");
      setMessage("Pilih file CSV transaksi terlebih dahulu.");
      return;
    }

    setStatus("loading");
    setMessage("Mengunggah dataset dan menjalankan ML inference...");

    try {
      const response = await scoreDatasetDirect(file);
      setResult(response);
      setStatus("success");
      setMessage(`Dataset berhasil diproses: ${formatNumber(response.customerCount)} customers.`);
      onScored?.(response);
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Gagal memproses dataset.");
    }
  };

  const profile = result?.profile;
  const total = result?.customerCount || profile?.n_customers || 0;
  const churnCounts = result?.summary?.churnCounts;
  const cltvCounts = result?.summary?.cltvCounts;
  const churnHigh = churnCounts
    ? (((churnCounts.high || 0) + (churnCounts.critical || 0)) / Math.max(total, 1)) * 100
    : profile?.churn_distribution?.high ?? profile?.churn_high_pct;
  const cltvHigh = cltvCounts
    ? ((cltvCounts.A || 0) / Math.max(total, 1)) * 100
    : profile?.cltv_distribution?.high ?? profile?.cltv_high_pct;

  return (
    <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-[#FFD13B] flex items-center justify-center text-[#1C1D36]">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-[#1C1D36]">Upload Transaction Dataset</h3>
              <p className="text-xs text-slate-500">CSV → FastAPI inference → dashboard profile & customer segments</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Format minimal: Customer ID, Invoice, InvoiceDate, Quantity, Price, Country. Model tetap frozen; dashboard memakai calibration profile per dataset.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 lg:min-w-[520px]">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-left hover:bg-white transition"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1C1D36]">
              <Upload className="w-4 h-4 text-slate-500" />
              <span className="truncate">{file ? file.name : "Pilih CSV transaksi"}</span>
            </div>
          </button>
          <button
            type="submit"
            disabled={status === "loading"}
            className="bg-[#1C1D36] text-white px-6 py-3 rounded-2xl font-bold text-sm disabled:opacity-60 hover:scale-[1.02] transition flex items-center justify-center gap-2"
          >
            {status === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            Score Dataset
          </button>
        </form>
      </div>

      {message && (
        <div className={`mt-4 flex items-start gap-2 text-sm rounded-2xl px-4 py-3 border ${
          status === "error" ? "bg-red-50 text-red-600 border-red-100" :
          status === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
          "bg-amber-50 text-amber-700 border-amber-100"
        }`}>
          {status === "error" ? <AlertCircle className="w-4 h-4 mt-0.5" /> : status === "success" ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <Loader2 className="w-4 h-4 mt-0.5 animate-spin" />}
          <span>{message}</span>
        </div>
      )}

      {profile && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <Metric label="Dataset ID" value={String(result.datasetId).slice(0, 8)} />
          <Metric label="Model" value={profile.model_version || "-"} />
          <Metric label="High Churn" value={pct(churnHigh)} />
          <Metric label="High CLTV" value={pct(cltvHigh)} />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="bg-white/70 rounded-2xl border border-white p-4">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-[#1C1D36] truncate">{value}</p>
    </div>
  );
}

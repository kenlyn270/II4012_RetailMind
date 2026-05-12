import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { ArrowUpRight } from "lucide-react";

const data = [
  { month: "May", Churn: 9.0, Predicted: 9.2 },
  { month: "June", Churn: 10.2, Predicted: 10.5 },
  { month: "July", Churn: 11.8, Predicted: 12.0 },
  { month: "August", Churn: 12.5, Predicted: 13.1 },
  { month: "September", Churn: 14.5, Predicted: 15.2 },
  { month: "October", Churn: 16.0, Predicted: 18.5 },
  { month: "November", Churn: null, Predicted: 21.0 },
  { month: "Dec", Churn: null, Predicted: 23.7 },
];

export default function ChurnChart() {
  return (
    <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white shadow-sm h-full flex flex-col">
      
      {/* Header Grafik */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="font-semibold text-lg text-[#1C1D36]">Churn Prediction Trend</h3>
          <p className="text-xs text-slate-500 mt-1">Next 6 months forecast</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-500 border border-red-100">
          <ArrowUpRight className="w-3 h-3" />
          +23.7%
        </div>
      </div>

      {/* Legenda */}
      <div className="flex gap-4 mb-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#1C1D36]" />
          <span className="text-slate-500 font-medium">Actual</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFD13B]" />
          <span className="text-slate-500 font-medium">Predicted</span>
        </div>
      </div>

      {/* Area Grafik Utama */}
      <div className="flex-1 min-h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {/* Gradasi warna Kuning RetailMind buat garis Prediksi */}
              <linearGradient id="churnGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFD13B" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#FFD13B" stopOpacity={0} />
              </linearGradient>
              {/* Gradasi warna Navy buat garis Actual */}
              <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1C1D36" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#1C1D36" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip
              contentStyle={{
                background: "rgba(255, 255, 255, 0.9)",
                border: "1px solid #E2E8F0",
                borderRadius: "16px",
                fontSize: "12px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                backdropFilter: "blur(4px)"
              }}
            />
            <Area type="monotone" dataKey="Predicted" stroke="#FFD13B" strokeWidth={3} fill="url(#churnGrad)" />
            <Area type="monotone" dataKey="Churn" stroke="#1C1D36" strokeWidth={2.5} fill="url(#actualGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
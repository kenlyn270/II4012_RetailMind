import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Cell, Tooltip } from "recharts";

const fallbackData = [
  { name: "High Value", value: 310, color: "#FFD13B" },
  { name: "At Risk", value: 478, color: "#FEACCC" },
  { name: "Hibernating", value: 392, color: "#B4D0FB" },
  { name: "New/Occasional", value: 234, color: "#B7D9B1" },
];

const colors = {
  "High Value": "#FFD13B",
  "At Risk": "#FEACCC",
  Hibernating: "#B4D0FB",
  "New/Occasional": "#B7D9B1",
  "New / Occasional": "#B7D9B1",
};

function buildData(datasetProfile) {
  const counts = datasetProfile?.summary?.segmentCounts;
  if (counts && Object.keys(counts).length) {
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value: Number(value),
      color: colors[name] || "#CBD5E1",
    }));
  }

  const dist = datasetProfile?.profile?.cluster_distribution;
  if (dist && Object.keys(dist).length) {
    const total = datasetProfile?.customerCount || datasetProfile?.profile?.n_customers || 0;
    return Object.entries(dist).map(([name, pct]) => ({
      name,
      value: Math.round(Number(pct) * total),
      color: colors[name] || "#CBD5E1",
    }));
  }

  return fallbackData;
}

export default function SegmentBreakdown({ datasetProfile }) {
  const data = buildData(datasetProfile);
  const total = data.reduce((s, d) => s + d.value, 0);
  
  return (
    <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white shadow-sm h-full flex flex-col">
      
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-semibold text-lg text-[#1C1D36]">RFM Segment Breakdown</h3>
          <p className="text-xs text-slate-500 mt-1">
            {datasetProfile ? "Uploaded dataset" : "Demo baseline"} · <span className="font-bold text-[#1C1D36]">{total.toLocaleString()}</span> total
          </p>
        </div>
      </div>

      {/* Area Bar Chart */}
      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 10, fill: "#64748B" }} 
              axisLine={false} 
              tickLine={false} 
            />
            
            <YAxis 
              tick={{ fontSize: 11, fill: "#64748B" }} 
              axisLine={false} 
              tickLine={false} 
            />
            
            <Tooltip
              cursor={{ fill: "rgba(241, 245, 249, 0.6)" }} // Efek highlight pas di-hover (bg-slate-100/60)
              contentStyle={{
                background: "rgba(255, 255, 255, 0.9)",
                border: "1px solid #E2E8F0",
                borderRadius: "16px",
                fontSize: "12px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                backdropFilter: "blur(4px)"
              }}
            />
            
            <Bar dataKey="value" radius={[12, 12, 4, 4]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
            
          </BarChart>
        </ResponsiveContainer>
      </div>
      
    </div>
  );
}
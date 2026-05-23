import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, Cell } from "recharts";

const fallbackSegments = [
  { name: "High Value", recency: 85, frequency: 90, monetary: 320, color: "#FFD13B", count: 310 },
  { name: "At Risk", recency: 25, frequency: 60, monetary: 200, color: "#FEACCC", count: 478 },
  { name: "Hibernating", recency: 15, frequency: 20, monetary: 90, color: "#B4D0FB", count: 392 },
  { name: "New/Occasional", recency: 70, frequency: 20, monetary: 90, color: "#B7D9B1", count: 234 },
];

const colors = {
  "High Value": "#FFD13B",
  "At Risk": "#FEACCC",
  Hibernating: "#B4D0FB",
  "New/Occasional": "#B7D9B1",
  "New / Occasional": "#B7D9B1",
};

function buildSegments(datasetProfile) {
  const customers = datasetProfile?.customers;
  if (!customers?.length) return fallbackSegments;

  const grouped = customers.reduce((acc, c) => {
    const name = c.kmeansSegment || "Unknown";
    if (!acc[name]) acc[name] = { name, recency: 0, frequency: 0, monetary: 0, count: 0, color: colors[name] || "#CBD5E1" };
    acc[name].recency += Number(c.recency || 0);
    acc[name].frequency += Number(c.frequency || 0);
    acc[name].monetary += Number(c.monetary || 0);
    acc[name].count += 1;
    return acc;
  }, {});

  return Object.values(grouped).map((s) => ({
    ...s,
    recency: Math.round(s.recency / s.count),
    frequency: Number((s.frequency / s.count).toFixed(1)),
    monetary: Number((s.monetary / s.count).toFixed(1)),
  }));
}

export default function RFMMap({ datasetProfile }) {
  const segments = buildSegments(datasetProfile);
  return (
    <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white shadow-sm h-full flex flex-col">
      
      {/* Header Grafik */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg text-[#1C1D36]">RFM Analysis Map</h3>
          <p className="text-xs text-slate-500 mt-1">{datasetProfile ? "Averages from uploaded dataset" : "Recency vs Frequency · bubble = monetary"}</p>
        </div>
      </div>

      {/* Legenda (Pills) */}
      <div className="flex flex-wrap gap-2 mb-4">
        {segments.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-full bg-slate-100 text-[#1C1D36] border border-slate-200">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            {s.name}
          </div>
        ))}
      </div>

      {/* Area Grafik Gelembung */}
      <div className="flex-1 min-h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            
            <XAxis
              type="number"
              dataKey="frequency"
              name="Frequency"
              tick={{ fontSize: 11, fill: "#64748B" }}
              axisLine={false}
              tickLine={false}
            />
            
            <YAxis
              type="number"
              dataKey="recency"
              name="Recency"
              tick={{ fontSize: 11, fill: "#64748B" }}
              axisLine={false}
              tickLine={false}
            />
            
            <ZAxis type="number" dataKey="monetary" range={[200, 1800]} />
            
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "#94A3B8" }}
              contentStyle={{
                background: "rgba(255, 255, 255, 0.9)",
                border: "1px solid #E2E8F0",
                borderRadius: "16px",
                fontSize: "12px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                backdropFilter: "blur(4px)"
              }}
            />
            
            <Scatter data={segments}>
              {segments.map((s, i) => (
                <Cell 
                  key={i} 
                  fill={s.color} 
                  fillOpacity={0.8} 
                  stroke={s.color} 
                  strokeWidth={2} 
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      
    </div>
  );
}
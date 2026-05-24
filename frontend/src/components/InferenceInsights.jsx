import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { TrendingUp, Target, CreditCard, Lightbulb } from "lucide-react";

const COLORS = ["#FFD13B", "#FFA951", "#FDC591", "#FCEFB4", "#1C1D36"];

/**
 * 1. Prediction Summary Card (REAL DATA)
 */
export function PredictionSummary({ datasetProfile }) {
  const summary = datasetProfile?.summary;
  const churnData = summary?.churnCounts ? Object.entries(summary.churnCounts).map(([name, value]) => ({ name: name.toUpperCase(), value })) : [
    { name: "LOW", value: 0 },
    { name: "MEDIUM", value: 0 },
    { name: "HIGH", value: 0 },
    { name: "CRITICAL", value: 0 },
  ];

  return (
    <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white shadow-sm flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-[#1C1D36]">Churn Distribution</h3>
          <p className="text-xs text-slate-500">Real-time risk profiling</p>
        </div>
      </div>

      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={churnData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} />
            <YAxis hide />
            <Tooltip 
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {churnData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * 2. CLTV Tier Breakdown (REAL DATA)
 */
export function CLTVTierBreakdown({ datasetProfile }) {
  const cltvCounts = datasetProfile?.summary?.cltvCounts || {};
  const data = Object.entries(cltvCounts).map(([name, value]) => ({ name: `Tier ${name}`, value }));

  return (
    <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white shadow-sm flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-[#1C1D36]">CLTV Tiering</h3>
          <p className="text-xs text-slate-500">Customer lifetime value segments</p>
        </div>
      </div>

      <div className="flex-1 min-h-[200px] flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.length > 0 ? data : [{ name: "No Data", value: 1 }]}
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
              {data.length === 0 && <Cell fill="#f1f5f9" />}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * 3. Segment Contribution (REAL DATA)
 */
export function SegmentContribution({ datasetProfile }) {
  const customers = datasetProfile?.customers || [];
  
  // Calculate total monetary per segment
  const contribution = customers.reduce((acc, c) => {
    const seg = c.kmeansSegment || "Unknown";
    acc[seg] = (acc[seg] || 0) + (c.monetary || 0);
    return acc;
  }, {});

  const data = Object.entries(contribution)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const formatMoney = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white shadow-sm flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center">
          <Target className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-[#1C1D36]">Revenue Mix</h3>
          <p className="text-xs text-slate-500">Monetary contribution by segment</p>
        </div>
      </div>

      <div className="space-y-4 flex-1">
        {data.slice(0, 4).map((item, idx) => (
          <div key={idx} className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] font-bold">
              <span className="text-slate-500 uppercase">{item.name}</span>
              <span className="text-[#1C1D36]">{formatMoney(item.value)}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#FFD13B] rounded-full" 
                style={{ width: `${(item.value / (data[0]?.value || 1)) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {data.length === 0 && <p className="text-center text-slate-400 text-sm py-10">Waiting for data...</p>}
      </div>
    </div>
  );
}

/**
 * 4. Recommended Action Card (REAL DATA)
 */
export function RecommendedActionCard({ datasetProfile }) {
  const customers = datasetProfile?.customers || [];
  
  // Aggregate actions
  const actionCounts = customers.reduce((acc, c) => {
    const action = c.recommendedAction || "Nurture";
    acc[action] = (acc[action] || 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(actionCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const topAction = data[0];

  return (
    <div className="bg-[#1C1D36] rounded-[32px] p-6 shadow-xl flex flex-col h-full text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/20 blur-[60px] rounded-full -mr-16 -mt-16" />
      
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
          <Lightbulb className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-white">AI Strategy</h3>
          <p className="text-xs text-slate-400">Next Steps (Real-time)</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between relative z-10">
        <div className="mb-6">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-2">Priority Action</p>
          <h4 className="text-2xl font-bold leading-tight mb-2">{topAction ? topAction.name : "Analyzing..."}</h4>
          <p className="text-sm text-slate-300 leading-relaxed">
            {topAction 
              ? `Targeting ${topAction.value} customers with ${topAction.name} strategy will optimize your conversion rates.`
              : "Upload a dataset to see AI-driven strategic recommendations for your customers."
            }
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-auto">
          {data.slice(0, 4).map((item, idx) => (
            <div key={idx} className="bg-white/5 border border-white/10 p-3 rounded-2xl">
              <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{item.name}</p>
              <p className="text-lg font-bold text-amber-400">{item.value}</p>
            </div>
          ))}
          {data.length === 0 && [1,2,3,4].map(i => <div key={i} className="bg-white/5 h-12 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    </div>
  );
}

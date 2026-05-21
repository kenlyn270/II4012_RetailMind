

const customers = [
  { id: "C-1024", name: "Aisha Rahmawati", risk: 92.3, segment: "At Risk", last: "Sep 3, 2025", value: "$1,240" },
  { id: "C-1018", name: "Budi Santoso", risk: 90.0, segment: "At Risk", last: "Sep 9, 2025", value: "$980" },
  { id: "C-1041", name: "Citra Lestari", risk: 85.0, segment: "Hibernating", last: "Sep 6, 2025", value: "$720" },
  { id: "C-1063", name: "Dimas Pratama", risk: 78.4, segment: "At Risk", last: "Aug 28, 2025", value: "$1,560" },
  { id: "C-1077", name: "Eka Putri", risk: 74.5, segment: "Hibernating", last: "Jan 25, 2026", value: "$430" },
];

const segmentColors = {
  "At Risk": "bg-red-100 text-red-600",
  "Hibernating": "bg-slate-200 text-slate-600",
  "Loyal": "bg-amber-100 text-amber-700",
};

export default function HighRiskTable() {
  return (
    <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white shadow-sm h-full flex flex-col">
      
      {/* Bagian Header Tabel */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          {/* <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center"> */}
            {/* <AlertTriangle className="w-5 h-5 text-red-500" /> */}
          {/* </div> */}
          <div>
            <h3 className="font-bold text-lg text-[#1C1D36]">High-Risk Customers</h3>
            <p className="text-xs text-slate-500">Top 5 to churn this month</p>
          </div>
        </div>
        <button className="text-xs font-bold px-4 py-2 rounded-full bg-slate-100 text-[#1C1D36] hover:bg-slate-200 transition">
          View all
        </button>
      </div>

      {/* Bagian Isi Tabel */}
      <div className="space-y-2 flex-1">
        
        {/* Judul Kolom */}
        <div className="grid grid-cols-12 gap-2 px-3 pb-2 text-[11px] font-bold uppercase text-slate-400 tracking-wider border-b border-slate-100">
          <div className="col-span-5">Customer</div>
          <div className="col-span-2">Risk</div>
          <div className="col-span-3">Segment</div>
          <div className="col-span-2 text-right">Last Purchase</div>
        </div>
        
        {/* Looping Data Customer */}
        {customers.map((c) => (
          <div key={c.id} className="grid grid-cols-12 gap-2 items-center p-3 rounded-2xl hover:bg-white/60 transition cursor-pointer border border-transparent hover:border-white hover:shadow-sm">
            
            {/* Info Customer (Avatar & Nama) */}
            <div className="col-span-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFD13B] flex items-center justify-center font-bold text-xs text-[#1C1D36] shadow-sm">
                {c.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-[#1C1D36] truncate">{c.name}</p>
                <p className="text-[10px] font-semibold text-slate-400">
                  {c.id} · <span className="text-emerald-500">{c.value}</span>
                </p>
              </div>
            </div>
            
            {/* Info Risk (Angka & Progress Bar) */}
            <div className="col-span-2 pr-4">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-[#1C1D36]">{c.risk}%</span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${c.risk}%` }} />
              </div>
            </div>
            
            {/* Info Segment */}
            <div className="col-span-3">
              <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full ${segmentColors[c.segment]}`}>
                {c.segment}
              </span>
            </div>
            
            {/* Info Last Purchase */}
            <div className="col-span-2 text-right text-[11px] font-semibold text-slate-500">
              {c.last}
            </div>
            
          </div>
        ))}
      </div>
      
    </div>
  );
}
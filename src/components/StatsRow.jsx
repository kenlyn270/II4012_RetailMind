import { Users, TrendingDown, Layers, Megaphone, ArrowUpRight, ArrowDownRight } from "lucide-react";

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatPct(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return null;
  return `${Number(value).toFixed(1)}%`;
}

function buildStats(datasetProfile) {
  const profile = datasetProfile?.profile;
  const total = datasetProfile?.customerCount || profile?.n_customers || 0;
  const churnCounts = datasetProfile?.summary?.churnCounts;
  const cltvCounts = datasetProfile?.summary?.cltvCounts;
  const churnHigh = churnCounts
    ? (((churnCounts.high || 0) + (churnCounts.critical || 0)) / Math.max(total, 1)) * 100
    : profile?.churn_distribution?.high ?? profile?.churn_high_pct;
  const cltvHigh = cltvCounts
    ? ((cltvCounts.A || 0) / Math.max(total, 1)) * 100
    : profile?.cltv_distribution?.high ?? profile?.cltv_high_pct;

  return [
    {
      label: "Total Customers",
      value: datasetProfile ? formatNumber(datasetProfile.customerCount) : "5,120",
      change: datasetProfile ? "Uploaded" : "+12.4%",
      trend: "up",
      icon: Users,
      variant: "color1",
    },
    {
      label: "Predicted Churn Rate",
      value: formatPct(churnHigh) || "12.5%",
      sub: datasetProfile ? "High-risk customers" : "30-day average",
      change: datasetProfile ? "Profiled" : "+2.1%",
      trend: "up",
      icon: TrendingDown,
      variant: "color2",
    },
    {
      label: "CLTV Profile",
      value: formatPct(cltvHigh) || "Champions",
      sub: datasetProfile ? "High-value customers" : "310 customers",
      change: datasetProfile ? "Calibrated" : "Top tier",
      trend: "up",
      icon: Layers,
      variant: "color3",
    },
    {
      label: "Active Campaigns",
      value: "8",
      sub: "AI-generated",
      change: "+3 this week",
      trend: "up",
      icon: Megaphone,
      variant: "color4",
    },
  ];
}

const variantStyles = {
  color1: "bg-gradient-to-br from-[#FFD13B] to-[#FFA951] text-[#1C1D36]",
  color2: "bg-gradient-to-br from-[#FFA951] to-[#FDC591] text-[#1C1D36]",
  color3: "bg-gradient-to-br from-[#FDC591] to-[#FCEFB4] text-[#1C1D36]",
  color4: "bg-gradient-to-br from-[#FCEFB4] to-[#FFF394] text-[#1C1D36]",
};

export default function StatsRow({ datasetProfile }) {
  const stats = buildStats(datasetProfile);

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const isDark = stat.variant === "dark";
        const isYellow = stat.variant === "yellow";
        const Icon = stat.icon;

        return (
          <div
            key={stat.label}
            className={`${variantStyles[stat.variant]} rounded-[32px] p-6 shadow-sm border ${
              isDark ? "border-white/5" : "border-white"
            } relative overflow-hidden transition-transform hover:scale-[1.02] duration-300`}
          >
            <div className="flex items-start justify-between mb-6">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  isDark ? "bg-white/10" : isYellow ? "bg-black/10" : "bg-slate-100"
                }`}
              >
                <Icon className={`w-5 h-5 ${isYellow ? "text-[#1C1D36]" : isDark ? "text-white" : "text-slate-500"}`} />
              </div>
              <div
                className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${
                  isDark ? "bg-white/10 text-white" : isYellow ? "bg-black/10 text-[#1C1D36]" : "bg-slate-100 text-slate-500"
                }`}
              >
                {stat.trend === "up" ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {stat.change}
              </div>
            </div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"} mb-1`}>
                {stat.label}
              </p>
              <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
              {stat.sub && (
                <p className={`text-[10px] mt-1 font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {stat.sub}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
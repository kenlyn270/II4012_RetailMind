import { Users, TrendingDown, Layers, Megaphone, ArrowUpRight, ArrowDownRight } from "lucide-react";

const stats = [
  {
    label: "Total Customers",
    value: "5,120",
    change: "+12.4%",
    trend: "up",
    icon: Users,
    variant: "color1",
  },
  {
    label: "Predicted Churn Rate",
    value: "12.5%",
    sub: "30-day average",
    change: "+2.1%",
    trend: "up",
    icon: TrendingDown,
    variant: "color1",
  },
  {
    label: "RFM Segments",
    value: "Champions",
    sub: "310 customers",
    change: "Top tier",
    trend: "up",
    icon: Layers,
    variant: "color1",
  },
  {
    label: "Active Campaigns",
    value: "8",
    sub: "AI-generated",
    change: "+3 this week",
    trend: "up",
    icon: Megaphone,
    variant: "color1",
  },
];

const variantStyles = {
  color1: "bg-gradient-to-br from-[#FFD13B] to-[#FFBE46] text-[#1C1D36]",
  color2: "bg-gradient-to-br from-[#FFBE46] to-[#FFA951] text-[#1C1D36]",
  color3: "bg-gradient-to-br from-[#FFA951] to-[#FEB771] text-[#1C1D36]",
  color4: "bg-gradient-to-br from-[#FEB771] to-[#FDC591] text-[#1C1D36]",
};

export default function StatsRow() {
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
import React, { useState } from "react";
import { ArrowLeft, User, Phone, MapPin, Calendar, TrendingUp, CreditCard, Activity, AlertTriangle, ShieldCheck, Lightbulb } from "lucide-react";

const segmentColors = {
  "At Risk": "bg-red-100 text-red-600",
  "Hibernating": "bg-slate-200 text-slate-600",
  "High Value": "bg-amber-100 text-amber-700",
  "New/Occasional": "bg-emerald-100 text-emerald-700",
};

export default function CustomerDetail({ customers, onBack }) {
  const [selectedId, setSelectedId] = useState(null);
  const selectedCustomer = customers.find(c => c.customerId === selectedId);

  const money = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(val || 0));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-[#1C1D36] font-bold text-sm mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Intelligence
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white shadow-sm">
            <h3 className="font-bold text-lg text-[#1C1D36] mb-4">All Customers</h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {customers.map((c) => (
                <div 
                  key={c.customerId} 
                  onClick={() => setSelectedId(c.customerId)}
                  className={`p-4 rounded-2xl transition cursor-pointer border ${
                    selectedId === c.customerId 
                      ? "bg-[#1C1D36] border-[#1C1D36] text-white shadow-lg" 
                      : "bg-white/40 border-transparent hover:bg-white/60 hover:border-white"
                  } flex items-center gap-3`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                    selectedId === c.customerId ? "bg-amber-400 text-[#1C1D36]" : "bg-amber-100 text-amber-600"
                  }`}>
                    {String(c.customerId).slice(-2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm truncate ${selectedId === c.customerId ? "text-white" : "text-[#1C1D36]"}`}>
                      Customer {c.customerId}
                    </p>
                    <p className={`text-[10px] font-semibold ${selectedId === c.customerId ? "text-slate-400" : "text-slate-400"}`}>
                      {c.kmeansSegment || "Unsegmented"}
                    </p>
                  </div>
                  {selectedId === c.customerId && <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                </div>
              ))}
              {customers.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-sm text-slate-400">No customers found.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Detail */}
        <div className="lg:col-span-8">
          {selectedCustomer ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Profile Header */}
              <div className="bg-white/70 backdrop-blur-md rounded-[40px] p-8 border border-white shadow-sm flex flex-col md:flex-row items-center gap-8">
                <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-[#FFD13B] to-[#FFA951] flex items-center justify-center text-3xl font-bold text-[#1C1D36] shadow-xl shadow-yellow-200/50">
                  {String(selectedCustomer.customerId).slice(-2)}
                </div>
                <div className="text-center md:text-left flex-1">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                    <h2 className="text-3xl font-bold text-[#1C1D36]">Customer {selectedCustomer.customerId}</h2>
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${segmentColors[selectedCustomer.kmeansSegment] || "bg-slate-100"}`}>
                      {selectedCustomer.kmeansSegment || "Unsegmented"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-slate-500 text-sm font-medium">
                    <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {selectedCustomer.country || "Unknown"}</div>
                    <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Joined: Oct 2024</div>
                    <div className="flex items-center gap-1.5"><Activity className="w-4 h-4" /> Status: {selectedCustomer.churnRiskLevel || "Unknown"}</div>
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Recency</p>
                  <p className="text-2xl font-bold text-[#1C1D36]">{selectedCustomer.recency || 0} <span className="text-xs text-slate-400">days ago</span></p>
                </div>
                <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Frequency</p>
                  <p className="text-2xl font-bold text-[#1C1D36]">{selectedCustomer.frequency || 0} <span className="text-xs text-slate-400">orders</span></p>
                </div>
                <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monetary</p>
                  <p className="text-2xl font-bold text-emerald-600">{money(selectedCustomer.monetary)}</p>
                </div>
              </div>

              {/* AI Insights Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Churn Risk */}
                <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${Number(selectedCustomer.churnRiskScore || 0) > 70 ? 'bg-red-100' : 'bg-emerald-100'}`}>
                      {Number(selectedCustomer.churnRiskScore || 0) > 70 ? <AlertTriangle className="w-5 h-5 text-red-500" /> : <ShieldCheck className="w-5 h-5 text-emerald-500" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1C1D36]">Churn Prediction</h4>
                      <p className="text-xs text-slate-500">AI-calculated risk score</p>
                    </div>
                  </div>
                  <div className="flex items-end gap-3 mb-4">
                    <p className="text-4xl font-bold text-[#1C1D36]">{Number(selectedCustomer.churnRiskScore || 0).toFixed(1)}%</p>
                    <p className={`text-xs font-bold pb-1 ${Number(selectedCustomer.churnRiskScore || 0) > 70 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {selectedCustomer.churnRiskLevel || "N/A"}
                    </p>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${Number(selectedCustomer.churnRiskScore || 0) > 70 ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Number(selectedCustomer.churnRiskScore || 0)}%` }}
                    />
                  </div>
                </div>

                {/* CLTV Forecast */}
                <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1C1D36]">6-Month CLTV</h4>
                      <p className="text-xs text-slate-500">Expected future value</p>
                    </div>
                  </div>
                  <div className="flex items-end gap-3 mb-4">
                    <p className="text-4xl font-bold text-[#1C1D36]">{money(selectedCustomer.cltv6Months)}</p>
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1">Tier {selectedCustomer.cltvSegment || "?"}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed italic">
                    Based on historical frequency and average transaction size.
                  </p>
                </div>
              </div>

              {/* Strategy & Explanation */}
              <div className="bg-[#1C1D36] rounded-[32px] p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 blur-[100px] rounded-full -mr-32 -mt-32" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-amber-400" />
                    </div>
                    <h4 className="font-bold text-lg text-white">AI Recommended Strategy</h4>
                  </div>
                  <div className="bg-white/10 border border-white/10 rounded-2xl p-6 mb-6">
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Action Plan</p>
                    <p className="text-2xl font-bold mb-3">{selectedCustomer.recommendedAction || "Standard Nurture"}</p>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {selectedCustomer.explanation || "No automated explanation available for this profile."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/70 backdrop-blur-md rounded-[40px] p-10 border border-white shadow-sm h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
                <User className="w-10 h-10 text-slate-300" />
              </div>
              <h2 className="text-2xl font-bold text-[#1C1D36] mb-2">Select a customer to view details</h2>
              <p className="text-slate-500 max-w-sm">
                Deep-dive into individual customer behavior, churn probability, and personalized AI recommendations.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

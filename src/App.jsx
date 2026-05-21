import { useState } from "react";
import StatsRow from "./components/StatsRow";
import AICopywriter from "./components/AICopywriter";
import ChurnChart from "./components/ChurnChart";
import HighRiskTable from "./components/HighRiskTable";
import RFMMap from "./components/RFMMap";
import SegmentBreakdown from "./components/SegmentBreakdown";
import WhatsAppCampaign from "./components/WhatsAppCampaign";

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState("intelligence"); // "intelligence" or "campaigns"

  const openModal = (tab) => {
    setActiveTab(tab);
    setIsModalOpen(true);
  };

  const handleAuth = (e) => {
    e.preventDefault();
    setIsModalOpen(false);
    setIsLoggedIn(true);
  };

  if (isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FCFAF5] to-[#FBE7B2] flex flex-col items-center p-4 md:p-8 font-sans">
        
        {/* Container Dashboard Utama (Gradient Cream & Rounded Besar ala Crextio) */}
        <div className="w-full max-w-[1500px]">
          {/* Header / Navbar Dalam */}
          <nav className="flex justify-between items-center mb-8 relative z-10">
            <div className="font-bold text-xl flex items-center gap-2 text-[#1C1D36] bg-white/60 backdrop-blur-md px-6 py-2 rounded-full border border-white shadow-sm">
              <span className="text-amber-400">✨</span> RetailMind
            </div>
            
            {/* Nav Pills Tengah */}
            <div className="hidden md:flex items-center gap-1 bg-white/40 p-1 rounded-full border border-white/20">
              <button 
                onClick={() => setCurrentView("intelligence")}
                className={`px-6 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition ${
                  currentView === "intelligence" 
                    ? "bg-[#1C1D36] text-white shadow-md" 
                    : "text-slate-500 hover:text-[#1C1D36]"
                }`}
              >
                Intelligence
              </button>
              <button 
                onClick={() => setCurrentView("campaigns")}
                className={`px-6 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition ${
                  currentView === "campaigns" 
                    ? "bg-[#1C1D36] text-white shadow-md" 
                    : "text-slate-500 hover:text-[#1C1D36]"
                }`}
              >
                Campaigns
              </button>
            </div>

            {/* Profile & Controls */}
            <div className="flex items-center gap-4">
              <button onClick={() => setIsLoggedIn(false)} className="text-slate-500 hover:text-red-500 font-semibold text-sm transition">
                Logout
              </button>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer shadow-sm">🔔</div>
                <div className="w-10 h-10 rounded-full bg-[#FFD13B] flex items-center justify-center text-[#1C1D36] font-bold shadow-md cursor-pointer border border-yellow-400">RM</div>
              </div>
            </div>
          </nav>

          {/* Title Area */}
          <div className="mb-8 relative z-10">
            <h1 className="text-4xl md:text-[2.5rem] font-sans font-medium text-[#1C1D36] tracking-tight mb-2">
              Welcome back, Admin
            </h1>
            <p className="text-slate-500 font-medium">Here's your AI-powered customer intelligence overview for today.</p>
          </div>

          {/* Main Content Grid */}
          <div className="relative z-10">
            {currentView === "intelligence" ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* KIRI & TENGAH: Stats & Charts (8 Kolom) */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                  <StatsRow />

                  {/* 2 Area Chart Bawah */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                    
                    {/* Chart 1: Churn Trend */}
                    <ChurnChart />

                    {/* Chart 2: RFM Map */}
                    <RFMMap />
                    <HighRiskTable />
                    <SegmentBreakdown />

                  </div>
                </div>

                {/* KANAN: Panel AI Copywriter (Dark Panel ala Crextio contrast) */}
                <div className="lg:col-span-4">
                  <AICopywriter />
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in duration-500">
                <WhatsAppCampaign />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FCFAF5] relative flex flex-col items-center justify-center p-8 font-sans">
      <div className="w-full max-w-[1200px] flex flex-col xl:flex-row items-center justify-between gap-16 xl:gap-8 h-full">
        
        {/* === BAGIAN KIRI === */}
        <div className="flex-1 space-y-8 z-10 w-full max-w-xl">
          <div className="space-y-4">
            <span className="inline-block border border-amber-200 px-4 py-1.5 rounded-full text-amber-500 text-[10px] font-bold tracking-[0.15em] uppercase bg-white/50">
              RetailMind - AI Platform for Retail Growth
            </span>
            <h1 className="text-6xl md:text-[5.5rem] font-serif font-bold text-[#1C1D36] leading-[1.05] tracking-tight">
              Predict your <br />
              <span className="text-[#FFB800] italic">Customer Aura</span> <br />
              effortlessly
            </h1>
            <p className="text-lg text-slate-600 max-w-md leading-relaxed pt-2">
              Discover churn risks, segment customers smartly, and let AI craft the perfect copywriting just from one dashboard.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <button 
              onClick={() => openModal("login")}
              className="bg-[#FFD13B] text-[#1C1D36] px-8 py-4 rounded-full font-bold shadow-xl shadow-yellow-200/50 hover:scale-105 transition-transform duration-300"
            >
              Get Started — Login
            </button>
            <button 
              onClick={() => openModal("register")}
              className="bg-white text-[#1C1D36] border border-[#1C1D36] px-10 py-4 rounded-full font-bold hover:bg-slate-50 transition-colors duration-300 shadow-sm"
            >
              Register
            </button>
          </div>
        </div>

        {/* === BAGIAN KANAN === */}
        <div className="flex-1 w-full max-w-[500px] z-10 relative mt-10 xl:mt-0">
          <div className="w-full h-[450px] md:h-[600px] rounded-[40px] overflow-hidden shadow-2xl relative bg-[#F3EBE1]">
            <img 
              src="https://plus.unsplash.com/premium_photo-1683746792239-6ce8cdd3ac78?q=80&w=687&auto=format&fit=crop" 
              alt="Yellow Shopping Bags" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
          </div>
          
          <div className="absolute top-12 -left-6 md:-left-16 bg-white px-5 py-4 rounded-2xl shadow-xl z-20 animate-float-1 flex items-center gap-4 min-w-[180px] border border-slate-50">
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Feature 1</p>
              <p className="text-sm font-bold text-[#1C1D36]">Churn Risk Prediction</p>
            </div>
          </div>
          <div className="absolute top-1/2 -translate-y-1/2 -right-6 md:-right-12 bg-white px-5 py-4 rounded-2xl shadow-xl z-20 animate-float-2 border border-slate-50">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Feature 2</p>
            <p className="text-sm font-bold text-[#1C1D36]">Customer Segmentation</p>
          </div>
          <div className="absolute bottom-16 -left-4 md:-left-10 bg-white px-5 py-4 rounded-2xl shadow-xl z-20 animate-float-3 flex items-center gap-4 min-w-[180px] border border-slate-50">
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Feature 3</p>
              <p className="text-sm font-bold text-[#1C1D36]">AI Copywriter</p>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[40px] p-10 shadow-2xl relative animate-float-1">
            <button 
              onClick={() => setIsModalOpen(false)} 
              className="absolute top-6 right-8 text-slate-300 hover:text-amber-500 text-3xl font-light transition"
            >
              &times;
            </button>
            <div className="flex space-x-8 mb-8 border-b border-slate-100 pb-2">
              <button 
                onClick={() => setActiveTab('login')} 
                className={`font-bold pb-2 transition cursor-pointer border-b-2 ${activeTab === 'login' ? 'text-[#1C1D36] border-[#FFB800]' : 'text-slate-300 border-transparent hover:text-slate-500'}`}
              >
                Login
              </button>
              <button 
                onClick={() => setActiveTab('register')} 
                className={`font-bold pb-2 transition cursor-pointer border-b-2 ${activeTab === 'register' ? 'text-[#1C1D36] border-[#FFB800]' : 'text-slate-300 border-transparent hover:text-slate-500'}`}
              >
                Register
              </button>
            </div>

            {activeTab === 'login' && (
              <form onSubmit={handleAuth} className="space-y-4">
                <h2 className="text-2xl font-bold text-[#1C1D36] mb-6">Welcome Back!</h2>
                <input type="email" required placeholder="Email Address" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-400 focus:bg-white transition text-sm" />
                <input type="password" required placeholder="Password" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-400 focus:bg-white transition text-sm" />
                <button type="submit" className="w-full bg-[#FFD13B] text-[#1C1D36] py-4 rounded-2xl font-bold shadow-lg shadow-yellow-200/50 hover:scale-[1.02] transition mt-2">
                  Login to RetailMind
                </button>
              </form>
            )}

            {activeTab === 'register' && (
              <form onSubmit={handleAuth} className="space-y-4">
                <h2 className="text-2xl font-bold text-[#1C1D36] mb-6">Join the Platform.</h2>
                <input type="text" required placeholder="Full Name" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-400 focus:bg-white transition text-sm" />
                <input type="email" required placeholder="Email Address" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-400 focus:bg-white transition text-sm" />
                <input type="password" required placeholder="Create Password" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-400 focus:bg-white transition text-sm" />
                <button type="submit" className="w-full bg-[#1C1D36] text-white py-4 rounded-2xl font-bold shadow-lg shadow-slate-300 hover:scale-[1.02] transition mt-2">
                  Create Account
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
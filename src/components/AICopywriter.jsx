import { Sparkles, Send, Copy, RefreshCw, Wand2 } from "lucide-react";
import { useState } from "react";

const segments = ["Loyal", "At Risk", "Hibernating"];
const goals = ["Re-engage", "Upsell", "Reward"];
const tones = ["Friendly", "Professional", "Urgent"];

const samples = {
  "At Risk": {
    subject: "Kami merindukanmu — diskon spesial 15% untukmu 💛",
    body: "Hai [Nama], sudah lama kami tak melihatmu! Sebagai pelanggan berharga, nikmati diskon 15% untuk pembelian berikutnya. Berlaku hingga akhir minggu — jangan sampai terlewat!",
  },
  "Loyal": {
    subject: "Terima kasih telah setia bersama kami ✨",
    body: "Hai [Nama], loyalitasmu berarti banget! Kami siapkan akses early-bird ke koleksi terbaru + free shipping khusus untukmu. Yuk intip sekarang.",
  },
  "Hibernating": {
    subject: "Saatnya kembali — ada kejutan menanti 🎁",
    body: "Hai [Nama], sudah berbulan-bulan kami tak bertemu. Kami siapkan voucher 20% + hadiah eksklusif untuk pembelian pertamamu kembali.",
  },
};

export default function AICopywriter() {
  const [segment, setSegment] = useState("At Risk");
  const [goal, setGoal] = useState("Re-engage");
  const [tone, setTone] = useState("Friendly");
  const [length, setLength] = useState(50);
  
  const sample = samples[segment];

  return (
    <div className="bg-[#1C1D36] text-white rounded-[32px] p-6 shadow-2xl border border-slate-700/50 h-full flex flex-col relative overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 border-b border-slate-700/50 pb-4">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shadow-inner">
          <Sparkles className="w-5 h-5 text-[#FFD13B]" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-white">AI Copywriter</h3>
          <p className="text-xs text-slate-400">Generate offers per segment</p>
        </div>
      </div>

      {/* Segment chips */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Target Segment</p>
        <div className="flex gap-1.5 bg-white/5 p-1.5 rounded-full border border-white/10">
          {segments.map((s) => (
            <button
              key={s}
              onClick={() => setSegment(s)}
              className={`flex-1 text-xs font-semibold py-2 rounded-full transition-all ${
                segment === s 
                  ? "bg-[#FFD13B] text-[#1C1D36] shadow-md" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Generated card */}
      <div className="bg-black/20 backdrop-blur rounded-[20px] p-5 mb-4 border border-white/10 flex-1 relative">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-[#FFD13B]/20 flex items-center justify-center">
            <Wand2 className="w-3 h-3 text-[#FFD13B]" />
          </div>
          <span className="text-xs font-semibold text-amber-400">Email Draft</span>
          <span className="ml-auto text-[9px] px-2 py-0.5 rounded bg-white/10 text-slate-300 font-semibold">AI</span>
        </div>
        
        <p className="text-sm font-bold mb-2 leading-snug text-white">{sample.subject}</p>
        <p className="text-xs text-slate-300 leading-relaxed font-light">{sample.body}</p>
        
        <div className="flex gap-2 mt-6">
          <button className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition border border-white/10">
            <Copy className="w-3 h-3" /> Copy
          </button>
          <button className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition border border-white/10">
            <RefreshCw className="w-3 h-3" /> Regenerate
          </button>
        </div>
      </div>

      {/* Controls (Goal, Tone, Length) */}
      <div className="space-y-4 mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Goal</p>
          <div className="flex gap-1.5 flex-wrap">
            {goals.map((g) => (
              <button
                key={g}
                onClick={() => setGoal(g)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition ${
                  goal === g 
                    ? "bg-[#FFD13B] text-[#1C1D36]" 
                    : "bg-transparent border border-white/20 text-slate-400 hover:text-white"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Tone</p>
          <div className="flex gap-1.5 flex-wrap">
            {tones.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition ${
                  tone === t 
                    ? "bg-[#FFD13B] text-[#1C1D36]" 
                    : "bg-transparent border border-white/20 text-slate-400 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <div className="flex justify-between mb-2 mt-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Copy length</p>
            <span className="text-[10px] text-amber-400 font-semibold">{length} words</span>
          </div>
          <input
            type="range"
            min="20"
            max="120"
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#FFD13B]"
          />
        </div>
      </div>

      {/* Primary Action Button */}
      <button className="w-full bg-[#FFD13B] text-[#1C1D36] font-bold text-sm py-3.5 rounded-2xl shadow-lg shadow-yellow-500/20 hover:scale-[1.02] transition flex items-center justify-center gap-2 mt-auto">
        <Send className="w-4 h-4" />
        Generate New Copy
      </button>
      
    </div>
  );
}
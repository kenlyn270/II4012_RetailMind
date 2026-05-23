import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import {
  approveCampaign,
  createCampaign,
  generateCopywritingPreview,
  getCampaign,
  getCampaignJobs,
  getDemoBlastTargets,
  getSegments,
  getSegmentPreview,
  pauseCampaign,
  resumeCampaign,
  runDemoBlast,
  testSend,
  triggerCampaign,
} from "../api";

const iconMap = {
  high_value: ShieldCheck,
  at_risk: AlertCircle,
  hibernating: MessageSquare,
  new_occasional: Sparkles,
};

const colorMap = {
  high_value: "bg-emerald-100 text-emerald-600",
  at_risk: "bg-orange-100 text-orange-600",
  hibernating: "bg-slate-100 text-slate-600",
  new_occasional: "bg-sky-100 text-sky-600",
};

function buildMessage(segment) {
  if (segment?.id === "high_value") {
    return "Halo {name}! ✨ Terima kasih sudah jadi pelanggan setia kami. Kami siapkan akses awal koleksi terbaru khusus untukmu. Cek di sini: {cta_link}\n\nBalas STOP jika tidak ingin menerima info promo.";
  }
  if (segment?.id === "new_occasional") {
    return "Halo {name}! 👋 Terima kasih sudah berbelanja. Cek rekomendasi yang cocok untukmu di sini: {cta_link}\n\nBalas STOP jika tidak ingin menerima info promo.";
  }
  return "Halo {name}! 👋 Sudah {last_purchase_days} hari sejak kunjungan terakhirmu. Kami punya rekomendasi baru yang mungkin kamu suka: {cta_link}\n\nBalas STOP jika tidak ingin menerima info promo.";
}

function statValue(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

export default function WhatsAppCampaign() {
  const [step, setStep] = useState(1);
  const [segments, setSegments] = useState([]);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [preview, setPreview] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [testNumber, setTestNumber] = useState("");
  const [ctaLink, setCtaLink] = useState("Balas INFO untuk dibantu admin");
  const [isGenerating, setIsGenerating] = useState(false);
  const [promoDetails, setPromoDetails] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Demo blast state
  const [demoTargets, setDemoTargets] = useState([]);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoResults, setDemoResults] = useState(null);
  const [demoCta, setDemoCta] = useState("Balas INFO untuk dibantu admin");
  const [demoPromo, setDemoPromo] = useState("");

  const messageChars = generatedMessage.length;
  const emojiCount = (
    generatedMessage.match(
      /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu,
    ) || []
  ).length;
  const hasOptOut = /STOP|BERHENTI|UNSUBSCRIBE|tidak ingin menerima/i.test(
    generatedMessage,
  );
  const hasNameToken = generatedMessage.includes("{name}");
  const hasCtaToken = generatedMessage.includes("{cta_link}");
  const qualityChecks = [
    {
      label: `${messageChars}/400 chars`,
      ok: messageChars > 0 && messageChars <= 400,
      warn: messageChars > 400,
    },
    { label: `${emojiCount} emoji`, ok: emojiCount <= 3, warn: emojiCount > 3 },
    { label: hasOptOut ? "Opt-out present" : "Missing opt-out", ok: hasOptOut },
    {
      label: hasNameToken ? "{name} token" : "Missing {name}",
      ok: hasNameToken,
    },
    {
      label: hasCtaToken ? "{cta_link} token" : "Missing {cta_link}",
      ok: hasCtaToken,
    },
  ];

  useEffect(() => {
    let cancelled = false;
    getSegments()
      .then((data) => {
        if (!cancelled) {
          setSegments(data.segments || []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    getDemoBlastTargets()
      .then((data) => {
        if (!cancelled) setDemoTargets(data.targets || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!campaign?.id || step !== 4) return;
    const timer = setInterval(async () => {
      try {
        const fresh = await getCampaign(campaign.id);
        const jobData = await getCampaignJobs(campaign.id, { limit: 8 });
        setCampaign(fresh);
        setJobs(jobData.jobs || []);
      } catch (err) {
        setError(err.message);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [campaign?.id, step]);

  const totals = campaign?.jobs || {};
  const finished =
    Number(totals.sent || 0) +
    Number(totals.delivered || 0) +
    Number(totals.read || 0) +
    Number(totals.failed || 0);
  const progress = totals.total
    ? Math.min(100, Math.round((finished / totals.total) * 100))
    : 0;

  const SelectedIcon = useMemo(
    () => (selectedSegment ? iconMap[selectedSegment.id] || Users : Users),
    [selectedSegment],
  );

  async function handleSelectSegment(seg) {
    setError("");
    setNotice("");
    setSelectedSegment(seg);
    setStep(2);
    setLoading(true);
    try {
      setPreview(await getSegmentPreview(seg.id, 10));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateAIContent() {
    setIsGenerating(true);
    setError("");
    setNotice("");
    try {
      const result = await generateCopywritingPreview({
        segmentId: selectedSegment.id,
        segmentLabel: selectedSegment.label,
        goal:
          selectedSegment.id === "high_value"
            ? "Loyalty maintenance"
            : "Win-back and reactivation",
        ctaLink,
        promoDetails: promoDetails || null,
      });
      setGeneratedMessage(result.message);
      const sourceLabel =
        result.source === "cache"
          ? "💾 Dari cache (hemat token)"
          : result.source === "fallback"
            ? "📋 Template fallback (LLM unavailable)"
            : `🤖 Gemini (${result.model})`;
      setNotice(`Pesan ter-generate. Sumber: ${sourceLabel}`);
      setStep(3);
    } catch (err) {
      setError(
        "AI generate gagal: " +
          err.message +
          ". Menggunakan template fallback.",
      );
      setGeneratedMessage(buildMessage(selectedSegment));
      setStep(3);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSendTest() {
    if (!testNumber || !generatedMessage)
      return setError("Isi nomor test dan pesan dulu.");
    setLoading(true);
    setError("");
    try {
      const tempCampaign = campaign || (await createDraftCampaign());
      setCampaign(tempCampaign);
      await testSend(
        tempCampaign.id,
        testNumber,
        generatedMessage.replaceAll("{cta_link}", ctaLink),
      );
      setNotice(
        "Test message berhasil diproses (dry-run jika token Fonnte belum diisi).",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function createDraftCampaign() {
    return createCampaign({
      name: `${selectedSegment.label} WhatsApp Campaign`,
      segmentFilter: {
        segmentId: selectedSegment.id,
        maxRecipients: 1,
        ctaLink,
        demoMode: true,
      },
      goal:
        selectedSegment.id === "high_value"
          ? "Loyalty maintenance"
          : "Win-back and reactivation",
      campaignBrief: `Demo-safe outbound WhatsApp untuk ${selectedSegment.label}. CTA: ${ctaLink}. Route ke 1 nomor perwakilan segmen.`,
      messageTemplate: generatedMessage.replaceAll("{cta_link}", ctaLink),
      createdBy: "admin",
    });
  }

  async function launchCampaign() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const draft = campaign || (await createDraftCampaign());
      const approved =
        draft.status === "draft" ? await approveCampaign(draft.id) : draft;
      const running = await triggerCampaign(approved.id);
      const jobData = await getCampaignJobs(running.id, { limit: 8 });
      setCampaign(running);
      setJobs(jobData.jobs || []);
      setStep(4);
      setNotice(
        "Campaign berjalan. Worker akan mengirim bertahap sesuai throttle.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function togglePause() {
    if (!campaign) return;
    const updated =
      campaign.status === "paused"
        ? await resumeCampaign(campaign.id)
        : await pauseCampaign(campaign.id);
    setCampaign(updated);
  }

  function applyQuickRefine(type) {
    const text = generatedMessage.trim();
    if (!text) return;

    if (type === "shorter") {
      setGeneratedMessage(
        text.split(" ").slice(0, 45).join(" ") +
          (text.split(" ").length > 45 ? "..." : ""),
      );
      return;
    }

    if (type === "urgent") {
      const urgentPrefix = "Jangan sampai terlewat, {name}! ";
      setGeneratedMessage(
        text.startsWith("Jangan sampai") ? text : urgentPrefix + text,
      );
      return;
    }

    if (type === "warmer") {
      setGeneratedMessage(
        text.replace(/^Halo|^Hai/i, "Hai {name}, semoga harimu menyenangkan!"),
      );
      return;
    }

    if (type === "optout" && !hasOptOut) {
      setGeneratedMessage(
        `${text}\n\nBalas STOP jika tidak ingin menerima info promo.`,
      );
      return;
    }

    if (type === "cta" && !hasCtaToken) {
      setGeneratedMessage(`${text}\nCek di sini: {cta_link}`);
    }
  }

  function appendToken(token) {
    setGeneratedMessage(
      (prev) => `${prev}${prev.endsWith(" ") || !prev ? "" : " "}${token}`,
    );
  }

  async function handleDemoBlast() {
    setDemoLoading(true);
    setDemoResults(null);
    setError("");
    setNotice("");
    try {
      const result = await runDemoBlast({
        ctaLink: demoCta,
        promoDetails: demoPromo || null,
        dryRun: false,
      });
      setDemoResults(result);
      setNotice(
        `Demo blast selesai: ${result.totalSent} terkirim, ${result.totalFailed} gagal${result.dryRun ? " (dry-run, FONNTE_TOKEN belum diisi)" : ""}.`,
      );
    } catch (err) {
      setError("Demo blast gagal: " + err.message);
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-4xl md:text-[2.5rem] font-sans font-bold text-[#1C1D36] tracking-tight mb-2">
          WhatsApp Campaign
        </h1>
        <p className="text-slate-500 font-medium">
          Real audience preview, approval, test-send, and Fonnte dispatch.
        </p>
      </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDemoOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-[#FFD13B] to-amber-400 text-[#1C1D36] px-5 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider shadow-md hover:scale-[1.02] transition"
          >
            <Zap className="w-4 h-4" /> Demo Blast (4 Segmen)
          </button>
          <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              API Connected
            </span>
          </div>
        </div>
      </div>

      {(error || notice) && (
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-semibold ${error ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"}`}
        >
          {error || notice}
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step === s ? "bg-[#FFD13B] text-[#1C1D36] shadow-md" : step > s ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}
            >
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
            {s < 4 && (
              <div
                className={`w-8 md:w-16 h-0.5 mx-1 ${step > s ? "bg-emerald-500" : "bg-slate-200"}`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-8 border border-white shadow-sm min-h-[520px] flex flex-col">
        {step === 1 && (
          <div>
            <h3 className="text-xl font-bold text-[#1C1D36] mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" /> Select Audience
              Segment
            </h3>
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {segments.map((seg) => {
                  const Icon = iconMap[seg.id] || Users;
                  return (
                    <button
                      key={seg.id}
                      onClick={() => handleSelectSegment(seg)}
                      className="flex items-start gap-4 p-6 rounded-[24px] border-2 border-transparent bg-white hover:border-amber-300 hover:shadow-md transition text-left group"
                    >
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorMap[seg.id] || "bg-slate-100 text-slate-600"}`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <p className="font-bold text-[#1C1D36]">
                            {seg.label}
                          </p>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500">
                            {statValue(seg.totalCustomers)} Customers
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {seg.description}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500 transition self-center" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 2 && selectedSegment && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#1C1D36] flex items-center gap-2">
                <SelectedIcon className="w-5 h-5 text-amber-500" /> Preview:{" "}
                {selectedSegment.label}
              </h3>
              <button
                onClick={() => setStep(1)}
                className="text-xs font-bold text-slate-500 hover:text-[#1C1D36]"
              >
                Change Segment
              </button>
            </div>
            {loading || !preview ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      Model Match
                    </p>
                    <p className="text-2xl font-bold">
                      {statValue(preview.totalModelMatches)}
                    </p>
                  </div>
                  <div className="bg-emerald-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">
                      Eligible
                    </p>
                    <p className="text-2xl font-bold">
                      {statValue(preview.eligibleContacts)}
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-amber-600 uppercase">
                      No Opt-in
                    </p>
                    <p className="text-2xl font-bold">
                      {statValue(preview.excluded.notOptedIn)}
                    </p>
                  </div>
                  <div className="bg-red-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-red-600 uppercase">
                      Blacklist
                    </p>
                    <p className="text-2xl font-bold">
                      {statValue(preview.excluded.blacklisted)}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      Freq Cap
                    </p>
                    <p className="text-2xl font-bold">
                      {statValue(preview.excluded.frequencyCapped)}
                    </p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden mb-8">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="p-4 text-[11px] font-bold uppercase text-slate-400">
                          ID
                        </th>
                        <th className="p-4 text-[11px] font-bold uppercase text-slate-400">
                          Name
                        </th>
                        <th className="p-4 text-[11px] font-bold uppercase text-slate-400">
                          WA
                        </th>
                        <th className="p-4 text-[11px] font-bold uppercase text-slate-400">
                          Risk
                        </th>
                        <th className="p-4 text-[11px] font-bold uppercase text-slate-400">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.sample.map((row) => (
                        <tr key={row.customerId}>
                          <td className="p-4 text-xs font-bold text-slate-500">
                            {row.customerId}
                          </td>
                          <td className="p-4 text-sm font-bold text-[#1C1D36]">
                            {row.displayName}
                          </td>
                          <td className="p-4 text-xs font-semibold text-slate-500">
                            {row.phoneMasked}
                          </td>
                          <td className="p-4 text-xs font-bold text-red-500">
                            {row.churnRiskScore}%
                          </td>
                          <td className="p-4 text-[10px] font-bold text-slate-500">
                            {row.recommendedAction}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col gap-3 mt-4">
                  <button
                    onClick={generateAIContent}
                    disabled={isGenerating}
                    className="w-full bg-[#1C1D36] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.01] transition shadow-lg disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Generating
                        with AI...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-5 h-5 text-amber-400" /> Generate AI
                        Copywriting (Gemini)
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-1">
                  Copywriting Studio
                </p>
                <h3 className="text-xl font-bold text-[#1C1D36]">
                  Craft & Approve Message
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Seluruh proses AI copywriting kini ada di tab Blasting Message
                  agar flow demo lebih fokus.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => applyQuickRefine("warmer")}
                  className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold border border-amber-100"
                >
                  😊 Lebih hangat
                </button>
                <button
                  onClick={() => applyQuickRefine("urgent")}
                  className="px-3 py-1.5 rounded-full bg-red-50 text-red-600 text-[11px] font-bold border border-red-100"
                >
                  🔥 Lebih urgent
                </button>
                <button
                  onClick={() => applyQuickRefine("shorter")}
                  className="px-3 py-1.5 rounded-full bg-slate-50 text-slate-600 text-[11px] font-bold border border-slate-100"
                >
                  📏 Ringkas
                </button>
                <button
                  onClick={() => applyQuickRefine("optout")}
                  className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-100"
                >
                  ✅ Tambah opt-out
                </button>
                <button
                  onClick={() => applyQuickRefine("cta")}
                  className="px-3 py-1.5 rounded-full bg-sky-50 text-sky-700 text-[11px] font-bold border border-sky-100"
                >
                  🔗 Tambah CTA
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {["{name}", "{last_purchase_days}", "{cta_link}"].map(
                  (token) => (
                    <button
                      key={token}
                      onClick={() => appendToken(token)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-mono font-bold text-slate-600 hover:border-amber-300"
                    >
                      + {token}
                    </button>
                  ),
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50">
                <textarea
                  value={generatedMessage}
                  onChange={(e) => setGeneratedMessage(e.target.value)}
                  className="w-full h-48 p-4 bg-transparent outline-none focus:ring-0 text-sm leading-relaxed resize-none"
                />
                <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-slate-200 bg-white/70">
                  {qualityChecks.map((check) => (
                    <span
                      key={check.label}
                      className={`text-[10px] font-bold px-2 py-1 rounded-full ${check.ok ? "bg-emerald-50 text-emerald-700" : check.warn ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}
                    >
                      {check.ok ? "✓" : "⚠"} {check.label}
                    </span>
                  ))}
                </div>
              </div>

              <input
                value={ctaLink}
                onChange={(e) => setCtaLink(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-amber-400"
                placeholder="CTA atau link, misal: Balas INFO untuk dibantu admin"
              />
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-xs font-bold text-amber-700">
                  Demo routing aktif: campaign dari card segment akan dikirim ke
                  1 nomor perwakilan segmen, bukan ke seluruh audience.
                </p>
              </div>
              <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <h4 className="font-bold mb-3 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-500" /> Send Test
                </h4>
                <div className="flex gap-2">
                  <input
                    value={testNumber}
                    onChange={(e) => setTestNumber(e.target.value)}
                    className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-amber-400"
                    placeholder="62812xxxx"
                  />
                  <button
                    onClick={handleSendTest}
                    disabled={loading}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-xs disabled:opacity-50"
                  >
                    Test
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-[#E5DDD5] rounded-[32px] p-4 border border-slate-200 shadow-inner relative min-h-[420px]">
              <div className="bg-white p-3 rounded-tr-xl rounded-b-xl shadow-sm max-w-[85%]">
                <p className="text-xs leading-relaxed whitespace-pre-wrap">
                  {generatedMessage
                    .replaceAll("{name}", "Aisha")
                    .replaceAll("{last_purchase_days}", "45")
                    .replaceAll("{cta_link}", ctaLink)}
                </p>
                <p className="text-[9px] text-slate-400 text-right mt-1">
                  10:42 AM
                </p>
              </div>
              <button
                onClick={launchCampaign}
                disabled={loading}
                className="absolute bottom-6 left-6 right-6 bg-[#25D366] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] transition shadow-xl disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}{" "}
                Approve & Launch Demo Segment
              </button>
            </div>
          </div>
        )}

        {step === 4 && campaign && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            </div>
            <h3 className="text-3xl font-bold text-[#1C1D36] mb-2">
              Campaign {campaign.status}
            </h3>
            <p className="text-slate-500 mb-6">
              Progress worker: {progress}% dari {statValue(totals.total)} jobs.
            </p>
            <div className="grid grid-cols-4 gap-4 w-full max-w-2xl mb-6">
              <div>
                <p className="text-2xl font-bold">{statValue(totals.queued)}</p>
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  Queued
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold">{statValue(totals.sent)}</p>
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  Sent
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-500">
                  {statValue(
                    Number(totals.delivered || 0) + Number(totals.read || 0),
                  )}
                </p>
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  Delivered/Read
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500">
                  {statValue(totals.failed)}
                </p>
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  Failed
                </p>
              </div>
            </div>
            <button
              onClick={togglePause}
              className="bg-[#1C1D36] text-white px-6 py-3 rounded-full font-bold flex items-center gap-2"
            >
              {campaign.status === "paused" ? (
                <Play className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}{" "}
              {campaign.status === "paused" ? "Resume" : "Pause"}
            </button>
            <div className="w-full max-w-3xl mt-8 text-left bg-slate-50 rounded-2xl overflow-hidden">
              <table className="w-full">
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b border-white">
                      <td className="p-3 text-xs font-bold">
                        {job.display_name}
                      </td>
                      <td className="p-3 text-xs text-slate-500">
                        {job.phone}
                      </td>
                      <td className="p-3 text-xs font-bold">{job.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {demoOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !demoLoading && setDemoOpen(false)}
        >
          <div
            className="bg-white rounded-[32px] max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-[#1C1D36] flex items-center gap-2">
                  <Zap className="w-6 h-6 text-amber-500" /> Demo Blast
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Kirim 1 pesan AI per segmen ke 4 nomor demo. AI copywriter
                  berjalan per segmen.
                </p>
              </div>
              <button
                onClick={() => !demoLoading && setDemoOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl"
              >
                ×
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 mb-4">
              <p className="text-[11px] font-bold uppercase text-slate-400 mb-3">
                Target Demo (4 Segmen K-Means)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {demoTargets.map((t) => {
                  const Icon = iconMap[t.segmentId] || Users;
                  return (
                    <div
                      key={t.segmentId}
                      className="flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-100"
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[t.segmentId] || "bg-slate-100 text-slate-600"}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#1C1D36] truncate">
                          {t.segmentLabel}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500">
                          {t.phoneMasked}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400">
                  CTA / Link
                </label>
                <input
                  value={demoCta}
                  onChange={(e) => setDemoCta(e.target.value)}
                  disabled={demoLoading}
                  className="w-full mt-1 p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400">
                  Promo Details (opsional)
                </label>
                <input
                  value={demoPromo}
                  onChange={(e) => setDemoPromo(e.target.value)}
                  disabled={demoLoading}
                  className="w-full mt-1 p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-amber-400"
                  placeholder="Misal: Diskon 20% untuk pembelian berikutnya"
                />
              </div>
            </div>

            <button
              onClick={handleDemoBlast}
              disabled={demoLoading}
              className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.01] transition shadow-lg disabled:opacity-50 mb-4"
            >
              {demoLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Generating &
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" /> Generate AI + Blast ke 4 Nomor
                </>
              )}
            </button>

            {demoResults && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm font-bold">
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">
                    ✓ {demoResults.totalSent} sent
                  </span>
                  {demoResults.totalFailed > 0 && (
                    <span className="px-3 py-1 rounded-full bg-red-100 text-red-600">
                      ✗ {demoResults.totalFailed} failed
                    </span>
                  )}
                  {demoResults.dryRun && (
                    <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700">
                      DRY-RUN
                    </span>
                  )}
                </div>
                {demoResults.results.map((r) => (
                  <div
                    key={r.segmentId}
                    className={`rounded-2xl p-4 border ${r.ok ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-[#1C1D36]">
                        {r.segmentLabel} → {r.phone}
                      </p>
                      <span className="text-[10px] font-bold uppercase text-slate-500">
                        {r.copySource || "error"}
                        {r.copyModel ? ` · ${r.copyModel}` : ""}
                      </span>
                    </div>
                    {r.ok ? (
                      <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                        {r.message}
                      </p>
                    ) : (
                      <p className="text-xs text-red-600 font-semibold">
                        {r.error}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

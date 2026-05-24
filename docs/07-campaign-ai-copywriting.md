# 07 — Campaign dan AI Copywriting

## Tujuan

AI copywriter membantu membuat pesan campaign yang relevan berdasarkan segment, goal, promo, CTA, dan insight pelanggan.

## Input Copywriting

Input umum:

- `segmentId`
- `segmentLabel`
- `goal`
- `campaignBrief`
- `ctaLink`
- `promoDetails`
- data segment: jumlah customer, churn risk, CLTV, recency, top products jika tersedia.

## Output Copywriting

Untuk MVP, output utama adalah pesan WhatsApp. Rencana multi-channel dapat mencakup:

```json
{
  "whatsapp": {
    "message": "...",
    "cta_button": "..."
  },
  "instagram": {
    "caption": "...",
    "suggested_visual": "..."
  },
  "email": {
    "subject": "...",
    "body_html": "..."
  },
  "discount_recommendation": {
    "percentage": 15,
    "justification": "...",
    "estimated_roi": "..."
  }
}
```

## Flow Generate Copy

```text
Frontend calls generate preview or generate campaign copy
  ↓
Backend copywriterService builds prompt
  ↓
Gemini API called if GEMINI_API_KEY exists
  ↓
Parse response
  ↓
If failed: fallback template
  ↓
Return text + metadata source/model/cached
```

## Segment Strategy

| Segment | Goal Umum | Tone/Pesan |
| --- | --- | --- |
| High Value | Loyalty maintenance, VIP reward. | Eksklusif, apresiatif, premium. |
| At Risk | Win-back. | Personal, urgency ringan, promo relevan. |
| Hibernating | Reaktivasi. | Friendly, low-friction, tawaran ringan. |
| New/Occasional | Second purchase/onboarding. | Edukatif, welcoming, CTA jelas. |

## Template Token

Pesan dapat memakai token:

- `{name}`
- `{last_purchase_days}`
- `{cta_link}`

Token diganti saat personalisasi sebelum pengiriman.

## Guardrail Prompt

- Maksimal panjang pesan WhatsApp disarankan < 500 karakter untuk readability.
- Jangan menjanjikan diskon yang tidak ada.
- Hindari klaim berlebihan atau manipulatif.
- Gunakan bahasa Indonesia natural untuk UMKM.
- CTA harus jelas.
- Output JSON harus bisa diparse jika memakai format structured.
- Selalu ada fallback jika Gemini gagal.

## Campaign Orchestration Future

Rencana ideal:

```text
Customer segments
  ↓
AI Campaign Generator
  ↓
Campaign Orchestrator
  ├─ WhatsApp batch queue
  ├─ Instagram copy-to-clipboard/API
  └─ Email SMTP/provider
  ↓
Monitoring + feedback loop
```

Untuk Instagram, rekomendasi MVP adalah copy-to-clipboard agar tidak bergantung pada Meta Business verification. Auto-posting dapat ditambahkan kemudian melalui Instagram Graph API.

## Approval dan Human-in-the-loop

Campaign tidak boleh langsung blast setelah AI generate. Urutan aman:

1. Generate copy.
2. Preview di UI.
3. User edit jika perlu.
4. User approve.
5. Sistem generate jobs.
6. User trigger send.

## Metrics Campaign

Metric minimal:

- total recipients,
- sent,
- failed,
- delivered/read jika gateway menyediakan,
- replies,
- conversion/purchase after campaign untuk future feedback.

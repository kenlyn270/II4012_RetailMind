# 02 — Frontend

## Lokasi Kode

- `frontend/src/App.jsx` — root UI, auth dummy, navigasi view.
- `frontend/src/api.js` — API client ke backend Express.
- `frontend/src/components/` — komponen dashboard dan campaign.

## Struktur View

### Landing/Auth

`App.jsx` menampilkan landing page jika user belum login. Login/register saat ini bersifat client-side dummy:

- state `isLoggedIn` disimpan di `localStorage` key `retailmind_logged_in`.
- tidak ada autentikasi server production.

### Dashboard Logged In

Setelah login, user masuk dashboard dengan dua view utama:

1. **Intelligence**
   - `SystemStatusPanel`
   - `DatasetUpload`
   - `StatsRow`
   - `ChurnChart`
   - `RFMMap`
   - `HighRiskTable`
   - `SegmentBreakdown`

2. **Blasting Message**
   - `WhatsAppCampaign`

## State Penting

| State | Fungsi |
| --- | --- |
| `isLoggedIn` | Menentukan landing/auth vs dashboard. |
| `currentView` | `intelligence` atau `blasting`. |
| `datasetProfile` | Hasil scoring dataset yang dikirim dari `DatasetUpload` ke chart/table. |
| `isModalOpen`, `activeTab` | Modal login/register dummy. |

## API Client

Semua request frontend diarahkan ke `API_BASE = "/api"` di `frontend/src/api.js`.

### Dataset/Inference

- `scoreDatasetDirect(file)` → `POST /api/datasets/score-direct`
- `getDatasetProfile(datasetId)` → `GET /api/datasets/:datasetId/profile`
- `getSystemStatus()` → `GET /api/system/status`

### Segment

- `getSegments()` → `GET /api/segments`
- `getSegmentPreview(segmentId, limit)` → `GET /api/segments/:segmentId/preview?limit=...`

### Campaign

- `getCampaigns()`
- `getCampaign(id)`
- `createCampaign(payload)`
- `updateCampaign(id, updates)`
- `approveCampaign(id)`
- `triggerCampaign(id)`
- `pauseCampaign(id)`
- `resumeCampaign(id)`
- `cancelCampaign(id)`
- `getCampaignJobs(id, options)`
- `generateCopywriting(campaignId, options)`
- `generateCopywritingPreview(payload)`
- `testSend(campaignId, phone, message)`

### Demo Blast

- `getDemoBlastTargets()` → daftar target demo masked.
- `runDemoBlast({ ctaLink, promoDetails, dryRun })` → kirim 1 pesan AI per segmen ke nomor demo.

## Alur Intelligence UI

```text
User login
  ↓
Buka tab Intelligence
  ↓
SystemStatusPanel cek status model/inference
  ↓
Upload dataset via DatasetUpload
  ↓
Frontend call scoreDatasetDirect(file)
  ↓
Backend/inference return profile + customers
  ↓
datasetProfile disimpan di App.jsx
  ↓
StatsRow/Chart/Table membaca datasetProfile
```

## Alur Blasting UI

```text
User buka tab Blasting Message
  ↓
Pilih segment/goal/brief atau demo blast
  ↓
Generate preview copywriting
  ↓
Create campaign
  ↓
Approve campaign untuk generate jobs
  ↓
Trigger campaign untuk dispatch
  ↓
Monitor status jobs dan webhook
```

## Catatan UX

- Dashboard menggunakan gaya visual warm/yellow dengan Tailwind utility class.
- Current implementation masih MVP/demo: auth belum production, dan demo blast dibatasi ke nomor representative.
- Untuk fitur production, perlu role-based auth, opt-in management, dan confirmation dialog sebelum broadcast.

## Validasi Frontend

```bash
npm install
npm run dev
npm run build
npm run lint
```

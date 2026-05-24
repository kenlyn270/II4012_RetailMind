# 🚀 RetailMind - Fonnte Webhook Setup dengan Ngrok

## Prasyarat

- **Node.js** v18+ terinstall
- **ngrok** terinstall dan sudah login (`ngrok config add-authtoken <TOKEN>`)
- Akun **Fonnte** aktif dengan device terhubung

---

## Arsitektur

```
[Fonnte Cloud] --POST/GET--> [ngrok tunnel] --> [localhost:3001] --> Express Server
```

### Webhook URLs yang didaftarkan di Fonnte:

| Setting | URL |
|---------|-----|
| Webhook | `https://<NGROK_URL>/webhook/fonnte` |
| Webhook Connect | `https://<NGROK_URL>/webhook/fonnte/connect` |
| Webhook Message Status | `https://<NGROK_URL>/webhook/fonnte/message-status` |

> `<NGROK_URL>` adalah URL gratis dari ngrok, contoh: `https://a1b2c3d4.ngrok-free.app`

---

## Cara Menjalankan

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Konfigurasi Environment

Pastikan file `backend/.env` sudah terisi:

```env
FONNTE_TOKEN=your_fonnte_token_here
FONNTE_SEND_URL=https://api.fonnte.com/send
FONNTE_COUNTRY_CODE=0

BROADCAST_ENABLED=true
BROADCAST_DAILY_LIMIT=20
BROADCAST_BATCH_SIZE=5
BROADCAST_MIN_DELAY_SEC=10
BROADCAST_MAX_DELAY_SEC=30
BROADCAST_FREQUENCY_CAP_DAYS=7

GEMINI_API_KEY=your_gemini_api_key_here
COPYWRITER_MODELS=gemini-2.0-flash-lite,gemini-2.0-flash,gemini-1.5-flash-8b,gemini-1.5-flash
COPYWRITER_TEMPERATURE=0.75
COPYWRITER_MAX_TOKENS=220
COPYWRITER_CACHE_TTL_MS=1800000

PORT=3001
```

### 3. Jalankan Server (Terminal 1)

```bash
cd server
npm run dev
```

Server akan berjalan di `http://localhost:3001`.

### 4. Jalankan Ngrok Tunnel (Terminal 2)

```bash
cd server
./start-ngrok.sh
```

Atau jalankan manual:

```bash
ngrok http 3001
```

Setelah ngrok berjalan, akan muncul output seperti:

```
Forwarding  https://a1b2c3d4.ngrok-free.app -> http://localhost:3001
```

**Copy URL tersebut** (contoh: `https://a1b2c3d4.ngrok-free.app`), ini yang akan digunakan di Fonnte.

### 5. Verifikasi Webhook Aktif

Buka browser atau gunakan `curl` untuk memastikan webhook bisa diakses:

```bash
# Ganti <NGROK_URL> dengan URL ngrok kamu
curl https://<NGROK_URL>/webhook/fonnte
curl https://<NGROK_URL>/webhook/fonnte/connect
curl https://<NGROK_URL>/webhook/fonnte/message-status
curl https://<NGROK_URL>/api/health
```

Semua endpoint harus mengembalikan response JSON `{ "status": "ok", ... }`.

### 6. Daftarkan URL di Dashboard Fonnte

1. Login ke [fonnte.com](https://fonnte.com)
2. Pilih device yang aktif
3. Masuk ke menu **Settings** atau **Webhook**
4. Isi field berikut (ganti `<NGROK_URL>` dengan URL ngrok kamu):

   - **Webhook**: `https://<NGROK_URL>/webhook/fonnte`
   - **Webhook Connect**: `https://<NGROK_URL>/webhook/fonnte/connect`
   - **Webhook Message Status**: `https://<NGROK_URL>/webhook/fonnte/message-status`

5. Klik **Save**

---

## ⚠️ Catatan Penting (Ngrok Free Tier)

- **URL berubah setiap restart**: Setiap kali ngrok dimatikan dan dinyalakan ulang, URL akan berubah. Kamu harus update URL di dashboard Fonnte setiap kali restart.
- **Solusi**: Gunakan ngrok static domain (gratis 1 domain per akun):
  ```bash
  ngrok http --domain=your-name.ngrok-free.app 3001
  ```
  Untuk mendapatkan static domain gratis, buka [dashboard.ngrok.com/domains](https://dashboard.ngrok.com/domains) dan claim domain.

---

## Penjelasan Endpoint

### `POST /webhook/fonnte` — Webhook (Pesan Masuk)

Menerima pesan masuk dari pelanggan. Jika pesan mengandung keyword opt-out (`stop`, `berhenti`, `unsubscribe`, `jangan kirim`), sistem akan:
- Menambahkan nomor ke blacklist
- Menonaktifkan opt-in WhatsApp pada kontak
- Membatalkan job broadcast yang pending

### `POST /webhook/fonnte/connect` — Webhook Connect

Menerima notifikasi status koneksi device (connected/disconnected).

### `POST /webhook/fonnte/message-status` — Webhook Message Status

Menerima update status pengiriman pesan:
- `sent` → pesan terkirim
- `delivered` → pesan diterima
- `read` → pesan dibaca
- `failed` → pengiriman gagal

---

## Troubleshooting

### Ngrok error "ERR_NGROK_108"

Kamu belum login ngrok. Jalankan:
```bash
ngrok config add-authtoken <TOKEN_DARI_DASHBOARD_NGROK>
```

### Webhook tidak menerima data

1. Pastikan server berjalan (`npm run dev`)
2. Pastikan ngrok tunnel aktif
3. Cek log di terminal server untuk melihat request masuk
4. Pastikan URL di Fonnte sudah benar (tanpa trailing slash)
5. Buka ngrok web inspector di `http://localhost:4040` untuk melihat request yang masuk

### Error "Missing message id" atau "Missing sender"

Ini normal jika Fonnte mengirim payload yang tidak lengkap. Sistem akan mengembalikan error 400 dan mengabaikan request tersebut.

---

## Quick Start (TL;DR)

```bash
# Terminal 1 - Server
cd server && npm install && npm run dev

# Terminal 2 - Ngrok
cd server && ./start-ngrok.sh

# Setelah ngrok jalan, copy URL-nya dan daftarkan di Fonnte:
#   Webhook:        https://<NGROK_URL>/webhook/fonnte
#   Connect:        https://<NGROK_URL>/webhook/fonnte/connect
#   Message Status: https://<NGROK_URL>/webhook/fonnte/message-status
```

Selesai! Webhook siap menerima callback dari Fonnte. 🎉

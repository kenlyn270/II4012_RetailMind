# Docker Quick Start

Stack Docker menjalankan:

- Frontend Vite: http://localhost:5173
- Backend Express: http://localhost:3001
- Inference FastAPI: http://localhost:8001
- PostgreSQL: localhost:5432
- Ngrok webhook tunnel (profile opsional): http://localhost:4040

## 1. Siapkan environment

Root compose memakai `backend/.env` untuk backend dan ngrok. Pastikan file tersebut ada:

```bash
cp backend/.env.example backend/.env
```

Isi minimal:

```env
FONNTE_TOKEN=...
GEMINI_API_KEY=...
NGROK_AUTHTOKEN=...
BROADCAST_ENABLED=true
```

Catatan: saat dijalankan di Docker, compose akan override koneksi internal ini secara otomatis:

- `DATABASE_URL=postgres://retailmind:retailmind@postgres:5432/retailmind`
- `INFERENCE_URL=http://inference:8000`

Jadi nilai localhost di `backend/.env` tetap aman untuk development non-Docker.

## 2. Jalankan semua service utama

```bash
docker compose -f docker-compose.dev.yml up --build
```

Cek status:

```bash
docker compose -f docker-compose.dev.yml ps
```

## 3. Jalankan dengan webhook/ngrok

```bash
docker compose -f docker-compose.dev.yml --profile webhook up --build
```

Buka inspection UI:

```text
http://localhost:4040
```

Gunakan public URL ngrok untuk endpoint Fonnte, contoh:

```text
https://xxxx.ngrok-free.app/webhook/fonnte
https://xxxx.ngrok-free.app/webhook/fonnte/connect
https://xxxx.ngrok-free.app/webhook/fonnte/message-status
```

## 4. Seed database demo (opsional)

Saat container backend sudah running:

```bash
docker compose -f docker-compose.dev.yml exec backend npm run seed
```

## 5. Stop dan reset data

Stop tanpa hapus data:

```bash
docker compose -f docker-compose.dev.yml down
```

Reset PostgreSQL volume:

```bash
docker compose -f docker-compose.dev.yml down -v
```

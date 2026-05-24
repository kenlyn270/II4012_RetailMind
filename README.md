# RetailMind

RetailMind adalah platform customer intelligence dan campaign distribution untuk retail/UMKM.

Dokumentasi utama sudah dikonsolidasikan di folder [`docs/`](./docs/).

Mulai dari:

1. [`docs/README.md`](./docs/README.md)
2. [`docs/01-overview.md`](./docs/01-overview.md)
3. [`docs/02-frontend.md`](./docs/02-frontend.md)
4. [`docs/03-backend.md`](./docs/03-backend.md)
5. [`docs/04-inference-process.md`](./docs/04-inference-process.md)

## Quick Start

Aplikasi terdiri dari beberapa service:

- Frontend Vite: http://localhost:5173
- Backend Express: http://localhost:3001
- Inference FastAPI: http://localhost:8001
- PostgreSQL: localhost:5432
- Ngrok webhook tunnel opsional: http://localhost:4040

## Menjalankan via Docker

Prasyarat:

- Docker dan Docker Compose sudah terpasang.
- File environment backend sudah dibuat.

### 1. Siapkan environment

Dari root directory project:

```bash
cp backend/.env.example backend/.env
```

Isi minimal variabel berikut di `backend/.env` sesuai kebutuhan:

```env
FONNTE_TOKEN=...
GEMINI_API_KEY=...
NGROK_AUTHTOKEN=...
BROADCAST_ENABLED=true
```

Saat dijalankan via Docker, `docker-compose.dev.yml` akan otomatis override koneksi internal berikut:

```env
DATABASE_URL=postgres://retailmind:retailmind@postgres:5432/retailmind
INFERENCE_URL=http://inference:8000
```

Jadi nilai `localhost` di `backend/.env` tetap aman untuk mode non-Docker.

### 2. Jalankan semua service utama

```bash
docker compose -f docker-compose.dev.yml up --build
```

Service yang berjalan:

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Inference API: http://localhost:8001
- PostgreSQL: localhost:5432

Cek status container:

```bash
docker compose -f docker-compose.dev.yml ps
```

### 3. Seed database demo (opsional)

Jalankan setelah container backend sudah running:

```bash
docker compose -f docker-compose.dev.yml exec backend npm run seed
```

### 4. Jalankan dengan webhook/ngrok (opsional)

```bash
docker compose -f docker-compose.dev.yml --profile webhook up --build
```

Buka inspection UI ngrok:

```text
http://localhost:4040
```

Gunakan public URL ngrok untuk endpoint Fonnte, contoh:

```text
https://xxxx.ngrok-free.app/webhook/fonnte
https://xxxx.ngrok-free.app/webhook/fonnte/connect
https://xxxx.ngrok-free.app/webhook/fonnte/message-status
```

### 5. Stop service Docker

Stop tanpa menghapus data PostgreSQL:

```bash
docker compose -f docker-compose.dev.yml down
```

Stop sekaligus reset data PostgreSQL volume:

```bash
docker compose -f docker-compose.dev.yml down -v
```

> Detail tambahan tersedia di [`docs/docker.md`](./docs/docker.md).

## Menjalankan tanpa Docker

Prasyarat:

- Node.js dan npm sudah terpasang.
- Python sudah terpasang.
- PostgreSQL sudah berjalan secara lokal.
- Database lokal tersedia sesuai `DATABASE_URL`, default: `postgres://retailmind:retailmind@localhost:5432/retailmind`.

### 1. Siapkan environment backend

Dari root directory project:

```bash
cp backend/.env.example backend/.env
```

Pastikan `backend/.env` berisi konfigurasi lokal, terutama:

```env
DATABASE_URL=postgres://retailmind:retailmind@localhost:5432/retailmind
INFERENCE_URL=http://localhost:8001
PORT=3001
```

Isi juga `FONNTE_TOKEN`, `GEMINI_API_KEY`, dan `NGROK_AUTHTOKEN` jika fitur terkait digunakan.

### 2. Install dependency Python

Dari root directory project:

```bash
pip install -r requirements.txt
```

### 3. Install dependency frontend

```bash
cd frontend
npm install
```

### 4. Install dependency backend

Buka terminal baru atau kembali ke root directory, lalu:

```bash
cd backend
npm install
```

### 5. Jalankan Inference API

Dari root directory project:

```bash
uvicorn model.inference.app:app --host 0.0.0.0 --port 8001 --reload
```

Pastikan port `8001` sesuai dengan `INFERENCE_URL` di `backend/.env`.

### 6. Jalankan Backend

Dari folder `backend`:

```bash
npm run dev
```

Backend akan berjalan di:

```text
http://localhost:3001
```

### 7. Seed database demo (opsional)

Dari folder `backend`:

```bash
npm run seed
```

### 8. Jalankan Frontend

Dari folder `frontend`:

```bash
npm run dev
```

Frontend akan berjalan di:

```text
http://localhost:5173
```

Dokumen lama yang sebelumnya tersebar sudah dipindahkan ke [`docs/archive/`](./docs/archive/) sebagai referensi historis.

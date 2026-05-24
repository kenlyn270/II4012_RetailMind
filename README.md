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

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd server
npm install
npm run dev
```

Inference:

```bash
uvicorn backend.inference.app:app --host 0.0.0.0 --port 8000 --reload
```

Dokumen lama yang sebelumnya tersebar sudah dipindahkan ke [`docs/archive/`](./docs/archive/) sebagai referensi historis.

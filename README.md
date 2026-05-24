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

Install Requirement PIP: (dari root directory)
```bash
pip install -r requirements.txt
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
npm run dev
```

Inference: (dari root directory)

```bash
uvicorn model.inference.app:app --host 0.0.0.0 --port 8000 --reload
```
!Pastikan port sesuai dengan yang digunakan pada file .env di folder /backend!

Dokumen lama yang sebelumnya tersebar sudah dipindahkan ke [`docs/archive/`](./docs/archive/) sebagai referensi historis.

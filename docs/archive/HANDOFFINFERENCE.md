# RetailMind Inference Handoff State

<state_snapshot>
    <overall_goal>
        Membangun RetailMind, platform analitik retail cerdas yang mengubah data transaksi menjadi insight berbasis AI dan kampanye pemasaran otomatis.
    </overall_goal>

    <active_constraints>
        - **Frozen Model Policy:** Model ML (Isolation Forest, KMeans, BG-NBD) bersifat statis; tidak ada retraining pada jalur upload transaksi untuk menjaga latensi rendah (target p95 < 1 detik untuk < 5rb pelanggan) dan stabilitas label.
        - **Calibration via Profiling:** Interpretasi spesifik dataset (tier CLTV, level churn) ditangani oleh "Dataset Profile" (~1KB JSON) yang dihitung per upload.
        - **Python for ML:** Semua inferensi ML berada di microservice Python FastAPI agar dapat menggunakan library native (lifetimes, sklearn).
        - **Content Hash Idempotency:** Dataset yang diunggah diidentifikasi via hash SHA256 di Node.js untuk menghindari komputasi berulang.
    </active_constraints>

    <key_knowledge>
        - **Model v2.0.0 Scaler Stats:** Raw scaler menggunakan Mean `[201.33, 6.29, 3018.62]` dan Scale `[209.32, 13.01, 14736.48]`.
        - **Lifetimes Compatibility:** `BetaGeoFitter` memerlukan alias manual `.predict` ke `.conditional_expected_number_of_purchases_up_to_time` agar kompatibel dengan metode `customer_lifetime_value` pada `GammaGammaFitter`.
        - **Pydantic Alias Handling:** Penggunaan `populate_by_name = True` dan `by_alias=True` pada Pydantic v2 krusial untuk memetakan "Customer ID" (CSV/JSON) ke `customer_id` (Internal/DB).
        - **Node-Python Bridge:** Komunikasi dilakukan via `inferenceService.js` menggunakan fetch API ke `INFERENCE_URL` (default: localhost:8000).
    </key_knowledge>

    <artifact_trail>
        - `model/model/retail_ai_model_assets.joblib`: Diperbarui ke v2.0.0; menyertakan `raw_scaler` dan `log_scaler` terpisah.
        - `model/inference/app.py`: Aplikasi FastAPI dengan endpoint inferensi dan manajemen lifespan model.
        - `backend/frontend/src/db/migrations/0002_inference.sql`: Skema untuk tabel `datasets` dan `dataset_profiles`.
        - `backend/frontend/src/services/inferenceService.js`: Client Node.js untuk service Python.
        - `backend/frontend/src/routes/datasets.js`: Endpoint API untuk upload dan scoring dataset.
    </artifact_trail>

    <file_system_state>
        - CWD: `/home/ikhbar/Documents/GitHub/II4012_RetailMind`
        - Aset ML: `model/model/retail_ai_model_assets.joblib`, `MODEL_CARD.md`
        - Source Inferensi: `model/inference/` (FastAPI)
        - Backend Node: `backend/frontend/src/` (Routes: datasets.js, Services: inferenceService.js, validator.js)
    </file_system_state>

    <recent_actions>
        - Sprint 3 SELESAI: Integrasi Node.js dengan Python Inference Service.
        - Implementasi database schema untuk tracking dataset dan calibration profile.
        - Pembuatan endpoint `POST /api/datasets/score-direct` yang mengotomatisasi alur: Upload -> Validation -> ML Scoring -> DB Persistence.
        - Registrasi router dataset ke main express app.
    </recent_actions>

    <task_state>
        1. [DONE] Sprint 1: Foundation (Perbaikan bug, export model v2, skrip train).
        2. [DONE] Sprint 2: Inference Service Core (FastAPI service, predictor, kalibrasi).
        3. [DONE] Sprint 3: Integrasi Node.js (Migration, Service Bridge, Upload API).
        4. [IN PROGRESS] Sprint 4: Dashboard & Hardening (UI, Docker, Observability).
           - [ ] Implementasi UI Upload di Frontend.
           - [ ] Visualisasi Churn & CLTV Profiling di Dashboard.
           - [ ] Docker Compose untuk orchestrating semua service.
    </task_state>
</state_snapshot>

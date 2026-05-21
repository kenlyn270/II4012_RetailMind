# GEMINI.md - RetailMind Project Context

## Project Overview
**RetailMind** is an intelligent customer analytics and campaign distribution platform designed for retail businesses (UMKM/SMEs). It transforms raw transaction data into actionable insights and automated marketing actions.

The system combines machine learning models for deep customer understanding with Generative AI (Gemini) for creating personalized marketing content across multiple channels.

### Core Architecture
1.  **Data & ML Pipeline (Backend):**
    *   **Data Source:** UCI Online Retail II dataset.
    *   **Feature Engineering:** RFM (Recency, Frequency, Monetary) analysis.
    *   **Models:**
        *   **Churn Risk Scoring:** Isolation Forest (unsupervised anomaly detection).
        *   **Customer Segmentation:** K-Means Clustering on RFM features.
        *   **CLTV Prediction:** BG-NBD and Gamma-Gamma probabilistic models.
    *   **Artifacts:** Models are serialized using `joblib` for inference.

2.  **Campaign Engine (Planned/Conceptual):**
    *   **Content Generation:** Uses Gemini API to generate personalized messages for WhatsApp, Instagram, and Email based on customer segments and CLTV.
    *   **Orchestration:** BullMQ + Redis for batch distribution and rate limiting.
    *   **Distribution Channels:** WhatsApp (Fonnte/Official API), Instagram, and Email.

3.  **Frontend (Dashboard):**
    *   A React-based dashboard for visualizing customer segments, churn risks, and managing AI-powered campaigns.

## Technology Stack
*   **Frontend:** React 19, Vite, Tailwind CSS, Lucide React (icons), Recharts (data visualization).
*   **Data Science/ML (Python):** Pandas, Scikit-learn, Lifetimes (CLTV), Joblib.
*   **AI:** Google Gemini API (Flash 2.0).
*   **Backend (Planned):** Node.js, BullMQ, Redis, SQLite/PostgreSQL.

## Key Files & Directories
*   `src/`: React frontend source code.
    *   `src/components/`: UI components for analytics and campaign management (e.g., `WhatsAppCampaign.jsx`, `ChurnChart.jsx`).
*   `backend/`: ML pipeline and data assets.
    *   `backend/data/`: Raw and processed datasets (`enriched_customer_analytics.csv`).
    *   `backend/model/`: Serialized ML model assets (`retail_ai_model_assets.joblib`).
    *   `backend/modelling/`: Jupyter notebooks for model training and experimentation.
*   `docs/` & `backend/docs/`: Comprehensive documentation on the pipeline, planning, and integration.

## Building and Running

### Frontend
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Lint the code
npm run lint
```

### ML Pipeline (Python)
The pipeline is currently managed via Jupyter notebooks in `backend/modelling/`. To run them, you need a Python environment with:
```bash
pip install pandas numpy scikit-learn lifetimes joblib matplotlib seaborn
```

## Development Conventions
*   **Component-Based UI:** Keep components modular and reusable in `src/components/`.
*   **Styling:** Use Tailwind CSS for rapid and consistent UI development.
*   **Data Visualization:** Use Recharts for charts and graphs to maintain a clean aesthetic.
*   **AI Integration:** Marketing copy generation should leverage the Gemini 2.0 Flash model for cost-effectiveness and speed.
*   **Documentation:** Maintain `PLAN.md` and `pipeline_documentation.md` for architectural changes.

## Future Roadmap
*   Transition from manual ML pipeline to automated inference service.
*   Implement the full Campaign Orchestrator with BullMQ and Redis.
*   Integrate official WhatsApp Cloud API for production-ready messaging.
*   Add a feedback loop to refine churn models based on campaign outcomes.

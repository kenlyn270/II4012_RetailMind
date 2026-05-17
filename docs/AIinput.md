Skema yang Anda usulkan sangat feasible (layak) untuk sistem AI Bisnis, namun ada beberapa catatan krusial mengenai strategi Pseudo-labelling pada model unsupervised agar tidak terjebak dalam "bias model".

Berikut adalah analisis dan saran untuk arsitektur sistem Anda:

1. Analisis Feasibility
Pipeline Data (Template Matching): Ini sangat standar. Anda hanya perlu memastikan pipeline preprocessing (scaling & log transformation) yang Anda lakukan di notebook tersimpan dalam objek (misal: pickle atau joblib untuk StandardScaler) agar data baru diproses dengan standar yang sama.
Pseudo-labelling & Retrain:
Risiko: Jika Anda menggunakan hasil prediksi baseline sebagai label absolut untuk melatih model baru (supervised), model tersebut hanya akan menduplikasi kelemahan baseline Anda (efek gema/echo chamber).
Saran: Gunakan Actual Feedback Loop. Alih-alih hanya pseudo-label, sistem sebaiknya menunggu (misal 30 hari). Jika pelanggan yang diprediksi "Risk" benar-benar tidak belanja, barulah data itu menjadi label "Churn" asli. Ini akan mengubah model Anda dari Unsupervised menjadi Supervised seiring berjalannya waktu.
2. Cara Menentukan "Model Terbaik" dalam Kasus Ini
Karena tidak ada label "benar/salah" di awal, Anda bisa menentukan model terbaik menggunakan Comparative Unsupervised Metrics:

A. Stabilitas Skor (Stability)
Model yang baik adalah model yang stabil. Jika Anda memasukkan data yang mirip, skornya tidak boleh melompat drastis.

Cara: Lakukan Bootstrap testing. Ambil 80% data secara acak beberapa kali, latih model, dan cek apakah peringkat pelanggan (Ranking) berubah drastis. Model terbaik adalah yang peringkat pelanggannya paling konsisten.
B. Sebaran Risiko (Score Distribution)
Model terbaik bukan yang memberikan nilai tengah (50), tapi yang mampu memisahkan ekstrim.

Cara: Cek histogram churn_risk_score. Pilih model yang kurvanya menunjukkan pemisahan jelas antara kelompok risiko rendah (menumpuk di kiri) dan risiko tinggi (menumpuk di kanan).
C. Business Proxy Metric (Backtesting)
Jika Anda punya data historis yang lebih panjang:

Ambil data transaksi bulan Januari - Juni.
Gunakan model untuk memprediksi risiko di akhir Juni.
Cek kenyataannya di bulan Juli. Apakah pelanggan dengan skor risiko tinggi (>80) benar-benar tidak belanja di bulan Juli?
Model dengan Precision at K (misal: dari 100 orang risiko tertinggi, berapa banyak yang benar-benar tidak kembali) adalah model terbaik.
Strategi Deployment yang Disarankan:
Jika Anda ingin tetap menggunakan skema retrain, gunakan pendekatan Champion-Challenger:

Champion: Baseline model Anda saat ini (Isolation Forest).
Challenger: Model baru (misal: One-Class SVM atau Cluster-based Local Outlier Factor).
Deploy kedua-duanya secara paralel (Shadow Mode).
Setelah 1 bulan, bandingkan model mana yang prediksi risikonya paling sesuai dengan kenyataan di lapangan (feedback loop). Pemenangnya akan menjadi Champion berikutnya.
Kesimpulan: Skema Anda bagus sebagai titik awal. Namun, kunci dari sistem yang production-ready bukan sekadar retrain, melainkan kemampuan sistem untuk belajar dari feedback (mengubah data tak berlabel menjadi berlabel secara otomatis setelah periode waktu tertentu).
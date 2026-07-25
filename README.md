# AU Learning — Panduan Penggunaan Platform
**Alternative Universe Learning oleh Ariel Usman**

Selamat datang di **AU Learning**! Platform ini adalah sistem **AI-Driven Micro-LMS Generator** yang dirancang khusus untuk mempermudah dosen/dosen tamu dalam membuat situs mikro pembelajaran secara instan hanya dengan mengunggah dokumen silabus (RPS - Rencana Pembelajaran Semester).

Platform ini mengintegrasikan kecerdasan buatan (**Google Gemini API**), data video (**YouTube API**), komunikasi waktu nyata (**Jitsi WebRTC**), visualisasi pencapaian (**Chart.js**), dan pengelolaan data (**Firebase**).

---

## 🚀 Cara Menjalankan Aplikasi Secara Lokal

Karena komputer lokal Anda saat ini berjalan tanpa Node.js/NPM, aplikasi ini telah dirancang khusus dengan **Sandbox Mode** (menggunakan database simulasi berbasis `localStorage` di browser) sehingga dapat dijalankan langsung menggunakan Python:

1. Buka terminal Anda pada folder project `/home/ariel/Dokumen/systemlmsau/`.
2. Jalankan server lokal Python:
   ```bash
   python3 -m http.server 8000 -d public
   ```
3. Buka browser Anda dan akses alamat:
   👉 **`http://localhost:8000/index.html`**

---

## 🧑‍🏫 Panduan Penggunaan untuk DOSEN (Lecturer)

### 1. Membuat Kelas Baru (Syllabus Generator)
* Buka halaman utama `http://localhost:8000/index.html`.
* Login sebagai **Lecturer** (Gunakan email default: `lecturer@au.edu` untuk uji coba cepat).
* Isi form pembuatan kelas:
  * **Course Name**: Masukkan nama mata kuliah (contoh: *Kecerdasan Buatan Terapan*).
  * **Course ID**: Kode unik kelas untuk mahasiswa Anda (contoh: `AU-AI-802`).
  * **Syllabus File**: Seret (drag & drop) atau pilih file silabus RPS Anda (Contoh file uji coba siap pakai: `scratch/sample-rps.txt`).
  * **Additional Directives** (Opsional): Instruksi tambahan untuk AI (contoh: *"Fokuskan tugas esai pada studi kasus etika AI"*).
* Klik tombol **Generate 16-Week Curriculum**. Anda akan dialihkan ke halaman kelas mahasiswa secara otomatis setelah AI selesai menyusun materi.

### 2. Mengelola Kelas Melalui Dashboard Dosen
Buka halaman dashboard dosen di **`http://localhost:8000/dashboard.html`**:
* **Menu Analytics**: 
  * Menampilkan grafik radar pencapaian **CPMK (Capaian Pembelajaran Mata Kuliah)** mahasiswa menggunakan Chart.js.
  * Menampilkan grafik batang persebaran nilai ujian mahasiswa.
  * Tombol **Export Excel / PDF**: Mengunduh rekap nilai dan absensi secara instan.
* **Menu No-Code Editor**:
  * Anda dapat mengubah deskripsi CPMK, memodifikasi kriteria penilaian/bobot rubrik esai, dan mengubah topik atau subtopik mingguan secara visual tanpa menyentuh kode. Klik **Commit Course Updates** untuk menyimpan ke database.
* **Menu Micro-Polling (Absensi Live)**:
  * Saat kelas WebRTC berlangsung, masukkan pertanyaan kehadiran dan durasi hitung mundur (15-60 detik), lalu klik **Trigger Micro-Poll**. Semua mahasiswa yang aktif di kelas akan melihat popup absensi secara real-time.
* **Integrasi LENTERA (LMS Kampus)**:
  * Klik tombol **Copy LENTERA Embed** di kanan atas untuk menyalin kode `<iframe>` agar kelas mikro ini dapat ditempelkan langsung ke LMS kampus Anda.

---

## 🧑‍🎓 Panduan Penggunaan untuk MAHASISWA (Student)

### 1. Mendaftar & Masuk Kelas
* Login sebagai **Student** di halaman utama (Gunakan email default: `student@au.edu`).
* Masukkan **Course Code ID** kelas yang diberikan oleh dosen Anda (contoh: `AU-AI-802`).
* Klik **Join Course**. Kelas tersebut akan terdaftar dalam riwayat kelas Anda. Klik **Open LMS** untuk masuk.

### 2. Mengikuti Kelas Mikro (`lms.html`)
* **Tab Curriculum (Materi & Tugas)**:
  * Buka accordion mingguan (Minggu 1-16) untuk melihat topik, rangkuman, dan rekomendasi video edukasi YouTube.
  * Kerjakan tugas mingguan (**Quiz** berupa pilihan ganda, atau **Essay** berupa uraian tertulis). Masukkan jawaban Anda lalu klik **Submit Answers** untuk mendapatkan penilaian otomatis dan feedback detail dari AI Auto-Grader secara instan.
* **Tab WebRTC Class (Kuliah Live)**:
  * Mahasiswa dapat bergabung ke tatap muka video langsung menggunakan frame Jitsi Meet yang terintegrasi.
  * **Verifikasi Kehadiran**: Jika dosen memicu polling absensi saat kuliah, popup melayang akan muncul di pojok kanan bawah. Mahasiswa harus mengklik tombol **Verify Presence** sebelum waktu hitung mundur habis agar tercatat hadir di database.
* **Tab Grades & Reports**:
  * Mahasiswa dapat melihat daftar tugas yang sudah dikerjakan lengkap dengan rincian nilai per kriteria rubrik dan saran perbaikan dari AI.

---

## ⚙️ Halaman Konfigurasi Kunci (Settings)

Jika Anda ingin mengaktifkan AI asli (Google Gemini) secara lokal tanpa server backend:
1. Masuk ke menu **Configuration** di sidebar.
2. Tempelkan (paste) API Key Anda pada kolom **Custom Gemini API Key**.
   *(Anda bisa mendapatkan kunci gratis di [Google AI Studio](https://aistudio.google.com/))*.
3. Klik **Save Configurations**. 
4. Sekarang, proses parsing silabus dan auto-grading esai akan dilakukan langsung secara pintar melalui koneksi browser Anda ke Google Gemini API!
5. Untuk mereset ulang seluruh data demonstrasi lokal (menghapus kelas simulasi), klik tombol **Reset Local Data**.

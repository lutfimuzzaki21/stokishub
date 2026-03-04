# StokisHub

Platform manajemen distribusi produk berbasis peran (role-based) yang menghubungkan **Stokis**, **Sub Stokis**, **Sales**, **Driver**, dan **Konsumen/Member** dalam satu ekosistem terintegrasi.

---

## 📦 Struktur Proyek

```
StokisHub/
├── backend/      → REST API (Node.js + Express + Prisma + MySQL)
├── frontend/     → Dashboard Web (React + Vite)
└── mobile/       → Aplikasi Mobile (React Native + Expo)
```

---

## 🚀 Fitur Utama

### 🏪 Stokis & Sub Stokis (Web Dashboard)
- Dashboard ringkasan stok, penjualan, dan pendapatan
- Manajemen produk dengan multi-tier harga (Harga Umum, Harga Member, dsb.)
- Manajemen pengguna bawahan (Sub Stokis, Sales, Driver, Konsumen)
- Laporan komisi sales secara real-time
- Pemantauan lokasi driver pengiriman via peta (Leaflet)
- Live update status pesanan via Socket.IO

### 📱 Sales (Mobile App)
- Registrasi konsumen / member baru ke Stokis atau Sub Stokis terdekat
- Pemilihan parent (Stokis/Sub Stokis) saat registrasi konsumen
- Pencatatan kunjungan konsumen (visit log)
- Laporan komisi bulanan dengan grafik pertumbuhan
- Dashboard ringkasan aktivitas harian

### 🚗 Driver (Mobile App)
- Daftar pesanan yang perlu diantar
- Pembaruan status pengiriman (PROCESSING → SHIPPED → DELIVERED)
- Navigasi peta ke titik lokasi konsumen
- Riwayat pengiriman selesai

### 🛒 Konsumen / Member (Mobile App)
- Toko produk dengan tampilan grid 2 kolom
- Detail produk dengan tabel tier harga
- Keranjang belanja (add, update qty, hapus item)
- Checkout & riwayat pesanan dengan status real-time
- Profil akun dengan edit data lengkap (nama, email, WhatsApp, alamat, koordinat GPS/peta)

---

## 🛠 Tech Stack

| Layer | Teknologi |
|---|---|
| Backend | Node.js, Express 5, Prisma 5, MySQL, JWT, bcrypt, Socket.IO |
| Frontend Web | React 19, Vite, React-Leaflet, Lucide-React, Axios, SweetAlert2 |
| Mobile | React Native 0.81, Expo 54, React Navigation, Expo Location, React Native Maps |

---

## ⚙️ Setup & Instalasi

### Prasyarat
- Node.js >= 18
- MySQL server aktif
- Expo CLI (`npm install -g expo-cli`)

---

### 1. Backend

```bash
cd backend
npm install
```

Buat file `.env`:
```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/stokishub"
JWT_SECRET="your_jwt_secret_key"
PORT=5000
```

Jalankan migrasi & seed database:
```bash
npx prisma migrate dev --name init
npx prisma db seed
```

Jalankan server:
```bash
npm run dev
```

Server berjalan di `http://localhost:5000`

---

### 2. Frontend Web

```bash
cd frontend
npm install
npm run dev
```

Dashboard berjalan di `http://localhost:5173`

---

### 3. Mobile (React Native + Expo)

```bash
cd mobile
npm install
```

Sesuaikan IP server di `src/context/AuthContext.js`:
```js
export const BASE_URL = 'http://YOUR_LOCAL_IP:5000';
```

Jalankan Expo:
```bash
npx expo start
```

Scan QR code menggunakan **Expo Go** di Android/iOS.

---

## 👥 Peran Pengguna (Roles)

| Role | Akses |
|---|---|
| `SUPERADMIN` | Akses penuh seluruh sistem |
| `STOKIS` | Dashboard stokis, manajemen produk & pengguna bawahan |
| `SUBSTOKIS` | Dashboard sub stokis, manajemen konsumen di bawahnya |
| `SALES` | Registrasi konsumen, kunjungan, laporan komisi (Mobile) |
| `DRIVER` | Pengelolaan pengiriman & pembaruan status (Mobile) |
| `KONSUMEN` | Belanja produk, cart, pesanan (Mobile) |
| `MEMBER` | Sama dengan Konsumen + harga khusus sesuai tier |

---

## 🗄 Model Database Utama

- **User** — semua pengguna dengan hierarki via `parent_id`
- **Product** — produk milik Stokis dengan stok & kode
- **PriceTier** — multi-tier harga per produk (umum, member, dst.)
- **UserPriceTier** — harga khusus per konsumen
- **Order / OrderItem** — transaksi pembelian konsumen
- **Purchase** — pembelian stok oleh Stokis
- **Visit** — log kunjungan Sales ke konsumen
- **CommissionConfig / CommissionCampaign** — konfigurasi & kampanye komisi Sales

---

## 📡 API Endpoints Utama

| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/auth/login` | Login semua role |
| GET | `/api/user/:id` | Detail profil user |
| PUT | `/api/user/:id` | Update profil user |
| GET | `/api/products` | Daftar produk (filter by stokis/buyer) |
| GET | `/api/orders` | Daftar pesanan |
| POST | `/api/orders` | Buat pesanan baru |
| PATCH | `/api/orders/:id/status` | Update status pesanan |
| GET | `/api/consumers` | Daftar konsumen di bawah parent |
| POST | `/api/consumers` | Registrasi konsumen baru |
| GET | `/api/parent-options` | Pilihan Stokis/SubStokis untuk Sales |
| GET | `/api/sales/commission` | Laporan komisi Sales |
| GET | `/api/visits` | Log kunjungan Sales |
| POST | `/api/visits` | Tambah catatan kunjungan |

---

## 📂 Struktur Folder Mobile

```
mobile/src/
├── context/
│   ├── AuthContext.js     → State autentikasi global
│   ├── CartContext.js     → State keranjang belanja
│   └── DriverContext.js   → State driver
├── navigation/
│   ├── ConsumerNavigator.js
│   ├── DriverNavigator.js
│   └── SalesNavigator.js
└── screens/
    ├── LoginScreen.js
    ├── ConsumerShopScreen.js
    ├── ConsumerCartScreen.js
    ├── ConsumerOrdersScreen.js
    ├── ConsumerProfileScreen.js
    ├── SalesHomeScreen.js
    ├── SalesRegisterConsumerScreen.js
    ├── SalesVisitScreen.js
    ├── SalesCommissionScreen.js
    ├── DriverHomeScreen.js
    └── DriverDeliveryScreen.js
```

---

## 🔐 Default Password Konsumen Baru

Saat Sales mendaftarkan konsumen baru, password default otomatis adalah:
```
pass1234
```
Konsumen dapat mengubah password setelah login pertama melalui fitur edit profil.

---

## 📝 Lisensi

MIT License — bebas digunakan dan dikembangkan.

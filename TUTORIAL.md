# Fokuz — Edit in VS Code & Publish Tutorial (v2: dashboards)

## 1. Open and edit in VS Code
1. Unzip `fokuz-html.zip` to a folder.
2. VS Code → **File → Open Folder** → pick the `fokuz-html` folder.
3. Install the extension **Live Server** (by Ritwick Dey). Right-click `index.html` → **Open with Live Server**. The site opens and refreshes every time you save.

What each file does:
| File | Edit it to change |
|---|---|
| `app.js` (top) | Services, categories, prices, packages (`SERVICES` list) |
| `style.css` (line 1) | Colors (`--mint`, `--navy`…), fonts, spacing |
| `index.html` | Homepage text and sections |
| `detail.html` | Checkout form (fields, payment methods) |
| `sukses.html` | "Pesanan Selesai & Lunas" page |
| `assets/hero.jpg` | Main photo — replace with your own (same name) |

## 2. How ordering works right now
Service → **Pesan Sekarang** → fill the checkout form → **Bayar Sekarang** → the order is marked **Selesai & Lunas** and appears in **Pesanan Saya**.
Note: this is a **simulation**. No real money moves, and orders are only saved in the visitor's own browser (localStorage).

## 3. Publish it free (5 minutes)
**Option A — Netlify Drop (easiest)**
1. Go to https://app.netlify.com/drop
2. Drag the whole `fokuz-html` folder onto the page.
3. You get a live link (e.g. `fokuz-123.netlify.app`). Sign up free to keep it and rename it.

**Option B — GitHub Pages**
1. Create a free account at github.com → **New repository** (public) → upload all files.
2. Repository **Settings → Pages** → Source: `main` branch, `/root` → Save.
3. Your site appears at `https://yourname.github.io/repo-name`.

**Custom domain** (e.g. `fokuz.id`): buy it at Niagahoster/Domainesia/Cloudflare, then add it in Netlify → Domain settings (or GitHub Pages → Custom domain) and follow the DNS steps shown.

## 4. Turning it into a fully working business app
A plain HTML site cannot safely store orders, logins, or take real payments. You need:

1. **Real payments (Indonesia):** sign up at **Midtrans** (midtrans.com) or **Xendit** (xendit.co). Both support QRIS, bank transfer, GoPay, OVO, and need your KTP/business documents for verification. Replace the `SIMULASI PEMBAYARAN` block in `app.js` with their checkout (Midtrans "Snap" is the simplest: one script tag + `snap.pay(token)`). The token must be created on a server using your secret key — never put the secret key in `app.js`.
2. **Database + login:** a backend such as **Supabase** (free tier) to store customers, orders, files, and revisions, with email login.
3. **Small server:** e.g. Netlify Functions or Vercel Functions to create payment tokens and receive Midtrans/Xendit "payment success" notifications (webhooks) that mark orders as paid.
4. **Admin page:** to see orders, upload finished files, and handle revisions.
5. **Legal pages:** Terms & Conditions and Privacy Policy (required by payment providers).

Simpler path: keep building in Lovable — it can add login, database, file uploads, and real payments for you, then publish with one click.


## 4. NEW in v2 — Customer & Admin dashboards
| File | What it is |
|---|---|
| `masuk.html` | Customer sign-in / sign-up. `masuk.html?admin=1` = **Login Admin** (also linked in the footer) |
| `akun.html` | Customer dashboard: overview, orders (search + filter), order detail & timeline, brief uploads, downloads, revisions, notifications, profile, help |
| `admin.html` | Admin dashboard: overview, orders, worker assignment, status changes + audit trail, deliveries, revisions, catalog & prices, payments & refunds, customers, support, sales report, team |
| `db.js` | All data rules: accounts, roles, order statuses, allowed status changes, files, payments |
| `dash.js` | Everything drawn on both dashboards |
| `syarat.html`, `privasi.html` | Terms & Privacy (example text — replace with your own) |

**Demo accounts** (change them in `db.js` before going live):
- Admin (full access): `admin@fokuz.id` / `admin123`
- Staff (orders, files, revisions, support only): `staf@fokuz.id` / `staf123`
- Customers create their own account on `masuk.html`. Signing up always makes a customer — nobody can make themselves admin.

**Order lifecycle:** Menunggu Pembayaran → Pembayaran Dikonfirmasi → Menunggu Review Admin → Sedang Dikerjakan → Menunggu Review Pelanggan → (Revisi Diminta → Revisi Dikerjakan → back to review) → Selesai. Cancel/refund where allowed. Only valid steps are possible (rules in `FLOW` inside `db.js`), and only the payment system can mark an order as paid.

**Try it:** sign up as a customer → order a service → log out → Login Admin → open the order → "Menunggu Review Admin" → "Sedang Dikerjakan" → upload the result → log back in as the customer → accept or request a revision.

## 5. IMPORTANT — what is still a demo
Everything is saved in **the visitor's own browser** (localStorage). That means:
- Admin and customer only see the same orders if they use **the same browser on the same device**.
- Someone technical can edit their own browser data, so the security rules here are for **testing the workflow only**.
- Files are limited to 2 MB, payment is simulated.

To go live for real you need a server + database (accounts, orders, private file storage with expiring links) and a payment gateway (Midtrans/Xendit) that confirms payments by itself. Every function in `db.js` (`Auth`, `Orders`, `Files`, `Pay`, `Tickets`) is the exact place to swap in those server calls. I can also build this version for real inside your Lovable project with Lovable Cloud.


## 6. Baru di v3 — gambar QRIS pada transaksi
- Pilih **QRIS**: gambar muncul di bawah metode pembayaran. Metode lain menyembunyikannya.
- Gambar bawaan hanya tempat gambar, **bukan QRIS asli dan tidak bisa menerima pembayaran**.
- Ganti `assets/qris.png` dengan gambar QRIS resmi dari bank/penyedia pembayaran dalam format PNG. Ekspor/konversikan ke PNG, jangan hanya mengganti ekstensi.
- Gambar ditampilkan tanpa memotong kode. Pastikan nama merchant benar dan uji pemindaian menggunakan aplikasi bank/e-wallet.
- QRIS statis tidak memverifikasi pembayaran. **Bayar Sekarang** tetap simulasi; jangan gunakan status lunas demo sebagai bukti uang diterima. Pembayaran nyata harus dikonfirmasi oleh penyedia pembayaran.


## 7. Baru di v4 — slider portofolio otomatis (halaman Review)
- Kartu di "Showcase karya" bergerak sendiri dari kanan ke kiri tanpa henti (satu putaran ±38 detik).
- Slider berhenti saat kursor di atasnya, saat difokus dengan keyboard, dan saat digeser di HP. Tombol ❚❚ / ▶ menjeda atau memutarnya lagi.
- Tombol ← → tetap menggeser satu kartu. Di keyboard, fokus ke slider lalu tekan panah kiri/kanan.
- Pengguna yang menyalakan "kurangi animasi" di perangkatnya tidak akan melihat gerakan otomatis.
- Kecepatan diatur di `review-slider.js` (`CYCLE_SECONDS`). Untuk menambah karya, tambahkan `<article class="portfolio-card">` baru di `review.html`; duplikat untuk loop dibuat otomatis.

// =====================================================================
// FOKUZ — DATA LAYER (db.js)
// Semua data (akun, pesanan, file, pembayaran, notifikasi) disimpan di
// localStorage browser. Ini cocok untuk DEMO & PENGEMBANGAN.
// Untuk versi online sungguhan, ganti fungsi-fungsi di file ini dengan
// panggilan ke server/database (lihat TUTORIAL.md bagian 5).
// =====================================================================

const DB = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem("fokuz_" + k)); return v ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem("fokuz_" + k, JSON.stringify(v)); },
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = (p) => p + "-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
const fmtD = (t) => (t ? new Date(t).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—");

async function hash(s) {
  const txt = "fokuz:" + s;
  if (window.crypto && crypto.subtle) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  let h = 0; for (const c of txt) h = (h * 31 + c.charCodeAt(0)) | 0; return "w" + h;
}

// ===== STATUS PESANAN & TRANSISI YANG DIIZINKAN =====
const STATUS = {
  awaiting_payment: "Menunggu Pembayaran",
  paid: "Pembayaran Dikonfirmasi",
  review: "Menunggu Review Admin",
  in_progress: "Sedang Dikerjakan",
  customer_review: "Menunggu Review Pelanggan",
  revision_requested: "Revisi Diminta",
  revision_in_progress: "Revisi Dikerjakan",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  refunded: "Dikembalikan (Refund)",
};
// siapa yang boleh: "system" = hanya sistem pembayaran, "admin" = admin/staf,
// "customer" = pemilik pesanan, "any" = pemilik atau admin
const FLOW = {
  awaiting_payment: { paid: "system", cancelled: "any" },
  paid: { review: "admin", refunded: "admin" },
  review: { in_progress: "admin", cancelled: "admin", refunded: "admin" },
  in_progress: { customer_review: "admin" },
  customer_review: { revision_requested: "customer", completed: "any" },
  revision_requested: { revision_in_progress: "admin" },
  revision_in_progress: { customer_review: "admin" },
  completed: {}, cancelled: {}, refunded: {},
};
const ACTIVE = ["paid", "review", "in_progress", "customer_review", "revision_requested", "revision_in_progress"];

// ===== AKUN DEMO (ganti kata sandi sebelum dipakai sungguhan) =====
const ready = (async () => {
  if (!DB.get("users", null)) {
    DB.set("users", [
      { id: "U-ADMIN", name: "Admin Fokuz", email: "admin@fokuz.id", phone: "", role: "admin", passHash: await hash("admin123"), createdAt: Date.now() },
      { id: "U-STAFF", name: "Staf Fokuz", email: "staf@fokuz.id", phone: "", role: "staff", passHash: await hash("staf123"), createdAt: Date.now() },
    ]);
    DB.set("workers", ["Rina (Desain)", "Bima (Akademik)", "Sari (Karier)"]);
  }
})();

// ===== HAK AKSES =====
const PERMS = {
  admin: ["orders", "files", "revisions", "support", "catalog", "payments", "customers", "reports", "team"],
  staff: ["orders", "files", "revisions", "support"],
  customer: [],
};
const Auth = {
  user() { const s = DB.get("session", null); return (s && DB.get("users", []).find((u) => u.id === s.id && !u.disabled)) || null; },
  isStaff(u) { return !!u && (u.role === "admin" || u.role === "staff"); },
  can(u, p) { return !!u && (PERMS[u.role] || []).includes(p); },
  async login(email, pw) {
    await ready;
    const u = DB.get("users", []).find((x) => x.email === email.trim().toLowerCase());
    if (!u || u.passHash !== (await hash(pw))) throw new Error("Email atau kata sandi salah.");
    if (u.disabled) throw new Error("Akun ini dinonaktifkan. Hubungi admin.");
    DB.set("session", { id: u.id }); return u;
  },
  async register(name, email, pw) {
    await ready;
    email = email.trim().toLowerCase();
    const users = DB.get("users", []);
    if (users.some((u) => u.email === email)) throw new Error("Email sudah terdaftar.");
    if (pw.length < 6) throw new Error("Kata sandi minimal 6 karakter.");
    // Pendaftaran publik SELALU menjadi pelanggan — tidak bisa memilih jadi admin.
    const u = { id: uid("U"), name: name.trim().slice(0, 100), email, phone: "", role: "customer", passHash: await hash(pw), createdAt: Date.now() };
    users.push(u); DB.set("users", users); DB.set("session", { id: u.id }); return u;
  },
  async changePassword(u, oldPw, newPw) {
    const users = DB.get("users", []), me = users.find((x) => x.id === u.id);
    if (me.passHash !== (await hash(oldPw))) throw new Error("Kata sandi lama salah.");
    if (newPw.length < 6) throw new Error("Kata sandi baru minimal 6 karakter.");
    me.passHash = await hash(newPw); DB.set("users", users);
  },
  updateProfile(u, name, phone) {
    const users = DB.get("users", []), me = users.find((x) => x.id === u.id);
    me.name = name.trim().slice(0, 100) || me.name; me.phone = phone.trim().slice(0, 20); DB.set("users", users);
  },
  logout() { localStorage.removeItem("fokuz_session"); },
};

// ===== NOTIFIKASI =====
const Notifs = {
  add(userId, text, orderId) { const a = DB.get("notifs", []); a.unshift({ id: uid("N"), userId, text, orderId, at: Date.now(), read: false }); DB.set("notifs", a); },
  mine(u) { return DB.get("notifs", []).filter((n) => n.userId === u.id); },
  unread(u) { return u ? this.mine(u).filter((n) => !n.read).length : 0; },
  readAll(u) { const a = DB.get("notifs", []); a.forEach((n) => { if (n.userId === u.id) n.read = true; }); DB.set("notifs", a); },
};

// ===== PESANAN =====
const Orders = {
  all() { return DB.get("orders", []); },
  visible(u) { const a = this.all(); return Auth.isStaff(u) ? a : a.filter((o) => o.userId === u.id); },
  get(id, u) { return this.visible(u).find((o) => o.id === id) || null; },
  create(u, s, p, brief) {
    if (Auth.isStaff(u)) throw new Error("Akun admin tidak bisa memesan.");
    const o = { id: "FKZ-" + Date.now().toString().slice(-7), userId: u.id, customer: u.name, slug: s.slug, service: s.title, pkg: p.name,
      price: p.price, days: p.days, revLimit: p.rev, revUsed: 0, brief: String(brief || "").slice(0, 1000), status: "awaiting_payment",
      createdAt: Date.now(), deadline: null, worker: "", revisions: [],
      audit: [{ at: Date.now(), from: null, to: "awaiting_payment", by: u.name, note: "Pesanan dibuat" }] };
    const a = this.all(); a.unshift(o); DB.set("orders", a); return o;
  },
  // Satu-satunya cara mengubah status — semua aturan dicek di sini.
  transition(id, to, actor, note = "") {
    const a = this.all(), o = a.find((x) => x.id === id);
    if (!o) throw new Error("Pesanan tidak ditemukan.");
    const rule = FLOW[o.status]?.[to];
    if (!rule) throw new Error(`Tidak bisa mengubah dari "${STATUS[o.status]}" ke "${STATUS[to]}".`);
    const sys = actor === "system", staff = !sys && Auth.can(actor, "orders"), owner = !sys && actor.id === o.userId;
    const ok = rule === "system" ? sys : rule === "admin" ? staff : rule === "customer" ? owner : staff || owner;
    if (!ok) throw new Error("Kamu tidak punya izin untuk perubahan status ini.");
    o.audit.push({ at: Date.now(), from: o.status, to, by: sys ? "Sistem Pembayaran" : actor.name + (staff ? " (admin)" : ""), note: String(note).slice(0, 300) });
    o.status = to;
    if (to === "paid") o.deadline = Date.now() + o.days * 864e5;
    DB.set("orders", a);
    Notifs.add(o.userId, `Pesanan ${o.id}: status kini "${STATUS[to]}".${note ? " Catatan: " + note : ""}`, o.id);
    return o;
  },
  staffUpdate(id, actor, patch) {
    if (!Auth.can(actor, "orders")) throw new Error("Tidak punya izin.");
    const a = this.all(), o = a.find((x) => x.id === id);
    if (patch.worker !== undefined && patch.worker !== o.worker) {
      o.audit.push({ at: Date.now(), from: o.status, to: o.status, by: actor.name + " (admin)", note: "Ditugaskan ke: " + (patch.worker || "—") });
      o.worker = patch.worker;
    }
    DB.set("orders", a);
  },
  requestRevision(id, actor, text) {
    const o = this.get(id, actor);
    if (!o || o.userId !== actor.id) throw new Error("Tidak punya izin.");
    if (o.revUsed >= o.revLimit) throw new Error("Jatah revisi sudah habis.");
    if (!text.trim()) throw new Error("Tuliskan apa yang perlu direvisi.");
    const a = this.all(), x = a.find((y) => y.id === id);
    x.revisions.push({ id: uid("R"), text: text.slice(0, 1000), at: Date.now(), response: "", respondedAt: null });
    x.revUsed++; DB.set("orders", a);
    this.transition(id, "revision_requested", actor, "Permintaan revisi #" + x.revUsed);
  },
  respondRevision(id, revId, actor, text) {
    if (!Auth.can(actor, "revisions")) throw new Error("Tidak punya izin.");
    const a = this.all(), o = a.find((y) => y.id === id), r = o.revisions.find((y) => y.id === revId);
    r.response = text.slice(0, 1000); r.respondedAt = Date.now(); DB.set("orders", a);
    if (o.status === "revision_requested") this.transition(id, "revision_in_progress", actor, "Tanggapan: " + text.slice(0, 120));
    else Notifs.add(o.userId, `Pesanan ${o.id}: admin menanggapi revisimu.`, o.id);
  },
  overdue(o) { return o.deadline && Date.now() > o.deadline && ACTIVE.includes(o.status); },
};

// ===== PEMBAYARAN (SIMULASI) =====
// Ganti Pay.charge dengan payment gateway asli (Midtrans/Xendit). Di versi asli,
// status "paid" HANYA boleh diset oleh server setelah menerima webhook dari gateway.
const Pay = {
  all() { return DB.get("payments", []); },
  forOrder(id) { return this.all().find((p) => p.orderId === id) || null; },
  async charge(orderId, method) {
    await new Promise((r) => setTimeout(r, 1000));
    const o = Orders.all().find((x) => x.id === orderId);
    const a = this.all(); a.unshift({ id: uid("PAY"), orderId, amount: o.price, method, at: Date.now(), status: "Berhasil", refund: "—" }); DB.set("payments", a);
    Orders.transition(orderId, "paid", "system", "Pembayaran " + method + " diterima");
  },
  refund(orderId, actor, note) {
    if (!Auth.can(actor, "payments")) throw new Error("Hanya admin keuangan yang bisa refund.");
    Orders.transition(orderId, "refunded", actor, note || "Dana dikembalikan");
    const a = this.all(), p = a.find((x) => x.orderId === orderId); if (p) { p.refund = "Dikembalikan " + fmtD(Date.now()); DB.set("payments", a); }
  },
};

// ===== FILE PRIVAT =====
// File disimpan terpisah & hanya bisa diunduh oleh pemilik pesanan atau admin.
// Tautan unduhan dibuat sementara dan otomatis kedaluwarsa setelah 60 detik.
const MAX_FILE = 2 * 1024 * 1024;
const Files = {
  forOrder(orderId, u) { if (!Orders.get(orderId, u)) return []; return DB.get("files", []).filter((f) => f.orderId === orderId).map(({ data, ...meta }) => meta); },
  add(orderId, kind, file, u) {
    return new Promise((res, rej) => {
      const o = Orders.get(orderId, u);
      if (!o) return rej(new Error("Tidak punya akses ke pesanan ini."));
      if (kind === "delivery" && !Auth.can(u, "files")) return rej(new Error("Hanya admin yang bisa mengirim hasil."));
      if (file.size > MAX_FILE) return rej(new Error("Ukuran file maksimal 2 MB pada versi demo."));
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const a = DB.get("files", []);
          a.push({ id: uid("F"), orderId, kind, name: file.name.slice(0, 120), type: file.type, size: file.size, data: rd.result, by: u.name, at: Date.now() });
          DB.set("files", a); res();
        } catch { rej(new Error("Penyimpanan browser penuh. Hapus beberapa file/pesanan lama.")); }
      };
      rd.onerror = () => rej(new Error("Gagal membaca file.")); rd.readAsDataURL(file);
    });
  },
  async download(fileId, u) {
    const f = DB.get("files", []).find((x) => x.id === fileId);
    if (!f || !Orders.get(f.orderId, u)) throw new Error("Tidak punya akses ke file ini.");
    const blob = await (await fetch(f.data)).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000); // tautan kedaluwarsa
  },
};

// ===== TIKET BANTUAN =====
const Tickets = {
  all() { return DB.get("tickets", []); },
  create(u, subject, msg) {
    if (!subject.trim() || !msg.trim()) throw new Error("Isi subjek dan pesan.");
    const a = this.all(); a.unshift({ id: uid("T"), userId: u.id, name: u.name, email: u.email, subject: subject.slice(0, 120), msg: msg.slice(0, 1000), reply: "", status: "Terbuka", at: Date.now() }); DB.set("tickets", a);
  },
  reply(id, actor, text) {
    if (!Auth.can(actor, "support")) throw new Error("Tidak punya izin.");
    const a = this.all(), t = a.find((x) => x.id === id); t.reply = text.slice(0, 1000); t.status = "Dijawab"; DB.set("tickets", a);
    Notifs.add(t.userId, `Tiket bantuan "${t.subject}" sudah dijawab.`);
  },
};

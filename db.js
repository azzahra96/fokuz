// =====================================================================
// FOKUZ — DATA LAYER (db.js)
// Semua data (akun, pesanan, file, pembayaran, notifikasi) disimpan di
// Lovable Cloud. Setiap perubahan status dijalankan oleh fungsi di database
// yang mengecek identitas & peran pengguna — browser tidak bisa melewatinya.
// Butuh: vendor/supabase.js, config.js, pay-rules.js (dimuat sebelum file ini).
// =====================================================================

const CFG = window.FOKUZ_CONFIG;
// Kunci publik baru bukan JWT: jangan kirim sebagai "Bearer" saat belum login.
const sbFetch = (input, init = {}) => {
  const h = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  if (h.get("Authorization") === "Bearer " + CFG.key) h.delete("Authorization");
  h.set("apikey", CFG.key);
  return fetch(input, { ...init, headers: h });
};
const sb = window.supabase.createClient(CFG.url, CFG.key, {
  global: { fetch: sbFetch },
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "fokuz-auth" },
});

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtD = (t) => (t ? new Date(t).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—");
const rid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

// Ubah pesan error teknis menjadi pesan yang mudah dipahami.
function cleanErr(error) {
  const m = (error && error.message) || String(error || "Terjadi kesalahan.");
  if (/Invalid login credentials/i.test(m)) return new Error("Email atau kata sandi salah.");
  if (/Email not confirmed/i.test(m)) return new Error("Email belum dikonfirmasi. Buka tautan konfirmasi di email kamu dulu.");
  if (/User already registered/i.test(m)) return new Error("Email sudah terdaftar. Silakan masuk.");
  if (/Password should be at least/i.test(m)) return new Error("Kata sandi minimal 6 karakter.");
  if (/row-level security|permission denied|Unauthorized/i.test(m)) return new Error("Kamu tidak punya izin untuk tindakan ini.");
  if (/exceeded the maximum allowed size|Payload too large/i.test(m)) return new Error("Ukuran file terlalu besar.");
  if (/Failed to fetch|NetworkError/i.test(m)) return new Error("Koneksi bermasalah. Coba lagi.");
  return new Error(m);
}
async function q(promise) { const { data, error } = await promise; if (error) throw cleanErr(error); return data; }
const rpc = (fn, args) => q(sb.rpc(fn, args));

// ===== STATUS =====
// Status pengerjaan pesanan
const STATUS = {
  awaiting_payment: "Menunggu Pembayaran",
  queued: "Antrean Pengerjaan",
  processing: "Sedang Dikerjakan",
  customer_review: "Menunggu Review Pelanggan",
  revision_requested: "Revisi Diminta",
  revision_in_progress: "Revisi Dikerjakan",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  refunded: "Dikembalikan (Refund)",
};
// Status pembayaran (terpisah dari status pengerjaan)
const PAY_STATUS = {
  pending_payment: "Menunggu Pembayaran",
  awaiting_verification: "Menunggu Verifikasi",
  payment_rejected: "Bukti Ditolak",
  paid: "Lunas (Disetujui Admin)",
  refunded: "Dikembalikan",
};
const ACTIVE = ["queued", "processing", "customer_review", "revision_requested", "revision_in_progress"];
const CLOSED = ["completed", "cancelled", "refunded"];

// ===== HAK AKSES (tampilan saja — server selalu mengecek ulang) =====
const PERMS = {
  admin: ["orders", "files", "revisions", "support", "catalog", "payments", "customers", "reports", "team"],
  staff: ["orders", "files", "revisions", "support"],
  customer: [],
};

let ME = null; // { id, name, email, phone, disabled, role }
async function loadMe() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { ME = null; return null; }
  const uid = session.user.id;
  const [prof, roles] = await Promise.all([
    sb.from("profiles").select("*").eq("id", uid).maybeSingle(),
    sb.from("user_roles").select("role").eq("user_id", uid),
  ]);
  const p = prof.data || { id: uid, name: session.user.user_metadata?.name || "", email: session.user.email || "", phone: "", disabled: false };
  const rs = (roles.data || []).map((r) => r.role);
  ME = { ...p, role: rs.includes("admin") ? "admin" : rs.includes("staff") ? "staff" : "customer" };
  if (ME.disabled) { await sb.auth.signOut(); ME = null; }
  return ME;
}

const Auth = {
  user() { return ME; },
  isStaff(u) { return !!u && (u.role === "admin" || u.role === "staff"); },
  isAdmin(u) { return !!u && u.role === "admin"; },
  can(u, p) { return !!u && (PERMS[u.role] || []).includes(p); },
  async login(email, pw) {
    const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pw });
    if (error) throw cleanErr(error);
    const u = await loadMe();
    if (!u) throw new Error("Akun ini dinonaktifkan. Hubungi admin.");
    return u;
  },
  async register(name, email, pw) {
    if (pw.length < 6) throw new Error("Kata sandi minimal 6 karakter.");
    const redirect = location.href.split("?")[0].replace(/[^/]*$/, "masuk.html");
    const { data, error } = await sb.auth.signUp({
      email: email.trim().toLowerCase(), password: pw,
      options: { data: { name: name.trim().slice(0, 100) }, emailRedirectTo: redirect },
    });
    if (error) throw cleanErr(error);
    if (!data.session) return { needsConfirm: true };
    return await loadMe();
  },
  async changePassword(oldPw, newPw) {
    if (newPw.length < 6) throw new Error("Kata sandi baru minimal 6 karakter.");
    const check = await sb.auth.signInWithPassword({ email: ME.email, password: oldPw });
    if (check.error) throw new Error("Kata sandi lama salah.");
    const { error } = await sb.auth.updateUser({ password: newPw });
    if (error) throw cleanErr(error);
  },
  updateProfile(name, phone) { return rpc("update_profile", { p_name: name, p_phone: phone }); },
  async logout() { await sb.auth.signOut(); ME = null; },
};

// ===== KATALOG =====
const Catalog = {
  async list() { return q(sb.from("services").select("*").order("sort").order("created_at")); },
  save(s) { return q(sb.from("services").update({ packages: s.packages }).eq("slug", s.slug)); },
  add(s) { return q(sb.from("services").insert(s)); },
  remove(slug) { return q(sb.from("services").delete().eq("slug", slug)); },
};

// ===== NOTIFIKASI =====
const Notifs = {
  mine() { return q(sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(100)); },
  async unread() {
    if (!ME) return 0;
    const { count } = await sb.from("notifications").select("id", { count: "exact", head: true }).eq("read", false);
    return count || 0;
  },
  readAll() { return rpc("mark_notifications_read"); },
};

// ===== PESANAN =====
const Orders = {
  list() { return q(sb.from("orders").select("*").order("created_at", { ascending: false })); },
  get(id) { return q(sb.from("orders").select("*").eq("id", id).maybeSingle()); },
  create(slug, pkgIndex, brief) { return rpc("create_order", { p_slug: slug, p_package: pkgIndex, p_brief: brief || "" }); },
  transition(id, to, note) { return rpc("transition_order", { p_order: id, p_to: to, p_note: note || "" }); },
  assign(id, worker) { return rpc("assign_worker", { p_order: id, p_worker: worker }); },
  events(id) { return q(sb.from("order_events").select("*").eq("order_id", id).order("created_at")); },
  recentEvents(limit = 8) { return q(sb.from("order_events").select("*, orders(service_title)").order("created_at", { ascending: false }).limit(limit)); },
  revisions(id) { return q(sb.from("revisions").select("*").eq("order_id", id).order("created_at")); },
  requestRevision(id, text) { return rpc("request_revision", { p_order: id, p_text: text }); },
  respondRevision(revId, text) { return rpc("respond_revision", { p_revision: revId, p_text: text }); },
  overdue(o) { return !!o.deadline && Date.now() > new Date(o.deadline).getTime() && ACTIVE.includes(o.order_status); },
};

// ===== FILE PESANAN (brief & hasil) — bucket privat, tautan unduh kedaluwarsa =====
const MAX_FILE = 10 * 1024 * 1024;
const Files = {
  forOrder(id) { return q(sb.from("order_files").select("*").eq("order_id", id).order("created_at")); },
  async add(orderId, kind, file) {
    if (!file || !file.size) throw new Error("Pilih file terlebih dahulu.");
    if (file.size > MAX_FILE) throw new Error("Ukuran file maksimal 10 MB.");
    const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
    const path = `${orderId}/${kind}/${rid()}-${safe}`;
    await q(sb.storage.from("order-files").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false }));
    await rpc("register_order_file", { p_order: orderId, p_kind: kind, p_path: path, p_name: file.name });
  },
  async download(f) {
    const d = await q(sb.storage.from("order-files").createSignedUrl(f.storage_path, 60, { download: f.name }));
    location.href = d.signedUrl;
  },
};

// ===== PEMBAYARAN (verifikasi manual oleh admin) =====
const Pay = {
  methods() { return q(sb.from("payment_methods").select("*").order("sort").order("name")); },
  ready: (m) => PayRules.methodReady(m),
  choose(orderId, methodId) { return rpc("choose_payment_method", { p_order: orderId, p_method: methodId }); },
  async qrisUrl(m) {
    if (!m || !m.qris_path) return null;
    const d = await q(sb.storage.from("payment-assets").createSignedUrl(m.qris_path, 600));
    return d.signedUrl;
  },
  async submitProof(order, file) {
    const err = PayRules.validateProof(file); if (err) throw new Error(err);
    const ext = file.name.split(".").pop().toLowerCase();
    const path = `${ME.id}/${order.id}/${rid()}.${ext}`;
    await q(sb.storage.from("payment-proofs").upload(path, file, { contentType: file.type, upsert: false }));
    await rpc("submit_payment_proof", { p_order: order.id, p_path: path });
  },
  proofs(orderId) {
    let x = sb.from("payment_proofs").select("*").order("uploaded_at", { ascending: false });
    if (orderId) x = x.eq("order_id", orderId);
    return q(x);
  },
  async proofUrl(path) { return (await q(sb.storage.from("payment-proofs").createSignedUrl(path, 120))).signedUrl; },
  approve(id) { return rpc("approve_payment", { p_order: id }); },
  reject(id, reason) { return rpc("reject_payment", { p_order: id, p_reason: reason }); },
  refund(id, note) { return rpc("refund_order", { p_order: id, p_note: note || "" }); },
  // Admin: konfigurasi metode
  saveMethod(id, patch) { return q(sb.from("payment_methods").update(patch).eq("id", id)); },
  addMethod(m) { return q(sb.from("payment_methods").insert(m)); },
  removeMethod(id) { return q(sb.from("payment_methods").delete().eq("id", id)); },
  async uploadQris(methodId, file) {
    const ext = String(file.name).split(".").pop().toLowerCase();
    if (!["png", "jpg", "jpeg", "webp"].includes(ext) || !/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error("Gambar QRIS harus PNG, JPG, atau WEBP.");
    if (file.size > 2 * 1024 * 1024) throw new Error("Gambar QRIS maksimal 2 MB.");
    const path = `qris/${rid()}.${ext}`;
    await q(sb.storage.from("payment-assets").upload(path, file, { contentType: file.type, upsert: false }));
    await this.saveMethod(methodId, { qris_path: path });
  },
};

// ===== TIKET BANTUAN =====
const Tickets = {
  list() { return q(sb.from("tickets").select("*").order("created_at", { ascending: false })); },
  create(subject, msg) { return rpc("create_ticket", { p_subject: subject, p_msg: msg }); },
  reply(id, text) { return rpc("reply_ticket", { p_ticket: id, p_text: text }); },
};

// ===== ADMIN: pelanggan, tim, pekerja =====
const Admin = {
  profiles() { return q(sb.from("profiles").select("*").order("created_at", { ascending: false })); },
  roles() { return q(sb.from("user_roles").select("*")); },
  setDisabled(userId, disabled) { return rpc("set_customer_disabled", { p_user: userId, p_disabled: disabled }); },
  setRole(email, role) { return rpc("set_user_role", { p_email: email, p_role: role }); },
  workers() { return q(sb.from("workers").select("*").order("created_at")); },
  addWorker(name) { return q(sb.from("workers").insert({ name: name.trim().slice(0, 60) })); },
  removeWorker(id) { return q(sb.from("workers").delete().eq("id", id)); },
};

// Siap dipakai setelah sesi login & profil dimuat.
const READY = loadMe().catch(() => { ME = null; });

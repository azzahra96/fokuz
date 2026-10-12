// ===== DATA LAYANAN (contoh — ganti dengan layanan & harga asli kamu) =====
const CATEGORIES = {
  akademik: { name: "Dukungan Akademik", desc: "Proofreading, format laporan, dan daftar pustaka.", icon: "🎓" },
  desain: { name: "Desain Grafis", desc: "Poster, logo, konten media sosial, dan promosi.", icon: "🎨" },
  karier: { name: "CV & Karier", desc: "Desain CV, portofolio, dan surat lamaran.", icon: "💼" },
  sekolah: { name: "Dukungan Sekolah", desc: "Slide presentasi, infografis, dan materi belajar.", icon: "📘" },
};

const DEFAULT_SERVICES = [
  { slug: "proofreading-dokumen-akademik", title: "Proofreading Dokumen Akademik", cat: "akademik", summary: "Koreksi tata bahasa, ejaan, dan kejelasan kalimat pada makalah atau laporanmu.", deliverables: ["Dokumen dengan track changes", "Catatan perbaikan"], formats: ["DOCX", "PDF"], exclusions: ["Tidak menulis ulang isi karya", "Tidak mengerjakan ujian atau tugas mandiri"],
    packages: [{ name: "Dasar", price: 15000, days: 2, rev: 1, features: ["Hingga 10 halaman", "Ejaan & tata bahasa"] }, { name: "Lengkap", price: 35000, days: 3, rev: 2, features: ["Hingga 25 halaman", "Kejelasan & alur kalimat"] }] },
  { slug: "format-laporan", title: "Format Laporan & Daftar Pustaka", cat: "akademik", summary: "Rapikan layout, heading, daftar isi, dan sitasi APA/MLA/IEEE.", deliverables: ["Dokumen terformat", "Daftar isi otomatis"], formats: ["DOCX"], exclusions: ["Tidak menambah konten ilmiah"],
    packages: [{ name: "Standar", price: 25000, days: 2, rev: 2, features: ["Hingga 30 halaman", "1 gaya sitasi"] }] },
  { slug: "desain-poster", title: "Desain Poster", cat: "desain", summary: "Poster acara, promosi, atau edukasi yang menarik perhatian.", deliverables: ["File PNG & PDF siap cetak"], formats: ["PNG", "PDF"], exclusions: ["Tidak termasuk biaya cetak"],
    packages: [{ name: "Dasar", price: 20000, days: 2, rev: 1, features: ["1 konsep", "Ukuran A4/A3"] }, { name: "Pro", price: 50000, days: 3, rev: 3, features: ["2 konsep", "File editable"] }] },
  { slug: "desain-logo", title: "Desain Logo", cat: "desain", summary: "Logo sederhana dan berkarakter untuk usaha atau organisasi.", deliverables: ["Logo PNG, SVG", "Panduan warna singkat"], formats: ["PNG", "SVG", "PDF"], exclusions: ["Tidak termasuk pendaftaran merek"],
    packages: [{ name: "Standar", price: 150000, days: 5, rev: 3, features: ["3 konsep awal", "File vektor"] }] },
  { slug: "desain-cv-ats", title: "Desain CV ATS-Friendly", cat: "karier", summary: "CV rapi, mudah dibaca rekruter, dan lolos sistem ATS.", deliverables: ["CV PDF & DOCX"], formats: ["PDF", "DOCX"], exclusions: ["Tidak mengikuti tes rekrutmen atas namamu"],
    packages: [{ name: "Dasar", price: 25000, days: 2, rev: 1, features: ["1 halaman", "Template ATS"] }, { name: "Plus", price: 60000, days: 3, rev: 2, features: ["CV + surat lamaran", "Review isi"] }] },
  { slug: "desain-portofolio", title: "Desain Portofolio", cat: "karier", summary: "Tampilkan karya terbaikmu dalam portofolio PDF profesional.", deliverables: ["Portofolio PDF"], formats: ["PDF"], exclusions: [],
    packages: [{ name: "Standar", price: 100000, days: 4, rev: 2, features: ["Hingga 12 halaman"] }] },
  { slug: "slide-presentasi", title: "Desain Slide Presentasi", cat: "sekolah", summary: "Ubah materimu jadi slide yang jelas dan enak dilihat.", deliverables: ["File PPTX & PDF"], formats: ["PPTX", "PDF"], exclusions: ["Tidak membuat isi materi ujian"],
    packages: [{ name: "Standar", price: 15000, days: 2, rev: 2, features: ["Hingga 10 slide"] }] },
  { slug: "infografis-edukasi", title: "Infografis Edukasi", cat: "sekolah", summary: "Ringkas materi pelajaran menjadi infografis visual.", deliverables: ["PNG resolusi tinggi"], formats: ["PNG", "PDF"], exclusions: [],
    packages: [{ name: "Standar", price: 20000, days: 2, rev: 1, features: ["1 halaman infografis"] }] },
];

// Admin bisa mengubah katalog dari dashboard; perubahan disimpan di browser.
const SERVICES = DB.get("services", null) || DEFAULT_SERVICES;

// ===== HELPERS =====
const rupiah = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const from = (s) => Math.min(...s.packages.map((p) => p.price));
const $ = (sel) => document.querySelector(sel);
const params = new URLSearchParams(location.search);

function card(s) {
  const c = CATEGORIES[s.cat];
  return `<a class="card" href="detail.html?slug=${s.slug}">
    <span class="tag ${s.cat}">${c.name}</span><h3>${s.title}</h3><p>${s.summary}</p>
    <span class="price">Mulai ${rupiah(from(s))} →</span></a>`;
}

// ===== HEADER & FOOTER (sama di semua halaman) =====
const page = document.body.dataset.page;
const ME = Auth.user();
const dashLink = ME ? (Auth.isStaff(ME) ? ["admin", "Dashboard Admin"] : ["akun", "Dashboard"]) : ["masuk", "Masuk"];
const unread = Notifs.unread(ME);
document.body.insertAdjacentHTML("afterbegin", `<header><div class="wrap">
  <a class="logo" href="index.html"><img src="assets/logo fokuz.png" alt="Fokuz" height="55"></a>
  <nav>${[["index", "Beranda"], ["layanan", "Layanan"], ["cara-kerja", "Cara Kerja"], ["review", "Review"], dashLink]
    .map(([p, l]) => `<a href="${p}.html" class="${page === p ? "active" : ""}">${l}${p === "akun" && unread ? ` <span class="dot">${unread}</span>` : ""}</a>`).join("")}</nav>
  <a class="btn" href="${ME ? dashLink[0] + ".html" : "layanan.html"}">${ME ? "Halo, " + esc(ME.name.split(" ")[0]) : "Pesan Sekarang"}</a></div></header>`);
document.body.insertAdjacentHTML("beforeend", `<footer><div class="wrap">
  <div><b>FOKUZ</b><p style="opacity:.7">Dari ide sampai hasil, Fokuz selalu ada.</p></div>
  <div style="display:flex;gap:18px;opacity:.8"><a href="syarat.html">Syarat & Ketentuan</a><a href="privasi.html">Kebijakan Privasi</a><a href="masuk.html?admin=1">Login Admin</a></div>
  <div style="opacity:.6">© 2026 Fokuz. Mendukung proses belajar yang jujur.</div></div></footer>`);

// ===== BERANDA =====
if (page === "index") {
  $("#cats").innerHTML = Object.entries(CATEGORIES).map(([id, c]) =>
    `<a class="cat ${id}" href="layanan.html?kategori=${id}"><div style="font-size:28px">${c.icon}</div><h3>${c.name}</h3><p>${c.desc}</p></a>`).join("");
  $("#popular").innerHTML = SERVICES.filter((_, i) => i % 2 === 0).map(card).join("");
}

// ===== KATALOG =====
if (page === "layanan") {
  let kat = params.get("kategori") || "";
  const q = $("#q"); q.value = params.get("q") || "";
  const render = () => {
    $("#chips").innerHTML = [["", "Semua"], ...Object.entries(CATEGORIES).map(([k, c]) => [k, c.name])]
      .map(([k, n]) => `<button class="chip ${kat === k ? "on" : ""}" data-k="${k}">${n}</button>`).join("");
    const list = SERVICES.filter((s) => (!kat || s.cat === kat) && (s.title + s.summary).toLowerCase().includes(q.value.toLowerCase()));
    $("#list").innerHTML = list.length ? list.map(card).join("") : `<p class="muted">Belum ada layanan yang cocok.</p>`;
  };
  $("#chips").onclick = (e) => { if (e.target.dataset.k !== undefined) { kat = e.target.dataset.k; render(); } };
  q.oninput = render; render();
}

// ===== DETAIL + CHECKOUT =====
if (page === "detail") {
  const s = SERVICES.find((x) => x.slug === params.get("slug")) || SERVICES[0];
  document.title = s.title + " — Fokuz";
  let pkg = 0;
  const list = (t, a) => a.length ? `<h3 style="margin-top:28px">${t}</h3><ul class="check">${a.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "";
  $("#info").innerHTML = `<a class="muted" href="layanan.html">← Layanan</a><br><br>
    <span class="tag ${s.cat}">${CATEGORIES[s.cat].name}</span><h1>${esc(s.title)}</h1><p class="muted">${esc(s.summary)}</p>
    ${list("Yang kamu dapatkan", s.deliverables)}${list("Format file", s.formats)}${list("Di luar lingkup layanan", s.exclusions)}`;
  const renderBox = () => {
    const p = s.packages[pkg];
    $("#box").innerHTML = `<div style="display:flex;gap:8px">${s.packages.map((x, i) => `<button class="chip ${i === pkg ? "on" : ""}" style="flex:1" data-i="${i}">${esc(x.name)}</button>`).join("")}</div>
      <div class="big">${rupiah(p.price)}</div><p class="muted">⏱ ${p.days} hari • 🔁 ${p.rev}x revisi</p>
      <ul class="check">${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul><br>
      <button class="btn dark block" id="order">Pesan Sekarang</button>`;
    $("#box").querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => { pkg = +b.dataset.i; renderBox(); }));
    $("#order").onclick = () => {
      if (!ME) return (location.href = "masuk.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search));
      if (Auth.isStaff(ME)) return alert("Kamu masuk sebagai admin. Gunakan akun pelanggan untuk memesan.");
      $("#sum").textContent = `${s.title} — ${p.name} • ${rupiah(p.price)}`;
      $("#who").textContent = `${ME.name} • ${ME.email}`;
      $("#modal").classList.add("show");
    };
  };
  renderBox();
  const method = $("#payment-method");
  const updateQRIS = () => { $("#qris-payment").hidden = method.value !== "QRIS"; };
  method.onchange = updateQRIS;
  updateQRIS();
  $("#qris-image").onerror = () => {
    $("#qris-image").hidden = true;
    $("#qris-unavailable").hidden = false;
  };
  $("#cancel").onclick = () => $("#modal").classList.remove("show");
  $("#form").onsubmit = async (e) => {
    e.preventDefault();
    const p = s.packages[pkg], f = new FormData(e.target), btn = $("#pay");
    btn.disabled = true; btn.textContent = "Memproses pembayaran...";
    try {
      const o = Orders.create(ME, s, p, f.get("brief"));
      const file = f.get("file"); if (file && file.size) await Files.add(o.id, "brief", file, ME);
      await Pay.charge(o.id, f.get("method")); // SIMULASI — ganti dengan payment gateway asli
      location.href = "sukses.html?id=" + o.id;
    } catch (err) { alert(err.message); btn.disabled = false; btn.textContent = "Bayar Sekarang"; }
  };
}

// ===== SUKSES =====
if (page === "sukses") {
  const o = ME && Orders.get(params.get("id"), ME), pay = o && Pay.forOrder(o.id);
  $("#receipt").innerHTML = o ? [["No. Pesanan", o.id], ["Layanan", esc(o.service)], ["Paket", esc(o.pkg)], ["Nama", esc(o.customer)], ["Metode", pay ? pay.method : "—"], ["Tanggal", fmtD(o.createdAt)], ["Total", rupiah(o.price)], ["Status", `<span class="badge">✓ Lunas • ${STATUS[o.status]}</span>`]]
    .map(([k, v]) => `<div><span class="muted">${k}</span><b>${v}</b></div>`).join("") + `<br><a class="btn dark block" style="text-align:center" href="akun.html#pesanan/${o.id}">Lihat di Dashboard</a>`
    : "<p>Pesanan tidak ditemukan.</p>";
}

// ===== PESANAN SAYA (lama) → dashboard =====
if (page === "pesanan") location.replace("akun.html#pesanan");

// ===== MASUK / DAFTAR =====
if (page === "masuk") {
  const isAdmin = params.get("admin") === "1";
  const next = params.get("next");
  const go = (u) => { location.href = Auth.isStaff(u) ? "admin.html" : next && /^[\w.-]+\.html(\?[\w=&%.-]*)?$/.test(next) ? next : "akun.html"; };
  if (ME) go(ME);
  $("#title").textContent = isAdmin ? "Login Admin" : "Masuk ke Fokuz";
  if (isAdmin) { $("#tabs").style.display = "none"; $("#hint").innerHTML = "Akun demo: <b>admin@fokuz.id</b> / admin123 • <b>staf@fokuz.id</b> / staf123"; }
  const show = (t) => { $("#login").style.display = t === "login" ? "" : "none"; $("#daftar").style.display = t === "daftar" ? "" : "none";
    document.querySelectorAll("#tabs .chip").forEach((c) => c.classList.toggle("on", c.dataset.t === t)); };
  $("#tabs").onclick = (e) => e.target.dataset.t && show(e.target.dataset.t);
  show("login");
  const handle = (form, fn) => (form.onsubmit = async (e) => {
    e.preventDefault(); const f = new FormData(form); $("#err").textContent = "";
    try { const u = await fn(f); if (isAdmin && !Auth.isStaff(u)) { Auth.logout(); throw new Error("Akun ini bukan akun admin."); } go(u); }
    catch (err) { $("#err").textContent = err.message; }
  });
  handle($("#login"), (f) => Auth.login(f.get("email"), f.get("password")));
  handle($("#daftar"), (f) => Auth.register(f.get("name"), f.get("email"), f.get("password")));
}

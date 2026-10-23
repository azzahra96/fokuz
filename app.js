// ===== KATEGORI LAYANAN =====
// Daftar layanan & harga disimpan di database dan diatur admin lewat
// Dashboard Admin → Katalog & Paket.
const CATEGORIES = {
  akademik: { name: "Dukungan Akademik", desc: "Proofreading, format laporan, dan daftar pustaka.", icon: "🎓" },
  desain: { name: "Desain Grafis", desc: "Poster, logo, konten media sosial, dan promosi.", icon: "🎨" },
  karier: { name: "CV & Karier", desc: "Desain CV, portofolio, dan surat lamaran.", icon: "💼" },
  sekolah: { name: "Dukungan Sekolah", desc: "Slide presentasi, infografis, dan materi belajar.", icon: "📘" },
};
let SERVICES = [];

// ===== HELPERS =====
const rupiah = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const from = (s) => Math.min(...s.packages.map((p) => p.price));
const $ = (sel) => document.querySelector(sel);
const params = new URLSearchParams(location.search);
const page = document.body.dataset.page;

function card(s) {
  const c = CATEGORIES[s.cat] || { name: s.cat };
  return `<a class="card" href="detail.html?slug=${encodeURIComponent(s.slug)}">
    <span class="tag ${s.cat}">${esc(c.name)}</span><h3>${esc(s.title)}</h3><p>${esc(s.summary)}</p>
    <span class="price">Mulai ${rupiah(from(s))} →</span></a>`;
}

// ===== HEADER & FOOTER (sama di semua halaman) =====
function renderHeader(unread) {
  const dashLink = ME ? (Auth.isStaff(ME) ? ["admin", "Dashboard Admin"] : ["akun", "Dashboard"]) : ["masuk", "Masuk"];
  const html = `<header><div class="wrap">
  <a class="logo" href="index.html"><img src="assets/logo fokuz.png" alt="Fokuz" height="40"></a>
  <nav>${[["index", "Beranda"], ["layanan", "Layanan"], ["cara-kerja", "Cara Kerja"], ["review", "Review"], dashLink]
    .map(([p, l]) => `<a href="${p}.html" class="${page === p ? "active" : ""}">${l}${p === "akun" && unread ? ` <span class="dot">${unread}</span>` : ""}</a>`).join("")}</nav>
  <a class="btn" href="${ME ? dashLink[0] + ".html" : "layanan.html"}">${ME ? "Halo, " + esc((ME.name || "").split(" ")[0]) : "Pesan Sekarang"}</a></div></header>`;
  const old = document.querySelector("body > header");
  if (old) old.outerHTML = html; else document.body.insertAdjacentHTML("afterbegin", html);
}
renderHeader(0);
document.body.insertAdjacentHTML("beforeend", `<footer><div class="wrap">
  <div><b>FOKUZ</b><p style="opacity:.7">Dari ide sampai hasil, Fokuz selalu ada.</p></div>
  <div style="display:flex;gap:18px;opacity:.8"><a href="syarat.html">Syarat & Ketentuan</a><a href="privasi.html">Kebijakan Privasi</a><a href="masuk.html?admin=1">Login Admin</a></div>
  <div style="opacity:.6">© 2026 Fokuz. Mendukung proses belajar yang jujur.</div></div></footer>`);

const needsCatalog = ["index", "layanan", "detail"].includes(page);
const APP_READY = READY.then(async () => {
  renderHeader(ME ? await Notifs.unread().catch(() => 0) : 0);
  if (needsCatalog) SERVICES = await Catalog.list().catch(() => []);
});

APP_READY.then(() => {
  // ===== BERANDA =====
  if (page === "index") {
    $("#cats").innerHTML = Object.entries(CATEGORIES).map(([id, c]) =>
      `<a class="cat ${id}" href="layanan.html?kategori=${id}"><div style="font-size:28px">${c.icon}</div><h3>${c.name}</h3><p>${c.desc}</p></a>`).join("");
    $("#popular").innerHTML = SERVICES.filter((_, i) => i % 2 === 0).map(card).join("") || `<p class="muted">Layanan belum bisa dimuat. Coba muat ulang halaman.</p>`;
  }

  // ===== KATALOG =====
  if (page === "layanan") {
    let kat = params.get("kategori") || "";
    const qi = $("#q"); qi.value = params.get("q") || "";
    const render = () => {
      $("#chips").innerHTML = [["", "Semua"], ...Object.entries(CATEGORIES).map(([k, c]) => [k, c.name])]
        .map(([k, n]) => `<button class="chip ${kat === k ? "on" : ""}" data-k="${k}">${n}</button>`).join("");
      const list = SERVICES.filter((s) => (!kat || s.cat === kat) && (s.title + s.summary).toLowerCase().includes(qi.value.toLowerCase()));
      $("#list").innerHTML = list.length ? list.map(card).join("") : `<p class="muted">Belum ada layanan yang cocok.</p>`;
    };
    $("#chips").onclick = (e) => { if (e.target.dataset.k !== undefined) { kat = e.target.dataset.k; render(); } };
    qi.oninput = render; render();
  }

  // ===== DETAIL + CHECKOUT =====
  if (page === "detail") {
    const s = SERVICES.find((x) => x.slug === params.get("slug")) || SERVICES[0];
    if (!s) { $("#info").innerHTML = `<p>Layanan tidak ditemukan. <a class="price" href="layanan.html">Lihat semua layanan →</a></p>`; return; }
    document.title = s.title + " — Fokuz";
    let pkg = 0;
    const list = (t, a) => a && a.length ? `<h3 style="margin-top:28px">${t}</h3><ul class="check">${a.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "";
    $("#info").innerHTML = `<a class="muted" href="layanan.html">← Layanan</a><br><br>
      <span class="tag ${s.cat}">${esc(CATEGORIES[s.cat]?.name || s.cat)}</span><h1>${esc(s.title)}</h1><p class="muted">${esc(s.summary)}</p>
      ${list("Yang kamu dapatkan", s.deliverables)}${list("Format file", s.formats)}${list("Di luar lingkup layanan", s.exclusions)}`;
    const renderBox = () => {
      const p = s.packages[pkg];
      $("#box").innerHTML = `<div style="display:flex;gap:8px">${s.packages.map((x, i) => `<button class="chip ${i === pkg ? "on" : ""}" style="flex:1" data-i="${i}">${esc(x.name)}</button>`).join("")}</div>
        <div class="big">${rupiah(p.price)}</div><p class="muted">⏱ ${p.days} hari • 🔁 ${p.rev}x revisi</p>
        <ul class="check">${(p.features || []).map((f) => `<li>${esc(f)}</li>`).join("")}</ul><br>
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
    $("#cancel").onclick = () => $("#modal").classList.remove("show");
    $("#form").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target), btn = $("#pay"), file = f.get("file");
      if (file && file.size > MAX_FILE) return alert("Ukuran file referensi maksimal 10 MB.");
      btn.disabled = true; btn.textContent = "Membuat pesanan...";
      try {
        // Harga diambil server dari katalog di database, bukan dari browser.
        const id = await Orders.create(s.slug, pkg, f.get("brief"));
        if (file && file.size) { try { await Files.add(id, "brief", file); } catch (err) { alert("Pesanan dibuat, tapi file referensi gagal diunggah: " + err.message + " Kamu bisa mengunggahnya lagi dari Dashboard."); } }
        location.href = "bayar.html?id=" + encodeURIComponent(id);
      } catch (err) { alert(err.message); btn.disabled = false; btn.textContent = "Buat Pesanan & Lanjut Bayar"; }
    };
  }

  // ===== HALAMAN LAMA → halaman pembayaran / dashboard =====
  if (page === "sukses") location.replace(params.get("id") ? "bayar.html?id=" + encodeURIComponent(params.get("id")) : "akun.html#pesanan");
  if (page === "pesanan") location.replace("akun.html#pesanan");

  // ===== MASUK / DAFTAR =====
  if (page === "masuk") {
    const isAdmin = params.get("admin") === "1";
    const next = params.get("next");
    const go = (u) => { location.href = Auth.isStaff(u) ? "admin.html" : next && /^[\w.-]+\.html(\?[\w=&%.-]*)?(#[\w/-]*)?$/.test(next) ? next : "akun.html"; };
    if (ME) return go(ME);
    $("#title").textContent = isAdmin ? "Login Admin" : "Masuk ke Fokuz";
    if (isAdmin) { $("#tabs").style.display = "none"; $("#hint").textContent = "Khusus akun yang sudah diberi peran admin atau staf."; }
    const show = (t) => { $("#login").style.display = t === "login" ? "" : "none"; $("#daftar").style.display = t === "daftar" ? "" : "none";
      document.querySelectorAll("#tabs .chip").forEach((c) => c.classList.toggle("on", c.dataset.t === t)); };
    $("#tabs").onclick = (e) => e.target.dataset.t && show(e.target.dataset.t);
    show("login");
    const handle = (form, fn) => (form.onsubmit = async (e) => {
      e.preventDefault(); const f = new FormData(form), btn = form.querySelector("button");
      $("#err").textContent = ""; $("#ok").textContent = ""; btn.disabled = true;
      try {
        const u = await fn(f);
        if (u && u.needsConfirm) { $("#ok").textContent = "Akun dibuat! Cek email kamu dan klik tautan konfirmasi, lalu masuk."; form.reset(); show("login"); return; }
        if (isAdmin && !Auth.isStaff(u)) { await Auth.logout(); throw new Error("Akun ini bukan akun admin."); }
        go(u);
      } catch (err) { $("#err").textContent = err.message; }
      finally { btn.disabled = false; }
    });
    handle($("#login"), (f) => Auth.login(f.get("email"), f.get("password")));
    handle($("#daftar"), (f) => Auth.register(f.get("name"), f.get("email"), f.get("password")));
  }
});

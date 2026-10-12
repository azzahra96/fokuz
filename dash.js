// =====================================================================
// FOKUZ — DASHBOARD PELANGGAN (akun.html) & ADMIN (admin.html)
// =====================================================================
const U = Auth.user();
const ADMIN = page === "admin";
const main = $("#main");
const toast = (t) => { const el = $("#toast"); el.textContent = t; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2600); };
const badge = (s) => `<span class="st st-${s}">${STATUS[s]}</span>`;
const late = (o) => (Orders.overdue(o) ? ` <span class="st st-late">Terlambat</span>` : "");
const kb = (n) => (n / 1024).toFixed(0) + " KB";
const go = (h) => { location.hash = h; };
const safe = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };
const val = (id) => ($("#" + id) ? $("#" + id).value : "");
const statusOpts = (sel) => `<option value="">Semua status</option>` + Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${sel === k ? "selected" : ""}>${v}</option>`).join("");

// --- Penjaga akses: pelanggan tidak bisa membuka admin.html, admin diarahkan ke dashboard admin ---
let allowed = true;
if (!U) { allowed = false; location.replace("masuk.html?" + (ADMIN ? "admin=1" : "next=akun.html")); }
else if (ADMIN && !Auth.isStaff(U)) { allowed = false; alert("Halaman ini khusus admin."); location.replace("akun.html"); }
else if (!ADMIN && Auth.isStaff(U)) { allowed = false; location.replace("admin.html"); }

const TABS = ADMIN
  ? [["ringkasan", "Ringkasan", "orders"], ["pesanan", "Pesanan", "orders"], ["layanan", "Katalog & Paket", "catalog"], ["pembayaran", "Pembayaran", "payments"],
     ["pelanggan", "Pelanggan", "customers"], ["dukungan", "Dukungan", "support"], ["laporan", "Laporan Penjualan", "reports"], ["tim", "Tim & Pekerja", "team"]].filter((t) => Auth.can(U, t[2]))
  : [["ringkasan", "Ringkasan"], ["pesanan", "Pesanan Saya"], ["notifikasi", "Notifikasi"], ["profil", "Profil & Akun"], ["bantuan", "Bantuan"]];

function render() {
  const [tab = "ringkasan", id] = decodeURIComponent(location.hash.slice(1)).split("/");
  const t = TABS.find((x) => x[0] === tab) ? tab : "ringkasan";
  const n = Notifs.unread(U);
  $("#side").innerHTML = `<div class="who"><b>${esc(U.name)}</b><br><span class="muted">${ADMIN ? (U.role === "admin" ? "Administrator" : "Staf") : "Pelanggan"}</span></div>` +
    TABS.map(([k, l]) => `<a href="#${k}" class="${t === k ? "on" : ""}">${l}${k === "notifikasi" && n ? ` <span class="dot">${n}</span>` : ""}</a>`).join("") +
    `<a href="#" id="logout">Keluar</a>`;
  $("#logout").onclick = (e) => { e.preventDefault(); Auth.logout(); location.href = "index.html"; };
  (ADMIN ? A : C)[t](id);
  window.scrollTo(0, 0);
}

// ---------- Komponen bersama ----------
function orderTable(list, admin) {
  if (!list.length) return `<p class="muted">Belum ada pesanan.</p>`;
  return `<div class="scroll"><table class="tbl"><tr><th>No.</th>${admin ? "<th>Pelanggan</th>" : ""}<th>Layanan</th><th>Total</th><th>Status</th><th>Deadline</th>${admin ? "<th>Pekerja</th>" : ""}</tr>` +
    list.map((o) => `<tr class="click" onclick="go('pesanan/${o.id}')"><td><b>${o.id}</b><br><span class="muted">${fmtD(o.createdAt)}</span></td>${admin ? `<td>${esc(o.customer)}</td>` : ""}
      <td>${esc(o.service)}<br><span class="muted">${esc(o.pkg)}</span></td><td>${rupiah(o.price)}</td><td>${badge(o.status)}${late(o)}</td><td>${fmtD(o.deadline)}</td>${admin ? `<td>${esc(o.worker || "—")}</td>` : ""}</tr>`).join("") + `</table></div>`;
}
function listPage(admin) {
  main.innerHTML = `<h2>${admin ? "Manajemen Pesanan" : "Riwayat Pesanan"}</h2><div class="panel"><div class="filters">
    <input id="fq" placeholder="Cari no. pesanan, layanan${admin ? ", pelanggan" : ""}..."><select id="fs">${statusOpts("")}${admin ? `<option value="late">Terlambat</option>` : ""}</select></div><div id="ft"></div></div>`;
  const draw = () => {
    const q = val("fq").toLowerCase(), s = val("fs");
    const list = Orders.visible(U).filter((o) => (o.id + o.service + o.customer).toLowerCase().includes(q) && (!s || (s === "late" ? Orders.overdue(o) : o.status === s)));
    $("#ft").innerHTML = orderTable(list, admin);
  };
  $("#fq").oninput = draw; $("#fs").onchange = draw; draw();
}
function timeline(o) {
  return `<ul class="timeline">${o.audit.slice().reverse().map((a) => `<li><b>${STATUS[a.to]}</b> <span class="muted">• ${fmtD(a.at)}</span><br>
    <span class="muted">oleh ${esc(a.by)}${a.note ? " — " + esc(a.note) : ""}</span></li>`).join("")}</ul>`;
}
function fileList(files) {
  return files.length ? files.map((f) => `<div class="file"><span>📄 ${esc(f.name)} <span class="muted">• ${kb(f.size)} • ${esc(f.by)} • ${fmtD(f.at)}</span></span>
    <button class="btn sm ghost" data-dl="${f.id}">Unduh</button></div>`).join("") : `<p class="muted" style="font-size:14px">Belum ada file.</p>`;
}
function bindFiles() { main.querySelectorAll("[data-dl]").forEach((b) => (b.onclick = safe(async () => { await Files.download(b.dataset.dl, U); toast("Unduhan dimulai • tautan kedaluwarsa dalam 60 detik"); }))); }
function uploadForm(id, label) { return `<form id="${id}" class="actions"><input type="file" name="f" required style="flex:1;margin:0"><button class="btn sm">${label}</button></form>`; }
function bindUpload(id, orderId, kind, after) {
  const f = $("#" + id); if (!f) return;
  f.onsubmit = safe(async (e) => { e.preventDefault(); const file = new FormData(f).get("f"); await Files.add(orderId, kind, file, U); if (after) after(); toast("File terunggah"); render(); });
}
function orderInfo(o) {
  const p = Pay.forOrder(o.id);
  const payStatus = o.status === "refunded" ? "Dikembalikan" : p ? "Lunas (" + esc(p.method) + ")" : "Belum dibayar";
  return `<div class="kv"><div><span class="muted">Layanan</span><b>${esc(o.service)} — ${esc(o.pkg)}</b></div><div><span class="muted">Harga</span><b>${rupiah(o.price)}</b></div>
    <div><span class="muted">Pembayaran</span><b>${payStatus}</b></div><div><span class="muted">Dipesan</span><b>${fmtD(o.createdAt)}</b></div>
    <div><span class="muted">Deadline</span><b>${fmtD(o.deadline)}${late(o)}</b></div><div><span class="muted">Revisi</span><b>${o.revUsed} / ${o.revLimit} terpakai</b></div></div>
    ${o.brief ? `<div class="note"><b>Brief:</b> ${esc(o.brief)}</div>` : ""}`;
}

// =====================================================================
// PELANGGAN
// =====================================================================
const C = {
  ringkasan() {
    const mine = Orders.visible(U), active = mine.filter((o) => ACTIVE.includes(o.status) || o.status === "awaiting_payment");
    const acts = mine.flatMap((o) => o.audit.map((a) => ({ ...a, id: o.id, service: o.service }))).sort((a, b) => b.at - a.at).slice(0, 6);
    main.innerHTML = `<h2>Halo, ${esc(U.name)} 👋</h2><div class="stats">
      <div class="stat"><b>${active.length}</b><span>Pesanan aktif</span></div><div class="stat"><b>${mine.filter((o) => o.status === "customer_review").length}</b><span>Menunggu review kamu</span></div>
      <div class="stat"><b>${mine.filter((o) => o.status === "completed").length}</b><span>Selesai</span></div><div class="stat"><b>${Notifs.unread(U)}</b><span>Notifikasi baru</span></div></div>
      <div class="panel"><h3 style="margin-top:0">Pesanan berjalan</h3>${orderTable(active, false)}</div>
      <div class="panel"><h3 style="margin-top:0">Aktivitas terbaru</h3>${acts.length ? acts.map((a) => `<div class="notif"><a href="#pesanan/${a.id}"><b>${a.id}</b> ${esc(a.service)} → ${STATUS[a.to]}</a><br><span class="muted">${fmtD(a.at)}</span></div>`).join("") : `<p class="muted">Belum ada aktivitas. <a class="price" href="layanan.html">Pesan layanan →</a></p>`}</div>`;
  },
  pesanan(id) {
    if (!id) return listPage(false);
    const o = Orders.get(id, U); if (!o) { main.innerHTML = `<p>Pesanan tidak ditemukan.</p>`; return; }
    const files = Files.forOrder(o.id, U), briefs = files.filter((f) => f.kind === "brief"), dels = files.filter((f) => f.kind === "delivery");
    const left = o.revLimit - o.revUsed, open = !["completed", "cancelled", "refunded"].includes(o.status);
    main.innerHTML = `<a class="muted" href="#pesanan">← Semua pesanan</a><h2 style="margin-top:8px">${o.id} ${badge(o.status)}</h2>
      <div class="two"><div class="panel" style="margin:0"><h3 style="margin-top:0">Detail pesanan</h3>${orderInfo(o)}
        ${o.status === "awaiting_payment" ? `<div class="actions"><select id="pm" style="flex:1;margin:0"><option>QRIS</option><option>Transfer Bank</option><option>GoPay</option><option>OVO</option></select><button class="btn sm dark" id="paynow">Bayar Sekarang</button><button class="btn sm red" id="cancel">Batalkan</button></div>` : ""}</div>
      <div class="panel" style="margin:0"><h3 style="margin-top:0">Progres</h3>${timeline(o)}</div></div>
      <div class="two"><div class="panel"><h3 style="margin-top:0">File brief & referensi</h3>${fileList(briefs)}${open ? uploadForm("upb", "Unggah") : ""}</div>
      <div class="panel"><h3 style="margin-top:0">Hasil pekerjaan</h3>${dels.length ? fileList(dels) : `<p class="muted" style="font-size:14px">Hasil akan muncul di sini saat dikirim tim Fokuz.</p>`}</div></div>
      <div class="panel"><h3 style="margin-top:0">Revisi <span class="muted" style="font-weight:400">• sisa ${left} dari ${o.revLimit}</span></h3>
        ${o.revisions.map((r, i) => `<div class="note"><b>Revisi #${i + 1}</b> <span class="muted">${fmtD(r.at)}</span><br>${esc(r.text)}${r.response ? `<br><br><b>Tanggapan Fokuz:</b> ${esc(r.response)}` : `<br><span class="muted">Menunggu tanggapan…</span>`}</div>`).join("")}
        ${o.status === "customer_review" ? `<p style="margin-top:12px;font-size:14px">Hasil sudah dikirim. Puas? Terima hasil, atau minta revisi.</p>
          ${left > 0 ? `<textarea id="revtxt" rows="3" maxlength="1000" placeholder="Jelaskan bagian yang perlu direvisi..."></textarea>` : `<p class="muted">Jatah revisi sudah habis.</p>`}
          <div class="actions"><button class="btn sm dark" id="accept">✓ Terima Hasil</button>${left > 0 ? `<button class="btn sm" id="rev">Minta Revisi</button>` : ""}</div>` : ""}</div>`;
    bindFiles(); bindUpload("upb", o.id, "brief");
    const on = (s, fn) => { const el = $(s); if (el) el.onclick = safe(fn); };
    on("#paynow", async () => { $("#paynow").textContent = "Memproses..."; await Pay.charge(o.id, val("pm")); toast("Pembayaran berhasil"); render(); });
    on("#cancel", () => { if (confirm("Batalkan pesanan ini?")) { Orders.transition(o.id, "cancelled", U, "Dibatalkan pelanggan"); render(); } });
    on("#accept", () => { Orders.transition(o.id, "completed", U, "Hasil diterima pelanggan"); toast("Terima kasih! Pesanan selesai."); render(); });
    on("#rev", () => { Orders.requestRevision(o.id, U, val("revtxt")); toast("Permintaan revisi terkirim"); render(); });
  },
  notifikasi() {
    const list = Notifs.mine(U);
    main.innerHTML = `<h2>Notifikasi</h2><div class="panel">${list.length ? list.map((n) => `<div class="notif ${n.read ? "" : "new"}">${n.orderId ? `<a href="#pesanan/${n.orderId}">` : ""}${esc(n.text)}${n.orderId ? "</a>" : ""}<br><span class="muted" style="font-weight:400">${fmtD(n.at)}</span></div>`).join("") : `<p class="muted">Belum ada notifikasi.</p>`}</div>`;
    if (list.some((n) => !n.read)) { Notifs.readAll(U); setTimeout(() => { const d = $("#side .dot"); if (d) d.remove(); }, 400); }
  },
  profil() {
    main.innerHTML = `<h2>Profil & Akun</h2><div class="two">
      <form class="panel" style="margin:0" id="pf"><h3 style="margin-top:0">Profil</h3><label>Nama<input name="name" value="${esc(U.name)}" maxlength="100" required></label>
        <label>Email<input value="${esc(U.email)}" disabled></label><label>No. WhatsApp<input name="phone" value="${esc(U.phone)}" maxlength="20"></label><br><button class="btn dark">Simpan</button></form>
      <form class="panel" style="margin:0" id="pw"><h3 style="margin-top:0">Ganti kata sandi</h3><label>Kata sandi lama<input type="password" name="old" required></label>
        <label>Kata sandi baru<input type="password" name="new" minlength="6" required></label><br><button class="btn dark">Ganti</button></form></div>`;
    $("#pf").onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target); Auth.updateProfile(U, f.get("name"), f.get("phone")); toast("Profil disimpan"); setTimeout(() => location.reload(), 600); };
    $("#pw").onsubmit = safe(async (e) => { e.preventDefault(); const f = new FormData(e.target); await Auth.changePassword(U, f.get("old"), f.get("new")); e.target.reset(); toast("Kata sandi diganti"); });
  },
  bantuan() {
    const mine = Tickets.all().filter((t) => t.userId === U.id);
    main.innerHTML = `<h2>Bantuan</h2><div class="two"><div class="panel" style="margin:0"><h3 style="margin-top:0">Dokumen</h3>
      <p><a class="price" href="syarat.html">Syarat & Ketentuan →</a></p><p><a class="price" href="privasi.html">Kebijakan Privasi →</a></p><p><a class="price" href="faq.html">FAQ →</a></p></div>
      <form class="panel" style="margin:0" id="tk"><h3 style="margin-top:0">Hubungi tim Fokuz</h3><label>Subjek<input name="s" maxlength="120" required></label>
        <label>Pesan<textarea name="m" rows="4" maxlength="1000" required></textarea></label><br><button class="btn dark">Kirim</button></form></div>
      <div class="panel"><h3 style="margin-top:0">Tiket saya</h3>${mine.length ? mine.map((t) => `<div class="note"><b>${esc(t.subject)}</b> <span class="st">${t.status}</span><br>${esc(t.msg)}${t.reply ? `<br><br><b>Balasan:</b> ${esc(t.reply)}` : ""}</div>`).join("") : `<p class="muted">Belum ada tiket.</p>`}</div>`;
    $("#tk").onsubmit = safe((e) => { e.preventDefault(); const f = new FormData(e.target); Tickets.create(U, f.get("s"), f.get("m")); toast("Pesan terkirim"); render(); });
  },
};

// =====================================================================
// ADMIN
// =====================================================================
const A = {
  ringkasan() {
    const all = Orders.all();
    const c = (f) => all.filter(f).length;
    main.innerHTML = `<h2>Ringkasan Operasional</h2><div class="stats">
      <div class="stat"><b>${c((o) => o.status === "awaiting_payment")}</b><span>Pesanan baru (belum bayar)</span></div>
      <div class="stat"><b>${c((o) => o.status === "paid")}</b><span>Sudah bayar, perlu dicek</span></div>
      <div class="stat"><b>${c((o) => ACTIVE.includes(o.status) && o.status !== "paid")}</b><span>Proyek aktif</span></div>
      <div class="stat"><b style="color:#B03A3A">${c(Orders.overdue)}</b><span>Terlambat</span></div>
      <div class="stat"><b>${c((o) => o.status === "completed")}</b><span>Selesai</span></div></div>
      <div class="panel"><h3 style="margin-top:0">Perlu tindakan</h3>${orderTable(all.filter((o) => ["paid", "review", "revision_requested"].includes(o.status) || Orders.overdue(o)), true)}</div>
      <div class="panel"><h3 style="margin-top:0">Pesanan terbaru</h3>${orderTable(all.slice(0, 8), true)}</div>`;
  },
  pesanan(id) {
    if (!id) return listPage(true);
    const o = Orders.get(id, U); if (!o) { main.innerHTML = `<p>Pesanan tidak ditemukan.</p>`; return; }
    const cust = DB.get("users", []).find((u) => u.id === o.userId) || {};
    const files = Files.forOrder(o.id, U), workers = DB.get("workers", []);
    const next = Object.entries(FLOW[o.status]).filter(([, r]) => r === "admin" || r === "any").map(([k]) => k)
      .filter((k) => k !== "refunded" || Auth.can(U, "payments"));
    const canDeliver = ["in_progress", "revision_in_progress"].includes(o.status);
    main.innerHTML = `<a class="muted" href="#pesanan">← Semua pesanan</a><h2 style="margin-top:8px">${o.id} ${badge(o.status)}${late(o)}</h2>
      <div class="two"><div class="panel" style="margin:0"><h3 style="margin-top:0">Detail</h3>${orderInfo(o)}</div>
        <div class="panel" style="margin:0"><h3 style="margin-top:0">Pelanggan</h3><div class="kv"><div><span class="muted">Nama</span><b>${esc(cust.name)}</b></div>
          <div><span class="muted">Email</span><b>${esc(cust.email)}</b></div><div><span class="muted">WhatsApp</span><b>${esc(cust.phone || "—")}</b></div>
          <div><span class="muted">Total pesanan</span><b>${Orders.all().filter((x) => x.userId === o.userId).length}</b></div></div>
          <h3>Tugaskan ke pekerja</h3><div class="actions" style="margin:0"><select id="wk" style="flex:1;margin:0"><option value="">— Belum ditugaskan —</option>${workers.map((w) => `<option ${w === o.worker ? "selected" : ""}>${esc(w)}</option>`).join("")}</select><button class="btn sm" id="assign">Simpan</button></div></div></div>
      <div class="panel"><h3 style="margin-top:0">Ubah status</h3>${next.length ? `<input id="note" placeholder="Catatan untuk pelanggan (opsional)" maxlength="300">
        <div class="actions">${next.map((k) => `<button class="btn sm ${k === "cancelled" || k === "refunded" ? "red" : "dark"}" data-to="${k}">→ ${STATUS[k]}</button>`).join("")}</div>
        ${o.status === "in_progress" || o.status === "revision_in_progress" ? `<p class="muted" style="font-size:13px;margin-top:8px">Tip: mengunggah hasil di bawah otomatis mengubah status ke "Menunggu Review Pelanggan".</p>` : ""}`
        : `<p class="muted">${o.status === "awaiting_payment" ? "Menunggu pembayaran dari pelanggan — status Lunas hanya bisa diset oleh sistem pembayaran." : o.status === "customer_review" ? "Menunggu pelanggan menerima hasil atau meminta revisi." : "Tidak ada perubahan status yang tersedia."}</p>`}</div>
      <div class="two"><div class="panel"><h3 style="margin-top:0">File dari pelanggan</h3>${fileList(files.filter((f) => f.kind === "brief"))}</div>
        <div class="panel"><h3 style="margin-top:0">Hasil akhir</h3>${fileList(files.filter((f) => f.kind === "delivery"))}${canDeliver ? uploadForm("upd", "Kirim ke Pelanggan") : `<p class="muted" style="font-size:13px">Upload hasil tersedia saat status "Sedang Dikerjakan" atau "Revisi Dikerjakan".</p>`}</div></div>
      <div class="panel"><h3 style="margin-top:0">Permintaan revisi <span class="muted" style="font-weight:400">• ${o.revUsed}/${o.revLimit}</span></h3>
        ${o.revisions.length ? o.revisions.map((r, i) => `<div class="note"><b>Revisi #${i + 1}</b> <span class="muted">${fmtD(r.at)}</span><br>${esc(r.text)}
          ${r.response ? `<br><br><b>Tanggapan:</b> ${esc(r.response)}` : `<textarea data-rv="${r.id}" rows="2" maxlength="1000" placeholder="Tulis tanggapan..." style="background:#fff"></textarea><button class="btn sm dark" data-rs="${r.id}" style="margin-top:8px">Kirim tanggapan & mulai revisi</button>`}</div>`).join("") : `<p class="muted">Belum ada revisi.</p>`}</div>
      <div class="panel"><h3 style="margin-top:0">Jejak audit</h3>${timeline(o)}</div>`;
    bindFiles();
    bindUpload("upd", o.id, "delivery", () => Orders.transition(o.id, "customer_review", U, "Hasil pekerjaan dikirim"));
    $("#assign").onclick = safe(() => { Orders.staffUpdate(o.id, U, { worker: val("wk") }); toast("Penugasan disimpan"); render(); });
    main.querySelectorAll("[data-to]").forEach((b) => (b.onclick = safe(() => {
      const to = b.dataset.to; if ((to === "cancelled" || to === "refunded") && !confirm(`Yakin ubah ke "${STATUS[to]}"?`)) return;
      if (to === "refunded") Pay.refund(o.id, U, val("note")); else Orders.transition(o.id, to, U, val("note"));
      toast("Status diperbarui"); render();
    })));
    main.querySelectorAll("[data-rs]").forEach((b) => (b.onclick = safe(() => {
      const t = main.querySelector(`[data-rv="${b.dataset.rs}"]`).value.trim(); if (!t) throw new Error("Tulis tanggapan dulu.");
      Orders.respondRevision(o.id, b.dataset.rs, U, t); toast("Tanggapan terkirim"); render();
    })));
  },
  layanan() {
    const list = DB.get("services", null) || DEFAULT_SERVICES;
    const save = (l) => { if (!Auth.can(U, "catalog")) throw new Error("Tidak punya izin."); DB.set("services", l); };
    main.innerHTML = `<h2>Katalog & Paket</h2><p class="muted">Atur harga, estimasi hari kerja, dan batas revisi. Perubahan langsung tampil di halaman Layanan.</p>
      ${list.map((s, si) => `<div class="panel"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><span class="tag ${s.cat}">${CATEGORIES[s.cat].name}</span> <b>${esc(s.title)}</b></div>
        <button class="btn sm red" data-del="${si}">Hapus layanan</button></div><div class="scroll"><table class="tbl" style="margin-top:10px"><tr><th>Paket</th><th>Harga (Rp)</th><th>Hari</th><th>Revisi</th><th></th></tr>
        ${s.packages.map((p, pi) => `<tr><td><input data-k="${si}.${pi}.name" value="${esc(p.name)}"></td><td><input type="number" min="0" data-k="${si}.${pi}.price" value="${p.price}"></td>
          <td><input type="number" min="1" data-k="${si}.${pi}.days" value="${p.days}"></td><td><input type="number" min="0" data-k="${si}.${pi}.rev" value="${p.rev}"></td>
          <td>${s.packages.length > 1 ? `<button class="btn sm ghost" data-delp="${si}.${pi}">✕</button>` : ""}</td></tr>`).join("")}</table></div>
        <div class="actions"><button class="btn sm dark" data-save="${si}">Simpan</button><button class="btn sm ghost" data-addp="${si}">+ Paket</button></div></div>`).join("")}
      <form class="panel" id="ns"><h3 style="margin-top:0">Tambah layanan baru</h3><div class="two"><label>Judul<input name="t" required maxlength="100"></label>
        <label>Kategori<select name="c">${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}">${c.name}</option>`).join("")}</select></label></div>
        <label>Ringkasan<input name="s" required maxlength="200"></label><div class="stats" style="margin-top:0"><label>Harga<input type="number" name="p" min="0" required></label>
        <label>Hari kerja<input type="number" name="d" min="1" value="2" required></label><label>Revisi<input type="number" name="r" min="0" value="1" required></label></div>
        <br><button class="btn dark">Tambah</button> <button type="button" class="btn ghost" id="reset">Kembalikan katalog awal</button></form>`;
    main.querySelectorAll("[data-save]").forEach((b) => (b.onclick = safe(() => {
      const si = +b.dataset.save;
      main.querySelectorAll(`[data-k^="${si}."]`).forEach((inp) => { const [, pi, k] = inp.dataset.k.split("."); list[si].packages[pi][k] = k === "name" ? inp.value.trim() || "Paket" : Math.max(0, +inp.value || 0); });
      save(list); toast("Disimpan");
    })));
    main.querySelectorAll("[data-addp]").forEach((b) => (b.onclick = safe(() => { list[+b.dataset.addp].packages.push({ name: "Baru", price: 10000, days: 2, rev: 1, features: [] }); save(list); render(); })));
    main.querySelectorAll("[data-delp]").forEach((b) => (b.onclick = safe(() => { const [si, pi] = b.dataset.delp.split(".").map(Number); list[si].packages.splice(pi, 1); save(list); render(); })));
    main.querySelectorAll("[data-del]").forEach((b) => (b.onclick = safe(() => { if (confirm("Hapus layanan ini?")) { list.splice(+b.dataset.del, 1); save(list); render(); } })));
    $("#ns").onsubmit = safe((e) => {
      e.preventDefault(); const f = new FormData(e.target), t = f.get("t").trim();
      const slug = t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
      list.push({ slug, title: t, cat: f.get("c"), summary: f.get("s").trim(), deliverables: [], formats: [], exclusions: [], packages: [{ name: "Standar", price: +f.get("p"), days: +f.get("d"), rev: +f.get("r"), features: [] }] });
      save(list); toast("Layanan ditambahkan"); render();
    });
    $("#reset").onclick = () => { if (confirm("Kembalikan semua layanan ke contoh awal?")) { localStorage.removeItem("fokuz_services"); location.reload(); } };
  },
  pembayaran() {
    const pays = Pay.all(), orders = Orders.all();
    main.innerHTML = `<h2>Riwayat Pembayaran</h2><div class="panel scroll">${pays.length ? `<table class="tbl"><tr><th>ID</th><th>Pesanan</th><th>Pelanggan</th><th>Jumlah</th><th>Metode</th><th>Tanggal</th><th>Status refund</th></tr>
      ${pays.map((p) => { const o = orders.find((x) => x.id === p.orderId) || {}; return `<tr class="click" onclick="go('pesanan/${p.orderId}')"><td>${p.id}</td><td>${p.orderId}</td><td>${esc(o.customer)}</td><td>${rupiah(p.amount)}</td><td>${esc(p.method)}</td><td>${fmtD(p.at)}</td><td>${p.refund === "—" ? `<span class="st">${p.status}</span>` : `<span class="st st-refunded">${esc(p.refund)}</span>`}</td></tr>`; }).join("")}</table>` : `<p class="muted">Belum ada pembayaran.</p>`}
      <p class="muted" style="font-size:13px;margin-top:10px">Refund dilakukan dari halaman detail pesanan (status "Pembayaran Dikonfirmasi" atau "Menunggu Review Admin").</p></div>`;
  },
  pelanggan() {
    const users = DB.get("users", []), orders = Orders.all();
    const cs = users.filter((u) => u.role === "customer");
    main.innerHTML = `<h2>Pelanggan</h2><div class="panel scroll">${cs.length ? `<table class="tbl"><tr><th>Nama</th><th>Email</th><th>WhatsApp</th><th>Pesanan</th><th>Total belanja</th><th>Bergabung</th><th></th></tr>
      ${cs.map((u) => { const mine = orders.filter((o) => o.userId === u.id); const spent = mine.filter((o) => Pay.forOrder(o.id) && o.status !== "refunded").reduce((a, o) => a + o.price, 0);
        return `<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td>${esc(u.phone || "—")}</td><td>${mine.length}</td><td>${rupiah(spent)}</td><td>${fmtD(u.createdAt)}</td>
        <td><button class="btn sm ${u.disabled ? "" : "red"}" data-tg="${u.id}">${u.disabled ? "Aktifkan" : "Nonaktifkan"}</button></td></tr>`; }).join("")}</table>` : `<p class="muted">Belum ada pelanggan terdaftar.</p>`}</div>`;
    main.querySelectorAll("[data-tg]").forEach((b) => (b.onclick = () => { const a = DB.get("users", []), u = a.find((x) => x.id === b.dataset.tg); u.disabled = !u.disabled; DB.set("users", a); render(); }));
  },
  dukungan() {
    const ts = Tickets.all();
    main.innerHTML = `<h2>Pertanyaan & Dukungan</h2>${ts.length ? ts.map((t) => `<div class="panel"><b>${esc(t.subject)}</b> <span class="st">${t.status}</span><br>
      <span class="muted">${esc(t.name)} • ${esc(t.email)} • ${fmtD(t.at)}</span><p style="margin-top:8px">${esc(t.msg)}</p>
      ${t.reply ? `<div class="note"><b>Balasan:</b> ${esc(t.reply)}</div>` : `<textarea data-rt="${t.id}" rows="2" maxlength="1000" placeholder="Tulis balasan..."></textarea><button class="btn sm dark" data-rb="${t.id}" style="margin-top:8px">Balas</button>`}</div>`).join("") : `<div class="panel"><p class="muted">Belum ada pertanyaan masuk.</p></div>`}`;
    main.querySelectorAll("[data-rb]").forEach((b) => (b.onclick = safe(() => { const t = main.querySelector(`[data-rt="${b.dataset.rb}"]`).value.trim(); if (!t) throw new Error("Tulis balasan dulu."); Tickets.reply(b.dataset.rb, U, t); toast("Balasan terkirim"); render(); })));
  },
  laporan() {
    const pays = Pay.all(), orders = Orders.all();
    const gross = pays.reduce((a, p) => a + p.amount, 0);
    const refunded = orders.filter((o) => o.status === "refunded");
    const refundAmt = refunded.reduce((a, o) => a + o.price, 0);
    const by = {}; orders.filter((o) => Pay.forOrder(o.id)).forEach((o) => { by[o.service] = by[o.service] || { n: 0, sum: 0 }; by[o.service].n++; by[o.service].sum += o.price; });
    main.innerHTML = `<h2>Laporan Penjualan</h2><div class="stats">
      <div class="stat"><b>${rupiah(gross)}</b><span>Penjualan kotor</span></div><div class="stat"><b>${rupiah(gross - refundAmt)}</b><span>Penjualan bersih</span></div>
      <div class="stat"><b>${orders.filter((o) => o.status === "completed").length}</b><span>Pesanan selesai</span></div>
      <div class="stat"><b>${orders.filter((o) => o.status === "cancelled").length}</b><span>Dibatalkan</span></div>
      <div class="stat"><b>${refunded.length} • ${rupiah(refundAmt)}</b><span>Refund</span></div></div>
      <div class="panel scroll"><h3 style="margin-top:0">Per layanan</h3>${Object.keys(by).length ? `<table class="tbl"><tr><th>Layanan</th><th>Terjual</th><th>Pendapatan</th></tr>${Object.entries(by).sort((a, b) => b[1].sum - a[1].sum).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.n}</td><td>${rupiah(v.sum)}</td></tr>`).join("")}</table>` : `<p class="muted">Belum ada penjualan.</p>`}</div>`;
  },
  tim() {
    const workers = DB.get("workers", []), staff = DB.get("users", []).filter((u) => Auth.isStaff(u));
    main.innerHTML = `<h2>Tim & Pekerja</h2><div class="two"><div class="panel" style="margin:0"><h3 style="margin-top:0">Pekerja (untuk penugasan)</h3>
      ${workers.map((w, i) => `<div class="file"><span>${esc(w)}</span><button class="btn sm ghost" data-rw="${i}">Hapus</button></div>`).join("")}
      <form id="aw" class="actions"><input name="w" placeholder="Nama pekerja" required maxlength="60" style="flex:1;margin:0"><button class="btn sm">Tambah</button></form></div>
      <div class="panel" style="margin:0"><h3 style="margin-top:0">Akun admin & staf</h3>${staff.map((u) => `<div class="file"><span><b>${esc(u.name)}</b> <span class="muted">${esc(u.email)}</span></span><span class="st">${u.role === "admin" ? "Admin" : "Staf"}</span></div>`).join("")}
        <form id="as"><label>Nama<input name="n" required maxlength="100"></label><label>Email<input name="e" type="email" required></label><label>Kata sandi<input name="p" type="password" minlength="6" required></label>
        <label>Peran<select name="r"><option value="staff">Staf — pesanan, file, revisi, dukungan</option><option value="admin">Admin — akses penuh</option></select></label><br><button class="btn dark">Buat akun</button></form></div></div>`;
    main.querySelectorAll("[data-rw]").forEach((b) => (b.onclick = () => { workers.splice(+b.dataset.rw, 1); DB.set("workers", workers); render(); }));
    $("#aw").onsubmit = (e) => { e.preventDefault(); workers.push(new FormData(e.target).get("w").trim()); DB.set("workers", workers); render(); };
    $("#as").onsubmit = safe(async (e) => {
      e.preventDefault(); if (!Auth.can(U, "team")) throw new Error("Tidak punya izin.");
      const f = new FormData(e.target), users = DB.get("users", []), email = f.get("e").trim().toLowerCase();
      if (users.some((u) => u.email === email)) throw new Error("Email sudah dipakai.");
      users.push({ id: uid("U"), name: f.get("n").trim(), email, phone: "", role: f.get("r") === "admin" ? "admin" : "staff", passHash: await hash(f.get("p")), createdAt: Date.now() });
      DB.set("users", users); toast("Akun dibuat"); render();
    });
  },
};

if (allowed) { window.addEventListener("hashchange", render); render(); }

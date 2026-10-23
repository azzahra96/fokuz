// =====================================================================
// FOKUZ — DASHBOARD PELANGGAN (akun.html) & ADMIN (admin.html)
// Data diambil dari Lovable Cloud. Tombol di sini hanya memanggil fungsi
// server; server yang memutuskan boleh/tidaknya setiap tindakan.
// =====================================================================
APP_READY.then(() => {
  const U = ME;
  const ADMIN = page === "admin";
  const main = $("#main");
  const toast = (t) => { const el = $("#toast"); el.textContent = t; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2800); };
  const badge = (s) => `<span class="st st-${s}">${STATUS[s] || s}</span>`;
  const pbadge = (s) => `<span class="st st-${s}">${PAY_STATUS[s] || s}</span>`;
  const late = (o) => (Orders.overdue(o) ? ` <span class="st st-late">Terlambat</span>` : "");
  const kb = (n) => (n / 1024).toFixed(0) + " KB";
  const go = (h) => { location.hash = h; };
  window.go = go;
  const val = (id) => ($("#" + id) ? $("#" + id).value : "");
  const busy = (b, t) => { if (b) { b.disabled = true; b.dataset.t = b.textContent; b.textContent = t || "Memproses..."; } };
  const unbusy = (b) => { if (b && b.dataset.t) { b.disabled = false; b.textContent = b.dataset.t; } };
  // Jalankan aksi server, tampilkan error dengan jelas, lalu muat ulang tampilan.
  const act = (fn, ok) => async (e) => {
    const b = e && e.currentTarget && e.currentTarget.tagName === "BUTTON" ? e.currentTarget : e && e.submitter;
    if (e && e.preventDefault && e.type === "submit") e.preventDefault();
    busy(b);
    try { const r = await fn(e); if (r === false) { unbusy(b); return; } if (ok) toast(ok); await render(); }
    catch (err) { toast(err.message); unbusy(b); }
  };
  const opts = (map, sel, all) => `<option value="">${all}</option>` + Object.entries(map).map(([k, v]) => `<option value="${k}" ${sel === k ? "selected" : ""}>${v}</option>`).join("");

  // --- Penjaga akses (tampilan). Data tetap dilindungi aturan di database. ---
  if (!U) { location.replace("masuk.html?" + (ADMIN ? "admin=1" : "next=akun.html")); return; }
  if (ADMIN && !Auth.isStaff(U)) { alert("Halaman ini khusus admin."); location.replace("akun.html"); return; }
  if (!ADMIN && Auth.isStaff(U)) { location.replace("admin.html"); return; }

  const TABS = ADMIN
    ? [["ringkasan", "Ringkasan", "orders"], ["pembayaran", "Verifikasi Pembayaran", "payments"], ["pesanan", "Pesanan", "orders"], ["metode", "Metode Pembayaran", "payments"],
       ["layanan", "Katalog & Paket", "catalog"], ["pelanggan", "Pelanggan", "customers"], ["dukungan", "Dukungan", "support"], ["laporan", "Laporan Penjualan", "reports"], ["tim", "Tim & Pekerja", "team"]].filter((t) => Auth.can(U, t[2]))
    : [["ringkasan", "Ringkasan"], ["pesanan", "Pesanan Saya"], ["notifikasi", "Notifikasi"], ["profil", "Profil & Akun"], ["bantuan", "Bantuan"]];

  let SEQ = 0;
  async function render() {
    const seq = ++SEQ;
    const [tab = "ringkasan", id] = decodeURIComponent(location.hash.slice(1)).split("/");
    const t = TABS.find((x) => x[0] === tab) ? tab : "ringkasan";
    const n = ADMIN ? 0 : await Notifs.unread().catch(() => 0);
    if (seq !== SEQ) return;
    $("#side").innerHTML = `<div class="who"><b>${esc(U.name)}</b><br><span class="muted">${ADMIN ? (U.role === "admin" ? "Administrator" : "Staf") : "Pelanggan"}</span></div>` +
      TABS.map(([k, l]) => `<a href="#${k}" class="${t === k ? "on" : ""}">${l}${k === "notifikasi" && n ? ` <span class="dot">${n}</span>` : ""}</a>`).join("") +
      `<a href="#" id="logout">Keluar</a>`;
    $("#logout").onclick = async (e) => { e.preventDefault(); await Auth.logout(); location.href = "index.html"; };
    if (!main.dataset.view || main.dataset.view !== t + "/" + (id || "")) main.innerHTML = `<p class="muted">Memuat…</p>`;
    main.dataset.view = t + "/" + (id || "");
    try {
      const html = await (ADMIN ? A : C)[t](id);
      if (seq !== SEQ) return;
      if (typeof html === "string") main.innerHTML = html;
      const bind = (ADMIN ? A : C)["_" + t];
      if (bind) bind(id);
    } catch (e) { if (seq === SEQ) main.innerHTML = `<div class="panel"><p>Gagal memuat data: ${esc(e.message)}</p><button class="btn sm" onclick="location.reload()">Coba lagi</button></div>`; }
  }

  // ---------- Komponen bersama ----------
  function orderTable(list, admin) {
    if (!list.length) return `<p class="muted">Belum ada pesanan.</p>`;
    return `<div class="scroll"><table class="tbl"><tr><th>No.</th>${admin ? "<th>Pelanggan</th>" : ""}<th>Layanan</th><th>Total</th><th>Pembayaran</th><th>Status</th><th>Deadline</th>${admin ? "<th>Pekerja</th>" : ""}</tr>` +
      list.map((o) => `<tr class="click" onclick="go('pesanan/${o.id}')"><td><b>${o.id}</b><br><span class="muted">${fmtD(o.created_at)}</span></td>${admin ? `<td>${esc(o.customer_name)}</td>` : ""}
        <td>${esc(o.service_title)}<br><span class="muted">${esc(o.package_name)}</span></td><td>${rupiah(o.price)}</td><td>${pbadge(o.payment_status)}</td><td>${badge(o.order_status)}${late(o)}</td><td>${fmtD(o.deadline)}</td>${admin ? `<td>${esc(o.worker || "—")}</td>` : ""}</tr>`).join("") + `</table></div>`;
  }
  let LIST = [];
  function listPage(admin, orders) {
    LIST = orders;
    return `<h2>${admin ? "Manajemen Pesanan" : "Riwayat Pesanan"}</h2><div class="panel"><div class="filters">
      <input id="fq" placeholder="Cari no. pesanan, layanan${admin ? ", pelanggan" : ""}..."><select id="fs">${opts(STATUS, "", "Semua status pengerjaan")}${admin ? `<option value="late">Terlambat</option>` : ""}</select>
      <select id="fp">${opts(PAY_STATUS, "", "Semua status pembayaran")}</select></div><div id="ft"></div></div>`;
  }
  function bindList(admin) {
    const draw = () => {
      const qv = val("fq").toLowerCase(), s = val("fs"), p = val("fp");
      const list = LIST.filter((o) => (o.id + o.service_title + o.customer_name).toLowerCase().includes(qv) && (!s || (s === "late" ? Orders.overdue(o) : o.order_status === s)) && (!p || o.payment_status === p));
      $("#ft").innerHTML = orderTable(list, admin);
    };
    $("#fq").oninput = draw; $("#fs").onchange = draw; $("#fp").onchange = draw; draw();
  }
  const evLabel = (e) => e.kind === "payment" ? "Pembayaran: " + (PAY_STATUS[e.to_status] || e.to_status) : STATUS[e.to_status] || e.to_status;
  function timeline(events, kind) {
    const list = events.filter((e) => !kind || e.kind === kind).slice().reverse();
    if (!list.length) return `<p class="muted">Belum ada riwayat.</p>`;
    return `<ul class="timeline">${list.map((a) => `<li class="${a.kind === "payment" ? "pay" : ""}"><b>${esc(evLabel(a))}</b> <span class="muted">• ${fmtD(a.created_at)}</span><br>
      <span class="muted">oleh ${esc(a.actor_label || "Sistem")}${a.note ? " — " + esc(a.note) : ""}</span></li>`).join("")}</ul>`;
  }
  function fileList(files) {
    return files.length ? files.map((f) => `<div class="file"><span>📄 ${esc(f.name)} <span class="muted">• ${kb(f.size_bytes)} • ${esc(f.uploaded_by_label)} • ${fmtD(f.created_at)}</span></span>
      <button class="btn sm ghost" data-dl="${f.id}">Unduh</button></div>`).join("") : `<p class="muted" style="font-size:14px">Belum ada file.</p>`;
  }
  function bindFiles(files) {
    main.querySelectorAll("[data-dl]").forEach((b) => (b.onclick = async () => {
      try { await Files.download(files.find((f) => f.id === b.dataset.dl)); toast("Unduhan dimulai • tautan kedaluwarsa dalam 60 detik"); } catch (e) { toast(e.message); }
    }));
  }
  const uploadForm = (id, label) => `<form id="${id}" class="actions"><input type="file" name="f" required style="flex:1;margin:0"><button class="btn sm">${label}</button></form>`;
  function bindUpload(id, orderId, kind, ok) {
    const f = $("#" + id); if (!f) return;
    f.onsubmit = act(async () => { await Files.add(orderId, kind, new FormData(f).get("f")); }, ok || "File terunggah");
  }
  function orderInfo(o) {
    return `<div class="kv"><div><span class="muted">Layanan</span><b>${esc(o.service_title)} — ${esc(o.package_name)}</b></div><div><span class="muted">Harga</span><b>${rupiah(o.price)}</b></div>
      <div><span class="muted">Pembayaran</span><b>${pbadge(o.payment_status)}${o.payment_method_name ? ` <span class="muted">${esc(o.payment_method_name)}</span>` : ""}</b></div>
      <div><span class="muted">Dipesan</span><b>${fmtD(o.created_at)}</b></div>
      <div><span class="muted">Deadline</span><b>${fmtD(o.deadline)}${late(o)}</b></div><div><span class="muted">Revisi</span><b>${o.rev_used} / ${o.rev_limit} terpakai</b></div></div>
      ${o.payment_status === "payment_rejected" && o.rejection_reason ? `<div class="note pay-alert-inline"><b>Alasan bukti ditolak:</b> ${esc(o.rejection_reason)}</div>` : ""}
      ${o.brief ? `<div class="note"><b>Brief:</b> ${esc(o.brief)}</div>` : ""}`;
  }
  // Langkah yang ditampilkan (cermin aturan server; server tetap mengecek ulang).
  function nextSteps(o) {
    if (o.order_status === "awaiting_payment") return Auth.isAdmin(U) && ["pending_payment", "payment_rejected"].includes(o.payment_status) ? ["cancelled"] : [];
    if (o.payment_status !== "paid") return [];
    return { queued: ["processing"], processing: ["customer_review"], revision_requested: ["revision_in_progress"], revision_in_progress: ["customer_review"], customer_review: ["completed"] }[o.order_status] || [];
  }
  async function orderBundle(id) {
    const o = await Orders.get(id);
    if (!o) return null;
    const [events, files, revisions] = await Promise.all([Orders.events(id), Files.forOrder(id), Orders.revisions(id)]);
    return { o, events, files, revisions };
  }

  // =====================================================================
  // PELANGGAN
  // =====================================================================
  const C = {
    async ringkasan() {
      const [mine, acts, unread] = await Promise.all([Orders.list(), Orders.recentEvents(6), Notifs.unread()]);
      const active = mine.filter((o) => ACTIVE.includes(o.order_status) || o.order_status === "awaiting_payment");
      const toPay = mine.filter((o) => o.order_status === "awaiting_payment" && ["pending_payment", "payment_rejected"].includes(o.payment_status));
      return `<h2>Halo, ${esc(U.name)} 👋</h2>
        ${toPay.length ? `<div class="panel pay-alert"><b>${toPay.length} pesanan menunggu pembayaranmu.</b> ${toPay.map((o) => `<a class="price" href="bayar.html?id=${o.id}">${o.id} — ${o.payment_status === "payment_rejected" ? "unggah ulang bukti" : "bayar sekarang"} →</a>`).join(" ")}</div>` : ""}
        <div class="stats">
        <div class="stat"><b>${active.length}</b><span>Pesanan aktif</span></div><div class="stat"><b>${mine.filter((o) => o.order_status === "customer_review").length}</b><span>Menunggu review kamu</span></div>
        <div class="stat"><b>${mine.filter((o) => o.order_status === "completed").length}</b><span>Selesai</span></div><div class="stat"><b>${unread}</b><span>Notifikasi baru</span></div></div>
        <div class="panel"><h3 style="margin-top:0">Pesanan berjalan</h3>${orderTable(active, false)}</div>
        <div class="panel"><h3 style="margin-top:0">Aktivitas terbaru</h3>${acts.length ? acts.map((a) => `<div class="notif"><a href="#pesanan/${a.order_id}"><b>${a.order_id}</b> ${esc(a.orders?.service_title || "")} → ${esc(evLabel(a))}</a><br><span class="muted">${fmtD(a.created_at)}</span></div>`).join("") : `<p class="muted">Belum ada aktivitas. <a class="price" href="layanan.html">Pesan layanan →</a></p>`}</div>`;
    },
    async pesanan(id) {
      if (!id) return listPage(false, await Orders.list());
      const d = await orderBundle(id); C._d = d;
      if (!d) return `<p>Pesanan tidak ditemukan.</p>`;
      const { o, events, files, revisions } = d;
      const briefs = files.filter((f) => f.kind === "brief"), dels = files.filter((f) => f.kind === "delivery");
      const left = o.rev_limit - o.rev_used, open = !CLOSED.includes(o.order_status);
      const canPay = o.order_status === "awaiting_payment" && ["pending_payment", "payment_rejected"].includes(o.payment_status);
      const payBox = o.order_status !== "awaiting_payment" ? "" : canPay
        ? `<div class="actions"><a class="btn sm dark" href="bayar.html?id=${o.id}">${o.payment_status === "payment_rejected" ? "Unggah Ulang Bukti" : "Bayar Sekarang"}</a><button class="btn sm red" id="cancel">Batalkan</button></div>`
        : `<p class="note">Bukti pembayaran berhasil dikirim. Pembayaran Anda sedang diperiksa oleh admin.</p>`;
      return `<a class="muted" href="#pesanan">← Semua pesanan</a><h2 style="margin-top:8px">${o.id} ${badge(o.order_status)}</h2>
        <div class="two"><div class="panel" style="margin:0"><h3 style="margin-top:0">Detail pesanan</h3>${orderInfo(o)}${payBox}</div>
        <div class="panel" style="margin:0"><h3 style="margin-top:0">Progres & riwayat pembayaran</h3>${timeline(events)}</div></div>
        <div class="two"><div class="panel"><h3 style="margin-top:0">File brief & referensi</h3>${fileList(briefs)}${open ? uploadForm("upb", "Unggah") : ""}</div>
        <div class="panel"><h3 style="margin-top:0">Hasil pekerjaan</h3>${dels.length ? fileList(dels) : `<p class="muted" style="font-size:14px">Hasil akan muncul di sini saat dikirim tim Fokuz.</p>`}</div></div>
        <div class="panel"><h3 style="margin-top:0">Revisi <span class="muted" style="font-weight:400">• sisa ${left} dari ${o.rev_limit}</span></h3>
          ${revisions.map((r, i) => `<div class="note"><b>Revisi #${i + 1}</b> <span class="muted">${fmtD(r.created_at)}</span><br>${esc(r.text)}${r.response ? `<br><br><b>Tanggapan Fokuz:</b> ${esc(r.response)}` : `<br><span class="muted">Menunggu tanggapan…</span>`}</div>`).join("")}
          ${o.order_status === "customer_review" ? `<p style="margin-top:12px;font-size:14px">Hasil sudah dikirim. Puas? Terima hasil, atau minta revisi.</p>
            ${left > 0 ? `<textarea id="revtxt" rows="3" maxlength="1000" placeholder="Jelaskan bagian yang perlu direvisi..."></textarea>` : `<p class="muted">Jatah revisi sudah habis.</p>`}
            <div class="actions"><button class="btn sm dark" id="accept">✓ Terima Hasil</button>${left > 0 ? `<button class="btn sm" id="rev">Minta Revisi</button>` : ""}</div>` : ""}</div>`;
    },
    _pesanan(id) {
      if (!id) return bindList(false);
      const d = C._d; if (!d) return;
      const o = d.o;
      bindFiles(d.files); bindUpload("upb", o.id, "brief");
      const on = (s, fn, ok) => { const el = $(s); if (el) el.onclick = act(fn, ok); };
      on("#cancel", () => (confirm("Batalkan pesanan ini?") ? Orders.transition(o.id, "cancelled", "Dibatalkan pelanggan") : false), "Pesanan dibatalkan");
      on("#accept", () => Orders.transition(o.id, "completed", "Hasil diterima pelanggan"), "Terima kasih! Pesanan selesai.");
      on("#rev", () => Orders.requestRevision(o.id, val("revtxt")), "Permintaan revisi terkirim");
    },
    async notifikasi() {
      const list = await Notifs.mine();
      if (list.some((n) => !n.read)) Notifs.readAll().then(() => setTimeout(() => { const d = $("#side .dot"); if (d) d.remove(); renderHeader(0); }, 400)).catch(() => {});
      return `<h2>Notifikasi</h2><div class="panel">${list.length ? list.map((n) => `<div class="notif ${n.read ? "" : "new"}">${n.order_id ? `<a href="#pesanan/${n.order_id}">` : ""}${esc(n.text)}${n.order_id ? "</a>" : ""}<br><span class="muted" style="font-weight:400">${fmtD(n.created_at)}</span></div>`).join("") : `<p class="muted">Belum ada notifikasi.</p>`}</div>`;
    },
    profil() {
      return `<h2>Profil & Akun</h2><div class="two">
        <form class="panel" style="margin:0" id="pf"><h3 style="margin-top:0">Profil</h3><label>Nama<input name="name" value="${esc(U.name)}" maxlength="100" required></label>
          <label>Email<input value="${esc(U.email)}" disabled></label><label>No. WhatsApp<input name="phone" value="${esc(U.phone)}" maxlength="20"></label><br><button class="btn dark">Simpan</button></form>
        <form class="panel" style="margin:0" id="pw"><h3 style="margin-top:0">Ganti kata sandi</h3><label>Kata sandi lama<input type="password" name="old" required></label>
          <label>Kata sandi baru<input type="password" name="new" minlength="6" required></label><br><button class="btn dark">Ganti</button></form></div>`;
    },
    _profil() {
      $("#pf").onsubmit = act(async (e) => { const f = new FormData(e.target); await Auth.updateProfile(f.get("name"), f.get("phone")); await loadMe(); Object.assign(U, ME); renderHeader(0); }, "Profil disimpan");
      $("#pw").onsubmit = act(async (e) => { const f = new FormData(e.target); await Auth.changePassword(f.get("old"), f.get("new")); }, "Kata sandi diganti");
    },
    async bantuan() {
      const mine = await Tickets.list();
      return `<h2>Bantuan</h2><div class="two"><div class="panel" style="margin:0"><h3 style="margin-top:0">Dokumen</h3>
        <p><a class="price" href="syarat.html">Syarat & Ketentuan →</a></p><p><a class="price" href="privasi.html">Kebijakan Privasi →</a></p><p><a class="price" href="faq.html">FAQ →</a></p></div>
        <form class="panel" style="margin:0" id="tk"><h3 style="margin-top:0">Hubungi tim Fokuz</h3><label>Subjek<input name="s" maxlength="120" required></label>
          <label>Pesan<textarea name="m" rows="4" maxlength="1000" required></textarea></label><br><button class="btn dark">Kirim</button></form></div>
        <div class="panel"><h3 style="margin-top:0">Tiket saya</h3>${mine.length ? mine.map((t) => `<div class="note"><b>${esc(t.subject)}</b> <span class="st">${esc(t.status)}</span><br>${esc(t.msg)}${t.reply ? `<br><br><b>Balasan:</b> ${esc(t.reply)}` : ""}</div>`).join("") : `<p class="muted">Belum ada tiket.</p>`}</div>`;
    },
    _bantuan() { $("#tk").onsubmit = act(async (e) => { const f = new FormData(e.target); await Tickets.create(f.get("s"), f.get("m")); }, "Pesan terkirim"); },
  };

  // =====================================================================
  // ADMIN
  // =====================================================================
  const A = {
    async ringkasan() {
      const all = await Orders.list();
      const c = (f) => all.filter(f).length;
      return `<h2>Ringkasan Operasional</h2><div class="stats">
        <div class="stat"><b>${c((o) => o.payment_status === "awaiting_verification")}</b><span>Bukti bayar perlu diperiksa</span></div>
        <div class="stat"><b>${c((o) => o.order_status === "awaiting_payment" && o.payment_status === "pending_payment")}</b><span>Belum dibayar</span></div>
        <div class="stat"><b>${c((o) => o.order_status === "queued")}</b><span>Antrean pengerjaan</span></div>
        <div class="stat"><b>${c((o) => ACTIVE.includes(o.order_status) && o.order_status !== "queued")}</b><span>Proyek aktif</span></div>
        <div class="stat"><b style="color:#B03A3A">${c(Orders.overdue)}</b><span>Terlambat</span></div>
        <div class="stat"><b>${c((o) => o.order_status === "completed")}</b><span>Selesai</span></div></div>
        ${Auth.can(U, "payments") && c((o) => o.payment_status === "awaiting_verification") ? `<div class="panel pay-alert"><b>Ada pembayaran yang menunggu verifikasi.</b> <a class="price" href="#pembayaran">Buka Verifikasi Pembayaran →</a></div>` : ""}
        <div class="panel"><h3 style="margin-top:0">Perlu tindakan</h3>${orderTable(all.filter((o) => o.payment_status === "awaiting_verification" || ["queued", "revision_requested"].includes(o.order_status) || Orders.overdue(o)), true)}</div>
        <div class="panel"><h3 style="margin-top:0">Pesanan terbaru</h3>${orderTable(all.slice(0, 8), true)}</div>`;
    },
    async pesanan(id) {
      if (!id) return listPage(true, await Orders.list());
      const d = await orderBundle(id); A._d = d;
      if (!d) return `<p>Pesanan tidak ditemukan.</p>`;
      const { o, events, files, revisions } = d;
      const [custList, workers] = await Promise.all([Admin.profiles(), Admin.workers()]);
      const cust = custList.find((u) => u.id === o.user_id) || {};
      const next = nextSteps(o);
      const canRefund = Auth.isAdmin(U) && o.payment_status === "paid" && ["queued", "processing"].includes(o.order_status);
      const canDeliver = o.payment_status === "paid" && ["processing", "revision_in_progress"].includes(o.order_status);
      const waitMsg = o.order_status === "awaiting_payment"
        ? (o.payment_status === "awaiting_verification" ? `Bukti pembayaran menunggu verifikasi. ${Auth.can(U, "payments") ? `<a class="price" href="#pembayaran/${o.id}">Periksa sekarang →</a>` : "Hanya admin yang dapat memverifikasi."}` : "Menunggu pembayaran dari pelanggan. Pesanan baru bisa dikerjakan setelah admin menyetujui bukti pembayaran.")
        : o.order_status === "customer_review" ? "Menunggu pelanggan menerima hasil atau meminta revisi." : "Tidak ada perubahan status yang tersedia.";
      return `<a class="muted" href="#pesanan">← Semua pesanan</a><h2 style="margin-top:8px">${o.id} ${badge(o.order_status)}${late(o)}</h2>
        <div class="two"><div class="panel" style="margin:0"><h3 style="margin-top:0">Detail</h3>${orderInfo(o)}
          ${Auth.can(U, "payments") ? `<div class="actions"><a class="btn sm" href="#pembayaran/${o.id}">Lihat pembayaran & bukti</a></div>` : ""}</div>
          <div class="panel" style="margin:0"><h3 style="margin-top:0">Pelanggan</h3><div class="kv"><div><span class="muted">Nama</span><b>${esc(cust.name || o.customer_name)}</b></div>
            <div><span class="muted">Email</span><b>${esc(cust.email || "—")}</b></div><div><span class="muted">WhatsApp</span><b>${esc(cust.phone || "—")}</b></div></div>
            <h3>Tugaskan ke pekerja</h3><div class="actions" style="margin:0"><select id="wk" style="flex:1;margin:0"><option value="">— Belum ditugaskan —</option>${workers.map((w) => `<option ${w.name === o.worker ? "selected" : ""}>${esc(w.name)}</option>`).join("")}</select><button class="btn sm" id="assign">Simpan</button></div></div></div>
        <div class="panel"><h3 style="margin-top:0">Ubah status pengerjaan</h3>${next.length || canRefund ? `<input id="note" placeholder="Catatan untuk pelanggan (opsional)" maxlength="300">
          <div class="actions">${next.map((k) => `<button class="btn sm ${k === "cancelled" ? "red" : "dark"}" data-to="${k}">→ ${STATUS[k]}</button>`).join("")}${canRefund ? `<button class="btn sm red" id="refund">→ Refund</button>` : ""}</div>
          ${["processing", "revision_in_progress"].includes(o.order_status) ? `<p class="muted" style="font-size:13px;margin-top:8px">Tip: mengunggah hasil di bawah otomatis mengubah status ke "Menunggu Review Pelanggan".</p>` : ""}`
          : `<p class="muted">${waitMsg}</p>`}</div>
        <div class="two"><div class="panel"><h3 style="margin-top:0">File dari pelanggan</h3>${fileList(files.filter((f) => f.kind === "brief"))}</div>
          <div class="panel"><h3 style="margin-top:0">Hasil akhir</h3>${fileList(files.filter((f) => f.kind === "delivery"))}${canDeliver ? uploadForm("upd", "Kirim ke Pelanggan") : `<p class="muted" style="font-size:13px">Upload hasil tersedia saat status "Sedang Dikerjakan" atau "Revisi Dikerjakan".</p>`}</div></div>
        <div class="panel"><h3 style="margin-top:0">Permintaan revisi <span class="muted" style="font-weight:400">• ${o.rev_used}/${o.rev_limit}</span></h3>
          ${revisions.length ? revisions.map((r, i) => `<div class="note"><b>Revisi #${i + 1}</b> <span class="muted">${fmtD(r.created_at)}</span><br>${esc(r.text)}
            ${r.response ? `<br><br><b>Tanggapan:</b> ${esc(r.response)}` : `<textarea data-rv="${r.id}" rows="2" maxlength="1000" placeholder="Tulis tanggapan..." style="background:#fff"></textarea><button class="btn sm dark" data-rs="${r.id}" style="margin-top:8px">Kirim tanggapan & mulai revisi</button>`}</div>`).join("") : `<p class="muted">Belum ada revisi.</p>`}</div>
        <div class="panel"><h3 style="margin-top:0">Jejak audit (pengerjaan & pembayaran)</h3>${timeline(events)}</div>`;
    },
    _pesanan(id) {
      if (!id) return bindList(true);
      const d = A._d; if (!d) return;
      const o = d.o;
      bindFiles(d.files);
      bindUpload("upd", o.id, "delivery", "Hasil terkirim ke pelanggan");
      $("#assign").onclick = act(() => Orders.assign(o.id, val("wk")), "Penugasan disimpan");
      main.querySelectorAll("[data-to]").forEach((b) => (b.onclick = act(() => {
        const to = b.dataset.to; if (to === "cancelled" && !confirm(`Yakin batalkan pesanan ini?`)) return false;
        return Orders.transition(o.id, to, val("note"));
      }, "Status diperbarui")));
      const rf = $("#refund"); if (rf) rf.onclick = act(() => (confirm("Yakin kembalikan dana pesanan ini?") ? Pay.refund(o.id, val("note")) : false), "Refund dicatat");
      main.querySelectorAll("[data-rs]").forEach((b) => (b.onclick = act(() => Orders.respondRevision(b.dataset.rs, main.querySelector(`[data-rv="${b.dataset.rs}"]`).value), "Tanggapan terkirim")));
    },

    // ----- VERIFIKASI PEMBAYARAN -----
    async pembayaran(id) {
      if (!id) {
        const [orders, proofs] = await Promise.all([Orders.list(), Pay.proofs()]);
        A._pay = { orders, proofs };
        return `<h2>Verifikasi Pembayaran</h2><p class="muted">Periksa bukti pembayaran, lalu setujui atau tolak. Pesanan baru masuk antrean pengerjaan setelah pembayaran disetujui.</p>
          <div class="panel"><div class="filters"><input id="pq" placeholder="Cari nomor pesanan (mis. FKZ-...)"><select id="ps">${opts(PAY_STATUS, "awaiting_verification", "Semua status pembayaran")}</select></div><div id="pt"></div></div>`;
      }
      const o = await Orders.get(id);
      if (!o) return `<p>Pesanan tidak ditemukan.</p>`;
      const [proofs, events, custList] = await Promise.all([Pay.proofs(id), Orders.events(id), Admin.profiles()]);
      const cust = custList.find((u) => u.id === o.user_id) || {};
      const pending = proofs.find((p) => p.status === "pending");
      const url = pending ? await Pay.proofUrl(pending.storage_path).catch(() => null) : null;
      A._pd = { o, pending };
      const pst = { pending: "Menunggu diperiksa", approved: "Disetujui", rejected: "Ditolak" };
      return `<a class="muted" href="#pembayaran">← Semua pembayaran</a><h2 style="margin-top:8px">Pembayaran ${o.id} ${pbadge(o.payment_status)}</h2>
        <div class="two"><div class="panel" style="margin:0"><h3 style="margin-top:0">Ringkasan tagihan</h3><div class="kv">
          <div><span class="muted">No. Pesanan</span><b><a class="price" href="#pesanan/${o.id}">${o.id}</a></b></div>
          <div><span class="muted">Pelanggan</span><b>${esc(cust.name || o.customer_name)}<br><span class="muted" style="font-weight:400">${esc(cust.email || "")}</span></b></div>
          <div><span class="muted">Layanan</span><b>${esc(o.service_title)} — ${esc(o.package_name)}</b></div>
          <div><span class="muted">Nominal tagihan</span><b class="price">${rupiah(o.price)}</b></div>
          <div><span class="muted">Metode</span><b>${esc(o.payment_method_name || "Belum dipilih")}</b></div>
          <div><span class="muted">Status pengerjaan</span><b>${badge(o.order_status)}</b></div>
          ${o.verified_at ? `<div><span class="muted">Diputuskan</span><b>${fmtD(o.verified_at)}</b></div>` : ""}</div>
          ${o.rejection_reason && o.payment_status === "payment_rejected" ? `<div class="note pay-alert-inline"><b>Alasan penolakan terakhir:</b> ${esc(o.rejection_reason)}</div>` : ""}</div>
        <div class="panel" style="margin:0"><h3 style="margin-top:0">Bukti yang menunggu diperiksa</h3>
          ${pending ? `<div class="proof-view">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="Bukti pembayaran ${o.id}"></a>` : `<p class="muted">Bukti tidak dapat ditampilkan.</p>`}</div>
            <p class="muted" style="font-size:13px">Diunggah ${fmtD(pending.uploaded_at)} • ${esc(pending.method_name)} • ${kb(pending.size_bytes)} • Nominal tagihan saat upload: ${rupiah(pending.amount)}<br>Tautan bukti berlaku 2 menit. <a class="price" href="#" id="reopen">Buka ulang</a></p>
            <p class="note" style="font-size:13px">Cocokkan nominal, nama penerima, dan waktu transaksi dengan mutasi rekening / dashboard QRIS sebelum menyetujui.</p>
            <div class="actions"><button class="btn dark" id="approve">✓ Setujui Pembayaran</button></div>
            <form id="rejectf" style="margin-top:14px"><label>Alasan penolakan (wajib)<textarea name="r" id="reason" rows="2" maxlength="500" placeholder="Mis. nominal tidak sesuai, bukti buram, transaksi tidak ditemukan"></textarea></label>
              <button class="btn red" style="margin-top:8px" id="reject">Tolak Pembayaran</button></form>`
          : `<p class="muted">${o.payment_status === "paid" ? "Pembayaran sudah disetujui." : o.payment_status === "payment_rejected" ? "Bukti terakhir ditolak. Menunggu pelanggan mengunggah bukti baru." : o.payment_status === "refunded" ? "Dana sudah dikembalikan." : "Pelanggan belum mengirim bukti pembayaran."}</p>`}</div></div>
        <div class="panel"><h3 style="margin-top:0">Semua bukti pembayaran</h3>${proofs.length ? `<div class="scroll"><table class="tbl"><tr><th>Diunggah</th><th>Metode</th><th>Ukuran</th><th>Status</th><th>Catatan</th><th></th></tr>
          ${proofs.map((p) => `<tr><td>${fmtD(p.uploaded_at)}</td><td>${esc(p.method_name)}</td><td>${kb(p.size_bytes)}</td><td><span class="st st-proof-${p.status}">${pst[p.status]}</span>${p.reviewed_at ? `<br><span class="muted">${fmtD(p.reviewed_at)}</span>` : ""}</td><td>${esc(p.rejection_reason || "—")}</td><td><button class="btn sm ghost" data-view="${esc(p.storage_path)}">Lihat</button></td></tr>`).join("")}</table></div>` : `<p class="muted">Belum ada bukti.</p>`}</div>
        <div class="panel"><h3 style="margin-top:0">Riwayat status pembayaran</h3>${timeline(events, "payment")}</div>`;
    },
    _pembayaran(id) {
      if (!id) {
        const { orders, proofs } = A._pay;
        const lastProof = (oid) => proofs.find((p) => p.order_id === oid);
        const draw = () => {
          const qv = val("pq").trim().toUpperCase(), s = val("ps");
          const list = orders.filter((o) => (!s || o.payment_status === s) && (!qv || o.id.toUpperCase().includes(qv)))
            .sort((a, b) => new Date(lastProof(b.id)?.uploaded_at || b.created_at) - new Date(lastProof(a.id)?.uploaded_at || a.created_at));
          $("#pt").innerHTML = list.length ? `<div class="scroll"><table class="tbl"><tr><th>No. Pesanan</th><th>Pelanggan</th><th>Layanan</th><th>Nominal</th><th>Metode</th><th>Waktu upload</th><th>Status</th></tr>
            ${list.map((o) => `<tr class="click" onclick="go('pembayaran/${o.id}')"><td><b>${o.id}</b></td><td>${esc(o.customer_name)}</td><td>${esc(o.service_title)}<br><span class="muted">${esc(o.package_name)}</span></td><td>${rupiah(o.price)}</td><td>${esc(o.payment_method_name || "—")}</td><td>${fmtD(lastProof(o.id)?.uploaded_at)}</td><td>${pbadge(o.payment_status)}</td></tr>`).join("")}</table></div>`
            : `<p class="muted">Tidak ada pembayaran yang cocok.</p>`;
        };
        $("#pq").oninput = draw; $("#ps").onchange = draw; draw();
        return;
      }
      const { o, pending } = A._pd || {};
      main.querySelectorAll("[data-view]").forEach((b) => (b.onclick = async () => {
        const w = window.open("", "_blank");
        try { const u = await Pay.proofUrl(b.dataset.view); if (w) w.location = u; else location.href = u; } catch (e) { if (w) w.close(); toast(e.message); }
      }));
      const re = $("#reopen"); if (re) re.onclick = (e) => { e.preventDefault(); render(); };
      if (!pending) return;
      $("#approve").onclick = act(() => (confirm(`Setujui pembayaran ${o.id} sebesar ${rupiah(o.price)}? Pesanan akan masuk antrean pengerjaan.`) ? Pay.approve(o.id) : false), "Pembayaran disetujui");
      $("#rejectf").onsubmit = act(async () => {
        const r = val("reason").trim();
        if (r.length < 5) throw new Error("Alasan penolakan wajib diisi (minimal 5 karakter).");
        await Pay.reject(o.id, r);
      }, "Bukti pembayaran ditolak");
    },

    // ----- METODE PEMBAYARAN -----
    async metode() {
      const list = await Pay.methods();
      const urls = await Promise.all(list.map((m) => (m.kind === "qris" ? Pay.qrisUrl(m).catch(() => null) : null)));
      A._methods = list;
      return `<h2>Metode Pembayaran</h2><p class="muted">Pelanggan hanya bisa memilih metode yang <b>aktif dan lengkap</b>. Gunakan gambar QRIS resmi dari bank/penyedia pembayaranmu dan detail rekening yang benar.</p>
        ${list.map((m, i) => { const ok = Pay.ready(m); return `<form class="panel" data-m="${m.id}"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">
          <div><b>${esc(m.name)}</b> <span class="muted">• ${m.kind === "qris" ? "QRIS" : "Transfer bank"}</span> ${ok ? `<span class="st st-paid">Tampil ke pelanggan</span>` : `<span class="st st-pending_payment">${m.active ? "Belum lengkap" : "Nonaktif"}</span>`}</div>
          <button type="button" class="btn sm red" data-delm="${m.id}">Hapus</button></div>
          <div class="two" style="margin-top:6px"><label>Nama metode<input name="name" value="${esc(m.name)}" maxlength="60" required></label>
            <label>Urutan tampil<input name="sort" type="number" value="${m.sort}" min="0"></label></div>
          ${m.kind === "qris" ? `<div class="qris-admin"><div>${urls[i] ? `<img src="${esc(urls[i])}" alt="QRIS ${esc(m.name)} saat ini">` : `<p class="muted">Belum ada gambar QRIS resmi.</p>`}</div>
            <label>Unggah gambar QRIS resmi (PNG/JPG/WEBP, maks 2 MB)<input type="file" name="qris" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"></label></div>`
          : `<div class="stats" style="margin-top:0"><label>Nama bank<input name="bank_name" value="${esc(m.bank_name)}" maxlength="60"></label>
            <label>No. rekening<input name="account_number" value="${esc(m.account_number)}" maxlength="40" inputmode="numeric"></label>
            <label>Atas nama<input name="account_holder" value="${esc(m.account_holder)}" maxlength="80"></label></div>`}
          <label>Instruksi untuk pelanggan<textarea name="instructions" rows="2" maxlength="600">${esc(m.instructions)}</textarea></label>
          <label style="font-weight:400;display:flex;gap:8px;align-items:center"><input type="checkbox" name="active" ${m.active ? "checked" : ""} style="width:auto;margin:0"> Aktifkan (tampilkan ke pelanggan)</label>
          <div class="actions"><button class="btn sm dark">Simpan</button></div></form>`; }).join("")}
        <form class="panel" id="nm"><h3 style="margin-top:0">Tambah metode</h3><div class="two"><label>Nama<input name="name" required maxlength="60" placeholder="Mis. Transfer BCA"></label>
          <label>Jenis<select name="kind"><option value="bank">Transfer bank</option><option value="qris">QRIS</option></select></label></div>
          <p class="muted" style="font-size:13px;margin-top:8px">Metode baru dibuat nonaktif. Lengkapi datanya lalu aktifkan.</p><button class="btn dark" style="margin-top:8px">Tambah</button></form>`;
    },
    _metode() {
      main.querySelectorAll("form[data-m]").forEach((f) => (f.onsubmit = act(async () => {
        const id = f.dataset.m, m = A._methods.find((x) => x.id === id), fd = new FormData(f);
        const file = fd.get("qris");
        if (file && file.size) await Pay.uploadQris(id, file);
        const patch = { name: fd.get("name"), sort: Math.max(0, +fd.get("sort") || 0), instructions: String(fd.get("instructions") || "").trim(), active: fd.get("active") === "on" };
        if (m.kind === "bank") Object.assign(patch, { bank_name: String(fd.get("bank_name")).trim(), account_number: String(fd.get("account_number")).trim(), account_holder: String(fd.get("account_holder")).trim() });
        await Pay.saveMethod(id, patch);
      }, "Metode pembayaran disimpan")));
      main.querySelectorAll("[data-delm]").forEach((b) => (b.onclick = act(() => (confirm("Hapus metode ini? Pesanan lama tetap menyimpan nama metodenya.") ? Pay.removeMethod(b.dataset.delm) : false), "Metode dihapus")));
      $("#nm").onsubmit = act(async (e) => { const f = new FormData(e.target); await Pay.addMethod({ name: f.get("name"), kind: f.get("kind"), active: false, sort: A._methods.length + 1 }); }, "Metode ditambahkan");
    },

    // ----- KATALOG -----
    async layanan() {
      const list = await Catalog.list(); A._cat = list;
      return `<h2>Katalog & Paket</h2><p class="muted">Atur harga, estimasi hari kerja, dan batas revisi. Harga pesanan baru selalu diambil dari sini oleh server.</p>
        ${list.map((s, si) => `<div class="panel"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><span class="tag ${s.cat}">${esc(CATEGORIES[s.cat]?.name || s.cat)}</span> <b>${esc(s.title)}</b></div>
          <button class="btn sm red" data-del="${si}">Hapus layanan</button></div><div class="scroll"><table class="tbl" style="margin-top:10px"><tr><th>Paket</th><th>Harga (Rp)</th><th>Hari</th><th>Revisi</th><th></th></tr>
          ${s.packages.map((p, pi) => `<tr><td><input data-k="${si}.${pi}.name" value="${esc(p.name)}"></td><td><input type="number" min="0" data-k="${si}.${pi}.price" value="${p.price}"></td>
            <td><input type="number" min="1" data-k="${si}.${pi}.days" value="${p.days}"></td><td><input type="number" min="0" data-k="${si}.${pi}.rev" value="${p.rev}"></td>
            <td>${s.packages.length > 1 ? `<button class="btn sm ghost" data-delp="${si}.${pi}">✕</button>` : ""}</td></tr>`).join("")}</table></div>
          <div class="actions"><button class="btn sm dark" data-save="${si}">Simpan</button><button class="btn sm ghost" data-addp="${si}">+ Paket</button></div></div>`).join("")}
        <form class="panel" id="ns"><h3 style="margin-top:0">Tambah layanan baru</h3><div class="two"><label>Judul<input name="t" required maxlength="100"></label>
          <label>Kategori<select name="c">${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}">${c.name}</option>`).join("")}</select></label></div>
          <label>Ringkasan<input name="s" required maxlength="200"></label><div class="stats" style="margin-top:0"><label>Harga<input type="number" name="p" min="0" required></label>
          <label>Hari kerja<input type="number" name="d" min="1" value="2" required></label><label>Revisi<input type="number" name="r" min="0" value="1" required></label></div>
          <br><button class="btn dark">Tambah</button></form>`;
    },
    _layanan() {
      const list = A._cat;
      const read = (si) => main.querySelectorAll(`[data-k^="${si}."]`).forEach((inp) => { const [, pi, k] = inp.dataset.k.split("."); list[si].packages[pi][k] = k === "name" ? inp.value.trim() || "Paket" : Math.max(0, Math.round(+inp.value || 0)); });
      main.querySelectorAll("[data-save]").forEach((b) => (b.onclick = act(() => { read(+b.dataset.save); return Catalog.save(list[+b.dataset.save]); }, "Disimpan")));
      main.querySelectorAll("[data-addp]").forEach((b) => (b.onclick = act(() => { const s = list[+b.dataset.addp]; read(+b.dataset.addp); s.packages.push({ name: "Baru", price: 10000, days: 2, rev: 1, features: [] }); return Catalog.save(s); })));
      main.querySelectorAll("[data-delp]").forEach((b) => (b.onclick = act(() => { const [si, pi] = b.dataset.delp.split(".").map(Number); read(si); list[si].packages.splice(pi, 1); return Catalog.save(list[si]); })));
      main.querySelectorAll("[data-del]").forEach((b) => (b.onclick = act(() => (confirm("Hapus layanan ini?") ? Catalog.remove(list[+b.dataset.del].slug) : false), "Layanan dihapus")));
      $("#ns").onsubmit = act(async (e) => {
        const f = new FormData(e.target), t = f.get("t").trim();
        const slug = t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
        await Catalog.add({ slug, title: t, cat: f.get("c"), summary: f.get("s").trim(), sort: list.length + 1, packages: [{ name: "Standar", price: Math.round(+f.get("p")), days: +f.get("d"), rev: +f.get("r"), features: [] }] });
      }, "Layanan ditambahkan");
    },

    async pelanggan() {
      const [users, roles, orders] = await Promise.all([Admin.profiles(), Admin.roles(), Orders.list()]);
      const staffIds = new Set(roles.map((r) => r.user_id));
      const cs = users.filter((u) => !staffIds.has(u.id));
      return `<h2>Pelanggan</h2><div class="panel scroll">${cs.length ? `<table class="tbl"><tr><th>Nama</th><th>Email</th><th>WhatsApp</th><th>Pesanan</th><th>Total belanja</th><th>Bergabung</th><th></th></tr>
        ${cs.map((u) => { const mine = orders.filter((o) => o.user_id === u.id); const spent = mine.filter((o) => o.payment_status === "paid").reduce((a, o) => a + o.price, 0);
          return `<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td>${esc(u.phone || "—")}</td><td>${mine.length}</td><td>${rupiah(spent)}</td><td>${fmtD(u.created_at)}</td>
          <td><button class="btn sm ${u.disabled ? "" : "red"}" data-tg="${u.id}" data-on="${u.disabled ? "0" : "1"}">${u.disabled ? "Aktifkan" : "Nonaktifkan"}</button></td></tr>`; }).join("")}</table>` : `<p class="muted">Belum ada pelanggan terdaftar.</p>`}</div>`;
    },
    _pelanggan() { main.querySelectorAll("[data-tg]").forEach((b) => (b.onclick = act(() => Admin.setDisabled(b.dataset.tg, b.dataset.on === "1"), "Status akun diperbarui"))); },

    async dukungan() {
      const ts = await Tickets.list();
      return `<h2>Pertanyaan & Dukungan</h2>${ts.length ? ts.map((t) => `<div class="panel"><b>${esc(t.subject)}</b> <span class="st">${esc(t.status)}</span><br>
        <span class="muted">${esc(t.name)} • ${esc(t.email)} • ${fmtD(t.created_at)}</span><p style="margin-top:8px">${esc(t.msg)}</p>
        ${t.reply ? `<div class="note"><b>Balasan:</b> ${esc(t.reply)}</div>` : `<textarea data-rt="${t.id}" rows="2" maxlength="1000" placeholder="Tulis balasan..."></textarea><button class="btn sm dark" data-rb="${t.id}" style="margin-top:8px">Balas</button>`}</div>`).join("") : `<div class="panel"><p class="muted">Belum ada pertanyaan masuk.</p></div>`}`;
    },
    _dukungan() { main.querySelectorAll("[data-rb]").forEach((b) => (b.onclick = act(() => Tickets.reply(b.dataset.rb, main.querySelector(`[data-rt="${b.dataset.rb}"]`).value), "Balasan terkirim"))); },

    async laporan() {
      const orders = await Orders.list();
      const sold = orders.filter((o) => o.payment_status === "paid" || o.payment_status === "refunded");
      const gross = sold.reduce((a, o) => a + o.price, 0);
      const refunded = orders.filter((o) => o.payment_status === "refunded"), refundAmt = refunded.reduce((a, o) => a + o.price, 0);
      const by = {}; sold.forEach((o) => { by[o.service_title] = by[o.service_title] || { n: 0, sum: 0 }; by[o.service_title].n++; by[o.service_title].sum += o.price; });
      return `<h2>Laporan Penjualan</h2><p class="muted">Hanya menghitung pembayaran yang sudah disetujui admin.</p><div class="stats">
        <div class="stat"><b>${rupiah(gross)}</b><span>Penjualan kotor</span></div><div class="stat"><b>${rupiah(gross - refundAmt)}</b><span>Penjualan bersih</span></div>
        <div class="stat"><b>${orders.filter((o) => o.order_status === "completed").length}</b><span>Pesanan selesai</span></div>
        <div class="stat"><b>${orders.filter((o) => o.order_status === "cancelled").length}</b><span>Dibatalkan</span></div>
        <div class="stat"><b>${refunded.length} • ${rupiah(refundAmt)}</b><span>Refund</span></div></div>
        <div class="panel scroll"><h3 style="margin-top:0">Per layanan</h3>${Object.keys(by).length ? `<table class="tbl"><tr><th>Layanan</th><th>Terjual</th><th>Pendapatan</th></tr>${Object.entries(by).sort((a, b) => b[1].sum - a[1].sum).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.n}</td><td>${rupiah(v.sum)}</td></tr>`).join("")}</table>` : `<p class="muted">Belum ada penjualan.</p>`}</div>`;
    },

    async tim() {
      const [workers, users, roles] = await Promise.all([Admin.workers(), Admin.profiles(), Admin.roles()]);
      const roleOf = (id) => (roles.some((r) => r.user_id === id && r.role === "admin") ? "admin" : roles.some((r) => r.user_id === id) ? "staff" : null);
      const staff = users.filter((u) => roleOf(u.id));
      return `<h2>Tim & Pekerja</h2><div class="two"><div class="panel" style="margin:0"><h3 style="margin-top:0">Pekerja (untuk penugasan)</h3>
        ${workers.map((w) => `<div class="file"><span>${esc(w.name)}</span><button class="btn sm ghost" data-rw="${w.id}">Hapus</button></div>`).join("")}
        <form id="aw" class="actions"><input name="w" placeholder="Nama pekerja" required maxlength="60" style="flex:1;margin:0"><button class="btn sm">Tambah</button></form></div>
        <div class="panel" style="margin:0"><h3 style="margin-top:0">Akun admin & staf</h3>${staff.map((u) => `<div class="file"><span><b>${esc(u.name)}</b> <span class="muted">${esc(u.email)}</span></span><span class="st">${roleOf(u.id) === "admin" ? "Admin" : "Staf"}</span></div>`).join("")}
          <form id="as"><p class="muted" style="font-size:13px;margin-top:12px">Orangnya harus mendaftar akun biasa dulu di halaman Masuk, lalu atur perannya di sini.</p>
          <label>Email akun<input name="e" type="email" required></label>
          <label>Peran<select name="r"><option value="staff">Staf — pesanan, file, revisi, dukungan</option><option value="admin">Admin — akses penuh termasuk verifikasi pembayaran</option><option value="customer">Cabut peran (jadi pelanggan)</option></select></label><br><button class="btn dark">Simpan peran</button></form></div></div>`;
    },
    _tim() {
      main.querySelectorAll("[data-rw]").forEach((b) => (b.onclick = act(() => Admin.removeWorker(b.dataset.rw))));
      $("#aw").onsubmit = act(async (e) => { await Admin.addWorker(new FormData(e.target).get("w")); });
      $("#as").onsubmit = act(async (e) => { const f = new FormData(e.target); await Admin.setRole(f.get("e"), f.get("r")); }, "Peran disimpan");
    },
  };

  window.addEventListener("hashchange", render);
  render();
});

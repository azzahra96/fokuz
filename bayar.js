// =====================================================================
// FOKUZ — HALAMAN PEMBAYARAN (bayar.html?id=FKZ-...)
// 1) pilih metode → 2) lihat QRIS / instruksi transfer & kirim bukti →
// 3) tunggu verifikasi admin. Nominal selalu diambil dari database.
// =====================================================================
APP_READY.then(async () => {
  const box = $("#pay");
  const id = params.get("id") || "";
  const toast = (t) => { const el = $("#toast"); el.textContent = t; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2600); };
  if (!ME) { location.replace("masuk.html?next=" + encodeURIComponent("bayar.html?id=" + id)); return; }
  if (Auth.isStaff(ME)) { box.innerHTML = `<div class="panel"><p>Kamu masuk sebagai admin. Pembayaran pesanan diverifikasi dari <a class="price" href="admin.html#pembayaran/${esc(id)}">Dashboard Admin → Pembayaran</a>.</p></div>`; return; }

  let order = null, methods = [], step = 1, selected = null, preview = null;
  const load = async () => {
    [order, methods] = await Promise.all([Orders.get(id), Pay.methods()]);
    if (order && !selected && order.payment_method_id) selected = order.payment_method_id;
  };
  try { await load(); } catch (e) { box.innerHTML = `<div class="panel"><p>${esc(e.message)}</p></div>`; return; }

  const steps = (n) => `<ol class="pay-steps">${["Pilih metode", "Bayar & kirim bukti", "Verifikasi admin"]
    .map((t, i) => `<li class="${i + 1 < n ? "done" : i + 1 === n ? "now" : ""}"><span>${i + 1 < n ? "✓" : i + 1}</span>${t}</li>`).join("")}</ol>`;
  const summary = () => `<div class="panel pay-summary"><div class="kv">
      <div><span class="muted">No. Pesanan</span><b>${esc(order.id)}</b></div>
      <div><span class="muted">Layanan</span><b>${esc(order.service_title)} — ${esc(order.package_name)}</b></div>
      <div><span class="muted">Status pembayaran</span><b><span class="st st-${order.payment_status}">${PAY_STATUS[order.payment_status]}</span></b></div>
      <div><span class="muted">Total tagihan</span><b class="price" style="font-size:18px">${rupiah(order.price)}</b></div></div></div>`;
  const back = `<p style="margin-top:16px"><a class="price" href="akun.html#pesanan/${esc(order?.id || "")}">← Lihat detail pesanan di Dashboard</a></p>`;

  async function render() {
    if (!order) { box.innerHTML = `<div class="panel"><h2>Pesanan tidak ditemukan</h2><p class="muted">Pastikan kamu masuk dengan akun yang membuat pesanan ini.</p><br><a class="btn" href="akun.html#pesanan">Pesanan Saya</a></div>`; return; }
    const head = `<a class="muted" href="akun.html#pesanan/${esc(order.id)}">← Pesanan ${esc(order.id)}</a><h1 class="pay-title">Pembayaran Pesanan</h1>`;

    if (order.order_status === "cancelled") { box.innerHTML = head + summary() + `<div class="panel"><p>Pesanan ini sudah dibatalkan, jadi tidak perlu dibayar.</p></div>` + back; return; }
    if (order.payment_status === "paid" || order.payment_status === "refunded") {
      box.innerHTML = head + steps(4) + summary() + `<div class="panel pay-state ok"><div class="ok">✓</div><h3>${order.payment_status === "paid" ? "Pembayaran sudah disetujui admin" : "Dana pesanan ini sudah dikembalikan"}</h3>
        <p class="muted">${order.payment_status === "paid" ? "Diverifikasi " + fmtD(order.verified_at) + ". Status pengerjaan: <b>" + STATUS[order.order_status] + "</b>." : ""}</p></div>` + back;
      return;
    }
    if (order.payment_status === "awaiting_verification") {
      box.innerHTML = head + steps(3) + summary() + `<div class="panel pay-state wait" role="status"><div class="ok">⏳</div>
        <h3>Bukti pembayaran berhasil dikirim. Pembayaran Anda sedang diperiksa oleh admin.</h3>
        <p class="muted">Metode: ${esc(order.payment_method_name)}. Kamu akan mendapat notifikasi setelah admin menyetujui atau menolak bukti. Pesanan mulai dikerjakan setelah pembayaran disetujui.</p></div>` + back;
      return;
    }

    // pending_payment / payment_rejected
    const rejected = order.payment_status === "payment_rejected"
      ? `<div class="panel pay-alert" role="alert"><b>Bukti pembayaran sebelumnya ditolak.</b><br>Alasan dari admin: ${esc(order.rejection_reason || "—")}<br><span class="muted">Silakan periksa kembali, lalu kirim bukti pembayaran yang baru.</span></div>` : "";
    const m = methods.find((x) => x.id === selected);

    if (step === 1 || !m || !Pay.ready(m)) {
      step = 1;
      const ready = methods.filter(Pay.ready);
      box.innerHTML = head + steps(1) + rejected + summary() + `<div class="panel"><h3 style="margin-top:0">Pilih metode pembayaran</h3>
        ${methods.length ? `<div class="pm-list" role="radiogroup" aria-label="Metode pembayaran">${methods.map((x) => {
          const ok = Pay.ready(x);
          return `<label class="pm-opt ${ok ? "" : "off"} ${x.id === selected && ok ? "on" : ""}"><input type="radio" name="pm" value="${x.id}" ${ok ? "" : "disabled"} ${x.id === selected && ok ? "checked" : ""}>
            <span class="pm-ico">${x.kind === "qris" ? "▦" : "🏦"}</span><span><b>${esc(x.name)}</b><br><span class="muted">${ok ? (x.kind === "qris" ? "Scan kode QRIS dengan aplikasi bank / e-wallet" : "Transfer ke rekening " + esc(x.bank_name)) : "Belum tersedia — admin belum mengatur metode ini"}</span></span></label>`;
        }).join("")}</div>` : ""}
        ${ready.length ? "" : `<p class="note">Belum ada metode pembayaran yang tersedia saat ini. Silakan hubungi admin Fokuz melalui menu Bantuan di Dashboard.</p>`}
        <button class="btn dark block" id="next" style="margin-top:16px" ${ready.some((x) => x.id === selected) ? "" : "disabled"}>Lanjutkan Pembayaran</button></div>` + back;
      box.querySelectorAll("input[name=pm]").forEach((r) => (r.onchange = () => { selected = r.value; render(); }));
      $("#next").onclick = async () => {
        const b = $("#next"); b.disabled = true; b.textContent = "Memproses...";
        try { await Pay.choose(order.id, selected); await load(); step = 2; render(); }
        catch (e) { toast(e.message); await load(); render(); }
      };
      return;
    }

    // Langkah 2: QRIS / instruksi transfer + unggah bukti
    const qr = m.kind === "qris" ? await Pay.qrisUrl(m).catch(() => null) : null;
    const how = m.kind === "qris"
      ? `<div class="qris-payment" style="border:0;padding:0;margin:0">${qr ? `<img src="${esc(qr)}" alt="Kode QRIS resmi Fokuz untuk pesanan ${esc(order.id)}" id="qris-image">` : ""}
          <p class="muted" id="qris-unavailable" ${qr ? "hidden" : ""}>Gambar QRIS tidak dapat ditampilkan. Pilih metode lain atau hubungi admin.</p></div>`
      : `<div class="kv bank"><div><span class="muted">Bank</span><b>${esc(m.bank_name)}</b></div>
          <div><span class="muted">No. rekening</span><b><span id="acc">${esc(m.account_number)}</span> <button type="button" class="btn sm ghost" id="copy">Salin</button></b></div>
          <div><span class="muted">Atas nama</span><b>${esc(m.account_holder)}</b></div></div>`;
    box.innerHTML = head + steps(2) + rejected + `<div class="two pay-two">
      <div class="panel" style="margin:0"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h3 style="margin:0">Bayar dengan ${esc(m.name)}</h3><button type="button" class="btn sm ghost" id="change">Ganti metode</button></div>
        <div class="pay-amount"><span class="muted">Nominal yang harus dibayar</span><b>${rupiah(order.price)}</b><span class="muted">Untuk pesanan <b>${esc(order.id)}</b> • ${esc(order.service_title)} — ${esc(order.package_name)}</span></div>
        ${how}
        ${m.instructions ? `<p class="note" style="margin-top:14px">${esc(m.instructions)}</p>` : ""}
        <p class="muted" style="font-size:13px;margin-top:10px">Pastikan nama penerima dan nominal sesuai sebelum membayar.</p></div>
      <form class="panel" style="margin:0" id="proof"><h3 style="margin-top:0">Kirim bukti pembayaran</h3>
        <p class="muted" style="font-size:14px">Unggah tangkapan layar atau foto bukti pembayaran. Format JPG, JPEG, PNG, atau WEBP, maksimal 5 MB.</p>
        <label>File bukti<input type="file" name="f" id="pf" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" required></label>
        <p id="perr" class="pay-err" role="alert"></p>
        <div id="pprev" class="proof-preview" hidden><img alt="Pratinjau bukti pembayaran" id="pimg"><span class="muted" id="pmeta"></span></div>
        <button class="btn dark block" id="send" disabled style="margin-top:14px">Kirim Bukti Pembayaran</button>
        <p class="muted" style="font-size:12px;margin-top:10px">Pembayaran baru dianggap lunas setelah admin memeriksa dan menyetujui bukti ini.</p></form></div>` + back;

    const img = $("#qris-image");
    if (img) img.onerror = () => { img.hidden = true; $("#qris-unavailable").hidden = false; };
    $("#change").onclick = () => { step = 1; render(); };
    const copy = $("#copy");
    if (copy) copy.onclick = () => navigator.clipboard?.writeText(m.account_number).then(() => toast("Nomor rekening disalin"), () => {});
    const pf = $("#pf");
    pf.onchange = () => {
      const file = pf.files[0], err = PayRules.validateProof(file);
      if (preview) { URL.revokeObjectURL(preview); preview = null; }
      $("#perr").textContent = file ? err || "" : "";
      $("#send").disabled = !!err;
      $("#pprev").hidden = !!err;
      if (!err) { preview = URL.createObjectURL(file); $("#pimg").src = preview; $("#pmeta").textContent = `${file.name} • ${(file.size / 1024).toFixed(0)} KB`; }
    };
    $("#proof").onsubmit = async (e) => {
      e.preventDefault();
      const file = pf.files[0], err = PayRules.validateProof(file);
      if (err) { $("#perr").textContent = err; return; }
      const b = $("#send"); b.disabled = true; b.textContent = "Mengirim bukti...";
      try { await Pay.submitProof(order, file); await load(); render(); window.scrollTo(0, 0); }
      catch (e2) { $("#perr").textContent = e2.message; b.disabled = false; b.textContent = "Kirim Bukti Pembayaran"; await load(); if (order.payment_status !== "pending_payment" && order.payment_status !== "payment_rejected") render(); }
    };
  }
  render();
});

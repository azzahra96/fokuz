// =====================================================================
// FOKUZ — aturan pembayaran yang dicek di browser SEBELUM dikirim.
// Server/database mengecek aturan yang sama lagi; file ini hanya agar
// pelanggan langsung tahu kalau file atau metode tidak valid.
// =====================================================================
(function (root) {
  const PROOF_TYPES = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp" };
  const PROOF_EXT = ["jpg", "jpeg", "png", "webp"];
  const PROOF_MAX = 5 * 1024 * 1024; // 5 MB

  // Kembalikan pesan error (string) atau null jika file boleh dikirim.
  function validateProof(file) {
    if (!file || !file.size) return "Pilih file bukti pembayaran terlebih dahulu.";
    const ext = String(file.name || "").split(".").pop().toLowerCase();
    if (!PROOF_TYPES[String(file.type).toLowerCase()] || !PROOF_EXT.includes(ext)) return "Format file harus JPG, JPEG, PNG, atau WEBP.";
    if (file.size > PROOF_MAX) return "Ukuran file maksimal 5 MB.";
    return null;
  }

  // Metode bisa dipakai hanya jika aktif DAN datanya lengkap.
  function methodReady(m) {
    if (!m || !m.active) return false;
    if (m.kind === "qris") return !!(m.qris_path && String(m.qris_path).trim());
    return ["bank_name", "account_number", "account_holder"].every((k) => String(m[k] || "").trim() !== "");
  }

  const api = { validateProof, methodReady, PROOF_MAX, PROOF_EXT };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PayRules = api;
})(typeof window !== "undefined" ? window : globalThis);

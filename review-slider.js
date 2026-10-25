// ===== REVIEW / PORTOFOLIO: slider otomatis (infinite loop) =====
// - Bergerak otomatis dari kanan ke kiri, satu putaran penuh ±38 detik.
// - Berhenti saat kursor di atas slider, saat slider difokus dengan keyboard,
//   saat disentuh/digeser, dan saat tombol Jeda ditekan.
// - Menghormati "prefers-reduced-motion": tidak bergerak otomatis.
// - Kartu duplikat (untuk loop mulus) disembunyikan dari pembaca layar.
(() => {
  const slider = document.getElementById("portfolio-slider");
  if (!slider) return;
  const bar = document.getElementById("slider-progress-bar");
  const toggle = document.getElementById("toggle-work");
  const prevBtn = document.getElementById("prev-work");
  const nextBtn = document.getElementById("next-work");

  const CYCLE_SECONDS = 38; // durasi satu putaran penuh
  const RESUME_DELAY = 1500; // jeda sebelum lanjut setelah digeser / tombol
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const originals = Array.from(slider.children);
  const count = originals.length;
  if (!count) return;

  let step = 0; // lebar satu kartu + jarak
  let setWidth = 0; // lebar satu set kartu asli
  let pos = 0; // posisi scroll (desimal, agar gerakan halus)
  let rafId = 0;
  let lastTime = 0;
  let pendingTarget = null;
  let hovering = false;
  let focused = false;
  let touching = false;
  let holding = false;
  let manualPaused = motion.matches;
  let holdTimer = 0;
  let idleTimer = 0;
  let resizeTimer = 0;

  const measure = () => {
    const gap = parseFloat(getComputedStyle(slider).columnGap) || 0;
    step = originals[0].getBoundingClientRect().width + gap;
    setWidth = step * count;
  };

  // Gandakan kartu secukupnya agar selalu ada kartu di kiri & kanan posisi aktif.
  const neededCopies = () => Math.max(3, 2 + Math.ceil((slider.clientWidth + step * 3) / setWidth));
  let builtCopies = 1;
  const buildClones = () => {
    measure();
    if (!setWidth) return;
    const copies = neededCopies();
    if (copies === builtCopies) return; // jumlah duplikat sudah cukup
    slider.querySelectorAll("[data-clone]").forEach((el) => el.remove());
    builtCopies = copies;
    const frag = document.createDocumentFragment();
    for (let c = 1; c < copies; c++) {
      originals.forEach((card) => {
        const clone = card.cloneNode(true);
        clone.setAttribute("data-clone", "");
        clone.setAttribute("aria-hidden", "true");
        clone.inert = true;
        clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
        clone.querySelectorAll("a,button,input,select,textarea,[tabindex]").forEach((el) => el.setAttribute("tabindex", "-1"));
        frag.appendChild(clone);
      });
    }
    slider.appendChild(frag);
  };

  // Posisi aman selalu berada di set kedua: [setWidth, 2 × setWidth).
  const wrap = (p) => {
    if (!setWidth) return p;
    while (p >= setWidth * 2) p -= setWidth;
    while (p < setWidth - 2) p += setWidth; // toleransi pembulatan piksel
    return p;
  };

  const updateProgress = () => {
    if (!bar || !setWidth) return;
    const frac = (((pos % setWidth) + setWidth) % setWidth) / setWidth;
    bar.style.transform = `scaleX(${Math.max(0.03, frac).toFixed(4)})`;
  };

  const setPos = (p) => {
    pos = p;
    slider.scrollLeft = p;
    updateProgress();
  };

  const shouldPlay = () => !manualPaused && !hovering && !focused && !touching && !holding && setWidth > 0;

  const tick = (time) => {
    if (!lastTime) lastTime = time;
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    let next = pos + (setWidth / CYCLE_SECONDS) * dt;
    if (next >= setWidth * 2) next -= setWidth; // lompat tak terlihat ke set yang identik
    setPos(next);
    rafId = requestAnimationFrame(tick);
  };

  const sync = () => {
    const play = shouldPlay();
    slider.classList.toggle("is-playing", play);
    if (play && !rafId) {
      lastTime = 0;
      if (Math.abs(slider.scrollLeft - pos) > 1.5) pos = wrap(slider.scrollLeft);
      rafId = requestAnimationFrame(tick);
    } else if (!play && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  const hold = () => {
    holding = true;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      holding = false;
      sync();
    }, RESUME_DELAY);
    sync();
  };

  const renderToggle = () => {
    if (!toggle) return;
    const label = manualPaused ? "Putar slider otomatis" : "Jeda slider otomatis";
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
    toggle.classList.toggle("is-paused", manualPaused);
  };

  // Tombol sebelumnya / berikutnya: pindah tepat satu kartu.
  const go = (dir) => {
    if (!step) return;
    let from = pendingTarget ?? pos;
    const shifted = wrap(from);
    const delta = shifted - from;
    if (Math.abs(delta) > 0.5) {
      from = shifted;
      setPos(slider.scrollLeft + delta);
    }
    const index = dir > 0 ? Math.floor(from / step + 0.01) + 1 : Math.ceil(from / step - 0.01) - 1;
    pendingTarget = index * step;
    hold();
    slider.scrollTo({ left: pendingTarget, behavior: motion.matches ? "auto" : "smooth" });
  };

  // Scroll dari pengguna (swipe, trackpad, tombol): ikuti posisinya lalu rapikan saat diam.
  slider.addEventListener(
    "scroll",
    () => {
      if (Math.abs(slider.scrollLeft - pos) <= 1.5 || performance.now() < ignoreUntil) return; // scroll dari autoplay / penyesuaian ukuran
      pos = slider.scrollLeft;
      updateProgress();
      hold();
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (touching) return;
        pendingTarget = null;
        const w = wrap(slider.scrollLeft);
        if (Math.abs(w - slider.scrollLeft) > 0.5) setPos(w);
        else pos = slider.scrollLeft;
      }, 180);
    },
    { passive: true }
  );

  // Pause saat hover (mouse saja, agar tap di HP tidak membuat slider macet).
  slider.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "mouse") { hovering = true; sync(); }
  });
  slider.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") { hovering = false; sync(); }
  });

  // Pause saat menerima fokus keyboard.
  const isKeyboardFocus = () => {
    try { return slider.matches(":focus-visible"); } catch { return true; }
  };
  slider.addEventListener("focusin", () => { focused = isKeyboardFocus(); sync(); });
  slider.addEventListener("focusout", (e) => {
    if (!slider.contains(e.relatedTarget)) { focused = false; sync(); }
  });
  slider.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  });

  // Swipe / sentuh di perangkat mobile.
  slider.addEventListener("touchstart", () => { touching = true; sync(); }, { passive: true });
  const endTouch = () => { touching = false; hold(); };
  slider.addEventListener("touchend", endTouch, { passive: true });
  slider.addEventListener("touchcancel", endTouch, { passive: true });

  prevBtn?.addEventListener("click", () => go(-1));
  nextBtn?.addEventListener("click", () => go(1));
  toggle?.addEventListener("click", () => {
    manualPaused = !manualPaused;
    renderToggle();
    sync();
  });

  const onMotionChange = () => {
    manualPaused = motion.matches;
    renderToggle();
    sync();
  };
  if (motion.addEventListener) motion.addEventListener("change", onMotionChange);
  else if (motion.addListener) motion.addListener(onMotionChange);

  // Hitung ulang saat ukuran layar berubah, tanpa kehilangan posisi.
  let ignoreUntil = 0;
  const refresh = () => {
    const frac = setWidth ? (wrap(pos) - setWidth) / setWidth : 0;
    buildClones();
    pendingTarget = null;
    ignoreUntil = performance.now() + 120;
    setPos(setWidth + frac * setWidth);
    sync();
  };
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refresh, 150);
  });
  window.addEventListener("load", refresh, { once: true });

  buildClones();
  setPos(setWidth);
  renderToggle();
  sync();
})();

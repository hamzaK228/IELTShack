(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  /* ---------- Stat counters ---------- */
  const counters = document.querySelectorAll("[data-count]");
  const formatNumber = (n) => n.toLocaleString("en-US");
  const runCounter = (el) => {
    const target = Number(el.dataset.count) || 0;
    if (reduceMotion) {
      el.textContent = formatNumber(target);
      return;
    }
    const duration = 1500;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = formatNumber(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if ("IntersectionObserver" in window) {
    const counterIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          runCounter(entry.target);
          counterIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach((el) => counterIO.observe(el));
  } else {
    counters.forEach(runCounter);
  }

  /* ---------- Mobile navigation ---------- */
  const navToggle = document.querySelector(".nav-toggle");
  const mobileNav = document.querySelector(".site-nav-mobile");
  if (navToggle && mobileNav) {
    const setOpen = (open) => {
      navToggle.setAttribute("aria-expanded", String(open));
      mobileNav.classList.toggle("open", open);
    };
    navToggle.addEventListener("click", () => {
      setOpen(navToggle.getAttribute("aria-expanded") !== "true");
    });
    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll(".faq-q").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = button.nextElementSibling;
      const isOpen = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!isOpen));
      if (panel) panel.classList.toggle("open", !isOpen);
    });
  });

  /* ---------- Hero spotlight + tilt ---------- */
  const hero = document.querySelector(".hero");
  const tilt = hero && hero.querySelector(".tilt");
  if (hero && tilt && !reduceMotion && window.matchMedia("(hover: hover)").matches) {
    let raf = 0;
    let px = 0;
    let py = 0;
    hero.addEventListener("pointermove", (event) => {
      const rect = hero.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      px = x;
      py = y;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        hero.style.setProperty("--sx", `${(px * 100).toFixed(2)}%`);
        hero.style.setProperty("--sy", `${(py * 100).toFixed(2)}%`);
        tilt.style.setProperty("--ry", `${((px - 0.5) * 7).toFixed(2)}deg`);
        tilt.style.setProperty("--rx", `${((0.5 - py) * 5).toFixed(2)}deg`);
      });
    });
    hero.addEventListener("pointerleave", () => {
      hero.style.setProperty("--sx", "50%");
      hero.style.setProperty("--sy", "28%");
      tilt.style.setProperty("--rx", "0deg");
      tilt.style.setProperty("--ry", "0deg");
    });
  }

  /* ---------- Band predictor ---------- */
  const inputs = Array.from(document.querySelectorAll("[data-band]"));
  const overallEl = document.getElementById("overall-band");
  const percentileEl = document.getElementById("band-percentile");
  const barEl = document.getElementById("band-bar");

  // Approximate overall-band percentile lookup (interpolated).
  const percentileTable = [
    [3.0, 1], [3.5, 3], [4.0, 6], [4.5, 12], [5.0, 20], [5.5, 31],
    [6.0, 43], [6.5, 57], [7.0, 69], [7.5, 80], [8.0, 88], [8.5, 94], [9.0, 98],
  ];

  const bandPercentile = (band) => {
    if (band <= percentileTable[0][0]) return percentileTable[0][1];
    const last = percentileTable[percentileTable.length - 1];
    if (band >= last[0]) return last[1];
    for (let i = 1; i < percentileTable.length; i += 1) {
      const [hiBand, hiPct] = percentileTable[i];
      if (band <= hiBand) {
        const [loBand, loPct] = percentileTable[i - 1];
        const t = (band - loBand) / (hiBand - loBand);
        return Math.round(loPct + t * (hiPct - loPct));
      }
    }
    return last[1];
  };

  const ordinal = (n) => {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
    switch (n % 10) {
      case 1: return `${n}st`;
      case 2: return `${n}nd`;
      case 3: return `${n}rd`;
      default: return `${n}th`;
    }
  };

  const readBand = (input) => {
    const raw = Number.parseFloat(input.value);
    if (Number.isNaN(raw)) return 0;
    return Math.min(9, Math.max(0, raw));
  };

  const updatePredictor = () => {
    const bands = inputs.map(readBand);
    const average = bands.reduce((sum, b) => sum + b, 0) / bands.length;
    // IELTS rounding: average rounded to the nearest half band.
    const overall = Math.round(average * 2) / 2;
    const percentile = bandPercentile(overall);

    if (overallEl) overallEl.textContent = overall.toFixed(1);
    if (percentileEl) percentileEl.textContent = ordinal(percentile);
    if (barEl) barEl.style.setProperty("--w", `${((overall / 9) * 100).toFixed(1)}%`);
  };

  inputs.forEach((input) => {
    input.addEventListener("input", updatePredictor);
    input.addEventListener("change", () => {
      const value = readBand(input);
      input.value = value.toFixed(1);
      updatePredictor();
    });
    input.addEventListener("blur", () => {
      if (input.value.trim() === "") input.value = "0.0";
      input.value = readBand(input).toFixed(1);
      updatePredictor();
    });
  });

  if (inputs.length) updatePredictor();
})();

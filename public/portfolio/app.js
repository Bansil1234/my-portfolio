/* ==========================================================================
   app.js — Global interaction layer (Vanilla ES6+, no dependencies)
   Every feature is an isolated module initialised from `boot()`.
   Modules bail out gracefully when their markup is absent on the page.
   ========================================================================== */

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
     1. Theme manager — persists to localStorage, applied pre-paint by
        an inline script in each document <head> to avoid a flash.
     ------------------------------------------------------------------ */
  const Theme = {
    KEY: "br-theme",
    get() {
      return localStorage.getItem(this.KEY) ||
        (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    },
    set(value) {
      document.documentElement.setAttribute("data-theme", value);
      localStorage.setItem(this.KEY, value);
      $$(".theme-toggle").forEach((b) =>
        b.setAttribute("aria-label", `Switch to ${value === "dark" ? "light" : "dark"} theme`)
      );
    },
    init() {
      this.set(this.get());
      $$(".theme-toggle").forEach((btn) =>
        btn.addEventListener("click", () =>
          this.set(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark")
        )
      );
    },
  };

  /* ------------------------------------------------------------------
     2. Reading progress indicator (rAF-throttled)
     ------------------------------------------------------------------ */
  function initProgress() {
    const bar = $(".progress-bar");
    if (!bar) return;
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? window.scrollY / max : 0;
      bar.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;
      ticking = false;
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
      },
      { passive: true }
    );
    update();
  }

  /* ------------------------------------------------------------------
     3. Header state + mobile overlay menu (focus trap + ESC)
     ------------------------------------------------------------------ */
  function initNav() {
    const header = $(".site-header");
    if (header) {
      const onScroll = () => header.classList.toggle("is-stuck", window.scrollY > 8);
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    const menu = $(".mobile-menu");
    const openBtn = $(".nav-toggle");
    if (!menu || !openBtn) return;
    const closeBtn = $(".close-btn", menu);

    const setOpen = (open) => {
      menu.classList.toggle("is-open", open);
      menu.setAttribute("aria-hidden", String(!open));
      openBtn.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("is-locked", open);
      // Staggered link reveal
      $$("a", menu).forEach((a, i) => {
        a.style.transitionDelay = open ? `${0.06 * i + 0.05}s` : "0s";
      });
      (open ? closeBtn : openBtn)?.focus();
    };

    openBtn.addEventListener("click", () => setOpen(true));
    closeBtn?.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("is-open")) setOpen(false);
    });
    $$("a", menu).forEach((a) => a.addEventListener("click", () => setOpen(false)));
  }

  /* ------------------------------------------------------------------
     4. SPA-like page transitions — fade/slide out, then navigate.
     ------------------------------------------------------------------ */
  function initPageTransitions() {
    if (prefersReduced) return;
    document.addEventListener("click", (e) => {
      const link = e.target.closest("a[href]");
      if (!link) return;
      const url = new URL(link.href, location.href);
      const isInternal =
        url.origin === location.origin &&
        !link.target &&
        !link.hasAttribute("download") &&
        !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0;
      if (!isInternal) return;
      if (url.pathname === location.pathname) return; // same page / hash link
      e.preventDefault();
      document.body.classList.add("is-leaving");
      setTimeout(() => (location.href = url.href), 260);
    });
    // Restore state when returning via bfcache
    window.addEventListener("pageshow", () => document.body.classList.remove("is-leaving"));
  }

  /* ------------------------------------------------------------------
     5. Scroll reveal — IntersectionObserver, one-shot per element
     ------------------------------------------------------------------ */
  function initReveal() {
    const items = $$("[data-reveal]");
    if (!items.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (!entry.isIntersecting) return;
          const delay = Number(entry.target.dataset.revealDelay || i * 60);
          setTimeout(() => entry.target.classList.add("is-visible"), delay);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px" }
    );
    items.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------
     6. Animated counters (count up on first view)
     ------------------------------------------------------------------ */
  function initCounters() {
    const nodes = $$("[data-count]");
    if (!nodes.length) return;
    const run = (el) => {
      const target = Number(el.dataset.count);
      const dur = 1500;
      const start = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        el.textContent = Math.round(target * eased).toLocaleString();
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
        }),
      { threshold: 0.4 }
    );
    nodes.forEach((n) => io.observe(n));
  }

  /* ------------------------------------------------------------------
     7. Magnetic hover buttons (pointer-following translate)
     ------------------------------------------------------------------ */
  function initMagnetic() {
    if (prefersReduced || window.matchMedia("(pointer: coarse)").matches) return;
    $$("[data-magnetic]").forEach((el) => {
      const strength = Number(el.dataset.magnetic) || 0.35;
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * strength;
        const y = (e.clientY - (r.top + r.height / 2)) * strength;
        el.style.transform = `translate(${x}px, ${y}px)`;
      });
      el.addEventListener("pointerleave", () => (el.style.transform = ""));
    });
  }

  /* ------------------------------------------------------------------
     8. Hero background: cursor-tracked gradient orb + drifting particle
        constellation rendered on <canvas>. Deliberately restrained.
     ------------------------------------------------------------------ */
  function initHero() {
    const orb = $(".hero__orb");
    const hero = $(".hero");
    if (!hero) return;

    if (orb && !prefersReduced) {
      let tx = window.innerWidth / 2, ty = 240, cx = tx, cy = ty, raf = null;
      const loop = () => {
        cx += (tx - cx) * 0.075;
        cy += (ty - cy) * 0.075;
        orb.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
        raf = requestAnimationFrame(loop);
      };
      hero.addEventListener("pointermove", (e) => {
        const r = hero.getBoundingClientRect();
        tx = e.clientX - r.left;
        ty = e.clientY - r.top;
      });
      loop();
      window.addEventListener("pagehide", () => raf && cancelAnimationFrame(raf));
    }

    const canvas = $(".hero__canvas");
    if (!canvas || prefersReduced) return;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, particles = [];

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = hero.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(80, Math.round((w * h) / 22000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.4 + 0.5,
      }));
    };

    const draw = () => {
      const light = document.documentElement.getAttribute("data-theme") === "light";
      const rgb = light ? "13,17,23" : "255,255,255";
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb},${light ? 0.28 : 0.38})`;
        ctx.fill();
      });
      // Constellation links
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 130) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${rgb},${(1 - d / 130) * (light ? 0.1 : 0.14)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    requestAnimationFrame(draw);
  }


  /* ------------------------------------------------------------------
     8b. Scene3D — a REUSABLE scroll-linked 3D component.

     Drop this markup on ANY page and the component builds + runs itself:

       <section class="scene3d"
                data-scene3d='{
                  "title": "How I build systems",
                  "hint": "Scroll to morph the model",
                  "shapes": ["sphere", "torus", "cube"],
                  "hue": 222,
                  "steps": [
                    { "index": "01 — Foundation", "heading": "...", "body": "..." }
                  ]
                }'></section>

     Notes
     - Any number of instances per page; each tracks its own scroll range.
     - `steps` may hold 2+ entries; the shape list morphs across them.
       If `shapes` is omitted it defaults to the first N built-in shapes.
     - Built-in shapes: sphere, torus, cube, capsule, knot.
     - If the element already contains markup (hand-authored), it is used
       as-is and only the renderer is attached.
     - Everything is a tiny software renderer on 2D canvas: no WebGL and
       no libraries. Faces are projected, back-face culled, depth sorted
       and Lambert shaded.
     ------------------------------------------------------------------ */
  const SCENE3D_SHAPES = (() => {
    const TAU = Math.PI * 2;
    const sphere = (u, v) => {
      const t = u * TAU, p = v * Math.PI;
      return [Math.sin(p) * Math.cos(t), Math.cos(p), Math.sin(p) * Math.sin(t)];
    };
    const torus = (u, v) => {
      const t = u * TAU, p = v * TAU, R = 0.72, r = 0.3;
      return [(R + r * Math.cos(p)) * Math.cos(t), r * Math.sin(p), (R + r * Math.cos(p)) * Math.sin(t)];
    };
    const cube = (u, v) => {
      // Spherified cube: push the sphere point out onto the cube surface.
      const [x, y, z] = sphere(u, v);
      const m = Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) || 1;
      const k = 0.78; // blend between sphere and hard cube for softer edges
      return [x / (m * k + (1 - k)), y / (m * k + (1 - k)), z / (m * k + (1 - k))].map((n) => n * 0.78);
    };
    const capsule = (u, v) => {
      const [x, y, z] = sphere(u, v);
      return [x * 0.55, y * 0.55 + Math.sign(y) * 0.32, z * 0.55];
    };
    const knot = (u, v) => {
      // Tube swept along a (2,3) torus knot.
      const t = u * TAU, p = v * TAU, r = 0.24;
      const cx = (1 + 0.42 * Math.cos(3 * t)) * Math.cos(2 * t) * 0.52;
      const cy = 0.42 * Math.sin(3 * t) * 0.52;
      const cz = (1 + 0.42 * Math.cos(3 * t)) * Math.sin(2 * t) * 0.52;
      return [cx + r * Math.cos(p) * Math.cos(2 * t), cy + r * Math.sin(p), cz + r * Math.cos(p) * Math.sin(2 * t)];
    };
    return { sphere, torus, cube, capsule, knot };
  })();

  const SCENE3D_ORDER = ["sphere", "torus", "cube", "knot", "capsule"];

  /** Read the live accent colour from the theme and return its hue. */
  function themeHue(fallback) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    const m = raw.match(/^#?([0-9a-f]{6})$/i);
    if (!m) return fallback;
    const n = parseInt(m[1], 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return fallback;
    let hh;
    if (max === r) hh = ((g - b) / d) % 6;
    else if (max === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
    return (hh * 60 + 360) % 360;
  }

  /** Build the component markup from a JSON config. */
  function buildScene3DMarkup(root, cfg) {
    const steps = cfg.steps || [];
    const id = `scene3d-title-${Math.random().toString(36).slice(2, 8)}`;
    root.setAttribute("aria-labelledby", id);
    const chips = (list) =>
      Array.isArray(list) && list.length
        ? `<ul class="scene3d__meta">${list.map((t) => `<li>${t}</li>`).join("")}</ul>`
        : "";
    root.innerHTML = `
      <div class="scene3d__track">
        <div class="scene3d__stage container">
          <div class="scene3d__copy">
            <header class="scene3d__head">
              ${cfg.eyebrow ? `<p class="eyebrow">${cfg.eyebrow}</p>` : ""}
              <h2 id="${id}" class="scene3d__title">${cfg.title || "Interactive 3D model"}</h2>
              ${cfg.lede ? `<p class="scene3d__lede">${cfg.lede}</p>` : ""}
            </header>
            <div class="scene3d__steps">
              ${steps
                .map(
                  (s, i) => `
              <article class="scene3d__step${i === 0 ? " is-active" : ""}" aria-hidden="${i === 0 ? "false" : "true"}">
                <p class="scene3d__index">${s.index || ""}</p>
                <h3>${s.heading || ""}</h3>
                <p>${s.body || ""}</p>
                ${chips(s.meta)}
              </article>`
                )
                .join("")}
            </div>
            <ol class="scene3d__dots" aria-hidden="true">
              ${steps.map((s, i) => `<li class="${i === 0 ? "is-active" : ""}"><span></span>${s.index ? `<em>${s.index}</em>` : ""}</li>`).join("")}
            </ol>
          </div>
          <div class="scene3d__canvas-wrap">
            <canvas aria-hidden="true"></canvas>
            ${cfg.hint ? `<p class="scene3d__hint">${cfg.hint}</p>` : ""}
          </div>
        </div>
      </div>`;
  }


  /** Attach the renderer to one prepared `.scene3d` root. */
  function mountScene3D(root, cfg) {
    const canvas = $("canvas", root);
    const track = $(".scene3d__track", root);
    const steps = $$(".scene3d__step", root);
    const dots = $$(".scene3d__dots li", root);
    if (!canvas || !track) return;
    const ctx = canvas.getContext("2d");

    const SEG_U = 44, SEG_V = 26;          // mesh resolution
    const TAU = Math.PI * 2;
    // Theme-aware: follow the live --accent token, with the config hue as a hint.
    let BASE_HUE = Number(cfg.hue) || themeHue(222);
    const syncHue = () => { BASE_HUE = themeHue(Number(cfg.hue) || 222); };
    syncHue();
    new MutationObserver(syncHue).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });


    const names = (cfg.shapes && cfg.shapes.length ? cfg.shapes : SCENE3D_ORDER.slice(0, Math.max(2, steps.length)))
      .map((n) => SCENE3D_SHAPES[n])
      .filter(Boolean);
    const SHAPES = names.length >= 2 ? names : [SCENE3D_SHAPES.sphere, SCENE3D_SHAPES.torus, SCENE3D_SHAPES.cube];

    // Pre-compute the shape targets once — morphing is then pure lerp.
    const targets = SHAPES.map((fn) => {
      const pts = [];
      for (let iv = 0; iv <= SEG_V; iv++)
        for (let iu = 0; iu <= SEG_U; iu++) pts.push(fn(iu / SEG_U, iv / SEG_V));
      return pts;
    });
    const idx = (iu, iv) => iv * (SEG_U + 1) + iu;
    const faces = [];
    for (let iv = 0; iv < SEG_V; iv++)
      for (let iu = 0; iu < SEG_U; iu++)
        faces.push([idx(iu, iv), idx(iu + 1, iv), idx(iu + 1, iv + 1), idx(iu, iv + 1)]);

    const verts = targets[0].map((p) => p.slice());
    let w = 0, h = 0, progress = 0, shown = -1, time = 0, raf = null, visible = true;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.parentElement.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.max(1, w * dpr);
      canvas.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const clamp01 = (n) => Math.min(1, Math.max(0, n));
    const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const onScroll = () => {
      const r = track.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      progress = clamp01(total > 0 ? -r.top / total : 0);
      root.style.setProperty("--scene3d-progress", progress.toFixed(4));
      if (!steps.length) return;
      const active = Math.min(steps.length - 1, Math.floor(progress * steps.length * 0.999));
      if (active !== shown) {
        shown = active;
        steps.forEach((s, i) => {
          s.classList.toggle("is-active", i === active);
          s.setAttribute("aria-hidden", i === active ? "false" : "true");
        });
        dots.forEach((d, i) => {
          d.classList.toggle("is-active", i === active);
          d.classList.toggle("is-done", i < active);
        });
      }
    };


    const render = () => {
      raf = requestAnimationFrame(render);
      if (!visible) return;                  // skip work while off-screen
      time += 0.006;
      // Morph: map progress across the shape list.
      const span = progress * (SHAPES.length - 1);
      const a = Math.min(SHAPES.length - 2, Math.floor(span));
      const mix = easeInOut(clamp01(span - a));
      const A = targets[a], B = targets[a + 1];

      // Rotation is driven by scroll (primary) plus a slow idle drift.
      const ry = progress * TAU * 1.15 + (prefersReduced ? 0 : time * 0.4);
      const rx = -0.42 + Math.sin(progress * Math.PI) * 0.5;
      const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);

      const scale = Math.min(w, h) * (0.36 + progress * 0.05);
      const cxp = w / 2, cyp = h / 2, camZ = 3.4;
      const proj = new Array(verts.length);

      for (let i = 0; i < verts.length; i++) {
        const pa = A[i], pb = B[i];
        let x = pa[0] + (pb[0] - pa[0]) * mix;
        let y = pa[1] + (pb[1] - pa[1]) * mix;
        let z = pa[2] + (pb[2] - pa[2]) * mix;
        // Yaw then pitch
        let X = x * cy - z * sy, Z = x * sy + z * cy;
        let Y = y * cx - Z * sx; Z = y * sx + Z * cx;
        const p = camZ / (camZ - Z);
        verts[i][0] = X; verts[i][1] = Y; verts[i][2] = Z;
        proj[i] = [cxp + X * scale * p, cyp + Y * scale * p, Z];
      }

      const light = document.documentElement.getAttribute("data-theme") === "light";
      ctx.clearRect(0, 0, w, h);

      // Depth-sorted painter's algorithm over quad faces.
      const drawList = [];
      for (let f = 0; f < faces.length; f++) {
        const [i0, i1, i2] = faces[f];
        const p0 = proj[i0], p1 = proj[i1], p2 = proj[i2];
        // Screen-space winding = backface culling
        if ((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]) <= 0) continue;
        const v0 = verts[i0], v1 = verts[i1], v2 = verts[i2];
        const ax = v1[0] - v0[0], ay = v1[1] - v0[1], az = v1[2] - v0[2];
        const bx = v2[0] - v0[0], by = v2[1] - v0[1], bz = v2[2] - v0[2];
        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        const lambert = Math.max(0, nx * -0.45 + ny * -0.62 + nz * 0.64);
        drawList.push({ f, z: (proj[i0][2] + proj[i1][2] + proj[i2][2] + proj[faces[f][3]][2]) / 4, l: lambert });
      }
      drawList.sort((m, n) => m.z - n.z);

      for (const item of drawList) {
        const [i0, i1, i2, i3] = faces[item.f];
        const shade = Math.pow(item.l, 0.85);
        const hue = BASE_HUE - shade * 14;
        const lum = light ? 34 + shade * 52 : 16 + shade * 62;
        const sat = 72 - shade * 18;
        ctx.beginPath();
        ctx.moveTo(proj[i0][0], proj[i0][1]);
        ctx.lineTo(proj[i1][0], proj[i1][1]);
        ctx.lineTo(proj[i2][0], proj[i2][1]);
        ctx.lineTo(proj[i3][0], proj[i3][1]);
        ctx.closePath();
        ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lum}%, ${light ? 0.92 : 0.95})`;
        ctx.fill();
        ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${Math.min(94, lum + 20)}%, ${0.12 + shade * 0.24})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    };

    resize();
    onScroll();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", () => raf && cancelAnimationFrame(raf));
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        (entries) => entries.forEach((e) => (visible = e.isIntersecting)),
        { rootMargin: "120px" }
      ).observe(root);
    }
    raf = requestAnimationFrame(render);
  }

  /** Boot every `.scene3d` on the page. */
  function initScene3D() {
    $$(".scene3d").forEach((root) => {
      if (root.dataset.scene3dReady) return;
      root.dataset.scene3dReady = "true";
      let cfg = {};
      if (root.dataset.scene3d) {
        try { cfg = JSON.parse(root.dataset.scene3d); }
        catch (err) { console.warn("Scene3D: invalid data-scene3d JSON", err); }
      }
      if (!$(".scene3d__track", root)) buildScene3DMarkup(root, cfg);
      mountScene3D(root, cfg);
    });
  }


  /* ------------------------------------------------------------------
     9. Accordions (experience timeline) — ARIA correct
     ------------------------------------------------------------------ */
  function initAccordions() {
    $$(".accordion__trigger").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const open = trigger.getAttribute("aria-expanded") === "true";
        trigger.setAttribute("aria-expanded", String(!open));
      });
    });
  }

  /* ------------------------------------------------------------------
     10. Projects: data, rendering, filtering, case-study modal
     ------------------------------------------------------------------ */
  const PROJECTS = [
    {
      id: "erp",
      title: "Enterprise Resource Planner",
      cat: "fullstack",
      catLabel: "Full-Stack",
      mono: "ERP",
      excerpt:
        "Modular ERP suite unifying inventory, procurement and finance for a 400-seat manufacturer.",
      tags: ["Java", "Spring Boot", "SQL Server", "JasperReports"],
      problem:
        "Six disconnected legacy tools forced staff into daily spreadsheet reconciliation, creating a 48-hour lag between a shop-floor event and any financial visibility.",
      solution:
        "A modular monolith with clean domain boundaries per business capability, an event outbox for cross-module consistency, and a role-aware reporting layer generating audit-ready documents.",
      architecture:
        "Java 17 / Spring Boot service layer, JPA with pessimistic locking on stock movements, normalised SQL Server schema (3NF) with materialised reporting views, and a nightly ETL into an analytics schema.",
      impact:
        "Month-end close reduced from 9 days to 2. Stock accuracy rose to 99.4%. 40+ recurring reports fully automated.",
    },
    {
      id: "hft",
      title: "Low-Latency Trading Engine",
      cat: "systems",
      catLabel: "C++ / Systems",
      mono: "HFT",
      excerpt:
        "A lock-free order matching and signal engine benchmarked in the low microsecond range.",
      tags: ["C++20", "Lock-free", "Boost.Asio", "Linux"],
      problem:
        "The prior Python research stack could not evaluate strategies within the exchange's tick cadence, so signals were consistently stale at execution time.",
      solution:
        "A single-writer ring buffer feed handler, cache-aligned order book structures and a pinned hot path with zero heap allocation after warm-up.",
      architecture:
        "Lock-free SPSC queues, custom slab allocator, `std::pmr` pools, CPU affinity and huge pages on Linux, deterministic replay harness for regression testing.",
      impact:
        "Median tick-to-signal latency of 8.4 µs (p99 21 µs), a 60× improvement, with reproducible backtests over 2.1 B recorded ticks.",
    },
    {
      id: "editor",
      title: "Real-Time Collaborative Code Editor",
      cat: "frontend",
      catLabel: "Frontend",
      mono: "RTC",
      excerpt:
        "Multi-cursor collaborative editing with conflict-free merging over WebSockets.",
      tags: ["JavaScript", "WebSockets", "CRDT", "Web Workers"],
      problem:
        "Pair-programming sessions across timezones relied on screen sharing, which is bandwidth-heavy and leaves no editable artefact.",
      solution:
        "A CRDT document model synchronised over a WebSocket relay, with presence awareness, remote cursor rendering and offline replay on reconnect.",
      architecture:
        "Vanilla ES modules, tokenizer running in a Web Worker, virtualised line renderer for 100k-line files, binary framing to cut payload size by 62%.",
      impact:
        "Sub-70 ms perceived sync latency for 12 concurrent editors; zero merge conflicts across a six-month pilot.",
    },
    {
      id: "auth",
      title: "Secure Authentication Microservice",
      cat: "backend",
      catLabel: "Backend",
      mono: "AUT",
      excerpt:
        "OAuth 2.1 + OIDC identity service with rotating refresh tokens and step-up MFA.",
      tags: ["C#", ".NET 8", "PostgreSQL", "Redis"],
      problem:
        "Each product team implemented its own login, producing inconsistent session rules and three separate password-reset vulnerabilities.",
      solution:
        "A centralised identity provider issuing short-lived access tokens with refresh rotation and reuse detection, plus risk-based step-up MFA.",
      architecture:
        ".NET 8 minimal APIs, Argon2id hashing, Redis-backed distributed rate limiting, PostgreSQL row-level tenancy, key rotation via JWKS.",
      impact:
        "Consolidated 7 login flows into one, cut auth-related incidents to zero over 14 months, passed an external penetration test with no critical findings.",
    },
    {
      id: "pipeline",
      title: "Distributed Ingestion Pipeline",
      cat: "backend",
      catLabel: "Backend",
      mono: "PIP",
      excerpt:
        "Exactly-once ingestion of 30M telemetry events per day with backpressure control.",
      tags: ["Java", "Kafka", "Docker", "CI/CD"],
      problem:
        "Bursty device telemetry regularly overwhelmed the ingest tier, dropping events and corrupting downstream aggregates.",
      solution:
        "Partitioned topics keyed by device, idempotent consumers with a transactional outbox, and adaptive backpressure driven by consumer lag.",
      architecture:
        "Kafka Streams topology, schema registry with backwards-compatible evolution, dead-letter queues, containerised workers on a rolling-deploy pipeline.",
      impact:
        "Zero data loss across 18 months, p95 end-to-end ingestion of 340 ms, infrastructure cost down 28% via right-sized consumers.",
    },
    {
      id: "designsys",
      title: "Design System & Component Library",
      cat: "frontend",
      catLabel: "Frontend",
      mono: "DS",
      excerpt:
        "Framework-agnostic Web Component library with tokenised theming and a11y baked in.",
      tags: ["Web Components", "CSS3", "A11y", "Storybook"],
      problem:
        "Four product surfaces shipped visibly different buttons, modals and form fields, and each rebuilt accessibility from scratch — usually incorrectly.",
      solution:
        "Custom elements built on Shadow DOM with CSS custom-property theming, automated accessibility tests and a versioned token pipeline.",
      architecture:
        "Vanilla Web Components, design tokens compiled to CSS variables, axe-core assertions in CI, visual regression snapshots per component state.",
      impact:
        "New feature UI build time down 45%; WCAG 2.2 AA compliance across every consuming product.",
    },
    {
      id: "kernel",
      title: "Memory Allocator & Profiler",
      cat: "systems",
      catLabel: "C++ / Systems",
      mono: "MEM",
      excerpt:
        "Drop-in arena allocator with live fragmentation visualisation for C++ services.",
      tags: ["C++", "POSIX", "Multithreading", "Perf"],
      problem:
        "A long-running service degraded steadily over days; general-purpose malloc fragmentation was suspected but invisible.",
      solution:
        "A size-class arena allocator with thread-local caches, plus an instrumentation shim streaming allocation histograms to a live view.",
      architecture:
        "mmap-backed arenas, atomic free lists, thread-local magazines, an out-of-band profiler exporting to a browser dashboard over a UNIX socket.",
      impact:
        "Steady-state RSS reduced by 34%; the 7-day latency drift disappeared entirely.",
    },
    {
      id: "portal",
      title: "Healthcare Scheduling Portal",
      cat: "fullstack",
      catLabel: "Full-Stack",
      mono: "MED",
      excerpt:
        "HIPAA-conscious appointment platform with clinician calendars and audit trails.",
      tags: ["C#", ".NET", "SQL", "MVC"],
      problem:
        "Phone-only booking produced a 21% no-show rate and no reliable record of scheduling changes.",
      solution:
        "Self-service booking against real clinician availability, automated reminders and an append-only audit log for every state change.",
      architecture:
        "ASP.NET MVC with a CQRS read model, SQL temporal tables for audit history, encrypted PII columns, background reminder scheduler.",
      impact:
        "No-shows down to 7%, 62% of bookings self-service, full change traceability for compliance review.",
    },
  ];

  function initProjects() {
    const grid = $("#project-grid");
    if (!grid) return;

    /* --- Render cards from the data model --- */
    grid.innerHTML = PROJECTS.map(
      (p) => `
      <article class="card project" data-cat="${p.cat}" data-id="${p.id}" data-reveal>
        <div class="project__thumb" role="img" aria-label="${p.title} cover artwork">${p.mono}</div>
        <div class="project__body">
          <span class="project__cat">${p.catLabel}</span>
          <h3>${p.title}</h3>
          <p>${p.excerpt}</p>
          <ul class="tags">${p.tags.map((t) => `<li class="tag">${t}</li>`).join("")}</ul>
          <button class="btn btn--ghost btn--sm" data-open="${p.id}"
            aria-haspopup="dialog">View Case Study</button>
        </div>
      </article>`
    ).join("");

    const cards = $$(".project", grid);
    const live = $("#filter-status");

    /* --- Filtering --- */
    $$(".filter").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = btn.dataset.filter;
        $$(".filter").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
        let shown = 0;
        cards.forEach((card) => {
          const match = cat === "all" || card.dataset.cat === cat;
          card.classList.toggle("is-hidden", !match);
          if (match) shown++;
        });
        if (live) live.textContent = `${shown} project${shown === 1 ? "" : "s"} shown.`;
      });
    });

    /* --- Case study modal --- */
    const modal = $("#case-modal");
    const dialog = $(".modal__dialog", modal);
    const content = $("#case-content", modal);
    let lastFocused = null;

    const open = (id) => {
      const p = PROJECTS.find((x) => x.id === id);
      if (!p) return;
      lastFocused = document.activeElement;
      content.innerHTML = `
        <span class="project__cat">${p.catLabel}</span>
        <h2 id="case-title">${p.title}</h2>
        <p class="lead">${p.excerpt}</p>
        <ul class="tags">${p.tags.map((t) => `<li class="tag">${t}</li>`).join("")}</ul>
        <div class="modal__section"><h4>Problem</h4><p>${p.problem}</p></div>
        <div class="modal__section"><h4>Solution</h4><p>${p.solution}</p></div>
        <div class="modal__section"><h4>Architecture</h4><p>${p.architecture}</p></div>
        <div class="modal__section"><h4>Impact</h4><p>${p.impact}</p></div>
        <div class="modal__links">
          <a class="btn" href="https://github.com/" target="_blank" rel="noopener noreferrer">View on GitHub</a>
          <a class="btn btn--ghost" href="https://github.com/" target="_blank" rel="noopener noreferrer">Live Demo</a>
        </div>`;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("is-locked");
      dialog.scrollTop = 0;
      $(".modal__close", modal).focus();
    };

    const close = () => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("is-locked");
      lastFocused?.focus();
    };

    grid.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-open]");
      if (trigger) open(trigger.dataset.open);
    });
    $$("[data-close]", modal).forEach((el) => el.addEventListener("click", close));
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !modal.classList.contains("is-open")) return;
      close();
    });
    // Simple focus trap inside the dialog
    modal.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const focusables = $$(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        dialog
      );
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    initReveal();
  }

  /* ------------------------------------------------------------------
     11. Skills: meters, tooltips, vanilla radar chart
     ------------------------------------------------------------------ */
  function initSkills() {
    /* Meters animate on view */
    const meters = $$(".meter__fill");
    if (meters.length) {
      const io = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            e.target.style.width = `${e.target.dataset.level}%`;
            io.unobserve(e.target);
          }),
        { threshold: 0.3 }
      );
      meters.forEach((m) => io.observe(m));
    }

    /* Tooltips for [data-tip] elements */
    const tipEls = $$("[data-tip]");
    if (tipEls.length) {
      const tip = document.createElement("div");
      tip.className = "tooltip";
      tip.setAttribute("role", "tooltip");
      document.body.appendChild(tip);

      const show = (el) => {
        tip.innerHTML = `<strong>${el.dataset.tipTitle || el.textContent.trim()}</strong>${el.dataset.tip}`;
        tip.classList.add("is-visible");
        const r = el.getBoundingClientRect();
        const t = tip.getBoundingClientRect();
        const left = Math.min(
          Math.max(8, r.left + r.width / 2 - t.width / 2),
          window.innerWidth - t.width - 8
        );
        const top = r.top - t.height - 10 < 8 ? r.bottom + 10 : r.top - t.height - 10;
        tip.style.left = `${left}px`;
        tip.style.top = `${top}px`;
      };
      const hide = () => tip.classList.remove("is-visible");

      tipEls.forEach((el) => {
        el.setAttribute("tabindex", "0");
        el.addEventListener("pointerenter", () => show(el));
        el.addEventListener("focus", () => show(el));
        el.addEventListener("pointerleave", hide);
        el.addEventListener("blur", hide);
      });
      window.addEventListener("scroll", hide, { passive: true });
    }

    /* Radar chart drawn with plain canvas 2D */
    const radar = $("#radar");
    if (radar) drawRadar(radar);
  }

  function drawRadar(canvas) {
    const data = [
      { label: "Backend", value: 0.94 },
      { label: "Systems", value: 0.86 },
      { label: "Frontend", value: 0.88 },
      { label: "Databases", value: 0.9 },
      { label: "DevOps", value: 0.78 },
      { label: "Architecture", value: 0.92 },
    ];
    const render = () => {
      const size = Math.min(canvas.parentElement.clientWidth, 440);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2, cy = size / 2, R = size / 2 - 46;
      const styles = getComputedStyle(document.documentElement);
      const accent = styles.getPropertyValue("--accent").trim() || "#2f6bff";
      const light = document.documentElement.getAttribute("data-theme") === "light";
      const gridColor = light ? "rgba(13,17,23,0.14)" : "rgba(255,255,255,0.13)";
      const textColor = light ? "#4d5765" : "#a7b0be";
      const angle = (i) => (Math.PI * 2 * i) / data.length - Math.PI / 2;

      // Grid rings
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      for (let ring = 1; ring <= 4; ring++) {
        ctx.beginPath();
        data.forEach((_, i) => {
          const r = (R * ring) / 4;
          const x = cx + Math.cos(angle(i)) * r;
          const y = cy + Math.sin(angle(i)) * r;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.closePath();
        ctx.stroke();
      }
      // Spokes + labels
      ctx.font = "500 12px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      data.forEach((d, i) => {
        const a = angle(i);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.stroke();
        ctx.fillText(d.label, cx + Math.cos(a) * (R + 26), cy + Math.sin(a) * (R + 20));
      });
      // Value polygon (animated)
      let progress = 0;
      const step = () => {
        progress = Math.min(1, progress + 0.03);
        ctx.save();
        ctx.beginPath();
        data.forEach((d, i) => {
          const a = angle(i);
          const r = R * d.value * progress;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.22;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();
        data.forEach((d, i) => {
          const a = angle(i);
          const r = R * d.value * progress;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = accent;
          ctx.fill();
        });
        ctx.restore();
        if (progress < 1) requestAnimationFrame(step);
      };
      prefersReduced ? ((progress = 0.99), step()) : step();
    };
    render();
    window.addEventListener("resize", render);
    // Redraw on theme change so grid/labels keep contrast
    new MutationObserver(render).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  }

  /* ------------------------------------------------------------------
     12. Toast notifications
     ------------------------------------------------------------------ */
  function toast(title, message) {
    let region = $(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
        stroke-width="2" aria-hidden="true" style="color:var(--emerald);flex:none">
        <path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div><strong>${title}</strong><p>${message}</p></div>`;
    region.appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-visible"));
    setTimeout(() => {
      el.classList.add("is-hiding");
      setTimeout(() => el.remove(), 500);
    }, 4800);
  }

  /* ------------------------------------------------------------------
     13. Contact form — real-time validation, loading state, toast
     ------------------------------------------------------------------ */
  function initForm() {
    const form = $("#contact-form");
    if (!form) return;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

    const rules = {
      name: (v) =>
        !v.trim() ? "Please enter your name."
        : v.trim().length < 2 ? "That name looks a little short."
        : "",
      email: (v) =>
        !v.trim() ? "An email address is required."
        : !EMAIL_RE.test(v.trim()) ? "Enter a valid email, e.g. name@company.com."
        : "",
      subject: (v) =>
        !v.trim() ? "Please add a subject."
        : v.length > 80 ? "Keep the subject under 80 characters."
        : "",
      message: (v) =>
        !v.trim() ? "Tell me a little about the project."
        : v.trim().length < 20 ? "Please add at least 20 characters."
        : v.length > 1000 ? "Messages are limited to 1000 characters."
        : "",
    };

    const validate = (field) => {
      const rule = rules[field.name];
      if (!rule) return true;
      const msg = rule(field.value);
      const wrap = field.closest(".field");
      const err = $(".error", wrap);
      wrap.classList.toggle("has-error", Boolean(msg));
      field.setAttribute("aria-invalid", String(Boolean(msg)));
      if (err) err.textContent = msg;
      return !msg;
    };

    const fields = $$("input, textarea", form).filter((f) => rules[f.name]);
    fields.forEach((f) => {
      f.addEventListener("blur", () => validate(f));
      f.addEventListener("input", () => {
        if (f.closest(".field").classList.contains("has-error")) validate(f);
        const counter = $(`[data-counter-for="${f.name}"]`, form);
        if (counter) counter.textContent = `${f.value.length} / ${f.maxLength}`;
      });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const valid = fields.map(validate).every(Boolean);
      if (!valid) {
        const firstBad = $(".field.has-error input, .field.has-error textarea", form);
        firstBad?.focus();
        return;
      }
      const btn = $("button[type=submit]", form);
      btn.classList.add("is-loading");
      btn.disabled = true;
      const label = $(".btn-label", btn);
      const original = label.textContent;
      label.textContent = "Sending";
      // Simulated network round-trip (no backend wired up in this demo)
      setTimeout(() => {
        btn.classList.remove("is-loading");
        btn.disabled = false;
        label.textContent = original;
        form.reset();
        $$(".counter", form).forEach((c) => (c.textContent = "0 / 1000"));
        toast("Message sent", "Thanks for reaching out — I'll reply within 24 hours.");
      }, 1600);
    });
  }

  /* ------------------------------------------------------------------
     14. Boot
     ------------------------------------------------------------------ */
  function boot() {
    Theme.init();
    initProgress();
    initNav();
    initPageTransitions();
    initReveal();
    initCounters();
    initMagnetic();
    initHero();
    initScene3D();
    initAccordions();
    initProjects();
    initSkills();
    initForm();

    // Mark the active nav item for the current document
    const path = location.pathname.split("/").pop() || "index.html";
    $$(".nav-link, .mobile-menu a").forEach((a) => {
      if ((a.getAttribute("href") || "").endsWith(path)) a.setAttribute("aria-current", "page");
    });
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", boot)
    : boot();
})();

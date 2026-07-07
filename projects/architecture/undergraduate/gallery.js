(function () {
  "use strict";

  const gallery = document.getElementById("gallery");
  const folder = gallery.getAttribute("data-folder"); // e.g. "assets/redHook"
  const ext = gallery.getAttribute("data-ext") || "jpg";
  const interval = parseInt(gallery.getAttribute("data-interval"), 10) || 3000;
  const maxProbe = 200; // safety cap on how many images we look for

  let images = [];
  let current = 0;
  let timer = null;

  // Build the "assets/redHook/01.jpg" style path for a given number.
  function src(n) {
    return folder + "/" + String(n).padStart(2, "0") + "." + ext;
  }

  // Add one <img> for the given file path (relative to the folder).
  function addImage(path) {
    const img = document.createElement("img");
    img.src = folder + "/" + path;
    img.alt = "Drawing " + (images.length + 1);
    if (images.length === 0) img.classList.add("active");
    gallery.appendChild(img);
    images.push(img);
  }

  // Preferred path: read manifest.json — an ordered list of filenames — so
  // images can keep their real names and the display order is explicit.
  // e.g.  ["ARCADE_RENDER.jpg", "BMT_STAIR_RENDER.jpg", ...]
  function init() {
    fetch(folder + "/manifest.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("no manifest");
        return r.json();
      })
      .then(function (list) {
        if (!Array.isArray(list) || list.length === 0) throw new Error("empty");
        list.forEach(addImage);
        finish();
      })
      .catch(function () {
        // Fallback: no manifest, so probe numbered files 01, 02, 03 ...
        loadNext(1);
      });
  }

  // Sequentially probe 01, 02, 03 ... until one fails to load, adding each
  // found image to the gallery. This lets the user just drop in numbered
  // JPEGs without editing any code.
  function loadNext(n) {
    if (n > maxProbe) return finish();

    const probe = new Image();
    probe.onload = function () {
      addImage(String(n).padStart(2, "0") + "." + ext);
      loadNext(n + 1);
    };
    probe.onerror = function () {
      finish();
    };
    probe.src = src(n);
  }

  function finish() {
    if (images.length <= 1) {
      gallery.setAttribute("data-single", "true");
      return; // nothing to rotate through
    }
    startTimer();
  }

  function show(index) {
    images[current].classList.remove("active");
    current = (index + images.length) % images.length;
    images[current].classList.add("active");
  }

  function next() {
    show(current + 1);
  }

  function prev() {
    show(current - 1);
  }

  function startTimer() {
    stopTimer();
    timer = setInterval(next, interval);
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  // Reset the auto-advance timer whenever the user navigates manually,
  // so they get a full interval to look at the image they chose.
  function manual(fn) {
    fn();
    startTimer();
  }

  // ---------- WIRING ----------

  const prevBtn = document.querySelector(".arrow.prev");
  const nextBtn = document.querySelector(".arrow.next");
  if (prevBtn) prevBtn.addEventListener("click", () => manual(prev));
  if (nextBtn) nextBtn.addEventListener("click", () => manual(next));

  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") manual(prev);
    else if (e.key === "ArrowRight") manual(next);
  });

  // Pause rotation when the tab is hidden; resume when visible.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopTimer();
    else if (images.length > 1) startTimer();
  });

  // Return button
  const returnBtn = document.getElementById("returnBtn");
  if (returnBtn) {
    returnBtn.addEventListener("click", function () {
      if (window.history.length > 1) history.back();
      else window.location.href = "/index.html";
    });
  }

  init();
})();

(() => {
  const CSV_PATH = "assets/portfolio.csv";
  const ASSET_PATH = "assets/";
  const MAX_LOOPS = 8;

  const phatscroll = document.getElementById("phatscroll");
  const overviewGrid = document.getElementById("overview-grid");
  const sentinel = document.getElementById("infinite-sentinel");
  const focusView = document.getElementById("focus");
  const focusStage = document.getElementById("focus-stage");
  const focusThumbs = document.getElementById("focus-thumbs");
  const focusTitle = document.getElementById("focus-title");
  const focusDescription = document.getElementById("focus-description");
  const navscreen = document.getElementById("navscreen");
  const navOpener = document.getElementById("nav-opener");
  const overviewEl = document.getElementById("overview");

  let csvItems = [];
  let shuffledItems = [];
  let view = "overview";
  let loops = 0;
  let navOpen = false;
  let overviewScrollY = 0;
  let focusIndex = 0;
  let wheelAcc = 0;
  let cycleLock = false;

  const videoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      });
    },
    { rootMargin: "160px 0px" }
  );

  const infiniteObserver = new IntersectionObserver(
    (entries) => {
      if (view === "overview" && entries.some((entry) => entry.isIntersecting)) {
        appendOverview();
      }
    },
    { rootMargin: "900px 0px" }
  );

  function normalize(row) {
    return {
      filename: String(row.filename || "").trim(),
      media_type: String(row.media_type || "image").trim().toLowerCase(),
      category: String(row.category || "").trim(),
      title: String(row.title || "").trim(),
      description: String(row.description || "").trim(),
      poster: String(row.poster || "").trim(),
    };
  }

  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function columnCount() {
    return window.matchMedia("(max-width: 700px)").matches ? 3 : 5;
  }

  function mediaEl(item, className, asThumb = false) {
    const isVideo = item.media_type === "video";
    if (isVideo && !asThumb) {
      const video = document.createElement("video");
      video.className = className || "media";
      video.src = `${ASSET_PATH}${item.filename}`;
      video.muted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      if (item.poster) video.poster = `${ASSET_PATH}${item.poster}`;
      video.addEventListener("loadedmetadata", fillIfNeeded, { once: true });
      videoObserver.observe(video);
      return video;
    }
    const img = document.createElement("img");
    img.className = className || "media";
    img.src = `${ASSET_PATH}${isVideo && item.poster ? item.poster : item.filename}`;
    img.alt = item.title || "Portfolio image";
    img.loading = asThumb ? "lazy" : "eager";
    if (!asThumb) img.addEventListener("load", fillIfNeeded, { once: true });
    return img;
  }

  function packCells(items, skipHoles) {
    const cols = columnCount();
    const centerCol = Math.floor(cols / 2);
    const cells = [];
    let col = 0;
    let row = 0;
    let skippedTop = !skipHoles;
    let skippedName = !skipHoles;

    function advance() {
      col += 1;
      if (col >= cols) {
        col = 0;
        row += 1;
      }
    }

    function maybeSkip() {
      while (
        (!skippedTop && row === 0 && col === centerCol) ||
        (!skippedName && row === 1 && col === centerCol)
      ) {
        const hole = row === 0 ? "top" : "name";
        cells.push({ skip: true, hole });
        if (hole === "top") skippedTop = true;
        else skippedName = true;
        advance();
      }
    }

    items.forEach((item) => {
      if (!item.filename) return;
      maybeSkip();
      cells.push({ skip: false, item });
      advance();
    });

    return cells;
  }

  function createOverviewCell(cell, index, firstBatch) {
    const node = document.createElement(cell.skip ? "div" : "button");
    node.className = "overview-item";
    if (!cell.skip) node.type = "button";
    if (cell.skip) {
      node.classList.add("is-skip");
      if (cell.hole) node.classList.add(`is-skip-${cell.hole}`);
      return node;
    }
    if (firstBatch) {
      node.style.setProperty("--reveal", `${Math.min(index, 24) * 55}ms`);
    }
    node.appendChild(mediaEl(cell.item));
    node.addEventListener("click", () => openFocus(cell.item));
    requestAnimationFrame(() => node.classList.add("is-visible"));
    return node;
  }

  function syncScrollHeight() {
    if (view !== "overview") {
      document.body.style.height = "";
      return;
    }
    document.body.style.height = `${phatscroll.scrollHeight}px`;
  }

  function fillIfNeeded() {
    if (view !== "overview") return;
    syncScrollHeight();
    const rect = sentinel.getBoundingClientRect();
    if (rect.top < window.innerHeight + 900) appendOverview();
  }

  function appendOverview() {
    if (view !== "overview" || loops >= MAX_LOOPS || !shuffledItems.length) return;
    loops += 1;
    const frag = document.createDocumentFragment();
    const firstBatch = loops === 1;
    packCells(shuffledItems, firstBatch).forEach((cell, index) => {
      frag.appendChild(createOverviewCell(cell, index, firstBatch));
    });
    overviewGrid.appendChild(frag);
    syncScrollHeight();
    infiniteObserver.unobserve(sentinel);
    infiniteObserver.observe(sentinel);
    requestAnimationFrame(fillIfNeeded);
  }

  function renderOverview() {
    overviewGrid.querySelectorAll("video").forEach((video) => videoObserver.unobserve(video));
    overviewGrid.innerHTML = "";
    loops = 0;
    appendOverview();
  }

  function buildFocusThumbs() {
    focusThumbs.innerHTML = "";
    csvItems.forEach((entry, index) => {
      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = "focus-thumb";
      thumb.dataset.index = String(index);
      thumb.appendChild(mediaEl(entry, "media", true));
      thumb.addEventListener("click", () => showFocusAt(index));
      focusThumbs.appendChild(thumb);
    });
  }

  function showFocusAt(index) {
    const length = csvItems.length;
    if (!length) return;
    focusIndex = ((index % length) + length) % length;
    const item = csvItems[focusIndex];

    focusStage.querySelectorAll("video").forEach((video) => videoObserver.unobserve(video));
    focusStage.innerHTML = "";
    focusStage.appendChild(mediaEl(item));
    focusTitle.textContent = item.title || "";
    focusDescription.textContent = item.description || "";
    restartAnim(focusTitle);
    restartAnim(focusDescription);

    focusThumbs.querySelectorAll(".focus-thumb").forEach((thumb, thumbIndex) => {
      thumb.classList.toggle("is-active", thumbIndex === focusIndex);
    });
    const active = focusThumbs.querySelector(".focus-thumb.is-active");
    if (active) active.scrollIntoView({ block: "nearest" });
  }

  function restartAnim(el) {
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  }

  function cycleFocus(direction) {
    if (cycleLock) return;
    cycleLock = true;
    showFocusAt(focusIndex + direction);
    window.setTimeout(() => {
      cycleLock = false;
    }, 280);
  }

  function openNav() {
    navOpen = true;
    navscreen.hidden = false;
    requestAnimationFrame(() => navscreen.classList.add("is-open"));
    navOpener.classList.add("is-open");
    navOpener.setAttribute("aria-expanded", "true");
    navOpener.setAttribute("aria-label", "Close menu");
  }

  function closeNav() {
    navOpen = false;
    navscreen.classList.remove("is-open");
    navOpener.classList.remove("is-open");
    navOpener.setAttribute("aria-expanded", "false");
    navOpener.setAttribute("aria-label", "Open menu");
    window.setTimeout(() => {
      if (!navOpen) navscreen.hidden = true;
    }, 480);
  }

  function toggleNav() {
    if (navOpen) closeNav();
    else openNav();
  }

  function setView(next, item) {
    if (view === "overview") overviewScrollY = window.scrollY;
    view = next;
    overviewEl.hidden = next !== "overview";
    focusView.hidden = next !== "focus";
    document.body.classList.toggle("is-overview", next === "overview");
    document.body.classList.toggle("is-focus", next === "focus");
    document.querySelectorAll("[data-view]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.view === next);
    });

    if (next === "overview") {
      requestAnimationFrame(() => {
        syncScrollHeight();
        window.scrollTo(0, overviewScrollY);
        onScroll();
        requestAnimationFrame(() => {
          syncScrollHeight();
          window.scrollTo(0, overviewScrollY);
          onScroll();
        });
      });
    } else {
      document.body.style.height = "";
      window.scrollTo(0, 0);
    }

    if (next === "focus" && item) {
      if (!focusThumbs.children.length) buildFocusThumbs();
      const index = csvItems.findIndex((entry) => entry.filename === item.filename);
      showFocusAt(index < 0 ? 0 : index);
    }
    closeNav();
  }

  function openFocus(item) {
    setView("focus", item);
  }

  function onWheel(event) {
    if (view !== "focus" || navOpen) return;
    event.preventDefault();
    wheelAcc += event.deltaY;
    if (Math.abs(wheelAcc) < 50) return;
    const direction = wheelAcc > 0 ? 1 : -1;
    wheelAcc = 0;
    cycleFocus(direction);
  }

  let touchStartY = 0;
  function onTouchStart(event) {
    if (view !== "focus") return;
    touchStartY = event.changedTouches[0].clientY;
  }
  function onTouchMove(event) {
    if (view !== "focus" || navOpen) return;
    event.preventDefault();
  }
  function onTouchEnd(event) {
    if (view !== "focus" || navOpen) return;
    const dy = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dy) < 40) return;
    cycleFocus(dy < 0 ? 1 : -1);
  }

  function onScroll() {
    if (view !== "overview") return;
    phatscroll.style.transform = `translate3d(0, ${-window.scrollY}px, 0)`;
    fillIfNeeded();
  }

  navOpener.addEventListener("click", toggleNav);
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.view === "focus") {
        setView("focus", csvItems[focusIndex] || csvItems[0]);
        return;
      }
      setView("overview");
    });
  });
  document.querySelector("[data-back]").addEventListener("click", (event) => {
    event.stopPropagation();
    setView("overview");
  });
  focusView.addEventListener("click", (event) => {
    if (event.target.closest(".media, .focus-thumb, .focus-copy, .focus-back")) return;
    setView("overview");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (navOpen) closeNav();
      else if (view === "focus") setView("overview");
      return;
    }
    if (view === "focus" && !navOpen) {
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        cycleFocus(1);
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        cycleFocus(-1);
      }
    }
  });
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", syncScrollHeight);

  function land() {
    const intro = document.getElementById("intro");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveal = () => {
      document.documentElement.classList.add("has-landed");
      window.setTimeout(() => {
        if (intro) intro.hidden = true;
      }, reduce ? 0 : 900);
    };
    if (reduce) {
      reveal();
      return;
    }
    window.setTimeout(reveal, 1450);
  }

  function loadCsv() {
    if (typeof Papa === "undefined") return;
    Papa.parse(CSV_PATH, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        csvItems = (results.data || []).map(normalize).filter((item) => item.filename);
        shuffledItems = shuffle(csvItems);
        document.body.classList.add("is-overview");
        renderOverview();
        infiniteObserver.observe(sentinel);
        new ResizeObserver(() => {
          if (view === "overview") fillIfNeeded();
        }).observe(overviewGrid);
        land();
      },
    });
  }

  loadCsv();
})();

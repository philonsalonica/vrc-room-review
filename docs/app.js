/* ===================================================================
   VRC ルーム系ワールド検索サイト — アプリケーションロジック
   ビルドツール無し。data.json を fetch して画面に描画する。
=================================================================== */

(() => {
  "use strict";

  const state = {
    all: [],
    tags: new Set(),
    platforms: new Set(),
    query: "",
    capacityMax: null,
    sort: "favorites-desc",
  };

  const els = {
    grid: document.getElementById("listing-grid"),
    resultCount: document.getElementById("result-count"),
    emptyState: document.getElementById("empty-state"),
    dataNotice: document.getElementById("data-notice"),
    tagFilter: document.getElementById("tag-filter"),
    platformFilter: document.getElementById("platform-filter"),
    searchInput: document.getElementById("search-input"),
    capacityMax: document.getElementById("capacity-max"),
    sortSelect: document.getElementById("sort-select"),
    resetBtn: document.getElementById("reset-filters"),
    generatedAt: document.getElementById("generated-at"),
  };

  /** "最大32人" や "32" など揺れのある表記から先頭の数値だけを取り出す */
  function extractNumber(value) {
    if (value === null || value === undefined) return null;
    const m = String(value).match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  async function loadData() {
    try {
      const res = await fetch("data.json", { cache: "no-store" });
      const payload = await res.json();
      state.all = payload.listings || [];

      if (payload.generatedAt) {
        const d = new Date(payload.generatedAt);
        if (!isNaN(d)) {
          els.generatedAt.textContent = `情報更新日時: ${d.toLocaleString("ja-JP")}`;
        }
      }
    } catch (err) {
      console.error("データの読み込みに失敗しました", err);
      state.all = [];
    }

    buildFilterOptions();
    render();
  }

  function buildFilterOptions() {
    const tagSet = new Set();
    const platformSet = new Set();
    state.all.forEach((w) => {
      (w.tags || []).forEach((t) => tagSet.add(t));
      (w.platform || []).forEach((p) => platformSet.add(p));
    });

    els.tagFilter.innerHTML = "";
    [...tagSet].sort().forEach((tag) => {
      els.tagFilter.appendChild(makeChip(tag, state.tags, () => render()));
    });

    els.platformFilter.innerHTML = "";
    [...platformSet].sort().forEach((p) => {
      els.platformFilter.appendChild(makeChip(p, state.platforms, () => render()));
    });
  }

  function makeChip(label, selectedSet, onChange) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = label;
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => {
      if (selectedSet.has(label)) {
        selectedSet.delete(label);
        btn.setAttribute("aria-pressed", "false");
      } else {
        selectedSet.add(label);
        btn.setAttribute("aria-pressed", "true");
      }
      onChange();
    });
    return btn;
  }

  function applyFilters() {
    const q = state.query.trim().toLowerCase();

    return state.all.filter((w) => {
      if (q) {
        const haystack = [w.name, w.authorName, w.description, w.mood]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (state.tags.size > 0) {
        const hasTag = (w.tags || []).some((t) => state.tags.has(t));
        if (!hasTag) return false;
      }

      if (state.platforms.size > 0) {
        const hasPlatform = (w.platform || []).some((p) => state.platforms.has(p));
        if (!hasPlatform) return false;
      }

      if (state.capacityMax !== null) {
        const cap = extractNumber(w.recommendedCapacity) ?? extractNumber(w.capacity);
        if (cap !== null && cap > state.capacityMax) return false;
      }

      return true;
    });
  }

  function sortListings(list) {
    const sorted = [...list];
    switch (state.sort) {
      case "favorites-desc":
        sorted.sort((a, b) => (b.favorites ?? -1) - (a.favorites ?? -1));
        break;
      case "updated-desc":
        sorted.sort((a, b) => (b.updatedDate || "").localeCompare(a.updatedDate || ""));
        break;
      case "capacity-asc": {
        const capOf = (w) => extractNumber(w.recommendedCapacity) ?? extractNumber(w.capacity) ?? 9999;
        sorted.sort((a, b) => capOf(a) - capOf(b));
        break;
      }
      case "name-asc":
        sorted.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));
        break;
    }
    return sorted;
  }

  function specRow(label, value) {
    if (!value) return "";
    return `
      <div class="spec-row">
        <div class="spec-row__label">${escapeHtml(label)}</div>
        <div class="spec-row__value">${escapeHtml(value)}</div>
      </div>`;
  }

  function renderCard(w) {
    const capacityText = [w.capacity, w.recommendedCapacity ? `(推奨${w.recommendedCapacity})` : ""]
      .filter(Boolean).join(" ");
    const platformText = (w.platform || []).join(" / ");
    const tagsHtml = (w.tags || [])
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
      .join("");

    const thumb = w.thumbnailUrl
      ? `<div class="card__thumb" style="background-image:url('${escapeHtml(w.thumbnailUrl)}')"></div>`
      : `<div class="card__thumb card__thumb--empty">画像なし</div>`;

    const reviewBtn = w.reviewVideoUrl
      ? `<a class="btn" href="${escapeHtml(w.reviewVideoUrl)}" target="_blank" rel="noopener">レビュー動画を見る</a>`
      : "";

    return `
      <article class="card">
        ${thumb}
        <div class="card__body">
          <h3 class="card__title">${escapeHtml(w.name || "無題のワールド")}</h3>
          <p class="card__author">${escapeHtml(w.authorName || "作者不明")}</p>
          ${w.description ? `<p class="card__desc">${escapeHtml(w.description)}</p>` : ""}

          <div class="spec-table">
            ${specRow("想定人数", capacityText)}
            ${specRow("間取り", w.layoutType)}
            ${specRow("雰囲気", w.mood)}
            ${specRow("対応機種", platformText)}
            ${specRow("最終更新", w.updatedDate)}
          </div>

          ${tagsHtml ? `<div class="card__tags">${tagsHtml}</div>` : ""}

          <div class="card__footer">
            <a class="btn btn--primary" href="${escapeHtml(w.worldUrl)}" target="_blank" rel="noopener">VRChatで見る</a>
            ${reviewBtn}
          </div>
        </div>
      </article>`;
  }

  function render() {
    const filtered = sortListings(applyFilters());

    els.resultCount.textContent = filtered.length;
    els.dataNotice.hidden = state.all.length !== 0;

    if (filtered.length === 0) {
      els.grid.innerHTML = "";
      els.emptyState.hidden = state.all.length === 0; // データが0件の時はdata-noticeで案内するので二重表示しない
    } else {
      els.emptyState.hidden = true;
      els.grid.innerHTML = filtered.map(renderCard).join("");
    }
  }

  els.searchInput.addEventListener("input", (e) => {
    state.query = e.target.value;
    render();
  });

  els.capacityMax.addEventListener("input", (e) => {
    const v = parseInt(e.target.value, 10);
    state.capacityMax = Number.isFinite(v) ? v : null;
    render();
  });

  els.sortSelect.addEventListener("change", (e) => {
    state.sort = e.target.value;
    render();
  });

  els.resetBtn.addEventListener("click", () => {
    state.tags.clear();
    state.platforms.clear();
    state.query = "";
    state.capacityMax = null;
    els.searchInput.value = "";
    els.capacityMax.value = "";
    document.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
    render();
  });

  loadData();
})();

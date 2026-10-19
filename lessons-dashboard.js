(() => {
  const dashboard = document.getElementById("lesson-dashboard");
  if (!dashboard) return;

  const searchInput = dashboard.querySelector("#lesson-search-input");
  const cards = [...dashboard.querySelectorAll(".lesson-card")];
  const status = dashboard.querySelector("#lesson-search-status");
  const emptyMessage = dashboard.querySelector("#lesson-search-empty");

  function updateLessonResults() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    let visibleCount = 0;

    cards.forEach((card) => {
      const searchableText = `${card.textContent} ${card.dataset.search || ""}`.toLocaleLowerCase();
      const matches = searchableText.includes(query);
      card.hidden = !matches;
      if (matches) visibleCount += 1;
    });

    status.textContent = `Showing ${visibleCount} ${visibleCount === 1 ? "lesson" : "lessons"}`;
    emptyMessage.hidden = visibleCount !== 0;
  }

  searchInput.addEventListener("input", updateLessonResults);
  updateLessonResults();
})();

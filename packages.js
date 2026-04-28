const packagesGrid = document.getElementById("packagesGrid");
const packagesEmpty = document.getElementById("packagesEmpty");

(async function initPackagesPage() {
  await loadPackages();
})();

function formatCurrency(value) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadPackages() {
  const { data, error } = await supabaseClient
    .from("packages")
    .select(`
      *,
      package_items (
        quantity,
        custom_name,
        furniture_items ( name )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Packages load error:", error);
    packagesGrid.innerHTML = `<p class="packages-empty">Failed to load packages.</p>`;
    return;
  }

  if (!data || !data.length) {
    packagesEmpty.hidden = false;
    return;
  }

  packagesGrid.innerHTML = data.map(pkg => {
    const items = (pkg.package_items || []).map(item => {
      const name =
        item.custom_name ||
        item.furniture_items?.name ||
        "Item";

      return `<li>${escapeHtml(name)} x${item.quantity}</li>`;
    }).join("");

    return `
      <article class="package-card" onclick="openPackage('${pkg.id}')">
        <img class="package-card-image" src="${pkg.image_url || ''}" alt="${escapeHtml(pkg.name)}">

        <div class="package-card-body">
          <div class="package-card-title">${escapeHtml(pkg.name)}</div>
          <div class="package-card-price">${formatCurrency(pkg.price)}</div>

          <div class="package-card-desc">
            ${escapeHtml(pkg.description || "")}
          </div>

          <ul class="package-card-items">
            ${items || "<li>No items listed</li>"}
          </ul>
        </div>
      </article>
    `;
  }).join("");
}

window.openPackage = function (id) {
  window.location.href = `package-detail.html?id=${id}`;
};
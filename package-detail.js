const packageDetail = document.getElementById("packageDetail");

(function initPackageDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    packageDetail.innerHTML = `<p class="package-detail-empty">Invalid package.</p>`;
    return;
  }

  loadPackage(id);
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

async function loadPackage(id) {
  const { data, error } = await supabaseClient
    .from("packages")
    .select(`
      *,
      package_items (
        quantity,
        custom_name,
        custom_price,
        furniture_items (
          name,
          description,
          image_url,
          price
        )
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error(error);
    packageDetail.innerHTML = `<p class="package-detail-empty">Failed to load package.</p>`;
    return;
  }

  renderPackage(data);
}

function renderPackage(pkg) {
  const itemsHtml = (pkg.package_items || []).map(item => {
    const furniture = item.furniture_items || {};

    const name = item.custom_name || furniture.name || "Item";
    const price = item.custom_price || furniture.price || 0;

    return `
      <div class="package-item-card">
        <img class="package-item-image" src="${furniture.image_url || ''}" alt="${escapeHtml(name)}">

        <div class="package-item-body">
          <div class="package-item-title">${escapeHtml(name)}</div>
          <div class="package-item-meta">
            ${formatCurrency(price)} · Qty ${item.quantity}
          </div>
          <div class="package-item-desc">
            ${escapeHtml(furniture.description || "")}
          </div>
        </div>
      </div>
    `;
  }).join("");

  packageDetail.innerHTML = `
    <section class="package-detail-hero">
      <img class="package-detail-image" src="${pkg.image_url || ''}" alt="${escapeHtml(pkg.name)}">

      <div class="package-detail-content">
        <p class="package-detail-kicker">Package</p>
        <h1 class="package-detail-title">${escapeHtml(pkg.name)}</h1>
        <div class="package-detail-price">${formatCurrency(pkg.price)}</div>

        <p class="package-detail-desc">
          ${escapeHtml(pkg.description || "")}
        </p>

        <div class="package-detail-actions">
          <a href="#" class="package-detail-btn">Rent Package</a>
          <a href="packages.html" class="package-detail-btn secondary">Back to Packages</a>
        </div>
      </div>
    </section>

    <section class="package-items-section">
      <div class="package-items-head">
        <p class="package-items-kicker">Included Items</p>
        <h2 class="package-items-title">What’s inside this package</h2>
      </div>

      <div class="package-items-grid">
        ${itemsHtml || "<p>No items in this package.</p>"}
      </div>
    </section>
  `;
}
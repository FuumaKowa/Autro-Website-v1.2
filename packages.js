const packagesGrid = document.getElementById("packagesGrid");
const packagesEmpty = document.getElementById("packagesEmpty");

const pkgModal = document.getElementById("pkgModal");
const pkgOverlay = document.getElementById("pkgOverlay");
const pkgClose = document.getElementById("pkgClose");

const pkgTitle = document.getElementById("pkgTitle");
const pkgMonths = document.getElementById("pkgMonths");
const pkgTotal = document.getElementById("pkgTotal");
const pkgMonthly = document.getElementById("pkgMonthly");

const pkgName = document.getElementById("pkgName");
const pkgPhone = document.getElementById("pkgPhone");
const pkgEmail = document.getElementById("pkgEmail");
const pkgAgent = document.getElementById("pkgAgent");
const pkgSubmit = document.getElementById("pkgSubmit");

let packages = [];
let activePackage = null;

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

function getPricing(price, months) {
  const rates = {
    3: 1.18,
    6: 1.24,
    12: 1.36
  };

  const total = Number(price || 0) * rates[months];
  const monthly = total / months;

  return { total, monthly };
}

async function loadPackages() {
  const { data, error } = await supabaseClient
    .from("packages")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Packages load error:", error);
    packagesGrid.innerHTML = `<p class="packages-empty">Failed to load packages.</p>`;
    return;
  }

  packages = data || [];

  if (!packages.length) {
    packagesEmpty.hidden = false;
    return;
  }

  packagesEmpty.hidden = true;

  packagesGrid.innerHTML = packages.map(pkg => `
    <article class="package-card" data-id="${escapeHtml(pkg.id)}">
      <img class="package-card-image" src="${escapeHtml(pkg.image_url || "")}" alt="${escapeHtml(pkg.name)}">

      <div class="package-card-body">
        <div class="package-card-title">${escapeHtml(pkg.name)}</div>
        <div class="package-card-price">${formatCurrency(pkg.price)}</div>

        <div class="package-card-desc">
          ${escapeHtml(pkg.description || "")}
        </div>

        <button type="button" class="package-rent-btn" data-id="${escapeHtml(pkg.id)}">
          Rent This Package
        </button>
      </div>
    </article>
  `).join("");
}

function openPackage(id) {
  activePackage = packages.find(pkg => String(pkg.id) === String(id));

  if (!activePackage) {
    console.error("Package not found:", id);
    return;
  }

  pkgTitle.textContent = activePackage.name;
  pkgMonths.value = "3";

  updatePricing();

  pkgModal.classList.add("active");
  pkgOverlay.classList.add("active");
}

function closeModal() {
  pkgModal.classList.remove("active");
  pkgOverlay.classList.remove("active");
}

function updatePricing() {
  if (!activePackage) return;

  const months = Number(pkgMonths.value);
  const pricing = getPricing(activePackage.price, months);

  pkgTotal.textContent = formatCurrency(pricing.total);
  pkgMonthly.textContent = formatCurrency(pricing.monthly);
}

async function findAgentByEmail(email) {
  if (!email) return null;

  const { data, error } = await supabaseClient
    .from("agents")
    .select("*")
    .eq("email", email)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function submitPackageOrder() {
  try {
    if (!activePackage) {
      alert("No package selected.");
      return;
    }

    if (!pkgName.value.trim() || !pkgPhone.value.trim()) {
      alert("Please enter your name and phone number.");
      return;
    }

    const months = Number(pkgMonths.value);
    const pricing = getPricing(activePackage.price, months);

    let agent = null;
    const agentEmail = pkgAgent.value.trim();

    if (agentEmail) {
      agent = await findAgentByEmail(agentEmail);
    }

    const payload = {
      customer_name: pkgName.value.trim(),
      customer_phone: pkgPhone.value.trim(),
      customer_email: pkgEmail.value.trim() || null,
      item_type: "package",
      item_id: activePackage.id,
      item_name: activePackage.name,
      rental_duration: `${months} months`,
      total_amount: pricing.total,
      payment_status: "pending",
      agent_id: agent ? agent.id : null,
      agent_code: agentEmail || null
    };

    console.log("Submitting package order:", payload);

   const { error } = await supabaseClient
  .from("rental_orders")
  .insert(payload);

    if (error) {
      console.error("Supabase insert error:", error);
      alert(error.message);
      return;
    }

    // console.log("Package order created:", data);

    alert("Package order submitted successfully.");

    pkgName.value = "";
    pkgPhone.value = "";
    pkgEmail.value = "";
    pkgAgent.value = "";

    closeModal();
  } catch (error) {
    console.error("Package submit error:", error);
    alert(error.message || "Failed to submit package order.");
  }
}

packagesGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".package-card");
  const button = event.target.closest(".package-rent-btn");

  const target = button || card;
  if (!target) return;

  openPackage(target.dataset.id);
});

pkgMonths.addEventListener("change", updatePricing);
pkgClose.addEventListener("click", closeModal);
pkgOverlay.addEventListener("click", closeModal);
pkgSubmit.addEventListener("click", submitPackageOrder);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
  }
});

loadPackages();
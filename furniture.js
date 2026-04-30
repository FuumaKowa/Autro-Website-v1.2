const grid = document.getElementById("grid");
const category = document.getElementById("category");
const sort = document.getElementById("sort");

const productPanel = document.getElementById("productPanel");
const productOverlay = document.getElementById("productOverlay");
const panelCloseBtn = document.getElementById("panelCloseBtn");
const panelBackBtn = document.getElementById("panelBackBtn");
const panelProceedBtn = document.getElementById("panelProceedBtn");
const rentalPeriod = document.getElementById("rentalPeriod");

const panelImage = document.getElementById("panelImage");
const panelTitle = document.getElementById("panelTitle");
const panelDescription = document.getElementById("panelDescription");
const panelBasePrice = document.getElementById("panelBasePrice");
const monthlyPayment = document.getElementById("monthlyPayment");
const totalPayment = document.getElementById("totalPayment");

const checkoutModal = document.getElementById("checkoutModal");
const checkoutOverlay = document.getElementById("checkoutOverlay");
const checkoutCloseBtn = document.getElementById("checkoutCloseBtn");
const checkoutBackBtn = document.getElementById("checkoutBackBtn");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutMessage = document.getElementById("checkoutMessage");

const summaryImage = document.getElementById("summaryImage");
const summaryTitle = document.getElementById("summaryTitle");
const summaryDescription = document.getElementById("summaryDescription");
const summaryRetail = document.getElementById("summaryRetail");
const summaryMonths = document.getElementById("summaryMonths");
const summaryMonthly = document.getElementById("summaryMonthly");
const summaryTotal = document.getElementById("summaryTotal");

const fullNameInput = document.getElementById("fullName");
const emailAddressInput = document.getElementById("emailAddress");
const phoneNumberInput = document.getElementById("phoneNumber");
const rentalStartDateInput = document.getElementById("rentalStartDate");
const homeAddressInput = document.getElementById("homeAddress");
const notesInput = document.getElementById("notes");
const agentCodeInput = document.getElementById("agentCode");

let products = [];
let activeProduct = null;

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

function normalizeProduct(row) {
  return {
    id: row.id,
    name: row.name || "Unnamed Item",
    price: Number(row.price) || 0,
    category: row.category || "living",
    description: row.description || "",
    img: row.image_url || "",
    markupRates: {
      3: 1.18,
      6: 1.24,
      12: 1.36
    }
  };
}

function getPricing(product, months) {
  const rate = product.markupRates[months] || 1;
  const total = product.price * rate;
  const monthly = total / months;

  return {
    total,
    monthly
  };
}

function setCheckoutMessage(message, isError = false) {
  checkoutMessage.textContent = message;
  checkoutMessage.style.color = isError ? "#9d4a3f" : "";
}

function updatePanelPricing() {
  if (!activeProduct) return;

  const months = Number(rentalPeriod.value);
  const pricing = getPricing(activeProduct, months);

  monthlyPayment.textContent = formatCurrency(pricing.monthly);
  totalPayment.textContent = formatCurrency(pricing.total);
}

function updateCheckoutSummary() {
  if (!activeProduct) return;

  const months = Number(rentalPeriod.value);
  const pricing = getPricing(activeProduct, months);

  summaryImage.src = activeProduct.img;
  summaryImage.alt = activeProduct.name;
  summaryTitle.textContent = activeProduct.name;
  summaryDescription.textContent = activeProduct.description;
  summaryRetail.textContent = formatCurrency(activeProduct.price);
  summaryMonths.textContent = `${months} Months`;
  summaryMonthly.textContent = formatCurrency(pricing.monthly);
  summaryTotal.textContent = formatCurrency(pricing.total);
}

function openProductPanel(productId) {
  activeProduct = products.find((item) => String(item.id) === String(productId));

  if (!activeProduct) return;

  panelImage.src = activeProduct.img;
  panelImage.alt = activeProduct.name;
  panelTitle.textContent = activeProduct.name;
  panelDescription.textContent = activeProduct.description;
  panelBasePrice.textContent = formatCurrency(activeProduct.price);

  rentalPeriod.value = "3";
  updatePanelPricing();

  productPanel.classList.add("active");
  productOverlay.classList.add("active");
  productPanel.setAttribute("aria-hidden", "false");
}

function closeProductPanel() {
  productPanel.classList.remove("active");
  productOverlay.classList.remove("active");
  productPanel.setAttribute("aria-hidden", "true");
}

function openCheckoutModal() {
  if (!activeProduct) return;

  updateCheckoutSummary();
  setCheckoutMessage("");

  checkoutModal.classList.add("active");
  checkoutOverlay.classList.add("active");
  checkoutModal.setAttribute("aria-hidden", "false");
}

function closeCheckoutModal() {
  checkoutModal.classList.remove("active");
  checkoutOverlay.classList.remove("active");
  checkoutModal.setAttribute("aria-hidden", "true");
}

async function findAgentByEmail(email) {
  if (!email) return null;

  const { data, error } = await supabaseClient
    .from("agents")
    .select("id, email, is_active")
    .eq("email", email)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function createRentalOrder(payload) {
  const { error } = await supabaseClient
    .from("rental_orders")
    .insert(payload);

  if (error) throw error;
}

async function handleCheckoutSubmit(event) {
  event.preventDefault();

  if (!activeProduct) {
    setCheckoutMessage("No furniture item selected.", true);
    return;
  }

  const customerName = fullNameInput.value.trim();
  const customerEmail = emailAddressInput.value.trim();
  const customerPhone = phoneNumberInput.value.trim();
  const rentalStartDate = rentalStartDateInput.value;
  const homeAddress = homeAddressInput.value.trim();
  const notes = notesInput.value.trim();
  const agentEmail = agentCodeInput.value.trim();

  if (!customerName || !customerPhone || !homeAddress || !rentalStartDate) {
    setCheckoutMessage("Please complete all required fields.", true);
    return;
  }

  const submitButton = checkoutForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Submitting...";

  try {
    setCheckoutMessage("Submitting...");

    const months = Number(rentalPeriod.value);
    const pricing = getPricing(activeProduct, months);

    let agent = null;

    if (agentEmail) {
      agent = await findAgentByEmail(agentEmail);
    }

    await createRentalOrder({
      customer_name: customerName,
      customer_email: customerEmail || null,
      customer_phone: customerPhone,
      item_type: "furniture",
      item_id: activeProduct.id,
      item_name: activeProduct.name,
      rental_duration: `${months} months`,
      total_amount: pricing.total,
      payment_status: "pending",
      agent_id: agent ? agent.id : null,
      agent_code: agentEmail || null,
      notes: [
        rentalStartDate ? `Rental start date: ${rentalStartDate}` : "",
        homeAddress ? `Address: ${homeAddress}` : "",
        notes ? `Notes: ${notes}` : ""
      ].filter(Boolean).join("\n")
    });

    setCheckoutMessage("Order submitted successfully.");
    checkoutForm.reset();
  } catch (error) {
    console.error("Furniture order submit error:", error);
    setCheckoutMessage(error.message || "Failed to submit order.", true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit Request";
  }
}

async function loadFurniture() {
  const { data, error } = await supabaseClient
    .from("furniture_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Furniture load error:", error);
    grid.innerHTML = `<p class="catalog-empty">Failed to load furniture items.</p>`;
    return;
  }

  products = (data || []).map(normalizeProduct);
  update();
}

function render(list) {
  grid.innerHTML = "";

  if (!list.length) {
    grid.innerHTML = `<p class="catalog-empty">No furniture items found.</p>`;
    return;
  }

  grid.innerHTML = list.map((product) => `
    <article class="browse-card" data-id="${escapeHtml(product.id)}">
      <div class="img-box">
        <img src="${escapeHtml(product.img)}" alt="${escapeHtml(product.name)}">
      </div>

      <div class="browse-card-title-row">
        <h3>${escapeHtml(product.name)}</h3>
        <span class="browse-card-action">View</span>
      </div>

      <p>${formatCurrency(product.price)}</p>
    </article>
  `).join("");
}

function update() {
  let filtered = [...products];

  if (category.value !== "all") {
    filtered = filtered.filter((product) => product.category === category.value);
  }

  if (sort.value === "low") {
    filtered.sort((a, b) => a.price - b.price);
  }

  if (sort.value === "high") {
    filtered.sort((a, b) => b.price - a.price);
  }

  render(filtered);
}

grid.addEventListener("click", (event) => {
  const card = event.target.closest(".browse-card");
  if (!card) return;

  openProductPanel(card.dataset.id);
});

checkoutForm.addEventListener("submit", handleCheckoutSubmit);

panelCloseBtn.addEventListener("click", closeProductPanel);
panelBackBtn.addEventListener("click", closeProductPanel);
productOverlay.addEventListener("click", closeProductPanel);

panelProceedBtn.addEventListener("click", openCheckoutModal);

checkoutCloseBtn.addEventListener("click", closeCheckoutModal);
checkoutBackBtn.addEventListener("click", closeCheckoutModal);
checkoutOverlay.addEventListener("click", closeCheckoutModal);

rentalPeriod.addEventListener("change", () => {
  updatePanelPricing();
  updateCheckoutSummary();
});

category.addEventListener("change", update);
sort.addEventListener("change", update);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeProductPanel();
    closeCheckoutModal();
  }
});

loadFurniture();
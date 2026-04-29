const supabaseUrl = "https://yygbmcvgdvsepdiwsixz.supabase.co";
const supabaseKey = "sb_publishable_ebPXA2OwzrR5bIlRsEVNcg_a2R4Dui5";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

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

function normalizeProduct(row) {
  return {
    id: row.id,
    name: row.name,
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
  const rate = product.markupRates[months];
  const total = product.price * rate;
  const monthly = total / months;
  return { total, monthly };
}

function setCheckoutMessage(message, isError = false) {
  checkoutMessage.textContent = message;
  checkoutMessage.style.color = isError ? "#9d4a3f" : "";
}

function updatePanelPricing() {
  const months = Number(rentalPeriod.value);
  const pricing = getPricing(activeProduct, months);
  monthlyPayment.textContent = formatCurrency(pricing.monthly);
  totalPayment.textContent = formatCurrency(pricing.total);
}

function updateCheckoutSummary() {
  const months = Number(rentalPeriod.value);
  const pricing = getPricing(activeProduct, months);

  summaryImage.src = activeProduct.img;
  summaryTitle.textContent = activeProduct.name;
  summaryDescription.textContent = activeProduct.description;
  summaryRetail.textContent = formatCurrency(activeProduct.price);
  summaryMonths.textContent = `${months} Months`;
  summaryMonthly.textContent = formatCurrency(pricing.monthly);
  summaryTotal.textContent = formatCurrency(pricing.total);
}

function openProductPanel(productId) {
  activeProduct = products.find((item) => item.id === productId);

  panelImage.src = activeProduct.img;
  panelTitle.textContent = activeProduct.name;
  panelDescription.textContent = activeProduct.description;
  panelBasePrice.textContent = formatCurrency(activeProduct.price);

  rentalPeriod.value = "3";
  updatePanelPricing();

  productPanel.classList.add("active");
  productOverlay.classList.add("active");
}

function closeProductPanel() {
  productPanel.classList.remove("active");
  productOverlay.classList.remove("active");
}

function openCheckoutModal() {
  updateCheckoutSummary();
  checkoutModal.classList.add("active");
  checkoutOverlay.classList.add("active");
}

function closeCheckoutModal() {
  checkoutModal.classList.remove("active");
  checkoutOverlay.classList.remove("active");
}

async function findAgentByEmail(email) {
  if (!email) return null;

  const { data } = await supabaseClient
    .from("agents")
    .select("*")
    .eq("email", email)
    .eq("is_active", true)
    .maybeSingle();

  return data;
}

async function createRentalOrder(payload) {
  const { data, error } = await supabaseClient
    .from("rental_orders")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  setCheckoutMessage("Submitting...");

  try {
    const months = Number(rentalPeriod.value);
    const pricing = getPricing(activeProduct, months);

    let agent = null;
    const agentEmail = agentCodeInput.value.trim();

    if (agentEmail) {
      agent = await findAgentByEmail(agentEmail);
    }

    const orderPayload = {
      customer_name: fullNameInput.value.trim(),
      customer_email: emailAddressInput.value.trim(),
      customer_phone: phoneNumberInput.value.trim(),
      item_type: "furniture",
      item_id: activeProduct.id,
      item_name: activeProduct.name,
      rental_duration: `${months} months`,
      total_amount: pricing.total,
      payment_status: "pending",
      agent_id: agent ? agent.id : null,
      agent_code: agentEmail || null,
      notes: notesInput.value.trim()
    };

    await createRentalOrder(orderPayload);

    setCheckoutMessage("Order submitted successfully.");
    checkoutForm.reset();

  } catch (error) {
    console.error(error);
    setCheckoutMessage("Failed to submit order.", true);
  }
});

panelCloseBtn.onclick = closeProductPanel;
panelBackBtn.onclick = closeProductPanel;
productOverlay.onclick = closeProductPanel;

panelProceedBtn.onclick = openCheckoutModal;

checkoutCloseBtn.onclick = closeCheckoutModal;
checkoutBackBtn.onclick = closeCheckoutModal;
checkoutOverlay.onclick = closeCheckoutModal;

rentalPeriod.addEventListener("change", () => {
  updatePanelPricing();
  updateCheckoutSummary();
});

category.addEventListener("change", update);
sort.addEventListener("change", update);

async function loadFurniture() {
  const { data } = await supabaseClient
    .from("furniture_items")
    .select("*");

  products = (data || []).map(normalizeProduct);
  update();
}

function render(list) {
  grid.innerHTML = "";

  if (!list.length) {
    grid.innerHTML = `<p class="catalog-empty">No furniture items found.</p>`;
    return;
  }

  list.forEach((product) => {
    grid.innerHTML += `
      <article class="browse-card" data-id="${product.id}">
        <div class="img-box">
          <img src="${product.img}" alt="${product.name}">
        </div>

        <div class="browse-card-title-row">
          <h3>${product.name}</h3>
          <span class="browse-card-action">View</span>
        </div>

        <p>${formatCurrency(product.price)}</p>
      </article>
    `;
  });

  document.querySelectorAll(".browse-card").forEach((card) => {
    card.addEventListener("click", () => {
      openProductPanel(card.dataset.id);
    });
  });
}

function update() {
  let filtered = [...products];

  if (category.value !== "all") {
    filtered = filtered.filter(p => p.category === category.value);
  }

  if (sort.value === "low") filtered.sort((a,b)=>a.price-b.price);
  if (sort.value === "high") filtered.sort((a,b)=>b.price-a.price);

  render(filtered);
}

loadFurniture();
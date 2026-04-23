const supabaseUrl = "https://yygbmcvgdvsepdiwsixz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5Z2JtY3ZnZHZzZXBkaXdzaXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDAyNTgsImV4cCI6MjA5MjQxNjI1OH0.bN3o0WixWBlfZ2-WpfeK1A5zPCUhrcvLot4rxsdoGEc";
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
  const number = Number(value) || 0;
  return `RM ${number.toFixed(2)}`;
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
  activeProduct = products.find((item) => item.id === productId);
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
  document.body.classList.add("panel-open");
}

function closeProductPanel() {
  productPanel.classList.remove("active");
  productOverlay.classList.remove("active");
  productPanel.setAttribute("aria-hidden", "true");

  if (!checkoutModal.classList.contains("active")) {
    document.body.classList.remove("panel-open");
  }
}

function openCheckoutModal() {
  if (!activeProduct) return;

  updateCheckoutSummary();
  checkoutModal.classList.add("active");
  checkoutOverlay.classList.add("active");
  checkoutModal.setAttribute("aria-hidden", "false");
  setCheckoutMessage("");
  document.body.classList.add("panel-open");
}

function closeCheckoutModal() {
  checkoutModal.classList.remove("active");
  checkoutOverlay.classList.remove("active");
  checkoutModal.setAttribute("aria-hidden", "true");

  if (!productPanel.classList.contains("active")) {
    document.body.classList.remove("panel-open");
  }
}

function render(list) {
  grid.innerHTML = "";

  if (!list.length) {
    grid.innerHTML = `<p class="catalog-empty">No items found.</p>`;
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

async function loadFurniture() {
  const { data, error } = await supabaseClient
    .from("furniture_items")
    .select("*")
    .order("created_at", { ascending: false });

  console.log("Supabase data:", data);
  console.log("Supabase error:", error);

  if (error) {
    console.error("Supabase load error:", error.message, error);
    grid.innerHTML = `<p class="catalog-empty">Failed to load catalog.</p>`;
    return;
  }

  products = (data || []).map(normalizeProduct);
  console.log("Normalized products:", products);
  update();
}

async function findAgentByEmail(email) {
  if (!email) return null;

  const { data, error } = await supabaseClient
    .from("agents")
    .select("*")
    .eq("email", email)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function createCustomer(payload) {
  const { data, error } = await supabaseClient
    .from("customers")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function createOrder(payload) {
  const { data, error } = await supabaseClient
    .from("orders")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function createCommission(payload) {
  const { data, error } = await supabaseClient
    .from("commissions")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

category.addEventListener("change", update);
sort.addEventListener("change", update);

rentalPeriod.addEventListener("change", () => {
  updatePanelPricing();

  if (checkoutModal.classList.contains("active")) {
    updateCheckoutSummary();
  }
});

panelCloseBtn.addEventListener("click", closeProductPanel);
panelBackBtn.addEventListener("click", closeProductPanel);
productOverlay.addEventListener("click", closeProductPanel);

panelProceedBtn.addEventListener("click", openCheckoutModal);

checkoutCloseBtn.addEventListener("click", closeCheckoutModal);
checkoutBackBtn.addEventListener("click", closeCheckoutModal);
checkoutOverlay.addEventListener("click", closeCheckoutModal);

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!activeProduct) return;

  setCheckoutMessage("Submitting...");

  try {
    const months = Number(rentalPeriod.value);
    const pricing = getPricing(activeProduct, months);

    const payload = {
      full_name: fullNameInput.value.trim(),
      email: emailAddressInput.value.trim(),
      phone: phoneNumberInput.value.trim(),
      address: homeAddressInput.value.trim(),
      rental_start_date: rentalStartDateInput.value,
      notes: notesInput.value.trim(),
      agent_email: agentCodeInput ? agentCodeInput.value.trim() : "",
      product_id: activeProduct.id,
      product_name: activeProduct.name,
      product_price: activeProduct.price,
      rental_months: months,
      monthly_payment: pricing.monthly,
      total_payment: pricing.total
    };

    const res = await fetch("https://yygbmcvgdvsepdiwsixz.functions.supabase.co/submit-rental-request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to submit request.");
    }

    localStorage.setItem("autro-rental-request", JSON.stringify({
      ...payload,
      order_id: data.order_id,
      customer_id: data.customer_id
    }));

    setCheckoutMessage("Request submitted successfully.");
    checkoutForm.reset();
  } catch (error) {
    console.error("Checkout submit error:", error);
    setCheckoutMessage(error.message || "Failed to submit request.", true);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCheckoutModal();
    closeProductPanel();
  }
});

loadFurniture();
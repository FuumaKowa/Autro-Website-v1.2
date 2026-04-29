const agentNameHeading = document.getElementById("agentNameHeading");
const totalCommission = document.getElementById("totalCommission");
const totalSales = document.getElementById("totalSales");
const totalRevenue = document.getElementById("totalRevenue");
const commissionRate = document.getElementById("commissionRate");
const salesTableBody = document.getElementById("salesTableBody");
const salesEmpty = document.getElementById("salesEmpty");
const logoutBtn = document.getElementById("logoutBtn");

const agentDashboard = document.getElementById("agentDashboard");
const agentInquiriesList = document.getElementById("agentInquiriesList");
const agentInquiriesEmpty = document.getElementById("agentInquiriesEmpty");

let packagesCache = [];
let furnitureCache = [];

function formatCurrency(value) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-MY");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadReferenceData() {
  const [packagesResult, furnitureResult] = await Promise.all([
    supabaseClient.from("packages").select("*"),
    supabaseClient.from("furniture_items").select("*")
  ]);

  packagesCache = packagesResult.data || [];
  furnitureCache = furnitureResult.data || [];
}

async function loadAgentInquiries(agentId) {
  const { data, error } = await supabaseClient
    .from("inquiries")
    .select("*")
    .eq("assigned_agent_id", agentId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
}

function getInquiryItem(inquiry) {
  if (inquiry.type === "package") {
    const item = packagesCache.find((pkg) => pkg.id === inquiry.item_id);

    return {
      name: item?.name || "Unknown package",
      price: item?.price || 0,
      image: item?.image_url || "",
      typeLabel: "Package"
    };
  }

  if (inquiry.type === "furniture") {
    const item = furnitureCache.find((furniture) => furniture.id === inquiry.item_id);

    return {
      name: item?.name || "Unknown furniture",
      price: item?.price || 0,
      image: item?.image_url || "",
      typeLabel: "Furniture"
    };
  }

  return {
    name: "Unknown item",
    price: 0,
    image: "",
    typeLabel: "Unknown"
  };
}

function renderAgentInquiries(inquiries) {
  agentInquiriesList.innerHTML = "";

  if (!inquiries.length) {
    agentInquiriesEmpty.hidden = false;
    return;
  }

  agentInquiriesEmpty.hidden = true;

  agentInquiriesList.innerHTML = inquiries.map((inquiry) => {
    const item = getInquiryItem(inquiry);

    return `
      <article class="agent-inquiry-card">
        <div class="agent-inquiry-head">
          <div>
            <div class="agent-inquiry-title">${escapeHtml(inquiry.customer_name)}</div>
            <div class="agent-inquiry-meta">
              ${escapeHtml(item.typeLabel)} · ${formatDate(inquiry.created_at)}
            </div>
          </div>

          <div class="agent-inquiry-status">${escapeHtml(inquiry.status || "new")}</div>
        </div>

        <div class="agent-inquiry-body">
          <div class="agent-inquiry-info">
            <div class="agent-inquiry-label">Phone</div>
            <div class="agent-inquiry-value">${escapeHtml(inquiry.phone)}</div>
          </div>

          <div class="agent-inquiry-info">
            <div class="agent-inquiry-label">Email</div>
            <div class="agent-inquiry-value">${escapeHtml(inquiry.email || "-")}</div>
          </div>

          <div class="agent-inquiry-info">
            <div class="agent-inquiry-label">Rental Duration</div>
            <div class="agent-inquiry-value">${Number(inquiry.rental_months || 1)} month(s)</div>
          </div>

          <div class="agent-inquiry-info">
            <div class="agent-inquiry-label">Inquiry ID</div>
            <div class="agent-inquiry-value">${escapeHtml(inquiry.id)}</div>
          </div>

          <div class="agent-inquiry-info full">
            <div class="agent-inquiry-label">Address</div>
            <div class="agent-inquiry-value">${escapeHtml(inquiry.address)}</div>
          </div>

          <div class="agent-inquiry-info full">
            <div class="agent-inquiry-label">Notes</div>
            <div class="agent-inquiry-value">${escapeHtml(inquiry.notes || "-")}</div>
          </div>
        </div>

        <div class="agent-inquiry-item">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">
          <div>
            <div class="agent-inquiry-item-title">${escapeHtml(item.name)}</div>
            <div class="agent-inquiry-item-meta">
              ${escapeHtml(item.typeLabel)} · ${formatCurrency(item.price)}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

async function loadAgentSales(agentId) {
  const { data: commissions, error: commissionError } = await supabaseClient
    .from("commissions")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (commissionError) throw commissionError;
  if (!commissions || !commissions.length) return [];

  const orderIds = commissions.map((item) => item.order_id);

  const { data: orders, error: orderError } = await supabaseClient
    .from("orders")
    .select("*")
    .in("id", orderIds);

  if (orderError) throw orderError;

  const customerIds = (orders || [])
    .map((order) => order.customer_id)
    .filter(Boolean);

  const { data: customers, error: customerError } = await supabaseClient
    .from("customers")
    .select("*")
    .in("id", customerIds);

  if (customerError) throw customerError;

  return commissions.map((commission) => {
    const order = (orders || []).find((o) => o.id === commission.order_id) || null;
    const customer = order
      ? (customers || []).find((c) => c.id === order.customer_id) || null
      : null;

    return {
      ...commission,
      order,
      customer
    };
  });
}

function renderAgentDashboard(agent, sales) {
  agentNameHeading.textContent = agent.full_name;
  commissionRate.textContent = `${Number(agent.commission_rate || 0).toFixed(2)}%`;

  const totalCommissionValue = sales.reduce(
    (sum, item) => sum + Number(item.commission_amount || 0),
    0
  );

  const totalRevenueValue = sales.reduce(
    (sum, item) => sum + Number(item.order?.total_payment || 0),
    0
  );

  totalCommission.textContent = formatCurrency(totalCommissionValue);
  totalRevenue.textContent = formatCurrency(totalRevenueValue);
  totalSales.textContent = String(sales.length);

  salesTableBody.innerHTML = "";

  if (!sales.length) {
    salesEmpty.hidden = false;
    return;
  }

  salesEmpty.hidden = true;

  sales.forEach((item) => {
    const order = item.order || {};
    const customer = item.customer || {};

    salesTableBody.innerHTML += `
      <tr>
        <td>${formatDate(order.created_at || item.created_at)}</td>
        <td>${escapeHtml(customer.full_name || "-")}</td>
        <td>${escapeHtml(order.product_name || "-")}</td>
        <td>${order.rental_months || "-"}</td>
        <td>${formatCurrency(order.total_payment)}</td>
        <td>${formatCurrency(item.commission_amount)}</td>
      </tr>
    `;
  });
}

(async function initAgentDashboard() {
  const result = await requireAgent();
  if (!result) return;

  logoutBtn.addEventListener("click", async () => {
    await signOutUser();
    window.location.href = "agent-login.html";
  });

  try {
    const agent = result.agent;

    await loadReferenceData();

    const [sales, inquiries] = await Promise.all([
      loadAgentSales(agent.id),
      loadAgentInquiries(agent.id)
    ]);

    renderAgentDashboard(agent, sales);
    renderAgentInquiries(inquiries);

    agentDashboard.hidden = false;
  } catch (error) {
    console.error("Agent dashboard error:", error);
  }
})();
const agentNameHeading = document.getElementById("agentNameHeading");
const totalCommission = document.getElementById("totalCommission");
const totalSales = document.getElementById("totalSales");
const totalRevenue = document.getElementById("totalRevenue");
const commissionRate = document.getElementById("commissionRate");
const salesTableBody = document.getElementById("salesTableBody");
const salesEmpty = document.getElementById("salesEmpty");
const logoutBtn = document.getElementById("logoutBtn");
const agentDashboard = document.getElementById("agentDashboard");

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

async function loadAgentSales(agentId) {
  const { data, error } = await supabaseClient
    .from("commissions")
    .select(`
      *,
      rental_orders (
        id,
        customer_name,
        customer_phone,
        customer_email,
        item_type,
        item_name,
        rental_duration,
        total_amount,
        payment_status,
        created_at
      )
    `)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
}

function renderAgentDashboard(agent, sales) {
  agentNameHeading.textContent = agent.full_name || "Agent Dashboard";
  commissionRate.textContent = `${Number(agent.commission_rate || 0).toFixed(2)}%`;

  const totalCommissionValue = sales.reduce(
    (sum, item) => sum + Number(item.commission_amount || 0),
    0
  );

  const totalRevenueValue = sales.reduce(
    (sum, item) => sum + Number(item.rental_orders?.total_amount || 0),
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
    const order = item.rental_orders || {};

    salesTableBody.innerHTML += `
      <tr>
        <td>${formatDate(order.created_at || item.created_at)}</td>
        <td>${escapeHtml(order.customer_name || "-")}</td>
        <td>${escapeHtml(order.item_name || "-")}</td>
        <td>${escapeHtml(order.rental_duration || "-")}</td>
        <td>${formatCurrency(order.total_amount)}</td>
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
    const sales = await loadAgentSales(agent.id);

    renderAgentDashboard(agent, sales);
    agentDashboard.hidden = false;
  } catch (error) {
    console.error("Agent dashboard error:", error);
  }
})();
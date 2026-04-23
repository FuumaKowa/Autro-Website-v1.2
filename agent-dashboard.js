const supabaseUrl = "https://yygbmcvgdvsepdiwsixz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5Z2JtY3ZnZHZzZXBkaXdzaXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDAyNTgsImV4cCI6MjA5MjQxNjI1OH0.bN3o0WixWBlfZ2-WpfeK1A5zPCUhrcvLot4rxsdoGEc";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const agentNameHeading = document.getElementById("agentNameHeading");
const totalCommission = document.getElementById("totalCommission");
const totalSales = document.getElementById("totalSales");
const totalRevenue = document.getElementById("totalRevenue");
const commissionRate = document.getElementById("commissionRate");
const salesTableBody = document.getElementById("salesTableBody");
const salesEmpty = document.getElementById("salesEmpty");
const logoutBtn = document.getElementById("logoutBtn");

function formatCurrency(value) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-MY");
}

async function loadAgentSales(agentId) {
  const { data: commissions, error: commissionError } = await supabaseClient
    .from("commissions")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  console.log("Commissions:", commissions);
  console.log("Commission error:", commissionError);

  if (commissionError) throw commissionError;
  if (!commissions || !commissions.length) return [];

  const orderIds = commissions.map((item) => item.order_id);

  const { data: orders, error: orderError } = await supabaseClient
    .from("orders")
    .select("*")
    .in("id", orderIds);

  console.log("Orders:", orders);
  console.log("Order error:", orderError);

  if (orderError) throw orderError;

  const customerIds = (orders || []).map((order) => order.customer_id).filter(Boolean);

  const { data: customers, error: customerError } = await supabaseClient
    .from("customers")
    .select("*")
    .in("id", customerIds);

  console.log("Customers:", customers);
  console.log("Customer error:", customerError);

  if (customerError) throw customerError;

  return commissions.map((commission) => {
    const order = (orders || []).find((o) => o.id === commission.order_id) || null;
    const customer = order ? (customers || []).find((c) => c.id === order.customer_id) || null : null;

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

  const totalCommissionValue = sales.reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);
  const totalRevenueValue = sales.reduce((sum, item) => sum + Number(item.order?.total_payment || 0), 0);

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
        <td>${customer.full_name || "-"}</td>
        <td>${order.product_name || "-"}</td>
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
    const sales = await loadAgentSales(agent.id);
    console.log("Final sales data:", sales);
    renderAgentDashboard(agent, sales);
    document.getElementById("agentLoginCard")?.remove();
    document.getElementById("agentDashboard").hidden = false;
  } catch (error) {
    console.error("Agent dashboard error:", error);
  }
})();
(async function initAdminAgentsPage() {
  const result = await requireAdmin();
  if (!result) return;

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOutUser();
    window.location.href = "admin-login.html";
  });

  loadAgents();
})();

const agentsList = document.getElementById("agentsList");
const detailTitle = document.getElementById("detailTitle");
const detailSubtitle = document.getElementById("detailSubtitle");
const detailTotalCommission = document.getElementById("detailTotalCommission");
const detailTotalSales = document.getElementById("detailTotalSales");
const detailTotalRevenue = document.getElementById("detailTotalRevenue");
const detailCommissionRate = document.getElementById("detailCommissionRate");
const detailTableBody = document.getElementById("detailTableBody");
const detailEmpty = document.getElementById("detailEmpty");
const detailTableWrap = document.getElementById("detailTableWrap");
const agentDetailStats = document.getElementById("agentDetailStats");
const logoutBtn = document.getElementById("logoutBtn");

let agentsCache = [];
let agentSalesCache = {};

function formatCurrency(value) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-MY");
}

async function loadAgents() {
  const { data, error } = await supabaseClient
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    agentsList.innerHTML = `<p class="agent-detail-empty">Failed to load agents.</p>`;
    return;
  }

  agentsCache = data || [];
  renderAgentsList();
}

async function loadAgentSales(agentId) {
  if (agentSalesCache[agentId]) return agentSalesCache[agentId];

  const { data, error } = await supabaseClient
    .from("commissions")
    .select(`
      id,
      commission_rate,
      commission_amount,
      created_at,
      orders (
        id,
        product_name,
        rental_months,
        total_payment,
        created_at,
        customers (
          full_name,
          email,
          phone
        )
      )
    `)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  agentSalesCache[agentId] = data || [];
  return agentSalesCache[agentId];
}

function renderAgentsList() {
  if (!agentsCache.length) {
    agentsList.innerHTML = `<p class="agent-detail-empty">No agents found.</p>`;
    return;
  }

  agentsList.innerHTML = agentsCache.map((agent) => `
    <article class="agent-list-item" data-id="${agent.id}">
      <div class="agent-list-name">${agent.full_name}</div>
      <div class="agent-list-meta">${agent.email}</div>
      <div class="agent-list-summary">Rate: ${Number(agent.commission_rate || 0).toFixed(2)}%</div>
    </article>
  `).join("");

  document.querySelectorAll(".agent-list-item").forEach((item) => {
    item.addEventListener("click", async () => {
      document.querySelectorAll(".agent-list-item").forEach((card) => card.classList.remove("active"));
      item.classList.add("active");

      const agentId = item.dataset.id;
      const agent = agentsCache.find((entry) => entry.id === agentId);
      if (!agent) return;

      try {
        const sales = await loadAgentSales(agentId);
        renderAgentDetails(agent, sales);
      } catch (error) {
        console.error(error);
      }
    });
  });
}

function renderAgentDetails(agent, sales) {
  detailTitle.textContent = agent.full_name;
  detailSubtitle.textContent = `${agent.email} · ${agent.phone || "No phone"}`;
  detailCommissionRate.textContent = `${Number(agent.commission_rate || 0).toFixed(2)}%`;

  const totalCommissionValue = sales.reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);
  const totalRevenueValue = sales.reduce((sum, item) => sum + Number(item.orders?.total_payment || 0), 0);

  detailTotalCommission.textContent = formatCurrency(totalCommissionValue);
  detailTotalRevenue.textContent = formatCurrency(totalRevenueValue);
  detailTotalSales.textContent = String(sales.length);

  agentDetailStats.hidden = false;
  detailTableWrap.hidden = false;
  detailEmpty.hidden = true;
  detailTableBody.innerHTML = "";

  if (!sales.length) {
    detailEmpty.textContent = "No sales found for this agent.";
    detailEmpty.hidden = false;
    detailTableWrap.hidden = true;
    return;
  }

  sales.forEach((item) => {
    const order = item.orders || {};
    const customer = order.customers || {};

    detailTableBody.innerHTML += `
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

const createForm = document.getElementById("createAgentForm");
const createMsg = document.getElementById("createAgentMsg");

createForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  createMsg.textContent = "Creating...";

  try {
    const res = await fetch("https://yygbmcvgdvsepdiwsixz.functions.supabase.co/create-agent", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    full_name: document.getElementById("agentName").value,
    email: document.getElementById("agentEmail").value,
    password: document.getElementById("agentPassword").value,
    phone: document.getElementById("agentPhone").value,
    commission_rate: parseFloat(document.getElementById("agentRate").value)
  })
});

    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    createMsg.textContent = "Agent created successfully";

    createForm.reset();
    loadAgents(); // refresh list

  } catch (err) {
    createMsg.textContent = err.message;
  }
});

logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem("autro-admin");
  window.location.href = "index.html";
});

loadAgents();
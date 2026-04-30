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

const createForm = document.getElementById("createAgentForm");
const createMsg = document.getElementById("createAgentMsg");
const agentName = document.getElementById("agentName");
const agentEmail = document.getElementById("agentEmail");
const agentPassword = document.getElementById("agentPassword");
const agentPhone = document.getElementById("agentPhone");
const agentRate = document.getElementById("agentRate");

let agentsCache = [];
let agentSalesCache = {};

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

function setCreateMessage(message, isError = false) {
  createMsg.textContent = message;
  createMsg.style.color = isError ? "#9d4a3f" : "";
}

(async function initAdminAgentsPage() {
  const result = await requireAdmin();
  if (!result) return;

  logoutBtn.addEventListener("click", async () => {
    await signOutUser();
    window.location.href = "admin-login.html";
  });

  createForm.addEventListener("submit", handleCreateAgent);

  await loadAgents();
})();

async function loadAgents() {
  const { data, error } = await supabaseClient
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Agents load error:", error);
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
      order_id,
      agent_id,
      commission_rate,
      commission_amount,
      status,
      created_at,
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
        agent_code,
        created_at
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
    <article class="agent-list-item" data-id="${escapeHtml(agent.id)}">
      <div class="agent-list-name">${escapeHtml(agent.full_name)}</div>
      <div class="agent-list-meta">${escapeHtml(agent.email)}</div>
      <div class="agent-list-summary">
        Rate: ${Number(agent.commission_rate || 0).toFixed(2)}%
        ${agent.is_active ? "" : " · Inactive"}
      </div>
    </article>
  `).join("");

  document.querySelectorAll(".agent-list-item").forEach((item) => {
    item.addEventListener("click", () => handleAgentSelection(item));
  });
}

async function handleAgentSelection(item) {
  document.querySelectorAll(".agent-list-item").forEach((card) => {
    card.classList.remove("active");
  });

  item.classList.add("active");

  const agentId = item.dataset.id;
  const agent = agentsCache.find((entry) => String(entry.id) === String(agentId));

  if (!agent) return;

  try {
    detailEmpty.textContent = "Loading agent sales...";
    detailEmpty.hidden = false;
    detailTableWrap.hidden = true;

    const sales = await loadAgentSales(agentId);
    renderAgentDetails(agent, sales);
  } catch (error) {
    console.error("Agent sales load error:", error);
    detailEmpty.textContent = error.message || "Failed to load agent sales.";
    detailEmpty.hidden = false;
  }
}

function renderAgentDetails(agent, sales) {
  detailTitle.textContent = agent.full_name || "Agent Details";
  detailSubtitle.textContent = `${agent.email || "-"} · ${agent.phone || "No phone"}`;
  detailCommissionRate.textContent = `${Number(agent.commission_rate || 0).toFixed(2)}%`;

  const totalCommissionValue = sales.reduce((sum, item) => {
    return sum + Number(item.commission_amount || 0);
  }, 0);

  const totalRevenueValue = sales.reduce((sum, item) => {
    return sum + Number(item.rental_orders?.total_amount || 0);
  }, 0);

  detailTotalCommission.textContent = formatCurrency(totalCommissionValue);
  detailTotalRevenue.textContent = formatCurrency(totalRevenueValue);
  detailTotalSales.textContent = String(sales.length);

  agentDetailStats.hidden = false;
  detailTableBody.innerHTML = "";

  if (!sales.length) {
    detailEmpty.textContent = "No rental orders found for this agent.";
    detailEmpty.hidden = false;
    detailTableWrap.hidden = true;
    return;
  }

  detailEmpty.hidden = true;
  detailTableWrap.hidden = false;

  detailTableBody.innerHTML = sales.map((item) => {
    const order = item.rental_orders || {};

    return `
      <tr>
        <td>${formatDate(order.created_at || item.created_at)}</td>
        <td>${escapeHtml(order.customer_name || "-")}</td>
        <td>${escapeHtml(order.item_name || "-")}</td>
        <td>${escapeHtml(order.rental_duration || "-")}</td>
        <td>${formatCurrency(order.total_amount)}</td>
        <td>${formatCurrency(item.commission_amount)}</td>
      </tr>
    `;
  }).join("");
}

async function handleCreateAgent(event) {
  event.preventDefault();

  const fullName = agentName.value.trim();
  const email = agentEmail.value.trim();
  const password = agentPassword.value;
  const phone = agentPhone.value.trim();
  const commissionRate = Number(agentRate.value);

  if (!fullName || !email || !password) {
    setCreateMessage("Full name, email, and password are required.", true);
    return;
  }

  if (Number.isNaN(commissionRate) || commissionRate < 0) {
    setCreateMessage("Enter a valid commission rate.", true);
    return;
  }

  const submitButton = createForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  setCreateMessage("Creating...");

  try {
    const response = await fetch("https://yygbmcvgdvsepdiwsixz.functions.supabase.co/create-agent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
        phone,
        commission_rate: commissionRate
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to create agent.");
    }

    setCreateMessage("Agent created successfully.");
    createForm.reset();

    agentsCache = [];
    agentSalesCache = {};

    await loadAgents();
  } catch (error) {
    console.error("Create agent error:", error);
    setCreateMessage(error.message || "Failed to create agent.", true);
  } finally {
    submitButton.disabled = false;
  }
}
let monthlyRevenueChartInstance = null;
let rentalHealthChartInstance = null;

let analysisOrders = [];
let analysisCommissions = [];
let analysisAgents = [];
let analysisAgentMap = {};

document.addEventListener("DOMContentLoaded", async () => {
  const authData = await requireAdmin();

  if (!authData) {
    return;
  }

  setupLogoutButton();
  setupCsvExportButton();
  await loadAnalysisDashboard();
});

function setupLogoutButton() {
  const logoutBtn = document.getElementById("logoutBtn");

  if (!logoutBtn) {
    return;
  }

  logoutBtn.addEventListener("click", async () => {
    try {
      await signOutUser();
      window.location.href = "admin-login.html";
    } catch (error) {
      console.error("Logout error:", error);
      alert("Failed to logout. Please try again.");
    }
  });
}

function setupCsvExportButton() {
  const exportBtn = document.getElementById("exportAnalysisCsvBtn");

  if (!exportBtn) {
    return;
  }

  exportBtn.addEventListener("click", exportAnalysisToCsv);
}

function formatCurrency(value) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeStatus(value) {
  return normalizeText(value).toLowerCase();
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  element.textContent = value;
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getOrderTotal(order) {
  return Number(
    order.total_amount ||
    order.total ||
    order.amount ||
    order.price ||
    0
  );
}

function getOrderCustomer(order) {
  return (
    order.customer_name ||
    order.full_name ||
    order.name ||
    order.client_name ||
    order.customer_email ||
    order.email ||
    "-"
  );
}

function getOrderItem(order) {
  return (
    order.item_name ||
    order.package_name ||
    order.product_name ||
    order.catalog_name ||
    order.furniture_name ||
    order.title ||
    "Rental Order"
  );
}

function getOrderAgent(order, agentMap = analysisAgentMap) {
  const agentId =
    order.agent_id ||
    order.agentId ||
    order.assigned_agent_id ||
    null;

  if (agentId && agentMap[String(agentId)]) {
    return agentMap[String(agentId)];
  }

  return (
    order.agent_name ||
    order.agent_email ||
    order.agent_code ||
    agentId ||
    "-"
  );
}

function getOrderDate(order) {
  return (
    order.created_at ||
    order.order_date ||
    order.date ||
    order.updated_at ||
    null
  );
}

function getPaymentStatusLabel(status) {
  const labels = {
    on_time: "On Time",
    due_soon: "Due Soon",
    overdue: "Overdue",
    behind_schedule: "Behind Schedule",
    fully_paid: "Fully Paid",
    closed: "Closed"
  };

  return labels[status] || "On Time";
}

function getRentalStatusLabel(status) {
  const labels = {
    active: "Active Rental",
    ownership_pending: "Ownership Pending",
    ownership_transferred: "Ownership Transferred",
    cancelled: "Cancelled",
    defaulted: "Defaulted",
    archived: "Archived"
  };

  return labels[status] || "Active Rental";
}

function getMonthsBetween(startDate, endDate) {
  if (!startDate || !endDate) {
    return 0;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();

  return Math.max((years * 12) + months, 0);
}

function getMonthsLeft(order) {
  const today = new Date();
  const rentalEndDate = order.rental_end_date ? new Date(order.rental_end_date) : null;

  if (!rentalEndDate || Number.isNaN(rentalEndDate.getTime())) {
    const durationMonths = Number(order.rental_duration_months || 0);
    const paidMonths = Number(order.paid_months || 0);

    if (durationMonths > 0) {
      return Math.max(durationMonths - paidMonths, 0);
    }

    return 0;
  }

  return getMonthsBetween(today, rentalEndDate);
}

function getPaidProgress(order) {
  const totalAmount = getOrderTotal(order);
  const amountPaid = Number(order.amount_paid || 0);
  const durationMonths = Number(order.rental_duration_months || 0);
  const paidMonths = Number(order.paid_months || 0);

  return {
    totalAmount,
    amountPaid,
    durationMonths,
    paidMonths,
    fullyPaid: totalAmount > 0 && amountPaid >= totalAmount
  };
}

function calculateRentalHealth(order) {
  const today = new Date();

  const rentalEndDate = order.rental_end_date ? new Date(order.rental_end_date) : null;
  const nextPaymentDate = order.next_payment_date ? new Date(order.next_payment_date) : null;

  const progress = getPaidProgress(order);
  const missedPayments = Number(order.missed_payments || 0);

  const currentRentalStatus = normalizeStatus(order.rental_status || "active");
  const currentArchiveStatus = normalizeStatus(order.archive_status || "active");
  const currentPaymentStatus = normalizeStatus(order.payment_status || "on_time");

  if (currentArchiveStatus === "archived") {
    return {
      rentalStatus: "archived",
      paymentStatus: progress.fullyPaid ? "fully_paid" : "closed",
      label: "Archived",
      action: "Review archive"
    };
  }

  if (currentRentalStatus === "cancelled") {
    return {
      rentalStatus: "cancelled",
      paymentStatus: "closed",
      label: "Cancelled",
      action: "Review record"
    };
  }

  if (currentRentalStatus === "defaulted") {
    return {
      rentalStatus: "defaulted",
      paymentStatus: "behind_schedule",
      label: "Defaulted",
      action: "Urgent follow-up"
    };
  }

  if (
    progress.fullyPaid &&
    rentalEndDate &&
    !Number.isNaN(rentalEndDate.getTime()) &&
    today >= rentalEndDate
  ) {
    return {
      rentalStatus: "ownership_transferred",
      paymentStatus: "fully_paid",
      label: "Ownership Transferred",
      action: "Move to archive"
    };
  }

  if (progress.fullyPaid) {
    return {
      rentalStatus: "ownership_pending",
      paymentStatus: "fully_paid",
      label: "Fully Paid",
      action: "Prepare ownership transfer"
    };
  }

  if (missedPayments > 0) {
    return {
      rentalStatus: "active",
      paymentStatus: "behind_schedule",
      label: "Behind Schedule",
      action: "Follow up customer"
    };
  }

  if (
    nextPaymentDate &&
    !Number.isNaN(nextPaymentDate.getTime()) &&
    today > nextPaymentDate
  ) {
    return {
      rentalStatus: "active",
      paymentStatus: "overdue",
      label: "Overdue",
      action: "Request payment"
    };
  }

  if (
    nextPaymentDate &&
    !Number.isNaN(nextPaymentDate.getTime())
  ) {
    const daysUntilPayment = Math.ceil((nextPaymentDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntilPayment >= 0 && daysUntilPayment <= 7) {
      return {
        rentalStatus: "active",
        paymentStatus: "due_soon",
        label: "Due Soon",
        action: "Prepare reminder"
      };
    }
  }

  if (currentPaymentStatus === "fully_paid") {
    return {
      rentalStatus: "ownership_pending",
      paymentStatus: "fully_paid",
      label: "Fully Paid",
      action: "Prepare ownership transfer"
    };
  }

  if (currentPaymentStatus === "overdue") {
    return {
      rentalStatus: "active",
      paymentStatus: "overdue",
      label: "Overdue",
      action: "Request payment"
    };
  }

  if (currentPaymentStatus === "behind_schedule") {
    return {
      rentalStatus: "active",
      paymentStatus: "behind_schedule",
      label: "Behind Schedule",
      action: "Follow up customer"
    };
  }

  if (currentPaymentStatus === "due_soon") {
    return {
      rentalStatus: "active",
      paymentStatus: "due_soon",
      label: "Due Soon",
      action: "Prepare reminder"
    };
  }

  return {
    rentalStatus: "active",
    paymentStatus: "on_time",
    label: "On Time",
    action: "No action needed"
  };
}

async function loadAnalysisDashboard() {
  const analysisMessage = document.getElementById("analysisMessage");

  try {
    if (analysisMessage) {
      analysisMessage.textContent = "Loading rental analysis data...";
    }

    const orders = await fetchRentalOrders();
    const commissions = await fetchCommissions();
    const agents = await fetchAgents();
    const agentMap = createAgentMap(agents);

    analysisOrders = orders;
    analysisCommissions = commissions;
    analysisAgents = agents;
    analysisAgentMap = agentMap;

    renderSummaryCards(orders, commissions);
    renderHighlightCards(orders, agentMap);
    renderMonthlyRevenueChart(orders);
    renderRentalHealthChart(orders);
    renderRecentSalesTable(orders, agentMap);
    renderAdminInsights(orders, commissions, agents, agentMap);

    if (analysisMessage) {
      analysisMessage.textContent = `Last updated: ${new Date().toLocaleString("en-MY")}`;
    }
  } catch (error) {
    console.error("Analysis dashboard error:", error);

    if (analysisMessage) {
      analysisMessage.textContent = "Failed to load rental analysis data. Please check the console for details.";
    }

    renderEmptyRecentSalesTable("Failed to load rental data.");
  }
}

async function fetchRentalOrders() {
  const { data, error } = await supabaseClient
    .from("rental_orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

async function fetchCommissions() {
  const { data, error } = await supabaseClient
    .from("commissions")
    .select("*");

  if (error) {
    console.warn("Could not load commissions:", error);
    return [];
  }

  return data || [];
}

async function fetchAgents() {
  const { data, error } = await supabaseClient
    .from("agents")
    .select("*");

  if (error) {
    console.warn("Could not load agents:", error);
    return [];
  }

  return data || [];
}

function createAgentMap(agents) {
  const agentMap = {};

  agents.forEach(agent => {
    const agentName =
      agent.name ||
      agent.agent_name ||
      agent.full_name ||
      agent.email ||
      "Unnamed Agent";

    if (agent.id) {
      agentMap[String(agent.id)] = agentName;
    }

    if (agent.auth_user_id) {
      agentMap[String(agent.auth_user_id)] = agentName;
    }
  });

  return agentMap;
}

function renderSummaryCards(orders, commissions) {
  const activeOrders = orders.filter(order => {
    const health = calculateRentalHealth(order);
    return health.rentalStatus !== "archived" && health.rentalStatus !== "cancelled";
  });

  const totalRevenue = orders.reduce((sum, order) => {
    return sum + getOrderTotal(order);
  }, 0);

  const activeRentalValue = activeOrders.reduce((sum, order) => {
    return sum + getOrderTotal(order);
  }, 0);

  const totalOrders = orders.length;

  const completedRentals = orders.filter(order => {
    const health = calculateRentalHealth(order);
    return health.rentalStatus === "ownership_transferred" || health.paymentStatus === "fully_paid";
  }).length;

  const attentionNeeded = orders.filter(order => {
    const health = calculateRentalHealth(order);

    return (
      health.paymentStatus === "overdue" ||
      health.paymentStatus === "behind_schedule" ||
      health.rentalStatus === "defaulted"
    );
  }).length;

  const totalCommission = commissions.reduce((sum, commission) => {
    return sum + Number(
      commission.commission_amount ||
      commission.amount ||
      commission.total_commission ||
      0
    );
  }, 0);

  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  setText("totalRevenue", formatCurrency(totalRevenue));
  setText("totalOrders", totalOrders);
  setText("completedOrders", completedRentals);
  setText("pendingOrders", attentionNeeded);
  setText("totalCommission", formatCurrency(totalCommission));
  setText("averageOrderValue", formatCurrency(averageOrderValue));

  const completedLabel = document.querySelector("#completedOrders")?.previousElementSibling;
  const pendingLabel = document.querySelector("#pendingOrders")?.previousElementSibling;
  const revenueLabel = document.querySelector("#totalRevenue")?.previousElementSibling;

  if (completedLabel) {
    completedLabel.textContent = "Completed / Fully Paid";
  }

  if (pendingLabel) {
    pendingLabel.textContent = "Needs Attention";
  }

  if (revenueLabel) {
    revenueLabel.textContent = "Total Rental Value";
  }

  console.log("Active rental value:", activeRentalValue);
}

function renderHighlightCards(orders, agentMap) {
  renderTopAgent(orders, agentMap);
  renderTopItem(orders);
  renderLatestOrder(orders);
}

function renderTopAgent(orders, agentMap) {
  const agentSales = {};

  orders.forEach(order => {
    const health = calculateRentalHealth(order);

    if (health.rentalStatus === "archived" || health.rentalStatus === "cancelled") {
      return;
    }

    const agentId =
      order.agent_id ||
      order.agentId ||
      order.assigned_agent_id ||
      order.agent_name ||
      null;

    if (!agentId) {
      return;
    }

    const key = String(agentId);

    if (!agentSales[key]) {
      agentSales[key] = {
        name: agentMap[key] || order.agent_name || key,
        total: 0,
        count: 0
      };
    }

    agentSales[key].total += getOrderTotal(order);
    agentSales[key].count += 1;
  });

  const topAgent = Object.values(agentSales).sort((a, b) => b.total - a.total)[0];

  if (!topAgent) {
    setText("topAgentName", "-");
    setText("topAgentValue", "No active agent rental value yet");
    return;
  }

  setText("topAgentName", topAgent.name);
  setText("topAgentValue", `${formatCurrency(topAgent.total)} active rental value from ${topAgent.count} order(s)`);
}

function renderTopItem(orders) {
  const itemCount = {};

  orders.forEach(order => {
    const health = calculateRentalHealth(order);

    if (health.rentalStatus === "archived" || health.rentalStatus === "cancelled") {
      return;
    }

    const itemName = getOrderItem(order);

    if (!itemCount[itemName]) {
      itemCount[itemName] = {
        name: itemName,
        count: 0,
        total: 0
      };
    }

    itemCount[itemName].count += 1;
    itemCount[itemName].total += getOrderTotal(order);
  });

  const topItem = Object.values(itemCount).sort((a, b) => {
    if (b.count === a.count) {
      return b.total - a.total;
    }

    return b.count - a.count;
  })[0];

  if (!topItem) {
    setText("topItemName", "-");
    setText("topItemValue", "No active rental data yet");
    return;
  }

  setText("topItemName", topItem.name);
  setText("topItemValue", `${topItem.count} active order(s), ${formatCurrency(topItem.total)} rental value`);
}

function renderLatestOrder(orders) {
  if (!orders.length) {
    setText("latestOrderName", "-");
    setText("latestOrderValue", "No order found");
    return;
  }

  const latestOrder = orders[0];
  const health = calculateRentalHealth(latestOrder);

  setText("latestOrderName", getOrderCustomer(latestOrder));
  setText("latestOrderValue", `${getOrderItem(latestOrder)} • ${health.label}`);
}

function renderMonthlyRevenueChart(orders) {
  const chartElement = document.getElementById("monthlyRevenueChart");

  if (!chartElement) {
    return;
  }

  const monthlyData = {};

  orders.forEach(order => {
    const rawDate = getOrderDate(order);

    if (!rawDate) {
      return;
    }

    const date = new Date(rawDate);

    if (Number.isNaN(date.getTime())) {
      return;
    }

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        label: date.toLocaleString("en-MY", {
          month: "short",
          year: "numeric"
        }),
        total: 0
      };
    }

    monthlyData[monthKey].total += getOrderTotal(order);
  });

  const sortedKeys = Object.keys(monthlyData).sort();
  const labels = sortedKeys.map(key => monthlyData[key].label);
  const values = sortedKeys.map(key => monthlyData[key].total);

  if (monthlyRevenueChartInstance) {
    monthlyRevenueChartInstance.destroy();
  }

  monthlyRevenueChartInstance = new Chart(chartElement, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Rental Value",
          data: values,
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: context => formatCurrency(context.raw)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => `RM ${value}`
          }
        }
      }
    }
  });
}

function renderRentalHealthChart(orders) {
  const chartElement =
    document.getElementById("orderStatusChart") ||
    document.getElementById("rentalHealthChart");

  if (!chartElement) {
    return;
  }

  const healthData = {
    "On Time": 0,
    "Due Soon": 0,
    "Overdue": 0,
    "Behind Schedule": 0,
    "Fully Paid": 0,
    "Archived": 0
  };

  orders.forEach(order => {
    const health = calculateRentalHealth(order);

    if (health.rentalStatus === "archived") {
      healthData["Archived"] += 1;
      return;
    }

    if (health.paymentStatus === "fully_paid") {
      healthData["Fully Paid"] += 1;
      return;
    }

    if (health.paymentStatus === "due_soon") {
      healthData["Due Soon"] += 1;
      return;
    }

    if (health.paymentStatus === "overdue") {
      healthData["Overdue"] += 1;
      return;
    }

    if (health.paymentStatus === "behind_schedule") {
      healthData["Behind Schedule"] += 1;
      return;
    }

    healthData["On Time"] += 1;
  });

  const labels = Object.keys(healthData).filter(label => healthData[label] > 0);
  const values = labels.map(label => healthData[label]);

  if (rentalHealthChartInstance) {
    rentalHealthChartInstance.destroy();
  }

  rentalHealthChartInstance = new Chart(chartElement, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

function renderRecentSalesTable(orders, agentMap) {
  const tableBody = document.getElementById("recentSalesTable");

  if (!tableBody) {
    return;
  }

  if (!orders.length) {
    renderEmptyRecentSalesTable("No rental data available.");
    return;
  }

  tableBody.innerHTML = orders.slice(0, 12).map(order => {
    const health = calculateRentalHealth(order);
    const progress = getPaidProgress(order);

    const customerName = escapeHTML(getOrderCustomer(order));
    const itemName = escapeHTML(getOrderItem(order));
    const agentName = escapeHTML(getOrderAgent(order, agentMap));

    const monthsLeft = getMonthsLeft(order);
    const paymentLabel = getPaymentStatusLabel(health.paymentStatus);
    const rentalLabel = getRentalStatusLabel(health.rentalStatus);

    const durationMonths = progress.durationMonths || "-";
    const paidMonths = progress.paidMonths || 0;

    const paidText = `${formatCurrency(progress.amountPaid)} / ${formatCurrency(progress.totalAmount)}`;
    const monthText = durationMonths === "-"
      ? `${paidMonths} month(s) paid`
      : `${paidMonths} / ${durationMonths} month(s)`;

    return `
      <tr>
        <td>${customerName}</td>
        <td>
          ${itemName}
          <br>
          <small>${escapeHTML(rentalLabel)}</small>
        </td>
        <td>${agentName}</td>
        <td>
          <span class="analysis-status ${escapeHTML(health.paymentStatus)}">
            ${escapeHTML(paymentLabel)}
          </span>
          <br>
          <small>${escapeHTML(health.action)}</small>
        </td>
        <td>
          ${paidText}
          <br>
          <small>${escapeHTML(monthText)}</small>
        </td>
        <td>
          ${monthsLeft} month(s) left
          <br>
          <small>Next: ${formatDate(order.next_payment_date)}</small>
        </td>
      </tr>
    `;
  }).join("");
}

function renderEmptyRecentSalesTable(message) {
  const tableBody = document.getElementById("recentSalesTable");

  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = `
    <tr>
      <td colspan="6">${escapeHTML(message)}</td>
    </tr>
  `;
}

function renderAdminInsights(orders, commissions, agents, agentMap) {
  const insightGrid = document.getElementById("insightGrid");

  if (!insightGrid) {
    return;
  }

  const insights = generateAdminInsights(orders, commissions, agents, agentMap);

  if (!insights.length) {
    insightGrid.innerHTML = `
      <div class="insight-empty">
        Not enough rental data yet. More insights will appear after the system receives more orders and payment records.
      </div>
    `;
    return;
  }

  insightGrid.innerHTML = insights.map(insight => {
    return `
      <div class="insight-card ${escapeHTML(insight.type)}">
        <span class="insight-tag">${escapeHTML(insight.type)}</span>
        <h4>${escapeHTML(insight.title)}</h4>
        <p>${escapeHTML(insight.message)}</p>
      </div>
    `;
  }).join("");
}

function generateAdminInsights(orders, commissions, agents, agentMap) {
  const insights = [];

  if (!orders.length) {
    insights.push({
      type: "info",
      title: "No rental data yet",
      message: "The system has not recorded any rental orders yet. Once customers submit orders, this section will generate operational tips."
    });

    return insights;
  }

  const activeOrders = orders.filter(order => {
    const health = calculateRentalHealth(order);
    return health.rentalStatus !== "archived" && health.rentalStatus !== "cancelled";
  });

  const totalRentalValue = activeOrders.reduce((sum, order) => {
    return sum + getOrderTotal(order);
  }, 0);

  const overdueOrders = activeOrders.filter(order => {
    const health = calculateRentalHealth(order);
    return health.paymentStatus === "overdue";
  });

  const behindScheduleOrders = activeOrders.filter(order => {
    const health = calculateRentalHealth(order);
    return health.paymentStatus === "behind_schedule";
  });

  const dueSoonOrders = activeOrders.filter(order => {
    const health = calculateRentalHealth(order);
    return health.paymentStatus === "due_soon";
  });

  const fullyPaidOrders = activeOrders.filter(order => {
    const health = calculateRentalHealth(order);
    return health.paymentStatus === "fully_paid";
  });

  if (activeOrders.length) {
    insights.push({
      type: "info",
      title: "Active rental value",
      message: `There are ${activeOrders.length} active rental order(s) with a total rental value of ${formatCurrency(totalRentalValue)}. Admin should monitor these orders regularly.`
    });
  }

  if (overdueOrders.length) {
    insights.push({
      type: "danger",
      title: "Overdue payments detected",
      message: `${overdueOrders.length} customer(s) have overdue payments. Admin should follow up before the delay affects ownership transfer or rental completion.`
    });
  }

  if (behindScheduleOrders.length) {
    insights.push({
      type: "warning",
      title: "Customers behind schedule",
      message: `${behindScheduleOrders.length} customer(s) are behind payment schedule. Check missed payment count and contact them before marking the rental as defaulted.`
    });
  }

  if (dueSoonOrders.length) {
    insights.push({
      type: "warning",
      title: "Upcoming payments",
      message: `${dueSoonOrders.length} rental payment(s) are due soon. Admin can prepare reminders to reduce late payments.`
    });
  }

  if (fullyPaidOrders.length) {
    insights.push({
      type: "success",
      title: "Ownership transfer needed",
      message: `${fullyPaidOrders.length} rental(s) are fully paid. Admin should check whether the rental duration is complete and prepare ownership transfer confirmation.`
    });
  }

  const topItem = getInsightTopItem(activeOrders);

  if (topItem) {
    insights.push({
      type: "success",
      title: "Best-performing item or package",
      message: `${topItem.name} is currently the strongest performer with ${topItem.count} active order(s) and ${formatCurrency(topItem.total)} rental value. Consider featuring it more prominently.`
    });
  }

  const topAgent = getInsightTopAgent(activeOrders, agentMap);

  if (topAgent) {
    insights.push({
      type: "success",
      title: "Top agent by rental value",
      message: `${topAgent.name} is currently managing ${formatCurrency(topAgent.total)} in active rental value from ${topAgent.count} order(s).`
    });
  }

  const inactiveAgents = getInsightInactiveAgents(activeOrders, agents);

  if (inactiveAgents.length) {
    insights.push({
      type: "warning",
      title: "Agents without active rentals",
      message: `${inactiveAgents.length} active agent(s) have no active rental sales recorded. Admin may need to check whether they need leads, account support, or clearer package information.`
    });
  }

  return insights.slice(0, 8);
}

function getInsightTopItem(orders) {
  const itemMap = {};

  orders.forEach(order => {
    const itemName = getOrderItem(order);

    if (!itemMap[itemName]) {
      itemMap[itemName] = {
        name: itemName,
        count: 0,
        total: 0
      };
    }

    itemMap[itemName].count += 1;
    itemMap[itemName].total += getOrderTotal(order);
  });

  return Object.values(itemMap).sort((a, b) => {
    if (b.count === a.count) {
      return b.total - a.total;
    }

    return b.count - a.count;
  })[0] || null;
}

function getInsightTopAgent(orders, agentMap) {
  const agentMapData = {};

  orders.forEach(order => {
    const agentId =
      order.agent_id ||
      order.agentId ||
      order.assigned_agent_id ||
      order.agent_name ||
      null;

    if (!agentId) {
      return;
    }

    const key = String(agentId);

    if (!agentMapData[key]) {
      agentMapData[key] = {
        name: agentMap[key] || order.agent_name || key,
        count: 0,
        total: 0
      };
    }

    agentMapData[key].count += 1;
    agentMapData[key].total += getOrderTotal(order);
  });

  return Object.values(agentMapData).sort((a, b) => b.total - a.total)[0] || null;
}

function getInsightInactiveAgents(orders, agents) {
  const activeAgentIds = new Set();

  orders.forEach(order => {
    const agentId =
      order.agent_id ||
      order.agentId ||
      order.assigned_agent_id ||
      null;

    if (agentId) {
      activeAgentIds.add(String(agentId));
    }
  });

  return agents.filter(agent => {
    const isActive = agent.is_active !== false;
    const hasSales =
      activeAgentIds.has(String(agent.id)) ||
      activeAgentIds.has(String(agent.auth_user_id));

    return isActive && !hasSales;
  });
}

function exportAnalysisToCsv() {
  if (!analysisOrders.length) {
    alert("No rental analysis data available to export.");
    return;
  }

  const summaryRows = buildSummaryCsvRows();
  const rentalRows = buildRentalCsvRows();
  const agentRows = buildAgentCsvRows();
  const insightRows = buildInsightCsvRows();

  const csvSections = [
    ["AUTRO RENTAL ANALYSIS EXPORT"],
    ["Generated At", new Date().toLocaleString("en-MY")],
    [],
    ["SUMMARY"],
    ...summaryRows,
    [],
    ["RENTAL RECORDS"],
    ...rentalRows,
    [],
    ["AGENT PERFORMANCE"],
    ...agentRows,
    [],
    ["SYSTEM INSIGHTS"],
    ...insightRows
  ];

  const csvContent = csvSections
    .map(row => row.map(escapeCsvValue).join(","))
    .join("\n");

  downloadCsvFile(csvContent, `autro-analysis-${getTodayFileName()}.csv`);
}

function buildSummaryCsvRows() {
  const activeOrders = analysisOrders.filter(order => {
    const health = calculateRentalHealth(order);
    return health.rentalStatus !== "archived" && health.rentalStatus !== "cancelled";
  });

  const totalRevenue = analysisOrders.reduce((sum, order) => {
    return sum + getOrderTotal(order);
  }, 0);

  const activeRentalValue = activeOrders.reduce((sum, order) => {
    return sum + getOrderTotal(order);
  }, 0);

  const completedRentals = analysisOrders.filter(order => {
    const health = calculateRentalHealth(order);
    return health.rentalStatus === "ownership_transferred" || health.paymentStatus === "fully_paid";
  }).length;

  const attentionNeeded = analysisOrders.filter(order => {
    const health = calculateRentalHealth(order);

    return (
      health.paymentStatus === "overdue" ||
      health.paymentStatus === "behind_schedule" ||
      health.rentalStatus === "defaulted"
    );
  }).length;

  const totalCommission = analysisCommissions.reduce((sum, commission) => {
    return sum + Number(
      commission.commission_amount ||
      commission.amount ||
      commission.total_commission ||
      0
    );
  }, 0);

  const averageOrderValue = analysisOrders.length > 0
    ? totalRevenue / analysisOrders.length
    : 0;

  return [
    ["Metric", "Value"],
    ["Total Rental Value", totalRevenue],
    ["Active Rental Value", activeRentalValue],
    ["Total Orders", analysisOrders.length],
    ["Active Rentals", activeOrders.length],
    ["Completed / Fully Paid Rentals", completedRentals],
    ["Needs Attention", attentionNeeded],
    ["Total Commission", totalCommission],
    ["Average Order Value", averageOrderValue]
  ];
}

function buildRentalCsvRows() {
  const rows = [
    [
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Item Type",
      "Item / Package",
      "Agent",
      "Rental Status",
      "Payment Status",
      "Payment Action",
      "Rental Duration Months",
      "Paid Months",
      "Months Left",
      "Monthly Payment",
      "Amount Paid",
      "Total Amount",
      "Missed Payments",
      "Rental Start Date",
      "Rental End Date",
      "Next Payment Date",
      "Last Payment Date",
      "Ownership Transferred",
      "Ownership Transfer Date",
      "Archive Status",
      "Archived At",
      "Created At",
      "Updated At"
    ]
  ];

  analysisOrders.forEach(order => {
    const health = calculateRentalHealth(order);
    const progress = getPaidProgress(order);

    rows.push([
      getOrderCustomer(order),
      order.customer_email || order.email || "",
      order.customer_phone || order.phone || "",
      order.item_type || "",
      getOrderItem(order),
      getOrderAgent(order, analysisAgentMap),
      getRentalStatusLabel(health.rentalStatus),
      getPaymentStatusLabel(health.paymentStatus),
      health.action,
      progress.durationMonths,
      progress.paidMonths,
      getMonthsLeft(order),
      Number(order.monthly_payment || 0),
      progress.amountPaid,
      progress.totalAmount,
      Number(order.missed_payments || 0),
      formatDate(order.rental_start_date),
      formatDate(order.rental_end_date),
      formatDate(order.next_payment_date),
      formatDate(order.last_payment_date),
      order.ownership_transferred ? "Yes" : "No",
      formatDate(order.ownership_transfer_date),
      order.archive_status || "active",
      formatDate(order.archived_at),
      formatDate(getOrderDate(order)),
      formatDate(order.updated_at)
    ]);
  });

  return rows;
}

function buildAgentCsvRows() {
  const rows = [
    [
      "Agent Name",
      "Agent Email",
      "Active Rental Count",
      "Total Rental Value",
      "Commission Amount"
    ]
  ];

  const agentStats = {};

  analysisAgents.forEach(agent => {
    const agentId = String(agent.id || "");
    const authUserId = String(agent.auth_user_id || "");

    const agentName =
      agent.name ||
      agent.agent_name ||
      agent.full_name ||
      agent.email ||
      "Unnamed Agent";

    const agentEmail = agent.email || "";

    if (agentId) {
      agentStats[agentId] = {
        name: agentName,
        email: agentEmail,
        count: 0,
        total: 0,
        commission: 0
      };
    }

    if (authUserId && !agentStats[authUserId]) {
      agentStats[authUserId] = {
        name: agentName,
        email: agentEmail,
        count: 0,
        total: 0,
        commission: 0
      };
    }
  });

  analysisOrders.forEach(order => {
    const health = calculateRentalHealth(order);

    if (health.rentalStatus === "archived" || health.rentalStatus === "cancelled") {
      return;
    }

    const agentId =
      order.agent_id ||
      order.agentId ||
      order.assigned_agent_id ||
      null;

    if (!agentId) {
      return;
    }

    const key = String(agentId);

    if (!agentStats[key]) {
      agentStats[key] = {
        name: order.agent_name || key,
        email: order.agent_email || order.agent_code || "",
        count: 0,
        total: 0,
        commission: 0
      };
    }

    agentStats[key].count += 1;
    agentStats[key].total += getOrderTotal(order);
  });

  analysisCommissions.forEach(commission => {
    const agentId =
      commission.agent_id ||
      commission.agentId ||
      commission.assigned_agent_id ||
      null;

    if (!agentId) {
      return;
    }

    const key = String(agentId);

    if (!agentStats[key]) {
      agentStats[key] = {
        name: analysisAgentMap[key] || key,
        email: "",
        count: 0,
        total: 0,
        commission: 0
      };
    }

    agentStats[key].commission += Number(
      commission.commission_amount ||
      commission.amount ||
      commission.total_commission ||
      0
    );
  });

  Object.values(agentStats).forEach(agent => {
    rows.push([
      agent.name,
      agent.email,
      agent.count,
      agent.total,
      agent.commission
    ]);
  });

  return rows;
}

function buildInsightCsvRows() {
  const rows = [
    ["Type", "Title", "Message"]
  ];

  const insights = generateAdminInsights(
    analysisOrders,
    analysisCommissions,
    analysisAgents,
    analysisAgentMap
  );

  if (!insights.length) {
    rows.push([
      "info",
      "No insights",
      "Not enough rental data to generate insights yet."
    ]);

    return rows;
  }

  insights.forEach(insight => {
    rows.push([
      insight.type,
      insight.title,
      insight.message
    ]);
  });

  return rows;
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function downloadCsvFile(csvContent, fileName) {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getTodayFileName() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}
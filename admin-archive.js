let archiveRentals = [];
let archiveAgents = [];
let archiveAgentMap = {};

document.addEventListener("DOMContentLoaded", async () => {
  const authData = await requireAdmin();

  if (!authData) {
    return;
  }

  setupLogoutButton();
  setupArchiveControls();
  await loadArchiveRecords();
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

function setupArchiveControls() {
  const archiveSearch = document.getElementById("archiveSearch");
  const archiveFilter = document.getElementById("archiveFilter");

  if (archiveSearch) {
    archiveSearch.addEventListener("input", renderArchiveTable);
  }

  if (archiveFilter) {
    archiveFilter.addEventListener("change", renderArchiveTable);
  }
}

async function loadArchiveRecords() {
  setArchiveMessage("Loading archive records...");

  try {
    archiveRentals = await fetchRentalOrders();
    archiveAgents = await fetchAgents();
    archiveAgentMap = createAgentMap(archiveAgents);

    renderArchiveSummary();
    renderArchiveTable();

    setArchiveMessage(`Last updated: ${new Date().toLocaleString("en-MY")}`);
  } catch (error) {
    console.error("Archive load error:", error);
    setArchiveMessage("Failed to load archive records. Please check the console for details.");
    renderEmptyArchiveTable("Failed to load archive records.");
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

function createAgentMap(agentList) {
  const map = {};

  agentList.forEach(agent => {
    const agentName =
      agent.name ||
      agent.agent_name ||
      agent.full_name ||
      agent.email ||
      "Unnamed Agent";

    if (agent.id) {
      map[agent.id] = agentName;
    }

    if (agent.auth_user_id) {
      map[agent.auth_user_id] = agentName;
    }
  });

  return map;
}

function getArchiveRecords() {
  return archiveRentals.filter(order => {
    const health = calculateArchiveHealth(order);

    return (
      normalizeText(order.archive_status) === "archived" ||
      health.rentalStatus === "archived" ||
      health.rentalStatus === "ownership_transferred" ||
      health.rentalStatus === "cancelled" ||
      health.rentalStatus === "defaulted" ||
      health.paymentStatus === "closed"
    );
  });
}

function renderArchiveSummary() {
  const records = getArchiveRecords();

  const ownershipTransferredCount = records.filter(order => {
    const health = calculateArchiveHealth(order);
    return health.rentalStatus === "ownership_transferred" || order.ownership_transferred === true;
  }).length;

  const cancelledCount = records.filter(order => {
    const health = calculateArchiveHealth(order);
    return health.rentalStatus === "cancelled";
  }).length;

  const defaultedCount = records.filter(order => {
    const health = calculateArchiveHealth(order);
    return health.rentalStatus === "defaulted";
  }).length;

  const archivedValue = records.reduce((sum, order) => {
    return sum + getOrderTotal(order);
  }, 0);

  setText("archivedCount", records.length);
  setText("ownershipTransferredCount", ownershipTransferredCount);
  setText("cancelledCount", cancelledCount);
  setText("defaultedCount", defaultedCount);
  setText("archivedValue", formatCurrency(archivedValue));
}

function renderArchiveTable() {
  const tableBody = document.getElementById("archiveTableBody");

  if (!tableBody) {
    return;
  }

  const searchValue = normalizeText(document.getElementById("archiveSearch")?.value).toLowerCase();
  const filterValue = normalizeText(document.getElementById("archiveFilter")?.value) || "all";

  let records = getArchiveRecords();

  if (filterValue !== "all") {
    records = records.filter(order => {
      const health = calculateArchiveHealth(order);

      if (filterValue === "archived") {
        return normalizeText(order.archive_status) === "archived" || health.rentalStatus === "archived";
      }

      if (filterValue === "fully_paid" || filterValue === "closed") {
        return health.paymentStatus === filterValue;
      }

      return health.rentalStatus === filterValue;
    });
  }

  if (searchValue) {
    records = records.filter(order => {
      const searchableText = [
        getOrderCustomer(order),
        getOrderItem(order),
        getOrderAgent(order),
        order.email,
        order.phone,
        order.customer_phone,
        order.customer_email
      ].join(" ").toLowerCase();

      return searchableText.includes(searchValue);
    });
  }

  if (!records.length) {
    renderEmptyArchiveTable("No archive records found.");
    return;
  }

  tableBody.innerHTML = records.map(order => {
    const health = calculateArchiveHealth(order);
    const progress = getPaidProgress(order);
    const progressPercent = getPaymentProgressPercent(order);

    const customerName = escapeHTML(getOrderCustomer(order));
    const customerEmail = escapeHTML(order.email || order.customer_email || "-");
    const itemName = escapeHTML(getOrderItem(order));
    const rentalLabel = escapeHTML(getRentalStatusLabel(health.rentalStatus));
    const paymentLabel = escapeHTML(getPaymentStatusLabel(health.paymentStatus));
    const ownershipText = order.ownership_transferred ? "Transferred" : "Not Transferred";
    const ownershipDate = formatDate(order.ownership_transfer_date);
    const agentName = escapeHTML(getOrderAgent(order));

    const paidText = `${formatCurrency(progress.amountPaid)} / ${formatCurrency(progress.totalAmount)}`;

    const paidMonthsText = progress.durationMonths > 0
      ? `${progress.paidMonths} / ${progress.durationMonths} month(s)`
      : `${progress.paidMonths} month(s) paid`;

    return `
      <tr>
        <td>
          <span class="archive-primary-text">${customerName}</span>
          <span class="archive-secondary-text">${customerEmail}</span>
        </td>

        <td>
          <span class="archive-primary-text">${itemName}</span>
          <span class="archive-secondary-text">Created: ${formatDate(getOrderDate(order))}</span>
        </td>

        <td>
          <span class="archive-status ${escapeHTML(health.rentalStatus)}">${rentalLabel}</span>
          <span class="archive-secondary-text">${paymentLabel}</span>
        </td>

        <td>
          <div class="archive-payment-box">
            <span class="archive-primary-text">${paidText}</span>
            <span class="archive-secondary-text">${escapeHTML(paidMonthsText)}</span>
            <div class="archive-progress-bar">
              <div class="archive-progress-fill" style="width: ${progressPercent}%"></div>
            </div>
          </div>
        </td>

        <td>
          <span class="archive-primary-text">${escapeHTML(ownershipText)}</span>
          <span class="archive-secondary-text">Date: ${ownershipDate}</span>
        </td>

        <td>
          <span class="archive-primary-text">${agentName}</span>
        </td>

        <td>
          <span class="archive-primary-text">${formatDate(order.archived_at)}</span>
          <span class="archive-secondary-text">Updated: ${formatDate(order.updated_at)}</span>
        </td>
      </tr>
    `;
  }).join("");
}

function renderEmptyArchiveTable(message) {
  const tableBody = document.getElementById("archiveTableBody");

  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = `
    <tr>
      <td colspan="7">${escapeHTML(message)}</td>
    </tr>
  `;
}

function calculateArchiveHealth(order) {
  const progress = getPaidProgress(order);
  const rentalStatus = normalizeStatus(order.rental_status || "active");
  const paymentStatus = normalizeStatus(order.payment_status || "on_time");
  const archiveStatus = normalizeStatus(order.archive_status || "active");

  if (archiveStatus === "archived") {
    if (order.ownership_transferred === true) {
      return {
        rentalStatus: "ownership_transferred",
        paymentStatus: "fully_paid"
      };
    }

    return {
      rentalStatus: "archived",
      paymentStatus: progress.fullyPaid ? "fully_paid" : paymentStatus || "closed"
    };
  }

  if (rentalStatus === "ownership_transferred") {
    return {
      rentalStatus: "ownership_transferred",
      paymentStatus: "fully_paid"
    };
  }

  if (rentalStatus === "cancelled") {
    return {
      rentalStatus: "cancelled",
      paymentStatus: "closed"
    };
  }

  if (rentalStatus === "defaulted") {
    return {
      rentalStatus: "defaulted",
      paymentStatus: "behind_schedule"
    };
  }

  if (paymentStatus === "closed") {
    return {
      rentalStatus: "archived",
      paymentStatus: "closed"
    };
  }

  if (progress.fullyPaid) {
    return {
      rentalStatus: "ownership_transferred",
      paymentStatus: "fully_paid"
    };
  }

  return {
    rentalStatus: rentalStatus || "archived",
    paymentStatus: paymentStatus || "closed"
  };
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

function getPaymentProgressPercent(order) {
  const progress = getPaidProgress(order);

  if (progress.totalAmount <= 0) {
    return 0;
  }

  const percent = (progress.amountPaid / progress.totalAmount) * 100;

  return Math.min(Math.max(percent, 0), 100).toFixed(0);
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

function getOrderAgent(order) {
  const agentId =
    order.agent_id ||
    order.agentId ||
    order.assigned_agent_id ||
    null;

  if (agentId && archiveAgentMap[agentId]) {
    return archiveAgentMap[agentId];
  }

  return (
    order.agent_name ||
    order.agent_email ||
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

  return labels[status] || "Closed";
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

  return labels[status] || "Archived";
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

function setArchiveMessage(message) {
  const messageElement = document.getElementById("archiveMessage");

  if (!messageElement) {
    return;
  }

  messageElement.textContent = message;
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
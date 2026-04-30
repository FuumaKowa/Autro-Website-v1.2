let rentals = [];
let agents = [];
let agentMap = {};
let selectedRental = null;

document.addEventListener("DOMContentLoaded", async () => {
  const authData = await requireAdmin();

  if (!authData) {
    return;
  }

  setupLogoutButton();
  setupRentalControls();
  await loadRentals();
});

function setupLogoutButton() {
  const logoutBtn = document.getElementById("logoutBtn");

  if (!logoutBtn) {
    return;
  }

  logoutBtn.addEventListener("click", async () => {
    signOutUser()
      .then(() => {
        window.location.href = "admin-login.html";
      })
      .catch(error => {
        console.error("Logout error:", error);
        alert("Failed to logout. Please try again.");
      });
  });
}

function setupRentalControls() {
  const rentalSearch = document.getElementById("rentalSearch");
  const rentalFilter = document.getElementById("rentalFilter");
  const rentalUpdateForm = document.getElementById("rentalUpdateForm");
  const recordPaymentBtn = document.getElementById("recordPaymentBtn");
  const transferOwnershipBtn = document.getElementById("transferOwnershipBtn");
  const archiveRentalBtn = document.getElementById("archiveRentalBtn");
  const closeButtons = document.querySelectorAll("[data-close-modal]");

  if (rentalSearch) {
    rentalSearch.addEventListener("input", renderRentalsTable);
  }

  if (rentalFilter) {
    rentalFilter.addEventListener("change", renderRentalsTable);
  }

  if (rentalUpdateForm) {
    rentalUpdateForm.addEventListener("submit", handleRentalUpdate);
  }

  if (recordPaymentBtn) {
    recordPaymentBtn.addEventListener("click", handleRecordMonthlyPayment);
  }

  if (transferOwnershipBtn) {
    transferOwnershipBtn.addEventListener("click", handleTransferOwnership);
  }

  if (archiveRentalBtn) {
    archiveRentalBtn.addEventListener("click", handleArchiveRental);
  }

  closeButtons.forEach(button => {
    button.addEventListener("click", closeRentalModal);
  });
}

async function loadRentals() {
  setMessage("Loading rental records...");

  try {
    rentals = await fetchRentalOrders();
    agents = await fetchAgents();
    agentMap = createAgentMap(agents);

    renderRentalSummary();
    renderRentalsTable();

    setMessage(`Last updated: ${new Date().toLocaleString("en-MY")}`);
  } catch (error) {
    console.error("Rental management load error:", error);
    setMessage("Failed to load rental records. Please check the console for details.");
    renderEmptyRentalsTable("Failed to load rental records.");
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

function getActiveRentals() {
  return rentals.filter(order => {
    const health = calculateRentalHealth(order);
    return (
      health.rentalStatus !== "archived" &&
      normalizeText(order.archive_status) !== "archived"
    );
  });
}

function renderRentalSummary() {
  const activeRentals = getActiveRentals();

  const onTimeCount = activeRentals.filter(order => {
    return calculateRentalHealth(order).paymentStatus === "on_time";
  }).length;

  const dueSoonCount = activeRentals.filter(order => {
    return calculateRentalHealth(order).paymentStatus === "due_soon";
  }).length;

  const attentionCount = activeRentals.filter(order => {
    const health = calculateRentalHealth(order);

    return (
      health.paymentStatus === "overdue" ||
      health.paymentStatus === "behind_schedule" ||
      health.rentalStatus === "defaulted"
    );
  }).length;

  const fullyPaidCount = activeRentals.filter(order => {
    return calculateRentalHealth(order).paymentStatus === "fully_paid";
  }).length;

  setText("activeRentalsCount", activeRentals.length);
  setText("onTimeCount", onTimeCount);
  setText("dueSoonCount", dueSoonCount);
  setText("attentionCount", attentionCount);
  setText("fullyPaidCount", fullyPaidCount);
}

function renderRentalsTable() {
  const tableBody = document.getElementById("rentalsTableBody");

  if (!tableBody) {
    return;
  }

  const searchValue = normalizeText(document.getElementById("rentalSearch")?.value).toLowerCase();
  const filterValue = normalizeText(document.getElementById("rentalFilter")?.value) || "all";

  let activeRentals = getActiveRentals();

  if (filterValue !== "all") {
    activeRentals = activeRentals.filter(order => {
      const health = calculateRentalHealth(order);

      if (filterValue === "defaulted") {
        return health.rentalStatus === "defaulted";
      }

      return health.paymentStatus === filterValue;
    });
  }

  if (searchValue) {
    activeRentals = activeRentals.filter(order => {
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

  if (!activeRentals.length) {
    renderEmptyRentalsTable("No active rental records found.");
    return;
  }

  tableBody.innerHTML = activeRentals.map(order => {
    const health = calculateRentalHealth(order);
    const progress = getPaidProgress(order);
    const progressPercent = getPaymentProgressPercent(order);
    const monthsLeft = getMonthsLeft(order);

    const customerName = escapeHTML(getOrderCustomer(order));
    const customerEmail = escapeHTML(order.email || order.customer_email || "-");
    const itemName = escapeHTML(getOrderItem(order));
    const rentalLabel = escapeHTML(getRentalStatusLabel(health.rentalStatus));
    const paymentLabel = escapeHTML(getPaymentStatusLabel(health.paymentStatus));
    const agentName = escapeHTML(getOrderAgent(order));
    const paidText = `${formatCurrency(progress.amountPaid)} / ${formatCurrency(progress.totalAmount)}`;

    const paidMonthsText = progress.durationMonths > 0
      ? `${progress.paidMonths} / ${progress.durationMonths} month(s)`
      : `${progress.paidMonths} month(s) paid`;

    return `
      <tr>
        <td>
          <span class="rental-primary-text">${customerName}</span>
          <span class="rental-secondary-text">${customerEmail}</span>
        </td>

        <td>
          <span class="rental-primary-text">${itemName}</span>
          <span class="rental-secondary-text">${rentalLabel}</span>
        </td>

        <td>
          <span class="rental-status ${escapeHTML(health.paymentStatus)}">${paymentLabel}</span>
          <span class="rental-secondary-text">${escapeHTML(health.action)}</span>
        </td>

        <td>
          <div class="rental-progress">
            <span class="rental-primary-text">${paidText}</span>
            <span class="rental-secondary-text">${escapeHTML(paidMonthsText)}</span>
            <div class="rental-progress-bar">
              <div class="rental-progress-fill" style="width: ${progressPercent}%"></div>
            </div>
          </div>
        </td>

        <td>
          <span class="rental-primary-text">${monthsLeft} month(s) left</span>
          <span class="rental-secondary-text">Next: ${formatDate(order.next_payment_date)}</span>
        </td>

        <td>
          <span class="rental-primary-text">${agentName}</span>
        </td>

        <td>
          <div class="rental-action-group">
            <button type="button" class="rental-action-btn" onclick="openRentalModal('${escapeHTML(order.id)}')">
              Manage
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderEmptyRentalsTable(message) {
  const tableBody = document.getElementById("rentalsTableBody");

  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = `
    <tr>
      <td colspan="7">${escapeHTML(message)}</td>
    </tr>
  `;
}

function openRentalModal(orderId) {
  selectedRental = rentals.find(order => String(order.id) === String(orderId));

  if (!selectedRental) {
    setMessage("Rental record not found.");
    return;
  }

  const health = calculateRentalHealth(selectedRental);

  setText("modalTitle", getOrderCustomer(selectedRental));
  setInputValue("modalRentalId", selectedRental.id);
  setInputValue("modalAmountPaid", selectedRental.amount_paid || 0);
  setInputValue("modalPaidMonths", selectedRental.paid_months || 0);
  setInputValue("modalMissedPayments", selectedRental.missed_payments || 0);
  setInputValue("modalNextPaymentDate", formatDateForInput(selectedRental.next_payment_date));
  setInputValue("modalRentalStatus", health.rentalStatus === "archived" ? "active" : health.rentalStatus);
  setInputValue("modalPaymentStatus", health.paymentStatus === "closed" ? "on_time" : health.paymentStatus);

  setModalMessage("");

  const modal = document.getElementById("rentalModal");

  if (modal) {
    modal.hidden = false;
  }
}

function closeRentalModal() {
  const modal = document.getElementById("rentalModal");

  if (modal) {
    modal.hidden = true;
  }

  selectedRental = null;
}

async function handleRentalUpdate(event) {
  event.preventDefault();

  if (!selectedRental) {
    setModalMessage("No rental selected.");
    return;
  }

  const rentalId = document.getElementById("modalRentalId")?.value;

  const payload = {
    amount_paid: Number(document.getElementById("modalAmountPaid")?.value || 0),
    paid_months: Number(document.getElementById("modalPaidMonths")?.value || 0),
    missed_payments: Number(document.getElementById("modalMissedPayments")?.value || 0),
    next_payment_date: document.getElementById("modalNextPaymentDate")?.value || null,
    rental_status: document.getElementById("modalRentalStatus")?.value || "active",
    payment_status: document.getElementById("modalPaymentStatus")?.value || "on_time",
    updated_at: new Date().toISOString()
  };

  try {
    await updateRentalRecord(rentalId, payload);
    setModalMessage("Rental record updated.");
    await loadRentals();
    refreshSelectedRental(rentalId);
  } catch (error) {
    console.error("Rental update error:", error);
    setModalMessage("Failed to update rental record.");
  }
}

async function handleRecordMonthlyPayment() {
  if (!selectedRental) {
    setModalMessage("No rental selected.");
    return;
  }

  const monthlyPayment = Number(selectedRental.monthly_payment || 0);
  const currentAmountPaid = Number(selectedRental.amount_paid || 0);
  const currentPaidMonths = Number(selectedRental.paid_months || 0);
  const durationMonths = Number(selectedRental.rental_duration_months || 0);
  const totalAmount = Number(selectedRental.total_amount || selectedRental.total || selectedRental.amount || 0);

  if (monthlyPayment <= 0) {
    setModalMessage("Monthly payment is missing or zero. Please update the monthly payment amount in the database.");
    return;
  }

  const newAmountPaid = currentAmountPaid + monthlyPayment;
  const newPaidMonths = currentPaidMonths + 1;
  const fullyPaid = totalAmount > 0 && newAmountPaid >= totalAmount;
  const nextPaymentDate = addOneMonth(selectedRental.next_payment_date || new Date());

  const payload = {
    amount_paid: newAmountPaid,
    paid_months: newPaidMonths,
    missed_payments: 0,
    next_payment_date: fullyPaid ? null : formatDateForInput(nextPaymentDate),
    payment_status: fullyPaid || (durationMonths > 0 && newPaidMonths >= durationMonths) ? "fully_paid" : "on_time",
    rental_status: fullyPaid || (durationMonths > 0 && newPaidMonths >= durationMonths) ? "ownership_pending" : "active",
    updated_at: new Date().toISOString()
  };

  try {
    await updateRentalRecord(selectedRental.id, payload);
    setModalMessage("Monthly payment recorded.");
    await loadRentals();
    refreshSelectedRental(selectedRental.id);
  } catch (error) {
    console.error("Record payment error:", error);
    setModalMessage("Failed to record monthly payment.");
  }
}

async function handleTransferOwnership() {
  if (!selectedRental) {
    setModalMessage("No rental selected.");
    return;
  }

  const confirmed = confirm("Confirm ownership transfer for this rental?");

  if (!confirmed) {
    return;
  }

  const payload = {
    rental_status: "ownership_transferred",
    payment_status: "fully_paid",
    ownership_transferred: true,
    ownership_transfer_date: new Date().toISOString().slice(0, 10),
    updated_at: new Date().toISOString()
  };

  try {
    await updateRentalRecord(selectedRental.id, payload);
    setModalMessage("Ownership transfer confirmed.");
    await loadRentals();
    refreshSelectedRental(selectedRental.id);
  } catch (error) {
    console.error("Ownership transfer error:", error);
    setModalMessage("Failed to confirm ownership transfer.");
  }
}

async function handleArchiveRental() {
  if (!selectedRental) {
    setModalMessage("No rental selected.");
    return;
  }

  const confirmed = confirm("Move this rental to archive? It will no longer appear in the active rental list.");

  if (!confirmed) {
    return;
  }

  const payload = {
    archive_status: "archived",
    archived_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    await updateRentalRecord(selectedRental.id, payload);
    setModalMessage("Rental moved to archive.");
    await loadRentals();
    closeRentalModal();
  } catch (error) {
    console.error("Archive rental error:", error);
    setModalMessage("Failed to move rental to archive.");
  }
}

async function updateRentalRecord(orderId, payload) {
  const { error } = await supabaseClient
    .from("rental_orders")
    .update(payload)
    .eq("id", orderId);

  if (error) {
    throw error;
  }
}

function refreshSelectedRental(orderId) {
  selectedRental = rentals.find(order => String(order.id) === String(orderId)) || null;

  if (!selectedRental) {
    closeRentalModal();
    return;
  }

  const health = calculateRentalHealth(selectedRental);

  setInputValue("modalAmountPaid", selectedRental.amount_paid || 0);
  setInputValue("modalPaidMonths", selectedRental.paid_months || 0);
  setInputValue("modalMissedPayments", selectedRental.missed_payments || 0);
  setInputValue("modalNextPaymentDate", formatDateForInput(selectedRental.next_payment_date));
  setInputValue("modalRentalStatus", health.rentalStatus === "archived" ? "active" : health.rentalStatus);
  setInputValue("modalPaymentStatus", health.paymentStatus === "closed" ? "on_time" : health.paymentStatus);
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
      label: "Request payment",
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

  if (agentId && agentMap[agentId]) {
    return agentMap[agentId];
  }

  return (
    order.agent_name ||
    order.agent_email ||
    agentId ||
    "-"
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

function addOneMonth(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  date.setMonth(date.getMonth() + 1);

  return date;
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

function formatDateForInput(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
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

function setInputValue(id, value) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  element.value = value;
}

function setMessage(message) {
  const messageElement = document.getElementById("rentalsMessage");

  if (!messageElement) {
    return;
  }

  messageElement.textContent = message;
}

function setModalMessage(message) {
  const messageElement = document.getElementById("modalMessage");

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
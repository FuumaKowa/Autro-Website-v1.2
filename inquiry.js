const inquiryForm = document.getElementById("inquiryForm");
const selectedItemBox = document.getElementById("selectedItemBox");
const inquiryMessage = document.getElementById("inquiryMessage");
const inquirySubmitBtn = document.getElementById("inquirySubmitBtn");

const customerName = document.getElementById("customerName");
const customerPhone = document.getElementById("customerPhone");
const customerEmail = document.getElementById("customerEmail");
const rentalMonths = document.getElementById("rentalMonths");
const customerAddress = document.getElementById("customerAddress");
const customerNotes = document.getElementById("customerNotes");

let currentItemId = null;
let currentType = null;

(function initInquiry() {
  const params = new URLSearchParams(window.location.search);

  currentItemId = params.get("id");
  currentType = params.get("type");

  if (!currentItemId || !currentType) {
    selectedItemBox.innerHTML = `<p class="inquiry-empty">Invalid item.</p>`;
    return;
  }

  loadSelectedItem();
})();

function setMsg(msg, err = false) {
  inquiryMessage.textContent = msg;
  inquiryMessage.style.color = err ? "#9d4a3f" : "";
}

function formatCurrency(val) {
  return `RM ${Number(val || 0).toFixed(2)}`;
}

function escapeHtml(val) {
  return String(val || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadSelectedItem() {
  try {
    if (currentType === "package") {
      const { data, error } = await supabaseClient
        .from("packages")
        .select("*")
        .eq("id", currentItemId)
        .single();

      if (error || !data) throw error;

      selectedItemBox.innerHTML = `
        <div class="selected-item">
          <img src="${data.image_url || ""}">
          <div class="selected-item-title">${escapeHtml(data.name)}</div>
          <div class="selected-item-meta">${formatCurrency(data.price)}</div>
          <div class="selected-item-desc">${escapeHtml(data.description || "")}</div>
        </div>
      `;
    }

    if (currentType === "furniture") {
      const { data, error } = await supabaseClient
        .from("furniture_items")
        .select("*")
        .eq("id", currentItemId)
        .single();

      if (error || !data) throw error;

      selectedItemBox.innerHTML = `
        <div class="selected-item">
          <img src="${data.image_url || ""}">
          <div class="selected-item-title">${escapeHtml(data.name)}</div>
          <div class="selected-item-meta">${formatCurrency(data.price)}</div>
          <div class="selected-item-desc">${escapeHtml(data.description || "")}</div>
        </div>
      `;
    }
  } catch (err) {
    console.error(err);
    selectedItemBox.innerHTML = `<p class="inquiry-empty">Failed to load item.</p>`;
  }
}

async function getAutoAssignedAgentId() {
  const { data: agents, error: agentsError } = await supabaseClient
    .from("agents")
    .select("id, full_name, is_active")
    .eq("is_active", true);

  if (agentsError) throw agentsError;

  if (!agents || !agents.length) {
    return null;
  }

  const { data: inquiries, error: inquiriesError } = await supabaseClient
    .from("inquiries")
    .select("assigned_agent_id, status")
    .in("status", ["new", "assigned"]);

  if (inquiriesError) throw inquiriesError;

  const agentLoad = agents.map((agent) => {
    const activeCount = (inquiries || []).filter(
      (inquiry) => inquiry.assigned_agent_id === agent.id
    ).length;

    return {
      id: agent.id,
      activeCount
    };
  });

  agentLoad.sort((a, b) => a.activeCount - b.activeCount);

  return agentLoad[0].id;
}

inquiryForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  inquirySubmitBtn.disabled = true;
  inquirySubmitBtn.textContent = "Submitting...";

  try {
    const assignedAgentId = await getAutoAssignedAgentId();

    const payload = {
      type: currentType,
      item_id: currentItemId,
      customer_name: customerName.value.trim(),
      email: customerEmail.value.trim() || null,
      phone: customerPhone.value.trim(),
      address: customerAddress.value.trim(),
      rental_months: Number(rentalMonths.value || 1),
      notes: customerNotes.value.trim() || null,
      assigned_agent_id: assignedAgentId,
      status: assignedAgentId ? "assigned" : "new"
    };

    const { error } = await supabaseClient
      .from("inquiries")
      .insert(payload);

    if (error) throw error;

    setMsg("Inquiry submitted successfully. Our team will contact you soon.");
    inquiryForm.reset();

  } catch (err) {
    console.error(err);
    setMsg(err.message || "Failed to submit inquiry.", true);
  }

  inquirySubmitBtn.disabled = false;
  inquirySubmitBtn.textContent = "Submit Inquiry";
});
const inquiriesList = document.getElementById("inquiriesList");
const statusFilter = document.getElementById("statusFilter");
const logoutBtn = document.getElementById("logoutBtn");

let agentsCache = [];
let packagesCache = [];
let furnitureCache = [];

(async function init() {
  const ok = await requireAdmin();
  if (!ok) return;

  logoutBtn.onclick = async () => {
    await signOutUser();
    window.location.href = "admin-login.html";
  };

  statusFilter.addEventListener("change", loadInquiries);

  await loadReferenceData();
  await loadInquiries();
})();

function escapeHtml(val) {
  return String(val || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCurrency(value) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

async function loadReferenceData() {
  const [agentsResult, packagesResult, furnitureResult] = await Promise.all([
    supabaseClient.from("agents").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("packages").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("furniture_items").select("*").order("created_at", { ascending: false })
  ]);

  if (agentsResult.error) console.error("Agents load error:", agentsResult.error);
  if (packagesResult.error) console.error("Packages load error:", packagesResult.error);
  if (furnitureResult.error) console.error("Furniture load error:", furnitureResult.error);

  agentsCache = agentsResult.data || [];
  packagesCache = packagesResult.data || [];
  furnitureCache = furnitureResult.data || [];
}

async function loadInquiries() {
  const filter = statusFilter.value;

  let query = supabaseClient
    .from("inquiries")
    .select("*")
    .order("created_at", { ascending: false });

  if (filter !== "all") {
    query = query.eq("status", filter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Inquiries load error:", error);
    inquiriesList.innerHTML = `<p class="inquiry-empty">Failed to load inquiries.</p>`;
    return;
  }

  if (!data || !data.length) {
    inquiriesList.innerHTML = `<p class="inquiry-empty">No inquiries found.</p>`;
    return;
  }

  inquiriesList.innerHTML = data.map((inquiry) => renderInquiryCard(inquiry)).join("");
}

function getInquiryItem(inquiry) {
  if (inquiry.type === "package") {
    const item = packagesCache.find((pkg) => pkg.id === inquiry.item_id);

    return {
      name: item?.name || "Unknown package",
      price: item?.price || 0,
      description: item?.description || "",
      image: item?.image_url || "",
      typeLabel: "Package"
    };
  }

  if (inquiry.type === "furniture") {
    const item = furnitureCache.find((furniture) => furniture.id === inquiry.item_id);

    return {
      name: item?.name || "Unknown furniture",
      price: item?.price || 0,
      description: item?.description || "",
      image: item?.image_url || "",
      typeLabel: "Furniture"
    };
  }

  return {
    name: "Unknown item",
    price: 0,
    description: "",
    image: "",
    typeLabel: "Unknown"
  };
}

function renderInquiryCard(inquiry) {
  const assignedAgent = agentsCache.find((agent) => agent.id === inquiry.assigned_agent_id);
  const item = getInquiryItem(inquiry);

  return `
    <div class="inquiry-card">
      <div class="inquiry-card-head">
        <div>
          <div class="inquiry-customer-name">${escapeHtml(inquiry.customer_name)}</div>
          <div class="inquiry-meta">
            Inquiry ID: ${escapeHtml(inquiry.id)}
          </div>
        </div>

        <div class="inquiry-status">${escapeHtml(inquiry.status || "new")}</div>
      </div>

      <div class="inquiry-selected-item">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">

        <div>
          <div class="inquiry-info-label">Selected ${escapeHtml(item.typeLabel)}</div>
          <div class="inquiry-selected-title">${escapeHtml(item.name)}</div>
          <div class="inquiry-selected-price">${formatCurrency(item.price)}</div>
          <div class="inquiry-selected-desc">${escapeHtml(item.description)}</div>
        </div>
      </div>

      <div class="inquiry-card-body">
        <div class="inquiry-info-block">
          <div class="inquiry-info-label">Submitted Date</div>
          <div class="inquiry-info-value">${formatDate(inquiry.created_at)}</div>
        </div>

        <div class="inquiry-info-block">
          <div class="inquiry-info-label">Assigned Agent</div>
          <div class="inquiry-info-value">${escapeHtml(assignedAgent?.full_name || "Not assigned")}</div>
        </div>

        <div class="inquiry-info-block">
          <div class="inquiry-info-label">Phone</div>
          <div class="inquiry-info-value">${escapeHtml(inquiry.phone)}</div>
        </div>

        <div class="inquiry-info-block">
          <div class="inquiry-info-label">Email</div>
          <div class="inquiry-info-value">${escapeHtml(inquiry.email || "-")}</div>
        </div>

        <div class="inquiry-info-block">
          <div class="inquiry-info-label">Rental Duration</div>
          <div class="inquiry-info-value">${Number(inquiry.rental_months || 1)} month(s)</div>
        </div>

        <div class="inquiry-info-block">
          <div class="inquiry-info-label">Inquiry Type</div>
          <div class="inquiry-info-value">${escapeHtml(item.typeLabel)}</div>
        </div>

        <div class="inquiry-info-block full">
          <div class="inquiry-info-label">Delivery Address</div>
          <div class="inquiry-info-value">${escapeHtml(inquiry.address)}</div>
        </div>

        <div class="inquiry-info-block full">
          <div class="inquiry-info-label">Customer Notes</div>
          <div class="inquiry-info-value">${escapeHtml(inquiry.notes || "-")}</div>
        </div>
      </div>

      <div class="inquiry-actions">
        <select onchange="assignAgent('${inquiry.id}', this.value)">
          <option value="">Assign Agent</option>
          ${agentsCache.map((agent) => `
            <option value="${agent.id}" ${inquiry.assigned_agent_id === agent.id ? "selected" : ""}>
              ${escapeHtml(agent.full_name)}
            </option>
          `).join("")}
        </select>

        <button class="inquiry-action-btn primary"
          onclick="confirmInquiry('${inquiry.id}')">
          Confirm
        </button>

        <button class="inquiry-action-btn danger"
          onclick="deleteInquiry('${inquiry.id}')">
          Delete
        </button>
      </div>
    </div>
  `;
}

window.assignAgent = async function (id, agentId) {
  if (!agentId) return;

  const { error } = await supabaseClient
    .from("inquiries")
    .update({
      assigned_agent_id: agentId,
      status: "assigned"
    })
    .eq("id", id);

  if (error) {
    console.error("Assign agent error:", error);
    alert(error.message);
    return;
  }

  await loadInquiries();
};

window.confirmInquiry = async function (id) {
  const { error } = await supabaseClient
    .from("inquiries")
    .update({
      status: "confirmed"
    })
    .eq("id", id);

  if (error) {
    console.error("Confirm inquiry error:", error);
    alert(error.message);
    return;
  }

  await loadInquiries();
};

window.deleteInquiry = async function (id) {
  if (!confirm("Delete this inquiry?")) return;

  const { error } = await supabaseClient
    .from("inquiries")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Delete inquiry error:", error);
    alert(error.message);
    return;
  }

  await loadInquiries();
};
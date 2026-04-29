const inquiriesList = document.getElementById("inquiriesList");
const statusFilter = document.getElementById("statusFilter");
const logoutBtn = document.getElementById("logoutBtn");

let agentsCache = [];

(async function init() {
  const ok = await requireAdmin();
  if (!ok) return;

  logoutBtn.onclick = async () => {
    await signOutUser();
    window.location.href = "admin-login.html";
  };

  statusFilter.addEventListener("change", loadInquiries);

  await loadAgents();
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

async function loadAgents() {
  const { data } = await supabaseClient
    .from("agents")
    .select("*");

  agentsCache = data || [];
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

  if (error || !data) {
    inquiriesList.innerHTML = `<p class="inquiry-empty">Failed to load inquiries.</p>`;
    return;
  }

  if (!data.length) {
    inquiriesList.innerHTML = `<p class="inquiry-empty">No inquiries found.</p>`;
    return;
  }

  inquiriesList.innerHTML = data.map(i => renderInquiryCard(i)).join("");
}

function renderInquiryCard(i) {
    const assignedAgent = agentsCache.find(a => a.id === i.assigned_agent_id);
  return `
    <div class="inquiry-card">
      <div class="inquiry-card-head">
        <div>
          <div class="inquiry-customer-name">${escapeHtml(i.customer_name)}</div>
          <div class="inquiry-meta">
            ${escapeHtml(i.type)} · ${new Date(i.created_at).toLocaleString()} · Agent: ${escapeHtml(assignedAgent?.full_name || "Not assigned")}
          </div>
        </div>

        <div class="inquiry-status">${escapeHtml(i.status)}</div>
      </div>

      <div class="inquiry-card-body">
        <div class="inquiry-info-block">
          <div class="inquiry-info-label">Phone</div>
          <div class="inquiry-info-value">${escapeHtml(i.phone)}</div>
        </div>

        <div class="inquiry-info-block">
          <div class="inquiry-info-label">Email</div>
          <div class="inquiry-info-value">${escapeHtml(i.email || "-")}</div>
        </div>

        <div class="inquiry-info-block">
          <div class="inquiry-info-label">Duration</div>
          <div class="inquiry-info-value">${i.rental_months} month(s)</div>
        </div>

        <div class="inquiry-info-block">
          <div class="inquiry-info-label">Type</div>
          <div class="inquiry-info-value">${escapeHtml(i.type)}</div>
        </div>

        <div class="inquiry-info-block full">
          <div class="inquiry-info-label">Address</div>
          <div class="inquiry-info-value">${escapeHtml(i.address)}</div>
        </div>

        <div class="inquiry-info-block full">
          <div class="inquiry-info-label">Notes</div>
          <div class="inquiry-info-value">${escapeHtml(i.notes || "-")}</div>
        </div>
      </div>

      <div class="inquiry-actions">
        <select onchange="assignAgent('${i.id}', this.value)">
            <option value="">Assign Agent</option>
            ${agentsCache.map(a => `
              <option value="${a.id}" ${i.assigned_agent_id === a.id ? "selected" : ""}>
                ${escapeHtml(a.full_name)}
              </option>
            `).join("")}
        </select>

        <button class="inquiry-action-btn primary"
          onclick="confirmInquiry('${i.id}')">
          Confirm
        </button>

        <button class="inquiry-action-btn danger"
          onclick="deleteInquiry('${i.id}')">
          Delete
        </button>
      </div>
    </div>
  `;
}

/* ---------- ACTIONS ---------- */

window.assignAgent = async function (id, agentId) {
  if (!agentId) return;

  const { data, error } = await supabaseClient
    .from("inquiries")
    .update({
      assigned_agent_id: agentId,
      status: "assigned"
    })
    .eq("id", id)
    .select();

  if (error) {
    console.error("Assign agent error:", error);
    alert(error.message);
    return;
  }

  console.log("Updated inquiry:", data);

  await loadInquiries();
};

window.confirmInquiry = async function (id) {
  await supabaseClient
    .from("inquiries")
    .update({
      status: "confirmed"
    })
    .eq("id", id);

  loadInquiries();
};

window.deleteInquiry = async function (id) {
  if (!confirm("Delete this inquiry?")) return;

  await supabaseClient
    .from("inquiries")
    .delete()
    .eq("id", id);

  loadInquiries();
};
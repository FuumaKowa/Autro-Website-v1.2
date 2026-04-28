const PACKAGE_BUCKET = "furniture-images";

const packageForm = document.getElementById("packageForm");
const packageName = document.getElementById("packageName");
const packagePrice = document.getElementById("packagePrice");
const packageDescription = document.getElementById("packageDescription");
const packageImage = document.getElementById("packageImage");

const packageImagePreview = document.getElementById("packageImagePreview");
const packageImageEmpty = document.getElementById("packageImageEmpty");
const packageCropBtn = document.getElementById("packageCropBtn");
const packageClearImageBtn = document.getElementById("packageClearImageBtn");

const packageItemsContainer = document.getElementById("packageItemsContainer");
const addPackageItemBtn = document.getElementById("addPackageItemBtn");

const packageSubmitBtn = document.getElementById("packageSubmitBtn");
const packageResetBtn = document.getElementById("packageResetBtn");
const packageCancelEditBtn = document.getElementById("packageCancelEditBtn");

const packagesList = document.getElementById("packagesList");
const packageMessage = document.getElementById("packageMessage");
const editingPackageId = document.getElementById("editingPackageId");
const logoutBtn = document.getElementById("logoutBtn");

let cropper = null;
let croppedBlob = null;
let packageItems = [];
let furnitureCache = [];

(async function initPackageAdmin() {
  const ok = await requireAdmin();
  if (!ok) return;

  logoutBtn.addEventListener("click", async () => {
    await signOutUser();
    window.location.href = "admin-login.html";
  });

  addPackageItemBtn.addEventListener("click", addItem);
  packageResetBtn.addEventListener("click", resetForm);
  packageCancelEditBtn.addEventListener("click", resetForm);

  await loadFurniture();
  await loadPackages();
  renderItems();
})();

function setMsg(message, isError = false) {
  packageMessage.textContent = message;
  packageMessage.style.color = isError ? "#9d4a3f" : "";
}

function formatCurrency(value) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetImageEditor() {
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }

  croppedBlob = null;
  packageImage.value = "";

  packageImagePreview.hidden = true;
  packageImagePreview.removeAttribute("src");
  packageImageEmpty.style.display = "block";
}

packageImage.addEventListener("change", () => {
  const file = packageImage.files?.[0];

  if (!file) {
    resetImageEditor();
    return;
  }

  if (!file.type.startsWith("image/")) {
    setMsg("Please upload a valid image file.", true);
    resetImageEditor();
    return;
  }

  croppedBlob = null;

  const reader = new FileReader();

  reader.onload = (event) => {
    packageImagePreview.src = event.target.result;
    packageImagePreview.hidden = false;
    packageImageEmpty.style.display = "none";

    packageImagePreview.onload = () => {
      if (cropper) cropper.destroy();

      cropper = new Cropper(packageImagePreview, {
        aspectRatio: 4 / 3,
        viewMode: 1,
        autoCropArea: 1,
        responsive: true,
        background: false,
        movable: true,
        zoomable: true,
        scalable: true,
        cropBoxResizable: true
      });
    };
  };

  reader.readAsDataURL(file);
});

packageCropBtn.addEventListener("click", () => {
  if (!cropper) {
    setMsg("Select an image first.", true);
    return;
  }

  const canvas = cropper.getCroppedCanvas({
    width: 800,
    height: 600,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high"
  });

  canvas.toBlob((blob) => {
    if (!blob) {
      setMsg("Failed to crop image.", true);
      return;
    }

    croppedBlob = blob;

    const croppedUrl = URL.createObjectURL(blob);

    cropper.destroy();
    cropper = null;

    packageImagePreview.src = croppedUrl;
    packageImagePreview.hidden = false;
    packageImageEmpty.style.display = "none";

    setMsg("Crop applied.");
  }, "image/jpeg", 0.9);
});

packageClearImageBtn.addEventListener("click", () => {
  resetImageEditor();
  setMsg("");
});

function addItem() {
  packageItems.push({
    furniture_id: "",
    custom_name: "",
    custom_price: 0,
    quantity: 1
  });

  renderItems();
}

window.removeItem = function removeItem(index) {
  packageItems.splice(index, 1);
  renderItems();
};

window.updateItem = function updateItem(index, field, value) {
  if (!packageItems[index]) return;

  if (field === "quantity") {
    packageItems[index][field] = Math.max(1, Number(value || 1));
    return;
  }

  if (field === "custom_price") {
    packageItems[index][field] = Math.max(0, Number(value || 0));
    return;
  }

  packageItems[index][field] = value;
};

function renderItems() {
  if (!packageItems.length) {
    packageItemsContainer.innerHTML = `
      <div class="package-empty">
        No furniture items added yet. Click + Add Furniture to start building this package.
      </div>
    `;
    return;
  }

  packageItemsContainer.innerHTML = packageItems.map((item, index) => `
    <div class="package-item-card">
      <div class="package-item-card-head">
        <div class="package-item-title-wrap">
          <div class="package-item-icon">▱</div>
          <div class="package-item-card-title">Item ${index + 1}</div>
          <div class="package-item-badge">Furniture Item</div>
        </div>

        <button type="button" class="package-item-remove-btn" onclick="removeItem(${index})">
          Remove
        </button>
      </div>

      <div class="package-item-body">
        <div class="package-item-grid">
          <div class="package-item-field">
            <label>Select Furniture <span>*</span></label>
            <p class="package-item-help">Choose from existing catalog</p>
            <select onchange="updateItem(${index}, 'furniture_id', this.value)" required>
              <option value="">Select Furniture</option>
              ${furnitureCache.map((furniture) => `
                <option value="${furniture.id}" ${furniture.id === item.furniture_id ? "selected" : ""}>
                  ${escapeHtml(furniture.name)}
                </option>
              `).join("")}
            </select>
          </div>

          <div class="package-item-field">
            <label>Quantity <span>*</span></label>
            <p class="package-item-help">How many units of this item</p>
            <input type="number" min="1" value="${item.quantity || 1}"
              onchange="updateItem(${index}, 'quantity', this.value)" required>
          </div>

          <div class="package-item-field package-item-full">
            <label>Custom Name <small>(Optional)</small></label>
            <p class="package-item-help">
              Enter a custom name for this item. Leave blank to use the selected furniture name.
            </p>
            <input type="text" placeholder="e.g. Living Room Chair"
              value="${escapeHtml(item.custom_name || "")}"
              onchange="updateItem(${index}, 'custom_name', this.value)">
          </div>

          <div class="package-item-field package-item-full">
            <label>Custom Price (RM) <small>(Optional)</small></label>
            <p class="package-item-help">
              Enter a custom price for this item. Leave 0 to use default pricing.
            </p>
            <input type="number" min="0" step="0.01" placeholder="0.00"
              value="${item.custom_price || 0}"
              onchange="updateItem(${index}, 'custom_price', this.value)">
          </div>
        </div>
      </div>
    </div>
  `).join("") + `
    <div class="package-add-more-box">
      <div class="package-add-more-content">
        <button type="button" class="package-add-more-icon" onclick="addItem()">+</button>
        <div>
          <h3>Add more furniture items to this package</h3>
          <p>Click the button above to add another item</p>
        </div>
      </div>
    </div>
  `;
}

window.addItem = addItem;

async function loadFurniture() {
  const { data, error } = await supabaseClient
    .from("furniture_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Furniture load error:", error);
    setMsg("Failed to load furniture catalog.", true);
    furnitureCache = [];
    return;
  }

  furnitureCache = data || [];
}

async function uploadImage() {
  if (!croppedBlob) return null;

  const filePath = `packages/package-${Date.now()}.jpg`;

  const { error } = await supabaseClient.storage
    .from(PACKAGE_BUCKET)
    .upload(filePath, croppedBlob, {
      cacheControl: "3600",
      upsert: false,
      contentType: "image/jpeg"
    });

  if (error) throw error;

  const { data } = supabaseClient.storage
    .from(PACKAGE_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

function validatePackageItems() {
  if (!packageItems.length) {
    throw new Error("Add at least one furniture item.");
  }

  const invalidItem = packageItems.find((item) => !item.furniture_id);

  if (invalidItem) {
    throw new Error("Please select furniture for every package item.");
  }
}

packageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMsg("");

  packageSubmitBtn.disabled = true;
  packageSubmitBtn.textContent = editingPackageId.value ? "Updating..." : "Publishing...";

  try {
    validatePackageItems();

    const imageUrl = await uploadImage();

    const payload = {
      name: packageName.value.trim(),
      price: Number(packagePrice.value || 0),
      description: packageDescription.value.trim()
    };

    if (imageUrl) {
      payload.image_url = imageUrl;
    }

    let packageId = editingPackageId.value;

    if (packageId) {
      const { error: updateError } = await supabaseClient
        .from("packages")
        .update(payload)
        .eq("id", packageId);

      if (updateError) throw updateError;

      const { error: deleteItemsError } = await supabaseClient
        .from("package_items")
        .delete()
        .eq("package_id", packageId);

      if (deleteItemsError) throw deleteItemsError;
    } else {
      if (!imageUrl) {
        throw new Error("Please upload and crop a package image before publishing.");
      }

      const { data, error: insertError } = await supabaseClient
        .from("packages")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) {
        console.error("Package insert error:", insertError);
        throw new Error(insertError.message || "Failed to create package.");
      }

      if (!data || !data.id) {
        throw new Error("Package was created but no package ID was returned.");
      }

      packageId = data.id;
    }

    const itemsInsert = packageItems.map((item) => ({
      package_id: packageId,
      furniture_id: item.furniture_id,
      custom_name: item.custom_name?.trim() || null,
      custom_price: Number(item.custom_price || 0),
      quantity: Number(item.quantity || 1)
    }));

    const { error: itemsError } = await supabaseClient
      .from("package_items")
      .insert(itemsInsert);

    if (itemsError) {
      console.error("Package items insert error:", itemsError);
      throw new Error(itemsError.message || "Failed to save package items.");
    }

    setMsg(editingPackageId.value ? "Package updated successfully." : "Package published successfully.");

    resetForm();
    await loadPackages();
  } catch (error) {
    console.error("Package save error:", error);
    setMsg(error.message || "Failed to save package.", true);
  } finally {
    packageSubmitBtn.disabled = false;
    packageSubmitBtn.textContent = editingPackageId.value ? "Update Package" : "Publish Package";
  }
});

async function loadPackages() {
  const { data, error } = await supabaseClient
    .from("packages")
    .select(`
      *,
      package_items (
        *,
        furniture_items (
          name,
          price
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Package load error:", error);
    packagesList.innerHTML = `<p class="package-empty">Failed to load packages.</p>`;
    return;
  }

  if (!data || !data.length) {
    packagesList.innerHTML = `<p class="package-empty">No packages yet.</p>`;
    return;
  }

  packagesList.innerHTML = data.map((pkg) => {
    const itemsHtml = (pkg.package_items || []).map((item) => {
      const name = item.custom_name || item.furniture_items?.name || "Unnamed item";
      return `<li>${escapeHtml(name)} x${Number(item.quantity || 1)}</li>`;
    }).join("");

    return `
      <div class="package-list-item">
        <img src="${pkg.image_url || ""}" alt="${escapeHtml(pkg.name)}">
        <div>
          <div class="package-list-title">${escapeHtml(pkg.name)}</div>
          <div class="package-list-meta">${formatCurrency(pkg.price)}</div>
          <div class="package-list-desc">${escapeHtml(pkg.description || "")}</div>

          <ul class="package-list-items">
            ${itemsHtml || "<li>No package items.</li>"}
          </ul>

          <div class="package-list-actions">
            <button type="button" class="package-list-action-btn" onclick="editPackage('${pkg.id}')">Edit</button>
            <button type="button" class="package-list-action-btn danger" onclick="deletePackage('${pkg.id}')">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

window.editPackage = async function editPackage(id) {
  setMsg("");

  const { data, error } = await supabaseClient
    .from("packages")
    .select("*, package_items(*)")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Package edit load error:", error);
    setMsg("Failed to load package for editing.", true);
    return;
  }

  editingPackageId.value = data.id;
  packageName.value = data.name || "";
  packagePrice.value = data.price || 0;
  packageDescription.value = data.description || "";

  if (data.image_url) {
    packageImagePreview.src = data.image_url;
    packageImagePreview.hidden = false;
    packageImageEmpty.style.display = "none";
  } else {
    resetImageEditor();
  }

  packageItems = (data.package_items || []).map((item) => ({
    furniture_id: item.furniture_id || "",
    custom_name: item.custom_name || "",
    custom_price: Number(item.custom_price || 0),
    quantity: Number(item.quantity || 1)
  }));

  renderItems();

  packageCancelEditBtn.hidden = false;
  packageSubmitBtn.textContent = "Update Package";

  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.deletePackage = async function deletePackage(id) {
  if (!confirm("Delete this package?")) return;

  const { error } = await supabaseClient
    .from("packages")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Package delete error:", error);
    setMsg(error.message || "Failed to delete package.", true);
    return;
  }

  setMsg("Package deleted successfully.");
  await loadPackages();
};

function resetForm() {
  packageForm.reset();
  editingPackageId.value = "";
  packageItems = [];

  resetImageEditor();
  renderItems();

  packageSubmitBtn.textContent = "Publish Package";
  packageCancelEditBtn.hidden = true;
  setMsg("");
}
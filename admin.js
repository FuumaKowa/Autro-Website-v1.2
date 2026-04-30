const BUCKET_NAME = "furniture-images";
const TABLE_NAME = "furniture_items";

const adminForm = document.getElementById("adminForm");
const itemName = document.getElementById("itemName");
const itemPrice = document.getElementById("itemPrice");
const itemCategory = document.getElementById("itemCategory");
const itemDescription = document.getElementById("itemDescription");
const itemImage = document.getElementById("itemImage");

const editingItemId = document.getElementById("editingItemId");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const imagePreview = document.getElementById("imagePreview");
const imageEditorEmpty = document.getElementById("imageEditorEmpty");
const cropBtn = document.getElementById("cropBtn");
const clearImageBtn = document.getElementById("clearImageBtn");

const adminMessage = document.getElementById("adminMessage");
const catalogList = document.getElementById("catalogList");
const submitBtn = document.getElementById("submitBtn");
const resetBtn = document.getElementById("resetBtn");
const logoutBtn = document.getElementById("logoutBtn");

const formTitle = document.getElementById("formTitle");
const cardTitle = document.getElementById("cardTitle");

let cropper = null;
let croppedBlob = null;

(async function initAdminPage() {
  const result = await requireAdmin();
  if (!result) return;

  logoutBtn.addEventListener("click", async () => {
    await signOutUser();
    window.location.href = "admin-login.html";
  });

  resetBtn.addEventListener("click", resetForm);
  cancelEditBtn.addEventListener("click", resetForm);
  clearImageBtn.addEventListener("click", clearImageSelection);
  cropBtn.addEventListener("click", applyCrop);
  itemImage.addEventListener("change", handleImageSelection);
  adminForm.addEventListener("submit", handleSubmit);

  await loadCatalog();
})();

function setMessage(message, isError = false) {
  adminMessage.textContent = message;
  adminMessage.style.color = isError ? "#9d4a3f" : "";
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

  imagePreview.hidden = true;
  imagePreview.removeAttribute("src");
  imagePreview.style.display = "none";
  imageEditorEmpty.style.display = "block";
}

function clearImageSelection() {
  itemImage.value = "";
  resetImageEditor();
  setMessage("");
}

function startCropper() {
  if (cropper) {
    cropper.destroy();
  }

  cropper = new Cropper(imagePreview, {
    aspectRatio: 4 / 3,
    viewMode: 1,
    autoCropArea: 1,
    background: false,
    responsive: true
  });
}

function handleImageSelection() {
  const file = itemImage.files?.[0];

  if (!file) {
    resetImageEditor();
    return;
  }

  if (!file.type.startsWith("image/")) {
    itemImage.value = "";
    resetImageEditor();
    setMessage("Please select a valid image file.", true);
    return;
  }

  croppedBlob = null;

  const reader = new FileReader();

  reader.onload = (event) => {
    imagePreview.src = event.target.result;
    imagePreview.hidden = false;
    imagePreview.style.display = "block";
    imageEditorEmpty.style.display = "none";

    imagePreview.onload = () => {
      startCropper();
    };
  };

  reader.readAsDataURL(file);
}

function applyCrop() {
  if (!cropper) {
    setMessage("Select an image first.", true);
    return;
  }

  const canvas = cropper.getCroppedCanvas({
    width: 800,
    height: 600,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high"
  });

  if (!canvas) {
    setMessage("Unable to crop image.", true);
    return;
  }

  canvas.toBlob((blob) => {
    if (!blob) {
      setMessage("Unable to process cropped image.", true);
      return;
    }

    croppedBlob = blob;

    const previewUrl = URL.createObjectURL(blob);

    cropper.destroy();
    cropper = null;

    imagePreview.src = previewUrl;
    imagePreview.hidden = false;
    imagePreview.style.display = "block";

    setMessage("Crop applied.");
  }, "image/jpeg", 0.9);
}

function resetForm() {
  adminForm.reset();
  editingItemId.value = "";
  resetImageEditor();

  submitBtn.textContent = "Publish Item";
  formTitle.textContent = "Add Furniture Item";
  cardTitle.textContent = "New Item";
  cancelEditBtn.hidden = true;

  setMessage("");
}

async function uploadImage() {
  if (!croppedBlob) {
    throw new Error("Crop image first.");
  }

  const path = `catalog/${Date.now()}-${crypto.randomUUID()}.jpg`;

  const { error } = await supabaseClient.storage
    .from(BUCKET_NAME)
    .upload(path, croppedBlob, {
      contentType: "image/jpeg",
      upsert: false
    });

  if (error) throw error;

  const { data } = supabaseClient.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return data.publicUrl;
}

async function deleteFurniture(id) {
  if (!confirm("Delete this item?")) return;

  try {
    setMessage("Deleting item...");

    const { error: packageError } = await supabaseClient
      .from("package_items")
      .update({ furniture_id: null })
      .eq("furniture_id", id);

    if (packageError) throw packageError;

    const { error: deleteError } = await supabaseClient
      .from(TABLE_NAME)
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    setMessage("Item deleted.");
    await loadCatalog();
  } catch (error) {
    console.error("Delete furniture error:", error);
    setMessage(error.message || "Delete failed.", true);
  }
}

function startEdit(item) {
  if (!item) return;

  resetImageEditor();

  editingItemId.value = item.id;
  itemName.value = item.name || "";
  itemPrice.value = item.price || 0;
  itemCategory.value = item.category || "living";
  itemDescription.value = item.description || "";

  if (item.image_url) {
    imagePreview.src = item.image_url;
    imagePreview.hidden = false;
    imagePreview.style.display = "block";
    imageEditorEmpty.style.display = "none";
  }

  submitBtn.textContent = "Update Item";
  formTitle.textContent = "Edit Furniture Item";
  cardTitle.textContent = "Editing Item";
  cancelEditBtn.hidden = false;

  setMessage("Editing item. Upload and crop a new image only if you want to replace the current one.");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

async function handleSubmit(event) {
  event.preventDefault();

  submitBtn.disabled = true;

  try {
    const name = itemName.value.trim();
    const price = Number(itemPrice.value);
    const category = itemCategory.value;
    const description = itemDescription.value.trim();

    if (!name) throw new Error("Item name is required.");
    if (Number.isNaN(price) || price < 0) throw new Error("Enter a valid price.");
    if (!category) throw new Error("Category is required.");
    if (!description) throw new Error("Description is required.");

    let imageUrl = null;

    if (croppedBlob) {
      setMessage("Uploading image...");
      imageUrl = await uploadImage();
    }

    const payload = {
      name,
      price,
      category,
      description
    };

    if (imageUrl) {
      payload.image_url = imageUrl;
    }

    if (editingItemId.value) {
      setMessage("Updating item...");

      const { error } = await supabaseClient
        .from(TABLE_NAME)
        .update(payload)
        .eq("id", editingItemId.value);

      if (error) throw error;

      setMessage("Item updated.");
    } else {
      if (!imageUrl) {
        throw new Error("Image is required for new items.");
      }

      setMessage("Publishing item...");

      const { error } = await supabaseClient
        .from(TABLE_NAME)
        .insert(payload);

      if (error) throw error;

      setMessage("Item added.");
    }

    resetForm();
    await loadCatalog();
  } catch (error) {
    console.error("Admin form error:", error);
    setMessage(error.message || "Failed to save item.", true);
  } finally {
    submitBtn.disabled = false;
  }
}

async function loadCatalog() {
  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Catalog load error:", error);
    catalogList.innerHTML = `<p class="catalog-empty">Failed to load catalog.</p>`;
    return;
  }

  if (!data || !data.length) {
    catalogList.innerHTML = `<p class="catalog-empty">No furniture items found.</p>`;
    return;
  }

  catalogList.innerHTML = data.map((item) => {
    const safeItem = encodeURIComponent(JSON.stringify(item));

    return `
      <div class="catalog-item">
        <img src="${escapeHtml(item.image_url || "")}" alt="${escapeHtml(item.name || "Furniture item")}">

        <div class="catalog-item-content">
          <div class="catalog-item-title">${escapeHtml(item.name)}</div>
          <div class="catalog-item-meta">${escapeHtml(item.category)} · ${formatCurrency(item.price)}</div>
          <div class="catalog-item-desc">${escapeHtml(item.description)}</div>

          <div class="catalog-item-actions">
            <button class="catalog-action-btn" type="button" onclick="startEdit(JSON.parse(decodeURIComponent('${safeItem}')))">Edit</button>
            <button class="catalog-action-btn danger" type="button" onclick="deleteFurniture('${escapeHtml(item.id)}')">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}
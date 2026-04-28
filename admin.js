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
let selectedFile = null;

(async function initAdminPage() {
  const result = await requireAdmin();
  if (!result) return;

  logoutBtn.addEventListener("click", async () => {
    await signOutUser();
    window.location.href = "admin-login.html";
  });

  await loadCatalog();
})();

function setMessage(message, isError = false) {
  adminMessage.textContent = message;
  adminMessage.style.color = isError ? "#9d4a3f" : "";
}

function formatCurrency(value) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}

function resetImageEditor() {
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }

  croppedBlob = null;
  selectedFile = null;

  imagePreview.hidden = true;
  imagePreview.removeAttribute("src");
  imagePreview.style.display = "none";
  imageEditorEmpty.style.display = "block";
}

function startCropper() {
  if (cropper) {
    cropper.destroy();
  }

  cropper = new Cropper(imagePreview, {
    aspectRatio: 4 / 3,
    viewMode: 1,
    autoCropArea: 1
  });
}

itemImage.addEventListener("change", () => {
  const file = itemImage.files?.[0];

  if (!file) {
    resetImageEditor();
    return;
  }

  selectedFile = file;
  croppedBlob = null;

  const reader = new FileReader();
  reader.onload = (e) => {
    imagePreview.src = e.target.result;
    imagePreview.hidden = false;
    imagePreview.style.display = "block";
    imageEditorEmpty.style.display = "none";

    imagePreview.onload = () => startCropper();
  };

  reader.readAsDataURL(file);
});

cropBtn.addEventListener("click", () => {
  if (!cropper) {
    setMessage("Select image first", true);
    return;
  }

  const canvas = cropper.getCroppedCanvas({
    width: 800,
    height: 600
  });

  canvas.toBlob((blob) => {
    croppedBlob = blob;
    const url = URL.createObjectURL(blob);

    cropper.destroy();
    cropper = null;

    imagePreview.src = url;
    setMessage("Crop applied");
  }, "image/jpeg", 0.9);
});

clearImageBtn.addEventListener("click", () => {
  itemImage.value = "";
  resetImageEditor();
});

resetBtn.addEventListener("click", resetForm);

cancelEditBtn.addEventListener("click", () => {
  resetForm();
});

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
  if (!croppedBlob) throw new Error("Crop image first");

  const path = `catalog/${Date.now()}.jpg`;

  const { error } = await supabaseClient.storage
    .from(BUCKET_NAME)
    .upload(path, croppedBlob, { contentType: "image/jpeg" });

  if (error) throw error;

  const { data } = supabaseClient.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return data.publicUrl;
}

async function deleteFurniture(id) {
  if (!confirm("Delete this item?")) return;

  try {
    await supabaseClient
      .from("package_items")
      .update({ furniture_id: null })
      .eq("furniture_id", id);

    await supabaseClient
      .from(TABLE_NAME)
      .delete()
      .eq("id", id);

    setMessage("Item deleted");
    loadCatalog();
  } catch (err) {
    setMessage("Delete failed", true);
  }
}

function startEdit(item) {
  editingItemId.value = item.id;

  itemName.value = item.name;
  itemPrice.value = item.price;
  itemCategory.value = item.category;
  itemDescription.value = item.description;

  imagePreview.src = item.image_url;
  imagePreview.hidden = false;
  imagePreview.style.display = "block";
  imageEditorEmpty.style.display = "none";

  submitBtn.textContent = "Update Item";
  formTitle.textContent = "Edit Furniture Item";
  cardTitle.textContent = "Editing Item";
  cancelEditBtn.hidden = false;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

adminForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  submitBtn.disabled = true;

  try {
    let imageUrl;

    if (croppedBlob) {
      imageUrl = await uploadImage();
    }

    const payload = {
      name: itemName.value,
      price: Number(itemPrice.value),
      category: itemCategory.value,
      description: itemDescription.value
    };

    if (imageUrl) payload.image_url = imageUrl;

    if (editingItemId.value) {
      await supabaseClient
        .from(TABLE_NAME)
        .update(payload)
        .eq("id", editingItemId.value);

      setMessage("Item updated");
    } else {
      if (!imageUrl) throw new Error("Image required");

      payload.image_url = imageUrl;

      await supabaseClient
        .from(TABLE_NAME)
        .insert(payload);

      setMessage("Item added");
    }

    resetForm();
    loadCatalog();
  } catch (err) {
    setMessage(err.message, true);
  }

  submitBtn.disabled = false;
});

async function loadCatalog() {
  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) {
    catalogList.innerHTML = "Failed to load";
    return;
  }

  catalogList.innerHTML = data.map(item => `
    <div class="catalog-item">
      <img src="${item.image_url}">
      <div class="catalog-item-content">
        <div class="catalog-item-title">${item.name}</div>
        <div class="catalog-item-meta">${item.category} · ${formatCurrency(item.price)}</div>
        <div class="catalog-item-desc">${item.description}</div>

        <div class="catalog-item-actions">
          <button class="catalog-action-btn" onclick='startEdit(${JSON.stringify(item)})'>Edit</button>
          <button class="catalog-action-btn danger" onclick="deleteFurniture('${item.id}')">Delete</button>
        </div>
      </div>
    </div>
  `).join("");
}
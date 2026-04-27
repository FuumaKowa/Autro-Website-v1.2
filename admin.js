const BUCKET_NAME = "furniture-images";
const TABLE_NAME = "furniture_items";

const adminForm = document.getElementById("adminForm");
const itemName = document.getElementById("itemName");
const itemPrice = document.getElementById("itemPrice");
const itemCategory = document.getElementById("itemCategory");
const itemDescription = document.getElementById("itemDescription");
const itemImage = document.getElementById("itemImage");

const imagePreview = document.getElementById("imagePreview");
const imageEditorEmpty = document.getElementById("imageEditorEmpty");
const cropBtn = document.getElementById("cropBtn");
const clearImageBtn = document.getElementById("clearImageBtn");

const adminMessage = document.getElementById("adminMessage");
const catalogList = document.getElementById("catalogList");
const submitBtn = document.getElementById("submitBtn");
const resetBtn = document.getElementById("resetBtn");
const logoutBtn = document.getElementById("logoutBtn");

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
    cropper = null;
  }

  cropper = new Cropper(imagePreview, {
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
});

cropBtn.addEventListener("click", () => {
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

  canvas.toBlob((blob) => {
    if (!blob) {
      setMessage("Failed to crop image.", true);
      return;
    }

    croppedBlob = blob;

    const croppedUrl = URL.createObjectURL(blob);
    cropper.destroy();
    cropper = null;

    imagePreview.src = croppedUrl;
    imagePreview.hidden = false;
    imagePreview.style.display = "block";

    setMessage("Crop applied.");
  }, "image/jpeg", 0.9);
});

clearImageBtn.addEventListener("click", () => {
  itemImage.value = "";
  resetImageEditor();
  setMessage("");
});

resetBtn.addEventListener("click", () => {
  adminForm.reset();
  resetImageEditor();
  setMessage("");
});

async function uploadImage() {
  if (!croppedBlob) {
    throw new Error("Please apply crop before publishing.");
  }

  const filePath = `catalog/furniture-${Date.now()}.jpg`;

  const { error } = await supabaseClient.storage
    .from(BUCKET_NAME)
    .upload(filePath, croppedBlob, {
      cacheControl: "3600",
      upsert: false,
      contentType: "image/jpeg"
    });

  if (error) throw error;

  const { data } = supabaseClient.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function insertFurnitureItem(payload) {
  const { error } = await supabaseClient
    .from(TABLE_NAME)
    .insert(payload);

  if (error) throw error;
}

adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");

  submitBtn.disabled = true;
  submitBtn.textContent = "Publishing...";

  try {
    const imageUrl = await uploadImage();

    const payload = {
      name: itemName.value.trim(),
      price: Number(itemPrice.value),
      category: itemCategory.value,
      description: itemDescription.value.trim(),
      image_url: imageUrl
    };

    await insertFurnitureItem(payload);

    setMessage("Item published successfully.");
    adminForm.reset();
    resetImageEditor();
    await loadCatalog();
  } catch (error) {
    console.error("Admin publish error:", error);
    setMessage(error.message || "Failed to publish item.", true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Publish Item";
  }
});

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
    catalogList.innerHTML = `<p class="catalog-empty">No items yet.</p>`;
    return;
  }

  catalogList.innerHTML = data.map((item) => `
    <article class="catalog-item">
      <img src="${item.image_url}" alt="${item.name}">
      <div>
        <div class="catalog-item-title">${item.name}</div>
        <div class="catalog-item-meta">${item.category} · ${formatCurrency(item.price)}</div>
        <div class="catalog-item-desc">${item.description || ""}</div>
      </div>
    </article>
  `).join("");
}
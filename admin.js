if (sessionStorage.getItem("autro-admin") !== "true") {
  window.location.href = "index.html";
}

const supabaseUrl = "https://yygbmcvgdvsepdiwsixz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5Z2JtY3ZnZHZzZXBkaXdzaXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDAyNTgsImV4cCI6MjA5MjQxNjI1OH0.bN3o0WixWBlfZ2-WpfeK1A5zPCUhrcvLot4rxsdoGEc";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = "furniture-images";
const TABLE_NAME = "furniture_items";

const adminForm = document.getElementById("adminForm");
const itemName = document.getElementById("itemName");
const itemPrice = document.getElementById("itemPrice");
const itemCategory = document.getElementById("itemCategory");
const itemDescription = document.getElementById("itemDescription");
const itemImage = document.getElementById("itemImage");
const imagePreview = document.getElementById("imagePreview");
const adminMessage = document.getElementById("adminMessage");
const catalogList = document.getElementById("catalogList");
const submitBtn = document.getElementById("submitBtn");
const resetBtn = document.getElementById("resetBtn");
const logoutBtn = document.getElementById("logoutBtn");

function setMessage(message, isError = false) {
  adminMessage.textContent = message;
  adminMessage.style.color = isError ? "#9d4a3f" : "";
}

function formatCurrency(value) {
  const number = Number(value) || 0;
  return `RM ${number.toFixed(2)}`;
}

function slugifyFileName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-");
}

function resetPreview() {
  imagePreview.hidden = true;
  imagePreview.removeAttribute("src");
}

itemImage.addEventListener("change", () => {
  const file = itemImage.files?.[0];
  if (!file) {
    resetPreview();
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  imagePreview.src = objectUrl;
  imagePreview.hidden = false;
});

resetBtn.addEventListener("click", () => {
  adminForm.reset();
  resetPreview();
  setMessage("");
});

logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem("autro-admin");
  window.location.href = "index.html";
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
    catalogList.innerHTML = `<p class="catalog-empty">No items in catalog yet.</p>`;
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

async function uploadImage(file) {
  const timeStamp = Date.now();
  const safeName = slugifyFileName(file.name);
  const filePath = `catalog/${timeStamp}-${safeName}`;

  const { error: uploadError } = await supabaseClient
    .storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabaseClient
    .storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function insertFurnitureItem(payload) {
  const { error } = await supabaseClient
    .from(TABLE_NAME)
    .insert(payload);

  if (error) {
    throw error;
  }
}

adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");

  const file = itemImage.files?.[0];

  if (!file) {
    setMessage("Please choose an image file.", true);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Publishing...";

  try {
    const publicImageUrl = await uploadImage(file);

    const payload = {
      name: itemName.value.trim(),
      price: Number(itemPrice.value),
      category: itemCategory.value,
      description: itemDescription.value.trim(),
      image_url: publicImageUrl
    };

    await insertFurnitureItem(payload);

    setMessage("Item published successfully.");
    adminForm.reset();
    resetPreview();
    await loadCatalog();
  } catch (error) {
    console.error("Admin publish error:", error);
    setMessage(error.message || "Failed to publish item.", true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Publish Item";
  }
});

loadCatalog();
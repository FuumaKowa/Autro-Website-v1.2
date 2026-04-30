const cursor = document.getElementById("cursor");
const cursorRing = document.getElementById("cursorRing");
const languageSwitcher = document.getElementById("languageSwitcher");
const adminTrigger = document.getElementById("adminTrigger");

const isDesktop = window.innerWidth > 900;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let mouseX = 0;
let mouseY = 0;
let ringX = 0;
let ringY = 0;

function initCursor() {
  if (!isDesktop || !cursor || !cursorRing) return;

  document.addEventListener("mousemove", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;

    cursor.style.left = `${mouseX}px`;
    cursor.style.top = `${mouseY}px`;
  });

  function animateCursorRing() {
    ringX += (mouseX - ringX) * 0.1;
    ringY += (mouseY - ringY) * 0.1;

    cursorRing.style.left = `${ringX}px`;
    cursorRing.style.top = `${ringY}px`;

    requestAnimationFrame(animateCursorRing);
  }

  animateCursorRing();

  document.querySelectorAll("a, button, select, input, textarea").forEach((element) => {
    element.addEventListener("mouseenter", () => {
      cursor.style.transform = "translate(-50%, -50%) scale(2.5)";
      cursorRing.style.opacity = "0";
    });

    element.addEventListener("mouseleave", () => {
      cursor.style.transform = "translate(-50%, -50%) scale(1)";
      cursorRing.style.opacity = "1";
    });
  });
}

function initScrollAnimations() {
  if (prefersReducedMotion || !("IntersectionObserver" in window)) return;

  const animatedElements = document.querySelectorAll(
    ".why-card, .plan-card, .info-card, .vip-text, .testimonial-kicker, blockquote, .dual-copy, .content-copy"
  );

  if (!animatedElements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      entry.target.style.opacity = "1";
      entry.target.style.transform = "translateY(0)";
      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.12
  });

  animatedElements.forEach((element) => {
    element.style.opacity = "0";
    element.style.transform = "translateY(20px)";
    element.style.transition = "opacity 0.7s ease, transform 0.7s ease";
    observer.observe(element);
  });
}

function applyTranslations(language) {
  const dictionary = window.translations?.[language];
  if (!dictionary) return;

  document.documentElement.lang = language;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");

    if (dictionary[key] !== undefined) {
      element.textContent = dictionary[key];
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.getAttribute("data-i18n-placeholder");

    if (dictionary[key] !== undefined) {
      element.setAttribute("placeholder", dictionary[key]);
    }
  });

  localStorage.setItem("autro-language", language);
}

function initLanguageSwitcher() {
  const savedLanguage = localStorage.getItem("autro-language") || "en";

  applyTranslations(savedLanguage);

  if (!languageSwitcher) return;

  languageSwitcher.value = savedLanguage;

  languageSwitcher.addEventListener("change", (event) => {
    applyTranslations(event.target.value);
  });
}

function initAdminTrigger() {
  if (!adminTrigger) return;

  adminTrigger.addEventListener("click", () => {
    window.location.href = "admin-login.html";
  });
}

window.applyTranslations = applyTranslations;

initCursor();
initScrollAnimations();
initLanguageSwitcher();
initAdminTrigger();
const cursor = document.getElementById('cursor');
const ring = document.getElementById('cursorRing');
const languageSwitcher = document.getElementById('languageSwitcher');

let mx = 0;
let my = 0;
let rx = 0;
let ry = 0;

if (window.innerWidth > 900) {
  document.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;

    if (cursor) {
      cursor.style.left = `${mx}px`;
      cursor.style.top = `${my}px`;
    }
  });

  function animateRing() {
    rx += (mx - rx) * 0.1;
    ry += (my - ry) * 0.1;

    if (ring) {
      ring.style.left = `${rx}px`;
      ring.style.top = `${ry}px`;
    }

    requestAnimationFrame(animateRing);
  }

  animateRing();

  document.querySelectorAll('a, button, select').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      if (cursor) cursor.style.transform = 'translate(-50%, -50%) scale(2.5)';
      if (ring) ring.style.opacity = '0';
    });

    el.addEventListener('mouseleave', () => {
      if (cursor) cursor.style.transform = 'translate(-50%, -50%) scale(1)';
      if (ring) ring.style.opacity = '1';
    });
  });
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.why-card, .plan-card, .info-card, .vip-text, .testimonial-kicker, blockquote, .dual-copy, .content-copy').forEach((el) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
  observer.observe(el);
});

function applyTranslations(lang) {
  document.documentElement.lang = lang;
  const dictionary = window.translations?.[lang];
  if (!dictionary) return;

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (dictionary[key] !== undefined) {
      element.textContent = dictionary[key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (dictionary[key] !== undefined) {
      element.setAttribute('placeholder', dictionary[key]);
    }
  });

  localStorage.setItem('autro-language', lang);
}

const savedLanguage = localStorage.getItem('autro-language') || 'en';
applyTranslations(savedLanguage);

if (languageSwitcher) {
  languageSwitcher.value = savedLanguage;
  languageSwitcher.addEventListener('change', (event) => {
    applyTranslations(event.target.value);
  });
}

const adminTrigger = document.getElementById("adminTrigger");

if (adminTrigger) {
  adminTrigger.addEventListener("click", (event) => {
    event.preventDefault();
    openAdminLogin();
  });
}

function openAdminLogin() {
  const user = prompt("Admin Username:");
  const pass = prompt("Admin Password:");

  if (user === "admin" && pass === "1234") {
    sessionStorage.setItem("autro-admin", "true");
    window.location.href = "admin.html";
  } else if (user !== null && pass !== null) {
    alert("Access denied");
  }
}
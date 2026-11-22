"use strict";

/* ==================================================
   ГАЛЕРЕЯ: кнопки, свайп, клавіші ← →
   Класи слайдів: active (центр), prev / next (по боках),
   incoming-left / incoming-right (наступні за ними, приховані)
================================================== */
(() => {
  const gallery = document.querySelector(".gallery");
  if (!gallery) return;

  const slides = [...gallery.querySelectorAll(".gallery-slide")];
  const prevButton = gallery.querySelector(".gallery-button.prev");
  const nextButton = gallery.querySelector(".gallery-button.next");
  const status = document.getElementById("gallery-status");
  if (slides.length < 3) return;

  const STATES = ["prev", "active", "next", "incoming-right", "incoming-left"];
  const at = (i) => (i + slides.length) % slides.length;

  let current = 1; // стартуємо з другого фото, щоб зліва теж був слайд

  function render() {
    const roles = {
      [at(current - 1)]: "prev",
      [current]: "active",
      [at(current + 1)]: "next",
      [at(current + 2)]: "incoming-right",
      [at(current - 2)]: "incoming-left",
    };

    slides.forEach((slide, i) => {
      slide.classList.remove(...STATES);
      if (roles[i]) slide.classList.add(roles[i]);
      slide.inert = i !== current; // бічні слайди недоступні для Tab і скрінрідера
    });

    if (status) {
      const alt = slides[current].querySelector("img")?.alt ?? "";
      status.textContent = `Фото ${current + 1} з ${slides.length}. ${alt}`;
    }
  }

  const go = (step) => {
    current = at(current + step);
    render();
  };

  prevButton?.addEventListener("click", () => go(-1));
  nextButton?.addEventListener("click", () => go(1));

  // Клавіші ← →, коли фокус усередині галереї (кнопки або сама секція)
  gallery.tabIndex = 0;
  gallery.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") go(-1);
    else if (event.key === "ArrowRight") go(1);
  });

  // Свайп: подію "swipe" генерує script.js (модуль 8), лише на явно горизонтальний рух
  gallery.dataset.swipe = "";
  gallery.addEventListener("swipe", (event) => go(event.detail));

  render();
})();

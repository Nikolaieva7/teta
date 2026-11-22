"use strict";

/* ==================================================
   1. ШАПКА: мобільне меню
================================================== */
(() => {
  const hamburger = document.getElementById("hamburger");
  const nav = document.getElementById("nav");
  if (!hamburger || !nav) return;

  const setMenuState = (isOpen) => {
    hamburger.setAttribute("aria-expanded", String(isOpen));
    hamburger.setAttribute(
      "aria-label",
      isOpen ? "Закрити меню" : "Відкрити меню",
    );
    // CSS відкриває меню за aria-expanded (через :has()), класи не потрібні
  };

  hamburger.addEventListener("click", () => {
    setMenuState(hamburger.getAttribute("aria-expanded") !== "true");
  });

  // Клік по пункту меню → закрити
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenuState(false);
  });

  // Escape → закрити й повернути фокус на кнопку
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      hamburger.getAttribute("aria-expanded") === "true"
    ) {
      setMenuState(false);
      hamburger.focus();
    }
  });

  // Клік поза меню → закрити
  document.addEventListener("click", (event) => {
    if (
      hamburger.getAttribute("aria-expanded") === "true" &&
      !nav.contains(event.target) &&
      !hamburger.contains(event.target)
    ) {
      setMenuState(false);
    }
  });

  // Перехід на десктопну ширину → закрити (брейкпоінт = як у CSS шапки, 64rem)
  matchMedia("(width > 64rem)").addEventListener("change", (event) => {
    if (event.matches) setMenuState(false);
  });
})();

/* ==================================================
   2. PROMO: дані з JSON + карусель
================================================== */
(() => {
  const PROMO_URL = "data/promos.json";
  const PROMO_DELAY = 8000; // скільки мс показується одна акція

  const money = (n) => `${new Intl.NumberFormat("uk-UA").format(n)} грн`;
  const todayKyiv = () =>
    new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv" }); // "2026-11-21"

  async function renderPromos() {
    const section = document.getElementById("promo");
    const list = document.getElementById("promo-list");
    const tpl = document.getElementById("promo-template");
    if (!section || !list || !tpl) return;

    let items;
    try {
      const res = await fetch(PROMO_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      items = await res.json();
      if (!Array.isArray(items)) throw new Error("очікувався масив акцій");
    } catch (err) {
      console.warn("Promo: не вдалося завантажити дані", err);
      return; // секція лишається hidden
    }

    const today = todayKyiv();
    const active = items
      .filter(
        (p) =>
          p.title &&
          (!p.start || p.start <= today) &&
          (!p.end || p.end >= today),
      )
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

    if (!active.length) return;

    const slides = active.map((p) => {
      const card = tpl.content.firstElementChild.cloneNode(true);
      const discount =
        p.oldPrice > p.price
          ? `−${Math.round((1 - p.price / p.oldPrice) * 100)}%`
          : "";

      const values = {
        ...p,
        badge: p.badge ?? discount,
        oldPrice: p.oldPrice && money(p.oldPrice),
        price: p.price && money(p.price),
        ctaText: p.cta?.text ?? "Записатися",
      };

      card.dataset.type = p.type ?? "default";

      card.querySelectorAll("[data-field]").forEach((el) => {
        const value = values[el.dataset.field];
        if (value) el.textContent = value;
        else (el.closest("[data-hide]") ?? el).hidden = true;
      });

      card.querySelector(".promo-button").href = p.cta?.url ?? "#contact";
      return card;
    });

    list.replaceChildren(...slides);
    section.hidden = false;
    keepPromoVisible(section);

    if (slides.length > 1) initPromoCarousel(section, slides);
    else slides[0].classList.add("is-active");
  }

  // Наїзд (CSS: position: sticky). Якщо promo вищий за екран (телефон) — прилипає нижнім
  // краєм, а не верхнім, інакше низ promo сховався б під блоком, що наїжджає.
  function keepPromoVisible(section) {
    const update = () => {
      const overflow = section.offsetHeight - innerHeight;
      section.style.setProperty("--promo-top", `${Math.min(0, -overflow)}px`);
    };
    new ResizeObserver(update).observe(section);
    addEventListener("resize", update);
    update();
  }

  function initPromoCarousel(section, slides) {
    const list = section.querySelector(".promo-list");
    const controls = section.querySelector(".promo-controls");
    const dotsBox = section.querySelector(".promo-dots");
    const pauseBtn = section.querySelector(".promo-pause");

    // «Зменшити рух» у системі → сама не крутиться
    let userPaused = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let current = 0;
    let timer = null;

    const dots = slides.map((slide, i) => {
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "слайд");
      slide.setAttribute("aria-label", `${i + 1} з ${slides.length}`);

      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "promo-dot";
      dot.setAttribute(
        "aria-label",
        `Показати: ${slide.querySelector(".promo-title").textContent}`,
      );
      dot.addEventListener("click", () => {
        show(i);
        restart();
      });
      return dot;
    });
    dotsBox.replaceChildren(...dots);

    function show(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => {
        const isActive = i === current;
        slide.classList.toggle("is-active", isActive);
        slide.inert = !isActive; // приховані слайди недоступні для Tab і скрінрідера
      });
      dots.forEach((dot, i) =>
        dot.setAttribute("aria-current", String(i === current)),
      );
    }

    const stop = () => {
      clearInterval(timer);
      timer = null;
    };
    const start = () => {
      if (!userPaused && !timer)
        timer = setInterval(() => show(current + 1), PROMO_DELAY);
    };
    const restart = () => {
      stop();
      start();
    };

    function updatePauseButton() {
      pauseBtn.setAttribute(
        "aria-label",
        userPaused ? "Увімкнути автопрокрутку" : "Зупинити автопрокрутку",
      );
      pauseBtn.firstElementChild.textContent = userPaused ? "▶" : "❚❚";
      // поки крутиться саме — не озвучуємо кожну зміну; на паузі — озвучуємо
      list.setAttribute("aria-live", userPaused ? "polite" : "off");
    }

    pauseBtn.addEventListener("click", () => {
      userPaused = !userPaused;
      updatePauseButton();
      userPaused ? stop() : start();
    });

    // Свайп пальцем (подію "swipe" генерує модуль 8)
    section.dataset.swipe = "";
    section.addEventListener("swipe", (e) => {
      show(current + e.detail);
      restart();
    });

    // Пауза, поки людина читає мишею або працює з клавіатури
    section.addEventListener(
      "pointerenter",
      (e) => e.pointerType === "mouse" && stop(),
    );
    section.addEventListener(
      "pointerleave",
      (e) => e.pointerType === "mouse" && start(),
    );
    section.addEventListener("focusin", stop);
    section.addEventListener("focusout", (e) => {
      if (!section.contains(e.relatedTarget)) start();
    });

    // Вкладка неактивна → не крутимо
    document.addEventListener("visibilitychange", () =>
      document.hidden ? stop() : start(),
    );

    show(0);
    updatePauseButton();
    controls.hidden = false;
    start();
  }

  renderPromos();
})();

/* ==================================================
   3. EVENT VIDEO: грає лише на екрані + кнопка паузи
================================================== */
(() => {
  const video = document.querySelector(".event-video__video");
  const btn = document.querySelector(".event-video__toggle");
  if (!video || !btn) return;

  // «Зменшити рух» у системі → не запускаємо саме
  let userPaused = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const syncButton = () => {
    btn.setAttribute(
      "aria-label",
      video.paused ? "Відтворити відео" : "Зупинити відео",
    );
    btn.firstElementChild.textContent = video.paused ? "▶" : "❚❚";
  };
  video.addEventListener("play", syncButton);
  video.addEventListener("pause", syncButton);

  btn.addEventListener("click", () => {
    userPaused = !video.paused;
    userPaused ? video.pause() : video.play().catch(() => {});
  });

  // Грає, коли видно ≥25% блоку; поза екраном — пауза (і не качається заздалегідь)
  new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !userPaused) video.play().catch(() => {});
      else if (!entry.isIntersecting) video.pause();
    },
    { threshold: 0.25 },
  ).observe(video);

  btn.hidden = false;
  syncButton();
})();

/* ==================================================
   4. ПОСЛУГИ: акордеон + липка навігація по категоріях
================================================== */
(() => {
  const section = document.getElementById("services");
  if (!section) return;

  // 4.1. Обгортка .card-details для анімації висоти (0fr → 1fr).
  //      Без JS обгортки немає — списки просто видно.
  section.querySelectorAll(".toggle-btn").forEach((btn) => {
    const list = document.getElementById(btn.getAttribute("aria-controls"));
    if (!list) return;
    const details = document.createElement("div");
    details.className = "card-details";
    list.before(details);
    details.append(list);
  });
  section.classList.add("js-ready");

  // 4.2. Один обробник на всю секцію: кнопка «+», назва або опис картки
  section.addEventListener("click", (e) => {
    const trigger = e.target.closest(
      ".toggle-btn, .card > div:first-child > :is(h4, p)",
    );
    if (!trigger) return;

    const isButton = trigger.matches(".toggle-btn");
    if (!isButton && getSelection().toString()) return; // людина виділяє текст — не заважаємо

    const btn = isButton
      ? trigger
      : trigger.parentElement.querySelector(".toggle-btn");
    if (!btn) return;

    const isOpen = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!isOpen));
  });

  // 4.3. Липка навігація по категоріях
  const titles = [...section.querySelectorAll(".category-title[id]")];
  const header = section.querySelector(".services-header");
  if (titles.length < 2 || !header) return;

  const nav = document.createElement("nav");
  nav.className = "services-nav";
  nav.setAttribute("aria-label", "Категорії послуг");

  // Звичайні якорі: плавний скрол і відступ дає CSS (scroll-behavior + scroll-margin)
  const links = titles.map((title) => {
    const a = document.createElement("a");
    a.href = `#${title.id}`;
    a.textContent = title.textContent.trim();
    return a;
  });
  nav.append(...links);
  header.after(nav);

  // Активна — категорія, чий заголовок останнім перетнув лінію на 35% висоти екрана
  let activeIndex = -1;

  const setActive = () => {
    const line = innerHeight * 0.35;
    let current = 0;
    titles.forEach((title, i) => {
      if (title.getBoundingClientRect().top < line) current = i;
    });

    if (current === activeIndex) return;
    activeIndex = current;

    links.forEach((a, i) =>
      a.setAttribute("aria-current", String(i === current)),
    );

    // Прокрутити навігацію так, щоб активне посилання було по центру (вузькі екрани)
    const active = links[current];
    nav.scrollTo({
      left: active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2,
    });
  };

  // Спрацьовує лише коли заголовок перетинає цю лінію, а не на кожен кадр скролу
  const observer = new IntersectionObserver(setActive, {
    rootMargin: "0px 0px -65% 0px",
  });
  titles.forEach((title) => observer.observe(title));
  setActive();
})();

/* ==================================================
   5. ВІДГУКИ: стрілки прокручують до сусідньої картки
================================================== */
(() => {
  const section = document.getElementById("reviews");
  if (!section) return;

  const track = section.querySelector(".reviews-track");
  if (!track) return;

  const cards = [...track.querySelectorAll(".review-card")];

  // «Читати повністю»: на телефоні CSS згортає довгі відгуки до 6 рядків.
  // Кнопку показуємо лише тим карткам, де текст справді обрізано (перевіряємо при зміні ширини).
  section.classList.add("js-reviews");
  const toggles = cards.map((card) => {
    const text = card.querySelector(".review-text");
    const para = text?.querySelector("p");
    if (!para) return null;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "review-more";
    btn.textContent = "Читати повністю";
    btn.setAttribute("aria-expanded", "false");
    btn.hidden = true;
    btn.addEventListener("click", () => {
      const expanded = card.classList.toggle("is-expanded");
      btn.textContent = expanded ? "Згорнути" : "Читати повністю";
      btn.setAttribute("aria-expanded", String(expanded));
    });
    text.after(btn);
    return { card, para, btn };
  });

  const updateToggles = () => {
    for (const item of toggles) {
      if (!item || item.card.classList.contains("is-expanded")) continue;
      item.btn.hidden = item.para.scrollHeight <= item.para.clientHeight + 1;
    }
  };
  new ResizeObserver(updateToggles).observe(track);

  if (cards.length < 2) return;

  // Позиція картки всередині стрічки
  const cardLeft = (card) => card.offsetLeft - cards[0].offsetLeft;

  // Яка картка зараз найближче до лівого краю стрічки
  const currentIndex = () => {
    const x = track.scrollLeft;
    return cards.reduce(
      (best, card, i) =>
        Math.abs(cardLeft(card) - x) < Math.abs(cardLeft(cards[best]) - x)
          ? i
          : best,
      0,
    );
  };

  // Точно на початок картки; по колу: з останньої → на першу, і навпаки
  const goTo = (index) => {
    const i = (index + cards.length) % cards.length;
    track.scrollTo({ left: cardLeft(cards[i]) });
  };

  section.querySelectorAll(".reviews-arrow").forEach((btn) => {
    const dir = btn.classList.contains("reviews-next") ? 1 : -1;
    btn.addEventListener("click", () => goTo(currentIndex() + dir));
    btn.hidden = false; // стрілки видно лише коли JS працює
  });
})();

/* ==================================================
   6. КОНТАКТИ: перевірка + надсилання форми (send.php → Telegram)
================================================== */
(() => {
  // Дані надсилаються на сервер у send.php — токен бота і CHAT_ID вписуються там,
  // а не тут: усе, що лежить у JS, видно будь-кому у вихідному коді сторінки.

  const form = document.getElementById("contactForm");
  if (!form) return;

  const nameInput = form.querySelector("#cf-name");
  const phoneInput = form.querySelector("#cf-phone");
  const messageInput = form.querySelector("#cf-message");
  const submitBtn = form.querySelector(".contact-submit");
  const submitText = form.querySelector(".contact-submit__text");
  const status = form.querySelector(".form-status");
  if (!nameInput || !phoneInput || !messageInput || !submitBtn || !submitText || !status) return;

  const SUBMIT_LABEL = submitText.textContent;

  const setStatus = (text, type = "") => {
    status.textContent = text;
    if (type) status.dataset.status = type; // CSS: .form-status[data-status="error" | "success"]
    else delete status.dataset.status;
  };

  // Показати / прибрати помилку під полем. Повертає true, якщо помилки немає.
  const setError = (input, message) => {
    const error = document.getElementById(`${input.id}-error`);
    if (error) error.textContent = message;
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
    return !message;
  };

  const NAME_RE = /^[\p{L}'’ʼ-]+(?:\s+[\p{L}'’ʼ-]+)*$/u;

  // Український або міжнародний номер: цифри, пробіли, дужки, дефіси, «+» на початку; 10–15 цифр
  const isPhone = (value) => {
    const digits = value.replace(/\D/g, "");
    return /^\+?[\d\s()-]+$/.test(value) && digits.length >= 10 && digits.length <= 15;
  };

  // Поле → функція, що повертає текст помилки або "" (усе добре)
  const rules = new Map([
    [nameInput, (v) =>
      !v ? "Введи ім’я."
      : v.length < 2 ? "Ім’я має містити щонайменше 2 символи."
      : !NAME_RE.test(v) ? "Ім’я може містити лише літери, пробіли та дефіс."
      : ""],
    [phoneInput, (v) =>
      !v ? "Вкажи номер телефону."
      : !isPhone(v) ? "Перевір номер, напр. +380 67 123 45 67."
      : ""],
    [messageInput, (v) =>
      !v ? "Напиши текст звернення."
      : v.length < 10 ? "Напиши хоча б кілька слів (від 10 символів)."
      : ""],
  ]);

  const validate = (input) => setError(input, rules.get(input)(input.value.trim()));

  // Почали виправляти — прибрати помилку цього поля і загальне повідомлення
  form.addEventListener("input", (event) => {
    if (rules.has(event.target)) setError(event.target, "");
    setStatus("");
  });

  const setSending = (sending) => {
    submitBtn.disabled = sending;
    submitBtn.setAttribute("aria-disabled", String(sending));
    submitText.textContent = sending ? "Відправка..." : SUBMIT_LABEL;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitBtn.disabled) return; // захист від дублів

    const results = [...rules.keys()].map(validate);
    if (results.includes(false)) {
      setStatus("Перевір, будь ласка, виділені поля.", "error");
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    setSending(true);
    setStatus("");

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form), // разом із прихованим полем-пасткою для ботів
        headers: { Accept: "application/json" },
      });
      const data = await response.json().catch(() => ({}));

      // Сервер повторно перевіряє поля — показуємо його помилки під відповідними полями
      if (data.errors) {
        const inputs = { name: nameInput, phone: phoneInput, message: messageInput };
        Object.entries(data.errors).forEach(([key, msg]) => inputs[key] && setError(inputs[key], msg));
        form.querySelector('[aria-invalid="true"]')?.focus();
      }
      if (!response.ok || !data.ok) {
        setStatus(data.message || "Не вдалося надіслати. Спробуй ще раз.", "error");
        return;
      }

      form.reset();
      setStatus(data.message || "Дякую! Повідомлення надіслано — я відповім найближчим часом.", "success");
    } catch (error) {
      console.error("Форма: не вдалося надіслати", error);
      setStatus("Не вдалося надіслати. Перевір з’єднання та спробуй ще раз.", "error");
    } finally {
      setSending(false);
    }
  });

  /* ---------- Кнопки «Записатися» → форма з уже вписаною послугою ----------
     Будь-яке посилання на #contact плавно веде до форми й ставить курсор у перше порожнє поле.
     Якщо кнопка в картці послуги чи акції — у «Текст звернення» підставляється назва і ціна,
     клієнту лишається ввести ім'я та телефон. */
  const contactSection = document.getElementById("contact");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let autoText = ""; // останній підставлений текст — щоб не затерти те, що клієнт написав сам

  // Назва, формат і ціна послуги з картки, у якій натиснули кнопку
  const getService = (trigger) => {
    const card = trigger.closest(".card, .promo");
    if (!card) return null;
    const text = (selector) => card.querySelector(selector)?.textContent.trim() ?? "";
    return {
      title: text("h4, .promo-title"),
      label: text(".card-label"),
      price: text(".card-footer .price, .promo-new-price [data-field='price']"),
    };
  };

  const serviceMessage = ({ title, label, price }) =>
    `Вітаю! Хочу записатися на «${title}»` +
    (label ? ` (${label})` : "") +
    (price ? ` — ${price}` : "") +
    ".";

  // Скрінрідер замість 19 однакових «Записатися» почує, на що саме запис
  document.querySelectorAll('.card a[href="#contact"]').forEach((link) => {
    const service = getService(link);
    if (service?.title) link.setAttribute("aria-label", `${link.textContent.trim()}: ${service.title}`);
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href="#contact"]');
    if (!link || !contactSection) return;
    event.preventDefault();

    const service = getService(link);
    const current = messageInput.value.trim();
    if (service?.title && (!current || current === autoText)) {
      autoText = serviceMessage(service);
      messageInput.value = autoText;
      setError(messageInput, "");
      setStatus("Послугу вже вказано у зверненні — залиш, будь ласка, ім’я та телефон.");
    }

    contactSection.scrollIntoView({
      behavior: reduceMotion.matches ? "auto" : "smooth",
      block: "start",
    });

    // Курсор — у перше незаповнене поле (на телефоні одразу відкриється клавіатура)
    const firstEmpty = [nameInput, phoneInput, messageInput].find((input) => !input.value.trim());
    (firstEmpty ?? nameInput).focus({ preventScroll: true });
  });
})();

/* ==================================================
   7. REVEAL: поява елементів з data-reveal при прокрутці
================================================== */
(() => {
  // Що з'являється при прокрутці. Атрибут ставимо тут, щоб не засмічувати HTML.
  // "up" — текст піднімається; "zoom" — фото/відео м'яко наближається.
  const TARGETS = {
    up: [
      ".event-video__content",
      ".services-header",
      ".category-title",
      ".card",
      ".about-content",
      ".about-privacy",
      ".reviews-header",
      ".reviews-slider",
      ".contact-intro",
      ".contact-form",
      ".case-heading",
      ".case-request",
      ".case-block",
      ".case-navigation",
    ],
    zoom: [".event-video__frame", ".about-visual"],
  };
  // Групи, де сусідні елементи з'являються по черзі, а не всі разом
  const STAGGER = [".hero-services__list > li", ".case-details > .case-block"];
  const STAGGER_STEP = 0.12; // с

  for (const [type, selectors] of Object.entries(TARGETS)) {
    document.querySelectorAll(selectors.join(",")).forEach((el) => {
      el.dataset.reveal ||= type;
    });
  }
  for (const selector of STAGGER) {
    document.querySelectorAll(selector).forEach((el, i) => {
      el.dataset.reveal ||= "up";
      el.style.setProperty("--reveal-delay", `${i * STAGGER_STEP}s`);
    });
  }

  const items = document.querySelectorAll("[data-reveal]");
  if (!items.length || !("IntersectionObserver" in window)) return;

  // Лише тепер CSS ховає елементи до появи — без JS усе видно одразу
  document.documentElement.classList.add("reveal-ready");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    // Елемент з'являється, коли трохи заїхав на екран, а не торкнувся краю
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  );

  items.forEach((el) => observer.observe(el));
})();

/* ==================================================
   8. СВАЙП: спільний для всіх каруселей
   Елемент з атрибутом data-swipe отримує подію "swipe"
   з event.detail = 1 (гортати вперед) або -1 (назад).
================================================== */
(() => {
  const MIN_DISTANCE = 50; // px — коротший рух вважаємо випадковим

  let start = null;

  document.addEventListener(
    "touchstart",
    (event) => {
      const target = event.target.closest("[data-swipe]");
      if (!target || event.touches.length > 1) return (start = null);
      const { clientX: x, clientY: y } = event.touches[0];
      start = { target, x, y };
    },
    { passive: true },
  );

  document.addEventListener(
    "touchend",
    (event) => {
      if (!start) return;
      const { clientX, clientY } = event.changedTouches[0];
      const dx = clientX - start.x;
      const dy = clientY - start.y;
      const { target } = start;
      start = null;

      // Лише явно горизонтальний рух — вертикальна прокрутка сторінки не перемикає слайди
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      target.dispatchEvent(new CustomEvent("swipe", { detail: dx < 0 ? 1 : -1 }));
    },
    { passive: true },
  );
})();

Передрелізна перевірка HTML/CSS

Вміст: index.html, style.css.
Це НЕ повний сайт: необхідно додати script.js, фото, іконки, відео, cases.html, gallerySlade.html, сторінку конфіденційності.

Перед публікацією:
1. Підтвердити, що https://skorbota.website/ — основний домен; за потреби змінити canonical, og:url, Schema.org @id/url/image та Twitter/OG images.
2. Перевірити роботу script.js: aria-expanded для hamburger і всіх toggle-btn має оновлюватися синхронно з класом .active/.is-open.
3. Перевірити надсилання форми contactForm.
4. Перевірити наявність і шляхи всіх зображень, відео та сторінок.
5. Додати справжні intrinsic width/height для двох фото (файли фото не надані).
6. Розглянути poster для відео та його зупинку при prefers-reduced-motion.
7. Перевірити Safari, мобільні екрани, Lighthouse та W3C HTML Validator.
8. CSS містить native nesting; для старих Safari потрібен PostCSS/Lightning CSS.

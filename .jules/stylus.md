# STYLUS Design System Log

## Guidelines
- **Consistency:** Use design tokens, not magic numbers.
- **Responsiveness:** Mobile First.
- **Accessibility:** Ensure high contrast, keyboard navigation, and semantic HTML.

## Log

### 2025-02-18 — [UX/A11y]
**Решение:**
- Заменил `div onClick` на `<Link>` и `<button>` в `Header.tsx`.
- Добавил `htmlFor` и `id` для полей ввода в `Login.tsx`.
- Оптимизировал отступы заголовка для мобильных устройств (`px-4 sm:px-6`).
- Добавил `aria-label` для иконок.

**Профит:**
- Полная поддержка навигации с клавиатуры (Tab/Enter).
- Поддержка скринридеров (Screen Readers) благодаря семантическим элементам и ARIA-атрибутам.
- Улучшенная эргономика форм (клик по лейблу ставит фокус в поле).
- Более компактный заголовок на узких экранах.

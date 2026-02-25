# Stylus Design System Log

This log tracks significant UI/UX improvements and design decisions.

## 2024-05-22 — [Setup] **Initial Setup**
**Decision:** Established the Stylus Design System Log.
**Profit:** Provides a centralized place to track design evolution and ensure consistency.

## 2024-05-22 — [UI/UX/A11y] **Решение:** Refactoring Login.tsx
**Решение:**
- Заменил хардкодные цвета на семантические (`bg-background`, `text-primary`).
- Добавил функционал показа/скрытия пароля.
- Внедрил `rounded-xl` и адаптивные отступы (`p-6 sm:p-8`).
- Добавил атрибуты доступности: `aria-required`, `aria-hidden`, `htmlFor`.
**Профит:**
- Улучшена доступность для скринридеров и менеджеров паролей.
- Повышено удобство использования на мобильных устройствах.
- Интерфейс стал визуально легче и современнее.

# Backlog: Enhanced Practice Test Features

Based on competitor analysis (USMLE style interfaces), we are implementing several premium features to improve the user experience during practice tests.

---

## ✅ Implemented Features (V1)
- [x] **Universal Navigation**: Top & Bottom "Previous/Next" buttons.
- [x] **Question Flagging**: 🚩 Visual flags that persist across navigation.
- [x] **Glassmorphic Toolbar**: Modern, premium UI with translucent backgrounds and hardware-style SVG icons.
- [x] **Highlighter System**: Multi-color text selection with local HTML session persistence.
- [x] **Fullscreen Mode**: distraction-free testing environment using native browser APIs.
- [x] **Question Feedback**: Report tool to collect errors/suggestions for the question bank.

---

## 🚀 Incoming Phase (Backlog)

### 6. Personal Question Notes 📝
*   **Goal**: Allow students to jot down thoughts or reminders specific to a question without leaving the test context.
*   **Backend**: 
    *   Add `notes` column (TEXT) to `QuestionSubmission` entity.
    *   Update `submitAnswer` DTO and service logic to accept and persist notes.
*   **Frontend**:
    *   Add a "Notes" button to the Exam Toolbar.
    *   Implement an expandable text area that stays pinned to the bottom of the question stem or within a dedicated tab.

### 7. Dual Slide-in resource Panels (The "Side-Study" System) �📓
*   **Goal**: Reference the Medical Library or Personal Notebook without breaking exam flow.
*   **Frontend**:
    *   **Layout**: Sliding panels that enter from the **left** and stop at the **mid-screen (50% width)**.
    *   **Overlay Logic**: Support multiple open panels. If Panel A is open and user clicks Panel B, Panel B slides in **above** Panel A.
    *   **Panel 1 (Medical Library)**: Standardized view of clinical subjects/systems.
    *   **Panel 2 (My Notebook)**: Direct access to the user's previously saved notes and entries.
    *   **Interactivity**: Ensure the test content (right side) remains visible and scrollable while panels are active.

### 8. Analytics Synchronization 🔄
*   **Goal**: Ensure all markings (notes, flags, highlights) are perfectly synced between real-time local state and backend persistence.
*   **Backend**: Optimize background auto-saves to prevent rate-limiting during high-frequency marking.

---
**Status**: Phase 1 Complete. Preparing Phase 2 (Notes & Side-Panels).

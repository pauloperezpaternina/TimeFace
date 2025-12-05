# AI Rules and Project Guidelines

This document outlines the technical stack and best practices for developing and maintaining the TimeFace EasyShift application.

## Tech Stack Overview

*   **Frontend Framework:** React (v19) for building dynamic and interactive user interfaces.
*   **Language:** TypeScript (v5) is used throughout the project for type safety, improved code quality, and better developer experience.
*   **Styling:** Tailwind CSS is the exclusive utility-first CSS framework for all styling, ensuring consistency and rapid UI development.
*   **UI Components:** Shadcn/ui (built on Radix UI) provides a set of accessible and customizable UI components.
*   **Backend & Database:** Supabase serves as the backend, handling database operations, user authentication, and file storage. All interactions are managed via `src/services/dbService.ts`.
*   **AI Integration:** The Google Gemini API is utilized for advanced features, specifically facial recognition, encapsulated in `src/services/geminiService.ts`.
*   **Build Tool:** Vite is used for a fast development server and optimized production builds.
*   **Icons:** Lucide React provides a comprehensive and customizable icon library for the application.

## Library Usage Rules

*   **React & TypeScript:** All new components, hooks, and application logic must be written in TypeScript and adhere to modern React functional component and hook patterns.
*   **Styling:**
    *   **Exclusively Tailwind CSS:** All styling must be applied using Tailwind CSS utility classes.
    *   **No Custom CSS Files:** Avoid creating `.css` or `.scss` files.
    *   **Limited Inline Styles:** Inline styles should only be used for dynamic, data-driven properties (e.g., `backgroundColor` based on a shift's color code).
*   **UI Components:**
    *   **Prioritize Shadcn/ui:** Always check if a required UI component exists within the Shadcn/ui library first.
    *   **New Components:** If a component is not available in Shadcn/ui or requires significant customization, create a new, small, and focused component in the `src/components/` directory. Do not modify Shadcn/ui source files directly.
*   **Backend Interactions:** All communication with the Supabase backend (database queries, authentication, storage uploads) must be routed through the `src/services/dbService.ts` module.
*   **AI Services:** All calls to the Google Gemini API for facial recognition or other AI functionalities must be made through the `src/services/geminiService.ts` module.
*   **Routing:** The application currently manages client-side page navigation using React's `useState` hook within `App.tsx`. This approach should be maintained for consistency.
*   **Icons:** Use icons from the `lucide-react` package for all graphical icons.
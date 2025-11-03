/**
 * ThemeProvider Component Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "../src/components/ThemeProvider";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Test component that uses useTheme
function TestComponent() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div>
      <div data-testid="theme">{theme}</div>
      <div data-testid="resolved-theme">{resolvedTheme}</div>
      <button onClick={() => setTheme("light")} data-testid="set-light">
        Light
      </button>
      <button onClick={() => setTheme("dark")} data-testid="set-dark">
        Dark
      </button>
      <button onClick={() => setTheme("system")} data-testid="set-system">
        System
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorageMock.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("theme-loaded");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children", () => {
    render(
      <ThemeProvider>
        <div data-testid="child">Test</div>
      </ThemeProvider>,
    );

    expect(screen.getByTestId("child")).toBeTruthy();
  });

  it("provides theme context", async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <TestComponent />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("light");
      expect(screen.getByTestId("resolved-theme").textContent).toBe("light");
    });
  });

  it("defaults to system theme", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("system");
    });
  });

  it("sets data-theme attribute on document", async () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <TestComponent />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });
  });

  it("adds theme-loaded class to document", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(document.documentElement.classList.contains("theme-loaded")).toBe(
        true,
      );
    });
  });

  it("allows theme changes", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider defaultTheme="light">
        <TestComponent />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("light");
    });

    await user.click(screen.getByTestId("set-dark"));

    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("dark");
      expect(screen.getByTestId("resolved-theme").textContent).toBe("dark");
    });
  });

  it("persists theme to localStorage", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    await user.click(screen.getByTestId("set-light"));

    await waitFor(() => {
      expect(localStorageMock.getItem("aligntrue-theme")).toBe("light");
    });
  });

  it("loads theme from localStorage on mount", async () => {
    localStorageMock.setItem("aligntrue-theme", "dark");

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("dark");
    });
  });

  it("uses custom storage key", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider storageKey="custom-key">
        <TestComponent />
      </ThemeProvider>,
    );

    await user.click(screen.getByTestId("set-light"));

    await waitFor(() => {
      expect(localStorageMock.getItem("custom-key")).toBe("light");
    });
  });
});

describe("useTheme", () => {
  it("throws error when used outside ThemeProvider", () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow("useTheme must be used within ThemeProvider");

    consoleSpy.mockRestore();
  });
});

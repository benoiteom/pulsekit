/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("../PulseIcon", () => ({
  PulseIcon: () => React.createElement("svg", { "data-testid": "pulse-icon" }),
}));

import { PulseLoginForm } from "../PulseLoginForm";

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockRefresh.mockClear();
  fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy;
});

afterEach(() => {
  cleanup();
});

// ── Tests ────────────────────────────────────────────────────────────

describe("PulseLoginForm", () => {
  it("renders a password input and submit button", () => {
    render(React.createElement(PulseLoginForm));
    expect(screen.getByPlaceholderText("Password")).toBeDefined();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDefined();
  });

  it("calls auth endpoint with password on submit", async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    render(React.createElement(PulseLoginForm));

    const input = screen.getByPlaceholderText("Password");
    const button = screen.getByRole("button", { name: "Sign in" });

    fireEvent.change(input, { target: { value: "my-secret" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/pulse/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "my-secret" }),
      });
    });
  });

  it("uses custom authEndpoint", async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    render(React.createElement(PulseLoginForm, { authEndpoint: "/custom/auth" }));

    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/custom/auth",
        expect.anything(),
      );
    });
  });

  it("refreshes router on successful login", async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    render(React.createElement(PulseLoginForm));

    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "correct" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledOnce();
    });
  });

  it("shows error message on failed login", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Incorrect password" }),
    });
    render(React.createElement(PulseLoginForm));

    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Incorrect password")).toBeDefined();
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("shows fallback error when response has no error field", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });
    render(React.createElement(PulseLoginForm));

    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Incorrect password")).toBeDefined();
    });
  });

  it("shows network error when fetch fails", async () => {
    fetchSpy.mockRejectedValue(new Error("Network error"));
    render(React.createElement(PulseLoginForm));

    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeDefined();
    });
  });

  it("shows loading state during submission", async () => {
    let resolveFetch!: (value: unknown) => void;
    fetchSpy.mockReturnValue(new Promise((r) => { resolveFetch = r; }));
    render(React.createElement(PulseLoginForm));

    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Signing in..." })).toBeDefined();
    });

    // Resolve the fetch
    resolveFetch({ ok: true, json: () => Promise.resolve({}) });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sign in" })).toBeDefined();
    });
  });
});

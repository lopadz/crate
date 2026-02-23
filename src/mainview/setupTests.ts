import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Clean up DOM after each test so renders don't accumulate across tests
afterEach(cleanup);

// ResizeObserver is used by react-resizable-panels but not implemented in happy-dom
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock;

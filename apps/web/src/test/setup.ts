import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Globals are off, so unmount rendered components after each test ourselves.
afterEach(() => cleanup());

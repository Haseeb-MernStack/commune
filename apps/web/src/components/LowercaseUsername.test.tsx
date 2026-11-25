import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import LowercaseUsername from "./LowercaseUsername";

function Where() {
  const { pathname, search, hash } = useLocation();
  return <p data-testid="where">{pathname + search + hash}</p>;
}

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/u/:username/*"
          element={
            <LowercaseUsername>
              <Where />
            </LowercaseUsername>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LowercaseUsername", () => {
  it("shows the page when the address is already lowercase", () => {
    renderAt("/u/sam_dev");
    expect(screen.getByTestId("where")).toHaveTextContent("/u/sam_dev");
  });

  it("sends an address with capitals to the lowercase one", () => {
    renderAt("/u/Sam_Dev");
    expect(screen.getByTestId("where")).toHaveTextContent("/u/sam_dev");
  });

  it("keeps the rest of the address, the query and the hash", () => {
    renderAt("/u/SAM/followers?x=1#top");
    expect(screen.getByTestId("where")).toHaveTextContent("/u/sam/followers?x=1#top");
  });
});

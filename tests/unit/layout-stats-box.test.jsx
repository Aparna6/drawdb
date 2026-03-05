import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StatsBox from "../../src/components/StatsBox";

const mockUseDiagram = vi.fn();
const mockUseSettings = vi.fn();

vi.mock("../../src/hooks", () => ({
  useDiagram: () => mockUseDiagram(),
  useSettings: () => mockUseSettings(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) =>
      ({
        stats_box: "Stats",
        stats_tables: "Tables",
        stats_relationships: "Relationships",
        stats_max_depth: "Max depth",
        stats_components: "Components",
        stats_isolated_tables: "Isolated tables",
        stats_line_crossings: "Line crossings",
      })[key] ?? key,
  }),
}));

describe("StatsBox", () => {
  beforeEach(() => {
    mockUseSettings.mockReturnValue({ settings: { tableWidth: 200 } });
  });

  test("renders layout metrics from current diagram", () => {
    mockUseDiagram.mockReturnValue({
      tables: [
        { id: "t1", x: 0, y: 0, fields: [{}, {}] },
        { id: "t2", x: 400, y: 0, fields: [{}, {}] },
        { id: "t3", x: 400, y: 300, fields: [{}, {}] },
      ],
      relationships: [
        { startTableId: "t1", endTableId: "t2" },
        { startTableId: "t2", endTableId: "t3" },
      ],
    });

    render(<StatsBox />);

    const statsCard = screen.getByText("Stats").closest(".popover-theme");
    expect(statsCard).toHaveTextContent(/Tables\s*3/);
    expect(statsCard).toHaveTextContent(/Relationships\s*2/);
    expect(statsCard).toHaveTextContent(/Max depth\s*3/);
    expect(statsCard).toHaveTextContent(/Components\s*1/);
    expect(statsCard).toHaveTextContent(/Isolated tables\s*0/);
    expect(statsCard).toHaveTextContent(/Line crossings\s*0/);
  });
});

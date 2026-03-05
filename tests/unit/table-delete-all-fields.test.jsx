import React from "react";
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DiagramContextProvider from "../../src/context/DiagramContext";
import TransformContextProvider from "../../src/context/TransformContext";
import UndoRedoContextProvider from "../../src/context/UndoRedoContext";
import SelectContextProvider from "../../src/context/SelectContext";
import { useDiagram, useUndoRedo } from "../../src/hooks";

vi.mock("@douyinfe/semi-ui", () => ({
  Toast: {
    success: () => {},
  },
}));

function Providers({ children }) {
  return (
    <TransformContextProvider>
      <UndoRedoContextProvider>
        <SelectContextProvider>
          <DiagramContextProvider>{children}</DiagramContextProvider>
        </SelectContextProvider>
      </UndoRedoContextProvider>
    </TransformContextProvider>
  );
}

function Harness() {
  const { tables, relationships, setTables, setRelationships, deleteAllFields } =
    useDiagram();
  const { undoStack } = useUndoRedo();

  return (
    <div>
      <button
        onClick={() => {
          setTables([
            {
              id: "t1",
              name: "users",
              fields: [
                { id: "f1", name: "id", type: "INT" },
                { id: "f2", name: "team_id", type: "INT" },
              ],
              indices: [
                { id: 0, name: "idx_team", unique: false, fields: ["team_id"] },
              ],
            },
            {
              id: "t2",
              name: "teams",
              fields: [{ id: "f3", name: "id", type: "INT" }],
              indices: [],
            },
          ]);

          setRelationships([
            {
              id: "r1",
              name: "users_team_fk",
              startTableId: "t1",
              startFieldId: "f2",
              endTableId: "t2",
              endFieldId: "f3",
              updateConstraint: "no action",
              deleteConstraint: "no action",
            },
          ]);
        }}
      >
        seed
      </button>

      <button onClick={() => deleteAllFields("t1")}>delete-all</button>

      <div data-testid="fields-count">
        {tables.find((t) => t.id === "t1")?.fields.length ?? 0}
      </div>
      <div data-testid="indices-count">
        {tables.find((t) => t.id === "t1")?.indices.length ?? 0}
      </div>
      <div data-testid="relationships-count">{relationships.length}</div>
      <div data-testid="undo-count">{undoStack.length}</div>
      <div data-testid="undo-component">
        {undoStack[undoStack.length - 1]?.component ?? ""}
      </div>
    </div>
  );
}

describe("deleteAllFields", () => {
  test("clears fields and indices, removes related relationships, and records undo action", async () => {
    const user = userEvent.setup();

    render(
      <Providers>
        <Harness />
      </Providers>,
    );

    await user.click(screen.getByRole("button", { name: "seed" }));
    await user.click(screen.getByRole("button", { name: "delete-all" }));

    expect(screen.getByTestId("fields-count")).toHaveTextContent("0");
    expect(screen.getByTestId("indices-count")).toHaveTextContent("0");
    expect(screen.getByTestId("relationships-count")).toHaveTextContent("0");
    expect(screen.getByTestId("undo-count")).toHaveTextContent("1");
    expect(screen.getByTestId("undo-component")).toHaveTextContent(
      "field_delete_all",
    );
  });
});

import { describe, expect, it, vi } from "vitest";
import { getTrajectoryList } from "../trajectory-views";
import { getHost, getTrajectoryStore } from "../ops-services";

vi.mock("../ops-services", () => ({
  getHost: vi.fn(),
  getTrajectoryStore: vi.fn(),
}));

describe("trajectory-views", () => {
  it("getTrajectoryList handles NaN limit by falling back to default", async () => {
    const mockStore = {
      listTrajectories: vi
        .fn()
        .mockResolvedValue({ ids: [], next_cursor: undefined }),
      listOutcomes: vi.fn().mockResolvedValue({ outcomes: [] }),
    };
    (getTrajectoryStore as any).mockReturnValue(mockStore);
    (getHost as any).mockResolvedValue(null);

    await getTrajectoryList({ limit: NaN });

    expect(mockStore.listTrajectories).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 }),
    );
  });

  it("getTrajectoryList uses provided valid limit", async () => {
    const mockStore = {
      listTrajectories: vi
        .fn()
        .mockResolvedValue({ ids: [], next_cursor: undefined }),
      listOutcomes: vi.fn().mockResolvedValue({ outcomes: [] }),
    };
    (getTrajectoryStore as any).mockReturnValue(mockStore);
    (getHost as any).mockResolvedValue(null);

    await getTrajectoryList({ limit: 50 });

    expect(mockStore.listTrajectories).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 }),
    );
  });
});

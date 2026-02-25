import { beforeEach, describe, expect, test } from "vitest";
import { useSettingsStore } from "./settingsStore";

beforeEach(() => {
  useSettingsStore.setState({
    pinnedFolders: [],
    autoplay: false,
    normalizeVolume: false,
    normalizationTargetLufs: -14,
    sidebarWidth: 220,
    detailPanelWidth: 300,
  });
});

describe("settingsStore — pinned folders", () => {
  test("addPinnedFolder adds a path", () => {
    useSettingsStore.getState().addPinnedFolder("/Samples");
    expect(useSettingsStore.getState().pinnedFolders).toContain("/Samples");
  });

  test("addPinnedFolder is idempotent", () => {
    useSettingsStore.getState().addPinnedFolder("/Samples");
    useSettingsStore.getState().addPinnedFolder("/Samples");
    expect(useSettingsStore.getState().pinnedFolders.filter((p) => p === "/Samples")).toHaveLength(
      1,
    );
  });

  test("removePinnedFolder removes a path", () => {
    useSettingsStore.getState().addPinnedFolder("/Samples");
    useSettingsStore.getState().removePinnedFolder("/Samples");
    expect(useSettingsStore.getState().pinnedFolders).not.toContain("/Samples");
  });
});

describe("settingsStore — toggles", () => {
  test("setAutoplay updates autoplay", () => {
    useSettingsStore.getState().setAutoplay(true);
    expect(useSettingsStore.getState().autoplay).toBe(true);
  });

  test("toggleNormalizeVolume flips the flag", () => {
    expect(useSettingsStore.getState().normalizeVolume).toBe(false);
    useSettingsStore.getState().toggleNormalizeVolume();
    expect(useSettingsStore.getState().normalizeVolume).toBe(true);
    useSettingsStore.getState().toggleNormalizeVolume();
    expect(useSettingsStore.getState().normalizeVolume).toBe(false);
  });
});

describe("settingsStore — panel sizes", () => {
  test("setSidebarWidth updates sidebarWidth", () => {
    useSettingsStore.getState().setSidebarWidth(260);
    expect(useSettingsStore.getState().sidebarWidth).toBe(260);
  });

  test("setDetailPanelWidth updates detailPanelWidth", () => {
    useSettingsStore.getState().setDetailPanelWidth(350);
    expect(useSettingsStore.getState().detailPanelWidth).toBe(350);
  });
});

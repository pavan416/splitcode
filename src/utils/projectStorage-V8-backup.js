// ==========================================================
// SplitCode V7
// Local Project Storage
// ==========================================================

const STORAGE_KEY =
  "splitcode-project-v7";

export function saveProjectState(state) {
  try {
    const data = {
      version: 7,
      savedAt: Date.now(),

      inputCode:
        state.inputCode || "",

      files:
        Array.isArray(state.files)
          ? state.files
          : [],

      folders:
        Array.isArray(state.folders)
          ? state.folders
          : [],

      activeFileId:
        state.activeFileId || null,

      openFileIds:
        Array.isArray(
          state.openFileIds
        )
          ? state.openFileIds
          : [],
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );

    return true;
  } catch (error) {
    console.error(
      "SplitCode save failed:",
      error
    );

    return false;
  }
}

export function loadProjectState() {
  try {
    const stored =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (!stored) {
      return null;
    }

    const data =
      JSON.parse(stored);

    if (
      !data ||
      data.version !== 7
    ) {
      return null;
    }

    return data;
  } catch (error) {
    console.error(
      "SplitCode restore failed:",
      error
    );

    return null;
  }
}

export function clearSavedProject() {
  try {
    localStorage.removeItem(
      STORAGE_KEY
    );

    return true;
  } catch (error) {
    console.error(
      "SplitCode storage clear failed:",
      error
    );

    return false;
  }
}

export function hasSavedProject() {
  try {
    return Boolean(
      localStorage.getItem(
        STORAGE_KEY
      )
    );
  } catch {
    return false;
  }
}
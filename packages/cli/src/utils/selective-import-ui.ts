/**
 * Selective import UI utility
 * Provides tiered selection interface for importing rules based on file count and folder structure
 */

import * as clack from "@clack/prompts";
import { dirname } from "path";

/**
 * Represents a file available for import
 */
export interface ImportFile {
  path: string; // Absolute path
  relativePath: string; // Relative to workspace root
}

/**
 * Represents a group of files in a folder
 */
interface FileGroup {
  folder: string; // Folder path (relative to cwd)
  files: string[]; // File names
  relativePaths: string[]; // Full relative paths
}

/**
 * Result of user selection
 */
export interface SelectionResult {
  selectedFiles: ImportFile[];
  selectedFileCount: number;
  totalFileCount: number;
  skipped: boolean;
}

/**
 * Configurable thresholds for selection UI tiers
 */
export const SELECTION_THRESHOLDS = {
  AUTO_IMPORT_MAX: 1, // Auto-import without any prompt
  SHOW_LIST_MAX: 10, // Show full file list in prompt
  SINGLE_FOLDER_MULTISELECT: 30, // Max files before suggesting folder-level
};

/**
 * Group files by parent folder
 */
function groupFilesByFolder(files: ImportFile[]): FileGroup[] {
  const groups: Map<string, FileGroup> = new Map();

  for (const file of files) {
    // Get parent folder of the file
    const folder = dirname(file.relativePath);
    const folderKey = folder === "." ? "." : folder;

    if (!groups.has(folderKey)) {
      groups.set(folderKey, {
        folder: folderKey,
        files: [],
        relativePaths: [],
      });
    }

    const group = groups.get(folderKey)!;
    group.files.push(file.relativePath.split("/").pop() || file.relativePath);
    group.relativePaths.push(file.relativePath);
  }

  // Sort groups by folder name for consistent ordering
  return Array.from(groups.values()).sort((a, b) =>
    a.folder.localeCompare(b.folder),
  );
}

/**
 * Show simple confirmation prompt for small file counts
 */
async function promptConfirmAll(
  fileCount: number,
  groups: FileGroup[],
  showFileList: boolean,
): Promise<boolean> {
  // Show file list if requested and count is reasonable
  if (showFileList && fileCount <= SELECTION_THRESHOLDS.SHOW_LIST_MAX) {
    // Show grouped files with nice formatting
    if (groups.length === 1) {
      // Single folder - show files
      const group = groups[0]!;
      clack.log.info(`Found ${fileCount} file(s) in ${group.folder}:\n`);
      for (const file of group.files.slice(0, 15)) {
        console.log(`  ${file}`);
      }
      if (group.files.length > 15) {
        console.log(`  ... and ${group.files.length - 15} more`);
      }
      console.log("");
    } else {
      // Multiple folders - show folder summary
      clack.log.info(
        `Found ${fileCount} file(s) in ${groups.length} folder(s):\n`,
      );
      for (const group of groups) {
        console.log(
          `  ${group.folder}/ (${group.files.length} file${group.files.length > 1 ? "s" : ""})`,
        );
      }
      console.log("");
    }
  } else if (fileCount > SELECTION_THRESHOLDS.SHOW_LIST_MAX) {
    // Large count - just show summary
    if (groups.length === 1) {
      clack.log.info(`Found ${fileCount} files in ${groups[0]!.folder}/`);
    } else {
      clack.log.info(`Found ${fileCount} files in ${groups.length} folders`);
    }
    console.log("");
  }

  // Show confirmation prompt
  const confirm = await clack.confirm({
    message: "Import all?",
    initialValue: true,
  });

  return !clack.isCancel(confirm) && confirm;
}

/**
 * Show multiselect for individual files (single folder)
 */
async function promptSelectFiles(group: FileGroup): Promise<string[]> {
  const choices = group.files.map((file) => ({
    value: file,
    label: file,
  }));

  clack.log.info(`Select files to import (space to toggle):\n`);

  const selected = await clack.multiselect({
    message: `Files in ${group.folder}/`,
    options: choices,
    initialValues: choices.map((c) => c.value),
    required: false,
  });

  if (clack.isCancel(selected)) {
    clack.cancel("Import cancelled");
    return [];
  }

  return selected as string[];
}

/**
 * Show multiselect for folders
 */
async function promptSelectFolders(groups: FileGroup[]): Promise<FileGroup[]> {
  const choices = groups.map((group) => ({
    value: group.folder,
    label: group.folder,
    hint: `${group.files.length} file${group.files.length > 1 ? "s" : ""}`,
  }));

  clack.log.info(`Select folders to import (space to toggle):\n`);

  const selected = await clack.multiselect({
    message: "Folders to import",
    options: choices,
    initialValues: choices.map((c) => c.value),
    required: false,
  });

  if (clack.isCancel(selected)) {
    clack.cancel("Import cancelled");
    return [];
  }

  const selectedSet = new Set(selected);
  return groups.filter((g) => selectedSet.has(g.folder));
}

/**
 * Main function: Select files to import based on count and structure
 *
 * Tiered behavior:
 * - 1 file: Auto-import with message
 * - 2-10 files, 1 folder: Show list + confirm
 * - 11+ files, 1 folder: Show count + confirm (or multiselect if they say no)
 * - Multiple folders: Show summary + confirm (or folder multiselect if they say no)
 */
export async function selectFilesToImport(
  files: ImportFile[],
  options: { nonInteractive?: boolean } = {},
): Promise<SelectionResult> {
  const nonInteractive = options.nonInteractive ?? false;
  const fileCount = files.length;

  // No files case
  if (fileCount === 0) {
    return {
      selectedFiles: [],
      selectedFileCount: 0,
      totalFileCount: 0,
      skipped: false,
    };
  }

  // Non-interactive: auto-import all
  if (nonInteractive) {
    return {
      selectedFiles: files,
      selectedFileCount: fileCount,
      totalFileCount: fileCount,
      skipped: false,
    };
  }

  // Group files by folder
  const groups = groupFilesByFolder(files);
  const isSingleFolder = groups.length === 1;

  // Tier 1: Single file - auto-import with message
  if (fileCount === 1) {
    clack.log.success(
      `Importing 1 rule from ${groups[0]!.folder}/${groups[0]!.files[0]!}`,
    );
    return {
      selectedFiles: files,
      selectedFileCount: 1,
      totalFileCount: 1,
      skipped: false,
    };
  }

  // Tier 2: Small count, single folder - show list and ask
  if (isSingleFolder && fileCount <= SELECTION_THRESHOLDS.SHOW_LIST_MAX) {
    const confirmed = await promptConfirmAll(fileCount, groups, true);

    if (confirmed) {
      return {
        selectedFiles: files,
        selectedFileCount: fileCount,
        totalFileCount: fileCount,
        skipped: false,
      };
    }

    // User said no - show file multiselect
    const selected = await promptSelectFiles(groups[0]!);
    if (selected.length === 0) {
      return {
        selectedFiles: [],
        selectedFileCount: 0,
        totalFileCount: fileCount,
        skipped: true,
      };
    }

    const selectedFiles = files.filter((f) =>
      selected.includes(f.relativePath.split("/").pop() || ""),
    );
    return {
      selectedFiles,
      selectedFileCount: selectedFiles.length,
      totalFileCount: fileCount,
      skipped: false,
    };
  }

  // Tier 3: Large count or multiple folders - show summary and ask
  const confirmed = await promptConfirmAll(fileCount, groups, false);

  if (confirmed) {
    return {
      selectedFiles: files,
      selectedFileCount: fileCount,
      totalFileCount: fileCount,
      skipped: false,
    };
  }

  // User said no - show folder multiselect if multiple, else file multiselect
  if (isSingleFolder) {
    const selected = await promptSelectFiles(groups[0]!);
    if (selected.length === 0) {
      return {
        selectedFiles: [],
        selectedFileCount: 0,
        totalFileCount: fileCount,
        skipped: true,
      };
    }

    const selectedFiles = files.filter((f) =>
      selected.includes(f.relativePath.split("/").pop() || ""),
    );
    return {
      selectedFiles,
      selectedFileCount: selectedFiles.length,
      totalFileCount: fileCount,
      skipped: false,
    };
  } else {
    // Multiple folders - show folder multiselect
    const selectedGroups = await promptSelectFolders(groups);
    if (selectedGroups.length === 0) {
      return {
        selectedFiles: [],
        selectedFileCount: 0,
        totalFileCount: fileCount,
        skipped: true,
      };
    }

    const selectedFolders = new Set(selectedGroups.map((g) => g.folder));
    const selectedFiles = files.filter((f) => {
      const folder = dirname(f.relativePath);
      return selectedFolders.has(folder === "." ? "." : folder);
    });

    return {
      selectedFiles,
      selectedFileCount: selectedFiles.length,
      totalFileCount: fileCount,
      skipped: false,
    };
  }
}

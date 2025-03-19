# Cloud Sync Plugin for Obsidian

This plugin helps you synchronize your Obsidian vault with cloud storage using Rclone's bisync feature. It provides a simple interface to keep your notes in sync across different devices.

## NEW

After more testing I found that https://github.com/syncthing/syncthing and https://github.com/Catfriend1/syncthing-android works pretty well for my use case via local sharing, this repo is still for times where you need cloud storage

## Why Not Just Edit Directly in Cloud Storage?

While it's tempting to directly edit files within a cloud-synced folder (like Google Drive), this often leads to significant performance issues within Obsidian.  Opening, editing, and even navigating can become sluggish. This plugin allows you to work locally with optimal speed and sync only when needed.

## Features

- Synchronize your Obsidian vault with cloud storage
- Simple, user-friendly interface
- Progress tracking during sync operations
- Configurable source and destination paths
- **Three sync modes:**
  - **Bi-directional sync:**  Uses `rclone bisync` to synchronize changes between local and remote locations.  Handles conflicts by creating `.conflict` files and, after manual resolution with a merge tool (Meld), automatically cleans them up.
  - **Local -> Remote:**  Syncs from your local vault to the remote storage (one-way).
  - **Remote -> Local:**  Syncs from the remote storage to your local vault (one-way).
- **Conflict Resolution (in Bi-directional Sync):**
    - Detects conflicts during bi-directional sync.
    - Renames conflicting local files to avoid overwrites.
    - Automatically opens the **Meld** merge tool (must be installed on your system) for manual conflict resolution.
    - After resolving conflicts in Meld and saving, automatically cleans up the temporary conflict files.
- **Automatic Local -> Remote Sync after Bi-directional:** An optional setting to automatically perform a Local -> Remote sync after a bi-directional sync.  This helps ensure that any conflict resolutions made locally are immediately pushed to the remote storage.
- Automatically excludes `.obsidian/` and `.git/` folders to prevent conflicts and unnecessary syncing.

## Installation

1. Download the latest release from the GitHub repository.
2. Extract the `obsidian-cloud-sync` folder into your Obsidian vault's `.obsidian/plugins/` directory.
3. Enable the plugin in Obsidian's settings under "Community plugins".

## Prerequisites

This plugin requires [Rclone](https://rclone.org/) to be installed on your system:
- For regular systems: Install Rclone according to the [official documentation](https://rclone.org/install/).
- For Flatpak Obsidian users: The plugin uses `flatpak-spawn --host` to access Rclone on the host system.  This also applies to `meld`.

You must configure Rclone with your cloud provider before using this plugin. See the [Rclone documentation](https://rclone.org/docs/) for instructions.

**For conflict resolution, you need to install Meld:**
- For regular systems:  Install Meld through your distribution's package manager (e.g., `apt install meld`, `pacman -S meld`, etc.).
- For Flatpak Obsidian users: The plugin uses `flatpak-spawn --host` to run Meld from the host system.  Ensure Meld is installed on your host.

## Usage

1. Configure your source and destination paths, and the auto-sync option in the plugin settings.
2. Click the sync icon in the left ribbon or use the "Sync Notes with Cloud" command.
3. In the modal that appears, choose your sync option:
    - **Sync Local -> Remote:** Syncs changes from your local machine to the cloud.
    - **Sync Remote -> Local:** Syncs changes from the cloud to your local machine.
    - **Bi-directional Sync:** Synchronizes changes in both directions, with conflict resolution.
4. Click the appropriate button to start the sync.
5. Watch the progress as your notes sync with the cloud.  If conflicts occur during bi-directional sync, Meld will open automatically. Resolve the conflicts in Meld, save the changes, and close Meld. The plugin will then continue the sync process.

## Configuration

- **Local Source**: The path to your local Obsidian vault (default: `~/Notes`).
- **Remote Destination**: The Rclone destination path (default: `gdrive:"notes_vault"`).
- **Auto sync Local to Remote after bisync:** If enabled, automatically performs a Local -> Remote sync after a Bi-directional sync. This ensures that conflict resolutions are immediately propagated to the remote storage (default: `false`).

## Excluded Files

By default, the plugin excludes the following to prevent conflicts and improve performance:

- `.obsidian/` (including all subfolders like plugins, themes, etc.)
- `.git/`

## Troubleshooting

- **Sync cancelled:** If you close the modal while a sync is in progress, the sync process will be terminated.
- **Failed to start sync:** Ensure Rclone is correctly installed and configured. Check the developper console for any errors.
- **Error: conflict detected, but filepaths could not be extracted:** This indicates an unexpected output format from Rclone during conflict detection. Please report this issue.
- **Error renaming conflict file:** This might indicate a permission issue or a problem with the filesystem.
- **Rclone Segfaults:** Rclone may occasionally segfault. The plugin will attempt to automatically handle a detected segfault, clean up the lockfile and restart rclone.
- **If Meld doesn't open:** Make sure Meld is installed on your host system

## Support

If you encounter any issues or have suggestions, please open an issue on the GitHub repository.

## License

This plugin is released under the MIT License.

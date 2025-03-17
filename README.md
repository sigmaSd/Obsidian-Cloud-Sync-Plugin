# Cloud Sync Plugin for Obsidian

This plugin helps you synchronize your Obsidian vault with cloud storage using Rclone's bisync feature. It provides a simple interface to keep your notes in sync across different devices.

## Features

- Synchronize your Obsidian vault with cloud storage
- Simple, user-friendly interface
- Progress tracking during sync operations
- Configurable source and destination paths
- Automatically excludes plugin folders to prevent conflicts

## Installation

1. Download the latest release from the GitHub repository
2. Extract the `obsidian-cloud-sync` folder into your Obsidian vault's `.obsidian/plugins/` directory
3. Enable the plugin in Obsidian's settings under "Community plugins"

## Prerequisites

This plugin requires [Rclone](https://rclone.org/) to be installed on your system:
- For regular systems: Install Rclone according to the [official documentation](https://rclone.org/install/)
- For Flatpak Obsidian users: The plugin uses `flatpak-spawn --host` to access Rclone on the host system

You must configure Rclone with your cloud provider before using this plugin. See the [Rclone documentation](https://rclone.org/docs/) for instructions.

## Usage

1. Configure your source and destination paths in the plugin settings
2. Click the sync icon in the left ribbon or use the "Sync Notes with Cloud" command
3. Click "Start Sync" in the modal that appears
4. Watch the progress as your notes sync with the cloud

## Configuration

- **Local Source**: The path to your local Obsidian vault (default: `~/Notes`)
- **Remote Destination**: The Rclone destination path (default: `gdrive:"notes_vault"`)

## Excluded Files

By default, the plugin excludes `.obsidian/plugins/**` to prevent plugin conflicts between devices.

## Support

If you encounter any issues or have suggestions, please open an issue on the GitHub repository.

## License

This plugin is released under the MIT License.

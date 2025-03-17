/// <reference lib="dom" />
import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";

import { exec } from "child_process";

interface SyncPluginSettings {
	syncSource: string;
	syncDestination: string;
}

const DEFAULT_SETTINGS: SyncPluginSettings = {
	syncSource: "~/Notes",
	syncDestination: 'gdrive:"notes_vault"',
};

export default class SyncPlugin extends Plugin {
	settings!: SyncPluginSettings;

	override async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon for quick access to sync
		const ribbonIconEl = this.addRibbonIcon(
			"refresh-cw", // Sync icon
			"Sync Notes",
			(_evt: MouseEvent) => {
				new SyncModal(this.app, this.settings).open();
			},
		);
		ribbonIconEl.addClass("sync-plugin-ribbon-class");

		// Add the Sync command to palette
		this.addCommand({
			id: "run-sync",
			name: "Sync Notes with Cloud",
			callback: () => {
				new SyncModal(this.app, this.settings).open();
			},
		});

		// This adds a settings tab so the user can configure sync paths
		this.addSettingTab(new SyncSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SyncModal extends Modal {
	settings: SyncPluginSettings;
	progressTextEl!: HTMLElement;
	isSyncing: boolean = false;
	// deno-lint-ignore no-explicit-any
	syncProcess: any = null;
	startButton!: HTMLButtonElement;
	cancelButton!: HTMLButtonElement;

	constructor(app: App, settings: SyncPluginSettings) {
		super(app);
		this.settings = settings;
	}

	override onOpen() {
		const { contentEl } = this;

		// Add some padding and better styling to the modal
		contentEl.style.padding = "20px";

		contentEl.createEl("h2", {
			text: "Sync Notes with Cloud",
			cls: "sync-modal-title",
		}).style.marginBottom = "15px";

		// Create a container for the progress text with better styling
		const outputContainer = contentEl.createEl("div", {
			cls: "sync-progress-container",
		});
		outputContainer.style.maxHeight = "300px";
		outputContainer.style.minHeight = "150px";
		outputContainer.style.overflow = "auto";
		outputContainer.style.border =
			"1px solid var(--background-modifier-border)";
		outputContainer.style.margin = "10px 0 20px 0";
		outputContainer.style.padding = "15px";
		outputContainer.style.borderRadius = "5px";
		outputContainer.style.fontFamily = "monospace";
		outputContainer.style.whiteSpace = "pre-wrap";
		outputContainer.style.wordBreak = "break-all";
		outputContainer.style.backgroundColor = "var(--background-secondary)";

		this.progressTextEl = outputContainer;
		this.progressTextEl.setText(
			"Ready to sync. Click 'Start Sync' to begin.",
		);

		// Create control buttons with better styling
		const buttonDiv = contentEl.createEl("div", { cls: "sync-buttons" });
		buttonDiv.style.display = "flex";
		buttonDiv.style.justifyContent = "flex-end";
		buttonDiv.style.gap = "10px";
		buttonDiv.style.marginTop = "15px";

		this.startButton = buttonDiv.createEl("button", {
			text: "Start Sync",
			cls: "mod-cta",
		});
		this.startButton.style.padding = "5px 15px";
		this.startButton.onclick = () => this.startSync();

		this.cancelButton = buttonDiv.createEl("button", { text: "Close" });
		this.cancelButton.style.padding = "5px 15px";
		this.cancelButton.onclick = () => {
			if (this.isSyncing && this.syncProcess) {
				try {
					this.syncProcess.kill();
					this.progressTextEl.setText(
						this.progressTextEl.getText() + "\n\nSync cancelled.",
					);
					this.startButton.disabled = false;
					this.startButton.setText("Start Sync");
					this.cancelButton.setText("Close");
					this.isSyncing = false;
				} catch (e) {
					console.error("Failed to cancel sync process", e);
				}
			} else {
				this.close();
			}
		};
	}

	appendToProgress(text: string) {
		if (!text) return;
		const currentText = this.progressTextEl.getText();
		this.progressTextEl.setText(currentText + "\n" + text);
		// Scroll to bottom
		this.progressTextEl.scrollTop = this.progressTextEl.scrollHeight;
	}

	startSync() {
		if (this.isSyncing) return;

		this.isSyncing = true;
		this.progressTextEl.setText("Starting sync...");

		// Disable start button and change cancel button text
		this.startButton.disabled = true;
		this.startButton.setText("Syncing...");
		this.cancelButton.setText("Cancel Sync");

		const command =
			`flatpak-spawn --host rclone bisync ${this.settings.syncSource} ${this.settings.syncDestination} --exclude ".obsidian/plugins/**" --progress`;

		try {
			this.syncProcess = exec(command, (error, _stdout, stderr) => {
				this.isSyncing = false;

				// Re-enable start button and revert cancel button text
				this.startButton.disabled = false;
				this.startButton.setText("Start Sync");
				this.cancelButton.setText("Close");

				if (error) {
					this.appendToProgress(`Error: ${error.message}`);
					if (stderr) {
						this.appendToProgress(`\nDetails: ${stderr}`);
					}
					return;
				}

				this.appendToProgress(`\nSync completed successfully!`);
				new Notice("Sync completed successfully!");
			});

			// Display progress updates
			let buffer = "";
			if (this.syncProcess && this.syncProcess.stdout) {
				this.syncProcess.stdout.on("data", (data: string) => {
					buffer += data.toString();

					// Process complete lines
					if (buffer.includes("\n")) {
						const lines = buffer.split("\n");
						buffer = lines.pop() || ""; // Keep the last incomplete line in the buffer

						// Update progress with complete lines
						this.progressTextEl.setText(lines.join("\n"));
					}
				});
			}

			if (this.syncProcess && this.syncProcess.stderr) {
				this.syncProcess.stderr.on("data", (data: string) => {
					this.appendToProgress(data.toString());
				});
			}
		} catch (e) {
			this.isSyncing = false;
			this.progressTextEl.setText(`Failed to start sync: ${e}`);

			// Re-enable start button and revert cancel button text
			this.startButton.disabled = false;
			this.startButton.setText("Start Sync");
			this.cancelButton.setText("Close");
		}
	}

	override onClose() {
		const { contentEl } = this;

		if (this.isSyncing && this.syncProcess) {
			try {
				this.syncProcess.kill();
				new Notice("Sync cancelled due to modal closing");
			} catch (e) {
				console.error("Failed to clean up sync process", e);
			}
		}

		contentEl.empty();
	}
}

class SyncSettingTab extends PluginSettingTab {
	plugin: SyncPlugin;

	constructor(app: App, plugin: SyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Sync Settings" });

		// Add sync source setting
		new Setting(containerEl)
			.setName("Local Source")
			.setDesc("Local directory to sync (default: ~/Notes)")
			.addText((text) =>
				text
					.setPlaceholder("~/Notes")
					.setValue(this.plugin.settings.syncSource)
					.onChange(async (value) => {
						this.plugin.settings.syncSource = value;
						await this.plugin.saveSettings();
					})
			);

		// Add sync destination setting
		new Setting(containerEl)
			.setName("Remote Destination")
			.setDesc(
				'Remote destination for sync (default: gdrive:"notes_vault")',
			)
			.addText((text) =>
				text
					.setPlaceholder('gdrive:"notes_vault"')
					.setValue(this.plugin.settings.syncDestination)
					.onChange(async (value) => {
						this.plugin.settings.syncDestination = value;
						await this.plugin.saveSettings();
					})
			);

		// Add information about exclude filters
		const infoDiv = containerEl.createEl("div", { cls: "sync-info" });
		infoDiv.style.backgroundColor = "var(--background-secondary)";
		infoDiv.style.padding = "10px";
		infoDiv.style.borderRadius = "5px";
		infoDiv.style.marginTop = "20px";

		infoDiv.createEl("h3", { text: "Excluded from Sync" });
		const excludeList = infoDiv.createEl("ul");
		excludeList.createEl("li", {
			text:
				".obsidian/plugins/** - Plugins are excluded to avoid conflicts",
		});
	}
}

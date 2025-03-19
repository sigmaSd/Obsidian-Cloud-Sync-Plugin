/// <reference lib="dom" />
import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";

import { exec, execSync } from "child_process";
import fs from "fs";

interface SyncPluginSettings {
	syncSource: string;
	syncDestination: string;
	autoSyncLocalToRemoteAfterBiSync: boolean;
}

const DEFAULT_SETTINGS: SyncPluginSettings = {
	syncSource: "~/Notes",
	syncDestination: 'gdrive:"notes_vault"',
	autoSyncLocalToRemoteAfterBiSync: false,
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
	startLocalToRemoteButton!: HTMLButtonElement;
	startRemoteToLocalButton!: HTMLButtonElement;
	startButton!: HTMLButtonElement; // Bi-directional
	cancelButton!: HTMLButtonElement;

	constructor(app: App, settings: SyncPluginSettings) {
		super(app);
		this.settings = settings;
	}

	override onOpen() {
		const { contentEl } = this;

		contentEl.style.padding = "20px";

		contentEl.createEl("h2", {
			text: "Sync Notes with Cloud",
			cls: "sync-modal-title",
		}).style.marginBottom = "15px";

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
			"Ready to sync. Choose a sync option to begin.",
		);

		const buttonDiv = contentEl.createEl("div", { cls: "sync-buttons" });
		buttonDiv.style.display = "flex";
		buttonDiv.style.justifyContent = "flex-end"; // Align buttons to the right
		buttonDiv.style.gap = "10px";
		buttonDiv.style.marginTop = "15px";
		// @ts-ignore works
		buttonDiv.style["flex-wrap"] = "wrap";

		this.startLocalToRemoteButton = buttonDiv.createEl("button", {
			text: "Sync Local -> Remote",
			cls: "mod-cta", // Use Obsidian's button styling
		});
		this.startLocalToRemoteButton.onclick = () =>
			this.startSync("local->remote");

		this.startRemoteToLocalButton = buttonDiv.createEl("button", {
			text: "Sync Remote -> Local",
			cls: "mod-cta",
		});
		this.startRemoteToLocalButton.onclick = () =>
			this.startSync("remote->local");

		this.startButton = buttonDiv.createEl("button", {
			text: "Bi-directional Sync",
			cls: "mod-cta",
		});
		this.startButton.onclick = () => this.startSync("bi");

		this.cancelButton = buttonDiv.createEl("button", { text: "Close" });
		this.cancelButton.onclick = () => {
			if (this.isSyncing && this.syncProcess) {
				try {
					this.syncProcess.kill();
					this.appendToProgress("\nSync cancelled.");
					this.resetButtons();
				} catch (e) {
					console.error("Failed to cancel sync process", e);
				}
			} else {
				this.close();
			}
		};
	}

	resetButtons() {
		this.isSyncing = false;
		this.startButton.disabled = false;
		this.startButton.setText("Bi-directional Sync");
		this.startLocalToRemoteButton.disabled = false;
		this.startLocalToRemoteButton.setText("Sync Local -> Remote");
		this.startRemoteToLocalButton.disabled = false;
		this.startRemoteToLocalButton.setText("Sync Remote -> Local");
		this.cancelButton.setText("Close");
	}

	appendToProgress(text: string) {
		if (!text) return;
		this.progressTextEl.appendText("\n" + text);
		this.progressTextEl.scrollTop = this.progressTextEl.scrollHeight;
	}

	startSync(direction: "local->remote" | "remote->local" | "bi") {
		if (this.isSyncing) return;

		this.isSyncing = true;
		this.progressTextEl.setText("Starting sync...");

		this.startButton.disabled = true;
		this.startLocalToRemoteButton.disabled = true;
		this.startRemoteToLocalButton.disabled = true;
		this.cancelButton.setText("Cancel Sync");

		// Set button text based on which button was clicked
		if (direction === "bi") {
			this.startButton.setText("Syncing...");
		} else if (direction === "local->remote") {
			this.startLocalToRemoteButton.setText("Syncing...");
		} else {
			this.startRemoteToLocalButton.setText("Syncing...");
		}

		const baseCommand = "flatpak-spawn --host rclone";
		const flags =
			'--exclude ".obsidian/" --exclude=".git/" --progress --color never';
		let command: string;

		if (direction === "bi") {
			command =
				`${baseCommand} bisync ${this.settings.syncSource} ${this.settings.syncDestination} ${flags}`;
		} else if (direction === "local->remote") {
			command =
				`${baseCommand} sync ${this.settings.syncSource} ${this.settings.syncDestination} ${flags}`;
		} else {
			// "remote->local"
			command =
				`${baseCommand} sync ${this.settings.syncDestination} ${this.settings.syncSource} ${flags}`;
		}

		try {
			this.syncProcess = exec(command, (error, stdout, stderr) => {
				this.resetButtons();

				// sometimes rclone segfaults after exiting, lets ignore all errors for now
				if (error) {
					this.appendToProgress(
						`Error: ${error.message}`,
					);
					const deleteLockCmd = stderr.match(/rclone deletefile.*/)
						?.at(0);
					if (deleteLockCmd) {
						this.appendToProgress(
							"Cleaning lock file, retrying..",
						);
						execSync(`flatpak-spawn --host ${deleteLockCmd}`);
						this.startSync(direction);
						return;
					}
				}

				// handle conflicts (only in bisync mode)
				if (direction === "bi" && /NOTICE: - Path1/.test(stdout)) {
					const firstPath = stdout.match(
						/Renaming Path1 copy.*- (.*)/,
					)?.at(1);
					const secondPath = stdout.match(
						/Queue copy to Path1.*- (.*)/,
					)?.at(1);
					if (!firstPath || !secondPath) {
						this.appendToProgress(
							`Error: conflict detected, but filepaths could not be extracted.`,
						);
						return; // prevent null access error.
					}

					const firstPathWithoutConflict = `${
						firstPath.replace(/\.conflict.*$/, "")
					}`;
					try {
						fs.renameSync(
							firstPath,
							firstPathWithoutConflict,
						);
					} catch (renameError) {
						this.appendToProgress(
							`Error renaming conflict file: ${renameError}`,
						);
						return; // Prevent meld from being launched
					}

					new Notice("Opening merge editor");
					this.appendToProgress(`Opening merge editor...`);
					execSync(
						`flatpak-spawn --host meld ${firstPathWithoutConflict} ${secondPath}`,
					);
					fs.unlinkSync(secondPath);

					if (this.settings.autoSyncLocalToRemoteAfterBiSync) {
						this.appendToProgress(`Starting sync Local -> Remote`);
						this.startSync("local->remote");
					} else {
						this.appendToProgress("Sync completed successfully!");
						new Notice("Sync completed successfully!");
					}
				} else {
					this.appendToProgress("Sync completed successfully!");
					new Notice("Sync completed successfully!");
				}
			});

			// Use a single buffer for both stdout and stderr
			let buffer = "";

			const processOutput = (data: string) => {
				buffer += data;
				if (buffer.includes("\n")) {
					const lines = buffer.split("\n");
					buffer = lines.pop() || ""; // Keep last incomplete line
					this.progressTextEl.setText(lines.join("\n")); // Overwrite
					this.progressTextEl.scrollTop =
						this.progressTextEl.scrollHeight;
				}
			};

			if (this.syncProcess?.stdout) {
				this.syncProcess.stdout.on("data", processOutput);
			}
			if (this.syncProcess?.stderr) {
				this.syncProcess.stderr.on("data", processOutput);
			}
		} catch (e) {
			this.resetButtons();
			this.progressTextEl.setText(`Failed to start sync: ${e}`);
		}
	}

	override onClose() {
		if (this.isSyncing && this.syncProcess) {
			try {
				this.syncProcess.kill();
				new Notice("Sync cancelled due to modal closing");
			} catch (e) {
				console.error("Failed to clean up sync process", e);
			}
		}
		this.contentEl.empty(); // Clean up the modal content
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

		new Setting(containerEl)
			.setName("Auto sync Local to Remote after bisync")
			.setDesc(
				"This is useful to automaticly remove any remaining conflict files (default: false)",
			)
			.addToggle((cb) =>
				cb.setValue(
					this.plugin.settings.autoSyncLocalToRemoteAfterBiSync,
				)
					.onChange((newValue) =>
						this.plugin.settings.autoSyncLocalToRemoteAfterBiSync =
							newValue
					)
			);

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

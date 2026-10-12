import { Notice, type App, type TFile, type WorkspaceLeaf } from 'obsidian';

/** Shows the note in its own tab if it has one, otherwise in a new tab. Never replaces the active note. */
export async function openNote(app: App, file: TFile): Promise<void> {
	// A renamed file keeps its TFile, so only a deleted one fails this lookup.
	if (!app.vault.getAbstractFileByPath(file.path)) {
		new Notice(`Note not found: ${file.basename}`);
		return;
	}

	const open: WorkspaceLeaf[] = [];
	app.workspace.iterateAllLeaves((leaf) => {
		// Read the view state, not the view: a background tab may not have loaded its view yet.
		const state = leaf.getViewState();
		if (state.type === 'markdown' && state.state?.file === file.path) {
			open.push(leaf);
		}
	});

	const existing = open[0];
	if (existing) {
		await app.workspace.revealLeaf(existing);
		app.workspace.setActiveLeaf(existing, { focus: true });
		return;
	}
	await app.workspace.getLeaf('tab').openFile(file);
}

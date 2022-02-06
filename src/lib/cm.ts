import {commands, ExtensionContext, QuickPickItemKind, window, workspace} from "vscode";
import {Flow, TreeViewBranches} from "../ViewBranches";
import {Tag, TreeViewVersions} from "../ViewVersions";
import {Disposable} from "./disposables";
import {Logger} from "./logger";

export class CommandManager extends Disposable {
    constructor(
        private context: ExtensionContext,
        private logger: Logger,
        viewBranches: TreeViewBranches,
        viewVersions: TreeViewVersions
    ) {
        super();

        this.rc("gitflow.quickPick", async () => {
            if (viewBranches.listBranches.length < 2) {
                window.showWarningMessage("Looks like view was not yet initialized");
                return;
            }

            let list = [
                {label: "Start new branch", id: "", kind: QuickPickItemKind.Separator},
                {label: "$(test-view-icon) Start Feature", id: "newFeature", description: ""},
                {label: "$(callstack-view-session) Start Bugfix", id: "newBugfix", description: ""},
                {label: "$(history) Start Support", id: "newSupport", description: ""},
            ];
            // Only single release might be at a time
            if (viewBranches.listBranches.filter((el) => el.search("release/") !== -1).length === 0) {
                list.push({label: "$(tag) Start Release", id: "newRelease", description: ""});
            }
            // Only single hotfix at a time
            if (viewBranches.listBranches.filter((el) => el.search("hotfix/") !== -1).length === 0) {
                list.push({label: "$(flame) Start Hotfix", id: "newHotfix", description: ""});
            }

            let cur = viewBranches.curBranch.split("/")[0];
            if (["feature", "release", "hotfix", "bugfix"].includes(cur)) {
                list.push({
                    label: "Current branch",
                    id: "",
                    kind: QuickPickItemKind.Separator,
                });
                list.push({
                    label: `$(trash) Delete ${ucf(cur)}`,
                    description: viewBranches.curBranch,
                    id: "delete",
                });
                list.push({
                    label: `$(debug-stop) Finalize ${ucf(cur)}`,
                    description: viewBranches.curBranch,
                    id: "finish",
                });
                list.push({
                    label: `$(git-merge) Rebase ${ucf(cur)}`,
                    description: viewBranches.curBranch,
                    id: "rebase",
                });
                if (!viewBranches.listRemoteBranches.includes(viewBranches.curBranch)) {
                    list.push({
                        label: `$(cloud-upload) Publish ${ucf(cur)}`,
                        description: viewBranches.curBranch,
                        id: "publish",
                    });
                }
            }
            let action = await window.showQuickPick(list, {
                title: "Select an action",
            });
            if (action === undefined) {
                return;
            }
            if (action.id.search("new") !== -1) {
                await viewBranches.general("start", action.id.replace("new", "").toLowerCase());
            } else {
                await viewBranches.general(action.id, action.description);
            }
            commands.executeCommand("workbench.view.scm");

            function ucf(string: string) {
                return string.charAt(0).toUpperCase() + string.slice(1);
            }
        });
        this.rc("gitflow.refreshB", () => {
            viewBranches.refresh();
        });
        this.rc("gitflow.fetchAllBranches", () => {
            viewBranches.fetchAllBranches();
        });
        this.rc("gitflow.init", () => {
            viewBranches.init();
        });
        this.rc("gitflow.checkoutBranch", (node?: Flow) => {
            viewBranches.checkoutBranch(node);
        });
        this.rc("gitflow.syncAll", () => {
            viewBranches.syncAll();
        });

        this.rc("gitflow.newSupport", () => {
            viewBranches.startSupport();
        });
        this.rc("gitflow.checkoutSupport", (node?: Flow) => {
            viewBranches.checkoutSupport(node);
        });
        this.rc("gitflow.deleteSupport", (node?: Flow) => {
            viewBranches.deleteSupport(node);
        });
        this.rc("gitflow.rebaseSupport", (node?: Flow) => {
            viewBranches.rebaseSupport(node);
        });
        this.rc("gitflow.publishSupport", (node?: Flow) => {
            viewBranches.publishSupport(node);
        });

        this.rc("gitflow.newHotfix", () => {
            viewBranches.startHotfix();
        });
        this.rc("gitflow.publishHotfix", (node?: Flow) => {
            viewBranches.publishHotfix(node);
        });
        this.rc("gitflow.deleteHotfix", (node?: Flow) => {
            viewBranches.deleteHotfix(node);
        });
        this.rc("gitflow.finishHotfix", (node?: Flow) => {
            viewBranches.finishHotfix(node);
        });
        this.rc("gitflow.rebaseHotfix", (node?: Flow) => {
            viewBranches.rebaseHotfix(node);
        });
        this.rc("gitflow.checkoutHotfix", (node?: Flow) => {
            viewBranches.checkoutHotfix(node);
        });

        this.rc("gitflow.newRelease", () => {
            viewBranches.startRelease();
        });
        this.rc("gitflow.publishRelease", (node?: Flow) => {
            viewBranches.publishRelease(node);
        });
        this.rc("gitflow.deleteRelease", (node?: Flow) => {
            viewBranches.deleteRelease(node);
        });
        this.rc("gitflow.finishRelease", (node?: Flow) => {
            viewBranches.finishRelease(node);
        });
        this.rc("gitflow.trackRelease", (node?: Flow) => {
            viewBranches.trackRelease(node);
        });
        this.rc("gitflow.rebaseRelease", (node?: Flow) => {
            viewBranches.rebaseRelease(node);
        });
        this.rc("gitflow.checkoutRelease", (node?: Flow) => {
            viewBranches.checkoutRelease(node);
        });

        this.rc("gitflow.newFeature", () => {
            viewBranches.startFeature();
        });
        this.rc("gitflow.checkoutFeature", (node?: Flow) => {
            viewBranches.checkoutFeature(node);
        });
        this.rc("gitflow.publishFeature", (node?: Flow) => {
            viewBranches.publishFeature(node);
        });
        this.rc("gitflow.deleteFeature", (node?: Flow) => {
            viewBranches.deleteFeature(node);
        });
        this.rc("gitflow.rebaseFeature", (node?: Flow) => {
            viewBranches.rebaseFeature(node);
        });
        this.rc("gitflow.trackFeature", (node?: Flow) => {
            viewBranches.trackFeature(node);
        });
        this.rc("gitflow.finishFeature", (node?: Flow) => {
            viewBranches.finishFeature(node);
        });

        this.rc("gitflow.newBugfix", () => {
            viewBranches.startBugfix();
        });
        this.rc("gitflow.checkoutBugfix", (node?: Flow) => {
            viewBranches.checkoutBugfix(node);
        });
        this.rc("gitflow.publishBugfix", (node?: Flow) => {
            viewBranches.publishBugfix(node);
        });
        this.rc("gitflow.deleteBugfix", (node?: Flow) => {
            viewBranches.deleteBugfix(node);
        });
        this.rc("gitflow.rebaseBugfix", (node?: Flow) => {
            viewBranches.rebaseBugfix(node);
        });
        this.rc("gitflow.trackBugfix", (node?: Flow) => {
            viewBranches.trackBugfix(node);
        });
        this.rc("gitflow.finishBugfix", (node?: Flow) => {
            viewBranches.finishBugfix(node);
        });

        this.rc("gitflow.refreshT", () => {
            viewVersions.refresh();
        });
        this.rc("gitflow.pushTags", () => {
            viewVersions.pushTags();
        });
        this.rc("gitflow.pushTag", (e?: Tag) => {
            viewVersions.pushTag(e);
        });
        this.rc("gitflow.deleteTag", (e?: Tag) => {
            viewVersions.deleteTag(e);
        });
    }

    /**
     * Register command short way
     * @param command
     * @param callback
     */
    public rc(command: string, callback: (...args: any[]) => any) {
        this.context.subscriptions.push(
            commands.registerCommand(command, (...args: any[]) => {
                this.logger.log(command, "Run command");
                callback(...args);
            })
        );
    }
}

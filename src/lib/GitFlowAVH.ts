import * as vscode from 'vscode';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { Flow } from '../ViewBranches';
import { Util } from './Util';
import { Logger, LogLevels } from './logger';
import { BranchConfig, GitFlowImplementation, OperationContext } from './GitFlowImplementation';

export class GitFlowAVH extends GitFlowImplementation {
    get variant(): 'avh' { return 'avh'; }

    // ═══════════════════════════════════════════════════════════
    // Config / detection
    // ═══════════════════════════════════════════════════════════

    parseConfigList(output: string): BranchConfig {
        const configLines = output.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
        const parsedConfig: Record<string, string> = {};
        for (const line of configLines) {
            const match = line.match(/(?:^[^:]*:\s*|^[^=]*=\s*)(.+)/);
            if (!match) { continue; }
            const value = match[1].trim();
            const lower = line.toLowerCase();
            if (
                lower.includes('production') || lower.includes('main') || lower.includes('master') ||
                (lower.includes('branch.master') && !lower.includes('develop')) ||
                lower.includes('branch.main')
            ) { parsedConfig.master = value; }
            else if (lower.includes('develop') || lower.includes('branch.develop'))
                { parsedConfig.develop = value; }
            else if (lower.includes('feature'))
                { parsedConfig.feature = value; }
            else if (lower.includes('bugfix'))
                { parsedConfig.bugfix = value; }
            else if (lower.includes('release'))
                { parsedConfig.release = value; }
            else if (lower.includes('hotfix'))
                { parsedConfig.hotfix = value; }
            else if (lower.includes('support'))
                { parsedConfig.support = value; }
        }
        return {
            master: parsedConfig.master || '',
            develop: parsedConfig.develop || '',
            feature: parsedConfig.feature || '',
            bugfix: parsedConfig.bugfix || '',
            release: parsedConfig.release || '',
            hotfix: parsedConfig.hotfix || '',
            support: parsedConfig.support || '',
        };
    }

    isNotInitialized(output: string): boolean {
        return output.toLowerCase().includes('not a gitflow-enabled repo yet');
    }

    // ═══════════════════════════════════════════════════════════
    // Private helpers
    // ═══════════════════════════════════════════════════════════

    /**
     * Pick a branch from the context's listBranches filtered by prefix.
     * Returns the full branch name, or undefined if user cancels.
     */
    private async _pickBranch(ctx: OperationContext, prefix: string, title: string): Promise<string | undefined> {
        const branches = ctx.listBranches.filter(el => el.search(prefix) !== -1);
        if (branches.length === 0) {
            vscode.window.showWarningMessage(vscode.l10n.t('Could not find any {0}', this._ucf(prefix)));
            return undefined;
        }
        return vscode.window.showQuickPick(branches, { title });
    }

    private _ucf(string: string): string {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    /**
     * Extract flags from picked option strings like `[-F] Fetch from origin...`
     */
    private _parseOptionFlags(options: string[]): string {
        return options
            .map(el => {
                const m = el.match(/\[([^\]]*)\]/);
                return m === null ? '' : m[1];
            })
            .join(' ');
    }

    showCommands(): string {
        const config = vscode.workspace.getConfiguration('gitflow');
        return config.get('showAllCommands') === true ? ' --showcommands ' : ' ';
    }

    /**
     * Shared rebase logic for feature, bugfix, release, hotfix, and support.
     * The only variant-specific piece is how base candidates are selected;
     * passed as a callback that returns the chosen base or undefined on cancel.
     */
    private async _rebaseOp(
        type: string,
        node: Flow | undefined,
        ctx: OperationContext,
        prefix: string
    ): Promise<void> {
        const plog = `[${this.variant}]`;
        let branch = node?.full;
        if (branch === undefined) {
            const picked = await this._pickBranch(ctx, prefix, vscode.l10n.t('Select branch'));
            if (picked === undefined) { return; }
            branch = picked;
        }
        const name = branch.substring(branch.indexOf('/') + 1);
        this.logger.log(`${plog} Starting ${type} rebase for "${branch}"...`, `git flow ${type} rebase`, LogLevels.info);

        const options = await vscode.window.showQuickPick(
            [`[-i] ${vscode.l10n.t('Interactive rebase')}`, `[-p] ${vscode.l10n.t('Preserve merges')}`],
            { title: vscode.l10n.t('Select options'), canPickMany: true }
        );
        if (options === undefined) {
            this.logger.log(`${plog} ${this._ucf(type)} rebase cancelled by user`, '', LogLevels.info);
            return;
        }

        const flags = this._parseOptionFlags(options);

        const fn = (type === 'support'
            ? async () => {
                const root = ctx.listBranches.filter(el => el.split('/').length < 2);
                const tags = this.util
                    .execSync(`"${this.util.path}" tag --sort=-v:refname`)
                    .split('\n')
                    .map(el => el.trim().replace('* ', ''))
                    .filter(el => el !== '');
                return vscode.window.showQuickPick([...root, ...tags], {
                    title: vscode.l10n.t('Select base branch'),
                });
            }
            : async () => vscode.window.showQuickPick(
                ctx.listBranches.filter(el => el.split('/').length < 2),
                { title: vscode.l10n.t('Select base branch') }
            ));

        const base =  await fn();
        if (base === undefined) {
            this.logger.log(`${plog} ${this._ucf(type)} rebase cancelled by user`, '', LogLevels.info);
            return;
        }

        const cmd = `${this.util.flowPath} ${type} rebase${this.showCommands()}${flags} ${name} ${base}`;
        this.logger.log(`${plog} CMD: ${cmd}`, `git flow ${type} rebase`, LogLevels.info);
        this.util.exec(cmd, false, () => {
            this.logger.log(`${plog} ${this._ucf(type)} rebase completed`, '', LogLevels.info);
            ctx.onComplete();
        });
    }

    // ── Finish option lists ──────────────────────────────

    private async _getFinishOptions(what: string): Promise<string[] | undefined> {
        let list: string[] = [];
        switch (what) {
            case 'bugfix':
                list = [
                    `[-F] ${vscode.l10n.t('Fetch from origin before performing finish')}`,
                    `[-r] ${vscode.l10n.t('Rebase before merging')}`,
                    `[-p] ${vscode.l10n.t('Preserve merges while rebasing')}`,
                    `[-k] ${vscode.l10n.t('Keep branch after performing finish')}`,
                    `[--keepremote] ${vscode.l10n.t('Keep the remote branch')}`,
                    `[--keeplocal] ${vscode.l10n.t('Keep the local branch')}`,
                    `[-D] ${vscode.l10n.t('Force delete branch after finish')}`,
                    `[-S] ${vscode.l10n.t('Squash branch during merge')}`,
                    `[--no-ff] ${vscode.l10n.t('Never fast-forward during the merge')}`,
                ];
                break;
            case 'hotfix':
                list = [
                    `[-F] ${vscode.l10n.t('Fetch from origin before performing finish')}`,
                    `[-p] ${vscode.l10n.t('Push to origin after performing finish')}`,
                    `[-k] ${vscode.l10n.t('Keep branch after performing finish')}`,
                    `[--keepremote] ${vscode.l10n.t('Keep the remote branch')}`,
                    `[--keeplocal] ${vscode.l10n.t('Keep the local branch')}`,
                    `[-D] ${vscode.l10n.t('Force delete branch after finish')}`,
                    `[-n] ${vscode.l10n.t("Don't tag this hotfix")}`,
                    `[-b] ${vscode.l10n.t("Don't back-merge master, or tag if applicable, in develop")}`,
                    `[-S] ${vscode.l10n.t('Squash branch during merge')}`,
                ];
                break;
            case 'feature':
                list = [
                    `[-F] ${vscode.l10n.t('Fetch from origin before performing finish')}`,
                    `[-r] ${vscode.l10n.t('Rebase before merging')}`,
                    `[-p] ${vscode.l10n.t('Preserve merges while rebasing')}`,
                    `[--push] ${vscode.l10n.t('Push to origin after performing finish')}`,
                    `[-k] ${vscode.l10n.t('Keep branch after performing finish')}`,
                    `[--keepremote] ${vscode.l10n.t('Keep the remote branch')}`,
                    `[--keeplocal] ${vscode.l10n.t('Keep the local branch')}`,
                    `[-D] ${vscode.l10n.t('Force delete branch after finish')}`,
                    `[-S] ${vscode.l10n.t('Squash branch during merge')}`,
                    `[--no-ff] ${vscode.l10n.t('Never fast-forward during the merge')}`,
                ];
                break;
            case 'release':
                list = [
                    `[-F] ${vscode.l10n.t('Fetch from origin before performing finish')}`,
                    `[-p] ${vscode.l10n.t('Push to origin after performing finish')}`,
                    `[-D] ${vscode.l10n.t('Force delete branch after finish')}`,
                    `[--pushproduction] ${vscode.l10n.t('Push the production branch')}`,
                    `[--pushdevelop] ${vscode.l10n.t('Push the develop branch')}`,
                    `[--pushtag] ${vscode.l10n.t('Push the tag')}`,
                    `[-k] ${vscode.l10n.t('Keep branch after performing finish')}`,
                    `[--keepremote] ${vscode.l10n.t('Keep the remote branch')}`,
                    `[--keeplocal] ${vscode.l10n.t('Keep the local branch')}`,
                    `[-n] ${vscode.l10n.t("Don't tag this release")}`,
                    `[-b] ${vscode.l10n.t("Don't back-merge master, or tag if applicable, in develop")}`,
                    `[-S] ${vscode.l10n.t('Squash branch during merge')}`,
                    `[--ff-master] ${vscode.l10n.t('Fast forward master branch if possible')}`,
                    `[--nodevelopmerge] ${vscode.l10n.t("Don't back-merge develop branch")}`,
                ];
                break;
        }
        return vscode.window.showQuickPick(list, {
            title: vscode.l10n.t('Select delete options'),
            canPickMany: true,
        });
    }

    // ── Version bump helper ──────────────────────────────

    private _bumpVersion(ctx: OperationContext, name: string): void {
        const exist = existsSync(ctx.workspaceRoot + '/package.json');
        if (!exist) { return; }

        const config = vscode.workspace.getConfiguration('gitflow');
        const shouldBumpVersion = config.get('autoBumpVersion');
        if (!shouldBumpVersion) { return; }

        const version = this._getPkgVersion(ctx);
        if (version === '' || name === version || `${name}`.match(/^[0-9.]*$/) === null) { return; }

        writeFileSync(
            ctx.workspaceRoot + '/package.json',
            readFileSync(ctx.workspaceRoot + '/package.json', 'utf8').replace(version, `${name}`)
        );
        this.util.execSync(`"${this.util.path}" add ./package.json`);
        this.util.execSync(`"${this.util.path}" commit ./package.json -m "Version bump to ${name}"`);
    }

    // ── Changelog update helper ──────────────────────────

    private _updateChangelog(ctx: OperationContext, name: string): void {
        if (!existsSync(ctx.workspaceRoot + '/CHANGELOG.md')) { return; }

        let updated = false;
        let chc = `${readFileSync(ctx.workspaceRoot + '/CHANGELOG.md')}`;
        chc = chc.split('\n').map(el => {
            if (el.toLowerCase().includes('[unreleased]')) {
                const date = new Date();
                updated = true;
                el = el
                    .replace(/\[unreleased\]/i, `[${name}]`)
                    .replace(/\byyyy\b/i, `${date.getFullYear()}`)
                    .replace(/\bmm\b/i, `${date.getMonth() < 9 ? '0' : ''}${date.getMonth() + 1}`)
                    .replace(/\bdd\b/i, `${date.getDate() < 10 ? '0' : ''}${date.getDate()}`);
            }
            return el;
        }).join('\n');

        if (updated) {
            writeFileSync(ctx.workspaceRoot + '/CHANGELOG.md', chc);
            this.util.execSync(`"${this.util.path}" add ./CHANGELOG.md`);
            this.util.execSync(`"${this.util.path}" commit ./CHANGELOG.md -m "Update Changelog"`);
        }
    }

    // ── Pre-fill version for start dialogs ───────────────

    private _getPkgVersion(ctx: OperationContext): string {
        const exist = existsSync(ctx.workspaceRoot + '/package.json');
        if (!exist) { return ''; }
        return JSON.parse(readFileSync(ctx.workspaceRoot + '/package.json', 'utf8')).version || '';
    }

    private async _startOp(type: string, ctx: OperationContext): Promise<void> {
        const prefix = '[avh]';
        this.logger.log(`${prefix} Starting ${type} branch...`, `git flow ${type} start`, LogLevels.info);

        const version = type === 'release' || type === 'hotfix' ? this._getPkgVersion(ctx) : '';
        const name = await vscode.window.showInputBox({
            title: vscode.l10n.t('Enter a valid {0} branch name', this._ucf('release')),
            value: version,
        });
        if (name === undefined) {
            this.logger.log(`${prefix} ${this._ucf(type)} start cancelled by user`, '', LogLevels.info);
            return;
        }
        const config = vscode.workspace.getConfiguration('gitflow');
        const safeName = name.replace(/\s/g, config.get('replaceSymbol') || '_');
        const checked = this.util.execSync(`"${this.util.path}" check-ref-format --branch ${safeName}`).trim();
        if (checked !== safeName) {
            vscode.window.showErrorMessage(vscode.l10n.t('Error creating a branch: {0}', checked));
            return;
        }

        let base : string | undefined = '';
        if (ctx.curBranch.search(ctx.branches.support) !== -1 && type === 'release') {
            const b = await vscode.window.showQuickPick([vscode.l10n.t('Yes'), vscode.l10n.t('No')], {
                title: vscode.l10n.t('Start release based on {0}?', ctx.curBranch),
            }) || vscode.l10n.t('No');
            base = b === vscode.l10n.t('Yes') ? ctx.curBranch : '';
        }
        if (type === 'support') {
            base = await vscode.window.showQuickPick(
                this.util
                    .execSync(`"${this.util.path}" tag --sort=-v:refname`)
                    .split('\n')
                    .map(el => el.trim().replace('* ', ''))
                    .filter(el => el !== ''),
                { title: vscode.l10n.t('Start support branch based on a tag') }
            );
            if (base === undefined) {
                this.logger.log(`${prefix} Support start cancelled by user`, '', LogLevels.info);
                return;
            }
        }

        const cmd = `${this.util.flowPath} ${type} start${this.showCommands()}${safeName} ${base}`;
        this.logger.log(`${prefix} CMD: ${cmd}`, `git flow ${type} start`, LogLevels.info);

        this.util.exec(cmd, false, () => {
            this.logger.log(`${prefix} ${this._ucf(type)} start completed`, '', LogLevels.info);
            ctx.onComplete();
            vscode.commands.executeCommand('gitflow.refreshT');
            if(type === 'release' || type === 'hotfix') this._bumpVersion(ctx, safeName);
        });
    }

    private async _deleteOp(type: string, node: Flow | undefined, ctx: OperationContext): Promise<void> {
        const prefix = '[avh]';
        let branch = node?.full;
        if (branch === undefined) {
            const picked = await this._pickBranch(ctx, ctx.branches[type as keyof BranchConfig], vscode.l10n.t('Select branch'));
            if (picked === undefined) { return; }
            branch = picked;
        }
        const name = branch.substring(branch.indexOf('/') + 1);
        this.logger.log(`${prefix} Starting ${type} delete for "${branch}"...`, `git flow ${type} delete`, LogLevels.info);

        const forceDel = `[-f] ${vscode.l10n.t('Force deletion')}`;
        const remoteDel = `[-r] ${vscode.l10n.t('Delete remote branch')}`;
        const list: string[] = [forceDel];
        if (ctx.listRemoteBranches.includes(branch)) {
            list.push(remoteDel);
        }
        const options = await vscode.window.showQuickPick(list, {
            title: vscode.l10n.t('Select options'),
            canPickMany: true,
        });
        if (options === undefined) {
            this.logger.log(`${prefix} ${this._ucf(type)} delete cancelled by user`, '', LogLevels.info);
            return;
        }

        let progress = false;
        if (options.includes(remoteDel)) {
            progress = true;
        }
        const flags = this._parseOptionFlags(options);
        const cmd = `${this.util.flowPath} ${type} delete ${flags} ${name}`;

        if (type === 'support') {
            const option = options?.includes(forceDel) ? '-D' : '-d';
            this.util.execSync(`"${this.util.path}" checkout -d ${ctx.branches.develop}`);
            this.util.execSync(`"${this.util.path}" branch ${option} ${branch}`);

            if (options?.includes(remoteDel)) {
                this.util.exec(`"${this.util.path}" push --delete origin ${name}`, true, () => {
                    this.logger.log(`${prefix} Support delete completed`, '', LogLevels.info);
                    ctx.onComplete();
                });
                return;
            }
            ctx.onComplete();
        } else {
            this.logger.log(`${prefix} CMD: ${cmd}`, `git flow ${type} delete`, LogLevels.info);
            this.util.exec(cmd, progress, () => {
                this.logger.log(`${prefix} ${this._ucf(type)} delete completed`, '', LogLevels.info);
                ctx.onComplete();
            });
        }

    }

    private async _finishOp(type: string, node: Flow | undefined, ctx: OperationContext): Promise<void> {
        const prefix = '[avh]';
        let branch = node?.full;
        if (branch === undefined) {
            const picked = await this._pickBranch(ctx, ctx.branches[type as keyof BranchConfig], vscode.l10n.t('Select branch'));
            if (picked === undefined) { return; }
            branch = picked;
        }
        const name = branch.substring(branch.indexOf('/') + 1);
        this.logger.log(`${prefix} Starting ${type} finish for "${branch}"...`, `git flow ${type} finish`, LogLevels.info);

        const options = await this._getFinishOptions(type);
        if (options === undefined) {
            this.logger.log(`${prefix} ${this._ucf(type)} finish cancelled by user`, '', LogLevels.info);
            return;
        }

        let progress = false;
        if (
            ctx.listRemoteBranches.includes(branch) &&
            !options.includes(`[--keepremote] ${vscode.l10n.t('Keep the remote branch')}`)
        ) {
            progress = true;
        }

        let flags = this._parseOptionFlags(options);

        if (type === 'release' || type === 'hotfix') {
            // Tag message
            let msg = await vscode.window.showInputBox({
                title: vscode.l10n.t('Message'),
                value: vscode.l10n.t('Finish {0}: {1}', this._ucf(type), name),
            });
            if (msg === undefined) {
                this.logger.log(`${prefix} ${this._ucf(type)} finish cancelled by user`, '', LogLevels.info);
                return;
            }
            msg = `${msg}`.trim();
            if (msg === '') {
                msg = vscode.l10n.t('Finish {0}: {1}', this._ucf(type), name);
            }

            const tmpMsgFile = path.join(
                `${os.tmpdir()}`,
                `vscode-git-flow-${Math.floor(Math.random() * 10000000)}.msg`
            );
            writeFileSync(tmpMsgFile, msg, 'utf-8');
            flags = `${flags} -f ${tmpMsgFile} -T "${name}"`;

            // Changelog
            this._updateChangelog(ctx, name);
        }

        const cmd = `${this.util.flowPath} ${type} finish${this.showCommands()}${flags} ${name}`;
        this.logger.log(`${prefix} CMD: ${cmd}`, 'git flow ${type} finish', LogLevels.info);

        this.util.exec(cmd, progress, () => {
            this.logger.log(`${prefix} ${this._ucf(type)} finish completed`, '', LogLevels.info);
            ctx.onComplete();
            vscode.commands.executeCommand('gitflow.refreshT');
        });
    }

    // ═══════════════════════════════════════════════════════════
    // Feature
    // ═══════════════════════════════════════════════════════════

    async startFeature(ctx: OperationContext): Promise<void> {
        return this._startOp('feature', ctx);
    }

    async finishFeature(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        return this._finishOp('feature', node, ctx);
    }

    async deleteFeature(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        return this._deleteOp('feature', node, ctx);
    }

    async rebaseFeature(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        await this._rebaseOp('feature', node, ctx, ctx.branches.feature);
    }

    // ═══════════════════════════════════════════════════════════
    // Release
    // ═══════════════════════════════════════════════════════════

    async startRelease(ctx: OperationContext): Promise<void> {
        return this._startOp('release', ctx);
    }

    async finishRelease(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        return this._finishOp('release', node, ctx);
    }

    async deleteRelease(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        return this._deleteOp('release', node, ctx);
    }

    async rebaseRelease(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        await this._rebaseOp('release', node, ctx, ctx.branches.release);
    }

    // ═══════════════════════════════════════════════════════════
    // Hotfix
    // ═══════════════════════════════════════════════════════════

    async startHotfix(ctx: OperationContext): Promise<void> {
        return this._startOp('hotfix', ctx);
    }

    async finishHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        return this._finishOp('hotfix', node, ctx);
    }

    async deleteHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        return this._deleteOp('hotfix', node, ctx);
    }

    async rebaseHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        await this._rebaseOp('hotfix', node, ctx, ctx.branches.hotfix);
    }

    // ═══════════════════════════════════════════════════════════
    // Bugfix
    // ═══════════════════════════════════════════════════════════

    async startBugfix(ctx: OperationContext): Promise<void> {
        return this._startOp('bugfix', ctx);
    }

    async finishBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        return this._finishOp('bugfix', node, ctx);
    }

    async deleteBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        return this._deleteOp('bugfix', node, ctx);
    }

    async rebaseBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        await this._rebaseOp('bugfix', node, ctx, ctx.branches.bugfix);
    }

    // ═══════════════════════════════════════════════════════════
    // Support
    // ═══════════════════════════════════════════════════════════

    async startSupport(ctx: OperationContext): Promise<void> {
        return this._startOp('support', ctx);
    }
    async deleteSupport(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        return this._deleteOp('support', node, ctx);
    }
    async rebaseSupport(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        await this._rebaseOp('support', node, ctx, ctx.branches.support);
    }
}

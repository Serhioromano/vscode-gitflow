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

    private _showCommands(): string {
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
            ? async () => vscode.window.showQuickPick(
                ctx.listBranches.filter(el => el.split('/').length < 2),
                { title: vscode.l10n.t('Select base branch') }
            )
            : async () => {
                const root = ctx.listBranches.filter(el => el.split('/').length < 2);
                const tags = this.util
                    .execSync(`"${this.util.path}" tag --sort=-v:refname`)
                    .split('\n')
                    .map(el => el.trim().replace('* ', ''))
                    .filter(el => el !== '');
                return vscode.window.showQuickPick([...root, ...tags], {
                    title: vscode.l10n.t('Select base branch'),
                });
            });

        const base =  await fn();
        if (base === undefined) {
            this.logger.log(`${plog} ${this._ucf(type)} rebase cancelled by user`, '', LogLevels.info);
            return;
        }

        const cmd = `${this.util.flowPath} ${type} rebase${this._showCommands()}${flags} ${name} ${base}`;
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

    // ═══════════════════════════════════════════════════════════
    // Feature
    // ═══════════════════════════════════════════════════════════

    async startFeature(ctx: OperationContext): Promise<void> {
        const prefix = '[avh]';
        this.logger.log(`${prefix} Starting feature branch...`, 'git flow feature start', LogLevels.info);

        const name = await vscode.window.showInputBox({
            title: vscode.l10n.t('Enter a valid {0} branch name', this._ucf('feature')),
        });
        if (name === undefined) {
            this.logger.log(`${prefix} Feature start cancelled by user`, '', LogLevels.info);
            return;
        }

        const config = vscode.workspace.getConfiguration('gitflow');
        const safeName = name.replace(/\s/g, config.get('replaceSymbol') || '_');
        const checked = this.util.execSync(`"${this.util.path}" check-ref-format --branch ${safeName}`).trim();
        if (checked !== safeName) {
            vscode.window.showErrorMessage(vscode.l10n.t('Error creating a branch: {0}', checked));
            return;
        }

        const cmd = `${this.util.flowPath} feature start${this._showCommands()}${safeName}`;
        this.logger.log(`${prefix} CMD: ${cmd}`, 'git flow feature start', LogLevels.info);

        this.util.exec(cmd, false, () => {
            this.logger.log(`${prefix} Feature start completed`, '', LogLevels.info);
            ctx.onComplete();
        });
    }

    async finishFeature(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        const prefix = '[avh]';
        let branch = node?.full;
        if (branch === undefined) {
            const picked = await this._pickBranch(ctx, ctx.branches.feature, vscode.l10n.t('Select branch'));
            if (picked === undefined) { return; }
            branch = picked;
        }
        const name = branch.substring(branch.indexOf('/') + 1);
        this.logger.log(`${prefix} Starting feature finish for "${branch}"...`, 'git flow feature finish', LogLevels.info);

        const options = await this._getFinishOptions('feature');
        if (options === undefined) {
            this.logger.log(`${prefix} Feature finish cancelled by user`, '', LogLevels.info);
            return;
        }

        let progress = false;
        if (
            ctx.listRemoteBranches.includes(branch) &&
            !options.includes(`[--keepremote] ${vscode.l10n.t('Keep the remote branch')}`)
        ) {
            progress = true;
        }

        const flags = this._parseOptionFlags(options);
        const cmd = `${this.util.flowPath} feature finish${this._showCommands()}${flags} ${name}`;
        this.logger.log(`${prefix} CMD: ${cmd}`, 'git flow feature finish', LogLevels.info);

        this.util.exec(cmd, progress, () => {
            this.logger.log(`${prefix} Feature finish completed`, '', LogLevels.info);
            ctx.onComplete();
        });
    }

    async deleteFeature(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        const prefix = '[avh]';
        let branch = node?.full;
        if (branch === undefined) {
            const picked = await this._pickBranch(ctx, ctx.branches.feature, vscode.l10n.t('Select branch'));
            if (picked === undefined) { return; }
            branch = picked;
        }
        const name = branch.substring(branch.indexOf('/') + 1);
        this.logger.log(`${prefix} Starting feature delete for "${branch}"...`, 'git flow feature delete', LogLevels.info);

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
            this.logger.log(`${prefix} Feature delete cancelled by user`, '', LogLevels.info);
            return;
        }

        let progress = false;
        if (options.includes(remoteDel)) {
            progress = true;
        }
        const flags = this._parseOptionFlags(options);
        const cmd = `${this.util.flowPath} feature delete ${flags} ${name}`;
        this.logger.log(`${prefix} CMD: ${cmd}`, 'git flow feature delete', LogLevels.info);

        this.util.exec(cmd, progress, () => {
            this.logger.log(`${prefix} Feature delete completed`, '', LogLevels.info);
            ctx.onComplete();
        });
    }

    async rebaseFeature(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        await this._rebaseOp('feature', node, ctx, ctx.branches.feature);
    }

    // ═══════════════════════════════════════════════════════════
    // Release
    // ═══════════════════════════════════════════════════════════

    async startRelease(ctx: OperationContext): Promise<void> {
        const prefix = '[avh]';
        this.logger.log(`${prefix} Starting release branch...`, 'git flow release start', LogLevels.info);

        let version = this._getPkgVersion(ctx);
        const name = await vscode.window.showInputBox({
            title: vscode.l10n.t('Enter a valid {0} branch name', this._ucf('release')),
            value: version,
        });
        if (name === undefined) {
            this.logger.log(`${prefix} Release start cancelled by user`, '', LogLevels.info);
            return;
        }

        const config = vscode.workspace.getConfiguration('gitflow');
        const safeName = name.replace(/\s/g, config.get('replaceSymbol') || '_');
        const checked = this.util.execSync(`"${this.util.path}" check-ref-format --branch ${safeName}`).trim();
        if (checked !== safeName) {
            vscode.window.showErrorMessage(vscode.l10n.t('Error creating a branch: {0}', checked));
            return;
        }

        let base = '';
        if (ctx.curBranch.search(ctx.branches.support) !== -1) {
            const b = await vscode.window.showQuickPick([vscode.l10n.t('Yes'), vscode.l10n.t('No')], {
                title: vscode.l10n.t('Start release based on {0}?', ctx.curBranch),
            }) || vscode.l10n.t('No');
            base = b === vscode.l10n.t('Yes') ? ctx.curBranch : '';
        }

        const cmd = `${this.util.flowPath} release start${this._showCommands()}${safeName} ${base}`;
        this.logger.log(`${prefix} CMD: ${cmd}`, 'git flow release start', LogLevels.info);

        this.util.exec(cmd, false, () => {
            this.logger.log(`${prefix} Release start completed`, '', LogLevels.info);
            ctx.onComplete();
            vscode.commands.executeCommand('gitflow.refreshT');
            this._bumpVersion(ctx, safeName);
        });
    }

    async finishRelease(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        const prefix = '[avh]';
        let branch = node?.full;
        if (branch === undefined) {
            const picked = await this._pickBranch(ctx, ctx.branches.release, vscode.l10n.t('Select branch'));
            if (picked === undefined) { return; }
            branch = picked;
        }
        const name = branch.substring(branch.indexOf('/') + 1);
        this.logger.log(`${prefix} Starting release finish for "${branch}"...`, 'git flow release finish', LogLevels.info);

        const options = await this._getFinishOptions('release');
        if (options === undefined) {
            this.logger.log(`${prefix} Release finish cancelled by user`, '', LogLevels.info);
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

        // Tag message
        let msg = await vscode.window.showInputBox({
            title: vscode.l10n.t('Message'),
            value: vscode.l10n.t('Finish {0}: {1}', this._ucf('release'), name),
        });
        if (msg === undefined) {
            this.logger.log(`${prefix} Release finish cancelled by user`, '', LogLevels.info);
            return;
        }
        msg = `${msg}`.trim();
        if (msg === '') {
            msg = vscode.l10n.t('Finish {0}: {1}', this._ucf('release'), name);
        }

        const tmpMsgFile = path.join(
            `${os.tmpdir()}`,
            `vscode-git-flow-${Math.floor(Math.random() * 10000000)}.msg`
        );
        writeFileSync(tmpMsgFile, msg, 'utf-8');
        flags = `${flags} -f ${tmpMsgFile} -T "${name}"`;

        // Changelog
        this._updateChangelog(ctx, name);

        const cmd = `${this.util.flowPath} release finish${this._showCommands()}${flags} ${name}`;
        this.logger.log(`${prefix} CMD: ${cmd}`, 'git flow release finish', LogLevels.info);

        this.util.exec(cmd, progress, () => {
            this.logger.log(`${prefix} Release finish completed`, '', LogLevels.info);
            ctx.onComplete();
            vscode.commands.executeCommand('gitflow.refreshT');
        });
    }

    async deleteRelease(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        const prefix = '[avh]';
        let branch = node?.full;
        if (branch === undefined) {
            const picked = await this._pickBranch(ctx, ctx.branches.release, vscode.l10n.t('Select branch'));
            if (picked === undefined) { return; }
            branch = picked;
        }
        const name = branch.substring(branch.indexOf('/') + 1);
        this.logger.log(`${prefix} Starting release delete for "${branch}"...`, 'git flow release delete', LogLevels.info);

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
            this.logger.log(`${prefix} Release delete cancelled by user`, '', LogLevels.info);
            return;
        }

        let progress = false;
        if (options.includes(remoteDel)) {
            progress = true;
        }
        const flags = this._parseOptionFlags(options);
        const cmd = `${this.util.flowPath} release delete ${flags} ${name}`;
        this.logger.log(`${prefix} CMD: ${cmd}`, 'git flow release delete', LogLevels.info);

        this.util.exec(cmd, progress, () => {
            this.logger.log(`${prefix} Release delete completed`, '', LogLevels.info);
            ctx.onComplete();
        });
    }

    async rebaseRelease(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        await this._rebaseOp('release', node, ctx, ctx.branches.release);
    }

    // ═══════════════════════════════════════════════════════════
    // Hotfix
    // ═══════════════════════════════════════════════════════════

    async startHotfix(ctx: OperationContext): Promise<void> {
        const prefix = '[avh]';
        this.logger.log(`${prefix} Starting hotfix branch...`, 'git flow hotfix start', LogLevels.info);

        let version = this._getPkgVersion(ctx);
        const name = await vscode.window.showInputBox({
            title: vscode.l10n.t('Enter a valid {0} branch name', this._ucf('hotfix')),
            value: version,
        });
        if (name === undefined) {
            this.logger.log(`${prefix} Hotfix start cancelled by user`, '', LogLevels.info);
            return;
        }

        const config = vscode.workspace.getConfiguration('gitflow');
        const safeName = name.replace(/\s/g, config.get('replaceSymbol') || '_');
        const checked = this.util.execSync(`"${this.util.path}" check-ref-format --branch ${safeName}`).trim();
        if (checked !== safeName) {
            vscode.window.showErrorMessage(vscode.l10n.t('Error creating a branch: {0}', checked));
            return;
        }

        const cmd = `${this.util.flowPath} hotfix start${this._showCommands()}${safeName}`;
        this.logger.log(`${prefix} CMD: ${cmd}`, 'git flow hotfix start', LogLevels.info);

        this.util.exec(cmd, false, () => {
            this.logger.log(`${prefix} Hotfix start completed`, '', LogLevels.info);
            ctx.onComplete();
            vscode.commands.executeCommand('gitflow.refreshT');
            this._bumpVersion(ctx, safeName);
        });
    }

    async finishHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        const prefix = '[avh]';
        let branch = node?.full;
        if (branch === undefined) {
            const picked = await this._pickBranch(ctx, ctx.branches.hotfix, vscode.l10n.t('Select branch'));
            if (picked === undefined) { return; }
            branch = picked;
        }
        const name = branch.substring(branch.indexOf('/') + 1);
        this.logger.log(`${prefix} Starting hotfix finish for "${branch}"...`, 'git flow hotfix finish', LogLevels.info);

        const options = await this._getFinishOptions('hotfix');
        if (options === undefined) {
            this.logger.log(`${prefix} Hotfix finish cancelled by user`, '', LogLevels.info);
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

        // Tag message
        let msg = await vscode.window.showInputBox({
            title: vscode.l10n.t('Message'),
            value: vscode.l10n.t('Finish {0}: {1}', this._ucf('hotfix'), name),
        });
        if (msg === undefined) {
            this.logger.log(`${prefix} Hotfix finish cancelled by user`, '', LogLevels.info);
            return;
        }
        msg = `${msg}`.trim();
        if (msg === '') {
            msg = vscode.l10n.t('Finish {0}: {1}', this._ucf('hotfix'), name);
        }

        const tmpMsgFile = path.join(
            `${os.tmpdir()}`,
            `vscode-git-flow-${Math.floor(Math.random() * 10000000)}.msg`
        );
        writeFileSync(tmpMsgFile, msg, 'utf-8');
        flags = `${flags} -f ${tmpMsgFile} -T "${name}"`;

        // Changelog
        this._updateChangelog(ctx, name);

        const cmd = `${this.util.flowPath} hotfix finish${this._showCommands()}${flags} ${name}`;
        this.logger.log(`${prefix} CMD: ${cmd}`, 'git flow hotfix finish', LogLevels.info);

        this.util.exec(cmd, progress, () => {
            this.logger.log(`${prefix} Hotfix finish completed`, '', LogLevels.info);
            ctx.onComplete();
            vscode.commands.executeCommand('gitflow.refreshT');
        });
    }

    async deleteHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        const prefix = '[avh]';
        let branch = node?.full;
        if (branch === undefined) {
            const picked = await this._pickBranch(ctx, ctx.branches.hotfix, vscode.l10n.t('Select branch'));
            if (picked === undefined) { return; }
            branch = picked;
        }
        const name = branch.substring(branch.indexOf('/') + 1);
        this.logger.log(`${prefix} Starting hotfix delete for "${branch}"...`, 'git flow hotfix delete', LogLevels.info);

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
            this.logger.log(`${prefix} Hotfix delete cancelled by user`, '', LogLevels.info);
            return;
        }

        let progress = false;
        if (options.includes(remoteDel)) {
            progress = true;
        }
        const flags = this._parseOptionFlags(options);
        const cmd = `${this.util.flowPath} hotfix delete ${flags} ${name}`;
        this.logger.log(`${prefix} CMD: ${cmd}`, 'git flow hotfix delete', LogLevels.info);

        this.util.exec(cmd, progress, () => {
            this.logger.log(`${prefix} Hotfix delete completed`, '', LogLevels.info);
            ctx.onComplete();
        });
    }

    async rebaseHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        await this._rebaseOp('hotfix', node, ctx, ctx.branches.hotfix);
    }

    // ═══════════════════════════════════════════════════════════
    // Bugfix
    // ═══════════════════════════════════════════════════════════

    async startBugfix(ctx: OperationContext): Promise<void> {
        const prefix = '[avh]';
        this.logger.log(`${prefix} Starting bugfix branch...`, 'git flow bugfix start', LogLevels.info);

        const name = await vscode.window.showInputBox({
            title: vscode.l10n.t('Enter a valid {0} branch name', this._ucf('bugfix')),
        });
        if (name === undefined) {
            this.logger.log(`${prefix} Bugfix start cancelled by user`, '', LogLevels.info);
            return;
        }

        const config = vscode.workspace.getConfiguration('gitflow');
        const safeName = name.replace(/\s/g, config.get('replaceSymbol') || '_');
        const checked = this.util.execSync(`"${this.util.path}" check-ref-format --branch ${safeName}`).trim();
        if (checked !== safeName) {
            vscode.window.showErrorMessage(vscode.l10n.t('Error creating a branch: {0}', checked));
            return;
        }

        const cmd = `${this.util.flowPath} bugfix start${this._showCommands()}${safeName}`;
        this.logger.log(`${prefix} CMD: ${cmd}`, 'git flow bugfix start', LogLevels.info);

        this.util.exec(cmd, false, () => {
            this.logger.log(`${prefix} Bugfix start completed`, '', LogLevels.info);
            ctx.onComplete();
        });
    }

    async finishBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        const prefix = '[avh]';
        let branch = node?.full;
        if (branch === undefined) {
            const picked = await this._pickBranch(ctx, ctx.branches.bugfix, vscode.l10n.t('Select branch'));
            if (picked === undefined) { return; }
            branch = picked;
        }
        const name = branch.substring(branch.indexOf('/') + 1);
        this.logger.log(`${prefix} Starting bugfix finish for "${branch}"...`, 'git flow bugfix finish', LogLevels.info);

        const options = await this._getFinishOptions('bugfix');
        if (options === undefined) {
            this.logger.log(`${prefix} Bugfix finish cancelled by user`, '', LogLevels.info);
            return;
        }

        let progress = false;
        if (
            ctx.listRemoteBranches.includes(branch) &&
            !options.includes(`[--keepremote] ${vscode.l10n.t('Keep the remote branch')}`)
        ) {
            progress = true;
        }

        const flags = this._parseOptionFlags(options);
        const cmd = `${this.util.flowPath} bugfix finish${this._showCommands()}${flags} ${name}`;
        this.logger.log(`${prefix} CMD: ${cmd}`, 'git flow bugfix finish', LogLevels.info);

        this.util.exec(cmd, progress, () => {
            this.logger.log(`${prefix} Bugfix finish completed`, '', LogLevels.info);
            ctx.onComplete();
        });
    }

    async deleteBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        const prefix = '[avh]';
        let branch = node?.full;
        if (branch === undefined) {
            const picked = await this._pickBranch(ctx, ctx.branches.bugfix, vscode.l10n.t('Select branch'));
            if (picked === undefined) { return; }
            branch = picked;
        }
        const name = branch.substring(branch.indexOf('/') + 1);
        this.logger.log(`${prefix} Starting bugfix delete for "${branch}"...`, 'git flow bugfix delete', LogLevels.info);

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
            this.logger.log(`${prefix} Bugfix delete cancelled by user`, '', LogLevels.info);
            return;
        }

        let progress = false;
        if (options.includes(remoteDel)) {
            progress = true;
        }
        const flags = this._parseOptionFlags(options);
        const cmd = `${this.util.flowPath} bugfix delete ${flags} ${name}`;
        this.logger.log(`${prefix} CMD: ${cmd}`, 'git flow bugfix delete', LogLevels.info);

        this.util.exec(cmd, progress, () => {
            this.logger.log(`${prefix} Bugfix delete completed`, '', LogLevels.info);
            ctx.onComplete();
        });
    }

    async rebaseBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        await this._rebaseOp('bugfix', node, ctx, ctx.branches.bugfix);
    }

    // ═══════════════════════════════════════════════════════════
    // Support
    // ═══════════════════════════════════════════════════════════

    async startSupport(ctx: OperationContext): Promise<void> {
        const prefix = '[avh]';
        this.logger.log(`${prefix} Starting support branch...`, 'git flow support start', LogLevels.info);

        const name = await vscode.window.showInputBox({
            title: vscode.l10n.t('Enter a valid {0} branch name', this._ucf('support')),
        });
        if (name === undefined) {
            this.logger.log(`${prefix} Support start cancelled by user`, '', LogLevels.info);
            return;
        }

        const config = vscode.workspace.getConfiguration('gitflow');
        const safeName = name.replace(/\s/g, config.get('replaceSymbol') || '_');
        const checked = this.util.execSync(`"${this.util.path}" check-ref-format --branch ${safeName}`).trim();
        if (checked !== safeName) {
            vscode.window.showErrorMessage(vscode.l10n.t('Error creating a branch: {0}', checked));
            return;
        }

        const base = await vscode.window.showQuickPick(
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

        const cmd = `${this.util.flowPath} support start${this._showCommands()}${safeName} ${base}`;
        this.logger.log(`${prefix} CMD: ${cmd}`, 'git flow support start', LogLevels.info);

        this.util.exec(cmd, false, () => {
            this.logger.log(`${prefix} Support start completed`, '', LogLevels.info);
            ctx.onComplete();
        });
    }

    async deleteSupport(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        const prefix = '[avh]';
        let branch = node?.full;
        if (branch === undefined) {
            const picked = await this._pickBranch(ctx, ctx.branches.support, vscode.l10n.t('Select support'));
            if (picked === undefined) { return; }
            branch = picked;
        }
        const name = branch;
        this.logger.log(`${prefix} Starting support delete for "${name}"...`, 'git flow support delete', LogLevels.info);

        const sForceDel = `[-f] ${vscode.l10n.t('Force deletion')}`;
        const sRemoteDel = `[-r] ${vscode.l10n.t('Delete remote branch')}`;
        const list: string[] = [sForceDel];
        if (ctx.listRemoteBranches.includes(name)) {
            list.push(sRemoteDel);
        }
        const options = await vscode.window.showQuickPick(list, {
            title: vscode.l10n.t('Select options'),
            canPickMany: true,
        });
        if (options === undefined) {
            this.logger.log(`${prefix} Support delete cancelled by user`, '', LogLevels.info);
            return;
        }
        const option = options?.includes(sForceDel) ? '-D' : '-d';

        this.util.execSync(`"${this.util.path}" checkout -d ${ctx.branches.develop}`);
        this.util.execSync(`"${this.util.path}" branch ${option} ${name}`);

        if (options?.includes(sRemoteDel)) {
            this.util.exec(`"${this.util.path}" push --delete origin ${name}`, true, () => {
                this.logger.log(`${prefix} Support delete completed`, '', LogLevels.info);
                ctx.onComplete();
            });
            return;
        }

        this.logger.log(`${prefix} Support delete completed`, '', LogLevels.info);
        ctx.onComplete();
    }
    async rebaseSupport(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        await this._rebaseOp('support', node, ctx, ctx.branches.support);
    }
}

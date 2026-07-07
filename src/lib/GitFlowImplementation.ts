import * as vscode from 'vscode';
import { Util } from './Util';
import { Logger, LogLevels } from './logger';
import { Flow } from '../ViewBranches';

export interface BranchConfig {
    master: string;
    develop: string;
    feature: string;
    bugfix: string;
    release: string;
    hotfix: string;
    support: string;
}

/**
 * Read-only context passed to every operation method.
 * Provides access to ViewBranches state without coupling to its internals.
 */
export interface OperationContext {
    listBranches: string[];
    listRemoteBranches: string[];
    curBranch: string;
    branches: BranchConfig;
    hasOrigin: boolean;
    workspaceRoot: string;
    /** Call after the operation completes to refresh the tree view */
    onComplete: () => void;
}

export abstract class GitFlowImplementation {
    constructor(
        protected util: Util,
        protected logger: Logger
    ) {}

    abstract get variant(): 'avh' | 'next';

    // ── Config / detection ───────────────────────────────
    abstract parseConfigList(output: string): BranchConfig;
    abstract isNotInitialized(output: string): boolean;

    // ── Feature ──────────────────────────────────────────
    abstract startFeature(ctx: OperationContext): Promise<void>;
    abstract finishFeature(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract deleteFeature(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract rebaseFeature(node: Flow | undefined, ctx: OperationContext): Promise<void>;

    // ── Release ──────────────────────────────────────────
    abstract startRelease(ctx: OperationContext): Promise<void>;
    abstract finishRelease(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract deleteRelease(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract rebaseRelease(node: Flow | undefined, ctx: OperationContext): Promise<void>;

    // ── Hotfix ───────────────────────────────────────────
    abstract startHotfix(ctx: OperationContext): Promise<void>;
    abstract finishHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract deleteHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract rebaseHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void>;

    // ── Bugfix ───────────────────────────────────────────
    abstract startBugfix(ctx: OperationContext): Promise<void>;
    abstract finishBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract deleteBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract rebaseBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void>;

    // ── Support ──────────────────────────────────────────
    abstract startSupport(ctx: OperationContext): Promise<void>;
    abstract deleteSupport(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract rebaseSupport(node: Flow | undefined, ctx: OperationContext): Promise<void>;
}

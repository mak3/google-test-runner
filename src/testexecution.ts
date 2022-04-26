import * as vscode from 'vscode';
import * as cfg from './configuration';
import { ProcessHandler, startProcess } from './system';
import { logInfo, logDebug, logError } from './logger';
import { buildTests } from './testbuild';
import { evaluateTestResult } from './testevaluation';
import { RunTask } from './system';
import { RunEnvironment } from './testrun';
import { getTargetFileForDocument, lastPathOfDocumentUri } from './utils';

export function runTests(runEnvironment: RunEnvironment, onTestFileExecuted: (item: vscode.TestItem) => void, onTestFileFailed: (item: vscode.TestItem) => void) {
    runEnvironment.leafItemsByRootItem.forEach((leafItems, rootItem) => {
        const rootItemUri = rootItem.uri!;
        const targetFile = getTargetFileForDocument(rootItemUri);
        const filter = createRunFilter(leafItems);
        const baseName = lastPathOfDocumentUri(rootItemUri);
        const jsonResultFile = `test_detail_for_${baseName}`;
        const cmd = `cd ${cfg.getBuildFolder()} && ${targetFile} --gtest_filter=${filter} --gtest_output=json:${jsonResultFile}`;

        let handlers: ProcessHandler = {
            onDone: (code) => onTestFileExecuted(rootItem),
            onData: logDebug,
            onError: (code) => onTestFileFailed(rootItem)
        }
        const executionTask = startProcess(cmd, handlers);
        runEnvironment.runTasks.push(executionTask);
    });
}

function createRunFilter(items: vscode.TestItem[]) {
    let filter = '';
    items.forEach(item => {
        if (!item.parent) {
            filter = '*';
            logDebug(`No filter for ${item.id} needed`);
            return;
        }
        if (item.children.size > 1 && item.parent) {
            const fixtureFilter = item.id + '*:';
            filter += fixtureFilter;
            logDebug(`Adding fixture filter ${fixtureFilter} for item ${item.id}.Current filter is ${filter} `);
            return;
        }

        if (item.parent && !item.parent.parent) {
            const testCaseFilter = item.id + ':';
            filter += testCaseFilter;
            logDebug(`Adding testcase filter ${testCaseFilter} for item ${item.id}.Current filter is ${filter} `);
            return;
        }

        if (item.parent && item.parent.parent) {
            const testCaseFilter = item.id + ':';
            filter += testCaseFilter;
            logDebug(`Adding testcase filter ${testCaseFilter} for item ${item.id}.Current filter is ${filter} `);
        }
    });
    return filter;
}

// function onTestTargetRunFailed(code: number, targetFile: string, runsCompletedEmitter: vscode.EventEmitter<void>) {
//     logError(`Test run for target file ${targetFile} failed with code ${code}`);
//     runsCompletedEmitter.fire();
// }

// function onAllRunsCompleted(run: vscode.TestRun) {
//     run.end();
//     logInfo('All test runs completed.');
// }
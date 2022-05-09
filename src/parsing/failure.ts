import * as vscode from 'vscode';
import * as rj from '../parsing/resultjson';
import { logInfo, logDebug } from '../utils/logger';
import { none, Option, some } from 'fp-ts/lib/Option';
import { pipe } from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option'

const assertTrueFalseRegex = /Value of/g;
const expectRegex = /Expected:/g;
const valueExpectRegex = /Expected equality of these values:/g;
const expectedRegex = /^\s+.+\n?(?:\s+Which is.*\n?)?/gm;

const msgParamsForAssertTrueExpectation = (item: vscode.TestItem, failureMessage: string, failure: rj.TestFailure): DiffMessageParams => {
    const splitted = failureMessage.split('\n');
    const expectedTerm = splitted[1].trim();
    const actual = splitted[2].replace('Actual:', '').trim();
    const expected = splitted[3].replace('Expected:', '').trim();
    return { item: item, expectedTerm: expectedTerm, expected: expected, actual: actual, lineNo: failure.lineNo };
}

const msgParamsForExpectation = (item: vscode.TestItem, failureMessage: string, failure: rj.TestFailure): DiffMessageParams => {
    const splitted = failureMessage.split('\n');
    const expectedTerm = splitted[1].trim();
    const subSplit = expectedTerm.split(', actual:');
    const expected = subSplit[0].replace('Expected:', '').trim();
    const actual = subSplit[1].trim();
    return { item: item, expectedTerm: expectedTerm, expected: expected, actual: actual, lineNo: failure.lineNo };
}

const msgParamsForValueExpectation = (item: vscode.TestItem, failureMessage: string, failure: rj.TestFailure): DiffMessageParams => {
    const m = [...failureMessage.matchAll(expectedRegex)];
    const expected = removeNewLineAndTrim(m[0].toString())
    const actual = removeNewLineAndTrim(m[1].toString())
    return { item: item, expectedTerm: 'Expected equality of these values:', expected: expected, actual: actual, lineNo: failure.lineNo };
}

const diffMsgParamsByRegex = new Map<RegExp, (item: vscode.TestItem, failureMessage: string, failure: rj.TestFailure) => DiffMessageParams>([
    [assertTrueFalseRegex, msgParamsForAssertTrueExpectation],
    [valueExpectRegex, msgParamsForValueExpectation],
    [expectRegex, msgParamsForExpectation],
]);

type DiffMessageParams = {
    item: vscode.TestItem;
    expectedTerm: string;
    expected: string;
    actual: string;
    lineNo: number;
}

export const createFailureMessage = (item: vscode.TestItem, failure: rj.TestFailure): vscode.TestMessage => {
    let failureMessage = failure.message;
    return pipe(
        maybeDiffMessage(item, failureMessage, failure),
        O.getOrElse(() => {
            if (failure.param) {
                failureMessage += '\n' + `Failure parameter: ${failure.param} `;
            }
            const failureMessageForDocument = createFailureMessageForDocument(item, failureMessage, failure);
            return failureMessageForDocument;
        })
    )
}

const maybeDiffMessage = (item: vscode.TestItem, failureMessage: string, failure: rj.TestFailure): Option<vscode.TestMessage> => {
    for (let [regex, msgCreator] of diffMsgParamsByRegex) {
        if (failureMessage.match(regex) != null) {
            const msgParams = msgCreator(item, failureMessage, failure);
            return some(createFailureMessageWithDiff(msgParams));
        }
    }
    return none;
}

const createFailureMessageForDocument = (item: vscode.TestItem, failureMessage: string, failure: rj.TestFailure): vscode.TestMessage => {
    const message = new vscode.TestMessage(failureMessage.substring(failureMessage.indexOf("\n") + 1));
    const lineNo = failure.lineNo;
    message.location = new vscode.Location(item.uri!, new vscode.Position(lineNo, 0));
    return message;
}

const createFailureMessageWithDiff = (diffMessageParams: DiffMessageParams): vscode.TestMessage => {
    const message = vscode.TestMessage.diff(`${diffMessageParams.expectedTerm}`, String(diffMessageParams.expected), String(diffMessageParams.actual));
    message.location = new vscode.Location(diffMessageParams.item.uri!, new vscode.Position(diffMessageParams.lineNo, 0));
    return message;
}

const removeNewLineAndTrim = (str: string): string => {
    return str.replace(/\s+/g, ' ').trim();
}
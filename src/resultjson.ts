import * as vscode from 'vscode';
import { logDebug } from './utils/logger';

export type TestFailure =
    {
        message: string;
        lineNo: number;
        param: string | undefined;
    }

export type TestReport =
    {
        name: string;
        fixture: string;
        id: string;
        parameter: string | undefined;
        line: number;
        timestamp: string;
        file: string;
        hasPassed: boolean;
        failures: TestFailure[];
    }

export async function createTestReportById(resultJSONUri: vscode.Uri) {
    const parsedJSON = await parse(resultJSONUri);

    const testReportById = createTestReports(parsedJSON);
    testReportById.forEach((reports, id) => {
        logDebug(`Testreport with id ${id} passed ${reports[0].hasPassed}`);
    });

    return testReportById;
}

async function parse(resultJSONUri: vscode.Uri) {
    const jsonResultRaw = await vscode.workspace.fs.readFile(resultJSONUri);
    const jsonResult = jsonResultRaw.toString();
    return JSON.parse(jsonResult);
}

function createTestReports(parsedJSON: any) {
    let testReportById = new Map<string, TestReport[]>();
    mapJSONArray(parsedJSON.testsuites, testSuiteJSON => {
        logDebug(`Processing testSuiteJSON ${testSuiteJSON.name}`);
        mapJSONArray(testSuiteJSON.testsuite, testCaseJSON => processTestCaseJSON(testCaseJSON, testReportById));
    });
    return testReportById;
}

function processTestCaseJSON(testCaseJSON: any, testReportById: Map<string, TestReport[]>) {
    const testReport = createTestReport(testCaseJSON);
    let currentTestReports = testReportById.get(testReport.id);
    if (!currentTestReports) {
        currentTestReports = [];
    }
    currentTestReports.push(testReport);
    testReportById.set(testReport.id, currentTestReports);
}

function createTestReport(testCaseJSON: any) {
    const parameter = parameterOfTestCaseJSON(testCaseJSON);
    const failures = failuresOfTestCaseJSON(testCaseJSON, parameter);
    const testReport: TestReport =
    {
        name: testCaseJSON.name,
        fixture: testCaseJSON.fixture,
        id: testCaseId(testCaseJSON),
        parameter: parameter,
        line: testCaseJSON.line,
        timestamp: testCaseJSON.timestamp,
        file: testCaseJSON.file,
        hasPassed: failures.length === 0,
        failures: failuresOfTestCaseJSON(testCaseJSON, parameter)
    }
    return testReport;
}

function parameterOfTestCaseJSON(testCaseJSON: any) {
    if (testCaseJSON.value_param) {
        return testCaseJSON.value_param;
    }
    else if (testCaseJSON.type_param) {
        return testCaseJSON.type_param;
    }
    return undefined;
}

function failuresOfTestCaseJSON(testCaseJSON: any, parameter: any) {
    if (testCaseJSON.failures) {
        return fillFailures(testCaseJSON.failures, parameter);
    }
    return [];
}

function fillFailures(failuresJSON: Array<any>, paramName: string): TestFailure[] {
    return mapJSONArray(failuresJSON, failureJSON => {
        const testFailure: TestFailure =
        {
            message: failureJSON.failure,
            lineNo: lineNumberFromFailureMessage(failureJSON.failure),
            param: paramName
        }
        return testFailure;
    });
}

function mapJSONArray<T>(jsonArray: Array<any>, handler: (item: any) => T) {
    let resultArray: T[] = [];
    for (let i = 0; i < jsonArray.length; i++) {
        const mapResult = handler(jsonArray[i]);
        resultArray.push(mapResult);
    }
    return resultArray;
}

function testCaseId(testcase: any) {
    const testCaseName: string = testcase.name;
    const fixtureName: string = testcase.classname;

    if (testcase.type_param) {
        //Typed test
        const fixtureNameWildCard = fixtureName.match(/\w+\/(\w+\/)?/)![0];
        return fixtureNameWildCard + "*." + testCaseName;
    }
    if (testcase.value_param) {
        //Typed test#
        const fixtureNameWildCard = fixtureName.match(/\w+\/\w+/);
        const testCaseNameWildCard = testCaseName.match(/\w+\//);
        return fixtureNameWildCard + "." + testCaseNameWildCard + '*';
    }
    return fixtureName + "." + testCaseName;
}

function lineNumberFromFailureMessage(failureMessage: string) {
    let lineNoRegex = /^.+\:(\d+)/;
    let lineNoMatch = lineNoRegex.exec(failureMessage)!;
    return Number(lineNoMatch[1]) - 1;
}
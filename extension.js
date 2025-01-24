const vscode = require('vscode');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');


function cleanOutput(rawOutput) {
    let cleanedArray = rawOutput
        .split(/\b[a-zA-Z_]+\s*=\s*/) 
        .filter(part => part.trim() !== "") 
        .map(part => part.trim()) 
        .map(part => part
            .replace(/"/g, '') 
            .replace(/[\[\]]/g, '') 
            .replace(/,/g, ' ') 
        );

    let cleaned = cleanedArray.join('\n');
    return cleaned;
}


function cleanInput(rawInput) {
    let cleanedArray = rawInput
        .split(/\b[a-zA-Z_]+\s*=\s*/) 
        .filter(part => part.trim() !== "") 
        .map(part => part.trim()); 

    let finalCleanedArray = [];
    cleanedArray.forEach(part => {
        let cleanedPart = part
            .replace(/"/g, '') 
            .replace(/[\[\]]/g, '') 
            .replace(/,/g, ' '); 
        if (part.includes('[') && part.includes(']')) {
            let elements = cleanedPart.split(/\s+/).filter(el => el !== "");
            if (elements.length > 0) { 
                finalCleanedArray.push(elements.length + " " + elements.join(' ')); 
            }
            else{
                finalCleanedArray.push("0")
            }
        } else {
            finalCleanedArray.push(cleanedPart); 
        }
    });

    let cleaned = finalCleanedArray.join('\n');
    return cleaned;
}


async function fetchTestCases() {
    const url = await vscode.window.showInputBox({
        prompt: 'Enter LeetCode problem URL',
        placeHolder: 'https://leetcode.com/problems/two-sum/description/'
    });

    if (!url) {
        vscode.window.showErrorMessage('No URL provided.');
        return;
    }

    try {
        const testCases = await getTestCasesFromLeetCode(url);
        const cleanedInputscpp = testCases.inputs.map(cleanInput);
        const cleanedInputspy = testCases.inputs.map(cleanOutput);
        const cleanedOutputs = testCases.outputs.map(cleanOutput);
        const workspaceFolder = vscode.workspace.workspaceFolders
            ? vscode.workspace.workspaceFolders[0].uri.fsPath
            : null;

        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Please open a workspace folder to save the test cases.');
            return;
        }
        const testDataFolder = path.join(workspaceFolder, 'TestData');
        const inputsFolder = path.join(testDataFolder);
        const outputsFolder = path.join(testDataFolder);

        [testDataFolder, inputsFolder, outputsFolder].forEach(folder => {
            if (!fs.existsSync(folder)) {
                fs.mkdirSync(folder, { recursive: true });
            }
        });
        cleanedInputscpp.forEach((input, index) => {
            const inputFile = path.join(inputsFolder, `inputcpp_${index + 1}.txt`);
            fs.writeFileSync(inputFile, input, 'utf8');
        });
        cleanedInputspy.forEach((input, index) => {
            const inputFile = path.join(inputsFolder, `inputpy_${index + 1}.txt`);
            fs.writeFileSync(inputFile, input, 'utf8');
        });

        cleanedOutputs.forEach((output, index) => {
            const outputFile = path.join(outputsFolder, `output_${index + 1}.txt`);
            fs.writeFileSync(outputFile, output, 'utf8');
        });

        vscode.window.showInformationMessage('Test cases fetched and saved successfully!');
    } catch (error) {
        vscode.window.showErrorMessage(`Error fetching test cases: ${error.message}`);
    }
}

const getTestCasesFromLeetCode = async (url) => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
    });
    const page = await browser.newPage();
    try {
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
        });
        await page.waitForSelector('.elfjS', { timeout: 5000 });
        const content = await page.evaluate(() => {
            const element = document.querySelector('.elfjS');
            return element ? element.innerText : '';
        });
        if (!content) {
            throw new Error('Failed to fetch content from the page.');
        }
        const inputRegex = /Input:\s*(.*?)(?=Output:|$)/gs;
        const outputRegex = /Output:\s*(.*?)(?=Explanation:|Example|Constraints:|$)/gs;
        const inputs = [];
        const outputs = [];
        let inputMatch;
        while ((inputMatch = inputRegex.exec(content)) !== null) {
            inputs.push(inputMatch[1].trim());
        }
        let outputMatch;
        while ((outputMatch = outputRegex.exec(content)) !== null) {
            outputs.push(outputMatch[1].trim());
        }
        console.log(inputs);
        return { inputs, outputs };
    } catch (error) {
        throw new Error(`Scraping failed: ${error.message}`);
    } finally {
        await browser.close();
    }
};


const readTestCasescpp = (testDataFolder) => {
    const inputsFolder = path.join(testDataFolder);
    const inputFiles = fs.readdirSync(inputsFolder).filter(file => file.startsWith('inputcpp_') && file.endsWith('.txt'));
    const inputs = inputFiles.map(file => {
        const filePath = path.join(inputsFolder, file);
        return fs.readFileSync(filePath, 'utf8').trim();
        console.log(inputs);
    });
    vscode.window.showInformationMessage(`${inputs}`)
    return inputs;
};

const readTestCasespy = (testDataFolder) => {
    const inputsFolder = path.join(testDataFolder);
    const inputFiles = fs.readdirSync(inputsFolder).filter(file => file.startsWith('inputpy_') && file.endsWith('.txt'));
    const inputs = inputFiles.map(file => {
        const filePath = path.join(inputsFolder, file);
        return fs.readFileSync(filePath, 'utf8').trim();
        console.log(inputs);
    });
    vscode.window.showInformationMessage(`${inputs}`)
    return inputs;
};


function activate(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.fetchTestCases', fetchTestCases)
    );
    const runTestCasesCommand = vscode.commands.registerCommand('extension.runTestCases', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No file is currently open");
            return;
        }
        const filePath = editor.document.fileName;
        const fileExt = path.extname(filePath);
        if (fileExt !== '.cpp' && fileExt !== '.py') {
            vscode.window.showErrorMessage("File format not supported. Please select .cpp or .py file");
            return;
        }
        const workspaceFolder = vscode.workspace.workspaceFolders
            ? vscode.workspace.workspaceFolders[0].uri.fsPath
            : null;

        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Please open a workspace folder to fetch the test cases.');
            return;
        }
        const testDataFolder = path.join(workspaceFolder, 'TestData');
        let inputs;
        if (fileExt === '.cpp') {
            inputs = readTestCasescpp(testDataFolder);
        } else {
            inputs = readTestCasespy(testDataFolder);
        }
        if (inputs.length === 0) {
            vscode.window.showErrorMessage('No test cases available.');
            return;
        }
        vscode.window.showInformationMessage("Running test cases...");
        try {
            let allPassed = true;
            if (fileExt === '.cpp') {
                allPassed = await cppExec(filePath, inputs, testDataFolder);
            } else {              
                allPassed = await pythonExec(filePath, inputs, testDataFolder);
            }
            if (allPassed) {
                vscode.window.showInformationMessage("All test cases passed successfully!");  
            } else {
                vscode.window.showErrorMessage("Some test cases failed.");
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error running test cases: ${error.message}`);
        }
    });
    context.subscriptions.push(runTestCasesCommand);
}

const getoutput = (testDataFolder) => {
    const outputFolder = path.join(testDataFolder);
    const outputFiles = fs.readdirSync(inputsFolder).filter(file => file.startsWith('output_') && file.endsWith('.txt'));
    
    const outputs = outputFiles.map(file => {
        const filePath = path.join(outputFolder, file);
        return fs.readFileSync(filePath, 'utf8').trim();
    });
    vscode.window.showInformationMessage(`${outputs}`)
    return outputs;
};

const cppExec = async (filePath, inputs, testDataFolder = "C:/Users/DHRUVI PATEL/OneDrive/Desktop/vs code extension project/testCases") => {
    try {
        const cppCompile = vscode.workspace.getConfiguration().get("cph.language.cpp.compile", "g++");
        const cppOutArg = vscode.workspace.getConfiguration().get("cph.language.cpp.OutputArg", "-o");
        const file = path.parse(filePath).name;
        const executablePath = path.join(path.dirname(filePath), file); 
        const command = `${cppCompile} "${filePath}" ${cppOutArg} "${executablePath}" -mconsole -lgdi32`;
        await new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Compilation failed:\n${stderr}`);
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
        let allPassed = true;
        for (const [index, input] of inputs.entries()) {
            const { stdout: runStdout, stderr: runStderr } = await new Promise((resolve, reject) => {
                const childProcess = exec(`"${executablePath}"`, (runError, runStdout, runStderr) => {
                    if (runError) {
                        reject({ stdout: runStdout, stderr: runStderr, error: runError });
                    } else {
                        resolve({ stdout: runStdout, stderr: runStderr });
                    }
                });
                childProcess.stdin.write(input);
                childProcess.stdin.end();
            });
            if (runStderr) {
                vscode.window.showErrorMessage(`Execution failed: ${runStderr}`);
                allPassed = false;
                continue;
            }
            const expectedOutputFile = path.join(testDataFolder, `output_${index + 1}.txt`);
            try {
                const expectedOutput = fs.readFileSync(expectedOutputFile, 'utf8').trim();
                if (runStdout.trim().replace(/\r\n/g, '\n') !== expectedOutput.replace(/\r\n/g, '\n')) {
                    vscode.window.showErrorMessage(`Test case ${index + 1} failed.\nExpected:\n${expectedOutput}\nGot:\n${runStdout.trim()}`,{modal:true});
                    allPassed = false;
                } else {
                    vscode.window.showInformationMessage(`Test case ${index+1} passed.`, { modal: true });
                }
            } catch (err) {
                vscode.window.showErrorMessage(`Could not read file ${expectedOutputFile}`);
                return false;
            }
        }
        fs.unlink(executablePath, (unlinkError) => {
            if (unlinkError) {
                console.error(`Error deleting executable: ${unlinkError}`);
            }
        });
        return allPassed;
    } catch (error) {
        if (error.stderr) {
            vscode.window.showErrorMessage(`Error: ${error.stderr}`);
        } else if (error.error) {
            vscode.window.showErrorMessage(`Error: ${error.error}`);
        } else {
            vscode.window.showErrorMessage(`An unexpected error occurred.`);
        }
        return false;
    }
};

const pythonExec = async (filePath, inputs, testDataFolder = "C:/Users/DHRUVI PATEL/OneDrive/Desktop/vs code extension project/testCases") => {
    try {
        const pythonRun = process.env.PYTHONPATH || "python";
        if (!fs.existsSync(testDataFolder)) {
            vscode.window.showErrorMessage(`Test data folder does not exist: ${testDataFolder}`);
            return false;
        }
        let allPassed = true;
        const normalize = (text) => text.trim().replace(/\r\n/g, '\n');
        for (const [index, input] of inputs.entries()) {
            try {
                const stringInput = input.toString();
                const { stdout: runStdout, stderr: runStderr } = await new Promise((resolve, reject) => {
                    const childProcess = exec(`${pythonRun} "${filePath}"`, { timeout: 5000 }, (runError, runStdout, runStderr) => {
                        if (runError) {
                            reject({ stdout: runStdout, stderr: runStderr, error: runError });
                        } else {
                            resolve({ stdout: runStdout, stderr: runStderr });
                        }
                    });
                    childProcess.stdin.write(stringInput);
                    childProcess.stdin.end();
                });
                if (runStderr) {
                    console.error(`stderr for test case ${index + 1}: ${runStderr}`);
                    vscode.window.showErrorMessage(`Execution failed: ${runStderr}`);
                    allPassed = false;
                    continue;
                }
                const expectedOutputFile = path.join(testDataFolder, `output_${index + 1}.txt`);
                console.log(`Checking for expected output file: ${expectedOutputFile}`);
                if (!fs.existsSync(expectedOutputFile)) {
                    vscode.window.showErrorMessage(`Expected output file not found: ${expectedOutputFile}`);
                    allPassed = false;
                    continue;
                }
                const expectedOutput = fs.readFileSync(expectedOutputFile, 'utf8');
                if (normalize(runStdout) !== normalize(expectedOutput)) {
                    vscode.window.showErrorMessage(
                        `Test case ${index+1} failed.\nExpected:\n${normalize(expectedOutput)}\nGot:\n${normalize(runStdout)}`,{modal:true}
                    );
                    allPassed = false;
                } else {
                    vscode.window.showInformationMessage(`Test case ${index+1} passed.`, { modal: true });

                }
            } catch (error) {
                const errorMessage = error.error?.message || error.message || String(error);
                console.error(`Error during execution of test case ${index + 1}: ${errorMessage}`);
                vscode.window.showErrorMessage(`Error during execution of test case: ${errorMessage}`);
                allPassed = false;
            }
        }
        return allPassed;
    } catch (error) {
        console.error(`Unexpected error: ${error.message}`);
        vscode.window.showErrorMessage(`Unexpected error: ${error.message}`);
        return false;
    }
};

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
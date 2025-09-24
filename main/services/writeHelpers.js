// main/services/writeHelpers.js
const { spawn } = require('child_process');
const path = require('path');
const lockfile = require('proper-lockfile');

// Note: Ensure your environment has Python installed and accessible in the PATH.
// For production, you may need to package Python with your app or rely on the user having it.
const PYTHON_EXE = 'python'; // Or 'python3' on macOS/Linux

async function runPythonScript(command, params) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'excel_handler.py');
        const args = [scriptPath, command, JSON.stringify(params)];

        const proc = spawn(PYTHON_EXE, args, { stdio: ['pipe', 'pipe', 'pipe'] });
        
        let output = '';
        let error = '';

        proc.stdout.on('data', (data) => {
            output += data.toString();
        });

        proc.stderr.on('data', (data) => {
            error += data.toString();
        });

        proc.on('close', (code) => {
            if (code !== 0) {
                console.error(`Python script exited with code ${code}. STDOUT: ${output}, STDERR: ${error}`);
                reject(new Error(error || `Python script failed with exit code ${code}.`));
            } else {
                try {
                    const result = JSON.parse(output);
                    if (result.status === 'error') {
                        reject(new Error(result.message));
                    } else {
                        resolve(result);
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse Python output: "${output}" - ${e.message}`));
                }
            }
        });
    });
}

async function performExcelOperationWithLock(filePath, command, params) {
    const lockOptions = { retries: 10, stale: 15000 };
    let release;
    try {
        release = await lockfile.lock(filePath, lockOptions);
    } catch (err) {
        const e = new Error('Could not acquire file lock.');
        e.code = 'LOCK_ERROR';
        throw e;
    }

    try {
        const result = await runPythonScript(command, params);
        return result;
    } finally {
        try {
            await release();
        } catch (e) {
            console.error("Failed to release lock:", e);
        }
    }
}

module.exports = { performExcelOperationWithLock };
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const res = spawn("python3", ["-m", "http.server", "8000"], { shell: true });

async function timeout(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

function cleanup(err) {
    console.log("cleaning up");
    res.kill();
    if (err != null) {
        console.error(err);
        process.exit(1);
    }
    process.exit(0);
}

function check(test) {
    if (test.includes("FAILED")) {
        throw new Error(test);
    }
}

function checkAllReady(tests) {
    for (let test of tests) {
        if (test === "") return false;
    }

    return true;
}

async function waitForTest(page) {
    let n = 0;
    while (n < 30) {
        const testInputType = await (await page.waitForSelector("#testInputType")).evaluate(el => el.textContent);
        const testSmallArrays = await (await page.waitForSelector("#testSmallArrays")).evaluate(el => el.textContent);
        const testUint8 = await (await page.waitForSelector("#testUint8")).evaluate(el => el.textContent);
        const testAlignment = await (await page.waitForSelector("#testAlignment")).evaluate(el => el.textContent);

        if (!checkAllReady([testInputType, testSmallArrays, testUint8, testAlignment])) {
            await timeout(1000);
            n++;
            continue;
        }

        check(testInputType);
        check(testSmallArrays);
        check(testUint8);
        check(testAlignment);

        return true;
    }
}

async function runTest() {
    const browser = await puppeteer.launch({ headless: "new", args: ["--enable-unsafe-webgpu"] });
    const page = await browser.newPage();

    page.on("console", message => console.log(`message from console ${message.text()}`))
        .on("pageerror", ({ message }) => console.log(`error from page ${message}`));

    const res = await page.goto("http://localhost:8000/test/index.html");
    if (res.status() !== 200) throw new Error("Failed to load page");

    const ready = await waitForTest(page);
    if (!ready) throw new Error("Failed to load page");

    cleanup(null);
}

runTest().catch(err => cleanup(err));

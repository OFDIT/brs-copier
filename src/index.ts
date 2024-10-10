import('dotenv/config');
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import fs from 'node:fs';
import csvtojson from 'csvtojson';

const trgCourses: trgCourse[] = await csvtojson().fromFile('data/targets.csv');
const recordList: trgCourse[] = []

type srcCourse = {
    orgId: number;
    type: "Agent" | "Course";
    name: string;
}

type trgCourse = {
    orgId: number;
    course_subject: string;
    course_number: number;
    status?: "Success" | "Failed";
    error?: string;
}
const copyAgent = async (srcCourse: srcCourse, trgCourse: trgCourse, page: Page) => {
    try {
        console.log(`Processing copy request for: ${srcCourse.type} ${srcCourse.name} (${srcCourse.orgId}) -> ${trgCourse.course_subject} ${trgCourse.course_number} (${trgCourse.orgId})`);
        await page.waitForTimeout(1000);
        await page.goto(`https://brightspace.cuny.edu/d2l/lms/importExport/import_export.d2l?ou=${trgCourse.orgId}`);
        const page1Promise = page.waitForEvent('popup');
        await page.getByRole('button', { name: 'Search for offering' }).click();
        const page1 = await page1Promise;
        await page1.frameLocator('internal:attr=[title="Body"i]').locator('#z_b').click();
        await page1.frameLocator('internal:attr=[title="Body"i]').locator('#z_b').fill(`${srcCourse.orgId}`);
        await page1.frameLocator('frame[name="Body"]').getByRole('button', { name: 'Search' }).click();
        await page1.frameLocator('frame[name="Body"]').getByRole('radio', { name: 'Select "SPS01 - Template Test Course_TB"' }).check();
        await page1.frameLocator('frame[name="Footer"]').getByRole('button', { name: 'Add Selected' }).click();
        await page.getByRole('button', { name: 'Select Components' }).click();
        await page.getByLabel('Intelligent Agents', { exact: true }).check();
        await page.getByRole('button', { name: 'Continue' }).click();
        await page.getByRole('button', { name: 'Finish' }).click();
        console.log(`Success copying: ${srcCourse.type} ${srcCourse.name} -> ${trgCourse.course_subject} ${trgCourse.course_number} (${trgCourse.orgId})`);
        trgCourse.status = 'Success';
        recordList.push(trgCourse)
    } catch (error) {
        console.error(error);
        trgCourse.status = 'Failed';
        trgCourse.error = String(error);
        recordList.push(trgCourse)
    }
}
async function run() {
    const browser = await chromium.launch({
        headless: true
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
        await page.goto('https://brightspace.cuny.edu');
        await page.getByLabel('Username').fill(String(process.env.USERNAME));
        await page.getByLabel('Username').press('Tab');
        await page.getByLabel('Password').fill(String(process.env.PASSWORD))
        await page.getByRole('button', { name: 'Log in' }).click();
    }
    catch (error) {
        console.log(error);
    }
    const srcCourse: srcCourse = {
        orgId: 7733,
        type: 'Agent',
        name: 'Un-Enroll Observers'
    }

    for (const trgCourse of trgCourses) {
        await copyAgent(srcCourse, trgCourse, page);
    }

    await context.close();
    await browser.close();

    try {
        fs.writeFileSync('data/output.json', JSON.stringify(recordList))
        console.log('✅ JSON file created successfully!')
    } catch (err) {
        console.error('🚫 Error writing JSON file:', err)
    }
}

run()
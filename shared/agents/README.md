# Job Automation Agents

These JavaScript scripts provide the core logic for the job application n8n workflows. Because n8n allows running custom JavaScript in the **Code** node, you can easily wire these agents together without relying on complex node setups.

## Prerequisites
1. Ensure your `.env` has `LLM_ENDPOINT` and `LLM_SECRET`.
2. Ensure your n8n docker instance allows external module requiring. You can set `NODE_FUNCTION_ALLOW_EXTERNAL=*` in your `.env` if needed, though these scripts just use native node `fetch` and local requires. Alternatively, just paste the script contents into the Code node if file system access is restricted.

## 1. Main Automation Workflow (Browser Extension Trigger)
Create a workflow in n8n with the following steps:
1. **Webhook Node**: Set to `POST`, URL `your-n8n-url/webhook/job-trigger`. Have your browser extension send `{ "jobDescription": "..." }`.
2. **Code Node (Fit Scorer)**:
   ```javascript
   const { scoreFit } = require('/data/shared/agents/fit_scorer.js');
   const { parseJobDescription } = require('/data/shared/agents/jd_parser.js');
   
   // Parse JD
   const jdParsed = await parseJobDescription($input.item.json.jobDescription);
   
   // Hardcode or load your resume text
   const myResume = "My base resume text here..."; 
   
   const fit = await scoreFit(myResume, jdParsed);
   return { jdParsed, fitScore: fit.score, fitReasoning: fit.reasoning };
   ```
3. **If Node**: Check if `fitScore > 70`.
4. **Code Node (Resume & Cover Letter Gen)**:
   ```javascript
   const { optimizeResume } = require('/data/shared/agents/resume_optimizer.js');
   const { craftCoverLetter } = require('/data/shared/agents/cover_letter_crafter.js');
   
   const jdParsed = $input.item.json.jdParsed;
   const myResume = "My base resume text here..."; 
   
   const tailoredResume = await optimizeResume(myResume, jdParsed);
   const coverLetter = await craftCoverLetter(tailoredResume, jdParsed);
   
   return { tailoredResume, coverLetter };
   ```
5. **Notion / Airtable Node**: Save the outputs.

## 2. Manual Trigger Workflows
Create another workflow with a Webhook/Manual trigger that takes a Job Description text and runs:

**Code Node (Interview Prep & Outreach)**:
```javascript
const { generateInterviewPrep } = require('/data/shared/agents/interview_prep.js');
const { draftOutreach } = require('/data/shared/agents/outreach_drafter.js');

const jdParsed = $input.item.json.jdParsed; // pass parsed JD
const myResume = "My base resume text here..."; 

const interviewPrep = await generateInterviewPrep(myResume, jdParsed);
const outreach = await draftOutreach(myResume, jdParsed);

return { interviewPrep, outreach };
```

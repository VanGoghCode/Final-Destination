import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
  ThinkingLevel,
  type GenerateContentConfig,
} from "@google/genai";

const MODEL_NAME = "gemini-3-pro-preview";

// Initialize Google GenAI client using API key mode
function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_GENAI_API_KEY environment variable is required");
  }

  return new GoogleGenAI({ apiKey });
}

// Generation config with thinking enabled
const generationConfig: GenerateContentConfig = {
  maxOutputTokens: 65535,
  temperature: 1,
  topP: 0.95,
  thinkingConfig: {
    thinkingLevel: ThinkingLevel.HIGH,
  },
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.OFF,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.OFF,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.OFF,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.OFF,
    },
  ],
};

// Helper to generate content using Google GenAI
async function generateContent(prompt: string): Promise<string> {
  try {
    const ai = getGenAI();
    console.log(`[Gemini] Initializing model ${MODEL_NAME}`);

    console.log("[Gemini] Sending request to Google GenAI...");
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: generationConfig,
    });

    const text = response.text || "";

    console.log(
      "[Gemini] Successfully received response, length:",
      text.length,
    );
    return text;
  } catch (error) {
    console.error("[Gemini] Error generating content:", error);
    throw error;
  }
}

/**
 * Research a company to understand their business, culture, and what makes a candidate stand out
 */
export async function researchCompany(
  companyName: string,
  companyUrl: string | undefined,
  positionTitle: string,
  jobDescription: string,
): Promise<string> {
  const companyUrlInfo = companyUrl 
    ? `\n\n## COMPANY WEBSITE:\nIMPORTANT: Use this URL to identify the EXACT company: ${companyUrl}\nThis URL is authoritative - use it to research the correct company and avoid confusion with other companies that may have similar names.`
    : '';

  const prompt = `You are an expert career researcher and strategist. Your task is to provide deep, actionable research about a company and role that will help a candidate stand out by showing MULTIDISCIPLINARY FIT.

## THE MULTIDISCIPLINARY ADVANTAGE:
In 2026, candidates get rejected not because of bad resumes, but because other candidates have backgrounds MORE SIMILAR to the work the company is already doing. The key to standing out is showing MULTIDISCIPLINARY expertise that combines two or more fields relevant to this role.

## RESEARCH TASK:
Provide comprehensive research on **${companyName}** for the **${positionTitle}** position.${companyUrlInfo}

## JOB DESCRIPTION:
${jobDescription}

## REQUIRED RESEARCH OUTPUT:

### 1. COMPANY DEEP DIVE
- **What they actually do:** Core business, products/services, how they make money
- **Industry & Market:** What industry/vertical are they in? Who are their competitors?
- **Tech Stack & Tools:** What technologies, frameworks, tools do they use? (Research from job postings, engineering blogs, tech radar)
- **Company Stage:** Startup, growth, enterprise? What does this mean for the role?
- **Recent News:** Any recent funding, product launches, acquisitions, or strategic shifts?

### 2. DEPARTMENT & ROLE CONTEXT
- **Where this role sits:** Which department/team? How does it fit in the org structure?
- **What problems they're solving:** Based on the JD, what challenges is this team facing?
- **Cross-functional work:** What other teams/departments does this role interact with?
- **Success metrics:** How would success be measured in this role?

### 3. MULTIDISCIPLINARY FIT ANALYSIS (CRITICAL)
Based on the job description and company context, identify:
- **Primary Domain:** The main field/expertise required (e.g., Software Engineering, Data Science)
- **Secondary Domains:** Adjacent fields that would make a candidate stand out:
  - If it's a fintech company → Finance + Tech combination is powerful
  - If they deal with healthcare → Healthcare domain knowledge + Tech
  - If it's B2B SaaS → Sales/Business understanding + Engineering
  - If it's consumer products → UX/Design thinking + Engineering
- **Industry-Specific Knowledge:** What domain expertise would be valuable?
- **Recommended Skill Combinations:** Specific 2-3 field combinations that would make someone IRRESISTIBLE for this role

### 4. CULTURAL & VALUES ALIGNMENT
- **Company values:** What do they emphasize in their culture?
- **Work style:** Remote/hybrid/onsite? Fast-paced startup vs. structured enterprise?
- **What they look for:** Beyond technical skills, what traits do they value?

### 5. STRATEGIC TALKING POINTS
- **Why this company matters:** What's their vision/mission? What problem are they solving for the world?
- **Why this role matters:** How does this position contribute to the company's success?
- **Connection points:** How can a candidate show their background DIRECTLY RELATES to what the company does?

### 6. KEYWORDS & LANGUAGE
- **Industry jargon:** Terms and phrases used in this industry
- **Company-specific language:** Words and concepts from their website, blog, JD
- **Technical keywords:** Specific technologies, methodologies, frameworks to mention

## FORMATTING RULES (CRITICAL):
- Do NOT use ** (double asterisks) to bold text. Use plain text only.
- Do NOT use em dashes (—). Use regular hyphens (-) or rewrite the sentence.
- Keep formatting simple and clean.

## OUTPUT FORMAT:
Provide the research in a clear, structured format. Be specific and actionable - every piece of information should help the candidate tailor their application to show multidisciplinary fit.`;

  return await generateContent(prompt);
}

export async function tailorResume(
  resumeLatex: string,
  jobDescription: string,
  personalDetails: string,
  companyInfo: string,
): Promise<string> {
  const prompt = `You are an expert resume writer and career consultant specializing in **Semantic Mapping** and **Multidisciplinary Positioning** for modern ATS systems. Your task is to tailor the given LaTeX resume to match the job description while maintaining the EXACT same LaTeX format and structure.

## THE MULTIDISCIPLINARY ADVANTAGE (CRITICAL):
In 2026, candidates don't get rejected for bad resumes—they get rejected because another candidate's background is MORE SIMILAR to the work the company is already doing. The secret to standing out is showing MULTIDISCIPLINARY expertise.

**Key Insight:** When two big fields combine (e.g., Finance + Engineering, Healthcare + ML, Business + Development), candidates become IRRESISTIBLE because their background matches what the company actually does.

Your job is to position the candidate's experience to show how their COMBINATION of skills directly relates to the company's work.

## SEMANTIC ALIGNMENT STRATEGY:
Modern ATS filters and recruiters look for **Technical Adjacencies**, not just keywords. You must optimize for:

### 1. Multidisciplinary Positioning
- Identify the company's DOMAIN (fintech, healthcare, e-commerce, etc.)
- Highlight experiences that show BOTH technical AND domain expertise
- Frame projects to show cross-functional understanding
- Example: For a fintech role, emphasize any finance/accounting + tech combination
- Example: For an Android role at a finance company, emphasize finance + Android experience

### 2. Contextual Clustering
Don't just list skills in isolation. Add semantic "Context Nouns" that signal expertise depth:
- If listing "AWS" → include adjacencies like "Infrastructure-as-Code," "Cost Optimization," "Auto-scaling"
- If listing "React" → include "Component Architecture," "State Management," "Performance Optimization"
- This signals you're an architect, not just a user

### 3. Velocity Signals
Use **Growth Nouns** that carry 10x more weight than passive language:
- PREFER: "Migrated," "Refactored," "Scaled," "Architected," "Optimized," "Accelerated," "Transformed"
- AVOID: "Responsible for," "Worked on," "Helped with," "Assisted in"
- Show momentum and ownership, not just participation

### 4. Complexity Gap Matching
Match the semantic tone to the company's stage and culture:
- Startup JD → Use agile, fast-paced language: "shipped," "iterated," "pivoted," "owned end-to-end"
- Enterprise JD → Use structured language: "governed," "standardized," "compliance," "cross-functional alignment"
- Bridge the "Semantic Distance" between your experience and their context

## CRITICAL INSTRUCTIONS:
1. **PRESERVE STRUCTURE:** Keep the EXACT same LaTeX document structure, \\documentclass, \\usepackage, and custom commands. Do NOT change the layout.
2. **TAILOR CONTENT:** Only modify the **text content** (summary, bullet points, skills) to better and most align with the job requirements.
3. **PRESERVE BASE DETAILS - DO NOT CHANGE:**
   - Company names from work experience
   - Job titles held
   - Dates and timelines
   - Educational institutions and degrees
   - Personal information (name, contact, links)
4. **WHAT TO TAILOR:**
   - Bullet point descriptions (rephrase with velocity signals and contextual clustering)
   - Professional summary/objective (align with company culture and role focus, emphasize multidisciplinary fit)
   - Skills section (group with technical adjacencies, reorder for relevance, show domain expertise)
   - How achievements are described (not the achievements themselves)
   - **Project/Work Descriptions (AGGRESSIVE KEYWORD INTEGRATION - CRITICAL):** You MUST weave must-have keywords from the job description directly into project and work experience bullet points to show PROOF OF WORK. This is NOT optional. For example:
     - If Python is a must-have skill → Add Python context to an existing bullet: "Developed automated data pipelines using Python and AWS Lambda..."
     - If Kubernetes is required → Modify deployment descriptions: "Orchestrated containerized microservices on Kubernetes clusters..."
     - If specific frameworks are mentioned (Django, React, etc.) → Integrate them naturally into relevant project descriptions
     - Emphasize different aspects of the same project that are more relevant to this role
     - Reframe the project's purpose or impact to highlight relevance to the target company's domain
     - Adjust technical details to emphasize technologies/skills mentioned in the job description
     - Add context about how the work relates to the target industry
   - **PROOF OF WORK RULE:** Keywords should appear in CONTEXT within experience bullets, NOT just listed in skills. A recruiter should see "Python" or "Kubernetes" embedded in actual work descriptions, demonstrating real usage.
   - **BUT DO NOT:** Fabricate entirely new projects, invent achievements that didn't happen, or fundamentally misrepresent what was done. The core truth must remain intact - but you CAN and SHOULD add relevant technology context to existing true experiences.
5. **SUMMARY WORD LIMIT:** The professional summary/objective section MUST NOT exceed 60 words. Keep it concise, impactful, and focused on multidisciplinary fit.
6. **MULTIDISCIPLINARY SKILLS EMPHASIS:** In the summary and throughout, emphasize how the candidate's combination of skills (technical + domain) makes them uniquely qualified. Show how their background DIRECTLY RELATES to what the company does.
7. **SKILLS FROM JOB DESCRIPTION (ADD ALL - CRITICAL):** Extract ALL required, preferred, and nice-to-have skills mentioned in the job description and ADD them to the Skills section - even if they are NOT explicitly in the original resume. The candidate is assumed to have exposure to industry-standard tools. Include:
   - ALL technical skills, programming languages, frameworks mentioned in JD
   - ALL tools, platforms, cloud services mentioned
   - ALL methodologies (Agile, Scrum, CI/CD, etc.)
   - Group related skills together to show contextual clustering
   - Do NOT leave out ANY skill keyword from the job description
8. **SEMANTIC KEYWORDS:** Naturally weave keywords and their technical adjacencies from the job description INTO existing bullet points.
9. **IMPACT:** Quantify achievements (e.g., "Scaled system to handle 10x traffic") where possible, using velocity-signaling verbs.
10. **CLEAN OUTPUT:** Return ONLY the complete LaTeX code. Do NOT wrap in markdown \`\`\`latex blocks. Do NOT include explanations.
11. **FORMATTING:** Do NOT use ** (double asterisks) to bold text. Do NOT use em dashes (—), use regular hyphens (-) or rewrite instead.

## ORIGINAL RESUME (LaTeX):
${resumeLatex}

## JOB DESCRIPTION:
${jobDescription}

## PERSONAL DETAILS:
${personalDetails}

## COMPANY INFO & RESEARCH (USE THIS TO POSITION MULTIDISCIPLINARY FIT):
${companyInfo}

Use this company information to:
- Understand the company's domain and what they actually do
- Identify the multidisciplinary skill combinations that would make the candidate stand out
- Use industry-specific language and keywords
- Frame the candidate's experience to show direct relevance to the company's work

## OUTPUT:
The complete, compilable LaTeX code with semantically aligned content that maximizes ATS compatibility, recruiter engagement, and shows MULTIDISCIPLINARY FIT with the company's actual work.`;

  let result = await generateContent(prompt);
  result = result.replace(/^```latex\n?|^```\n?/i, "").replace(/\n?```$/i, "");

  return result.trim();
}

export async function tailorCoverLetter(
  coverLetterLatex: string,
  jobDescription: string,
  personalDetails: string,
  companyInfo: string,
): Promise<string> {
  const prompt = `You are an expert cover letter writer crafting a letter for a visionary technologist. Your task is to tailor the given LaTeX cover letter for the specified job.

## THE MULTIDISCIPLINARY ADVANTAGE (CRITICAL):
In 2026, candidates don't get rejected for bad cover letters—they get rejected because another candidate's background is MORE SIMILAR to the work the company is already doing. The secret to standing out is showing MULTIDISCIPLINARY expertise.

**Key Insight:** Emphasize how the candidate's COMBINATION of skills (e.g., Finance + Engineering, Healthcare + ML, Business + Development) makes them uniquely qualified for THIS specific role at THIS specific company.

## CANDIDATE PERSONALITY & VALUES (MUST be reflected in the letter):
- **Passionate innovator:** Loves playing with technology, building inventions, and exploring what's possible.
- **Mission-driven:** Cares deeply about making life easier for humans and contributing to a better future.
- **Values innovation:** Drawn to companies and people who drive real change and do something different.
- **Visionary mindset:** Wants to be part of something meaningful, not just a job - wants to help the company achieve its vision.
- **Authentic enthusiasm:** Genuine excitement about technology and its potential to help humanity.
- **Multidisciplinary thinker:** Brings unique value through combination of different expertise areas.
- **The "Obsessed" Expert:** You don't just "do" cloud work; you are fascinated by the architecture. You love talking about how things scale.
- **High-IQ / High-Initiative:** Show you understand the "Why" behind the "How." You see the business impact, not just the code.
- **Direct & Honest:** Use a "smart-casual" professional voice. Use conversational interjections like "To be honest," "The reality is," or "What I really love about this is..."
- **Founder Mentality:** Frame past experiences through a lens of ownership. You don't just follow tickets; you build solutions that move the needle.

## CRITICAL INSTRUCTIONS:
1. **PRESERVE STRUCTURE:** Keep the EXACT same LaTeX format and commands.
2. **THE OPENING:** DO NOT use "I am writing to express my interest." Start with a high-energy observation about the company's mission or a specific challenge they face.
3. **NO AI CLICHÉS:** Strictly forbid words like "tapestry," "testament," "ever-evolving," "leverage," "passionate" (use 'obsessed' or 'fascinated'), and "I am confident that my unique blend of...".
4. **FOCUS ON WINS:** Frame technical achievements as business wins. (e.g., "That 90% speed increase wasn't just a tech win; it allowed the team to stop worrying about setup and start innovating.")
5. **PRESERVE BASE DETAILS - DO NOT CHANGE:**
   - Project names mentioned (keep them exactly as they are)
   - Project ideas/concepts (don't change what projects are about)
   - Company names from past experience
   - Job titles held
   - Educational institutions and degrees
   - Personal information (name, contact details)
   - Specific achievements and their facts
6. **WHAT TO TAILOR:**
   - How experiences are framed and described
   - Which aspects of projects/experience to emphasize
   - Connecting past work to the job requirements
   - The narrative around why this role/company is exciting
   - **MULTIDISCIPLINARY FIT:** Explain how the combination of skills makes them perfect for this role
7. **TONE:** 80% formal + 20% informal. Professional but human. Include occasional conversational phrases like "honestly," "what really excites me is," "I genuinely believe," etc.
8. **VISIONARY TONE:** Write as if from someone who truly believes technology can change the world. Express genuine passion for innovation and building things that matter.
9. **COMPANY ALIGNMENT:** Show how the candidate's vision aligns with the company's mission. Explain how they can help the company meet its goals and fulfill its vision.
10. **MULTIDISCIPLINARY NARRATIVE:** Weave in how the candidate's unique combination of expertise (technical + domain knowledge) directly relates to what the company does. This is the KEY differentiator.
11. **PERSONAL TOUCH:** Include phrases like "I am drawn to companies that...", "What excites me about [Company] is...", "I believe technology should...", "My background in [X] combined with [Y] uniquely positions me to...".
12. **HUMBLE CONFIDENCE:** Confident about skills but humble about learning. Eager to contribute, not just take.
13. **AVOID GENERIC:** No clichés. Make it feel written by a real person who genuinely cares.
14. **WORD COUNT:** Keep the body between 250-350 words. Punchy and impactful.
15. **CLEAN OUTPUT:** Return ONLY the complete LaTeX code. Do NOT wrap in markdown.
16. **FORMATTING:** Do NOT use ** (double asterisks) to bold text. Do NOT use em dashes (—), use regular hyphens (-) or rewrite instead.
## ORIGINAL COVER LETTER (LaTeX):
${coverLetterLatex}

## JOB DESCRIPTION:
${jobDescription}

## PERSONAL DETAILS:
${personalDetails}

## COMPANY INFO & RESEARCH (USE THIS TO POSITION MULTIDISCIPLINARY FIT):
${companyInfo}

Use this company information to:
- Understand exactly what the company does and their domain
- Identify the multidisciplinary skill combinations that would make the candidate stand out
- Use industry-specific language and concepts
- Show deep understanding of the company's challenges and how the candidate can help
- Frame the candidate's background as DIRECTLY RELEVANT to the company's actual work

## OUTPUT:
The complete, compilable LaTeX code with tailored content that sounds like a visionary technologist who genuinely wants to help this company succeed and whose MULTIDISCIPLINARY background makes them uniquely qualified.`;

  let result = await generateContent(prompt);
  result = result.replace(/^```latex\n?|^```\n?/i, "").replace(/\n?```$/i, "");

  return result.trim();
}

export async function generateAnswers(
  questions: string,
  tailoredResume: string,
  tailoredCoverLetter: string | undefined,
  jobDescription: string,
  companyInfo: string,
): Promise<string> {
  const prompt = `You are an expert career coach helping a visionary technologist answer application questions. Your answers should sound authentic, human, and passionate.

## CANDIDATE PERSONALITY & VALUES (MUST be reflected in answers):
- **Passionate innovator:** Loves playing with technology, building inventions, and exploring what's possible.
- **Mission-driven:** Cares deeply about making life easier for humans and contributing to a better future.
- **Values innovation:** Drawn to companies and people who drive real change and do something different.
- **Visionary mindset:** Wants to help the company achieve its vision, not just get a job.
- **Authentic enthusiasm:** Genuine excitement about technology's potential to help humanity.

## CONTEXT:
- **Job:** ${jobDescription}
- **Company:** ${companyInfo}
- **Resume:** ${tailoredResume}
- **Cover Letter:** ${tailoredCoverLetter || "Not provided"}

## CRITICAL INSTRUCTIONS:
1. **TONE (VERY IMPORTANT):** 70% formal + 30% informal. Write like a smart, articulate human - not a robot. Mix professional language with natural conversational elements. Include phrases like "honestly," "what really excites me is," "I genuinely believe," "to be frank," "the thing I love most about," "what drew me to" etc. The answer should feel like it came from a real person having a professional conversation, not a corporate template.
2. **AUTHENTICITY:** Sound like a real person wrote this, not a template. Vary sentence structure. Avoid corporate buzzwords.
3. **PASSION:** Show genuine enthusiasm for technology, innovation, and making a difference.
4. **COMPANY FIT:** Explain how the candidate's vision aligns with the company. Show eagerness to help them succeed.
5. **SPECIFIC:** Reference real experiences from the resume but paraphrase naturally.
6. **HUMBLE CONFIDENCE:** Confident about abilities but eager to learn and contribute.
7. **FORMATTING:** Do NOT use ** (double asterisks) to bold text. Do NOT use em dashes (—), use regular hyphens (-) or rewrite instead.
8. **WORD/CHARACTER LIMITS:** If a question has a [LIMIT: X words] or [LIMIT: X characters] tag, you MUST strictly adhere to that limit. Count carefully and ensure the answer does not exceed the specified limit. For word limits, count actual words. For character limits, count all characters including spaces.

## QUESTIONS TO ANSWER:
${questions}

## OUTPUT FORMAT:
For each question, provide:
Question: [Question Text - without the limit tag]
Answer: [A thoughtful, human-sounding answer that reflects the visionary personality and respects any word/character limits]
...`;

  return await generateContent(prompt);
}

export async function generateColdEmail(
  tailoredResume: string,
  tailoredCoverLetter: string,
  jobDescription: string,
  companyInfo: string,
  positionTitle: string,
  companyName: string,
): Promise<string> {
  const prompt = `You are helping a visionary technologist write a compelling cold email to a hiring authority (e.g., Director, VP, or Hiring Manager) at a company they want to work for.

## CANDIDATE PERSONALITY:
- Passionate innovator who loves building with technology
- Mission-driven, wants to make life easier for humanity
- Drawn to companies that drive real change
- Visionary mindset - wants to help the company succeed
- Authentic enthusiasm about tech's potential

## CONTEXT:
- **Position:** ${positionTitle}
- **Company:** ${companyName}
- **Job Description:** ${jobDescription}
- **Company Info:** ${companyInfo}
- **Resume highlights:** ${tailoredResume.substring(0, 2000)}
- **Cover Letter insights:** ${tailoredCoverLetter.substring(0, 1500)}

## CRITICAL INSTRUCTIONS:
1. **TONE:** 70% formal + 30% informal. Professional yet personable. Sound like a real person, not a template.
2. **LENGTH:** 100-200 words ONLY. Short, punchy, and impactful.
3. **HOOK:** Start with something that grabs attention - mention something specific about the company or role.
4. **VALUE:** Focus on what value YOU can bring to THEM, not what you want.
5. **CTA:** End with a clear, simple call to action (e.g., "Would love 15 minutes to share how I could help with X").
6. **NO ATTACHMENTS MENTION:** Don't say "I've attached my resume" - just focus on the pitch.
7. **FORMATTING:** Do NOT use ** (double asterisks) to bold text. Do NOT use em dashes (—), use regular hyphens (-) or rewrite instead.

## OUTPUT:
Write the cold email body only (no subject line needed). Make it compelling, human, and confident but not arrogant.`;

  return await generateContent(prompt);
}

export async function generateReferenceEmail(
  tailoredResume: string,
  tailoredCoverLetter: string,
  jobDescription: string,
  companyInfo: string,
  positionTitle: string,
  companyName: string,
): Promise<string> {
  const prompt = `You are helping a visionary technologist write a warm, genuine email to an employee at a company, asking for a referral for an open position.

## CANDIDATE PERSONALITY:
- Passionate innovator who loves building with technology
- Mission-driven, wants to make life easier for humanity
- Drawn to companies that drive real change
- Visionary mindset - wants to help the company succeed
- Authentic enthusiasm about tech's potential

## CONTEXT:
- **Position:** ${positionTitle}
- **Company:** ${companyName}
- **Job Description:** ${jobDescription}
- **Company Info:** ${companyInfo}
- **Resume highlights:** ${tailoredResume.substring(0, 2000)}

## CRITICAL INSTRUCTIONS:
1. **TONE:** 70% formal + 30% informal. Friendly and genuine. You're asking a favor, so be humble and appreciative.
2. **LENGTH:** 100-200 words ONLY. Respect their time.
3. **OPENING:** Brief, warm greeting. Mention how you found them (LinkedIn, mutual connection placeholder, etc.).
4. **ASK:** Clearly state you're interested in the ${positionTitle} role and would appreciate a referral if they feel comfortable.
5. **WHY YOU:** Briefly (1-2 sentences) mention why you'd be a good fit - connect to company values.
6. **GRATITUDE:** Express genuine appreciation for their time regardless of outcome.
7. **NO PRESSURE:** Make it clear it's okay to say no.
8. **FORMATTING:** Do NOT use ** (double asterisks) to bold text. Do NOT use em dashes (—), use regular hyphens (-) or rewrite instead.

## OUTPUT:
Write the referral request email body only (no subject line needed). Make it human, humble, and genuine.`;

  return await generateContent(prompt);
}

// ========================================
// REGENERATION FUNCTIONS (with user feedback)
// ========================================

export async function regenerateResume(
  currentContent: string,
  userComment: string,
  originalResumeLatex: string,
  jobDescription: string,
  personalDetails: string,
  companyInfo: string,
): Promise<string> {
  const prompt = `You are an expert resume writer. The user has previously generated a tailored resume, but wants changes based on their feedback.

## USER'S FEEDBACK:
${userComment}

## CURRENT TAILORED RESUME (to be modified based on feedback):
${currentContent}

## ORIGINAL RESUME TEMPLATE (for reference):
${originalResumeLatex}

## JOB DESCRIPTION:
${jobDescription}

## PERSONAL DETAILS:
${personalDetails}

## COMPANY INFO:
${companyInfo}

## CRITICAL INSTRUCTIONS:
1. **APPLY THE FEEDBACK:** Make the specific changes the user requested.
2. **PRESERVE LATEX:** Keep the EXACT same LaTeX structure and formatting.
3. **MAINTAIN QUALITY:** Ensure the resume remains ATS-friendly and professional.
4. **CLEAN OUTPUT:** Return ONLY the complete LaTeX code. Do NOT wrap in markdown.
5. **FORMATTING:** Do NOT use ** (double asterisks) to bold text. Do NOT use em dashes (—), use regular hyphens (-) or rewrite instead.

## OUTPUT:
The regenerated LaTeX resume with the user's requested changes applied.`;

  let result = await generateContent(prompt);
  result = result.replace(/^```latex\n?|^```\n?/i, "").replace(/\n?```$/i, "");

  return result.trim();
}

export async function regenerateCoverLetter(
  currentContent: string,
  userComment: string,
  originalCoverLetterLatex: string,
  jobDescription: string,
  personalDetails: string,
  companyInfo: string,
): Promise<string> {
  const prompt = `You are an expert cover letter writer. The user has previously generated a tailored cover letter, but wants changes based on their feedback.

## USER'S FEEDBACK:
${userComment}

## CURRENT TAILORED COVER LETTER (to be modified based on feedback):
${currentContent}

## ORIGINAL COVER LETTER TEMPLATE (for reference):
${originalCoverLetterLatex}

## JOB DESCRIPTION:
${jobDescription}

## PERSONAL DETAILS:
${personalDetails}

## COMPANY INFO:
${companyInfo}

## CRITICAL INSTRUCTIONS:
1. **APPLY THE FEEDBACK:** Make the specific changes the user requested.
2. **PRESERVE LATEX:** Keep the EXACT same LaTeX structure and formatting.
3. **MAINTAIN TONE:** Keep it 80% formal + 20% informal, authentic, and passionate.
4. **CLEAN OUTPUT:** Return ONLY the complete LaTeX code. Do NOT wrap in markdown.
5. **FORMATTING:** Do NOT use ** (double asterisks) to bold text. Do NOT use em dashes (—), use regular hyphens (-) or rewrite instead.

## OUTPUT:
The regenerated LaTeX cover letter with the user's requested changes applied.`;

  let result = await generateContent(prompt);
  result = result.replace(/^```latex\n?|^```\n?/i, "").replace(/\n?```$/i, "");

  return result.trim();
}

export async function regenerateAnswers(
  currentContent: string,
  userComment: string,
  questions: string,
  tailoredResume: string,
  tailoredCoverLetter: string,
  jobDescription: string,
  companyInfo: string,
): Promise<string> {
  const prompt = `You are an expert career coach. The user has previously generated answers to application questions, but wants changes based on their feedback.

## USER'S FEEDBACK:
${userComment}

## CURRENT GENERATED ANSWERS (to be modified based on feedback):
${currentContent}

## ORIGINAL QUESTIONS:
${questions}

## CONTEXT:
- **Job:** ${jobDescription}
- **Company:** ${companyInfo}
- **Resume:** ${tailoredResume}
- **Cover Letter:** ${tailoredCoverLetter}

## CRITICAL INSTRUCTIONS:
1. **APPLY THE FEEDBACK:** Make the specific changes the user requested.
2. **MAINTAIN AUTHENTICITY:** Keep the 80% formal + 20% informal tone.
3. **KEEP STRUCTURE:** Follow the same Question/Answer format.
4. **BE SPECIFIC:** Reference real experiences from the resume.
5. **FORMATTING:** Do NOT use ** (double asterisks) to bold text. Do NOT use em dashes (—), use regular hyphens (-) or rewrite instead.

## OUTPUT:
The regenerated answers with the user's requested changes applied.`;

  return await generateContent(prompt);
}

export async function regenerateEmail(
  emailType: "coldEmail" | "referenceEmail",
  currentContent: string,
  userComment: string,
  tailoredResume: string,
  tailoredCoverLetter: string,
  jobDescription: string,
  companyInfo: string,
  positionTitle: string,
  companyName: string,
): Promise<string> {
  const emailTypeDescription =
    emailType === "coldEmail"
      ? "cold outreach email to a hiring authority"
      : "referral request email to an employee";

  const prompt = `You are helping rewrite a ${emailTypeDescription}. The user wants changes based on their feedback.

## USER'S FEEDBACK:
${userComment}

## CURRENT EMAIL (to be modified based on feedback):
${currentContent}

## CONTEXT:
- **Position:** ${positionTitle}
- **Company:** ${companyName}
- **Job Description:** ${jobDescription}
- **Company Info:** ${companyInfo}
- **Resume highlights:** ${tailoredResume.substring(0, 2000)}

## CRITICAL INSTRUCTIONS:
1. **APPLY THE FEEDBACK:** Make the specific changes the user requested.
2. **KEEP IT SHORT:** 100-200 words maximum.
3. **TONE:** 70% formal + 30% informal. Professional yet personable.
4. **BE GENUINE:** Sound like a real person, not a template.
5. **FORMATTING:** Do NOT use ** (double asterisks) to bold text. Do NOT use em dashes (—), use regular hyphens (-) or rewrite instead.

## OUTPUT:
The regenerated email with the user's requested changes applied.`;

  return await generateContent(prompt);
}

// ========================================
// GENERAL QUESTION ANSWERING
// ========================================

export async function answerGeneralQuestion(
  question: string,
  tailoredResume: string,
  tailoredCoverLetter: string,
  jobDescription: string,
  companyInfo: string,
  companyName: string,
  positionTitle: string,
  limitType?: "words" | "characters",
  limitValue?: number,
): Promise<string> {
  const limitInstruction = limitType && limitValue
    ? `\n6. IMPORTANT: Your answer MUST be within ${limitValue} ${limitType}. Be concise and stay within this limit.`
    : "";

  const prompt = `You are helping a job applicant write answers in FIRST PERSON (using "I", "my", "me"). Write as if you ARE the applicant. Use ONLY the provided context to answer the question. If the answer cannot be found in the context, say so clearly.

## QUESTION:
${question}

## APPLICATION CONTEXT:

### Tailored Resume:
${tailoredResume}

### Tailored Cover Letter:
${tailoredCoverLetter || "Not provided"}

### Target Position: ${positionTitle || "Not specified"} at ${companyName || "Not specified"}

### Job Description:
${jobDescription || "Not provided"}

### Company Information:
${companyInfo || "Not provided"}

## INSTRUCTIONS:
1. Answer the question in FIRST PERSON - write as if you are the applicant (use "I", "my", "me").
2. TONE: Write like a human - use a mix of 50% formal and 30% informal tone. Sound natural, not robotic. Include occasional conversational phrases like "honestly," "I really enjoy," "what excites me is" to make it feel authentic.
3. Answer the question directly and concisely based on the context provided.
4. If asking for a list (e.g., skills), provide a clean list (still in first person where applicable).
5. If the information is not available in the context, clearly state that.
6. Do NOT make up information that isn't in the provided context.
7. FORMATTING (CRITICAL): Do NOT use ** (double asterisks) to bold text - use plain text only. Do NOT use em dashes (—) - use regular hyphens (-) or rewrite the sentence instead. Keep it simple and clean.${limitInstruction}

## ANSWER (in first person, human-written tone):`;

  return await generateContent(prompt);
}

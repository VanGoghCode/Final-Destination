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

export async function tailorResume(
  resumeLatex: string,
  jobDescription: string,
  personalDetails: string,
  companyInfo: string,
): Promise<string> {
  const prompt = `You are an expert resume writer and career consultant. Your task is to tailor the given LaTeX resume to match the job description while maintaining the EXACT same LaTeX format and structure.

## CRITICAL INSTRUCTIONS:
1. **PRESERVE STRUCTURE:** Keep the EXACT same LaTeX document structure, \\documentclass, \\usepackage, and custom commands. Do NOT change the layout.
2. **TAILOR CONTENT:** Only modify the **text content** (summary, bullet points, skills) to better align with the job requirements.
3. **KEYWORDS:** naturally incorporate keywords from the job description.
4. **IMPACT:** Quantify achievements (e.g., "Increased sales by 20%") where possible.
5. **CLEAN OUTPUT:** Return ONLY the complete LaTeX code. Do NOT wrap in markdown \`\`\`latex blocks. Do NOT include explanations.

## ORIGINAL RESUME (LaTeX):
${resumeLatex}

## JOB DESCRIPTION:
${jobDescription}

## PERSONAL DETAILS:
${personalDetails}

## COMPANY INFO:
${companyInfo}

## OUTPUT:
The complete, compilable LaTeX code with tailored content.`;

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

## CANDIDATE PERSONALITY & VALUES (MUST be reflected in the letter):
- **Passionate innovator:** Loves playing with technology, building inventions, and exploring what's possible.
- **Mission-driven:** Cares deeply about making life easier for humans and contributing to a better future.
- **Values innovation:** Drawn to companies and people who drive real change and do something different.
- **Visionary mindset:** Wants to be part of something meaningful, not just a job - wants to help the company achieve its vision.
- **Authentic enthusiasm:** Genuine excitement about technology and its potential to help humanity.

## CRITICAL INSTRUCTIONS:
1. **PRESERVE STRUCTURE:** Keep the EXACT same LaTeX format and commands.
2. **TONE:** 80% formal + 20% informal. Professional but human. Include occasional conversational phrases like "honestly," "what really excites me is," "I genuinely believe," etc.
3. **VISIONARY TONE:** Write as if from someone who truly believes technology can change the world. Express genuine passion for innovation and building things that matter.
4. **COMPANY ALIGNMENT:** Show how the candidate's vision aligns with the company's mission. Explain how they can help the company meet its goals and fulfill its vision.
5. **PERSONAL TOUCH:** Include phrases like "I am drawn to companies that...", "What excites me about [Company] is...", "I believe technology should...".
6. **HUMBLE CONFIDENCE:** Confident about skills but humble about learning. Eager to contribute, not just take.
7. **AVOID GENERIC:** No clichés. Make it feel written by a real person who genuinely cares.
8. **CLEAN OUTPUT:** Return ONLY the complete LaTeX code. Do NOT wrap in markdown.

## ORIGINAL COVER LETTER (LaTeX):
${coverLetterLatex}

## JOB DESCRIPTION:
${jobDescription}

## PERSONAL DETAILS:
${personalDetails}

## COMPANY INFO:
${companyInfo}

## OUTPUT:
The complete, compilable LaTeX code with tailored content that sounds like a visionary technologist who genuinely wants to help this company succeed.`;

  let result = await generateContent(prompt);
  result = result.replace(/^```latex\n?|^```\n?/i, "").replace(/\n?```$/i, "");

  return result.trim();
}

export async function generateAnswers(
  questions: string,
  tailoredResume: string,
  tailoredCoverLetter: string,
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
- **Cover Letter:** ${tailoredCoverLetter}

## CRITICAL INSTRUCTIONS:
1. **TONE:** 80% formal + 20% informal. Professional but human. Include occasional conversational phrases like "honestly," "what really excites me is," "I genuinely believe," etc.
2. **AUTHENTICITY:** Sound like a real person wrote this, not a template. Vary sentence structure. Avoid corporate buzzwords.
3. **PASSION:** Show genuine enthusiasm for technology, innovation, and making a difference.
4. **COMPANY FIT:** Explain how the candidate's vision aligns with the company. Show eagerness to help them succeed.
5. **SPECIFIC:** Reference real experiences from the resume but paraphrase naturally.
6. **HUMBLE CONFIDENCE:** Confident about abilities but eager to learn and contribute.

## QUESTIONS TO ANSWER:
${questions}

## OUTPUT FORMAT:
For each question, provide:
**Question:** [Question Text]
**Answer:** [A thoughtful, human-sounding answer that reflects the visionary personality]
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
): Promise<string> {
  const prompt = `You are a helpful assistant that answers questions about a job applicant's materials. Use ONLY the provided context to answer the question. If the answer cannot be found in the context, say so clearly.

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
1. Answer the question directly and concisely based on the context provided.
2. If asking for a list (e.g., skills), provide a clean bulleted list.
3. If the information is not available in the context, clearly state that.
4. Be helpful and specific in your response.
5. Do NOT make up information that isn't in the provided context.

## ANSWER:`;

  return await generateContent(prompt);
}

import data from "./personal-workspace.json";
export const resumeTemplate = {
  id: "kirtan-resume",
  name: "Kirtan resume",
  content: data.resume,
  createdAt: 0,
  updatedAt: 0,
};
export const coverTemplate = {
  id: "kirtan-cover",
  name: "Kirtan cover letter",
  content: data.cover,
  createdAt: 0,
  updatedAt: 0,
};
export const masterContext = data.context;
export const personalProfile = {
  id: "kirtan",
  name: "Kirtan Thummar",
  firstName: "Kirtan",
  lastName: "Thummar",
  color: "from-blue-500 to-blue-600",
  defaultResumeId: resumeTemplate.id,
  defaultCoverLetterId: coverTemplate.id,
  createdAt: 0,
  updatedAt: 0,
};

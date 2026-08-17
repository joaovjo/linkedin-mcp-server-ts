export interface SectionDef {
	url: string | ((username: string) => string);
	waitForText?: string;
}

export const PERSON_SECTIONS: Record<string, SectionDef> = {
	experience: {
		url: (u: string) => `https://www.linkedin.com/in/${u}/details/experience/`,
	},
	education: {
		url: (u: string) => `https://www.linkedin.com/in/${u}/details/education/`,
	},
	interests: {
		url: (u: string) => `https://www.linkedin.com/in/${u}/details/interests/`,
	},
	honors: {
		url: (u: string) => `https://www.linkedin.com/in/${u}/details/honors/`,
	},
	languages: {
		url: (u: string) => `https://www.linkedin.com/in/${u}/details/languages/`,
	},
	certifications: {
		url: (u: string) => `https://www.linkedin.com/in/${u}/details/certifications/`,
	},
	skills: {
		url: (u: string) => `https://www.linkedin.com/in/${u}/details/skills/`,
	},
	projects: {
		url: (u: string) => `https://www.linkedin.com/in/${u}/details/projects/`,
	},
	contact_info: {
		url: (u: string) => `https://www.linkedin.com/in/${u}/overlay/contact-info/`,
	},
	posts: {
		url: (u: string) => `https://www.linkedin.com/in/${u}/recent-activity/all/`,
	},
};

export const COMPANY_SECTIONS: Record<string, SectionDef> = {
	about: {
		url: (u: string) => `https://www.linkedin.com/company/${u}/about/`,
	},
	posts: {
		url: (u: string) => `https://www.linkedin.com/company/${u}/posts/`,
	},
	jobs: {
		url: (u: string) => `https://www.linkedin.com/company/${u}/jobs/`,
	},
};

export const LINKEDIN_BASE = "https://www.linkedin.com";

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  experience: string;
  salary: string | null;
  postedDate: string; // ISO date, e.g. "2026-11-12"
  category: string;
  applyUrl: string;
  source: "Naukri" | "LinkedIn";
  sourceJobId: string;
  verifiedDate: string; // ISO date the listing was last verified live
  description?: string | null;
  keywords?: string[] | null;
};

// A job plus the display values computed from its dates at render time.
export type JobView = Job & {
  daysAgo: number;
  postedLabel: string;
  locationBucket: string;
  experienceBucket: string;
};

export const CATEGORIES = ["AI/ML", "Full Stack", "Software", "Data", "Other"] as const;

export const LOCATIONS = [
  "Remote",
  "Pune",
  "Bengaluru",
  "Mumbai",
  "Noida",
  "Gurugram",
  "Hyderabad",
  "Ahmedabad",
  "Other",
] as const;

export const EXPERIENCES = ["Fresher / 0-1", "1-2", "2+"] as const;

// Recency buckets use calendar days because postedDate is a date, not a
// timestamp. "Last few hours" means posted today; "Last 24 hours" means
// posted today or yesterday.
export const RECENCY_OPTIONS = [
  { value: "hours", label: "Last few hours", maxDays: 0 },
  { value: "24h", label: "Last 24 hours", maxDays: 1 },
  { value: "3d", label: "Past 3 days", maxDays: 3 },
  { value: "7d", label: "Past 7 days", maxDays: 7 },
] as const;

// Whole calendar days between the posted date and today, in UTC so the
// result does not depend on the server or visitor timezone.
export function daysSincePosted(postedDate: string, now: Date): number {
  const posted = new Date(postedDate + "T00:00:00Z").getTime();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((today - posted) / 86400000));
}

export function postedLabel(daysAgo: number): string {
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return `${daysAgo}d ago`;
}

// Map a free-text location ("Mumbai/Navi Mumbai", "Ahmedabad (On-site)")
// onto one of the location filter buckets.
export function locationBucket(location: string): string {
  const text = location.toLowerCase();
  if (text.includes("remote")) return "Remote";
  if (text.includes("pune")) return "Pune";
  if (text.includes("bengaluru") || text.includes("bangalore")) return "Bengaluru";
  if (text.includes("mumbai") || text.includes("navi mumbai")) return "Mumbai";
  if (text.includes("noida")) return "Noida";
  if (text.includes("gurugram") || text.includes("gurgaon")) return "Gurugram";
  if (text.includes("hyderabad")) return "Hyderabad";
  if (text.includes("ahmedabad")) return "Ahmedabad";
  return "Other";
}

// Map a free-text experience range onto one of the experience filter
// buckets. A range that starts at 0 accepts freshers, so it belongs in
// "Fresher / 0-1". A range that tops out at 2 is "1-2". Anything asking
// for more is "2+". An unparseable value lands in "2+" so a senior-leaning
// role is never shown to freshers by mistake.
export function experienceBucket(experience: string): string {
  const text = experience.toLowerCase();
  if (text.includes("entry") || text.includes("fresher")) return "Fresher / 0-1";
  const match = text.match(/(\d+)\s*-\s*(\d+)/);
  if (!match) return "2+";
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (min === 0) return "Fresher / 0-1";
  if (max <= 2) return "1-2";
  return "2+";
}

export function toJobView(job: Job, now: Date): JobView {
  const daysAgo = daysSincePosted(job.postedDate, now);
  return {
    ...job,
    daysAgo,
    postedLabel: postedLabel(daysAgo),
    locationBucket: locationBucket(job.location),
    experienceBucket: experienceBucket(job.experience),
  };
}


const atsTerms = [
  "Machine Learning", "Deep Learning", "Generative AI", "Computer Vision",
  "Natural Language Processing", "NLP", "LLM", "RAG", "AI Agents", "MLOps",
  "PyTorch", "TensorFlow", "Hugging Face", "LangChain", "LangGraph",
  "scikit-learn", "NumPy", "pandas", "OpenCV", "Vector Search",
  "Python", "JavaScript", "TypeScript", "Java", "Kotlin", "C++", "C#",
  "React", "Next.js", "Node.js", "Angular", "Vue", "Django", "Flask",
  "FastAPI", "Spring Boot", "REST APIs", "GraphQL", "Git", "CI/CD",
  "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Data Analysis",
  "Data Engineering", "ETL", "Spark", "Power BI", "Tableau",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Linux", "Terraform",
  "Full Stack", "Frontend", "Backend", "Software Testing", "Selenium",
].map((term) => ({
  term,
  pattern: new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`,
    "iu",
  ),
}));

export function jobKeywords(job: Job): { terms: string[]; source: "listing" | "description" | "title" } {
  const unique = new Map<string, string>();
  for (const keyword of job.keywords ?? []) {
    const cleaned = keyword.trim();
    if (cleaned && !unique.has(cleaned.toLowerCase())) {
      unique.set(cleaned.toLowerCase(), cleaned);
    }
  }
  if (unique.size > 0) return { terms: [...unique.values()], source: "listing" };

  const description = job.description?.trim();
  if (description) {
    const terms = atsTerms
      .filter(({ pattern }) => pattern.test(description))
      .slice(0, 12)
      .map(({ term }) => term);
    if (terms.length > 0) return { terms, source: "description" };
  }

  const terms = job.category === "Other" || job.title.toLowerCase() === job.category.toLowerCase()
    ? [job.title]
    : [job.title, job.category];
  return { terms, source: "title" };
}

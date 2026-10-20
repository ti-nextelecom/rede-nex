import { fetchProjects, fetchProjectSteps, type ProjectStep } from './projectsApi';
import { personalizeProjects } from '../../shared/personalWork.mjs';

export async function fetchPersonalProjects(user: { id: string; name?: string }) {
  const projects = await fetchProjects();
  const steps: Record<string, ProjectStep[]> = {};
  // Bounded concurrency: don't flood the API on large project portfolios.
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, projects.length) }, async () => {
    while (next < projects.length) {
      const project = projects[next++];
      try { steps[project.id] = await fetchProjectSteps(project.id); }
      catch { /* Unknown is not zero pending; the UI explicitly displays it. */ }
    }
  }));
  return { projects: personalizeProjects(projects, steps, user), incomplete: Object.keys(steps).length !== projects.length };
}

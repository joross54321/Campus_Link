/** Canonical colleges — store `name` on users and subjects in Firestore. Use `id` in admin UI selects only. */

export interface CollegeDefinition {
  id: string;
  name: string;
  icon: string;
  programs: string[];
}

export const COLLEGES: CollegeDefinition[] = [
  {
    id: 'CCI',
    name: 'College of Computing and Informatics',
    icon: '💻',
    programs: ['BS Computer Science', 'BS Information Technology', 'BS Data Science'],
  },
  {
    id: 'CEA',
    name: 'College of Engineering and Architecture',
    icon: '🏗️',
    programs: ['BS Civil Engineering', 'BS Architecture', 'BS Electrical Engineering'],
  },
  {
    id: 'CED',
    name: 'College of Education',
    icon: '📖',
    programs: ['BE Elementary Education', 'BS Secondary Education'],
  },
  {
    id: 'CIT',
    name: 'College of Industrial Technology',
    icon: '🛠️',
    programs: ['BS Industrial Technology', 'BS Automotive Technology'],
  },
  {
    id: 'CAS',
    name: 'College of Arts and Sciences',
    icon: '🔬',
    programs: ['BS Biology', 'BS Mathematics', 'BA English'],
  },
];

export const COLLEGE_ENGINEERING = 'College of Engineering';

export function collegeNameById(id: string): string | undefined {
  return COLLEGES.find((c) => c.id === id)?.name;
}

export function collegeIdByName(name: string): string | undefined {
  return COLLEGES.find((c) => c.name === name)?.id;
}

export function buildSubjectDocId(code: string, section: string): string {
  return `${code.replace(/\s+/g, '')}-${section.replace(/\s+/g, '')}`;
}

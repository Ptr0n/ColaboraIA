
export interface Analysis {
  topic: string;
  objectives: string[];
  competencies: string[];
}

export interface Group {
  groupNumber: number;
  students: {
    name: string;
    role: string;
  }[];
  computer: number;
}

export interface GroupDistribution {
  totalGroups: number;
  groups: Group[];
}

export interface CollaborativeRole {
  roleName: string;
  description: string;
  responsibilities: string[];
}

export interface RubricCriterion {
  level: string;
  description: string;
}

export interface Rubric {
  role: string;
  criteria: RubricCriterion[];
}

export interface EvaluationTools {
  rubric: Rubric[];
  checklist: string[];
}

export interface Strategy {
  analysis: Analysis;
  strategy: {
    groupDistribution: GroupDistribution;
    collaborativeRoles: CollaborativeRole[];
    mitigationStrategies?: string;
    offlineResources?: string;
  };
  evaluationTools: EvaluationTools;
}

export interface Configuration {
    studentCount: number;
    computerCount: number;
    connectivity: 'online' | 'offline';
    classPlan: {
        mimeType: string;
        data: string; // base64 encoded
    };
    studentNames: string[];
}

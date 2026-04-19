export interface FieldCandidate {
  id: string;
  name: string;
}

export const resolveFieldNamesFromCandidates = (
  readMetaCandidates: () => FieldCandidate[],
  readFieldListCandidates: () => FieldCandidate[],
): FieldCandidate[] => {
  try {
    return readMetaCandidates();
  } catch {
    return readFieldListCandidates();
  }
};

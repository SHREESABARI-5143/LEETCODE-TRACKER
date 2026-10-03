export function normalizeProctorName(rawName: string | null | undefined): string {
  if (!rawName) return '';
  
  // 1. Lowercase
  let name = rawName.toLowerCase();
  
  // 2. Strip titles
  // Matches "mr.", "mr ", "mrs.", "mrs ", "ms.", "ms ", "dr.", "dr ", "prof.", "prof "
  name = name.replace(/\b(mrs|mr|ms|prof|dr)\.?\s*/g, '');
  
  // 3. Strip trailing designation/department like ", AP/CSE" or " - AsP/ECE"
  // Match a comma or dash, followed by optional spaces, then AP, AsP, etc.
  name = name.replace(/[,|-]\s*(ap|asp|prof|hod)\b.*?$/g, '');
  name = name.replace(/\b(ap|asp)\s*\/\s*[a-z]+\b/g, '');
  
  // 4. Remove all punctuation and spaces
  name = name.replace(/[^a-z0-9]/g, '');
  
  return name;
}

export function fuzzyMatchProctor(normalizedInput: string, candidateAliases: string[]): boolean {
  if (!normalizedInput || candidateAliases.length === 0) return false;
  
  // Exact match
  if (candidateAliases.includes(normalizedInput)) return true;
  
  // Simple Jaro-Winkler or Levenshtein can be implemented here.
  // For now, let's do a basic includes or high overlap
  for (const alias of candidateAliases) {
    if (alias.includes(normalizedInput) || normalizedInput.includes(alias)) {
      if (alias.length > 5 && normalizedInput.length > 5) {
        return true;
      }
    }
  }
  
  return false;
}

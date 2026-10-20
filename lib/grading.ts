export const TRANSMUTATION_TABLE: Record<number, number> = {
  ...Object.fromEntries(Array.from({ length: 38 }, (_, i) => [i, 70])),
  38:71, 39:71, 40:71, 41:72, 42:72, 43:72, 44:73, 45:73, 46:73, 47:74, 48:74, 49:74,
  50:75, 51:75, 52:76, 53:76, 54:77, 55:77, 56:78, 57:78, 58:79, 59:79,
  60:80, 61:80, 62:81, 63:81, 64:82, 65:82, 66:83, 67:83, 68:84, 69:84,
  70:85, 71:85, 72:86, 73:86, 74:87, 75:87, 76:88, 77:88, 78:89, 79:89,
  80:90, 81:90, 82:91, 83:91, 84:92, 85:92, 86:93, 87:93, 88:94, 89:94,
  90:95, 91:95, 92:96, 93:96, 94:97, 95:97, 96:98, 97:98, 98:99, 99:99, 100:100
};

export function computeDepEdScienceGrade(
  wwScores: (number | string)[],
  wwMax: number[],
  ptScores: (number | string)[],
  ptMax: number[],
  qaScore: number | string,
  qaMax: number
) {
  // 1. Written Works (40%) - Handles 'E' (Excused)
  let wwEarned = 0, wwTotalMax = 0;
  wwScores.forEach((s, i) => {
    if (s === 'E' || s === 'e') {
      // Excused: omit from highest possible score
    } else if (s !== '' && !isNaN(Number(s))) {
      wwEarned += Number(s);
      wwTotalMax += wwMax[i];
    }
  });
  const wwPs = wwTotalMax > 0 ? Math.round((wwEarned / wwTotalMax) * 100) : 0;
  const wwWg = Math.round(wwPs * 0.40);

  // 2. Performance Tasks (40%) - Handles 'E' (Excused)
  let ptEarned = 0, ptTotalMax = 0;
  ptScores.forEach((s, i) => {
    if (s === 'E' || s === 'e') {
      // Excused
    } else if (s !== '' && !isNaN(Number(s))) {
      ptEarned += Number(s);
      ptTotalMax += ptMax[i];
    }
  });
  const ptPs = ptTotalMax > 0 ? Math.round((ptEarned / ptTotalMax) * 100) : 0;
  const ptWg = Math.round(ptPs * 0.40);

  // 3. Quarterly Assessment (20%)
  const qaEarned = (qaScore === 'E' || qaScore === '' || isNaN(Number(qaScore))) ? 0 : Number(qaScore);
  const qaPs = Math.round((qaEarned / qaMax) * 100);
  const qaWg = Math.round(qaPs * 0.20);

  // 4. Initial Grade & Transmuted Grade
  const initialGrade = Math.round(wwWg + ptWg + qaWg);
  const clamped = Math.min(100, Math.max(0, initialGrade));
  const finalGrade = TRANSMUTATION_TABLE[clamped] ?? 70;

  return { wwEarned, wwPs, wwWg, ptEarned, ptPs, ptWg, qaEarned, qaWg, initialGrade, finalGrade };
}
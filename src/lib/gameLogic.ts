/**
 * Fisher-Yates shuffle — returns a new shuffled copy of the array.
 */
export function shuffle<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick `count` random elements from an array without replacement.
 */
export function sampleN<T>(array: T[], count: number): T[] {
  return shuffle(array).slice(0, count);
}

/**
 * Assign players to two teams as evenly as possible.
 * Returns a map of playerId -> teamNumber (1 or 2).
 */
export function assignTeams(playerIds: string[]): Record<string, number> {
  const shuffled = shuffle(playerIds);
  const half = Math.ceil(shuffled.length / 2);
  const assignments: Record<string, number> = {};
  shuffled.forEach((id, i) => {
    assignments[id] = i < half ? 1 : 2;
  });
  return assignments;
}

/**
 * Build the game data for a new round.
 */
export function buildGameData(
  playerIds: string[],
  fullWordList: string[],
  wordCount = 18,
) {
  const gameWords = sampleN(fullWordList, Math.min(wordCount, fullWordList.length));
  const [team1Word, team2Word] = sampleN(gameWords, 2);
  const teamAssignments = assignTeams(playerIds);

  const playerData = playerIds.map((id) => {
    const team = teamAssignments[id];
    const assignedWord = team === 1 ? team1Word : team2Word;
    const wordOrder = shuffle(gameWords);
    return { id, team, assignedWord, wordOrder };
  });

  return {
    gameWords,
    teamWords: { 1: team1Word, 2: team2Word } as Record<number, string>,
    playerData,
  };
}

/**
 * Maximum N (number of players to name in a method-1 team declaration)
 * based on player count.
 *
 * Teams are split as evenly as possible: team 1 gets ceil(playerCount / 2)
 * players and team 2 gets the rest (see start_game_atomic). A team
 * declaration only wins if it names the declarer's team *exactly*, so the
 * cap must allow selecting a full team — i.e. the size of the larger team,
 * ceil(playerCount / 2). Capping any lower makes the larger team unable to
 * ever declare correctly (e.g. 10 players → teams of 5, but a cap of 4 can
 * never match).
 */
export function suggestedN(playerCount: number): number {
  return Math.ceil(playerCount / 2);
}

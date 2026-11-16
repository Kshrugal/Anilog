export function nextProgress(entry: any, now = Date.now()) {
  const isVn = entry.mediaType === 'vn' || entry.showType === 'Visual Novel';
  const current = Math.max(0, Number(entry.watchedEpisodes) || 0);
  const limit = isVn ? 100 : Math.max(0, Number(entry.totalEpisodes) || 0);
  if (limit && current >= limit) return null;
  const progress = limit ? Math.min(limit, current + (isVn ? 5 : 1)) : current + 1;
  const completed = limit > 0 && progress >= limit;
  return {
    isVn, progress, completed,
    changes: {
      watchedEpisodes: progress,
      updatedAt: now,
      ...(completed ? { status: 'completed', completedAt: entry.completedAt || new Date(now).toISOString().slice(0, 10) } : {}),
    },
  };
}

export function scoreSummary(entries: any[]) {
  const counts = Array(10).fill(0);
  const scores = entries.map(entry => Number(entry.score)).filter(score => Number.isFinite(score) && score > 0 && score <= 10).sort((a, b) => a - b);
  // Nearest whole-score bucket; positive scores below 1 belong in bucket 1.
  scores.forEach(score => counts[Math.max(1, Math.round(score)) - 1]++);
  const mid = Math.floor(scores.length / 2);
  return {
    counts,
    ratedCount: scores.length,
    meanScore: scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1) : '0.0',
    medianScore: scores.length ? (scores.length % 2 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2).toFixed(1) : '0.0',
    maxCount: Math.max(...counts, 1),
  };
}

export function planImport(entries: any[], existing: any[], overwrite: boolean, normalize: (title: string) => string) {
  const ids = new Set(existing.map(entry => String(entry.id || entry.kitsuId)));
  const titles = new Set(existing.map(entry => normalize(entry.title || '')).filter(Boolean));
  const seen = new Set<string>();
  return entries.map(entry => {
    const id = String(entry.kitsuId);
    const title = normalize(entry.title || '');
    const exact = ids.has(id);
    const duplicate = seen.has(id);
    seen.add(id);
    const reason = duplicate ? 'Duplicate source entry' : exact ? (overwrite ? 'Update exact ID' : 'Keep AniLog') : title && titles.has(title) ? 'Skip title-only match' : 'Add';
    return { entry, reason, importable: !duplicate && (exact ? overwrite : !(title && titles.has(title))) };
  });
}

export function importPayload(entry: any, existing?: any) {
  const payload = { ...entry };
  if (existing) {
    // Overwrite imported tracking fields, never local journal notes or settings.
    delete payload.notes;
  }
  return payload;
}

export function resetBackup(username: string, animeList: any[], activity: any[], hallOfFame: any[], exportedAt = new Date().toISOString()) {
  return { exportedAt, username, animeList, activity, hallOfFame };
}

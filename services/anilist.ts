const ANILIST_API_URL = 'https://graphql.anilist.co';

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  description(asHtml: false)
  format
  status
  episodes
  duration
  averageScore
  genres
  coverImage { extraLarge large medium color }
  bannerImage
  season
  seasonYear
  siteUrl
`;

async function queryAniList(query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(ANILIST_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json();
  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.[0]?.message || `AniList request failed (${response.status})`;
    throw new Error(message);
  }
  return payload.data;
}

function cleanDescription(description = '') {
  return description
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&');
}

export function mapAniListMedia(media: any) {
  const id = `anilist:${media.id}`;
  const title = media.title?.english || media.title?.romaji || media.title?.native || 'Unknown';
  const poster = media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '';
  return {
    id,
    provider: 'anilist',
    anilistId: media.id,
    attributes: {
      canonicalTitle: title,
      titles: media.title,
      posterImage: { original: poster, large: poster, medium: media.coverImage?.medium || poster, small: media.coverImage?.medium || poster, tiny: media.coverImage?.medium || poster },
      coverImage: { original: media.bannerImage || poster, large: media.bannerImage || poster },
      episodeCount: media.episodes || 0,
      episodeLength: media.duration || 0,
      averageRating: media.averageScore ? String(media.averageScore) : null,
      synopsis: cleanDescription(media.description),
      showType: media.format || 'Anime',
      status: media.status,
      genres: media.genres || [],
      season: media.season,
      seasonYear: media.seasonYear,
      siteUrl: media.siteUrl,
      provider: 'anilist',
      anilistId: media.id,
      studios: media.studios?.nodes || [],
      rankings: media.rankings || [],
      nextAiringEpisode: media.nextAiringEpisode || null,
      trailer: media.trailer || null,
      externalLinks: media.externalLinks || [],
      streamingEpisodes: media.streamingEpisodes || [],
      relations: (media.relations?.edges || []).map((edge: any) => ({
        relationType: edge.relationType,
        media: mapAniListMedia(edge.node),
      })),
      characters: (media.characters?.edges || []).map((edge: any) => ({
        role: edge.role,
        character: edge.node,
        voiceActor: edge.voiceActors?.[0] || null,
      })),
      recommendations: (media.recommendations?.nodes || [])
        .map((node: any) => node.mediaRecommendation)
        .filter(Boolean)
        .map(mapAniListMedia),
    },
  };
}

export async function getAniListMedia(id: string | number) {
  const numericId = Number(String(id).replace(/^anilist:/, ''));
  const data = await queryAniList(`query ($id: Int!) {
    Media(id: $id, type: ANIME, isAdult: false) {
      ${MEDIA_FIELDS}
      studios(isMain: true) { nodes { id name siteUrl } }
      rankings { rank type format year season allTime context }
      nextAiringEpisode { airingAt timeUntilAiring episode }
      trailer { id site thumbnail }
      externalLinks { id site url type icon color }
      streamingEpisodes { title thumbnail url site }
      relations { edges { relationType node { ${MEDIA_FIELDS} } } }
      characters(sort: [ROLE, FAVOURITES_DESC], perPage: 12) {
        edges { role node { id name { full native } image { large medium } siteUrl } voiceActors(language: JAPANESE) { id name { full native } image { large medium } siteUrl } }
      }
      recommendations(sort: RATING_DESC, perPage: 8) { nodes { mediaRecommendation { ${MEDIA_FIELDS} } } }
    }
  }`, { id: numericId });
  return mapAniListMedia(data.Media);
}

export async function searchAniList(search: string, perPage = 20) {
  const data = await queryAniList(`query ($search: String!, $perPage: Int!) {
    Page(page: 1, perPage: $perPage) {
      media(search: $search, type: ANIME, isAdult: false, sort: [SEARCH_MATCH, POPULARITY_DESC]) { ${MEDIA_FIELDS} }
    }
  }`, { search, perPage });
  return (data.Page?.media || []).map(mapAniListMedia);
}

export async function getAniListSeasonal(perPage = 20) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const season = month <= 3 ? 'WINTER' : month <= 6 ? 'SPRING' : month <= 9 ? 'SUMMER' : 'FALL';
  const data = await queryAniList(`query ($season: MediaSeason!, $year: Int!, $perPage: Int!) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, season: $season, seasonYear: $year, isAdult: false, sort: [POPULARITY_DESC, SCORE_DESC]) { ${MEDIA_FIELDS} }
    }
  }`, { season, year: now.getFullYear(), perPage });
  return (data.Page?.media || []).map(mapAniListMedia);
}

export async function getAniListDiscovery(perPage = 10) {
  const data = await queryAniList(`query ($perPage: Int!) {
    trending: Page(page: 1, perPage: $perPage) { media(type: ANIME, isAdult: false, sort: [TRENDING_DESC, POPULARITY_DESC]) { ${MEDIA_FIELDS} } }
    airing: Page(page: 1, perPage: $perPage) { media(type: ANIME, status: RELEASING, isAdult: false, sort: [POPULARITY_DESC, SCORE_DESC]) { ${MEDIA_FIELDS} } }
    upcoming: Page(page: 1, perPage: $perPage) { media(type: ANIME, status: NOT_YET_RELEASED, isAdult: false, sort: [POPULARITY_DESC]) { ${MEDIA_FIELDS} } }
    rated: Page(page: 1, perPage: $perPage) { media(type: ANIME, isAdult: false, sort: [SCORE_DESC, POPULARITY_DESC]) { ${MEDIA_FIELDS} } }
  }`, { perPage });
  return {
    trending: (data.trending?.media || []).map(mapAniListMedia),
    airing: (data.airing?.media || []).map(mapAniListMedia),
    upcoming: (data.upcoming?.media || []).map(mapAniListMedia),
    rated: (data.rated?.media || []).map(mapAniListMedia),
  };
}

export async function getAniListPersonalized(genres: string[], perPage = 18) {
  if (!genres.length) return [];
  const data = await queryAniList(`query ($genres: [String], $perPage: Int!) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, genre_in: $genres, isAdult: false, sort: [SCORE_DESC, POPULARITY_DESC]) { ${MEDIA_FIELDS} }
    }
  }`, { genres, perPage });
  return (data.Page?.media || []).map(mapAniListMedia);
}

function formatFuzzyDate(date: { year?: number; month?: number; day?: number } | null) {
  if (!date?.year) return null;
  return [date.year, date.month || 1, date.day || 1]
    .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, '0'))
    .join('-');
}

export async function getAniListUserAnimeList(userName: string) {
  const data = await queryAniList(`query ($userName: String!) {
    MediaListCollection(userName: $userName, type: ANIME) {
      user { id name siteUrl }
      lists {
        name
        status
        entries {
          status
          score(format: POINT_10_DECIMAL)
          progress
          repeat
          notes
          private
          updatedAt
          startedAt { year month day }
          completedAt { year month day }
          media { ${MEDIA_FIELDS} }
        }
      }
    }
  }`, { userName });

  const collection = data.MediaListCollection;
  const entries = (collection?.lists || []).flatMap((list: any) => list.entries || []);
  return {
    user: collection?.user,
    entries: entries.map((entry: any) => {
      const mapped = mapAniListMedia(entry.media);
      const statusMap: Record<string, string> = {
        CURRENT: 'watching',
        REPEATING: 'watching',
        COMPLETED: 'completed',
        PLANNING: 'planned',
        PAUSED: 'paused',
        DROPPED: 'dropped',
      };
      return {
        kitsuId: mapped.id,
        title: mapped.attributes.canonicalTitle,
        imageUrl: mapped.attributes.posterImage.original,
        totalEpisodes: mapped.attributes.episodeCount || 0,
        status: statusMap[entry.status] || 'planned',
        watchedEpisodes: entry.progress || 0,
        score: entry.score || 0,
        notes: entry.notes || '',
        genres: mapped.attributes.genres || [],
        mediaType: 'anime',
        showType: mapped.attributes.showType || '',
        provider: 'anilist',
        anilistId: entry.media.id,
        anilistUserName: collection.user.name,
        repeatCount: entry.repeat || 0,
        startedAt: formatFuzzyDate(entry.startedAt),
        completedAt: formatFuzzyDate(entry.completedAt),
        updatedAt: entry.updatedAt ? entry.updatedAt * 1000 : Date.now(),
      };
    }),
  };
}

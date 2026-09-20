import { UNSPLASH_ACCESS_KEY } from './config.js?v=4';

const isConfigured = !UNSPLASH_ACCESS_KEY.includes('YOUR-UNSPLASH');

async function searchOnce(query) {
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
    { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] ?? null;
}

// Best-effort: any failure (no key, rate limit, no results, network error)
// just means no photo — never blocks the trip from being created.
//
// Unsplash's search can return zero results for an unusual multi-word trip
// name (e.g. "Deep Balkans" or "Andalusia Golf" both get nothing) even
// though the individual words match plenty on their own — so on a miss,
// retry with just the last word, then just the first.
export async function fetchDestinationImage(name) {
  if (!isConfigured) return null;

  const words = name.trim().split(/\s+/);
  const attempts = [name];
  if (words.length > 1) {
    attempts.push(words[words.length - 1], words[0]);
  }

  try {
    for (const query of attempts) {
      const photo = await searchOnce(query);
      if (photo) {
        return {
          image_url: photo.urls.regular,
          image_credit_name: photo.user.name,
          image_credit_url: `${photo.user.links.html}?utm_source=travel-plans&utm_medium=referral`,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

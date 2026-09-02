const DRAFT_PREFIX = 'dietapp:meal-draft:v1';
const MAX_DRAFT_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const storageKey = (draftKey) => `${DRAFT_PREFIX}:${draftKey}`;

export const readMealDraft = (draftKey) => {
  if (!draftKey || typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey(draftKey));
    if (!raw) return null;

    const draft = JSON.parse(raw);
    const isValid = draft?.version === 1
      && typeof draft.mealName === 'string'
      && Array.isArray(draft.selectedItems)
      && typeof draft.savedAt === 'number';

    if (!isValid || Date.now() - draft.savedAt > MAX_DRAFT_AGE_MS) {
      window.localStorage.removeItem(storageKey(draftKey));
      return null;
    }

    return draft;
  } catch {
    return null;
  }
};

export const writeMealDraft = (draftKey, draft) => {
  if (!draftKey || typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(storageKey(draftKey), JSON.stringify({
      ...draft,
      version: 1,
      savedAt: Date.now()
    }));
  } catch {
    // A full or unavailable storage must never block meal editing.
  }
};

export const clearMealDraft = (draftKey) => {
  if (!draftKey || typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(storageKey(draftKey));
  } catch {
    // Ignore unavailable storage.
  }
};

export const hasMealDraftContent = (draft) => Boolean(
  draft?.mealName?.trim()
  || draft?.selectedItems?.length
  || Object.values(draft?.manualItem || {}).some((value) => String(value || '').trim())
);

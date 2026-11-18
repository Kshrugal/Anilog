export const libraryVisibilityLabels = {
  public: 'Everyone',
  friends: 'Mutual follows',
  private: 'Only me',
};

export type LibraryVisibility = keyof typeof libraryVisibilityLabels;

export function getLibraryVisibility(profile: { libraryVisibility?: LibraryVisibility; libraryPublic?: boolean } | undefined): LibraryVisibility {
  return profile?.libraryVisibility ?? (profile?.libraryPublic === true ? 'public' : profile?.libraryPublic === false ? 'private' : 'friends');
}

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll, getMetadata } from 'firebase/storage';
import { doc, runTransaction, getDocFromServer } from 'firebase/firestore';
import { normalizeIdentity, type ProfileIdentity } from './profile-identity';

export async function prepareProfileImage(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024 || !file.size) throw new Error('Choose a JPEG, PNG, or WebP image under 8 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000) throw new Error('Image dimensions are too large.');
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this image.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Image conversion failed.')), 'image/webp', 0.88));
    if (blob.type !== 'image/webp') throw new Error('Your browser does not support WebP image uploads. Try an updated browser.');
    if (blob.size > 5 * 1024 * 1024) throw new Error('Image is too large after compression.');
    return blob;
  } finally { bitmap.close(); }
}
export async function saveProfileIdentity(db: any, appId: string, uid: string, draft: ProfileIdentity, files: Partial<Record<'avatar' | 'banner', Blob>>, expectedRevision: number) {
  const storage = getStorage(db.app);
  const identityRef = doc(db, `artifacts/${appId}/public/data/profileIdentity/${uid}`);
  const uploaded: string[] = [];
  const value = normalizeIdentity(draft);
  let committed = false;
  try {
    for (const kind of ['avatar', 'banner'] as const) if (files[kind]) {
      const path = `profile-images/${uid}/${crypto.randomUUID()}.webp`;
      uploaded.push(path);
      await uploadBytes(ref(storage, path), files[kind], { contentType: 'image/webp', cacheControl: 'public,max-age=3600' });
      const url = (await getDownloadURL(ref(storage, path))).replace('http://127.0.0.1:9199', 'https://firebasestorage.googleapis.com');
      value[kind] = { ...draft[kind], path, url };
    }
    const replaced = await runTransaction(db, async transaction => {
      const current = await transaction.get(identityRef);
      if ((current.data()?.revision || 0) !== expectedRevision) throw new Error('Your profile changed in another window. Close and reopen the editor before saving.');
      const { showcases, ...identity } = value;
      transaction.set(identityRef, { ...identity, revision: expectedRevision + 1 });
      for (const kind of ['anime', 'vn', 'characters'] as const) {
        transaction.set(doc(identityRef, 'showcases', kind), { items: showcases[kind], revision: expectedRevision + 1 });
      }
      return [current.data()?.avatar?.path, current.data()?.banner?.path].filter((path): path is string => typeof path === 'string' && path.startsWith(`profile-images/${uid}/`) && path !== value.avatar.path && path !== value.banner.path);
    });
    committed = true;
    // Read the committed reference again before deleting anything. Old orphaned
    // uploads are retried on the next successful save, including aborted drafts.
    let cleanupPending = false;
    try {
      const current = (await getDocFromServer(identityRef)).data();
      const keep = new Set([current?.avatar?.path, current?.banner?.path]);
      const objects = await listAll(ref(storage, `profile-images/${uid}`));
      for (const object of objects.items) if (!keep.has(object.fullPath)) {
        const metadata = await getMetadata(object);
        // A grace period protects another tab's upload before its transaction.
        if (replaced.includes(object.fullPath) || Date.now() - Date.parse(metadata.timeCreated) > 60 * 60 * 1000) await deleteObject(object);
      }
    } catch { cleanupPending = true; }
    return { value, revision: expectedRevision + 1, cleanupPending };
  } catch (error) {
    if (!committed) await Promise.allSettled(uploaded.map(path => deleteObject(ref(storage, path))));
    throw error;
  }
}

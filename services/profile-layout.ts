import { MODULES, type ProfileIdentity } from './profile-identity';

const media = (key: string) => key === 'anime' || key === 'vn';
export function profileLayoutRows(identity: ProfileIdentity) {
  const ordered = [...identity.modules, ...MODULES.filter(key => !identity.modules.includes(key))];
  const first = ordered.find(media);
  return ordered.filter(key => identity.mediaLayout !== 'combined' || !media(key) || key === first);
}
export function toggleProfileModule(identity: ProfileIdentity, key: string, enabled: boolean) {
  const targets = identity.mediaLayout === 'combined' && media(key) ? ['anime', 'vn'] : [key];
  const kept = identity.modules.filter(value => !targets.includes(value));
  return enabled ? [...kept, ...targets] : kept;
}
export function moveProfileModule(identity: ProfileIdentity, key: string, direction: number) {
  const groups = profileLayoutRows(identity).filter(value => identity.modules.includes(value)).map(value => identity.mediaLayout === 'combined' && media(value) ? identity.modules.filter(media) : [value]);
  const index = groups.findIndex(group => group.includes(key));
  if (index < 0 || index + direction < 0 || index + direction >= groups.length) return identity.modules;
  [groups[index], groups[index + direction]] = [groups[index + direction], groups[index]];
  return groups.flat();
}

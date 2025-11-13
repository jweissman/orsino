export default function deepCopy(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Array) return obj.map(item => deepCopy(item));
  
  const copy: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      copy[key] = deepCopy(obj[key]);
    }
  }
  return copy;
}
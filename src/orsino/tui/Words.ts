export default class Words {
  static capitalize = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1);
  static humanizeList = (arr: string[]): string => {
    if (arr.length === 0) return '';
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
    return `${arr.slice(0, -1).join(', ')}, and ${arr[arr.length - 1]}`;
  }
}
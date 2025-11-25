export default class Words {
  static humanize(phrase: string) {
    return phrase.replace(/([A-Z])/g, ' $1') // Add space before capital letters
                  .replace(/[_-]+/g, ' ')    // Replace underscores and hyphens with spaces
                  .toLowerCase()             // Convert to lowercase
                  .replace(/\b\w/g, char => char.toUpperCase()) // Capitalize first letter of each word
                  .trim();                   // Trim leading/trailing spaces
  }

  static a_an(phrase: string): string {
    const firstLetter = phrase.trim().charAt(0).toLowerCase();
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    const article = vowels.includes(firstLetter) ? 'an' : 'a';
    return `${article} ${phrase}`;
  }
  static capitalize = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1);
  static humanizeList = (arr: string[]): string => {
    if (arr.length === 0) return '';
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
    return `${arr.slice(0, -1).join(', ')}, and ${arr[arr.length - 1]}`;
  }

  static remove_article(phrase: string): string {
    return phrase.replace(/^(a|an|the)\s+/i, '');
  }
}
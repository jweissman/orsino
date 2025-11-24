export default class Sample {
  static count<T>(n: number, ...items: T[]): T[] {
    const results: any[] = [];
    const population = [...items];
    for (let i = 0; i < n; i++) {
      const item = population[Math.floor(Math.random() * population.length)];
      population.splice(population.indexOf(item), 1);
      console.log(`Sampled item: ${item}`);
      results.push(item);
    }
    console.log(`Sampled ${n} items: ${results.join(", ")}`);
    return results;
  }
}

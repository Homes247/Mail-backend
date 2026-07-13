function testFraction(numStr) {
    const num = Number(numStr);
    const whole = Math.floor(num);
    const dec = num - whole;
    if (dec === 0) return String(whole);

    let denom = 9;

    let h1 = 1, h2 = 0, k1 = 0, k2 = 1, b = dec;
    do {
      const a = Math.floor(b);
      let aux = h1; h1 = a * h1 + h2; h2 = aux;
      aux = k1; k1 = a * k1 + k2; k2 = aux;
      b = 1 / (b - a);
    } while (Math.abs(dec - h1 / k1) > dec * 1.0E-6 && k1 <= denom);

    if (k1 > denom) {
      h1 = h2; k1 = k2;
    }
    return (whole !== 0 ? whole + ' ' : '') + h1 + '/' + k1;
}

console.log(testFraction('-0.5'));
console.log(testFraction('-0.25'));
console.log(testFraction('-1.5'));

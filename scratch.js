function format(val, formatType) {
    const decVal = 0; // default dec
    let applyNumFormatVal = val;
    if (formatType === 'percent') applyNumFormatVal = (Number(val) * 100).toFixed(decVal) + '%';
    else if (formatType === 'number') applyNumFormatVal = Number(val).toFixed(decVal);
    else applyNumFormatVal = decVal > 0 ? Number(val).toFixed(decVal) : val;

    val = applyNumFormatVal;
    
    const isNum = !isNaN(Number(val)) && val !== '';
    const num = isNum ? Number(val) : 0;
    
    if (formatType === 'scientific') return isNum ? num.toExponential(2) : val;
    if (formatType === 'text') return String(val);
    
    if (formatType.startsWith('fraction')) {
      if (!isNum) return val;
      const whole = Math.floor(num);
      const dec = num - whole;
      if (dec === 0) return String(whole);

      let denom = 10;
      if (formatType === 'fraction_1') denom = 9;
      if (formatType === 'fraction_2') denom = 99;
      if (formatType === 'fraction_3') denom = 999;

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
    return val;
}
console.log(format('0.3333333333333333', 'fraction_1'));
console.log(format('0.1', 'fraction_1'));
